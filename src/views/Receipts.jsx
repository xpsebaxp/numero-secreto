import { useState } from 'preact/hooks';
import { ReceiptRow } from './Home.jsx';
import { CATEGORIES } from '../lib/categories.js';
import { clp, dateLong, normName } from '../lib/format.js';

export function Receipts({ st, onEdit, onScan, onManual }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const nq = normName(q);
  const rs = st.rs.filter((r) => (!cat || (cat === '_extra' ? st.extras.has(r.id) : r.category === cat)) && (!nq || normName(r.merchant + ' ' + (r.note || '') + ' ' + (r.items || []).map((i) => i.desc).join(' ')).includes(nq)));
  const days = {};
  for (const r of rs) (days[r.date] = days[r.date] || []).push(r);
  const total = rs.reduce((a, b) => a + b.total, 0);

  return (
    <div>
      <div class="search">
        <input type="search" placeholder="Buscar comercio o producto" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <select value={cat} onChange={(e) => setCat(e.currentTarget.value)} aria-label="Filtrar categoría">
          <option value="">Todas</option>
          <option value="_extra">⚡ Extraordinarios</option>
          {CATEGORIES.map((c) => <option value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div class="btns" style="margin:0 0 12px">
        <button class="btn accent small" onClick={onScan}>📷 Escanear</button>
        <button class="btn small ghost" onClick={onManual}>✍️ Ingresar a mano</button>
      </div>
      {rs.length ? (
        <div class="card" style="padding-top:4px">
          <div class="day-head"><span>{rs.length} gastos</span><span>{clp(total)}</span></div>
          {Object.entries(days).map(([d, list]) => (
            <div>
              <div class="day-head"><span>{dateLong(d)}</span><span>{clp(list.reduce((a, b) => a + b.total, 0))}</span></div>
              <div class="list">{list.map((r) => <ReceiptRow r={r} extra={st.extras.has(r.id)} onClick={() => onEdit(r)} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div class="card empty"><span class="e">🔍</span><p>{st.count ? 'No hay gastos con ese filtro.' : 'Sin boletas en este mes.'}</p></div>
      )}
    </div>
  );
}
