<?php
// DompetKu Telemetry - Konfigurasi Database MySQL
//
// Kredensial TIDAK disimpan di file ini agar aman saat repo dipublikasikan.
// Isi kredensial di backend/config.local.php (lihat config.example.php).
// File config.local.php di-.gitignore dan tidak ikut deploy GitHub Pages.
//
// Alternatif: set environment variable DOMPETKU_DB_HOST, DOMPETKU_DB_USER,
// DOMPETKU_DB_PASS, DOMPETKU_DB_NAME, DOMPETKU_ADMIN_KEY.

$__local = __DIR__ . '/config.local.php';
if (is_file($__local)) {
    require $__local;
}

if (!defined('DB_HOST')) define('DB_HOST', getenv('DOMPETKU_DB_HOST') ?: 'localhost');
if (!defined('DB_USER')) define('DB_USER', getenv('DOMPETKU_DB_USER') ?: '');
if (!defined('DB_PASS')) define('DB_PASS', getenv('DOMPETKU_DB_PASS') ?: '');
if (!defined('DB_NAME')) define('DB_NAME', getenv('DOMPETKU_DB_NAME') ?: '');
if (!defined('ADMIN_KEY')) define('ADMIN_KEY', getenv('DOMPETKU_ADMIN_KEY') ?: 'DOMPETKU_LAPORAN_2026');

function db_connect() {
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        return null;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}
