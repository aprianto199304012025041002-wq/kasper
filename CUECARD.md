# KASPER — Cue Card

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Clone & lanjut kerja

```bash
git clone https://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@github.com/aprianto199304012025041002-wq/kasper.git /home/claude/kasper && cat /home/claude/kasper/CUECARD.md
```

---

## Arsitektur

```
DB (MySQL tabel: isr) → PHP API → Frontend (Vite + Vanilla JS)
Deploy: GitHub Actions → FTP → Hostinger public_html/

Key DB fields: freq, area_of_service, city, district, stn_name, clnt_name,
               erp_pwr_dbm, status_simf, sid_lat, sid_long, validity_date,
               service='Broadcast', subservice='FM'

PHP API endpoints:
  /stations         → semua stasiun FM, filter ?city= ?province= ?search=
  /stations/:freq   → detail satu stasiun
  /cities           → DISTINCT area_of_service
  /stats            → COUNT GROUP BY area_of_service + jenis
  /interference     → analisis interferensi ITU-R BS.412
  /allotment        → serve api/data/allotment_nasional.json
  /health           → cek koneksi DB
  cache prefix      → v5 (bump untuk bust cache)
  filter ?city=     → match ke area_of_service (BUKAN kolom city)

Frontend src/:
  main.js             → state, renderShell (sidebar+toolbar), renderSidebar,
                        renderContent, semua view (grid/band/geo), detail drawer
  channelEngine.js    → computeChannelMapForWilayah() + allotment merge
  apiClient.js        → fetch API langsung (tanpa health check), fallback lokal
  detailPage.js       → detail stasiun + Leaflet map
  interferenceView.js → panel interferensi
  mobile.js           → FAB + drawer mobile (filter/view/wilayah)
  data/allotment.js   → KM 570/2025 hardcode (8 DIY + 76 Jateng = 84 wilayah)
  data/stations.json  → fallback offline (57 stasiun DIY only)
  api/data/allotment_nasional.json → placeholder kosong (belum diisi)
```

---

## Layout (desktop)

```
┌─ header (compact) ──────────────────────────────────────┐
├─ sidebar (220px) ──┬─ app-main ──────────────────────────┤
│ [search wilayah]   │ [toolbar: Grid | Pita | Geo + filter]│
│ Semua Wilayah  [N] │ [stats bar: 6-col]                  │
│ ── D.I. YOGYAKARTA │ [legend]                            │
│   Bantul-Bangunta  │ [dynamicContent — scrollable]       │
│   Depok …          │                                     │
│ ── JAWA TENGAH ──  │                                     │
│   Gandrungmangu…   │                                     │
│ ── ANALISIS ──     │                                     │
│   ⚡ Interferensi  │                                     │
└────────────────────┴─────────────────────────────────────┘
Mobile: sidebar collapse, FAB kiri bawah buka drawer
```

---

## State

```js
state = {
  page:             'main' | 'interference',
  view:             'grid' | 'band' | 'geo',
  filterCities:     [],          // sync dari selectedWilayah
  filterChanView:   'all' | 'free' | 'used',
  searchTerm:       '',
  geoSettings:      { showAdj, showLabel, onlyFree },
  data:             null,        // hasil fetchSpectrum
  interfData:       null,
  loading:          false,
  error:            null,
  selectedWilayah:  null,        // wilayah aktif sidebar
  sidebarCollapsed: false,
}

URL params: ?view= &page= &chan= &city= &q= &w=
```

---

## Rules wajib

1. `npm run build` wajib sebelum push — CI/CD rebuild di GitHub Actions
2. `area_of_service` = sumber kebenaran wilayah, bukan kolom `city`
3. Komunitas AOS `"2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR"` → row khusus
4. DB/live blocked dari sandbox — tidak bisa test langsung
5. `summary.adjacent` tidak ada → pakai `adjacent_1 + adjacent_2`
6. CSS warning "Unexpected /" → harmless, dari esbuild
7. `renderControls()` = no-op, controls ada di toolbar `renderShell`
8. `renderSidebar()` dipanggil setelah `loadData()` selesai
9. `apiClient.js` langsung fetch tanpa health check — eliminasi false fallback
10. Cache PHP prefix sekarang `v5`

---

## DB: isi data saat ini

```sql
SELECT province, COUNT(*) total FROM isr
WHERE service='Broadcast' AND subservice='FM'
GROUP BY province;
-- DAERAH ISTIMEWA YOGYAKARTA: 56
-- JAWA TENGAH: 50
-- Total: 106 stasiun
```

---

## Status checklist

- ✅ Layout rombak total: sidebar wilayah + toolbar + main area scrollable
- ✅ Stats bar 6-col desktop / 3-col mobile
- ✅ WILAYAH_SHORT labels semua 84 wilayah
- ✅ URL state sync (?view= &w= &chan= &q= &city=)
- ✅ allotment.js 84 wilayah (8 DIY + 76 Jateng) KM 570/2025
- ✅ Overlay allotment: ★ LPS / ▣ RRI / · tidak dijatahkan
- ✅ Komunitas row terpisah (107.4–107.9)
- ✅ Filter/search client-side
- ✅ apiClient tanpa health check (fix fallback false DIY-only)
- ✅ Cache bust v5
- ✅ Security headers .htaccess
- ✅ CI: GitHub Actions → FTP Hostinger
- 🔲 `api/data/allotment_nasional.json` masih kosong

---

## OUTSTANDING: allotment_nasional.json

Tool ada di laptop user: `extract_allotment.html` (di Downloads)
- Butuh: PDF `2025kepmen570_1_.pdf` + Gemini API key (gratis: aistudio.google.com/apikey)
- Output: `allotment_nasional.json` → taruh di `api/data/` → push

Setelah ada: endpoint `GET /allotment?provinsi=&kode=` langsung aktif.

---

## PERHATIAN: putih saat deploy terakhir

Sesi terakhir ada laporan layar putih setelah deploy UI baru.
**Kemungkinan besar: CI/CD belum selesai saat dicek.**
Kalau masih putih di sesi baru: buka DevTools → Console → cari error merah.
Paling mungkin ada element ID yang dicari tapi tidak ada di DOM baru.
