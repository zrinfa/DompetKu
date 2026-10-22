<?php
// DompetKu Telemetry Collector
// POST JSON ke file ini dari telemetry.js (frontend).
// Menyimpan: nama usaha, fingerprint device, datetime, status Google,
// email/nama Google, sumber pencatatan (manual/ai/nota/telpon/transfer),
// jam penggunaan, tab, dsb.

header('Content-Type: application/json; charset=utf-8');

// CORS: izinkan origin yang sama. Untuk PWA/file:// tetap terima.
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

require_once __DIR__ . '/config.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad json']);
    exit;
}

// Dukung batch: {events:[...]} atau single event {...}
$events = [];
if (isset($data['events']) && is_array($data['events'])) {
    $events = $data['events'];
} else {
    $events = [$data];
}
// Batasi 50 event per request agar ringan
$events = array_slice($events, 0, 50);
if (count($events) === 0) {
    echo json_encode(['ok' => true, 'saved' => 0]);
    exit;
}

$conn = db_connect();
if (!$conn) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'db connect failed (cek DB_HOST di config.php)']);
    exit;
}

$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ip = trim(explode(',', (string)$ip)[0]);
if (strlen($ip) > 45) $ip = substr($ip, 0, 45);
$uaHeader = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 1000);

function s($v, $max = 190) {
    if ($v === null) return null;
    $v = trim((string)$v);
    if ($v === '') return null;
    if (strlen($v) > $max) $v = substr($v, 0, $max);
    return $v;
}
function i($v) {
    if ($v === null || $v === '') return null;
    if (!is_numeric($v)) return null;
    return (int)$v;
}
function parseClientTime($v) {
    if (!$v) return null;
    try {
        $dt = new DateTime((string)$v);
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) { return null; }
}

