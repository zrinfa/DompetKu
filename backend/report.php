<?php
// DompetKu — Laporan Performa & Penggunaan Aplikasi
// Buka: https://domainanda/backend/report.php?key=DOMPETKU_LAPORAN_2026
// Ganti ADMIN_KEY di bawah dengan kunci rahasia Anda.

define('ADMIN_KEY', 'DOMPETKU_LAPORAN_2026');
require_once __DIR__ . '/config.php';

$key = $_GET['key'] ?? '';
if ($key !== ADMIN_KEY) {
    http_response_code(403);
    die('Akses ditolak. Tambahkan ?key= yang benar.');
}
$conn = db_connect();
if (!$conn) die('Gagal konek DB. Cek config.php (DB_HOST/USER/PASS).');

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

$days = isset($_GET['days']) ? max(1, min(365, (int)$_GET['days'])) : 30;

$tot = q1($conn, "SELECT COUNT(*) c, SUM(google_linked) glink, SUM(tx_total) tx, SUM(app_opens) opens FROM telemetry_users");
$dev = q1($conn, "SELECT COUNT(*) c, COUNT(DISTINCT device_id) d FROM telemetry_devices");
$ev  = q1($conn, "SELECT COUNT(*) c FROM telemetry_events WHERE server_time >= DATE_SUB(NOW(), INTERVAL $days DAY)");

