// src/mobile.js — Universal Drawer

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

        <!-- ── MODE TAMPILAN ── -->
        <section class="kd-section">
          <div class="kd-section__label">MODE TAMPILAN</div>
          <div class="kd-view-row" id="drawerViewGrid">
            <button class="kd-view-btn" data-dview="grid">⊞ GRID</button>
            <button class="kd-view-btn" data-dview="band">▬ PITA</button>
            <button class="kd-view-btn" data-dview="geo">⊟ GEO</button>
            <button class="kd-view-btn" data-dpage="interference">⚡ RF</button>
          </div>
        </section>

        <!-- ── FILTER WILAYAH LAYANAN ── -->
        <section class="kd-section" id="drawerSectionCity">
          <div class="kd-section__label">WILAYAH LAYANAN</div>
          <div class="kd-city-chips-scroll"><div class="kd-city-chips" id="drawerCityChips"></div></div>
        </section>

        <!-- ── PENGATURAN GEO (hanya muncul di mode GEO) ── -->
        <section class="kd-section" id="drawerSectionGeo" style="display:none">
          <div class="kd-section__label">PENGATURAN GEO GRID</div>
          <div class="kd-toggle-list">
            <label class="kd-toggle-row">
              <span>Guard band</span>
              <input type="checkbox" id="geoTogAdj" checked>
              <span class="kd-tog-s"></span>
            </label>
            <label class="kd-toggle-row">
              <span>Label sel</span>
              <input type="checkbox" id="geoTogLabel" checked>
              <span class="kd-tog-s"></span>
            </label>
            <label class="kd-toggle-row">
              <span>Sorot slot kosong</span>
              <input type="checkbox" id="geoTogFree">
              <span class="kd-tog-s"></span>
            </label>
          </div>
        </section>

        <!-- ── TAMPILKAN KANAL ── -->
        <section class="kd-section" id="drawerSectionChanView">
          <div class="kd-section__label">TAMPILKAN KANAL</div>
          <div class="kd-segmented" id="drawerChanView">
            <button class="kd-seg-btn is-active" data-chanview="all">SEMUA</button>
            <button class="kd-seg-btn" data-chanview="free">KOSONG ★</button>
            <button class="kd-seg-btn" data-chanview="used">TERPAKAI</button>
            <button class="kd-seg-btn" data-chanview="expired">⚠ HABIS</button>
          </div>
        </section>

        <!-- ── CARI ── -->
        <section class="kd-section">
          <div class="kd-section__label">CARI STASIUN / FREKUENSI</div>
          <div class="kd-search-wrap">
            <input type="search" class="kd-search" id="drawerSearch"
              placeholder="contoh: 101.7 atau Radio…" autocomplete="off" spellcheck="false">
            <span class="kd-search__icon">⌕</span>
          </div>
        </section>

        <!-- ── STATUS API ── -->
        <section class="kd-section kd-section--api">
          <div class="kd-api-status" id="drawerApiStatus">
            <span class="live-dot"></span> MEMERIKSA API…
          </div>
        </section>

      </div>

      <div class="kasper-drawer__footer">
        <button class="kd-btn-reset" id="drawerReset">RESET</button>
        <button class="kd-btn-apply" id="drawerApply">TERAPKAN ✓</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector('.kasper-drawer__backdrop').addEventListener('click', () => {
    closeDrawer();
    if (_getStateFn) updateFabBadge(_getStateFn());
  });
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);

  // Swipe down to close
  const panel = el.querySelector('.kasper-drawer__panel');
  let _sy = 0;
  panel.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (e.touches[0].clientY - _sy > 60) closeDrawer();
  }, { passive: true });

  // Escape key — hanya tutup drawer kalau sedang terbuka
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('kasperDrawer')?.classList.contains('is-open')) {
      e.stopPropagation();
      closeDrawer();
    }
  });

  // View mode buttons — toggle is-active eksklusif
  el.querySelectorAll('.kd-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.kd-view-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // ChanView segmented buttons
  el.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Live search dari drawer — re-render tanpa re-fetch
  let _searchTimer = null;
  document.getElementById('drawerSearch').addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('kasper:search', {
        detail: { searchTerm: e.target.value }
      }));
    }, 280);
  });
}

// ── Open / Close ──────────────────────────────────────────────────────
let _getStateFn = null;

