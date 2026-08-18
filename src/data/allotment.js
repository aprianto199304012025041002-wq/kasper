// Allotment kanal FM berdasarkan KM Komdigi No. 570 Tahun 2025
// Cakupan: DIY (34) + Jawa Tengah (33)
// Kanal -> frekuensi: freq = 87.5 + (ch * 0.1)

const ch2f = ch => Math.round((87.5 + ch * 0.1) * 10) / 10;

const ALLOTMENT = {

  // ══════════════════════════════════════════════
  // DAERAH ISTIMEWA YOGYAKARTA (kode 34)
  // ══════════════════════════════════════════════

  // 34-001
  'WATES, SENTOLO': {
    kode: '34-001', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E09 36', lat: '07S49 43' },
    rri: [].map(ch2f),
    lps: [63, 130, 197].map(ch2f),
  },
  // 34-002
  'BANTUL, BANGUNTAPAN': {
    kode: '34-002', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E22 07', lat: '07S52 02' },
    rri: [194].map(ch2f),
    lps: [20, 67, 127].map(ch2f),
  },
  // 34-003
  'WONOSARI': {
    kode: '34-003', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E35 34', lat: '07S58 12' },
    rri: [].map(ch2f),
    lps: [24, 57, 124].map(ch2f),
  },
  // 34-004
  'PATUK': {
    kode: '34-004', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E31 53', lat: '07S50 34' },
    rri: [191].map(ch2f),
    lps: [111].map(ch2f),
  },
  // 34-005
  'GAMPING': {
    kode: '34-005', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E20 19', lat: '07S47 01' },
    rri: [].map(ch2f),
    lps: [16, 44].map(ch2f),
  },
  // 34-006
  'DEPOK': {
    kode: '34-006', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E24 52', lat: '07S46 07' },
    rri: [].map(ch2f),
    lps: [8, 28, 75, 95, 142, 162, 178].map(ch2f),
  },
  // 34-007
  'SLEMAN, NGAGLIK, KALASAN, NGEMPLAK, PAKEM': {
    kode: '34-007', provinsi: 'DIY', kelas: 'C',
    koordinat: { lng: '110E25 16', lat: '07S41 51' },
    rri: [150].map(ch2f),
    lps: [7, 32, 48, 83, 99, 115, 166, 182].map(ch2f),
  },
  // 34-008 (Kota Yogyakarta — Kelas B)
  'KOTA YOGYAKARTA': {
    kode: '34-008', provinsi: 'DIY', kelas: 'B',
    koordinat: { lng: '110E23 13', lat: '07S46 59' },
    rri: [36, 60, 154].map(ch2f),
    lps: [4, 12, 52, 71, 79, 87, 103, 119, 138, 146, 170, 186].map(ch2f),
  },

  // ══════════════════════════════════════════════
  // JAWA TENGAH (kode 33)
  // ══════════════════════════════════════════════

  // 33-001
  'GANDRUNGMANGU': {
    kode: '33-001', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E00 34', lat: '07S31 07' },
    rri: [12].map(ch2f),
    lps: [119].map(ch2f),
  },
  // 33-002
  'MAJENANG': {
    kode: '33-002', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '108E45 47', lat: '07S17 55' },
    rri: [134].map(ch2f),
    lps: [67].map(ch2f),
  },
  // 33-003
  'CILACAP': {
    kode: '33-003', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E00 34', lat: '07S43 40' },
    rri: [].map(ch2f),
    lps: [1, 33, 52, 68, 84, 100, 135, 151, 167].map(ch2f),
  },
  // 33-004
  'WANGON, JATILAWANG, PURWOJATI': {
    kode: '33-004', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E03 17', lat: '07S31 07' },
    rri: [96].map(ch2f),
    lps: [29, 163, 186].map(ch2f),
  },
  // 33-005
  'SOKARAJA, KALIBAGOR': {
    kode: '33-005', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E17 56', lat: '07S29 15' },
    rri: [17, 111].map(ch2f),
    lps: [40, 44, 48, 178].map(ch2f),
  },
  // 33-006
  'PURWOKERTO, PATIK, RAJA, KARANG LEWAS': {
    kode: '33-006', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E13 38', lat: '07S24 29' },
    rri: [56, 115, 198].map(ch2f),
    lps: [64, 107, 123, 131, 160, 182, 190].map(ch2f),
  },
  // 33-007
  'PURBALINGGA': {
    kode: '33-007', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E21 48', lat: '07S23 21' },
    rri: [147, 155].map(ch2f),
    lps: [5, 13, 21, 72, 80, 88, 139].map(ch2f),
  },
  // 33-008
  'BANJARNEGARA, BANJARMANGU, MADUKARA': {
    kode: '33-008', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E41 42', lat: '07S22 46' },
    rri: [161].map(ch2f),
    lps: [27, 35, 94, 102, 169].map(ch2f),
  },
  // 33-009
  'KALIBENING, PUNGGELAN': {
    kode: '33-009', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E38 11', lat: '07S13 14' },
    rri: [134].map(ch2f),
    lps: [67].map(ch2f),
  },
  // 33-010
  'WANAYASA, PEJAWARAN, PAGETAN, KARANG KOBAR': {
    kode: '33-010', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E46 24', lat: '07S16 05' },
    rri: [193].map(ch2f),
    lps: [59, 126].map(ch2f),
  },
  // 33-011
  'KARANGANYAR, GOMBONG, SEMPOR': {
    kode: '33-011', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E30 23', lat: '07S36 27' },
    rri: [31].map(ch2f),
    lps: [98, 165].map(ch2f),
  },
  // 33-012
  'KEBUMEN, ALIAN, KALIBONG': {
    kode: '33-012', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E39 39', lat: '07S40 16' },
    rri: [153].map(ch2f),
    lps: [8, 24, 75, 91, 142, 158].map(ch2f),
  },
  // 33-013
  'AMBAL, KUTOWINANGUN, MIRIT': {
    kode: '33-013', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E43 09', lat: '07S47 09' },
    rri: [176].map(ch2f),
    lps: [42, 109].map(ch2f),
  },
  // 33-014
  'KARANGANYAR, SADANG': {
    kode: '33-014', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E39 00', lat: '07S33 21' },
    rri: [].map(ch2f),
    lps: [19, 86].map(ch2f),
  },
  // 33-015
  'KUTOARJO, BAYAN': {
    kode: '33-015', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E56 11', lat: '07S44 02' },
    rri: [152].map(ch2f),
    lps: [10, 77, 144].map(ch2f),
  },
  // 33-016
  'PURWOREJO, BANYUURIP': {
    kode: '33-016', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E01 13', lat: '07S44 09' },
    rri: [].map(ch2f),
    lps: [59, 126, 193].map(ch2f),
  },
  // 33-017
  'BRUNO, KEMIRI, PITURUH': {
    kode: '33-017', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E55 16', lat: '07S37 22' },
    rri: [18].map(ch2f),
    lps: [85].map(ch2f),
  },
  // 33-018
  'KALIWIRO, WADASLINTANG': {
    kode: '33-018', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E49 31', lat: '07S29 51' },
    rri: [184].map(ch2f),
    lps: [50, 117].map(ch2f),
  },
  // 33-019
  'SAPURAN': {
    kode: '33-019', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E58 44', lat: '07S27 27' },
    rri: [].map(ch2f),
    lps: [62, 129].map(ch2f),
  },
  // 33-020
  'WONOSOBO, LEKSONO': {
    kode: '33-020', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E54 35', lat: '07S22 14' },
    rri: [].map(ch2f),
    lps: [38, 46, 105, 113, 180].map(ch2f),
  },
  // 33-021
  'KALIKAJAR, KERTEK': {
    kode: '33-021', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E59 50', lat: '07S19 20' },
    rri: [172].map(ch2f),
    lps: [].map(ch2f),
  },
  // 33-022
  'MUNGKID, MUNTILAN, SALAM': {
    kode: '33-022', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E17 54', lat: '07S35 24' },
    rri: [].map(ch2f),
    lps: [40, 107, 174].map(ch2f),
  },
  // 33-023
  'BOYOLALI': {
    kode: '33-023', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E36 05', lat: '07S31 56' },
    rri: [165].map(ch2f),
    lps: [61, 128, 195].map(ch2f),
  },
  // 33-024
  'KLATEN': {
    kode: '33-024', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E36 05', lat: '07S42 19' },
    rri: [3].map(ch2f),
    lps: [24, 41, 91, 158].map(ch2f),
  },
  // 33-025
  'SUKOHARJO, GROGOL': {
    kode: '33-025', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E50 34', lat: '07S40 57' },
    rri: [].map(ch2f),
    lps: [34, 117, 144, 168].map(ch2f),
  },
  // 33-026
  'EROMOKO, PRACIMANTORO': {
    kode: '33-026', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E49 14', lat: '08S01 50' },
    rri: [152].map(ch2f),
    lps: [10].map(ch2f),
  },
  // 33-027
  'GIRIWOYO, BATURETNO': {
    kode: '33-027', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E56 29', lat: '07S59 05' },
    rri: [152].map(ch2f),
    lps: [18].map(ch2f),
  },
  // 33-028
  'TIRTOMOYO, BATUWARNO, KARANG TENGAH': {
    kode: '33-028', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E04 53', lat: '07S59 40' },
    rri: [175].map(ch2f),
    lps: [85, 108].map(ch2f),
  },
  // 33-029
  'NGADIROJO, NGUNTORONADI': {
    kode: '33-029', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E58 01', lat: '07S52 10' },
    rri: [57].map(ch2f),
    lps: [124, 191].map(ch2f),
  },
  // 33-030
  'WONOGIRI': {
    kode: '33-030', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E55 24', lat: '07S48 57' },
    rri: [].map(ch2f),
    lps: [65, 132].map(ch2f),
  },
  // 33-031
  'JATISRONO, JATIPURNO, GIRIMARTO': {
    kode: '33-031', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E08 06', lat: '07S47 47' },
    rri: [93].map(ch2f),
    lps: [26, 160].map(ch2f),
  },
  // 33-032
  'JUMANTONO, JUMAPOLO': {
    kode: '33-032', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E59 07', lat: '07S40 52' },
    rri: [1].map(ch2f),
    lps: [68].map(ch2f),
  },
  // 33-033
  'KARANGPANDAN': {
    kode: '33-033', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E04 26', lat: '07S36 53' },
    rri: [].map(ch2f),
    lps: [198].map(ch2f),
  },
  // 33-034
  'KARANGANYAR': {
    kode: '33-034', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E54 60', lat: '07S32 55' },
    rri: [135, 184].map(ch2f),
    lps: [21, 88, 155].map(ch2f),
  },
  // 33-035
  'SRAGEN': {
    kode: '33-035', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E03 09', lat: '07S28 00' },
    rri: [].map(ch2f),
    lps: [5, 13, 72, 80, 147].map(ch2f),
  },
  // 33-036
  'PURWODADI': {
    kode: '33-036', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E55 48', lat: '07S03 52' },
    rri: [143].map(ch2f),
    lps: [9, 40, 76, 107].map(ch2f),
  },
  // 33-037
  'WIROSARI, NGARINGAN': {
    kode: '33-037', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E08 44', lat: '07S05 04' },
    rri: [167].map(ch2f),
    lps: [100].map(ch2f),
  },
  // 33-038
  'KEDUNGTUBAN, CEPU': {
    kode: '33-038', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E32 56', lat: '07S09 29' },
    rri: [179].map(ch2f),
    lps: [45, 112].map(ch2f),
  },
  // 33-039
  'BLORA': {
    kode: '33-039', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E28 32', lat: '06S58 39' },
    rri: [58, 125].map(ch2f),
    lps: [50, 66, 117, 133, 184, 192].map(ch2f),
  },
  // 33-040
  'KRAGAN, SEDAN, SARANG': {
    kode: '33-040', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E35 38', lat: '06S44 08' },
    rri: [102].map(ch2f),
    lps: [169].map(ch2f),
  },
  // 33-041
  'PANCUR, LASEM, PAMOTAN': {
    kode: '33-041', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E28 34', lat: '06S43 45' },
    rri: [30].map(ch2f),
    lps: [97, 164].map(ch2f),
  },
  // 33-042
  'REMBANG': {
    kode: '33-042', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E20 56', lat: '06S42 21' },
    rri: [42, 93].map(ch2f),
    lps: [10, 26, 77, 109, 146, 160, 176].map(ch2f),
  },
  // 33-043
  'PATI': {
    kode: '33-043', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E59 23', lat: '06S43 07' },
    rri: [].map(ch2f),
    lps: [1, 17, 33, 68, 84, 135, 151].map(ch2f),
  },
  // 33-044
  'BATANGAN, JUWANA, JAKENAN': {
    kode: '33-044', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '111E09 34', lat: '06S43 46' },
    rri: [].map(ch2f),
    lps: [88, 155].map(ch2f),
  },
  // 33-045
  'GUNUNGWUNGKAL, CLUWAK, TAYU': {
    kode: '33-045', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E59 20', lat: '06S33 58' },
    rri: [147].map(ch2f),
    lps: [80].map(ch2f),
  },
  // 33-046
  'KUDUS': {
    kode: '33-046', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E52 17', lat: '06S44 59' },
    rri: [21].map(ch2f),
    lps: [5, 62, 129, 196].map(ch2f),
  },
  // 33-047
  'JEPARA': {
    kode: '33-047', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E43 25', lat: '06S36 42' },
    rri: [165].map(ch2f),
    lps: [67, 98, 134].map(ch2f),
  },
  // 33-048
  'BANGSRI, KELING': {
    kode: '33-048', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E51 40', lat: '06S31 10' },
    rri: [13].map(ch2f),
    lps: [72, 139].map(ch2f),
  },
  // 33-049
  'KARIMUN JAWA': {
    kode: '33-049', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E25 58', lat: '05S52 48' },
    rri: [].map(ch2f),
    lps: [].map(ch2f),
  },
  // 33-050
  'DEMAK': {
    kode: '33-050', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E38 19', lat: '06S53 41' },
    rri: [3].map(ch2f),
    lps: [70, 173].map(ch2f),
  },
  // 33-051
  'AMBARAWA, BANDUNGAN': {
    kode: '33-051', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E22 47', lat: '07S14 46' },
    rri: [].map(ch2f),
    lps: [30].map(ch2f),
  },
  // 33-052
  'UNGARAN': {
    kode: '33-052', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E24 33', lat: '07S08 06' },
    rri: [].map(ch2f),
    lps: [181, 198].map(ch2f),
  },
  // 33-053
  'TEMANGGUNG': {
    kode: '33-053', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E11 20', lat: '07S18 42' },
    rri: [89].map(ch2f),
    lps: [6, 22, 73, 140, 156].map(ch2f),
  },
  // 33-054
  'KENDAL, WELERI': {
    kode: '33-054', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E09 25', lat: '06S58 24' },
    rri: [].map(ch2f),
    lps: [55, 64, 122, 189, 198].map(ch2f),
  },
  // 33-055
  'WONOTUNGGAL, BANDAR': {
    kode: '33-055', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E48 37', lat: '07S00 48' },
    rri: [167].map(ch2f),
    lps: [33, 100].map(ch2f),
  },
  // 33-056
  'BLADO, REBAN, BAWANG': {
    kode: '33-056', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E52 20', lat: '07S04 51' },
    rri: [].map(ch2f),
    lps: [40, 107].map(ch2f),
  },
  // 33-057
  'BATANG': {
    kode: '33-057', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E43 49', lat: '06S54 28' },
    rri: [53].map(ch2f),
    lps: [174, 187].map(ch2f),
  },
  // 33-058
  'BANYUPUTH, LIMPUNG': {
    kode: '33-058', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E55 46', lat: '06S57 58' },
    rri: [].map(ch2f),
    lps: [120].map(ch2f),
  },
  // 33-059
  'DORO, LEBAKBARANG, TALUN, PETUNGKRIYONO, KARANGDADAP': {
    kode: '33-059', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E43 08', lat: '07S03 30' },
    rri: [143].map(ch2f),
    lps: [76].map(ch2f),
  },
  // 33-060
  'KAJEN, KEDUNGWUNI': {
    kode: '33-060', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E36 55', lat: '07S00 09' },
    rri: [22].map(ch2f),
    lps: [89, 156].map(ch2f),
  },
  // 33-061
  'WIRADESA': {
    kode: '33-061', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E37 23', lat: '06S53 30' },
    rri: [148].map(ch2f),
    lps: [14, 81].map(ch2f),
  },
  // 33-062
  'RANDUDONGKAL, BELIK': {
    kode: '33-062', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E15 44', lat: '07S06 60' },
    rri: [128].map(ch2f),
    lps: [61].map(ch2f),
  },
  // 33-063
  'PEMALANG': {
    kode: '33-063', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E22 46', lat: '06S55 38' },
    rri: [].map(ch2f),
    lps: [2, 18, 69, 85, 136, 152].map(ch2f),
  },
  // 33-064
  'BUMIJAWA, BOJONG': {
    kode: '33-064', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E08 50', lat: '07S09 48' },
    rri: [35].map(ch2f),
    lps: [6, 51].map(ch2f),
  },
  // 33-065
  'SLAWI': {
    kode: '33-065', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E08 11', lat: '06S58 59' },
    rri: [].map(ch2f),
    lps: [102, 118, 169].map(ch2f),
  },
  // 33-066
  'SURADADI, TARUB': {
    kode: '33-066', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E13 59', lat: '06S54 05' },
    rri: [73].map(ch2f),
    lps: [140, 185].map(ch2f),
  },
  // 33-067
  'BANTARKAWUNG': {
    kode: '33-067', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '108E52 38', lat: '07S10 52' },
    rri: [127].map(ch2f),
    lps: [60, 76, 143, 194].map(ch2f),
  },
  // 33-068
  'BUMIAYU, PAGUYANGAN': {
    kode: '33-068', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E01 56', lat: '07S16 04' },
    rri: [9].map(ch2f),
    lps: [].map(ch2f),
  },
  // 33-069
  'BREBES': {
    kode: '33-069', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E02 27', lat: '06S53 06' },
    rri: [102].map(ch2f),
    lps: [30, 46, 97, 155, 164, 169].map(ch2f),
  },
  // 33-070
  'BANJARHAREJO, KETANGGUNGAN': {
    kode: '33-070', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '108E52 11', lat: '06S57 42' },
    rri: [].map(ch2f),
    lps: [5, 13, 72, 80, 147].map(ch2f),
  },
  // 33-071
  'KOTA MAGELANG': {
    kode: '33-071', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E14 14', lat: '07S28 56' },
    rri: [].map(ch2f),
    lps: [1, 26, 55, 68, 84, 95, 101, 109, 160, 176].map(ch2f),
  },
  // 33-072
  'KOTA SURAKARTA': {
    kode: '33-072', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E48 01', lat: '07S32 49' },
    rri: [77, 180].map(ch2f),
    lps: [26, 34, 46, 50, 54, 95, 101, 105, 113, 150, 160, 172].map(ch2f),
  },
  // 33-073
  'KOTA SALATIGA': {
    kode: '33-073', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '110E28 21', lat: '07S20 01' },
    rri: [64].map(ch2f),
    lps: [57, 97, 124].map(ch2f),
  },
  // 33-074 (Kota Semarang — Kelas B)
  'KOTA SEMARANG': {
    kode: '33-074', provinsi: 'Jawa Tengah', kelas: 'B',
    koordinat: { lng: '110E25 28', lat: '06S58 09' },
    rri: [7, 15, 47, 78, 131].map(ch2f),
    lps: [3, 11, 19, 23, 27, 35, 43, 51, 59, 70, 74, 82, 86, 90, 94, 102, 110, 114, 118, 126, 137, 141, 145, 149, 153, 157, 161, 165, 177, 185, 193].map(ch2f),
  },
  // 33-075
  'KOTA PEKALONGAN': {
    kode: '33-075', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E40 29', lat: '06S52 44' },
    rri: [41, 92].map(ch2f),
    lps: [9, 37, 96, 104, 163, 171].map(ch2f),
  },
  // 33-076
  'KOTA TEGAL': {
    kode: '33-076', provinsi: 'Jawa Tengah', kelas: 'C',
    koordinat: { lng: '109E09 19', lat: '06S52 03' },
    rri: [].map(ch2f),
    lps: [25, 57, 65, 108, 124, 132, 159, 175, 191].map(ch2f),
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
