// src/apiClient.js — koneksi ke API Hostinger
import fallbackStations from './data/stations.json';
import { computeChannelMap, findFreeBlocks, summarize } from './channelEngine.js';

// URL API — langsung hardcode ke domain Hostinger
const API_BASE = 'https://kasper.balmonjogja.info/api';

let _apiAvailable = null;
let _apiCheckedAt = 0;
const API_CACHE_MS = 60_000; // re-check setelah 1 menit jika sebelumnya gagal
const FETCH_TIMEOUT_MS = 8000;

async function checkApi() {
  const now = Date.now();
  // Kalau sudah confirmed available di sesi ini, langsung pakai
  if (_apiAvailable === true) return true;
  // Kalau sebelumnya gagal, coba lagi setelah API_CACHE_MS
  if (_apiAvailable === false && now - _apiCheckedAt < API_CACHE_MS) return false;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    _apiCheckedAt = now;
    return (_apiAvailable = r.ok && d.status === 'ok');
  } catch {
    _apiCheckedAt = now;
    return (_apiAvailable = false);
  }
}

async function apiFetch(endpoint, params = {}) {
  const available = await checkApi();
  if (available) {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  }
  // Fallback ke data JSON lokal
  return buildLocalResponse(params);
}

function buildLocalResponse(filters = {}) {
  let stations = [...fallbackStations];
  if (filters.city)   stations = stations.filter((s) => (s.wilayah_layanan||s.kota||s.city) === filters.city);
  if (filters.jenis)  stations = stations.filter((s) => s.jenis === filters.jenis);
  if (filters.search) {
    const t = filters.search.toLowerCase();
    stations = stations.filter((s) =>
      s.stn_name.toLowerCase().includes(t) ||
      s.clnt_name.toLowerCase().includes(t) ||
      String(s.freq).includes(t)
    );
  }
  const norm       = stations.map((s) => ({ ...s, lower_mhz: s.lower ?? s.lower_mhz, upper_mhz: s.upper ?? s.upper_mhz }));
  const channelMap = computeChannelMap(norm);
  return {
    summary: summarize(channelMap), stations: norm,
    channel_map: channelMap, free_blocks: findFreeBlocks(channelMap),
    _source: 'local',
    meta: { fm_min:87.5, fm_max:108.0, channel_spacing:0.1, generated_at: new Date().toISOString() },
  };
}

export async function fetchSpectrum(filters = {}) {
  const available = await checkApi();
  if (available) {
    const url = new URL(`${API_BASE}/stations`);
    Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`API error ${r.status}`);
    const raw = await r.json();
    const stations = (raw.stations || []).map(s => ({
      ...s, freq: parseFloat(s.freq),
    }));
    // Pakai channel_map dari PHP — sudah punya adj1_left/adj1_right/adj2_left/adj2_right
    // Rebuild hanya kalau channel_map tidak ada (fallback)
    const channelMap = (raw.channel_map && raw.channel_map.length > 0)
      ? raw.channel_map
      : computeChannelMap(stations);
    return {
      ...raw,
      stations,
      channel_map: channelMap,
      summary: raw.summary || summarize(channelMap),
      free_blocks: raw.free_blocks || findFreeBlocks(channelMap),
    };
  }
  return buildLocalResponse(filters);
}

export async function fetchProvinces() {
  const available = await checkApi();
  if (available) {
    const r = await fetch(`${API_BASE}/provinces`);
    const d = await r.json();
    return d.provinces || [];
  }
  // API mati: return [] supaya hanya tab "Semua Wilayah" yang aktif
  return [];
}

export async function fetchStationDetail(freq) {
  const available = await checkApi();
  if (available) {
    const r = await fetch(`${API_BASE}/stations/${freq}`);
    if (!r.ok) throw new Error(`Stasiun ${freq} tidak ditemukan`);
    return r.json();
  }
  const s = fallbackStations.find((x) => Math.abs(x.freq - freq) < 0.05);
  if (!s) throw new Error('Stasiun tidak ditemukan');
  const neighbors = fallbackStations
    .filter((x) => Math.abs(x.freq - freq) >= 0.05 && Math.abs(x.freq - freq) <= 2.0)
    .sort((a, b) => Math.abs(a.freq - freq) - Math.abs(b.freq - freq))
    .map((x) => ({ ...x, wilayah_layanan: x.wilayah_layanan||x.kota||x.city, kota: x.kota||x.city, freq_distance: Math.abs(x.freq-freq) }));
  return { data: { ...s, wilayah_layanan: s.wilayah_layanan||s.kota||s.city, kota: s.kota||s.city }, neighbors };
}

export async function fetchInterference(filters = {}) {
  const available = await checkApi();
  if (available) {
    const url = new URL(`${API_BASE}/interference`);
    Object.entries(filters).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString());
    return r.json();
  }
  return {
    pairs: [], summary: { co_channel:0, adjacent_1:0, adjacent_2:0, clean:0 },
    stations_evaluated: 0,
    message: 'Analisis interferensi memerlukan koneksi API.',
    model: 'N/A', _source: 'local',
  };
}

export async function fetchCities(province = '') {
  const available = await checkApi();
  if (available) {
    const url = province
      ? `${API_BASE}/cities?province=${encodeURIComponent(province)}`
      : `${API_BASE}/cities`;
    const r = await fetch(url);
    const d = await r.json();
    const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
    return (d.cities || [])
      .map(c => c.wilayah_layanan || c.kota)
      .filter(w => w && w !== KOMUNITAS_AOS);
  }
  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  return [...new Set(
    fallbackStations
      .map(s => s.wilayah_layanan || s.kota || s.city)
      .filter(w => w && w !== KOMUNITAS_AOS)
  )].sort();
}

export async function fetchHealth() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    return r.json();
  } catch {
    return { status: 'error', source: 'local' };
  }
}

export const isUsingFallback = () => _apiAvailable === false;
