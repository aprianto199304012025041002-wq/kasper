import './style.css';
import './components/header.css';
import './components/stats.css';
import './components/grid.css';
import './components/band.css';
import './components/detail-page.css';
import { fetchSpectrum, fetchStationDetail, fetchInterference, isUsingFallback } from './apiClient.js';
import { renderDetailPage } from './detailPage.js';
import { renderInterferencePanel } from './interferenceView.js';
import { initMobileUI, openFilterDrawer, syncFilterBadge } from './mobile.js';
import { computeChannelMapForWilayah } from './channelEngine.js';
import './components/responsive.css';

const JENIS_LABELS = {
  swasta:'Swasta', publik:'Publik (RRI)', publik_lokal:'Publik Lokal (LPPL)', komunitas:'Komunitas',
};

// ── State ─────────────────────────────────────────────────────────────
let state = {
  page:           'main',
  view:           'grid',
  filterCities:   [],
  filterChanView: 'all',
  searchTerm:     '',
  geoSettings:    { showAdj: true, showLabel: true, onlyFree: false },
  data:           null,
  interfData:     null,
  loading:        false,
  error:          null,
};

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  document.getElementById('app').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
      font-family:var(--font-mono);font-size:13px;color:var(--text-tertiary)">
      <span class="live-dot"></span>&nbsp;Memuat data spektrum…
    </div>`;

  renderShell();
  attachEvents();
  await loadData();

  // Mobile UI
  const mob = initMobileUI(
    () => state,
    (view) => {
      state.view = view;
      state.page = 'main';
      renderControls();
      renderContent();
    },
    async (page) => {
      state.page = page;
      state.view = state.view || 'grid';
      if (page === 'interference' && !state.interfData) await loadInterference();
      else renderContent();
    },
    (filters) => {
      if (filters.filterCities   !== undefined) state.filterCities   = filters.filterCities;
      if (filters.filterChanView !== undefined) state.filterChanView = filters.filterChanView;
      if (filters.searchTerm     !== undefined) state.searchTerm     = filters.searchTerm;
      if (filters.geoSettings    !== undefined) state.geoSettings    = { ...state.geoSettings, ...filters.geoSettings };
      renderControls();
      loadData();
    }
  );
  window.__openMobFilter = () => openFilterDrawer();
  window.__mobSync = mob;
  window._kasperFallback = false; // diupdate setelah loadData
}

// ── Shell ─────────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    <div id="statsBar" style="padding:0 32px;margin-top:16px"></div>
    <div class="view-tab-bar">
      <button class="view-tab ${state.view==='grid'?'is-active':''}" data-view="grid">⊞ Grid</button>
      <button class="view-tab ${state.view==='band'?'is-active':''}" data-view="band">▬ Pita</button>
      <button class="view-tab ${state.view==='geo'?'is-active':''}" data-view="geo">⊟ Geo Grid</button>
      <div class="view-tab-sep"></div>
      <button class="view-tab ${state.page==='interference'?'is-active':''}" data-page="interference">⚡ Interferensi</button>
    </div>
    <main class="main-content" style="padding-top:12px">
      <div id="controlsBar" class="controls-bar"></div>
      <div id="legendBar"></div>
      <div id="dynamicContent"></div>
    </main>
    <div class="tooltip-float" id="tooltip"></div>`;
  renderControls();
}

function attachEvents() {
  document.addEventListener('change', handleChange);
  document.addEventListener('kasper:search', (e) => {
    state.searchTerm = e.detail.searchTerm || '';
    renderContent();
  });
  document.addEventListener('input',  handleInput);
  document.addEventListener('click',  handleClick);
}

function handleChange(e) {
  // filterCity dihapus — filter kabupaten via drawer chips

  if (e.target.id==='fChanView') { state.filterChanView=e.target.value; renderContent(); }
}

let _searchDebounce;
function handleInput(e) {
  if (e.target.id==='fSearch') {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => { state.searchTerm=e.target.value; loadData(); }, 320);
  }
}

async function handleClick(e) {
  const vtBtn = e.target.closest('[data-view]');
  if (vtBtn && !vtBtn.dataset.page) {
    state.view=vtBtn.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.view===state.view));
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.remove('is-active'));
    state.page = 'main';
    renderControls(); renderContent(); return;
  }
  const pagBtn = e.target.closest('[data-page]');
  if (pagBtn) {
    state.page=pagBtn.dataset.page;
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('is-active',b.dataset.page===state.page));
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('is-active'));
    if (state.page==='interference' && !state.interfData) await loadInterference();
    else renderContent(); return;
  }
  const cell = e.target.closest('.ch-cell[data-freq]');
  if (cell && state.data) {
    const freq = parseFloat(cell.dataset.freq);
    const ch = state.data.channel_map.find(c => c.freq === freq);
    if (ch) {
      // Cari semua stasiun di frekuensi ini dari kota yang sama (co-channel)
      const city = cell.closest('.city-row-block')?.querySelector('.city-row-label')?.childNodes[0]?.textContent?.trim();
      const coStations = city
        ? state.data.stations
            .filter(s => Math.abs(parseFloat(s.freq) - freq) < 0.01 && (s.wilayah_layanan || s.kota || s.city) === city)
            .sort((a, b) => (a.stn_name||'').localeCompare(b.stn_name||''))
        : null;
      openInlineDetail(coStations?.length ? { ...ch, coStations } : ch);
    }
    return;
  }
  const nRow = e.target.closest('.neighbor-row[data-freq]');
  if (nRow) { openDetailPage({freq:parseFloat(nRow.dataset.freq)}); return; }
}

