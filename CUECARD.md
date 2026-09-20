# KASPER — Cuecard Handover

## Stack
- **Frontend**: Vite + Vanilla JS ESM, modular (`src/`)
- **Backend**: PHP (`api/data.php`) → PDO/MySQL
- **Deploy**: GitHub Actions → lftp → Hostinger (`kasper.balmonjogja.info`)
- **Repo**: `aprianto199304012025041002-wq/kasper`

## Arsitektur src/
```
main.js          — boot, shell HTML, wiring komponen (120 baris)
state.js         — state global + filteredStations()
api.js           — fetch ke /api/stations, /api/stations/:freq, /api/health
utils.js         — parseValidity, isExpired, fmtDate, dbmToWatt, haversineKm, esc
style.css        — design system (light/dark, token CSS)
components/
  header.js      — logo, status stasiun, btn refresh/theme
  sidebar.js     — nav wilayah per provinsi, filter, mobile close
  toolbar.js     — tab Grid/Pita/Geo/RF + search + filter kanal
  statsbar.js    — stats bar (total/terisi/adjacent/kosong/habis)
views/
  grid.js        — grid kanal per wilayah, klik → detail
  band.js        — pita frekuensi visual 87.5–108 MHz
  geo.js         — peta Leaflet (bundled npm, tile OSM)
  rf.js          — tabel interferensi ITU-R BS.412, sortable
  detail.js      — slide-in panel detail stasiun lengkap
engine/
  channel.js     — computeChannelMapForWilayah(), summarizeChannels()
  interference.js — computeInterference() ITU-R BS.412
data/
  allotment.js   — data allotment KM Komdigi 570/2025
```

## Data
- 105 stasiun FM — DIY + Jateng
- Band 87.5–108.0 MHz, spasi 100 kHz = 206 kanal
- Regulasi: KM 570/2025

## Fitur aktif
- Grid view per wilayah — warna cell: biru=terisi, amber=adjacent, merah=expired, outline=allotment
- Pita view — band bar 87.5–108 per wilayah
- Geo view — peta Leaflet OSM, marker biru/merah
- RF view — interference pairs ITU-R, sortable, filter level
- Detail panel — slide-in dari kanan (desktop) / bottom sheet (mobile)
- Filter: wilayah, search, chanFilter (all/free/used/expired)
- Dark/light mode
- Mobile: FAB ☰ → slide-in sidebar, tombol ✕ tutup

## Deploy
- Workflow: `.github/workflows/deploy.yml`
- Build: `npm run build` → `dist/`
- Deploy: lftp ke Hostinger, retry 3x (30s interval)
- Health check: `/api/health` → `{ status, total_fm, db_ms }`

## Catatan penting
- Komunitas (wilayah "2,5 KILOMETER...") dikecualikan dari grid/band "Semua Wilayah"
- Leaflet ter-bundle via npm — tidak perlu CDN
- `apiClient.js` (file lama) masih ada tapi tidak dipakai — bisa dihapus
- Bundle size: ~195KB JS (60KB gzip) karena Leaflet

## Outstanding
- Detail stasiun belum ditest di mobile (slide-in panel)
- allotment_nasional.json belum diisi (data allotment nasional)
