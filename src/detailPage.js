// src/detailPage.js — detail drawer, pakai app.css classes

const JENIS_LABELS = {
  swasta: 'Swasta', publik: 'Publik (RRI)',
  publik_lokal: 'Publik Lokal (LPPL)', komunitas: 'Komunitas',
};

export function renderDetailPage(data, onBack, allData, targetEl) {
  const s   = data.data;
  const nbr = data.neighbors || [];

  const freq     = parseFloat(s.freq);
  const lower    = s.lower_mhz ?? (freq - (parseFloat(s.bw_khz||200)/2/1000));
  const upper    = s.upper_mhz ?? (freq + (parseFloat(s.bw_khz||200)/2/1000));
  const bwKhz    = s.bw_khz || 200;
  const erp      = s.erp_dbm ? parseFloat(s.erp_dbm).toFixed(1) : '—';
  const status   = s.status || '—';
  const validity = s.validity || '—';
  const kota     = s.wilayah_layanan || s.kota || '—';
  const lat      = parseFloat(s.latitude)  || null;
  const lon      = parseFloat(s.longitude) || null;
  const jenis    = JENIS_LABELS[s.jenis] || s.jenis || '—';

  const root = targetEl || document.getElementById('app');
  root.innerHTML = `
    <div class="dp-header">
      <button class="dp-back" id="dpBack">←</button>
      <div style="flex:1;min-width:0">
        <div class="dp-freq">${freq.toFixed(1)} <span style="font-size:13px;color:var(--txt-2)">MHz</span></div>
        <div class="dp-title">${esc(s.stn_name||'—')}</div>
        <div class="dp-meta">${esc(s.clnt_name||'—')} · ${esc(kota)}</div>
      </div>
      <button class="dp-share" id="dpShare" title="Salin link stasiun ini">⎘</button>
    </div>

    <div class="dp-section">
      <div class="dp-section__label">Teknis</div>
      <div class="dp-grid">
        <div class="dp-item"><div class="dp-item__label">Frekuensi</div><div class="dp-item__val mono">${freq.toFixed(3)} MHz</div></div>
        <div class="dp-item"><div class="dp-item__label">ERP</div><div class="dp-item__val mono">${erp} dBm</div></div>
        <div class="dp-item"><div class="dp-item__label">Lower edge</div><div class="dp-item__val mono">${Number(lower).toFixed(4)} MHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Upper edge</div><div class="dp-item__val mono">${Number(upper).toFixed(4)} MHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Bandwidth</div><div class="dp-item__val mono">${bwKhz} kHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Jenis</div><div class="dp-item__val">${esc(jenis)}</div></div>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section__label">Perizinan</div>
      <div class="dp-grid">
        <div class="dp-item"><div class="dp-item__label">No. SIMF</div><div class="dp-item__val mono" style="font-size:11px">${esc(s.no_simf||'—')}</div></div>
        <div class="dp-item"><div class="dp-item__label">Status</div><div class="dp-item__val" style="color:${status.toLowerCase()==='granted'?'var(--phosphor)':'var(--txt-3)'}">${esc(status)}</div></div>
        <div class="dp-item"><div class="dp-item__label">Berlaku s.d.</div><div class="dp-item__val">${esc(validity)}</div></div>
        <div class="dp-item"><div class="dp-item__label">Kecamatan</div><div class="dp-item__val">${esc(s.kecamatan||'—')}</div></div>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section__label">Lokasi pemancar${lat&&lon ? ` · ${lat.toFixed(5)}, ${lon.toFixed(5)}` : ' · Koordinat belum tersedia'}</div>
      <div id="stationMap" class="dp-map"></div>
    </div>

    ${nbr.length ? `<div class="dp-section">
      <div class="dp-section__label">Tetangga band (±2 MHz) — ${nbr.length} stasiun</div>
      <div style="max-height:240px;overflow-y:auto">
        ${nbr.map(n => {
          const nf = parseFloat(n.freq);
          const diff = (nf - freq).toFixed(1);
          return `<div class="neighbor-row" data-freq="${nf}">
            <span class="neighbor-freq">${nf.toFixed(1)}</span>
            <span class="neighbor-name">${esc(n.stn_name||'—')}</span>
            <span class="neighbor-dist">${parseFloat(diff)>0?'+':''}${diff} MHz</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  root.querySelector('#dpBack')?.addEventListener('click', onBack);
  root.querySelector('#dpShare')?.addEventListener('click', () => {
    const url = location.origin + location.pathname + '?freq=' + freq.toFixed(1);
    navigator.clipboard?.writeText(url).then(() => {
      const btn = root.querySelector('#dpShare');
      if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⎘'; }, 1200); }
    });
  });
  root.querySelectorAll('.neighbor-row[data-freq]').forEach(r => {
    r.addEventListener('click', () => {
      if (window.__openDetailFreq) window.__openDetailFreq(parseFloat(r.dataset.freq));
    });
  });

  initMap(lat, lon, s.stn_name||'', freq, nbr, parseFloat(s.erp_dbm||0));
}

function initMap(lat, lon, name, freq, neighbors, erp) {
  const el = document.getElementById('stationMap');
  if (!el) return;
  if (!lat || !lon) {
    el.innerHTML = `<div class="state-empty" style="min-height:100px;font-size:11px">Koordinat GPS tidak tersedia</div>`;
    return;
  }
  if (!window.L) {
    const lnk = document.createElement('link');
    lnk.rel = 'stylesheet'; lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(lnk);
    const sc = document.createElement('script');
    sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    sc.onload = () => initLeaflet(lat, lon, name, freq, neighbors, el, erp);
    document.head.appendChild(sc);
  } else {
    initLeaflet(lat, lon, name, freq, neighbors, el, erp);
  }
}

function initLeaflet(lat, lon, name, freq, neighbors, el, erp) {
  const map = L.map(el).setView([lat, lon], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#1DFF9A;border:2px solid #03070D;box-shadow:0 0 8px rgba(29,255,154,.5)"></div>`,
    iconSize: [12,12], iconAnchor: [6,6],
  });
  L.marker([lat,lon],{icon}).addTo(map)
    .bindPopup(`<b>${name}</b><br>${freq.toFixed(1)} MHz · ERP: ${erp?erp.toFixed(1)+' dBm':'—'}`).openPopup();
  neighbors.forEach(n => {
    const nLat = parseFloat(n.latitude), nLon = parseFloat(n.longitude);
    if (!nLat || !nLon) return;
    const ni = L.divIcon({
      className:'',
      html:`<div style="width:8px;height:8px;border-radius:50%;background:#2E4560;border:1.5px solid #03070D"></div>`,
      iconSize:[8,8], iconAnchor:[4,4],
    });
    L.marker([nLat,nLon],{icon:ni}).addTo(map)
      .bindPopup(`<b>${n.stn_name||'—'}</b><br>${parseFloat(n.freq).toFixed(1)} MHz`);
  });
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
