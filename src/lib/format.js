// Utilidades de formato (CLP, fechas) y helpers varios.

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export const clp = (n) => clpFmt.format(Math.round(n || 0));
export const num = (n) => numFmt.format(Math.round(n || 0));
export const clpShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M';
  if (a >= 1e4) return '$' + Math.round(n / 1e3).toLocaleString('es-CL') + 'k';
  return clp(n);
};

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (iso) => iso.slice(0, 7); // "2026-11"
export const currentMonthKey = () => monthKey(todayISO());
export const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const monthLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const monthLabelShort = (mk) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; };
export const shiftMonth = (mk, delta) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const daysInMonth = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const dateLabel = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
export const dateLong = (iso) => { const d = parseISO(iso); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Normaliza nombres de comercio para comparar ("SUPERMERCADO LÍDER EXPRESS S.A." -> "supermercado lider express")
export const normName = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(s\.?a\.?|spa|ltda\.?|limitada|eirl|e\.i\.r\.l\.?|y cia\.?)\b/g, '')
  .replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

// RUT chileno: normaliza y valida dígito verificador
export const cleanRut = (r = '') => r.replace(/[^0-9kK]/g, '').toUpperCase();
export const formatRut = (r = '') => {
  const c = cleanRut(r); if (c.length < 2) return r;
  const body = c.slice(0, -1), dv = c.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
};
export const validRut = (r = '') => {
  const c = cleanRut(r); if (c.length < 2) return false;
  const body = c.slice(0, -1), dv = c.slice(-1);
  let s = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) { s += Number(body[i]) * m; m = m === 7 ? 2 : m + 1; }
  const r11 = 11 - (s % 11);
  const exp = r11 === 11 ? '0' : r11 === 10 ? 'K' : String(r11);
  return exp === dv;
};

// Convierte "12.990" / "$ 12.990" / "12990" a número
export const parseCLP = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const t = String(s).replace(/[^\d,.-]/g, '');
  // En Chile el punto es separador de miles y la coma decimal
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? Math.round(n) : 0;
};
