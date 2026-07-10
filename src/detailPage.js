// src/detailPage.js
// Render halaman detail satu stasiun: info lengkap, peta Leaflet, tetangga band, interferensi lokal.

const REGION_COLORS = {
  'KOTA YOGYAKARTA': '#4a90d9',
  SLEMAN:            '#5ee69c',
  BANTUL:            '#e6b85c',
  GUNUNGKIDUL:       '#d97a9c',
  'KULON PROGO':     '#9d8ce6',
};

const JENIS_LABELS = {
  swasta:      'Swasta',
  publik:      'Publik (RRI)',
  publik_lokal:'Publik Lokal (LPPL)',
  komunitas:   'Komunitas',
};

const FM_MIN = 87.5, FM_MAX = 108.0;

/**
 * Render halaman detail ke #app
 * @param {Object} data    - { data: stationRow, neighbors: [] }
 * @param {Function} onBack - callback untuk kembali ke halaman utama
 * @param {Object}  allData - data spektrum lengkap (untuk mini band strip)
 */
export function renderDetailPage(data, onBack, allData) {
  const s   = data.data;
  const nbr = data.neighbors || [];

  const freq      = parseFloat(s.freq || s['freq']);
  const lowerMhz  = s.lower_mhz ?? (freq - (parseFloat(s.bw_khz || s.bwidth || 200) / 2 / 1000));
  const upperMhz  = s.upper_mhz ?? (freq + (parseFloat(s.bw_khz || s.bwidth || 200) / 2 / 1000));
  const bwKhz     = s.bw_khz || s.bwidth || 200;
  const statusCls = (s.status || s.lic_status || '').toLowerCase() === 'granted' ? 'is-granted' : 'is-expired';
  const jenis     = s.jenis || classifyJenis(s.clnt_name || '');
  const color     = REGION_COLORS[s.kota || s.city] || '#888';

  const kota      = s.kota || s.city || '—';
  const stnName   = s.stn_name || '—';
  const clntName  = s.clnt_name || '—';
  const erp       = s.erp_dbm || s.erp_pwr_dbm || '—';
  const status    = s.status || s.lic_status || '—';
  const validity  = s.validity || s.lic_expiry || '—';
  const noSimf    = s.no_simf || '—';
  const district  = s.kecamatan || s.district || '—';
  const lat       = parseFloat(s.latitude)  || null;
  const lon       = parseFloat(s.longitude) || null;

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-header__brand">
          <div class="app-header__mark"><span>FM</span></div>
          <div class="app-header__titles">
            <h1>${esc(stnName)}</h1>
            <p>Detail Stasiun · ${freq.toFixed(1)} MHz · ${esc(kota)}</p>
          </div>
        </div>
      </div>
    </header>

    <main class="page-detail">
      <button class="back-btn" id="backBtn">← Kembali ke peta spektrum</button>

      <!-- Hero block -->
      <div class="detail-hero">
        <div class="detail-hero__main">
          <div class="detail-hero__freq">
            ${freq.toFixed(1)}<span class="detail-hero__unit">MHz</span>
          </div>
          <div class="detail-hero__name">${esc(stnName)}</div>
          <div class="detail-hero__clnt">${esc(clntName)}</div>
        </div>
        <div class="detail-hero__meta">
          <div>
            <div class="dmeta__label">Lower</div>
            <div class="dmeta__val">${Number(lowerMhz).toFixed(4)} MHz</div>
          </div>
          <div>
            <div class="dmeta__label">Upper</div>
            <div class="dmeta__val">${Number(upperMhz).toFixed(4)} MHz</div>
          </div>
          <div>
            <div class="dmeta__label">Bandwidth</div>
            <div class="dmeta__val">${bwKhz} kHz</div>
          </div>
          <div>
            <div class="dmeta__label">ERP</div>
            <div class="dmeta__val">${erp} dBm</div>
          </div>
          <div>
            <div class="dmeta__label">Status</div>
            <div class="dmeta__val ${statusCls}">${status}</div>
          </div>
          <div>
            <div class="dmeta__label">Berlaku s.d.</div>
            <div class="dmeta__val">${validity}</div>
          </div>
          <div>
            <div class="dmeta__label">No. SIMF</div>
            <div class="dmeta__val" style="font-size:11px">${noSimf}</div>
          </div>
          <div>
            <div class="dmeta__label">Jenis siaran</div>
            <div class="dmeta__val">${JENIS_LABELS[jenis] || jenis}</div>
          </div>
          <div>
            <div class="dmeta__label">Wilayah</div>
            <div class="dmeta__val">${esc(kota)}</div>
          </div>
          <div>
            <div class="dmeta__label">Kecamatan</div>
            <div class="dmeta__val">${esc(district)}</div>
          </div>
        </div>
      </div>

      <!-- Mini band strip: posisi stasiun ini di antara tetangga -->
      <div class="freq-band-strip">
        <div class="fbs-label">Posisi di band FM (±2 MHz)</div>
        <div id="miniBand"></div>
      </div>

      <!-- Peta lokasi -->
      <div class="map-frame">
        <div class="map-frame__head">
          Lokasi pemancar
          ${lat && lon ? `· ${lat.toFixed(6)}, ${lon.toFixed(6)}` : '· Koordinat belum tersedia di database'}
        </div>
        <div id="stationMap"></div>
      </div>

      <!-- Tetangga band -->
      <div class="neighbor-section">
        <div class="neighbor-header">
          Stasiun tetangga (±2 MHz di provinsi sama) — ${nbr.length} stasiun
        </div>
        ${nbr.length === 0
          ? `<div style="padding:20px 18px;font-size:13px;color:var(--text-tertiary)">Tidak ada data tetangga.</div>`
          : nbr.map((n) => {
              const nFreq = parseFloat(n.freq);
              const diff  = (nFreq - freq).toFixed(1);
              const sign  = parseFloat(diff) > 0 ? '+' : '';
              return `
                <div class="neighbor-row" data-freq="${nFreq}">
                  <div>
                    <div class="neighbor-row__freq">${nFreq.toFixed(1)}</div>
                    <div class="neighbor-row__diff">${sign}${diff} MHz</div>
                  </div>
                  <div style="color:var(--text-primary);font-size:13px">${esc(n.stn_name || '—')}</div>
                  <div style="color:var(--text-secondary);font-size:12px">${esc(n.kota || '—')}</div>
                  <div class="neighbor-row__erp">${n.erp_dbm || '—'} dBm</div>
                  <div><span class="badge badge--${statusBadge(n.status)}">${n.status || '—'}</span></div>
                </div>`;
            }).join('')}
      </div>
    </main>
  `;

  document.getElementById('backBtn').addEventListener('click', onBack);

  // Mini band strip
  renderMiniBand(freq, nbr, lowerMhz, upperMhz, color);

  // Peta Leaflet
  initMap(lat, lon, stnName, freq, nbr);
}

// ── Mini band strip SVG ───────────────────────────────────────────────
function renderMiniBand(centerFreq, neighbors, lower, upper, color) {
  const wrap  = document.getElementById('miniBand');
  if (!wrap) return;

  const viewMin = Math.max(FM_MIN, centerFreq - 2.2);
  const viewMax = Math.min(FM_MAX, centerFreq + 2.2);
  const W       = 800;
  const H       = 60;

  function px(f) { return ((f - viewMin) / (viewMax - viewMin)) * (W - 40) + 20; }

  // Current station block
  const cx    = px(centerFreq);
  const lx    = px(Number(lower));
  const ux    = px(Number(upper));
  const bw    = Math.max(ux - lx, 4);

  let rects = '';

  // Neighbors
  neighbors.forEach((n) => {
    const nf = parseFloat(n.freq);
    if (nf < viewMin || nf > viewMax) return;
    const nx = px(nf);
    rects += `<rect x="${nx-3}" y="8" width="6" height="32" rx="2" fill="var(--text-tertiary)" opacity="0.6"/>
              <text x="${nx}" y="${H - 2}" text-anchor="middle" font-size="9" font-family="monospace" fill="var(--text-tertiary)">${nf.toFixed(1)}</text>`;
  });

  // Current station
  rects += `<rect x="${lx}" y="6" width="${bw}" height="36" rx="3" fill="${color}33" stroke="${color}" stroke-width="1.5"/>
            <text x="${cx}" y="27" text-anchor="middle" font-size="10" font-weight="600" font-family="monospace" fill="${color}">${centerFreq.toFixed(1)}</text>`;

  // Ruler ticks
  let ticks = '';
  for (let f = Math.ceil(viewMin * 10) / 10; f <= viewMax; f = Math.round((f + 0.2) * 10) / 10) {
    const x = px(f);
    const isMajor = Math.abs(f % 1) < 0.05 || Math.abs(f % 1 - 1) < 0.05;
    ticks += `<line x1="${x}" y1="44" x2="${x}" y2="${44 + (isMajor ? 8 : 4)}" stroke="var(--text-tertiary)" stroke-width="0.5" opacity="${isMajor ? 0.5 : 0.25}"/>`;
    if (isMajor) {
      ticks += `<text x="${x}" y="60" text-anchor="middle" font-size="9" font-family="monospace" fill="var(--text-tertiary)" opacity="0.6">${f.toFixed(0)}</text>`;
    }
  }

  wrap.innerHTML = `
    <svg width="100%" viewBox="0 0 ${W} ${H + 4}" style="display:block">
      <rect x="0" y="0" width="${W}" height="${H}" rx="4" fill="var(--bg-input)" opacity="0.5"/>
      ${rects}
      ${ticks}
    </svg>`;
}

// ── Leaflet map ───────────────────────────────────────────────────────
function initMap(lat, lon, stnName, freq, neighbors) {
  const mapEl = document.getElementById('stationMap');
  if (!mapEl) return;

  // Load Leaflet dinamis
  if (!window.L) {
    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initLeaflet(lat, lon, stnName, freq, neighbors, mapEl);
    document.head.appendChild(script);
  } else {
    initLeaflet(lat, lon, stnName, freq, neighbors, mapEl);
  }
}

function initLeaflet(lat, lon, stnName, freq, neighbors, mapEl) {
  if (!lat || !lon) {
    mapEl.style.display     = 'flex';
    mapEl.style.alignItems  = 'center';
    mapEl.style.justifyContent = 'center';
    mapEl.style.color       = 'var(--text-tertiary)';
    mapEl.style.fontSize    = '13px';
    mapEl.innerHTML         = 'Koordinat GPS tidak tersedia di database. Isi kolom latitude/longitude di tabel isr_stations.';
    return;
  }

  const map = L.map(mapEl).setView([lat, lon], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  // Marker utama
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#5ee69c;border:2px solid #0e1410;box-shadow:0 0 8px #5ee69c66"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });

  L.marker([lat, lon], { icon })
    .addTo(map)
    .bindPopup(`<b>${stnName}</b><br>${freq.toFixed(1)} MHz<br>ERP: — dBm`)
    .openPopup();

  // Marker tetangga
  neighbors.forEach((n) => {
    const nLat = parseFloat(n.latitude);
    const nLon = parseFloat(n.longitude);
    if (!nLat || !nLon) return;

    const nIcon = L.divIcon({
      className: '',
      html: `<div style="width:9px;height:9px;border-radius:50%;background:var(--text-tertiary);border:1.5px solid #0e1410"></div>`,
      iconSize: [9, 9], iconAnchor: [4, 4],
    });

    L.marker([nLat, nLon], { icon: nIcon })
      .addTo(map)
      .bindPopup(`<b>${n.stn_name || '—'}</b><br>${parseFloat(n.freq).toFixed(1)} MHz`);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function classifyJenis(clntName) {
  if (/RRI|RADIO REPUBLIK/i.test(clntName)) return 'publik';
  if (/LPPL|LEMBAGA PENYIARAN PUBLIK LOKAL/i.test(clntName)) return 'publik_lokal';
  if (/PERKUMPULAN|KOMUNITAS/i.test(clntName)) return 'komunitas';
  return 'swasta';
}

function statusBadge(status) {
  if (!status) return 'low';
  return status.toLowerCase() === 'granted' ? 'high' : 'low';
}
