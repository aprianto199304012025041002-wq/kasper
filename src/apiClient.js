// src/apiClient.js — langsung ke API, tanpa fallback sama sekali
import { computeChannelMap } from './channelEngine.js';

const API_BASE = 'https://kasper.balmonjogja.info/api';
const FETCH_TIMEOUT_MS = 15000;

// AbortController manual — kompatibel semua browser (AbortSignal.timeout tidak support Safari lama)
function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(new Error(`Timeout ${ms}ms`)), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

export async function fetchSpectrum(filters = {}) {
  const url = new URL(`${API_BASE}/stations`);
  Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const r = await fetchWithTimeout(url.toString());
  if (!r.ok) throw new Error(`API error ${r.status}`);
  const raw = await r.json();
  const stations = (raw.stations || []).map(s => ({ ...s, freq: parseFloat(s.freq) }));
  const channel_map = computeChannelMap(stations);
  return { ...raw, stations, channel_map };
}

export async function fetchStationDetail(freq) {
  const r = await fetchWithTimeout(`${API_BASE}/stations/${freq}`);
  if (!r.ok) throw new Error(`Stasiun ${freq} tidak ditemukan`);
  return r.json();
}

export async function fetchInterference(filters = {}) {
  const url = new URL(`${API_BASE}/interference`);
  Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const r = await fetchWithTimeout(url.toString());
  if (!r.ok) throw new Error(`Interference API error ${r.status}`);
  return r.json();
}
