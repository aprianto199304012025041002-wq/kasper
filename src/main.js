// src/main.js — v2: API client + split view toggle
import './style.css';
import './components/header.css';
import './components/stats.css';
import './components/grid.css';
import './components/band.css';
import { fetchSpectrum, fetchCities, isUsingFallback } from './apiClient.js';
import { renderBandView, renderBandRuler } from './bandView.js';

const REGION_COLORS = {
  'KOTA YOGYAKARTA': '#4a90d9',
  SLEMAN:            '#5ee69c',
  BANTUL:            '#e6b85c',
  GUNUNGKIDUL:       '#d97a9c',
  'KULON PROGO':     '#9d8ce6',
};
const REGION_LABELS = {
  'KOTA YOGYAKARTA': 'Kota Yogyakarta',
  SLEMAN:            'Sleman',
  BANTUL:            'Bantul',
  GUNUNGKIDUL:       'Gunungkidul',
  'KULON PROGO':     'Kulon Progo',
};
const JENIS_LABELS = {
  swasta:      'Swasta',
  publik:      'Publik (RRI)',
  publik_lokal:'Publik Lokal (LPPL)',
  komunitas:   'Komunitas',
};

// ── State ─────────────────────────────────────────────────────────────
let state = {
  view:         'grid',   // 'grid' | 'band'
  filterRegion: 'all',
  filterJenis:  'all',
  filterChanView: 'all', // 'all' | 'free' | 'used'
  searchTerm:   '',
  cities:       [],
  data:         null,     // cache hasil fetch terakhir
  loading:      false,
  error:        null,
};

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  document.getElementById('app').innerHTML = renderShell();
  attachShellEvents();
  await loadCities();
  await loadData();
}

async function loadCities() {
  try {
    state.cities = await fetchCities();
    updateCitySelect();
  } catch (_) { /* non-fatal */ }
}

async function loadData() {
  state.loading = true;
  state.error   = null;
  renderContent();

  const filters = {};
  if (state.filterRegion !== 'all') filters.city   = state.filterRegion;
  if (state.filterJenis  !== 'all') filters.jenis  = state.filterJenis;
  if (state.searchTerm)             filters.search = state.searchTerm;

  try {
    state.data    = await fetchSpectrum(filters);
    state.loading = false;
  } catch (e) {
    state.error   = e.message;
    state.loading = false;
  }
  renderContent();
}

// ── Shell (header + controls, persisten) ─────────────────────────────
function renderShell() {
  return `
    ${renderHeader()}
    <div id="statsBar"></div>
    <main class="main-content">
      <div class="controls-bar" id="controlsBar">
        ${renderControls()}
      </div>
      ${renderLegend()}
      <div id="dynamicContent"></div>
    </main>
    <div class="tooltip-float" id="tooltip"></div>
  `;
}

function attachShellEvents() {
  document.addEventListener('change', handleControlChange);
  document.addEventListener('input',  handleControlInput);
  document.addEventListener('click',  handleClick);
}

function handleControlChange(e) {
  const id = e.target.id;
  if (id === 'fRegion')    { state.filterRegion  = e.target.value; loadData(); }
  if (id === 'fJenis')     { state.filterJenis   = e.target.value; loadData(); }
  if (id === 'fChanView')  { state.filterChanView = e.target.value; renderContent(); }
}

let _searchTimer;
function handleControlInput(e) {
  if (e.target.id === 'fSearch') {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      state.searchTerm = e.target.value;
      loadData();
    }, 320);
  }
}

function handleClick(e) {
  const btn = e.target.closest('[data-view]');
  if (btn) {
    state.view = btn.dataset.view;
    document.querySelectorAll('[data-view]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.view === state.view)
    );
    renderContent();
    return;
  }

  if (e.target.id === 'closeDetail') {
    document.getElementById('detailPanel')?.classList.remove('is-open');
    return;
  }

  const cell = e.target.closest('.ch-cell[data-freq]');
  if (cell && state.data) {
    const freq = parseFloat(cell.dataset.freq);
    const info = state.data.channel_map.find((c) => c.freq === freq);
    if (info) openDetail(info);
    return;
  }

  const slotRow = e.target.closest('.slot-row[data-start]');
  if (slotRow) {
    openSlotDetail(parseFloat(slotRow.dataset.start), parseFloat(slotRow.dataset.end));
  }
}

