// components/header.js
// Header bar: logo, subtitle, status stasiun, tombol refresh dan theme.

import { state } from '../state.js';
import { isExpired } from '../utils.js';

export function mountHeader(onRefresh, onTheme) {
  const user = window.__KASPER_USER__ || {};
  const name = user.name || user.email || '';

  document.getElementById('hdr').innerHTML = `
    <div class="hdr-l">
      <button id="sidebar-toggle" title="Sembunyikan sidebar">‹</button>
      <span class="logo">KASPER</span>
      <span class="hdr-sub">Pengkanalan Spektrum Radio · DIY &amp; Jawa Tengah</span>
    </div>
    <div class="hdr-r">
      <span id="hdr-status">—</span>
      <button id="btn-refresh" title="Refresh data [R]">↺</button>
      <button id="btn-theme" title="Toggle tema">${state.theme === 'dark' ? '☀' : '☾'}</button>
      ${name ? `<span class="hdr-user" title="${name}">${name.split(' ')[0]}</span>` : ''}
      <a href="/logout.php" class="hdr-logout" title="Keluar">⏏</a>
    </div>`;

  document.getElementById('btn-refresh').onclick = onRefresh;
  document.getElementById('btn-theme').onclick   = onTheme;
}

export function updateStatus() {
  const el = document.getElementById('hdr-status');
  if (!el) return;

  if (!state.data) { el.innerHTML = '—'; return; }

  const stations = state.data.stations || [];
  const total    = stations.length;
  const expired  = stations.filter(s => isExpired(s)).length;
  const time     = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  el.innerHTML = `
    ${total} stasiun
    ${expired ? `· <span class="status-exp">⚠ ${expired} habis</span>` : ''}
    · ${time}`;
}

export function setThemeButton(theme) {
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}
