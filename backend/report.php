<?php
// DompetKu — Laporan Performa & Penggunaan Aplikasi
// Buka: https://dompetku.csproject.org/backend/report.php?key=KUNCI_RAHASIA
// Kunci admin dibaca dari backend/config.local.php (ADMIN_KEY).
// Ekspor: ?key=...&format=csv&type=users|events|daily&days=30

require_once __DIR__ . '/config.php';

$key = isset($_GET['key']) ? (string)$_GET['key'] : '';
if ($key === '' || !defined('ADMIN_KEY') || !hash_equals((string)ADMIN_KEY, $key)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    die('Akses ditolak. Tambahkan ?key= yang benar.');
}

header('X-Robots-Tag: noindex, nofollow');

$conn = db_connect();
if (!$conn) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    die('Gagal konek DB. Cek backend/config.local.php (DB_HOST/USER/PASS/NAME).');
}

// Deteksi kolom migrasi. Jika belum ada, laporan tetap jalan dengan peringatan.
$hasOriginCol = false;
$hasDeviceOriginCol = false;
if ($r = $conn->query("SHOW COLUMNS FROM telemetry_events LIKE 'origin'")) {
    $hasOriginCol = $r->num_rows > 0;
    $r->free();
}
if ($r = $conn->query("SHOW COLUMNS FROM telemetry_devices LIKE 'last_origin'")) {
    $hasDeviceOriginCol = $r->num_rows > 0;
    $r->free();
}
$originSel = $hasOriginCol ? 'origin' : 'NULL AS origin';
$devOriginSel = $hasDeviceOriginCol ? 'last_origin' : 'NULL AS last_origin';

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
function origin_label($o) {
    if (!$o) return '(data lama)';
    $h = parse_url($o, PHP_URL_HOST);
    if (!$h) $h = (string)$o;
    if (stripos($h, 'is-local.org') !== false) return 'GitHub Pages';
    if (stripos($h, 'csproject.org') !== false) return 'cPanel';
    if ($h === 'localhost' || $h === '127.0.0.1') return 'Lokal / dev';
    if (substr(strtolower($h), -10) === '.github.io') return 'GitHub Preview';
    return $h;
}

