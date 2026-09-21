// views/detail.js — detail panel stasiun FM

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchStationDetail } from '../api.js';
import { isExpired, parseValidity, fmtDate, dbmToWatt, esc, JENIS_LABEL } from '../utils.js';

// Fix Leaflet default icon path saat di-bundle
import iconUrl       from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

let _panel = null;
let _loadSeq = 0; // sequence number untuk cancel fetch lama

export function openDetail(freq) {
  if (_panel) {
    // Reuse panel — reset konten langsung
    _panel.querySelector('.detail-freq').textContent = '…';
    _panel.querySelector('.detail-body').innerHTML =
      '<div class="loading"><div class="spin"></div>Memuat…</div>';
  } else {
    _panel = createPanel();
    document.body.appendChild(_panel);
    requestAnimationFrame(() => _panel.classList.add('open'));
  }
  loadAndRender(freq);
}

export function closeDetail() {
  if (!_panel) return;
  _loadSeq++; // cancel pending fetch
  const p = _panel;
  _panel = null;
  p.classList.remove('open');
  p.addEventListener('transitionend', () => p.remove(), { once: true });
}

function createPanel() {
  const el = document.createElement('div');
  el.className = 'detail-panel';
  el.innerHTML = `
    <div class="detail-drag-handle"></div>
    <div class="detail-hdr">
      <button class="detail-close">✕ Tutup</button>
      <span class="detail-freq">—</span>
    </div>
    <div class="detail-body">
      <div class="loading"><div class="spin"></div>Memuat…</div>
    </div>`;
  el.querySelector('.detail-close').onclick = closeDetail;

  // Swipe down to close — hanya dari drag handle, bukan body panel
  const handle = el.querySelector('.detail-drag-handle');
  if (handle) {
    let _touchY = 0;
    handle.addEventListener('touchstart', e => { _touchY = e.touches[0].clientY; }, { passive: true });
    handle.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - _touchY;
      if (dy > 60) closeDetail();
    }, { passive: true });
  }

  return el;
}

async function loadAndRender(freq) {
  const seq = ++_loadSeq;
  try {
    const result = await fetchStationDetail(freq);
    // Pastikan ini masih request terbaru dan panel masih ada
    if (seq !== _loadSeq || !_panel) return;
    renderDetail(result);
  } catch (e) {
    if (seq !== _loadSeq || !_panel) return;
    _panel.querySelector('.detail-body').innerHTML =
      `<div class="err">Gagal memuat detail: ${e.message}</div>`;
  }
}

function renderDetail({ data: s, neighbors = [] }) {
  if (!_panel) return;

  if (!s) {
    _panel.querySelector('.detail-body').innerHTML = `<div class="err">Data tidak ditemukan</div>`;
    return;
  }

  _panel.querySelector('.detail-freq').textContent = `${parseFloat(s.freq).toFixed(1)} MHz`;
  const body = _panel.querySelector('.detail-body');
  if (!body) return;

  const exp      = isExpired(s);
  const validTs  = parseValidity(s.validity);
  const erpDbm   = s.erp_dbm ? parseFloat(s.erp_dbm) : null;
  const lat      = parseFloat(s.latitude)  || null;
  const lon      = parseFloat(s.longitude) || null;

  body.innerHTML = `
    <div class="dp-name">${esc(s.stn_name || '—')}</div>
    <div class="dp-owner">${esc(s.clnt_name || '—')}</div>
    ${exp ? `<div class="dp-expired">⚠ Izin habis sejak ${fmtDate(validTs)}</div>` : ''}

    <div class="dp-section">
      <div class="dp-sec-title">Frekuensi &amp; Teknis</div>
      ${row('Frekuensi',   `${parseFloat(s.freq).toFixed(1)} MHz`)}
      ${row('Bandwidth',   s.bw_khz ? `${s.bw_khz} kHz` : '—')}
      ${row('Lower–Upper', s.lower_mhz && s.upper_mhz ? `${s.lower_mhz}–${s.upper_mhz} MHz` : '—')}
      ${row('ERP',         erpDbm !== null ? `${erpDbm.toFixed(1)} dBm (${dbmToWatt(erpDbm)})` : '—')}
      ${s.antenna_gain    ? row('Gain antena',  `${s.antenna_gain} dBd`) : ''}
      ${s.tower_height_m  ? row('Tinggi tower', `${s.tower_height_m} m`) : ''}
      ${s.equip_type      ? row('Perangkat',    esc(s.equip_type)) : ''}
    </div>

    <div class="dp-section">
      <div class="dp-sec-title">Izin &amp; Status</div>
      ${row('No. SIMF',   s.no_simf || '—')}
      ${row('Status',     s.status  || '—')}
      ${row('Jenis',      JENIS_LABEL[s.jenis] || s.jenis || '—')}
      ${row('Tgl Izin',   fmtDate(parseValidity(s.licence_date)))}
      ${row('Berlaku s/d', validTs ? `${fmtDate(validTs)}${exp ? ' <span style="color:var(--red)">HABIS</span>' : ''}` : '—')}
    </div>

    <div class="dp-section">
      <div class="dp-sec-title">Lokasi</div>
      ${row('Wilayah Layanan', s.wilayah_layanan || s.kota || '—')}
      ${row('Kota/Kab',       s.kota || '—')}
      ${row('Kecamatan',      s.kecamatan || '—')}
      ${lat && lon ? row('Koordinat', `${lat.toFixed(5)}, ${lon.toFixed(5)}`) : ''}
      ${lat && lon ? `
      <div id="dp-map-wrap">
        <div id="dp-map"></div>
        <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener" class="dp-gmaps">
          Buka di Google Maps ↗
        </a>
      </div>` : ''}
    </div>

    ${neighbors.length ? `
    <div class="dp-section">
      <div class="dp-sec-title">Frekuensi Berdekatan</div>
      ${neighbors.slice(0, 8).map(n => `
        <div class="dp-neighbor">
          <span class="dp-neighbor-freq">${parseFloat(n.freq).toFixed(1)}</span>
          <span class="dp-neighbor-name">${esc(n.stn_name)}</span>
          <span class="dp-neighbor-wil">${esc(n.wilayah_layanan || n.kota || '')}</span>
        </div>`).join('')}
    </div>` : ''}`;

  // Peta mini Leaflet
  // Delay > durasi transisi panel (0.22s desktop, sama di mobile)
  // agar Leaflet tahu ukuran container setelah animasi selesai
  if (lat && lon) {
    const mapEl = document.getElementById('dp-map');
    if (mapEl) {
      setTimeout(() => {
        const m = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView([lat, lon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
        L.circleMarker([lat, lon], {
          radius: 8, color: '#2563eb', fillColor: '#2563eb', fillOpacity: .8, weight: 2,
        }).addTo(m);
        // invalidateSize setelah transisi panel benar-benar selesai
        m.invalidateSize();
      }, 300);
    }
  }
}

const row = (key, val) =>
  `<div class="dp-row"><span class="dp-row-key">${key}</span><span class="dp-row-val">${val}</span></div>`;
