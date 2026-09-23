<?php
require_once __DIR__ . '/../config.php';

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header_remove('X-Powered-By');
}

function _session_start(): void {
    if (session_status() !== PHP_SESSION_NONE) return;
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'None',
    ]);
    session_start();
}

function require_login(): void {
    _session_start();
    if (empty($_SESSION['user_id'])) {
        // API request → 401 JSON
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) || str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Unauthenticated']);
            exit;
        }
        header('Location: ' . APP_BASE_URL . '/login.php');
        exit;
    }
}

function is_logged_in(): bool {
    _session_start();
    return !empty($_SESSION['user_id']);
}

function get_user(): array {
    _session_start();
    return [
        'id'    => $_SESSION['user_id'] ?? '',
        'name'  => $_SESSION['name']    ?? 'Pengguna',
        'email' => $_SESSION['email']   ?? '',
        'role'  => $_SESSION['role']    ?? 'user',
    ];
}

function verify_sso_token(string $token): array|false {
    $b64d = fn($d) => base64_decode(strtr($d, '-_', '+/') . str_repeat('=', (4 - strlen($d) % 4) % 4));

    $parts = explode('.', $token);
    if (count($parts) !== 3) return false;
    [$header, $body, $sig] = $parts;

    $header_data = json_decode($b64d($header), true);
    if (($header_data['alg'] ?? '') !== 'RS256') return false;

    $public_key_pem = defined('SSO_PUBLIC_KEY') ? SSO_PUBLIC_KEY : false;
    if (!$public_key_pem) return false;

    $public_key = openssl_pkey_get_public($public_key_pem);
    if (!$public_key) return false;

    $valid = openssl_verify("$header.$body", $b64d($sig), $public_key, OPENSSL_ALGO_SHA256);
    if ($valid !== 1) return false;

    $payload = json_decode($b64d($body), true);
    if (!$payload) return false;

    if (($payload['exp'] ?? 0) < time()) return false;
    if (($payload['iss'] ?? '') !== 'gudeg-sso') return false;

    return [
        'user_id' => $payload['user_id'] ?? $payload['sub'] ?? '',
        'name'    => $payload['name']    ?? '',
        'email'   => $payload['email']   ?? '',
        'role'    => $payload['role']    ?? 'user',
        'exp'     => $payload['exp']     ?? 0,
    ];
}
