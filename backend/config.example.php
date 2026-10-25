<?php
// TEMPLATE. Salin file ini menjadi config.local.php lalu isi kredensial cPanel.
// config.local.php TIDAK di-commit ke GitHub.
if (isset($_SERVER['SCRIPT_FILENAME']) && basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

define('DB_HOST', 'localhost');
define('DB_USER', 'xfag9686_dompetku_user');
define('DB_PASS', 'GANTI_DENGAN_PASSWORD_DB');
define('DB_NAME', 'xfag9686_dompetku_user');
define('ADMIN_KEY', 'GANTI_DENGAN_KUNCI_RAHASIA');
define('GEMINI_API_KEY', 'GANTI_DENGAN_GEMINI_API_KEY');
