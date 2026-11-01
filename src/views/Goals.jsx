import { useState } from 'preact/hooks';
import { LevelCard } from './Home.jsx';
import { Sheet, MoneyInput, Ring } from '../components/ui.jsx';
import { CHALLENGE_TEMPLATES, lastMonthSaving } from '../lib/gamification.js';
import { CATEGORIES, catOf } from '../lib/categories.js';
import { clp, todayISO, uid, pct, monthLabel, daysBetween, dateLabel } from '../lib/format.js';

const GOAL_ICONS = ['✈️', '🏖️', '🚗', '🏠', '🎓', '💻', '🛟', '🎁', '💍', '🐷'];

export function Goals({ settings, game, months, st, update, toast }) {
  const [sheet, setSheet] = useState(null);
  const [showXp, setShowXp] = useState(false);
  const goals = settings.goals || [];
  const last = lastMonthSaving(months, settings);
  const startChallenge = (tpl, amount) => {
    const ch = { id: uid(), key: tpl.key, type: tpl.type, cat: tpl.cat, days: tpl.days, count: tpl.count, max: tpl.max, amount, reward: tpl.reward, title: tpl.title, start: todayISO() };
    update({ challenges: [...(settings.challenges || []), ch] });
    setSheet(null); toast(`⚔️ Reto iniciado: ${tpl.title}`);
  };
  const challenges = game.challenges.slice().sort((a, b) => ({ active: 0, won: 1, failed: 2 }[a.status] - { active: 0, won: 1, failed: 2 }[b.status]) || b.start.localeCompare(a.start));
  const activeKeys = new Set(challenges.filter((c) => c.status === 'active').map((c) => c.key));

  return (
    <div>
      <LevelCard game={game} />
      <div style="margin:-6px 0 14px;text-align:right"><button class="link" onClick={() => setShowXp(!showXp)}>{showXp ? 'Ocultar' : '¿Cómo gano XP?'}</button></div>
      {showXp && (
        <div class="card"><h3>Tu XP</h3>
          <div class="xpparts">{game.xpParts.map((p) => <div><span>{p.label}</span><b>{p.xp.toLocaleString('es-CL')} XP</b></div>)}</div>
          <p class="small muted">+10 por boleta (+5 si la escaneas) · +5 por día sin gasto · +150 por mes bajo presupuesto · retos y metas suman más. La racha 🔥 cuenta los días seguidos en que tu gasto acumulado va bajo el ritmo del presupuesto.</p>
        </div>
      )}

      <div class="section-title">Presupuesto</div>
      <div class="card">
        <div class="card-head"><h3>🎯 {settings.budget ? clp(settings.budget) + ' al mes' : 'Sin presupuesto'}</h3><button class="link" onClick={() => setSheet({ t: 'budget' })}>{settings.budget ? 'Editar' : 'Definir'}</button></div>
        {settings.budget > 0 && st.isCurrent && <p class="sub" style="margin:0">Llevas {pct(st.total, settings.budget)}% · vas en el día {st.elapsed} de {st.dim} ({pct(st.elapsed, st.dim)}% del mes)</p>}
        {Object.keys(settings.catBudgets || {}).length > 0 && (
          <div style="margin-top:10px">
            {Object.entries(settings.catBudgets).map(([id, cap]) => {
              const spent = st.cats.find((c) => c.id === id)?.total || 0;
              return <div class="cbar"><div class="top-l"><span>{catOf(id).icon} {catOf(id).name}</span><b>{clp(spent)} / {clp(cap)}</b></div><div class="track"><i class={spent > cap ? 'over' : ''} style={{ width: Math.min(100, (spent / cap) * 100) + '%' }} /></div></div>;
            })}
          </div>
        )}
        {last && !last.already && last.saving > 0 && goals.length > 0 && (
          <div class="notice ok" style="margin-top:12px">
            🎉 En <span style="text-transform:capitalize">{monthLabel(last.mk)}</span> te sobraron {clp(last.saving)} del presupuesto.
            <div class="btns" style="margin-top:8px"><button class="btn small primary" onClick={() => setSheet({ t: 'abono', amount: last.saving, mk: last.mk })}>Abonar a una meta</button></div>
          </div>
        )}
      </div>

      <div class="section-title">Metas de ahorro</div>
      <div class="card">
        {goals.length ? goals.map((g) => {
          const p = g.target ? (g.saved || 0) / g.target : 0;
          const daysLeft = g.deadline ? daysBetween(todayISO(), g.deadline) : null;
          const perMonth = daysLeft > 0 ? Math.max(0, (g.target - (g.saved || 0)) / Math.max(1, daysLeft / 30)) : null;
          return (
            <div class="goal">
              <div class="gh"><span class="e">{g.icon}</span><div class="n">{g.name}<small>{clp(g.saved || 0)} de {clp(g.target)}{daysLeft != null ? ` · ${daysLeft > 0 ? `${daysLeft} días` : 'plazo vencido'}` : ''}</small></div><b>{Math.round(p * 100)}%</b></div>
              <div class="gbar"><i style={{ width: Math.min(100, p * 100) + '%' }} /></div>
              {p >= 1 ? <p class="small" style="margin:0;color:var(--good);font-weight:700">🏁 ¡Meta cumplida!</p> : perMonth ? <p class="small muted" style="margin:0">Necesitas ahorrar ~{clp(perMonth)} al mes para llegar a tiempo.</p> : null}
              <div class="btns" style="margin-top:8px"><button class="btn small primary" onClick={() => setSheet({ t: 'abono', goalId: g.id })}>+ Aportar</button><button class="btn small ghost" onClick={() => setSheet({ t: 'goal', goal: g })}>Editar</button></div>
            </div>
          );
        }) : <p class="muted small" style="margin:0 0 8px">Ponle nombre y monto a lo que quieres lograr: un viaje, un fondo de emergencia, un computador…</p>}
        <button class="btn block ghost" style="margin-top:8px" onClick={() => setSheet({ t: 'goal' })}>+ Nueva meta</button>
      </div>

      <div class="section-title">Retos</div>
      <div class="card">
        {challenges.length ? challenges.slice(0, 8).map((c) => (
          <div class="chal">
            <Ring value={c.progress} color={c.status === 'won' ? 'var(--good)' : c.status === 'failed' ? 'var(--bad)' : 'var(--xp)'}>{c.status === 'won' ? '🏆' : c.status === 'failed' ? '✗' : '⚔️'}</Ring>
            <div class="main"><b>{c.title}</b><small>{c.detail}</small><small>{dateLabel(c.start)} → {dateLabel(c.end)} · +{c.reward} XP</small></div>
            <span class={'st ' + c.status}>{c.status === 'active' ? 'En curso' : c.status === 'won' ? 'Ganado' : 'Perdido'}</span>
          </div>
        )) : <p class="muted small" style="margin:0 0 8px">Los retos son desafíos cortos que te dan XP extra. ¡Elige uno!</p>}
        <div class="tpl" style="margin-top:10px">
          {CHALLENGE_TEMPLATES.filter((t) => !activeKeys.has(t.key)).map((t) => (
            <button onClick={() => (t.needsAmount ? setSheet({ t: 'chal', tpl: t }) : startChallenge(t))}><b>{t.title}</b><small>{t.desc}</small><span class="xp">+{t.reward} XP</span></button>
          ))}
        </div>
      </div>

      <div class="section-title">Insignias · {game.badges.filter((b) => b.got).length}/{game.badges.length}</div>
      <div class="card">
        <div class="badges">{game.badges.map((b) => <div class={'bdg' + (b.got ? '' : ' off')}><span class="e">{b.icon}</span><b>{b.name}</b><small>{b.desc}</small></div>)}</div>
      </div>

      {sheet?.t === 'budget' && <BudgetSheet settings={settings} st={st} onClose={() => setSheet(null)} onSave={(p) => { update(p); setSheet(null); toast('Presupuesto guardado'); }} />}
      {sheet?.t === 'goal' && <GoalSheet goal={sheet.goal} onClose={() => setSheet(null)}
        onSave={(g) => { update({ goals: sheet.goal ? goals.map((x) => (x.id === g.id ? g : x)) : [...goals, g] }); setSheet(null); }}
        onDelete={(g) => { update({ goals: goals.filter((x) => x.id !== g.id) }); setSheet(null); }} />}
      {sheet?.t === 'abono' && <AbonoSheet goals={goals} goalId={sheet.goalId} amount={sheet.amount} onClose={() => setSheet(null)}
        onSave={(gid, amount) => {
          const ng = goals.map((g) => (g.id === gid ? { ...g, saved: (g.saved || 0) + amount, contributions: [...(g.contributions || []), { date: todayISO(), amount }] } : g));
          const patch = { goals: ng };
          if (sheet.mk) patch.closedMonths = { ...(settings.closedMonths || {}), [sheet.mk]: amount };
          update(patch); setSheet(null); toast(`🐷 Aporte de ${clp(amount)} · +15 XP`);
        }} />}
      {sheet?.t === 'chal' && <ChalSheet tpl={sheet.tpl} st={st} onClose={() => setSheet(null)} onStart={(a) => startChallenge(sheet.tpl, a)} />}
    </div>
  );
}

