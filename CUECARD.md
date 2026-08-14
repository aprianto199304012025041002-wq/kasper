# KASPER — Cue Card Sesi 14 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- READ token: `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`
- KUNCI token: `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`
- Live: `kasper.balmonjogja.info`

---

## Aturan logika spektrum FM (jangan sampai salah)

### Parameter kanal FM
- Step channel_map: 100kHz
- Adj-1: ±100kHz, Adj-2: ±200kHz
- Warna: kuning (used), merah dashed (adj), biru (free/allotted), ungu dashed (allotted RRI), redup (not allotted)

### Arsitektur data flow
```
PHP API /stations
  → raw stations (termasuk area_of_service AS wilayah_layanan)
  → channel_map (PHP ChannelEngine.php) — adj1/adj2 per sisi lengkap
  → summary, free_blocks

Frontend fetchSpectrum()
  → pakai channel_map dari PHP langsung (adj info)

main.js renderContent() cityRows
  → computeChannelMapForWilayah(cityStations, city) → allotmentIndex
  → merge allotment_status ke channel_map global dari PHP
  → grouping by wilayah_layanan (bukan kota administratif)

src/data/allotment.js
  → data penjatahan kanal KM Komdigi 570/2025 untuk DIY
  → 8 wilayah layanan: KOTA YOGYAKARTA, BANTUL BANGUNTAPAN, DEPOK,
    GAMPING, SLEMAN NGAGLIK..., WATES SENTOLO, WONOSARI, PATUK
```

### Field penting di station object
- `wilayah_layanan` = area_of_service dari DB (primary group key)
- `kota` = city administratif (fallback)
- `kecamatan` = district
- Komunitas: wilayah_layanan = "2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR"

### allotment_status per slot
- `allotted_lps` → biru ★ (kanal dijatahkan, kosong, bisa diisi LPS)
- `allotted_rri` → ungu dashed ▣ (dijatahkan untuk LPP RRI)
- `not_allotted` → redup · (tidak dijatahkan di wilayah ini)
- `null` → wilayah komunitas / tidak dikenal

---

## Commit history sesi ini (14 Agu 2026)
```
4dfdf16  fix: merge PHP channel_map adj info dengan allotment_status dari JS
83afbc0  fix: remove duplicate function declarations in channelEngine.js
89c3ac4  fix: propagate wilayah_layanan ke interferenceView, detailPage, neighbors
2d04d40  feat: overlay allotment KM 570/2025 per wilayah layanan
9af132f  feat: group by wilayah_layanan instead of kota administratif
851fbf1  fix: adj detail panels use adj1_*/adj2_* fields; remove dead bandView.js
```

## Status akhir sesi
- ✅ Grouping by wilayah_layanan (area_of_service dari DB)
- ✅ Overlay allotment KM 570/2025: allotted LPS/RRI/not_allotted
- ✅ PHP channel_map tetap sumber adj, JS sumber allotment — di-merge di cityRows
- ✅ detailPage, interferenceView, neighbors pakai wilayah_layanan
- ✅ Legend 5 item: used, adj, allotted LPS, allotted RRI, not_allotted
- ✅ stations.json fallback updated dengan wilayah_layanan

## Backlog / next session
- Verifikasi visual di live setelah deploy 108+
- Cek apakah allotment_status muncul benar di grid/pita untuk tiap wilayah
- Pertimbangkan: tampilkan allotment stats (berapa kanal allotted terisi vs kosong)
- Perlu review: stasiun komunitas "2,5 KILOMETER..." — apakah perlu group sendiri
  atau disembunyikan dari band/grid view dan hanya muncul di geo view?