// ── Data loading ──────────────────────────────────────────────────────
async function loadData() {
  state.loading=true; state.error=null; state.data=null;
  renderContent();
  const filters = {};
  try {
    state.data    = await fetchSpectrum(filters);
    state.loading = false;
    window._kasperFallback = isUsingFallback();
  } catch(e) { state.error=e.message; state.loading=false; }
  renderControls(); renderContent();
}

async function loadInterference() {
  state.loading=true; renderContent();
  try {
    state.interfData = await fetchInterference({});
  } catch(e) {
    state.interfData = {pairs:[],summary:{},stations_evaluated:0,model:'error:'+e.message};
  }
  state.loading=false; renderContent();
}

async function openDetailPage(stationOrFreq) {
  const freq = stationOrFreq.freq ?? stationOrFreq;

  // Buka drawer dulu dengan loading state
  let el = document.getElementById('stationDrawer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stationDrawer';
    el.className = 'station-drawer';
    el.innerHTML = `<div class="station-drawer__backdrop"></div><div class="station-drawer__panel" id="stationDrawerPanel"></div>`;
    document.body.appendChild(el);
    el.querySelector('.station-drawer__backdrop').addEventListener('click', closeStationDrawer);
  }
  document.getElementById('stationDrawerPanel').innerHTML =
    `<div style="padding:48px;text-align:center;font-family:var(--font-mono);font-size:13px;color:var(--text-tertiary)"><span class="live-dot"></span> Memuat detail…</div>`;
  el.classList.add('is-open');
  document.body.classList.add('drawer-open');

  try {
    const detail = await fetchStationDetail(parseFloat(freq));
    const panel = document.getElementById('stationDrawerPanel');
    renderDetailPage(detail, closeStationDrawer, state.data, panel);
  } catch(e) {
    const panel = document.getElementById('stationDrawerPanel');
    if (panel) panel.innerHTML = `<div class="empty-state" style="padding:32px">Gagal memuat detail: ${e.message}</div>`;
  }
}

function closeStationDrawer() {
  document.getElementById('stationDrawer')?.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
}

// ── Header ────────────────────────────────────────────────────────────
function renderHeader() {
  const dateStr = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  return `<header class="app-header">
    <div class="app-header__inner">
      <div class="app-header__brand">
        <div class="app-header__mark"><span>👻</span></div>
        <div class="app-header__titles">
          <h1>KASPER — KANAL SPEKTRUM RADIO</h1>
          <p>Visualisasi kanal, slot kosong &amp; analisis interferensi</p>
        </div>
      </div>
      <div class="app-header__meta">
        <div class="app-header__meta-item">
          <span class="app-header__meta-label">Band</span>
          <span class="app-header__meta-val mono">87.5–108.0 MHz</span>
        </div>
        <div class="app-header__meta-item">
          <span class="app-header__meta-label">Spasi</span>
          <span class="app-header__meta-val mono">200 kHz</span>
        </div>
        <div class="app-header__meta-item">
          <span class="app-header__meta-label"><span class="live-dot"></span>Update</span>
          <span class="app-header__meta-val mono">${dateStr}</span>
        </div>
      </div>
    </div>
  </header>`;
}

// ── Province tabs ─────────────────────────────────────────────────────

function shortName(name) {
  const map = {
    'DAERAH ISTIMEWA YOGYAKARTA':'D.I. Yogyakarta','JAWA TENGAH':'Jawa Tengah',
    'JAWA TIMUR':'Jawa Timur','JAWA BARAT':'Jawa Barat','DKI JAKARTA':'DKI Jakarta',
    'SUMATERA UTARA':'Sumut','BALI':'Bali','KALIMANTAN SELATAN':'Kalsel',
    'SULAWESI SELATAN':'Sulsel','NUSA TENGGARA BARAT':'NTB',
  };
  return map[name] || name.split(' ').slice(0,2).join(' ');
}

// ── Stats bar ─────────────────────────────────────────────────────────
function updateStatsBar(summary, allotmentStats = null) {
  const el = document.getElementById('statsBar');
  if (!el) return;
  const pctU = summary.pct_used  ?? +((summary.used/summary.total)*100).toFixed(1);
  const pctF = summary.pct_free  ?? +((summary.free/summary.total)*100).toFixed(1);
  const adjTotal = (summary.adjacent ?? ((summary.adjacent_1||0) + (summary.adjacent_2||0)));
  const pctA = +((adjTotal/summary.total)*100).toFixed(1);

  const allotmentHtml = allotmentStats ? `
    <div class="stat-cell">
      <div class="stat-cell__label">Allotted terisi</div>
      <div class="stat-cell__value" style="color:#ffd600">${allotmentStats.allottedUsed}<span class="stat-cell__unit">/ ${allotmentStats.allottedTotal}</span></div>
    </div>
    <div class="stat-cell">
      <div class="stat-cell__label">Allotted kosong</div>
      <div class="stat-cell__value" style="color:#1e90ff">${allotmentStats.allottedFree}</div>
    </div>` : '';

  el.innerHTML = `<div class="stats-bar" style="padding:0;margin:0">
    <div class="stat-cell"><div class="stat-cell__label">Total kanal</div><div class="stat-cell__value">${summary.total}</div></div>
    <div class="stat-cell">
      <div class="stat-cell__label">Terpakai</div>
      <div class="stat-cell__value is-occupied">${summary.used}<span class="stat-cell__unit">${pctU}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctU}%;background:var(--signal-occupied)"></div></div>
    </div>
    <div class="stat-cell">
      <div class="stat-cell__label">Adjacent protected</div>
      <div class="stat-cell__value is-danger">${adjTotal}<span class="stat-cell__unit">${pctA}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctA}%;background:var(--signal-danger)"></div></div>
    </div>
    <div class="stat-cell">
      <div class="stat-cell__label">Kosong / potensial</div>
      <div class="stat-cell__value is-phosphor">${summary.free}<span class="stat-cell__unit">${pctF}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctF}%;background:var(--signal-phosphor)"></div></div>
    </div>
    ${allotmentHtml}
  </div>`;
}

