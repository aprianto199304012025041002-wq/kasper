// views/geo.js — peta Leaflet, bundled via npm (tidak perlu CDN)

import { state, filteredStations } from '../state.js';
import { renderStatsBar } from '../components/statsbar.js';
import { computeChannelMap } from '../engine/channel.js';
import { isExpired, esc } from '../utils.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix ikon Leaflet default (path asset berubah saat di-bundle)
import iconUrl      from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl    from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

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

  main.innerHTML = `<div id="geo-map"></div>`;

  // Gunakan OSM standar saja — CartoCDN sering blocked di jaringan tertentu
  const tileUrl  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';

  _map = L.map('geo-map').setView([-7.8, 110.4], 8);
  L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 18 }).addTo(_map);

  for (const s of stations) {
    const exp   = isExpired(s);
    const color = exp ? '#dc2626' : '#2563eb';
    L.circleMarker([parseFloat(s.latitude), parseFloat(s.longitude)], {
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
