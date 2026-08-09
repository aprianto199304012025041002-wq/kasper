// src/bandView.js — Band view per kota, shared scroll, konsisten dengan grid view
import { FM_MIN, FM_MAX } from './channelEngine.js';

const PX_PER_MHZ = 52;   // piksel per MHz — lebar total ~1060px untuk 87.5–108.0
const TRACK_H    = 56;    // tinggi row track
const ERP_MIN    = 40, ERP_MAX = 78;
const BLOCK_W    = 14;    // lebar tiap blok (px) — setara 200kHz slot

const REGION_COLORS = {
  'KOTA YOGYAKARTA': '#00e5ff',
  'SLEMAN':          '#a78bfa',
  'BANTUL':          '#ff6b35',
  'GUNUNGKIDUL':     '#34d399',
  'KULON PROGO':     '#f472b6',
};
const DEFAULT_COLOR = '#4a90d9';

function px(freq) { return (freq - FM_MIN) * PX_PER_MHZ; }
function erpH(erp) {
  const ratio = Math.max(0, Math.min(1, ((erp || 60) - ERP_MIN) / (ERP_MAX - ERP_MIN)));
  return Math.round(10 + ratio * (TRACK_H - 16));
}

export function renderBandView(channelMap, stations, activeCities, onClickCell) {
  const el = document.getElementById('bandViewInner');
  if (!el) return;

  // Group channel_map per kota — pakai channel_map dari API tapi filtered per city
  const cities = activeCities && activeCities.length
    ? activeCities
    : [...new Set(stations.map(s => s.kota || s.city).filter(Boolean))].sort();

  const totalW = px(FM_MAX) + 40;

  // Build ruler HTML
  let rulerHtml = `<div class="bv-ruler" style="width:${totalW}px">`;
  for (let f = FM_MIN; f <= FM_MAX + 0.01; f = Math.round((f + 0.5) * 10) / 10) {
    const x = px(f);
    const major = f % 1 === 0;
    rulerHtml += `<div class="bv-tick ${major ? 'bv-tick--major' : 'bv-tick--minor'}" style="left:${x}px"></div>`;
    if (major) rulerHtml += `<div class="bv-ruler-label" style="left:${x}px">${f.toFixed(0)}</div>`;
  }
  rulerHtml += `</div>`;

  // Build rows HTML per kota
  let rowsHtml = '';
  for (const city of cities) {
    const cityStations = stations.filter(s => (s.kota || s.city) === city);
    const cityColor = REGION_COLORS[city] || DEFAULT_COLOR;
    const count = cityStations.length;

    // Filter channel_map untuk kota ini
    const cityFreqs = new Set(cityStations.map(s => parseFloat(s.freq)));

    let blocksHtml = '';
    for (const ch of channelMap) {
      const x = px(ch.freq) - BLOCK_W / 2;

      if (ch.type === 'used') {
        const chCity = ch.station?.kota || ch.station?.city;
        if (chCity !== city) continue; // hanya blok milik kota ini
        const h = erpH(ch.station?.erp_dbm);
        const color = cityColor;
        const top = TRACK_H - h;
        blocksHtml += `<div class="bv-block bv-block--used"
          style="left:${x}px;width:${BLOCK_W}px;height:${h}px;top:${top}px;background:${color}22;border-color:${color}"
          data-freq="${ch.freq}" data-type="used" title="${ch.station?.stn_name || ''} · ${ch.freq.toFixed(1)} MHz">
          <div class="bv-block__label" style="color:${color}">${ch.freq.toFixed(1)}</div>
        </div>`;
      } else if (ch.type === 'adjacent_1' || ch.type === 'adjacent_2') {
        // Tampilkan adjacent jika salah satu guard-nya kota ini
        const leftCity  = ch.adj_left?.kota  || ch.adj_left?.city;
        const rightCity = ch.adj_right?.kota || ch.adj_right?.city;
        if (leftCity !== city && rightCity !== city) continue;
        const isAdj1 = ch.type === 'adjacent_1';
        blocksHtml += `<div class="bv-block bv-block--adj ${isAdj1 ? 'bv-block--adj1' : 'bv-block--adj2'}"
          style="left:${x}px;width:${BLOCK_W}px"
          data-freq="${ch.freq}" data-type="${ch.type}">
        </div>`;
      } else {
        // free — tampilkan di setiap row sebagai konteks
        blocksHtml += `<div class="bv-block bv-block--free"
          style="left:${x}px;width:${BLOCK_W}px"
          data-freq="${ch.freq}" data-type="free">
          <div class="bv-block__star">★</div>
        </div>`;
      }
    }

    rowsHtml += `
      <div class="bv-row">
        <div class="bv-row-label">
          <span class="bv-row-city" style="color:${cityColor}">${city}</span>
          <span class="bv-row-count">${count}</span>
        </div>
        <div class="bv-track" style="width:${totalW}px;height:${TRACK_H}px">
          <div class="bv-baseline"></div>
          ${blocksHtml}
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="bv-scroll-wrap">
      <div class="bv-sticky-col">
        <div class="bv-ruler-spacer"></div>
        ${cities.map((city, i) => {
          const color = REGION_COLORS[city] || DEFAULT_COLOR;
          const count = stations.filter(s => (s.kota || s.city) === city).length;
          return `<div class="bv-label-cell">
            <span class="bv-row-city" style="color:${color}">${city}</span>
            <span class="bv-row-count">${count}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="bv-scroll-body" id="bvScrollBody">
        ${rulerHtml}
        ${cities.map(city => {
          const cityStations = stations.filter(s => (s.kota || s.city) === city);
          const cityColor = REGION_COLORS[city] || DEFAULT_COLOR;
          let blocksHtml = '';
          for (const ch of channelMap) {
            const x = px(ch.freq) - BLOCK_W / 2;
            if (ch.type === 'used') {
              const chCity = ch.station?.kota || ch.station?.city;
              if (chCity !== city) continue;
              const h = erpH(ch.station?.erp_dbm);
              const top = TRACK_H - h;
              blocksHtml += `<div class="bv-block bv-block--used"
                style="left:${x}px;width:${BLOCK_W}px;height:${h}px;top:${top}px;background:${cityColor}22;border-color:${cityColor}"
                data-freq="${ch.freq}" title="${ch.station?.stn_name||''} · ${ch.freq.toFixed(1)} MHz">
                <div class="bv-block__label" style="color:${cityColor}">${ch.freq.toFixed(1)}</div>
              </div>`;
            } else if (ch.type === 'adjacent_1' || ch.type === 'adjacent_2') {
              const leftCity  = ch.adj_left?.kota  || ch.adj_left?.city;
              const rightCity = ch.adj_right?.kota || ch.adj_right?.city;
              if (leftCity !== city && rightCity !== city) continue;
              blocksHtml += `<div class="bv-block ${ch.type==='adjacent_1'?'bv-block--adj1':'bv-block--adj2'}"
                style="left:${x}px;width:${BLOCK_W}px"
                data-freq="${ch.freq}" data-type="${ch.type}">
              </div>`;
            } else {
              blocksHtml += `<div class="bv-block bv-block--free"
                style="left:${x}px;width:${BLOCK_W}px"
                data-freq="${ch.freq}" data-type="free">
                <div class="bv-block__star">★</div>
              </div>`;
            }
          }
          return `<div class="bv-track" style="width:${totalW}px;height:${TRACK_H}px">
            <div class="bv-baseline"></div>
            ${blocksHtml}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Attach click
  el.querySelectorAll('.bv-block[data-freq]').forEach(block => {
    block.addEventListener('click', () => {
      const freq = parseFloat(block.dataset.freq);
      const ch = channelMap.find(c => c.freq === freq);
      if (ch) onClickCell(ch);
    });
  });
}