export function openDrawer() {
  if (_getStateFn) syncDrawer(_getStateFn());
  document.getElementById('kasperDrawer')?.classList.add('is-open');
  document.body.classList.add('drawer-open');
  // Autofocus search setelah animasi selesai
  setTimeout(() => {
    document.getElementById('drawerSearch')?.focus();
  }, 300);
}

function closeDrawer() {
  document.getElementById('kasperDrawer')?.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
}

// ── Sync drawer values dari state ─────────────────────────────────────
function syncDrawer(state) {
  // View mode buttons
  document.querySelectorAll('.kd-view-btn[data-dview]').forEach(btn => {
    btn.classList.toggle('is-active',
      btn.dataset.dview === state.view && state.page === 'main');
  });
  document.querySelectorAll('.kd-view-btn[data-dpage]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.dpage === state.page);
  });

  // City chips — multi-select
  const cityChipsEl = document.getElementById('drawerCityChips');
  if (cityChipsEl) {
    const KOMUNITAS_AOS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';
    // Ambil 2 kata pertama sebagai chip label — cukup untuk identifikasi
    const chipLabel = (w) => {
      const words = w.split(/[,\s]+/).filter(Boolean);
      return words.slice(0, 2).join(' ');
    };
    const cities = state.data
      ? [...new Set(state.data.stations
          .map(s => s.wilayah_layanan || s.kota || s.city)
          .filter(w => w && w !== KOMUNITAS_AOS)
        )].sort()
      : [];
    // filterCities = array of selected cities, atau [] = semua
    const sel = state.filterCities || [];
    cityChipsEl.innerHTML =
      `<button class="kd-city-chip ${sel.length === 0 ? 'is-active' : ''}" data-city="">SEMUA</button>` +
      cities.map(c =>
        `<button class="kd-city-chip ${sel.includes(c) ? 'is-active' : ''}" data-city="${c}">${chipLabel(c)}</button>`
      ).join('');

    // Handler: chip "SEMUA" exclusive, chip lain multi-toggle
    cityChipsEl.querySelectorAll('.kd-city-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.city === '') {
          // Klik SEMUA → hapus semua seleksi
          cityChipsEl.querySelectorAll('.kd-city-chip').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        } else {
          // Klik kota tertentu → toggle, hapus "SEMUA"
          cityChipsEl.querySelector('[data-city=""]')?.classList.remove('is-active');
          btn.classList.toggle('is-active');
          // Jika tidak ada yang aktif, aktifkan kembali "SEMUA"
          const anyActive = [...cityChipsEl.querySelectorAll('.kd-city-chip[data-city]')]
            .some(b => b.classList.contains('is-active'));
          if (!anyActive) cityChipsEl.querySelector('[data-city=""]')?.classList.add('is-active');
        }
      });
    });
  }

  // ChanView segmented
  document.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.chanview === (state.filterChanView || 'all'));
  });

  // Search
  const searchEl = document.getElementById('drawerSearch');
  if (searchEl) searchEl.value = state.searchTerm || '';

  // Hide/show seksi berdasarkan mode
  const sectionChan = document.getElementById('drawerSectionChanView');
  const sectionCity = document.getElementById('drawerSectionCity');
  const sectionGeo  = document.getElementById('drawerSectionGeo');
  const isGeo       = state.view === 'geo' && state.page === 'main';
  const isInterf    = state.page === 'interference';
  if (sectionChan) sectionChan.style.display = (isGeo || isInterf) ? 'none' : '';
  if (sectionCity) sectionCity.style.display = isInterf ? 'none' : '';
  if (sectionGeo)  sectionGeo.style.display  = isGeo ? '' : 'none';

  // Sync geo toggles
  if (isGeo && state.geoSettings) {
    const togAdj   = document.getElementById('geoTogAdj');
    const togLabel = document.getElementById('geoTogLabel');
    const togFree  = document.getElementById('geoTogFree');
    if (togAdj)   togAdj.checked   = state.geoSettings.showAdj   !== false;
    if (togLabel) togLabel.checked = state.geoSettings.showLabel  !== false;
    if (togFree)  togFree.checked  = state.geoSettings.onlyFree   === true;
  }

  // API status
  const apiEl = document.getElementById('drawerApiStatus');
  if (apiEl) {
    apiEl.innerHTML = `<span class="live-dot"></span> KASPER.BALMONJOGJA.INFO`;
  }

  updateFabBadge(state);
}

