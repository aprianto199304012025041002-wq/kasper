// src/apiClient.js — langsung ke API, tanpa fallback sama sekali
import { computeChannelMap, summarize } from './channelEngine.js';

const API_BASE = 'https://kasper.balmonjogja.info/api';
const FETCH_TIMEOUT_MS = 15000;

export async function fetchSpectrum(filters = {}) {
  const url = new URL(`${API_BASE}/stations`);
  Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  const raw = await r.json();
  const stations = (raw.stations || []).map(s => ({ ...s, freq: parseFloat(s.freq) }));
  const channelMap = (raw.channel_map?.length > 0) ? raw.channel_map : computeChannelMap(stations);
  return { ...raw, stations, channel_map: channelMap, summary: raw.summary || summarize(channelMap), free_blocks: raw.free_blocks || [] };
}

export async function fetchStationDetail(freq) {
  const r = await fetch(`${API_BASE}/stations/${freq}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`Stasiun ${freq} tidak ditemukan`);
  return r.json();
}

export async function fetchInterference(filters = {}) {
  const url = new URL(`${API_BASE}/interference`);
  Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`Interference API error ${r.status}`);
  return r.json();
}

export const isUsingFallback = () => false;
