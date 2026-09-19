// components/statsbar.js
// Stats bar: ringkasan kanal (total, terisi, adjacent, kosong, expired).

import { state } from '../state.js';
import { summarizeChannels } from '../engine/channel.js';
import { isExpired } from '../utils.js';

export function renderStatsBar(channelMap) {
  const el = document.getElementById('statsbar');
  if (!el) return;

  if (!channelMap) { el.innerHTML = ''; return; }

  const { total, used, adj, free } = summarizeChannels(channelMap);
  const exp = (state.data?.stations || []).filter(s => isExpired(s)).length;
  const pct = (n, d) => d ? (n / d * 100).toFixed(1) : '0';

  el.innerHTML = `
    <div class="stats">
      <div class="stat">
        <div class="stat-l">Total kanal FM</div>
        <div class="stat-v">${total}</div>
      </div>
      <div class="stat stat-btn" data-filter="used" title="Filter terisi">
        <div class="stat-l">Terisi</div>
        <div class="stat-v accent">${used} <small>${pct(used, total)}%</small></div>
      </div>
      <div class="stat">
        <div class="stat-l">Adjacent guard</div>
        <div class="stat-v amber">${adj} <small>${pct(adj, total)}%</small></div>
      </div>
      <div class="stat stat-btn" data-filter="free" title="Filter kosong">
        <div class="stat-l">Kosong</div>
        <div class="stat-v green">${free} <small>${pct(free, total)}%</small></div>
      </div>
      ${exp ? `
      <div class="stat stat-btn" data-filter="expired" title="Filter izin habis">
        <div class="stat-l">⚠ Habis</div>
        <div class="stat-v red">${exp}</div>
      </div>` : ''}
    </div>`;

  el.onclick = e => {
    const btn = e.target.closest('.stat-btn[data-filter]');
    if (!btn) return;
    state.chanFilter = state.chanFilter === btn.dataset.filter ? 'all' : btn.dataset.filter;
    // Re-render dipanggil dari luar lewat event
    el.dispatchEvent(new CustomEvent('kasper:filter', { bubbles: true }));
  };
}