function BudgetSheet({ settings, st, onSave, onClose }) {
  const [budget, setBudget] = useState(settings.budget || 0);
  const [caps, setCaps] = useState({ ...(settings.catBudgets || {}) });
  return (
    <Sheet onClose={onClose}>
      <h2>Presupuesto mensual</h2>
      <p class="lead">¿Cuánto quieres gastar como máximo al mes? Opcionalmente, ponle tope a algunas categorías.</p>
      <label for="b-t">Presupuesto total</label>
      <MoneyInput id="b-t" value={budget} onChange={setBudget} />
      {st.total > 0 && <p class="small muted">Este mes llevas {clp(st.total)}.</p>}
      <label>Topes por categoría (opcional)</label>
      {CATEGORIES.filter((c) => c.id !== 'otros').map((c) => (
        <div class="grid2" style="align-items:center;margin-bottom:6px"><span style="font-size:14px">{c.icon} {c.name}</span><MoneyInput value={caps[c.id] || 0} placeholder="Sin tope" onChange={(v) => setCaps({ ...caps, [c.id]: v })} /></div>
      ))}
      <div class="btns"><button class="btn ghost" onClick={onClose}>Cancelar</button>
        <button class="btn primary" onClick={() => onSave({ budget, catBudgets: Object.fromEntries(Object.entries(caps).filter(([, v]) => v > 0)) })}>Guardar</button></div>
    </Sheet>
  );
}

