import { useState, useRef } from 'preact/hooks';
import { clp, clpShort, monthLabelShort, monthLabel } from '../lib/format.js';

const niceMax = (v) => {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

// Gasto acumulado del mes vs ritmo del presupuesto (línea de referencia) y promedio de meses anteriores
export function CumulativeChart({ st, prevCumulative }) {
  const W = 340, H = 170, L = 6, R = 40, T = 10, B = 22;
  const days = st.dim; const upTo = st.isCurrent ? st.elapsed : st.dim;
  const data = st.cumulative.slice(0, upTo);
  const maxV = niceMax(Math.max(st.budget || 0, ...data, ...(prevCumulative || []), 1));
  const x = (i) => L + (i / (days - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / maxV) * (H - T - B);
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const ref = useRef();

  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const prevLine = prevCumulative ? prevCumulative.slice(0, days).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') : '';
  const ticks = [0, maxV / 2, maxV];

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(upTo - 1, Math.round(((px - L) / (W - L - R)) * (days - 1))));
    setHover(i);
  };

  if (!data.length) return <p class="muted small">Aún no hay gastos este mes.</p>;
  const hv = hover != null ? { i: hover, v: data[hover], px: (x(hover) / W) * 100, py: (y(data[hover]) / H) * 100 } : null;

  return (
    <div class="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gasto acumulado: ${clp(data[data.length - 1])} al día ${upTo}`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => <g><line class="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text class="axis" x={W - R + 6} y={y(t) + 3.5}>{clpShort(t)}</text></g>)}
        {[1, 10, 20, days].map((d) => <text class="axis" x={x(d - 1)} y={H - 6} text-anchor="middle">{d}</text>)}
        {prevLine && <path d={prevLine} fill="none" stroke="var(--ink-3)" stroke-opacity=".45" stroke-width="2" />}
        {st.budget > 0 && <line x1={x(0)} y1={y(0)} x2={x(days - 1)} y2={y(st.budget)} stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="4 3" />}
        <path d={`${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--series-1)" opacity=".1" />
        <path d={line} fill="none" stroke="var(--series-1)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="4.5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" />
        {hv && <g><line x1={x(hv.i)} x2={x(hv.i)} y1={T} y2={H - B} stroke="var(--ink-3)" stroke-width="1" /><circle cx={x(hv.i)} cy={y(hv.v)} r="5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" /></g>}
      </svg>
      {hv && (
        <div class="tip-box" style={{ left: `clamp(60px, ${hv.px}%, calc(100% - 60px))`, top: hv.py + '%' }}>
          <b>{clp(hv.v)}</b>Día {hv.i + 1}{st.budget ? ` · ritmo ${clp((st.budget * (hv.i + 1)) / days)}` : ''}{prevCumulative?.[hv.i] != null ? ` · antes ${clp(prevCumulative[hv.i])}` : ''}
        </div>
      )}
      <div class="legend">
        <span><i />Este mes</span>
        {st.budget > 0 && <span><i class="dash" />Ritmo del presupuesto</span>}
        {prevLine && <span><i class="prev" />Promedio meses anteriores</span>}
        <button class="link table-toggle" style="margin-left:auto" onClick={() => setTable(!table)}>{table ? 'Ocultar tabla' : 'Ver tabla'}</button>
      </div>
      {table && (
        <table class="data"><thead><tr><th>Día</th><th>Gasto del día</th><th>Acumulado</th></tr></thead>
          <tbody>{data.map((v, i) => st.daily[i] ? <tr><td>{i + 1}</td><td>{clp(st.daily[i])}</td><td>{clp(v)}</td></tr> : null)}</tbody></table>
      )}
    </div>
  );
}

// Historial mensual (barras verticales, un solo color; el mes seleccionado destacado)
export function MonthBars({ history, selected, budget, onPick }) {
  const W = 340, H = 150, T = 22, B = 22, L = 4, R = 4;
  const maxV = niceMax(Math.max(budget || 0, ...history.map((h) => h.total), 1));
  const bw = (W - L - R) / history.length;
  const y = (v) => T + (1 - v / maxV) * (H - T - B);
  const [hover, setHover] = useState(null);
  return (
    <div class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gasto por mes">
        {budget > 0 && <g><line x1={L} x2={W - R} y1={y(budget)} y2={y(budget)} stroke="var(--ink-3)" stroke-dasharray="4 3" /><text class="axis" x={L + 2} y={y(budget) - 4}>presupuesto {clpShort(budget)}</text></g>}
        {history.map((h, i) => {
          const x0 = L + i * bw + bw * 0.18, w = bw * 0.64, top = y(h.total), sel = h.mk === selected;
          const hgt = Math.max(0, H - B - top);
          return (
            <g onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => onPick?.(h.mk)} style="cursor:pointer">
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
              {hgt > 0 && <path d={`M${x0},${H - B}V${top + Math.min(4, hgt)}q0,-4 4,-4h${w - 8}q4,0 4,4V${H - B}Z`} fill="var(--series-1)" opacity={sel ? 1 : hover === i ? 0.7 : 0.38} />}
              {sel && h.total > 0 && <text x={x0 + w / 2} y={top - 5} text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--ink)">{clpShort(h.total)}</text>}
              <text class="axis" x={x0 + w / 2} y={H - 6} text-anchor="middle" font-weight={sel ? 700 : 400}>{monthLabelShort(h.mk)}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div class="tip-box" style={{ left: `clamp(60px, ${((L + (hover + 0.5) * bw) / W) * 100}%, calc(100% - 60px))`, top: (y(history[hover].total) / H) * 100 + '%' }}>
          <b>{clp(history[hover].total)}</b><span style="text-transform:capitalize">{monthLabel(history[hover].mk)}</span> · {history[hover].count} boletas
        </div>
      )}
    </div>
  );
}
