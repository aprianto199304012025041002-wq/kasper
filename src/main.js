import './style.css';
import './components/header.css';
import './components/stats.css';
import './components/grid.css';
import './components/band.css';
import './components/province.css';
import './components/detail-page.css';
import { fetchSpectrum, fetchProvinces, fetchStationDetail, fetchInterference, isUsingFallback } from './apiClient.js';
import { renderBandView, renderBandRuler } from './bandView.js';
import { renderDetailPage } from './detailPage.js';
import { renderInterferencePanel } from './interferenceView.js';
import { renderGeoGridView } from './geoGridView.js';
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
  province:       '',
  provinces:      [],
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

  try {
    state.provinces = await fetchProvinces();
    // state.province tetap '' = semua provinsi; user pilih via tab jika perlu
  } catch(e) { state.provinces = []; }

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
    <div id="provinceTabs"></div>
    <div id="statsBar" style="padding:0 32px;margin-top:16px"></div>
    <main class="main-content" style="padding-top:12px">
      <div id="controlsBar" class="controls-bar"></div>
      <div id="legendBar"></div>
      <div id="dynamicContent"></div>
    </main>
    <div class="tooltip-float" id="tooltip"></div>`;
  renderProvinceTabs();
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

let _st;
function handleInput(e) {
  if (e.target.id==='fSearch') {
    clearTimeout(_st);
    _st = setTimeout(() => { state.searchTerm=e.target.value; loadData(); }, 320);
  }
}

async function handleClick(e) {
  const ptab = e.target.closest('[data-province]');
  if (ptab) {
    state.province=ptab.dataset.province;
    state.filterCities=[]; state.searchTerm='';
    renderProvinceTabs(); renderControls();
    await loadData(); return;
  }
  const vtBtn = e.target.closest('[data-view]');
  if (vtBtn && !vtBtn.dataset.page) {
    state.view=vtBtn.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.view===state.view));
    renderContent(); return;
  }
  const pagBtn = e.target.closest('[data-page]');
  if (pagBtn) {
    state.page=pagBtn.dataset.page;
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('is-active',b.dataset.page===state.page));
    if (state.page==='interference' && !state.interfData) await loadInterference();
    else renderContent(); return;
  }
  if (e.target.id==='closeDetail') { document.getElementById('detailPanel')?.classList.remove('is-open'); return; }
  const cell = e.target.closest('.ch-cell[data-freq]');
  if (cell && state.data) {
    const ch = state.data.channel_map.find(c=>c.freq===parseFloat(cell.dataset.freq));
    if (ch?.type==='used') openDetailPage(ch.station);
    else if (ch) openInlineDetail(ch); return;
  }
  const slot = e.target.closest('.slot-row[data-start]');
  if (slot) { openSlotDetail(parseFloat(slot.dataset.start),parseFloat(slot.dataset.end)); return; }
  const nRow = e.target.closest('.neighbor-row[data-freq]');
  if (nRow) { openDetailPage({freq:parseFloat(nRow.dataset.freq)}); return; }
  if (e.target.id==='backBtn') {
    state.page='main'; renderShell(); attachEvents(); renderContent(); return;
  }
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
  const dc = document.getElementById('dynamicContent');
  if (dc) dc.innerHTML=`<div style="padding:48px;text-align:center;font-family:var(--font-mono);font-size:13px;color:var(--text-tertiary)"><span class="live-dot"></span> Memuat detail…</div>`;
  try {
    const detail = await fetchStationDetail(parseFloat(freq));
    renderDetailPage(detail, ()=>{
      state.page='main'; renderShell(); attachEvents(); renderContent();
    }, state.data);
  } catch(e) {
    if (dc) dc.innerHTML=`<div class="empty-state">Gagal memuat detail: ${e.message}</div>`;
  }
}

// ── Header ────────────────────────────────────────────────────────────
function renderHeader() {
  const dateStr = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  return `<header class="app-header">
    <div class="app-header__inner">
      <div class="app-header__brand">
        <div class="app-header__mark"><span>FM</span></div>
        <div class="app-header__titles">
          <h1>Peta Spektrum FM — ISR Balmon</h1>
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
function renderProvinceTabs() {
  const el = document.getElementById('provinceTabs');
  if (!el) return;
  const items = state.provinces.length ? state.provinces : [];
  const semua = !state.province; // aktif kalau province = ''
  el.innerHTML = `<div class="province-bar" role="tablist">
    <button class="province-tab ${semua?'is-active':''}"
      data-province="" role="tab">
      Semua Wilayah
      <span class="province-tab__count">${items.reduce((a,p)=>a+(p.total_fm||0),0)||''}</span>
    </button>
    ${items.map(p=>`
      <button class="province-tab ${p.name===state.province?'is-active':''}"
        data-province="${p.name}" role="tab">
        ${shortName(p.name)}
        <span class="province-tab__count">${p.total_fm||0}</span>
      </button>`).join('')}
  </div>`;
}

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
    <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
      <div class="view-toggle">
        <button class="view-toggle__btn ${state.view==='grid'?'is-active':''}" data-view="grid">⊞ Grid</button>
        <button class="view-toggle__btn ${state.view==='band'?'is-active':''}" data-view="band">▬ Pita</button>
        <button class="view-toggle__btn ${state.view==='geo'?'is-active':''}" data-view="geo">⊟ Geo Grid</button>
        <button class="view-toggle__btn ${state.page==='interference'?'is-active':''}" data-page="interference">⚡ Interferensi</button>
      </div>
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

  // ── Geo Grid view ──────────────────────────────────────────────────
  if (state.view === 'geo') {
    renderLegend();
    el.innerHTML = '<div id="geoGridContainer"></div>';
    const filters = {
      search: state.searchTerm,
      filterCities: state.filterCities,
      ...state.geoSettings,
    };
    renderGeoGridView(
      document.getElementById('geoGridContainer'),
      '',
      filters
    );
    return;
  }

  if (!state.data) return;

  // Apply filterCities multi-select di FE
  const activeCities = state.filterCities || [];
  const baseMap = activeCities.length === 0
    ? state.data.channel_map
    : state.data.channel_map.map(c => {
        if (c.type !== 'used') return c;
        const kota = c.station?.kota || c.station?.city;
        return activeCities.includes(kota) ? c : { ...c, type: 'free', station: null };
      });

  updateStatsBar(state.data.summary);
  renderLegend();

  let chMap = baseMap;
  if (state.filterChanView==='free') chMap=chMap.filter(c=>c.type==='free');
  if (state.filterChanView==='used') chMap=chMap.filter(c=>c.type==='used');

  const freeBlocks = (state.data.free_blocks||[]).filter(b=>b.count>=2);

  // Apply search di FE
  const searchLower = (state.searchTerm || '').toLowerCase().trim();
  const matchSearch = (c) => {
    if (!searchLower) return true;
    if (c.type !== 'used') return String(c.freq).includes(searchLower);
    return String(c.freq).includes(searchLower)
      || (c.station?.stn_name || '').toLowerCase().includes(searchLower)
      || (c.station?.kota || c.station?.city || '').toLowerCase().includes(searchLower);
  };

  if (state.view==='grid') {
    // Kelompokkan per kabupaten
    const cityList = activeCities.length > 0
      ? activeCities
      : [...new Set(
          state.data.channel_map
            .filter(c => c.type === 'used')
            .map(c => c.station?.kota || c.station?.city || '')
            .filter(Boolean)
        )].sort();

    const cityRows = cityList.map(city => {
      const row = baseMap.map(c => {
        if (c.type !== 'used') return c; // kosong/guard tetap tampil di semua row
        return (c.station?.kota || c.station?.city) === city ? c : { ...c, type: 'free', station: null };
      }).filter(matchSearch);
      return { city, row };
    }).filter(({ row }) => row.some(c => c.type === 'used' || (searchLower && matchSearch(c))));

    el.innerHTML = `
      <div class="section-label">Peta kanal per wilayah · grid 200 kHz · 87.5–108.0 MHz · ${state.data.stations.length} stasiun aktif</div>
      <div class="grid-frame" style="padding:12px">
        ${cityRows.map(({ city, row }) => {
          const usedCount = row.filter(c => c.type === 'used').length;
          const filtered = state.filterChanView === 'free'  ? row.filter(c => c.type === 'free') :
                           state.filterChanView === 'used'  ? row.filter(c => c.type === 'used') : row;
          return `<div class="city-row-block">
            <div class="city-row-label">${esc(city)} <span class="city-row-count">${usedCount}</span></div>
            <div class="ch-grid-row">${filtered.map(renderCell).join('')}</div>
          </div>`;
        }).join('')}
      </div>
      ${renderSlotSection(freeBlocks)}
      <div class="detail-panel" id="detailPanel"></div>`;
    attachCellTooltips(state.data.channel_map);
  } else {
    el.innerHTML=`
      <div class="section-label">Pita spektrum horizontal · tinggi blok ∝ ERP · klik untuk detail</div>
      <div class="band-view">
        <div class="band-ruler"><div class="band-ruler__inner" id="bandRuler"></div></div>
        <div class="band-track-wrap"><div class="band-track-inner" id="bandViewInner"></div></div>
      </div>
      ${renderSlotSection(freeBlocks)}
      <div class="detail-panel" id="detailPanel"></div>`;
    renderBandRuler();
    const filteredForBand = searchLower
      ? (state.filterChanView==='all' ? baseMap : chMap).map(c =>
          c.type === 'used' && !matchSearch(c) ? { ...c, type: 'free', station: null } : c)
      : (state.filterChanView==='all' ? baseMap : chMap);
    renderBandView(
      filteredForBand,
      handleBandHover,
      info=>{ if(info.type==='used') openDetailPage(info.station); else openInlineDetail(info); }
    );
  }
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
  if (c.type==='adjacent') {
    const dir=c.adj_left&&c.adj_right?'◄►':c.adj_left?'◄':'►';
    return `<div class="ch-cell ch-cell--adjacent" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${dir}</span>
    </div>`;
  }
  return `<div class="ch-cell ch-cell--free" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">★</span>
  </div>`;
}

