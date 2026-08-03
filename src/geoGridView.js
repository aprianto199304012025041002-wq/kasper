// src/geoGridView.js
// View baru: Geo Grid — satu row per kota, kolom = kanal FM 87.5–108.0 MHz
import { FM_MIN, FM_MAX, CHANNEL_SPACING } from './channelEngine.js';
import { fetchSpectrum, fetchProvinces } from './apiClient.js';

const SPACING = CHANNEL_SPACING;

// ── Grid ──────────────────────────────────────────────────────────────────
function buildGrid() {
  const chs = [];
  const steps = Math.round((FM_MAX - FM_MIN) / SPACING);
  for (let i = 0; i <= steps; i++) chs.push(Math.round((FM_MIN + i * SPACING) * 10) / 10);
  return chs;
}
const GRID = buildGrid();

// ── Warna per kota ────────────────────────────────────────────────────────
const PALETTE = [
  '#00e5ff','#a78bfa','#22c55e','#f472b6','#fb923c',
  '#38bdf8','#facc15','#4ade80','#e879f9','#94a3b8',
  '#f87171','#34d399','#60a5fa','#fbbf24','#c084fc',
];
let _cityColorMap = {};
let _colorIdx = 0;

function cityColor(city) {
  if (!city) return '#888';
  if (!_cityColorMap[city]) {
    _cityColorMap[city] = PALETTE[_colorIdx % PALETTE.length];
    _colorIdx++;
  }
  return _cityColorMap[city];
}

function resetColors() {
  _cityColorMap = {};
  _colorIdx = 0;
}

// ── Jenis label ───────────────────────────────────────────────────────────
const JENIS = { swasta: 'SW', publik: 'RRI', publik_lokal: 'LPPL', komunitas: 'KOM' };

// ── Channel map per kota ──────────────────────────────────────────────────
function computeCityChannelMap(stations) {
  return GRID.map((ch) => {
    const lower = Math.round((ch - SPACING / 2) * 100) / 100;
    const upper = Math.round((ch + SPACING / 2) * 100) / 100;
    const used = stations.find((s) => Math.abs(parseFloat(s.freq) - ch) < 0.15);
    if (used) return { freq: ch, lower, upper, type: 'used', station: used };
    const adjL = stations.find((s) => Math.abs(parseFloat(s.freq) - (ch - SPACING)) < 0.15);
    const adjR = stations.find((s) => Math.abs(parseFloat(s.freq) - (ch + SPACING)) < 0.15);
    if (adjL || adjR) return { freq: ch, lower, upper, type: 'adj', adj_left: adjL, adj_right: adjR };
    return { freq: ch, lower, upper, type: 'free' };
  });
}

function buildCityRows(stations) {
  const cityMap = {};
  stations.forEach((s) => {
    const city = (s.kota || s.city || 'TIDAK DIKETAHUI').toUpperCase().trim();
    if (!cityMap[city]) cityMap[city] = [];
    cityMap[city].push(s);
  });
  return Object.entries(cityMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([city, stns]) => ({
      city,
      stations: stns,
      channelMap: computeCityChannelMap(stns),
    }));
}

// ── Stats ─────────────────────────────────────────────────────────────────
function calcStats(cityRows) {
  let used = 0, adj = 0, free = 0;
  cityRows.forEach((r) => {
    r.channelMap.forEach((ch) => {
      if (ch.type === 'used') used++;
      else if (ch.type === 'adj') adj++;
      else free++;
    });
  });
  return { used, adj, free, cities: cityRows.length };
}

// ── Helper ────────────────────────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function shortCity(name) {
  const map = {
    'KOTA YOGYAKARTA': 'Kota YK', 'KABUPATEN SLEMAN': 'Sleman',
    'KABUPATEN BANTUL': 'Bantul', 'KABUPATEN GUNUNGKIDUL': 'Gunungkidul',
    'KABUPATEN KULON PROGO': 'Kulon Progo', 'SLEMAN': 'Sleman',
    'BANTUL': 'Bantul', 'GUNUNGKIDUL': 'Gunungkidul',
    'KULON PROGO': 'Kulon Progo', 'YOGYAKARTA': 'Kota YK',
    'KOTA MAGELANG': 'Kota Magelang', 'KABUPATEN MAGELANG': 'Kab. Magelang',
    'KOTA SEMARANG': 'Semarang', 'KOTA SURAKARTA': 'Solo',
    'KABUPATEN KLATEN': 'Klaten', 'KABUPATEN PURWOREJO': 'Purworejo',
  };
  return map[name] || name.replace(/KABUPATEN\s*/gi, 'Kab. ').replace(/KOTA\s*/gi, '').trim().substring(0, 18);
}

