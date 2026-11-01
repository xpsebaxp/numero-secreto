// Gamificación: XP, niveles, racha, retos e insignias. Todo se calcula a partir de los datos
// (no hay contadores sueltos), así nunca se desincroniza.
import { flatten } from './analytics.js';
import { sum, todayISO, addDays, monthKey, daysInMonth, shiftMonth, clp } from './format.js';
import { catOf } from './categories.js';

export const LEVELS = [
  { xp: 0, name: 'Aprendiz', icon: '🌱' },
  { xp: 120, name: 'Anotador', icon: '📝' },
  { xp: 300, name: 'Ordenado', icon: '🗂️' },
  { xp: 600, name: 'Estratega', icon: '♟️' },
  { xp: 1000, name: 'Ahorrador', icon: '🐷' },
  { xp: 1600, name: 'Ahorrador Pro', icon: '💎' },
  { xp: 2400, name: 'Maestro de las lucas', icon: '🧙' },
  { xp: 3500, name: 'Leyenda financiera', icon: '🏆' },
];

export const CHALLENGE_TEMPLATES = [
  { key: 'no_delivery7', type: 'no_cat', cat: 'delivery', days: 7, reward: 80, title: 'Semana sin delivery', desc: '7 días sin pedir delivery' },
  { key: 'no_comida5', type: 'no_cat', cat: 'comida', days: 5, reward: 60, title: 'Cocina en casa', desc: '5 días sin restaurantes ni café' },
  { key: 'no_spend4', type: 'no_spend_days', count: 4, days: 14, reward: 90, title: 'Días en cero', desc: '4 días sin ningún gasto en 2 semanas' },
  { key: 'hormiga', type: 'small_cap', max: 5000, count: 4, days: 7, reward: 70, title: 'Cero hormigas', desc: 'Máximo 4 compras menores a $5.000 en 7 días' },
  { key: 'super_cap', type: 'cap_cat', cat: 'super', days: 7, reward: 80, title: 'Súper con lista', desc: 'Supermercado bajo un tope semanal', needsAmount: true },
  { key: 'cap_total', type: 'cap_total', days: 7, reward: 100, title: 'Semana austera', desc: 'Gasto total de la semana bajo un tope', needsAmount: true },
];

const inWindow = (r, start, end) => r.date >= start && r.date <= end;

export function evalChallenge(ch, all) {
  const today = todayISO();
  const end = addDays(ch.start, ch.days - 1);
  const rs = all.filter((r) => inWindow(r, ch.start, end));
  const elapsed = Math.max(0, Math.min(ch.days, Math.round((new Date(today) - new Date(ch.start)) / 86400000) + 1));
  const over = today > end;
  let ok = true, progress = 0, detail = '';
  switch (ch.type) {
    case 'no_cat': {
      const hits = rs.filter((r) => r.category === ch.cat);
      ok = hits.length === 0; progress = ok ? elapsed / ch.days : 0;
      detail = ok ? `${elapsed} de ${ch.days} días sin ${catOf(ch.cat).name.toLowerCase()}` : `Registraste ${hits.length} gasto(s) en ${catOf(ch.cat).name.toLowerCase()}`;
      break;
    }
    case 'cap_cat':
    case 'cap_total': {
      const t = sum(rs.filter((r) => ch.type === 'cap_total' || r.category === ch.cat).map((r) => r.total));
      ok = t <= ch.amount; progress = ok ? elapsed / ch.days : 1;
      detail = `${clp(t)} de ${clp(ch.amount)}`;
      break;
    }
    case 'small_cap': {
      const n = rs.filter((r) => r.total > 0 && r.total < ch.max).length;
      ok = n <= ch.count; progress = ok ? elapsed / ch.days : 1;
      detail = `${n} de ${ch.count} compras chicas permitidas`;
      break;
    }
    case 'no_spend_days': {
      const days = new Set(rs.map((r) => r.date));
      let zero = 0;
      for (let i = 0; i < elapsed; i++) { const d = addDays(ch.start, i); if (d < today && !days.has(d)) zero++; }
      const remaining = ch.days - elapsed + (days.has(today) ? 0 : 1);
      progress = Math.min(1, zero / ch.count);
      if (zero >= ch.count) { return { ...ch, end, status: 'won', progress: 1, detail: `${zero} días en cero ✔` }; }
      ok = zero + remaining >= ch.count;
      detail = `${zero} de ${ch.count} días sin gastos`;
      if (over) return { ...ch, end, status: 'failed', progress, detail };
      return { ...ch, end, status: ok ? 'active' : 'failed', progress, detail };
    }
    default: break;
  }
  const status = !ok ? 'failed' : over ? 'won' : 'active';
  return { ...ch, end, status, progress: status === 'won' ? 1 : progress, detail };
}

function noSpendDays(all) {
  if (!all.length) return 0;
  const first = all[0].date; const today = todayISO();
  const days = new Set(all.map((r) => r.date));
  let n = 0;
  for (let d = first; d < today; d = addDays(d, 1)) if (!days.has(d)) n++;
  return n;
}

