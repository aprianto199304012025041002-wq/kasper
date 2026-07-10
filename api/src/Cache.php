<?php
class Cache {
    private string $dir;
    private int    $ttl;
    private bool   $enabled;

    public function __construct(array $cfg) {
        $this->enabled = $cfg['enabled'] ?? true;
        $this->dir     = $cfg['dir'];
        $this->ttl     = $cfg['ttl'] ?? 300;
        if ($this->enabled && !is_dir($this->dir)) mkdir($this->dir, 0755, true);
    }

    private function key(string $id): string { return $this->dir . '/' . md5($id) . '.cache'; }

    public function get(string $id): mixed {
        if (!$this->enabled) return null;
        $f = $this->key($id);
        if (!file_exists($f)) return null;
        if (time() - filemtime($f) > $this->ttl) { unlink($f); return null; }
        $raw = file_get_contents($f);
        return $raw !== false ? json_decode($raw, true) : null;
    }

    public function set(string $id, mixed $data): void {
        if (!$this->enabled) return;
        file_put_contents($this->key($id), json_encode($data), LOCK_EX);
    }
}
