# KASPER — Cue Card Sesi 15 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Arsitektur data flow

```
DB (MySQL tabel: isr)
  → PHP API /stations  → stations[] dengan wilayah_layanan (area_of_service)
  → PHP API channel_map → adj1_left/adj1_right/adj2_left/adj2_right lengkap
  → PHP API summary     → {total,used,adjacent_1,adjacent_2,free,pct_used,pct_free}

Frontend fetchSpectrum()
  → pakai channel_map dari PHP (adj info sumber kebenaran)

main.js / geoGridView.js renderContent() per wilayah:
  → computeChannelMapForWilayah(cityStations, wilayah) → allotmentIndex
  → merge allotment_status ke channel_map PHP per freq
  → grouping by wilayah_layanan (bukan kota administratif)

src/data/allotment.js
  → KM Komdigi 570/2025, 8 wilayah layanan DIY
  → allotted_lps ★ (biru), allotted_rri ▣ (ungu dashed), not_allotted · (redup)
```

## Field station object
- `wilayah_layanan` = area_of_service dari DB — primary group key
- `kota` = city administratif — fallback display saja
- `kecamatan` = district
- Komunitas AOS: `"2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR"` — exclude dari grid/pita/geo

## 8 Wilayah Layanan DIY (KM 570/2025)
| Kode | Wilayah | Kelas |
|------|---------|-------|
| 34-001 | WATES, SENTOLO | C |
| 34-002 | BANTUL, BANGUNTAPAN | C |
| 34-003 | WONOSARI | C |
| 34-004 | PATUK | C |
| 34-005 | GAMPING | C |
| 34-006 | DEPOK | C |
| 34-007 | SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM | C |
| 34-008 | KOTA YOGYAKARTA | B |

## Aturan teknis
- Step: 100 kHz, Adj-1: ±100 kHz (20dB), Adj-2: ±200 kHz (10dB)
- summary.adjacent tidak ada → pakai adjacent_1 + adjacent_2
- PHP ChannelEngine sudah produce adj1_left/adj1_right/adj2_left/adj2_right + backward compat adj_left/adj_right

## Commit terakhir sesi ini
```
b0db1f8  chore: hapus komentar stale
ccf3b15  feat: allotment stats di geoGridView stats panel
fd7a162  fix: TYPE_LABELS adj spacing; summary.adjacent fix
ee83b57  fix: slotBar dan freeN hanya allotted
b8d6734  feat: allotment visual di geoGridView
de7dba3  refactor: geoGridView pakai buildChannelGrid()
5c1e7f0  fix: exclude komunitas dari chips/renderControls
334e2cb  fix: geoGridView konsisten wilayah_layanan + allotment
94da250  fix: getCities return wilayah_layanan
5782966  refactor: cleanup dead code + allotment stats statsBar
4dfdf16  fix: merge PHP channel_map adj + allotment_status JS
```

## Status / backlog
- ✅ Semua view (grid/pita/geo) konsisten wilayah_layanan + allotment
- ✅ Komunitas excluded dari band/grid/geo
- ✅ Stats bar + geoGridView stats panel punya allotment breakdown
- ✅ Legend 5 item di main.js; geoGridView allotment CSS
- ⚠️ Belum diverifikasi di live (tunggu deploy)
- 🔲 allotment.js hanya cover DIY — jika scope diperluas perlu data lain
- 🔲 Komunitas — saat ini tidak ditampilkan sama sekali; mungkin perlu geo-only view
- 🔲 CSS warning "Unexpected /" di build — dari comment unicode, harmless
