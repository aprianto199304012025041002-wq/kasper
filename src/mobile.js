// src/mobile.js — Universal Drawer: semua kontrol masuk satu drawer, FAB kiri bawah

const JENIS_LABELS = {
  swasta: 'Swasta', publik: 'Publik (RRI)',
  publik_lokal: 'Publik Lokal (LPPL)', komunitas: 'Komunitas',
};

// ── FAB kiri bawah ───────────────────────────────────────────────────
function injectFAB() {
  if (document.getElementById('kasperFAB')) return;
  const fab = document.createElement('button');
  fab.id = 'kasperFAB';
  fab.className = 'kasper-fab';
  fab.setAttribute('aria-label', 'Buka panel kontrol');
  fab.innerHTML = `<span class="kasper-fab__icon">⚙</span><span class="kasper-fab__badge" id="fabBadge"></span>`;
  document.body.appendChild(fab);
  fab.addEventListener('click', openDrawer);
}

// ── Drawer utama ─────────────────────────────────────────────────────
function injectDrawer() {
  if (document.getElementById('kasperDrawer')) return;
  const el = document.createElement('div');
  el.id = 'kasperDrawer';
  el.className = 'kasper-drawer';
  el.innerHTML = `
    <div class="kasper-drawer__backdrop"></div>
    <div class="kasper-drawer__panel" role="dialog" aria-modal="true" aria-label="Panel Kontrol">
      <div class="kasper-drawer__handle"></div>

      <div class="kasper-drawer__header">
        <span class="kasper-drawer__title">KONTROL</span>
        <button class="kasper-drawer__close" id="drawerClose" aria-label="Tutup">✕</button>
      </div>

      <div class="kasper-drawer__body">

        <!-- ── PROVINSI ── -->
        <section class="kd-section">
          <div class="kd-section__label">Wilayah</div>
          <div class="kd-province-chips" id="drawerProvince"></div>
        </section>

        <!-- ── VIEW MODE ── -->
        <section class="kd-section">
          <div class="kd-section__label">Mode Tampilan</div>
          <div class="kd-view-grid" id="drawerViewGrid">
            <button class="kd-view-btn" data-dview="grid">⊞<span>Grid</span></button>
            <button class="kd-view-btn" data-dview="band">▬<span>Pita</span></button>
            <button class="kd-view-btn" data-dview="geo">⊟<span>Geo Grid</span></button>
            <button class="kd-view-btn" data-dpage="interference">⚡<span>Interferensi</span></button>
          </div>
        </section>

        <!-- ── FILTER KOTA ── -->
        <section class="kd-section" id="drawerSectionCity">
          <div class="kd-section__label">Kota / Kabupaten</div>
          <select class="kd-select" id="drawerFCity">
            <option value="all">Semua wilayah</option>
          </select>
        </section>

        <!-- ── FILTER JENIS ── -->
        <section class="kd-section">
          <div class="kd-section__label">Jenis Siaran</div>
          <select class="kd-select" id="drawerFJenis">
            <option value="all">Semua jenis</option>
            ${Object.entries(JENIS_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </section>

        <!-- ── FILTER TAMPILAN KANAL ── -->
        <section class="kd-section" id="drawerSectionChanView">
          <div class="kd-section__label">Tampilkan Kanal</div>
          <div class="kd-segmented" id="drawerChanView">
            <button class="kd-seg-btn is-active" data-chanview="all">Semua</button>
            <button class="kd-seg-btn" data-chanview="free">Kosong ★</button>
            <button class="kd-seg-btn" data-chanview="used">Terpakai</button>
          </div>
        </section>

        <!-- ── SEARCH ── -->
        <section class="kd-section">
          <div class="kd-section__label">Cari Stasiun / Frekuensi</div>
          <div class="kd-search-wrap">
            <input type="search" class="kd-search" id="drawerSearch"
              placeholder="contoh: 101.7 atau Radio…" autocomplete="off" spellcheck="false">
            <span class="kd-search__icon">⌕</span>
          </div>
        </section>

        <!-- ── STATUS API ── -->
        <section class="kd-section kd-section--api">
          <div class="kd-api-status" id="drawerApiStatus">
            <span class="live-dot"></span> Memeriksa API…
          </div>
        </section>

      </div>

      <div class="kasper-drawer__footer">
        <button class="kd-btn-reset" id="drawerReset">Reset Filter</button>
        <button class="kd-btn-apply" id="drawerApply">Terapkan ✓</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector('.kasper-drawer__backdrop').addEventListener('click', closeDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);

  // Swipe down to close
  const panel = el.querySelector('.kasper-drawer__panel');
  let _sy = 0;
  panel.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (e.touches[0].clientY - _sy > 60) closeDrawer();
  }, { passive: true });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  // ChanView segmented buttons
  el.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });
}

// ── Open / Close ──────────────────────────────────────────────────────
export function openDrawer() {
  document.getElementById('kasperDrawer')?.classList.add('is-open');
  document.body.classList.add('drawer-open');
}

function closeDrawer() {
  document.getElementById('kasperDrawer')?.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
}

// ── Sync drawer values dari state ─────────────────────────────────────
function syncDrawer(state) {
  // Province chips
  const provEl = document.getElementById('drawerProvince');
  if (provEl) {
    const items = state.provinces || [];
    provEl.innerHTML =
      `<button class="kd-prov-chip ${!state.province ? 'is-active' : ''}" data-prov="">
        Semua<span class="kd-prov-chip__cnt">${items.reduce((a,p) => a + (p.total_fm||0), 0) || ''}</span>
      </button>` +
      items.map(p => `
        <button class="kd-prov-chip ${p.name === state.province ? 'is-active' : ''}" data-prov="${p.name}">
          ${shortName(p.name)}<span class="kd-prov-chip__cnt">${p.total_fm||0}</span>
        </button>`).join('');

    provEl.querySelectorAll('.kd-prov-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        provEl.querySelectorAll('.kd-prov-chip').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  // View mode buttons
  document.querySelectorAll('.kd-view-btn[data-dview]').forEach(btn => {
    btn.classList.toggle('is-active',
      btn.dataset.dview === state.view && state.page === 'main');
  });
  document.querySelectorAll('.kd-view-btn[data-dpage]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.dpage === state.page);
  });

  // City select
  const cityEl = document.getElementById('drawerFCity');
  if (cityEl && state.data) {
    const cities = [...new Set(state.data.stations.map(s => s.kota||s.city).filter(Boolean))].sort();
    cityEl.innerHTML = `<option value="all">Semua wilayah</option>` +
      cities.map(c => `<option value="${c}" ${state.filterCity===c?'selected':''}>${c}</option>`).join('');
  } else if (cityEl) {
    cityEl.value = state.filterCity || 'all';
  }

  // Jenis select
  const jenisEl = document.getElementById('drawerFJenis');
  if (jenisEl) jenisEl.value = state.filterJenis || 'all';

  // ChanView segmented
  document.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.chanview === (state.filterChanView || 'all'));
  });

  // Search
  const searchEl = document.getElementById('drawerSearch');
  if (searchEl) searchEl.value = state.searchTerm || '';

  // Hide chanview + city filter on geo/interference
  const sectionChan = document.getElementById('drawerSectionChanView');
  const sectionCity = document.getElementById('drawerSectionCity');
  const isGeoOrInterf = state.view === 'geo' || state.page === 'interference';
  if (sectionChan) sectionChan.style.display = isGeoOrInterf ? 'none' : '';
  if (sectionCity) sectionCity.style.display = state.page === 'interference' ? 'none' : '';

  // API status
  const apiEl = document.getElementById('drawerApiStatus');
  if (apiEl) {
    const live = !window._kasperFallback;
    apiEl.innerHTML = live
      ? `<span class="live-dot"></span> API live — kasper.balmonjogja.info`
      : `<span style="color:var(--signal-warn)">⬡</span> Mode offline — data lokal`;
  }

  // Update FAB badge
  updateFabBadge(state);
}

function updateFabBadge(state) {
  const badge = document.getElementById('fabBadge');
  if (!badge) return;
  const n = (state.filterCity !== 'all' ? 1 : 0)
    + (state.filterJenis !== 'all' ? 1 : 0)
    + (state.filterChanView !== 'all' ? 1 : 0)
    + (state.searchTerm ? 1 : 0)
    + (state.province ? 1 : 0);
  badge.textContent = n || '';
  badge.classList.toggle('has-filter', n > 0);
}

// ── Init utama ────────────────────────────────────────────────────────
export function initMobileUI(getState, onViewChange, onPageChange, onFilterChange) {
  injectFAB();
  injectDrawer();
  injectScrollHints();

  // Apply button
  document.getElementById('drawerApply').addEventListener('click', () => {
    const state = getState();
    const newProvince = document.querySelector('.kd-prov-chip.is-active')?.dataset.prov ?? state.province;
    const newView     = document.querySelector('.kd-view-btn[data-dview].is-active')?.dataset.dview;
    const newPage     = document.querySelector('.kd-view-btn[data-dpage].is-active')?.dataset.dpage;
    const newChan     = document.querySelector('.kd-seg-btn[data-chanview].is-active')?.dataset.chanview || 'all';

    closeDrawer();

    // Province changed?
    if (newProvince !== state.province) {
      onFilterChange({ province: newProvince });
    }

    // View/page changed?
    if (newView && (newView !== state.view || state.page !== 'main')) {
      onViewChange(newView);
    } else if (newPage && newPage !== state.page) {
      onPageChange(newPage);
    }

    // Filters
    onFilterChange({
      filterCity:     document.getElementById('drawerFCity').value,
      filterJenis:    document.getElementById('drawerFJenis').value,
      filterChanView: newChan,
      searchTerm:     document.getElementById('drawerSearch').value,
    });
  });

  // Reset button
  document.getElementById('drawerReset').addEventListener('click', () => {
    document.getElementById('drawerFCity').value = 'all';
    document.getElementById('drawerFJenis').value = 'all';
    document.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.chanview === 'all'));
    const searchEl = document.getElementById('drawerSearch');
    if (searchEl) searchEl.value = '';
    document.querySelectorAll('.kd-prov-chip').forEach((b,i) =>
      b.classList.toggle('is-active', i === 0));
  });

  return {
    syncNav: () => syncDrawer(getState()),
    syncDrawer: () => syncDrawer(getState()),
  };
}

export function openFilterDrawer(state) {
  syncDrawer(state);
  openDrawer();
}

export function syncFilterBadge(state) {
  updateFabBadge(state);
}

// ── Scroll hints ──────────────────────────────────────────────────────
function injectScrollHints() {
  const observer = new MutationObserver(() => {
    const trackWrap = document.querySelector('.band-track-wrap');
    if (trackWrap && !trackWrap.previousElementSibling?.classList.contains('band-scroll-hint')) {
      const hint = document.createElement('div');
      hint.className = 'band-scroll-hint';
      hint.textContent = '← geser untuk lihat spektrum penuh →';
      trackWrap.parentNode.insertBefore(hint, trackWrap);
    }
    const geoScroll = document.querySelector('.gg-scroll-wrap');
    if (geoScroll && !geoScroll.previousElementSibling?.classList.contains('band-scroll-hint')) {
      const hint = document.createElement('div');
      hint.className = 'band-scroll-hint';
      hint.textContent = '← geser untuk melihat semua 103 kanal →';
      geoScroll.parentNode.insertBefore(hint, geoScroll);
    }
  });
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
}

function shortName(name) {
  const map = {
    'DAERAH ISTIMEWA YOGYAKARTA': 'D.I. Yogyakarta',
    'JAWA TENGAH': 'Jawa Tengah', 'JAWA TIMUR': 'Jawa Timur',
    'JAWA BARAT': 'Jawa Barat', 'DKI JAKARTA': 'DKI Jakarta',
    'SUMATERA UTARA': 'Sumut', 'BALI': 'Bali',
    'KALIMANTAN SELATAN': 'Kalsel', 'SULAWESI SELATAN': 'Sulsel',
    'NUSA TENGGARA BARAT': 'NTB',
  };
  return map[name] || name.split(' ').slice(0, 2).join(' ');
}

export function initMobileTap() {}
