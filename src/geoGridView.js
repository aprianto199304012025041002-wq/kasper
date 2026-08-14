// src/geoGridView.js — Geo Grid FM · Design language KOMENK
import { FM_MIN, FM_MAX, CHANNEL_SPACING, ADJACENT_GUARD } from './channelEngine.js';

const GRID = (() => {
  const chs = [], steps = Math.round((FM_MAX - FM_MIN) / CHANNEL_SPACING);
  for (let i = 0; i <= steps; i++) chs.push(Math.round((FM_MIN + i * CHANNEL_SPACING) * 10) / 10);
  return chs;
})();

const PALETTE = [
  '#00e5ff','#a78bfa','#22c55e','#f472b6','#fb923c',
  '#38bdf8','#facc15','#4ade80','#e879f9','#94a3b8',
  '#f87171','#34d399','#60a5fa','#fbbf24','#c084fc',
  '#fb7185','#67e8f9','#86efac','#d8b4fe','#fed7aa',
];
const JENIS_TAG = { swasta:'SW', publik:'RRI', publik_lokal:'LPPL', komunitas:'KOM' };

// ── Color map ─────────────────────────────────────────────────────────
let _cityColorMap = {}, _colorIdx = 0;
function cityColor(city) {
  if (!city) return '#6b8099';
  if (!_cityColorMap[city]) { _cityColorMap[city] = PALETTE[_colorIdx % PALETTE.length]; _colorIdx++; }
  return _cityColorMap[city];
}
function resetColors() { _cityColorMap = {}; _colorIdx = 0; }

// ── Channel map per kota ──────────────────────────────────────────────
function buildCityRows(stations) {
  const map = {};
  stations.forEach(s => {
    const city = (s.wilayah_layanan || s.kota || s.city || 'TIDAK DIKETAHUI').toUpperCase().trim();
    if (!map[city]) map[city] = [];
    map[city].push(s);
  });
  return Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([city, stns]) => ({
      city,
      stations: stns,
      channelMap: GRID.map(ch => {
        const lower = Math.round((ch - CHANNEL_SPACING / 2) * 100) / 100;
        const upper = Math.round((ch + CHANNEL_SPACING / 2) * 100) / 100;
        const used = stns.find(s => Math.abs(parseFloat(s.freq) - ch) < ADJACENT_GUARD);
        if (used) return { freq: ch, lower, upper, type: 'used', station: used };
        const adjL = stns.find(s => Math.abs(parseFloat(s.freq) - (ch - CHANNEL_SPACING)) < ADJACENT_GUARD);
        const adjR = stns.find(s => Math.abs(parseFloat(s.freq) - (ch + CHANNEL_SPACING)) < ADJACENT_GUARD);
        if (adjL || adjR) return { freq: ch, lower, upper, type: 'adj', adjL, adjR };
        return { freq: ch, lower, upper, type: 'free' };
      }),
    }));
}

