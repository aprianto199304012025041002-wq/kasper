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
  _interfLoading:  false,
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
  const geo = state.geoSettings || {};
  if (geo.showAdj === false)  p.set('gAdj', '0');
  if (geo.showLabel === false) p.set('gLbl', '0');
  if (geo.onlyFree)           p.set('gFree', '1');
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
  if (p.has('gAdj') || p.has('gLbl') || p.has('gFree')) {
    state.geoSettings = {
      showAdj:   p.get('gAdj')  !== '0',
      showLabel: p.get('gLbl')  !== '0',
      onlyFree:  p.get('gFree') === '1',
    };
  }
}

// -- Keyboard shortcuts -----------------------------------------------
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Jangan intercept kalau sedang di input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
    switch (e.key) {
      case '1': state.view='grid'; state.page='main'; syncURL(); renderControls(); renderContent(); break;
      case '2': state.view='band'; state.page='main'; syncURL(); renderControls(); renderContent(); break;
      case '3': state.view='geo';  state.page='main'; syncURL(); renderControls(); renderContent(); break;
      case '4': state.page='interference'; syncURL(); renderControls();
        if (!state.interfData) loadInterference(); else renderContent(); break;
      case 'f': case '/':
        e.preventDefault();
        document.getElementById('fSearch')?.focus();
        break;
      case 'Escape':
        if (document.getElementById('helpOverlay')) { document.getElementById('helpOverlay').remove(); break; }
        if (state.searchTerm) {
          state.searchTerm = '';
          const el = document.getElementById('fSearch');
          if (el) el.value = '';
          syncURL(); renderControls(); renderContent();
        } else if (state.selectedWilayah) {
          state.selectedWilayah = null; state.filterCities = [];
          syncURL(); renderSidebar(); renderContent();
        }
        break;
      case '?':
        toggleHelpOverlay(); break;
      case 'r': refreshData(); break;
      case 'd': toggleTheme(); break;
      case 'b':
        state.sidebarCollapsed = !state.sidebarCollapsed;
        document.getElementById('sidebar')?.classList.toggle('is-collapsed', state.sidebarCollapsed);
        const btn = document.getElementById('sidebarCollapseBtn');
        if (btn) btn.textContent = state.sidebarCollapsed ? '\u203a' : '\u2039';
        break;
    }
  });
}

