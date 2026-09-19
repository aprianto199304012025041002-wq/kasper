// components/toolbar.js
// Toolbar: tab navigasi view (Grid/Pita/Geo/RF) + search + filter kanal.

import { state } from '../state.js';

const VIEWS = [
  { id: 'grid', label: 'Grid' },
  { id: 'band', label: 'Pita' },
  { id: 'geo',  label: 'Geo'  },
  { id: 'rf',   label: '⚡ RF' },
];

let _onView   = null;
let _onSearch = null;
let _onFilter = null;

export function mountToolbar({ onView, onSearch, onFilter }) {
  _onView   = onView;
  _onSearch = onSearch;
  _onFilter = onFilter;

  renderToolbar();
}

export function renderToolbar() {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  const isRF = state.view === 'rf';

  toolbar.innerHTML = `
    <div id="tabs">
      ${VIEWS.map(v => `
        <button class="tab${state.view === v.id ? ' active' : ''}" data-v="${v.id}">
          ${v.label}
        </button>`).join('')}
    </div>
    <div id="filters"${isRF ? ' style="display:none"' : ''}>
      <input
        id="f-search" type="search"
        placeholder="Cari stasiun / pemilik / frekuensi…"
        value="${state.search}"
        autocomplete="off"/>
      <select id="f-chan">
        <option value="all"     ${state.chanFilter === 'all'     ? 'selected' : ''}>Semua kanal</option>
        <option value="free"    ${state.chanFilter === 'free'    ? 'selected' : ''}>Kosong saja</option>
        <option value="used"    ${state.chanFilter === 'used'    ? 'selected' : ''}>Terisi saja</option>
        <option value="expired" ${state.chanFilter === 'expired' ? 'selected' : ''}>⚠ Izin habis</option>
      </select>
    </div>`;

  document.getElementById('tabs').onclick = e => {
    const v = e.target.closest('.tab')?.dataset.v;
    if (!v || v === state.view) return;
    state.view = v;
    renderToolbar();
    if (_onView) _onView(v);
  };

  const searchEl = document.getElementById('f-search');
  if (searchEl) {
    searchEl.oninput = e => {
      state.search = e.target.value;
      if (_onSearch) _onSearch(state.search);
    };
  }

  const chanEl = document.getElementById('f-chan');
  if (chanEl) {
    chanEl.onchange = e => {
      state.chanFilter = e.target.value;
      if (_onFilter) _onFilter(state.chanFilter);
    };
  }
}
