// state.js — single source of truth untuk seluruh app
// Semua komponen baca dan tulis lewat sini, tidak ada state lokal di komponen.

export const state = {
  // Data dari API
  data:      null,   // { stations: [], summary: {}, total: n }
  interfData: null,  // hasil computeInterference()

  // Navigasi
  view:     'grid',  // 'grid' | 'band' | 'geo' | 'rf'
  wilayah:  '',      // '' = semua wilayah

  // Filter
  search:     '',
  chanFilter: 'all', // 'all' | 'free' | 'used' | 'expired'

  // Geo settings
  geo: { showAdj: true, showLabel: true, onlyFree: false },

  // UI
  theme: localStorage.getItem('kasper-theme') || 'light',
};

/** Konstanta wilayah komunitas — dikecualikan dari daftar wilayah normal */
export const KOMUNITAS_RADIUS = '2,5 KILOMETER DARI LOKASI ANTENA PEMANCAR';

/** Ambil daftar wilayah unik dari data, dikelompokkan per provinsi */
export function getWilayahByProv() {
  const stations = state.data?.stations || [];
  const allWilayah = [...new Set(
    stations
      .map(s => s.wilayah_layanan || s.kota || '')
      .filter(w => w && w !== KOMUNITAS_RADIUS)
  )].sort();

  const diy    = [];
  const jateng = [];

  for (const w of allWilayah) {
    const s = stations.find(st => (st.wilayah_layanan || st.kota) === w);
    if (s?.province?.includes('YOGYAKARTA')) diy.push(w);
    else jateng.push(w);
  }

  return { diy, jateng, all: allWilayah };
}

/** Stasiun yang aktif setelah filter wilayah + search + chanFilter */
export function filteredStations() {
  let st = state.data?.stations || [];

  if (state.wilayah)
    st = st.filter(s => (s.wilayah_layanan || s.kota) === state.wilayah);

  if (state.search) {
    const q = state.search.toLowerCase();
    st = st.filter(s =>
      (s.stn_name  || '').toLowerCase().includes(q) ||
      (s.clnt_name || '').toLowerCase().includes(q) ||
      String(s.freq).includes(q) ||
      (s.wilayah_layanan || s.kota || '').toLowerCase().includes(q) ||
      (s.no_simf || '').toLowerCase().includes(q)
    );
  }

  return st;
}
