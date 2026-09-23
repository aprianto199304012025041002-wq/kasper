<?php
// kasper_config.php — di-generate saat deploy, JANGAN commit file ini
// Salin file ini ke kasper_config.php dan isi nilainya

define('APP_BASE_URL',   'https://kasper.balmonjogja.info');
define('SSO_URL',        'https://gudeg.xo.je/sso.php');
define('SSO_CLIENT_ID',  '1d4b1ae1b885ed27');

// Public key RSA dari GUDEG (ambil dari gudeg.xo.je/jwks.json)
define('SSO_PUBLIC_KEY', <<<PEM
-----BEGIN PUBLIC KEY-----
<isi_public_key_dari_gudeg>
-----END PUBLIC KEY-----
PEM);

// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'nama_database');
define('DB_USER', 'username');
define('DB_PASS', 'password');
