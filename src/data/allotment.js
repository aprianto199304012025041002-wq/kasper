// Allotment kanal FM DIY berdasarkan KM Komdigi No. 570 Tahun 2025
// Kanal -> frekuensi: freq = 87.5 + (ch * 0.1)
// Kolom: kanal untuk LPP RRI | kanal untuk LPP Lokal + LPS (swasta/komunitas)

const ch2f = ch => Math.round((87.5 + ch * 0.1) * 10) / 10;

const ALLOTMENT = {
  // 34-008
  'KOTA YOGYAKARTA': {
    kode: '34-008',
    kelas: 'B',
    koordinat: { lng: '110E23 13', lat: '07S46 59' },
    rri:  [36, 60, 154].map(ch2f),         // 95.1, 97.5, 102.9
    lps:  [4, 12, 52, 71, 79, 87, 103, 119, 138, 146, 170, 186].map(ch2f),
  },
  // 34-002
  'BANTUL, BANGUNTAPAN': {
    kode: '34-002',
    kelas: 'C',
    koordinat: { lng: '110E22 07', lat: '07S52 02' },
    rri:  [194].map(ch2f),                 // 106.9
    lps:  [20, 67, 127].map(ch2f),
  },
  // 34-003
  'WONOSARI': {
    kode: '34-003',
    kelas: 'C',
    koordinat: { lng: '110E35 34', lat: '07S58 12' },
    rri:  [],
    lps:  [24, 57, 124].map(ch2f),
  },
  // 34-004
  'PATUK': {
    kode: '34-004',
    kelas: 'C',
    koordinat: { lng: '110E31 53', lat: '07S50 34' },
    rri:  [191].map(ch2f),                 // 106.6
    lps:  [111].map(ch2f),
  },
  // 34-001
  'WATES, SENTOLO': {
    kode: '34-001',
    kelas: 'C',
    koordinat: { lng: '110E09 36', lat: '07S49 43' },
    rri:  [],
    lps:  [63, 130, 197].map(ch2f),
  },
  // 34-005
  'GAMPING': {
    kode: '34-005',
    kelas: 'C',
    koordinat: { lng: '110E20 19', lat: '07S47 01' },
    rri:  [],
    lps:  [16, 44].map(ch2f),
  },
  // 34-006
  'DEPOK': {
    kode: '34-006',
    kelas: 'C',
    koordinat: { lng: '110E24 52', lat: '07S46 07' },
    rri:  [],
    lps:  [8, 28, 75, 95, 142, 162, 178].map(ch2f),
  },
  // 34-007
  'SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM': {
    kode: '34-007',
    kelas: 'C',
    koordinat: { lng: '110E25 16', lat: '07S41 51' },
    rri:  [150].map(ch2f),                 // 102.5
    lps:  [7, 32, 48, 83, 99, 115, 166, 182].map(ch2f),
  },
};

// Lookup: frekuensi -> { wilayah, slot: 'rri'|'lps'|null }
function getAllotmentByFreq(wilayah, freq) {
  const a = ALLOTMENT[wilayah];
  if (!a) return null;
  const f = Math.round(freq * 10) / 10;
  if (a.rri.includes(f)) return { ...a, slot: 'rri' };
  if (a.lps.includes(f)) return { ...a, slot: 'lps' };
  return null;
}

// Semua frekuensi yang dijatahkan untuk wilayah tertentu
function getAllottedFreqs(wilayah) {
  const a = ALLOTMENT[wilayah];
  if (!a) return [];
  return [...a.rri, ...a.lps];
}

export { ALLOTMENT, getAllotmentByFreq, getAllottedFreqs, ch2f };