function GoalSheet({ goal, onSave, onDelete, onClose }) {
  const [g, setG] = useState(goal || { id: uid(), name: '', target: 0, saved: 0, deadline: '', icon: '✈️', contributions: [] });
  return (
    <Sheet onClose={onClose}>
      <h2>{goal ? 'Editar meta' : 'Nueva meta de ahorro'}</h2>
      <label>Ícono</label>
      <div class="cats">{GOAL_ICONS.map((i) => <button type="button" class={g.icon === i ? 'on' : ''} onClick={() => setG({ ...g, icon: i })}>{i}</button>)}</div>
      <label for="g-n">Nombre</label>
      <input id="g-n" value={g.name} placeholder="Ej: Vacaciones en el sur" onInput={(e) => setG({ ...g, name: e.currentTarget.value })} />
      <div class="grid2">
        <div><label for="g-t">Monto objetivo</label><MoneyInput id="g-t" value={g.target} onChange={(v) => setG({ ...g, target: v })} /></div>
        <div><label for="g-d">Fecha límite</label><input id="g-d" type="date" value={g.deadline} min={todayISO()} onInput={(e) => setG({ ...g, deadline: e.currentTarget.value })} /></div>
      </div>
      {!goal && <><label for="g-s">Ya tengo ahorrado</label><MoneyInput id="g-s" value={g.saved} onChange={(v) => setG({ ...g, saved: v })} /></>}
      <div class="btns">
        {goal && <button class="btn danger" style="flex:0 0 auto" onClick={() => onDelete(goal)} aria-label="Eliminar meta">🗑️</button>}
        <button class="btn ghost" onClick={onClose}>Cancelar</button>
        <button class="btn primary" disabled={!g.name || !g.target} onClick={() => onSave(g)}>Guardar</button>
      </div>
    </Sheet>
  );
}

function AbonoSheet({ goals, goalId, amount, onSave, onClose }) {
  const [gid, setGid] = useState(goalId || goals[0]?.id);
  const [a, setA] = useState(amount || 0);
  return (
    <Sheet onClose={onClose}>
      <h2>Aportar a una meta</h2>
      <label>Meta</label>
      <div class="cats">{goals.map((g) => <button type="button" class={gid === g.id ? 'on' : ''} onClick={() => setGid(g.id)}>{g.icon} {g.name}</button>)}</div>
      <label for="a-m">Monto</label>
      <MoneyInput id="a-m" value={a} onChange={setA} />
      <div class="btns"><button class="btn ghost" onClick={onClose}>Cancelar</button><button class="btn primary" disabled={!a || !gid} onClick={() => onSave(gid, a)}>Aportar · +15 XP</button></div>
    </Sheet>
  );
}

function ChalSheet({ tpl, st, onStart, onClose }) {
  const weekly = tpl.type === 'cap_cat' ? (st.cats.find((c) => c.id === tpl.cat)?.recurring || 0) / Math.max(1, st.elapsed || st.dim) * 7 : (st.recurring / Math.max(1, st.elapsed || st.dim)) * 7;
  const suggested = Math.round((weekly * 0.85) / 1000) * 1000 || 50000;
  const [a, setA] = useState(suggested);
  return (
    <Sheet onClose={onClose}>
      <h2>{tpl.title}</h2>
      <p class="lead">{tpl.desc}. {weekly > 0 ? `Tu promedio semanal es ~${clp(weekly)}; te sugiero un tope 15% menor.` : ''}</p>
      <label for="c-a">Tope para los próximos {tpl.days} días</label>
      <MoneyInput id="c-a" value={a} onChange={setA} />
      <div class="btns"><button class="btn ghost" onClick={onClose}>Cancelar</button><button class="btn primary" disabled={!a} onClick={() => onStart(a)}>Empezar reto</button></div>
    </Sheet>
  );
}
