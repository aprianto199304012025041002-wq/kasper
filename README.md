# KASPER — Pengkanalan Spektrum Radio

Aplikasi web pengkanalan spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon Jogja, mencakup **DIY & Jawa Tengah**.

- **Live:** `kasper.balmonjogja.info`
- **Stack:** Vite + Vanilla JS · PHP 8 + MySQL · Hostinger
- **Auth:** SSO GUDEG (`gudeg.xo.je`)
- **Repo:** `aprianto199304012025041002-wq/kasper`

---

## Fitur

| View | Keterangan |
|---|---|
| **Grid** | Grid kanal 100 kHz per wilayah, sync scroll horizontal, highlight kolom, jump to frekuensi |
| **Pita** | Bar kontinu 87.5–108 MHz per wilayah, sync scroll horizontal |
| **Geo** | Peta Leaflet, marker cluster, titik pusat + radius wilayah layanan (KM 570/2025) |
| **RF** | Tabel interferensi ITU-R BS.412, sortable, filter level |
| **Detail** | Panel slide-in: info lengkap + peta mini + tetangga frekuensi |

**Filter:** multi-select wilayah, search, kanal (all/terisi/kosong/expired)

**Allotment:** KM Komdigi 570/2025 — dot RRI/LPS per cell, radius wilayah per kelas (A=30km, B=20km, C=12km)

---

## Struktur

```
src/
  main.js           — boot, shell HTML, wiring komponen
  state.js          — state global, filteredStations(), wilayahOf(), resolveKomunitasWilayah()
  api.js            — fetch ke /api/stations, /api/stations/:freq
  utils.js          — parseValidity, isExpired, fmtDate, dbmToWatt, esc, haversineKm
  style.css         — design system (light/dark, CSS tokens)
  components/
    header.js       — logo, user badge, btn refresh/theme/logout
    sidebar.js      — nav wilayah collapsible per provinsi, multi-select, mobile slide-in
    toolbar.js      — tab Grid/Pita/Geo/RF + search + filter kanal
    statsbar.js     — stats ringkasan kanal
  views/
    grid.js         — grid kanal per wilayah, sync scroll, highlight, jump
    band.js         — pita frekuensi bar kontinu, sync scroll
    geo.js          — Leaflet + cluster, titik pusat + radius wilayah KM 570
    rf.js           — tabel interferensi sortable + filter level + tap detail
    detail.js       — slide-in panel, peta mini, swipe-to-close (mobile)
  engine/
    channel.js      — computeChannelMapForWilayah(), ITU-R grid
    interference.js — computeInterference(), ITU-R BS.412
  data/
    allotment.js    — data allotment KM Komdigi 570/2025 (84 wilayah DIY+Jateng)

api/
  data.php          — single-file PHP backend (PDO/MySQL), require_login()

includes/
  auth.php          — require_login(), verify_sso_token() RS256, security headers

login.php           — halaman login SSO GUDEG
callback.php        — verifikasi JWT, set session
logout.php          — destroy session
config.php          — loader kasper_config.php
index.php           — auth guard + serve dist/index.html
```

---

## Setup lokal

```bash
git clone https://github.com/aprianto199304012025041002-wq/kasper.git
cd kasper
npm install
npm run dev
# Untuk auth: buat kasper_config.php dari kasper_config.example.php
```

---

## Deploy

GitHub Actions → `npm run build` → generate `kasper_config.php` dari secrets → lftp ke Hostinger (retry 3x).

```bash
git push   # trigger CI/CD otomatis
```

**GitHub Secrets yang dibutuhkan:** `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `SSO_PUBLIC_KEY`

---

## Auth (SSO GUDEG)

- Client ID: `1d4b1ae1b885ed27`
- Callback: `https://kasper.balmonjogja.info/callback.php`
- JWT RS256 — public key dari `gudeg.xo.je`
- `kasper_config.php` tidak di-commit, di-generate saat deploy

---

## Model interferensi (ITU-R BS.412)

| Tipe | Δf | D/U minimum | Radius |
|---|---|---|---|
| Co-channel | < 0.095 MHz | 30 dB | 150 km |
| 1st Adjacent | < 0.195 MHz | 20 dB | 60 km |
| 2nd Adjacent | < 0.295 MHz | 10 dB | 30 km |