$saved = 0;
foreach ($events as $e) {
    if (!is_array($e)) continue;
    $eventType = s($e['event'] ?? $e['event_type'] ?? 'unknown', 40) ?? 'unknown';
    $allowed = ['app_open','heartbeat','tx_saved','google_linked','google_unlinked','tab_view','profile_created','backup_done'];
    if (!in_array($eventType, $allowed, true)) $eventType = 'unknown';

    $userKey   = s($e['user_key'] ?? '', 64) ?? 'anon';
    $deviceId  = s($e['device_id'] ?? '', 64) ?? 'unknown';
    $biz       = s($e['business_name'] ?? 'DompetKu', 120) ?? 'DompetKu';
    $source    = s($e['source'] ?? '', 20) ?? '';
    $allowedSrc = ['manual','ai','nota','telpon','transfer',''];
    if (!in_array($source, $allowedSrc, true)) $source = '';
    $hour      = i($e['hour_local'] ?? null);
    if ($hour !== null && ($hour < 0 || $hour > 23)) $hour = null;
    $clientTime = parseClientTime($e['client_time'] ?? null);
    $gLinked   = !empty($e['google_linked']) ? 1 : 0;
    $gEmail    = s($e['google_email'] ?? null, 190);
    $gName     = s($e['google_name'] ?? null, 190);
    $amount    = i($e['amount'] ?? null);
    $txType    = s($e['tx_type'] ?? null, 20);
    $entity    = s($e['entity'] ?? null, 20);
    $tab       = s($e['tab'] ?? $e['tab_name'] ?? null, 40);
    $appVer    = s($e['app_version'] ?? null, 40);

    // --- fingerprint (hanya untuk app_open / heartbeat agar hemat) ---
    $fp = (isset($e['fingerprint']) && is_array($e['fingerprint'])) ? $e['fingerprint'] : null;

    // 1) upsert telemetry_users
    $stmt = $conn->prepare("INSERT INTO telemetry_users
        (user_key, business_name, google_email, google_name, google_linked, first_seen, last_seen, tx_total, tx_manual, tx_ai, tx_nota, tx_telpon, tx_transfer, app_opens)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW(), 0,0,0,0,0,0,0)
        ON DUPLICATE KEY UPDATE
          business_name = VALUES(business_name),
          google_email = COALESCE(VALUES(google_email), google_email),
          google_name = COALESCE(VALUES(google_name), google_name),
          google_linked = VALUES(google_linked),
          last_seen = NOW()");
    if ($stmt) {
        $stmt->bind_param('ssssi', $userKey, $biz, $gEmail, $gName, $gLinked);
        $stmt->execute();
        $stmt->close();
    }

    // counter tambahan
    if ($eventType === 'app_open') {
        $conn->query("UPDATE telemetry_users SET app_opens = app_opens + 1 WHERE user_key='" . $conn->real_escape_string($userKey) . "'");
    }
    if ($eventType === 'tx_saved') {
        $col = null;
        if ($source === 'manual') $col = 'tx_manual';
        elseif ($source === 'ai') $col = 'tx_ai';
        elseif ($source === 'nota') $col = 'tx_nota';
        elseif ($source === 'telpon') $col = 'tx_telpon';
        elseif ($source === 'transfer') $col = 'tx_transfer';
        $uk = $conn->real_escape_string($userKey);
        if ($col) $conn->query("UPDATE telemetry_users SET tx_total = tx_total + 1, $col = $col + 1 WHERE user_key='$uk'");
        else $conn->query("UPDATE telemetry_users SET tx_total = tx_total + 1 WHERE user_key='$uk'");
    }

    // 2) upsert telemetry_devices (hanya jika ada fingerprint/device_id valid)
    if ($deviceId !== 'unknown' && $fp !== null) {
        $fpHash = s($fp['hash'] ?? '', 64) ?? '';
        $platform = s($fp['platform'] ?? null, 120);
        $lang = s($fp['language'] ?? null, 20);
        $tz = s($fp['timezone'] ?? null, 80);
        $screen = s($fp['screen'] ?? null, 30);
        $cores = i($fp['cores'] ?? null);
        $mem = s($fp['memory'] ?? null, 20);
        $touch = i($fp['touch'] ?? null);
        $isPwa = !empty($fp['is_pwa']) ? 1 : 0;
        $canvas = s($fp['canvas'] ?? null, 64);
        $ua = s($fp['user_agent'] ?? $uaHeader, 1000);
        $stmt2 = $conn->prepare("INSERT INTO telemetry_devices
            (device_id, user_key, fingerprint_hash, user_agent, platform, language, timezone, screen, cores, memory_gb, touch_points, is_pwa, canvas_fp, ip, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              fingerprint_hash = VALUES(fingerprint_hash), user_agent = VALUES(user_agent),
              platform = VALUES(platform), language = VALUES(language), timezone = VALUES(timezone),
              screen = VALUES(screen), cores = VALUES(cores), memory_gb = VALUES(memory_gb),
              touch_points = VALUES(touch_points), is_pwa = VALUES(is_pwa), canvas_fp = VALUES(canvas_fp),
              ip = VALUES(ip), last_seen = NOW()");
        if ($stmt2) {
            // bind: s s s s s s s s i s i i s s  (14 params)
            $coresV = $cores === null ? null : (int)$cores;
            $touchV = $touch === null ? null : (int)$touch;
            $stmt2->bind_param('ssssssssisiiss',
                $deviceId, $userKey, $fpHash, $ua, $platform, $lang, $tz, $screen,
                $coresV, $mem, $touchV, $isPwa, $canvas, $ip);
            $stmt2->execute();
            $stmt2->close();
        }
    }

    // 3) insert event
    $stmt3 = $conn->prepare("INSERT INTO telemetry_events
        (user_key, device_id, business_name, event_type, source, hour_local, client_time, google_linked, google_email, google_name, amount, tx_type, entity, tab_name, app_version, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if ($stmt3) {
        // 17 kolom: s s s s s i s i s s i s s s s s s
        $stmt3->bind_param('sssssisississssss',
            $userKey, $deviceId, $biz, $eventType, $source, $hour, $clientTime,
            $gLinked, $gEmail, $gName, $amount, $txType, $entity, $tab, $appVer, $ip, $uaHeader);
        $stmt3->execute();
        $stmt3->close();
        $saved++;
    }
}

$conn->close();
echo json_encode(['ok' => true, 'saved' => $saved]);
