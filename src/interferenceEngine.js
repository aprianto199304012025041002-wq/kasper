// src/interferenceEngine.js
// Hitung pasangan interferensi dari daftar stasiun berkoordinat
// Model: ITU-R BS.412 — D/U ratio protection
//
// Threshold D/U minimum:
//   Co-channel   (|Δf| < 0.1 MHz)  : 30 dB
//   Adjacent ±1  (|Δf| ≈ 0.1 MHz)  : 20 dB
//   Adjacent ±2  (|Δf| ≈ 0.2 MHz)  : 10 dB
//
// Propagasi: free-space path loss = 20·log10(d_km) + 20·log10(f_mhz) + 32.45 dB
//
// D/U dihitung dua arah (simetris):
//   Arah A→B: desired = ERP_A − PL(d,f), undesired = ERP_B − PL(d,f)
//             D/U = ERP_A − ERP_B  (path loss cancel karena sama)
//   Arah B→A: D/U = ERP_B − ERP_A
//   Worst-case (yang menentukan apakah ada interferensi) = min(D/U_AB, D/U_BA)
//   = −|ERP_A − ERP_B|  ... selalu ≤ 0 untuk stasiun berdaya berbeda
//
// Lebih berguna: evaluasi dari sisi stasiun yang lebih lemah sebagai "korban"
//   Korban = stasiun dengan ERP lebih kecil
//   D/U_korban = ERP_korban − ERP_interferor   (negatif jika interferor lebih kuat)
//   margin    = D/U_korban − threshold
//
// ERP fallback: 40 dBm (10 W) — representatif untuk FM komunitas/lokal kecil

const CO_THRESHOLD   = 30; // dB
const ADJ1_THRESHOLD = 20;
const ADJ2_THRESHOLD = 10;
const CO_FREQ_MAX    = 0.095; // |Δf| < ini → co-channel
const ADJ1_FREQ_MAX  = 0.195; // |Δf| < ini → adjacent-1
const ERP_FALLBACK   = 40;    // dBm — ~10 W, representatif FM komunitas/lokal

function pathLoss(distKm, freqMhz) {
  if (distKm <= 0) return 0;
  return 20 * Math.log10(distKm) + 20 * Math.log10(freqMhz) + 32.45;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function computeInterference(stations) {
  // Hanya stasiun dengan koordinat valid
  const valid = stations.filter(s => {
    const lat = parseFloat(s.latitude), lon = parseFloat(s.longitude);
    return lat && lon && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
  }).map(s => ({
    ...s,
    freq:    parseFloat(s.freq),
    lat:     parseFloat(s.latitude),
    lon:     parseFloat(s.longitude),
    erp_dbm: parseFloat(s.erp_dbm) || ERP_FALLBACK,
  }));

  const pairs = [];
  const summary = { co_channel: 0, adjacent_1: 0, adjacent_2: 0, ok: 0 };

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j];
      const df = Math.abs(a.freq - b.freq);

      let type, threshold;
      if      (df < CO_FREQ_MAX)   { type = 'co_channel'; threshold = CO_THRESHOLD; }
      else if (df < ADJ1_FREQ_MAX) { type = 'adjacent_1'; threshold = ADJ1_THRESHOLD; }
      else if (df < 0.295)         { type = 'adjacent_2'; threshold = ADJ2_THRESHOLD; }
      else continue; // tidak relevan

      const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (distKm > 300) continue; // terlalu jauh, tidak signifikan

      // Evaluasi dari sisi stasiun yang lebih lemah sebagai "korban"
      // Path loss sama untuk kedua arah (jarak & frekuensi identik), sehingga cancel.
      // D/U = ERP_korban − ERP_interferor  (dB)
      const freqMid = (a.freq + b.freq) / 2;
      const pl      = pathLoss(distKm, freqMid); // sama dua arah → hanya untuk future use

      // Korban = yang ERP-nya lebih kecil (paling rentan terinterferensi)
      const [victim, interferer] = a.erp_dbm <= b.erp_dbm ? [a, b] : [b, a];
      const du_actual  = Math.round((victim.erp_dbm - interferer.erp_dbm) * 10) / 10;
      const margin_db  = Math.round((du_actual - threshold) * 10) / 10;

      const level = margin_db < -10 ? 'critical'
                  : margin_db < 0   ? 'warning'
                  : 'ok';

      if (level === 'critical' || level === 'warning' || distKm < 50) {
        pairs.push({
          tx: {
            stn_name: interferer.stn_name,
            freq: interferer.freq,
            wilayah_layanan: interferer.wilayah_layanan || interferer.kota,
            erp_dbm: interferer.erp_dbm,
          },
          rx: {
            stn_name: victim.stn_name,
            freq: victim.freq,
            wilayah_layanan: victim.wilayah_layanan || victim.kota,
            erp_dbm: victim.erp_dbm,
          },
          type,
          dist_km:   Math.round(distKm * 10) / 10,
          pr_actual: du_actual,  // D/U aktual di sisi korban (dB)
          margin_db,
          level,
          pl_db: Math.round(pl * 10) / 10, // tersedia untuk debug
        });
        if (level !== 'ok') summary[type] = (summary[type] || 0) + 1;
        else summary.ok++;
      }
    }
  }

  // Sort: critical dulu, lalu warning, lalu ok; dalam grup sort by margin asc
  pairs.sort((a, b) => {
    const rank = { critical: 0, warning: 1, ok: 2 };
    return (rank[a.level] - rank[b.level]) || (a.margin_db - b.margin_db);
  });

  return {
    pairs,
    summary,
    stations_evaluated: valid.length,
    model: 'ITU-R BS.412 (free-space PL, worst-case D/U sisi korban)',
  };
}
