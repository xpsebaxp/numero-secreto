import { CumulativeChart } from '../components/charts.jsx';
import { clp, dateLabel, pct } from '../lib/format.js';
import { catOf } from '../lib/categories.js';
import { suggestions } from '../lib/analytics.js';

export function LevelCard({ game, compact }) {
  const { level, xp, streak } = game;
  return (
    <div class="card">
      <div class="level">
        <div class="badge-lv">{level.icon}</div>
        <div class="info">
          <div class="name">Nivel {level.n} · {level.name}</div>
          <div class="xpline">{xp.toLocaleString('es-CL')} XP{level.next ? ` · faltan ${(level.next.xp - xp).toLocaleString('es-CL')} para ${level.next.name}` : ' · nivel máximo'}</div>
          <div class="xpbar"><i style={{ width: Math.round(level.progress * 100) + '%' }} /></div>
        </div>
        {!compact || streak > 0 ? <div class="streak"><b>🔥 {streak}</b><small>días en ritmo</small></div> : null}
      </div>
    </div>
  );
}

export function ReceiptRow({ r, extra, onClick }) {
  const c = catOf(r.category);
  return (
    <button class="row" onClick={onClick}>
      <div class="ic" aria-hidden="true">{c.icon}</div>
      <div class="main">
        <div class="t">{r.merchant || c.name}</div>
        <div class="s">{dateLabel(r.date)}{r.time ? ' · ' + r.time : ''} · {c.name}{extra ? ' ' : ''}{extra && <span class="tag extra">extraordinario</span>}</div>
      </div>
      <div class={'amt' + (r.total < 0 ? ' neg' : '')}>{clp(r.total)}</div>
    </button>
  );
}

export function Tips({ tips }) {
  return tips.map((t) => (
    <div class={'tip ' + (t.tone || '')}>
      <div class="ti" aria-hidden="true">{t.icon}</div>
      <div><b>{t.title}</b><p>{t.body}</p>{t.saving > 0 && <span class="save">Ahorro posible: {clp(t.saving)}/mes</span>}</div>
    </div>
  ));
}

export function Home({ st, settings, game, prevCumulative, onEdit, onScan, go }) {
  const b = st.budget;
  const used = b ? st.total / b : 0;
  const pacePos = b && st.isCurrent ? st.elapsed / st.dim : null;
  const tips = suggestions(st, settings).sort((a, c) => (c.tone === 'warn') - (a.tone === 'warn')).slice(0, 3);
  const active = game.challenges.filter((c) => c.status === 'active');

  return (
    <div>
      <div class="hero">
        <div class="label">Gastado {st.isCurrent ? 'este mes' : 'en el mes'}</div>
        <div class="big">{clp(st.total)}</div>
        {b > 0 ? (
          <>
            <div class="bar" aria-label={`${pct(st.total, b)}% del presupuesto`}>
              <i class={used > 1 ? 'over' : ''} style={{ width: Math.min(100, used * 100) + '%' }} />
              {pacePos != null && <b style={{ left: pacePos * 100 + '%' }} title="Hoy" />}
            </div>
            <div class="meta"><span>{pct(st.total, b)}% de {clp(b)}</span><span>{st.total <= b ? `Quedan ${clp(b - st.total)}` : `Excedido ${clp(st.total - b)}`}</span></div>
          </>
        ) : <div class="meta"><a href="#metas" style="color:#fff;font-weight:700">Define tu presupuesto →</a></div>}
        <div class="chips">
          <span class="chip">🧾 {st.count} boletas</span>
          {st.isCurrent && st.projection != null && st.count > 0 && <span class="chip">📈 Cierre estimado {clp(st.projection)}</span>}
          {st.extraTotal > 0 && <span class="chip">⚡ {clp(st.extraTotal)} extraordinarios</span>}
        </div>
      </div>

      <LevelCard game={game} compact />

      {st.count > 0 ? (
        <>
          <div class="card">
            <div style="margin-bottom:12px"><h3>Cómo va el mes</h3>{st.prevSameDay != null && (!st.isCurrent || st.elapsed >= 3) && <div class="sub">{st.total > st.prevSameDay ? '▲' : '▼'} {clp(Math.abs(st.total - st.prevSameDay))} {st.total > st.prevSameDay ? 'más' : 'menos'} que tu promedio a esta fecha</div>}</div>
            <CumulativeChart st={st} prevCumulative={prevCumulative} />
          </div>

          <div class="card">
            <div class="card-head"><h3>Sugerencias</h3><a href="#analisis">Ver análisis</a></div>
            <Tips tips={tips} />
          </div>

          {active.length > 0 && (
            <div class="card">
              <div class="card-head"><h3>Retos activos</h3><a href="#metas">Ver todos</a></div>
              {active.slice(0, 2).map((c) => <div class="tip"><div class="ti">⚔️</div><div><b>{c.title}</b><p>{c.detail} · +{c.reward} XP</p></div></div>)}
            </div>
          )}

          <div class="card">
            <div class="card-head"><h3>Últimos gastos</h3><a href="#boletas">Ver todos</a></div>
            <div class="list">{st.rs.slice(0, 5).map((r) => <ReceiptRow r={r} extra={st.extras.has(r.id)} onClick={() => onEdit(r)} />)}</div>
          </div>
        </>
      ) : (
        <div class="card empty">
          <span class="e">🧾</span>
          <b>Aún no hay boletas en este mes</b>
          <p>Escanea una boleta y la app leerá el total, la fecha y el comercio desde el timbre electrónico.</p>
          <button class="btn accent" onClick={onScan}>📷 Escanear boleta</button>
          <p class="small" style="margin-top:14px">¿Quieres ver cómo funciona? <button class="link" onClick={() => go('ajustes')}>Carga datos de ejemplo</button></p>
        </div>
      )}
    </div>
  );
}