// ── Slot section ──────────────────────────────────────────────────────
function renderSlotSection(blocks) {
  if (!blocks.length) return '';
  return `<div class="section-label">Slot kosong potensial — ${blocks.length} blok ≥ 400 kHz</div>
    <div class="slot-list">
      ${blocks.map(b=>{
        const r=b.priority||'low';
        const lbl={high:'★★ Prioritas tinggi',medium:'★ Layak',low:'Marginal'}[r];
        return `<div class="slot-row slot-row--${r}" data-start="${b.start}" data-end="${b.end}">
          <div><div class="slot-row__main">${b.start.toFixed(1)}–${b.end.toFixed(1)}</div><div class="slot-row__sub">MHz</div></div>
          <div><div class="slot-row__val">${b.width_khz??b.widthKHz} kHz</div><div class="slot-row__sub">lebar</div></div>
          <div><div class="slot-row__val">${b.center.toFixed(1)} MHz</div><div class="slot-row__sub">kandidat center</div></div>
          <div><div class="slot-row__val">${b.count} kanal</div><div class="slot-row__sub">@200 kHz</div></div>
          <div style="text-align:right"><span class="badge badge--${r}">${lbl}</span></div>
        </div>`;
      }).join('')}
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

function handleBandHover(e,info){ if(!info||!e){hideTooltip();return;} showTooltip(e,info); }

function showTooltip(e,info) {
  const tt=document.getElementById('tooltip');
  let title='',rows=[];
  if (info.type==='used') {
    const s=info.station;
    title=s?.stn_name||info.freq.toFixed(1)+' MHz';
    rows=[
      ['Frekuensi',info.freq.toFixed(3)+' MHz'],
      ['Lower',(info.lower??info.lower_mhz??info.freq-.1).toFixed(4)+' MHz'],
      ['Upper',(info.upper??info.upper_mhz??info.freq+.1).toFixed(4)+' MHz'],
      ['ERP',(s?.erp_dbm||'—')+' dBm'],
      ['Wilayah',s?.kota||s?.city||'—'],
      ['Jenis',JENIS_LABELS[s?.jenis]||s?.jenis||'—'],
      ['','▸ Klik untuk detail'],
    ];
  } else if (info.type==='adjacent') {
    title=info.freq.toFixed(1)+' MHz — Guard band';
    rows=[['Kiri',info.adj_left?.stn_name||'—'],['Kanan',info.adj_right?.stn_name||'—']];
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

// ── Inline detail panel ───────────────────────────────────────────────
function openInlineDetail(info) {
  const panel=document.getElementById('detailPanel');
  if (!panel) return;
  panel.classList.add('is-open');
  const lower=info.lower??info.lower_mhz??(info.freq-.1);
  const upper=info.upper??info.upper_mhz??(info.freq+.1);
  if (info.type==='free') {
    panel.innerHTML=`<div class="detail-panel__head">
      <div class="detail-panel__title">Kanal ${info.freq.toFixed(1)} MHz — Kosong ★</div>
      <button class="detail-panel__close" id="closeDetail">✕</button>
    </div>
    <div class="detail-grid">
      <div><div class="detail-item__label">Center</div><div class="detail-item__value mono">${info.freq.toFixed(3)} MHz</div></div>
      <div><div class="detail-item__label">Lower</div><div class="detail-item__value mono">${Number(lower).toFixed(4)} MHz</div></div>
      <div><div class="detail-item__label">Upper</div><div class="detail-item__value mono">${Number(upper).toFixed(4)} MHz</div></div>
      <div><div class="detail-item__label">Status</div><div class="detail-item__value" style="color:var(--signal-phosphor)">Tersedia untuk alokasi baru</div></div>
    </div>`;
  } else {
    panel.innerHTML=`<div class="detail-panel__head">
      <div class="detail-panel__title">${info.freq.toFixed(1)} MHz — Adjacent Protected</div>
      <button class="detail-panel__close" id="closeDetail">✕</button>
    </div>
    <div class="detail-grid">
      <div><div class="detail-item__label">Guard kiri</div><div class="detail-item__value">${esc(info.adj_left?.stn_name||'—')}</div></div>
      <div><div class="detail-item__label">Guard kanan</div><div class="detail-item__value">${esc(info.adj_right?.stn_name||'—')}</div></div>
    </div>`;
  }
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function openSlotDetail(start,end) {
  const panel=document.getElementById('detailPanel');
  if (!panel) return;
  panel.classList.add('is-open');
  const center=Math.round(((start+end)/2)*10)/10;
  panel.innerHTML=`<div class="detail-panel__head">
    <div class="detail-panel__title">Slot kosong ${start.toFixed(1)}–${end.toFixed(1)} MHz</div>
    <button class="detail-panel__close" id="closeDetail">✕</button>
  </div>
  <div class="detail-grid">
    <div><div class="detail-item__label">Rentang</div><div class="detail-item__value mono">${start.toFixed(2)} – ${end.toFixed(2)} MHz</div></div>
    <div><div class="detail-item__label">Lebar</div><div class="detail-item__value mono">${Math.round((end-start+.2)*1000)} kHz</div></div>
    <div><div class="detail-item__label">Kandidat center</div><div class="detail-item__value mono">${center.toFixed(1)} MHz</div></div>
    <div><div class="detail-item__label">Lower</div><div class="detail-item__value mono">${(center-.1).toFixed(3)} MHz</div></div>
    <div><div class="detail-item__label">Upper</div><div class="detail-item__value mono">${(center+.1).toFixed(3)} MHz</div></div>
    <div><div class="detail-item__label">Status</div><div class="detail-item__value" style="color:var(--signal-phosphor)">Layak diajukan izin baru</div></div>
  </div>`;
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function esc(str){const d=document.createElement('div');d.textContent=String(str);return d.innerHTML;}

boot();

