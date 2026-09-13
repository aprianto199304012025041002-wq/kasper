<?php
// data.php — satu-satunya file PHP, langsung query MySQL
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
$allowed = ['https://kasper.balmonjogja.info', 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'];
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . (in_array($origin, $allowed, true) ? $origin : $allowed[0]));
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET')     { http_response_code(405); echo json_encode(['error'=>'Method not allowed']); exit; }

// ── Koneksi ──────────────────────────────────────────────────────────────────
// Credentials di-inject oleh CI/CD — jangan edit manual di sini
define('DB_HOST', 'DB_HOST_PLACEHOLDER');
define('DB_NAME', 'DB_NAME_PLACEHOLDER');
define('DB_USER', 'DB_USER_PLACEHOLDER');
define('DB_PASS', 'DB_PASS_PLACEHOLDER');

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Koneksi database gagal']);
    exit;
}

// ── Routing sederhana ─────────────────────────────────────────────────────────
$path  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path  = preg_replace('#^/api#', '', $path);
$path  = trim($path, '/');
$parts = explode('/', $path);
$route = $parts[0] ?? '';
$param = $parts[1] ?? null;
$q     = $_GET;

// ── Helper ────────────────────────────────────────────────────────────────────
function jenis_sql(): string {
    return "CASE
        WHEN clnt_name LIKE '%RRI%' OR clnt_name LIKE '%RADIO REPUBLIK%' THEN 'publik'
        WHEN clnt_name LIKE '%LPPL%' OR clnt_name LIKE '%LEMBAGA PENYIARAN PUBLIK LOKAL%' THEN 'publik_lokal'
        WHEN clnt_name LIKE '%PERKUMPULAN%' OR clnt_name LIKE '%KOMUNITAS%' THEN 'komunitas'
        ELSE 'swasta'
    END";
}

function base_where(array $q): array {
    $w = []; $p = [];
    if (!empty($q['province'])) { $w[] = 'province = :province'; $p[':province'] = $q['province']; }
    if (!empty($q['city']))     { $w[] = 'area_of_service = :city'; $p[':city'] = $q['city']; }
    if (!empty($q['search']))   { $w[] = '(stn_name LIKE :s1 OR clnt_name LIKE :s2)'; $p[':s1'] = $p[':s2'] = '%'.$q['search'].'%'; }
    return [$w, $p];
}

