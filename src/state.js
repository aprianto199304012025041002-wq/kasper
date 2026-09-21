// state.js — single source of truth untuk seluruh app
// Semua komponen baca dan tulis lewat sini, tidak ada state lokal di komponen.

export const state = {
  // Data dari API
  data:      null,   // { stations: [], summary: {}, total: n }
  interfData: null,  // hasil computeInterference()

  // Navigasi
  view:     'grid',  // 'grid' | 'band' | 'geo' | 'rf'
  wilayah:  [],      // [] = semua wilayah; array string wilayah yang dipilih

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

/**
 * Setelah data dimuat, resolve stasiun komunitas ke wilayah terdefinisi terdekat
 * berdasarkan jarak Haversine ke centroid tiap wilayah.
 * Hasilnya disimpan di s._wilayah_resolved — tidak ubah data asli.
 */
export function resolveKomunitasWilayah() {
  const stations = state.data?.stations || [];

  // Hitung centroid per wilayah dari rata-rata lat/lon stasiunnya
  const centroids = {};
  for (const s of stations) {
    const w = s.wilayah_layanan || s.kota || '';
    if (!w || w === KOMUNITAS_RADIUS) continue;
    if (!s.latitude || !s.longitude) continue;
    if (!centroids[w]) centroids[w] = { sumLat: 0, sumLon: 0, n: 0 };
    centroids[w].sumLat += parseFloat(s.latitude);
    centroids[w].sumLon += parseFloat(s.longitude);
    centroids[w].n++;
  }
  const wilayahList = Object.keys(centroids);

  // Untuk setiap stasiun komunitas, cari wilayah terdekat
  for (const s of stations) {
    const w = s.wilayah_layanan || s.kota || '';
    if (w !== KOMUNITAS_RADIUS) continue;
    if (!s.latitude || !s.longitude) continue;

    const lat = parseFloat(s.latitude);
    const lon = parseFloat(s.longitude);
    let minDist = Infinity, nearest = null;

    for (const wName of wilayahList) {
      const c = centroids[wName];
      const dlat = lat - c.sumLat / c.n;
      const dlon = lon - c.sumLon / c.n;
      const dist = dlat * dlat + dlon * dlon; // Euclidean cukup untuk jarak kecil
      if (dist < minDist) { minDist = dist; nearest = wName; }
    }

    if (nearest) s._wilayah_resolved = nearest;
  }
}

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

/** Helper: ambil wilayah efektif stasiun (resolved untuk komunitas) */
export function wilayahOf(s) {
  if ((s.wilayah_layanan || s.kota) === KOMUNITAS_RADIUS)
    return s._wilayah_resolved || KOMUNITAS_RADIUS;
  return s.wilayah_layanan || s.kota || '';
}

/** Stasiun yang aktif setelah filter wilayah + search + chanFilter */
export function filteredStations() {
  let st = state.data?.stations || [];

  // Komunitas tanpa resolved → exclude dari "Semua Wilayah"
  if (!state.wilayah.length)
    st = st.filter(s => wilayahOf(s) !== KOMUNITAS_RADIUS);

  if (state.wilayah.length)
    st = st.filter(s => state.wilayah.includes(wilayahOf(s)));

  if (state.search) {
    const q = state.search.toLowerCase();
    st = st.filter(s =>
      (s.stn_name  || '').toLowerCase().includes(q) ||
      (s.clnt_name || '').toLowerCase().includes(q) ||
      String(s.freq).includes(q) ||
      wilayahOf(s).toLowerCase().includes(q) ||
      (s.no_simf || '').toLowerCase().includes(q)
    );
  }

  return st;
}
