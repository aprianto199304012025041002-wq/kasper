// src/channelEngine.js
// Mesin perhitungan kanal FM: menentukan kanal terpakai, adjacent-protected, dan kosong.

export const FM_MIN = 87.5;
export const FM_MAX = 108.0;
export const CHANNEL_SPACING = 0.2; // 200 kHz, sesuai Permenkominfo
export const ADJACENT_GUARD = 0.15; // toleransi pencocokan ke kanal (±150kHz)

/**
 * Bangun daftar kanal grid 200kHz dari 87.5 - 108.0 MHz
 */
export function buildChannelGrid() {
  const channels = [];
  const steps = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  for (let i = 0; i <= steps; i++) {
    channels.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  }
  return channels;
}

/**
 * Tentukan status sebuah kanal: 'used' | 'adjacent' | 'free'
 * @param {number} ch - frekuensi kanal (MHz)
 * @param {Array} stations - daftar objek stasiun { freq, ... }
 */
export function getChannelStatus(ch, stations) {
  const used = stations.find((s) => Math.abs(s.freq - ch) < ADJACENT_GUARD);
  if (used) return { type: 'used', station: used };

  const adjLeft = stations.find(
    (s) => Math.abs(s.freq - (ch - CHANNEL_SPACING)) < ADJACENT_GUARD
  );
  const adjRight = stations.find(
    (s) => Math.abs(s.freq - (ch + CHANNEL_SPACING)) < ADJACENT_GUARD
  );
  if (adjLeft || adjRight) {
    return { type: 'adjacent', adjLeft, adjRight };
  }

  return { type: 'free' };
}

/**
 * Hitung seluruh status kanal grid berdasar data stasiun
 */
export function computeChannelMap(stations) {
  const channels = buildChannelGrid();
  return channels.map((ch) => ({
    freq: ch,
    lower: Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100,
    upper: Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100,
    ...getChannelStatus(ch, stations),
  }));
}

/**
 * Cari blok-blok kanal kosong berurutan (gap analysis).
 * Mengembalikan daftar { start, end, count, center, lower, upper, widthKHz }
 */
export function findFreeBlocks(channelMap) {
  const freeChannels = channelMap.filter((c) => c.type === 'free').map((c) => c.freq);
  const blocks = [];
  let i = 0;
  while (i < freeChannels.length) {
    let j = i;
    while (
      j < freeChannels.length - 1 &&
      Math.round((freeChannels[j + 1] - freeChannels[j]) * 10) / 10 === CHANNEL_SPACING
    ) {
      j++;
    }
    const start = freeChannels[i];
    const end = freeChannels[j];
    const count = j - i + 1;
    const center = Math.round(((start + end) / 2) * 10) / 10;
    blocks.push({
      start,
      end,
      count,
      center,
      lower: Math.round((center - CHANNEL_SPACING / 2) * 100) / 100,
      upper: Math.round((center + CHANNEL_SPACING / 2) * 100) / 100,
      widthKHz: Math.round((end - start + CHANNEL_SPACING) * 1000),
    });
    i = j + 1;
  }
  return blocks;
}

/**
 * Beri skor prioritas slot kosong: tinggi (>=4 kanal), sedang (>=2), rendah (1)
 */
export function rateSlot(count) {
  if (count >= 4) return { label: 'Prioritas tinggi', level: 'high' };
  if (count >= 2) return { label: 'Layak dipertimbangkan', level: 'medium' };
  return { label: 'Marginal', level: 'low' };
}

/**
 * Ringkasan statistik
 */
export function summarize(channelMap) {
  const used = channelMap.filter((c) => c.type === 'used').length;
  const adjacent = channelMap.filter((c) => c.type === 'adjacent').length;
  const free = channelMap.filter((c) => c.type === 'free').length;
  return { total: channelMap.length, used, adjacent, free };
}
