<?php
class Database {
    private static ?PDO $instance = null;
    public static function connect(array $cfg): PDO {
        if (self::$instance) return self::$instance;
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset={$cfg['charset']}";
        try {
            self::$instance = new PDO($dsn, $cfg['user'], $cfg['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(503);
            echo json_encode(['error' => 'DB connection failed', 'detail' => $e->getMessage()]);
            exit;
        }
        return self::$instance;
    }
}
