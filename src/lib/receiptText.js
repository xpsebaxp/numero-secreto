// Interpreta el texto (OCR) de una boleta chilena: comercio, RUT, fecha, total e ítems.
import { parseCLP, validRut, formatRut } from './format.js';

const STOP = /\b(sub\s*-?total|total|iva|neto|exento|efectivo|vuelto|cambio|tarjeta|debito|d[eé]bito|cr[eé]dito|redcompra|transbank|pago|propina|descuento total|ahorro|cuotas|n[°º] ?oper|autoriz|saldo|monto|redondeo|donaci[oó]n|cajero|caja|vendedor|folio|boleta|rut|giro|fecha|hora|timbre|res\.?|verifique|www|sii|av|avda|avenida|calle|direcci[oó]n|local|sucursal|comuna|fono|tel[eé]fono|casa matriz)\b/i;
const AMOUNT = /\$?\s?(-?\d{1,3}(?:[.\s]\d{3})+|-?\d{2,7})(?:,\d{1,2})?\s*$/;

export function parseReceiptText(raw = '') {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = { source: 'ocr', merchant: '', rut: '', date: '', time: '', total: 0, items: [], folio: '' };

  // RUT emisor: el primero válido que aparezca
  for (const l of lines) {
    const m = l.match(/(\d{1,2}[.\s]?\d{3}[.\s]?\d{3}\s?-\s?[\dkK])/);
    if (m && validRut(m[1])) { out.rut = formatRut(m[1]); break; }
  }

  // Fecha: dd/mm/aaaa, dd-mm-aaaa, dd.mm.aa, aaaa-mm-dd
  for (const l of lines) {
    let m = l.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    if (m) {
      let [, d, mo, y] = m; y = y.length === 2 ? '20' + y : y;
      if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 && +y > 2000) {
        out.date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const t = l.match(/\b(\d{1,2}):(\d{2})/); if (t) out.time = `${t[1].padStart(2, '0')}:${t[2]}`;
        break;
      }
    }
    m = l.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (m) { out.date = `${m[1]}-${m[2]}-${m[3]}`; break; }
  }

  // Folio
  for (const l of lines) {
    const m = l.match(/(?:folio|boleta[^\d]{0,25}|n[°º.]|nro\.?)\s*:?\s*(\d{3,10})\b/i);
    if (m) { out.folio = m[1]; break; }
  }

  // Total: línea con TOTAL (no SUBTOTAL); preferir la última "TOTAL" con monto
  const totals = [];
  lines.forEach((l, i) => {
    if (/total/i.test(l) && !/sub\s*-?total|total\s+(desc|ahorro|items?|art)/i.test(l)) {
      let m = l.match(AMOUNT);
      if (!m && lines[i + 1]) m = lines[i + 1].match(/^\$?\s?(\d{1,3}(?:[.\s]\d{3})+|\d{2,7})\s*$/);
      if (m) totals.push(parseCLP(m[1].replace(/\s/g, '.')));
    }
  });
  if (totals.length) out.total = Math.max(...totals.filter((t) => t > 0), 0) || totals[totals.length - 1];

  // Comercio: primera línea "de texto" de las primeras 6, que no sea RUT/dirección/giro
  for (const l of lines.slice(0, 6)) {
    if (/rut|giro|direcci|fono|tel[eé]f|boleta|factura|fecha|www|@|casa matriz|sucursal|av\.|avenida|calle/i.test(l)) continue;
    const letters = (l.match(/[a-záéíóúñ]/gi) || []).length;
    if (letters >= 4 && letters / l.length > 0.5) { out.merchant = l.replace(/[^\wÁÉÍÓÚÑáéíóúñ&.\- ]/g, '').trim(); break; }
  }

  // Ítems: "DESCRIPCIÓN .... 1.990" (entre el encabezado y el total)
  const totalIdx = lines.findIndex((l) => /\btotal\b/i.test(l));
  const body = totalIdx > 0 ? lines.slice(0, totalIdx) : lines;
  for (const l of body) {
    if (STOP.test(l)) continue;
    const m = l.match(/^(.{3,}?)\s+\$?\s?(-?\d{1,3}(?:\.\d{3})+|-?\d{3,6})\s*[A-Z]?$/);
    if (!m) continue;
    const desc = m[1].replace(/^\d{6,14}\s+/, '').replace(/\s+\d+\s*[xX]\s*$/, '').trim(); // quita código de barras al inicio
    const letters = (desc.match(/[a-záéíóúñ]/gi) || []).length;
    const amount = parseCLP(m[2]);
    if (letters >= 3 && Math.abs(amount) >= 10 && Math.abs(amount) < 5_000_000) out.items.push({ desc, amount });
  }
  if (!out.total && out.items.length) out.total = out.items.reduce((a, b) => a + b.amount, 0);
  return out;
}
