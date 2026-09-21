// views/grid.js
// Grid view: satu row per wilayah, 206 cell (full band 87.5–108 MHz).
// Scroll horizontal sinkron antar wilayah — bisa lihat korelasi frekuensi.

import { state, filteredStations, KOMUNITAS_RADIUS } from '../state.js';
import { computeChannelMapForWilayah, buildChannelGrid } from '../engine/channel.js';
import { renderStatsBar } from '../components/statsbar.js';
import { isExpired, esc } from '../utils.js';

let _onDetail = null;

export function renderGrid(onDetail) {
  if (onDetail) _onDetail = onDetail;

  const main = document.getElementById('main');
  if (!main) return;

  const stations = filteredStations();

  // Tentukan daftar wilayah yang akan ditampilkan
  let wilayahList;
  if (state.wilayah) {
    wilayahList = [state.wilayah];
  } else {
    wilayahList = [...new Set(
      stations
        .map(s => s.wilayah_layanan || s.kota || '')
        .filter(w => w && w !== KOMUNITAS_RADIUS)
    )].sort();
  }

  if (!wilayahList.length) {
    main.innerHTML = `<div class="empty">Tidak ada hasil yang cocok dengan filter aktif.</div>`;
    renderStatsBar(null);
    return;
  }

  // Stats bar
  const allChannels = computeChannelMapForWilayah(
    stations.filter(s => !state.wilayah || (s.wilayah_layanan || s.kota) === state.wilayah),
    state.wilayah || ''
  );
  renderStatsBar(allChannels);

  // Header frekuensi (ruler) — satu baris di atas semua wilayah
  const freqGrid = buildChannelGrid();

  let html = '<div class="grid-wrap">';

  // Ruler frekuensi
  html += '<div class="grid-table"><div class="grid-ruler-row"><div class="grid-label-col"></div><div class="grid-scroll-body" id="grid-ruler">';
  for (const f of freqGrid) {
    // Tampilkan label hanya setiap 1 MHz (setiap 10 channel)
    const label = Number.isInteger(Math.round(f * 10) / 10) && (Math.round(f * 10) % 10 === 0)
      ? f.toFixed(0)
      : '';
    html += `<div class="ch-ruler">${label}</div>`;
  }
  html += '</div></div>';

  // Satu row per wilayah
  for (const w of wilayahList) {
    const wStations = state.wilayah
      ? stations
      : stations.filter(s => (s.wilayah_layanan || s.kota) === w);

    if (!wStations.length) continue;

    const channels = computeChannelMapForWilayah(wStations, w);
    const expCount  = wStations.filter(s => isExpired(s)).length;
    const allotRRI  = channels.filter(c => c.allotment_status === 'allotted_rri' && c.type === 'free').length;
    const allotLPS  = channels.filter(c => c.allotment_status === 'allotted_lps' && c.type === 'free').length;

    // Untuk filter chanFilter: sembunyikan row jika tidak ada cell visible
    const hasVisible = channels.some(ch => {
      if (state.chanFilter === 'free')    return ch.type === 'free';
      if (state.chanFilter === 'used')    return ch.type === 'used';
      if (state.chanFilter === 'expired') return ch.type === 'used' && isExpired(ch.station);
      return true;
    });
    if (!hasVisible) continue;

    html += `
      <div class="grid-row">
        <div class="grid-label-col">
          <div class="city-name">${esc(w)}</div>
          <div class="city-meta">
            ${expCount ? `<span class="city-exp" title="${expCount} izin habis">⚠${expCount}</span>` : ''}
            ${allotRRI  ? `<span class="city-allot-rri" title="${allotRRI} slot allotment RRI kosong">R${allotRRI}</span>` : ''}
            ${allotLPS  ? `<span class="city-allot-lps" title="${allotLPS} slot allotment LPS kosong">L${allotLPS}</span>` : ''}
            <span class="city-cnt" title="${wStations.length} stasiun aktif">${wStations.length}st</span>
          </div>
        </div>
        <div class="grid-scroll-body">`;

    for (const ch of channels) {
      html += renderCell(ch);
    }

    html += `</div></div>`;
  }

  html += '</div></div>';
  main.innerHTML = html;
  attachGridEvents(main);
}

