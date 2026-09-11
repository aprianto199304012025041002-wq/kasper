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
tools/extract_allotment.py — ekstrak allotment PDF → JSON via Claude Vision
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
  filterChanView,  // 'all' | 'free' | 'used' | 'expired'
  searchTerm,
  geoSettings: { showAdj, showLabel, onlyFree },
  data,            // { stations[], channel_map[], summary }
  interfData,      // dari computeInterference(stations)
  selectedWilayah,
  sidebarCollapsed,
  _allotmentCache, // { [wilayah]: { [freq]: allotment_status } }
  _stationCountMap,// { [wilayah]: count } — pre-computed di loadData
  _openFreqOnLoad, // dari ?freq= URL param
}
```

## Fitur aktif
- ✅ Dark/light theme, simpan localStorage, toggle `d`
- ✅ Sidebar DIY/Jateng, collapse `b` (desktop only), search wilayah
- ✅ Grid view: scroll horizontal per wilayah, cell click → drawer bawah
- ✅ Band view: SVG per wilayah, theme-aware, hint "geser →"
- ✅ Geo view: cell kecil, geo opts (Guard/Label/Kosong) di toolbar desktop + mobile drawer
- ✅ ⚡ RF: interference dihitung client-side, tabel D/U + margin, filter level, breakdown adj±1/±2
- ✅ Stats bar: akurat per wilayah aktif, cell Terisi/Kosong/Izin-habis klik untuk filter
- ✅ Free slot panel: muncul saat satu wilayah aktif, list kanal KM 570 yang belum terisi
- ✅ Detail drawer: slide kanan, Leaflet map (theme-aware), ERP dBm+Watt, Tgl.Izin, validity terformat+highlight, neighbor + jarak km
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
- `window.__openDetailFreq` di-expose global di boot() — dipakai neighbor rows, interference table, cell drawer
- `findFreeBlocks` di channelEngine.js — diekspor tapi tidak dipakai di mana pun (dead export, biarkan dulu)

## Sesi terkini — semua sudah di-push

### Fixes sesi akhir
| File | Apa |
|---|---|
| `main.js` | sync-label click handler nyasar ke toggleHelpOverlay — dipindah ke event delegation |
| `main.js` | Active state (cyan) pada sync-label wilayah yang dipilih |
| `main.js` | Scroll ke atas saat pilih wilayah dari sidebar (sync-tbody + dynamicContent) |
| `main.js` | Guard double-call loadInterference dengan `_interfLoading` flag |
| `main.js` | `_interfLoading: false` eksplisit di state init |
| `main.js` | Tombol ↺ refresh data di header + shortcut `R`, invalidate semua cache |
| `main.js` | Refresh di halaman interferensi juga reload interfData |
| `main.js` | Skip wilayah kosong di semua view (grid/band/geo) saat filter/search aktif |
| `main.js` | `activeCityRows` — hanya wilayah yang punya hasil masuk ke sync grid |
| `main.js` | `getWilayahProvinceMap()` cached helper — hapus 3× duplikat province map |
| `main.js` | `isYogya()` helper untuk grouping DIY/Jateng |
| `app.css` | Hapus CSS mati: `.city-block__province`, `.band-scroll-hint-mobile` |
| `app.css` | Fix content-area landscape mobile untuk sync grid |
| `deploy.yml` | Health check retry 3x + non-fatal; sleep 20s |
| `deploy.yml` | FTP diganti lftp — passive mode, parallel=2, auto-reconnect |

### Sync scroll grid (fitur besar sesi ini)
- Grid view: freq header sticky atas, label wilayah sticky kiri, satu scrollbar
- Band view: sync scroll juga, waveform SVG sejajar lintas wilayah
- Geo view: tetap per-wilayah (ada Leaflet map)
- Mobile = desktop, label 120px di mobile
- Divider DIY/Jateng di grid dan band view
- Scroll position dipertahankan saat filter/wilayah ganti
- Cell 64px di sync grid; label wilayah 190px (nama terpanjang: "Banjarharejo – Ketanggungan")

## Sesi sebelumnya — semua sudah di-push

### Sync scroll grid (fitur besar)
- Grid view pakai layout spreadsheet: freq header sticky atas, label wilayah sticky kiri, satu scrollbar
- Frekuensi sejajar lintas semua wilayah — bisa lihat co-channel visual langsung
- Band view juga pakai sync scroll (label sticky kiri, waveform sejajar)
- Geo view tetap per-wilayah (ada Leaflet map)
- Mobile sama dengan desktop, label 120px di mobile
- Divider DIY/Jateng di grid dan band view
- Scroll position dipertahankan saat filter/wilayah ganti
- cell 64px di sync grid (lebih lebar dari geo/band 52px)

### Deploy & infra
- FTP action diganti ke `lftp` — passive mode eksplisit, parallel=2, auto-reconnect
- Health check retry 3x, non-fatal (tidak fail workflow)
- Dua FTP step digabung jadi satu deploy folder

### Fitur & fixes lain
- `?freq=` di URL saat detail drawer buka — shareable link per stasiun
- Link ↗ Google Maps di seksi lokasi detail drawer
- Cell drawer (inline) tampilkan expired + validity
- Search match `no_simf`, `clnt_name`
- Tooltip co-channel tampilkan semua nama
- Print CSS `@media print`
- Help overlay `?` + tombol di toolbar
- Export CSV izin habis
- Stat cell "⚠ Izin habis" di statsbar klik-filter
- Sidebar badge ⚠N per wilayah
- City block badge ⚠N + count akurat saat filter aktif
- Global empty state saat filter tidak ada hasil
- Cache detail drawer per frekuensi (O(1))
- Station lookup per channel O(n)→O(1) freq index
- getAllotmentByFreq O(n)→O(1) Set cache
- Neighbours query filter koordinat valid + validity_date

## Sesi sebelumnya — semua sudah di-push

| Commit | Apa |
|---|---|
| interference engine | Distance cutoff per tipe: co 150 km / adj±1 60 km / adj±2 30 km; pair ok hanya ≤10 km |
| interference table | Sortable columns (Jarak/D/U/Margin/Level), klik header → ▲▼; nama stasiun klik → detail |
| detail drawer | Tgl. Permohonan (appl_date), tinggi antena, gain, perangkat; neighbor expired ⚠ |
| header status | Total expired global tampil merah saat load |
| sidebar | Group DIY/Jateng dari `province` data (bukan hardcode Set); search match label pendek; section wrapper hide; badge ⚠N per wilayah |
| grid view | City block count akurat saat filter aktif (N/total); badge ⚠N expired per wilayah |
| filter/empty state | Global empty state saat semua rows filtered habis; filter expired di band view |
| export CSV | Tombol ⬇ CSV muncul saat filter expired aktif; download `kasper_izin_habis_YYYY-MM-DD.csv` |
| help overlay | Tekan `?` atau klik tombol `?` di toolbar → modal keyboard shortcuts; Escape tutup |
| export btn sync | Stat cell click juga update visibility export button |

## Fitur expired (izin habis) — konsisten end-to-end



| Lokasi | Apa |
|---|---|
| Grid + Geo | Cell border merah putus-putus, nama merah (`ch-cell--expired`) |
| Band SVG | Gelombang merah putus-putus menggantikan kuning solid |
| Tooltip | Judul ⚠ + baris "Berlaku s.d." terformat |
| Detail drawer | Tanggal merah + ⚠, field "Tgl. Izin" (`licence_date`) ditambahkan |
| Stats bar | Cell "⚠ Izin habis" muncul bila ada, klik untuk filter |
| Filter toolbar | Opsi "⚠ Izin habis" di dropdown `fChanView` |
| Mobile drawer | Tombol "⚠ HABIS" sejajar SEMUA/KOSONG/TERPAKAI |
| Legend | Chip "Izin habis" ditambahkan |
| Interference table | Nama stasiun bisa diklik → buka detail drawer via `window.__openDetailFreq` |

## Perbaikan sesi terakhir (semua sudah di-push)
| File | Apa |
|---|---|
| `interferenceEngine.js` | Formula D/U dikoreksi: evaluasi dari sisi korban (ERP lebih kecil), fallback ERP 60→40 dBm, hapus dead code |
| `interferenceView.js` | Label TX/RX → Interferor/Korban, breakdown adj±1/±2, filter level dropdown, ERP per baris |
| `detailPage.js` | ERP → Watt konversi, Leaflet tile ikut tema, neighbor click selalu bekerja |
| `main.js` | Fix cityStations.length out-of-scope, hapus double renderStatsBar, hapus 4 duplikat WILAYAH_SHORT, expose window.__openDetailFreq di boot() |
| `api/data.php` | CORS allow localhost dev, fix PDO named param duplikat neighbors, COALESCE erp NULL→40, filter sid_long != 0 |
| `channelEngine.js` | getChannelStatus single-pass (5x find → 1x for), guard `<` → `<=` |
| `app.css` | Hapus `truncate: ellipsis` invalid, FAB display:none di tablet breakpoint, hapus @import Google Fonts duplikat |
| `index.html` | Hapus Space Mono+DM Sans (tidak dipakai), load JetBrains Mono+Inter non-blocking, robots noindex, preconnect |
| `.github/workflows/deploy.yml` | Urutan API dulu→frontend, hapus dangerous-clean-slate, guard inject credentials, tambah health check step |