// ── Controls ──────────────────────────────────────────────────────────
function renderControls() {
  const el = document.getElementById('controlsBar');
  if (!el) return;
  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const cities = state.data
    ? [...new Set(state.data.stations
        .map(s=>s.wilayah_layanan||s.kota||s.city)
        .filter(w => w && w !== KOMUNITAS_AOS)
      )].sort()
    : [];
  const src = isUsingFallback()
    ? '<span class="source-badge">⬡ data lokal</span>'
    : '<span class="source-badge is-live"><span class="live-dot"></span> API live</span>';

  // Sembunyikan filter wilayah & tampilkan di geo-grid (ditangani internal)
  const hideCity = state.view === 'geo';

  el.innerHTML = `
    ${state.view !== 'geo' ? `<div class="control-group">
      <span class="control-group__label">Tampilkan</span>
      <select class="control-input" id="fChanView">
        <option value="all"  ${state.filterChanView==='all' ?'selected':''}>Semua kanal</option>
        <option value="free" ${state.filterChanView==='free'?'selected':''}>Kosong saja</option>
        <option value="used" ${state.filterChanView==='used'?'selected':''}>Terpakai saja</option>
      </select>
    </div>` : ''}
    <input type="search" class="control-input search-input" id="fSearch"
      placeholder="Cari stasiun / frekuensi…" value="${state.searchTerm}" style="width:200px"/>
    <button class="mob-filter-btn" id="mobFilterBtn" onclick="window.__openMobFilter()">
      ⚙ Filter
      <span class="mob-badge"></span>
    </button>
    <div style="margin-left:auto;display:flex;align-items:center">
      ${src}
    </div>`;
}

// ── Legend dinamis ────────────────────────────────────────────────────
function renderLegend() {
  const el = document.getElementById('legendBar');
  if (!el || !state.data) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = `<div class="legend-strip">
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:rgba(255,214,0,.13);border-color:#ffd600"></span>
      <span>Terpakai</span>
    </div>
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:rgba(255,45,45,.1);border-color:#ff2d2d;border-style:dashed"></span>
      <span>Adjacent (guard)</span>
    </div>
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:rgba(30,144,255,.13);border-color:#1e90ff"></span>
      <span>Allotted ★ (kosong)</span>
    </div>
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:rgba(192,132,252,.13);border-color:#c084fc;border-style:dashed"></span>
      <span>Allotted RRI ▣</span>
    </div>
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);opacity:0.5"></span>
      <span>Tidak dijatahkan ·</span>
    </div>
  </div>`;
}

