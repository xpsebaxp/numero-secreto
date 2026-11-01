// Datos de ejemplo realistas (Chile) para explorar la app. Se marcan con demo:true para poder borrarlos.
import { addDays, todayISO, uid, monthKey } from './format.js';

const P = [
  // [comercio, rut, categoría, mínimo, máximo, frecuencia por semana]
  ['LIDER EXPRESS', '76.042.014-K', 'super', 8000, 45000, 1.6],
  ['JUMBO', '81.201.000-K', 'super', 25000, 95000, 0.5],
  ['OK MARKET', '76.165.987-3', 'super', 1200, 6500, 1.8],
  ['STARBUCKS', '96.937.270-3', 'comida', 3500, 7500, 1.2],
  ['JUAN MAESTRO', '76.230.170-0', 'comida', 6500, 14000, 0.5],
  ['RESTAURANT LA PICADA', '77.123.456-0', 'comida', 12000, 38000, 0.4],
  ['RAPPI', '76.721.203-2', 'delivery', 9000, 26000, 0.9],
  ['PEDIDOSYA', '76.546.990-6', 'delivery', 8000, 22000, 0.6],
  ['COPEC', '99.520.000-7', 'combustible', 25000, 52000, 0.6],
  ['METRO RED', '61.219.000-3', 'transporte', 10000, 20000, 0.25],
  ['UBER', '76.513.920-5', 'transporte', 3500, 11000, 0.7],
  ['FARMACIAS CRUZ VERDE', '89.807.200-2', 'salud', 3500, 28000, 0.4],
  ['SODIMAC', '96.792.430-K', 'hogar', 6000, 55000, 0.2],
  ['ENEL', '96.800.570-7', 'servicios', 32000, 48000, 0], // mensual
  ['AGUAS ANDINAS', '61.808.000-5', 'servicios', 14000, 22000, 0],
  ['ENTEL', '92.580.000-7', 'servicios', 19990, 19990, 0],
  ['CINEMARK', '96.659.800-K', 'entretencion', 8000, 24000, 0.2],
  ['FALABELLA', '77.261.280-K', 'ropa', 15000, 60000, 0.15],
  ['PREUNIC', '96.511.460-2', 'personal', 4000, 18000, 0.2],
  ['SUPERZOO', '76.183.290-7', 'mascotas', 12000, 35000, 0.12],
];

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const round = (n) => Math.round(n / 10) * 10;

const ITEMS = {
  super: ['LECHE ENTERA 1L', 'PAN MARRAQUETA KG', 'HUEVOS 12 UN', 'PALTA HASS KG', 'ARROZ GRADO 1 1KG', 'COCA COLA 3L', 'QUESO GAUDA 250G', 'POLLO ENTERO KG', 'DETERGENTE 3L', 'PAPEL HIGIENICO 12R', 'TOMATE KG', 'YOGURT BATIDO'],
  comida: ['CAFE LATTE GRANDE', 'CAPUCCINO', 'COMPLETO ITALIANO', 'MENU DEL DIA', 'CHURRASCO', 'PROPINA'],
  delivery: ['PEDIDO + ENVIO'],
  combustible: ['GASOLINA 95 OCT'],
};

export function generateDemo() {
  seed = 7;
  const out = [];
  const today = todayISO();
  const start = addDays(today, -125);
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dow = new Date(d + 'T12:00').getDay();
    const weekendBoost = dow === 5 || dow === 6 ? 1.6 : dow === 0 ? 1.2 : 0.85;
    for (const [m, rut, cat, min, max, fpw] of P) {
      if (!fpw) continue;
      const pr = (fpw / 7) * (['comida', 'delivery', 'entretencion'].includes(cat) ? weekendBoost : 1);
      if (rnd() < pr) {
        const total = round(min + (max - min) * rnd() ** 1.4);
        const names = ITEMS[cat] || [];
        const items = names.length ? Array.from({ length: Math.min(names.length, 1 + Math.floor(rnd() * 4)) }, () => names[Math.floor(rnd() * names.length)]).map((desc, i, arr) => ({ desc, amount: i === arr.length - 1 ? 0 : 0 })) : [];
        out.push({ id: uid() + out.length, date: d, time: `${String(9 + Math.floor(rnd() * 12)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`, merchant: m, rut, category: cat, total, items: items.map((i) => ({ desc: i.desc, amount: 0 })), source: rnd() < 0.7 ? 'ted' : 'manual', demo: true });
      }
    }
    // cuentas mensuales
    if (d.endsWith('-05')) for (const [m, rut, cat, min, max] of P.filter((p) => p[2] === 'servicios')) out.push({ id: uid() + out.length, date: d, time: '10:00', merchant: m, rut, category: cat, total: round(min + (max - min) * rnd()), items: [], source: 'manual', demo: true });
  }
  // algunos extraordinarios
  const ex = [
    [-80, 'PC FACTORY', '76.135.420-2', 'tecno', 389990, 'NOTEBOOK 14"'],
    [-40, 'CLINICA DENTAL SONRISA', '77.555.111-4', 'salud', 145000, 'TRATAMIENTO CONDUCTO'],
    [-9, 'SODIMAC', '96.792.430-K', 'hogar', 219990, 'REFRIGERADOR NO FROST'],
  ];
  for (const [off, m, rut, cat, total, item] of ex) {
    const d = addDays(today, off);
    if (d >= start) out.push({ id: uid() + out.length, date: d, time: '17:20', merchant: m, rut, category: cat, total, items: [{ desc: item, amount: total }], source: 'ted', demo: true });
  }
  const months = {};
  for (const r of out) (months[monthKey(r.date)] = months[monthKey(r.date)] || []).push(r);
  return months;
}
