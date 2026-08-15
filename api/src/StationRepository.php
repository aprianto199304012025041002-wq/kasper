<?php
class StationRepository
{
    private const TABLE = 'isr';

    public function __construct(private PDO $db) {}

    public function getStations(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $sql = "
            SELECT
                id, no_simf, freq,
                bwidth                                      AS bw_khz,
                ROUND(freq - bwidth/2/1000, 4)             AS lower_mhz,
                ROUND(freq + bwidth/2/1000, 4)             AS upper_mhz,
                stn_name, clnt_name,
                city                                        AS kota,
                district                                    AS kecamatan,
                area_of_service                             AS wilayah_layanan,
                province,
                erp_pwr_dbm                                 AS erp_dbm,
                status_simf                                 AS status,
                validity_date                               AS validity,
                sid_lat                                     AS latitude,
                sid_long                                    AS longitude,
                {$this->classifyJenis()}                    AS jenis
            FROM " . self::TABLE . "
            WHERE service = 'Broadcast'
              AND subservice = 'FM'
              AND freq BETWEEN 87.5 AND 108.0
              $where
            ORDER BY freq ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getByFreq(float $freq): ?array
    {
        $sql = "
            SELECT
                id, no_simf, freq,
                bwidth AS bw_khz,
                ROUND(freq - bwidth/2/1000, 4) AS lower_mhz,
                ROUND(freq + bwidth/2/1000, 4) AS upper_mhz,
                stn_name, clnt_name,
                city AS kota, district AS kecamatan, area_of_service AS wilayah_layanan, province,
                erp_pwr_dbm AS erp_dbm,
                status_simf AS status,
                validity_date AS validity,
                licence_date, appl_date,
                hgt_ant AS tower_height_m,
                gain AS antenna_gain,
                sid_lat AS latitude, sid_long AS longitude,
                equip_type, eq_mfr, eq_mdl,
                {$this->classifyJenis()} AS jenis
            FROM " . self::TABLE . "
            WHERE service='Broadcast' AND subservice='FM'
              AND ABS(freq - :freq) < 0.05
            LIMIT 1
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':freq' => $freq]);
        return $stmt->fetch() ?: null;
    }

    public function getById(int $id): ?array
    {
        $sql = "
            SELECT id, freq, bwidth AS bw_khz, stn_name, clnt_name,
                   city AS kota, district AS kecamatan, area_of_service AS wilayah_layanan, province,
                   erp_pwr_dbm AS erp_dbm, status_simf AS status,
                   sid_lat AS latitude, sid_long AS longitude,
                   validity_date AS validity, no_simf, masa_laku,
                   {$this->classifyJenis()} AS jenis
            FROM " . self::TABLE . " WHERE id=:id LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function getNeighbors(float $cf, string $province = '', float $range = 2.0): array
    {
        $sql = "
            SELECT id, freq, stn_name, clnt_name,
                   city AS kota, area_of_service AS wilayah_layanan, province,
                   erp_pwr_dbm AS erp_dbm,
                   status_simf AS status,
                   sid_lat AS latitude, sid_long AS longitude,
                   ABS(freq - :cf) AS freq_distance
            FROM " . self::TABLE . "
            WHERE service='Broadcast' AND subservice='FM'
              AND ABS(freq - :cf2) BETWEEN 0.05 AND :range
            ORDER BY freq_distance ASC LIMIT 30
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':cf'=>$cf,':cf2'=>$cf,':range'=>$range]);
        return $stmt->fetchAll();
    }

    public function getStationsWithCoords(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $sql = "
            SELECT id, freq, bwidth AS bw_khz, stn_name, clnt_name,
                   city AS kota, district AS kecamatan, area_of_service AS wilayah_layanan, province,
                   erp_pwr_dbm AS erp_dbm, status_simf AS status,
                   sid_lat AS latitude, sid_long AS longitude
            FROM " . self::TABLE . "
            WHERE service='Broadcast' AND subservice='FM'
              AND freq BETWEEN 87.5 AND 108.0
              AND sid_lat IS NOT NULL AND sid_long IS NOT NULL
              AND sid_lat != 0 AND sid_long != 0
              $where
            ORDER BY freq ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getStats(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $base = "FROM " . self::TABLE . " WHERE service='Broadcast' AND subservice='FM' AND freq BETWEEN 87.5 AND 108.0 $where";
        $s1 = $this->db->prepare("SELECT city AS kota, COUNT(*) AS total $base GROUP BY city ORDER BY total DESC");
        $s1->execute($params);
        $s2 = $this->db->prepare("SELECT {$this->classifyJenis()} AS jenis, COUNT(*) AS total $base GROUP BY jenis ORDER BY total DESC");
        $s2->execute($params);
        return ['per_kota'=>$s1->fetchAll(),'per_jenis'=>$s2->fetchAll()];
    }

    public function getCities(?string $province=null): array
    {
        $where=$province?"AND province=:province":'';
        $params=$province?[':province'=>$province]:[];
        $stmt=$this->db->prepare("SELECT DISTINCT area_of_service AS wilayah_layanan FROM ".self::TABLE." WHERE service='Broadcast' AND subservice='FM' $where ORDER BY area_of_service");
        $stmt->execute($params);
        return array_column($stmt->fetchAll(),'kota');
    }

    private function classifyJenis(): string
    {
        return "CASE
            WHEN clnt_name LIKE '%RRI%' OR clnt_name LIKE '%RADIO REPUBLIK%' THEN 'publik'
            WHEN clnt_name LIKE '%LPPL%' OR clnt_name LIKE '%LEMBAGA PENYIARAN PUBLIK LOKAL%' THEN 'publik_lokal'
            WHEN clnt_name LIKE '%PERKUMPULAN%' OR clnt_name LIKE '%KOMUNITAS%' THEN 'komunitas'
            ELSE 'swasta'
        END";
    }

    private function buildWhere(array $filters): array
    {
        $c=[]; $p=[];
        if(!empty($filters['province'])){$c[]="province=:province";$p[':province']=$filters['province'];}
        if(!empty($filters['city'])){$c[]="area_of_service=:city";$p[':city']=$filters['city'];}
        if(!empty($filters['status'])){$c[]="status_simf=:status";$p[':status']=$filters['status'];}
        if(!empty($filters['freq_min'])){$c[]="freq>=:freq_min";$p[':freq_min']=(float)$filters['freq_min'];}
        if(!empty($filters['freq_max'])){$c[]="freq<=:freq_max";$p[':freq_max']=(float)$filters['freq_max'];}
        if(!empty($filters['search'])){$c[]="(stn_name LIKE :search OR clnt_name LIKE :search)";$p[':search']='%'.$filters['search'].'%';}
        return [$c?'AND '.implode(' AND ',$c):'',$p];
    }
}
