// IA opcional con Claude:
//  - Dentro de claude.ai: capacidad "sample" del artifact (sin API key).
//  - En el APK / PWA: API de Anthropic con la API key del usuario (se guarda solo en el dispositivo).
import { CATEGORIES } from '../lib/categories.js';

let samplePromise = null;
const getSample = () => {
  if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(null);
  if (!samplePromise) samplePromise = Promise.race([window.claude.use('sample'), new Promise((r) => setTimeout(() => r(null), 11000))]).catch(() => null);
  return samplePromise;
};

export async function aiAvailability(settings) {
  const s = await getSample();
  if (s) {
    let images = false; try { images = !!(await s.limits())?.images; } catch { /* */ }
    return { mode: 'claude', images };
  }
  if (settings?.apiKey) return { mode: 'api', images: true };
  return { mode: null, images: false };
}

const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

async function shrink(file, maxSide = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}

function extractJSON(text) {
  const t = String(text || '').replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const a2 = t.indexOf('['), b2 = t.lastIndexOf(']');
  if (a2 >= 0 && (a < 0 || a2 < a)) return JSON.parse(t.slice(a2, b2 + 1));
  return JSON.parse(t.slice(a, b + 1));
}

async function callApi(settings, content, maxTokens = 1500) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: settings.aiModel || 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(r.status === 401 ? 'API key inválida' : `Error de la API (${r.status}): ${e.slice(0, 160)}`); }
  const j = await r.json();
  return (j.content || []).map((c) => c.text || '').join('');
}

const catList = CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ');

const RECEIPT_PROMPT = `Eres un lector de boletas chilenas. Extrae los datos de la imagen y responde SOLO con JSON válido, sin texto extra:
{"merchant": "nombre del comercio (razón social o nombre de fantasía)", "rut": "RUT del emisor con formato 12.345.678-9 o vacío", "date": "AAAA-MM-DD", "time": "HH:MM o vacío", "total": número entero en pesos (sin puntos), "items": [{"desc": "descripción", "qty": número, "amount": número entero total de la línea}], "category": "una de: ${catList}", "docType": "boleta|factura|voucher|otro"}
Reglas: los montos chilenos usan punto como separador de miles ("12.990" = 12990). Ignora líneas de IVA, neto, vuelto, efectivo y medios de pago. Si no puedes leer un dato déjalo vacío o 0. No inventes ítems.`;

export async function aiReadReceipt(file, settings) {
  const img = await shrink(file);
  let text;
  const s = await getSample();
  if (s) {
    const r = await s(RECEIPT_PROMPT, { images: [img], modelTier: 'default', cache: false });
    text = r.text;
  } else if (settings?.apiKey) {
    const b64 = await blobToBase64(img);
    text = await callApi(settings, [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
      { type: 'text', text: RECEIPT_PROMPT },
    ]);
  } else throw new Error('IA no configurada');
  const j = extractJSON(text);
  return {
    source: 'ai',
    merchant: j.merchant || '', rut: j.rut || '', date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || '') ? j.date : '', time: j.time || '',
    total: Math.round(Number(j.total) || 0),
    items: (j.items || []).filter((i) => i && i.desc).map((i) => ({ desc: String(i.desc), qty: Number(i.qty) || 1, amount: Math.round(Number(i.amount) || 0) })),
    category: CATEGORIES.some((c) => c.id === j.category) ? j.category : undefined,
  };
}

export async function aiAdvice(summary, settings) {
  const prompt = `Eres un asesor financiero personal chileno, cercano y concreto. Analiza este resumen de gastos (montos en CLP) y da 4 sugerencias accionables y específicas a estos datos, con un ahorro mensual estimado realista. Responde SOLO con JSON: [{"title": "título corto", "body": "explicación en 1-2 frases, tuteando", "saving": número entero}]

Datos:
${JSON.stringify(summary)}`;
  let text;
  const s = await getSample();
  if (s) text = (await s(prompt, { modelTier: 'default', cache: false })).text;
  else if (settings?.apiKey) text = await callApi(settings, [{ type: 'text', text: prompt }], 1200);
  else throw new Error('IA no configurada');
  const arr = extractJSON(text);
  return Array.isArray(arr) ? arr.slice(0, 6) : [];
}
