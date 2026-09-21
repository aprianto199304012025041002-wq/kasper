// components/sidebar.js
// Sidebar navigasi: daftar wilayah dikelompokkan per provinsi.
// Provinsi bisa di-collapse; sidebar bisa disembunyikan sepenuhnya.

import { state, getWilayahByProv, KOMUNITAS_RADIUS, wilayahOf } from '../state.js';
import { isExpired, shortWilayah, esc } from '../utils.js';

let _onSelect = null;

// State collapse per provinsi — persist di localStorage
const _collapsed = new Set(
  JSON.parse(localStorage.getItem('kasper-collapsed') || '[]')
);

function saveCollapsed() {
  localStorage.setItem('kasper-collapsed', JSON.stringify([..._collapsed]));
}

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

  // Tombol toggle sidebar di desktop (collapse ke kiri)
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    const sidebar = document.getElementById('sidebar');
    const body    = document.getElementById('body');
    const collapsed = localStorage.getItem('kasper-sidebar-collapsed') === '1';
    if (collapsed) { sidebar?.classList.add('sb-hidden'); body?.classList.add('sb-hidden'); }
    updateToggleBtn(toggleBtn, collapsed);

    toggleBtn.onclick = () => {
      const isHidden = sidebar?.classList.toggle('sb-hidden');
      body?.classList.toggle('sb-hidden', isHidden);
      localStorage.setItem('kasper-sidebar-collapsed', isHidden ? '1' : '0');
      updateToggleBtn(toggleBtn, isHidden);
    };
  }
}

function updateToggleBtn(btn, isHidden) {
  btn.title = isHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar';
  btn.textContent = isHidden ? '›' : '‹';
}

export function renderSidebar() {
  const nav = document.getElementById('nav-list');
  if (!nav || !state.data) return;

  const stations = state.data.stations || [];
  const { diy, jateng } = getWilayahByProv();

  const stationCount = w => w === '' ? stations.filter(s => wilayahOf(s) !== KOMUNITAS_RADIUS).length
                                     : stations.filter(s => wilayahOf(s) === w).length;
  const expiredCount = w => w === '' ? stations.filter(s => wilayahOf(s) !== KOMUNITAS_RADIUS && isExpired(s)).length
                                     : stations.filter(s => wilayahOf(s) === w && isExpired(s)).length;

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

  const section = (key, title, items) => {
    if (!items.length) return '';
    const isCollapsed = _collapsed.has(key);
    const activeCount = items.filter(w => state.wilayah.includes(w)).length;
    return `
      <button class="nav-sec-hdr${isCollapsed ? ' collapsed' : ''}" data-sec="${key}">
        <span>${title}</span>
        <span class="nav-sec-meta">
          ${activeCount ? `<span class="nav-sec-active">${activeCount} dipilih</span>` : ''}
          <span class="nav-sec-chevron">${isCollapsed ? '›' : '‹'}</span>
        </span>
      </button>
      <div class="nav-sec-body${isCollapsed ? ' hidden' : ''}">
        ${items.map(w => item(w, shortWilayah(w))).join('')}
      </div>`;
  };

  nav.innerHTML =
    item('', 'Semua Wilayah') +
    section('diy',    'D.I. Yogyakarta', diy) +
    section('jateng', 'Jawa Tengah',     jateng);

  nav.onclick = e => {
    // Toggle collapse provinsi
    const secBtn = e.target.closest('.nav-sec-hdr');
    if (secBtn) {
      const key = secBtn.dataset.sec;
      if (_collapsed.has(key)) _collapsed.delete(key);
      else _collapsed.add(key);
      saveCollapsed();
      renderSidebar();
      return;
    }

    // Pilih wilayah
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const w = btn.dataset.w;
    if (w === '') {
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