// ── Dynamic content ───────────────────────────────────────────────────
function renderContent() {
  const el = document.getElementById('dynamicContent');
  if (!el) return;

  if (state.loading) {
    el.innerHTML=`<div class="skeleton-band" style="margin-top:12px;height:300px"></div>`;
    return;
  }
  if (state.error) {
    el.innerHTML=`<div class="empty-state">Error: ${state.error}</div>`;
    return;
  }

  if (state.page==='interference') {
    el.innerHTML='<div id="interfPanel"></div>';
    if (state.interfData) renderInterferencePanel(document.getElementById('interfPanel'),state.interfData);
    return;
  }

  if (!state.data) return;

  // ── Pipeline filter — sama untuk semua 3 view ──────────────────────
  updateStatsBar(state.data.summary);
  renderLegend();

  // Hitung allotment stats dari semua cityRows
  let allottedTotal = 0, allottedUsed = 0, allottedFree = 0;
  // Kita hitung setelah cityRows dibangun di bawah, update stats setelahnya

  const searchLower = (state.searchTerm || '').toLowerCase().trim();
  const matchSearch = (c) => {
    if (!searchLower) return true;
    if (c.type !== 'used') return String(c.freq).includes(searchLower);
    return String(c.freq).includes(searchLower)
      || (c.station?.stn_name || '').toLowerCase().includes(searchLower)
      || (c.station?.wilayah_layanan || c.station?.kota || c.station?.city || '').toLowerCase().includes(searchLower);
  };

  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const filterCities = state.filterCities || [];

  // Daftar wilayah layanan yang aktif (non-komunitas) — sama untuk semua view
  const allWilayah = [...new Set(
    state.data.stations
      .map(s => s.wilayah_layanan || s.kota || s.city || '')
      .filter(wl => wl && wl !== KOMUNITAS_AOS)
  )].sort();

  const cityList = filterCities.length > 0
    ? filterCities.filter(c => c !== KOMUNITAS_AOS)
    : allWilayah;

  // ── Build city rows ─────────────────────────────────────────────────
  const cityRows = cityList.map(city => {
    const cityStations = state.data.stations.filter(s => (s.wilayah_layanan || s.kota || s.city) === city);

    // Allotment status dari KM 570/2025 (JS-side, per wilayah)
    const wilayahMap = computeChannelMapForWilayah(cityStations, city);
    const allotmentIndex = {};
    wilayahMap.forEach(c => { allotmentIndex[c.freq] = c.allotment_status; });

    // Pakai channel_map global dari PHP (punya adj1/adj2 lengkap),
    // merge allotment_status ke tiap slot
    const row = state.data.channel_map.map(c => {
      const allotment_status = allotmentIndex[c.freq] ?? null;
      const ownStations = cityStations.filter(s => Math.abs(parseFloat(s.freq) - c.freq) < 0.01);
      if (ownStations.length > 0) {
        return { ...c, allotment_status, type: 'used', station: ownStations[0], coStations: ownStations };
      }
      if (c.type === 'used') return { ...c, allotment_status, type: 'free', station: null };
      return { ...c, allotment_status };
    }).filter(matchSearch);

    return { city, row };
  }).filter(({ row }) => row.some(c => c.type === 'used' || (searchLower && matchSearch(c))));

  // Hitung allotment stats dari semua city rows
  cityRows.forEach(({ row }) => {
    row.forEach(c => {
      if (c.allotment_status === 'allotted_lps' || c.allotment_status === 'allotted_rri') {
        allottedTotal++;
        if (c.type === 'used') allottedUsed++;
        else allottedFree++;
      }
    });
  });
  if (allottedTotal > 0) {
    updateStatsBar(state.data.summary, { allottedTotal, allottedUsed, allottedFree });
  }

  // ── Komunitas row (terpisah, bukan per wilayah layanan) ─────────────
  const komStations = state.data.stations.filter(s => s.jenis === 'komunitas');
  const komRow = komStations.length > 0
    ? state.data.channel_map.map(c => {
        const ownStations = komStations.filter(s => Math.abs(parseFloat(s.freq) - c.freq) < 0.01);
        if (ownStations.length > 0) {
          return { ...c, allotment_status: null, type: 'used', station: ownStations[0], coStations: ownStations };
        }
        // Tampilkan hanya kanal 107.5–107.9 (kanal komunitas) + adj-nya
        if (c.freq < 107.4) return null;
        if (c.type === 'used') return { ...c, allotment_status: null, type: 'free', station: null };
        return { ...c, allotment_status: null };
      }).filter(c => c !== null).filter(matchSearch)
    : null;

  const applyFilter = (row) =>
    state.filterChanView === 'free' ? row.filter(c => c.type === 'free') :
    state.filterChanView === 'used' ? row.filter(c => c.type === 'used' || c.type === 'adjacent_1' || c.type === 'adjacent_2') :
    row;
  if (state.view === 'band') {
    el.innerHTML = `
      <div class="grid-frame" style="padding:12px">
        <div class="city-grid-scroll">
          <div class="city-grid-inner">
            ${cityRows.map(({ city, row }) => {
              const usedCount = state.data.stations.filter(s => (s.wilayah_layanan || s.kota || s.city) === city).length;
              return `<div class="city-row-block">
                <div class="city-row-label">${esc(city)} <span class="city-row-count">${usedCount}</span></div>
                <div class="band-svg-row" data-city="${esc(city)}">${renderBandSVG(row, city)}</div>
              </div>`;
            }).join('')}
            ${komRow ? `<div class="city-row-block city-row-block--komunitas">
              <div class="city-row-label" style="color:#f97316">KOMUNITAS <span class="city-row-count" style="font-size:9px">±2.5km</span></div>
              <div class="band-svg-row" data-city="KOMUNITAS">${renderBandSVG(komRow, 'KOMUNITAS')}</div>
            </div>` : ''}
          </div>
        </div>
      </div>`;

    // Click handler untuk band SVG — sama seperti grid, sertakan coStations
    el.querySelectorAll('.band-hit[data-freq]').forEach(hit => {
      hit.addEventListener('click', () => {
        const freq = parseFloat(hit.dataset.freq);
        const ch = state.data.channel_map.find(c => Math.abs(c.freq - freq) < 0.01);
        if (!ch) return;
        const cityEl = hit.closest('.city-row-block')?.querySelector('.city-row-label');
        const city = cityEl?.childNodes[0]?.textContent?.trim();
        const coStations = city
          ? state.data.stations
              .filter(s => Math.abs(parseFloat(s.freq) - freq) < 0.01 && (s.wilayah_layanan || s.kota || s.city) === city)
              .sort((a, b) => (a.stn_name||'').localeCompare(b.stn_name||''))
          : null;
        openInlineDetail(coStations?.length ? { ...ch, coStations } : ch);
      });
    });
    return;
  }

  // ── Grid & Geo: cell-per-cell ──────────────────────────────────────
  const cellFn = state.view === 'geo' ? renderCellGeo : renderCell;

  el.innerHTML = `
    <div class="grid-frame" style="padding:12px">
      <div class="city-grid-scroll">
        <div class="city-grid-inner">
          ${cityRows.map(({ city, row }) => {
            const usedCount = state.data.stations.filter(s => (s.wilayah_layanan || s.kota || s.city) === city).length;
            const filtered = applyFilter(row);
            return `<div class="city-row-block">
              <div class="city-row-label">${esc(city)} <span class="city-row-count">${usedCount}</span></div>
              <div class="ch-grid-row">${filtered.map(c => cellFn(c, city)).join('')}</div>
            </div>`;
          }).join('')}
          ${komRow ? `<div class="city-row-block city-row-block--komunitas">
            <div class="city-row-label" style="color:#f97316">KOMUNITAS <span class="city-row-count" style="font-size:9px">±2.5km · ${komStations.length} stasiun</span></div>
            <div class="ch-grid-row">${applyFilter(komRow).map(c => cellFn(c, 'KOMUNITAS')).join('')}</div>
          </div>` : ''}
        </div>
      </div>
    </div>`;

  attachCellTooltips(state.data.channel_map);
}