// -- Boot -------------------------------------------------------------
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
  window.__openDetailFreq = (f) => openDetailPage({ freq: f });
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
          <button class="toolbar-tab${state.view==='grid'?' is-active':''}" data-view="grid" title="Grid view [1]">GRID</button>
          <button class="toolbar-tab${state.view==='band'?' is-active':''}" data-view="band" title="Pita frekuensi [2]">PITA</button>
          <button class="toolbar-tab${state.view==='geo'?' is-active':''}" data-view="geo" title="Geo density [3]">GEO</button>
          ${state.view==='geo' && state.page==='main' ? `
          <div class="toolbar-sep"></div>
          <label class="toolbar-geo-opt"><input type="checkbox" id="dGeoAdj" ${state.geoSettings?.showAdj!==false?'checked':''}> Guard</label>
          <label class="toolbar-geo-opt"><input type="checkbox" id="dGeoLabel" ${state.geoSettings?.showLabel!==false?'checked':''}> Label</label>
          <label class="toolbar-geo-opt"><input type="checkbox" id="dGeoFree" ${state.geoSettings?.onlyFree?'checked':''}> Kosong saja</label>
          ` : ''}
          <div class="toolbar-sep"></div>
          <button class="toolbar-tab${state.page==='interference'?' is-active':''}" data-page="interference" title="Analisis interferensi RF [4]">⚡ RF</button>
          <div class="toolbar-right">
            <div class="toolbar-search-wrap">
              <input type="search" class="toolbar-search" id="fSearch" placeholder="Cari stasiun / pemilik / frekuensi…" value="${esc(state.searchTerm)}"/>
              ${state.searchTerm ? `<button class="toolbar-search-clear" id="fSearchClear" title="Hapus pencarian">✕</button>` : ''}
            </div>
            <select class="toolbar-select" id="fChanView">
              <option value="all"     ${state.filterChanView==='all'     ?'selected':''}>Semua kanal</option>
              <option value="free"    ${state.filterChanView==='free'    ?'selected':''}>Kosong saja</option>
              <option value="used"    ${state.filterChanView==='used'    ?'selected':''}>Terisi saja</option>
              <option value="expired" ${state.filterChanView==='expired' ?'selected':''}>⚠ Izin habis</option>
            </select>
            ${(state.filterCities?.length || state.searchTerm || state.filterChanView !== 'all') ?
              `<button class="toolbar-reset" id="fReset" title="Reset semua filter [Esc]">↺ Reset</button>` : ''}
            <button class="toolbar-btn" id="exportExpiredBtn" title="Export daftar izin habis ke CSV" style="display:${state.filterChanView==='expired'?'':'none'}">⬇ CSV</button>
            <button class="toolbar-btn" id="helpBtn" title="Keyboard shortcuts [?]" style="padding:4px 8px;color:var(--txt-3)">?</button>
          </div>
        </div>
        <div id="statsBar"></div>
        <div id="legendBar"></div>
        <div id="freeBlocksPanel"></div>
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
    const label = (el.querySelector('.sidebar__label')?.textContent || '').toLowerCase();
    el.style.display = (!q || name.includes(q) || label.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.sidebar__section-label').forEach(label => {
    const sec = label.nextElementSibling;
    const wrapper = label.closest('.sidebar__section');
    if (!sec) return;
    const anyVisible = [...sec.querySelectorAll('.sidebar__item')].some(i => i.style.display !== 'none');
    label.style.display = sec.style.display = anyVisible ? '' : 'none';
    if (wrapper) wrapper.style.display = anyVisible ? '' : 'none';
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
      <button id="refreshBtn" class="theme-toggle" title="Refresh data [R]" style="font-size:13px">↺</button>
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
  const now = Date.now();
  const expMap = {};
  state.data.stations.forEach(s => {
    const w = s.wilayah_layanan || s.kota || '';
    if (w && s.validity && new Date(s.validity).getTime() < now)
      expMap[w] = (expMap[w] || 0) + 1;
  });
  const expCnt = (w) => expMap[w] || 0;

  // Grup berdasarkan province dari data — tidak hardcode nama wilayah
  const diy    = allWilayah.filter(w => isYogya(w));
  const jateng = allWilayah.filter(w => !isYogya(w));

  const itemHtml = (w) => {
    const active = state.selectedWilayah === w;
    const exp = expCnt(w);
    const expBadge = exp > 0 ? `<span class="sidebar__badge sidebar__badge--exp" title="${exp} izin habis">⚠${exp}</span>` : '';
    return `<button class="sidebar__item${active?' is-active':''}" data-wilayah="${esc(w)}">
      <span class="sidebar__label">${esc(shortWilayah(w))}</span>
      ${expBadge}<span class="sidebar__badge">${cnt(w)}</span>
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
      document.querySelector('.sync-tbody')?.scrollTo(0, 0);
    });
  });
  nav.querySelector('[data-page="interference"]')?.addEventListener('click', () => {
    state.page = 'interference'; state.selectedWilayah = null;
    syncURL(); renderSidebar(); renderContent();
    if (!state.interfData) loadInterference();
  });
}

// ── Stats bar ────────────────────────────────────────────────────────
function renderStatsBar(summary, allotmentStats = null, expiredCount = 0) {
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
    ${expiredCount > 0 ? `
    <div class="stat-cell stat-cell--btn" data-filter-chan="expired" title="Filter: izin habis">
      <div class="stat-cell__label">⚠ Izin habis</div>
      <div class="stat-cell__val --red">${expiredCount}<span class="unit">stasiun</span></div>
      <div class="stat-cell__meter" style="width:${(expiredCount/summary.used*100).toFixed(1)}%;background:var(--red)"></div>
    </div>` : ''}
    ${extra}
  </div>`;
  // Stats cell click → filter
  el.querySelectorAll('.stat-cell--btn[data-filter-chan]').forEach(cell => {
    cell.addEventListener('click', () => {
      state.filterChanView = cell.dataset.filterChan;
      const sel = document.getElementById('fChanView');
      if (sel) sel.value = state.filterChanView;
      const expBtn = document.getElementById('exportExpiredBtn');
      if (expBtn) expBtn.style.display = state.filterChanView === 'expired' ? '' : 'none';
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
    <div class="legend-chip"><span class="legend-chip__dot" style="background:rgba(255,59,59,.08);border:1px dashed var(--red)"></span>Izin habis</div>
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


// -- Free block panel -------------------------------------------------
function renderFreeBlocksPanel() {
  const el = document.getElementById('freeBlocksPanel');
  if (!el) return;
  const activeCities = state.filterCities?.length === 1 ? state.filterCities : null;
  if (!activeCities) { el.innerHTML = ''; return; }
  const city = activeCities[0];
  const cityStations = state.data?.stations.filter(s => (s.wilayah_layanan || s.kota) === city) || [];
  const channelMap = computeChannelMapForWilayah(cityStations, city);
  const allotFree = channelMap.filter(c =>
    c.type === 'free' &&
    (c.allotment_status === 'allotted_lps' || c.allotment_status === 'allotted_rri')
  );
  if (allotFree.length === 0) { el.innerHTML = ''; return; }
  const rows = allotFree.map(c => {
    const isRRI = c.allotment_status === 'allotted_rri';
    const badge = isRRI
      ? `<span style="color:var(--purple);font-size:9px;background:var(--purple-dim);padding:1px 5px;border-radius:3px">RRI</span>`
      : `<span style="color:var(--cyan);font-size:9px;background:var(--cyan-dim);padding:1px 5px;border-radius:3px">LPS</span>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--txt);min-width:52px">${c.freq.toFixed(1)} MHz</span>
      ${badge}
      <span style="font-size:10px;color:var(--txt-3);font-family:var(--mono)">${Number(c.lower).toFixed(3)}–${Number(c.upper).toFixed(3)} MHz</span>
    </div>`;
  }).join('');
  el.innerHTML = `<div style="margin-bottom:10px;padding:10px 12px;background:var(--bg-panel);border:1px solid rgba(29,255,154,.2);border-radius:var(--r2)">
    <div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--txt-3);text-transform:uppercase;margin-bottom:8px">
      Slot kosong terjatah — ${esc(shortWilayah(city))}
      <span style="color:var(--phosphor);margin-left:6px">${allotFree.length} kanal</span>
    </div>
    ${rows}
    <div style="font-size:9px;color:var(--txt-3);margin-top:6px">KM Komdigi 570/2025</div>
  </div>`;
}

// ── Attach events ─────────────────────────────────────────────────────
function attachEvents() {
  document.addEventListener('change', e => {
    if (e.target.id === 'fChanView') {
      state.filterChanView = e.target.value;
      syncURL(); renderContent();
      // Show/hide export button
      const expBtn = document.getElementById('exportExpiredBtn');
      if (expBtn) expBtn.style.display = state.filterChanView === 'expired' ? '' : 'none';
    }
    if (['dGeoAdj','dGeoLabel','dGeoFree'].includes(e.target.id)) {
      state.geoSettings = {
        showAdj:   document.getElementById('dGeoAdj')?.checked ?? true,
        showLabel: document.getElementById('dGeoLabel')?.checked ?? true,
        onlyFree:  document.getElementById('dGeoFree')?.checked ?? false,
      };
      renderContent();
    }
  });
  document.addEventListener('click', e => {
    if (e.target.id === 'fSearchClear') {
      state.searchTerm = '';
      syncURL(); renderControls(); renderContent();
      document.getElementById('fSearch')?.focus();
    }
    if (e.target.id === 'exportExpiredBtn') { exportExpiredCSV(); return; }
    if (e.target.id === 'helpBtn') { toggleHelpOverlay(); return; }
    if (e.target.id === 'refreshBtn') { refreshData(); return; }
    const syncLabel = e.target.closest('.sync-label[data-city]');
    if (syncLabel && !e.target.closest('#kasperDrawer') && !e.target.closest('#helpOverlay')) {
      const city = syncLabel.dataset.city;
      if (state.selectedWilayah === city) { state.selectedWilayah = null; state.filterCities = []; }
      else { state.selectedWilayah = city; state.filterCities = [city]; }
      syncURL(); renderSidebar(); renderContent(); return;
    }
    if (e.target.id === 'fReset') {
      state.filterCities = []; state.selectedWilayah = null;
      state.filterChanView = 'all'; state.searchTerm = '';
      syncURL(); renderSidebar(); renderControls(); renderContent();
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
    const city = cell.closest('.sync-row')?.querySelector('.sync-label')?.dataset?.city
      || cell.closest('.city-block')?.querySelector('.city-block__name')?.dataset?.city;
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
  const dbg = (msg) => { const el = document.getElementById('dynamicContent'); if(el) el.innerHTML = `<div style="padding:16px;font-size:12px;font-family:monospace">${msg}</div>`; };
  state.loading = true; state.error = null; state.data = null;
  dbg('1. loading=true, memanggil fetchSpectrum...');
  try {
    const raw = await fetchSpectrum({});
    dbg('2. fetchSpectrum selesai, stations=' + (raw?.stations?.length ?? 'null'));
    state.data = raw;
    dbg('3. state.data ter-assign');
    state.loading = false;
    dbg('4. loading=false');
    state._allotmentCache = null;    state._allotmentCacheData = null;
    state._stationCountMap = {};
    (state.data.stations || []).forEach(s => {
      const w = s.wilayah_layanan || s.kota || '';
      if (w) state._stationCountMap[w] = (state._stationCountMap[w] || 0) + 1;
    });
    dbg('5. stationCountMap selesai');
    const total = state.data.stations?.length ?? 0;
    const nowTs = Date.now();
    const totalExpired = (state.data.stations || []).filter(s => s.validity && new Date(s.validity).getTime() < nowTs).length;
    const statusEl = document.getElementById('headerStatus');
    const nowStr = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    if (statusEl) statusEl.innerHTML = `${total} stasiun${totalExpired ? ` · <span style="color:var(--red)" title="${totalExpired} izin habis">⚠ ${totalExpired} habis</span>` : ''} · ${nowStr}`;
    dbg('6. statusEl updated');
  } catch(e) {
    state.error = e.message || String(e); state.loading = false;
    dbg('CATCH: ' + state.error);
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
  if (state._interfLoading) return;
  state._interfLoading = true;
  // Jangan set state.loading global — hanya render interference panel sendiri
  if (state.page === 'interference') renderContent();
  try {
    const raw = await fetchInterference({});
    const stations = raw.stations || state.data?.stations || [];
    await new Promise(resolve => {
      const compute = () => {
        state.interfData = computeInterference(stations);
        state._interfLoading = false;
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
  } finally {
    state.loading = false;
    state._interfLoading = false;
    renderContent();
  }
}

// ── Dynamic content ───────────────────────────────────────────────────
function renderContent() {
  const el = document.getElementById('dynamicContent');
  if (!el) return;

  if (state.loading) {
    const caller = new Error().stack?.split('\n').slice(1,3).map(l=>l.trim()).join(' ← ') || '?';
    el.innerHTML = `<div style="padding:16px;font-size:11px;font-family:monospace;word-break:break-all">loading=true<br>data=${state.data?'ada':'null'}<br>caller: ${caller}</div>`;
    return;
  }
    </div>`;
    el.innerHTML = `<div class="state-loading"><span class="live-dot"></span> Memuat data spektrum…</div>`;
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
    if (state._interfLoading) {
      el.innerHTML = `<div class="state-loading"><span class="live-dot"></span> Memuat interferensi…</div>`;
    } else {
      el.innerHTML = '<div class="interf-wrap" id="interfPanel"></div>';
      if (state.interfData) renderInterferencePanel(document.getElementById('interfPanel'), state.interfData);
    }
    return;
  }
  if (!state.data) return;

  if (state.selectedWilayah && !state.filterCities.includes(state.selectedWilayah))
    state.filterCities = [state.selectedWilayah];

  // Hitung summary dari cityRows yang aktif (bukan global)
  // Dihitung setelah cityRows tersedia — placeholder dulu
  renderLegend();

  const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const searchLower = (state.searchTerm || '').toLowerCase().trim();

  const matchSearch = (c) => {
    if (!searchLower) return true;
    if (c.type !== 'used') return String(c.freq).includes(searchLower);
    return String(c.freq).includes(searchLower)
      || (c.station?.stn_name || '').toLowerCase().includes(searchLower)
      || (c.station?.clnt_name || '').toLowerCase().includes(searchLower)
      || (c.station?.no_simf || '').toLowerCase().includes(searchLower)
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
    // Index stasiun per frekuensi — O(1) lookup per channel, bukan O(stations) per channel
    const stationsByFreq = {};
    cityStations.forEach(s => {
      const fk = Math.round(parseFloat(s.freq) * 10);
      if (!stationsByFreq[fk]) stationsByFreq[fk] = [];
      stationsByFreq[fk].push(s);
    });
    const row = state.data.channel_map.map(c => {
      const allotment_status = allotIdx[c.freq] ?? null;
      const fk = Math.round(c.freq * 10);
      const ownStations = stationsByFreq[fk] || [];
      if (ownStations.length > 0)
        return { ...c, allotment_status, type: 'used', station: ownStations[0], coStations: ownStations };
      if (c.type === 'used') return { ...c, allotment_status, type: 'free', station: null };
      return { ...c, allotment_status };
    }).filter(matchSearch);
    return { city, row };
  }); // semua wilayah tetap tampil — yang 0 stasiun tampil empty state

  // Hitung summary dari cityRows aktif (akurat untuk filter wilayah)
  const activeSummary = (() => {
    let used = 0, adj1 = 0, adj2 = 0, free = 0, expired = 0;
    const now = Date.now();
    cityRows.forEach(({ row }) => {
      row.forEach(c => {
        if      (c.type === 'used')       { used++; const v = c.station?.validity; if (v && new Date(v).getTime() < now) expired++; }
        else if (c.type === 'adjacent_1') adj1++;
        else if (c.type === 'adjacent_2') adj2++;
        else if (c.type === 'free')       free++;
      });
    });
    const total = used + adj1 + adj2 + free;
    return { total, used, adjacent_1: adj1, adjacent_2: adj2, free, expired };
  })();
  // hitung allotment stats
  cityRows.forEach(({ row }) => {
    row.forEach(c => {
      if (c.allotment_status === 'allotted_lps' || c.allotment_status === 'allotted_rri') {
        allotTotal++;
        if (c.type === 'used') allotUsed++; else allotFree++;
      }
    });
  });
  // Simpan scroll position sync-tbody sebelum re-render
  const _prevScrollLeft = el.querySelector('.sync-tbody')?.scrollLeft ?? 0;

  renderStatsBar(activeSummary, allotTotal > 0 ? { total: allotTotal, used: allotUsed, free: allotFree } : null, activeSummary.expired);
  renderFreeBlocksPanel();

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
    if (state.filterChanView === 'expired') {
      const now = Date.now();
      return row.filter(c => {
        const v = c.station?.validity || c.coStations?.[0]?.validity;
        return c.type === 'used' && v && new Date(v).getTime() < now;
      });
    }
    return row;
  };

  // ── Band view — sync scroll, label sticky kiri ─────────────────────
  const _isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (state.view === 'band') {
    let _bandLastProv = null;
    const bandRows = cityRows.flatMap(({ city, row }) => {
      const filtered = applyFilter(row);
      if (!filtered.length) return [];
      const nowTs2 = Date.now();
      const expInRow2 = row.filter(c => c.type === 'used' && c.station?.validity && new Date(c.station.validity).getTime() < nowTs2).length;
      const expBadge2 = expInRow2 > 0 ? `<span class="city-exp-badge" title="${expInRow2} izin habis">⚠${expInRow2}</span>` : '';
      const cityProv2 = getWilayahProvinceMap()[city] || '';
      const provLabel2 = cityProv2.includes('YOGYAKARTA') ? 'D.I. Yogyakarta' : 'Jawa Tengah';
      const divider2 = (_bandLastProv !== null && cityProv2 !== _bandLastProv)
        ? `<div class="sync-divider"><span>${provLabel2}</span></div>` : '';
      _bandLastProv = cityProv2;
      return [divider2 + `<div class="sync-row band-sync-row">
        <div class="sync-label" data-city="${esc(city)}" title="${esc(shortWilayah(city))}">
          <span class="sync-label__name">${esc(shortWilayah(city))}</span>
          <span class="sync-label__count">${state._stationCountMap?.[city] ?? 0}${expBadge2}</span>
        </div>
        <div class="band-scroll">${renderBandSVG(filtered, city, _isLight)}</div>
      </div>`];
    });
    el.innerHTML = `<div class="sync-table">
      <div class="sync-tbody band-tbody">${bandRows.join('')}</div>
    </div>`;
    attachCellTooltips();
    return;
  }

  // ── Grid / Geo view ───────────────────────────────────────────────
  const cellFn = state.view === 'geo' ? (c) => renderCellGeo(c) : renderCell;

  // Kalau filter expired aktif dan tidak ada hasil sama sekali
  if (activeCityRows.length === 0 && state.filterChanView !== 'all') {
    el.innerHTML = `<div class="state-empty" style="padding:48px 24px;text-align:center">
      <div style="font-size:24px;margin-bottom:12px">✓</div>
      <div style="font-size:13px;color:var(--txt-2)">${
        state.filterChanView === 'expired' ? 'Tidak ada stasiun dengan izin habis di wilayah ini.' :
        state.filterChanView === 'free'    ? 'Tidak ada kanal kosong di wilayah ini.' :
        'Tidak ada hasil untuk filter ini.'
      }</div>
    </div>`;
    attachCellTooltips();
    return;
  }

  // ── Geo view: layout per-wilayah biasa (cell 36px, tidak sync) ───
  if (state.view === 'geo') {
    el.innerHTML = cityRows.flatMap(({ city, row }) => {
      const filtered = applyFilter(row);
      if (!filtered.length) return [];
      return [`<div class="city-block">
        <div class="city-block__head">
          <span class="city-block__name" data-city="${esc(city)}">${esc(shortWilayah(city))}</span>
          <span class="city-block__count">${state._stationCountMap?.[city] ?? 0} stasiun</span>
        </div>
        <div class="ch-row">${filtered.map(c => renderCellGeo(c)).join('')}</div>
      </div>`];
    }).join('');
    attachCellTooltips();
    return;
  }

  // ── Sync-scroll: spreadsheet layout — label sticky kiri, freq header sticky atas ──
  const nowTs = Date.now();

  // Kumpulkan frekuensi unik — skip wilayah yang 0 hasil setelah filter+search
  const allFreqs = new Set();
  const filteredByCity = {};
  const activeCityRows = cityRows.filter(({ city, row }) => {
    const filtered = applyFilter(row);
    if (!filtered.length) return false;
    filteredByCity[city] = filtered;
    filtered.forEach(c => allFreqs.add(c.freq));
    return true;
  });
  const sortedFreqs = [...allFreqs].sort((a, b) => a - b);

  // Header baris frekuensi
  const freqHeader = sortedFreqs.map(f =>
    `<div class="sync-fhdr">${f.toFixed(1)}</div>`
  ).join('');

  // Tiap wilayah = satu baris, tiap frekuensi = satu slot
  let _lastProvince = null;
  const rows = activeCityRows.map(({ city, row }) => {
    const filtered = filteredByCity[city];
    const cellMap = {};
    filtered.forEach(c => { cellMap[c.freq] = cellFn(c); });
    const usedInRow = filtered.filter(c => c.type === 'used').length;
    const totalInRow = state._stationCountMap?.[city] ?? 0;
    const expInRow = row.filter(c => c.type === 'used' && c.station?.validity && new Date(c.station.validity).getTime() < nowTs).length;
    const countLabel = state.filterChanView !== 'all' ? `${usedInRow}/${totalInRow}` : `${totalInRow}`;
    const expBadge = expInRow > 0 && state.filterChanView === 'all'
      ? `<span class="city-exp-badge" title="${expInRow} izin habis">⚠${expInRow}</span>` : '';
    const slots = sortedFreqs.map(f =>
      cellMap[f] ?? `<div class="sync-cell-empty"></div>`
    ).join('');
    const shortName = shortWilayah(city);
    const cityProv = getWilayahProvinceMap()[city] || '';
    const provLabel = cityProv.includes('YOGYAKARTA') ? 'D.I. Yogyakarta' : 'Jawa Tengah';
    const divider = (_lastProvince !== null && cityProv !== _lastProvince)
      ? `<div class="sync-divider"><span>${provLabel}</span></div>` : '';
    if (_lastProvince === null) {
      _lastProvince = cityProv;
    } else {
      _lastProvince = cityProv;
    }
    const isSelected = state.selectedWilayah === city || state.filterCities?.[0] === city;
    return divider + `<div class="sync-row${isSelected ? ' sync-row--active' : ''}">
      <div class="sync-label${isSelected ? ' sync-label--active' : ''}" data-city="${esc(city)}" title="${esc(shortName)}">
        <span class="sync-label__name">${esc(shortName)}</span>
        <span class="sync-label__count">${countLabel}${expBadge}</span>
      </div>
      <div class="sync-cells">${slots}</div>
    </div>`;
  });

  el.innerHTML = `<div class="sync-table">
    <div class="sync-thead">
      <div class="sync-corner"></div>
      <div class="sync-fhdr-row">${freqHeader}</div>
    </div>
    <div class="sync-tbody">${rows.join('')}</div>
  </div>`;

  // Sync scroll header dengan body + restore posisi sebelumnya
  const thead = el.querySelector('.sync-thead');
  const tbody = el.querySelector('.sync-tbody');
  if (tbody && thead) {
    if (_prevScrollLeft > 0) {
      tbody.scrollLeft = _prevScrollLeft;
      thead.scrollLeft = _prevScrollLeft;
    }
    tbody.addEventListener('scroll', () => {
      thead.scrollLeft = tbody.scrollLeft;
    }, { passive: true });
  }

  attachCellTooltips();
}

// ── Cell renderers ────────────────────────────────────────────────────
function firstWord(n) { return (n || '').trim().split(/\s+/)[0]; }
const _BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
function fmtDateTT(raw) { if (!raw) return '—'; const d = new Date(raw); return isNaN(d) ? raw : `${d.getUTCDate()} ${_BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }

function adjSym(c) {
  const a1L = c.adj1_left  || (c.type==='adjacent_1' && c.adj_left);
  const a1R = c.adj1_right || (c.type==='adjacent_1' && c.adj_right);
  const a2L = c.adj2_left  || (c.type==='adjacent_2' && c.adj_left);
  const a2R = c.adj2_right || (c.type==='adjacent_2' && c.adj_right);
  return ((a1L?'<':a2L?'«':'') + (a1R?'>':a2R?'»':'')).trim() || '—';
}

function isStationExpired(c) {
  const v = c.station?.validity || c.coStations?.[0]?.validity;
  return v && new Date(v).getTime() < Date.now();
}

function renderCell(c) {
  if (c.type === 'used') {
    const co = c.coStations?.length > 1 ? `<span class="ch-cell__co">${c.coStations.length}</span>` : '';
    const exp = isStationExpired(c) ? ' ch-cell--expired' : '';
    return `<div class="ch-cell ch-cell--used${exp}" data-freq="${c.freq}">
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
    const exp = isStationExpired(c) ? ' ch-cell--expired' : '';
    return `<div class="ch-cell ch-cell--used${exp}" data-freq="${c.freq}" style="width:36px;height:36px">
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
      const waveClr = isStationExpired(c) ? '#FF3B3B' : '#FFB800';
      const dashAttr = isStationExpired(c) ? ' stroke-dasharray="4,2"' : '';
      paths.push(`<path d="${pts} L${x1.toFixed(1)},${cy} L${x0.toFixed(1)},${cy} Z" fill="${waveClr}" opacity=".08"/>`);
      paths.push(`<path d="${pts}" stroke="${waveClr}" stroke-width="1.6" fill="none"${dashAttr}/>`);
      const cnt = (c.coStations||[]).length > 1 ? ` ×${c.coStations.length}` : '';
      labels.push(`<text x="${x.toFixed(1)}" y="${(cy-amp-5).toFixed(1)}" text-anchor="middle" font-size="7" fill="${waveClr}" font-family="monospace">${c.freq.toFixed(1)}${cnt}</text>`);
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
    const city = cell.closest('.sync-row')?.querySelector('.sync-label')?.dataset?.city
      || cell.closest('.city-block')?.querySelector('.city-block__name')?.dataset?.city;
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
    const expired = isStationExpired(c);
    const co = c.coStations?.length > 1 ? c.coStations : null;
    title = (expired ? '⚠ ' : '') + (s?.stn_name || c.freq.toFixed(1)+' MHz')
      + (co ? ` +${co.length-1} lainnya` : '');
    const validStr = s?.validity ? (expired ? '⚠ ' : '') + fmtDateTT(s.validity) : '—';
    rows = [['Frekuensi', c.freq.toFixed(3)+' MHz'],['ERP',(s?.erp_dbm||'—')+' dBm'],
            ['Wilayah', s?.wilayah_layanan||s?.kota||'—'],
            ['Berlaku s.d.', validStr]];
    if (co) co.slice(1).forEach(cs => rows.push(['', esc(cs.stn_name||'—')]));
    rows.push(['','▸ Klik untuk detail']);
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
        <div class="cd-swipe-wrap" id="cdSwipeWrap">${cards}</div>
        <div class="cd-swipe-dots" id="cdSwipeDots">${stations.map((_,i) =>
          `<span class="cd-swipe-dot${i===0?' is-active':''}"></span>`).join('')}</div>`);
      setTimeout(() => {
        const wrap = document.getElementById('cdSwipeWrap');
        const dots = document.querySelectorAll('.cd-swipe-dot');
        if (wrap && dots.length) wrap.addEventListener('scroll', () => {
          const idx = Math.round(wrap.scrollLeft / wrap.offsetWidth);
          dots.forEach((d,i) => d.classList.toggle('is-active', i === idx));
        }, {passive:true});
      }, 50);
      document.getElementById('cdClose')?.addEventListener('click', closeCellDrawer);
      window.__openDetailFreq = (f) => { closeCellDrawer(); openDetailPage({freq:f}); };
      return;
    }
    const s = stations[0] || {};
    const nowMs = Date.now();
    const sExpired = s.validity && new Date(s.validity).getTime() < nowMs;
    const validLabel = s.validity ? fmtDateTT(s.validity) + (sExpired ? ' ⚠' : '') : '—';
    rows = [
      ['Frekuensi', freq.toFixed(3)+' MHz', true],
      ['Nama stasiun', (sExpired ? '⚠ ' : '') + (s.stn_name||'—'), false],
      ['Wilayah Layanan', s.wilayah_layanan||s.kota||'—', false],
      ['Kecamatan', s.kecamatan||'—', false],
      ['ERP', s.erp_dbm ? s.erp_dbm+' dBm' : '—', true],
      ['Jenis', s.jenis||'—', false],
      ['Berlaku s.d.', validLabel, sExpired],
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
  // Sync freq ke URL supaya bisa di-share/bookmark
  const p = new URLSearchParams(location.search);
  p.set('freq', parseFloat(freq).toFixed(3));
  history.replaceState(null, '', `?${p}`);
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
    // Cache detail per frekuensi — invalidate saat data berubah
    if (!state._detailCache) state._detailCache = { _data: null };
    if (state._detailCache._data !== state.data) {
      state._detailCache = { _data: state.data };
    }
    const fkey = parseFloat(freq).toFixed(3);
    if (!state._detailCache[fkey]) {
      state._detailCache[fkey] = await fetchStationDetail(parseFloat(freq));
    }
    const detail = state._detailCache[fkey];
    renderDetailPage(detail, closeStationDrawer, state.data, document.getElementById('stationDrawerPanel'));
  } catch(e) {
    const p = document.getElementById('stationDrawerPanel');
    if (p) p.innerHTML = `<div class="state-error"><div>⚠</div><div>Gagal memuat detail: ${esc(e.message)}</div></div>`;
  }
}
function closeStationDrawer() {
  document.getElementById('stationDrawer')?.classList.remove('is-open');
  // Hapus freq dari URL saat drawer ditutup
  const p = new URLSearchParams(location.search);
  p.delete('freq');
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

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
  'DORO, LEBAKBARANG, TALUN, PETUNGKRIYONO, KARANGDADAP': 'Doro – Lebakbarang',
  'KAJEN, KEDUNGWUNI': 'Kajen – Kedungwuni',
  'RANDUDONGKAL, BELIK': 'Randudongkal – Belik',
  'BUMIJAWA, BOJONG': 'Bumijawa – Bojong',
  'SURADADI, TARUB': 'Suradadi – Tarub',
  'BANTARKAWUNG': 'Bantarkawung',
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
  'MAJENANG': 'Majenang',
  'PATI': 'Pati',
  'PEMALANG': 'Pemalang',
  'PURBALINGGA': 'Purbalingga',
  'PURWODADI': 'Purwodadi',
  'REMBANG': 'Rembang',
  'SAPURAN': 'Sapuran',
  'SLAWI': 'Slawi',
  'SRAGEN': 'Sragen',
  'TEMANGGUNG': 'Temanggung',
  'UNGARAN': 'Ungaran',
  'WIRADESA': 'Wiradesa',
  'WIROSARI, NGARINGAN': 'Wirosari – Ngaringan',
  'WONOGIRI': 'Wonogiri',
  'WONOSOBO, LEKSONO': 'Wonosobo – Leksono',
  'WONOTUNGGAL, BANDAR': 'Wonotunggal – Bandar',
};
function shortWilayah(w) { return WILAYAH_SHORT[w] || w; }

async function refreshData() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.style.opacity = '.4'; btn.style.pointerEvents = 'none'; }
  state._allotmentCache = null;
  state._detailCache = null;
  state._wpMap = null;
  state.interfData = null;
  state._interfLoading = false;
  await loadData();
  if (state.page === 'interference') await loadInterference();
  if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
}

// Cache wilayah→province map — dipakai di sidebar, grid, band view
function getWilayahProvinceMap() {
  if (state._wpMap && state._wpMapData === state.data) return state._wpMap;
  state._wpMap = {};
  state._wpMapData = state.data;
  (state.data?.stations || []).forEach(s => {
    const w = s.wilayah_layanan || s.kota || '';
    if (w && s.province) state._wpMap[w] = s.province;
  });
  return state._wpMap;
}
function isYogya(city) { return (getWilayahProvinceMap()[city] || '').includes('YOGYAKARTA'); }

function toggleHelpOverlay() {
  let el = document.getElementById('helpOverlay');
  if (el) { el.remove(); return; }
  el = document.createElement('div');
  el.id = 'helpOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';
  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r2);padding:24px 28px;min-width:340px;max-width:90vw;font-family:var(--mono)">
      <div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:16px;letter-spacing:.05em">KASPER — Keyboard Shortcuts</div>
      ${[
        ['1 / 2 / 3','Grid / Pita / Geo view'],
        ['4','Halaman Interferensi'],
        ['f  atau  /','Fokus ke kotak cari (nama / pemilik / frekuensi)'],
        ['Esc','Hapus filter / tutup detail'],
        ['b','Toggle sidebar'],
        ['r','Refresh data dari server'],
        ['d','Toggle tema gelap/terang'],
        ['?','Tampilkan / tutup bantuan ini'],
      ].map(([k,v]) => `
        <div style="display:flex;gap:16px;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="min-width:120px;color:var(--phosphor);font-size:11px">${k}</span>
          <span style="color:var(--txt-2);font-size:11px">${v}</span>
        </div>`).join('')}
      <div style="margin-top:14px;font-size:10px;color:var(--txt-3);text-align:center">Klik di luar atau tekan ? untuk tutup</div>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}

function exportExpiredCSV() {
  const now = Date.now();
  const rows = (state.data?.stations || [])
    .filter(s => s.validity && new Date(s.validity).getTime() < now)
    .sort((a, b) => new Date(a.validity) - new Date(b.validity));

  if (!rows.length) { alert('Tidak ada stasiun dengan izin habis.'); return; }

  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const fmtD = raw => { if (!raw) return ''; const d = new Date(raw); return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const esc_csv = v => `"${String(v||'').replace(/"/g,'""')}"`;

  const header = ['No','Frekuensi (MHz)','Nama Stasiun','Pemilik','Jenis','Wilayah Layanan','No. SIMF','Tgl. Izin','Berlaku s.d.','ERP (dBm)'];
  const lines = [header.map(esc_csv).join(',')];
  rows.forEach((s, i) => {
    lines.push([
      i+1, parseFloat(s.freq).toFixed(3), s.stn_name||'', s.clnt_name||'',
      s.jenis_penyiaran||'', s.wilayah_layanan||s.kota||'',
      s.no_simf||'', fmtD(s.licence_date), fmtD(s.validity), s.erp_dbm||''
    ].map(esc_csv).join(','));
  });

  const blob = new Blob(['﻿'+lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0,10);
  a.download = `kasper_izin_habis_${today}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

boot();
