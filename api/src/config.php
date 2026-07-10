<?php
return [
    'db' => [
        'host'    => getenv('DB_HOST') ?: 'localhost',
        'port'    => getenv('DB_PORT') ?: '3306',
        'name'    => getenv('DB_NAME') ?: 'isr_db',
        'user'    => getenv('DB_USER') ?: 'root',
        'pass'    => getenv('DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ],
    'cors' => [
        'allowed_origin' => getenv('CORS_ORIGIN') ?: '*',
    ],
    'cache' => [
        'enabled' => true,
        'dir'     => __DIR__ . '/../cache',
        'ttl'     => 300,
    ],
];
