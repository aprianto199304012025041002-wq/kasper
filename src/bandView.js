// src/bandView.js
// Renderer pita spektrum horizontal dengan tinggi blok proporsional ke ERP.

import { FM_MIN, FM_MAX, CHANNEL_SPACING } from './channelEngine.js';

const REGION_COLORS = {
  'KOTA YOGYAKARTA': '#4a90d9',
  SLEMAN:            '#5ee69c',
  BANTUL:            '#e6b85c',
  GUNUNGKIDUL:       '#d97a9c',
  'KULON PROGO':     '#9d8ce6',
};

const PX_PER_MHZ  = 38;   // lebar 1 MHz dalam pixel
const TRACK_H     = 172;  // tinggi area blok (di atas baseline)
const ERP_MIN     = 40;   // dBm terendah untuk normalisasi tinggi
const ERP_MAX     = 78;   // dBm tertinggi
const BLOCK_MIN_H = 28;   // tinggi minimum blok (px)

function freqToPx(freq) {
  return (freq - FM_MIN) * PX_PER_MHZ;
}

function erpToHeight(erp) {
  const normalized = Math.max(0, Math.min(1, (erp - ERP_MIN) / (ERP_MAX - ERP_MIN)));
  return BLOCK_MIN_H + normalized * (TRACK_H - BLOCK_MIN_H);
}

/**
 * Render seluruh pita horizontal ke dalam container #bandView
 * @param {Array}    channelMap   - output dari computeChannelMap()
 * @param {Function} onHover      - callback(event, channelInfo)
 * @param {Function} onClick      - callback(channelInfo)
 */
export function renderBandView(channelMap, onHover, onClick) {
  const container = document.getElementById('bandViewInner');
  if (!container) return;

  const totalW = freqToPx(FM_MAX) + 24;
  container.style.width = totalW + 'px';
  container.innerHTML   = '';

  // --- Baseline ---
  const baseline = document.createElement('div');
  baseline.className = 'band-baseline';
  container.appendChild(baseline);

  // --- ERP height hint ---
  const erpHint = document.createElement('div');
  erpHint.className   = 'band-erp-legend';
  erpHint.textContent = `↕ tinggi ∝ ERP (${ERP_MIN}–${ERP_MAX} dBm)`;
  container.appendChild(erpHint);

  // --- Freq axis ---
  const axis = document.createElement('div');
  axis.className = 'band-freq-axis';
  axis.style.width = totalW + 'px';

  for (let f = FM_MIN; f <= FM_MAX + 0.01; f = Math.round((f + 1) * 10) / 10) {
    const x = freqToPx(f);

    const tick = document.createElement('div');
    tick.className = 'band-freq-tick';
    tick.style.left = x + 'px';
    axis.appendChild(tick);

    const lbl = document.createElement('div');
    lbl.className   = 'band-freq-label';
    lbl.style.left  = x + 'px';
    lbl.textContent = f % 1 === 0 ? f.toFixed(0) : f.toFixed(1);
    axis.appendChild(lbl);

    // Minor tick setiap 0.5 MHz
    if (f + 0.5 < FM_MAX) {
      const halfX = freqToPx(f + 0.5);
      const minor = document.createElement('div');
      minor.className = 'band-freq-tick';
      minor.style.cssText = `left:${halfX}px;height:4px;opacity:0.4;`;
      axis.appendChild(minor);
    }
  }
  container.appendChild(axis);

  // --- Channel blocks ---
  for (const ch of channelMap) {
    const x = freqToPx(ch.freq);
    const blockW = Math.max(CHANNEL_SPACING * PX_PER_MHZ - 2, 4);
    const blockH = ch.type === 'used' ? erpToHeight(ch.station?.erp_dbm || 60) : 20;

    const block = document.createElement('div');
    block.className = 'band-block';
    block.style.cssText = `
      left: ${x - blockW / 2}px;
      width: ${blockW}px;
      height: ${blockH}px;
    `;

    if (ch.type === 'used') {
      const color = REGION_COLORS[ch.station?.kota] || '#888';
      block.style.background   = color + '22';
      block.style.borderColor  = color;
      block.style.borderStyle  = 'solid';

      if (blockW > 20) {
        const lbl = document.createElement('div');
        lbl.className   = 'band-block__label';
        lbl.style.color = color;
        lbl.textContent = blockW > 35 ? (ch.station?.stn_name || '') : ch.freq.toFixed(1);
        block.appendChild(lbl);
      }

    } else if (ch.type === 'adjacent') {
      block.classList.add('band-block--adjacent');
      block.style.height = '14px';

    } else {
      block.classList.add('band-block--free');
      const star = document.createElement('div');
      star.className   = 'band-block__label';
      star.style.color = 'var(--signal-phosphor)';
      star.textContent = ch.freq.toFixed(1);
      block.appendChild(star);
    }

    block.addEventListener('mouseenter', (e) => onHover(e, ch));
    block.addEventListener('mousemove',  (e) => onHover(e, ch));
    block.addEventListener('mouseleave', ()  => onHover(null, null));
    block.addEventListener('click',      ()  => onClick(ch));

    container.appendChild(block);
  }
}

/**
 * Render ruler di atas band track
 */
export function renderBandRuler() {
  const ruler = document.getElementById('bandRuler');
  if (!ruler) return;

  const totalW = freqToPx(FM_MAX) + 24;
  ruler.style.width = totalW + 'px';
  ruler.innerHTML   = '';

  for (let f = FM_MIN; f <= FM_MAX + 0.01; f = Math.round((f + 0.5) * 10) / 10) {
    const x = freqToPx(f);
    const isMajor = f % 1 === 0;

    const tick = document.createElement('div');
    tick.className = `band-ruler__tick band-ruler__tick--${isMajor ? 'major' : 'minor'}`;
    tick.style.left = x + 'px';
    ruler.appendChild(tick);

    if (isMajor) {
      const lbl = document.createElement('div');
      lbl.className   = 'band-ruler__label';
      lbl.style.left  = x + 'px';
      lbl.textContent = f.toFixed(0) + ' MHz';
      ruler.appendChild(lbl);
    }
  }
}
