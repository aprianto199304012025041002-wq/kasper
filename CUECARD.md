# KASPER — Cue Card Sesi 15 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Arsitektur

```
DB (MySQL tabel: isr)
  → kolom kunci: freq, area_of_service, city, district, stn_name, clnt_name,
                 erp_pwr_dbm, status_simf, sid_lat, sid_long, validity_date, no_simf

PHP API
  → wilayah_layanan = area_of_service AS wilayah_layanan (semua query)
  → channel_map: adj1_left/adj1_right/adj2_left/adj2_right
  → summary: {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
  → filter ?city= → match ke area_of_service (bukan city administratif)
  → /cities → DISTINCT area_of_service
  → /stats → GROUP BY area_of_service (per_wilayah + per_jenis)

Frontend
  → wilayah_layanan = primary group key di semua view
  → kota = fallback display saja
  → computeChannelMapForWilayah() → allotmentIndex → merge ke channel_map PHP
  → komunitas AOS "2,5 KILOMETER..." → row terpisah, kanal 107.4–107.9 saja
```

## Rules
1. `npm run build` wajib sebelum push
2. `summary.adjacent` tidak ada → pakai `adjacent_1 + adjacent_2`
3. Jangan pakai `kota` untuk grouping/filter
4. DB/kasper.balmonjogja.info/postel.go.id blocked dari sandbox
5. allotment.js hanya DIY — 8 wilayah layanan

## 8 Wilayah Layanan DIY (KM 570/2025)
| Key allotment.js | Kode |
|---|---|
| KOTA YOGYAKARTA | 34-008 (B) |
| BANTUL, BANGUNTAPAN | 34-002 (C) |
| WONOSARI | 34-003 (C) |
| PATUK | 34-004 (C) |
| WATES, SENTOLO | 34-001 (C) |
| GAMPING | 34-005 (C) |
| DEPOK | 34-006 (C) |
| SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM | 34-007 (C) |

## Status
- ✅ Semua view + API konsisten wilayah_layanan
- ✅ Overlay allotment KM 570/2025 (allotted_lps ★ / allotted_rri ▣ / not_allotted ·)
- ✅ Komunitas row terpisah di semua 3 view
- ✅ InterferenceEngine adj threshold fix (0.1/0.2 MHz bukan 0.2/0.4)
- ✅ getById explicit columns, buildWhere → area_of_service, getCities → wilayah_layanan
- ✅ Stats bar + geoGridView stats: allotment breakdown
- ✅ REGION_COLORS + shortCity pakai wilayah_layanan keys
- ⚠️ Perlu verifikasi visual di live
- 🔲 allotment.js hanya DIY — jika diperluas perlu data provinsi lain
