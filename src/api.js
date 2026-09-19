// api.js — semua komunikasi ke backend PHP
// Satu tempat untuk semua fetch: mudah diganti endpoint atau ditambah caching.

import { computeChannelMap } from './engine/channel.js';

const BASE = 'https://kasper.balmonjogja.info/api';
const TIMEOUT_MS = 30000;

/** Fetch dengan timeout via AbortController */
function request(url) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    .finally(() => clearTimeout(tid));
}

/**
 * GET /api/stations
 * Return: { stations, total, summary, channel_map }
 */
export async function fetchStations() {
  const url = `${BASE}/stations?_t=${Date.now()}`;
  const res = await request(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const raw = await res.json();
  const stations = (raw.stations || []).map(s => ({
    ...s,
    freq: parseFloat(s.freq),
  }));

  // Tambah channel_map global (semua wilayah) untuk stats header
  const channel_map = computeChannelMap(stations);

  return { ...raw, stations, channel_map };
}

/**
 * GET /api/stations/:freq
 * Return: { data, neighbors }
 */
export async function fetchStationDetail(freq) {
  const res = await request(`${BASE}/stations/${freq}`);
  if (!res.ok) throw new Error(`Stasiun ${freq} tidak ditemukan`);
  return res.json();
}

/**
 * GET /api/health
 * Return: { status, total_fm, expired, time, db_ms }
 */
export async function fetchHealth() {
  const res = await request(`${BASE}/health`);
  if (!res.ok) throw new Error(`Health check gagal: ${res.status}`);
  return res.json();
}
