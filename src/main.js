import './app.css';
import { fetchSpectrum } from './apiClient.js';
import { fetchInterference } from './apiClient.js';
import { computeChannelMapForWilayah, FM_MIN, FM_MAX } from './channelEngine.js';
import { computeInterference } from './interferenceEngine.js';
import { renderDetailPage } from './detailPage.js';

// ─── State ────────────────────────────────────────────────────────────
const S = {
  data: null,
  interfData: null,
  view: 'grid',        // grid | band | geo | rf
  wilayah: '',         // '' = semua
  search: '',
  chanFilter: 'all',   // all | free | used | expired
  theme: localStorage.getItem('kasper-theme') || 'light',
};

// ─── Theme ────────────────────────────────────────────────────────────
function applyTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('kasper-theme', t);
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = t === 'dark' ? '☀' : '☾';
}

// ─── API ──────────────────────────────────────────────────────────────
async function loadData() {
  setStatus('Memuat…');
  try {
    S.data = await fetchSpectrum({});
    render();
    setStatus(statusText());
  } catch (e) {
    document.getElementById('main').innerHTML =
      `<div class="err">Gagal memuat data: ${e.message} <button onclick="location.reload()">Coba lagi</button></div>`;
  }
}

async function loadRF() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="loading"><div class="spin"></div>Menghitung interferensi…</div>`;
  if (!S.interfData) {
    try {
      S.interfData = S.data?.stations?.length
        ? computeInterference(S.data.stations)
        : { pairs: [], summary: {}, stations_evaluated: 0 };
    } catch(e) {
      main.innerHTML = `<div class="err">Error: ${e.message}</div>`;
      return;
    }
  }
  renderRF();
}

function statusText() {
  if (!S.data) return '—';
  const n = S.data.stations?.length ?? 0;
  const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const exp = (S.data.stations || []).filter(s => s.validity && new Date(s.validity.replace(/(\d{2})-([A-Z]{3})-(\d{2})/, (_, d, m, y) => {
    const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    return `20${y}-${String(months[m]+1).padStart(2,'0')}-${d}`;
  })) < new Date()).length;
  return `${n} stasiun${exp ? ` · <span class="warn">⚠ ${exp} habis</span>` : ''} · ${now}`;
}

function setStatus(html) {
  const el = document.getElementById('status');
  if (el) el.innerHTML = html;
}

// ─── Shell ────────────────────────────────────────────────────────────
function mount() {
  document.getElementById('app').innerHTML = `
    <header id="hdr">
      <div class="hdr-l">
        <span class="logo">KASPER</span>
        <span class="hdr-sub">Spektrum FM · DIY &amp; Jateng</span>
      </div>
      <div class="hdr-r">
        <span id="status">—</span>
        <button id="btnRefresh" title="Refresh [R]">↺</button>
        <button id="btnTheme" title="Theme">${S.theme === 'dark' ? '☀' : '☾'}</button>
      </div>
    </header>
    <div id="body">
      <nav id="sidebar">
        <input id="sSearch" type="search" placeholder="Cari wilayah…" autocomplete="off"/>
        <div id="navList"></div>
      </nav>
      <div id="content">
        <div id="toolbar">
          <div id="tabs">
            <button class="tab" data-v="grid">Grid</button>
            <button class="tab" data-v="band">Pita</button>
            <button class="tab" data-v="geo">Geo</button>
            <button class="tab" data-v="rf">⚡ RF</button>
          </div>
          <div id="filters">
            <input id="fSearch" type="search" placeholder="Cari stasiun…" value="${S.search}" autocomplete="off"/>
            <select id="fChan">
              <option value="all">Semua kanal</option>
              <option value="free">Kosong</option>
              <option value="used">Terisi</option>
              <option value="expired">Izin habis</option>
            </select>
          </div>
        </div>
        <div id="statsbar"></div>
        <div id="main"><div class="loading"><div class="spin"></div>Memuat…</div></div>
      </div>
    </div>
    <div id="tooltip"></div>`;

  // Events
  document.getElementById('btnRefresh').onclick = () => {
    S.data = null; S.interfData = null;
    document.getElementById('main').innerHTML = `<div class="loading"><div class="spin"></div>Memuat…</div>`;
    loadData();
  };
  document.getElementById('btnTheme').onclick = () => applyTheme(S.theme === 'dark' ? 'light' : 'dark');

  document.getElementById('tabs').onclick = e => {
    const v = e.target.dataset.v;
    if (!v) return;
    S.view = v;
    updateTabs();
    if (v === 'rf') { loadRF(); return; }
    render();
  };

  document.getElementById('fSearch').oninput = e => { S.search = e.target.value; render(); };
  document.getElementById('fChan').onchange = e => { S.chanFilter = e.target.value; render(); };
  document.getElementById('sSearch').oninput = e => filterNav(e.target.value);

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'r' || e.key === 'R') document.getElementById('btnRefresh').click();
  });

  // Tooltip
  document.addEventListener('mousemove', e => {
    const tt = document.getElementById('tooltip');
    if (!tt.classList.contains('show')) return;
    tt.style.left = (e.clientX + 14) + 'px';
    tt.style.top  = (e.clientY + 14) + 'px';
  });

  updateTabs();
}

function updateTabs() {
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.v === S.view);
  });
  // sembunyikan filter saat RF
  document.getElementById('filters').style.display = S.view === 'rf' ? 'none' : '';
}

// ─── Sidebar ──────────────────────────────────────────────────────────
function renderNav() {
  if (!S.data) return;
  const stations = S.data.stations || [];
  const KOMUNITAS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  const nowTs = Date.now();

  const allWilayah = [...new Set(
    stations.map(s => s.wilayah_layanan || s.kota || '').filter(w => w && w !== KOMUNITAS)
  )].sort();

  const byProv = { DIY: [], JATENG: [] };
  allWilayah.forEach(w => {
    const s = stations.find(st => (st.wilayah_layanan || st.kota) === w);
    if (s?.province?.includes('YOGYAKARTA')) byProv.DIY.push(w);
    else byProv.JATENG.push(w);
  });

  const cnt = w => stations.filter(s => (s.wilayah_layanan || s.kota) === w).length;
  const exp = w => stations.filter(s =>
    (s.wilayah_layanan || s.kota) === w && s.validity &&
    parseValidity(s.validity) < nowTs
  ).length;

  const item = (w, label) => {
    const e = exp(w), c = cnt(w);
    const active = S.wilayah === w;
    return `<button class="nav-item${active ? ' active' : ''}" data-w="${w}">
      <span class="nav-label">${label}</span>
      <span class="nav-meta">${e ? `<span class="nav-exp">⚠${e}</span> ` : ''}${c}</span>
    </button>`;
  };

  const secLabel = t => `<div class="nav-sec">${t}</div>`;
  const shorten = w => w.replace(/^(KOTA |KABUPATEN )/i, '').replace(/, /g, ' – ').replace(/[A-Z]{4,}/g, s => s[0] + s.slice(1).toLowerCase());

  let html = item('', 'Semua Wilayah');
  if (byProv.DIY.length) {
    html += secLabel('D.I. Yogyakarta');
    html += byProv.DIY.map(w => item(w, shorten(w))).join('');
  }
  if (byProv.JATENG.length) {
    html += secLabel('Jawa Tengah');
    html += byProv.JATENG.map(w => item(w, shorten(w))).join('');
  }

  document.getElementById('navList').innerHTML = html;
  document.getElementById('navList').onclick = e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    S.wilayah = btn.dataset.w;
    S.view = 'grid';
    updateTabs();
    renderNav();
    render();
  };
}

function filterNav(q) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    const txt = btn.textContent.toLowerCase();
    btn.style.display = q && !txt.includes(q.toLowerCase()) ? 'none' : '';
  });
  document.querySelectorAll('.nav-sec').forEach(sec => {
    const items = [...sec.nextElementSibling ? [] : []];
    // just hide section label if all items under it hidden
  });
}

// ─── Stats bar ────────────────────────────────────────────────────────
function renderStats(channels) {
  const total = channels.length;
  const used  = channels.filter(c => c.type === 'used').length;
  const free  = channels.filter(c => c.type === 'free').length;
  const adj   = channels.filter(c => c.type === 'adjacent_1' || c.type === 'adjacent_2').length;
  const exp   = channels.filter(c => c.type === 'used' && isExpired(c.station)).length;

  const pct = (n, d) => d ? (n/d*100).toFixed(1) : '0';

  document.getElementById('statsbar').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="stat-l">Total kanal FM</div><div class="stat-v">${total}</div></div>
      <div class="stat"><div class="stat-l">Terisi</div><div class="stat-v accent">${used} <small>${pct(used,total)}%</small></div></div>
      <div class="stat"><div class="stat-l">Adjacent guard</div><div class="stat-v amber">${adj} <small>${pct(adj,total)}%</small></div></div>
      <div class="stat"><div class="stat-l">Kosong</div><div class="stat-v green">${free} <small>${pct(free,total)}%</small></div></div>
      ${exp ? `<div class="stat"><div class="stat-l">⚠ Habis</div><div class="stat-v red">${exp}</div></div>` : ''}
    </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────
function parseValidity(v) {
  if (!v) return 0;
  const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  const m = String(v).match(/(\d{2})-([A-Z]{3})-(\d{2,4})/);
  if (!m) return 0;
  const yr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return new Date(yr, months[m[2]], +m[1]).getTime();
}

function isExpired(s) {
  return s?.validity && parseValidity(s.validity) < Date.now();
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function activeStations() {
  let st = S.data?.stations || [];
  const KOMUNITAS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
  if (S.wilayah)
    st = st.filter(s => (s.wilayah_layanan || s.kota) === S.wilayah);
  if (S.search) {
    const q = S.search.toLowerCase();
    st = st.filter(s =>
      (s.stn_name||'').toLowerCase().includes(q) ||
      (s.clnt_name||'').toLowerCase().includes(q) ||
      String(s.freq).includes(q) ||
      (s.wilayah_layanan||s.kota||'').toLowerCase().includes(q)
    );
  }
  return st;
}

function stationsForWilayah(w) {
  return (S.data?.stations || []).filter(s => (s.wilayah_layanan || s.kota) === w);
}

// ─── Render dispatcher ────────────────────────────────────────────────
function render() {
  if (!S.data) return;
  renderNav();
  if (S.view === 'grid') renderGrid();
  else if (S.view === 'band') renderBand();
  else if (S.view === 'geo') renderGeo();
}

// ─── Grid view ────────────────────────────────────────────────────────
function renderGrid() {
  const stations = activeStations();
  const KOMUNITAS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';

  // Kelompokkan per wilayah
  let wilayahList;
  if (S.wilayah) {
    wilayahList = [S.wilayah];
  } else {
    wilayahList = [...new Set(
      stations.map(s => s.wilayah_layanan || s.kota || '').filter(w => w && w !== KOMUNITAS)
    )].sort();
  }

  if (!wilayahList.length) {
    document.getElementById('main').innerHTML = `<div class="empty">Tidak ada stasiun yang cocok</div>`;
    document.getElementById('statsbar').innerHTML = '';
    return;
  }

  // Ambil channel map untuk semua stasiun (untuk stats)
  const allChannels = computeChannelMapForWilayah(stations, S.wilayah || '__all__');
  renderStats(allChannels);

  const nowTs = Date.now();

  let html = '<div class="grid-wrap">';

  for (const w of wilayahList) {
    const wStations = S.wilayah ? stations : stationsForWilayah(w).filter(s =>
      !S.search || stations.includes(s)
    );
    if (!wStations.length) continue;

    const channels = computeChannelMapForWilayah(wStations, w);
    const expCount = wStations.filter(s => isExpired(s)).length;

    // Filter berdasarkan chanFilter
    const visible = channels.filter(ch => {
      if (S.chanFilter === 'free') return ch.type === 'free';
      if (S.chanFilter === 'used') return ch.type === 'used';
      if (S.chanFilter === 'expired') return ch.type === 'used' && isExpired(ch.station);
      return true;
    });
    if (!visible.length) continue;

    html += `<div class="city">
      <div class="city-hdr">
        <span class="city-name">${esc(w)}</span>
        ${expCount ? `<span class="city-exp">⚠ ${expCount} habis</span>` : ''}
        <span class="city-cnt">${wStations.length} stasiun</span>
      </div>
      <div class="ch-row">`;

    for (const ch of visible) {
      const { type, station } = ch;
      const exp = type === 'used' && isExpired(station);
      let cls = 'ch ';
      cls += type === 'used' ? (exp ? 'ch-exp' : 'ch-used') : type === 'adjacent_1' ? 'ch-adj1' : type === 'adjacent_2' ? 'ch-adj2' : 'ch-free';
      if (ch.allotment_status === 'allotted_rri') cls += ' ch-rri';
      else if (ch.allotment_status === 'allotted_lps') cls += ' ch-lps';

      const label = station
        ? `<b>${ch.freq.toFixed(1)}</b><br><span>${esc(station.stn_name?.replace(/^(RADIO |LPP RRI |LPP |LPK )/i,'').slice(0,16))}</span>`
        : `<b>${ch.freq.toFixed(1)}</b>`;

      const ttData = station
        ? `data-tt="${esc(ch.freq.toFixed(1)+' MHz — '+station.stn_name+(exp?' [HABIS]':''))}" data-freq="${ch.freq}"`
        : `data-tt="${ch.freq.toFixed(1)} MHz — kosong"`;

      html += `<div class="${cls}" ${ttData}>${label}</div>`;
    }

    html += `</div></div>`;
  }

  html += '</div>';
  document.getElementById('main').innerHTML = html;

  // Click handler
  document.getElementById('main').onclick = e => {
    const ch = e.target.closest('.ch[data-freq]');
    if (!ch) return;
    const freq = parseFloat(ch.dataset.freq);
    const station = (S.data?.stations||[]).find(s => Math.abs(s.freq - freq) < 0.01);
    if (station) openDetail(station);
  };

  // Tooltip
  document.getElementById('main').addEventListener('mouseover', e => {
    const ch = e.target.closest('.ch[data-tt]');
    const tt = document.getElementById('tooltip');
    if (ch) { tt.textContent = ch.dataset.tt; tt.classList.add('show'); }
    else tt.classList.remove('show');
  });
  document.getElementById('main').addEventListener('mouseleave', () => {
    document.getElementById('tooltip')?.classList.remove('show');
  });
}

// ─── Band view ────────────────────────────────────────────────────────
function renderBand() {
  const stations = activeStations();
  const KOMUNITAS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';

  let wilayahList;
  if (S.wilayah) {
    wilayahList = [S.wilayah];
  } else {
    wilayahList = [...new Set(
      stations.map(s => s.wilayah_layanan || s.kota || '').filter(w => w && w !== KOMUNITAS)
    )].sort();
  }

  const fRange = FM_MAX - FM_MIN;
  let html = '<div class="band-wrap">';

  for (const w of wilayahList) {
    const wSt = S.wilayah ? stations : stationsForWilayah(w).filter(s => !S.search || stations.includes(s));
    if (!wSt.length) continue;

    html += `<div class="band-city"><div class="band-city-lbl">${esc(w)}</div><div class="band-row">`;
    html += `<div class="band-axis"><span>${FM_MIN}</span><span>${FM_MAX}</span></div>`;
    html += `<div class="band-bar">`;

    const channels = computeChannelMapForWilayah(wSt, w);
    for (const ch of channels) {
      const pct = ((ch.freq - FM_MIN) / fRange * 100).toFixed(3);
      const w2 = (0.1 / fRange * 100).toFixed(3);
      const { type, station } = ch;
      const exp = type === 'used' && isExpired(station);
      const cls = type === 'used' ? (exp ? 'bs-exp' : 'bs-used') : type === 'adjacent_1' ? 'bs-adj1' : type === 'adjacent_2' ? 'bs-adj2' : 'bs-free';
      const tt = station ? `${ch.freq.toFixed(1)} — ${station.stn_name}` : `${ch.freq.toFixed(1)} kosong`;
      html += `<div class="bs ${cls}" style="left:${pct}%;width:${w2}%" title="${esc(tt)}" data-freq="${ch.freq}"></div>`;
    }
    html += `</div></div></div>`;
  }

  html += '</div>';
  document.getElementById('main').innerHTML = html;
  renderStats(computeChannelMapForWilayah(stations, S.wilayah || '__all__'));

  document.getElementById('main').onclick = e => {
    const seg = e.target.closest('.bs[data-freq]');
    if (!seg) return;
    const freq = parseFloat(seg.dataset.freq);
    const station = (S.data?.stations||[]).find(s => Math.abs(s.freq - freq) < 0.01);
    if (station) openDetail(station);
  };
}

// ─── Geo view ────────────────────────────────────────────────────────
function renderGeo() {
  const stations = activeStations().filter(s => s.latitude && s.longitude);
  document.getElementById('main').innerHTML = `<div id="geoMap" style="height:100%;min-height:400px"></div>`;
  renderStats(computeChannelMapForWilayah(activeStations(), S.wilayah || '__all__'));

  if (typeof L === 'undefined') {
    document.getElementById('main').innerHTML = `<div class="err">Leaflet tidak tersedia</div>`;
    return;
  }

  const map = L.map('geoMap').setView([-7.8, 110.4], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 18
  }).addTo(map);

  stations.forEach(s => {
    const exp = isExpired(s);
    const color = exp ? '#ef4444' : '#3b82f6';
    const marker = L.circleMarker([s.latitude, s.longitude], {
      radius: 6, color, fillColor: color, fillOpacity: .7, weight: 1.5
    });
    marker.bindPopup(`<b>${s.freq.toFixed(1)} MHz</b><br>${esc(s.stn_name)}<br><small>${esc(s.wilayah_layanan||s.kota)}</small>`);
    marker.addTo(map);
  });
}

// ─── RF view ─────────────────────────────────────────────────────────
function renderRF() {
  const d = S.interfData;
  if (!d) return;

  const pairs = d.pairs || [];
  const summary = d.summary || {};

  const typeLabel = { co: 'Co-channel', adj1: '1st Adj', adj2: '2nd Adj' };
  const typeCls   = { co: 'rf-co', adj1: 'rf-adj1', adj2: 'rf-adj2' };

  const rows = pairs.map(p => `
    <tr>
      <td><span class="rf-badge ${typeCls[p.type] || ''}">${typeLabel[p.type] || p.type}</span></td>
      <td class="mono">${p.freq_a?.toFixed(1)}</td>
      <td>${esc(p.stn_a)}</td>
      <td class="mono">${p.freq_b?.toFixed(1)}</td>
      <td>${esc(p.stn_b)}</td>
      <td class="mono">${p.distance_km ? p.distance_km.toFixed(1)+' km' : '—'}</td>
    </tr>`).join('');

  document.getElementById('main').innerHTML = `
    <div class="rf-wrap">
      <div class="rf-stats">
        <div class="rf-stat"><div class="rf-stat-l">Total pasang</div><div class="rf-stat-v">${pairs.length}</div></div>
        <div class="rf-stat"><div class="rf-stat-l">Co-channel</div><div class="rf-stat-v red">${summary.co || 0}</div></div>
        <div class="rf-stat"><div class="rf-stat-l">1st Adjacent</div><div class="rf-stat-v amber">${summary.adj1 || 0}</div></div>
        <div class="rf-stat"><div class="rf-stat-l">2nd Adjacent</div><div class="rf-stat-v">${summary.adj2 || 0}</div></div>
        <div class="rf-stat"><div class="rf-stat-l">Stasiun dievaluasi</div><div class="rf-stat-v">${d.stations_evaluated || 0}</div></div>
      </div>
      ${pairs.length ? `
      <div class="rf-table-wrap">
        <table class="rf-table">
          <thead><tr><th>Tipe</th><th>Freq A</th><th>Stasiun A</th><th>Freq B</th><th>Stasiun B</th><th>Jarak</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : '<div class="empty">Tidak ada interferensi terdeteksi</div>'}
    </div>`;

  document.getElementById('statsbar').innerHTML = '';
}

// ─── Detail panel ─────────────────────────────────────────────────────
function openDetail(station) {
  renderDetailPage({ freq: station.freq }, S.data?.stations || []);
}

// ─── Boot ─────────────────────────────────────────────────────────────
applyTheme(S.theme);
mount();
loadData();
