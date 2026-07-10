<?php
// api/src/Cache.php
// Cache file sederhana — cocok untuk VPS tanpa Redis/Memcached

class Cache
{
    private string $dir;
    private int    $ttl;
    private bool   $enabled;

    public function __construct(array $cfg)
    {
        $this->enabled = $cfg['enabled'] ?? true;
        $this->dir     = $cfg['dir'];
        $this->ttl     = $cfg['ttl'] ?? 300;

        if ($this->enabled && !is_dir($this->dir)) {
            mkdir($this->dir, 0755, true);
        }
    }

    private function key(string $id): string
    {
        return $this->dir . '/' . md5($id) . '.cache';
    }

    public function get(string $id): mixed
    {
        if (!$this->enabled) return null;
        $file = $this->key($id);
        if (!file_exists($file)) return null;
        if (time() - filemtime($file) > $this->ttl) {
            unlink($file);
            return null;
        }
        $raw = file_get_contents($file);
        return $raw !== false ? json_decode($raw, true) : null;
    }

    public function set(string $id, mixed $data): void
    {
        if (!$this->enabled) return;
        file_put_contents($this->key($id), json_encode($data), LOCK_EX);
    }

    public function bust(string $id): void
    {
        $file = $this->key($id);
        if (file_exists($file)) unlink($file);
    }
}