// ── CSS injection ─────────────────────────────────────────────────────
const CSS = `
/* ── GEO GRID CSS · KOMENK design language ───────────────────────── */
.gg-wrap{
  position:relative;width:100%;height:100%;display:flex;flex-direction:column;
  font-family:'Space Mono',monospace;
  --gg-row-h:44px;
}

/* ── Floating logo pill ── */
.gg-logo{
  position:absolute;top:10px;left:10px;z-index:60;
  display:flex;align-items:center;gap:8px;
  background:var(--glass-hi,rgba(15,21,32,.92));
  backdrop-filter:blur(16px) saturate(180%);
  border:1px solid var(--border-hi,#2a3a50);
  border-radius:var(--radius,8px);
  padding:6px 12px;
  box-shadow:var(--shadow-float,0 8px 32px rgba(0,0,0,.7));
  pointer-events:none;
}
.gg-logo-mark{
  font-family:'Space Mono',monospace;font-size:12px;font-weight:700;
  letter-spacing:3px;
  background:linear-gradient(135deg,var(--accent,#00e5ff),#7dd3fc);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.gg-logo-sep{width:1px;height:16px;background:var(--border-hi,#2a3a50);}
.gg-logo-sub{font-size:8px;color:var(--muted-hi,#6b8099);letter-spacing:1.5px;text-transform:uppercase;}

/* ── FAB / Floating action buttons ── */
/* ── Float stats pill ── */
.gg-stats-float{
  position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:60;
  display:flex;align-items:stretch;
  background:var(--glass-hi,rgba(15,21,32,.92));
  backdrop-filter:blur(16px) saturate(180%);
  border:1px solid var(--border-hi,#2a3a50);
  border-radius:var(--radius,8px);
  box-shadow:var(--shadow-float,0 8px 32px rgba(0,0,0,.7));
  pointer-events:none;white-space:nowrap;
}
.gg-stat{
  display:flex;flex-direction:column;align-items:center;
  padding:7px 16px;position:relative;
}
.gg-stat+.gg-stat::before{
  content:'';position:absolute;left:0;top:20%;bottom:20%;
  width:1px;background:var(--border,#1e2a3a);
}
.gg-stat-val{
  font-family:'Space Mono',monospace;font-size:15px;font-weight:700;
  color:var(--accent,#00e5ff);line-height:1;
  text-shadow:0 0 16px var(--accent-glow,rgba(0,229,255,.18));
}
.gg-stat-val.adj{color:var(--yellow,#eab308);}
.gg-stat-val.free{color:var(--green,#22c55e);}
.gg-stat-val.city{color:var(--accent3,#a78bfa);}
.gg-stat-lbl{
  font-size:7px;color:var(--muted-hi,#6b8099);
  letter-spacing:.8px;text-transform:uppercase;margin-top:3px;
}

/* ── Drawer backdrop ── */
.gg-drawer-scrim{
  position:absolute;inset:0;z-index:70;
  background:rgba(0,0,0,.55);backdrop-filter:blur(2px);
  opacity:0;pointer-events:none;
  transition:opacity .22s cubic-bezier(.4,0,.2,1);
}
.gg-drawer-scrim.open{opacity:1;pointer-events:auto;}

/* ── Drawer panel ── */
.gg-drawer{
  position:absolute;top:0;right:0;bottom:0;z-index:80;
  width:260px;
  background:var(--gradient-surface,linear-gradient(145deg,#0f1520,#0c1219));
  border-left:1px solid var(--border-hi,#2a3a50);
  box-shadow:-8px 0 32px rgba(0,0,0,.5);
  transform:translateX(100%);
  transition:transform .25s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;overflow:hidden;
}
.gg-drawer.open{transform:translateX(0);}

.gg-drawer-head{
  padding:14px 16px;
  border-bottom:1px solid var(--border,#1e2a3a);
  flex-shrink:0;display:flex;align-items:center;gap:10px;
  background:rgba(0,0,0,.1);
}
.gg-drawer-title{
  font-size:10px;letter-spacing:2px;text-transform:uppercase;
  color:var(--accent,#00e5ff);font-weight:700;flex:1;
  text-shadow:0 0 16px var(--accent-glow,rgba(0,229,255,.18));
}
.gg-drawer-close{
  background:none;border:none;color:var(--muted,#4a6080);
  font-size:16px;cursor:pointer;padding:4px 8px;
  border-radius:var(--radius-sm,5px);
  transition:color .12s,background .12s;
}
.gg-drawer-close:hover{color:var(--text,#f1f5f9);background:var(--border,#1e2a3a);}

.gg-drawer-body{
  flex:1;overflow-y:auto;padding:12px 0;
  overscroll-behavior:contain;
}
.gg-drawer-body::-webkit-scrollbar{width:3px;}
.gg-drawer-body::-webkit-scrollbar-thumb{background:var(--border-hi,#2a3a50);border-radius:2px;}

.gg-drawer-section{padding:0 16px 14px;}
.gg-drawer-label{
  font-size:8px;color:var(--muted-hi,#6b8099);
  letter-spacing:2px;text-transform:uppercase;
  padding:0 0 6px;border-bottom:1px solid var(--border,#1e2a3a);
  margin-bottom:10px;
}

/* ── Toggle row ── */
.gg-toggle-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:9px 0;border-bottom:1px solid var(--border,#1e2a3a);
  font-size:12px;color:var(--text,#f1f5f9);
}
.gg-toggle-row:last-child{border-bottom:none;}

/* ── Komenk-style toggle ── */
.gg-tog{position:relative;width:34px;height:20px;flex-shrink:0;}
.gg-tog input{opacity:0;width:0;height:0;}
.gg-tog-s{
  position:absolute;inset:0;background:var(--border,#1e2a3a);
  border-radius:10px;cursor:pointer;
  transition:background .22s,border .22s;border:1px solid transparent;
}
.gg-tog-s::before{
  content:'';position:absolute;width:14px;height:14px;
  left:3px;top:2px;background:var(--muted-hi,#6b8099);
  border-radius:50%;transition:transform .22s,background .12s;
}
.gg-tog input:checked+.gg-tog-s{
  background:rgba(0,229,255,.2);border-color:var(--accent,#00e5ff);
  box-shadow:0 0 10px var(--accent-glow,rgba(0,229,255,.18));
}
.gg-tog input:checked+.gg-tog-s::before{
  transform:translateX(14px);background:var(--accent,#00e5ff);
}

/* ── Drawer select ── */
.gg-select{
  background:var(--border,#1e2a3a);border:1px solid var(--border-hi,#2a3a50);
  border-radius:var(--radius-sm,5px);color:var(--text,#f1f5f9);
  font-size:11px;font-family:'Space Mono',monospace;
  padding:5px 8px;outline:none;cursor:pointer;
  transition:border-color .12s,box-shadow .12s;width:100%;margin-top:6px;
}
.gg-select:focus{border-color:var(--accent,#00e5ff);box-shadow:0 0 0 2px var(--accent-glow,rgba(0,229,255,.18));}
.gg-select option{background:var(--surface,#0f1520);}

/* ── Slot bar ── */
.gg-slot-bar{
  padding:0 16px 14px;
}
.gg-slot-label{
  font-size:8px;color:var(--green,#22c55e);letter-spacing:1.5px;
  text-transform:uppercase;margin-bottom:7px;
  display:flex;align-items:center;gap:5px;
}
.gg-slot-label::before{content:'★';}
.gg-slot-chips{display:flex;flex-wrap:wrap;gap:4px;}
.gg-slot-chip{
  background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);
  border-radius:4px;padding:3px 9px;
  font-size:10px;color:var(--green,#22c55e);
  cursor:pointer;white-space:nowrap;
  transition:background .12s,border-color .12s;
}
.gg-slot-chip:hover{background:rgba(34,197,94,.2);}
.gg-slot-chip.active{
  background:rgba(34,197,94,.25);border-color:var(--green,#22c55e);
  box-shadow:0 0 8px rgba(34,197,94,.3);
}

/* ── Legend ── */
.gg-legend-section{padding:0 16px 14px;}
.gg-leg-rows{display:flex;flex-direction:column;gap:5px;margin-top:8px;}
.gg-leg-row{
  display:flex;align-items:center;gap:8px;
  font-size:11px;color:var(--text,#f1f5f9);
  padding:5px 0;border-bottom:1px solid var(--border,#1e2a3a);
}
.gg-leg-row:last-child{border-bottom:none;}
.gg-leg-dot{
  width:8px;height:8px;border-radius:50%;flex-shrink:0;
  box-shadow:0 0 6px currentColor;
}
.gg-leg-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;}
.gg-leg-count{font-size:9px;color:var(--muted-hi,#6b8099);font-family:'Space Mono',monospace;}
.gg-leg-adj{
  display:flex;align-items:center;gap:6px;font-size:11px;color:var(--yellow,#eab308);
  padding:5px 0;border-bottom:1px solid var(--border,#1e2a3a);
}
.gg-leg-free{
  display:flex;align-items:center;gap:6px;font-size:11px;color:var(--green,#22c55e);
  padding:5px 0;
}
.gg-leg-swatch{
  width:12px;height:12px;border-radius:2px;flex-shrink:0;
  border:1px solid;
}

/* ── GRID area ── */
.gg-grid-area{
  flex:1;overflow:auto;position:relative;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
}
.gg-grid-min{min-width:900px;position:relative;}

/* ── Sticky ruler ── */
.gg-ruler{
  position:sticky;top:0;z-index:30;
  display:flex;
  background:var(--glass-hi,rgba(15,21,32,.92));
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border-hi,#2a3a50);
}
.gg-ruler-label{
  flex-shrink:0;width:130px;
  padding:5px 8px;
  border-right:1px solid var(--border-hi,#2a3a50);
  font-size:8px;color:var(--muted,#4a6080);
  letter-spacing:1.5px;text-transform:uppercase;
  display:flex;align-items:center;
  background:var(--glass-hi,rgba(15,21,32,.92));
}
.gg-ruler-chs{flex:1;display:flex;overflow:hidden;}
.gg-ruler-ch{
  flex:1;min-width:0;text-align:center;
  padding:5px 1px;
  font-size:7.5px;color:var(--muted,#4a6080);
  border-right:1px solid var(--border,#1e2a3a);
  white-space:nowrap;overflow:hidden;
  transition:color .1s,background .1s;cursor:default;
}
.gg-ruler-ch:last-child{border-right:none;}
.gg-ruler-ch.major{color:var(--muted-hi,#6b8099);font-weight:700;}
.gg-ruler-ch.hl-used{color:var(--accent,#00e5ff)!important;background:rgba(0,229,255,.06);}
.gg-ruler-ch.hl-adj{color:var(--yellow,#eab308)!important;background:rgba(234,179,8,.05);}
.gg-ruler-ch.hl-free{color:var(--green,#22c55e)!important;background:rgba(34,197,94,.04);}

/* ── Grid table ── */
.gg-table{border:1px solid var(--border,#1e2a3a);border-top:none;}

/* ── City row ── */
.gg-city-row{
  display:flex;
  border-top:1px solid var(--border,#1e2a3a);
  transition:background .08s;
}
.gg-city-row:first-child{border-top:none;}
.gg-city-row:hover{background:rgba(0,229,255,.02);}
.gg-city-row:nth-child(even){background:rgba(255,255,255,.012);}
.gg-city-row:nth-child(even):hover{background:rgba(0,229,255,.025);}

/* ── City label ── */
.gg-city-lbl{
  flex-shrink:0;width:130px;
  padding:0 8px 0 10px;
  border-right:1px solid var(--border-hi,#2a3a50);
  display:flex;flex-direction:column;justify-content:center;gap:3px;
  min-height:var(--gg-row-h,44px);
  background:var(--surface,#0f1520);
  cursor:default;
}
.gg-city-name{
  font-size:11px;font-weight:700;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.gg-city-meta{
  font-size:8px;color:var(--muted-hi,#6b8099);
  letter-spacing:.3px;display:flex;gap:5px;
}
.gg-city-meta .u{color:var(--accent,#00e5ff);}
.gg-city-meta .f{color:var(--green,#22c55e);}

/* ── Channel cells ── */
.gg-city-chs{flex:1;display:flex;align-items:stretch;overflow:hidden;}
.gg-ch{
  flex:1;min-width:0;position:relative;
  border-right:1px solid var(--border,#1e2a3a);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:3px 1px;min-height:var(--gg-row-h,44px);
  cursor:pointer;transition:background .1s;
  -webkit-tap-highlight-color:transparent;
}
.gg-ch:last-child{border-right:none;}

/* Used */
.gg-ch.used{
  background:color-mix(in srgb,var(--city-color,var(--accent,#00e5ff)) 14%,transparent);
  border-right-color:color-mix(in srgb,var(--city-color,var(--accent,#00e5ff)) 25%,var(--border,#1e2a3a));
}
.gg-ch.used:hover{background:color-mix(in srgb,var(--city-color,var(--accent,#00e5ff)) 24%,transparent);z-index:2;}

/* Adjacent */
.gg-ch.adj{
  background:rgba(234,179,8,.06);
  border-right-color:rgba(234,179,8,.14);
  border-right-style:dashed;
}
.gg-ch.adj:hover{background:rgba(234,179,8,.12);}

/* Free */
.gg-ch.free{background:transparent;}
.gg-ch.free:hover{background:rgba(34,197,94,.05);}

/* Col highlight */
.gg-ch.col-hl{outline:1px solid var(--accent,#00e5ff);outline-offset:-1px;z-index:1;}
.gg-ch.used.col-hl{z-index:3;}

/* Cell text */
.gg-ch-freq{
  font-size:7.5px;font-weight:700;line-height:1;
  opacity:.4;transition:opacity .1s;
}
.gg-ch.used .gg-ch-freq{opacity:.7;color:var(--city-color,var(--accent,#00e5ff));}
.gg-ch.adj  .gg-ch-freq{opacity:.4;color:var(--yellow,#eab308);}
.gg-ch.free .gg-ch-freq{opacity:.3;color:var(--green,#22c55e);}

.gg-ch-lbl{
  font-size:7px;line-height:1;text-align:center;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  padding:0 2px;margin-top:2px;opacity:.75;
}
.gg-ch.used .gg-ch-lbl{color:var(--city-color,var(--accent,#00e5ff));}
.gg-ch.adj  .gg-ch-lbl{color:var(--yellow,#eab308);font-size:9px;}
.gg-ch.free .gg-ch-lbl{color:var(--green,#22c55e);}
.gg-ch-tag{font-size:6px;letter-spacing:.4px;margin-top:1px;opacity:.5;}
.gg-ch.used .gg-ch-tag{color:var(--city-color,var(--accent,#00e5ff));}

/* ── Tooltip ── */
.gg-tt{
  position:fixed;z-index:9999;display:none;
  background:var(--glass-hi,rgba(15,21,32,.92));
  backdrop-filter:blur(20px) saturate(180%);
  border:1px solid var(--border-hi,#2a3a50);
  border-radius:var(--radius,8px);
  padding:11px 14px;min-width:210px;max-width:285px;
  box-shadow:0 16px 48px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.04);
  pointer-events:none;font-family:'Space Mono',monospace;
  animation:ggTtIn .1s ease;
}
@keyframes ggTtIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.gg-tt-title{font-size:12px;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:8px;line-height:1.4;}
.gg-tt-row{display:flex;justify-content:space-between;gap:8px;padding:2px 0;font-size:10px;}
.gg-tt-key{color:var(--muted-hi,#6b8099);}
.gg-tt-val{color:var(--text,#f1f5f9);text-align:right;}
.gg-tt-badge{
  display:inline-block;margin-top:7px;
  padding:2px 8px;border-radius:3px;
  font-size:8px;font-weight:700;letter-spacing:.6px;
}
.gg-tt-badge.used{
  background:color-mix(in srgb,var(--badge,var(--accent,#00e5ff)) 18%,transparent);
  color:var(--badge,var(--accent,#00e5ff));
  border:1px solid color-mix(in srgb,var(--badge,var(--accent,#00e5ff)) 40%,transparent);
  box-shadow:0 0 10px color-mix(in srgb,var(--badge,var(--accent,#00e5ff)) 25%,transparent);
}
.gg-tt-badge.adj{background:rgba(234,179,8,.15);color:var(--yellow,#eab308);border:1px solid rgba(234,179,8,.3);}
.gg-tt-badge.free{background:rgba(34,197,94,.12);color:var(--green,#22c55e);border:1px solid rgba(34,197,94,.28);}

/* ── Empty / Loading state ── */
.gg-state{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;padding:60px 20px;
  color:var(--muted-hi,#6b8099);font-size:12px;letter-spacing:.5px;
  text-align:center;
}
.gg-spinner{
  width:26px;height:26px;border-radius:50%;
  border:2px solid var(--border,#1e2a3a);
  border-top-color:var(--accent,#00e5ff);
  animation:ggSpin .7s cubic-bezier(.4,0,.6,1) infinite;
  box-shadow:0 0 14px var(--accent-glow,rgba(0,229,255,.18));
}
@keyframes ggSpin{to{transform:rotate(360deg)}}

/* ── Mobile ── */
@media(max-width:768px){
  .gg-city-lbl{width:80px;padding:0 5px 0 7px;}
  .gg-ruler-label{width:80px;font-size:7px;padding:5px 3px;}
  .gg-city-name{font-size:9.5px;}
  .gg-city-meta{display:none;}
  .gg-ch-lbl{display:none;}
  .gg-ch-tag{display:none;}
  .gg-ch{min-height:36px;}
  .gg-drawer{width:240px;}
  .gg-stats-float{font-size:11px;}
  .gg-stat{padding:6px 12px;}
  .gg-stat-val{font-size:13px;}
}
@media(max-width:480px){
  .gg-city-lbl{width:62px;}
  .gg-ruler-label{width:62px!important;}
  .gg-city-name{font-size:8.5px;}
  .gg-ch-freq{font-size:6.5px;}
}
`;

