<?php
// api/src/ChannelEngine.php
// Port logika channelEngine.js ke PHP agar bisa dihitung server-side

class ChannelEngine
{
    const FM_MIN          = 87.5;
    const FM_MAX          = 108.0;
    const CHANNEL_SPACING = 0.2;   // kHz
    const MATCH_TOLERANCE = 0.15;  // MHz — toleransi pencocokan center ke kanal grid

    /**
     * Build grid kanal 200 kHz → [87.5, 87.7, 87.9, …, 108.0]
     */
    public static function buildGrid(): array
    {
        $channels = [];
        $steps = round((self::FM_MAX - self::FM_MIN) / self::CHANNEL_SPACING);
        for ($i = 0; $i <= $steps; $i++) {
            $channels[] = round((self::FM_MIN + $i * self::CHANNEL_SPACING) * 10) / 10;
        }
        return $channels;
    }

    /**
     * Peta status seluruh kanal berdasar daftar stasiun.
     * Tiap elemen: { freq, lower, upper, type, station? }
     */
    public static function computeMap(array $stations): array
    {
        $grid = self::buildGrid();
        $map  = [];

        foreach ($grid as $ch) {
            $lower = round(($ch - self::CHANNEL_SPACING / 2) * 100) / 100;
            $upper = round(($ch + self::CHANNEL_SPACING / 2) * 100) / 100;

            // Cek apakah ada stasiun yang center-nya dekat kanal ini
            $used = null;
            foreach ($stations as $s) {
                if (abs((float)$s['freq'] - $ch) < self::MATCH_TOLERANCE) {
                    $used = $s;
                    break;
                }
            }

            if ($used !== null) {
                $map[] = [
                    'freq'    => $ch,
                    'lower'   => $lower,
                    'upper'   => $upper,
                    'type'    => 'used',
                    'station' => $used,
                ];
                continue;
            }

            // Cek adjacent (kanal di kiri/kanan stasiun aktif)
            $adjLeft = $adjRight = null;
            foreach ($stations as $s) {
                $f = (float)$s['freq'];
                if (abs($f - ($ch - self::CHANNEL_SPACING)) < self::MATCH_TOLERANCE) $adjLeft  = $s;
                if (abs($f - ($ch + self::CHANNEL_SPACING)) < self::MATCH_TOLERANCE) $adjRight = $s;
            }

            if ($adjLeft !== null || $adjRight !== null) {
                $map[] = [
                    'freq'     => $ch,
                    'lower'    => $lower,
                    'upper'    => $upper,
                    'type'     => 'adjacent',
                    'adj_left'  => $adjLeft,
                    'adj_right' => $adjRight,
                ];
                continue;
            }

            $map[] = [
                'freq'  => $ch,
                'lower' => $lower,
                'upper' => $upper,
                'type'  => 'free',
            ];
        }

        return $map;
    }

    /**
     * Cari blok kanal kosong berurutan (gap analysis).
     */
    public static function findFreeBlocks(array $channelMap): array
    {
        $freeFreqs = array_values(array_map(
            fn($c) => $c['freq'],
            array_filter($channelMap, fn($c) => $c['type'] === 'free')
        ));

        $blocks = [];
        $i = 0;
        $n = count($freeFreqs);

        while ($i < $n) {
            $j = $i;
            while (
                $j < $n - 1 &&
                round(($freeFreqs[$j + 1] - $freeFreqs[$j]) * 10) / 10 === self::CHANNEL_SPACING
            ) {
                $j++;
            }

            $start    = $freeFreqs[$i];
            $end      = $freeFreqs[$j];
            $count    = $j - $i + 1;
            $center   = round((($start + $end) / 2) * 10) / 10;
            $widthKHz = round(($end - $start + self::CHANNEL_SPACING) * 1000);

            $blocks[] = [
                'start'     => $start,
                'end'       => $end,
                'count'     => $count,
                'center'    => $center,
                'lower'     => round(($center - self::CHANNEL_SPACING / 2) * 100) / 100,
                'upper'     => round(($center + self::CHANNEL_SPACING / 2) * 100) / 100,
                'width_khz' => $widthKHz,
                'priority'  => self::ratePriority($count),
            ];

            $i = $j + 1;
        }

        usort($blocks, fn($a, $b) => $b['count'] - $a['count']);
        return $blocks;
    }

    /**
     * Ringkasan statistik.
     */
    public static function summarize(array $channelMap): array
    {
        $total    = count($channelMap);
        $used     = count(array_filter($channelMap, fn($c) => $c['type'] === 'used'));
        $adjacent = count(array_filter($channelMap, fn($c) => $c['type'] === 'adjacent'));
        $free     = count(array_filter($channelMap, fn($c) => $c['type'] === 'free'));

        return [
            'total'    => $total,
            'used'     => $used,
            'adjacent' => $adjacent,
            'free'     => $free,
            'pct_used' => $total > 0 ? round($used / $total * 100, 1) : 0,
            'pct_free' => $total > 0 ? round($free / $total * 100, 1) : 0,
        ];
    }

    private static function ratePriority(int $count): string
    {
        if ($count >= 4) return 'high';
        if ($count >= 2) return 'medium';
        return 'low';
    }
}
