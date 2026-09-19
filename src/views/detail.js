// views/detail.js
// Detail panel: informasi lengkap satu stasiun FM.
// Muncul sebagai slide-in panel dari kanan (desktop) atau bottom sheet (mobile).

import { state } from '../state.js';
import { fetchStationDetail } from '../api.js';
import { isExpired, parseValidity, fmtDate, dbmToWatt, esc, JENIS_LABEL } from '../utils.js';

let _panel = null;

export function openDetail(freq) {
  closeDetail();
  _panel = createPanel();
  document.body.appendChild(_panel);
  requestAnimationFrame(() => _panel.classList.add('open'));

  loadAndRender(freq);
}

export function closeDetail() {
  if (!_panel) return;
  _panel.classList.remove('open');
  _panel.addEventListener('transitionend', () => _panel?.remove(), { once: true });
  _panel = null;
}

function createPanel() {
  const el = document.createElement('div');
  el.className = 'detail-panel';
  el.innerHTML = `
    <div class="detail-hdr">
      <button class="detail-close" id="detail-close">✕</button>
      <span class="detail-freq" id="detail-freq-tag">—</span>
    </div>
    <div class="detail-body" id="detail-body">
      <div class="loading"><div class="spin"></div>Memuat…</div>
    </div>`;

  el.querySelector('#detail-close').onclick = closeDetail;

  // Backdrop klik tutup
  el.onclick = e => { if (e.target === el) closeDetail(); };

  return el;
}

async function loadAndRender(freq) {
  try {
    const result = await fetchStationDetail(freq);
    renderDetail(result);
  } catch (e) {
    const body = document.getElementById('detail-body');
    if (body) body.innerHTML = `<div class="err">${e.message}</div>`;
  }
}

function renderDetail({ data: s, neighbors = [] }) {
  if (!s) return;

  const freqTag = document.getElementById('detail-freq-tag');
  if (freqTag) freqTag.textContent = `${parseFloat(s.freq).toFixed(1)} MHz`;

  const body = document.getElementById('detail-body');
  if (!body) return;

  const exp     = isExpired(s);
  const erpDbm  = s.erp_dbm ? parseFloat(s.erp_dbm) : null;
  const validTs = parseValidity(s.validity);
  const lat     = parseFloat(s.latitude)  || null;
  const lon     = parseFloat(s.longitude) || null;

  body.innerHTML = `
    <div class="detail-name">${esc(s.stn_name)}</div>
    <div class="detail-owner">${esc(s.clnt_name || '—')}</div>
    ${exp ? `<div class="detail-exp-badge">⚠ Izin habis sejak ${fmtDate(validTs)}</div>` : ''}

    <div class="detail-section">
      <div class="detail-sec-title">Frekuensi &amp; Teknis</div>
      ${row('Frekuensi',    `${parseFloat(s.freq).toFixed(1)} MHz`)}
      ${row('Bandwidth',    s.bw_khz ? `${s.bw_khz} kHz` : '—')}
      ${row('Lower–Upper',  s.lower_mhz && s.upper_mhz ? `${s.lower_mhz}–${s.upper_mhz} MHz` : '—')}
      ${row('ERP',          erpDbm !== null ? `${erpDbm.toFixed(1)} dBm (${dbmToWatt(erpDbm)})` : '—')}
      ${s.gain       ? row('Gain antena', `${s.gain} dBd`) : ''}
      ${s.twr_height ? row('Tinggi tower', `${s.twr_height} m`) : ''}
    </div>

    <div class="detail-section">
      <div class="detail-sec-title">Izin &amp; Status</div>
      ${row('No. SIMF',      s.no_simf || '—')}
      ${row('Status',        s.status  || '—')}
      ${row('Jenis',         JENIS_LABEL[s.jenis] || s.jenis || '—')}
      ${row('Tgl Izin',      fmtDate(parseValidity(s.licence_date)))}
      ${row('Tgl Permohonan', fmtDate(parseValidity(s.appl_date)))}
      ${row('Berlaku s/d',   validTs ? `${fmtDate(validTs)}${exp ? ' <span class="red">HABIS</span>' : ''}` : '—')}
    </div>

    <div class="detail-section">
      <div class="detail-sec-title">Lokasi</div>
      ${row('Wilayah Layanan', s.wilayah_layanan || s.kota || '—')}
      ${row('Kota/Kab',       s.kota || '—')}
      ${row('Kecamatan',      s.kecamatan || '—')}
      ${lat && lon ? row('Koordinat', `${lat.toFixed(5)}, ${lon.toFixed(5)}`) : ''}
      ${lat && lon ? `<div class="detail-map-wrap">
        <div id="detail-map"></div>
        <a class="detail-gmaps" href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener">
          Buka di Google Maps ↗
        </a>
      </div>` : ''}
    </div>

    ${neighbors.length ? `
    <div class="detail-section">
      <div class="detail-sec-title">Stasiun Tetangga (frekuensi berdekatan)</div>
      ${neighbors.slice(0, 6).map(n => `
        <div class="detail-neighbor">
          <span class="mono">${parseFloat(n.freq).toFixed(1)}</span>
          <span>${esc(n.stn_name)}</span>
          <span class="detail-neighbor-dist">${n.dist_km ? n.dist_km.toFixed(1) + ' km' : '—'}</span>
        </div>`).join('')}
    </div>` : ''}

    <div class="detail-actions">
      <button onclick="navigator.share ? navigator.share({title:'${esc(s.stn_name)}',url:location.origin+'?freq=${s.freq}'}) : (location.hash = 'freq=${s.freq}')">
        Bagikan ↗
      </button>
    </div>`;

  // Mount peta mini jika ada koordinat
  if (lat && lon && typeof L !== 'undefined') {
    const mapEl = document.getElementById('detail-map');
    if (mapEl) {
      const m = L.map(mapEl, { zoomControl: false, attributionControl: false })
        .setView([lat, lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
      L.circleMarker([lat, lon], {
        radius: 7, color: '#2563eb', fillColor: '#2563eb', fillOpacity: .8, weight: 2,
      }).addTo(m);
    }
  }
}

function row(key, val) {
  return `<div class="detail-row">
    <span class="detail-row-key">${key}</span>
    <span class="detail-row-val">${val}</span>
  </div>`;
}
