// views/rf.js
// RF view: tabel interferensi hasil komputasi ITU-R BS.412.
// Sortable per kolom, filter per level (critical/warning/ok).

import { state } from '../state.js';
import { computeInterference } from '../engine/interference.js';
import { esc } from '../utils.js';

const TYPE_LABEL = { co_channel: 'Co-channel', adjacent_1: '±1 Adjacent', adjacent_2: '±2 Adjacent' };
const TYPE_CLS   = { co_channel: 'rf-co',     adjacent_1: 'rf-adj1',     adjacent_2: 'rf-adj2'     };
const LEVEL_CLS  = { critical: 'lv-critical', warning: 'lv-warning', ok: 'lv-ok' };

let _sortCol = 'level';
let _sortAsc = true;
let _filterLevel = '';

export function renderRF() {
  const main = document.getElementById('main');
  if (!main) return;

  // Hitung jika belum ada
  if (!state.interfData) {
    main.innerHTML = `<div class="loading"><div class="spin"></div>Menghitung interferensi…</div>`;
    setTimeout(() => {
      try {
        state.interfData = computeInterference(state.data?.stations || []);
      } catch (e) {
        main.innerHTML = `<div class="err">Gagal menghitung: ${e.message}</div>`;
        return;
      }
      renderRF();
    }, 50); // beri waktu browser render spinner dulu
    return;
  }

  const { pairs = [], summary = {}, stations_evaluated = 0 } = state.interfData;
  const adjTotal = (summary.adjacent_1 || 0) + (summary.adjacent_2 || 0);

  main.innerHTML = `
    <div class="rf-wrap">
      <div class="rf-summary">
        <div class="rf-stat">
          <div class="rf-stat-l">Dievaluasi</div>
          <div class="rf-stat-v">${stations_evaluated}</div>
        </div>
        <div class="rf-stat">
          <div class="rf-stat-l">Total pasang</div>
          <div class="rf-stat-v">${pairs.length}</div>
        </div>
        <div class="rf-stat">
          <div class="rf-stat-l">Co-channel</div>
          <div class="rf-stat-v ${summary.co_channel ? 'red' : ''}">${summary.co_channel || 0}</div>
        </div>
        <div class="rf-stat">
          <div class="rf-stat-l">Adjacent</div>
          <div class="rf-stat-v ${adjTotal ? 'amber' : ''}">${adjTotal}</div>
        </div>
        <div class="rf-stat">
          <div class="rf-stat-l">Aman (dekat)</div>
          <div class="rf-stat-v">${summary.ok || 0}</div>
        </div>
      </div>

      ${pairs.length === 0
        ? `<div class="empty">Tidak ada pasangan interferensi terdeteksi.</div>`
        : `
        <div class="rf-controls">
          <select id="rf-filter">
            <option value="">Semua level</option>
            <option value="critical" ${_filterLevel === 'critical' ? 'selected' : ''}>Critical saja</option>
            <option value="warning"  ${_filterLevel === 'warning'  ? 'selected' : ''}>Warning saja</option>
            <option value="ok"       ${_filterLevel === 'ok'       ? 'selected' : ''}>OK saja</option>
          </select>
        </div>
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th class="sortable" data-col="level">Level</th>
                <th class="sortable" data-col="type">Tipe</th>
                <th>Interferor (TX)</th>
                <th>Korban (RX)</th>
                <th class="sortable" data-col="dist">Jarak</th>
                <th class="sortable" data-col="margin">Margin D/U</th>
              </tr>
            </thead>
            <tbody id="rf-tbody">${buildRows(pairs)}</tbody>
          </table>
        </div>`
      }
    </div>`;

  // Event: filter level
  document.getElementById('rf-filter')?.addEventListener('change', e => {
    _filterLevel = e.target.value;
    document.getElementById('rf-tbody').innerHTML = buildRows(sortPairs(pairs));
  });

  // Event: sort kolom
  document.querySelectorAll('.rf-table .sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (_sortCol === col) _sortAsc = !_sortAsc;
      else { _sortCol = col; _sortAsc = col !== 'margin'; }
      document.querySelectorAll('.sortable').forEach(h =>
        h.textContent = h.textContent.replace(/ [▲▼]$/, '')
      );
      th.textContent += _sortAsc ? ' ▲' : ' ▼';
      document.getElementById('rf-tbody').innerHTML = buildRows(sortPairs(pairs));
    });
  });
}

function sortPairs(pairs) {
  const levelRank = { critical: 0, warning: 1, ok: 2 };
  return [...pairs].sort((a, b) => {
    let va, vb;
    if      (_sortCol === 'level')  { va = levelRank[a.level];  vb = levelRank[b.level]; }
    else if (_sortCol === 'type')   { va = a.type;               vb = b.type; }
    else if (_sortCol === 'dist')   { va = a.dist_km;            vb = b.dist_km; }
    else if (_sortCol === 'margin') { va = a.margin_db;          vb = b.margin_db; }
    else return 0;
    if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _sortAsc ? va - vb : vb - va;
  });
}

const shortWil = w => !w ? '' : w.startsWith('2,5') ? 'Komunitas' : w;

function buildRows(pairs) {
  const filtered = _filterLevel ? pairs.filter(p => p.level === _filterLevel) : pairs;
  if (!filtered.length) return `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--txt3)">Tidak ada data</td></tr>`;

  return filtered.map(p => `
    <tr data-level="${p.level}">
      <td><span class="lv-badge ${LEVEL_CLS[p.level]}">${p.level}</span></td>
      <td><span class="rf-badge ${TYPE_CLS[p.type]}">${TYPE_LABEL[p.type]}</span></td>
      <td>
        <span class="rf-freq">${p.tx.freq.toFixed(1)}</span>
        <span class="rf-name">${esc(p.tx.stn_name)}</span>
        <span class="rf-wilayah">${esc(shortWil(p.tx.wilayah_layanan))}</span>
      </td>
      <td>
        <span class="rf-freq">${p.rx.freq.toFixed(1)}</span>
        <span class="rf-name">${esc(p.rx.stn_name)}</span>
        <span class="rf-wilayah">${esc(shortWil(p.rx.wilayah_layanan))}</span>
      </td>
      <td class="mono">${p.dist_km} km</td>
      <td class="mono ${p.margin_db < 0 ? 'red' : 'green'}">${p.margin_db > 0 ? '+' : ''}${p.margin_db} dB</td>
    </tr>`).join('');
}
