// views/geo.js — peta Leaflet dengan marker cluster

import { state, filteredStations, wilayahOf } from '../state.js';
import { ALLOTMENT } from '../data/allotment.js';
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

  // Titik pusat + radius wilayah layanan dari KM 570/2025
  const centerLayer = L.layerGroup();
  const radiusLayer = L.layerGroup();
  const wilayahSet  = new Set(stations.map(s => wilayahOf(s)));
  const RADIUS_KM   = { A: 30, B: 20, C: 12, D: 2.5 };

  for (const [wName, data] of Object.entries(ALLOTMENT)) {
    if (!wilayahSet.has(wName)) continue;
    if (!data.koordinat) continue;
    const lat = parseDMS(data.koordinat.lat);
    const lng = parseDMS(data.koordinat.lng);
    if (lat === null || lng === null) continue;

    const r   = (RADIUS_KM[data.kelas] || 12) * 1000;
    const ttl = `${wName} — Kelas ${data.kelas} (r=${RADIUS_KM[data.kelas] || 12} km)`;

    // Circle radius wilayah layanan
    L.circle([lat, lng], {
      radius: r, color: '#f59e0b', fillColor: '#fbbf24',
      fillOpacity: 0.05, weight: 1, dashArray: '4,4',
    }).bindTooltip(ttl, { direction: 'top' }).addTo(radiusLayer);

    // Titik pusat
    L.circleMarker([lat, lng], {
      radius: 4, color: '#f59e0b', fillColor: '#fbbf24',
      fillOpacity: 0.9, weight: 2,
    }).bindTooltip(ttl, { direction: 'top' }).addTo(centerLayer);
  }

  centerLayer.addTo(_map);
  radiusLayer.addTo(_map);

  L.control.layers(null, {
    'Titik pusat wilayah (KM 570)': centerLayer,
    'Radius wilayah layanan (KM 570)': radiusLayer,
  }, { collapsed: false, position: 'topright' }).addTo(_map);

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

/** Parse koordinat DMS format KM 570: "07S49 43" → -7.829, "110E09 36" → 110.16 */
function parseDMS(str) {
  if (!str) return null;
  const m = str.match(/^(\d+)([NSEW])(\d+)\s*(\d*)/i);
  if (!m) return null;
  const deg = parseInt(m[1]);
  const hem = m[2].toUpperCase();
  const min = parseInt(m[3]);
  const sec = m[4] ? parseInt(m[4]) : 0;
  let val = deg + min / 60 + sec / 3600;
  if (hem === 'S' || hem === 'W') val = -val;
  return val;
}

export function destroyGeo() {
  if (_map) { _map.remove(); _map = null; }
}