// ── Adj direction symbol ──────────────────────────────────────────────
// adj_left  = ada stasiun di kiri → panah kanan (>) karena interferensi datang dari kiri
// adj_right = ada stasiun di kanan → panah kiri (<) karena interferensi datang dari kanan
function adjSymbol(c) {
  // Panah menunjuk KE ARAH stasiunnya:
  // adj_left  = stasiun di KIRI  → '<'  (adj-1) atau '<<' (adj-2)
  // adj_right = stasiun di KANAN → '>'  (adj-1) atau '>>' (adj-2)
  // Per sisi: adj-1 menang atas adj-2
  const a1L = !!(c.adj1_left  || (c.type === 'adjacent_1' && c.adj_left));
  const a1R = !!(c.adj1_right || (c.type === 'adjacent_1' && c.adj_right));
  const a2L = !!(c.adj2_left  || (c.type === 'adjacent_2' && c.adj_left));
  const a2R = !!(c.adj2_right || (c.type === 'adjacent_2' && c.adj_right));

  const fromLeft  = a1L ? '<'  : a2L ? '<<' : '';
  const fromRight = a1R ? '>'  : a2R ? '>>' : '';

  if (fromLeft || fromRight) return fromLeft + fromRight;
  return '?';
}

// ── Cell render ───────────────────────────────────────────────────────
function firstWord(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

function renderCell(c) {
  if (c.type==='used') {
    const label = firstWord(c.station?.stn_name);
    const co = c.coStations?.length > 1 ? `<span class="ch-cell__co">${c.coStations.length}</span>` : '';
    return `<div class="ch-cell ch-cell--used" data-freq="${c.freq}" title="${esc(c.station?.stn_name||'')}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${esc(label)}</span>
      ${co}
    </div>`;
  }
  if (c.type==='adjacent_1') {
    const sym = adjSymbol(c);
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj1" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${sym}</span>
    </div>`;
  }
  if (c.type==='adjacent_2') {
    const sym = adjSymbol(c);
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj2" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${sym}</span>
    </div>`;
  }
  const allotClass = c.allotment_status === 'allotted_rri' ? ' ch-cell--allotted-rri'
                   : c.allotment_status === 'allotted_lps' ? ' ch-cell--allotted-lps'
                   : c.allotment_status === 'not_allotted'  ? ' ch-cell--not-allotted'
                   : '';
  const allotIcon  = c.allotment_status === 'allotted_rri' ? '▣'
                   : c.allotment_status === 'allotted_lps' ? '★' : '·';
  return `<div class="ch-cell ch-cell--free${allotClass}" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">${allotIcon}</span>
  </div>`;
}

// ── Band view: SVG spectrum per kota ─────────────────────────────────
const FM_MIN_B = 87.5, FM_MAX_B = 108.0;
const SVG_W_PER_MHZ = 200;  // 200px per MHz = 20px per 100kHz step
const SVG_H = 110;           // lebih tinggi untuk ruler di bawah
const RULER_H = 20;          // tinggi area ruler
const AMP_MIN = 12, AMP_MAX = 48;
const SINE_STEPS = 40;
const SLOT_PX = SVG_W_PER_MHZ * 0.1;  // 20px per 100kHz step

function erpAmp(erp) {
  const ratio = Math.max(0, Math.min(1, ((erp || 60) - 40) / (78 - 40)));
  return AMP_MIN + ratio * (AMP_MAX - AMP_MIN);
}

function freqToX(freq) {
  return (freq - FM_MIN_B) * SVG_W_PER_MHZ;
}

function renderBandSVG(row, city) {
  const totalW = (FM_MAX_B - FM_MIN_B) * SVG_W_PER_MHZ + 40;
  const cy = SVG_H - RULER_H - 6;  // baseline di atas ruler

  const COLOR_USED  = '#ffd600';
  const COLOR_ADJ1  = '#ff2d2d';
  const COLOR_ADJ2  = 'rgba(255,45,45,0.5)';
  const COLOR_FREE  = '#1e90ff';

  let paths   = [];
  let markers = [];
  let hits    = [];
  let labels  = [];

  const slotHalfW = SLOT_PX;

  for (const c of row) {
    const x = freqToX(c.freq);

    if (c.type === 'used') {
      const coStations = c.coStations || [c.station];
      const count = coStations.length;
      const avgErp = coStations.reduce((s, st) => s + (st?.erp_dbm || 60), 0) / coStations.length;
      const amp = erpAmp(avgErp);
      // Arch: puncak di center freq, kaki di ±100kHz (pas di posisi adj-1)
      // Adj-1 = ±100kHz, Adj-2 = ±200kHz, step = 100kHz
      const archW = SLOT_PX * 1; // ±100kHz = 1 step
      const x0 = x - archW;
      const x1 = x + archW;
      const pts = [];
      for (let i = 0; i <= SINE_STEPS; i++) {
        const t = i / SINE_STEPS;
        const px = x0 + t * (x1 - x0);
        const py = cy - amp * Math.sin(Math.PI * t);
        pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
      }
      const d = pts.join(' ');
      const fillD = `${d} L${x1.toFixed(1)},${cy} L${x0.toFixed(1)},${cy} Z`;
      paths.push(`<path d="${fillD}" fill="${COLOR_USED}" opacity="0.13"/>`);
      paths.push(`<path d="${d}" stroke="${COLOR_USED}" stroke-width="1.8" fill="none" opacity="0.95"/>`);
      const badge = count > 1 ? ` ×${count}` : '';
      labels.push(`<text x="${x.toFixed(1)}" y="${(cy - amp - 4).toFixed(1)}" text-anchor="middle" font-size="7" fill="${COLOR_USED}" opacity="0.9" font-family="monospace">${c.freq.toFixed(1)}${badge}</text>`);
      labels.push(`<text x="${x.toFixed(1)}" y="${(cy + RULER_H - 4).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${COLOR_USED}" font-family="monospace" opacity="0.7">${c.freq.toFixed(1)}</text>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${x0.toFixed(1)}" y="0" width="${(x1 - x0).toFixed(1)}" height="${cy}" fill="transparent" style="cursor:pointer"/>`);

    } else if (c.type === 'adjacent_1' || c.type === 'adjacent_2') {
      const is2   = c.type === 'adjacent_2';
      const sym   = adjSymbol(c);
      const color = is2 ? COLOR_ADJ2 : COLOR_ADJ1;
      const tickH = is2 ? 8 : 14;
      const arrowY = cy - tickH - 2;

      // Garis vertikal dashed
      markers.push(`<line x1="${x.toFixed(1)}" y1="${cy}" x2="${x.toFixed(1)}" y2="${(cy - tickH).toFixed(1)}" stroke="${color}" stroke-width="${is2?1:1.5}" stroke-dasharray="3,2"/>`);
      // Simbol arah di atas garis
      markers.push(`<text x="${x.toFixed(1)}" y="${arrowY.toFixed(1)}" text-anchor="middle" font-size="7" fill="${color}" font-family="monospace" font-weight="700">${sym}</text>`);
      // Label frekuensi di bawah baseline
      markers.push(`<text x="${x.toFixed(1)}" y="${(cy + RULER_H - 4).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${color}" font-family="monospace" opacity="0.8">${c.freq.toFixed(1)}</text>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${(x - SLOT_PX/2).toFixed(1)}" y="0" width="${SLOT_PX.toFixed(1)}" height="${cy}" fill="transparent" style="cursor:pointer"/>`);

    } else {
      // Free — bedakan: allotted (bisa diisi) vs not_allotted (tidak dijatahkan)
      const isAllotted = c.allotment_status === 'allotted_lps' || c.allotment_status === 'allotted_rri';
      const isRRI      = c.allotment_status === 'allotted_rri';
      const dotColor   = isRRI ? '#c084fc' : isAllotted ? COLOR_FREE : 'rgba(255,255,255,0.18)';
      const dotR       = isAllotted ? 3.5 : 2;
      const dotOp      = isAllotted ? 0.85 : 0.35;
      const labelOp    = isAllotted ? 0.7 : 0.25;
      markers.push(`<circle cx="${x.toFixed(1)}" cy="${cy}" r="${dotR}" fill="${dotColor}" opacity="${dotOp}"/>`);
      markers.push(`<text x="${x.toFixed(1)}" y="${(cy + RULER_H - 4).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${dotColor}" font-family="monospace" opacity="${labelOp}">${c.freq.toFixed(1)}</text>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${(x - SLOT_PX/2).toFixed(1)}" y="0" width="${SLOT_PX.toFixed(1)}" height="${cy}" fill="transparent" style="cursor:pointer"/>`);
    }
  }

  // Baseline
  const baseline = `<line x1="0" y1="${cy}" x2="${totalW}" y2="${cy}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

  // Ruler frekuensi di bawah baseline
  let rulerParts = [];
  const rulerY = cy + 4;
  for (let f = FM_MIN_B; f <= FM_MAX_B + 0.01; f = Math.round((f + 0.1) * 10) / 10) {
    const rx = freqToX(f);
    const isMajor = Math.round(f * 10) % 10 === 0; // setiap 1 MHz
    const isMid   = Math.round(f * 10) % 5 === 0 && !isMajor; // setiap 0.5 MHz
    if (isMajor) {
      rulerParts.push(`<line x1="${rx.toFixed(1)}" y1="${rulerY}" x2="${rx.toFixed(1)}" y2="${(rulerY + 6)}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`);
      rulerParts.push(`<text x="${rx.toFixed(1)}" y="${(rulerY + 16)}" text-anchor="middle" font-size="7.5" fill="rgba(255,255,255,0.35)" font-family="monospace">${f.toFixed(0)}</text>`);
    } else if (isMid) {
      rulerParts.push(`<line x1="${rx.toFixed(1)}" y1="${rulerY}" x2="${rx.toFixed(1)}" y2="${(rulerY + 4)}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`);
    } else {
      rulerParts.push(`<line x1="${rx.toFixed(1)}" y1="${rulerY}" x2="${rx.toFixed(1)}" y2="${(rulerY + 2)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${SVG_H}" style="display:block">
    ${baseline}
    ${rulerParts.join('')}
    ${markers.join('')}
    ${paths.join('')}
    ${labels.join('')}
    ${hits.join('')}
  </svg>`;
}

// ── Cell renderer: Geo Grid (warna solid per wilayah layanan) ────────
function renderCellGeo(c, city) {
  if (c.type === 'used') {
    const co = c.coStations?.length > 1 ? `<span class="ch-cell__co">${c.coStations.length}</span>` : '';
    return `<div class="ch-cell ch-cell--used ch-cell--geo-used" data-freq="${c.freq}" title="${esc(c.station?.stn_name||'')}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      ${co}
    </div>`;
  }
  if (c.type === 'adjacent_1') {
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj1" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    </div>`;
  }
  if (c.type === 'adjacent_2') {
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj2" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    </div>`;
  }
  const allotClass = c.allotment_status === 'allotted_rri' ? ' ch-cell--allotted-rri'
                   : c.allotment_status === 'allotted_lps' ? ' ch-cell--allotted-lps'
                   : c.allotment_status === 'not_allotted'  ? ' ch-cell--not-allotted'
                   : '';
  const allotIcon  = c.allotment_status === 'allotted_rri' ? '▣'
                   : c.allotment_status === 'allotted_lps' ? '★' : '·';
  return `<div class="ch-cell ch-cell--free${allotClass}" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">${allotIcon}</span>
  </div>`;
}

// ── Tooltip ───────────────────────────────────────────────────────────


function attachCellTooltips(channelMap) {
  document.querySelectorAll('.ch-cell[data-freq]').forEach(cell=>{
    const info=channelMap.find(c=>c.freq===parseFloat(cell.dataset.freq));
    if (!info) return;
    cell.addEventListener('mouseenter',e=>showTooltip(e,info));
    cell.addEventListener('mousemove',moveTooltip);
    cell.addEventListener('mouseleave',hideTooltip);
  });
}


function showTooltip(e,info) {
  const tt=document.getElementById('tooltip');
  let title='',rows=[];
  if (info.type==='used') {
    const s=info.station;
    title=s?.stn_name||info.freq.toFixed(1)+' MHz';
    rows=[
      ['Frekuensi',info.freq.toFixed(3)+' MHz'],
      ['ERP',(s?.erp_dbm||'—')+' dBm'],
      ['Wilayah Layanan',s?.wilayah_layanan||s?.kota||s?.city||'—'],
      ['','▸ Klik untuk detail'],
    ];
  } else if (info.type==='adjacent_1') {
    title=info.freq.toFixed(1)+' MHz — 1st Adjacent (Guard)';
    const a1l = info.adj1_left || info.adj_left;
    const a1r = info.adj1_right || info.adj_right;
    rows=[
      ['Kiri', a1l?.stn_name||'—'],
      ['Kanan',a1r?.stn_name||'—'],
      ['Proteksi','20 dB (ITU-R BS.412)'],
    ];
  } else if (info.type==='adjacent_2') {
    title=info.freq.toFixed(1)+' MHz — 2nd Adjacent';
    const a2l = info.adj2_left || info.adj_left;
    const a2r = info.adj2_right || info.adj_right;
    rows=[
      ['Kiri', a2l?.stn_name||'—'],
      ['Kanan',a2r?.stn_name||'—'],
      ['Proteksi','10 dB (ITU-R BS.412)'],
    ];
  } else {
    const aStatus = info.allotment_status;
    const aLabel  = aStatus === 'allotted_rri' ? 'Allotted — LPP RRI (KM 570/2025)'
                  : aStatus === 'allotted_lps' ? 'Allotted — LPS/LPP Lokal (KM 570/2025)'
                  : aStatus === 'not_allotted'  ? 'Tidak dijatahkan di wilayah ini'
                  : 'Tersedia (wilayah komunitas / tidak diketahui)';
    const icon    = aStatus === 'allotted_rri' ? ' ▣' : aStatus === 'allotted_lps' ? ' ★' : '';
    title=info.freq.toFixed(1)+' MHz — Kosong'+icon;
    rows=[
      ['Lower',(info.lower??info.freq-.1).toFixed(4)+' MHz'],
      ['Upper',(info.upper??info.freq+.1).toFixed(4)+' MHz'],
      ['Allotment', aLabel],
    ];
  }
  tt.innerHTML=`<div class="tooltip-float__title">${esc(title)}</div>`
    +rows.map(([k,v])=>`<div class="tooltip-float__row"><span>${k}</span><span>${esc(String(v))}</span></div>`).join('');
  tt.style.display='block'; moveTooltip(e);
}

function moveTooltip(e){
  const tt=document.getElementById('tooltip'); if(!tt)return;
  let x=e.clientX+14,y=e.clientY-10;
  if(x+270>window.innerWidth) x=e.clientX-280;
  tt.style.left=x+'px'; tt.style.top=y+'px';
}
function hideTooltip(){ const tt=document.getElementById('tooltip'); if(tt) tt.style.display='none'; }

// ── Cell detail drawer (bottom-up) ───────────────────────────────────
function openCellDrawer(html) {
  let el = document.getElementById('cellDrawer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cellDrawer';
    el.className = 'cell-drawer';
    el.innerHTML = `<div class="cell-drawer__backdrop"></div><div class="cell-drawer__panel" id="cellDrawerPanel"></div>`;
    document.body.appendChild(el);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCellDrawer(); }, { passive: true });
  }

  const panel = document.getElementById('cellDrawerPanel');
  panel.scrollTop = 0;
  panel.innerHTML = html;

  if (!el.classList.contains('is-open')) {
    el.classList.add('is-open');
    document.body.classList.add('drawer-open');
  }
}

