// views/band.js
// Pita view: layout sama dengan grid (sync scroll, label kiri sticky, ruler atas)
// tapi visualisasi frekuensi sebagai bar kontinu proporsional, bukan kotak per cell.

import { state, filteredStations, KOMUNITAS_RADIUS, wilayahOf } from '../state.js';
import { computeChannelMapForWilayah, FM_MIN, FM_MAX, CHANNEL_SPACING } from '../engine/channel.js';
import { renderStatsBar } from '../components/statsbar.js';
import { isExpired, esc } from '../utils.js';

let _onDetail = null;
const RANGE    = FM_MAX - FM_MIN;
const BAR_W    = 4000; // lebar virtual bar dalam px — sama untuk semua wilayah

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
      stations.map(s => wilayahOf(s)).filter(w => w && w !== KOMUNITAS_RADIUS)
    )].sort();
  }

  if (!wilayahList.length) {
    main.innerHTML = `<div class="empty">Tidak ada data untuk ditampilkan.</div>`;
    renderStatsBar(null);
    return;
  }

  renderStatsBar(computeChannelMapForWilayah(stations, ''));

  // Ruler frekuensi di atas
  let html = '<div class="band-wrap">';
  html += `<div class="band-scroll-wrap"><div class="band-ruler band-scroll">`;
  html += `<div class="band-bar-wrap" style="width:${BAR_W}px">`;
  for (let f = FM_MIN; f <= FM_MAX; f += 0.5) {
    const x = ((f - FM_MIN) / RANGE * BAR_W).toFixed(1);
    const isMajor = Number.isInteger(f);
    html += `<div class="band-tick${isMajor ? ' major' : ''}" style="left:${x}px">${isMajor ? f : ''}</div>`;
  }
  html += '</div></div></div>';

  // Satu blok per wilayah: judul di atas, bar di bawah
  for (const w of wilayahList) {
    const wSt = stations.filter(s => wilayahOf(s) === w);
    if (!wSt.length) continue;

    const channels = computeChannelMapForWilayah(wSt, w);
    const expCount  = wSt.filter(s => isExpired(s)).length;
    const allotRRI  = channels.filter(c => c.allotment_status === 'allotted_rri' && c.type === 'free').length;
    const allotLPS  = channels.filter(c => c.allotment_status === 'allotted_lps' && c.type === 'free').length;

    html += `
      <div class="band-city">
        <div class="band-city-hdr">
          <span class="band-city-lbl">${esc(w)}</span>
          <span class="band-city-meta">
            ${expCount  ? `<span class="city-exp">⚠${expCount} habis</span>` : ''}
            ${allotRRI  ? `<span class="city-allot-rri">RRI:${allotRRI}</span>` : ''}
            ${allotLPS  ? `<span class="city-allot-lps">LPS:${allotLPS}</span>` : ''}
          </span>
        </div>
        <div class="band-scroll-wrap"><div class="band-scroll">
          <div class="band-bar-wrap" style="width:${BAR_W}px">`;

    for (const ch of channels) {
      const x     = ((ch.freq - FM_MIN) / RANGE * BAR_W).toFixed(1);
      const w_seg = (CHANNEL_SPACING / RANGE * BAR_W).toFixed(1);
      const cls   = segClass(ch);
      const freq  = ch.freq.toFixed(1);
      const name  = ch.station
        ? ch.station.stn_name
            .replace(/^(RADIO |LPP RRI |LPPL |LPP |LPK )/i, '')
            .replace(/\s+(FM|AM)$/i, '')
            .split(/\s+/)[0].slice(0, 10)
        : '';
      const tt = ch.station
        ? `${freq} MHz — ${ch.station.stn_name}${isExpired(ch.station) ? ' [HABIS]' : ''}`
        : ch.allotment_status === 'allotted_rri' ? `${freq} MHz — kosong (allotment RRI)`
        : ch.allotment_status === 'allotted_lps' ? `${freq} MHz — kosong (allotment LPS)`
        : `${freq} MHz — kosong`;
      const allotCls = ch.allotment_status === 'allotted_rri' ? ' bs-allot-rri'
                     : ch.allotment_status === 'allotted_lps' ? ' bs-allot-lps' : '';

      html += `<div class="bs ${cls}${allotCls}"
        style="left:${x}px;width:${w_seg}px"
        data-freq="${ch.freq}"
        ${ch.station ? 'data-has-stn' : ''}
        data-tt="${esc(tt)}"
        data-freqlbl="${freq}"
        data-name="${esc(name)}"></div>`;
    }

    html += `</div></div></div></div>`;
  }

  html += '</div>';
  main.innerHTML = html;
  attachBandEvents(main);
}

function segClass(ch) {
  if (ch.type === 'used' && isExpired(ch.station)) return 'bs-exp';
  if (ch.type === 'used')       return 'bs-used';
  if (ch.type === 'adjacent_1') return 'bs-adj1';
  if (ch.type === 'adjacent_2') return 'bs-adj2';
  return 'bs-free';
}

function attachBandEvents(main) {
  // Scroll sinkron — sama dengan grid
  const bodies = main.querySelectorAll('.band-scroll');
  let _syncing = false;
  bodies.forEach(el => {
    el.addEventListener('scroll', () => {
      if (_syncing) return;
      _syncing = true;
      bodies.forEach(other => { if (other !== el) other.scrollLeft = el.scrollLeft; });
      _syncing = false;
    }, { passive: true });
  });

  const tt = document.getElementById('tooltip');
  let _ttTimer = null;

  function showTt(text, x, y) {
    if (!tt) return;
    tt.textContent = text; tt.classList.add('show');
    const tw = tt.offsetWidth || 200, th = tt.offsetHeight || 30;
    tt.style.left = (x + 12 + tw > window.innerWidth  ? x - tw - 8 : x + 12) + 'px';
    tt.style.top  = (y + 12 + th > window.innerHeight ? y - th - 8 : y + 12) + 'px';
    clearTimeout(_ttTimer);
    _ttTimer = setTimeout(() => tt.classList.remove('show'), 2500);
  }

  // Desktop hover
  main.addEventListener('mousemove', e => {
    const seg = e.target.closest('.bs[data-tt]');
    if (seg) showTt(seg.dataset.tt, e.clientX, e.clientY);
  });
  main.addEventListener('mouseleave', () => { clearTimeout(_ttTimer); tt?.classList.remove('show'); });

  // Mobile tap
  main.addEventListener('touchend', e => {
    const seg = e.target.closest('.bs[data-tt]');
    if (!seg) return;
    const touch = e.changedTouches[0];
    showTt(seg.dataset.tt, touch.clientX, touch.clientY);
  }, { passive: true });

  // Klik detail
  main.onclick = e => {
    const seg = e.target.closest('.bs[data-has-stn]');
    if (seg && _onDetail) _onDetail(parseFloat(seg.dataset.freq));
  };
}
