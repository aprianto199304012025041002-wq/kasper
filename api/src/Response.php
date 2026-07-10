<?php
class Response {
    public static function json(mixed $data, int $status = 200): void {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    public static function error(string $msg, int $status = 400): void { self::json(['error' => $msg], $status); }
    public static function notFound(string $msg = 'Not found'): void   { self::error($msg, 404); }
}
