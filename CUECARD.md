# KASPER — Cuecard Handover

> Baca ini dulu sebelum mulai sesi baru. Jalankan script handover di bawah.

## Quick start sesi baru

```bash
git clone https://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@github.com/aprianto199304012025041002-wq/kasper.git /home/claude/kasper
cd /home/claude/kasper
npm install
cat CUECARD.md
```

## Stack

- **Frontend:** Vite + Vanilla JS ESM, modular (`src/`)
- **Backend:** PHP single-file (`api/data.php`) → PDO/MySQL
- **Deploy:** GitHub Actions → lftp retry 3x → Hostinger
- **Live:** `kasper.balmonjogja.info`
- **Repo:** `aprianto199304012025041002-wq/kasper`
- **Git config:** `kasper@balmonjogja.info` / `KASPER Dev`

## Arsitektur `src/`

```
main.js          — 120 baris, boot + event wiring
state.js         — state global + filteredStations() + getWilayahByProv()
api.js           — fetch /api/stations, /api/stations/:freq, /api/health
utils.js         — parseValidity, isExpired, fmtDate, dbmToWatt, haversineKm, esc
style.css        — design system, 391 baris, light/dark token
components/
  header.js      — logo, status stasiun, btn refresh/theme
  sidebar.js     — nav wilayah per provinsi, mobile slide-in + ✕
  toolbar.js     — tab Grid/Pita/Geo/RF + search + filter kanal
  statsbar.js    — stats bar, emit kasper:filter event
views/
  grid.js        — grid kanal per wilayah, klik → detail
  band.js        — pita frekuensi 87.5–108 MHz horizontal
  geo.js         — Leaflet bundled npm, tile OSM
  rf.js          — interferensi ITU-R BS.412, sortable, filter level
  detail.js      — slide-in panel kanan, reuse panel saat ganti stasiun
engine/
  channel.js     — computeChannelMapForWilayah(), summarizeChannels()
  interference.js— computeInterference() ITU-R BS.412
data/
  allotment.js   — data allotment KM Komdigi 570/2025
```

## Data & regulasi

- 105 stasiun FM — DIY + Jateng, 84 wilayah layanan
- Band 87.5–108.0 MHz, spasi 100 kHz = 206 kanal
- Regulasi: KM Komdigi 570/2025
- Komunitas dikecualikan dari grid/band "Semua Wilayah"

## Status cell grid

| Warna | Arti |
|---|---|
| Biru | Terisi (ada pemegang izin) |
| Amber | Adjacent guard (proteksi ITU-R) |
| Merah dashed | Expired (izin habis) |
| Abu | Kosong |

## Mobile

- FAB ☰ kanan bawah → slide-in sidebar
- Tombol ✕ di sidebar untuk tutup
- Backdrop tap untuk tutup

## Deploy workflow

```
git push → GitHub Actions → npm run build → lftp ke Hostinger
Retry 3x dengan 30s interval (FTP Hostinger kadang intermittent)
```

## Keyboard shortcuts

| Key | Aksi |
|---|---|
| `1` | Grid view |
| `2` | Pita view |
| `3` | Geo view |
| `4` | RF view |
| `R` | Refresh data |
| `Esc` | Tutup detail panel |

## File penting lain

- `.github/workflows/deploy.yml` — CI/CD config
- `api/data.php` — single-file PHP backend
- `src/data/allotment.js` — data allotment (jangan edit manual)

## Outstanding / TODO

- Detail panel peta mini: Leaflet mungkin tidak load jika `L` belum tersedia saat render
- `src/apiClient.js` (file lama) masih ada — bisa dihapus
- `api/data/allotment_nasional.json` belum diisi (perlu ekstraksi dari PDF KM 570)
- Test detail panel di HP (slide-in + peta mini)

## SSO GUDEG (ditambahkan Sep 2026)
- Login via SSO GUDEG (`gudeg.xo.je/sso.php`)
- Client ID: `1d4b1ae1b885ed27`
- Callback: `https://kasper.balmonjogja.info/callback.php`
- File baru: `login.php`, `callback.php`, `logout.php`, `config.php`, `includes/auth.php`
- `kasper_config.php` di-generate saat deploy via CI/CD, tidak di-commit
- GitHub Secret yang dibutuhkan: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `SSO_PUBLIC_KEY`
- SSO_PUBLIC_KEY: public key RSA dari GUDEG — jalankan `scripts/fetch-gudeg-pubkey.sh` dari laptop
- `api/data.php` sekarang require_login() — redirect ke login.php jika belum auth
- Health check URL sekarang return 401 jika tidak ada session (wajar)
