<?php
// api/src/config.php
// Konfigurasi database — bisa override via environment variables (untuk Docker/server)

return [
    'db' => [
        'host'    => getenv('DB_HOST')    ?: 'localhost',
        'port'    => getenv('DB_PORT')    ?: '3306',
        'name'    => getenv('DB_NAME')    ?: 'isr_db',
        'user'    => getenv('DB_USER')    ?: 'root',
        'pass'    => getenv('DB_PASS')    ?: '',
        'charset' => 'utf8mb4',
    ],
    'cors' => [
        // Ganti dengan domain frontend saat produksi, misal: 'https://spectrum.example.com'
        'allowed_origin' => getenv('CORS_ORIGIN') ?: '*',
    ],
    'cache' => [
        // Cache sederhana ke file, set false untuk disable
        'enabled' => true,
        'dir'     => __DIR__ . '/../cache',
        'ttl'     => 300, // detik
    ],
];
