<?php
// api/src/StationRepository.php
// Semua query ke tabel ISR ada di sini — ubah nama tabel/kolom sesuai schema database kamu

class StationRepository
{
    // ---------------------------------------------------------------
    // Sesuaikan nama tabel dan kolom dengan database ISR kamu
    // ---------------------------------------------------------------
    private const TABLE   = 'isr_stations';   // nama tabel utama
    private const COL_MAP = [
        'freq'      => 'freq',          // frekuensi center (MHz)
        'bw'        => 'bwidth',        // bandwidth (kHz)
        'stn_name'  => 'stn_name',      // nama pemancar
        'clnt_name' => 'clnt_name',     // nama penyelenggara
        'service'   => 'service',       // 'Broadcast'
        'subservice'=> 'subservice',    // 'FM'
        'erp'       => 'erp_pwr_dbm',  // effective radiated power dBm
        'status'    => 'lic_status',    // 'Granted' / 'Cancelled' / 'Expired'
        'province'  => 'province',      // 'DAERAH ISTIMEWA YOGYAKARTA'
        'city'      => 'city',          // kabupaten/kota
        'district'  => 'district',      // kecamatan
        'no_simf'   => 'no_simf',       // nomor surat izin
        'validity'  => 'lic_expiry',    // tanggal berakhir izin
    ];

    public function __construct(private PDO $db) {}

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    /**
     * Ambil semua stasiun FM dengan filter opsional.
     *
     * @param array $filters  Keys: province, city, jenis, status, search
     * @return array
     */
    public function getStations(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);

        $sql = "
            SELECT
                {$this->col('no_simf')}          AS no_simf,
                {$this->col('freq')}              AS freq,
                {$this->col('bw')}                AS bw_khz,
                ROUND({$this->col('freq')} - {$this->col('bw')} / 2 / 1000, 4)  AS lower_mhz,
                ROUND({$this->col('freq')} + {$this->col('bw')} / 2 / 1000, 4)  AS upper_mhz,
                {$this->col('stn_name')}          AS stn_name,
                {$this->col('clnt_name')}         AS clnt_name,
                {$this->col('city')}              AS kota,
                {$this->col('district')}          AS kecamatan,
                {$this->col('erp')}               AS erp_dbm,
                {$this->col('status')}            AS status,
                {$this->col('validity')}          AS validity,
                {$this->classifyJenis()}          AS jenis
            FROM " . self::TABLE . "
            WHERE
                {$this->col('service')}    = 'Broadcast'
                AND {$this->col('subservice')} = 'FM'
                $where
            ORDER BY {$this->col('freq')} ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Ambil daftar kota/kabupaten unik yang punya stasiun FM.
     */
    public function getCities(?string $province = null): array
    {
        $where  = $province ? "AND {$this->col('province')} = :province" : '';
        $params = $province ? [':province' => $province] : [];

        $sql = "
            SELECT DISTINCT {$this->col('city')} AS kota
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              $where
            ORDER BY {$this->col('city')}
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return array_column($stmt->fetchAll(), 'kota');
    }

    /**
     * Ambil satu stasiun berdasar frekuensi exact (±0.05 MHz).
     */
    public function getByFreq(float $freq): ?array
    {
        $sql = "
            SELECT *
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              AND ABS({$this->col('freq')} - :freq) < 0.05
            LIMIT 1
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':freq' => $freq]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Statistik ringkas: total stasiun per kota, per jenis.
     */
    public function getStats(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);

        // Per kota
        $sqlKota = "
            SELECT {$this->col('city')} AS kota, COUNT(*) AS total
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              $where
            GROUP BY {$this->col('city')}
            ORDER BY total DESC
        ";
        $stmt = $this->db->prepare($sqlKota);
        $stmt->execute($params);
        $perKota = $stmt->fetchAll();

        // Per jenis
        $sqlJenis = "
            SELECT {$this->classifyJenis()} AS jenis, COUNT(*) AS total
            FROM " . self::TABLE . "
            WHERE {$this->col('service')} = 'Broadcast'
              AND {$this->col('subservice')} = 'FM'
              $where
            GROUP BY jenis
            ORDER BY total DESC
        ";
        $stmt = $this->db->prepare($sqlJenis);
        $stmt->execute($params);
        $perJenis = $stmt->fetchAll();

        return [
            'per_kota'  => $perKota,
            'per_jenis' => $perJenis,
        ];
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private function col(string $key): string
    {
        return self::COL_MAP[$key] ?? $key;
    }

    /**
     * CASE expression untuk mengklasifikasi jenis stasiun dari nama klien.
     */
    private function classifyJenis(): string
    {
        $clnt = $this->col('clnt_name');
        return "
            CASE
                WHEN $clnt LIKE '%RRI%' OR $clnt LIKE '%RADIO REPUBLIK%' THEN 'publik'
                WHEN $clnt LIKE '%LPPL%' OR $clnt LIKE '%LEMBAGA PENYIARAN PUBLIK LOKAL%' THEN 'publik_lokal'
                WHEN $clnt LIKE '%PERKUMPULAN%' OR $clnt LIKE '%KOMUNITAS%' THEN 'komunitas'
                ELSE 'swasta'
            END
        ";
    }

    /**
     * Build WHERE clause dari filter array.
     * Filter yang didukung: province, city, jenis, status, search, freq_min, freq_max
     */
    private function buildWhere(array $filters): array
    {
        $clauses = [];
        $params  = [];

        if (!empty($filters['province'])) {
            $clauses[] = "{$this->col('province')} = :province";
            $params[':province'] = $filters['province'];
        }

        if (!empty($filters['city'])) {
            $clauses[] = "{$this->col('city')} = :city";
            $params[':city'] = $filters['city'];
        }

        if (!empty($filters['status'])) {
            $clauses[] = "{$this->col('status')} = :status";
            $params[':status'] = $filters['status'];
        }

        if (!empty($filters['freq_min'])) {
            $clauses[] = "{$this->col('freq')} >= :freq_min";
            $params[':freq_min'] = (float) $filters['freq_min'];
        }

        if (!empty($filters['freq_max'])) {
            $clauses[] = "{$this->col('freq')} <= :freq_max";
            $params[':freq_max'] = (float) $filters['freq_max'];
        }

        if (!empty($filters['search'])) {
            $clauses[] = "({$this->col('stn_name')} LIKE :search OR {$this->col('clnt_name')} LIKE :search)";
            $params[':search'] = '%' . $filters['search'] . '%';
        }

        // Filter jenis pakai HAVING karena itu computed column
        // Dihandle di level aplikasi setelah fetch jika dibutuhkan
        // (untuk simplisitas, filter jenis di PHP side)

        $sql = $clauses ? 'AND ' . implode(' AND ', $clauses) : '';
        return [$sql, $params];
    }
}
