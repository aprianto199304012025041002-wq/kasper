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
import './components/responsive.css';

// ── Warna dinamis — di-generate dari HSL berdasar index kota ─────────
const CITY_PALETTE = [
  '#4a90d9','#5ee69c','#e6b85c','#d97a9c','#9d8ce6',
  '#4fd9d0','#e67c5c','#a0d94a','#d9c44a','#7ca8e6',
  '#e64a7c','#5cb8e6','#b8e65c','#e6a04a','#7c5ce6',
  '#4ae6b8','#e65c5c','#5c7ce6','#c8e64a','#e64ac8',
];
const _cityColorMap = {};
let _colorIdx = 0;

function cityColor(kota) {
  if (!kota) return '#888780';
  if (!_cityColorMap[kota]) {
    _cityColorMap[kota] = CITY_PALETTE[_colorIdx % CITY_PALETTE.length];
    _colorIdx++;
  }
  return _cityColorMap[kota];
}

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
    const ch = state.data.channel_map.find(c=>c.freq===parseFloat(cell.dataset.freq));
    if (ch) openInlineDetail(ch); return;
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
    Object.keys(_cityColorMap).forEach(k=>delete _cityColorMap[k]);
    _colorIdx = 0;
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
function updateStatsBar(summary) {
  const el = document.getElementById('statsBar');
  if (!el) return;
  const pctU = summary.pct_used  ?? +((summary.used/summary.total)*100).toFixed(1);
  const pctF = summary.pct_free  ?? +((summary.free/summary.total)*100).toFixed(1);
  const pctA = +((summary.adjacent/summary.total)*100).toFixed(1);
  el.innerHTML = `<div class="stats-bar" style="padding:0;margin:0">
    <div class="stat-cell"><div class="stat-cell__label">Total kanal (200 kHz)</div><div class="stat-cell__value">${summary.total}</div></div>
    <div class="stat-cell">
      <div class="stat-cell__label">Terpakai</div>
      <div class="stat-cell__value is-occupied">${summary.used}<span class="stat-cell__unit">${pctU}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctU}%;background:var(--signal-occupied)"></div></div>
    </div>
    <div class="stat-cell">
      <div class="stat-cell__label">Adjacent protected</div>
      <div class="stat-cell__value is-danger">${summary.adjacent}<span class="stat-cell__unit">${pctA}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctA}%;background:var(--signal-danger)"></div></div>
    </div>
    <div class="stat-cell">
      <div class="stat-cell__label">Kosong / potensial</div>
      <div class="stat-cell__value is-phosphor">${summary.free}<span class="stat-cell__unit">${pctF}%</span></div>
      <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctF}%;background:var(--signal-phosphor)"></div></div>
    </div>
  </div>`;
}