function injectCSS() {
  if (document.getElementById('gg-style')) return;
  const s = document.createElement('style');
  s.id = 'gg-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ── HTML ──────────────────────────────────────────────────────────────
function createHTML() {
  return `
<div class="gg-wrap" id="ggWrap">
  <!-- Logo -->
  <div class="gg-logo">
    <span class="gg-logo-mark">GEO GRID</span>
    <div class="gg-logo-sep"></div>
    <span class="gg-logo-sub">87.5–108.0 MHz</span>
  </div>

  <!-- Stats float -->
  <div class="gg-stats-float" id="ggStats">
    <div class="gg-stat"><span class="gg-stat-val" id="ggStUsed">—</span><span class="gg-stat-lbl">Terpakai</span></div>
    <div class="gg-stat"><span class="gg-stat-val adj" id="ggStAdj">—</span><span class="gg-stat-lbl">Guard</span></div>
    <div class="gg-stat"><span class="gg-stat-val free" id="ggStFree">—</span><span class="gg-stat-lbl">Kosong</span></div>
    <div class="gg-stat"><span class="gg-stat-val city" id="ggStCity">—</span><span class="gg-stat-lbl">Kota</span></div>
  </div>

  <!-- Grid area -->
  <div class="gg-grid-area" id="ggGridArea">
    <div class="gg-state"><div class="gg-spinner"></div><span>Memuat data spektrum…</span></div>
  </div>

  <!-- Tooltip -->
  <div class="gg-tt" id="ggTT"></div>
</div>`;
}

// ── Tooltip ───────────────────────────────────────────────────────────
let _tt = null;
function ensureTT() { return _tt || (_tt = document.getElementById('ggTT')); }

function showTT(e, cell, cityRow) {
  const tt = ensureTT(); if (!tt) return;
  const color = cityColor(cityRow.city);
  let html = '';
  if (cell.type === 'used') {
    const s = cell.station;
    const tag = JENIS_TAG[s.jenis] || s.jenis || 'SW';
    html = `<div class="gg-tt-title">${esc(s.stn_name || '—')}</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Frekuensi</span><span class="gg-tt-val">${cell.freq.toFixed(1)} MHz</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Lower / Upper</span><span class="gg-tt-val">${cell.lower.toFixed(3)} – ${cell.upper.toFixed(3)}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Wilayah Layanan</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Klien</span><span class="gg-tt-val">${esc(s.clnt_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">ERP</span><span class="gg-tt-val">${s.erp_dbm || '—'} dBm</span></div>
      <span class="gg-tt-badge used" style="--badge:${color}">${tag}</span>`;
  } else if (cell.type === 'adj') {
    html = `<div class="gg-tt-title">${cell.freq.toFixed(1)} MHz — Guard band</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kiri</span><span class="gg-tt-val">${esc(cell.adjL?.stn_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Kanan</span><span class="gg-tt-val">${esc(cell.adjR?.stn_name || '—')}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Wilayah Layanan</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <span class="gg-tt-badge adj">ADJACENT</span>`;
  } else {
    html = `<div class="gg-tt-title">${cell.freq.toFixed(1)} MHz — Kosong ★</div>
      <div class="gg-tt-row"><span class="gg-tt-key">Lower / Upper</span><span class="gg-tt-val">${cell.lower.toFixed(3)} – ${cell.upper.toFixed(3)}</span></div>
      <div class="gg-tt-row"><span class="gg-tt-key">Wilayah Layanan</span><span class="gg-tt-val">${esc(shortCity(cityRow.city))}</span></div>
      <span class="gg-tt-badge free">AVAILABLE ★</span>`;
  }
  tt.innerHTML = html;
  tt.style.display = 'block';
  moveTT(e);
}
function moveTT(e) {
  const tt = ensureTT(); if (!tt) return;
  let x = e.clientX + 16, y = e.clientY - 10;
  if (x + 295 > window.innerWidth) x = e.clientX - 305;
  if (y + 240 > window.innerHeight) y = e.clientY - 250;
  tt.style.left = x + 'px'; tt.style.top = y + 'px';
}
function hideTT() { const tt = ensureTT(); if (tt) tt.style.display = 'none'; }

// ── Render helpers ────────────────────────────────────────────────────
function shortCity(name) {
  const MAP = {
    'KOTA YOGYAKARTA':'Kota YK','KABUPATEN SLEMAN':'Sleman','KABUPATEN BANTUL':'Bantul',
    'KABUPATEN GUNUNGKIDUL':'Gunungkidul','KABUPATEN KULON PROGO':'Kulon Progo',
    'SLEMAN':'Sleman','BANTUL':'Bantul','GUNUNGKIDUL':'Gunungkidul',
    'KULON PROGO':'Kulon Progo','YOGYAKARTA':'Kota YK',
    'KOTA MAGELANG':'Kota Magelang','KABUPATEN MAGELANG':'Kab. Magelang',
    'KOTA SEMARANG':'Semarang','KOTA SURAKARTA':'Solo',
  };
  return MAP[name] || name.replace(/KABUPATEN\s*/gi,'Kab.').replace(/KOTA\s*/gi,'').trim().substring(0,18);
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? ''); return d.innerHTML;
}

