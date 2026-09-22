// views/band.js
// Pita view: band FM 87.5–108 MHz sebagai bar horizontal per wilayah.
// Segmen berwarna per status; hover/tap expand + label frekuensi + nama stasiun.

import { state, filteredStations, KOMUNITAS_RADIUS, wilayahOf } from '../state.js';
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
  if (state.wilayah.length) {
    wilayahList = [...state.wilayah];
  } else {
    wilayahList = [...new Set(
      stations
        .map(s => wilayahOf(s))
        .filter(w => w && w !== KOMUNITAS_RADIUS)
    )].sort();
  }

  if (!wilayahList.length) {
    main.innerHTML = `<div class="empty">Tidak ada data untuk ditampilkan.</div>`;
    renderStatsBar(null);
    return;
  }

  renderStatsBar(computeChannelMapForWilayah(stations, ''));

  let html = '<div class="band-wrap">';

  // Axis label — shared di atas
  html += `<div class="band-axis-global">
    <span>${FM_MIN}</span>`;
  for (let f = 90; f <= 107; f++) {
    const pct = ((f - FM_MIN) / RANGE * 100).toFixed(3);
    html += `<span class="band-axis-tick" style="left:${pct}%">${f}</span>`;
  }
  html += `<span>${FM_MAX}</span></div>`;

  for (const w of wilayahList) {
    const wSt = stations.filter(s => wilayahOf(s) === w);
    if (!wSt.length) continue;

    const channels = computeChannelMapForWilayah(wSt, w);
    const usedCh   = channels.filter(c => c.type === 'used');
    const expCh    = channels.filter(c => c.type === 'used' && isExpired(c.station));
    const allotRRI = channels.filter(c => c.allotment_status === 'allotted_rri').length;
    const allotLPS = channels.filter(c => c.allotment_status === 'allotted_lps').length;

    html += `
      <div class="band-city">
        <div class="band-city-hdr">
          <span class="band-city-lbl">${esc(w)}</span>
          <span class="band-city-meta">
            <span class="band-cnt">${usedCh.length} terisi</span>
            ${expCh.length   ? `<span class="band-exp">⚠${expCh.length} habis</span>` : ''}
            ${allotRRI ? `<span class="band-allot-rri">RRI:${allotRRI}</span>` : ''}
            ${allotLPS ? `<span class="band-allot-lps">LPS:${allotLPS}</span>` : ''}
          </span>
        </div>
        <div class="band-bar">`;

    for (const ch of channels) {
      const left  = ((ch.freq - FM_MIN) / RANGE * 100).toFixed(3);
      const width = (CHANNEL_SPACING / RANGE * 100).toFixed(3);
      const cls   = segClass(ch);
      const freq  = ch.freq.toFixed(1);
      const name  = ch.station
        ? ch.station.stn_name
            .replace(/^(RADIO |LPP RRI |LPPL |LPP |LPK )/i, '')
            .replace(/\s+(FM|AM)$/i, '')
            .split(/\s+/)[0]
            .slice(0, 10)
        : '';
      const tt = ch.station
        ? `${freq} MHz — ${ch.station.stn_name}${isExpired(ch.station) ? ' [HABIS]' : ''}`
        : ch.allotment_status === 'allotted_rri' ? `${freq} MHz — kosong (allotment RRI)`
        : ch.allotment_status === 'allotted_lps' ? `${freq} MHz — kosong (allotment LPS)`
        : `${freq} MHz — kosong`;

      // Allotment outline untuk segmen kosong
      const allotCls = ch.allotment_status === 'allotted_rri' ? ' bs-allot-rri'
                     : ch.allotment_status === 'allotted_lps' ? ' bs-allot-lps' : '';

      html += `<div class="bs${allotCls} ${cls}"
        style="left:${left}%;width:${width}%"
        data-freq="${ch.freq}"
        ${ch.station ? 'data-has-stn' : ''}
        data-tt="${esc(tt)}"
        data-name="${esc(name)}"
        data-freqlbl="${freq}"></div>`;
    }

    html += `</div></div>`;
  }

  html += '</div>';
  main.innerHTML = html;
  attachBandEvents(main);
}

function segClass(ch) {
  const { type, station } = ch;
  if (type === 'used' && isExpired(station)) return 'bs-exp';
  if (type === 'used')       return 'bs-used';
  if (type === 'adjacent_1') return 'bs-adj1';
  if (type === 'adjacent_2') return 'bs-adj2';
  return 'bs-free';
}

function attachBandEvents(main) {
  const tt   = document.getElementById('tooltip');
  let _ttTimer = null;

  function showTt(text, x, y) {
    if (!tt) return;
    tt.textContent = text;
    tt.classList.add('show');
    const tw = tt.offsetWidth || 200;
    const th = tt.offsetHeight || 30;
    tt.style.left = (x + 12 + tw > window.innerWidth  ? x - tw - 8 : x + 12) + 'px';
    tt.style.top  = (y + 12 + th > window.innerHeight ? y - th - 8 : y + 12) + 'px';
    clearTimeout(_ttTimer);
    _ttTimer = setTimeout(() => tt.classList.remove('show'), 2500);
  }

  // Desktop hover — expand segmen + tooltip
  main.addEventListener('mouseover', e => {
    const seg = e.target.closest('.bs[data-tt]');
    if (!seg) return;
    seg.classList.add('bs-hover');
  });
  main.addEventListener('mousemove', e => {
    const seg = e.target.closest('.bs[data-tt]');
    if (seg) showTt(seg.dataset.tt, e.clientX, e.clientY);
  });
  main.addEventListener('mouseout', e => {
    const seg = e.target.closest('.bs');
    if (seg) seg.classList.remove('bs-hover');
    clearTimeout(_ttTimer);
    tt?.classList.remove('show');
  });

  // Mobile tap — expand + tooltip teks di dalam bar
  main.addEventListener('touchend', e => {
    const seg = e.target.closest('.bs[data-tt]');
    if (!seg) return;
    // Toggle active
    const wasActive = seg.classList.contains('bs-active');
    main.querySelectorAll('.bs.bs-active').forEach(el => el.classList.remove('bs-active'));
    if (!wasActive) {
      seg.classList.add('bs-active');
      const touch = e.changedTouches[0];
      showTt(seg.dataset.tt, touch.clientX, touch.clientY);
    }
  }, { passive: true });

  // Klik detail
  main.onclick = e => {
    const seg = e.target.closest('.bs[data-has-stn]');
    if (!seg || !_onDetail) return;
    _onDetail(parseFloat(seg.dataset.freq));
  };
}
