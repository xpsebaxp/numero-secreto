// Timbre Electrónico (TED) del SII: el código PDF417 impreso en boletas y facturas electrónicas chilenas.
import { formatRut } from './format.js';
// Contiene RUT emisor, tipo de documento, folio, fecha, monto total, primer ítem y la razón social del emisor (dentro del CAF).

export const DOC_TYPES = {
  33: 'Factura electrónica', 34: 'Factura exenta', 39: 'Boleta electrónica', 41: 'Boleta exenta',
  46: 'Factura de compra', 52: 'Guía de despacho', 56: 'Nota de débito', 61: 'Nota de crédito',
};

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
};
const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

export function looksLikeTED(text = '') {
  return /<TED\b|<DD>/i.test(text) && /<MNT>/i.test(text);
}

export function parseTED(text) {
  if (!looksLikeTED(text)) return null;
  const dd = (text.match(/<DD>([\s\S]*?)<\/DD>/i) || [, text])[1];
  const da = (dd.match(/<DA>([\s\S]*?)<\/DA>/i) || [, ''])[1];
  const td = Number(tag(dd, 'TD')) || 39;
  const total = Number(tag(dd, 'MNT')) || 0;
  const fe = tag(dd, 'FE'); // AAAA-MM-DD
  const ts = tag(text, 'TSTED'); // AAAA-MM-DDTHH:MM:SS
  return {
    source: 'ted',
    rut: formatRut(tag(dd, 'RE')),
    docType: td,
    docLabel: DOC_TYPES[td] || 'Documento tributario',
    folio: tag(dd, 'F'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(fe) ? fe : '',
    time: ts.includes('T') ? ts.split('T')[1].slice(0, 5) : '',
    total: td === 61 ? -total : total, // nota de crédito = devolución
    firstItem: tag(dd, 'IT1'),
    merchant: tag(da, 'RS') || '',
  };
}
