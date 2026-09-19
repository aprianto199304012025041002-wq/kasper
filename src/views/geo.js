// views/geo.js
// Geo view: peta Leaflet dengan marker per stasiun.
// Leaflet dimuat dari CDN saat view pertama kali dibuka (lazy load).

import { state, filteredStations } from '../state.js';
import { renderStatsBar } from '../components/statsbar.js';
import { computeChannelMap } from '../engine/channel.js';
import { isExpired, esc } from '../utils.js';

let _map = null;

export function renderGeo() {
  const main = document.getElementById('main');
  if (!main) return;

  if (_map) { _map.remove(); _map = null; }

  const stations = filteredStations().filter(s => s.latitude && s.longitude);
  renderStatsBar(computeChannelMap(filteredStations()));

  if (!stations.length) {
    main.innerHTML = `<div class="empty">Tidak ada stasiun dengan koordinat GPS.</div>`;
    return;
  }

  main.innerHTML = `
    <div id="geo-map"></div>
    <div id="geo-loading" class="loading" style="position:absolute;inset:0;background:var(--bg)">
      <div class="spin"></div>Memuat peta…
    </div>`;
  main.style.position = 'relative';

  loadLeaflet().then(() => {
    document.getElementById('geo-loading')?.remove();
    main.style.position = '';
    mountMap(stations);
  }).catch(() => {
    main.innerHTML = `<div class="err">
      Peta tidak dapat dimuat (CDN tidak terjangkau).<br>
      <small>Coba sambungkan ke internet atau gunakan view Grid/RF.</small>
    </div>`;
  });
}

function loadLeaflet() {
  if (typeof L !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    // CSS dulu
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    // Cek apakah sudah ada script
    if (document.getElementById('leaflet-js')) {
      // Tunggu load
      const wait = setInterval(() => {
        if (typeof L !== 'undefined') { clearInterval(wait); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(wait); reject(new Error('timeout')); }, 8000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Leaflet gagal dimuat'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('timeout')), 10000);
  });
}

function mountMap(stations) {
  const mapEl = document.getElementById('geo-map');
  if (!mapEl || typeof L === 'undefined') return;

  const isDark   = state.theme === 'dark';
  const tileUrl  = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = isDark
    ? '© <a href="https://carto.com">CARTO</a> © OSM'
    : '© <a href="https://openstreetmap.org">OpenStreetMap</a>';

  _map = L.map(mapEl, { zoomControl: true }).setView([-7.8, 110.4], 8);
  L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 18 }).addTo(_map);

  for (const s of stations) {
    const exp   = isExpired(s);
    const color = exp ? '#dc2626' : '#2563eb';
    L.circleMarker([s.latitude, s.longitude], {
      radius: 6, color, fillColor: color, fillOpacity: 0.75, weight: 1.5,
    }).bindPopup(`
      <b>${s.freq.toFixed(1)} MHz</b><br>
      ${esc(s.stn_name)}<br>
      <small>${esc(s.wilayah_layanan || s.kota || '')}</small>
      ${exp ? '<br><b style="color:#dc2626">⚠ Izin habis</b>' : ''}
    `).addTo(_map);
  }
}

export function destroyGeo() {
  if (_map) { _map.remove(); _map = null; }
}
