import { useState } from 'preact/hooks';
import { MonthBars } from '../components/charts.jsx';
import { Tips, ReceiptRow } from './Home.jsx';
import { suggestions, summaryForAI } from '../lib/analytics.js';
import { aiAdvice } from '../platform/ai.js';
import { clp, pct, monthLabel } from '../lib/format.js';
import { catOf } from '../lib/categories.js';

export function Analysis({ st, months, history, settings, ai, setMonth, onEdit, onMarkExtra }) {
  const [aiTips, setAiTips] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const tips = suggestions(st, settings);
  const maxCat = Math.max(1, ...st.cats.map((c) => Math.max(c.total, settings.catBudgets?.[c.id] || 0)));

  async function askAI() {
    setBusy(true); setErr('');
    try { setAiTips(await aiAdvice(summaryForAI(st, months, settings), settings)); }
    catch (e) { setErr(e?.code === 'not_granted' ? 'No se otorgó permiso para usar Claude.' : e?.code === 'rate_limited' ? 'Demasiadas consultas; intenta en un rato.' : 'No se pudo obtener el análisis: ' + (e?.message || 'error')); }
    setBusy(false);
  }

  if (!st.count) return <div class="card empty"><span class="e">📊</span><p>No hay datos para analizar en <span style="text-transform:capitalize">{monthLabel(st.mk)}</span>.</p></div>;

  const cats = showAll ? st.cats : st.cats.slice(0, 6);
  return (
    <div>
      <div class="card">
        <div class="kpis">
          <div class="kpi"><small>Ticket promedio</small><b>{clp(st.avgTicket)}</b></div>
          <div class="kpi"><small>Recurrente</small><b>{clp(st.recurring)}</b></div>
          <div class="kpi"><small>Extraordinario</small><b>{clp(st.extraTotal)}</b></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Por categoría</h3><span class="sub">{st.prevMonths.length ? (st.trendReliable ? 'vs tu promedio a la misma fecha' : 'comparación disponible desde el día 7') : ''}</span></div>
        {cats.map((c) => {
          const cap = settings.catBudgets?.[c.id];
          return (
            <div class="cbar">
              <div class="top-l"><span>{c.icon} {c.name}</span><b>{clp(c.total)} <span class="muted small" style="font-weight:500">{pct(c.total, st.total)}%</span></b></div>
              <div class="track"><i class={cap && c.total > cap ? 'over' : ''} style={{ width: (c.total / maxCat) * 100 + '%' }} />{cap ? <u style={{ left: `calc(${(cap / maxCat) * 100}% - 1px)` }} title={'Tope ' + clp(cap)} /> : null}</div>
              {((st.trendReliable && c.prevAvg != null) || cap || c.recurring < c.total) ? (
                <div class="delta">
                  {c.recurring === 0 ? <span>Solo gasto extraordinario</span> : st.trendReliable && c.prevAvg != null ? (
                    c.prevAvg < 1000 ? <span>Nuevo este mes</span> : Math.abs(c.delta) < 0.05 ? <span>≈ igual que siempre · promedio {clp(c.prevAvg)}</span>
                      : <><span class={c.delta > 0 ? 'up' : 'down'}>{c.delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(c.delta * 100))}%</span><span> · promedio {clp(c.prevAvg)}</span></>
                  ) : null}
                  {c.recurring > 0 && c.recurring < c.total ? <span> · incluye {clp(c.total - c.recurring)} extraordinario</span> : null}
                  {cap ? <span> · tope {clp(cap)}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {st.cats.length > 6 && <button class="link" style="margin-top:8px" onClick={() => setShowAll(!showAll)}>{showAll ? 'Ver menos' : `Ver las ${st.cats.length} categorías`}</button>}
      </div>

      <div class="card">
        <div class="card-head"><h3>⚡ Gastos extraordinarios</h3><span class="sub">{clp(st.extraTotal)}</span></div>
        {st.extraRs.length ? st.extraRs.map((r) => (
          <div class="extra-row">
            <ReceiptRow r={r} onClick={() => onEdit(r)} />
            <div class="why">{st.extras.get(r.id)?.reason}</div>
            {r.extra == null && (
              <div class="acts">
                <button class="btn small ghost" onClick={() => onMarkExtra(r, true)}>✓ Sí, fue extraordinario</button>
                <button class="btn small ghost" onClick={() => onMarkExtra(r, false)}>Es normal</button>
              </div>
            )}
          </div>
        )) : <p class="muted small">No detecté gastos fuera de lo común este mes. Puedes marcar uno manualmente al editarlo.</p>}
        {st.extraRs.length > 0 && <p class="small muted" style="margin-top:8px">Revisar cada caso entrena la detección y suma a la insignia 🕵️ Detective.</p>}
      </div>

      <div class="card">
        <div class="card-head"><h3>Sugerencias</h3>{ai.mode && <button class="btn small ghost" disabled={busy} onClick={askAI}>{busy ? 'Pensando…' : '✨ Analizar con IA'}</button>}</div>
        <Tips tips={tips} />
        {err && <div class="notice">{err}</div>}
        {aiTips && (
          <>
            <div class="section-title" style="margin-left:0">✨ Recomendaciones de Claude</div>
            <Tips tips={aiTips.map((t) => ({ icon: '✨', tone: '', title: t.title, body: t.body, saving: Math.round(Number(t.saving) || 0) }))} />
          </>
        )}
      </div>

      <div class="card">
        <div class="card-head"><h3>Últimos 6 meses</h3><span class="sub">toca un mes para verlo</span></div>
        <MonthBars history={history} selected={st.mk} budget={settings.budget} onPick={setMonth} />
      </div>

      <div class="card">
        <div class="card-head"><h3>Dónde más gastas</h3></div>
        <div class="list">
          {st.merchants.map((m) => (
            <div class="row"><div class="ic">{catOf(m.category).icon}</div><div class="main"><div class="t">{m.name}</div><div class="s">{m.count} compra{m.count > 1 ? 's' : ''} · promedio {clp(m.total / m.count)}</div></div><div class="amt">{clp(m.total)}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
