<?php
// Konfigurasi database
// JANGAN isi password di sini — edit langsung di Hostinger File Manager
// atau gunakan GitHub Actions Secrets
return [
    'db' => [
        'host'    => getenv('DB_HOST') ?: 'localhost',
        'port'    => getenv('DB_PORT') ?: '3306',
        'name'    => getenv('DB_NAME') ?: 'nama_database',
        'user'    => getenv('DB_USER') ?: 'user_database',
        'pass'    => getenv('DB_PASS') ?: 'password_database',
        'charset' => 'utf8mb4',
    ],
    'cors' => [
        'allowed_origin' => getenv('CORS_ORIGIN') ?: 'https://kasper.balmonjogja.info',
    ],
    'cache' => [
        'enabled' => true,
        'dir'     => __DIR__ . '/../cache',
        'ttl'     => 300,
    ],
];