// Racha: días seguidos (hasta hoy) en que tu gasto acumulado del mes estuvo bajo el ritmo del presupuesto
export function paceStreak(months, budget) {
  if (!budget) return 0;
  let streak = 0; let day = todayISO();
  for (let guard = 0; guard < 400; guard++) {
    const mk = monthKey(day); const d = Number(day.slice(8, 10));
    const rs = months[mk] || [];
    const spent = sum(rs.filter((r) => Number(r.date.slice(8, 10)) <= d).map((r) => r.total));
    if (!rs.length && mk !== monthKey(todayISO())) break;
    if (spent <= (budget * d) / daysInMonth(mk)) streak++; else break;
    day = addDays(day, -1);
  }
  return streak;
}

export function computeGame(months, settings) {
  const all = flatten(months);
  const budget = settings.budget || 0;
  const challenges = (settings.challenges || []).map((c) => evalChallenge(c, all));
  const won = challenges.filter((c) => c.status === 'won');
  const goals = settings.goals || [];
  const goalsDone = goals.filter((g) => (g.saved || 0) >= g.target && g.target > 0);
  const contributions = sum(goals.map((g) => (g.contributions || []).length));
  const nsd = noSpendDays(all);
  const nowMk = monthKey(todayISO());
  const closedUnder = budget ? Object.keys(months).filter((mk) => mk < nowMk && months[mk].length >= 5 && sum(months[mk].map((r) => r.total)) <= budget) : [];
  const scanned = all.filter((r) => ['ted', 'ai', 'ocr'].includes(r.source)).length;
  const reviewedExtra = all.filter((r) => r.extra === true || r.extra === false).length;
  const streak = paceStreak(months, budget);

  const xpParts = [
    { label: 'Boletas registradas', xp: all.length * 10 },
    { label: 'Bonus por escanear', xp: scanned * 5 },
    { label: 'Días sin gasto', xp: nsd * 5 },
    { label: 'Meses bajo presupuesto', xp: closedUnder.length * 150 },
    { label: 'Retos ganados', xp: sum(won.map((c) => c.reward || 50)) },
    { label: 'Aportes a metas', xp: contributions * 15 },
    { label: 'Metas cumplidas', xp: goalsDone.length * 200 },
  ];
  const xp = sum(xpParts.map((p) => p.xp));
  let li = 0; LEVELS.forEach((l, i) => { if (xp >= l.xp) li = i; });
  const level = { ...LEVELS[li], n: li + 1, next: LEVELS[li + 1] || null };
  level.progress = level.next ? (xp - level.xp) / (level.next.xp - level.xp) : 1;

  const B = (id, icon, name, desc, got) => ({ id, icon, name, desc, got: !!got });
  const badges = [
    B('first', '🧾', 'Primera boleta', 'Registra tu primera boleta', all.length >= 1),
    B('ten', '📚', 'Coleccionista', 'Registra 10 boletas', all.length >= 10),
    B('fifty', '🗄️', 'Archivista', 'Registra 50 boletas', all.length >= 50),
    B('hundred', '🏛️', 'Contador oficial', 'Registra 100 boletas', all.length >= 100),
    B('scanner', '📷', 'Escáner', 'Escanea 5 boletas', scanned >= 5),
    B('budget', '🎯', 'Con rumbo', 'Define tu presupuesto mensual', budget > 0),
    B('detective', '🕵️', 'Detective', 'Revisa 3 gastos extraordinarios', reviewedExtra >= 3),
    B('zero5', '🧘', 'Zen', 'Acumula 5 días sin gasto', nsd >= 5),
    B('streak7', '🔥', 'En racha', '7 días seguidos bajo tu ritmo de presupuesto', streak >= 7),
    B('streak30', '☄️', 'Imparable', '30 días seguidos bajo tu ritmo', streak >= 30),
    B('challenger', '⚔️', 'Retador', 'Gana tu primer reto', won.length >= 1),
    B('champion', '🥇', 'Campeón', 'Gana 5 retos', won.length >= 5),
    B('green', '💚', 'Mes verde', 'Cierra un mes bajo presupuesto', closedUnder.length >= 1),
    B('saver', '🐷', 'Alcancía', 'Haz tu primer aporte a una meta', contributions >= 1),
    B('goal', '🏁', 'Meta cumplida', 'Completa una meta de ahorro', goalsDone.length >= 1),
  ];

  return { xp, xpParts, level, badges, challenges, streak, noSpendDays: nsd, closedUnder, goalsDone };
}

// Ahorro disponible de un mes cerrado (presupuesto - gasto) para abonar a metas
export function lastMonthSaving(months, settings) {
  const budget = settings.budget || 0;
  const mk = shiftMonth(monthKey(todayISO()), -1);
  const rs = months[mk] || [];
  if (!budget || !rs.length) return null;
  const spent = sum(rs.map((r) => r.total));
  const already = (settings.closedMonths || {})[mk];
  return { mk, saving: Math.max(0, budget - spent), spent, already: already != null };
}
