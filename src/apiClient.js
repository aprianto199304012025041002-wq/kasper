// src/apiClient.js v3 — tambah fetchProvinces, fetchDetail, fetchInterference
import fallbackStations from './data/stations.json';
import { computeChannelMap, findFreeBlocks, summarize } from './channelEngine.js';

const API_BASE = import.meta.env.VITE_API_URL || '';
let _apiAvailable = null;

async function checkApi() {
  if (!API_BASE) return (_apiAvailable = false);
  if (_apiAvailable !== null) return _apiAvailable;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return (_apiAvailable = r.ok);
  } catch {
    return (_apiAvailable = false);
  }
}

async function apiFetch(endpoint, params = {}) {
  if (await checkApi()) {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json();
  }
  return buildLocalResponse(params);
}

function buildLocalResponse(filters = {}) {
  let stations = [...fallbackStations];
  if (filters.city)   stations = stations.filter((s) => (s.kota || s.city) === filters.city);
  if (filters.jenis)  stations = stations.filter((s) => s.jenis === filters.jenis);
  if (filters.search) {
    const t = filters.search.toLowerCase();
    stations = stations.filter((s) => s.stn_name.toLowerCase().includes(t) || s.clnt_name.toLowerCase().includes(t) || String(s.freq).includes(t));
  }
  const norm       = stations.map((s) => ({ ...s, lower_mhz: s.lower ?? s.lower_mhz, upper_mhz: s.upper ?? s.upper_mhz }));
  const channelMap = computeChannelMap(norm);
  return {
    summary: summarize(channelMap), stations: norm,
    channel_map: channelMap, free_blocks: findFreeBlocks(channelMap),
    _source: 'local',
    meta: { fm_min:87.5, fm_max:108.0, channel_spacing:0.2, generated_at: new Date().toISOString() },
  };
}

// Spektrum utama
export async function fetchSpectrum(filters = {}) { return apiFetch('/stations', filters); }

// Daftar provinsi
export async function fetchProvinces() {
  if (await checkApi()) {
    const r = await fetch(`${API_BASE}/provinces`);
    const d = await r.json();
    return d.provinces || [];
  }
  // Fallback: satu provinsi dari data lokal
  return [{ name: 'DAERAH ISTIMEWA YOGYAKARTA', code: 'DIY', total_fm: fallbackStations.length }];
}

// Detail satu stasiun
export async function fetchStationDetail(freq) {
  if (await checkApi()) {
    const r = await fetch(`${API_BASE}/stations/${freq}`);
    if (!r.ok) throw new Error(`Station ${freq} tidak ditemukan`);
    return r.json();
  }
  // Fallback: cari dari data lokal
  const s = fallbackStations.find((x) => Math.abs(x.freq - freq) < 0.05);
  if (!s) throw new Error('Stasiun tidak ditemukan di data lokal');
  const neighbors = fallbackStations
    .filter((x) => Math.abs(x.freq - freq) >= 0.05 && Math.abs(x.freq - freq) <= 2.0)
    .sort((a, b) => Math.abs(a.freq - freq) - Math.abs(b.freq - freq))
    .slice(0, 8)
    .map((x) => ({ ...x, kota: x.kota || x.city, freq_distance: Math.abs(x.freq - freq) }));
  return { data: { ...s, kota: s.kota || s.city }, neighbors };
}

// Analisis interferensi
export async function fetchInterference(filters = {}) {
  if (await checkApi()) {
    const url = new URL(`${API_BASE}/interference`);
    Object.entries(filters).forEach(([k, v]) => v && url.searchParams.set(k, v));
    const r = await fetch(url.toString());
    return r.json();
  }
  // Fallback: tidak bisa hitung interferensi tanpa koordinat GPS
  return {
    pairs: [], summary: { co_channel:0, adjacent_1:0, adjacent_2:0, clean:0 },
    stations_evaluated: 0,
    message: 'Analisis interferensi memerlukan koneksi ke API (koordinat GPS dari database).',
    model: 'N/A',
    _source: 'local',
  };
}

// Kota
export async function fetchCities(province = 'DAERAH ISTIMEWA YOGYAKARTA') {
  if (await checkApi()) {
    const r = await fetch(`${API_BASE}/cities?province=${encodeURIComponent(province)}`);
    const d = await r.json();
    return d.cities || [];
  }
  return [...new Set(fallbackStations.map((s) => s.kota || s.city))].filter(Boolean).sort();
}

export async function fetchHealth() {
  if (!API_BASE) return { status:'no_api', source:'local' };
  try { const r = await fetch(`${API_BASE}/health`, { signal:AbortSignal.timeout(3000) }); return r.json(); }
  catch { return { status:'error', source:'local' }; }
}

export const isUsingFallback = () => _apiAvailable === false || !API_BASE;