// ── Tooltip ───────────────────────────────────────────────────────────────
let _ttEl = null;

function ensureTT() {
  if (!_ttEl) {
    _ttEl = document.createElement('div');
    _ttEl.className = 'gg-tooltip';
    document.body.appendChild(_ttEl);
  }
  return _ttEl;
}

function showTT(e, cell, cityRow) {
  const tt = ensureTT();
  const color = cityColor(cityRow.city);
  let html = '';

  if (cell.type === 'used') {
    const s = cell.station;
    const jenis = JENIS[s.jenis] || s.jenis || '—';
    html = `
      <div class="gg-tt-title">${esc(s.stn_name || '—')}</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Frekuensi</span><span class="gg-tt-val">${cell.freq.toFixed(1)} MHz</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Lower / Upper</span><span class="gg-tt-val">${cell.lower.toFixed(3)} – ${cell.upper.toFixed(3)}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kota</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Klien</span><span class="gg-tt-val">${esc(s.clnt_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">ERP</span><span class="gg-tt-val">${s.erp_dbm || '—'} dBm</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Status</span><span class="gg-tt-val">${esc(s.status || '—')}</span></div>
      <span class="gg-tt-badge gg-used" style="--badge-color:${color}">${jenis}</span>`;
  } else if (cell.type === 'adj') {
    html = `
      <div class="gg-tt-title">${cell.freq.toFixed(1)} MHz — Guard band</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kiri</span><span class="gg-tt-val">${esc(cell.adj_left?.stn_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kanan</span><span class="gg-tt-val">${esc(cell.adj_right?.stn_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kota</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <span class="gg-tt-badge gg-adj">ADJACENT</span>`;
  } else {
    html = `
      <div class="gg-tt-title">${cell.freq.toFixed(1)} MHz — Kosong ★</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Lower / Upper</span><span class="gg-tt-val">${cell.lower.toFixed(3)} – ${cell.upper.toFixed(3)}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kota</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <span class="gg-tt-badge gg-free">AVAILABLE ★</span>`;
  }

  tt.innerHTML = html;
  tt.style.display = 'block';
  moveTT(e);
}

