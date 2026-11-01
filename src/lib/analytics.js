// Análisis mensual: totales, categorías, tendencias, gastos extraordinarios y sugerencias.
import { CATEGORIES, catOf } from './categories.js';
import { clp, median, sum, daysInMonth, monthKey, shiftMonth, todayISO, parseISO, normName, addDays, pct } from './format.js';

export const flatten = (months) => Object.values(months).flat().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

export function monthReceipts(months, mk) { return (months[mk] || []).slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))); }

export function byCategory(receipts) {
  const m = {};
  for (const r of receipts) m[r.category || 'otros'] = (m[r.category || 'otros'] || 0) + r.total;
  return Object.entries(m).map(([id, total]) => ({ id, total, ...catOf(id) })).sort((a, b) => b.total - a.total);
}

export function topMerchants(receipts, n = 5) {
  const m = {};
  for (const r of receipts) {
    const k = normName(r.merchant) || '(sin nombre)';
    m[k] = m[k] || { name: r.merchant || 'Sin nombre', total: 0, count: 0, category: r.category };
    m[k].total += r.total; m[k].count++;
  }
  return Object.values(m).sort((a, b) => b.total - a.total).slice(0, n);
}

// Gasto acumulado hasta el día "day" de un mes
const spentUntilDay = (rs, day) => sum(rs.filter((r) => Number(r.date.slice(8, 10)) <= day).map((r) => r.total));

// Días transcurridos del mes (si es el mes actual) o el mes completo
export function elapsedDays(mk) {
  const t = todayISO();
  if (monthKey(t) === mk) return Number(t.slice(8, 10));
  return mk < monthKey(t) ? daysInMonth(mk) : 0;
}

// ---------- Gastos extraordinarios ----------
export function detectExtraordinary(allRs, settings = {}) {
  const budget = settings.budget || 0;
  const out = new Map();
  const byCat = {};
  for (const r of allRs) (byCat[r.category || 'otros'] = byCat[r.category || 'otros'] || []).push(r);
  const byMerchant = {};
  for (const r of allRs) { const k = normName(r.merchant); if (k) (byMerchant[k] = byMerchant[k] || []).push(r); }
  const p75 = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * 0.75)]; };
  for (const r of allRs) {
    if (r.extra === false) continue;
    if (r.extra === true) { out.set(r.id, { reason: 'Marcado por ti como extraordinario', level: 'manual' }); continue; }
    if (r.total <= 0) continue;
    const from = addDays(r.date, -150), to = addDays(r.date, 30);
    const near = (x) => x.id !== r.id && x.date >= from && x.date <= to;
    const histCat = (byCat[r.category || 'otros'] || []).filter(near).map((x) => x.total);
    const histMer = (byMerchant[normName(r.merchant)] || []).filter(near).map((x) => x.total);
    const reasons = [];
    if (histMer.length >= 3) {
      const med = median(histMer);
      if (r.total >= Math.max(20000, med * 2.8)) reasons.push(`${(r.total / med).toFixed(1).replace('.', ',')}× lo que sueles gastar en ${r.merchant} (${clp(med)})`);
    } else if (histCat.length >= 4) {
      const base = p75(histCat);
      if (base > 0 && r.total >= Math.max(25000, base * 3)) reasons.push(`${(r.total / base).toFixed(1).replace('.', ',')}× un gasto alto habitual en ${catOf(r.category).name.toLowerCase()} (${clp(base)})`);
    }
    if (budget && r.total >= budget * 0.18) reasons.push(`Equivale al ${pct(r.total, budget)}% de tu presupuesto mensual`);
    if (!reasons.length && histCat.length === 0 && allRs.length >= 15 && r.total >= Math.max(30000, budget * 0.08)) reasons.push('Gasto alto en una categoría poco habitual para ti');
    if (reasons.length) out.set(r.id, { reason: reasons.join(' · '), level: 'auto' });
  }
  return out;
}

