<?php
// Laporan Pemantauan Penggunaan Aplikasi DompetKu
// Buka: https://dompetku.csproject.org/backend/report.php?key=KUNCI_RAHASIA
// Kunci admin dibaca dari backend/config.local.php (ADMIN_KEY).
// Ekspor CSV: ?key=...&format=csv&type=users|events|daily&days=30

require_once __DIR__ . '/config.php';

$key = isset($_GET['key']) && is_scalar($_GET['key']) ? (string)$_GET['key'] : '';
if ($key === '' || !defined('ADMIN_KEY') || !hash_equals((string)ADMIN_KEY, $key)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    die('Akses ditolak. Tambahkan ?key= yang benar.');
}

header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

$conn = db_connect();
if (!$conn) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    die('Gagal konek DB. Cek backend/config.local.php (DB_HOST/USER/PASS/NAME).');
}

// Identitas penyusun laporan.
$REPORT_AUTHOR = 'Fazrin Mauza Dwi Zuhudi';
$REPORT_NIM = '24050974090';
$REPORT_PROGRAM = 'S1 Pendidikan Teknologi Informasi';
$REPORT_INSTITUTION = 'Universitas Negeri Surabaya';
$REPORT_YEAR = '2026';

function q1($conn, $sql) {
    $r = $conn->query($sql);
    if (!$r) return null;
    $row = $r->fetch_assoc();
    $r->free();
    return $row;
}
function qa($conn, $sql) {
    $out = [];
    $r = $conn->query($sql);
    if (!$r) return $out;
    while ($row = $r->fetch_assoc()) $out[] = $row;
    $r->free();
    return $out;
}
function e($v) { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8'); }
function num($v) { return number_format((int)($v ?? 0), 0, ',', '.'); }
function rupiah($v) { return 'Rp ' . number_format((int)($v ?? 0), 0, ',', '.'); }
function persen($part, $total) {
    if ($total <= 0) return '0';
    $value = (float)$part / (float)$total * 100;
    $text = number_format($value, 1, ',', '.');
    $text = rtrim(rtrim($text, '0'), ',');
    return $text === '' ? '0' : $text;
}
function tanggal_id($ymd) {
    if (!$ymd) return 'Tidak tersedia';
    $ts = strtotime((string)$ymd);
    if (!$ts) return (string)$ymd;
    $bulan = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return date('j', $ts) . ' ' . $bulan[(int)date('n', $ts)] . ' ' . date('Y', $ts);
}
function tanggal_waktu_id($dt) {
    if (!$dt) return 'Tidak tersedia';
    $ts = strtotime((string)$dt);
    if (!$ts) return (string)$dt;
    return tanggal_id(date('Y-m-d', $ts)) . ', pukul ' . date('H.i', $ts);
}
function tanggal_singkat_id($dt) {
    if (!$dt) return 'Tidak tersedia';
    $ts = strtotime((string)$dt);
    if (!$ts) return (string)$dt;
    $bulan = [1 => 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return date('j', $ts) . ' ' . $bulan[(int)date('n', $ts)] . ' ' . date('Y', $ts);
}
function sumber_label($s) {
    $map = [
        'manual' => 'Input Manual',
        'ai' => 'Catat Cepat AI',
        'nota' => 'Pemindaian Nota',
        'telpon' => 'Telepon AI',
        'transfer' => 'Transfer',
        '' => 'Tidak Terklasifikasi',
    ];
    return $map[$s] ?? ($s !== '' ? ucfirst((string)$s) : 'Tidak Terklasifikasi');
}
function tab_label($t) {
    $map = [
        'tab-dashboard' => 'Dasbor',
        'tab-transaksi' => 'Transaksi',
        'tab-laporan' => 'Laporan',
        'tab-pengaturan' => 'Pengaturan',
    ];
    return $map[$t] ?? ($t ? ucfirst(str_replace('tab-', '', (string)$t)) : 'Tidak diketahui');
}
function device_type($platform, $ua) {
    $p = strtolower((string)$platform);
    $u = strtolower((string)$ua);
    if (strpos($u, 'android') !== false || strpos($p, 'android') !== false) return 'Android';
    if (strpos($u, 'iphone') !== false || strpos($u, 'ipad') !== false || strpos($p, 'iphone') !== false || strpos($p, 'ipad') !== false) return 'iOS';
    if (strpos($p, 'mac') !== false) return 'macOS';
    if (strpos($p, 'win') !== false) return 'Windows';
    if (strpos($p, 'linux') !== false) return 'Linux';
    return $platform ? (string)$platform : 'Tidak diketahui';
}
function mask_email($email) {
    $email = trim((string)$email);
    if ($email === '') return '';
    $at = strpos($email, '@');
    if ($at === false) return mask_key($email);
    $local = substr($email, 0, $at);
    $domain = substr($email, $at);
    return substr($local, 0, 4) . '**' . $domain;
}
function mask_key($value) {
    $value = (string)$value;
    if ($value === '') return '';
    return substr($value, 0, 4) . '********';
}
function pii_span($real, $masked) {
    $real = (string)$real;
    if ($real === '') return '<span class="muted">Tidak tersedia</span>';
    return '<span class="pii" data-real="' . e($real) . '" data-masked="' . e($masked) . '">' . e($masked) . '</span>';
}
function google_badge($linked) {
    return $linked
        ? '<span class="badge badge-green">Tertaut</span>'
        : '<span class="badge badge-gray">Belum Tertaut</span>';
}

$days = isset($_GET['days']) && is_scalar($_GET['days']) ? (int)$_GET['days'] : 30;
$days = max(1, min(365, $days));
$format = strtolower(isset($_GET['format']) && is_scalar($_GET['format']) ? (string)$_GET['format'] : '');
$type = strtolower(isset($_GET['type']) && is_scalar($_GET['type']) ? (string)$_GET['type'] : 'users');

$periodEndDate = date('Y-m-d');
$periodStartDate = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
$periodLabel = tanggal_id($periodStartDate) . ' sampai ' . tanggal_id($periodEndDate);
$generatedAt = tanggal_waktu_id(date('Y-m-d H:i:s'));
$since = "server_time >= '" . $periodStartDate . " 00:00:00' AND server_time < DATE_ADD('" . $periodEndDate . "', INTERVAL 1 DAY)";

// ---------------------------------------------------------------- CSV export
if ($format === 'csv') {
    $allowedTypes = ['users', 'events', 'daily'];
    if (!in_array($type, $allowedTypes, true)) $type = 'users';

    if ($type === 'users') {
        $rows = qa($conn, "SELECT user_key, business_name, google_email, google_name, google_linked,
            first_seen, last_seen, tx_total, tx_manual, tx_ai, tx_nota, tx_telpon, tx_transfer, app_opens
            FROM telemetry_users ORDER BY last_seen DESC LIMIT 5000");
        $head = ['user_key','business_name','google_email','google_name','google_linked','first_seen','last_seen',
            'tx_total','tx_manual','tx_ai','tx_nota','tx_telpon','tx_transfer','app_opens'];
    } elseif ($type === 'daily') {
        $rows = qa($conn, "SELECT DATE(server_time) AS tanggal, COUNT(*) AS events,
            SUM(event_type='app_open') AS app_opens, SUM(event_type='tx_saved') AS tx_saved,
            SUM(event_type='heartbeat') AS heartbeat, COUNT(DISTINCT user_key) AS users
            FROM telemetry_events WHERE $since GROUP BY DATE(server_time) ORDER BY tanggal");
        $head = ['tanggal','events','app_opens','tx_saved','heartbeat','users'];
    } else {
        $rows = qa($conn, "SELECT server_time, client_time, business_name, user_key, device_id,
            event_type, source, hour_local, google_linked, google_email, amount, tx_type, entity, tab_name, app_version, ip
            FROM telemetry_events WHERE $since ORDER BY id DESC LIMIT 10000");
        $head = ['server_time','client_time','business_name','user_key','device_id','event_type','source',
            'hour_local','google_linked','google_email','amount','tx_type','entity','tab_name','app_version','ip'];
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="dompetku-' . $type . '-' . date('Ymd-His') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, $head, ',', '"', '');
    foreach ($rows as $r) {
        $line = [];
        foreach ($head as $h) $line[] = $r[$h] ?? '';
        fputcsv($out, $line, ',', '"', '');
    }
    fclose($out);
    $conn->close();
    exit;
}

// ------------------------------------------------------------------ Ringkasan
$tot = q1($conn, "SELECT COUNT(*) c, SUM(google_linked) glink, SUM(tx_total) tx, SUM(app_opens) opens FROM telemetry_users");
$dev = q1($conn, "SELECT COUNT(*) c, COUNT(DISTINCT device_id) d FROM telemetry_devices");
$ev  = q1($conn, "SELECT COUNT(*) c FROM telemetry_events WHERE $since");
$active7 = q1($conn, "SELECT COUNT(DISTINCT user_key) c FROM telemetry_events WHERE server_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
$new7 = q1($conn, "SELECT COUNT(*) c FROM telemetry_users WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
$amount = q1($conn, "SELECT SUM(amount) s FROM telemetry_events WHERE $since AND event_type='tx_saved' AND amount IS NOT NULL");

// Sesi: kelompokkan event per user dan device, jeda lebih dari 30 menit dianggap sesi baru.
$sessions = q1($conn, "SELECT COUNT(*) AS sessions, ROUND(AVG(dur_min), 1) AS avg_min, ROUND(AVG(ev), 1) AS avg_events
    FROM (
        SELECT user_key, device_id, grp,
               TIMESTAMPDIFF(MINUTE, MIN(server_time), MAX(server_time)) AS dur_min,
               COUNT(*) AS ev
        FROM (
            SELECT user_key, device_id, server_time,
                   SUM(is_new) OVER (PARTITION BY user_key, device_id ORDER BY server_time) AS grp
            FROM (
                SELECT user_key, device_id, server_time,
                       CASE WHEN LAG(server_time) OVER (PARTITION BY user_key, device_id ORDER BY server_time) IS NULL
                             OR TIMESTAMPDIFF(MINUTE, LAG(server_time) OVER (PARTITION BY user_key, device_id ORDER BY server_time), server_time) > 30
                            THEN 1 ELSE 0 END AS is_new
                FROM telemetry_events
                WHERE $since AND device_id NOT IN ('', 'unknown')
            ) a
        ) b
        GROUP BY user_key, device_id, grp
    ) c");

$srcTotal = qa($conn, "SELECT source, COUNT(*) c FROM telemetry_events
  WHERE event_type='tx_saved' AND $since GROUP BY source ORDER BY c DESC");
$srcAll = q1($conn, "SELECT SUM(tx_manual) m, SUM(tx_ai) a, SUM(tx_nota) n, SUM(tx_telpon) t, SUM(tx_transfer) tr FROM telemetry_users");

$daily = qa($conn, "SELECT DATE(server_time) d, COUNT(*) c,
    SUM(event_type='app_open') opens, SUM(event_type='tx_saved') tx
  FROM telemetry_events WHERE $since GROUP BY DATE(server_time) ORDER BY d");
$dailyMap = [];
foreach ($daily as $r) $dailyMap[$r['d']] = $r;

$hours = qa($conn, "SELECT hour_local h, COUNT(*) c FROM telemetry_events
  WHERE $since AND hour_local IS NOT NULL GROUP BY hour_local ORDER BY hour_local");
$hmap = array_fill(0, 24, 0);
foreach ($hours as $h) $hmap[(int)$h['h']] = (int)$h['c'];

$tabs = qa($conn, "SELECT tab_name t, COUNT(*) c FROM telemetry_events
  WHERE event_type='tab_view' AND $since GROUP BY tab_name ORDER BY c DESC LIMIT 10");

$users = qa($conn, "SELECT user_key, business_name, google_email, google_name, google_linked,
  tx_total, tx_manual, tx_ai, tx_nota, tx_telpon, tx_transfer, app_opens, first_seen, last_seen
  FROM telemetry_users ORDER BY last_seen DESC LIMIT 20");

$devices = qa($conn, "SELECT device_id, user_key, platform, user_agent, language, timezone, screen, cores,
  touch_points, is_pwa, ip, first_seen, last_seen FROM telemetry_devices ORDER BY last_seen DESC LIMIT 20");

$platforms = qa($conn, "SELECT CASE
    WHEN LOWER(COALESCE(platform, '')) LIKE '%android%' OR LOWER(COALESCE(user_agent, '')) LIKE '%android%' THEN 'Android'
    WHEN LOWER(COALESCE(platform, '')) LIKE '%iphone%' OR LOWER(COALESCE(platform, '')) LIKE '%ipad%'
         OR LOWER(COALESCE(user_agent, '')) LIKE '%iphone%' OR LOWER(COALESCE(user_agent, '')) LIKE '%ipad%' THEN 'iOS'
    WHEN LOWER(COALESCE(platform, '')) LIKE '%mac%' THEN 'macOS'
    WHEN LOWER(COALESCE(platform, '')) LIKE '%win%' THEN 'Windows'
    WHEN LOWER(COALESCE(platform, '')) LIKE '%linux%' THEN 'Linux'
    ELSE COALESCE(NULLIF(platform, ''), 'Tidak diketahui')
  END AS tipe, COUNT(*) c
  FROM telemetry_devices GROUP BY tipe ORDER BY c DESC LIMIT 5");

// ------------------------------------------------------------------ Turunan
$totalUsers = (int)($tot['c'] ?? 0);
$totalGoogle = (int)($tot['glink'] ?? 0);
$totalTx = (int)($tot['tx'] ?? 0);
$totalOpens = (int)($tot['opens'] ?? 0);
$totalDevices = (int)($dev['d'] ?? 0);
$totalEvents = (int)($ev['c'] ?? 0);
$totalAmount = (int)($amount['s'] ?? 0);
$activeUsers = (int)($active7['c'] ?? 0);
$newUsers = (int)($new7['c'] ?? 0);
$totalSessions = (int)($sessions['sessions'] ?? 0);
$avgSession = $sessions['avg_min'] ?? null;
$avgSessionEvents = $sessions['avg_events'] ?? null;
$txPeriod = 0;
foreach ($srcTotal as $r) $txPeriod += (int)$r['c'];
$eventsPerDay = $totalEvents > 0 ? $totalEvents / $days : 0;
$googlePct = persen($totalGoogle, $totalUsers);
$activePct = persen($activeUsers, $totalUsers);

$sourceTopLabel = $srcTotal ? sumber_label($srcTotal[0]['source']) : 'Tidak Terklasifikasi';
$sourceTopCount = $srcTotal ? (int)$srcTotal[0]['c'] : 0;
$sourceTopPct = persen($sourceTopCount, $txPeriod);

$busiestDate = '';
$busiestCount = 0;
foreach ($dailyMap as $d => $r) {
    if ((int)$r['c'] > $busiestCount) {
        $busiestCount = (int)$r['c'];
        $busiestDate = $d;
    }
}
$busiestDayLabel = $busiestDate ? tanggal_id($busiestDate) : 'belum tersedia';
$peakHourValue = max($hmap);
$peakHour = $totalEvents > 0 && $peakHourValue > 0 ? array_search($peakHourValue, $hmap) : null;
$peakHourLabel = $peakHour !== null ? sprintf('%02d.00 sampai %02d.00', (int)$peakHour, ((int)$peakHour + 1) % 24) : 'belum tersedia';

$topTabLabel = $tabs ? tab_label($tabs[0]['t']) : 'Dasbor';
$topTabCount = $tabs ? (int)$tabs[0]['c'] : 0;
$topPlatformLabel = $platforms ? $platforms[0]['tipe'] : 'Tidak diketahui';

$avgSessionLabel = $avgSession !== null ? number_format((float)$avgSession, 1, ',', '.') : '0';
$avgSessionEventsLabel = $avgSessionEvents !== null ? number_format((float)$avgSessionEvents, 1, ',', '.') : '0';

$dayKeys = [];
for ($i = $days - 1; $i >= 0; $i--) $dayKeys[] = date('Y-m-d', strtotime('-' . $i . ' days'));

// ------------------------------------------------------------------ Grafik
$chartSourceLabels = [];
$chartSourceData = [];
foreach ($srcTotal as $r) {
    $chartSourceLabels[] = sumber_label($r['source']);
    $chartSourceData[] = (int)$r['c'];
}

$chartDailyLabels = [];
$chartDailyData = [];
foreach ($dayKeys as $d) {
    $count = (int)($dailyMap[$d]['c'] ?? 0);
    $chartDailyLabels[] = date('d/m', strtotime($d));
    $chartDailyData[] = $count;
}

$chartHourLabels = [];
for ($h = 0; $h < 24; $h++) $chartHourLabels[] = sprintf('%02d.00', $h);

$chartTabLabels = [];
$chartTabData = [];
foreach ($tabs as $r) {
    $chartTabLabels[] = tab_label($r['t']);
    $chartTabData[] = (int)$r['c'];
}

// ------------------------------------------------------------------ JSON
$jsonFlags = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="data:,">
<title>Laporan Pemantauan Penggunaan Aplikasi DompetKu</title>
<link rel="stylesheet" href="../assets/fa/css/all.min.css">
<style>
:root {
    --green-900: #14532d;
    --green-800: #166534;
    --green-700: #15803d;
    --green-600: #16a34a;
    --green-100: #dcfce7;
    --green-50: #f0fdf4;
    --page: #f4f9f5;
    --card: #ffffff;
    --border: #d8e8dd;
    --text: #1f2937;
    --muted: #64748b;
    --amber: #d97706;
    --shadow: 0 8px 24px rgba(20, 83, 45, 0.07);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
    margin: 0;
    padding: 24px 16px 48px;
    background:
        radial-gradient(circle at top left, rgba(22, 163, 74, 0.08), transparent 28%),
        radial-gradient(circle at bottom right, rgba(13, 148, 136, 0.06), transparent 30%),
        var(--page);
    color: var(--text);
    font-family: "Times New Roman", Times, serif;
    font-size: 15px;
    line-height: 1.58;
}
.wrap { max-width: 1180px; margin: 0 auto; }
a { color: var(--green-800); }
.muted { color: var(--muted); }
.mono { font-family: "Courier New", Courier, monospace; font-size: 12px; }

/* Kop laporan */
.report-header {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    padding: 30px 34px 26px;
    color: #ffffff;
    background: linear-gradient(135deg, #0f3d24 0%, #14532d 48%, #15803d 100%);
    box-shadow: var(--shadow);
}
.report-header::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 5px;
    background: linear-gradient(90deg, #d97706, #f59e0b, #d97706);
}
.brand-strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    width: fit-content;
    margin: 0 0 16px auto;
}
.brand-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 92px;
    height: 68px;
    padding: 7px 9px;
    border: 1px solid rgba(255, 255, 255, 0.75);
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.brand-item img {
    display: block;
    max-width: 100%;
    max-height: 52px;
    width: auto;
    height: auto;
    object-fit: contain;
}
.brand-item.brand-dompetku img {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    object-fit: cover;
}
.report-header h1 {
    margin: 0;
    max-width: 900px;
    font-size: 30px;
    line-height: 1.18;
    letter-spacing: 0.2px;
}
.report-header .subtitle {
    margin: 8px 0 0;
    font-size: 16px;
    color: #dcfce7;
    font-style: italic;
}
.header-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 22px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(220, 252, 231, 0.28);
    font-size: 13px;
    color: #e7f8eb;
}
.header-meta strong { color: #ffffff; }

/* Toolbar */
.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 16px 0 18px;
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow);
}
.toolbar-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.toolbar-label { font-size: 12px; color: var(--muted); margin-right: 2px; }
.spacer { flex: 1 1 auto; }
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #ffffff;
    color: var(--green-800);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.btn:hover { background: var(--green-50); border-color: #a7d7b5; }
.btn.is-active { background: var(--green-700); border-color: var(--green-700); color: #ffffff; }
.btn-primary { background: var(--green-800); border-color: var(--green-800); color: #ffffff; }
.btn-primary:hover { background: var(--green-900); border-color: var(--green-900); }
.icon-eye, .icon-eye-off { width: 16px; height: 16px; flex: 0 0 auto; }
body.privacy-on .icon-eye { display: inline-block; }
body.privacy-on .icon-eye-off { display: none; }
body:not(.privacy-on) .icon-eye { display: none; }
body:not(.privacy-on) .icon-eye-off { display: inline-block; }

/* Kartu dan bagian */
.card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 24px;
    margin-bottom: 18px;
    box-shadow: var(--shadow);
}
.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 6px;
    font-size: 20px;
    line-height: 1.3;
    color: var(--green-900);
}
.section-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: var(--green-100);
    color: var(--green-800);
    font-size: 14px;
    font-weight: 700;
}
.section-desc { margin: 0 0 16px 40px; color: var(--muted); font-size: 13.5px; }
.prose p { margin: 0 0 12px; text-align: justify; }
.prose p:last-child { margin-bottom: 0; }
.lead { font-size: 16.5px; line-height: 1.7; }
.callout {
    margin-top: 18px;
    padding: 16px 18px;
    border-left: 4px solid var(--green-600);
    border-radius: 0 12px 12px 0;
    background: var(--green-50);
}
.callout h3 { margin: 0 0 8px; font-size: 15px; color: var(--green-900); }
.findings { margin: 0; padding-left: 20px; }
.findings li { margin: 6px 0; }
.finding-label { font-weight: 700; color: var(--green-800); }

/* KPI */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
}
.kpi {
    display: flex;
    flex-direction: column;
    min-height: 132px;
    padding: 18px 18px 16px;
    border: 1px solid var(--border);
    border-top: 4px solid var(--green-600);
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff, #f7fdf9);
}
.kpi-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}
.kpi-head .kpi-label { flex: 1 1 auto; }
.kpi-label {
    min-height: 34px;
    font-size: 12.5px;
    line-height: 1.35;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--green-800);
}
.kpi-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    margin-top: -2px;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    background: var(--green-50);
    color: var(--green-700);
    font-size: 14px;
    line-height: 1;
}
.kpi-value {
    margin: 6px 0 5px;
    font-size: 30px;
    line-height: 1.1;
    font-weight: 700;
    color: var(--green-900);
}
.kpi-value-money { font-size: 22px; }
.kpi-unit {
    margin-left: 4px;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
}
.kpi-note {
    margin-top: auto;
    font-size: 12.5px;
    line-height: 1.35;
    font-weight: 600;
    color: #475569;
}

/* Grafik */
.chart-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: 18px;
    align-items: start;
}
.chart-grid.single { grid-template-columns: 1fr; }
.chart-wrap { position: relative; height: 310px; }
.chart-wrap.short { height: 280px; }
.chart-box { min-width: 0; }
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 220px;
    border: 1px dashed #b9d8c4;
    border-radius: 12px;
    color: var(--muted);
    background: #fbfefc;
    font-style: italic;
}

/* Tabel */
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
caption {
    caption-side: top;
    padding: 0 0 8px;
    text-align: left;
    font-size: 12px;
    color: var(--muted);
}
th, td {
    padding: 8px 9px;
    border-bottom: 1px solid #e5eee8;
    text-align: left;
    vertical-align: top;
}
th {
    background: var(--green-50);
    color: var(--green-900);
    font-size: 11px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    white-space: nowrap;
}
tbody tr:nth-child(even) { background: #fbfefc; }
tbody tr:hover { background: #f2fbf5; }
td.num, th.num { text-align: right; white-space: nowrap; }
.cell-note { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }

/* Label dan lencana */
.badge {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
}
.badge-green { background: #dcfce7; color: #166534; }
.badge-gray { background: #eef2f1; color: #52625a; }
.col-google .badge { margin-right: 3px; }

/* Catatan */
.notice {
    margin-bottom: 18px;
    padding: 14px 16px;
    border: 1px solid #f3d38a;
    border-radius: 12px;
    background: #fffbeb;
    color: #854d0e;
    font-size: 13px;
}
.method-list { margin: 0; padding-left: 20px; }
.method-list li { margin: 7px 0; text-align: justify; }
.report-footer {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    text-align: center;
}
.report-footer p { margin: 4px 0; }

/* Ponsel */
@media (max-width: 900px) {
    .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .chart-grid { grid-template-columns: 1fr; }
    .report-header h1 { font-size: 24px; }
    .section-desc { margin-left: 0; }
}
@media (max-width: 560px) {
    body { padding: 12px 10px 32px; }
    .report-header { padding: 22px 20px; border-radius: 14px; }
    .report-header h1 { font-size: 21px; }
    .brand-strip { justify-content: flex-start; gap: 6px; margin: 0 0 12px 0; }
    .brand-item { width: 76px; height: 56px; padding: 5px 7px; }
    .brand-item img { max-height: 42px; }
    .brand-item.brand-dompetku img { width: 40px; height: 40px; }
    .card { padding: 18px 16px; }
    .kpi-grid { grid-template-columns: 1fr; }
    .chart-wrap { height: 260px; }
    .toolbar { padding: 10px; }
    .spacer { display: none; }
}

/* Cetak */
@media print {
    @page { size: A4; margin: 12mm; }
    body {
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-size: 10.5pt;
        line-height: 1.45;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    .card, .report-header { box-shadow: none; }
    .card {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 10px;
        padding: 14px 16px;
    }
    .report-header {
        border-radius: 10px;
        padding: 20px 22px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .report-header h1 { font-size: 22pt; }
    .report-header .subtitle { font-size: 11pt; }
    .brand-strip { gap: 6px; margin-bottom: 10px; }
    .brand-item {
        width: 80px;
        height: 56px;
        padding: 5px 6px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: none;
    }
    .brand-item img { max-height: 44px; }
    .brand-item.brand-dompetku img { width: 40px; height: 40px; }
    .kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .kpi { position: relative; padding: 9px 10px; min-height: 0; }
    .kpi-head { display: block; }
    .kpi-label { min-height: 0; padding-right: 22px; font-size: 8pt; line-height: 1.25; letter-spacing: 0.02em; }
    .kpi-icon {
        position: absolute;
        top: 8px;
        right: 9px;
        width: 21px;
        height: 21px;
        margin: 0;
        border-radius: 5px;
        font-size: 8.5pt;
    }
    .kpi-value { margin: 4px 0 3px; font-size: 18pt; }
    .kpi-value-money { font-size: 13pt; }
    .kpi-unit { font-size: 8.5pt; }
    .kpi-note { font-size: 8.2pt; line-height: 1.25; }
    .chart-grid { grid-template-columns: 1fr; gap: 10px; }
    .chart-box { overflow: hidden; }
    .chart-wrap { height: 240px; overflow: hidden; }
    .chart-wrap.short { height: 210px; }
    .chart-wrap canvas { max-width: 100%; max-height: 100%; }
    table { width: 100%; table-layout: fixed; font-size: 8.6pt; }
    th, td { padding: 5px 6px; overflow-wrap: anywhere; }
    th { white-space: normal; }
    .cell-note { display: none; }
    .col-opens,
    .dev-platform,
    .dev-language,
    .dev-timezone,
    .dev-screen,
    .dev-mode { display: none; }
    .badge { margin-right: 3px; padding: 1px 4px; font-size: 8pt; }
    .col-business { width: 20%; }
    .col-key { width: 19%; }
    .col-google { width: 15%; }
    .col-email { width: 19%; }
    .col-tx { width: 13%; }
    .col-last { width: 14%; }
    .dev-id { width: 28%; }
    .dev-type { width: 20%; }
    .dev-ip { width: 24%; }
    .dev-last { width: 28%; }
    .section-title { font-size: 14pt; }
    .section-desc { margin-bottom: 8px; }
    a { color: #111827; text-decoration: none; }
    .lead { font-size: 11pt; }
    .prose p { text-align: justify; }
    .report-footer { font-size: 8.5pt; }
}
</style>
</head>
<body class="privacy-on">
<div class="wrap">

    <header class="report-header">
        <div class="brand-strip" aria-label="Logo institusi dan aplikasi">
            <div class="brand-item"><img src="../icons/Logo-Unesa.png" alt="Logo Universitas Negeri Surabaya"></div>
            <div class="brand-item"><img src="../icons/Logo-RB-Ngawi.png" alt="Logo Rumah BUMN Ngawi"></div>
            <div class="brand-item brand-dompetku"><img src="../icons/icon-192.png" alt="Logo DompetKu"></div>
        </div>
        <h1>Laporan Pemantauan Penggunaan Aplikasi DompetKu</h1>
        <p class="subtitle">Analisis Perilaku Pengguna dan Pemanfaatan Fitur</p>
        <div class="header-meta">
            <span><strong>Periode:</strong> <?= e($periodLabel) ?></span>
            <span><strong>Disusun oleh:</strong> <?= e($REPORT_AUTHOR) ?></span>
            <span><strong>NIM:</strong> <?= e($REPORT_NIM) ?></span>
            <span><strong>Program Studi:</strong> <?= e($REPORT_PROGRAM) ?></span>
            <span><strong>Institusi:</strong> <?= e($REPORT_INSTITUTION) ?></span>
            <span><strong>Tahun:</strong> <?= e($REPORT_YEAR) ?></span>
        </div>
    </header>

    <div class="toolbar no-print">
        <div class="toolbar-group">
            <span class="toolbar-label">Periode</span>
            <?php foreach ([7, 30, 90, 365] as $option): ?>
                <a class="btn <?= $days === $option ? 'is-active' : '' ?>"
                   href="?key=<?= e(rawurlencode($key)) ?>&days=<?= $option ?>"><?= $option ?> Hari</a>
            <?php endforeach; ?>
        </div>
        <div class="spacer"></div>
        <div class="toolbar-group">
            <button type="button" id="privacy-toggle" class="btn" aria-pressed="true"
                    title="Sembunyikan atau tampilkan data pribadi">
                <svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <span id="privacy-label">Tampilkan Data</span>
            </button>
            <button type="button" class="btn btn-primary" onclick="window.print()">Cetak atau Simpan PDF</button>
        </div>
        <div class="toolbar-group">
            <span class="toolbar-label">Unduh</span>
            <a class="btn" href="?key=<?= e(rawurlencode($key)) ?>&format=csv&type=users&days=<?= $days ?>">CSV Pengguna</a>
            <a class="btn" href="?key=<?= e(rawurlencode($key)) ?>&format=csv&type=daily&days=<?= $days ?>">CSV Harian</a>
            <a class="btn" href="<?= e('?key=' . rawurlencode($key) . '&format=csv&type=events&days=' . $days) ?>">CSV Event</a>
        </div>
    </div>

    <section class="card prose" id="ringkasan">
        <h2 class="section-title"><span class="section-num">1</span> Ringkasan Eksekutif</h2>
        <p class="section-desc">Gambaran umum penggunaan aplikasi pada periode pengamatan.</p>

        <?php if ($totalEvents > 0): ?>
            <p class="lead">
                Sepanjang periode <strong><?= e($periodLabel) ?></strong>, aplikasi DompetKu mencatat
                <strong><?= num($totalUsers) ?></strong> pengguna dan <strong><?= num($totalEvents) ?></strong> aktivitas.
                Angka tersebut setara dengan rata-rata <strong><?= num(round($eventsPerDay)) ?></strong> aktivitas per hari.
                Sebanyak <strong><?= num($activeUsers) ?></strong> pengguna tercatat aktif dalam tujuh hari terakhir,
                sedangkan <strong><?= num($newUsers) ?></strong> pengguna baru bergabung pada periode yang sama.
            </p>
            <p>
                Dari sisi perangkat, <strong><?= e($topPlatformLabel) ?></strong> menjadi jenis perangkat yang paling
                banyak digunakan. Sebanyak <strong><?= num($totalGoogle) ?></strong> pengguna atau
                <strong><?= e($googlePct) ?> persen</strong> telah menautkan akun Google untuk mendukung pencadangan data.
            </p>
            <p>
                Aktivitas harian mencapai puncak pada <strong><?= e($busiestDayLabel) ?></strong> dengan
                <strong><?= num($busiestCount) ?></strong> event. Jam penggunaan tertinggi berada pada pukul
                <strong><?= e($peakHourLabel) ?></strong>. Fitur <strong><?= e($topTabLabel) ?></strong> menjadi bagian
                yang paling sering dibuka, sedangkan sumber pencatatan transaksi terbanyak adalah
                <strong><?= e($sourceTopLabel) ?></strong> dengan <strong><?= num($sourceTopCount) ?></strong> transaksi.
            </p>
        <?php else: ?>
            <p class="lead">
                Belum terdapat data aktivitas yang memadai pada periode <strong><?= e($periodLabel) ?></strong>.
                Laporan ini akan diperbarui setelah aplikasi menerima aktivitas pengguna melalui telemetry.
            </p>
        <?php endif; ?>

        <div class="callout">
            <h3>Temuan Utama</h3>
            <ul class="findings">
                <li><span class="finding-label">Puncak aktivitas:</span> <?= e($busiestDayLabel) ?> dengan <?= num($busiestCount) ?> event.</li>
                <li><span class="finding-label">Jam tersibuk:</span> pukul <?= e($peakHourLabel) ?>.</li>
                <li><span class="finding-label">Fitur terpopuler:</span> <?= e($topTabLabel) ?> dengan <?= num($topTabCount) ?> kunjungan.</li>
                <li><span class="finding-label">Pencatatan transaksi:</span> <?= e($sourceTopLabel) ?> sebesar <?= e($sourceTopPct) ?> persen.</li>
                <li><span class="finding-label">Tautan Google:</span> <?= num($totalGoogle) ?> pengguna atau <?= e($googlePct) ?> persen.</li>
            </ul>
        </div>
    </section>

    <section class="card" id="indikator">
        <h2 class="section-title"><span class="section-num">2</span> Indikator Kinerja</h2>
        <p class="section-desc">Ringkasan angka utama selama periode pengamatan.</p>
        <div class="kpi-grid">
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Total Pengguna</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-users"></i></span></div><div class="kpi-value"><?= num($totalUsers) ?></div><div class="kpi-note">Akumulasi seluruh data</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Pengguna Aktif 7 Hari</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-user-check"></i></span></div><div class="kpi-value"><?= num($activeUsers) ?></div><div class="kpi-note"><?= e($activePct) ?> persen dari total pengguna</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Pengguna Baru 7 Hari</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-user-plus"></i></span></div><div class="kpi-value"><?= num($newUsers) ?></div><div class="kpi-note">Registrasi profil terbaru</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Akun Google Tertaut</div><span class="kpi-icon" aria-hidden="true"><i class="fa-brands fa-google"></i></span></div><div class="kpi-value"><?= num($totalGoogle) ?></div><div class="kpi-note"><?= e($googlePct) ?> persen dari pengguna</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Total Transaksi</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-receipt"></i></span></div><div class="kpi-value"><?= num($totalTx) ?></div><div class="kpi-note">Akumulasi seluruh data</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Transaksi Periode</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-calendar-check"></i></span></div><div class="kpi-value"><?= num($txPeriod) ?></div><div class="kpi-note">Tercatat pada periode ini</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Nominal Transaksi</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-coins"></i></span></div><div class="kpi-value kpi-value-money"><?= rupiah($totalAmount) ?></div><div class="kpi-note">Akumulasi periode</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Buka Aplikasi</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen-button"></i></span></div><div class="kpi-value"><?= num($totalOpens) ?></div><div class="kpi-note">Akumulasi pembukaan aplikasi</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Event Periode</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-chart-line"></i></span></div><div class="kpi-value"><?= num($totalEvents) ?></div><div class="kpi-note"><?= $days ?> hari terakhir</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Sesi</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-clock"></i></span></div><div class="kpi-value"><?= num($totalSessions) ?></div><div class="kpi-note">Jeda lebih dari 30 menit</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Rata-rata Sesi</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-stopwatch"></i></span></div><div class="kpi-value"><?= e($avgSessionLabel) ?><span class="kpi-unit">menit</span></div><div class="kpi-note"><?= e($avgSessionEventsLabel) ?> event per sesi</div></div>
            <div class="kpi"><div class="kpi-head"><div class="kpi-label">Perangkat Unik</div><span class="kpi-icon" aria-hidden="true"><i class="fa-solid fa-laptop"></i></span></div><div class="kpi-value"><?= num($totalDevices) ?></div><div class="kpi-note">Akumulasi perangkat terdeteksi</div></div>
        </div>
    </section>

    <section class="card" id="sumber">
        <h2 class="section-title"><span class="section-num">3</span> Komposisi Sumber Pencatatan</h2>
        <p class="section-desc">Sebaran transaksi berdasarkan cara pengguna mencatat transaksi.</p>
        <div class="chart-grid">
            <div class="chart-box">
                <?php if (count($chartSourceData)): ?>
                    <div class="chart-wrap"><canvas id="chartSource" role="img" aria-label="Grafik lingkaran sumber pencatatan"></canvas></div>
                <?php else: ?>
                    <div class="empty">Belum ada transaksi pada periode ini.</div>
                <?php endif; ?>
            </div>
            <div class="table-scroll">
                <table>
                    <caption>Jumlah transaksi per sumber pencatatan</caption>
                    <thead><tr><th>Sumber</th><th class="num">Transaksi</th><th class="num">Porsi</th></tr></thead>
                    <tbody>
                    <?php if (count($srcTotal)): ?>
                        <?php foreach ($srcTotal as $r): ?>
                            <tr>
                                <td><?= e(sumber_label($r['source'])) ?></td>
                                <td class="num"><?= num($r['c']) ?></td>
                                <td class="num"><?= e(persen((int)$r['c'], $txPeriod)) ?>%</td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <tr><td colspan="3" class="muted">Belum ada data.</td></tr>
                    <?php endif; ?>
                    </tbody>
                </table>
                <p class="muted" style="margin-top:14px">
                    Akumulasi seluruh data: input manual <?= num($srcAll['m'] ?? 0) ?>,
                    Catat Cepat AI <?= num($srcAll['a'] ?? 0) ?>, pemindaian nota <?= num($srcAll['n'] ?? 0) ?>,
                    Telepon AI <?= num($srcAll['t'] ?? 0) ?>, dan transfer <?= num($srcAll['tr'] ?? 0) ?>.
                </p>
            </div>
        </div>
    </section>

    <section class="card" id="harian">
        <h2 class="section-title"><span class="section-num">4</span> Aktivitas Harian</h2>
        <p class="section-desc">Jumlah event yang tercatat setiap hari selama periode pengamatan.</p>
        <div class="chart-wrap"><canvas id="chartDaily" role="img" aria-label="Grafik batang aktivitas harian"></canvas></div>
        <p class="muted" style="margin-top:12px">
            Puncak aktivitas terjadi pada <?= e($busiestDayLabel) ?> dengan <?= num($busiestCount) ?> event.
            Rata-rata aktivitas harian sebesar <?= num(round($eventsPerDay)) ?> event.
        </p>
    </section>

    <section class="card" id="jam">
        <h2 class="section-title"><span class="section-num">5</span> Distribusi Jam Penggunaan</h2>
        <p class="section-desc">Pola penggunaan aplikasi berdasarkan jam lokal perangkat pengguna.</p>
        <div class="chart-wrap"><canvas id="chartHours" role="img" aria-label="Grafik batang distribusi jam penggunaan"></canvas></div>
        <p class="muted" style="margin-top:12px">
            Jam penggunaan tertinggi berada pada pukul <?= e($peakHourLabel) ?>. Informasi ini dapat dipakai
            untuk menentukan waktu yang tepat dalam menyampaikan pengumuman atau pemeliharaan aplikasi.
        </p>
    </section>

    <section class="card" id="navigasi">
        <h2 class="section-title"><span class="section-num">6</span> Preferensi Navigasi</h2>
        <p class="section-desc">Frekuensi pembukaan tab utama di dalam aplikasi.</p>
        <div class="chart-grid">
            <div class="chart-box">
                <?php if (count($chartTabData)): ?>
                    <div class="chart-wrap short"><canvas id="chartTabs" role="img" aria-label="Grafik batang preferensi navigasi"></canvas></div>
                <?php else: ?>
                    <div class="empty">Belum ada data navigasi pada periode ini.</div>
                <?php endif; ?>
            </div>
            <div class="table-scroll">
                <table>
                    <caption>Jumlah kunjungan per tab</caption>
                    <thead><tr><th>Tab</th><th class="num">Kunjungan</th><th class="num">Porsi</th></tr></thead>
                    <tbody>
                    <?php if (count($tabs)): ?>
                        <?php $tabTotal = 0; foreach ($tabs as $t) $tabTotal += (int)$t['c']; ?>
                        <?php foreach ($tabs as $t): ?>
                            <tr>
                                <td><?= e(tab_label($t['t'])) ?></td>
                                <td class="num"><?= num($t['c']) ?></td>
                                <td class="num"><?= e(persen((int)$t['c'], $tabTotal)) ?>%</td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <tr><td colspan="3" class="muted">Belum ada data.</td></tr>
                    <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <section class="card" id="pengguna">
        <h2 class="section-title"><span class="section-num">7</span> Profil Pengguna</h2>
        <p class="section-desc">Dua puluh pengguna terakhir yang aktif. Angka transaksi merupakan akumulasi seluruh data. Data lengkap tersedia melalui ekspor CSV.</p>
        <div class="table-scroll">
            <table>
                <caption>Profil pengguna dan ringkasan transaksi</caption>
                <thead>
                    <tr>
                        <th class="col-business">Nama Usaha</th>
                        <th class="col-key">Kunci Pengguna</th>
                        <th class="col-google">Status Google</th>
                        <th class="col-email">Surel</th>
                        <th class="num col-tx">Transaksi</th>
                        <th class="num col-opens">Buka Aplikasi</th>
                        <th class="col-last">Terakhir Aktif</th>
                    </tr>
                </thead>
                <tbody>
                <?php if (count($users)): ?>
                    <?php foreach ($users as $u): ?>
                        <tr>
                            <td class="col-business"><strong><?= e($u['business_name']) ?></strong></td>
                            <td class="mono col-key"><?= pii_span($u['user_key'], mask_key($u['user_key'])) ?></td>
                            <td class="col-google"><?= google_badge((int)$u['google_linked']) ?></td>
                            <td class="col-email"><?= pii_span($u['google_email'], mask_email($u['google_email'])) ?></td>
                            <td class="num col-tx">
                                <?= num($u['tx_total']) ?>
                                <span class="cell-note">Manual <?= num($u['tx_manual']) ?>, AI <?= num($u['tx_ai']) ?>, Nota <?= num($u['tx_nota']) ?>, Telepon <?= num($u['tx_telpon']) ?>, Transfer <?= num($u['tx_transfer']) ?></span>
                            </td>
                            <td class="num col-opens"><?= num($u['app_opens']) ?></td>
                            <td class="col-last"><?= e(tanggal_singkat_id($u['last_seen'])) ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr><td colspan="7" class="muted">Belum ada data pengguna.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>

    <section class="card" id="perangkat">
        <h2 class="section-title"><span class="section-num">8</span> Profil Perangkat</h2>
        <p class="section-desc">Dua puluh perangkat terakhir yang aktif beserta tipe perangkatnya.</p>
        <div class="table-scroll">
            <table>
                <caption>Profil perangkat dan informasi teknis</caption>
                <thead>
                    <tr>
                        <th class="dev-id">ID Perangkat</th>
                        <th class="dev-type">Tipe Perangkat</th>
                        <th class="dev-platform">Platform</th>
                        <th class="dev-language">Bahasa</th>
                        <th class="dev-timezone">Zona Waktu</th>
                        <th class="dev-screen">Resolusi</th>
                        <th class="dev-mode">Mode</th>
                        <th class="dev-ip">Alamat IP</th>
                        <th class="dev-last">Terakhir Aktif</th>
                    </tr>
                </thead>
                <tbody>
                <?php if (count($devices)): ?>
                    <?php foreach ($devices as $d): ?>
                        <tr>
                            <td class="mono dev-id"><?= e($d['device_id']) ?></td>
                            <td class="dev-type"><strong><?= e(device_type($d['platform'], $d['user_agent'] ?? '')) ?></strong></td>
                            <td class="dev-platform"><?= e($d['platform']) ?></td>
                            <td class="dev-language"><?= e($d['language']) ?></td>
                            <td class="dev-timezone"><?= e($d['timezone']) ?></td>
                            <td class="dev-screen"><?= e($d['screen']) ?></td>
                            <td class="dev-mode"><?= $d['is_pwa'] ? 'PWA' : 'Web' ?></td>
                            <td class="mono dev-ip"><?= $d['ip'] ? e($d['ip']) : '<span class="muted">Tidak tersedia</span>' ?></td>
                            <td class="dev-last"><?= e(tanggal_singkat_id($d['last_seen'])) ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr><td colspan="9" class="muted">Belum ada data perangkat.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>

    <section class="card prose" id="metodologi">
        <h2 class="section-title"><span class="section-num">9</span> Metodologi dan Keterbatasan</h2>
        <p class="section-desc">Penjelasan singkat mengenai sumber data dan cara pembacaan angka.</p>
        <p>
            Data dikumpulkan melalui modul telemetri pada aplikasi DompetKu. Setiap aktivitas pengguna dikirim ke
            backend dan disimpan pada tabel telemetry_events, telemetry_users, dan telemetry_devices. Periode laporan
            mengikuti batas tanggal yang dipilih pada toolbar.
        </p>
        <ul class="method-list">
            <li>Seluruh aktivitas digabungkan tanpa membedakan kanal akses agar laporan berfokus pada perilaku pengguna dan pemanfaatan fitur.</li>
            <li>Sesi dihitung berdasarkan kelompok aktivitas per pengguna dan perangkat. Jeda lebih dari 30 menit dianggap sebagai sesi baru.</li>
            <li>Jam penggunaan mengikuti waktu lokal perangkat pengguna, sehingga dapat berbeda dengan waktu server.</li>
            <li>Angka transaksi berasal dari event tx_saved, sedangkan nominal hanya dihitung jika nilai amount tersedia.</li>
            <li>Pengguna dapat menonaktifkan telemetri melalui pengaturan lokal pada perangkat, sehingga sebagian aktivitas mungkin tidak tercatat.</li>
        </ul>
    </section>

    <section class="card prose" id="kesimpulan">
        <h2 class="section-title"><span class="section-num">10</span> Kesimpulan</h2>
        <p class="section-desc">Ringkasan temuan dan rekomendasi tindak lanjut.</p>
        <?php if ($totalEvents > 0): ?>
            <p>
                Penggunaan aplikasi DompetKu pada periode <?= e($periodLabel) ?> menunjukkan aktivitas yang dominan
                pada perangkat <?= e($topPlatformLabel) ?>. Fitur <?= e($topTabLabel) ?> menjadi bagian yang paling
                banyak diakses, sedangkan <?= e($sourceTopLabel) ?> mendominasi cara pengguna mencatat transaksi.
                Pola ini menunjukkan bahwa fitur inti telah digunakan sesuai rancangan aplikasi.
            </p>
            <p>
                Sebanyak <?= num($totalGoogle) ?> pengguna telah menautkan akun Google, atau setara dengan
                <?= e($googlePct) ?> persen dari total pengguna. Angka ini dapat menjadi dasar untuk mendorong
                fitur pencadangan data kepada pengguna lain. Pemantauan berikutnya disarankan tetap dilakukan secara
                berkala agar perubahan perilaku pengguna dapat terlihat dan menjadi bahan evaluasi pengembangan aplikasi.
            </p>
        <?php else: ?>
            <p>
                Belum terdapat data yang cukup untuk menyusun kesimpulan pada periode ini. Pemantauan perlu dilanjutkan
                setelah aplikasi menerima aktivitas pengguna dalam jumlah yang memadai.
            </p>
        <?php endif; ?>
    </section>

    <footer class="report-footer">
        <p>Sumber data: tabel telemetry_users, telemetry_devices, dan telemetry_events pada basis data <?= e(DB_NAME) ?>.</p>
        <p>Laporan dihasilkan pada <?= e($generatedAt) ?>. Dokumen ini bersifat internal dan tidak untuk dipublikasikan.</p>
        <p>Disusun oleh <?= e($REPORT_AUTHOR) ?>, NIM <?= e($REPORT_NIM) ?>. <?= e($REPORT_PROGRAM) ?>, <?= e($REPORT_INSTITUTION) ?>, <?= e($REPORT_YEAR) ?>.</p>
    </footer>
</div>

<script src="../assets/js/chart.umd.min.js"></script>
<script>
const CHART = {
    source: {
        labels: <?= json_encode($chartSourceLabels, $jsonFlags) ?>,
        data: <?= json_encode($chartSourceData, $jsonFlags) ?>
    },
    daily: {
        labels: <?= json_encode($chartDailyLabels, $jsonFlags) ?>,
        data: <?= json_encode($chartDailyData, $jsonFlags) ?>
    },
    hours: {
        labels: <?= json_encode($chartHourLabels, $jsonFlags) ?>,
        data: <?= json_encode($hmap, $jsonFlags) ?>
    },
    tabs: {
        labels: <?= json_encode($chartTabLabels, $jsonFlags) ?>,
        data: <?= json_encode($chartTabData, $jsonFlags) ?>
    }
};

(function () {
    const palette = ['#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#be123c'];
    const numberFormat = new Intl.NumberFormat('id-ID');
    const body = document.body;
    const toggle = document.getElementById('privacy-toggle');
    const privacyLabel = document.getElementById('privacy-label');
    let masked = true;

    function applyPrivacy(value) {
        body.classList.toggle('privacy-on', value);
        document.querySelectorAll('.pii').forEach(function (el) {
            el.textContent = value ? (el.dataset.masked || '') : (el.dataset.real || '');
        });
        if (toggle) toggle.setAttribute('aria-pressed', String(value));
        if (privacyLabel) privacyLabel.textContent = value ? 'Tampilkan Data' : 'Sembunyikan Data';
    }

    applyPrivacy(true);
    if (toggle) {
        toggle.addEventListener('click', function () {
            masked = !masked;
            applyPrivacy(masked);
        });
    }

    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = '"Times New Roman", Times, serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#475569';
    Chart.defaults.borderColor = '#e2e8f0';

    const centerTextPlugin = {
        id: 'centerText',
        afterDraw: function (chart, args, options) {
            if (!options || !options.text) return;
            const area = chart.chartArea;
            const x = (area.left + area.right) / 2;
            const y = (area.top + area.bottom) / 2;
            const ctx = chart.ctx;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#14532d';
            ctx.font = '700 22px "Times New Roman", Times, serif';
            ctx.fillText(options.text, x, y - 8);
            ctx.fillStyle = '#64748b';
            ctx.font = '12px "Times New Roman", Times, serif';
            ctx.fillText(options.label || '', x, y + 15);
            ctx.restore();
        }
    };

    function doughnut(id, labels, data, centerText, centerLabel) {
        const el = document.getElementById(id);
        if (!el) return;
        new Chart(el, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: palette,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                const share = total ? Math.round(context.parsed / total * 100) : 0;
                                return context.label + ': ' + numberFormat.format(context.parsed) + ' (' + share + '%)';
                            }
                        }
                    },
                    centerText: { text: centerText, label: centerLabel }
                }
            },
            plugins: [centerTextPlugin]
        });
    }

    function pie(id, labels, data) {
        const el = document.getElementById(id);
        if (!el) return;
        new Chart(el, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: palette,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                const share = total ? Math.round(context.parsed / total * 100) : 0;
                                return context.label + ': ' + numberFormat.format(context.parsed) + ' (' + share + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    function bar(id, labels, data, horizontal) {
        const el = document.getElementById(id);
        if (!el) return;
        const isHorizontal = !!horizontal;
        const scales = isHorizontal ? {
            x: {
                beginAtZero: true,
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { color: '#475569', font: { size: 11 }, precision: 0 }
            },
            y: {
                grid: { display: false, drawBorder: false },
                ticks: { color: '#475569', font: { size: 12 } }
            }
        } : {
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { color: '#475569', font: { size: 11 }, maxTicksLimit: 12, autoSkip: true }
            },
            y: {
                beginAtZero: true,
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { color: '#475569', font: { size: 11 }, precision: 0 }
            }
        };
        new Chart(el, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: isHorizontal ? palette : 'rgba(37, 99, 235, 0.78)',
                    hoverBackgroundColor: isHorizontal ? palette : '#2563eb',
                    borderRadius: 5,
                    maxBarThickness: isHorizontal ? 18 : 26
                }]
            },
            options: {
                indexAxis: isHorizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = isHorizontal ? context.parsed.x : context.parsed.y;
                                return ' ' + numberFormat.format(value) + ' event';
                            }
                        }
                    }
                },
                scales: scales
            }
        });
    }

    if (CHART.source.data.some(function (v) { return v > 0; })) {
        pie('chartSource', CHART.source.labels, CHART.source.data);
    }
    bar('chartDaily', CHART.daily.labels, CHART.daily.data, false);
    bar('chartHours', CHART.hours.labels, CHART.hours.data, false);
    if (CHART.tabs.data.some(function (v) { return v > 0; })) {
        bar('chartTabs', CHART.tabs.labels, CHART.tabs.data, true);
    }

    function resizeCharts(tickLimit) {
        if (!Chart.instances) return;
        Object.keys(Chart.instances).forEach(function (id) {
            const chart = Chart.instances[id];
            if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
                chart.options.scales.x.ticks.maxTicksLimit = tickLimit;
            }
            chart.resize();
            chart.update('none');
        });
    }

    window.addEventListener('beforeprint', function () {
        resizeCharts(8);
    });
    window.addEventListener('afterprint', function () {
        resizeCharts(12);
    });
})();
</script>
</body>
</html>
