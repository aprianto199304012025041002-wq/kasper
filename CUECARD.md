# KASPER — Cue Card Sesi 15 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Arsitektur

```
DB (MySQL: isr) → PHP API → Frontend (Vite + Vanilla JS)

Key fields: freq, area_of_service, city, district, stn_name, clnt_name,
            erp_pwr_dbm, status_simf, sid_lat, sid_long, validity_date

PHP API:
  wilayah_layanan = area_of_service AS wilayah_layanan (semua query)
  filter ?city=   → match ke area_of_service
  /cities         → DISTINCT area_of_service
  /stats          → GROUP BY area_of_service (per_wilayah + per_jenis)
  cache keys      → semua pakai prefix $CACHE_V (saat ini v4)
  summary         → {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
                    NB: TIDAK ada 'adjacent' — pakai adjacent_1 + adjacent_2

Frontend (src/):
  main.js         → app utama, state, render semua view (grid/pita/geo)
  channelEngine.js → computeChannelMapForWilayah() + allotment merge
  apiClient.js    → fetch + offline fallback
  detailPage.js   → detail stasiun + Leaflet
  interferenceView.js → panel interferensi
  mobile.js       → drawer + FAB
  data/allotment.js → KM 570/2025 (8 wilayah DIY)
  data/stations.json → fallback offline

View "geo" (tab ⊟) → renderCellGeo() di main.js (bukan file terpisah)
```

## Rules
1. `npm run build` wajib sebelum push
2. `kota` = fallback display saja, jangan pakai untuk grouping/filter
3. Komunitas AOS `"2,5 KILOMETER..."` → row terpisah, kanal 107.4–107.9
4. DB/live site/postel.go.id blocked dari sandbox
5. allotment.js hanya DIY

## 8 Wilayah Layanan DIY (KM 570/2025)
KOTA YOGYAKARTA (34-008 B), BANTUL BANGUNTAPAN (34-002 C),
WONOSARI (34-003 C), PATUK (34-004 C), WATES SENTOLO (34-001 C),
GAMPING (34-005 C), DEPOK (34-006 C),
SLEMAN NGAGLIK KALASAN NGEMPLAK PAKEM (34-007 C)

## Status
- ✅ Semua view + API konsisten wilayah_layanan
- ✅ Overlay allotment KM 570/2025 (allotted_lps ★ / allotted_rri ▣ / not_allotted ·)
- ✅ Komunitas row terpisah di band/grid/geo view
- ✅ Dead code dihapus: geoGridView.js (-883 baris), province.css, geo-grid.css,
     bandView.js, fetchProvinces, rateSlot, initMobileTap, CITY_PALETTE, dll
- ✅ Bug fix: InterferenceEngine adj 0.1/0.2 MHz, buildWhere area_of_service,
     getCities array_column, cache key prefix, double config load
- ⚠️ Perlu verifikasi visual di live setelah deploy
