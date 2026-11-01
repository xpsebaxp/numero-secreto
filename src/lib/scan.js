// Lectura de boletas sin conexión: timbre electrónico (PDF417) + OCR (Tesseract).
import { parseTED, looksLikeTED } from './ted.js';
import { parseReceiptText } from './receiptText.js';

const asset = (p) => new URL(p, document.baseURI).href;
// En la versión publicada dentro de claude.ai no se incluyen los motores wasm/OCR: se usa el lector JS + IA.
export const LOCAL_ENGINES = import.meta.env.VITE_TARGET !== 'claude';

// ---------- Imagen ----------
export async function fileToCanvas(file, maxSide = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

const canvasToBlob = (c, type = 'image/png', q) => new Promise((r) => c.toBlob(r, type, q));

// Recorta una zona (fracciones 0..1) y la escala
function crop(c, y0, y1, scale = 1) {
  const o = document.createElement('canvas');
  const sh = Math.round(c.height * (y1 - y0));
  o.width = Math.round(c.width * scale); o.height = Math.round(sh * scale);
  const ctx = o.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(c, 0, Math.round(c.height * y0), c.width, sh, 0, 0, o.width, o.height);
  return o;
}

// Escala de grises + contraste (ayuda al OCR en papel térmico)
function enhance(c) {
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const ctx = o.getContext('2d', { willReadFrequently: true }); ctx.drawImage(c, 0, 0);
  const d = ctx.getImageData(0, 0, o.width, o.height); const p = d.data;
  let min = 255, max = 0;
  for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = g; if (g < min) min = g; if (g > max) max = g; }
  const k = 255 / Math.max(1, max - min);
  for (let i = 0; i < p.length; i += 4) { const g = Math.min(255, Math.max(0, (p[i] - min) * k)); p[i] = p[i + 1] = p[i + 2] = g; }
  ctx.putImageData(d, 0, 0); return o;
}

// ---------- Timbre electrónico ----------
let zxingReady = null;
async function zxingWasm() {
  if (!zxingReady) {
    zxingReady = (async () => {
      const mod = await import('zxing-wasm/reader');
      mod.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? asset('vendor/zxing_reader.wasm') : prefix + path) }, fireImmediately: true });
      return mod;
    })();
  }
  return zxingReady;
}

const decodeBytes = (r) => {
  // El TED viene en ISO-8859-1: si el texto trae caracteres rotos, decodificamos los bytes crudos.
  if (r.bytes && r.bytes.length) { try { return new TextDecoder('iso-8859-1').decode(r.bytes); } catch { /* */ } }
  return r.text || '';
};

// Rota un canvas (grados) sobre fondo gris; el PDF417 tolera poca inclinación (~1,5°), así que probamos varios ángulos
function rotate(c, deg) {
  if (!deg) return c;
  const r = (deg * Math.PI) / 180, cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const o = document.createElement('canvas');
  o.width = Math.round(c.width * cos + c.height * sin); o.height = Math.round(c.width * sin + c.height * cos);
  const ctx = o.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, o.width, o.height);
  ctx.translate(o.width / 2, o.height / 2); ctx.rotate(r); ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return o;
}
const scaleTo = (c, maxW) => (c.width > maxW ? crop(c, 0, 1, maxW / c.width) : c);

async function tryWasm(canvas) {
  const z = await zxingWasm();
  const read = async (v, extra = {}) => {
    const ctx = v.getContext('2d', { willReadFrequently: true });
    const res = await z.readBarcodes(ctx.getImageData(0, 0, v.width, v.height), { formats: ['PDF417'], tryHarder: true, tryInvert: true, maxNumberOfSymbols: 2, ...extra });
    for (const r of res) { const t = decodeBytes(r); if (looksLikeTED(t)) return t; }
    return null;
  };
  // 1) Imagen completa (también prueba 90°/180° por si la foto está girada)
  let t = await read(canvas, { tryRotate: true, tryDownscale: true });
  if (t) return t;
  // 2) Mitad inferior (donde va el timbre), corrigiendo inclinación
  const bottom = scaleTo(crop(canvas, 0.4, 1), 1800);
  for (const a of [0, -3, 3, -6, 6, -9, 9, -12, 12]) { t = await read(rotate(bottom, a)); if (t) return t; }
  // 3) Contraste reforzado
  t = await read(enhance(bottom), { tryDenoise: true });
  return t;
}

