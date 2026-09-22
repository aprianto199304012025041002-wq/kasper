// engine/interference.js
// Hitung pasangan interferensi antar stasiun FM.
// Model: ITU-R BS.412 — D/U ratio (free-space path loss)
//
// Threshold D/U minimum:
//   Co-channel   |Δf| < 0.095 MHz  → 30 dB
//   Adjacent ±1  |Δf| < 0.195 MHz  → 20 dB
//   Adjacent ±2  |Δf| < 0.295 MHz  → 10 dB
//
// Distance cutoff (ITU-R FM planning):
//   Co-channel   150 km
//   Adjacent ±1   60 km
//   Adjacent ±2   30 km
//
// Level: critical (margin < -10 dB), warning (< 0), ok (≥ 0, jarak ≤ 10 km)

import { haversineKm } from '../utils.js';

const THRESHOLD = { co_channel: 30, adjacent_1: 20, adjacent_2: 10 };
const DIST_CUT  = { co_channel: 150, adjacent_1: 60, adjacent_2: 30 };
const ERP_FALLBACK = 40; // dBm (~10 W) untuk stasiun tanpa data ERP

export function computeInterference(stations) {
  // Normalkan data, filter yang punya koordinat valid
  const valid = stations
    .filter(s => {
      const lat = parseFloat(s.latitude);
      const lon = parseFloat(s.longitude);
      return lat && lon && !isNaN(lat) && !isNaN(lon);
    })
    .map(s => ({
      ...s,
      freq:    parseFloat(s.freq),
      lat:     parseFloat(s.latitude),
      lon:     parseFloat(s.longitude),
      erp_dbm: parseFloat(s.erp_dbm) || ERP_FALLBACK,
    }));

  const pairs   = [];
  const summary = { co_channel: 0, adjacent_1: 0, adjacent_2: 0, ok: 0 };

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a  = valid[i];
      const b  = valid[j];
      const df = Math.abs(a.freq - b.freq);

      // Tentukan tipe interferensi
      let type;
      if      (df < 0.095) type = 'co_channel';
      else if (df < 0.195) type = 'adjacent_1';
      else if (df < 0.295) type = 'adjacent_2';
      else continue; // tidak relevan

      // Cek jarak
      const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (distKm > DIST_CUT[type]) continue;

      // Evaluasi dari sisi korban (stasiun dengan ERP lebih kecil)
      // Path loss sama dua arah → cancel. D/U = ERP_korban − ERP_interferor
      const [victim, interferer] = a.erp_dbm <= b.erp_dbm ? [a, b] : [b, a];
      const du_actual = Math.round((victim.erp_dbm - interferer.erp_dbm) * 10) / 10;
      const margin_db = Math.round((du_actual - THRESHOLD[type]) * 10) / 10;

      const level = margin_db < -10 ? 'critical'
                  : margin_db <   0 ? 'warning'
                  : 'ok';

      // Simpan critical+warning selalu; ok hanya jika sangat dekat (co-located)
      if (level !== 'ok' || distKm <= 10) {
        pairs.push({
          type,
          level,
          dist_km:   Math.round(distKm * 10) / 10,
          margin_db,
          du_actual,
          tx: {
            stn_name:          interferer.stn_name,
            freq:              interferer.freq,
            wilayah_layanan:   interferer.wilayah_layanan || interferer.kota,
            _wilayah_resolved: interferer._wilayah_resolved,
            erp_dbm:           interferer.erp_dbm,
          },
          rx: {
            stn_name:          victim.stn_name,
            freq:              victim.freq,
            wilayah_layanan:   victim.wilayah_layanan || victim.kota,
            _wilayah_resolved: victim._wilayah_resolved,
            erp_dbm:           victim.erp_dbm,
          },
        });

        if (level !== 'ok') summary[type] = (summary[type] || 0) + 1;
        else summary.ok++;
      }
    }
  }

  // Sort: critical → warning → ok; dalam grup sort by margin asc (paling parah duluan)
  pairs.sort((a, b) => {
    const rank = { critical: 0, warning: 1, ok: 2 };
    return (rank[a.level] - rank[b.level]) || (a.margin_db - b.margin_db);
  });

  return {
    pairs,
    summary,
    stations_evaluated: valid.length,
    model: 'ITU-R BS.412 (free-space PL, D/U sisi korban)',
  };
}