function moveTT(e) {
  const tt = ensureTT();
  let x = e.clientX + 16, y = e.clientY - 10;
  if (x + 295 > window.innerWidth) x = e.clientX - 305;
  if (y + 220 > window.innerHeight) y = e.clientY - 230;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function hideTT() {
  if (_ttEl) _ttEl.style.display = 'none';
}

// ── Render ruler ──────────────────────────────────────────────────────────
function renderRuler(cityColW) {
  const cols = GRID.map((ch) => {
    const isMajor = Math.round(ch * 10) % 10 === 0;
    return `<div class="gg-ruler-ch${isMajor ? ' gg-major' : ''}" data-freq="${ch}">${ch.toFixed(1)}</div>`;
  }).join('');
  return `
    <div class="gg-ruler-inner">
      <div class="gg-ruler-label" style="width:${cityColW}px">Kota ↓ · Frekuensi →</div>
      <div class="gg-ruler-channels">${cols}</div>
    </div>`;
}

// ── Render city row ───────────────────────────────────────────────────────
function renderCityRow(row, opts) {
  const { city, stations, channelMap } = row;
  const color = cityColor(city);
  const usedCount = channelMap.filter((c) => c.type === 'used').length;
  const freeCount = channelMap.filter((c) => c.type === 'free').length;

  const cells = channelMap.map((ch) => {
    if (ch.type === 'used') {
      const s = ch.station;
      const jenis = JENIS[s.jenis] || 'SW';
      const label = (s.stn_name || '').replace(/RADIO\s*/gi, '').trim().substring(0, 8);
      return `<div class="gg-ch gg-used" style="--city-color:${color}" data-freq="${ch.freq}" data-city="${esc(city)}">
        <span class="gg-freq">${ch.freq.toFixed(1)}</span>
        ${opts.showLabel ? `<span class="gg-label">${esc(label)}</span>` : ''}
        <span class="gg-tag">${jenis}</span>
      </div>`;
    }
    if (ch.type === 'adj') {
      if (!opts.showAdj) return `<div class="gg-ch gg-free gg-adj-hidden" data-freq="${ch.freq}" data-city="${esc(city)}"><span class="gg-freq">${ch.freq.toFixed(1)}</span></div>`;
      const dir = ch.adj_left && ch.adj_right ? '◄►' : ch.adj_left ? '◄' : '►';
      return `<div class="gg-ch gg-adj" data-freq="${ch.freq}" data-city="${esc(city)}">
        <span class="gg-freq">${ch.freq.toFixed(1)}</span>
        ${opts.showLabel ? `<span class="gg-label">${dir}</span>` : ''}
      </div>`;
    }
    // free
    return `<div class="gg-ch gg-free" data-freq="${ch.freq}" data-city="${esc(city)}">
      <span class="gg-freq">${ch.freq.toFixed(1)}</span>
      ${opts.showLabel ? `<span class="gg-label">★</span>` : ''}
    </div>`;
  }).join('');

  return `<div class="gg-city-row" data-city="${esc(city)}">
    <div class="gg-city-label" style="border-left:3px solid ${color}">
      <span class="gg-city-name" style="color:${color}">${esc(shortCity(city))}</span>
      <div class="gg-city-meta">
        <span class="gg-c-used">${usedCount}t</span>
        <span class="gg-c-free">${freeCount}k</span>
        <span>${stations.length}stn</span>
      </div>
    </div>
    <div class="gg-city-channels">${cells}</div>
  </div>`;
}

// ── Slot bar ──────────────────────────────────────────────────────────────
function renderSlotBar(cityRows) {
  const allFree = GRID.filter((ch) =>
    cityRows.length > 0 && cityRows.every((r) => {
      const c = r.channelMap.find((x) => Math.abs(x.freq - ch) < 0.01);
      return c && c.type === 'free';
    })
  );
  if (!allFree.length) return '';
  const chips = allFree.map((ch) =>
    `<span class="gg-slot-chip" data-freq="${ch}">${ch.toFixed(1)}</span>`
  ).join('');
  return `<div class="gg-slot-bar">
    <span class="gg-slot-label">★ KOSONG DI SEMUA KOTA</span>
    ${chips}
  </div>`;
}

// ── Legend ────────────────────────────────────────────────────────────────
function renderLegend(cityRows) {
  const swatches = cityRows.slice(0, 12).map((r) => {
    const col = cityColor(r.city);
    const used = r.channelMap.filter((c) => c.type === 'used').length;
    return `<div class="gg-leg-item">
      <div class="gg-leg-swatch" style="background:${col}33;border-color:${col}"></div>
      <span class="gg-leg-label">${esc(shortCity(r.city))} <span class="gg-leg-count">${used}</span></span>
    </div>`;
  }).join('');
  return `<div class="gg-legend">
    <span class="gg-leg-title">KOTA</span>
    ${swatches}
    <span class="gg-leg-sep"></span>
    <div class="gg-leg-item"><div class="gg-leg-swatch" style="background:rgba(234,179,8,.12);border-color:rgba(234,179,8,.35);border-style:dashed"></div><span class="gg-leg-label">Guard</span></div>
    <div class="gg-leg-item"><div class="gg-leg-swatch" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3)"></div><span class="gg-leg-label">Kosong</span></div>
  </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────
function renderGeoGrid(container, cityRows, opts) {
  const stats = calcStats(cityRows);
  const CITY_COL_W = 148;

  const rowsHtml = cityRows.map((r) => renderCityRow(r, opts)).join('');

  container.innerHTML = `
    <div class="gg-statsbar">
      <div class="gg-stat"><span class="gg-stat-val gg-used-val">${stats.used}</span><span class="gg-stat-lbl">Terpakai</span></div>
      <div class="gg-stat"><span class="gg-stat-val gg-adj-val">${stats.adj}</span><span class="gg-stat-lbl">Guard</span></div>
      <div class="gg-stat"><span class="gg-stat-val gg-free-val">${stats.free}</span><span class="gg-stat-lbl">Kosong</span></div>
      <div class="gg-stat"><span class="gg-stat-val gg-city-val">${stats.cities}</span><span class="gg-stat-lbl">Kota</span></div>
    </div>
    ${renderLegend(cityRows)}
    ${renderSlotBar(cityRows)}
    <div class="section-label">Geo Grid Spektrum FM · ${cityRows.length} kota · 87.5–108.0 MHz</div>
    <div class="gg-scroll-wrap">
      <div class="gg-grid-min">
        <div class="gg-ruler-wrap" id="ggRuler">${renderRuler(CITY_COL_W)}</div>
        <div class="gg-grid-table" id="ggTable">${rowsHtml}</div>
      </div>
    </div>`;

  attachGeoEvents(container, cityRows);
}

// ── Events ────────────────────────────────────────────────────────────────
function attachGeoEvents(container, cityRows) {
  // Slot chip click
  container.querySelectorAll('.gg-slot-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const freq = parseFloat(chip.dataset.freq);
      container.querySelectorAll('.gg-slot-chip').forEach((c) =>
        c.classList.toggle('gg-slot-active', Math.abs(parseFloat(c.dataset.freq) - freq) < 0.01)
      );
      const cell = container.querySelector(`.gg-ch[data-freq="${freq}"]`);
      if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Cell hover
  container.querySelectorAll('.gg-ch').forEach((cell) => {
    cell.addEventListener('mouseenter', (e) => {
      const freq = parseFloat(cell.dataset.freq);
      const cityName = cell.dataset.city;

      // Highlight ruler col
      container.querySelectorAll('.gg-ruler-ch').forEach((r) => {
        const match = Math.abs(parseFloat(r.dataset.freq) - freq) < 0.01;
        r.classList.toggle('gg-ruler-hl-used', match && cell.classList.contains('gg-used'));
        r.classList.toggle('gg-ruler-hl-adj', match && cell.classList.contains('gg-adj'));
        r.classList.toggle('gg-ruler-hl-free', match && (cell.classList.contains('gg-free') || cell.classList.contains('gg-adj-hidden')));
      });

      // Highlight column in all rows
      container.querySelectorAll(`.gg-ch[data-freq="${freq}"]`).forEach((c) => c.classList.add('gg-col-hl'));

      // Tooltip
      const row = cityRows.find((r) => r.city === cityName);
      const cellData = row?.channelMap.find((c) => Math.abs(c.freq - freq) < 0.01);
      if (row && cellData) showTT(e, cellData, row);
    });

    cell.addEventListener('mousemove', moveTT);

    cell.addEventListener('mouseleave', () => {
      container.querySelectorAll('.gg-ruler-ch').forEach((r) =>
        r.classList.remove('gg-ruler-hl-used', 'gg-ruler-hl-adj', 'gg-ruler-hl-free')
      );
      container.querySelectorAll('.gg-ch.gg-col-hl').forEach((c) => c.classList.remove('gg-col-hl'));
      hideTT();
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────
export async function renderGeoGridView(container, currentProvince, currentFilters) {
  resetColors();

  container.innerHTML = `<div class="skeleton-band" style="margin-top:12px;height:400px"></div>`;

  try {
    const filters = { province: currentProvince, ...currentFilters };
    const data = await fetchSpectrum(filters);
    let stations = data.stations || [];

    // Filter jenis jika ada
    if (currentFilters?.jenis && currentFilters.jenis !== 'all') {
      stations = stations.filter((s) => s.jenis === currentFilters.jenis);
    }

    if (!stations.length) {
      container.innerHTML = `<div class="empty-state">Tidak ada data stasiun ditemukan untuk filter ini.</div>`;
      return;
    }

    const cityRows = buildCityRows(stations);
    const opts = {
      showAdj: currentFilters?.showAdj !== false,
      showLabel: currentFilters?.showLabel !== false,
    };

    renderGeoGrid(container, cityRows, opts);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Gagal memuat data: ${esc(e.message)}</div>`;
  }
}
