// src/interferenceView.js — pakai app.css classes

export function renderInterferencePanel(container, data) {
  if (!container) return;
  const { pairs = [], summary = {}, stations_evaluated = 0, model = '' } = data;

  const adjTotal = (summary.adjacent_1||0) + (summary.adjacent_2||0);

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
        <div class="interf-card__val ${adjTotal > 0 ? 'is-warn' : 'is-ok'}">${adjTotal}
          ${adjTotal > 0 ? `<span style="font-size:9px;color:var(--txt-3);font-weight:400;display:block">±1: ${summary.adjacent_1||0} · ±2: ${summary.adjacent_2||0}</span>` : ''}
        </div>
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
        : renderTableWithFilter(pairs, model)
    }
  `;

  // Pasang click-to-detail pada nama stasiun
  container.querySelectorAll('.interf-stn-link[data-freq]').forEach(el => {
    el.addEventListener('click', () => {
      const f = parseFloat(el.dataset.freq);
      if (window.__openDetailFreq) window.__openDetailFreq(f);
    });
    el.addEventListener('mouseenter', () => { el.style.textDecoration = 'underline'; });
    el.addEventListener('mouseleave', () => { el.style.textDecoration = ''; });
  });

  // Pasang event filter setelah render
  container.querySelector('#interfFilter')?.addEventListener('change', e => {
    const val = e.target.value;
    container.querySelectorAll('tr[data-level]').forEach(row => {
      row.style.display = (!val || row.dataset.level === val) ? '' : 'none';
    });
    renumberRows(container);
  });

  // Sort by column header
  let _sortCol = null, _sortAsc = true;
  container.querySelectorAll('.interf-th-sort[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (_sortCol === col) _sortAsc = !_sortAsc; else { _sortCol = col; _sortAsc = col === 'dist'; }
      // Update header indicators
      container.querySelectorAll('.interf-th-sort').forEach(h => {
        h.textContent = h.textContent.replace(/ [▲▼]$/, '');
        if (h.dataset.sort === col) h.textContent += _sortAsc ? ' ▲' : ' ▼';
      });
      const tbody = container.querySelector('.interf-table tbody');
      if (!tbody) return;
      const rows = [...tbody.querySelectorAll('tr[data-level]')];
      const levelRank = { critical: 0, warning: 1, ok: 2 };
      rows.sort((a, b) => {
        let va, vb;
        if (col === 'level')  { va = levelRank[a.dataset.level]; vb = levelRank[b.dataset.level]; }
        else if (col === 'dist')   { va = parseFloat(a.dataset.dist);   vb = parseFloat(b.dataset.dist); }
        else if (col === 'du')     { va = parseFloat(a.dataset.du);     vb = parseFloat(b.dataset.du); }
        else if (col === 'margin') { va = parseFloat(a.dataset.margin); vb = parseFloat(b.dataset.margin); }
        return _sortAsc ? va - vb : vb - va;
      });
      rows.forEach(r => tbody.appendChild(r));
      renumberRows(container);
    });
  });
}

function renderTableWithFilter(pairs, model) {
  const criticalCount  = pairs.filter(p => p.level === 'critical').length;
  const warningCount   = pairs.filter(p => p.level === 'warning').length;

  const rows = pairs.map((p, i) => {
    const barPct = Math.min(100, Math.max(0, ((p.margin_db + 10) / 30) * 100));
    const barClr = p.level === 'critical' ? 'var(--red)' : p.level === 'warning' ? 'var(--amber)' : 'var(--phosphor)';
    const typeBadge = p.type === 'co_channel' ? `<span class="badge-co">CO</span>`
                    : p.type === 'adjacent_1'  ? `<span class="badge-adj1">ADJ±1</span>`
                    :                            `<span class="badge-adj2">ADJ±2</span>`;
    const levelLabel = p.level === 'critical' ? 'Kritis' : p.level === 'warning' ? 'Peringatan' : 'Aman';
    return `<tr data-level="${p.level}" data-dist="${p.dist_km}" data-du="${p.pr_actual}" data-margin="${p.margin_db}">
      <td style="color:var(--txt-3)" class="row-num">${i+1}</td>
      <td>
        <div class="interf-stn-link" data-freq="${p.tx.freq}" style="color:var(--txt);cursor:pointer" title="Buka detail ${esc(p.tx.stn_name)}">${esc(p.tx.stn_name)}</div>
        <div style="font-size:10px;color:var(--txt-3)">${parseFloat(p.tx.freq).toFixed(1)} MHz · ${esc(p.tx.wilayah_layanan||'—')}</div>
        <div style="font-size:9px;color:var(--txt-3)">ERP ${p.tx.erp_dbm} dBm</div>
      </td>
      <td>
        <div class="interf-stn-link" data-freq="${p.rx.freq}" style="color:var(--txt);cursor:pointer" title="Buka detail ${esc(p.rx.stn_name)}">${esc(p.rx.stn_name)}</div>
        <div style="font-size:10px;color:var(--txt-3)">${parseFloat(p.rx.freq).toFixed(1)} MHz · ${esc(p.rx.wilayah_layanan||'—')}</div>
        <div style="font-size:9px;color:var(--txt-3)">ERP ${p.rx.erp_dbm} dBm</div>
      </td>
      <td>${typeBadge}</td>
      <td style="font-family:var(--mono);font-size:11px">${p.dist_km} km</td>
      <td style="font-family:var(--mono);font-size:11px">${p.pr_actual > 0 ? '+' : ''}${p.pr_actual} dB</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:4px;background:var(--bg-raised);border-radius:2px">
            <div style="height:100%;width:${barPct}%;background:${barClr};border-radius:2px"></div>
          </div>
          <span style="color:${barClr};min-width:36px;font-size:10px;text-align:right">${p.margin_db > 0 ? '+' : ''}${p.margin_db}</span>
        </div>
      </td>
      <td style="color:${barClr}">${levelLabel}</td>
    </tr>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
      <div style="font-size:11px;color:var(--txt-3)">${pairs.length} pasangan terdeteksi</div>
      <select id="interfFilter" style="margin-left:auto;font-family:var(--mono);font-size:11px;background:var(--bg-raised);color:var(--txt);border:1px solid var(--border);border-radius:4px;padding:3px 8px">
        <option value="">Semua level</option>
        ${criticalCount  ? `<option value="critical">Kritis (${criticalCount})</option>` : ''}
        ${warningCount   ? `<option value="warning">Peringatan (${warningCount})</option>` : ''}
        <option value="ok">Aman</option>
      </select>
    </div>
    <div style="overflow-x:auto">
      <table class="interf-table" id="interfTable">
        <thead><tr>
          <th>#</th>
          <th>Interferor ↑ ERP lebih besar</th>
          <th>Korban ↓ ERP lebih kecil</th>
          <th>Tipe</th>
          <th class="interf-th-sort" data-sort="dist" style="cursor:pointer;user-select:none" title="Sort by jarak">Jarak ↕</th>
          <th class="interf-th-sort" data-sort="du"   style="cursor:pointer;user-select:none" title="Sort by D/U">D/U ↕</th>
          <th class="interf-th-sort" data-sort="margin" style="cursor:pointer;user-select:none" title="Sort by margin">Margin ↕</th>
          <th class="interf-th-sort" data-sort="level" style="cursor:pointer;user-select:none" title="Sort by level">Level ↕</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--txt-3)">
      Model: ${esc(model)} · D/U = ERP korban − ERP interferor · Margin = D/U − proteksi minimum · Klik header untuk sort
    </div>`;
}

function renumberRows(container) {
  const tbody = container.querySelector('.interf-table tbody');
  if (!tbody) return;
  const visible = [...tbody.querySelectorAll('tr[data-level]')].filter(r => r.style.display !== 'none');
  visible.forEach((r, i) => { const nd = r.querySelector('.row-num'); if (nd) nd.textContent = i+1; });
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s||'—'); return d.innerHTML; }
