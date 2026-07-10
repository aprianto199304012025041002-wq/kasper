<?php
class ChannelEngine {
    const FM_MIN          = 87.5;
    const FM_MAX          = 108.0;
    const CHANNEL_SPACING = 0.2;
    const MATCH_TOLERANCE = 0.15;

    public static function buildGrid(): array {
        $channels = [];
        $steps = round((self::FM_MAX - self::FM_MIN) / self::CHANNEL_SPACING);
        for ($i = 0; $i <= $steps; $i++) $channels[] = round((self::FM_MIN + $i * self::CHANNEL_SPACING) * 10) / 10;
        return $channels;
    }

    public static function computeMap(array $stations): array {
        $grid = self::buildGrid();
        $map  = [];
        foreach ($grid as $ch) {
            $lower = round(($ch - self::CHANNEL_SPACING / 2) * 100) / 100;
            $upper = round(($ch + self::CHANNEL_SPACING / 2) * 100) / 100;
            $used  = null;
            foreach ($stations as $s) {
                if (abs((float)$s['freq'] - $ch) < self::MATCH_TOLERANCE) { $used = $s; break; }
            }
            if ($used) { $map[] = ['freq'=>$ch,'lower'=>$lower,'upper'=>$upper,'type'=>'used','station'=>$used]; continue; }
            $adjL = $adjR = null;
            foreach ($stations as $s) {
                $f = (float)$s['freq'];
                if (abs($f - ($ch - self::CHANNEL_SPACING)) < self::MATCH_TOLERANCE) $adjL = $s;
                if (abs($f - ($ch + self::CHANNEL_SPACING)) < self::MATCH_TOLERANCE) $adjR = $s;
            }
            if ($adjL || $adjR) { $map[] = ['freq'=>$ch,'lower'=>$lower,'upper'=>$upper,'type'=>'adjacent','adj_left'=>$adjL,'adj_right'=>$adjR]; continue; }
            $map[] = ['freq'=>$ch,'lower'=>$lower,'upper'=>$upper,'type'=>'free'];
        }
        return $map;
    }

    public static function findFreeBlocks(array $channelMap): array {
        $freeFreqs = array_values(array_map(fn($c)=>$c['freq'], array_filter($channelMap, fn($c)=>$c['type']==='free')));
        $blocks = []; $i = 0; $n = count($freeFreqs);
        while ($i < $n) {
            $j = $i;
            while ($j < $n-1 && round(($freeFreqs[$j+1]-$freeFreqs[$j])*10)/10 === self::CHANNEL_SPACING) $j++;
            $start=$freeFreqs[$i]; $end=$freeFreqs[$j]; $count=$j-$i+1;
            $center=round((($start+$end)/2)*10)/10;
            $blocks[] = [
                'start'=>$start,'end'=>$end,'count'=>$count,'center'=>$center,
                'lower'=>round(($center-self::CHANNEL_SPACING/2)*100)/100,
                'upper'=>round(($center+self::CHANNEL_SPACING/2)*100)/100,
                'width_khz'=>round(($end-$start+self::CHANNEL_SPACING)*1000),
                'priority'=>self::ratePriority($count),
            ];
            $i=$j+1;
        }
        usort($blocks, fn($a,$b)=>$b['count']-$a['count']);
        return $blocks;
    }

    public static function summarize(array $channelMap): array {
        $total=$n=count($channelMap);
        $used=count(array_filter($channelMap,fn($c)=>$c['type']==='used'));
        $adj=count(array_filter($channelMap,fn($c)=>$c['type']==='adjacent'));
        $free=count(array_filter($channelMap,fn($c)=>$c['type']==='free'));
        return ['total'=>$total,'used'=>$used,'adjacent'=>$adj,'free'=>$free,
                'pct_used'=>$total>0?round($used/$total*100,1):0,
                'pct_free'=>$total>0?round($free/$total*100,1):0];
    }

    private static function ratePriority(int $count): string {
        if ($count>=4) return 'high';
        if ($count>=2) return 'medium';
        return 'low';
    }
}
