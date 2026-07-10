<?php
// api/src/InterferenceEngine.php
// Model interferensi FM sederhana berbasis ITU-R BS.412 dan jarak antar pemancar.
// Asumsi: propagasi free-space, ERP dalam dBm, jarak dalam km.

class InterferenceEngine
{
    // Batas proteksi rasio (dB) — nilai minimum agar tidak interferensi
    const PR_COCHANNEL  = 30.0; // dB — co-channel (frekuensi sama)
    const PR_ADJACENT_1 = 20.0; // dB — adjacent channel ±200 kHz
    const PR_ADJACENT_2 = 10.0; // dB — 2nd adjacent ±400 kHz

    // Radius jangkauan maksimum yang dievaluasi (km)
    const EVAL_RADIUS_KM = 150.0;

    // Radius bumi (km)
    const EARTH_R = 6371.0;

    /**
     * Hitung jarak Haversine antara dua titik (lat/lon dalam derajat)
     */
    public static function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r    = self::EARTH_R;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a    = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2)**2;
        return $r * 2 * asin(sqrt($a));
    }

    /**
     * Estimasi field strength (dBuV/m) pada jarak tertentu dari pemancar FM.
     * Model free-space sederhana: Lfs = 32.45 + 20·log10(f_MHz) + 20·log10(d_km)
     * Fs = ERP_dBm + 107.2 - Lfs   (konversi ERP dBm ke dBW dulu: -30 dBW, lalu +137.2)
     */
    public static function fieldStrength(float $erp_dbm, float $freq_mhz, float $dist_km): float
    {
        if ($dist_km <= 0) return 120.0; // sangat dekat
        $lfs = 32.45 + 20 * log10($freq_mhz) + 20 * log10($dist_km);
        $erp_dbw = $erp_dbm - 30;
        return $erp_dbw + 137.2 - $lfs; // dBuV/m
    }

    /**
     * Evaluasi interferensi antar semua pasangan stasiun.
     *
     * @param  array $stations  Array stasiun dengan keys: freq, erp_dbm, latitude, longitude, stn_name, kota
     * @return array {
     *   pairs: [ { tx, rx, type, dist_km, pr_db, level } ],
     *   summary: { co_channel, adjacent_1, adjacent_2, clean }
     * }
     */
    public static function evaluate(array $stations): array
    {
        // Filter stasiun yang punya koordinat
        $valid = array_values(array_filter($stations, fn($s) =>
            !empty($s['latitude']) && !empty($s['longitude']) &&
            is_numeric($s['latitude']) && is_numeric($s['longitude'])
        ));

        $pairs   = [];
        $summary = ['co_channel' => 0, 'adjacent_1' => 0, 'adjacent_2' => 0, 'clean' => 0];
        $n       = count($valid);

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                $tx = $valid[$i];
                $rx = $valid[$j];

                $dist = self::haversine(
                    (float)$tx['latitude'], (float)$tx['longitude'],
                    (float)$rx['latitude'], (float)$rx['longitude']
                );

                if ($dist > self::EVAL_RADIUS_KM) continue;

                $freqDiff = abs((float)$tx['freq'] - (float)$rx['freq']);
                $freqDiff = round($freqDiff * 10) / 10; // bulatkan ke 0.1 MHz

                // Tentukan tipe interferensi berdasar selisih frekuensi
                if ($freqDiff < 0.05) {
                    $type    = 'co_channel';
                    $pr_req  = self::PR_COCHANNEL;
                } elseif (abs($freqDiff - 0.2) < 0.05) {
                    $type    = 'adjacent_1';
                    $pr_req  = self::PR_ADJACENT_1;
                } elseif (abs($freqDiff - 0.4) < 0.05) {
                    $type    = 'adjacent_2';
                    $pr_req  = self::PR_ADJACENT_2;
                } else {
                    continue; // frekuensi jauh, tidak relevan
                }

                // Hitung protection ratio aktual
                // D/U ratio: wanted signal (rx dari tx1) vs unwanted (rx dari tx2)
                $fs_wanted   = self::fieldStrength((float)$tx['erp_dbm'], (float)$tx['freq'], $dist);
                $fs_unwanted = self::fieldStrength((float)$rx['erp_dbm'], (float)$rx['freq'], max(0.1, $dist));

                // Estimasi: jika jarak lebih dari 50 km, biasanya aman
                $pr_actual = $fs_wanted - $fs_unwanted;

                // Level: critical jika D/U < requirement, warning jika kurang 6 dB margin
                if ($pr_actual < $pr_req) {
                    $level = 'critical';
                } elseif ($pr_actual < $pr_req + 6) {
                    $level = 'warning';
                } else {
                    $level = 'ok';
                }

                $pairs[] = [
                    'tx'         => self::stationInfo($tx),
                    'rx'         => self::stationInfo($rx),
                    'type'       => $type,
                    'freq_diff'  => $freqDiff,
                    'dist_km'    => round($dist, 2),
                    'pr_actual'  => round($pr_actual, 1),
                    'pr_required'=> $pr_req,
                    'margin_db'  => round($pr_actual - $pr_req, 1),
                    'level'      => $level,
                ];

                if ($level !== 'ok') {
                    $summary[$type]++;
                }
            }
        }

        // Hitung pasangan bersih
        $summary['clean'] = count($valid) - array_sum([
            $summary['co_channel'],
            $summary['adjacent_1'],
            $summary['adjacent_2'],
        ]);

        usort($pairs, fn($a, $b) => $a['margin_db'] <=> $b['margin_db']); // terburuk duluan

        return [
            'pairs'           => $pairs,
            'summary'         => $summary,
            'stations_evaluated' => $n,
            'model'           => 'free-space ITU-R BS.412 approximation',
        ];
    }

    private static function stationInfo(array $s): array
    {
        return [
            'stn_name' => $s['stn_name'] ?? '—',
            'clnt_name'=> $s['clnt_name'] ?? '—',
            'freq'     => $s['freq'],
            'erp_dbm'  => $s['erp_dbm'],
            'kota'     => $s['kota']     ?? $s['city'] ?? '—',
            'lat'      => (float)($s['latitude']  ?? 0),
            'lon'      => (float)($s['longitude'] ?? 0),
        ];
    }
}
