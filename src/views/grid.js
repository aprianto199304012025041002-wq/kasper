// views/grid.js
// Grid view: tabel frekuensi per wilayah, satu baris per wilayah.
// Klik sel → detail stasiun.

import { state, filteredStations, KOMUNITAS_RADIUS } from '../state.js';
import { computeChannelMapForWilayah } from '../engine/channel.js';
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

  // Stats bar pakai channel map seluruh stasiun aktif
  const allChannels = computeChannelMapForWilayah(
    stations.filter(s => !state.wilayah || (s.wilayah_layanan || s.kota) === state.wilayah),
    state.wilayah || ''
  );
  renderStatsBar(allChannels);

  let html = '<div class="grid-wrap">';

  for (const w of wilayahList) {
    // Stasiun di wilayah ini (yang lolos filter)
    const wStations = state.wilayah
      ? stations
      : stations.filter(s => (s.wilayah_layanan || s.kota) === w);

    if (!wStations.length) continue;

    const channels  = computeChannelMapForWilayah(wStations, w);
    const expCount   = wStations.filter(s => isExpired(s)).length;
    const allotRRI   = channels.filter(c => c.allotment_status === 'allotted_rri' && c.type === 'free').length;
    const allotLPS   = channels.filter(c => c.allotment_status === 'allotted_lps' && c.type === 'free').length;

    // Filter berdasarkan chanFilter
    const visible = channels.filter(ch => {
      if (state.chanFilter === 'free')    return ch.type === 'free';
      if (state.chanFilter === 'used')    return ch.type === 'used';
      if (state.chanFilter === 'expired') return ch.type === 'used' && isExpired(ch.station);
      return true;
    });

    if (!visible.length) continue;

    html += `
      <div class="city">
        <div class="city-hdr">
          <span class="city-name">${esc(w)}</span>
          ${expCount ? `<span class="city-exp">⚠ ${expCount} habis</span>` : ''}
          ${allotRRI ? `<span class="city-allot-rri">● ${allotRRI} RRI</span>` : ''}
          ${allotLPS ? `<span class="city-allot-lps">● ${allotLPS} LPS</span>` : ''}
          <span class="city-cnt">${wStations.length} stasiun</span>
        </div>
        <div class="ch-row">`;

    for (const ch of visible) {
      html += renderCell(ch);
    }

    html += `</div></div>`;
  }

  html += '</div>';
  main.innerHTML = html;
  attachGridEvents(main);
}

function renderCell(ch) {
  const { type, station, allotment_status } = ch;
  const exp = type === 'used' && isExpired(station);

  // Class: status teknis utama
  let cls = 'ch ';
  if      (exp)                   cls += 'ch-exp';
  else if (type === 'used')       cls += 'ch-used';
  else if (type === 'adjacent_1') cls += 'ch-adj1';
  else if (type === 'adjacent_2') cls += 'ch-adj2';
  else                            cls += 'ch-free';

  // Indikator allotment (dot kecil di pojok)
  let allotDot = '';
  if (allotment_status === 'allotted_rri') allotDot = '<i class="ch-dot ch-dot-rri" title="Allotment RRI"></i>';
  else if (allotment_status === 'allotted_lps') allotDot = '<i class="ch-dot ch-dot-lps" title="Allotment LPS"></i>';

  const freqStr = ch.freq.toFixed(1);
  const nameStr = station
    ? esc(station.stn_name
        .replace(/^(RADIO |LPP RRI |LPPL |LPP |LPK |PRAMBORS |SONORA )/i, '')
        .replace(/ (FM|AM|RADIO|JOGJA|YOGYAKARTA)$/i, '')
        .slice(0, 12))
    : '';

  const allotLabel = allotment_status === 'allotted_rri' ? ' [RRI]'
                   : allotment_status === 'allotted_lps' ? ' [LPS]' : '';
  const ttText = station
    ? `${freqStr} MHz — ${station.stn_name}${exp ? ' [HABIS]' : ''}${allotLabel}`
    : allotment_status === 'allotted_rri' ? `${freqStr} MHz — kosong (allotment RRI)`
    : allotment_status === 'allotted_lps' ? `${freqStr} MHz — kosong (allotment LPS)`
    : `${freqStr} MHz — kosong`;

  const dataAttr = station ? `data-freq="${ch.freq}"` : '';

  return `
    <div class="${cls}" ${dataAttr} data-tt="${esc(ttText)}">
      ${allotDot}
      <b>${freqStr}</b>
      ${nameStr ? `<span>${nameStr}</span>` : ''}
    </div>`;

  return `
    <div class="${cls}" ${dataAttr} data-tt="${esc(ttText)}">
      <b>${freqStr}</b>
      ${nameStr ? `<span>${nameStr}</span>` : ''}
    </div>`;
}

function attachGridEvents(main) {
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
    if (cell && tt) {
      tt.textContent = cell.dataset.tt;
      tt.classList.add('show');
    }
  });
  main.addEventListener('mouseleave', () => tt?.classList.remove('show'));
  main.addEventListener('mousemove', e => {
    if (tt?.classList.contains('show')) {
      tt.style.left = (e.clientX + 12) + 'px';
      tt.style.top  = (e.clientY + 12) + 'px';
    }
  });
}
