<?php
// api/src/StationRepository.php v3 — tambah getById, getNeighbors, getStationsWithCoords

class StationRepository
{
    private const TABLE = 'isr_stations';
    private const COL_MAP = [
        'freq'      => 'freq',
        'bw'        => 'bwidth',
        'stn_name'  => 'stn_name',
        'clnt_name' => 'clnt_name',
        'service'   => 'service',
        'subservice'=> 'subservice',
        'erp'       => 'erp_pwr_dbm',
        'status'    => 'lic_status',
        'province'  => 'province',
        'city'      => 'city',
        'district'  => 'district',
        'no_simf'   => 'no_simf',
        'validity'  => 'lic_expiry',
        'lat'       => 'latitude',
        'lon'       => 'longitude',
        'tower_h'   => 'tower_height_m',
        'gain'      => 'antenna_gain',
    ];

    public function __construct(private PDO $db) {}

    // ── Daftar stasiun dengan filter ─────────────────────────────────────
    public function getStations(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $sql = "
            SELECT
                id,
                {$this->col('no_simf')}     AS no_simf,
                {$this->col('freq')}         AS freq,
                {$this->col('bw')}           AS bw_khz,
                ROUND({$this->col('freq')} - {$this->col('bw')}/2/1000, 4) AS lower_mhz,
                ROUND({$this->col('freq')} + {$this->col('bw')}/2/1000, 4) AS upper_mhz,
                {$this->col('stn_name')}     AS stn_name,
                {$this->col('clnt_name')}    AS clnt_name,
                {$this->col('city')}         AS kota,
                {$this->col('district')}     AS kecamatan,
                {$this->col('province')}     AS province,
                {$this->col('erp')}          AS erp_dbm,
                {$this->col('status')}       AS status,
                {$this->col('validity')}     AS validity,
                {$this->col('lat')}          AS latitude,
                {$this->col('lon')}          AS longitude,
                {$this->classifyJenis()}     AS jenis
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              $where
            ORDER BY {$this->col('freq')} ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    // ── Detail satu stasiun by ID ─────────────────────────────────────────
    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM " . self::TABLE . " WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // ── Detail satu stasiun by frekuensi (±0.05 MHz) ─────────────────────
    public function getByFreq(float $freq): ?array
    {
        $sql = "SELECT * FROM " . self::TABLE . "
                WHERE {$this->col('service')} = 'Broadcast'
                  AND {$this->col('subservice')} = 'FM'
                  AND ABS({$this->col('freq')} - :freq) < 0.05
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':freq' => $freq]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // ── Stasiun tetangga: frekuensi berdekatan, provinsi sama ─────────────
    public function getNeighbors(float $centerFreq, string $province, float $freqRange = 2.0): array
    {
        $sql = "
            SELECT
                id,
                {$this->col('freq')}      AS freq,
                {$this->col('stn_name')}  AS stn_name,
                {$this->col('clnt_name')} AS clnt_name,
                {$this->col('city')}      AS kota,
                {$this->col('erp')}       AS erp_dbm,
                {$this->col('status')}    AS status,
                {$this->col('lat')}       AS latitude,
                {$this->col('lon')}       AS longitude,
                ABS({$this->col('freq')} - :cf) AS freq_distance
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              AND {$this->col('province')} = :prov
              AND ABS({$this->col('freq')} - :cf2) BETWEEN 0.05 AND :range
            ORDER BY freq_distance ASC
            LIMIT 10
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':cf' => $centerFreq, ':cf2' => $centerFreq, ':prov' => $province, ':range' => $freqRange]);
        return $stmt->fetchAll();
    }

    // ── Stasiun dengan koordinat GPS (untuk interferensi) ─────────────────
    public function getStationsWithCoords(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $sql = "
            SELECT
                id,
                {$this->col('freq')}      AS freq,
                {$this->col('bw')}        AS bw_khz,
                {$this->col('stn_name')}  AS stn_name,
                {$this->col('clnt_name')} AS clnt_name,
                {$this->col('city')}      AS kota,
                {$this->col('province')}  AS province,
                {$this->col('erp')}       AS erp_dbm,
                {$this->col('status')}    AS status,
                {$this->col('lat')}       AS latitude,
                {$this->col('lon')}       AS longitude
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              AND {$this->col('lat')} IS NOT NULL
              AND {$this->col('lon')} IS NOT NULL
              $where
            ORDER BY {$this->col('freq')} ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    // ── Statistik per kota dan jenis ─────────────────────────────────────
    public function getStats(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);
        $sqlKota = "
            SELECT {$this->col('city')} AS kota, COUNT(*) AS total
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast' AND {$this->col('subservice')} = 'FM' $where
            GROUP BY {$this->col('city')} ORDER BY total DESC";
        $s1 = $this->db->prepare($sqlKota); $s1->execute($params);

        $sqlJenis = "
            SELECT {$this->classifyJenis()} AS jenis, COUNT(*) AS total
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast' AND {$this->col('subservice')} = 'FM' $where
            GROUP BY jenis ORDER BY total DESC";
        $s2 = $this->db->prepare($sqlJenis); $s2->execute($params);

        return ['per_kota' => $s1->fetchAll(), 'per_jenis' => $s2->fetchAll()];
    }

    // ── Daftar kota unik ──────────────────────────────────────────────────
    public function getCities(?string $province = null): array
    {
        $where  = $province ? "AND {$this->col('province')} = :province" : '';
        $params = $province ? [':province' => $province] : [];
        $stmt = $this->db->prepare(
            "SELECT DISTINCT {$this->col('city')} AS kota FROM " . self::TABLE .
            " WHERE {$this->col('service')}='Broadcast' AND {$this->col('subservice')}='FM' $where ORDER BY kota"
        );
        $stmt->execute($params);
        return array_column($stmt->fetchAll(), 'kota');
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private function col(string $key): string { return self::COL_MAP[$key] ?? $key; }

    private function classifyJenis(): string
    {
        $c = $this->col('clnt_name');
        return "CASE
            WHEN $c LIKE '%RRI%' OR $c LIKE '%RADIO REPUBLIK%' THEN 'publik'
            WHEN $c LIKE '%LPPL%' OR $c LIKE '%LEMBAGA PENYIARAN PUBLIK LOKAL%' THEN 'publik_lokal'
            WHEN $c LIKE '%PERKUMPULAN%' OR $c LIKE '%KOMUNITAS%' THEN 'komunitas'
            ELSE 'swasta'
        END";
    }

    private function buildWhere(array $filters): array
    {
        $clauses = []; $params = [];
        if (!empty($filters['province'])) { $clauses[] = "{$this->col('province')} = :province"; $params[':province'] = $filters['province']; }
        if (!empty($filters['city']))     { $clauses[] = "{$this->col('city')} = :city";         $params[':city']     = $filters['city']; }
        if (!empty($filters['status']))   { $clauses[] = "{$this->col('status')} = :status";     $params[':status']   = $filters['status']; }
        if (!empty($filters['freq_min'])) { $clauses[] = "{$this->col('freq')} >= :freq_min";    $params[':freq_min'] = (float)$filters['freq_min']; }
        if (!empty($filters['freq_max'])) { $clauses[] = "{$this->col('freq')} <= :freq_max";    $params[':freq_max'] = (float)$filters['freq_max']; }
        if (!empty($filters['search']))   { $clauses[] = "({$this->col('stn_name')} LIKE :search OR {$this->col('clnt_name')} LIKE :search)"; $params[':search'] = '%'.$filters['search'].'%'; }
        return [$clauses ? 'AND '.implode(' AND ', $clauses) : '', $params];
    }
}