function renderCell(ch) {
  const { type, station, allotment_status } = ch;
  const exp = type === 'used' && isExpired(station);

  let cls = 'ch ';
  if      (exp)                   cls += 'ch-exp';
  else if (type === 'used')       cls += 'ch-used';
  else if (type === 'adjacent_1') cls += 'ch-adj1';
  else if (type === 'adjacent_2') cls += 'ch-adj2';
  else                            cls += 'ch-free';

  // Dim cell yang tidak lolos chanFilter
  if (state.chanFilter === 'free'    && type !== 'free')                          cls += ' ch-dim';
  if (state.chanFilter === 'used'    && type !== 'used')                          cls += ' ch-dim';
  if (state.chanFilter === 'expired' && !(type === 'used' && isExpired(station))) cls += ' ch-dim';

  let allotDot = '';
  if (allotment_status === 'allotted_rri') allotDot = '<i class="ch-dot ch-dot-rri"></i>';
  else if (allotment_status === 'allotted_lps') allotDot = '<i class="ch-dot ch-dot-lps"></i>';

  const freqStr = ch.freq.toFixed(1);
  const nameStr = station
    ? esc(station.stn_name
        .replace(/^(RADIO |LPP RRI |LPPL |LPP |LPK |PRAMBORS |SONORA )/i, '')
        .replace(/ (FM|AM|RADIO|JOGJA|YOGYAKARTA)$/i, '')
        .slice(0, 10))
    : '';

  const allotLabel = allotment_status === 'allotted_rri' ? ' [RRI]'
                   : allotment_status === 'allotted_lps' ? ' [LPS]' : '';
  const ttText = station
    ? `${freqStr} MHz — ${station.stn_name}${exp ? ' [HABIS]' : ''}${allotLabel}`
    : allotment_status === 'allotted_rri' ? `${freqStr} MHz — kosong (allotment RRI)`
    : allotment_status === 'allotted_lps' ? `${freqStr} MHz — kosong (allotment LPS)`
    : `${freqStr} MHz — kosong`;

  const dataAttr = station ? `data-freq="${ch.freq}"` : '';

  return `<div class="${cls}" ${dataAttr} data-tt="${esc(ttText)}">${allotDot}<b>${freqStr}</b>${nameStr ? `<span class="ch-name">${nameStr}</span>` : ''}</div>`;
}

function attachGridEvents(main) {
  // Scroll sinkron: semua .grid-scroll-body ikut scroll bersama
  const bodies = main.querySelectorAll('.grid-scroll-body');
  let _syncing = false;
  bodies.forEach(el => {
    el.addEventListener('scroll', () => {
      if (_syncing) return;
      _syncing = true;
      bodies.forEach(other => { if (other !== el) other.scrollLeft = el.scrollLeft; });
      _syncing = false;
    }, { passive: true });
  });

  // Klik detail
  main.onclick = e => {
    const cell = e.target.closest('.ch[data-freq]');
    if (!cell || !_onDetail) return;
    _onDetail(parseFloat(cell.dataset.freq));
  };

  // Tooltip hover
  const tt = document.getElementById('tooltip');
  main.addEventListener('mouseover', e => {
    const cell = e.target.closest('.ch[data-tt]');
    if (cell && tt) { tt.textContent = cell.dataset.tt; tt.classList.add('show'); }
  });
  main.addEventListener('mouseleave', () => tt?.classList.remove('show'));
  main.addEventListener('mousemove', e => {
    if (tt?.classList.contains('show')) {
      tt.style.left = (e.clientX + 12) + 'px';
      tt.style.top  = (e.clientY + 12) + 'px';
    }
  });
}
