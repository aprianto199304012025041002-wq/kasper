# KASPER — Cue Card Sesi 11 Agu 2026

## Repo
`github.com/aprianto199304012025041002-wq/kasper.git`
- READ token: `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`
- KUNCI token: `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`
- Live: `kasper.balmonjogja.info`

---

## Aturan logika spektrum FM (penting, jangan sampai salah lagi)

### Parameter kanal FM (ITU / Permenkominfo Indonesia)
- **Step channel_map**: 100kHz
- **Lebar 1 kanal**: 100kHz total (±50kHz dari center) — bukan 200kHz
- **Adj-1**: ±100kHz dari center (1 step)
- **Adj-2**: ±200kHz dari center (2 step)
- **Deviasi maks**: ±75kHz, guard band 25kHz
- Channel spacing alokasi baru: 200kHz (tapi stasiun lama bisa di frekuensi "di luar grid")

### Visualisasi pita (band view SVG)
- Arch sinus: puncak di center freq, kaki di ±100kHz (pas di posisi adj-1)
- Adj-1: garis dashed merah pendek di ±100kHz
- Adj-2: garis dashed merah redup lebih pendek di ±200kHz
- Free: titik biru di baseline
- Semua elemen punya label frekuensi di bawah baseline
- Step = 100kHz = 20px (SVG_W_PER_MHZ = 200px/MHz)

### Simbol arah adj di grid dan pita
Panah menunjuk KE ARAH stasiun yang jadi sumber interferensi:
- `<` = adj-1 dari kiri (stasiun 100kHz di kiri)
- `>` = adj-1 dari kanan (stasiun 100kHz di kanan)
- `<>` = adj-1 dari dua sisi
- `<<` = adj-2 dari kiri saja
- `>>` = adj-2 dari kanan saja
- `<<>>` = adj-2 dari dua sisi
- `<>>` = adj-1 kiri + adj-2 kanan
- `<<>` = adj-2 kiri + adj-1 kanan

**Prioritas per sisi**: adj-1 menang atas adj-2 (adj-1 lebih ketat)
Contoh: kiri kena adj-1 → `<` bukan `<<`, meski juga kena adj-2 dari kiri

### Sumber data adj
- `adj1_left` = stasiun di 100kHz kiri slot ini
- `adj1_right` = stasiun di 100kHz kanan slot ini
- `adj2_left` = stasiun di 200kHz kiri slot ini
- `adj2_right` = stasiun di 200kHz kanan slot ini
- Field ini ada di channel_map dari PHP (ChannelEngine.php) dan JS (channelEngine.js)
- **channel_map dari PHP dipakai langsung** — tidak di-rebuild di frontend
  (kecuali offline/fallback)

### Prioritas tampilan per row kota
1. **Own station (used)** milik kota ini → selalu menang, override adj global
2. **Used kota lain** → tampil sebagai free di row kota ini
3. **Adjacent** → tampil di SEMUA row kota (proteksi berlaku universal)
4. **Free** → slot tidak terpengaruh apapun

### Co-channel
- Beberapa stasiun di frekuensi yang sama (misal 107.5 MHz ada 3 di Bantul)
- Di grid/pita/geo: 1 cell/arch saja, badge `×3` di pojok
- Klik → swipe drawer urut abjad, tiap card = 1 stasiun
- `coStations` array di channel object, amplitude SVG = rata-rata ERP

### Warna standar
- **Used**: kuning `#ffd600`
- **Adjacent (1&2)**: merah `#ff2d2d`, border dashed
- **Free**: biru langit `#1e90ff`

---

## Commit history sesi ini (11 Agu 2026)
```
d0ec727  fix: pakai channel_map dari PHP langsung
0aae2ce  refactor: channel_map dibangun di frontend dari raw stations API
705372a  fix: bust cache API v2
d6fdada  fix: adjSymbol — panah menunjuk ke arah stasiun
10b568f  fix: adjSymbol — adj-1 menang atas adj-2 per sisi
39cb65a  fix: adjSymbol arah panah terbalik
b9fa912  fix: ChannelEngine.php — adj1/adj2 per sisi terpisah
69cb155  feat: simbol campuran adj
bc720cc  fix: adjSymbol adj2 pakai <<>>
ce3a3da  feat: simbol arah adj + label frekuensi semua elemen
001fca8  fix: arch sinus kaki ±100kHz
3b05b02  ux: pita step 100kHz — dot/tick proporsional
3cdefe8  ux: pita 200px/MHz
...dan banyak lagi (grid/pita/geo refactor, drawer, co-channel, warna)
```

---

## Arsitektur data flow
```
PHP API /stations
  → raw stations dari DB
  → channel_map (PHP ChannelEngine.php) — adj1/adj2 fields lengkap
  → summary, free_blocks

Frontend apiClient.js fetchSpectrum()
  → pakai channel_map dari PHP langsung (tidak di-rebuild)
  → fallback: computeChannelMap(stations) dari channelEngine.js

main.js renderContent()
  → 1 pipeline filter untuk semua view (grid/band/geo)
  → buildCityRows: per kota, own station override adj global
  → adjSymbol(c): baca adj1_left/adj1_right/adj2_left/adj2_right
  → renderCell (grid) / renderBandSVG (pita) / renderCellGeo (geo)
```

---

## Status akhir sesi
- ✅ Simbol adj arah benar (< > <> << >> <<>> <>> <<>)
- ✅ PHP ChannelEngine.php simpan adj1/adj2 per sisi
- ✅ channel_map dari PHP dipakai langsung di frontend
- ✅ Pita view: arch sinus proporsional, ruler frekuensi, label semua elemen
- ✅ Co-channel: badge, swipe drawer, arch rata-rata ERP
- ✅ Warna seragam: kuning/merah dashed/biru
- ✅ Grid/pita/geo konsisten: 1 pipeline, 1 drawer, 1 aturan

## Yang belum dikerjakan / next session
- Verifikasi visual simbol adj di live (harusnya sudah benar setelah d0ec727)
- Fine-tuning visual pita jika masih ada masalah proporsi
- Update fallback JSON stations.json agar sinkron dengan DB live
