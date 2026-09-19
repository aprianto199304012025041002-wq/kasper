// main.js — entry point KASPER
// Tanggung jawab: boot app, wiring event antar komponen, lifecycle view.
// Logic bisnis dan render ada di masing-masing modul.

import './style.css';
import { state }            from './state.js';
import { fetchStations }    from './api.js';
import { mountHeader, updateStatus, setThemeButton } from './components/header.js';
import { mountSidebar, renderSidebar }               from './components/sidebar.js';
import { mountToolbar, renderToolbar }               from './components/toolbar.js';
import { renderGrid }                                from './views/grid.js';
import { renderBand }                                from './views/band.js';
import { renderGeo, destroyGeo }                     from './views/geo.js';
import { renderRF }                                  from './views/rf.js';
import { openDetail, closeDetail }                   from './views/detail.js';

// ─── Theme ────────────────────────────────────────────────────────────
function applyTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('kasper-theme', t);
  setThemeButton(t);
}

// ─── Shell HTML ───────────────────────────────────────────────────────
function buildShell() {
  document.getElementById('app').innerHTML = `
    <header id="hdr"></header>
    <div id="body">
      <nav id="sidebar">
        <input id="nav-search" type="search" placeholder="Cari wilayah…" autocomplete="off"/>
        <div id="nav-list"></div>
      </nav>
      <div id="content">
        <div id="toolbar"></div>
        <div id="statsbar"></div>
        <div id="main">
          <div class="loading"><div class="spin"></div>Memuat data…</div>
        </div>
      </div>
    </div>
    <div id="mob-backdrop"></div>
    <button id="mob-fab" title="Pilih wilayah">☰</button>
    <div id="tooltip"></div>`;

  // Mobile sidebar FAB
  const fab = document.getElementById('mob-fab');
  const backdrop = document.getElementById('mob-backdrop');
  const sidebar = document.getElementById('sidebar');
  const toggleMobSidebar = (open) => {
    sidebar?.classList.toggle('mob-open', open);
    backdrop?.classList.toggle('show', open);
  };
  fab?.addEventListener('click', () => toggleMobSidebar(true));
  backdrop?.addEventListener('click', () => toggleMobSidebar(false));
}

// ─── Render aktif view ────────────────────────────────────────────────
function renderView() {
  if (state.view !== 'geo') destroyGeo();
  closeDetail();
  try {
    switch (state.view) {
      case 'grid': renderGrid(onDetailOpen); break;
      case 'band': renderBand(onDetailOpen); break;
      case 'geo':  renderGeo();              break;
      case 'rf':   renderRF();               break;
    }
  } catch (e) {
    const main = document.getElementById('main');
    if (main) main.innerHTML = '<div class="err">Error render: ' + e.message + '</div>';
  }
}

function onDetailOpen(freq) {
  openDetail(freq);
}

// ─── Load data ────────────────────────────────────────────────────────
async function loadData() {
  document.getElementById('main').innerHTML =
    `<div class="loading"><div class="spin"></div>Memuat data…</div>`;
  document.getElementById('statsbar').innerHTML = '';

  try {
    state.data       = await fetchStations();
    state.interfData = null;
    updateStatus();
    renderSidebar();
    renderView();
  } catch (e) {
    document.getElementById('main').innerHTML = `
      <div class="err">
        Gagal memuat data: ${e.message}
        <button onclick="location.reload()">Coba lagi</button>
      </div>`;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────
function boot() {
  applyTheme(state.theme);
  buildShell();

  mountHeader(
    async () => { state.data = null; state.interfData = null; await loadData(); },
    () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'),
  );

  mountSidebar(() => {
    if (state.view === 'rf') { state.view = 'grid'; renderToolbar(); }
    // Tutup sidebar mobile setelah pilih wilayah
    document.getElementById('sidebar')?.classList.remove('mob-open');
    document.getElementById('mob-backdrop')?.classList.remove('show');
    renderView();
  });

  mountToolbar({
    onView:   () => renderView(),
    onSearch: () => renderView(),
    onFilter: () => renderView(),
  });

  document.addEventListener('kasper:filter', () => renderView());

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'r' || e.key === 'R') document.getElementById('btn-refresh')?.click();
    if (e.key === 'Escape') closeDetail();
    if (e.key === '1') { state.view = 'grid'; renderToolbar(); renderView(); }
    if (e.key === '2') { state.view = 'band'; renderToolbar(); renderView(); }
    if (e.key === '3') { state.view = 'geo';  renderToolbar(); renderView(); }
    if (e.key === '4') { state.view = 'rf';   renderToolbar(); renderView(); }
  });

  const urlFreq = new URLSearchParams(location.search).get('freq');
  loadData().then(() => { if (urlFreq) openDetail(parseFloat(urlFreq)); });
}

boot();
