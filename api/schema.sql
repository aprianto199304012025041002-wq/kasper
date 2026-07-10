-- schema.sql
-- Skema tabel ISR untuk import dari isr.sql
-- Sesuaikan dengan struktur database asli kamu jika sudah ada.

CREATE DATABASE IF NOT EXISTS isr_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE isr_db;

CREATE TABLE IF NOT EXISTS isr_stations (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    no_simf         VARCHAR(50)  DEFAULT NULL COMMENT 'Nomor surat izin',
    lic_status      VARCHAR(20)  DEFAULT NULL COMMENT 'Granted / Cancelled / Expired',
    lic_expiry      VARCHAR(20)  DEFAULT NULL COMMENT 'Tanggal berakhir izin',
    clnt_name       VARCHAR(255) NOT NULL     COMMENT 'Nama penyelenggara / pemegang izin',
    stn_name        VARCHAR(255) DEFAULT NULL COMMENT 'Nama stasiun pemancar',
    service         VARCHAR(100) DEFAULT NULL COMMENT 'Misal: Broadcast, Land Mobile, Fixed',
    subservice      VARCHAR(100) DEFAULT NULL COMMENT 'Misal: FM, AM, LTE, GSM',
    stn_type        VARCHAR(50)  DEFAULT NULL COMMENT 'Transmitter / Base Station / dll',
    freq            DECIMAL(12,6) NOT NULL    COMMENT 'Frekuensi center (MHz)',
    bwidth          DECIMAL(12,3) DEFAULT 0   COMMENT 'Bandwidth (kHz)',
    erp_pwr_dbm     DECIMAL(8,2)  DEFAULT 0   COMMENT 'Effective Radiated Power (dBm)',
    province        VARCHAR(100) DEFAULT NULL,
    city            VARCHAR(100) DEFAULT NULL COMMENT 'Kabupaten / Kota',
    district        VARCHAR(100) DEFAULT NULL COMMENT 'Kecamatan',
    latitude        DECIMAL(10,6) DEFAULT NULL,
    longitude       DECIMAL(10,6) DEFAULT NULL,
    tower_height_m  DECIMAL(8,2)  DEFAULT NULL COMMENT 'Tinggi antena (m)',
    antenna_gain    DECIMAL(8,2)  DEFAULT NULL COMMENT 'Gain antena (dBd)',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_freq         (freq),
    INDEX idx_service      (service, subservice),
    INDEX idx_province     (province),
    INDEX idx_city         (city),
    INDEX idx_lic_status   (lic_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Data Izin Stasiun Radio (ISR) — Balmon';

-- Contoh insert (sesuaikan dengan parser isr.sql kamu):
-- INSERT INTO isr_stations (no_simf, lic_status, clnt_name, stn_name, service, subservice,
--   stn_type, freq, bwidth, erp_pwr_dbm, province, city, district)
-- VALUES ('123/FM/2023', 'Granted', 'RADIO GERONIMO, PT.', 'Geronimo FM',
--         'Broadcast', 'FM', 'Transmitter', 106.1, 200, 65.4,
--         'DAERAH ISTIMEWA YOGYAKARTA', 'KOTA YOGYAKARTA', 'GONDOKUSUMAN');
