<?php
// api/index.php — Entry point API
// Struktur endpoint:
//   GET /api/stations          → daftar stasiun + channel map + free blocks
//   GET /api/stations/:freq    → detail satu stasiun
//   GET /api/channels          → channel map saja (tanpa data stasiun lengkap)
//   GET /api/slots             → free blocks saja
//   GET /api/stats             → statistik ringkasan
//   GET /api/cities            → daftar kota/kabupaten unik
//   GET /api/health            → cek koneksi DB

declare(strict_types=1);

// ---------- Bootstrap ----------
require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/Response.php';
require_once __DIR__ . '/src/Cache.php';
require_once __DIR__ . '/src/ChannelEngine.php';
require_once __DIR__ . '/src/StationRepository.php';

$config = require __DIR__ . '/src/config.php';
$cache  = new Cache($config['cache']);
$db     = Database::connect($config['db']);
$repo   = new StationRepository($db);

// ---------- Headers ----------
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['cors']['allowed_origin']);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

// ---------- Routing ----------
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path   = preg_replace('#^/api#', '', $path); // strip prefix /api jika ada
$path   = rtrim($path, '/') ?: '/';
$parts  = explode('/', trim($path, '/'));
$route  = $parts[0] ?? '';
$param  = $parts[1] ?? null;

// Query params
$qp = $_GET;

switch ($route) {

    // ----------------------------------------------------------------
    // GET /stations[?province=&city=&jenis=&status=&search=]
    // GET /stations/:freq   → detail stasiun + channel info
    // ----------------------------------------------------------------
    case 'stations':
        if ($param !== null) {
            // Detail per frekuensi
            $freq = filter_var($param, FILTER_VALIDATE_FLOAT);
            if ($freq === false) Response::error('Invalid frequency');

            $station = $repo->getByFreq($freq);
            if (!$station) Response::notFound("Stasiun pada {$freq} MHz tidak ditemukan");

            Response::json(['data' => $station]);
        }

        $filters = array_filter([
            'province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA',
            'city'     => $qp['city']     ?? null,
            'status'   => $qp['status']   ?? null,
            'search'   => $qp['search']   ?? null,
            'freq_min' => $qp['freq_min'] ?? null,
            'freq_max' => $qp['freq_max'] ?? null,
        ]);

        $cacheKey = 'stations_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) {
            header('X-Cache: HIT');
            Response::json($cached);
        }

        $stations = $repo->getStations($filters);

        // Filter jenis di PHP (karena CASE expression MySQL tidak bisa di WHERE langsung)
        if (!empty($qp['jenis'])) {
            $stations = array_values(array_filter(
                $stations,
                fn($s) => $s['jenis'] === $qp['jenis']
            ));
        }

        $channelMap  = ChannelEngine::computeMap($stations);
        $freeBlocks  = ChannelEngine::findFreeBlocks($channelMap);
        $summary     = ChannelEngine::summarize($channelMap);

        $result = [
            'summary'     => $summary,
            'stations'    => $stations,
            'channel_map' => $channelMap,
            'free_blocks' => $freeBlocks,
            'filters'     => $filters,
            'meta'        => [
                'fm_min'          => ChannelEngine::FM_MIN,
                'fm_max'          => ChannelEngine::FM_MAX,
                'channel_spacing' => ChannelEngine::CHANNEL_SPACING,
                'generated_at'    => date('c'),
            ],
        ];

        $cache->set($cacheKey, $result);
        header('X-Cache: MISS');
        Response::json($result);
        break;

    // ----------------------------------------------------------------
    // GET /channels[?province=&city=&jenis=]
    // ----------------------------------------------------------------
    case 'channels':
        $filters = array_filter([
            'province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA',
            'city'     => $qp['city']     ?? null,
        ]);

        $cacheKey = 'channels_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) {
            header('X-Cache: HIT');
            Response::json($cached);
        }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);

        $result = [
            'channel_map' => $channelMap,
            'summary'     => ChannelEngine::summarize($channelMap),
        ];

        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ----------------------------------------------------------------
    // GET /slots[?province=&city=&min_count=2]
    // Slot kosong potensial
    // ----------------------------------------------------------------
    case 'slots':
        $filters = array_filter([
            'province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA',
            'city'     => $qp['city']     ?? null,
        ]);
        $minCount = max(1, (int)($qp['min_count'] ?? 1));

        $cacheKey = 'slots_' . md5(json_encode($filters) . $minCount);
        if ($cached = $cache->get($cacheKey)) {
            header('X-Cache: HIT');
            Response::json($cached);
        }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);
        $blocks     = array_values(array_filter(
            ChannelEngine::findFreeBlocks($channelMap),
            fn($b) => $b['count'] >= $minCount
        ));

        $result = ['free_blocks' => $blocks, 'total' => count($blocks)];
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ----------------------------------------------------------------
    // GET /stats[?province=&city=]
    // ----------------------------------------------------------------
    case 'stats':
        $filters = array_filter([
            'province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA',
            'city'     => $qp['city']     ?? null,
        ]);

        $cacheKey = 'stats_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) {
            header('X-Cache: HIT');
            Response::json($cached);
        }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);
        $dbStats    = $repo->getStats($filters);
        $summary    = ChannelEngine::summarize($channelMap);

        $result = array_merge($summary, $dbStats);
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ----------------------------------------------------------------
    // GET /cities[?province=]
    // ----------------------------------------------------------------
    case 'cities':
        $province = $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA';
        Response::json(['cities' => $repo->getCities($province)]);
        break;

    // ----------------------------------------------------------------
    // GET /health
    // ----------------------------------------------------------------
    case 'health':
        try {
            $db->query('SELECT 1');
            Response::json(['status' => 'ok', 'db' => 'connected', 'time' => date('c')]);
        } catch (Exception $e) {
            Response::json(['status' => 'error', 'db' => $e->getMessage()], 503);
        }
        break;

    default:
        Response::notFound('Endpoint tidak ditemukan. Tersedia: /stations, /channels, /slots, /stats, /cities, /health');
}