// ---------- Estadísticas del mes ----------
export function monthStats(months, mk, settings = {}) {
  const rs = months[mk] || [];
  const total = sum(rs.map((r) => r.total));
  const all = flatten(months);
  const extras = detectExtraordinary(all, settings);
  const extraRs = rs.filter((r) => extras.has(r.id));
  const extraTotal = sum(extraRs.map((r) => r.total));
  const dim = daysInMonth(mk);
  const el = elapsedDays(mk);
  const isCurrent = mk === monthKey(todayISO());
  const recurring = total - extraTotal;

  // Serie diaria acumulada
  const daily = Array.from({ length: dim }, (_, i) => sum(rs.filter((r) => Number(r.date.slice(8, 10)) === i + 1).map((r) => r.total)));
  let acc = 0; const cumulative = daily.map((d) => (acc += d));

  // Comparación con meses anteriores al mismo día
  // Meses anteriores "completos" (con suficientes boletas) para comparar
  const prev = [1, 2, 3].map((k) => shiftMonth(mk, -k)).filter((p) => (months[p] || []).length >= 8);
  const day = isCurrent ? el : dim;
  // Proyección de cierre: lo gastado + lo que sueles gastar el resto del mes (sin extraordinarios).
  // Sin historial, extrapola el ritmo actual (solo desde el día 5 para no exagerar).
  let projection = total;
  if (isCurrent && el > 0 && el < dim) {
    if (prev.length) {
      const rest = sum(prev.map((p) => sum(months[p].filter((r) => !extras.has(r.id) && Number(r.date.slice(8, 10)) > el).map((r) => r.total)))) / prev.length;
      const pace = el >= 10 ? (recurring / el) * (dim - el) : rest; // a mitad de mes mezcla ambos
      projection = Math.round(total + (el >= 10 ? (rest + pace) / 2 : rest));
    } else if (el >= 5) projection = Math.round(total + (recurring / el) * (dim - el));
    else projection = null;
  }
  const trendReliable = !isCurrent || el >= 7;
  const prevSameDay = prev.length ? sum(prev.map((p) => spentUntilDay(months[p], day))) / prev.length : null;
  const cats = byCategory(rs);
  // Las tendencias se miden sobre el gasto recurrente (sin extraordinarios) para no exagerar alzas
  const catTrend = cats.map((c) => {
    const rec = sum(rs.filter((r) => (r.category || 'otros') === c.id && !extras.has(r.id)).map((r) => r.total));
    const avg = prev.length ? sum(prev.map((p) => sum(months[p].filter((r) => (r.category || 'otros') === c.id && !extras.has(r.id) && Number(r.date.slice(8, 10)) <= day).map((r) => r.total)))) / prev.length : null;
    return { ...c, recurring: rec, prevAvg: avg, delta: avg ? (rec - avg) / avg : null };
  });

  return {
    mk, rs, total, count: rs.length, avgTicket: rs.length ? total / rs.length : 0,
    cats: catTrend, merchants: topMerchants(rs), extras, extraRs, extraTotal, recurring,
    dim, elapsed: el, isCurrent, projection, trendReliable, daily, cumulative, prevSameDay, prevMonths: prev,
    budget: settings.budget || 0,
  };
}

export function monthHistory(months, mk, n = 6) {
  return Array.from({ length: n }, (_, i) => shiftMonth(mk, i - n + 1)).map((m) => ({ mk: m, total: sum((months[m] || []).map((r) => r.total)), count: (months[m] || []).length }));
}

