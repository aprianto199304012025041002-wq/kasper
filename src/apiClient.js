// src/apiClient.js — langsung ke API, tanpa fallback sama sekali
import { computeChannelMap } from './channelEngine.js';

const API_BASE = 'https://kasper.balmonjogja.info/api';
const FETCH_TIMEOUT_MS = 60000;

// XHR-based fetch dengan timeout — lebih reliable dari fetch+AbortController di Firefox mobile
function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const tid = setTimeout(() => {
      xhr.abort();
      reject(new Error(`Timeout ${ms}ms: ${url}`));
    }, ms);
    xhr.open('GET', url);
    xhr.onload = () => {
      clearTimeout(tid);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ ok: true, status: xhr.status, json: () => Promise.resolve(data) });
        } catch (e) {
          reject(new Error(`JSON parse error: ${xhr.responseText.slice(0, 100)}`));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 100)}`));
      }
    };
    xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error')); };
    xhr.ontimeout = () => { clearTimeout(tid); reject(new Error(`XHR timeout ${ms}ms`)); };
    xhr.timeout = ms;
    xhr.send();
  });
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
