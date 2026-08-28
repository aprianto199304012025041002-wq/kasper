# KASPER — Cue Card Handoff

## Stack
- **Frontend**: Vite + Vanilla JS ESM, `src/app.css` (satu file)
- **Backend**: `api/data.php` → PDO → MySQL tabel `isr`
- **Deploy**: GitHub Actions → FTP → Hostinger (`kasper.balmonjogja.info`)
- **DB credentials**: inject via `sed` di CI/CD dari GitHub Secrets

## File utama
```
src/main.js              — boot, state, render semua view
src/app.css              — satu file CSS, dark/light theme via [data-theme]
src/apiClient.js         — fetch /api/* (NO fallback, error = throw)
src/channelEngine.js     — grid 87.5–108.0 MHz, allotment per wilayah
src/interferenceEngine.js— hitung interferensi client-side (ITU-R BS.412)
src/data/allotment.js    — 84 wilayah KM Komdigi 570/2025
src/detailPage.js        — drawer detail stasiun (slide kanan) + Leaflet map
src/interferenceView.js  — render tabel interferensi RF
src/mobile.js            — FAB + drawer kontrol mobile
api/data.php             — satu file PHP, semua endpoint
api/.htaccess            — rewrite semua ke data.php
```

## API endpoints
| Endpoint | Return |
|---|---|
| `GET /api/stations` | `{ stations[], total, summary }` |
| `GET /api/stations/:freq` | `{ data, neighbors[] }` |
| `GET /api/interference` | `{ stations[] }` — raw, interference dihitung di client |
| `GET /api/cities` | `{ cities[] }` |
| `GET /api/stats` | `{ per_wilayah[], per_jenis[] }` |
| `GET /api/health` | `{ status, total_fm, time }` |

## State utama
```js
state = {
  page,            // 'main' | 'interference'
  view,            // 'grid' | 'band' | 'geo'
  filterCities[],  // [] = semua wilayah
  filterChanView,  // 'all' | 'free' | 'used'
  searchTerm,
  geoSettings: { showAdj, showLabel, onlyFree },
  data,            // { stations[], channel_map[], summary }
  interfData,      // dari computeInterference(stations)
  selectedWilayah,
  sidebarCollapsed,
  _allotmentCache, // { [wilayah]: { [freq]: allotment_status } }
  _openFreqOnLoad, // dari ?freq= URL param
}
```

## Fitur aktif
- ✅ Dark/light theme, simpan localStorage, toggle `d`
- ✅ Sidebar DIY/Jateng, collapse `b` (desktop only), search wilayah
- ✅ Grid view: scroll horizontal per wilayah, cell click → drawer bawah
- ✅ Band view: SVG per wilayah, theme-aware, hint "geser →"
- ✅ Geo view: cell kecil, geo opts (Guard/Label/Kosong) di toolbar desktop + mobile drawer
- ✅ ⚡ RF: interference dihitung client-side, tabel D/U + margin
- ✅ Stats bar: akurat per wilayah aktif, cell Terisi/Kosong klik untuk filter
- ✅ Free slot panel: muncul saat satu wilayah aktif, list kanal KM 570 yang belum terisi
- ✅ Detail drawer: slide kanan, Leaflet map, neighbor 30 stasiun (max-height scroll)
- ✅ Share URL: tombol ⎘ di detail → salin ?freq=xxx ke clipboard
- ✅ ?freq= URL: buka detail drawer otomatis saat load
- ✅ URL state sync: view, page, city, search, wilayah
- ✅ Mobile: FAB + drawer, swipe dots co-channel, scroll-to-top setelah filter
- ✅ Desktop: toolbar geo opts, reset filter button, tooltip delay 180ms
- ✅ Keyboard shortcuts: 1-4 (view), f//, Esc, d, b

## Keyboard shortcuts
| Key | Aksi |
|---|---|
| `1` | Grid view |
| `2` | Pita (band) view |
| `3` | Geo density |
| `4` | ⚡ RF Interferensi |
| `f` atau `/` | Fokus search |
| `Esc` | Clear search / reset wilayah |
| `d` | Toggle dark/light |
| `b` | Toggle sidebar (desktop only) |

## Data
- 106 stasiun FM: 56 DIY + 50 Jateng dari tabel `isr`
- 84 wilayah di `allotment.js` (KM 570/2025)
- `api/data/allotment_nasional.json` → kosong, tidak dipakai

## Yang perlu diperhatikan
- Stasiun tanpa koordinat lat/lon tidak dievaluasi di interference engine
- `computeChannelMap` fallback di apiClient (jika API tidak return channel_map) tidak punya allotment_status
- Wilayah dengan 0 stasiun tidak tampil di grid (filter di cityRows)
- CSS warning vite (angka di comment) → false positive, tidak mempengaruhi output
