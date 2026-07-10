# Peta Spektrum FM — D.I. Yogyakarta

Visualisasi pita spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon Kelas I Yogyakarta. Menampilkan kanal yang terpakai, kanal adjacent-protected, dan kanal kosong yang berpotensi dialokasikan untuk izin baru.

## Fitur

- Grid kanal 200 kHz dari 87.5–108.0 MHz sesuai aturan spasi kanal FM Indonesia
- Deteksi otomatis kanal kosong dan blok kanal kosong berurutan (gap analysis)
- Perhitungan center / lower / upper frequency per kanal
- Filter berdasarkan wilayah (Kota Yogyakarta, Sleman, Bantul, Gunungkidul, Kulon Progo) dan jenis siaran (swasta, publik/RRI, publik lokal/LPPL, komunitas)
- Pencarian stasiun
- Detail panel per kanal: ERP, bandwidth, penyelenggara, status izin

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

## Build untuk produksi

```bash
npm run build
```

Hasil build ada di folder `dist/`.

## Deploy

### GitHub Pages (otomatis)

Repo ini sudah dilengkapi workflow `.github/workflows/deploy.yml`. Setelah push ke branch `main`:

1. Buka **Settings → Pages** di repo GitHub
2. Pilih source **GitHub Actions**
3. Push ke `main`, situs otomatis ter-deploy

### Vercel / Netlify

Import repo ini langsung, gunakan setting default:
- Build command: `npm run build`
- Output directory: `dist`

## Struktur data

Data stasiun ada di `src/data/stations.json`, diekstrak dari database ISR (`isr.sql`) dengan filter `service = 'Broadcast'`, `subservice = 'FM'`, `province = 'DAERAH ISTIMEWA YOGYAKARTA'`.

Setiap entri berisi:

| Field | Keterangan |
|---|---|
| `freq` | Frekuensi center (MHz) |
| `bw_khz` | Bandwidth (kHz) |
| `lower` / `upper` | Batas bawah/atas kanal (MHz) |
| `stn_name` | Nama stasiun pemancar |
| `clnt_name` | Nama penyelenggara siaran |
| `kota` | Kabupaten/kota |
| `kecamatan` | Kecamatan |
| `erp_dbm` | Effective Radiated Power (dBm) |
| `jenis` | swasta / publik / publik_lokal / komunitas |
| `status` | Status izin (Granted/dll) |

### Memperbarui data dari sumber lain

Untuk regenerasi data dari file `isr.sql` lain (misal update terbaru atau provinsi berbeda), sesuaikan filter regex di skrip ekstraksi pada riwayat percakapan, atau tulis query SQL langsung:

```sql
SELECT freq, bwidth, stn_name, clnt_name, city, district, erp_pwr, status
FROM isr_stations
WHERE service = 'Broadcast' AND subservice = 'FM' AND province = 'DAERAH ISTIMEWA YOGYAKARTA';
```

Lalu format ulang ke `src/data/stations.json` sesuai skema di atas.

## Logika perhitungan kanal

Ada di `src/channelEngine.js`:

- **`buildChannelGrid()`** — membuat grid kanal 200 kHz
- **`getChannelStatus(ch, stations)`** — menentukan status kanal: `used`, `adjacent` (guard band di sebelah stasiun aktif), atau `free`
- **`computeChannelMap(stations)`** — peta status semua kanal
- **`findFreeBlocks(channelMap)`** — mengelompokkan kanal kosong berurutan jadi blok, hitung center/lower/upper kandidat
- **`rateSlot(count)`** — skor prioritas slot kosong berdasarkan lebar (jumlah kanal)

## Tech stack

Vanilla JS + Vite, tanpa framework — ringan dan cepat di-deploy ke static hosting manapun.