// ---------- Sugerencias automáticas ----------
export function suggestions(st, settings = {}) {
  const out = [];
  const { budget } = st;
  if (!st.count) return [{ icon: '📸', tone: 'info', title: 'Escanea tu primera boleta', body: 'Con 2 o 3 semanas de boletas podré mostrarte patrones y oportunidades de ahorro.' }];

  // Ritmo vs presupuesto
  if (budget && st.isCurrent && st.elapsed > 0 && st.projection != null) {
    const left = st.dim - st.elapsed;
    if (st.projection > budget) {
      const room = Math.max(0, budget - st.total);
      out.push({ icon: '🚦', tone: 'warn', title: `A este ritmo cerrarás en ${clp(st.projection)}`, body: `Eso es ${clp(st.projection - budget)} sobre tu presupuesto. Para cumplirlo, gasta máximo ${clp(left ? room / left : 0)} por día los ${left} días que quedan.` });
    } else {
      out.push({ icon: '🌱', tone: 'good', title: `Vas ${pct(budget - st.projection, budget)}% bajo tu presupuesto`, body: `Proyección de cierre: ${clp(st.projection)}. Si mantienes el ritmo podrías ahorrar ${clp(budget - st.projection)} este mes.`, saving: budget - st.projection });
    }
  }

  // Categorías que suben (las 3 con mayor alza en pesos)
  const rising = st.trendReliable ? st.cats.filter((c) => c.prevAvg && c.delta > 0.3 && c.recurring - c.prevAvg > 15000).sort((a, b) => (b.recurring - b.prevAvg) - (a.recurring - a.prevAvg)).slice(0, 3) : [];
  for (const c of rising) {
    {
      out.push({ icon: c.icon, tone: 'warn', title: `${c.name}: +${Math.round(c.delta * 100)}% vs tu promedio`, body: `Llevas ${clp(c.recurring)} (sin extraordinarios) y a esta altura del mes sueles llevar ${clp(c.prevAvg)}. Volver a tu nivel habitual = ${clp(c.recurring - c.prevAvg)} menos.`, saving: Math.round(c.recurring - c.prevAvg) });
    }
  }
  for (const c of st.cats) {
    const cap = settings.catBudgets?.[c.id];
    if (cap && c.total > cap) out.push({ icon: '⛔', tone: 'warn', title: `Superaste tu tope de ${c.name.toLowerCase()}`, body: `Tope ${clp(cap)}, llevas ${clp(c.total)} (${clp(c.total - cap)} de exceso).` });
    else if (cap && c.total > cap * 0.8) out.push({ icon: '⚠️', tone: 'warn', title: `${c.name}: ${pct(c.total, cap)}% del tope`, body: `Te quedan ${clp(cap - c.total)} para el resto del mes.` });
  }

  // Compras hormiga
  const small = st.rs.filter((r) => r.total > 0 && r.total <= 5000);
  if (small.length >= 8) {
    const t = sum(small.map((r) => r.total));
    out.push({ icon: '🐜', tone: 'info', title: `${small.length} compras hormiga suman ${clp(t)}`, body: `Son compras de menos de $5.000. Reducirlas a la mitad te ahorraría cerca de ${clp(t / 2)} al mes.`, saving: Math.round(t / 2) });
  }

  // Delivery
  const deliv = st.cats.find((c) => c.id === 'delivery');
  if (deliv && deliv.total >= 25000) {
    const n = st.rs.filter((r) => r.category === 'delivery').length;
    out.push({ icon: '🛵', tone: 'info', title: `${n} pedidos de delivery (${clp(deliv.total)})`, body: `Cocinar en casa la mitad de esas veces podría ahorrarte ~${clp(deliv.total * 0.3)} (considerando el costo de los ingredientes).`, saving: Math.round(deliv.total * 0.3) });
  }

  // Muchas idas al súper
  const superRs = st.rs.filter((r) => r.category === 'super');
  if (superRs.length >= 12) {
    out.push({ icon: '🧺', tone: 'info', title: `Fuiste ${superRs.length} veces al supermercado`, body: 'Planificar una compra grande semanal con lista suele reducir el gasto entre 10% y 15% por compras impulsivas.', saving: Math.round(sum(superRs.map((r) => r.total)) * 0.1) });
  }

  // Fin de semana
  const we = st.rs.filter((r) => [0, 5, 6].includes(parseISO(r.date).getDay()));
  const weT = sum(we.map((r) => r.total));
  if (st.total > 0 && weT / st.total > 0.55 && st.count >= 10) out.push({ icon: '📅', tone: 'info', title: `El ${pct(weT, st.total)}% de tu gasto es viernes a domingo`, body: 'Define un monto fijo para el fin de semana y llévalo en una cuenta aparte o en efectivo.' });

  // Extraordinarios
  if (st.extraRs.length) out.push({ icon: '🔎', tone: 'info', title: `${st.extraRs.length} gasto${st.extraRs.length > 1 ? 's' : ''} extraordinario${st.extraRs.length > 1 ? 's' : ''}: ${clp(st.extraTotal)}`, body: `Sin ellos, tu gasto recurrente del mes es ${clp(st.recurring)}. Revisa si eran planificados o conviene crear un fondo para imprevistos.` });

  // Comercio más frecuente
  const top = st.merchants[0];
  if (top && top.count >= 6) out.push({ icon: '🏪', tone: 'info', title: `Tu comercio más frecuente: ${top.name}`, body: `${top.count} compras por ${clp(top.total)}. Revisa si tiene programa de puntos o descuentos con tu banco.` });

  if (!budget) out.push({ icon: '🎯', tone: 'info', title: 'Define un presupuesto mensual', body: 'Con un presupuesto puedo proyectar tu cierre de mes, avisarte a tiempo y darte XP por cumplirlo.' });
  return out;
}

// Resumen compacto y sin datos personales para pedir consejos a la IA
export function summaryForAI(st, months, settings) {
  return {
    mes: st.mk, dias_transcurridos: st.elapsed, dias_mes: st.dim,
    presupuesto: settings.budget || null, gasto_total: st.total, proyeccion_cierre: st.projection,
    boletas: st.count, ticket_promedio: Math.round(st.avgTicket),
    por_categoria: st.cats.map((c) => ({ categoria: c.name, total: c.total, promedio_meses_anteriores_misma_fecha: c.prevAvg ? Math.round(c.prevAvg) : null })),
    comercios_top: st.merchants.map((m) => ({ comercio: m.name, compras: m.count, total: m.total })),
    extraordinarios: st.extraRs.map((r) => ({ comercio: r.merchant, categoria: catOf(r.category).name, monto: r.total })),
    historial_meses: Object.keys(months).sort().slice(-6).map((m) => ({ mes: m, total: sum(months[m].map((r) => r.total)) })),
  };
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
