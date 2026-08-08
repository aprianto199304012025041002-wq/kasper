# KASPER — Kanal Spektrum Radio

Aplikasi web visualisasi spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon.

- **Live:** `kasper.balmonjogja.info`
- **Stack:** Vite + Vanilla JS · PHP 8 + MySQL · Deploy Hostinger

---

## Fitur

| Fitur | Keterangan |
|---|---|
| **Peta kanal grid** | Grid 100 kHz · 87.5–108.0 MHz, warna per wilayah |
| **Pita horizontal** | View alternatif, tinggi blok proporsional ERP |
| **Geo Grid** | Grid per kota dengan drawer filter (guard band, label, slot) |
| **Slot kosong** | Deteksi dan ranking blok kanal kosong potensial |
| **Detail stasiun** | Info lengkap + mini band strip + peta Leaflet + tetangga |
| **Analisis interferensi** | Model ITU-R BS.412: co-channel & adjacent channel |
| **Universal Drawer** | FAB → drawer kontrol: view, filter kota, search, geo settings |
| **API PHP** | Backend MySQL dengan 8 endpoint, file cache 5 menit |
| **Offline fallback** | Jika API tidak tersedia, pakai data JSON lokal otomatis |

---

## Struktur repo

```
kasper/
├── index.html                  # Entry point frontend
├── vite.config.js
├── package.json
│
├── src/                        # Frontend (Vite, Vanilla JS)
│   ├── main.js                 # App utama + state management
│   ├── apiClient.js            # HTTP client + offline fallback + retry
│   ├── channelEngine.js        # Logic grid/gap analysis (JS)
│   ├── bandView.js             # Renderer pita horizontal
│   ├── geoGridView.js          # Geo Grid per kota + drawer internal
│   ├── detailPage.js           # Halaman detail stasiun + Leaflet map
│   ├── interferenceView.js     # Panel analisis interferensi
│   ├── mobile.js               # Universal Drawer + FAB
│   ├── style.css               # Design tokens global (komenk palette)
│   ├── data/
│   │   └── stations.json       # Data stasiun FM fallback (offline)
│   └── components/
│       ├── responsive.css      # Drawer layout + breakpoints
│       ├── header.css
│       ├── stats.css
│       ├── grid.css
│       ├── band.css
│       └── detail-page.css
│
└── api/                        # Backend PHP
    ├── index.php               # Router API (8 endpoint)
    └── src/
        ├── config.php          # Konfigurasi DB (env vars)
        ├── Database.php        # PDO singleton
        ├── Response.php        # JSON response helper
        ├── Cache.php           # File cache TTL 5 menit
        ├── ChannelEngine.php   # Logic kanal (PHP port)
        ├── StationRepository.php
        ├── ProvinceRepository.php
        └── InterferenceEngine.php  # Model ITU-R BS.412
```

---

## Setup lokal

### Prasyarat
- Node.js ≥ 18
- PHP ≥ 8.1 + MySQL (opsional, bisa tanpa backend)

### 1. Clone dan install

```bash
git clone https://github.com/aprianto199304012025041002-wq/kasper.git
cd kasper
npm install
```

### 2. Jalankan tanpa backend (mode offline)

```bash
npm run dev
```

Buka `http://localhost:5173`. Data diambil dari `src/data/stations.json`.

### 3. Setup backend PHP (opsional)

```bash
# Import skema
mysql -u root -p < api/schema.sql

# Import data ISR
mysql -u root -p isr_db < /path/to/isr.sql

# Konfigurasi env (edit api/src/config.php atau set env vars)
# DB_HOST, DB_NAME, DB_USER, DB_PASS, CORS_ORIGIN

# Salin folder api/ ke web root PHP
cp -r api/ /var/www/html/kasper-api/

npm run dev
```

---

## Deploy ke Hostinger

### Backend PHP

1. Upload folder `api/` ke `public_html/api/`
2. Buat database MySQL di hPanel → **Databases**
3. Import `api/schema.sql` via phpMyAdmin
4. Import data ISR via phpMyAdmin atau SSH
5. Edit `api/src/config.php` — isi DB credentials
6. Pastikan `api/cache/` writable: `chmod 755 api/cache/`

### Frontend

Frontend di-serve langsung dari Hostinger (`kasper.balmonjogja.info`). API URL sudah hardcode di `src/apiClient.js`:

```js
const API_BASE = 'https://kasper.balmonjogja.info/api';
```

---

## Endpoint API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/stations` | Daftar stasiun + channel map + free blocks |
| GET | `/stations/:freq` | Detail satu stasiun + tetangga |
| GET | `/provinces` | Daftar provinsi + jumlah stasiun |
| GET | `/cities?province=` | Daftar kota/kabupaten |
| GET | `/channels` | Channel map saja |
| GET | `/slots?min_count=2` | Slot kosong potensial |
| GET | `/interference` | Analisis interferensi co-channel & adjacent |
| GET | `/stats` | Statistik ringkasan |
| GET | `/health` | Cek koneksi DB |

**Query params umum:** `province=`, `city=`, `jenis=`, `search=`, `status=`

### Contoh request

```bash
# Slot kosong dengan minimal 2 kanal berurutan
curl "https://kasper.balmonjogja.info/api/slots?min_count=2"

# Detail stasiun 106.1 MHz
curl "https://kasper.balmonjogja.info/api/stations/106.1"

# Interferensi Sleman
curl "https://kasper.balmonjogja.info/api/interference?city=SLEMAN"
```

---

## Update data ISR

```bash
# Truncate dan reimport
mysql -u root -p isr_db -e "TRUNCATE TABLE isr;"
mysql -u root -p isr_db < isr_baru.sql

# Bust cache API
rm -f api/cache/*.cache
```

---

## Model interferensi

Analisis menggunakan **free-space path loss** berbasis ITU-R BS.412:

- **Co-channel**: protection ratio minimum 30 dB
- **Adjacent ±200 kHz**: protection ratio minimum 20 dB
- **2nd Adjacent ±400 kHz**: protection ratio minimum 10 dB
- Radius evaluasi: 150 km per pasangan stasiun
- **Prasyarat**: kolom `latitude` dan `longitude` di tabel `isr` harus terisi

Model ini adalah aproksimasi — untuk analisis resmi gunakan ITU-R P.1546 atau SEAMCAT.
