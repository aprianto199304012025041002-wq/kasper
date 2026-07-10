<?php
// api/index.php v3 — tambah: /provinces, /stations/:id detail, /interference
declare(strict_types=1);

require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/Response.php';
require_once __DIR__ . '/src/Cache.php';
require_once __DIR__ . '/src/ChannelEngine.php';
require_once __DIR__ . '/src/StationRepository.php';
require_once __DIR__ . '/src/ProvinceRepository.php';
require_once __DIR__ . '/src/InterferenceEngine.php';

$config = require __DIR__ . '/src/config.php';
$cache  = new Cache($config['cache']);
$db     = Database::connect($config['db']);
$repo   = new StationRepository($db);
$provRepo = new ProvinceRepository($db);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['cors']['allowed_origin']);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET')     { Response::error('Method not allowed', 405); }

$path  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path  = preg_replace('#^/api#', '', $path);
$path  = rtrim($path, '/') ?: '/';
$parts = explode('/', trim($path, '/'));
$route = $parts[0] ?? '';
$param = $parts[1] ?? null;
$qp    = $_GET;

switch ($route) {

    // ── /stations[?province=&city=&jenis=&status=&search=] ─────────────
    // ── /stations/:freq  → detail satu stasiun lengkap + tetangga ───────
    case 'stations':
        if ($param !== null) {
            // Coba cari by freq dulu, lalu by id
            $byFreq = filter_var($param, FILTER_VALIDATE_FLOAT);
            $byId   = filter_var($param, FILTER_VALIDATE_INT);

            if ($byFreq !== false) {
                $station = $repo->getByFreq($byFreq);
            } elseif ($byId !== false) {
                $station = $repo->getById((int)$byId);
            } else {
                Response::error('Parameter tidak valid');
            }

            if (!$station) Response::notFound("Stasiun tidak ditemukan");

            // Stasiun tetangga: frekuensi ±2 MHz, provinsi sama
            $neighbors = $repo->getNeighbors(
                (float)$station['freq'],
                $station['province'] ?? '',
                2.0
            );

            Response::json([
                'data'      => $station,
                'neighbors' => $neighbors,
            ]);
        }

        $province = $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA';
        $filters  = array_filter([
            'province' => $province,
            'city'     => $qp['city']     ?? null,
            'status'   => $qp['status']   ?? null,
            'search'   => $qp['search']   ?? null,
            'freq_min' => $qp['freq_min'] ?? null,
            'freq_max' => $qp['freq_max'] ?? null,
        ]);

        $cacheKey = 'stations_' . md5(json_encode($filters) . ($qp['jenis'] ?? ''));
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        $stations = $repo->getStations($filters);
        if (!empty($qp['jenis'])) {
            $stations = array_values(array_filter($stations, fn($s) => $s['jenis'] === $qp['jenis']));
        }

        $channelMap = ChannelEngine::computeMap($stations);
        $freeBlocks = ChannelEngine::findFreeBlocks($channelMap);
        $summary    = ChannelEngine::summarize($channelMap);

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

    // ── /provinces ───────────────────────────────────────────────────────
    case 'provinces':
        $cacheKey = 'provinces_list';
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        $result = [
            'provinces'    => $provRepo->listWithStats(),
            'generated_at' => date('c'),
        ];
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ── /cities[?province=] ──────────────────────────────────────────────
    case 'cities':
        $province = $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA';
        Response::json([
            'province' => $province,
            'cities'   => $provRepo->citiesInProvince($province),
        ]);
        break;

    // ── /channels[?province=&city=] ──────────────────────────────────────
    case 'channels':
        $filters  = array_filter(['province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA', 'city' => $qp['city'] ?? null]);
        $cacheKey = 'channels_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);
        $result     = ['channel_map' => $channelMap, 'summary' => ChannelEngine::summarize($channelMap)];
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ── /slots[?province=&city=&min_count=] ─────────────────────────────
    case 'slots':
        $filters  = array_filter(['province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA', 'city' => $qp['city'] ?? null]);
        $minCount = max(1, (int)($qp['min_count'] ?? 1));
        $cacheKey = 'slots_' . md5(json_encode($filters) . $minCount);
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);
        $blocks     = array_values(array_filter(ChannelEngine::findFreeBlocks($channelMap), fn($b) => $b['count'] >= $minCount));
        $result     = ['free_blocks' => $blocks, 'total' => count($blocks)];
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ── /interference[?province=&city=] ─────────────────────────────────
    case 'interference':
        $province = $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA';
        $filters  = array_filter(['province' => $province, 'city' => $qp['city'] ?? null]);
        $cacheKey = 'interference_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        // Ambil stasiun dengan lat/lon
        $stations = $repo->getStationsWithCoords($filters);
        if (empty($stations)) {
            Response::json([
                'message' => 'Tidak ada stasiun dengan koordinat GPS. Isi kolom latitude/longitude di database.',
                'pairs'   => [],
                'summary' => ['co_channel'=>0,'adjacent_1'=>0,'adjacent_2'=>0,'clean'=>0],
                'stations_evaluated' => 0,
            ]);
        }

        $result = InterferenceEngine::evaluate($stations);
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ── /stats[?province=&city=] ─────────────────────────────────────────
    case 'stats':
        $filters  = array_filter(['province' => $qp['province'] ?? 'DAERAH ISTIMEWA YOGYAKARTA', 'city' => $qp['city'] ?? null]);
        $cacheKey = 'stats_' . md5(json_encode($filters));
        if ($cached = $cache->get($cacheKey)) { header('X-Cache: HIT'); Response::json($cached); }

        $stations   = $repo->getStations($filters);
        $channelMap = ChannelEngine::computeMap($stations);
        $result     = array_merge(ChannelEngine::summarize($channelMap), $repo->getStats($filters));
        $cache->set($cacheKey, $result);
        Response::json($result);
        break;

    // ── /health ──────────────────────────────────────────────────────────
    case 'health':
        try {
            $db->query('SELECT 1');
            Response::json(['status'=>'ok','db'=>'connected','time'=>date('c'),'version'=>'3.0']);
        } catch (Exception $e) {
            Response::json(['status'=>'error','db'=>$e->getMessage()], 503);
        }
        break;

    default:
        Response::notFound('Endpoint tidak ditemukan. Tersedia: /stations, /provinces, /cities, /channels, /slots, /interference, /stats, /health');
}
