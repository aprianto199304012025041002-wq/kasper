import './app.css';
import { fetchSpectrum, fetchStationDetail, fetchInterference } from './apiClient.js';
import { renderDetailPage } from './detailPage.js';
import { renderInterferencePanel } from './interferenceView.js';
import { initMobileUI, openFilterDrawer } from './mobile.js';
import { computeChannelMapForWilayah, FM_MIN, FM_MAX } from './channelEngine.js';
import { computeInterference } from './interferenceEngine.js';

// -- Theme ------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem('kasper-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('kasper-theme', next);
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  // Button mungkin belum ada saat initTheme() dipanggil — update lagi setelah renderShell
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '\u2600' : '\u263d';
  // Simpan agar renderShell bisa apply saat mount
  window._kasperTheme = theme;
}

// ── State ────────────────────────────────────────────────────────────
let state = {
  page:            'main',
  view:            'grid',
  filterCities:    [],
  filterChanView:  'all',
  searchTerm:      '',
  geoSettings:     { showAdj: true, showLabel: true, onlyFree: false },
  data:            null,
  interfData:      null,
  loading:         false,
  error:           null,
  selectedWilayah: null,
  sidebarCollapsed:false,
  _allotmentCache: null,
  _allotmentCacheData: null,
};

// ── URL sync ─────────────────────────────────────────────────────────
function syncURL() {
  const p = new URLSearchParams();
  if (state.view !== 'grid')          p.set('view', state.view);
  if (state.page !== 'main')          p.set('page', state.page);
  if (state.filterChanView !== 'all') p.set('chan', state.filterChanView);
  if (state.filterCities?.length)     p.set('city', state.filterCities.join('|'));
  if (state.searchTerm)               p.set('q', state.searchTerm);
  if (state.selectedWilayah)          p.set('w', state.selectedWilayah);
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

function restoreURL() {
  const p = new URLSearchParams(location.search);
  if (p.has('view')) state.view             = p.get('view');
  if (p.has('page')) state.page             = p.get('page');
  if (p.has('chan')) state.filterChanView   = p.get('chan');
  if (p.has('city')) state.filterCities     = p.get('city').split('|').filter(Boolean);
  if (p.has('q'))    state.searchTerm       = p.get('q');
  if (p.has('w'))    state.selectedWilayah  = p.get('w');
  if (p.has('freq')) state._openFreqOnLoad  = parseFloat(p.get('freq'));
}

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  document.getElementById('app').innerHTML =
    `<div class="state-loading"><span class="live-dot"></span>Memuat data spektrum…</div>`;
  restoreURL();
  initTheme();
  renderShell();
  updateThemeBtn(localStorage.getItem('kasper-theme') || 'dark');
  attachEvents();
  await loadData();
  initMobileUI(
    () => state,
    (view) => { state.view = view; state.page = 'main'; syncURL(); renderControls(); renderContent(); },
    async (page) => {
      state.page = page; syncURL();
      if (page === 'interference' && !state.interfData) await loadInterference();
      else renderContent();
    },
    (filters) => {
      if (filters.filterCities   !== undefined) state.filterCities   = filters.filterCities;
      if (filters.filterChanView !== undefined) state.filterChanView = filters.filterChanView;
      if (filters.searchTerm     !== undefined) state.searchTerm     = filters.searchTerm;
      syncURL(); renderControls(); renderContent();
    }
  );
  window.__openMobFilter = () => openFilterDrawer();
}

