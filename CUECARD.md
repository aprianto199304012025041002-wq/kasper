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
  /cities         → DISTINCT area_of_service (array_column 'wilayah_layanan')
  /stats          → GROUP BY area_of_service → per_wilayah + per_jenis
  cache keys      → semua prefix $CACHE_V (saat ini v4)
  summary fields  → {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
                    NB: tidak ada 'adjacent' — pakai adjacent_1 + adjacent_2

Frontend src/:
  main.js (976 ln)  → app utama, state, render semua view
  channelEngine.js  → computeChannelMapForWilayah() + allotment merge
  apiClient.js      → fetch + offline fallback (filter = client-side, NOT refetch)
  detailPage.js     → detail stasiun + Leaflet
  interferenceView.js → panel interferensi
  mobile.js         → drawer + FAB
  data/allotment.js → KM 570/2025 (8 wilayah DIY)
  data/stations.json → fallback offline

View "geo" (tab ⊟) → renderCellGeo() di main.js (bukan file terpisah)
Filter/search       → client-side renderContent(), TIDAK refetch API
```

## Rules
1. `npm run build` wajib sebelum push
2. `kota` = fallback display, jangan pakai untuk grouping/filter
3. Komunitas AOS `"2,5 KILOMETER..."` → row terpisah, kanal 107.4–107.9
4. DB/live/postel.go.id blocked dari sandbox
5. allotment.js hanya cover DIY

## 8 Wilayah Layanan DIY (KM 570/2025)
KOTA YOGYAKARTA (34-008 B), BANTUL BANGUNTAPAN (34-002 C),
WONOSARI (34-003 C), PATUK (34-004 C), WATES SENTOLO (34-001 C),
GAMPING (34-005 C), DEPOK (34-006 C),
SLEMAN NGAGLIK KALASAN NGEMPLAK PAKEM (34-007 C)

## Status akhir
- ✅ Semua view + API konsisten wilayah_layanan
- ✅ Overlay allotment KM 570/2025
- ✅ Komunitas row terpisah + click handler benar
- ✅ Filter/search client-side (tidak refetch API)
- ✅ Dead code bersih: geoGridView.js (-883), province.css, geo-grid.css,
     syncFilterBadge, gg-scroll-wrap, fetchProvinces, dll
- ✅ Bug fix: InterferenceEngine adj 0.1/0.2, buildWhere area_of_service,
     header 100kHz, channel width 100kHz, spasi ITU-R label
- ⚠️ Perlu verifikasi visual di live
