# KASPER — Kanal Spektrum Radio

Aplikasi web visualisasi spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon Jogja, dengan overlay allotment berdasarkan KM Komdigi No. 570 Tahun 2025.

- **Live:** `kasper.balmonjogja.info`
- **Stack:** Vite + Vanilla JS · PHP 8 + MySQL · Deploy Hostinger

---

## Fitur

| Fitur | Keterangan |
|---|---|
| **Peta kanal grid** | Grid 100 kHz · 87.5–108.0 MHz, grouping per wilayah layanan |
| **Pita horizontal** | View alternatif, tinggi blok proporsional ERP |
| **Geo Grid** | Grid per wilayah layanan dengan drawer filter |
| **Overlay allotment** | KM 570/2025: allotted LPS ★, allotted RRI ▣, tidak dijatahkan · |
| **Komunitas** | Row terpisah (oranye) di bawah, kanal 107.4–107.9 MHz |
| **Slot kosong** | Deteksi dan ranking blok kanal kosong potensial (hanya allotted) |
| **Detail stasiun** | Info lengkap + mini band strip + peta Leaflet + tetangga |
| **Analisis interferensi** | Model ITU-R BS.412: co-channel & adjacent (±100/±200 kHz) |
| **Universal Drawer** | FAB → drawer kontrol: view, filter wilayah, search, geo settings |
| **API PHP** | Backend MySQL dengan 8 endpoint, file cache 5 menit |
| **Offline fallback** | Jika API tidak tersedia, pakai data JSON lokal otomatis |

---

## Struktur repo

```
kasper/
├── index.html
├── vite.config.js
├── package.json
│
├── src/
│   ├── main.js                 # App utama + state management + Geo Grid view
│   ├── apiClient.js            # HTTP client + offline fallback
│   ├── channelEngine.js        # Logic grid/allotment (JS)
│   ├── detailPage.js           # Halaman detail stasiun + Leaflet map
│   ├── interferenceView.js     # Panel analisis interferensi
│   ├── mobile.js               # Universal Drawer + FAB
│   ├── style.css               # Design tokens global
│   ├── data/
│   │   ├── stations.json       # Fallback data stasiun FM
│   │   └── allotment.js        # Data allotment KM 570/2025 (8 wilayah DIY)
│   └── components/
│       ├── responsive.css
│       ├── header.css
│       ├── stats.css
│       ├── grid.css
│       ├── band.css
│       └── detail-page.css
│
└── api/
    ├── index.php               # Router API
    └── src/
        ├── config.php
        ├── Database.php
        ├── Response.php
        ├── Cache.php
        ├── ChannelEngine.php
        ├── StationRepository.php
        ├── ProvinceRepository.php
        └── InterferenceEngine.php
```

---

## Wilayah Layanan DIY (KM 570/2025)

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

---

## Setup lokal

```bash
git clone https://github.com/aprianto199304012025041002-wq/kasper.git
cd kasper
npm install
npm run dev   # offline mode, data dari src/data/stations.json
```

---

## Endpoint API

| Endpoint | Keterangan |
|---|---|
| `GET /stations` | Stasiun + channel map + free blocks |
| `GET /stations/:freq` | Detail stasiun + tetangga |
| `GET /provinces` | Daftar provinsi |
| `GET /cities?province=` | Daftar wilayah layanan per provinsi |
| `GET /channels` | Channel map saja |
| `GET /slots?min_count=2` | Slot kosong potensial |
| `GET /interference` | Analisis interferensi |
| `GET /stats` | Statistik per wilayah layanan + per jenis |
| `GET /health` | Cek koneksi DB |

**Query params:** `province=`, `city=` (match ke `area_of_service`), `jenis=`, `search=`

---

## Model interferensi

ITU-R BS.412 free-space approximation:

- **Co-channel**: PR minimum 30 dB
- **1st Adjacent ±100 kHz**: PR minimum 20 dB
- **2nd Adjacent ±200 kHz**: PR minimum 10 dB
- Radius evaluasi: 150 km
- Prasyarat: kolom `latitude`/`longitude` di tabel `isr` terisi

---

## Update data ISR

```bash
# Bust cache
rm -f api/cache/*.cache

# Reimport
mysql -u root -p isr_db -e "TRUNCATE TABLE isr;"
mysql -u root -p isr_db < isr_baru.sql
```
