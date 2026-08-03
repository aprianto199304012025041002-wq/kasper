// src/mobile.js
// Mobile UI enhancements: bottom nav, filter drawer, scroll hints

export function initMobileUI(getState, onViewChange, onPageChange, onFilterChange) {

  injectBottomNav(getState, onViewChange, onPageChange);
  injectFilterDrawer(getState, onFilterChange);
  injectScrollHints();

  // Update bottom nav active state when state changes
  return {
    syncNav: () => syncBottomNav(getState()),
  };
}

// ── Bottom nav ────────────────────────────────────────────────────────
function injectBottomNav(getState, onViewChange, onPageChange) {
  if (document.getElementById('mobBottomNav')) return;

  const nav = document.createElement('div');
  nav.className = 'mob-bottom-nav';
  nav.id = 'mobBottomNav';
  nav.innerHTML = `
    <button data-nav-view="grid">
      <span class="mob-nav-icon">⊞</span>
      <span>Grid</span>
    </button>
    <button data-nav-view="band">
      <span class="mob-nav-icon">▬</span>
      <span>Pita</span>
    </button>
    <button data-nav-view="geo">
      <span class="mob-nav-icon">⊟</span>
      <span>Geo</span>
    </button>
    <button data-nav-page="interference">
      <span class="mob-nav-icon">⚡</span>
      <span>Interferensi</span>
    </button>`;

  document.body.appendChild(nav);
  syncBottomNav(getState());

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.navView) onViewChange(btn.dataset.navView);
    if (btn.dataset.navPage) onPageChange(btn.dataset.navPage);
    syncBottomNav(getState());
  });
}

function syncBottomNav(state) {
  const nav = document.getElementById('mobBottomNav');
  if (!nav) return;
  nav.querySelectorAll('button').forEach((btn) => {
    const isView = btn.dataset.navView;
    const isPage = btn.dataset.navPage;
    btn.classList.toggle('is-active',
      (isView && state.view === isView && state.page === 'main') ||
      (isPage && state.page === isPage)
    );
  });
}

// ── Filter drawer ─────────────────────────────────────────────────────
function injectFilterDrawer(getState, onFilterChange) {
  if (document.getElementById('mobFilterDrawer')) return;

  const drawer = document.createElement('div');
  drawer.className = 'mob-filter-drawer';
  drawer.id = 'mobFilterDrawer';
  drawer.innerHTML = `
    <div class="mob-drawer-backdrop"></div>
    <div class="mob-drawer-panel">
      <div class="mob-drawer-handle"></div>
      <div class="mob-drawer-title">Filter & Pencarian</div>
      <div class="mob-drawer-body" id="mobDrawerBody">
        <div class="mob-filter-row">
          <label>Wilayah / Kota</label>
          <select id="mobFCity"><option value="all">Semua</option></select>
        </div>
        <div class="mob-filter-row">
          <label>Jenis Siaran</label>
          <select id="mobFJenis">
            <option value="all">Semua</option>
            <option value="swasta">Swasta</option>
            <option value="publik">Publik (RRI)</option>
            <option value="publik_lokal">Publik Lokal (LPPL)</option>
            <option value="komunitas">Komunitas</option>
          </select>
        </div>
        <div class="mob-filter-row">
          <label>Tampilkan</label>
          <select id="mobFChanView">
            <option value="all">Semua kanal</option>
            <option value="free">Kosong saja</option>
            <option value="used">Terpakai saja</option>
          </select>
        </div>
        <div class="mob-filter-row">
          <label>Cari Stasiun</label>
          <input type="search" id="mobFSearch" placeholder="Nama stasiun / frekuensi…">
        </div>
      </div>
      <button class="mob-drawer-apply" id="mobDrawerApply">Terapkan Filter</button>
    </div>`;

  document.body.appendChild(drawer);

  // Backdrop close
  drawer.querySelector('.mob-drawer-backdrop').addEventListener('click', closeDrawer);

  // Apply button
  document.getElementById('mobDrawerApply').addEventListener('click', () => {
    onFilterChange({
      filterCity:     document.getElementById('mobFCity').value,
      filterJenis:    document.getElementById('mobFJenis').value,
      filterChanView: document.getElementById('mobFChanView').value,
      searchTerm:     document.getElementById('mobFSearch').value,
    });
    closeDrawer();
    updateFilterBadge(getState());
  });

  // Swipe down to close
  let startY = 0;
  const panel = drawer.querySelector('.mob-drawer-panel');
  panel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - startY;
    if (dy > 60) closeDrawer();
  }, { passive: true });
}

