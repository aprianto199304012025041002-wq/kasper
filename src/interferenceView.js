// src/interferenceView.js — pakai app.css classes

export function renderInterferencePanel(container, data) {
  if (!container) return;
  const { pairs = [], summary = {}, stations_evaluated = 0, model = '' } = data;

  container.innerHTML = `
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
        <div class="interf-card__val ${ (summary.adjacent_1||0)+(summary.adjacent_2||0) > 0 ? 'is-warn' : 'is-ok' }">${(summary.adjacent_1||0)+(summary.adjacent_2||0)}</div>
      </div>
      <div class="interf-card">
        <div class="interf-card__label">Pasangan aman</div>
        <div class="interf-card__val is-ok">${pairs.filter(p => p.level==='ok').length}</div>
      </div>
    </div>

    ${stations_evaluated === 0
      ? `<div class="state-empty">Tidak ada stasiun dengan koordinat GPS.<br><span style="font-size:10px;margin-top:4px;display:block">Isi kolom latitude / longitude di tabel isr.</span></div>`
      : pairs.length === 0
        ? `<div class="state-empty">Tidak ada pasangan interferensi terdeteksi.</div>`
        : renderTable(pairs, model)
    }
  `;
}

function renderTable(pairs, model) {
  const rows = pairs.map((p, i) => {
    const barPct = Math.min(100, Math.max(0, ((p.margin_db+10)/30)*100));
    const barClr = p.level==='critical' ? 'var(--red)' : p.level==='warning' ? 'var(--amber)' : 'var(--phosphor)';
    const typeBadge = p.type==='co_channel' ? `<span class="badge-co">CO</span>`
                    : p.type==='adjacent_1' ? `<span class="badge-adj1">ADJ±1</span>`
                    : `<span class="badge-adj2">ADJ±2</span>`;
    return `<tr>
      <td style="color:var(--txt-3)">${i+1}</td>
      <td>
        <div style="color:var(--txt)">${esc(p.tx.stn_name)}</div>
        <div style="font-size:10px;color:var(--txt-3)">${parseFloat(p.tx.freq).toFixed(1)} MHz · ${esc(p.tx.wilayah_layanan||p.tx.kota||'—')}</div>
      </td>
      <td>
        <div style="color:var(--txt)">${esc(p.rx.stn_name)}</div>
        <div style="font-size:10px;color:var(--txt-3)">${parseFloat(p.rx.freq).toFixed(1)} MHz · ${esc(p.rx.wilayah_layanan||p.rx.kota||'—')}</div>
      </td>
      <td>${typeBadge}</td>
      <td>${p.dist_km} km</td>
      <td>${p.pr_actual} dB</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:4px;background:var(--bg-raised);border-radius:2px">
            <div style="height:100%;width:${barPct}%;background:${barClr};border-radius:2px"></div>
          </div>
          <span style="color:${barClr};min-width:32px;font-size:10px">${p.margin_db>0?'+':''}${p.margin_db}</span>
        </div>
      </td>
      <td style="color:${barClr};text-transform:capitalize">${p.level}</td>
    </tr>`;
  }).join('');

  return `
    <div style="overflow-x:auto">
      <table class="interf-table">
        <thead><tr>
          <th>#</th><th>Stasiun TX</th><th>Stasiun RX</th>
          <th>Tipe</th><th>Jarak</th><th>D/U</th><th>Margin</th><th>Level</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--txt-3)">
      Model: ${esc(model)} · Margin = D/U aktual − proteksi minimum (ITU-R BS.412)
    </div>`;
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s||'—'); return d.innerHTML; }
