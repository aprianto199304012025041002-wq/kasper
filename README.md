# KASPER — Kanal Spektrum Radio

Aplikasi web monitoring spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon Jogja, mencakup **DIY & Jawa Tengah**.

- **Live:** `kasper.balmonjogja.info`
- **Stack:** Vite + Vanilla JS · PHP 8 + MySQL · Hostinger
- **Repo:** `aprianto199304012025041002-wq/kasper`

---

## Fitur

| View | Keterangan |
|---|---|
| **Grid** | Grid kanal 100 kHz per wilayah, warna per status |
| **Pita** | Band 87.5–108 MHz horizontal per wilayah |
| **Geo** | Peta Leaflet marker per stasiun |
| **RF** | Tabel interferensi ITU-R BS.412, sortable |
| **Detail** | Panel slide-in: info lengkap + peta mini + tetangga |

**Filter:** wilayah, search, kanal (all/terisi/kosong/expired)

**Status cell grid:** biru=terisi · amber=adjacent guard · merah dashed=expired · abu=kosong

---

## Struktur

```
src/
  main.js           — boot, shell HTML, wiring komponen
  state.js          — state global + filteredStations()
  api.js            — fetch ke /api/stations, /api/stations/:freq, /api/health
  utils.js          — parseValidity, isExpired, fmtDate, dbmToWatt, esc, haversineKm
  style.css         — design system (light/dark, CSS tokens)
  components/
    header.js       — logo, status, btn refresh/theme
    sidebar.js      — nav wilayah per provinsi + mobile close
    toolbar.js      — tab Grid/Pita/Geo/RF + search + filter kanal
    statsbar.js     — stats ringkasan kanal
  views/
    grid.js         — grid kanal per wilayah
    band.js         — pita frekuensi visual
    geo.js          — peta Leaflet (bundled npm, tile OSM)
    rf.js           — tabel interferensi sortable + filter level
    detail.js       — slide-in panel detail stasiun
  engine/
    channel.js      — computeChannelMapForWilayah(), ITU-R grid
    interference.js — computeInterference(), ITU-R BS.412
  data/
    allotment.js    — data allotment KM Komdigi 570/2025

api/
  data.php          — single-file PHP backend (PDO/MySQL)
```

---

## Setup lokal

```bash
git clone https://github.com/aprianto199304012025041002-wq/kasper.git
cd kasper
npm install
npm run dev
```

---

## API endpoints

| Endpoint | Keterangan |
|---|---|
| `GET /api/stations` | Semua stasiun FM |
| `GET /api/stations/:freq` | Detail stasiun + tetangga |
| `GET /api/health` | Cek DB (`{ status, total_fm, db_ms }`) |

---

## Deploy

GitHub Actions → lftp → Hostinger. Retry 3x (30s interval) untuk handle FTP intermittent.

```bash
npm run build   # output ke dist/
git push        # trigger CI/CD otomatis
```

---

## Model interferensi (ITU-R BS.412)

| Tipe | Δf | D/U minimum | Radius |
|---|---|---|---|
| Co-channel | < 0.095 MHz | 30 dB | 150 km |
| 1st Adjacent | < 0.195 MHz | 20 dB | 60 km |
| 2nd Adjacent | < 0.295 MHz | 10 dB | 30 km |
