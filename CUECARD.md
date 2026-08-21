# KASPER — Cue Card

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Arsitektur

```
DB (MySQL: isr) → PHP API → Frontend (Vite + Vanilla JS)

Key DB fields: freq, area_of_service, city, district, stn_name, clnt_name,
               erp_pwr_dbm, status_simf, sid_lat, sid_long, validity_date

PHP API:
  wilayah_layanan = area_of_service AS wilayah_layanan (semua query)
  filter ?city=   → match ke area_of_service (BUKAN kolom city)
  /cities         → DISTINCT area_of_service
  /stats          → GROUP BY area_of_service → per_wilayah + per_jenis
  /allotment      → serve api/data/allotment_nasional.json (filter ?provinsi= ?kode=)
  cache keys      → semua prefix $CACHE_V (saat ini v4)
  summary         → {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
                    NB: tidak ada 'adjacent' — pakai adjacent_1 + adjacent_2

Frontend src/:
  main.js           → app utama, state, render semua view + sidebar + toolbar
  channelEngine.js  → computeChannelMapForWilayah() + allotment merge
  apiClient.js      → fetch + offline fallback
  detailPage.js     → detail stasiun + Leaflet
  interferenceView.js → panel interferensi
  mobile.js         → drawer + FAB
  data/allotment.js → KM 570/2025 (8 DIY + 76 Jateng = 84 wilayah layanan)
  data/stations.json → fallback offline
  api/data/allotment_nasional.json → data nasional (placeholder kosong, lihat handoff)

CSS components/:
  sidebar.css   → sidebar wilayah + app-body layout (NEW)
  header.css    → header compact
  stats.css     → stats bar 6-col desktop / 3-col mobile
  grid.css      → ch-cell, city-row-block, legend, tooltip
  band.css      → band SVG row
  detail-page.css → drawer + inline detail
  responsive.css  → mobile overrides
```

## Layout & State

```
App layout (desktop):
┌─ header ──────────────────────────────────┐
├─ sidebar (220px) ──┬─ app-main ───────────┤
│ [search wilayah]   │ [toolbar: tab+filter] │
│ Semua Wilayah      │ [stats bar 6-col]     │
│ ── DIY ──          │ [legend]              │
│   Kota Yogyakarta  │ [dynamicContent]      │
│   Bantul …         │   scrollable          │
│ ── Jateng ──       │                       │
│   Gandrungmangu…   │                       │
│ ── Analisis ──     │                       │
│   ⚡ Interferensi  │                       │
└────────────────────┴───────────────────────┘

State:
  state.selectedWilayah → wilayah aktif dari sidebar klik
  state.filterCities    → sync dari selectedWilayah
  state.view            → 'grid' | 'band' | 'geo'
  state.page            → 'main' | 'interference'
  state.filterChanView  → 'all' | 'free' | 'used'
  state.searchTerm      → search string
  state.sidebarCollapsed → boolean

URL params: ?view= &page= &chan= &city= &q= &w=
```

## Rules
1. `npm run build` wajib sebelum push — pernah break karena syntax error
2. `kota` = fallback display, jangan pakai untuk grouping/filter
3. Komunitas AOS `"2,5 KILOMETER..."` → row terpisah, kanal 107.4–107.9
4. DB/live/postel.go.id blocked dari sandbox
5. allotment.js sudah cover DIY (8) + Jateng (76) = 84 wilayah
6. summary.adjacent tidak ada → pakai adjacent_1 + adjacent_2
7. CSS warning "Unexpected /" → harmless, dari esbuild/comment syntax
8. renderControls() sekarang no-op — controls ada di toolbar (renderShell)
9. renderSidebar() dipanggil setelah loadData() selesai

## 8 Wilayah Layanan DIY (KM 570/2025)
| Key allotment.js | Kode | Kelas | Allotted |
|---|---|---|---|
| KOTA YOGYAKARTA | 34-008 | B | 15 (3 RRI + 12 LPS) |
| BANTUL, BANGUNTAPAN | 34-002 | C | 4 (1 RRI + 3 LPS) |
| WONOSARI | 34-003 | C | 3 (0 RRI + 3 LPS) |
| PATUK | 34-004 | C | 2 (1 RRI + 1 LPS) |
| WATES, SENTOLO | 34-001 | C | 3 (0 RRI + 3 LPS) |
| GAMPING | 34-005 | C | 2 (0 RRI + 2 LPS) |
| DEPOK | 34-006 | C | 7 (0 RRI + 7 LPS) |
| SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM | 34-007 | C | 9 (1 RRI + 8 LPS) |

## Status akhir
- ✅ Semua view + API konsisten wilayah_layanan
- ✅ Overlay allotment KM 570/2025 (allotted_lps ★ / allotted_rri ▣ / not_allotted ·)
- ✅ Komunitas row terpisah di band/grid/geo view + click handler benar
- ✅ Filter/search client-side (tidak refetch API)
- ✅ Cache allotmentIndex per wilayah
- ✅ WILAYAH_SHORT labels semua 84 wilayah (DIY + Jateng)
- ✅ URL state sync (?view= &w= &chan= &q= &city=) — bookmarkable
- ✅ geoSettings (showAdj/showLabel/onlyFree) terhubung ke Geo Grid view
- ✅ UI/UX rombak total: sidebar wilayah kiri + toolbar atas + main area scrollable
- ✅ Stats bar 6-col desktop / 3-col mobile (2 baris)
- ✅ Sidebar collapse/expand + search filter wilayah
- ✅ Sidebar grouped per provinsi: DIY / Jawa Tengah / Analisis
- ✅ Security headers (.htaccess): CSP, X-XSS-Protection, Permissions-Policy
- ✅ Font non-blocking, terser drop_console
- ✅ CI: npm ci + paths-ignore **.md
- 🔲 api/data/allotment_nasional.json masih kosong (lihat HANDOFF di bawah)

---

## HANDOFF — Sesi Berikutnya

### Satu-satunya outstanding item:
**Isi `api/data/allotment_nasional.json` dengan data KM 570/2025 nasional**

### Cara:
1. User punya tool browser: `extract_allotment.html` (ada di Downloads user)
   - Pakai Gemini API (gratis, daftar di aistudio.google.com/apikey)
   - Upload PDF `2025kepmen570_1_.pdf` (182 halaman, nasional)
   - Klik Mulai → download `allotment_nasional.json`
2. User taruh file di `api/data/allotment_nasional.json` di repo
3. Push → endpoint `/allotment` otomatis aktif

### Setelah JSON nasional tersedia:
- Pertimbangkan: apakah `src/data/allotment.js` (DIY+Jateng, hardcode di frontend)
  perlu diganti fetch ke `/allotment` API, atau tetap hardcode untuk performa
- Kalau diganti: update `channelEngine.js` → fetch allotment dari API saat init
