// src/interferenceEngine.js
// Hitung pasangan interferensi dari daftar stasiun berkoordinat
// Model: ITU-R BS.412 — D/U ratio protection
//
// Threshold D/U minimum:
//   Co-channel   (|Δf| < 0.1 MHz)  : 30 dB
//   Adjacent ±1  (|Δf| ≈ 0.1 MHz)  : 20 dB
//   Adjacent ±2  (|Δf| ≈ 0.2 MHz)  : 10 dB
//
// Propagasi sederhana: path loss = 20*log10(d_km) + 20*log10(f_mhz) + 32.45 dB
// D/U = ERP_tx - PathLoss_tx_rx + (ERP_rx tidak diketahui → gunakan ERP_tx sebagai proxy)

const CO_THRESHOLD  = 30; // dB
const ADJ1_THRESHOLD = 20;
const ADJ2_THRESHOLD = 10;
const CO_FREQ_MAX   = 0.095; // |Δf| < ini → co-channel
const ADJ1_FREQ_MAX = 0.195; // |Δf| < ini → adjacent-1

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
    erp_dbm: parseFloat(s.erp_dbm) || 60,
  }));

  const pairs = [];
  const summary = { co_channel: 0, adjacent_1: 0, adjacent_2: 0, ok: 0 };

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const tx = valid[i], rx = valid[j];
      const df = Math.abs(tx.freq - rx.freq);

      let type, threshold;
      if      (df < CO_FREQ_MAX)   { type = 'co_channel';  threshold = CO_THRESHOLD; }
      else if (df < ADJ1_FREQ_MAX) { type = 'adjacent_1';  threshold = ADJ1_THRESHOLD; }
      else if (df < 0.295)         { type = 'adjacent_2';  threshold = ADJ2_THRESHOLD; }
      else continue; // tidak relevan

      const distKm = haversineKm(tx.lat, tx.lon, rx.lat, rx.lon);
      if (distKm > 300) continue; // terlalu jauh, tidak signifikan

      const pl    = pathLoss(distKm, (tx.freq + rx.freq) / 2);
      // D/U = ERP_tx - pathloss (sinyal desired = ERP_rx jika posisi dibalik)
      // Gunakan rata-rata ERP sebagai proxy receiver
      const erpD  = tx.erp_dbm;
      const erpU  = rx.erp_dbm;
      // D/U aktual di titik rx: ERP_tx - PL vs ERP_rx (received)
      // Simplified: pr_actual = ERP_tx - ERP_rx - PL (selisih diterima)
      const pr_actual = Math.round(erpD - pl - (erpU - pl));
      // Lebih tepat: margin = (ERP_tx - PL) - (ERP_rx - PL) + threshold = erpD - erpU + threshold
      // Tapi untuk evaluasi interferensi: pr = erpD - PL (sinyal dari tx ke rx)
      // undesired = erpU - PL (sinyal dari rx ke tx, asumsi sama)
      // ratio = pr_tx - pr_rx
      const pr_tx = erpD - pl;
      const pr_rx = erpU - pl;
      const du_actual = Math.round((pr_tx - pr_rx) * 10) / 10;
      const margin_db = Math.round((du_actual - threshold) * 10) / 10;

      const level = margin_db < -10 ? 'critical'
                  : margin_db < 0   ? 'warning'
                  : 'ok';

      if (level === 'critical' || level === 'warning' || distKm < 50) {
        pairs.push({
          tx: { stn_name: tx.stn_name, freq: tx.freq, wilayah_layanan: tx.wilayah_layanan || tx.kota, erp_dbm: tx.erp_dbm },
          rx: { stn_name: rx.stn_name, freq: rx.freq, wilayah_layanan: rx.wilayah_layanan || rx.kota, erp_dbm: rx.erp_dbm },
          type,
          dist_km: Math.round(distKm * 10) / 10,
          pr_actual: du_actual,
          margin_db,
          level,
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
    model: 'ITU-R BS.412 (simplified free-space path loss)',
  };
}
