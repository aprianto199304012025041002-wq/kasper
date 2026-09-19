// engine/channel.js
// Komputasi grid kanal FM Indonesia (87.5–108.0 MHz, 100 kHz step = 206 slot)
// Aturan proteksi ITU-R BS.412:
//   Co-channel   |Δf| ≤ 0.055 MHz → type: 'used'
//   Adjacent ±1  |Δf| ≈ 0.1 MHz   → type: 'adjacent_1'
//   Adjacent ±2  |Δf| ≈ 0.2 MHz   → type: 'adjacent_2'
//   Selain itu                     → type: 'free'

import { getAllotmentByFreq, getAllottedFreqs } from '../data/allotment.js';

export const FM_MIN          = 87.5;
export const FM_MAX          = 108.0;
export const CHANNEL_SPACING = 0.1;
export const ADJACENT_GUARD  = 0.055;

/** Bangun array semua frekuensi kanal FM (206 nilai) */
export function buildChannelGrid() {
  const steps    = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  const channels = [];
  for (let i = 0; i <= steps; i++)
    channels.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  return channels;
}

/**
 * Tentukan status satu kanal terhadap daftar stasiun.
 * Single-pass O(n) — lebih cepat dari filter berulang.
 */
export function getChannelStatus(ch, stations) {
  let used = null;
  let adj1L = null, adj1R = null;
  let adj2L = null, adj2R = null;

  for (const s of stations) {
    const diff = Math.abs(s.freq - ch);
    if (diff <= ADJACENT_GUARD) { used = s; break; }

    const side = s.freq < ch ? 'L' : 'R';
    if (diff <= CHANNEL_SPACING + ADJACENT_GUARD) {
      if (side === 'L') adj1L = adj1L || s; else adj1R = adj1R || s;
    } else if (diff <= 2 * CHANNEL_SPACING + ADJACENT_GUARD) {
      if (side === 'L') adj2L = adj2L || s; else adj2R = adj2R || s;
    }
  }

  if (used) return { type: 'used', station: used };

  const hasAdj1 = adj1L || adj1R;
  const hasAdj2 = adj2L || adj2R;

  if (hasAdj1 || hasAdj2) {
    return {
      type: hasAdj1 ? 'adjacent_1' : 'adjacent_2',
      adj1_left:  adj1L || null,
      adj1_right: adj1R || null,
      adj2_left:  adj2L || null,
      adj2_right: adj2R || null,
      adj_left:   adj1L || adj2L || null,
      adj_right:  adj1R || adj2R || null,
    };
  }

  return { type: 'free' };
}

/**
 * Channel map tanpa allotment (untuk stats global / semua wilayah)
 */
export function computeChannelMap(stations) {
  return buildChannelGrid().map(ch => ({
    freq:  ch,
    lower: Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100,
    upper: Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100,
    ...getChannelStatus(ch, stations),
  }));
}

/**
 * Channel map per wilayah layanan, lengkap dengan allotment status (KM 570/2025).
 * allotment_status:
 *   'allotted_rri' — dijatahkan untuk LPP RRI
 *   'allotted_lps' — dijatahkan untuk LPS/LPP Lokal
 *   'not_allotted' — wilayah ini punya allotment tapi kanal ini tidak dijatahkan
 *   null           — wilayah komunitas / tidak ada data allotment
 */
export function computeChannelMapForWilayah(stations, wilayah) {
  const allottedFreqs = getAllottedFreqs(wilayah);
  const hasAllotment  = allottedFreqs.length > 0;

  return buildChannelGrid().map(ch => {
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
      freq:  ch,
      lower: Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100,
      upper: Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100,
      allotment_status,
      ...status,
    };
  });
}

/**
 * Ringkasan statistik dari channel map
 */
export function summarizeChannels(channelMap) {
  const total = channelMap.length;
  const used  = channelMap.filter(c => c.type === 'used').length;
  const adj   = channelMap.filter(c => c.type === 'adjacent_1' || c.type === 'adjacent_2').length;
  const free  = channelMap.filter(c => c.type === 'free').length;
  const exp   = channelMap.filter(c => c.type === 'used' && c.station && isExpiredStation(c.station)).length;
  return { total, used, adj, free, exp };
}

function isExpiredStation(s) {
  if (!s?.validity) return false;
  const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
  const m = String(s.validity).match(/(\d{2})-([A-Z]{3})-(\d{2,4})/);
  if (!m) return false;
  const yr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return new Date(yr, months[m[2]] ?? 0, +m[1]).getTime() < Date.now();
}