// ── Controls ──────────────────────────────────────────────────────────
function renderControls() {
  const el = document.getElementById('controlsBar');
  if (!el) return;
  const cities = state.data
    ? [...new Set(state.data.stations.map(s=>s.kota||s.city).filter(Boolean))].sort()
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
  if (!el || !state.data || state.view === 'geo') { if (el) el.innerHTML = ''; return; }
  const cities = [...new Set(state.data.stations.map(s=>s.kota||s.city).filter(Boolean))].sort();
  el.innerHTML = `<div class="legend-strip">
    ${cities.map(c=>{
      const col = cityColor(c);
      return `<div class="legend-chip">
        <span class="legend-chip__swatch" style="background:${col}22;border-color:${col}"></span>
        <span>${c}</span>
      </div>`;
    }).join('')}
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:var(--signal-danger-dim);border-color:var(--signal-danger);border-style:dashed"></span>
      <span>Adjacent</span>
    </div>
    <div class="legend-chip">
      <span class="legend-chip__swatch" style="background:var(--signal-phosphor-dim);border-color:var(--signal-phosphor)"></span>
      <span>Kosong ★</span>
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
  const activeCities = state.filterCities || [];

  const baseMap = activeCities.length === 0
    ? state.data.channel_map
    : state.data.channel_map.map(c => {
        if (c.type === 'used') {
          const kota = c.station?.kota || c.station?.city;
          return activeCities.includes(kota) ? c : { ...c, type: 'free', station: null };
        }
        if (c.type === 'adjacent_1' || c.type === 'adjacent_2') {
          const kotaL = c.adj_left?.kota  || c.adj_left?.city;
          const kotaR = c.adj_right?.kota || c.adj_right?.city;
          const keepL = kotaL && activeCities.includes(kotaL) ? c.adj_left  : null;
          const keepR = kotaR && activeCities.includes(kotaR) ? c.adj_right : null;
          if (keepL || keepR) return { ...c, adj_left: keepL, adj_right: keepR };
          return { ...c, type: 'free', adj_left: null, adj_right: null };
        }
        return c;
      });

  updateStatsBar(state.data.summary);
  renderLegend();

  let chMap = baseMap;
  if (state.filterChanView==='free') chMap=chMap.filter(c=>c.type==='free');
  if (state.filterChanView==='used') chMap=chMap.filter(c=>c.type==='used'||c.type==='adjacent_1'||c.type==='adjacent_2');

  const searchLower = (state.searchTerm || '').toLowerCase().trim();
  const matchSearch = (c) => {
    if (!searchLower) return true;
    if (c.type !== 'used') return String(c.freq).includes(searchLower);
    return String(c.freq).includes(searchLower)
      || (c.station?.stn_name || '').toLowerCase().includes(searchLower)
      || (c.station?.kota || c.station?.city || '').toLowerCase().includes(searchLower);
  };

  // Daftar kota yang aktif — sama untuk semua view
  const cityList = activeCities.length > 0
    ? activeCities
    : [...new Set(
        state.data.channel_map
          .filter(c => c.type === 'used')
          .map(c => c.station?.kota || c.station?.city || '')
          .filter(Boolean)
      )].sort();

  // ── Build city rows ─────────────────────────────────────────────────
  const cityRows = cityList.map(city => {
    const row = baseMap.map(c => {
      if (c.type === 'used') {
        return (c.station?.kota || c.station?.city) === city
          ? c : { ...c, type: 'free', station: null };
      }
      if (c.type === 'adjacent_1' || c.type === 'adjacent_2') {
        const kotaL = c.adj_left?.kota  || c.adj_left?.city;
        const kotaR = c.adj_right?.kota || c.adj_right?.city;
        const keepL = kotaL === city ? c.adj_left  : null;
        const keepR = kotaR === city ? c.adj_right : null;
        if (keepL || keepR) return { ...c, adj_left: keepL, adj_right: keepR };
        return { ...c, type: 'free', adj_left: null, adj_right: null };
      }
      return c;
    }).filter(matchSearch);
    return { city, row };
  }).filter(({ row }) => row.some(c => c.type === 'used' || (searchLower && matchSearch(c))));

  const applyFilter = (row) =>
    state.filterChanView === 'free' ? row.filter(c => c.type === 'free') :
    state.filterChanView === 'used' ? row.filter(c => c.type === 'used' || c.type === 'adjacent_1' || c.type === 'adjacent_2') :
    row;

  // ── Band view: SVG spectrum per kota ──────────────────────────────
  if (state.view === 'band') {
    el.innerHTML = `
      <div class="grid-frame" style="padding:12px">
        <div class="city-grid-scroll">
          <div class="city-grid-inner">
            ${cityRows.map(({ city, row }) => {
              const usedCount = state.data.stations.filter(s => (s.kota || s.city) === city).length;
              return `<div class="city-row-block">
                <div class="city-row-label">${esc(city)} <span class="city-row-count">${usedCount}</span></div>
                <div class="band-svg-row" data-city="${esc(city)}">${renderBandSVG(row, city)}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    // Click handler untuk band SVG
    el.querySelectorAll('.band-hit[data-freq]').forEach(hit => {
      hit.addEventListener('click', () => {
        const freq = parseFloat(hit.dataset.freq);
        const ch = state.data.channel_map.find(c => Math.abs(c.freq - freq) < 0.01);
        if (ch) openInlineDetail(ch);
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
            const usedCount = state.data.stations.filter(s => (s.kota || s.city) === city).length;
            const filtered = applyFilter(row);
            return `<div class="city-row-block">
              <div class="city-row-label">${esc(city)} <span class="city-row-count">${usedCount}</span></div>
              <div class="ch-grid-row">${filtered.map(c => cellFn(c, city)).join('')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  attachCellTooltips(state.data.channel_map);
}

// ── Cell render ───────────────────────────────────────────────────────
function firstWord(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

function renderCell(c) {
  if (c.type==='used') {
    const color = cityColor(c.station?.kota||c.station?.city);
    const label = firstWord(c.station?.stn_name);
    return `<div class="ch-cell ch-cell--used" style="--cell-color:${color}" data-freq="${c.freq}" title="${esc(c.station?.stn_name||'')}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${esc(label)}</span>
    </div>`;
  }
  if (c.type==='adjacent_1') {
    const dir = c.adj_left&&c.adj_right?'◄►':c.adj_left?'◄':'►';
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj1" data-freq="${c.freq}" title="1st adjacent — guard ketat (20 dB)">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${dir}</span>
    </div>`;
  }
  if (c.type==='adjacent_2') {
    const dir = c.adj_left&&c.adj_right?'◄►':c.adj_left?'◄':'►';
    return `<div class="ch-cell ch-cell--adjacent ch-cell--adj2" data-freq="${c.freq}" title="2nd adjacent — guard lunak (10 dB)">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${dir}${dir}</span>
    </div>`;
  }
  return `<div class="ch-cell ch-cell--free" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">★</span>
  </div>`;
}

// ── Band view: SVG spectrum per kota ─────────────────────────────────
const FM_MIN_B = 87.5, FM_MAX_B = 108.0;
const SVG_W_PER_MHZ = 52;   // sama dengan grid cell spacing
const SVG_H = 72;            // tinggi track
const AMP_MIN = 8, AMP_MAX = 34;   // amplitudo sinus (px)
const SINE_STEPS = 40;       // resolusi kurva per channel

function erpAmp(erp) {
  const ratio = Math.max(0, Math.min(1, ((erp || 60) - 40) / (78 - 40)));
  return AMP_MIN + ratio * (AMP_MAX - AMP_MIN);
}

function freqToX(freq) {
  return (freq - FM_MIN_B) * SVG_W_PER_MHZ;
}

function renderBandSVG(row, city) {
  const totalW = (FM_MAX_B - FM_MIN_B) * SVG_W_PER_MHZ + 40;
  const cy = SVG_H / 2;   // garis tengah
  const color = cityColor(city);

  let pathParts = [];    // path segmen gelombang
  let adjRects  = [];    // rect adjacent
  let freeMarks = [];    // titik free
  let hitAreas  = [];    // invisible hit targets
  let labels    = [];    // label frekuensi

  for (const c of row) {
    const x = freqToX(c.freq);
    const slotW = SVG_W_PER_MHZ * 0.2; // lebar 200 kHz dalam px

    if (c.type === 'used') {
      const amp = erpAmp(c.station?.erp_dbm);
      // Gambar satu arch sinus penuh dari x-slotW/2 ke x+slotW/2
      const x0 = x - slotW;
      const x1 = x + slotW;
      const pts = [];
      for (let i = 0; i <= SINE_STEPS; i++) {
        const t = i / SINE_STEPS;
        const px = x0 + t * (x1 - x0);
        const py = cy - amp * Math.sin(Math.PI * t);
        pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
      }
      pathParts.push(`<path d="${pts.join(' ')}" stroke="${color}" stroke-width="2" fill="none" opacity="0.9"/>`);
      // Area fill di bawah arch
      const fillPts = [...pts, `L${x1.toFixed(1)},${cy} L${x0.toFixed(1)},${cy} Z`];
      pathParts.push(`<path d="${fillPts.join(' ')}" fill="${color}" opacity="0.12"/>`);
      // Label frekuensi
      labels.push(`<text x="${x.toFixed(1)}" y="${(cy - amp - 5).toFixed(1)}" text-anchor="middle" font-size="7" fill="${color}" opacity="0.8">${c.freq.toFixed(1)}</text>`);
      // Hit area
      hitAreas.push(`<rect class="band-hit" data-freq="${c.freq}" x="${(x - slotW).toFixed(1)}" y="0" width="${(slotW * 2).toFixed(1)}" height="${SVG_H}" fill="transparent" style="cursor:pointer"/>`);

    } else if (c.type === 'adjacent_1') {
      adjRects.push(`<rect x="${(x - slotW/2).toFixed(1)}" y="${(cy - 6).toFixed(1)}" width="${slotW.toFixed(1)}" height="12" rx="2" fill="rgba(255,160,0,0.2)" stroke="rgba(255,160,0,0.5)" stroke-width="0.5"/>
        <rect class="band-hit" data-freq="${c.freq}" x="${(x - slotW).toFixed(1)}" y="0" width="${(slotW * 2).toFixed(1)}" height="${SVG_H}" fill="transparent" style="cursor:pointer"/>`);

    } else if (c.type === 'adjacent_2') {
      adjRects.push(`<rect x="${(x - slotW/2).toFixed(1)}" y="${(cy - 4).toFixed(1)}" width="${slotW.toFixed(1)}" height="8" rx="2" fill="rgba(255,100,0,0.15)" stroke="rgba(255,100,0,0.4)" stroke-width="0.5"/>
        <rect class="band-hit" data-freq="${c.freq}" x="${(x - slotW).toFixed(1)}" y="0" width="${(slotW * 2).toFixed(1)}" height="${SVG_H}" fill="transparent" style="cursor:pointer"/>`);

    } else {
      // free — titik kecil di garis tengah
      freeMarks.push(`<circle cx="${x.toFixed(1)}" cy="${cy}" r="2" fill="rgba(0,230,118,0.3)" stroke="rgba(0,230,118,0.5)" stroke-width="0.5"/>
        <rect class="band-hit" data-freq="${c.freq}" x="${(x - slotW).toFixed(1)}" y="0" width="${(slotW * 2).toFixed(1)}" height="${SVG_H}" fill="transparent" style="cursor:pointer"/>`);
    }
  }

  // Garis baseline tengah
  const baseline = `<line x1="0" y1="${cy}" x2="${totalW}" y2="${cy}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${SVG_H}" style="display:block;overflow:visible">
    ${baseline}
    ${adjRects.join('')}
    ${freeMarks.join('')}
    ${pathParts.join('')}
    ${labels.join('')}
    ${hitAreas.join('')}
  </svg>`;
}

// ── Cell renderer: Pita (lama, tidak dipakai) ─────────────────────────
// Diganti renderBandSVG di atas

// ── Cell renderer: Geo Grid (warna solid per kota, tanpa nama) ────────
function renderCellGeo(c, city) {
  if (c.type === 'used') {
    const color = cityColor(c.station?.kota || c.station?.city);
    return `<div class="ch-cell ch-cell--geo-used" style="--cell-color:${color};background:${color}22;border-color:${color}" data-freq="${c.freq}" title="${esc(c.station?.stn_name||'')}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
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
  return `<div class="ch-cell ch-cell--free" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">★</span>
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
      ['Wilayah',s?.kota||s?.city||'—'],
      ['','▸ Klik untuk detail'],
    ];
  } else if (info.type==='adjacent_1') {
    title=info.freq.toFixed(1)+' MHz — 1st Adjacent (Guard)';
    rows=[
      ['Kiri',info.adj_left?.stn_name||'—'],
      ['Kanan',info.adj_right?.stn_name||'—'],
      ['Proteksi','20 dB separation required'],
    ];
  } else if (info.type==='adjacent_2') {
    title=info.freq.toFixed(1)+' MHz — 2nd Adjacent';
    rows=[
      ['Kiri',info.adj_left?.stn_name||'—'],
      ['Kanan',info.adj_right?.stn_name||'—'],
      ['Proteksi','10 dB separation required'],
    ];
  } else {
    title=info.freq.toFixed(1)+' MHz — Kosong ★';
    rows=[
      ['Lower',(info.lower??info.freq-.1).toFixed(4)+' MHz'],
      ['Upper',(info.upper??info.freq+.1).toFixed(4)+' MHz'],
      ['Status','Tersedia untuk alokasi'],
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
    const s = info.station || {};
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Nama stasiun', s.stn_name || '—',                false],
      ['Wilayah',    s.kota || s.city || '—',            false],
      ['ERP',        s.erp_dbm ? s.erp_dbm + ' dBm' : '—', true],
    ];
    cta = `<button class="cd-cta" id="cdCtaDetail">Lihat detail stasiun →</button>`;
  } else if (info.type === 'adjacent_1') {
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Guard kiri', info.adj_left?.stn_name  || '—',    false],
      ['Guard kanan',info.adj_right?.stn_name || '—',    false],
      ['Proteksi',   '20 dB separation',                 true],
    ];
  } else if (info.type === 'adjacent_2') {
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Guard kiri', info.adj_left?.stn_name  || '—',    false],
      ['Guard kanan',info.adj_right?.stn_name || '—',    false],
      ['Proteksi',   '10 dB separation',                 true],
    ];
  } else {
    rows = [
      ['Frekuensi',  freq.toFixed(3) + ' MHz',           true],
      ['Lower edge', Number(lower).toFixed(4) + ' MHz',  true],
      ['Upper edge', Number(upper).toFixed(4) + ' MHz',  true],
      ['Lebar kanal','200 kHz',                          true],
      ['Status',     'Tersedia untuk alokasi baru',      false],
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

