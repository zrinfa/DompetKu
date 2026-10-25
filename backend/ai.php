<?php
// DompetKu AI Gateway & Proxy
// Mengamankan API key Google AI Studio di cPanel agar tidak perlu di-commit ke GitHub.
// Frontend di dompetku.is-local.org dapat:
// 1. Meminta token / key via GET ?action=key
// 2. Mem-proxy generateContent via POST ke endpoint ini

header('Content-Type: application/json; charset=utf-8');

$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string)$_SERVER['HTTP_ORIGIN']) : '';

function origin_allowed($o) {
    if ($o === '') return true;
    $allowed = [
        'https://dompetku.is-local.org',
        'https://www.dompetku.is-local.org',
        'https://dompetku.csproject.org',
        'https://www.dompetku.csproject.org',
    ];
    if (in_array($o, $allowed, true)) return true;
    // Dev lokal: http(s)://localhost:xxxx / 127.0.0.1
    if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $o)) return true;
    // GitHub Pages preview
    if (preg_match('#^https://[a-z0-9-]+\.github\.io$#i', $o)) return true;
    return false;
}

header('Vary: Origin');
if ($origin !== '' && origin_allowed($origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

require_once __DIR__ . '/config.php';

$apiKey = defined('GEMINI_API_KEY') ? trim(GEMINI_API_KEY) : '';
if ($apiKey === '') {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'GEMINI_API_KEY belum dikonfigurasi di backend/config.local.php.'
    ]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';

// 1. Permintaan kunci / token untuk frontend & Live WebSocket
if ($method === 'GET' || $action === 'key' || $action === 'token') {
    echo json_encode([
        'ok' => true,
        'key' => $apiKey
    ]);
    exit;
}

// 2. Proxy request generateContent (POST)
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Format payload JSON tidak valid.']);
        exit;
    }

    $model = isset($_GET['model']) ? trim((string)$_GET['model']) : (isset($payload['model']) ? trim((string)$payload['model']) : 'gemini-2.5-flash');
    if ($model === '') $model = 'gemini-2.5-flash';

    $geminiBody = [];
    if (isset($payload['contents'])) {
        $geminiBody['contents'] = $payload['contents'];
        if (isset($payload['generationConfig'])) {
            $geminiBody['generationConfig'] = $payload['generationConfig'];
        }
    } elseif (isset($payload['parts'])) {
        $geminiBody['contents'] = [
            ['parts' => $payload['parts']]
        ];
        $geminiBody['generationConfig'] = [
            'responseMimeType' => 'application/json',
            'temperature' => 0.1,
            'maxOutputTokens' => isset($payload['maxTokens']) ? (int)$payload['maxTokens'] : 400
        ];
    } else {
        $geminiBody = $payload;
    }

    $targetUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . urlencode($model) . ':generateContent?key=' . urlencode($apiKey);

    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($geminiBody));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'cURL proxy error: ' . $curlError]);
        exit;
    }

    http_response_code($httpCode ?: 200);
    echo $response;
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Metode HTTP tidak didukung.']);
