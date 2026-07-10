<?php
// api/src/ProvinceRepository.php

class ProvinceRepository
{
    private const STATIONS_TABLE  = 'isr_stations';
    private const PROVINCES_TABLE = 'isr_provinces';

    public function __construct(private PDO $db) {}

    /**
     * Daftar provinsi yang punya data di tabel isr_stations (dinamis dari DB)
     */
    public function listFromStations(): array
    {
        $sql = "
            SELECT
                province                          AS name,
                COUNT(*)                          AS total_stations,
                SUM(service='Broadcast' AND subservice='FM') AS total_fm
            FROM " . self::STATIONS_TABLE . "
            WHERE province IS NOT NULL AND province != ''
            GROUP BY province
            ORDER BY total_fm DESC, province ASC
        ";
        return $this->db->query($sql)->fetchAll();
    }

    /**
     * Daftar provinsi dari tabel master isr_provinces
     */
    public function listMaster(): array
    {
        $sql = "SELECT * FROM " . self::PROVINCES_TABLE . " ORDER BY name ASC";
        try {
            return $this->db->query($sql)->fetchAll();
        } catch (PDOException) {
            return [];
        }
    }

    /**
     * Gabungan: master + jumlah stasiun dari isr_stations
     */
    public function listWithStats(): array
    {
        $sql = "
            SELECT
                p.code,
                p.name,
                p.balmon,
                p.lat_center,
                p.lon_center,
                COALESCE(s.total_stations, 0) AS total_stations,
                COALESCE(s.total_fm, 0)       AS total_fm
            FROM " . self::PROVINCES_TABLE . " p
            LEFT JOIN (
                SELECT
                    province,
                    COUNT(*) AS total_stations,
                    SUM(service='Broadcast' AND subservice='FM') AS total_fm
                FROM " . self::STATIONS_TABLE . "
                GROUP BY province
            ) s ON s.province = p.name
            ORDER BY p.name ASC
        ";
        try {
            return $this->db->query($sql)->fetchAll();
        } catch (PDOException) {
            // Fallback jika tabel provinces belum ada
            return $this->listFromStations();
        }
    }

    /**
     * Kota/kabupaten dalam satu provinsi
     */
    public function citiesInProvince(string $province): array
    {
        $sql = "
            SELECT DISTINCT city, COUNT(*) AS total
            FROM " . self::STATIONS_TABLE . "
            WHERE province = :province AND service = 'Broadcast' AND subservice = 'FM'
            GROUP BY city
            ORDER BY city ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':province' => $province]);
        return $stmt->fetchAll();
    }
}
