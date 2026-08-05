// src/channelEngine.js
// Aturan proteksi kanal FM (ITU-R BS.412 / PPDR FM):
//   Co-channel   : |Δf| < 0.1 MHz  → used        (30 dB separation required)
//   1st adjacent : |Δf| ≈ 0.2 MHz  → adjacent_1  (20 dB separation required)
//   2nd adjacent : |Δf| ≈ 0.4 MHz  → adjacent_2  (10 dB separation required)
//   > 0.4 MHz    : free
export const FM_MIN = 87.5, FM_MAX = 108.0, CHANNEL_SPACING = 0.2, ADJACENT_GUARD = 0.09;

export function buildChannelGrid() {
  const channels = [], steps = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  for (let i = 0; i <= steps; i++) channels.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  return channels;
}

export function getChannelStatus(ch, stations) {
  // Co-channel
  const used = stations.find((s) => Math.abs(s.freq - ch) < ADJACENT_GUARD);
  if (used) return { type: 'used', station: used };

  // 1st adjacent (±0.2 MHz)
  const adj1L = stations.find((s) => Math.abs(s.freq - (ch - CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adj1R = stations.find((s) => Math.abs(s.freq - (ch + CHANNEL_SPACING)) < ADJACENT_GUARD);
  if (adj1L || adj1R) return { type: 'adjacent_1', adj_left: adj1L, adj_right: adj1R };

  // 2nd adjacent (±0.4 MHz)
  const adj2L = stations.find((s) => Math.abs(s.freq - (ch - 2 * CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adj2R = stations.find((s) => Math.abs(s.freq - (ch + 2 * CHANNEL_SPACING)) < ADJACENT_GUARD);
  if (adj2L || adj2R) return { type: 'adjacent_2', adj_left: adj2L, adj_right: adj2R };

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

export function findFreeBlocks(channelMap) {
  const freeFreqs = channelMap.filter((c) => c.type === 'free').map((c) => c.freq);
  const blocks = [];
  let i = 0;
  while (i < freeFreqs.length) {
    let j = i;
    while (j < freeFreqs.length - 1 && Math.round((freeFreqs[j + 1] - freeFreqs[j]) * 10) / 10 === CHANNEL_SPACING) j++;
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