// ── Shell ────────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    <div class="app-body">
      <aside class="sidebar${state.sidebarCollapsed ? ' is-collapsed' : ''}" id="sidebar">
        <div class="sidebar__top">
          <input type="search" class="sidebar__search" id="sidebarSearch" placeholder="Cari wilayah…"/>
          <button class="sidebar__collapse" id="sidebarCollapseBtn" title="Sembunyikan sidebar">‹</button>
        </div>
        <nav class="sidebar__nav" id="sidebarNav"><div style="padding:8px 10px;font-size:11px;color:var(--txt-3)">Memuat…</div></nav>
      </aside>
      <button class="sidebar-toggle" id="sidebarToggle">›</button>
      <div class="app-main" id="appMain">
        <div class="toolbar" id="toolbar">
          <button class="toolbar-tab${state.view==='grid'?' is-active':''}" data-view="grid">GRID</button>
          <button class="toolbar-tab${state.view==='band'?' is-active':''}" data-view="band">PITA</button>
          <button class="toolbar-tab${state.view==='geo'?' is-active':''}" data-view="geo">GEO</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-tab${state.page==='interference'?' is-active':''}" data-page="interference">⚡ RF</button>
          <div class="toolbar-right">
            <div class="toolbar-search-wrap">
              <input type="search" class="toolbar-search" id="fSearch" placeholder="Cari stasiun / frekuensi…" value="${esc(state.searchTerm)}"/>
              ${state.searchTerm ? `<button class="toolbar-search-clear" id="fSearchClear" title="Hapus pencarian">✕</button>` : ''}
            </div>
            <select class="toolbar-select" id="fChanView">
              <option value="all"  ${state.filterChanView==='all' ?'selected':''}>Semua kanal</option>
              <option value="free" ${state.filterChanView==='free'?'selected':''}>Kosong saja</option>
              <option value="used" ${state.filterChanView==='used'?'selected':''}>Terisi saja</option>
            </select>
          </div>
        </div>
        <div id="statsBar"></div>
        <div id="legendBar"></div>
        <div id="dynamicContent" class="content-area"></div>
      </div>
    </div>
    <div class="tooltip-float" id="tooltip"></div>`;

  document.getElementById('sidebarCollapseBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarSearch')?.addEventListener('input', filterSidebarNav);
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  document.getElementById('sidebar')?.classList.toggle('is-collapsed', state.sidebarCollapsed);
  document.getElementById('sidebarToggle')?.classList.toggle('is-visible', state.sidebarCollapsed);
  const btn = document.getElementById('sidebarCollapseBtn');
  if (btn) btn.textContent = state.sidebarCollapsed ? '›' : '‹';
}

function filterSidebarNav() {
  const q = (document.getElementById('sidebarSearch')?.value || '').toLowerCase();
  document.querySelectorAll('.sidebar__item[data-wilayah]').forEach(el => {
    const name = el.dataset.wilayah.toLowerCase();
    el.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.sidebar__section-label').forEach(label => {
    const sec = label.nextElementSibling;
    if (!sec) return;
    const anyVisible = [...sec.querySelectorAll('.sidebar__item')].some(i => i.style.display !== 'none');
    label.style.display = sec.style.display = anyVisible ? '' : 'none';
  });
}

// ── Header ───────────────────────────────────────────────────────────
function renderHeader() {
  return `<header class="app-header">
    <div class="app-header__brand">
      <span class="app-header__logo">KASPER</span>
      <span class="app-header__title">Monitoring Spektrum FM · DIY &amp; Jawa Tengah</span>
    </div>
    <div class="app-header__divider"></div>
    <div class="app-header__meta">
      <span class="app-header__chip">Band <b>87.5–108.0 MHz</b></span>
      <span class="app-header__chip">Spasi <b>100 kHz</b></span>
      <span class="app-header__chip">Regulasi <b>KM 570/2025</b></span>
    </div>
    <div class="app-header__status">
      <span class="live-dot"></span>
      <span id="headerStatus">—</span>
      <button id="themeToggle" class="theme-toggle" title="Toggle dark/light mode">◑</button>
    </div>
  </header>`;
}

// ── Sidebar render ───────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav || !state.data) return;

  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const allWilayah = [...new Set(
    state.data.stations
      .map(s => s.wilayah_layanan || s.kota || '')
      .filter(w => w && w !== KOMUNITAS_AOS)
  )].sort();

  const cnt = (w) => state._stationCountMap?.[w] ?? 0;

  const DIY = new Set(['KOTA YOGYAKARTA','BANTUL, BANGUNTAPAN',
    'SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM','WATES, SENTOLO',
    'WONOSARI','GAMPING','DEPOK','PATUK']);

  const diy    = allWilayah.filter(w => DIY.has(w));
  const jateng = allWilayah.filter(w => !DIY.has(w));

  const itemHtml = (w) => {
    const active = state.selectedWilayah === w;
    return `<button class="sidebar__item${active?' is-active':''}" data-wilayah="${esc(w)}">
      <span class="sidebar__label">${esc(shortWilayah(w))}</span>
      <span class="sidebar__badge">${cnt(w)}</span>
    </button>`;
  };

  const allActive = !state.selectedWilayah && state.page !== 'interference';
  nav.innerHTML = `
    <button class="sidebar__item${allActive?' is-active':''}" data-wilayah="">
      <span class="sidebar__label">Semua Wilayah</span>
      <span class="sidebar__badge">${allWilayah.length}</span>
    </button>
    ${diy.length ? `<div class="sidebar__section">
      <div class="sidebar__section-label">D.I. Yogyakarta</div>
      <div>${diy.map(itemHtml).join('')}</div>
    </div>` : ''}
    ${jateng.length ? `<div class="sidebar__section">
      <div class="sidebar__section-label">Jawa Tengah</div>
      <div>${jateng.map(itemHtml).join('')}</div>
    </div>` : ''}
    <div class="sidebar__section">
      <div class="sidebar__section-label">Analisis</div>
      <button class="sidebar__item${state.page==='interference'?' is-active':''}" data-page="interference">
        <span class="sidebar__label">⚡ Interferensi RF</span>
      </button>
    </div>`;

  nav.querySelectorAll('.sidebar__item[data-wilayah]').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.wilayah;
      state.selectedWilayah = w || null;
      state.filterCities    = w ? [w] : [];
      state.page = 'main';
      syncURL(); renderSidebar(); renderContent();
      document.getElementById('dynamicContent')?.scrollTo(0, 0);
    });
  });
  nav.querySelector('[data-page="interference"]')?.addEventListener('click', () => {
    state.page = 'interference'; state.selectedWilayah = null;
    syncURL(); renderSidebar(); renderContent();
    if (!state.interfData) loadInterference();
  });
}

// ── Stats bar ────────────────────────────────────────────────────────
function renderStatsBar(summary, allotmentStats = null) {
  const el = document.getElementById('statsBar');
  if (!el) return;
  const pctU = +((summary.used  / summary.total) * 100).toFixed(1);
  const pctF = +((summary.free  / summary.total) * 100).toFixed(1);
  const adj  = (summary.adjacent_1 || 0) + (summary.adjacent_2 || 0);
  const pctA = +((adj / summary.total) * 100).toFixed(1);

  let extra = '';
  if (allotmentStats) {
    extra = `
      <div class="stat-cell">
        <div class="stat-cell__label">Allotted terisi</div>
        <div class="stat-cell__val --amber">${allotmentStats.used}<span class="unit">/ ${allotmentStats.total}</span></div>
        <div class="stat-cell__meter" style="width:${(allotmentStats.used/allotmentStats.total*100).toFixed(1)}%;background:var(--amber)"></div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell__label">Allotted kosong</div>
        <div class="stat-cell__val --cyan">${allotmentStats.free}</div>
        <div class="stat-cell__meter" style="width:${(allotmentStats.free/allotmentStats.total*100).toFixed(1)}%;background:var(--cyan)"></div>
      </div>`;
  }

  el.innerHTML = `<div class="statsbar">
    <div class="stat-cell stat-cell--btn" data-filter-chan="all" title="Tampilkan semua kanal">
      <div class="stat-cell__label">Total kanal FM</div>
      <div class="stat-cell__val">${summary.total}</div>
    </div>
    <div class="stat-cell stat-cell--btn" data-filter-chan="used" title="Filter: terisi saja">
      <div class="stat-cell__label">Terisi ↗</div>
      <div class="stat-cell__val --amber">${summary.used}<span class="unit">${pctU}%</span></div>
      <div class="stat-cell__meter" style="width:${pctU}%;background:var(--amber)"></div>
    </div>
    <div class="stat-cell" title="Kanal terlindungi adjacent">
      <div class="stat-cell__label">Adjacent guard</div>
      <div class="stat-cell__val --red">${adj}<span class="unit">${pctA}%</span></div>
      <div class="stat-cell__meter" style="width:${pctA}%;background:var(--red)"></div>
    </div>
    <div class="stat-cell stat-cell--btn" data-filter-chan="free" title="Filter: kosong saja">
      <div class="stat-cell__label">Kosong / potensial ↗</div>
      <div class="stat-cell__val --green">${summary.free}<span class="unit">${pctF}%</span></div>
      <div class="stat-cell__meter" style="width:${pctF}%;background:var(--phosphor)"></div>
    </div>
    ${extra}
  </div>`;
  // Stats cell click → filter
  el.querySelectorAll('.stat-cell--btn[data-filter-chan]').forEach(cell => {
    cell.addEventListener('click', () => {
      state.filterChanView = cell.dataset.filterChan;
      const sel = document.getElementById('fChanView');
      if (sel) sel.value = state.filterChanView;
      syncURL(); renderContent();
    });
  });
}

// ── Legend ───────────────────────────────────────────────────────────
function renderLegend() {
  const el = document.getElementById('legendBar');
  if (!el) return;
  el.innerHTML = `<div class="legend-strip">
    <div class="legend-chip"><span class="legend-chip__dot" style="background:rgba(255,184,0,.35);border:1px solid var(--amber)"></span>Terisi</div>
    <div class="legend-chip"><span class="legend-chip__dot" style="background:var(--red-dim);border:1px dashed var(--red)"></span>Adjacent guard</div>
    <div class="legend-chip"><span class="legend-chip__dot" style="background:var(--cyan-dim);border:1px solid var(--cyan)"></span>Allotted ★ (kosong)</div>
    <div class="legend-chip"><span class="legend-chip__dot" style="background:var(--purple-dim);border:1px dashed var(--purple)"></span>Allotted RRI ▣</div>
    <div class="legend-chip"><span class="legend-chip__dot" style="background:transparent;border:1px solid var(--border)"></span>Tidak dijatahkan</div>
  </div>`;
}

// ── Controls ──────────────────────────────────────────────────────────
function renderControls() {
  document.querySelectorAll('.toolbar-tab[data-view]').forEach(b =>
    b.classList.toggle('is-active', b.dataset.view === state.view));
  document.querySelectorAll('.toolbar-tab[data-page]').forEach(b =>
    b.classList.toggle('is-active', b.dataset.page === state.page));
}

// ── Attach events ─────────────────────────────────────────────────────
function attachEvents() {
  document.addEventListener('change', e => {
    if (e.target.id === 'fChanView') { state.filterChanView = e.target.value; syncURL(); renderContent(); }
  });
  document.addEventListener('click', e => {
    if (e.target.id === 'fSearchClear') {
      state.searchTerm = '';
      syncURL(); renderControls(); renderContent();
      document.getElementById('fSearch')?.focus();
    }
  });
  let _debounce;
  document.addEventListener('input', e => {
    if (e.target.id === 'fSearch') {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => { state.searchTerm = e.target.value; syncURL(); renderContent(); }, 250);
    }
  });
  document.addEventListener('click', handleClick);
  document.addEventListener('click', e => { if (e.target.id === 'themeToggle') toggleTheme(); });
  document.addEventListener('kasper:search', (e) => {
    state.searchTerm = e.detail.searchTerm || ''; syncURL(); renderContent();
  });
}

async function handleClick(e) {
  const vtBtn = e.target.closest('[data-view]');
  if (vtBtn && !vtBtn.dataset.page) {
    state.view = vtBtn.dataset.view; state.page = 'main';
    syncURL(); renderControls(); renderContent(); return;
  }
  const pgBtn = e.target.closest('[data-page]');
  if (pgBtn && !pgBtn.closest('.sidebar__item')) {
    state.page = pgBtn.dataset.page;
    syncURL(); renderControls();
    if (state.page === 'interference' && !state.interfData) await loadInterference();
    else renderContent(); return;
  }
  const cell = e.target.closest('.ch-cell[data-freq]');
  if (cell && state.data) {
    const freq = parseFloat(cell.dataset.freq);
    const chGlobal = state.data.channel_map.find(c => c.freq === freq);
    if (!chGlobal) return;
    const city = cell.closest('.city-block')?.querySelector('.city-block__name')?.dataset?.city;
    const coStations = city
      ? state.data.stations.filter(s => {
          if (Math.abs(parseFloat(s.freq) - freq) >= 0.01) return false;
          return (s.wilayah_layanan || s.kota) === city;
        }).sort((a,b) => (a.stn_name||'').localeCompare(b.stn_name||''))
      : null;
    // Gunakan allotment_status per-wilayah (dari cache), bukan dari channel_map global
    const allotmentStatus = city && state._allotmentCache?.[city]
      ? (state._allotmentCache[city][freq] ?? null)
      : chGlobal.allotment_status;
    // Hitung type per-wilayah: kalau coStations ada → used, kalau tidak → pakai chGlobal
    const chPerWilayah = coStations?.length
      ? { ...chGlobal, type: 'used', allotment_status: allotmentStatus, coStations }
      : { ...chGlobal, allotment_status: allotmentStatus };
    openInlineDetail(chPerWilayah);
    return;
  }
  const nRow = e.target.closest('.neighbor-row[data-freq]');
  if (nRow) { openDetailPage({ freq: parseFloat(nRow.dataset.freq) }); }
  // band SVG hits
  const bandHit = e.target.closest('.band-hit[data-freq]');
  if (bandHit && state.data) {
    const freq = parseFloat(bandHit.dataset.freq);
    const ch = state.data.channel_map.find(c => Math.abs(c.freq - freq) < 0.01);
    if (!ch) return;
    const cityEl = bandHit.closest('.city-block')?.querySelector('.city-block__name');
    const city = cityEl?.dataset?.city;
    const coStations = city
      ? state.data.stations.filter(s => {
          if (Math.abs(parseFloat(s.freq) - freq) >= 0.01) return false;
          return (s.wilayah_layanan || s.kota) === city;
        }).sort((a,b) => (a.stn_name||'').localeCompare(b.stn_name||''))
      : null;
    openInlineDetail(coStations?.length ? { ...ch, coStations } : ch);
  }
}

// ── Data loading ──────────────────────────────────────────────────────
async function loadData() {
  state.loading = true; state.error = null; state.data = null;
  renderContent();
  try {
    state.data = await fetchSpectrum({});
    state.loading = false;
    state._allotmentCache = null;
    state._allotmentCacheData = null;
    // Pre-compute station count per wilayah
    state._stationCountMap = {};
    (state.data.stations || []).forEach(s => {
      const w = s.wilayah_layanan || s.kota || '';
      if (w) state._stationCountMap[w] = (state._stationCountMap[w] || 0) + 1;
    });
    const total = state.data.stations?.length ?? 0;
    const statusEl = document.getElementById('headerStatus');
    const now = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    if (statusEl) statusEl.textContent = `${total} stasiun · ${now}`;
  } catch(e) {
    state.error = e.message; state.loading = false;
  }
  renderControls(); renderSidebar(); renderContent();
  // Buka detail stasiun dari URL ?freq=
  if (state._openFreqOnLoad) {
    const freq = state._openFreqOnLoad;
    state._openFreqOnLoad = null;
    setTimeout(() => openDetailPage({ freq }), 300);
  }
}

async function loadInterference() {
  state.loading = true; renderContent();
  try {
    const raw = await fetchInterference({});
    const stations = raw.stations || state.data?.stations || [];
    // Hitung di background agar tidak freeze UI
    await new Promise(resolve => {
      const compute = () => {
        state.interfData = computeInterference(stations);
        state.loading = false;
        renderContent();
        resolve();
      };
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(compute, { timeout: 2000 });
      } else {
        setTimeout(compute, 0);
      }
    });
  } catch(e) {
    const stations = state.data?.stations || [];
    state.interfData = stations.length
      ? computeInterference(stations)
      : { pairs:[], summary:{}, stations_evaluated:0, model:'error:'+e.message };
    state.loading = false; renderContent();
  }
}

// ── Dynamic content ───────────────────────────────────────────────────
function renderContent() {
  const el = document.getElementById('dynamicContent');
  if (!el) return;

  if (state.loading) {
    // Skeleton stats bar saat loading agar layout tidak loncat
    document.getElementById('statsBar').innerHTML = `<div class="statsbar">
      ${['Total kanal FM','Terisi','Adjacent guard','Kosong'].map(l =>
        `<div class="stat-cell"><div class="stat-cell__label">${l}</div><div class="stat-cell__val" style="color:var(--txt-3)">—</div></div>`
      ).join('')}
    </div>`;
    el.innerHTML = `<div class="state-loading"><span class="live-dot"></span> Memuat…</div>`;
    return;
  }
  if (state.error) {
    el.innerHTML = `<div class="state-error">
      <div style="font-size:20px">⚠</div>
      <div>Gagal memuat data</div>
      <div class="state-error__msg">${esc(state.error)}</div>
      <button class="state-retry" onclick="location.reload()">↺ Coba lagi</button>
    </div>`;
    return;
  }
  if (state.page === 'interference') {
    el.innerHTML = '<div class="interf-wrap" id="interfPanel"></div>';
    if (state.interfData) renderInterferencePanel(document.getElementById('interfPanel'), state.interfData);
    return;
  }
  if (!state.data) return;

  if (state.selectedWilayah && !state.filterCities.includes(state.selectedWilayah))
    state.filterCities = [state.selectedWilayah];

  renderStatsBar(state.data.summary);
  renderLegend();

  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const searchLower = (state.searchTerm || '').toLowerCase().trim();

  const matchSearch = (c) => {
    if (!searchLower) return true;
    if (c.type !== 'used') return String(c.freq).includes(searchLower);
    return String(c.freq).includes(searchLower)
      || (c.station?.stn_name || '').toLowerCase().includes(searchLower)
      || (c.station?.wilayah_layanan || c.station?.kota || '').toLowerCase().includes(searchLower);
  };

  const filterCities = state.filterCities || [];
  const allWilayah = [...new Set(
    state.data.stations
      .map(s => s.wilayah_layanan || s.kota || '')
      .filter(w => w && w !== KOMUNITAS_AOS)
  )].sort();
  const cityList = filterCities.length > 0 ? filterCities.filter(c => c !== KOMUNITAS_AOS) : allWilayah;

  if (!state._allotmentCache || state._allotmentCacheData !== state.data) {
    state._allotmentCache = {}; state._allotmentCacheData = state.data;
  }

  let allotTotal = 0, allotUsed = 0, allotFree = 0;

  const cityRows = cityList.map(city => {
    const cityStations = state.data.stations.filter(s => (s.wilayah_layanan || s.kota) === city);
    if (!state._allotmentCache[city]) {
      const idx = {};
      computeChannelMapForWilayah(cityStations, city).forEach(c => { idx[c.freq] = c.allotment_status; });
      state._allotmentCache[city] = idx;
    }
    const allotIdx = state._allotmentCache[city];
    const row = state.data.channel_map.map(c => {
      const allotment_status = allotIdx[c.freq] ?? null;
      const ownStations = cityStations.filter(s => Math.abs(parseFloat(s.freq) - c.freq) < 0.01);
      if (ownStations.length > 0)
        return { ...c, allotment_status, type: 'used', station: ownStations[0], coStations: ownStations };
      if (c.type === 'used') return { ...c, allotment_status, type: 'free', station: null };
      return { ...c, allotment_status };
    }).filter(matchSearch);
    return { city, row };
  }); // semua wilayah tetap tampil — yang 0 stasiun tampil empty state

  // hitung allotment stats
  cityRows.forEach(({ row }) => {
    row.forEach(c => {
      if (c.allotment_status === 'allotted_lps' || c.allotment_status === 'allotted_rri') {
        allotTotal++;
        if (c.type === 'used') allotUsed++; else allotFree++;
      }
    });
  });
  if (allotTotal > 0) renderStatsBar(state.data.summary, { total: allotTotal, used: allotUsed, free: allotFree });

  const geo = state.geoSettings || {};
  const applyFilter = (row) => {
    if (state.view === 'geo') {
      let r = row;
      if (geo.onlyFree) r = r.filter(c => c.type === 'free');
      if (geo.showAdj === false) r = r.filter(c => c.type !== 'adjacent_1' && c.type !== 'adjacent_2');
      return r;
    }
    if (state.filterChanView === 'free') return row.filter(c => c.type === 'free');
    if (state.filterChanView === 'used') return row.filter(c => c.type === 'used' || c.type === 'adjacent_1' || c.type === 'adjacent_2');
    return row;
  };

  // ── Band view ─────────────────────────────────────────────────────
  const _isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (state.view === 'band') {
    el.innerHTML = cityRows.map(({ city, row }) =>
      `<div class="city-block">
        <div class="city-block__head">
          <span class="city-block__name" data-city="${esc(city)}">${esc(shortWilayah(city))}</span>
          <span class="city-block__count">${state._stationCountMap?.[city] ?? cityStations.length} stasiun</span>
        </div>
        <div class="band-scroll">${renderBandSVG(row, city, _isLight)}</div>
      </div>`
    ).join('');
    return;
  }

  // ── Grid / Geo view ───────────────────────────────────────────────
  const cellFn = state.view === 'geo' ? (c) => renderCellGeo(c) : renderCell;
  el.innerHTML = cityRows.map(({ city, row }) =>
    `<div class="city-block">
      <div class="city-block__head">
        <span class="city-block__name" data-city="${esc(city)}">${esc(shortWilayah(city))}</span>
        <span class="city-block__count">${state._stationCountMap?.[city] ?? cityStations.length} stasiun</span>
      </div>
      <div class="ch-row">${applyFilter(row).map(c => cellFn(c)).join('') ||
        '<div class="state-empty" style="min-height:60px;font-size:11px;padding:16px">Tidak ada stasiun aktif di wilayah ini</div>'
      }</div>
    </div>`
  ).join('');

  attachCellTooltips();
}

// ── Cell renderers ────────────────────────────────────────────────────
function firstWord(n) { return (n || '').trim().split(/\s+/)[0]; }

function adjSym(c) {
  const a1L = c.adj1_left  || (c.type==='adjacent_1' && c.adj_left);
  const a1R = c.adj1_right || (c.type==='adjacent_1' && c.adj_right);
  const a2L = c.adj2_left  || (c.type==='adjacent_2' && c.adj_left);
  const a2R = c.adj2_right || (c.type==='adjacent_2' && c.adj_right);
  return ((a1L?'<':a2L?'«':'') + (a1R?'>':a2R?'»':'')).trim() || '—';
}

function renderCell(c) {
  if (c.type === 'used') {
    const co = c.coStations?.length > 1 ? `<span class="ch-cell__co">${c.coStations.length}</span>` : '';
    return `<div class="ch-cell ch-cell--used" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${esc(firstWord(c.station?.stn_name))}</span>
      ${co}
    </div>`;
  }
  if (c.type === 'adjacent_1')
    return `<div class="ch-cell ch-cell--adj1" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${adjSym(c)}</span>
    </div>`;
  if (c.type === 'adjacent_2')
    return `<div class="ch-cell ch-cell--adj2" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">${adjSym(c)}</span>
    </div>`;
  const cls  = c.allotment_status === 'allotted_rri' ? 'ch-cell--allotted-rri'
             : c.allotment_status === 'allotted_lps' ? 'ch-cell--allotted-lps'
             : 'ch-cell--free';
  const icon = c.allotment_status === 'allotted_rri' ? '▣'
             : c.allotment_status === 'allotted_lps' ? '★' : '·';
  return `<div class="ch-cell ${cls}" data-freq="${c.freq}">
    <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
    <span class="ch-cell__name">${icon}</span>
  </div>`;
}

function renderCellGeo(c) {
  const showLabel = state.geoSettings?.showLabel !== false;
  const label = showLabel ? `<span class="ch-cell__freq">${c.freq.toFixed(1)}</span>` : '';
  if (c.type === 'used') {
    const co = c.coStations?.length > 1 ? `<span class="ch-cell__co">${c.coStations.length}</span>` : '';
    return `<div class="ch-cell ch-cell--used" data-freq="${c.freq}" style="width:36px;height:36px">
      ${label}${co}
    </div>`;
  }
  if (c.type === 'adjacent_1')
    return `<div class="ch-cell ch-cell--adj1" data-freq="${c.freq}" style="width:36px;height:36px">
      ${label}
    </div>`;
  if (c.type === 'adjacent_2')
    return `<div class="ch-cell ch-cell--adj2" data-freq="${c.freq}" style="width:36px;height:36px">
      ${label}
    </div>`;
  const cls  = c.allotment_status === 'allotted_rri' ? 'ch-cell--allotted-rri'
             : c.allotment_status === 'allotted_lps' ? 'ch-cell--allotted-lps'
             : 'ch-cell--free';
  const icon = c.allotment_status === 'allotted_rri' ? '\u25a3'
             : c.allotment_status === 'allotted_lps' ? '\u2605' : '\u00b7';
  return `<div class="ch-cell ${cls}" data-freq="${c.freq}" style="width:36px;height:36px">
    ${label}
    <span class="ch-cell__name" style="font-size:8px">${icon}</span>
  </div>`;
}

// ── Band SVG ─────────────────────────────────────────────────────────
const SVG_W_PER_MHZ = 200, SVG_H = 110, RULER_H = 20, SLOT_PX = 20;
const AMP_MIN = 10, AMP_MAX = 46, SINE_STEPS = 36;
function freqX(f) { return (f - FM_MIN) * SVG_W_PER_MHZ; }
function erpAmp(e) { return AMP_MIN + Math.max(0, Math.min(1, ((e||60)-40)/(78-40))) * (AMP_MAX-AMP_MIN); }

function renderBandSVG(row, city, isLight = false) {
  const W = (FM_MAX - FM_MIN) * SVG_W_PER_MHZ + 40;
  const cy = SVG_H - RULER_H - 4;
  let paths = [], markers = [], labels = [], hits = [];

  for (const c of row) {
    const x = freqX(c.freq);
    if (c.type === 'used') {
      const avgErp = (c.coStations||[c.station]).reduce((s,st) => s+(st?.erp_dbm||60),0) / (c.coStations||[c.station]).length;
      const amp = erpAmp(avgErp);
      const x0 = x - SLOT_PX, x1 = x + SLOT_PX;
      const pts = Array.from({length: SINE_STEPS+1}, (_,i) => {
        const t = i/SINE_STEPS, px = x0+t*(x1-x0), py = cy - amp*Math.sin(Math.PI*t);
        return `${i?'L':'M'}${px.toFixed(1)},${py.toFixed(1)}`;
      }).join(' ');
      paths.push(`<path d="${pts} L${x1.toFixed(1)},${cy} L${x0.toFixed(1)},${cy} Z" fill="#FFB800" opacity=".1"/>`);
      paths.push(`<path d="${pts}" stroke="#FFB800" stroke-width="1.6" fill="none"/>`);
      const cnt = (c.coStations||[]).length > 1 ? ` ×${c.coStations.length}` : '';
      labels.push(`<text x="${x.toFixed(1)}" y="${(cy-amp-5).toFixed(1)}" text-anchor="middle" font-size="7" fill="#FFB800" font-family="monospace">${c.freq.toFixed(1)}${cnt}</text>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${x0.toFixed(1)}" y="0" width="${(x1-x0).toFixed(1)}" height="${cy}" fill="transparent"/>`);
    } else if (c.type === 'adjacent_1' || c.type === 'adjacent_2') {
      const is2 = c.type==='adjacent_2';
      const color = is2 ? 'rgba(255,59,59,.4)' : 'rgba(255,59,59,.8)';
      const h = is2 ? 8 : 14;
      markers.push(`<line x1="${x.toFixed(1)}" y1="${cy}" x2="${x.toFixed(1)}" y2="${(cy-h).toFixed(1)}" stroke="${color}" stroke-width="${is2?1:1.4}" stroke-dasharray="3,2"/>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${(x-SLOT_PX/2).toFixed(1)}" y="0" width="${SLOT_PX}" height="${cy}" fill="transparent"/>`);
    } else {
      const isLPS = c.allotment_status==='allotted_lps';
      const isRRI = c.allotment_status==='allotted_rri';
      const color = isRRI ? '#A78BFA' : isLPS ? '#00C4FF' : (isLight ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.15)');
      const r = isLPS||isRRI ? 3.5 : 2;
      const op = isLPS||isRRI ? .8 : .3;
      markers.push(`<circle cx="${x.toFixed(1)}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`);
      hits.push(`<rect class="band-hit" data-freq="${c.freq}" x="${(x-SLOT_PX/2).toFixed(1)}" y="0" width="${SLOT_PX}" height="${cy}" fill="transparent"/>`);
    }
  }

  // baseline + ruler — theme-aware via CSS custom properties
  // isLight passed as parameter from renderContent
  const rulerColor  = isLight ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.06)';
  const tickMajor   = isLight ? 'rgba(0,0,0,.30)' : 'rgba(255,255,255,.20)';
  const tickMid     = isLight ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.10)';
  const labelColor  = isLight ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.30)';
  let ruler = [`<line x1="0" y1="${cy}" x2="${W}" y2="${cy}" stroke="${rulerColor}" stroke-width="1"/>`];
  for (let f=FM_MIN; f<=FM_MAX+.01; f=Math.round((f+.1)*10)/10) {
    const rx = freqX(f), isMajor = Math.round(f*10)%10===0, isMid = Math.round(f*10)%5===0&&!isMajor;
    if (isMajor) {
      ruler.push(`<line x1="${rx.toFixed(1)}" y1="${cy+2}" x2="${rx.toFixed(1)}" y2="${cy+7}" stroke="${tickMajor}" stroke-width="1"/>`);
      ruler.push(`<text x="${rx.toFixed(1)}" y="${cy+17}" text-anchor="middle" font-size="7" fill="${labelColor}" font-family="monospace">${f.toFixed(0)}</text>`);
    } else if (isMid) {
      ruler.push(`<line x1="${rx.toFixed(1)}" y1="${cy+2}" x2="${rx.toFixed(1)}" y2="${cy+5}" stroke="${tickMid}" stroke-width="1"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SVG_H}" style="display:block">
    ${ruler.join('')}${markers.join('')}${paths.join('')}${labels.join('')}${hits.join('')}
  </svg>`;
}

// ── Tooltip ───────────────────────────────────────────────────────────
function attachCellTooltips() {
  // Touch devices: skip tooltip — tidak ada hover
  if (window.matchMedia('(hover: none)').matches) return;
  const content = document.getElementById('dynamicContent');
  if (!content || content._ttAttached) return;
  content._ttAttached = true;
  content.addEventListener('mouseover', e => {
    const cell = e.target.closest('.ch-cell[data-freq]');
    if (!cell) return;
    const freq = parseFloat(cell.dataset.freq);
    const city = cell.closest('.city-block')?.querySelector('.city-block__name')?.dataset?.city;
    // Cari channel dari allotmentCache per-wilayah jika ada
    const chGlobal = state.data?.channel_map.find(c => c.freq === freq);
    if (!chGlobal) return;
    const allotmentStatus = city && state._allotmentCache?.[city]
      ? (state._allotmentCache[city][freq] ?? null) : chGlobal.allotment_status;
    const cityStations = city
      ? state.data.stations.filter(s => Math.abs(parseFloat(s.freq)-freq)<0.01 && (s.wilayah_layanan||s.kota)===city)
      : [];
    const ch = cityStations.length
      ? { ...chGlobal, type: 'used', allotment_status: allotmentStatus, station: cityStations[0] }
      : { ...chGlobal, allotment_status: allotmentStatus };
    showTT(e, ch);
  });
  content.addEventListener('mousemove', e => {
    if (e.target.closest('.ch-cell[data-freq]')) moveTT(e);
  });
  content.addEventListener('mouseleave', hideTT);
  content.addEventListener('mouseout', e => {
    if (!e.target.closest('.ch-cell[data-freq]')) hideTT();
  });
}

function showTT(e, c) {
  const tt = document.getElementById('tooltip');
  let title = '', rows = [];
  if (c.type === 'used') {
    const s = c.station;
    title = s?.stn_name || c.freq.toFixed(1)+' MHz';
    rows = [['Frekuensi', c.freq.toFixed(3)+' MHz'],['ERP',(s?.erp_dbm||'—')+' dBm'],
            ['Wilayah', s?.wilayah_layanan||s?.kota||'—'],['','▸ Klik untuk detail']];
  } else if (c.type === 'adjacent_1') {
    title = c.freq.toFixed(1)+' MHz — Adjacent-1 (guard)';
    rows = [['Kiri',(c.adj1_left||c.adj_left)?.stn_name||'—'],
            ['Kanan',(c.adj1_right||c.adj_right)?.stn_name||'—'],['Proteksi','20 dB']];
  } else if (c.type === 'adjacent_2') {
    title = c.freq.toFixed(1)+' MHz — Adjacent-2';
    rows = [['Kiri',(c.adj2_left||c.adj_left)?.stn_name||'—'],
            ['Kanan',(c.adj2_right||c.adj_right)?.stn_name||'—'],['Proteksi','10 dB']];
  } else {
    const al = c.allotment_status;
    title = c.freq.toFixed(1)+' MHz — Kosong'+(al==='allotted_lps'?' ★':al==='allotted_rri'?' ▣':'');
    rows = [['Lower',(c.lower??c.freq-.1).toFixed(4)+' MHz'],['Upper',(c.upper??c.freq+.1).toFixed(4)+' MHz'],
            ['Allotment', al==='allotted_rri'?'RRI (KM 570)':al==='allotted_lps'?'LPS (KM 570)':al==='not_allotted'?'Tidak dijatahkan':'—']];
  }
  tt.innerHTML = `<div class="tooltip-float__title">${esc(title)}</div>`
    + rows.map(([k,v]) => `<div class="tooltip-float__row"><span>${esc(k)}</span><span>${esc(String(v))}</span></div>`).join('');
  tt.style.display = 'block'; moveTT(e);
}
function moveTT(e) {
  const tt = document.getElementById('tooltip'); if (!tt) return;
  let x = e.clientX+14, y = e.clientY-10;
  if (x+270 > window.innerWidth) x = e.clientX-280;
  tt.style.left = x+'px'; tt.style.top = y+'px';
}
function hideTT() { const tt = document.getElementById('tooltip'); if (tt) tt.style.display='none'; }

// ── Cell detail drawer ────────────────────────────────────────────────
function openCellDrawer(html) {
  let el = document.getElementById('cellDrawer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cellDrawer'; el.className = 'cell-drawer';
    el.innerHTML = `<div class="cell-drawer__backdrop"></div><div class="cell-drawer__panel" id="cellDrawerPanel"></div>`;
    document.body.appendChild(el);
    el.querySelector('.cell-drawer__backdrop').addEventListener('click', closeCellDrawer);
    document.addEventListener('keydown', ev => { if (ev.key==='Escape') closeCellDrawer(); }, {passive:true});
  }
  document.getElementById('cellDrawerPanel').innerHTML = html;
  el.classList.add('is-open');
}
function closeCellDrawer() { document.getElementById('cellDrawer')?.classList.remove('is-open'); }

function openInlineDetail(info) {
  const freq = info.freq;
  const lower = info.lower ?? info.lower_mhz ?? (freq-.1);
  const upper = info.upper ?? info.upper_mhz ?? (freq+.1);

  const BADGE = {
    used:       ['TERISI',   'cd-badge--used'],
    adjacent_1: ['ADJ-1',    'cd-badge--adj1'],
    adjacent_2: ['ADJ-2',    'cd-badge--adj2'],
    free:       ['KOSONG',   'cd-badge--free'],
  };
  const [badge, badgeCls] = BADGE[info.type] || BADGE.free;

  let rows = [], cta = '';

  if (info.type === 'used') {
    const stations = info.coStations || [info.station];
    if (stations.length > 1) {
      const cards = stations.map((s,i) => `
        <div class="cd-swipe-card">
          <div class="cd-swipe-num">${i+1} / ${stations.length}</div>
          <div class="cd-swipe-name">${esc(s.stn_name||'—')}</div>
          <div class="cd-grid" style="margin-top:10px">
            <div class="cd-item"><div class="cd-label">Wilayah</div><div class="cd-val">${esc(s.wilayah_layanan||s.kota||'—')}</div></div>
            <div class="cd-item"><div class="cd-label">ERP</div><div class="cd-val mono">${s.erp_dbm ? s.erp_dbm.toFixed(1)+' dBm' : '—'}</div></div>
            <div class="cd-item"><div class="cd-label">Jenis</div><div class="cd-val">${esc(s.jenis||'—')}</div></div>
            <div class="cd-item"><div class="cd-label">No. SIMF</div><div class="cd-val mono">${esc(s.no_simf||'—')}</div></div>
          </div>
          <button class="cd-cta" onclick="window.__openDetailFreq(${freq})">Lihat detail stasiun →</button>
        </div>`).join('');
      openCellDrawer(`
        <div class="cd-head">
          <div class="cd-head-left">
            <span class="cd-badge cd-badge--used">CO-CHANNEL ×${stations.length}</span>
            <span class="cd-freq">${freq.toFixed(1)} MHz</span>
          </div>
          <button class="cd-close" id="cdClose">✕</button>
        </div>
        <div class="cd-swipe-hint">← geser →</div>
        <div class="cd-swipe-wrap">${cards}</div>`);
      document.getElementById('cdClose')?.addEventListener('click', closeCellDrawer);
      window.__openDetailFreq = (f) => { closeCellDrawer(); openDetailPage({freq:f}); };
      return;
    }
    const s = stations[0] || {};
    rows = [
      ['Frekuensi', freq.toFixed(3)+' MHz', true],
      ['Nama stasiun', s.stn_name||'—', false],
      ['Wilayah Layanan', s.wilayah_layanan||s.kota||'—', false],
      ['Kecamatan', s.kecamatan||'—', false],
      ['ERP', s.erp_dbm ? s.erp_dbm+' dBm' : '—', true],
      ['Jenis', s.jenis||'—', false],
    ];
    cta = `<button class="cd-cta" id="cdCtaDetail">Lihat detail stasiun →</button>`;
  } else if (info.type === 'adjacent_1' || info.type === 'adjacent_2') {
    const isAdj1 = info.type === 'adjacent_1';
    const L = isAdj1 ? (info.adj1_left||info.adj_left) : (info.adj2_left||info.adj_left);
    const R = isAdj1 ? (info.adj1_right||info.adj_right) : (info.adj2_right||info.adj_right);
    rows = [
      ['Frekuensi', freq.toFixed(3)+' MHz', true],
      ['Guard kiri',  L?.stn_name||'—', false],
      ['Guard kanan', R?.stn_name||'—', false],
      ['Proteksi', isAdj1 ? '20 dB (ITU-R BS.412)' : '10 dB (ITU-R BS.412)', true],
    ];
  } else {
    const al = info.allotment_status;
    rows = [
      ['Frekuensi', freq.toFixed(3)+' MHz', true],
      ['Lower edge', Number(lower).toFixed(4)+' MHz', true],
      ['Upper edge', Number(upper).toFixed(4)+' MHz', true],
      ['Allotment', al==='allotted_rri'?'LPP RRI (KM 570/2025)':al==='allotted_lps'?'LPS/LPP Lokal (KM 570/2025)':al==='not_allotted'?'Tidak dijatahkan':'—', false],
    ];
  }

  openCellDrawer(`
    <div class="cd-head">
      <div class="cd-head-left">
        <span class="cd-badge ${badgeCls}">${badge}</span>
        <span class="cd-freq">${freq.toFixed(1)} MHz</span>
      </div>
      <button class="cd-close" id="cdClose">✕</button>
    </div>
    <div class="cd-grid">
      ${rows.map(([l,v,mono]) => `<div class="cd-item"><div class="cd-label">${esc(l)}</div><div class="cd-val${mono?' mono':''}">${esc(String(v))}</div></div>`).join('')}
    </div>
    ${cta}`);

  document.getElementById('cdClose')?.addEventListener('click', closeCellDrawer);
  document.getElementById('cdCtaDetail')?.addEventListener('click', () => {
    closeCellDrawer();
    if (info.station?.freq) openDetailPage(info.station);
    else if (info.freq) openDetailPage({ freq: info.freq });
  });
}

// ── Station detail drawer ─────────────────────────────────────────────
async function openDetailPage(stationOrFreq) {
  const freq = stationOrFreq?.freq ?? stationOrFreq;
  let el = document.getElementById('stationDrawer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stationDrawer'; el.className = 'station-drawer';
    el.innerHTML = `<div class="station-drawer__backdrop"></div><div class="station-drawer__panel" id="stationDrawerPanel"></div>`;
    document.body.appendChild(el);
    el.querySelector('.station-drawer__backdrop').addEventListener('click', closeStationDrawer);
    document.addEventListener('keydown', ev => { if (ev.key==='Escape') closeStationDrawer(); }, {passive:true});
  }
  document.getElementById('stationDrawerPanel').innerHTML =
    `<div class="state-loading"><span class="live-dot"></span> Memuat detail…</div>`;
  el.classList.add('is-open');
  try {
    const detail = await fetchStationDetail(parseFloat(freq));
    renderDetailPage(detail, closeStationDrawer, state.data, document.getElementById('stationDrawerPanel'));
  } catch(e) {
    const p = document.getElementById('stationDrawerPanel');
    if (p) p.innerHTML = `<div class="state-error"><div>⚠</div><div>Gagal memuat detail: ${esc(e.message)}</div></div>`;
  }
}
function closeStationDrawer() { document.getElementById('stationDrawer')?.classList.remove('is-open'); }

// ── Wilayah short labels ──────────────────────────────────────────────
const WILAYAH_SHORT = {
  'KOTA YOGYAKARTA': 'Kota Yogyakarta',
  'BANTUL, BANGUNTAPAN': 'Bantul – Banguntapan',
  'SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM': 'Sleman – Ngaglik – Pakem',
  'WATES, SENTOLO': 'Wates – Sentolo',
  'WONOSARI': 'Wonosari',
  'GAMPING': 'Gamping',
  'DEPOK': 'Depok',
  'PATUK': 'Patuk',
  'WANGON, JATILAWANG, PURWOJATI': 'Wangon – Jatilawang',
  'SOKARAJA, KALIBAGOR': 'Sokaraja – Kalibagor',
  'PURWOKERTO, PATIK, RAJA, KARANG LEWAS': 'Purwokerto',
  'BANJARNEGARA, BANJARMANGU, MADUKARA': 'Banjarnegara',
  'KALIBENING, PUNGGELAN': 'Kalibening – Punggelan',
  'WANAYASA, PEJAWARAN, PAGETAN, KARANG KOBAR': 'Wanayasa – Pejawaran',
  'KARANGANYAR, GOMBONG, SEMPOR': 'Gombong – Sempor',
  'KEBUMEN, ALIAN, KALIBONG': 'Kebumen',
  'AMBAL, KUTOWINANGUN, MIRIT': 'Ambal – Kutowinangun',
  'KARANGANYAR, SADANG': 'Karanganyar – Sadang',
  'KUTOARJO, BAYAN': 'Kutoarjo – Bayan',
  'PURWOREJO, BANYUURIP': 'Purworejo',
  'BRUNO, KEMIRI, PITURUH': 'Bruno – Kemiri',
  'KALIWIRO, WADASLINTANG': 'Kaliwiro – Wadaslintang',
  'MUNGKID, MUNTILAN, SALAM': 'Muntilan',
  'SUKOHARJO, GROGOL': 'Sukoharjo – Grogol',
  'EROMOKO, PRACIMANTORO': 'Eromoko – Pracimantoro',
  'GIRIWOYO, BATURETNO': 'Giriwoyo – Baturetno',
  'TIRTOMOYO, BATUWARNO, KARANG TENGAH': 'Tirtomoyo',
  'NGADIROJO, NGUNTORONADI': 'Ngadirojo',
  'JATISRONO, JATIPURNO, GIRIMARTO': 'Jatisrono',
  'JUMANTONO, JUMAPOLO': 'Jumantono – Jumapolo',
  'KRAGAN, SEDAN, SARANG': 'Kragan – Sarang',
  'PANCUR, LASEM, PAMOTAN': 'Lasem – Pamotan',
  'BATANGAN, JUWANA, JAKENAN': 'Juwana – Jakenan',
  'GUNUNGWUNGKAL, CLUWAK, TAYU': 'Tayu – Cluwak',
  'BANGSRI, KELING': 'Bangkri – Keling',
  'DORO, LEBAKBARANG, TALUN, PETUNGKRIYONO, KARANGDADAP': 'Doro – Lebakbarang',
  'KAJEN, KEDUNGWUNI': 'Kajen – Kedungwuni',
  'RANDUDONGKAL, BELIK': 'Randudongkal – Belik',
  'BUMIJAWA, BOJONG': 'Bumijawa – Bojong',
  'SURADADI, TARUB': 'Suradadi – Tarub',
  'BANTARKAWUNG': 'Bantarkawung',
  'BANJARHAREJO, KETANGGUNGAN': 'Banjarharejo – Ketanggungan',
  'BANJARHAREJO, KETANGGUNGAN': 'Banjarharejo – Ketanggungan',
  'KOTA MAGELANG': 'Kota Magelang',
  'KOTA SURAKARTA': 'Kota Surakarta',
  'KOTA SALATIGA': 'Kota Salatiga',
  'KOTA SEMARANG': 'Kota Semarang',
  'KOTA PEKALONGAN': 'Kota Pekalongan',
  'KOTA TEGAL': 'Kota Tegal',
  // Jateng — tambahan dari allotment.js yang belum ada
  'AMBARAWA, BANDUNGAN': 'Ambarawa – Bandungan',
  'BANGSRI, KELING': 'Bangsri – Keling',
  'BANYUPUTH, LIMPUNG': 'Banyuputih – Limpung',
  'BATANG': 'Batang',
  'BLADO, REBAN, BAWANG': 'Blado – Reban',
  'BLORA': 'Blora',
  'BOYOLALI': 'Boyolali',
  'BREBES': 'Brebes',
  'BUMIAYU, PAGUYANGAN': 'Bumiayu – Paguyangan',
  'CILACAP': 'Cilacap',
  'DEMAK': 'Demak',
  'GANDRUNGMANGU': 'Gandrungmangu',
  'JEPARA': 'Jepara',
  'KALIKAJAR, KERTEK': 'Kalikajar – Kertek',
  'KARANGANYAR': 'Karanganyar',
  'KARANGPANDAN': 'Karangpandan',
  'KARIMUN JAWA': 'Karimunjawa',
  'KEDUNGTUBAN, CEPU': 'Kedungtuban – Cepu',
  'KENDAL, WELERI': 'Kendal – Weleri',
  'KLATEN': 'Klaten',
  'KUDUS': 'Kudus',
  'KUTOARJO, BAYAN': 'Kutoarjo – Bayan',
  'MAJENANG': 'Majenang',
  'PATI': 'Pati',
  'PEMALANG': 'Pemalang',
  'PURBALINGGA': 'Purbalingga',
  'PURWODADI': 'Purwodadi',
  'REMBANG': 'Rembang',
  'SAPURAN': 'Sapuran',
  'SLAWI': 'Slawi',
  'SRAGEN': 'Sragen',
  'SURADADI, TARUB': 'Suradadi – Tarub',
  'TEMANGGUNG': 'Temanggung',
  'UNGARAN': 'Ungaran',
  'WIRADESA': 'Wiradesa',
  'WIROSARI, NGARINGAN': 'Wirosari – Ngaringan',
  'WONOGIRI': 'Wonogiri',
  'WONOSOBO, LEKSONO': 'Wonosobo – Leksono',
  'WONOTUNGGAL, BANDAR': 'Wonotunggal – Bandar',
};
function shortWilayah(w) { return WILAYAH_SHORT[w] || w; }

function esc(s) { const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

boot();
