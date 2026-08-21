// src/apiClient.js — langsung ke API, tanpa fallback/health check
import fallbackStations from './data/stations.json';
import { computeChannelMap, summarize } from './channelEngine.js';

const API_BASE = 'https://kasper.balmonjogja.info/api';
const FETCH_TIMEOUT_MS = 15000;

let _usedFallback = false;

function buildLocalResponse(filters = {}) {
  _usedFallback = true;
  let stations = [...fallbackStations];
  if (filters.city)   stations = stations.filter(s => (s.wilayah_layanan||s.kota||s.city) === filters.city);
  if (filters.search) {
    const t = filters.search.toLowerCase();
    stations = stations.filter(s =>
      s.stn_name.toLowerCase().includes(t) ||
      s.clnt_name.toLowerCase().includes(t) ||
      String(s.freq).includes(t)
    );
  }
  const norm       = stations.map(s => ({ ...s, lower_mhz: s.lower ?? s.lower_mhz, upper_mhz: s.upper ?? s.upper_mhz }));
  const channelMap = computeChannelMap(norm);
  return {
    summary: summarize(channelMap), stations: norm,
    channel_map: channelMap, _source: 'local',
    meta: { fm_min:87.5, fm_max:108.0, channel_spacing:0.1, generated_at: new Date().toISOString() },
  };
}

export async function fetchSpectrum(filters = {}) {
  _usedFallback = false;
  try {
    const url = new URL(`${API_BASE}/stations`);
    Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`API error ${r.status}`);
    const raw = await r.json();
    const stations = (raw.stations || []).map(s => ({ ...s, freq: parseFloat(s.freq) }));
    const channelMap = (raw.channel_map?.length > 0) ? raw.channel_map : computeChannelMap(stations);
    return { ...raw, stations, channel_map: channelMap, summary: raw.summary || summarize(channelMap), free_blocks: raw.free_blocks || [] };
  } catch (e) {
    console.warn('API tidak tersedia, pakai data lokal:', e.message);
    return buildLocalResponse(filters);
  }
}

export async function fetchStationDetail(freq) {
  try {
    const r = await fetch(`${API_BASE}/stations/${freq}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`Stasiun ${freq} tidak ditemukan`);
    return r.json();
  } catch {
    const s = fallbackStations.find(x => Math.abs(x.freq - freq) < 0.05);
    if (!s) throw new Error('Stasiun tidak ditemukan');
    const neighbors = fallbackStations
      .filter(x => Math.abs(x.freq - freq) >= 0.05 && Math.abs(x.freq - freq) <= 2.0)
      .sort((a, b) => Math.abs(a.freq - freq) - Math.abs(b.freq - freq))
      .map(x => ({ ...x, wilayah_layanan: x.wilayah_layanan||x.kota||x.city, kota: x.kota||x.city, freq_distance: Math.abs(x.freq-freq) }));
    return { data: { ...s, wilayah_layanan: s.wilayah_layanan||s.kota||s.city, kota: s.kota||s.city }, neighbors };
  }
}

export async function fetchInterference(filters = {}) {
  try {
    const url = new URL(`${API_BASE}/interference`);
    Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return r.json();
  } catch {
    return {
      pairs: [], summary: { co_channel:0, adjacent_1:0, adjacent_2:0, clean:0 },
      stations_evaluated: 0,
      message: 'Analisis interferensi memerlukan koneksi API.',
      model: 'N/A', _source: 'local',
    };
  }
}

export const isUsingFallback = () => _usedFallback;
