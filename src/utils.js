// utils.js — helper functions yang dipakai di mana-mana

const MONTHS = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
const BULAN  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

/** Escape HTML */
export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Parse validity date "DD-MMM-YY" atau "DD-MMM-YYYY" → timestamp ms
 * Return 0 jika tidak valid
 */
export function parseValidity(v) {
  if (!v) return 0;
  const m = String(v).match(/(\d{2})-([A-Z]{3})-(\d{2,4})/);
  if (!m) return 0;
  const yr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return new Date(yr, MONTHS[m[2]] ?? 0, +m[1]).getTime();
}

/** Apakah izin sudah expired? */
export function isExpired(station) {
  if (!station?.validity) return false;
  return parseValidity(station.validity) < Date.now();
}

/** Format timestamp → "31 Jan 2027" */
export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Konversi dBm → string Watt: "12.50 W" / "1.25 kW" / "125.0 mW" */
export function dbmToWatt(dbm) {
  const w = Math.pow(10, (parseFloat(dbm) - 30) / 10);
  if (w >= 1000) return (w / 1000).toFixed(2) + ' kW';
  if (w >= 1)    return w.toFixed(2) + ' W';
  return (w * 1000).toFixed(1) + ' mW';
}

/** Haversine distance antara dua titik (km) */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*r) * Math.cos(lat2*r) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Pendekkan nama wilayah untuk tampilan sidebar */
export function shortWilayah(w) {
  return w
    .replace(/^(KOTA |KABUPATEN )/i, '')
    .replace(/, /g, ' – ')
    .split(' ').map(word =>
      word.length > 4 ? word[0] + word.slice(1).toLowerCase() : word
    ).join(' ');
}

/** Label jenis penyiaran */
export const JENIS_LABEL = {
  swasta:       'Swasta',
  publik:       'Publik (RRI)',
  publik_lokal: 'Publik Lokal (LPPL)',
  komunitas:    'Komunitas',
};
