// src/detailPage.js — detail drawer, pakai app.css classes

const JENIS_LABELS = {
  swasta: 'Swasta', publik: 'Publik (RRI)',
  publik_lokal: 'Publik Lokal (LPPL)', komunitas: 'Komunitas',
};

// Konversi dBm → Watt dengan unit yang tepat
function dbmToWatt(dbm) {
  const w = Math.pow(10, (parseFloat(dbm) - 30) / 10);
  if (w >= 1000) return (w / 1000).toFixed(2) + ' kW';
  if (w >= 1)    return w.toFixed(2) + ' W';
  if (w >= 0.001) return (w * 1000).toFixed(1) + ' mW';
  return w.toExponential(2) + ' W';
}

// Format tanggal ISO → "31 Des 2027"
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
function fmtDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Apakah tanggal sudah lewat hari ini?
function isExpired(raw) {
  if (!raw) return false;
  return new Date(raw) < new Date();
}

// Haversine distance (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function renderDetailPage(data, onBack, allData, targetEl) {
  const s   = data.data;
  const nbr = data.neighbors || [];

  const freq     = parseFloat(s.freq);
  const lower    = s.lower_mhz ?? (freq - (parseFloat(s.bw_khz||200)/2/1000));
  const upper    = s.upper_mhz ?? (freq + (parseFloat(s.bw_khz||200)/2/1000));
  const bwKhz    = s.bw_khz || 200;
  const erpDbm   = s.erp_dbm ? parseFloat(s.erp_dbm) : null;
  const erpStr   = erpDbm !== null ? `${erpDbm.toFixed(1)} dBm` : '—';
  const erpWatt  = erpDbm !== null ? ` (${dbmToWatt(erpDbm)})` : '';
  const status   = s.status || '—';
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
        <div class="dp-item"><div class="dp-item__label">ERP</div><div class="dp-item__val mono">${erpStr}<span style="color:var(--txt-3);font-size:10px">${erpWatt}</span></div></div>
        <div class="dp-item"><div class="dp-item__label">Lower edge</div><div class="dp-item__val mono">${Number(lower).toFixed(4)} MHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Upper edge</div><div class="dp-item__val mono">${Number(upper).toFixed(4)} MHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Bandwidth</div><div class="dp-item__val mono">${bwKhz} kHz</div></div>
        <div class="dp-item"><div class="dp-item__label">Jenis</div><div class="dp-item__val">${esc(jenis)}</div></div>
        ${s.tower_height_m ? `<div class="dp-item"><div class="dp-item__label">Tinggi antena</div><div class="dp-item__val mono">${s.tower_height_m} m</div></div>` : ''}
        ${s.antenna_gain   ? `<div class="dp-item"><div class="dp-item__label">Gain antena</div><div class="dp-item__val mono">${s.antenna_gain} dBd</div></div>` : ''}
        ${(s.equip_type||s.eq_mfr||s.eq_mdl) ? `<div class="dp-item" style="grid-column:1/-1"><div class="dp-item__label">Perangkat</div><div class="dp-item__val mono" style="font-size:10px">${esc([s.equip_type,s.eq_mfr,s.eq_mdl].filter(Boolean).join(' · '))}</div></div>` : ''}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section__label">Perizinan</div>
      <div class="dp-grid">
        <div class="dp-item"><div class="dp-item__label">No. SIMF</div><div class="dp-item__val mono" style="font-size:11px">${esc(s.no_simf||'—')}</div></div>
        <div class="dp-item"><div class="dp-item__label">Status</div><div class="dp-item__val" style="color:${status.toLowerCase()==='granted'?'var(--phosphor)':'var(--txt-3)'}">${esc(status)}</div></div>
        <div class="dp-item"><div class="dp-item__label">Tgl. Permohonan</div><div class="dp-item__val">${fmtDate(s.appl_date)}</div></div>
        <div class="dp-item"><div class="dp-item__label">Tgl. Izin</div><div class="dp-item__val">${fmtDate(s.licence_date)}</div></div>
        <div class="dp-item"><div class="dp-item__label">Berlaku s.d.</div><div class="dp-item__val" style="${isExpired(s.validity)?'color:var(--red)':''}" title="${isExpired(s.validity)?'Izin telah berakhir':''}">${fmtDate(s.validity)}${isExpired(s.validity)?' ⚠':''}</div></div>
        <div class="dp-item"><div class="dp-item__label">Kecamatan</div><div class="dp-item__val">${esc(s.kecamatan||'—')}</div></div>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section__label">Lokasi pemancar${lat&&lon ? ` · ${lat.toFixed(5)}, ${lon.toFixed(5)} · <a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" rel="noopener" style="color:var(--cyan);text-decoration:none;font-size:9px">↗ Google Maps</a>` : ' · Koordinat belum tersedia'}</div>
      <div id="stationMap" class="dp-map"></div>
    </div>

    ${nbr.length ? `<div class="dp-section">
      <div class="dp-section__label">Tetangga band (±2 MHz) — ${nbr.length} stasiun</div>
      <div style="max-height:240px;overflow-y:auto">
        ${nbr.map(n => {
          const nf = parseFloat(n.freq);
          const diff = (nf - freq).toFixed(1);
          const nLat = parseFloat(n.latitude), nLon = parseFloat(n.longitude);
          const distKm = (lat && lon && nLat && nLon)
            ? ` · ${haversineKm(lat, lon, nLat, nLon).toFixed(1)} km`
            : '';
          const nExp = isExpired(n.validity);
          return `<div class="neighbor-row" data-freq="${nf}" style="${nExp?'opacity:.75':''}">
            <span class="neighbor-freq" style="${nExp?'color:var(--red)':''}">${nf.toFixed(1)}</span>
            <span class="neighbor-name">${esc(n.stn_name||'—')}${nExp?' <span style="color:var(--red);font-size:9px">⚠</span>':''}</span>
            <span class="neighbor-dist">${parseFloat(diff)>0?'+':''}${diff} MHz${distKm}</span>
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
  // Neighbor click — window.__openDetailFreq di-set di boot() di main.js
  root.querySelectorAll('.neighbor-row[data-freq]').forEach(r => {
    r.addEventListener('click', () => {
      const f = parseFloat(r.dataset.freq);
      if (typeof window.__openDetailFreq === 'function') window.__openDetailFreq(f);
    });
  });

  initMap(lat, lon, s.stn_name||'', freq, nbr, erpDbm);
}

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

function initMap(lat, lon, name, freq, neighbors, erpDbm) {
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
    sc.onload = () => initLeaflet(lat, lon, name, freq, neighbors, el, erpDbm);
    document.head.appendChild(sc);
  } else {
    initLeaflet(lat, lon, name, freq, neighbors, el, erpDbm);
  }
}

function initLeaflet(lat, lon, name, freq, neighbors, el, erpDbm) {
  const dark = isDarkTheme();
  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const map = L.map(el).setView([lat, lon], 11);
  L.tileLayer(tileUrl, {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  const erpLabel = erpDbm !== null ? `ERP: ${erpDbm.toFixed(1)} dBm (${dbmToWatt(erpDbm)})` : 'ERP: —';
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#1DFF9A;border:2px solid #03070D;box-shadow:0 0 8px rgba(29,255,154,.5)"></div>`,
    iconSize: [12,12], iconAnchor: [6,6],
  });
  L.marker([lat,lon],{icon}).addTo(map)
    .bindPopup(`<b>${name}</b><br>${freq.toFixed(1)} MHz · ${erpLabel}`).openPopup();

  neighbors.forEach(n => {
    const nLat = parseFloat(n.latitude), nLon = parseFloat(n.longitude);
    if (!nLat || !nLon) return;
    const ni = L.divIcon({
      className:'',
      html:`<div style="width:8px;height:8px;border-radius:50%;background:${dark?'#2E4560':'#9BB8D4'};border:1.5px solid ${dark?'#03070D':'#fff'}"></div>`,
      iconSize:[8,8], iconAnchor:[4,4],
    });
    L.marker([nLat,nLon],{icon:ni}).addTo(map)
      .bindPopup(`<b>${n.stn_name||'—'}</b><br>${parseFloat(n.freq).toFixed(1)} MHz`);
  });
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