$srcTotal = qa($conn, "SELECT source, COUNT(*) c FROM telemetry_events
  WHERE event_type='tx_saved' AND server_time >= DATE_SUB(NOW(), INTERVAL $days DAY) GROUP BY source ORDER BY c DESC");
$srcAll = qa($conn, "SELECT SUM(tx_manual) m, SUM(tx_ai) a, SUM(tx_nota) n, SUM(tx_telpon) t, SUM(tx_transfer) tr FROM telemetry_users");

$hours = qa($conn, "SELECT hour_local h, COUNT(*) c FROM telemetry_events
  WHERE server_time >= DATE_SUB(NOW(), INTERVAL $days DAY) AND hour_local IS NOT NULL
  GROUP BY hour_local ORDER BY hour_local");
$hmap = array_fill(0, 24, 0);
foreach ($hours as $h) $hmap[(int)$h['h']] = (int)$h['c'];
$hmax = max(1, max($hmap));

$tabs = qa($conn, "SELECT tab_name t, COUNT(*) c FROM telemetry_events
  WHERE event_type='tab_view' AND server_time >= DATE_SUB(NOW(), INTERVAL $days DAY)
  GROUP BY tab_name ORDER BY c DESC LIMIT 10");

$users = qa($conn, "SELECT user_key, business_name, google_email, google_name, google_linked,
  tx_total, tx_manual, tx_ai, tx_nota, tx_telpon, tx_transfer, app_opens, last_seen
  FROM telemetry_users ORDER BY last_seen DESC LIMIT 200");

$devices = qa($conn, "SELECT device_id, user_key, platform, language, timezone, screen, cores,
  touch_points, is_pwa, ip, last_seen FROM telemetry_devices ORDER BY last_seen DESC LIMIT 200");
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DompetKu — Laporan Penggunaan (<?= $days ?> hari)</title>
<style>
body{font-family:system-ui,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:16px}
.wrap{max-width:1080px;margin:0 auto}
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
.bar span{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:#94a3b8}
a{color:#5eead4}.muted{color:#94a3b8;font-size:12px}
.badge{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700}
.ok{background:#064e3b;color:#6ee7b7}.no{background:#3f3f46;color:#d4d4d8}
</style>
</head>
<body>
<div class="wrap">
<h1>DompetKu — Laporan Performa &amp; Penggunaan</h1>
<p class="muted">Periode <?= $days ?> hari terakhir · Server time <?= date('Y-m-d H:i:s') ?> ·
<a href="?key=<?= e($key) ?>&days=7">7 hari</a> · <a href="?key=<?= e($key) ?>&days=30">30 hari</a> · <a href="?key=<?= e($key) ?>&days=90">90 hari</a></p>

<div class="card"><h2>Ringkasan</h2>
<div class="grid">
<div class="kpi"><b><?= e($tot['c'] ?? 0) ?></b><span>Total user terlacak</span></div>
<div class="kpi"><b><?= e($tot['glink'] ?? 0) ?></b><span>User taut Google</span></div>
<div class="kpi"><b><?= e($dev['d'] ?? 0) ?></b><span>Device unik</span></div>
<div class="kpi"><b><?= e($tot['tx'] ?? 0) ?></b><span>Total transaksi</span></div>
<div class="kpi"><b><?= e($tot['opens'] ?? 0) ?></b><span>App opens</span></div>
<div class="kpi"><b><?= e($ev['c'] ?? 0) ?></b><span>Event <?= $days ?> hari</span></div>
</div></div>

<div class="card"><h2>Kecenderungan pencatatan (tx_saved, <?= $days ?> hari)</h2>
<table><tr><th>Sumber</th><th>Event</th></tr>
<?php foreach ($srcTotal as $r): ?>
<tr><td><?= e($r['source'] === '' ? '(kosong)' : $r['source']) ?></td><td><?= e($r['c']) ?></td></tr>
<?php endforeach; ?>
<?php if (!count($srcTotal)): ?><tr><td colspan="2" class="muted">Belum ada data.</td></tr><?php endif; ?>
</table>
<p class="muted">Akumulasi per user — manual: <?= e($srcAll[0]['m'] ?? 0) ?> · ai: <?= e($srcAll[0]['a'] ?? 0) ?> · nota: <?= e($srcAll[0]['n'] ?? 0) ?> · telpon: <?= e($srcAll[0]['t'] ?? 0) ?> · transfer: <?= e($srcAll[0]['tr'] ?? 0) ?></p>
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
<?php foreach ($tabs as $r): ?><tr><td><?= e($r['t']) ?></td><td><?= e($r['c']) ?></td></tr><?php endforeach; ?>
<?php if (!count($tabs)): ?><tr><td colspan="2" class="muted">Belum ada data.</td></tr><?php endif; ?>
</table></div>

<div class="card"><h2>User (200 terakhir aktif)</h2>
<div style="overflow-x:auto"><table>
<tr><th>Nama usaha</th><th>User key</th><th>Google</th><th>Email / nama</th><th>Tx (M/AI/N/T/Tf)</th><th>Opens</th><th>Terakhir</th></tr>
<?php foreach ($users as $u): ?>
<tr>
<td><b><?= e($u['business_name']) ?></b></td>
<td class="muted"><?= e(substr($u['user_key'], 0, 18)) ?></td>
<td><span class="badge <?= $u['google_linked'] ? 'ok' : 'no' ?>"><?= $u['google_linked'] ? 'tertaut' : 'belum' ?></span></td>
<td><?= e($u['google_email']) ?><br><span class="muted"><?= e($u['google_name']) ?></span></td>
<td><?= e($u['tx_total']) ?> (<?= e($u['tx_manual']) ?>/<?= e($u['tx_ai']) ?>/<?= e($u['tx_nota']) ?>/<?= e($u['tx_telpon']) ?>/<?= e($u['tx_transfer']) ?>)</td>
<td><?= e($u['app_opens']) ?></td>
<td class="muted"><?= e($u['last_seen']) ?></td>
</tr>
<?php endforeach; ?>
</table></div></div>

<div class="card"><h2>Device / fingerprint (200 terakhir)</h2>
<div style="overflow-x:auto"><table>
<tr><th>Device</th><th>User</th><th>Platform</th><th>Lang / TZ</th><th>Layar</th><th>CPU/Touch/PWA</th><th>IP</th><th>Terakhir</th></tr>
<?php foreach ($devices as $d): ?>
<tr>
<td class="muted"><?= e(substr($d['device_id'], 0, 14)) ?></td>
<td class="muted"><?= e(substr($d['user_key'], 0, 14)) ?></td>
<td><?= e($d['platform']) ?></td>
<td><?= e($d['language']) ?> / <?= e($d['timezone']) ?></td>
<td><?= e($d['screen']) ?></td>
<td><?= e($d['cores']) ?>c · t<?= e($d['touch_points']) ?> · <?= $d['is_pwa'] ? 'PWA' : 'web' ?></td>
<td class="muted"><?= e($d['ip']) ?></td>
<td class="muted"><?= e($d['last_seen']) ?></td>
</tr>
<?php endforeach; ?>
</table></div></div>

<p class="muted">Sumber: tabel telemetry_users / telemetry_devices / telemetry_events di database <?= e('xfag9686_dompetku_user') ?>.</p>
</div>
</body>
</html>
