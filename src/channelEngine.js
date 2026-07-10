// src/channelEngine.js
export const FM_MIN = 87.5, FM_MAX = 108.0, CHANNEL_SPACING = 0.2, ADJACENT_GUARD = 0.15;

export function buildChannelGrid() {
  const channels = [], steps = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  for (let i = 0; i <= steps; i++) channels.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  return channels;
}

export function getChannelStatus(ch, stations) {
  const used = stations.find((s) => Math.abs(s.freq - ch) < ADJACENT_GUARD);
  if (used) return { type: 'used', station: used };
  const adjLeft  = stations.find((s) => Math.abs(s.freq - (ch - CHANNEL_SPACING)) < ADJACENT_GUARD);
  const adjRight = stations.find((s) => Math.abs(s.freq - (ch + CHANNEL_SPACING)) < ADJACENT_GUARD);
  if (adjLeft || adjRight) return { type: 'adjacent', adjLeft, adjRight };
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
  const used = channelMap.filter((c) => c.type === 'used').length;
  const adjacent = channelMap.filter((c) => c.type === 'adjacent').length;
  const free = channelMap.filter((c) => c.type === 'free').length;
  return { total, used, adjacent, free, pct_used: total ? +(used/total*100).toFixed(1) : 0, pct_free: total ? +(free/total*100).toFixed(1) : 0 };
}

export function rateSlot(count) {
  if (count >= 4) return { label: 'Prioritas tinggi', level: 'high' };
  if (count >= 2) return { label: 'Layak dipertimbangkan', level: 'medium' };
  return { label: 'Marginal', level: 'low' };
}
