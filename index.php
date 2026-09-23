<?php
require_once __DIR__ . '/includes/auth.php';
require_login();

$user = get_user();
$html = file_get_contents(__DIR__ . '/index.html');

// Inject user data sebelum </head>
$user_script = '<script>window.__KASPER_USER__=' . json_encode([
    'name'  => $user['name'],
    'email' => $user['email'],
]) . ';</script>';

echo str_replace('</head>', $user_script . '</head>', $html);
