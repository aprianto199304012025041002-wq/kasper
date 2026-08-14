<?php
class ProvinceRepository
{
    private const TABLE = 'isr';

    public function __construct(private PDO $db) {}

    public function listWithStats(): array
    {
        $sql = "
            SELECT
                province                                        AS name,
                province                                        AS code,
                COUNT(*)                                        AS total_stations,
                SUM(service='Broadcast' AND subservice='FM'
                    AND freq BETWEEN 87.5 AND 108.0)           AS total_fm,
                NULL AS balmon, NULL AS lat_center, NULL AS lon_center
            FROM " . self::TABLE . "
            WHERE province IS NOT NULL AND province != ''
            GROUP BY province
            ORDER BY total_fm DESC, province ASC
        ";
        return $this->db->query($sql)->fetchAll();
    }

    public function citiesInProvince(string $province): array
    {
        $sql = "
            SELECT area_of_service AS wilayah_layanan, COUNT(*) AS total
            FROM " . self::TABLE . "
            WHERE province = :province
              AND service = 'Broadcast' AND subservice = 'FM'
              AND freq BETWEEN 87.5 AND 108.0
              AND area_of_service IS NOT NULL
            GROUP BY area_of_service ORDER BY area_of_service ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':province' => $province]);
        return $stmt->fetchAll();
    }
}