async function tryJs(canvas) {
  const { PDF417Reader, BinaryBitmap, HybridBinarizer, HTMLCanvasElementLuminanceSource, DecodeHintType } = await import('@zxing/library');
  const reader = new PDF417Reader();
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  const read = (v) => { try { const t = reader.decode(new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(v))), hints).getText(); return looksLikeTED(t) ? t : null; } catch { return null; } };
  const bottom = scaleTo(crop(canvas, 0.4, 1), 1400);
  let t = read(scaleTo(canvas, 1400));
  for (const a of [0, -3, 3, -6, 6, -9, 9, -12, 12]) { if (t) break; t = read(rotate(bottom, a)); await new Promise((r) => setTimeout(r, 0)); }
  return t;
}

export async function readTED(canvas) {
  let text = null;
  if (LOCAL_ENGINES) { try { text = await tryWasm(canvas); } catch (e) { console.warn('zxing-wasm no disponible', e); } }
  if (!text) { try { text = await tryJs(canvas); } catch (e) { console.warn('zxing js falló', e); } }
  return text ? parseTED(text) : null;
}

// ---------- OCR ----------
let ocrWorker = null;
export async function ocrText(canvas, onProgress) {
  if (!LOCAL_ENGINES) throw new Error('OCR no incluido en esta versión');
  const T = await import('tesseract.js');
  if (!ocrWorker) {
    ocrWorker = T.createWorker('spa', 1, {
      workerPath: asset('vendor/tesseract/worker.min.js'),
      corePath: asset('vendor/tesseract/'),
      langPath: asset('vendor/tesseract/'),
      // En el APK, Android descomprime los .gz al empaquetar; en la web se sirve comprimido
      gzip: !window.Capacitor?.isNativePlatform?.(),
      cacheMethod: 'none',
      logger: (m) => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
    });
  }
  const w = await ocrWorker;
  await w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' });
  const src = canvas.width > 1600 ? crop(canvas, 0, 1, 1600 / canvas.width) : canvas;
  const { data } = await w.recognize(enhance(src));
  return data.text || '';
}

// ---------- Flujo completo sin conexión ----------
export async function scanOffline(file, { ocr = true, onStage } = {}) {
  onStage?.('Preparando imagen…');
  const canvas = await fileToCanvas(file, 2600);
  onStage?.('Buscando timbre electrónico…');
  const ted = await readTED(canvas);
  let text = null, parsed = null;
  if (ocr && LOCAL_ENGINES) {
    onStage?.('Leyendo texto (OCR)…');
    try { text = await ocrText(canvas, (p) => onStage?.(`Leyendo texto… ${Math.round(p * 100)}%`)); parsed = parseReceiptText(text); }
    catch (e) { console.warn('OCR no disponible', e); }
  }
  return { ted, ocr: parsed, text, merged: mergeResults(ted, parsed) };
}

// El timbre manda en total/fecha/RUT (es dato tributario exacto); el OCR aporta ítems y nombre si faltan
export function mergeResults(ted, ocr, ai) {
  const base = { merchant: '', rut: '', date: '', time: '', total: 0, items: [], folio: '', docLabel: '', sources: [] };
  const layers = [ocr, ai, ted].filter(Boolean); // prioridad creciente: OCR < IA < timbre
  for (const l of layers) {
    for (const k of ['merchant', 'rut', 'date', 'time', 'folio', 'docLabel']) if (l[k]) base[k] = l[k];
    if (l.total) base.total = l.total;
    if (l.items && l.items.length && (!base.items.length || l.source === 'ai')) base.items = l.items;
    if (l.category) base.category = l.category;
    base.sources.push(l.source);
  }
  // Si hay IA, sus ítems son mejores que los del OCR
  if (ai?.items?.length) base.items = ai.items;
  if (!base.items.length && ted?.firstItem) base.items = [{ desc: ted.firstItem, amount: 0 }];
  if (base.items.length === 1 && !base.items[0].amount) base.items[0] = { ...base.items[0], amount: base.total };
  return base;
}
