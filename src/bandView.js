// src/bandView.js
import { FM_MIN, FM_MAX, CHANNEL_SPACING } from './channelEngine.js';

const REGION_COLORS = {
  'KOTA YOGYAKARTA':'#4a90d9', SLEMAN:'#5ee69c', BANTUL:'#e6b85c',
  GUNUNGKIDUL:'#d97a9c', 'KULON PROGO':'#9d8ce6',
};
const PX_PER_MHZ = 38, TRACK_H = 172, ERP_MIN = 40, ERP_MAX = 78, BLOCK_MIN_H = 28;

function px(freq) { return (freq - FM_MIN) * PX_PER_MHZ; }
function erpH(erp) { return BLOCK_MIN_H + Math.max(0, Math.min(1, (erp - ERP_MIN) / (ERP_MAX - ERP_MIN))) * (TRACK_H - BLOCK_MIN_H); }

export function renderBandView(channelMap, onHover, onClick) {
  const container = document.getElementById('bandViewInner');
  if (!container) return;
  const totalW = px(FM_MAX) + 24;
  container.style.width = totalW + 'px';
  container.innerHTML = '';

  const baseline = document.createElement('div');
  baseline.className = 'band-baseline'; container.appendChild(baseline);

  const hint = document.createElement('div');
  hint.className = 'band-erp-legend'; hint.textContent = '↕ tinggi ∝ ERP'; container.appendChild(hint);

  const axis = document.createElement('div');
  axis.className = 'band-freq-axis'; axis.style.width = totalW + 'px';
  for (let f = FM_MIN; f <= FM_MAX + 0.01; f = Math.round((f + 1) * 10) / 10) {
    const x = px(f);
    const tick = document.createElement('div'); tick.className = 'band-freq-tick'; tick.style.left = x + 'px'; axis.appendChild(tick);
    const lbl = document.createElement('div'); lbl.className = 'band-freq-label'; lbl.style.left = x + 'px'; lbl.textContent = f % 1 === 0 ? f.toFixed(0) : f.toFixed(1); axis.appendChild(lbl);
    if (f + 0.5 < FM_MAX) { const m = document.createElement('div'); m.className='band-freq-tick'; m.style.cssText=`left:${px(f+0.5)}px;height:4px;opacity:.4;`; axis.appendChild(m); }
  }
  container.appendChild(axis);

  for (const ch of channelMap) {
    const bx = px(ch.freq), bw = Math.max(CHANNEL_SPACING * PX_PER_MHZ - 2, 4);
    const bh = ch.type === 'used' ? erpH(ch.station?.erp_dbm || 60) : 20;
    const block = document.createElement('div');
    block.className = 'band-block';
    block.style.cssText = `left:${bx - bw/2}px;width:${bw}px;height:${bh}px;`;

    if (ch.type === 'used') {
      const color = REGION_COLORS[ch.station?.kota] || '#888';
      block.style.background = color + '22'; block.style.borderColor = color; block.style.borderStyle = 'solid';
      if (bw > 20) { const l = document.createElement('div'); l.className='band-block__label'; l.style.color=color; l.textContent=bw>35?(ch.station?.stn_name||''):ch.freq.toFixed(1); block.appendChild(l); }
    } else if (ch.type === 'adjacent') {
      block.classList.add('band-block--adjacent'); block.style.height = '14px';
    } else {
      block.classList.add('band-block--free');
      const star = document.createElement('div'); star.className='band-block__label'; star.style.color='var(--signal-phosphor)'; star.textContent=ch.freq.toFixed(1); block.appendChild(star);
    }
    block.addEventListener('mouseenter', (e) => onHover(e, ch));
    block.addEventListener('mousemove',  (e) => onHover(e, ch));
    block.addEventListener('mouseleave', ()  => onHover(null, null));
    block.addEventListener('click',      ()  => onClick(ch));
    container.appendChild(block);
  }
}

export function renderBandRuler() {
  const ruler = document.getElementById('bandRuler');
  if (!ruler) return;
  const totalW = px(FM_MAX) + 24;
  ruler.style.width = totalW + 'px'; ruler.innerHTML = '';
  for (let f = FM_MIN; f <= FM_MAX + 0.01; f = Math.round((f + 0.5) * 10) / 10) {
    const x = px(f), isMajor = f % 1 === 0;
    const tick = document.createElement('div'); tick.className=`band-ruler__tick band-ruler__tick--${isMajor?'major':'minor'}`; tick.style.left=x+'px'; ruler.appendChild(tick);
    if (isMajor) { const lbl=document.createElement('div'); lbl.className='band-ruler__label'; lbl.style.left=x+'px'; lbl.textContent=f.toFixed(0)+' MHz'; ruler.appendChild(lbl); }
  }
}
