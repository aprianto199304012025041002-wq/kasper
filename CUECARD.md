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
  cache keys      → semua prefix $CACHE_V (saat ini v4)
  summary         → {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
                    NB: tidak ada 'adjacent' — pakai adjacent_1 + adjacent_2

Frontend src/:
  main.js (1008 ln) → app utama, state, render semua view
  channelEngine.js  → computeChannelMapForWilayah() + allotment merge
  apiClient.js      → fetch + offline fallback
  detailPage.js     → detail stasiun + Leaflet
  interferenceView.js → panel interferensi
  mobile.js         → drawer + FAB
  data/allotment.js → KM 570/2025 (8 wilayah DIY)
  data/stations.json → fallback offline

View "geo" (tab ⊟) → renderCellGeo() di main.js
Filter/search       → client-side renderContent(), TIDAK refetch API
allotmentIndex      → di-cache per wilayah di state._allotmentCache
```

## Rules
1. `npm run build` wajib sebelum push — pernah break karena syntax error
2. `kota` = fallback display, jangan pakai untuk grouping/filter
3. Komunitas AOS `"2,5 KILOMETER..."` → row terpisah, kanal 107.4–107.9
4. DB/live/postel.go.id blocked dari sandbox
5. allotment.js hanya cover DIY — 8 wilayah layanan
6. summary.adjacent tidak ada → pakai adjacent_1 + adjacent_2
7. CSS warning "Unexpected /" → harmless, dari esbuild/comment syntax

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
- ✅ shortWilayah() untuk label readable di row header + chips
- ✅ Dead code sangat minimal — CSS -19%, JS lean
- ✅ Security headers (.htaccess): CSP, X-XSS-Protection, Permissions-Policy
- ✅ Font non-blocking (media=print trick), terser drop_console
- ✅ CI: npm ci + paths-ignore **.md
- ⚠️ Perlu verifikasi visual di live
- 🔲 allotment.js hanya DIY
