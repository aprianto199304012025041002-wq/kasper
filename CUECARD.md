# KASPER — Cuecard Handover

> Baca ini dulu sebelum mulai sesi baru. Clone repo lalu baca file ini.

## Quick start sesi baru

```bash
git clone https://<PAT>@github.com/aprianto199304012025041002-wq/kasper.git /home/claude/kasper
cd /home/claude/kasper
npm install
cat CUECARD.md
```

## Stack

- **Frontend:** Vite + Vanilla JS ESM, modular (`src/`)
- **Backend:** PHP single-file (`api/data.php`) → PDO/MySQL
- **Auth:** SSO GUDEG (`gudeg.xo.je`), JWT RS256, client ID `1d4b1ae1b885ed27`
- **Deploy:** GitHub Actions → lftp retry 3x → Hostinger
- **Live:** `kasper.balmonjogja.info`
- **Repo:** `aprianto199304012025041002-wq/kasper`
- **Git config:** `kasper@balmonjogja.info` / `KASPER Dev`

## Arsitektur `src/`

```
main.js           — boot, shell HTML, event wiring, openDetail()
state.js          — state global, filteredStations(), wilayahOf(),
                    resolveKomunitasWilayah(), getWilayahByProv()
api.js            — fetch /api/stations, /api/stations/:freq
utils.js          — parseValidity, isExpired, fmtDate, dbmToWatt, haversineKm, esc
style.css         — design system, light/dark token
components/
  header.js       — logo, user badge, btn refresh/theme, tombol logout (/logout.php)
  sidebar.js      — nav wilayah collapsible per provinsi, multi-select, localStorage collapse state
  toolbar.js      — tab Grid/Pita/Geo/RF + search + filter kanal
  statsbar.js     — stats bar ringkasan kanal
views/
  grid.js         — grid kanal per wilayah, sync scroll horizontal, highlight kolom, jump to freq
  band.js         — pita bar kontinu 87.5–108 MHz, sync scroll horizontal, ruler sticky
  geo.js          — Leaflet + markercluster npm, titik pusat + radius wilayah KM 570
  rf.js           — tabel interferensi ITU-R BS.412, sortable, filter level, tap → detail
  detail.js       — slide-in panel, peta mini Leaflet, swipe-to-close dari drag handle (mobile)
engine/
  channel.js      — computeChannelMapForWilayah(), buildChannelGrid(), FM_MIN/MAX
  interference.js — computeInterference(), ITU-R BS.412
data/
  allotment.js    — KM Komdigi 570/2025, 84 wilayah DIY+Jateng
```

## File PHP (root)

```
index.php         — require_login() + serve dist/index.html + inject window.__KASPER_USER__
login.php         — halaman login, redirect ke gudeg.xo.je/sso.php
callback.php      — verifikasi JWT RS256, set session, redirect ke index.php
logout.php        — destroy session, redirect ke login.php
config.php        — loader kasper_config.php
kasper_config.php — TIDAK di-commit, di-generate CI/CD dari GitHub Secrets
includes/auth.php — require_login(), get_user(), verify_sso_token(), security headers
```

## GitHub Secrets (repo kasper)

| Secret | Keterangan |
|---|---|
| `DB_HOST` | Host MySQL Hostinger |
| `DB_NAME` | Nama database |
| `DB_USER` | Username DB |
| `DB_PASS` | Password DB |
| `SSO_PUBLIC_KEY` | Public key RSA GUDEG (dari gudeg.xo.je/keys/public.pem) |

## Data & regulasi

- 105 stasiun FM — DIY + Jateng, 84 wilayah layanan
- Band 87.5–108.0 MHz, spasi 100 kHz = 206 kanal
- Regulasi: KM Komdigi 570/2025
- Komunitas (radius 2.5km) di-resolve ke wilayah terdekat via `resolveKomunitasWilayah()`
- Allotment: dot RRI/LPS di grid, outline di pita, radius circle di geo

## Radius wilayah layanan (KM 570/2025)

| Kelas | Wilayah | Radius |
|---|---|---|
| A | DKI Jakarta + perbatasan | 30 km |
| B | Ibukota provinsi | 20 km |
| C | Kabupaten/kota lain | 12 km |
| D | Komunitas (per stasiun) | 2.5 km |

DIY+Jateng: Yogyakarta + Semarang = kelas B, sisanya kelas C.

## Deploy workflow

```
git push → GitHub Actions → npm run build
         → generate kasper_config.php dari secrets
         → deploy includes/, login/callback/logout/config/index.php, .htaccess, favicon.svg
         → lftp retry 3x ke Hostinger
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

## Outstanding / TODO

- `api/data/allotment_nasional.json` belum diisi (perlu ekstraksi PDF KM 570 di laptop + Gemini)
- Test SSO login end-to-end setelah deploy SSO_PUBLIC_KEY
