<?php
require_once __DIR__ . '/includes/auth.php';

_session_start();

if (!empty($_SESSION['user_id'])) {
    header('Location: ' . APP_BASE_URL . '/index.php');
    exit;
}

$token = $_GET['token'] ?? '';
if (!$token) {
    error_log('[KASPER] Callback: token tidak ditemukan dari IP ' . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    header('Location: ' . APP_BASE_URL . '/login.php?err=1');
    exit;
}

$state            = $_GET['state'] ?? '';
$session_state    = $_SESSION['sso_state'] ?? '';
$session_state_ts = $_SESSION['sso_state_ts'] ?? 0;

unset($_SESSION['sso_state'], $_SESSION['sso_state_ts']);

if (!$state || !$session_state || !hash_equals($session_state, $state)) {
    error_log('[KASPER] Callback: state tidak valid dari IP ' . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    header('Location: ' . APP_BASE_URL . '/login.php?err=3');
    exit;
}

if (time() - $session_state_ts > 600) {
    error_log('[KASPER] Callback: state expired dari IP ' . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    header('Location: ' . APP_BASE_URL . '/login.php?err=3');
    exit;
}

$payload = verify_sso_token($token);
if (!$payload) {
    error_log('[KASPER] Callback: token tidak valid dari IP ' . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    header('Location: ' . APP_BASE_URL . '/login.php?err=2');
    exit;
}

session_regenerate_id(true);

$_SESSION['user_id']    = $payload['user_id'];
$_SESSION['name']       = $payload['name'];
$_SESSION['email']      = $payload['email'];
$_SESSION['role']       = $payload['role'];
$_SESSION['login_time'] = time();
$_SESSION['ip']         = $_SERVER['REMOTE_ADDR'] ?? '';

header('Location: ' . APP_BASE_URL . '/index.php');
exit;
