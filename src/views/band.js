// views/band.js
// Pita view: visualisasi band FM 87.5–108 MHz sebagai bar horizontal per wilayah.
// Tiap kanal → segmen berwarna sesuai statusnya.

import { state, filteredStations, KOMUNITAS_RADIUS } from '../state.js';
import { computeChannelMapForWilayah, FM_MIN, FM_MAX, CHANNEL_SPACING } from '../engine/channel.js';
import { renderStatsBar } from '../components/statsbar.js';
import { isExpired, esc } from '../utils.js';

let _onDetail = null;
const RANGE = FM_MAX - FM_MIN;

export function renderBand(onDetail) {
  if (onDetail) _onDetail = onDetail;

  const main = document.getElementById('main');
  if (!main) return;

  const stations = filteredStations();

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
    main.innerHTML = `<div class="empty">Tidak ada data untuk ditampilkan.</div>`;
    renderStatsBar(null);
    return;
  }

  renderStatsBar(computeChannelMapForWilayah(stations, state.wilayah || ''));

  let html = '<div class="band-wrap">';

  for (const w of wilayahList) {
    const wSt = state.wilayah
      ? stations
      : stations.filter(s => (s.wilayah_layanan || s.kota) === w);

    if (!wSt.length) continue;

    const channels = computeChannelMapForWilayah(wSt, w);

    html += `
      <div class="band-city">
        <div class="band-city-lbl">${esc(w)}</div>
        <div class="band-axis">
          <span>${FM_MIN}</span><span>${(FM_MIN + RANGE / 2).toFixed(1)}</span><span>${FM_MAX}</span>
        </div>
        <div class="band-bar">`;

    for (const ch of channels) {
      const left = ((ch.freq - FM_MIN) / RANGE * 100).toFixed(3);
      const w2   = (CHANNEL_SPACING / RANGE * 100).toFixed(3);
      const cls  = cellClass(ch);
      const tt   = ch.station
        ? `${ch.freq.toFixed(1)} — ${ch.station.stn_name}`
        : `${ch.freq.toFixed(1)} — kosong`;

      html += `<div class="bs ${cls}" style="left:${left}%;width:${w2}%"
        title="${esc(tt)}" data-freq="${ch.freq}"></div>`;
    }

    html += `</div></div>`;
  }

  html += '</div>';
  main.innerHTML = html;

  main.onclick = e => {
    const seg = e.target.closest('.bs[data-freq]');
    if (!seg || !_onDetail) return;
    _onDetail(parseFloat(seg.dataset.freq));
  };
}

function cellClass(ch) {
  const { type, station } = ch;
  if (type === 'used' && isExpired(station)) return 'bs-exp';
  if (type === 'used')       return 'bs-used';
  if (type === 'adjacent_1') return 'bs-adj1';
  if (type === 'adjacent_2') return 'bs-adj2';
  return 'bs-free';
}
