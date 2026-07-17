# ISR FM Spectrum — v3

Aplikasi web visualisasi pita spektrum frekuensi FM berbasis data ISR (Izin Stasiun Radio) Balmon.

## Fitur

| Fitur | Keterangan |
|---|---|
| **Peta kanal grid** | Grid 200 kHz · 87.5–108.0 MHz, warna per wilayah |
| **Pita horizontal** | View alternatif, tinggi blok proporsional ERP |
| **Slot kosong** | Deteksi dan ranking blok kanal kosong potensial |
| **Detail stasiun** | Info lengkap + mini band strip + peta Leaflet + tetangga |
| **Multi-provinsi** | Tab provinsi dinamis, filter wilayah |
| **Analisis interferensi** | Model ITU-R BS.412: co-channel & adjacent channel |
| **API PHP** | Backend MySQL dengan 7 endpoint, file cache 5 menit |
| **Offline fallback** | Jika API tidak tersedia, pakai data JSON lokal otomatis |

---

## Struktur repo

```
isr-fm-spectrum/
├── index.html                  # Entry point frontend
├── vite.config.js
├── package.json
├── .env.example                # Template konfigurasi URL API
├── .github/workflows/
│   └── deploy.yml              # Auto-deploy ke GitHub Pages
│
├── src/                        # Frontend (Vite, Vanilla JS)
│   ├── main.js                 # App utama
│   ├── apiClient.js            # HTTP client + offline fallback
│   ├── channelEngine.js        # Logic grid/gap analysis
│   ├── bandView.js             # Renderer pita horizontal
│   ├── detailPage.js           # Halaman detail stasiun + Leaflet map
│   ├── interferenceView.js     # Panel analisis interferensi
│   ├── style.css               # Design tokens global
│   ├── data/
│   │   └── stations.json       # Data stasiun FM Yogyakarta (fallback)
│   └── components/
│       ├── header.css
│       ├── stats.css
│       ├── grid.css
│       ├── band.css
│       ├── province.css
│       └── detail-page.css
│
└── api/                        # Backend PHP
    ├── index.php               # Router API (7 endpoint)
    ├── .htaccess               # URL rewrite Apache
    ├── schema.sql              # Skema MySQL + seed provinsi
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

## Setup lokal (VS Code)

### Prasyarat
- Node.js ≥ 18
- PHP ≥ 8.1 + MySQL (opsional, bisa tanpa backend)
- Git

### 1. Clone dan install

```bash
git clone https://github.com/<username>/<repo>.git
cd isr-fm-spectrum
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

# Import data dari isr.sql
mysql -u root -p isr_db < /path/to/isr.sql

# Konfigurasi
cp .env.example .env.local
# Edit .env.local:
# VITE_API_URL=http://localhost/isr-api/api

# Salin folder api/ ke web root PHP, misal:
cp -r api/ /var/www/html/isr-api/

npm run dev
```

### 4. VS Code extensions yang disarankan

Install via VS Code → Extensions:
- **ESLint** (`dbaeumer.vscode-eslint`)
- **PHP Intelephense** (`bmewburn.vscode-intelephense-client`)
- **GitLens** (`eamodio.gitlens`)
- **Vite** (`antfu.vite`)

---

## Deploy ke Hostinger via GitHub

### A. Siapkan repo GitHub

```bash
git init
git add .
git commit -m "feat: ISR FM Spectrum v3"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

### B. Deploy frontend ke GitHub Pages

1. Di GitHub: **Settings → Pages → Source → GitHub Actions**
2. Workflow `.github/workflows/deploy.yml` sudah siap — setiap push ke `main` otomatis build dan deploy
3. Jika pakai custom domain Hostinger:
   - Di GitHub Pages: tambahkan custom domain (`spectrum.namadomain.com`)
   - Di Hostinger DNS: tambahkan CNAME `spectrum` → `<username>.github.io`

### C. Deploy backend PHP ke Hostinger

1. Login ke **Hostinger hPanel → File Manager** atau pakai FTP/SSH
2. Upload folder `api/` ke `public_html/api/` (atau subfolder sesuai struktur kamu)
3. Buat database MySQL di hPanel → **Databases → MySQL Databases**
4. Import skema:
   ```bash
   # Via phpMyAdmin di hPanel, atau SSH:
   mysql -u user_db -p nama_db < api/schema.sql
   ```
5. Import data ISR:
   ```bash
   mysql -u user_db -p nama_db < isr.sql
   ```
6. Set environment variables — buat file `api/.env` atau edit langsung `api/src/config.php`:
   ```php
   'db' => [
       'host' => 'localhost',
       'name' => 'u123456_isr_db',   // nama DB dari hPanel
       'user' => 'u123456_user',      // user DB dari hPanel
       'pass' => 'password_db',
   ]
   ```
7. Pastikan folder `api/cache/` bisa ditulis:
   ```bash
   chmod 755 api/cache/
   ```

### D. Hubungkan frontend ke backend Hostinger

```bash
# Edit .env.local (tidak di-commit ke git)
echo "VITE_API_URL=https://namadomain.com/api" > .env.local

# Build ulang
npm run build

# Upload dist/ ke GitHub → Pages otomatis update via Actions
git add dist/ && git commit -m "build: update" && git push
# atau biarkan Actions yang build otomatis dari source
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
# Slot kosong DIY dengan minimal 2 kanal berurutan
curl "https://api.namadomain.com/slots?province=DAERAH+ISTIMEWA+YOGYAKARTA&min_count=2"

# Detail stasiun 106.1 MHz
curl "https://api.namadomain.com/stations/106.1"

# Interferensi Sleman
curl "https://api.namadomain.com/interference?city=SLEMAN"
```

---

## Update data

Jika ada update file `isr.sql` dari Balmon:

```bash
# Drop dan reimport
mysql -u root -p isr_db -e "TRUNCATE TABLE isr_stations;"
mysql -u root -p isr_db < isr_baru.sql

# Bust cache API
rm -f api/cache/*.cache
```

Untuk update `stations.json` (fallback offline), jalankan script ekstraksi:

```bash
python3 scripts/extract_stations.py  # lihat folder scripts/
```

---

## Catatan model interferensi

Analisis interferensi menggunakan model **free-space path loss** berbasis ITU-R BS.412:

- **Co-channel**: protection ratio minimum 30 dB
- **Adjacent ±200 kHz**: protection ratio minimum 20 dB
- **2nd Adjacent ±400 kHz**: protection ratio minimum 10 dB
- Radius evaluasi: 150 km per pasangan stasiun
- **Prasyarat**: kolom `latitude` dan `longitude` di tabel `isr_stations` harus terisi
hehehe
Model ini adalah aproksimasi — untuk analisis resmi gunakan software propagasi ITU-R P.1546 atau SEAMCAT.