function updateFabBadge(state) {
  const badge = document.getElementById('fabBadge');
  if (!badge) return;
  const cities = state.filterCities || [];
  const geo = state.geoSettings || {};
  const geoChanged = !geo.showAdj || !geo.showLabel || geo.onlyFree;
  const n = (cities.length > 0 ? 1 : 0)
    + (state.filterChanView !== 'all' ? 1 : 0)
    + (state.searchTerm ? 1 : 0)
    + (geoChanged ? 1 : 0);
  badge.textContent = n || '';
  badge.classList.toggle('has-filter', n > 0);
}

// ── Helper: baca pilihan city chips ──────────────────────────────────
function getSelectedCities() {
  const chips = [...document.querySelectorAll('.kd-city-chip[data-city].is-active')];
  return chips.map(b => b.dataset.city).filter(Boolean); // [] = semua
}

// ── Init utama ────────────────────────────────────────────────────────
export function initMobileUI(getState, onViewChange, onPageChange, onFilterChange) {
  _getStateFn = getState;
  injectFAB();
  injectDrawer();
  // Apply button
  document.getElementById('drawerApply').addEventListener('click', () => {
    const state = getState();
    const newView = document.querySelector('.kd-view-btn[data-dview].is-active')?.dataset.dview;
    const newPage = document.querySelector('.kd-view-btn[data-dpage].is-active')?.dataset.dpage;
    const newChan = document.querySelector('.kd-seg-btn[data-chanview].is-active')?.dataset.chanview || 'all';

    const isGeo = document.querySelector('.kd-view-btn[data-dview="geo"].is-active') !== null
      || (state.view === 'geo' && !newView && !newPage);

    const filterPayload = {
      filterCities:   getSelectedCities(),
      filterChanView: newChan,
      searchTerm:     document.getElementById('drawerSearch').value,
    };

    if (isGeo) {
      filterPayload.geoSettings = {
        showAdj:   document.getElementById('geoTogAdj')?.checked   !== false,
        showLabel: document.getElementById('geoTogLabel')?.checked  !== false,
        onlyFree:  document.getElementById('geoTogFree')?.checked   === true,
      };
    }

    // Visual feedback: flash "✓" sebelum tutup
    const applyBtn = document.getElementById('drawerApply');
    if (applyBtn) {
      const orig = applyBtn.textContent;
      applyBtn.textContent = '✓ DITERAPKAN';
      applyBtn.style.opacity = '.7';
      setTimeout(() => { applyBtn.textContent = orig; applyBtn.style.opacity = ''; }, 600);
    }

    setTimeout(() => {
      closeDrawer();
      document.getElementById('dynamicContent')?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }, 180);

    onFilterChange(filterPayload);

    if (newView && (newView !== state.view || state.page !== 'main')) {
      onViewChange(newView);
    } else if (newPage && newPage !== state.page) {
      onPageChange(newPage);
    }
  });

  // Reset button — reset UI drawer DAN state langsung via onFilterChange
  document.getElementById('drawerReset').addEventListener('click', () => {
    // Reset city chips → SEMUA
    document.querySelectorAll('.kd-city-chip').forEach(b => b.classList.remove('is-active'));
    document.querySelector('.kd-city-chip[data-city=""]')?.classList.add('is-active');

    // Reset chanview → SEMUA
    document.querySelectorAll('.kd-seg-btn[data-chanview]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.chanview === 'all'));

    // Reset search
    const searchEl = document.getElementById('drawerSearch');
    if (searchEl) searchEl.value = '';

    // Reset view mode → grid (state sekarang)
    const state = getState();
    document.querySelectorAll('.kd-view-btn').forEach(b => b.classList.remove('is-active'));
    const gridBtn = document.querySelector('.kd-view-btn[data-dview="grid"]');
    if (gridBtn) gridBtn.classList.add('is-active');

    // Reset geo toggles ke default
    const togAdj   = document.getElementById('geoTogAdj');
    const togLabel = document.getElementById('geoTogLabel');
    const togFree  = document.getElementById('geoTogFree');
    if (togAdj)   togAdj.checked   = true;
    if (togLabel) togLabel.checked = true;
    if (togFree)  togFree.checked  = false;

    // Terapkan reset ke state sekaligus
    onFilterChange({
      filterCities: [], filterChanView: 'all', searchTerm: '',
      geoSettings: { showAdj: true, showLabel: true, onlyFree: false },
    });

    // Kalau view bukan grid, reset ke grid
    if (state.view !== 'grid' || state.page !== 'main') {
      onViewChange('grid');
    }
  });

  syncDrawer(getState());
}

export { openDrawer as openFilterDrawer };
