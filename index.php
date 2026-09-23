<?php
require_once __DIR__ . '/includes/auth.php';
require_login();

// Serve Vite build output
$html = file_get_contents(__DIR__ . '/index.html');
echo $html;
