// src/channelEngine.js
// Grid FM Indonesia: 100 kHz step (87.5–108.0 MHz), 206 slot
// Regulasi Indonesia (Permenkominfo) izinkan alokasi tiap 100 kHz,
// berbeda dari standar Eropa yang hanya 200 kHz.
//
// Aturan proteksi kanal (ITU-R BS.412):
//   Co-channel     : |Δf| < 0.055 MHz → used        (30 dB)
//   1st adjacent   : |Δf| ≈ 0.1 MHz   → adjacent_1  (20 dB)
//   2nd adjacent   : |Δf| ≈ 0.2 MHz   → adjacent_2  (10 dB)
//   > 0.2 MHz      : free
//
// allotment_status (per wilayah layanan, KM Komdigi 570/2025):
//   'allotted_rri' : kanal dijatahkan untuk LPP RRI
//   'allotted_lps' : kanal dijatahkan untuk LPS/LPP Lokal
//   'not_allotted' : kanal tidak dijatahkan di wilayah ini
//   null           : wilayah tidak diketahui / komunitas

import { getAllotmentByFreq, getAllottedFreqs } from './data/allotment.js';

export const FM_MIN = 87.5, FM_MAX = 108.0, CHANNEL_SPACING = 0.1, ADJACENT_GUARD = 0.055;

export function buildChannelGrid() {
  const channels = [], steps = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  for (let i = 0; i <= steps; i++)
    channels.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  return channels;
}

export function getChannelStatus(ch, stations) {
  // Co-channel
  const used = stations.find((s) => Math.abs(s.freq - ch) < ADJACENT_GUARD);
  if (used) return { type: 'used', station: used };

  // Cek semua kemungkinan adj dari kiri dan kanan
  const adj1L = stations.find((s) => Math.abs(s.freq - (ch - CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adj1R = stations.find((s) => Math.abs(s.freq - (ch + CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adj2L = stations.find((s) => Math.abs(s.freq - (ch - 2 * CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adj2R = stations.find((s) => Math.abs(s.freq - (ch + 2 * CHANNEL_SPACING)) < ADJACENT_GUARD);

  const hasAdj1 = adj1L || adj1R;
  const hasAdj2 = adj2L || adj2R;

  if (hasAdj1 || hasAdj2) {
    const type = hasAdj1 ? 'adjacent_1' : 'adjacent_2';
    return {
      type,
      adj1_left:  adj1L || null,
      adj1_right: adj1R || null,
      adj2_left:  adj2L || null,
      adj2_right: adj2R || null,
      adj_left:  adj1L || adj2L || null,
      adj_right: adj1R || adj2R || null,
    };
  }

  return { type: 'free' };
}

export function computeChannelMap(stations) {
  return buildChannelGrid().map((ch) => ({
    freq: ch,
    lower: Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100,
    upper: Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100,
    ...getChannelStatus(ch, stations),
  }));
}

// Compute channel map per wilayah layanan, dengan allotment status
export function computeChannelMapForWilayah(stations, wilayah) {
  const allottedFreqs = getAllottedFreqs(wilayah); // [] jika wilayah komunitas / tidak dikenal
  const hasAllotment = allottedFreqs.length > 0;

  return buildChannelGrid().map((ch) => {
    const status = getChannelStatus(ch, stations);
    let allotment_status = null;

    if (hasAllotment) {
      const f = Math.round(ch * 10) / 10;
      if (allottedFreqs.includes(f)) {
        const a = getAllotmentByFreq(wilayah, f);
        allotment_status = a?.slot === 'rri' ? 'allotted_rri' : 'allotted_lps';
      } else {
        allotment_status = 'not_allotted';
      }
    }

    return {
      freq: ch,
      lower: Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100,
      upper: Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100,
      allotment_status,
      ...status,
    };
  });
}

export function findFreeBlocks(channelMap) {
  const freeFreqs = channelMap.filter((c) => c.type === 'free').map((c) => c.freq);
  const blocks = [];
  let i = 0;
  while (i < freeFreqs.length) {
    let j = i;
    while (j < freeFreqs.length - 1 &&
      Math.round((freeFreqs[j + 1] - freeFreqs[j]) * 10) / 10 === CHANNEL_SPACING) j++;
    const start = freeFreqs[i], end = freeFreqs[j], count = j - i + 1;
    const center = Math.round(((start + end) / 2) * 10) / 10;
    blocks.push({
      start, end, count, center,
      lower: Math.round((center - CHANNEL_SPACING / 2) * 100) / 100,
      upper: Math.round((center + CHANNEL_SPACING / 2) * 100) / 100,
      widthKHz: Math.round((end - start + CHANNEL_SPACING) * 1000),
      priority: count >= 4 ? 'high' : count >= 2 ? 'medium' : 'low',
    });
    i = j + 1;
  }
  return blocks.sort((a, b) => b.count - a.count);
}

export function summarize(channelMap) {
  const total = channelMap.length;
  const used  = channelMap.filter((c) => c.type === 'used').length;
  const adj1  = channelMap.filter((c) => c.type === 'adjacent_1').length;
  const adj2  = channelMap.filter((c) => c.type === 'adjacent_2').length;
  const free  = channelMap.filter((c) => c.type === 'free').length;
  return { total, used, adjacent_1: adj1, adjacent_2: adj2, free,
    pct_used: total ? +(used/total*100).toFixed(1) : 0,
    pct_free: total ? +(free/total*100).toFixed(1) : 0 };
}

export function rateSlot(count) {
  if (count >= 4) return { label: 'Prioritas tinggi', level: 'high' };
  if (count >= 2) return { label: 'Layak dipertimbangkan', level: 'medium' };
  return { label: 'Marginal', level: 'low' };
}
