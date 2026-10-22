<?php
// DompetKu Telemetry - Konfigurasi Database MySQL
// Kredensial dari user. Host default 'localhost' untuk cPanel shared hosting.
// Jika host DB berbeda (misal di cPanel terlihat seperti 'localhost' / IP khusus),
// ubah DB_HOST di bawah.

define('DB_HOST', 'localhost');
define('DB_USER', 'xfag9686_dompetku_user');
define('DB_PASS', 'dompetku_user');
define('DB_NAME', 'xfag9686_dompetku_user');

function db_connect() {
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        return null;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}