function out(array $data): void {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Routes ────────────────────────────────────────────────────────────────────
switch ($route) {

    // GET /api/stations  atau  GET /api/stations/:freq
    case 'stations':
        if ($param !== null) {
            $freq = filter_var($param, FILTER_VALIDATE_FLOAT);
            if ($freq === false) { http_response_code(400); out(['error'=>'Frekuensi tidak valid']); }
            $stmt = $pdo->prepare("
                SELECT id, no_simf, freq,
                    bwidth AS bw_khz,
                    ROUND(freq - bwidth/2/1000, 4) AS lower_mhz,
                    ROUND(freq + bwidth/2/1000, 4) AS upper_mhz,
                    stn_name, clnt_name,
                    city AS kota, district AS kecamatan,
                    area_of_service AS wilayah_layanan, province,
                    erp_pwr_dbm AS erp_dbm, status_simf AS status,
                    validity_date AS validity, licence_date, appl_date,
                    hgt_ant AS tower_height_m, gain AS antenna_gain,
                    sid_lat AS latitude, sid_long AS longitude,
                    equip_type, eq_mfr, eq_mdl,
                    " . jenis_sql() . " AS jenis
                FROM isr
                WHERE service='Broadcast' AND subservice='FM'
                  AND ABS(freq - :freq) < 0.05
                LIMIT 1
            ");
            $stmt->execute([':freq' => $freq]);
            $station = $stmt->fetch();
            if (!$station) { http_response_code(404); out(['error'=>"Stasiun {$freq} tidak ditemukan"]); }

            // PDO MySQL tidak bisa bind named param yang sama dua kali — pakai ? positional
            $stmt2 = $pdo->prepare("
                SELECT id, freq, stn_name, clnt_name,
                    city AS kota, area_of_service AS wilayah_layanan, province,
                    erp_pwr_dbm AS erp_dbm, status_simf AS status,
                    validity_date AS validity,
                    sid_lat AS latitude, sid_long AS longitude,
                    ABS(freq - ?) AS freq_distance
                FROM isr
                WHERE service='Broadcast' AND subservice='FM'
                  AND ABS(freq - ?) BETWEEN 0.05 AND 2.0
                  AND sid_lat IS NOT NULL AND sid_long IS NOT NULL
                  AND sid_lat != 0 AND sid_long != 0
                ORDER BY freq_distance ASC LIMIT 30
            ");
            $stmt2->execute([$freq, $freq]);
            out(['data' => $station, 'neighbors' => $stmt2->fetchAll()]);
        }

        [$w, $p] = base_where($q);
        $where = $w ? 'AND ' . implode(' AND ', $w) : '';
        $stmt = $pdo->prepare("
            SELECT id, no_simf, freq,
                bwidth AS bw_khz,
                ROUND(freq - bwidth/2/1000, 4) AS lower_mhz,
                ROUND(freq + bwidth/2/1000, 4) AS upper_mhz,
                stn_name, clnt_name,
                city AS kota, district AS kecamatan,
                area_of_service AS wilayah_layanan, province,
                COALESCE(erp_pwr_dbm, 40) AS erp_dbm, status_simf AS status,
                validity_date AS validity,
                sid_lat AS latitude, sid_long AS longitude,
                " . jenis_sql() . " AS jenis
            FROM isr
            WHERE service='Broadcast' AND subservice='FM'
              AND freq BETWEEN 87.5 AND 108.0
              $where
            ORDER BY freq ASC
        ");
        $t_sql0 = microtime(true);
        $stmt->execute($p);
        $stations = $stmt->fetchAll();
        $t_sql1 = microtime(true);
        foreach ($stations as &$s) $s['freq'] = (float)$s['freq'];

        // Hitung summary di server untuk efisiensi
        $freqIndex = [];
        foreach ($stations as $s) {
            $f = round($s['freq'] * 10) / 10;
            if (!isset($freqIndex[$f])) $freqIndex[$f] = [];
            $freqIndex[$f][] = $s;
        }
        $used = 0; $free = 0; $adj1 = 0; $adj2 = 0;
        $spacing = 0.1; $guard = 0.055;
        for ($f = 87.5; $f <= 108.001; $f = round(($f + $spacing) * 10) / 10) {
            $fk = round($f * 10) / 10;
            if (isset($freqIndex[$fk])) { $used++; continue; }
            $has1 = isset($freqIndex[round(($fk - $spacing) * 10)/10]) || isset($freqIndex[round(($fk + $spacing) * 10)/10]);
            $has2 = isset($freqIndex[round(($fk - 2*$spacing) * 10)/10]) || isset($freqIndex[round(($fk + 2*$spacing) * 10)/10]);
            if ($has1) { $adj1++; } elseif ($has2) { $adj2++; } else { $free++; }
        }
        $total = $used + $adj1 + $adj2 + $free;
        $summary = [
            'total' => $total, 'used' => $used,
            'adjacent_1' => $adj1, 'adjacent_2' => $adj2, 'free' => $free,
            'pct_used' => $total ? round($used/$total*100, 1) : 0,
            'pct_free' => $total ? round($free/$total*100, 1) : 0,
        ];

        out(['stations' => $stations, 'total' => count($stations), 'summary' => $summary,
             'debug_sql_ms' => isset($t_sql0) ? round(($t_sql1-$t_sql0)*1000) : null]);

    // GET /api/cities
    case 'cities':
        $stmt = $pdo->prepare("
            SELECT DISTINCT area_of_service AS wilayah_layanan
            FROM isr
            WHERE service='Broadcast' AND subservice='FM'
            " . (!empty($q['province']) ? 'AND province = :province' : '') . "
            ORDER BY area_of_service
        ");
        $stmt->execute(!empty($q['province']) ? [':province' => $q['province']] : []);
        out(['cities' => array_column($stmt->fetchAll(), 'wilayah_layanan')]);

    // GET /api/stats
    case 'stats':
        [$w, $p] = base_where($q);
        $where = $w ? 'AND ' . implode(' AND ', $w) : '';
        $base  = "FROM isr WHERE service='Broadcast' AND subservice='FM' AND freq BETWEEN 87.5 AND 108.0 $where";
        $s1 = $pdo->prepare("SELECT area_of_service AS wilayah_layanan, COUNT(*) AS total $base GROUP BY area_of_service ORDER BY total DESC");
        $s1->execute($p);
        $s2 = $pdo->prepare("SELECT " . jenis_sql() . " AS jenis, COUNT(*) AS total $base GROUP BY jenis ORDER BY total DESC");
        $s2->execute($p);
        out(['per_wilayah' => $s1->fetchAll(), 'per_jenis' => $s2->fetchAll()]);

    // GET /api/interference
    case 'interference':
        [$w, $p] = base_where($q);
        $where = $w ? 'AND ' . implode(' AND ', $w) : '';
        $stmt = $pdo->prepare("
            SELECT id, freq, stn_name, clnt_name,
                city AS kota, area_of_service AS wilayah_layanan, province,
                COALESCE(erp_pwr_dbm, 40) AS erp_dbm,
                status_simf AS status,
                sid_lat AS latitude, sid_long AS longitude
            FROM isr
            WHERE service='Broadcast' AND subservice='FM'
              AND freq BETWEEN 87.5 AND 108.0
              AND sid_lat IS NOT NULL  AND sid_long IS NOT NULL
              AND sid_lat != 0        AND sid_long != 0
              $where
            ORDER BY freq ASC
        ");
        $stmt->execute($p);
        out(['stations' => $stmt->fetchAll()]);

    // GET /api/health
    case 'health':
        $t0 = microtime(true);
        $cnt = $pdo->query("SELECT COUNT(*) FROM isr WHERE service='Broadcast' AND subservice='FM'")->fetchColumn();
        $t1 = microtime(true);
        $exp = $pdo->query("SELECT COUNT(*) FROM isr WHERE service='Broadcast' AND subservice='FM' AND validity_date < CURDATE()")->fetchColumn();
        $t2 = microtime(true);
        out(['status' => 'ok', 'total_fm' => (int)$cnt, 'expired' => (int)$exp, 'time' => date('c'),
             'db_ms' => round(($t1-$t0)*1000), 'total_ms' => round(($t2-$t0)*1000)]);

    default:
        http_response_code(404);
        out(['error' => 'Endpoint tidak ada. Tersedia: /api/stations, /api/cities, /api/stats, /api/interference, /api/health']);
}