// ── Render ruler ──────────────────────────────────────────────────────
function renderRuler() {
  const cols = GRID.map(ch => {
    const major = Math.round(ch * 10) % 10 === 0;
    return `<div class="gg-ruler-ch${major?' major':''}" data-freq="${ch}">${ch.toFixed(1)}</div>`;
  }).join('');
  return `<div class="gg-ruler"><div class="gg-ruler-label">Kota ↓ · MHz →</div><div class="gg-ruler-chs">${cols}</div></div>`;
}

// ── Render city row ───────────────────────────────────────────────────
function renderCityRow(row, opts) {
  const { city, stations, channelMap } = row;
  const color = cityColor(city);
  const usedN = channelMap.filter(c => c.type === 'used').length;
  const freeN = channelMap.filter(c => c.type === 'free').length;

  const cells = channelMap.map(ch => {
    if (ch.type === 'used') {
      const s = ch.station;
      const tag = JENIS_TAG[s.jenis] || 'SW';
      const abbr = (s.stn_name || '').replace(/RADIO\s*/gi,'').trim().substring(0,8);
      return `<div class="gg-ch used" style="--city-color:${color}" data-freq="${ch.freq}" data-city="${esc(city)}">
        <span class="gg-ch-freq">${ch.freq.toFixed(1)}</span>
        ${opts.showLabel ? `<span class="gg-ch-lbl">${esc(abbr)}</span>` : ''}
        <span class="gg-ch-tag">${tag}</span>
      </div>`;
    }
    if (ch.type === 'adj') {
      if (!opts.showAdj) return `<div class="gg-ch free" data-freq="${ch.freq}" data-city="${esc(city)}"><span class="gg-ch-freq">${ch.freq.toFixed(1)}</span></div>`;
      const dir = ch.adjL && ch.adjR ? '◄►' : ch.adjL ? '◄' : '►';
      return `<div class="gg-ch adj" data-freq="${ch.freq}" data-city="${esc(city)}">
        <span class="gg-ch-freq">${ch.freq.toFixed(1)}</span>
        ${opts.showLabel ? `<span class="gg-ch-lbl">${dir}</span>` : ''}
      </div>`;
    }
    // free
    return `<div class="gg-ch free ${opts.onlyFree ? 'col-hl' : ''}" data-freq="${ch.freq}" data-city="${esc(city)}">
      <span class="gg-ch-freq">${ch.freq.toFixed(1)}</span>
      ${opts.showLabel ? `<span class="gg-ch-lbl">★</span>` : ''}
    </div>`;
  }).join('');

  return `<div class="gg-city-row" data-city="${esc(city)}">
    <div class="gg-city-lbl" style="border-left:3px solid ${color}">
      <span class="gg-city-name" style="color:${color}">${esc(shortCity(city))}</span>
      <div class="gg-city-meta">
        <span class="u">${usedN}t</span>
        <span class="f">${freeN}k</span>
        <span>${stations.length}stn</span>
      </div>
    </div>
    <div class="gg-city-chs">${cells}</div>
  </div>`;
}

