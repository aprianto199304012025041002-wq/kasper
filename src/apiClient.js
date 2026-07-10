// src/apiClient.js
// Abstraksi koneksi ke PHP API.
// Saat API tidak tersedia (misal deploy GitHub Pages tanpa backend),
// otomatis fallback ke data statis JSON.

import fallbackStations from './data/stations.json';
import { computeChannelMap, findFreeBlocks, summarize } from './channelEngine.js';

// Ganti dengan URL API PHP kamu saat produksi
// Contoh: 'https://api.domainmu.com/api'
// Jika kosong (''), selalu pakai fallback data statis
const API_BASE = import.meta.env.VITE_API_URL || '';

let _apiAvailable = null; // null = belum dicek, true/false = hasil cek

/**
 * Cek apakah API tersedia (health check)
 */
async function checkApiAvailability() {
  if (!API_BASE) return false;
  if (_apiAvailable !== null) return _apiAvailable;

  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    _apiAvailable = res.ok;
  } catch {
    _apiAvailable = false;
  }
  return _apiAvailable;
}

/**
 * Fetch dari API atau fallback ke data lokal
 */
async function apiFetch(endpoint, params = {}) {
  const available = await checkApiAvailability();

  if (available) {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  // Fallback: hitung di client dari data JSON statis
  return buildLocalResponse(params);
}

/**
 * Bangun response struktur sama dengan API dari data lokal
 */
function buildLocalResponse(filters = {}) {
  let stations = [...fallbackStations];

  if (filters.city) {
    stations = stations.filter((s) => s.kota === filters.city);
  }
  if (filters.jenis) {
    stations = stations.filter((s) => s.jenis === filters.jenis);
  }
  if (filters.search) {
    const t = filters.search.toLowerCase();
    stations = stations.filter(
      (s) =>
        s.stn_name.toLowerCase().includes(t) ||
        s.clnt_name.toLowerCase().includes(t) ||
        String(s.freq).includes(t)
    );
  }

  // Normalisasi field (API pakai lower_mhz/upper_mhz, JSON lokal pakai lower/upper)
  const normalized = stations.map((s) => ({
    ...s,
    lower_mhz: s.lower ?? s.lower_mhz,
    upper_mhz: s.upper ?? s.upper_mhz,
  }));

  const channelMap = computeChannelMap(normalized);
  const freeBlocks = findFreeBlocks(channelMap);
  const summary    = summarize(channelMap);

  return {
    summary,
    stations: normalized,
    channel_map: channelMap,
    free_blocks: freeBlocks,
    _source: 'local',
    meta: {
      fm_min: 87.5,
      fm_max: 108.0,
      channel_spacing: 0.2,
      generated_at: new Date().toISOString(),
    },
  };
}

// ---------- Public API ----------

export async function fetchSpectrum(filters = {}) {
  return apiFetch('/stations', filters);
}

export async function fetchCities(province = 'DAERAH ISTIMEWA YOGYAKARTA') {
  const available = await checkApiAvailability();
  if (available) {
    const res = await fetch(`${API_BASE}/cities?province=${encodeURIComponent(province)}`);
    const data = await res.json();
    return data.cities;
  }
  // Fallback: unique cities dari JSON lokal
  return [...new Set(fallbackStations.map((s) => s.kota))].sort();
}

export async function fetchHealth() {
  if (!API_BASE) return { status: 'no_api', source: 'local' };
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.json();
  } catch {
    return { status: 'error', source: 'local' };
  }
}

export function isUsingFallback() {
  return _apiAvailable === false || !API_BASE;
}
