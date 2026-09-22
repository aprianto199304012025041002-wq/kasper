// views/geo.js — peta Leaflet dengan marker cluster

import { state, filteredStations, wilayahOf } from '../state.js';
import { renderStatsBar } from '../components/statsbar.js';
import { computeChannelMap } from '../engine/channel.js';
import { isExpired, esc } from '../utils.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import iconUrl       from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

let _map = null;
let _onDetail = null;

export function renderGeo(onDetail) {
  if (onDetail) _onDetail = onDetail;

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

  _map = L.map('geo-map').setView([-7.8, 110.4], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_map);

  // Cluster group
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: c => {
      const n = c.getChildCount();
      const cls = n >= 10 ? 'mcluster-lg' : n >= 5 ? 'mcluster-md' : 'mcluster-sm';
      return L.divIcon({ html: `<span>${n}</span>`, className: `mcluster ${cls}`, iconSize: [32, 32] });
    },
  });

  for (const s of stations) {
    const exp   = isExpired(s);
    const color = exp ? '#dc2626' : '#2563eb';
    const wil   = wilayahOf(s);

    const marker = L.circleMarker([parseFloat(s.latitude), parseFloat(s.longitude)], {
      radius: 7, color, fillColor: color, fillOpacity: 0.8, weight: 2,
    });

    // Popup ringkas
    marker.bindPopup(`
      <div class="geo-popup">
        <b>${s.freq.toFixed(1)} MHz</b>
        <span>${esc(s.stn_name)}</span>
        <small>${esc(wil)}</small>
        ${exp ? '<em>⚠ Izin habis</em>' : ''}
        <button class="geo-detail-btn" data-freq="${s.freq}">Detail →</button>
      </div>
    `, { minWidth: 160 });

    // Klik marker langsung → buka detail (tanpa popup di mobile)
    marker.on('click', () => {
      if (window.innerWidth < 768 && _onDetail) {
        _onDetail(s.freq);
      }
    });

    cluster.addLayer(marker);
  }

  _map.addLayer(cluster);

  // Delegasi klik tombol "Detail →" di popup
  _map.on('popupopen', e => {
    const btn = e.popup.getElement()?.querySelector('.geo-detail-btn');
    if (btn && _onDetail) {
      btn.onclick = () => {
        _map.closePopup();
        _onDetail(parseFloat(btn.dataset.freq));
      };
    }
  });
}

export function destroyGeo() {
  if (_map) { _map.remove(); _map = null; }
}