export function openFilterDrawer(state) {
  const drawer = document.getElementById('mobFilterDrawer');
  if (!drawer) return;

  // Sync values
  const cityEl   = document.getElementById('mobFCity');
  const jenisEl  = document.getElementById('mobFJenis');
  const chanEl   = document.getElementById('mobFChanView');
  const searchEl = document.getElementById('mobFSearch');

  // Populate city options if data available
  if (state.data) {
    const cities = [...new Set(state.data.stations.map(s => s.kota || s.city).filter(Boolean))].sort();
    cityEl.innerHTML = `<option value="all">Semua</option>` +
      cities.map(c => `<option value="${c}" ${state.filterCity === c ? 'selected' : ''}>${c}</option>`).join('');
  }

  if (jenisEl)  jenisEl.value  = state.filterJenis    || 'all';
  if (chanEl)   chanEl.value   = state.filterChanView  || 'all';
  if (searchEl) searchEl.value = state.searchTerm      || '';

  drawer.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const drawer = document.getElementById('mobFilterDrawer');
  if (drawer) drawer.classList.remove('is-open');
  document.body.style.overflow = '';
}

function updateFilterBadge(state) {
  const badge = document.querySelector('.mob-badge');
  if (!badge) return;
  const active = (state.filterCity !== 'all' ? 1 : 0)
    + (state.filterJenis !== 'all' ? 1 : 0)
    + (state.filterChanView !== 'all' ? 1 : 0)
    + (state.searchTerm ? 1 : 0);
  badge.textContent = active;
  badge.classList.toggle('has-filter', active > 0);
}

export function syncFilterBadge(state) { updateFilterBadge(state); }

// ── Scroll hints ──────────────────────────────────────────────────────
function injectScrollHints() {
  // Add scroll hint after band view renders
  const observer = new MutationObserver(() => {
    const trackWrap = document.querySelector('.band-track-wrap');
    if (trackWrap && !trackWrap.previousElementSibling?.classList.contains('band-scroll-hint')) {
      const hint = document.createElement('div');
      hint.className = 'band-scroll-hint';
      hint.textContent = '← geser untuk lihat spektrum penuh →';
      trackWrap.parentNode.insertBefore(hint, trackWrap);
    }

    // Add geo grid scroll hint
    const geoScroll = document.querySelector('.gg-scroll-wrap');
    if (geoScroll && !geoScroll.previousElementSibling?.classList.contains('band-scroll-hint')) {
      const hint = document.createElement('div');
      hint.className = 'band-scroll-hint';
      hint.textContent = '← geser untuk melihat semua 103 kanal →';
      geoScroll.parentNode.insertBefore(hint, geoScroll);
    }
  });

  observer.observe(document.getElementById('app') || document.body, {
    childList: true, subtree: true,
  });
}

// ── Mobile tap info (replace tooltip) ────────────────────────────────
export function initMobileTap(container, data) {
  if (window.matchMedia('(pointer: coarse)').matches) {
    container.querySelectorAll('.gg-ch.gg-used').forEach((cell) => {
      cell.addEventListener('click', () => {
        const freq = parseFloat(cell.dataset.freq);
        const city = cell.dataset.city;
        showMobileSnack(`${freq.toFixed(1)} MHz · ${city}`);
      });
    });
  }
}

function showMobileSnack(msg) {
  let snack = document.getElementById('mobSnack');
  if (!snack) {
    snack = document.createElement('div');
    snack.id = 'mobSnack';
    snack.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
      background:var(--bg-panel-raised);border:1px solid var(--border-mid);
      color:var(--text-primary);font-family:var(--font-mono);font-size:12px;
      padding:10px 18px;border-radius:20px;z-index:300;
      box-shadow:0 4px 20px rgba(0,0,0,.5);
      opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap;
    `;
    document.body.appendChild(snack);
  }
  snack.textContent = msg;
  snack.style.opacity = '1';
  snack.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(snack._t);
  snack._t = setTimeout(() => {
    snack.style.opacity = '0';
    snack.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}