function closeCellDrawer() {
  const el = document.getElementById('cellDrawer');
  if (!el) return;
  el.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
}

function openInlineDetail(info) {
  const freq = info.freq;
  const lower = (info.lower ?? info.lower_mhz ?? (freq - .1));
  const upper = (info.upper ?? info.upper_mhz ?? (freq + .1));

  const TYPE_META = {
    used:       { badge: 'TERPAKAI',   badgeClass: 'cd-badge--used',  icon: '📻' },
    adjacent_1: { badge: 'ADJ-1',      badgeClass: 'cd-badge--adj1',  icon: '⚡' },
    adjacent_2: { badge: 'ADJ-2',      badgeClass: 'cd-badge--adj2',  icon: '〰' },
    free:       { badge: 'KOSONG',     badgeClass: 'cd-badge--free',  icon: '★'  },
  };
  const meta = TYPE_META[info.type] || TYPE_META.free;

  // Baris konten per type — format [label, value, mono?]
  let rows = [];
  let cta = '';

  if (info.type === 'used') {
    const stations = info.coStations || [info.station];
    const isCoChannel = stations.length > 1;
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz', true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz', true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz', true],
    ];
    if (isCoChannel) {
      const cards = stations
        .slice()
        .sort((a, b) => (a.stn_name||'').localeCompare(b.stn_name||''))
        .map((s, i) => `
          <div class="cd-swipe-card">
            <div class="cd-swipe-num">${i+1} / ${stations.length}</div>
            <div class="cd-swipe-name">${esc(s.stn_name||'—')}</div>
            <div class="cd-grid" style="margin-top:10px">
              <div class="cd-item"><div class="cd-label">Kecamatan</div><div class="cd-val">${esc(s.kecamatan||'—')}</div></div>
              <div class="cd-item"><div class="cd-label">ERP</div><div class="cd-val mono">${s.erp_dbm ? s.erp_dbm.toFixed(1)+' dBm' : '—'}</div></div>
              <div class="cd-item"><div class="cd-label">Jenis</div><div class="cd-val">${esc(s.jenis||'—')}</div></div>
              <div class="cd-item"><div class="cd-label">No. SIMF</div><div class="cd-val mono">${esc(s.no_simf||'—')}</div></div>
            </div>
            <button class="cd-cta" onclick="window.__openDetailFreq(${freq})">Lihat detail stasiun →</button>
          </div>`).join('');

      const html = `
        <div class="cd-head">
          <div class="cd-head-left">
            <span class="cd-badge cd-badge--used">📻 CO-CHANNEL ×${stations.length}</span>
            <span class="cd-freq">${freq.toFixed(1)} MHz</span>
          </div>
          <button class="cd-close" id="cdClose">✕</button>
        </div>
        <div class="cd-swipe-hint">← geser →</div>
        <div class="cd-swipe-wrap">${cards}</div>`;

      openCellDrawer(html);
      document.getElementById('cdClose')?.addEventListener('click', closeCellDrawer);
      // Expose untuk CTA button di dalam card
      window.__openDetailFreq = (f) => { closeCellDrawer(); openDetailPage({freq: f}); };
      return;
    }
    const s = stations[0] || {};
    rows.push(
      ['Nama stasiun', s.stn_name || '—', false],
      ['Wilayah Layanan', s.wilayah_layanan || s.kota || s.city || '—', false],
      ['ERP',         s.erp_dbm ? s.erp_dbm + ' dBm' : '—', true],
    );
    cta = `<button class="cd-cta" id="cdCtaDetail">Lihat detail stasiun →</button>`;
  } else if (info.type === 'adjacent_1') {
    const a1l = info.adj1_left  || info.adj_left;
    const a1r = info.adj1_right || info.adj_right;
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Guard kiri', a1l?.stn_name || '—',               false],
      ['Guard kanan',a1r?.stn_name || '—',               false],
      ['Proteksi',   '20 dB (ITU-R BS.412)',             true],
    ];
  } else if (info.type === 'adjacent_2') {
    const a2l = info.adj2_left  || info.adj_left;
    const a2r = info.adj2_right || info.adj_right;
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Guard kiri', a2l?.stn_name || '—',               false],
      ['Guard kanan',a2r?.stn_name || '—',               false],
      ['Proteksi',   '10 dB (ITU-R BS.412)',             true],
    ];
  } else {
    const aStatus = info.allotment_status;
    const aLabel  = aStatus === 'allotted_rri' ? 'Allotted LPP RRI (KM 570/2025)'
                  : aStatus === 'allotted_lps' ? 'Allotted LPS/LPP Lokal (KM 570/2025)'
                  : aStatus === 'not_allotted'  ? 'Tidak dijatahkan di wilayah ini'
                  : 'Tersedia (wilayah komunitas / tidak diketahui)';
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Lebar kanal','100 kHz',                          true],
      ['Allotment',  aLabel,                             false],
    ];
  }

  const html = `
    <div class="cd-head">
      <div class="cd-head-left">
        <span class="cd-badge ${meta.badgeClass}">${meta.icon} ${meta.badge}</span>
        <span class="cd-freq">${freq.toFixed(1)} MHz</span>
      </div>
      <button class="cd-close" id="cdClose">✕</button>
    </div>
    <div class="cd-grid">
      ${rows.map(([l, v, mono]) => `
        <div class="cd-item">
          <div class="cd-label">${esc(l)}</div>
          <div class="cd-val${mono ? ' mono' : ''}">${esc(String(v))}</div>
        </div>`).join('')}
    </div>
    ${cta}`;

  openCellDrawer(html);

  document.getElementById('cdClose')?.addEventListener('click', closeCellDrawer);
  document.getElementById('cdCtaDetail')?.addEventListener('click', () => {
    closeCellDrawer();
    openDetailPage(info.station);
  });
}

function esc(str){const d=document.createElement('div');d.textContent=String(str);return d.innerHTML;}

boot();