// ── Header ────────────────────────────────────────────────────────────
function renderHeader() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  return `
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-header__brand">
          <div class="app-header__mark"><span>FM</span></div>
          <div class="app-header__titles">
            <h1>Peta Spektrum FM — D.I. Yogyakarta</h1>
            <p>Sumber: Database ISR · Balmon Kelas I Yogyakarta</p>
          </div>
        </div>
        <div class="app-header__meta">
          <div class="app-header__meta-item">
            <span class="app-header__meta-label">Rentang band</span>
            <span class="app-header__meta-val mono">87.5–108.0 MHz</span>
          </div>
          <div class="app-header__meta-item">
            <span class="app-header__meta-label">Spasi kanal</span>
            <span class="app-header__meta-val mono">200 kHz</span>
          </div>
          <div class="app-header__meta-item">
            <span class="app-header__meta-label"><span class="live-dot"></span>Update</span>
            <span class="app-header__meta-val mono">${dateStr}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

// ── Stats bar ─────────────────────────────────────────────────────────
function updateStatsBar(summary) {
  const pctUsed = summary.pct_used ?? ((summary.used / summary.total) * 100).toFixed(1);
  const pctFree = summary.pct_free ?? ((summary.free / summary.total) * 100).toFixed(1);
  const pctAdj  = (((summary.adjacent || 0) / summary.total) * 100).toFixed(1);
  document.getElementById('statsBar').innerHTML = `
    <div class="stats-bar">
      <div class="stat-cell">
        <div class="stat-cell__label">Total kanal (200 kHz)</div>
        <div class="stat-cell__value">${summary.total}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell__label">Terpakai</div>
        <div class="stat-cell__value is-occupied">${summary.used}<span class="stat-cell__unit">${pctUsed}%</span></div>
        <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctUsed}%;background:var(--signal-occupied)"></div></div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell__label">Adjacent protected</div>
        <div class="stat-cell__value is-danger">${summary.adjacent}<span class="stat-cell__unit">${pctAdj}%</span></div>
        <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctAdj}%;background:var(--signal-danger)"></div></div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell__label">Kosong / potensial</div>
        <div class="stat-cell__value is-phosphor">${summary.free}<span class="stat-cell__unit">${pctFree}%</span></div>
        <div class="stat-cell__bar"><div class="stat-cell__bar-fill" style="width:${pctFree}%;background:var(--signal-phosphor)"></div></div>
      </div>
    </div>`;
}

// ── Controls ──────────────────────────────────────────────────────────
function renderControls() {
  const src = isUsingFallback()
    ? '<span class="source-badge">⬡ data lokal (static)</span>'
    : '<span class="source-badge is-live"><span class="live-dot"></span> API live</span>';

  return `
    <div class="control-group">
      <span class="control-group__label">Wilayah</span>
      <select class="control-input" id="fRegion">
        <option value="all">Semua</option>
        ${Object.entries(REGION_LABELS).map(([k,v]) =>
          `<option value="${k}" ${state.filterRegion===k?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="control-group">
      <span class="control-group__label">Jenis</span>
      <select class="control-input" id="fJenis">
        <option value="all">Semua</option>
        ${Object.entries(JENIS_LABELS).map(([k,v]) =>
          `<option value="${k}" ${state.filterJenis===k?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="control-group">
      <span class="control-group__label">Tampilkan</span>
      <select class="control-input" id="fChanView">
        <option value="all"  ${state.filterChanView==='all' ?'selected':''}>Semua kanal</option>
        <option value="free" ${state.filterChanView==='free'?'selected':''}>Kosong saja</option>
        <option value="used" ${state.filterChanView==='used'?'selected':''}>Terpakai saja</option>
      </select>
    </div>
    <div class="control-group">
      <input type="search" class="control-input search-input" id="fSearch"
        placeholder="Cari stasiun / frekuensi…" value="${state.searchTerm}"/>
    </div>
    <div class="view-toggle" style="margin-left:auto">
      <button class="view-toggle__btn ${state.view==='grid'?'is-active':''}" data-view="grid">
        <span class="view-toggle__icon">⊞</span> Grid
      </button>
      <button class="view-toggle__btn ${state.view==='band'?'is-active':''}" data-view="band">
        <span class="view-toggle__icon">▬</span> Pita
      </button>
    </div>
    ${src}
  `;
}

function updateCitySelect() {
  const sel = document.getElementById('fRegion');
  if (!sel) return;
  const extra = state.cities
    .filter((c) => !Object.keys(REGION_LABELS).includes(c))
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  if (extra) sel.insertAdjacentHTML('beforeend', extra);
}

// ── Legend ────────────────────────────────────────────────────────────
function renderLegend() {
  return `
    <div class="legend-strip">
      ${Object.entries(REGION_LABELS).map(([k,v]) => `
        <div class="legend-chip">
          <span class="legend-chip__swatch" style="background:${REGION_COLORS[k]}22;border-color:${REGION_COLORS[k]}"></span>
          <span>${v}</span>
        </div>`).join('')}
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
    el.innerHTML = `
      <div class="section-label">Memuat data…</div>
      <div class="skeleton-band"></div>`;
    return;
  }

  if (state.error) {
    el.innerHTML = `<div class="empty-state">Gagal memuat data: ${state.error}</div>`;
    return;
  }

  if (!state.data) return;

  updateStatsBar(state.data.summary);

  let channelMap = state.data.channel_map;
  if (state.filterChanView === 'free') channelMap = channelMap.filter((c) => c.type === 'free');
  if (state.filterChanView === 'used') channelMap = channelMap.filter((c) => c.type === 'used');

  const freeBlocks = (state.data.free_blocks || []).filter((b) => b.count >= 2);

  if (state.view === 'grid') {
    el.innerHTML = `
      <div class="section-label">Peta kanal — grid 200&nbsp;kHz · 87.5–108.0&nbsp;MHz</div>
      <div class="grid-frame">
        <div class="ch-grid">${channelMap.map(renderCell).join('')}</div>
      </div>
      ${renderSlotSection(freeBlocks)}
      <div class="detail-panel" id="detailPanel"></div>
    `;
    attachCellTooltips(state.data.channel_map);

  } else {
    el.innerHTML = `
      <div class="section-label">Pita spektrum — horizontal · tinggi blok ∝ ERP</div>
      <div class="band-view">
        <div class="band-ruler"><div class="band-ruler__inner" id="bandRuler"></div></div>
        <div class="band-track-wrap">
          <div class="band-track-inner" id="bandViewInner"></div>
        </div>
      </div>
      ${renderSlotSection(freeBlocks)}
      <div class="detail-panel" id="detailPanel"></div>
    `;
    const allMap = state.data.channel_map;
    renderBandRuler();
    renderBandView(
      state.filterChanView === 'all' ? allMap
        : allMap.filter((c) => state.filterChanView === 'free' ? c.type === 'free' : c.type === 'used'),
      handleBandHover,
      (info) => openDetail(info)
    );
  }
}

// ── Grid cell ─────────────────────────────────────────────────────────
function renderCell(c) {
  if (c.type === 'used') {
    const color = REGION_COLORS[c.station?.kota] || '#888';
    const tag   = { publik:'RRI', komunitas:'KOM', publik_lokal:'LPPL' }[c.station?.jenis] || 'SW';
    return `
      <div class="ch-cell ch-cell--used" style="--cell-color:${color}" data-freq="${c.freq}">
        <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
        <span class="ch-cell__name">${esc(c.station?.stn_name || '')}</span>
        <span class="ch-cell__tag">${tag}</span>
      </div>`;
  }
  if (c.type === 'adjacent') {
    const dir = c.adj_left && c.adj_right ? '◄►' : c.adj_left ? '◄' : '►';
    return `
      <div class="ch-cell ch-cell--adjacent" data-freq="${c.freq}">
        <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
        <span class="ch-cell__name">guard</span>
        <span class="ch-cell__tag">${dir}</span>
      </div>`;
  }
  return `
    <div class="ch-cell ch-cell--free" data-freq="${c.freq}">
      <span class="ch-cell__freq">${c.freq.toFixed(1)}</span>
      <span class="ch-cell__name">kosong</span>
      <span class="ch-cell__tag">★</span>
    </div>`;
}

// ── Slot section ──────────────────────────────────────────────────────
function renderSlotSection(blocks) {
  if (!blocks.length) return '';
  return `
    <div class="section-label">Slot kosong potensial — blok ≥ 400&nbsp;kHz</div>
    <div class="slot-list">
      ${blocks.map((b) => {
        const r = b.priority || 'low';
        const lbl = { high:'★★ Prioritas tinggi', medium:'★ Layak', low:'Marginal' }[r] || r;
        return `
          <div class="slot-row slot-row--${r}" data-start="${b.start}" data-end="${b.end}">
            <div>
              <div class="slot-row__main">${b.start.toFixed(1)}–${b.end.toFixed(1)}</div>
              <div class="slot-row__sub">MHz</div>
            </div>
            <div>
              <div class="slot-row__val">${b.width_khz ?? b.widthKHz} kHz</div>
              <div class="slot-row__sub">lebar</div>
            </div>
            <div>
              <div class="slot-row__val">${b.center.toFixed(1)} MHz</div>
              <div class="slot-row__sub">kandidat center</div>
            </div>
            <div>
              <div class="slot-row__val">${b.count} kanal</div>
              <div class="slot-row__sub">@200 kHz</div>
            </div>
            <div style="text-align:right">
              <span class="badge badge--${r}">${lbl}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Tooltip ───────────────────────────────────────────────────────────
function attachCellTooltips(channelMap) {
  document.querySelectorAll('.ch-cell[data-freq]').forEach((cell) => {
    const freq = parseFloat(cell.dataset.freq);
    const info = channelMap.find((c) => c.freq === freq);
    if (!info) return;
    cell.addEventListener('mouseenter', (e) => showTooltip(e, info));
    cell.addEventListener('mousemove',  moveTooltip);
    cell.addEventListener('mouseleave', hideTooltip);
  });
}

function handleBandHover(e, info) {
  if (!info || !e) { hideTooltip(); return; }
  showTooltip(e, info);
}

function showTooltip(e, info) {
  const tt  = document.getElementById('tooltip');
  let title = '', rows = [];

  if (info.type === 'used') {
    title = info.station?.stn_name || info.freq.toFixed(1) + ' MHz';
    rows  = [
      ['Frekuensi center', info.freq.toFixed(3) + ' MHz'],
      ['Lower', (info.lower ?? info.lower_mhz ?? '').toFixed(4) + ' MHz'],
      ['Upper', (info.upper ?? info.upper_mhz ?? '').toFixed(4) + ' MHz'],
      ['ERP', (info.station?.erp_dbm ?? '—') + ' dBm'],
      ['Wilayah', REGION_LABELS[info.station?.kota] || info.station?.kota || '—'],
      ['Jenis',   JENIS_LABELS[info.station?.jenis]  || info.station?.jenis  || '—'],
    ];
  } else if (info.type === 'adjacent') {
    title = info.freq.toFixed(1) + ' MHz — Guard band';
    rows  = [
      ['Kiri',  info.adj_left  ? info.adj_left.stn_name  + ' (' + info.adj_left.freq  + ')' : '—'],
      ['Kanan', info.adj_right ? info.adj_right.stn_name + ' (' + info.adj_right.freq + ')' : '—'],
    ];
  } else {
    title = info.freq.toFixed(1) + ' MHz — Kosong ★';
    rows  = [
      ['Lower', (info.lower ?? info.lower_mhz ?? (info.freq - 0.1)).toFixed(3) + ' MHz'],
      ['Upper', (info.upper ?? info.upper_mhz ?? (info.freq + 0.1)).toFixed(3) + ' MHz'],
      ['Status', 'Tersedia untuk alokasi'],
    ];
  }

  tt.innerHTML =
    `<div class="tooltip-float__title">${esc(title)}</div>` +
    rows.map(([k,v]) => `<div class="tooltip-float__row"><span>${k}</span><span>${esc(String(v))}</span></div>`).join('');
  tt.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;
  let x = e.clientX + 14, y = e.clientY - 10;
  if (x + 270 > window.innerWidth) x = e.clientX - 280;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}

function hideTooltip() {
  const tt = document.getElementById('tooltip');
  if (tt) tt.style.display = 'none';
}

// ── Detail panel ──────────────────────────────────────────────────────
function openDetail(info) {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;
  panel.classList.add('is-open');

  const lower = info.lower ?? info.lower_mhz ?? (info.freq - 0.1);
  const upper = info.upper ?? info.upper_mhz ?? (info.freq + 0.1);

  if (info.type === 'used') {
    const s = info.station;
    panel.innerHTML = `
      <div class="detail-panel__head">
        <div class="detail-panel__title">${esc(s?.stn_name || '—')} — ${info.freq.toFixed(1)} MHz</div>
        <button class="detail-panel__close" id="closeDetail">✕</button>
      </div>
      <div class="detail-grid">
        <div><div class="detail-item__label">Center</div><div class="detail-item__value mono">${info.freq.toFixed(3)} MHz</div></div>
        <div><div class="detail-item__label">Lower</div><div class="detail-item__value mono">${Number(lower).toFixed(4)} MHz</div></div>
        <div><div class="detail-item__label">Upper</div><div class="detail-item__value mono">${Number(upper).toFixed(4)} MHz</div></div>
        <div><div class="detail-item__label">Bandwidth</div><div class="detail-item__value mono">${s?.bw_khz ?? '200'} kHz</div></div>
        <div><div class="detail-item__label">ERP</div><div class="detail-item__value mono">${s?.erp_dbm ?? '—'} dBm</div></div>
        <div><div class="detail-item__label">Status izin</div><div class="detail-item__value">${s?.status ?? '—'}</div></div>
        <div><div class="detail-item__label">Penyelenggara</div><div class="detail-item__value">${esc(s?.clnt_name || '—')}</div></div>
        <div><div class="detail-item__label">Wilayah</div><div class="detail-item__value">${REGION_LABELS[s?.kota] || s?.kota || '—'} · ${esc(s?.kecamatan || '—')}</div></div>
        <div><div class="detail-item__label">Jenis</div><div class="detail-item__value">${JENIS_LABELS[s?.jenis] || s?.jenis || '—'}</div></div>
      </div>`;
  } else if (info.type === 'free') {
    panel.innerHTML = `
      <div class="detail-panel__head">
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
    const l = info.adj_left, r = info.adj_right;
    panel.innerHTML = `
      <div class="detail-panel__head">
        <div class="detail-panel__title">Kanal ${info.freq.toFixed(1)} MHz — Adjacent Protected</div>
        <button class="detail-panel__close" id="closeDetail">✕</button>
      </div>
      <div class="detail-grid">
        <div><div class="detail-item__label">Center</div><div class="detail-item__value mono">${info.freq.toFixed(3)} MHz</div></div>
        <div><div class="detail-item__label">Guard kiri</div><div class="detail-item__value">${l ? esc(l.stn_name)+' ('+l.freq+')' : '—'}</div></div>
        <div><div class="detail-item__label">Guard kanan</div><div class="detail-item__value">${r ? esc(r.stn_name)+' ('+r.freq+')' : '—'}</div></div>
      </div>`;
  }

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openSlotDetail(start, end) {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;
  panel.classList.add('is-open');
  const center = Math.round(((start + end) / 2) * 10) / 10;
  panel.innerHTML = `
    <div class="detail-panel__head">
      <div class="detail-panel__title">Slot kosong ${start.toFixed(1)}–${end.toFixed(1)} MHz</div>
      <button class="detail-panel__close" id="closeDetail">✕</button>
    </div>
    <div class="detail-grid">
      <div><div class="detail-item__label">Rentang</div><div class="detail-item__value mono">${start.toFixed(2)} – ${end.toFixed(2)} MHz</div></div>
      <div><div class="detail-item__label">Lebar</div><div class="detail-item__value mono">${Math.round((end - start + 0.2) * 1000)} kHz</div></div>
      <div><div class="detail-item__label">Kandidat center</div><div class="detail-item__value mono">${center.toFixed(1)} MHz</div></div>
      <div><div class="detail-item__label">Lower kandidat</div><div class="detail-item__value mono">${(center - 0.1).toFixed(3)} MHz</div></div>
      <div><div class="detail-item__label">Upper kandidat</div><div class="detail-item__value mono">${(center + 0.1).toFixed(3)} MHz</div></div>
      <div><div class="detail-item__label">Status</div><div class="detail-item__value" style="color:var(--signal-phosphor)">Layak diajukan izin baru</div></div>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Utils ─────────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

boot();