// ── Slot bar ──────────────────────────────────────────────────────────
function buildSlotBar(cityRows) {
  const allFree = GRID.filter(ch =>
    cityRows.length > 0 && cityRows.every(r => {
      const c = r.channelMap.find(x => Math.abs(x.freq - ch) < 0.01);
      return c && c.type === 'free';
    })
  );
  const slotBar = document.getElementById('ggSlotBar');
  const slotChips = document.getElementById('ggSlotChips');
  if (!slotBar || !slotChips) return;
  if (!allFree.length) { slotBar.style.display = 'none'; return; }
  slotBar.style.display = '';
  slotChips.innerHTML = allFree.map(ch =>
    `<span class="gg-slot-chip" data-freq="${ch}">${ch.toFixed(1)}</span>`
  ).join('');
  slotChips.onclick = e => {
    const chip = e.target.closest('.gg-slot-chip');
    if (!chip) return;
    const freq = parseFloat(chip.dataset.freq);
    slotChips.querySelectorAll('.gg-slot-chip').forEach(c =>
      c.classList.toggle('active', Math.abs(parseFloat(c.dataset.freq) - freq) < 0.01)
    );
    const cell = document.querySelector(`.gg-ch[data-freq="${freq}"]`);
    if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
}

// ── Legend ────────────────────────────────────────────────────────────
function buildLegend(cityRows) {
  const el = document.getElementById('ggLegRows');
  if (!el) return;
  el.innerHTML = cityRows.slice(0, 15).map(r => {
    const col = cityColor(r.city);
    const used = r.channelMap.filter(c => c.type === 'used').length;
    return `<div class="gg-leg-row">
      <div class="gg-leg-dot" style="background:${col}"></div>
      <span class="gg-leg-name">${esc(shortCity(r.city))}</span>
      <span class="gg-leg-count">${used}</span>
    </div>`;
  }).join('');
}

// ── Stats ─────────────────────────────────────────────────────────────
function updateStats(cityRows) {
  let used = 0, adj = 0, free = 0;
  cityRows.forEach(r => r.channelMap.forEach(ch => {
    if (ch.type === 'used') used++;
    else if (ch.type === 'adj') adj++;
    else free++;
  }));
  const su = document.getElementById('ggStUsed'); if (su) su.textContent = used;
  const sa = document.getElementById('ggStAdj');  if (sa) sa.textContent = adj;
  const sf = document.getElementById('ggStFree'); if (sf) sf.textContent = free;
  const sc = document.getElementById('ggStCity'); if (sc) sc.textContent = cityRows.length;
}

// ── Render grid ───────────────────────────────────────────────────────
function renderGrid(area, cityRows, opts) {
  const rows = cityRows.map(r => renderCityRow(r, opts)).join('');
  area.innerHTML = `<div class="gg-grid-min">
    ${renderRuler()}
    <div class="gg-table" id="ggTable">${rows}</div>
  </div>`;
  attachCellEvents(area, cityRows);
  updateStats(cityRows);
  buildSlotBar(cityRows);
  buildLegend(cityRows);
}

// ── Cell events ───────────────────────────────────────────────────────
function attachCellEvents(container, cityRows) {
  // Only desktop tooltip (touch devices get nothing — prevents jank)
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) return;

  container.querySelectorAll('.gg-ch').forEach(cell => {
    cell.addEventListener('mouseenter', e => {
      const freq = parseFloat(cell.dataset.freq);
      const cityName = cell.dataset.city;
      // Ruler highlight
      container.querySelectorAll('.gg-ruler-ch').forEach(r => {
        const match = Math.abs(parseFloat(r.dataset.freq) - freq) < 0.01;
        r.classList.toggle('hl-used', match && cell.classList.contains('used'));
        r.classList.toggle('hl-adj',  match && cell.classList.contains('adj'));
        r.classList.toggle('hl-free', match && cell.classList.contains('free'));
      });
      // Col highlight
      container.querySelectorAll(`.gg-ch[data-freq="${freq}"]`).forEach(c => c.classList.add('col-hl'));
      // Tooltip
      const row = cityRows.find(r => r.city === cityName);
      const cellData = row?.channelMap.find(c => Math.abs(c.freq - freq) < 0.01);
      if (row && cellData) showTT(e, cellData, row);
    });
    cell.addEventListener('mousemove', moveTT);
    cell.addEventListener('mouseleave', () => {
      container.querySelectorAll('.gg-ruler-ch').forEach(r =>
        r.classList.remove('hl-used', 'hl-adj', 'hl-free')
      );
      container.querySelectorAll('.gg-ch.col-hl').forEach(c => c.classList.remove('col-hl'));
      hideTT();
    });
  });
}

