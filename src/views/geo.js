// views/geo.js
// Geo view: peta Leaflet dengan marker per stasiun.
// Warna marker: biru = aktif, merah = expired.

import { state, filteredStations } from '../state.js';
import { renderStatsBar } from '../components/statsbar.js';
import { computeChannelMap } from '../engine/channel.js';
import { isExpired, esc } from '../utils.js';

let _map = null; // simpan instance Leaflet agar bisa di-destroy saat ganti view

export function renderGeo() {
  const main = document.getElementById('main');
  if (!main) return;

  // Destroy map lama kalau ada
  if (_map) { _map.remove(); _map = null; }

  const stations = filteredStations().filter(s => s.latitude && s.longitude);

  renderStatsBar(computeChannelMap(filteredStations()));

  if (!stations.length) {
    main.innerHTML = `<div class="empty">Tidak ada stasiun dengan koordinat GPS.</div>`;
    return;
  }

  main.innerHTML = `<div id="geo-map"></div>`;

  // Leaflet dimuat dari CDN di index.html
  if (typeof L === 'undefined') {
    main.innerHTML = `<div class="err">Leaflet belum dimuat. Periksa koneksi internet.</div>`;
    return;
  }

  const theme     = state.theme;
  const tileLight = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileDark  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  _map = L.map('geo-map', { zoomControl: true }).setView([-7.8, 110.4], 8);

  L.tileLayer(theme === 'dark' ? tileDark : tileLight, {
    attribution: theme === 'dark'
      ? '© <a href="https://carto.com">CARTO</a> © <a href="https://www.openstreetmap.org">OSM</a>'
      : '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_map);

  for (const s of stations) {
    const exp   = isExpired(s);
    const color = exp ? '#dc2626' : '#2563eb';
    const popup = `
      <b>${s.freq.toFixed(1)} MHz</b><br>
      ${esc(s.stn_name)}<br>
      <small>${esc(s.wilayah_layanan || s.kota || '')}</small>
      ${exp ? `<br><span style="color:#dc2626;font-weight:600">⚠ Izin habis</span>` : ''}`;

    L.circleMarker([s.latitude, s.longitude], {
      radius: 6, color, fillColor: color, fillOpacity: 0.75, weight: 1.5,
    }).bindPopup(popup).addTo(_map);
  }
}

/** Panggil saat ganti view agar peta lama tidak bocor memori */
export function destroyGeo() {
  if (_map) { _map.remove(); _map = null; }
}
