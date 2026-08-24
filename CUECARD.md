# KASPER — Cue Card Handoff

## Stack
- **Frontend**: Vite + Vanilla JS ESM, satu file `src/app.css`
- **Backend**: satu file `api/data.php` → PDO → MySQL tabel `isr`
- **Deploy**: GitHub Actions → FTP → Hostinger (`kasper.balmonjogja.info`)
- **DB credentials**: di-inject via `sed` di CI/CD dari GitHub Secrets (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`)

## Data
- **106 stasiun FM**: 56 DIY + 50 Jateng dari tabel `isr`
- **84 wilayah layanan** terdefinisi di `src/data/allotment.js` (KM Komdigi 570/2025)
- `api/data/allotment_nasional.json` → **kosong, tidak dipakai**, artifact lama

## Arsitektur frontend
```
main.js           — boot, state, render shell/sidebar/toolbar/content
channelEngine.js  — channel grid 87.5–108.0 MHz, allotment status per wilayah
interferenceEngine.js — hitung interferensi di client (ITU-R BS.412)
apiClient.js      — fetch ke /api/stations, /api/interference (NO fallback)
detailPage.js     — drawer detail stasiun (slide kanan)
interferenceView.js — render tabel interferensi
mobile.js         — FAB + drawer kontrol mobile
app.css           — satu file CSS, dark/light theme via [data-theme]
```

## API endpoints (`/api/data.php` via `.htaccess` rewrite)
| Endpoint | Return |
|---|---|
| `GET /api/stations` | `{ stations[], total }` |
| `GET /api/stations/:freq` | `{ data, neighbors[] }` |
| `GET /api/interference` | `{ stations[] }` — raw, interference dihitung di client |
| `GET /api/cities` | `{ cities[] }` |
| `GET /api/stats` | `{ per_wilayah[], per_jenis[] }` |
| `GET /api/health` | `{ status, total_fm, time }` |

## State utama (src/main.js)
```js
state = {
  page, view,           // 'main'|'interference', 'grid'|'band'|'geo'
  filterCities[],       // [] = semua wilayah
  filterChanView,       // 'all'|'free'|'used'
  searchTerm,
  geoSettings: { showAdj, showLabel, onlyFree },
  data,                 // dari fetchSpectrum → { stations[], channel_map[], summary }
  interfData,           // dari computeInterference(stations)
  selectedWilayah,
  _allotmentCache,      // { [wilayah]: { [freq]: allotment_status } }
}
```

## Status fitur (per sesi ini)
- ✅ Dark/light theme toggle, simpan ke localStorage
- ✅ Sidebar DIY/Jateng, collapse, search
- ✅ Grid view: scroll horizontal per wilayah, cell click → drawer
- ✅ Band view: SVG per wilayah, theme-aware ruler
- ✅ Geo view: cell kecil, showAdj/showLabel/onlyFree dari drawer
- ✅ Interference view: hitung di client via interferenceEngine.js (ITU-R BS.412)
- ✅ Mobile: FAB + drawer kontrol, swipe to close, responsive 4 breakpoint
- ✅ Detail drawer stasiun: Leaflet map, neighbor table
- ✅ URL state sync (view, page, city, search, wilayah)
- ✅ allotment_status per-wilayah di-cache di `state._allotmentCache`
- 🔲 `allotment_nasional.json` kosong — tidak mempengaruhi fungsi (tidak dipakai)

## Bug yang sudah difix sesi ini (ringkasan)
1. Semua fallback data lokal dihapus — error = tampil error, bukan data palsu
2. API berlapis → satu `data.php`
3. Import order ESM (theme fn sebelum import)
4. `isKom` sisa di handleClick
5. ch-cell type pakai channel_map global → sekarang per-wilayah dari cache
6. Band SVG hardcode warna putih → theme-aware
7. geoSettings.showLabel tidak efek di renderCellGeo
8. openDetailPage bisa terima null station
9. Interference view selalu kosong → sekarang dihitung di client
10. 4 typo nama wilayah + 39 wilayah Jateng missing di WILAYAH_SHORT
11. CSS classes mobile drawer missing (kd-city-chip dll)
12. Export duplikat di mobile.js

## Yang perlu diperhatikan berikutnya
- Data koordinat (lat/lon) stasiun mungkin banyak yang kosong → interference engine hanya evaluasi stasiun berkoordinat
- `computeChannelMap` fallback di apiClient tidak punya allotment_status — tapi ini hanya terjadi kalau API tidak return `channel_map` (normal return dari DB)
- Wilayah dengan 0 stasiun tidak tampil di grid (intentional filter)
