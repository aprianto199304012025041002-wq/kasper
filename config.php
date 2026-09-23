<?php
/**
 * config.php — loader konfigurasi KASPER.
 * kasper_config.php di-generate saat deploy via GitHub Actions
 * dan di-deploy ke direktori yang sama (/public_html/).
 */
$config_path = __DIR__ . '/kasper_config.php';

if (!file_exists($config_path)) {
    http_response_code(503);
    die('Server configuration missing. Please deploy kasper_config.php.');
}

require_once $config_path;
