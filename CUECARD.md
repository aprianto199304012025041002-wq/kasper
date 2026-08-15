# KASPER — Cue Card Sesi 15 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- Token: `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`
- Live: `kasper.balmonjogja.info`

---

## Arsitektur data flow

```
DB (MySQL tabel: isr)
  kolom kunci: freq, area_of_service, city, district, stn_name, clnt_name,
               erp_pwr_dbm, status_simf, sid_lat, sid_long, validity_date, no_simf, masa_laku

PHP API /stations
  → stations[] dengan wilayah_layanan (area_of_service AS wilayah_layanan)
  → channel_map (PHP ChannelEngine) — adj1_left/adj1_right/adj2_left/adj2_right
  → summary: {total, used, adjacent_1, adjacent_2, free, pct_used, pct_free}
  → NB: summary tidak punya 'adjacent' — pakai adjacent_1 + adjacent_2

Filter ?city= di API → match ke area_of_service (bukan kolom city administratif)

Frontend fetchSpectrum()
  → pakai channel_map dari PHP (adj info sumber kebenaran)

main.js / geoGridView.js renderContent():
  → computeChannelMapForWilayah(cityStations, wilayah) → allotmentIndex
  → merge allotment_status ke channel_map PHP per freq
  → grouping by wilayah_layanan
  → komunitas: row terpisah di bawah (oranye, kanal 107.4–107.9 saja)

src/data/allotment.js
  → KM Komdigi 570/2025, 8 wilayah layanan DIY
  → allotted_lps ★ biru, allotted_rri ▣ ungu dashed, not_allotted · redup
```

## Field station object
- `wilayah_layanan` = area_of_service dari DB — primary group key
- `kota` = city administratif — fallback/display saja (jangan dipakai untuk grouping)
- `kecamatan` = district
- `jenis` = classifyJenis() computed: swasta/publik/publik_lokal/komunitas
- Komunitas AOS: `"2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR"` — exclude dari group biasa

## 8 Wilayah Layanan DIY (KM 570/2025)
| Kode | Key di allotment.js | Kelas |
|------|---------------------|-------|
| 34-001 | WATES, SENTOLO | C |
| 34-002 | BANTUL, BANGUNTAPAN | C |
| 34-003 | WONOSARI | C |
| 34-004 | PATUK | C |
| 34-005 | GAMPING | C |
| 34-006 | DEPOK | C |
| 34-007 | SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM | C |
| 34-008 | KOTA YOGYAKARTA | B |

## Aturan teknis
- Step: 100 kHz, range 87.5–108.0 MHz, 206 slot
- Co-channel: |Δf| < 0.055 → used
- Adj-1: |Δf| ≈ 0.1 MHz (20 dB), Adj-2: |Δf| ≈ 0.2 MHz (10 dB)
- Kanal komunitas: 202–204 (107.7–107.9 MHz), kelas D max 50W ±2.5km

## Rules before coding
1. `npm run build` wajib sebelum setiap push — pernah gagal karena duplicate export
2. DB domain blocked dari sandbox — tidak bisa curl ke kasper.balmonjogja.info
3. postel.go.id dan jdih.komdigi.go.id blocked dari sandbox
4. Jangan pakai `kota` untuk grouping/filter — pakai `wilayah_layanan`
5. `summary.adjacent` tidak ada — gunakan `adjacent_1 + adjacent_2`

## Commit terakhir sesi ini
```
98d0068  fix: buildWhere city filter → area_of_service
21389cd  fix: getById explicit columns + wilayah_layanan + classifyJenis
93e70a9  fix: apiClient fallback wilayah_layanan + channel_spacing 0.1
4e4e171  feat: komunitas row di geoGridView
4c4f1b3  feat: komunitas row terpisah di band/grid view (oranye, 107.4–107.9)
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
83afbc0  fix: duplicate export di channelEngine.js
```

## Status / backlog
- ✅ Semua view (grid/pita/geo) konsisten wilayah_layanan + allotment KM 570/2025
- ✅ Komunitas tampil sebagai row terpisah di semua 3 view
- ✅ Stats bar + geoGridView stats: allotment breakdown (terisi/kosong)
- ✅ API filter ?city= match ke area_of_service
- ✅ getById explicit columns (tidak lagi SELECT *)
- ✅ buildWhere, fetchCities, fallback semua konsisten wilayah_layanan
- ⚠️ Belum diverifikasi di live — perlu cek visual setelah deploy
- 🔲 allotment.js hanya DIY — jika scope diperluas perlu data provinsi lain
- 🔲 CSS warning "Unexpected /" di build — dari comment unicode, harmless
