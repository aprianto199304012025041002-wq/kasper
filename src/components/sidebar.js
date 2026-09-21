// components/sidebar.js
// Sidebar navigasi: daftar wilayah dikelompokkan per provinsi.

import { state, getWilayahByProv, KOMUNITAS_RADIUS } from '../state.js';
import { isExpired, shortWilayah, esc } from '../utils.js';

let _onSelect = null;

export function mountSidebar(onSelect) {
  _onSelect = onSelect;

  const search = document.getElementById('nav-search');
  if (search) {
    search.oninput = e => filterNav(e.target.value.toLowerCase());
  }

  // Tombol tutup sidebar di mobile
  const closeBtn = document.getElementById('nav-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      document.getElementById('sidebar')?.classList.remove('mob-open');
      document.getElementById('mob-backdrop')?.classList.remove('show');
    };
  }
}

export function renderSidebar() {
  const nav = document.getElementById('nav-list');
  if (!nav || !state.data) return;

  const stations = state.data.stations || [];
  const { diy, jateng } = getWilayahByProv();

  const stationCount = w => w === '' ? stations.filter(s => (s.wilayah_layanan || s.kota) !== KOMUNITAS_RADIUS).length
                                     : stations.filter(s => (s.wilayah_layanan || s.kota) === w).length;
  const expiredCount = w => w === '' ? stations.filter(s => (s.wilayah_layanan || s.kota) !== KOMUNITAS_RADIUS && isExpired(s)).length
                                     : stations.filter(s => (s.wilayah_layanan || s.kota) === w && isExpired(s)).length;

  const item = (w, label) => {
    const cnt = stationCount(w);
    const exp = expiredCount(w);
    const active = w === '' ? !state.wilayah.length : state.wilayah.includes(w);
    return `
      <button class="nav-item${active ? ' active' : ''}" data-w="${esc(w)}">
        <span class="nav-label">${esc(label)}</span>
        <span class="nav-count">
          ${exp ? `<span class="nav-exp">⚠${exp}</span> ` : ''}${cnt}
        </span>
      </button>`;
  };

  const section = (title, items) => items.length
    ? `<div class="nav-sec">${title}</div>${items.map(w => item(w, shortWilayah(w))).join('')}`
    : '';

  nav.innerHTML =
    item('', 'Semua Wilayah') +
    section('D.I. Yogyakarta', diy) +
    section('Jawa Tengah', jateng);

  nav.onclick = e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const w = btn.dataset.w;
    if (w === '') {
      // Semua Wilayah = reset
      state.wilayah = [];
    } else {
      const idx = state.wilayah.indexOf(w);
      if (idx === -1) state.wilayah = [...state.wilayah, w];
      else            state.wilayah = state.wilayah.filter(x => x !== w);
    }
    renderSidebar();
    if (_onSelect) _onSelect();
  };
}

function filterNav(q) {
  document.querySelectorAll('#nav-list .nav-item').forEach(btn => {
    btn.style.display = q && !btn.textContent.toLowerCase().includes(q) ? 'none' : '';
  });
}