$days = isset($_GET['days']) ? max(1, min(365, (int)$_GET['days'])) : 30;
$format = strtolower((string)($_GET['format'] ?? ''));
$type = strtolower((string)($_GET['type'] ?? 'users'));
$since = "server_time >= DATE_SUB(NOW(), INTERVAL $days DAY)";

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
        $rows = qa($conn, "SELECT server_time, client_time, $originSel, business_name, user_key, device_id,
            event_type, source, hour_local, google_linked, google_email, amount, tx_type, entity, tab_name, app_version, ip
            FROM telemetry_events WHERE $since ORDER BY id DESC LIMIT 10000");
        $head = ['server_time','client_time','origin','business_name','user_key','device_id','event_type','source',
            'hour_local','google_linked','google_email','amount','tx_type','entity','tab_name','app_version','ip'];
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="dompetku-' . $type . '-' . date('Ymd-His') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM agar Excel membaca UTF-8
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

// Sesi: kelompokkan event per user+device, jeda > 30 menit dianggap sesi baru.
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

$origins = $hasOriginCol ? qa($conn, "SELECT origin, COUNT(*) c, COUNT(DISTINCT user_key) users
  FROM telemetry_events WHERE $since GROUP BY origin ORDER BY c DESC") : [];
$originTotal = 0;
foreach ($origins as $o) $originTotal += (int)$o['c'];

$daily = qa($conn, "SELECT DATE(server_time) d, COUNT(*) c,
    SUM(event_type='app_open') opens, SUM(event_type='tx_saved') tx
  FROM telemetry_events WHERE $since GROUP BY DATE(server_time) ORDER BY d");
$dailyMap = [];
foreach ($daily as $r) $dailyMap[$r['d']] = $r;
$dailyMax = 1;
foreach ($dailyMap as $r) $dailyMax = max($dailyMax, (int)$r['c']);

$hours = qa($conn, "SELECT hour_local h, COUNT(*) c FROM telemetry_events
  WHERE $since AND hour_local IS NOT NULL GROUP BY hour_local ORDER BY hour_local");
$hmap = array_fill(0, 24, 0);
foreach ($hours as $h) $hmap[(int)$h['h']] = (int)$h['c'];
$hmax = max(1, max($hmap));

$tabs = qa($conn, "SELECT tab_name t, COUNT(*) c FROM telemetry_events
  WHERE event_type='tab_view' AND $since GROUP BY tab_name ORDER BY c DESC LIMIT 10");

$users = qa($conn, "SELECT user_key, business_name, google_email, google_name, google_linked,
  tx_total, tx_manual, tx_ai, tx_nota, tx_telpon, tx_transfer, app_opens, first_seen, last_seen
  FROM telemetry_users ORDER BY last_seen DESC LIMIT 200");

$devices = qa($conn, "SELECT device_id, user_key, $devOriginSel, platform, language, timezone, screen, cores,
  touch_points, is_pwa, ip, last_seen FROM telemetry_devices ORDER BY last_seen DESC LIMIT 200");

$dayKeys = [];
for ($i = $days - 1; $i >= 0; $i--) $dayKeys[] = date('Y-m-d', strtotime("-$i day"));
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>DompetKu — Laporan Penggunaan (<?= $days ?> hari)</title>
<style>
body{font-family:system-ui,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:16px}
.wrap{max-width:1180px;margin:0 auto}
.card{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:14px;margin-bottom:14px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:0 0 10px;color:#5eead4}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:10px}
.kpi b{font-size:22px;display:block}.kpi span{font-size:11px;color:#94a3b8}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border-bottom:1px solid #334155;padding:6px 8px;text-align:left;vertical-align:top}
th{color:#94a3b8;font-size:11px;text-transform:uppercase}
.bars{display:flex;align-items:flex-end;gap:3px;height:120px}
.bar{flex:1;background:#10b981;border-radius:4px 4px 0 0;min-height:3px;position:relative}
.bar span{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:#94a3b8;white-space:nowrap}
a{color:#5eead4}.muted{color:#94a3b8;font-size:12px}
.badge{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700}
.ok{background:#064e3b;color:#6ee7b7}.no{background:#3f3f46;color:#d4d4d8}
.gh{background:#1e3a8a;color:#bfdbfe}.cp{background:#78350f;color:#fde68a}
.btn{display:inline-block;padding:6px 10px;border:1px solid #334155;border-radius:8px;margin:2px 4px 2px 0;text-decoration:none;font-size:12px}
.progress{height:6px;background:#0f172a;border-radius:99px;overflow:hidden;margin-top:4px}
.progress i{display:block;height:100%;background:#10b981}
</style>
</head>
<body>
<div class="wrap">
<h1>DompetKu — Laporan Performa &amp; Penggunaan</h1>
<p class="muted">Periode <?= $days ?> hari terakhir · Waktu server <?= date('Y-m-d H:i:s') ?> ·
<a href="?key=<?= e($key) ?>&days=7">7 hari</a> · <a href="?key=<?= e($key) ?>&days=30">30 hari</a> · <a href="?key=<?= e($key) ?>&days=90">90 hari</a> · <a href="?key=<?= e($key) ?>&days=365">1 tahun</a></p>
<p class="muted">Unduh CSV:
<a class="btn" href="?key=<?= e($key) ?>&format=csv&type=users&days=<?= $days ?>">User</a>
<a class="btn" href="?key=<?= e($key) ?>&format=csv&type=daily&days=<?= $days ?>">Harian</a>
<a class="btn" href="?key=<?= e($key) ?>&format=csv&type=events&days=<?= $days ?>">Event</a></p>

<?php if (!$hasOriginCol || !$hasDeviceOriginCol): ?>
<div class="card" style="border-color:#a16207;background:#422006">
<p style="color:#fde68a;margin:0;font-size:13px">Migrasi database belum lengkap. Jalankan <b>backend/migrate_origin.sql</b> lewat phpMyAdmin agar kolom asal trafik (<code>origin</code> / <code>last_origin</code>) tersimpan. Event tetap tersimpan; hanya info asal trafik yang kosong.</p>
</div>
<?php endif; ?>

<div class="card"><h2>Ringkasan</h2>
<div class="grid">
<div class="kpi"><b><?= num($tot['c'] ?? 0) ?></b><span>Total user terlacak</span></div>
<div class="kpi"><b><?= num($tot['glink'] ?? 0) ?></b><span>User taut Google</span></div>
<div class="kpi"><b><?= num($dev['d'] ?? 0) ?></b><span>Device unik</span></div>
<div class="kpi"><b><?= num($tot['tx'] ?? 0) ?></b><span>Total transaksi</span></div>
<div class="kpi"><b><?= num($tot['opens'] ?? 0) ?></b><span>App opens</span></div>
<div class="kpi"><b><?= num($ev['c'] ?? 0) ?></b><span>Event <?= $days ?> hari</span></div>
<div class="kpi"><b><?= num($active7['c'] ?? 0) ?></b><span>User aktif 7 hari</span></div>
<div class="kpi"><b><?= num($new7['c'] ?? 0) ?></b><span>User baru 7 hari</span></div>
<div class="kpi"><b><?= num($sessions['sessions'] ?? 0) ?></b><span>Sesi (jeda &gt;30 mnt)</span></div>
<div class="kpi"><b><?= e($sessions['avg_min'] ?? 0) ?> m</b><span>Rata-rata durasi sesi</span></div>
<div class="kpi"><b><?= e($sessions['avg_events'] ?? 0) ?></b><span>Event per sesi</span></div>
<div class="kpi"><b>Rp<?= num($amount['s'] ?? 0) ?></b><span>Nominal tx tercatat</span></div>
</div></div>

<div class="card"><h2>Asal trafik (deployment)</h2>
<table><tr><th>Sumber</th><th>Origin</th><th>Event</th><th>User</th><th>Porsi</th></tr>
<?php foreach ($origins as $o): $c = (int)$o['c']; $pct = $originTotal ? round($c / $originTotal * 100) : 0; ?>
<tr>
<td><span class="badge <?= stripos((string)$o['origin'], 'is-local.org') !== false ? 'gh' : (stripos((string)$o['origin'], 'csproject.org') !== false ? 'cp' : 'no') ?>"><?= e(origin_label($o['origin'])) ?></span></td>
<td class="muted"><?= e($o['origin'] ?: '-') ?></td>
<td><?= num($c) ?></td>
<td><?= num($o['users'] ?? 0) ?></td>
<td><?= $pct ?>%<div class="progress"><i style="width:<?= $pct ?>%"></i></div></td>
</tr>
<?php endforeach; ?>
<?php if (!count($origins)): ?><tr><td colspan="5" class="muted">Belum ada data origin. Jalankan migrate_origin.sql lalu buka aplikasi dari GitHub Pages.</td></tr><?php endif; ?>
</table></div>

<div class="card"><h2>Event harian (<?= $days ?> hari)</h2>
<div class="bars">
<?php foreach ($dayKeys as $d): $c = (int)($dailyMap[$d]['c'] ?? 0); $pct = round($c / $dailyMax * 100); ?>
<div class="bar" style="height:<?= max(3, $pct) ?>%" title="<?= e($d) ?> = <?= $c ?> event"><span><?= e(substr($d, 8, 2)) ?>/<?= e(substr($d, 5, 2)) ?></span></div>
<?php endforeach; ?>
</div><p class="muted" style="margin-top:24px">Hari dengan event terbanyak: <?= num($dailyMax) ?> event. Arahkan kursor ke bar untuk detail tanggal.</p>
</div>

<div class="card"><h2>Kecenderungan pencatatan (tx_saved, <?= $days ?> hari)</h2>
<table><tr><th>Sumber</th><th>Event</th></tr>
<?php foreach ($srcTotal as $r): ?>
<tr><td><?= e($r['source'] === '' ? '(kosong)' : $r['source']) ?></td><td><?= num($r['c']) ?></td></tr>
<?php endforeach; ?>
<?php if (!count($srcTotal)): ?><tr><td colspan="2" class="muted">Belum ada data.</td></tr><?php endif; ?>
</table>
<p class="muted">Akumulasi per user — manual: <?= num($srcAll['m'] ?? 0) ?> · ai: <?= num($srcAll['a'] ?? 0) ?> · nota: <?= num($srcAll['n'] ?? 0) ?> · telpon: <?= num($srcAll['t'] ?? 0) ?> · transfer: <?= num($srcAll['tr'] ?? 0) ?></p>
<p class="muted">manual = form biasa · ai = Catat Cepat AI (ketik/bicara) · nota = foto struk / bukti foto · telpon = Telepon AI Live</p>
</div>

<div class="card"><h2>Jam-jam penggunaan (WIB perangkat user, <?= $days ?> hari)</h2>
<div class="bars">
<?php for ($h = 0; $h < 24; $h++): $pct = round($hmap[$h] / $hmax * 100); ?>
<div class="bar" style="height:<?= max(3, $pct) ?>%" title="<?= $h ?>:00 = <?= $hmap[$h] ?> event"><span><?= $h ?></span></div>
<?php endfor; ?>
</div><p class="muted" style="margin-top:22px">Puncak: jam <?= array_search(max($hmap), $hmap) ?> (<?= max($hmap) ?> event). Arahkan kursor ke bar untuk angka.</p>
</div>

<div class="card"><h2>Tab paling sering dibuka</h2>
<table><tr><th>Tab</th><th>Views</th></tr>
<?php foreach ($tabs as $r): ?><tr><td><?= e($r['t']) ?></td><td><?= num($r['c']) ?></td></tr><?php endforeach; ?>
<?php if (!count($tabs)): ?><tr><td colspan="2" class="muted">Belum ada data.</td></tr><?php endif; ?>
</table></div>

<div class="card"><h2>User (200 terakhir aktif)</h2>
<div style="overflow-x:auto"><table>
<tr><th>Nama usaha</th><th>User key</th><th>Google</th><th>Email / nama</th><th>Tx (M/AI/N/T/Tf)</th><th>Opens</th><th>Pertama</th><th>Terakhir</th></tr>
<?php foreach ($users as $u): ?>
<tr>
<td><b><?= e($u['business_name']) ?></b></td>
<td class="muted"><?= e(substr($u['user_key'], 0, 18)) ?></td>
<td><span class="badge <?= $u['google_linked'] ? 'ok' : 'no' ?>"><?= $u['google_linked'] ? 'tertaut' : 'belum' ?></span></td>
<td><?= e($u['google_email']) ?><br><span class="muted"><?= e($u['google_name']) ?></span></td>
<td><?= num($u['tx_total']) ?> (<?= num($u['tx_manual']) ?>/<?= num($u['tx_ai']) ?>/<?= num($u['tx_nota']) ?>/<?= num($u['tx_telpon']) ?>/<?= num($u['tx_transfer']) ?>)</td>
<td><?= num($u['app_opens']) ?></td>
<td class="muted"><?= e($u['first_seen']) ?></td>
<td class="muted"><?= e($u['last_seen']) ?></td>
</tr>
<?php endforeach; ?>
<?php if (!count($users)): ?><tr><td colspan="8" class="muted">Belum ada data user.</td></tr><?php endif; ?>
</table></div></div>

<div class="card"><h2>Device / fingerprint (200 terakhir)</h2>
<div style="overflow-x:auto"><table>
<tr><th>Device</th><th>User</th><th>Asal</th><th>Platform</th><th>Lang / TZ</th><th>Layar</th><th>CPU/Touch/PWA</th><th>IP</th><th>Terakhir</th></tr>
<?php foreach ($devices as $d): ?>
<tr>
<td class="muted"><?= e(substr($d['device_id'], 0, 14)) ?></td>
<td class="muted"><?= e(substr($d['user_key'], 0, 14)) ?></td>
<td><span class="badge <?= stripos((string)$d['last_origin'], 'is-local.org') !== false ? 'gh' : (stripos((string)$d['last_origin'], 'csproject.org') !== false ? 'cp' : 'no') ?>"><?= e(origin_label($d['last_origin'])) ?></span></td>
<td><?= e($d['platform']) ?></td>
<td><?= e($d['language']) ?> / <?= e($d['timezone']) ?></td>
<td><?= e($d['screen']) ?></td>
<td><?= e($d['cores']) ?>c · t<?= e($d['touch_points']) ?> · <?= $d['is_pwa'] ? 'PWA' : 'web' ?></td>
<td class="muted"><?= e($d['ip']) ?></td>
<td class="muted"><?= e($d['last_seen']) ?></td>
</tr>
<?php endforeach; ?>
<?php if (!count($devices)): ?><tr><td colspan="9" class="muted">Belum ada data device.</td></tr><?php endif; ?>
</table></div></div>

<p class="muted">Sumber: tabel telemetry_users / telemetry_devices / telemetry_events di database <?= e(DB_NAME) ?>.
Kunci admin tersimpan di backend/config.local.php.</p>
</div>
</body>
</html>