// ── Main export ───────────────────────────────────────────────────────
// preloadedStations: state.data.stations dari main.js (sumber tunggal data)
// filterCities: array kota yang dipilih (dari drawer filter)
// geoSettings: { showAdj, showLabel, onlyFree }
// onClickCell: callback(ch) → openInlineDetail dari main.js
export function renderGeoGridView(container, filterCities, geoSettings, preloadedStations, onClickCell) {
  injectCSS();
  resetColors();
  _tt = null;

  const showAdj   = geoSettings?.showAdj   !== false;
  const showLabel = geoSettings?.showLabel  !== false;
  const onlyFree  = geoSettings?.onlyFree  === true;

  let stations = (preloadedStations || []).map(s => ({ ...s, freq: parseFloat(s.freq) }));
  if (filterCities && filterCities.length > 0) {
    stations = stations.filter(s =>
      filterCities.includes((s.wilayah_layanan || s.kota || s.city || '').toUpperCase().trim()) ||
      filterCities.includes(s.wilayah_layanan || s.kota || s.city || '')
    );
  }

  if (!stations.length) {
    container.innerHTML = `<div class="gg-state"><span>Tidak ada stasiun untuk filter ini.</span></div>`;
    return;
  }

  const cityRows = buildCityRows(stations);

  // Render: sticky label col kiri + shared scroll kanan (konsisten dgn grid & band view)
  const rows = cityRows.map(r => renderCityRow(r, { showAdj, showLabel, onlyFree })).join('');
  container.innerHTML = `
    <div class="gg-wrap">
      <div class="gg-grid-area" id="ggGridArea">
        <div class="gg-grid-min">
          ${renderRuler()}
          <div class="gg-table" id="ggTable">${rows}</div>
        </div>
      </div>
      <div class="gg-tt" id="ggTT"></div>
    </div>`;

  const area = container.querySelector('#ggGridArea');

  // Click handler — teruskan ke openInlineDetail via callback
  area.addEventListener('click', e => {
    const cell = e.target.closest('.gg-ch[data-freq]');
    if (!cell) return;
    const freq = parseFloat(cell.dataset.freq);
    const cityName = cell.dataset.city;
    const row = cityRows.find(r => r.city === cityName);
    const ch = row?.channelMap.find(c => Math.abs(c.freq - freq) < 0.01);
    if (ch && onClickCell) {
      const coStations = (preloadedStations || [])
        .filter(s => Math.abs(parseFloat(s.freq) - freq) < 0.01 && (s.wilayah_layanan || s.kota || s.city) === cityName)
        .sort((a, b) => (a.stn_name||'').localeCompare(b.stn_name||''));
      const normalized = {
        freq: ch.freq,
        lower: ch.lower,
        upper: ch.upper,
        type: ch.type === 'adj' ? 'adjacent_1' : ch.type,
        station: ch.station || null,
        adj_left:  ch.adjL || null,
        adj_right: ch.adjR || null,
        coStations: coStations.length > 0 ? coStations : null,
      };
      onClickCell(normalized);
    }
  });

  attachCellEvents(area, cityRows);
}
