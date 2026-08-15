// src/interferenceView.js
// Render panel analisis interferensi co-channel dan adjacent channel.

const TYPE_LABELS = {
  co_channel: 'Co-channel (0 kHz)',
  adjacent_1: '1st Adjacent (±100 kHz)',
  adjacent_2: '2nd Adjacent (±200 kHz)',
};

const TYPE_CLASS = {
  co_channel: 'co',
  adjacent_1: 'adj1',
  adjacent_2: 'adj2',
};

/**
 * Render panel interferensi ke dalam container element.
 * @param {HTMLElement} container
 * @param {Object} data  - response dari GET /interference
 */
export function renderInterferencePanel(container, data) {
  if (!container) return;

  const { pairs = [], summary = {}, stations_evaluated = 0, model = '' } = data;

  const criticalPairs = pairs.filter((p) => p.level === 'critical');
  const warningPairs  = pairs.filter((p) => p.level === 'warning');

  container.innerHTML = `
    <div class="section-label">Analisis interferensi FM — ${stations_evaluated} stasiun dievaluasi</div>

    <div class="interf-summary">
      <div class="interf-card">
        <div class="interf-card__label">Stasiun dievaluasi</div>
        <div class="interf-card__val is-neutral">${stations_evaluated}</div>
      </div>
      <div class="interf-card">
        <div class="interf-card__label">Co-channel kritis</div>
        <div class="interf-card__val ${summary.co_channel > 0 ? 'is-danger' : 'is-ok'}">${summary.co_channel || 0}</div>
      </div>
      <div class="interf-card">
        <div class="interf-card__label">Adjacent kritis</div>
        <div class="interf-card__val ${(summary.adjacent_1 + summary.adjacent_2) > 0 ? 'is-warn' : 'is-ok'}">${(summary.adjacent_1 || 0) + (summary.adjacent_2 || 0)}</div>
      </div>
      <div class="interf-card">
        <div class="interf-card__label">Pasangan aman</div>
        <div class="interf-card__val is-ok">${pairs.filter((p) => p.level === 'ok').length}</div>
      </div>
    </div>

    ${stations_evaluated === 0
      ? `<div class="empty-state" style="padding:32px;border:1px solid var(--border-hairline);border-radius:var(--radius-md);background:var(--bg-panel)">
           Tidak ada stasiun dengan koordinat GPS.<br>
           <span style="font-size:11px;color:var(--text-tertiary);margin-top:6px;display:block">
             Isi kolom <code style="font-family:var(--font-mono);font-size:11px">latitude</code> dan
             <code style="font-family:var(--font-mono);font-size:11px">longitude</code> di tabel isr_stations untuk mengaktifkan analisis ini.
           </span>
         </div>`
      : renderTable(pairs, model)
    }
  `;
}

function renderTable(pairs, model) {
  if (pairs.length === 0) {
    return `<div class="empty-state" style="padding:24px;border:1px solid var(--border-hairline);border-radius:var(--radius-md);background:var(--bg-panel)">
              Tidak ada pasangan interferensi terdeteksi dalam radius evaluasi.
            </div>`;
  }

  const rows = pairs.map((p, i) => {
    const marginPct = Math.min(100, Math.max(0, ((p.margin_db + 10) / 30) * 100));
    const barColor  = p.level === 'critical' ? 'var(--signal-danger)' : p.level === 'warning' ? 'var(--signal-warn)' : 'var(--signal-phosphor)';

    return `
      <div class="interf-table-row is-${p.level}">
        <div class="row-idx">${i + 1}</div>
        <div>
          <div class="row-stn">${esc(p.tx.stn_name)}</div>
          <div class="row-stn__freq">${parseFloat(p.tx.freq).toFixed(1)} MHz · ${esc(p.tx.wilayah_layanan || p.tx.kota)}</div>
        </div>
        <div>
          <div class="row-stn">${esc(p.rx.stn_name)}</div>
          <div class="row-stn__freq">${parseFloat(p.rx.freq).toFixed(1)} MHz · ${esc(p.rx.wilayah_layanan || p.rx.kota)}</div>
        </div>
        <div class="row-mono">
          <span class="interf-row__type ${TYPE_CLASS[p.type] || ''}">
            ${p.type === 'co_channel' ? 'CO-CH' : p.type === 'adjacent_1' ? 'ADJ±1' : 'ADJ±2'}
          </span>
        </div>
        <div class="row-mono">${p.dist_km} km</div>
        <div class="row-mono">${p.pr_actual} dB</div>
        <div class="margin-bar">
          <div class="margin-bar__track">
            <div class="margin-bar__fill" style="width:${marginPct}%;background:${barColor}"></div>
          </div>
          <span style="min-width:38px;color:${barColor}">${p.margin_db > 0 ? '+' : ''}${p.margin_db}</span>
        </div>
        <div>
          <span class="level-dot ${p.level}"></span>
          <span style="font-size:11px;color:var(--text-secondary);text-transform:capitalize">${p.level}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="interf-table-wrap">
      <div class="interf-table-head">
        <div>#</div>
        <div>Stasiun TX</div>
        <div>Stasiun RX</div>
        <div>Tipe</div>
        <div>Jarak</div>
        <div>D/U (dB)</div>
        <div>Margin</div>
        <div>Level</div>
      </div>
      ${rows}
    </div>
    <div style="margin-top:10px;font-size:10.5px;font-family:var(--font-mono);color:var(--text-tertiary)">
      Model: ${esc(model)} · Margin = D/U aktual − proteksi minimum (ITU-R BS.412)
    </div>`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '—');
  return d.innerHTML;
}
