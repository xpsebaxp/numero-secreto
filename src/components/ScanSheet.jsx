import { useState, useEffect } from 'preact/hooks';
import { Sheet } from './ui.jsx';
import { ReceiptForm, SourceTags } from './ReceiptForm.jsx';
import { scanOffline, mergeResults, LOCAL_ENGINES } from '../lib/scan.js';
import { aiReadReceipt } from '../platform/ai.js';
import { guessCategory } from '../lib/categories.js';
import { todayISO, uid, clp, cleanRut, normName } from '../lib/format.js';

const emptyDraft = () => ({ merchant: '', rut: '', date: todayISO(), time: '', total: 0, category: 'otros', items: [], note: '', extra: null, source: 'manual', folio: '' });

export function ScanSheet({ settings, ai, allReceipts, onSave, onClose, startManual }) {
  const [step, setStep] = useState(startManual ? 'review' : 'pick');
  const [stage, setStage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [sources, setSources] = useState(startManual ? ['manual'] : []);
  const [layers, setLayers] = useState({});
  const [msg, setMsg] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const toDraft = (merged, aiCat) => {
    const d = { ...emptyDraft(), ...merged };
    d.date = merged.date || todayISO();
    d.category = aiCat || guessCategory({ merchant: d.merchant, rut: d.rut, items: d.items }, settings.learned || {});
    d.source = merged.sources?.includes('ted') ? 'ted' : merged.sources?.includes('ai') ? 'ai' : merged.sources?.includes('ocr') ? 'ocr' : 'manual';
    delete d.sources;
    return d;
  };

  async function handleFile(f) {
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setStep('working'); setMsg(null);
    const useAI = ai.mode && ai.images && settings.aiAuto;
    try {
      const [off, aiRes] = await Promise.all([
        scanOffline(f, { ocr: settings.ocr !== false && !useAI, onStage: setStage }),
        useAI ? aiReadReceipt(f, settings).catch((e) => { console.warn(e); return null; }) : null,
      ]);
      let aiR = aiRes;
      if (!off.ted && !off.ocr && !aiR && ai.mode && ai.images && !LOCAL_ENGINES) {
        setStage('Sin timbre: leyendo con IA…');
        aiR = await aiReadReceipt(f, settings).catch((e) => { console.warn(e); return null; });
      }
      const L = { ted: off.ted, ocr: off.ocr, ai: aiR };
      setLayers(L);
      const merged = mergeResults(L.ted, L.ocr, L.ai);
      setSources(merged.sources);
      setDraft(toDraft(merged, L.ai?.category));
      if (off.ted) setMsg({ t: 'ok', m: `Timbre electrónico leído: total ${clp(off.ted.total)} del ${off.ted.date.split('-').reverse().join('/')}. Estos datos vienen directo del SII.` });
      else if (!merged.total) setMsg({ t: 'warn', m: 'No pude leer el total. Revisa la foto (bien iluminada, sin arrugas y con el código de barras completo) o ingrésalo a mano.' + (ai.mode ? ' También puedes probar con IA.' : '') });
      else setMsg({ t: 'warn', m: 'No encontré el timbre electrónico; leí el texto de la foto. Revisa los datos antes de guardar.' });
    } catch (e) {
      console.error(e);
      setMsg({ t: 'warn', m: 'No pude procesar la imagen. Puedes completar los datos a mano.' });
    }
    setStep('review');
  }

  async function improveWithAI() {
    if (!file) return;
    setAiBusy(true);
    try {
      const r = await aiReadReceipt(file, settings);
      const L = { ...layers, ai: r }; setLayers(L);
      const merged = mergeResults(L.ted, L.ocr, L.ai);
      setSources(merged.sources);
      setDraft({ ...toDraft(merged, r.category), note: draft.note, extra: draft.extra });
      setMsg({ t: 'ok', m: L.ted ? 'IA aplicada: detalle de productos y comercio completados. Total y fecha se mantienen del timbre electrónico.' : 'Datos leídos con IA. Revísalos antes de guardar.' });
    } catch (e) {
      setMsg({ t: 'warn', m: e?.code === 'not_granted' ? 'No se otorgó permiso para usar Claude.' : e?.code === 'rate_limited' ? 'Demasiadas consultas seguidas; espera un momento.' : 'La IA no pudo leer la boleta: ' + (e?.message || 'error') });
    }
    setAiBusy(false);
  }

  // Posible duplicado
  const dup = allReceipts.find((r) => (draft.folio && r.folio === draft.folio && cleanRut(r.rut) === cleanRut(draft.rut)) || (r.date === draft.date && r.total === draft.total && draft.total && normName(r.merchant) === normName(draft.merchant)));

  const save = () => {
    if (!draft.total) { setMsg({ t: 'warn', m: 'Falta el total de la boleta.' }); return; }
    onSave({ ...draft, id: uid(), createdAt: Date.now(), items: (draft.items || []).filter((i) => i.desc) });
  };

  return (
    <Sheet onClose={onClose}>
      {step === 'pick' && (
        <div>
          <h2>Agregar boleta</h2>
          <p class="lead">Fotografía la boleta completa, incluyendo el código de barras del timbre electrónico (abajo).</p>
          <div class="pick">
            <label class="opt"><span class="e">📷</span>Tomar foto<small>Usa la cámara</small>
              <input type="file" accept="image/*" capture="environment" class="sr" onChange={(e) => handleFile(e.currentTarget.files[0])} /></label>
            <label class="opt"><span class="e">🖼️</span>Desde galería<small>Foto o captura</small>
              <input type="file" accept="image/*" class="sr" onChange={(e) => handleFile(e.currentTarget.files[0])} /></label>
            <button class="opt wide" onClick={() => { setSources(['manual']); setStep('review'); }}><span class="e">✍️</span><span>Ingresar a mano<br /><small>Para gastos sin boleta</small></span></button>
          </div>
          <p class="small muted" style="margin-top:12px">
            🔒 La lectura del timbre{LOCAL_ENGINES ? ' y del texto' : ''} ocurre en tu dispositivo.{ai.mode ? ' La IA (opcional) envía la foto a Claude solo cuando lo pides.' : ''}
          </p>
        </div>
      )}
      {step === 'working' && (
        <div>
          <h2>Leyendo boleta…</h2>
          {preview && <img class="thumb" src={preview} alt="Boleta" />}
          <div class="stage"><div class="spin" /><span>{stage || 'Procesando…'}</span></div>
        </div>
      )}
      {step === 'review' && (
        <div>
          <h2>{sources.includes('manual') && !file ? 'Nuevo gasto' : 'Revisa los datos'}</h2>
          {preview && <img class="thumb" src={preview} alt="Boleta" />}
          {file && <SourceTags sources={sources} />}
          {msg && <div class={'notice ' + (msg.t === 'ok' ? 'ok' : '')}>{msg.m}</div>}
          {file && ai.mode && ai.images && !sources.includes('ai') && (
            <button class="btn small ghost" style="margin-top:4px" disabled={aiBusy} onClick={improveWithAI}>{aiBusy ? <><span class="spin" style="width:16px;height:16px;border-width:2px" /> Consultando a Claude…</> : '✨ Mejorar lectura con IA'}</button>
          )}
          <ReceiptForm draft={draft} setDraft={setDraft} />
          {dup && <div class="notice">⚠️ Parece que ya registraste esta boleta ({dup.merchant || 'sin nombre'}, {clp(dup.total)}, {dup.date.split('-').reverse().join('/')}).</div>}
          <div class="btns">
            <button class="btn ghost" onClick={onClose}>Cancelar</button>
            <button class="btn primary" onClick={save}>Guardar · +{file ? 15 : 10} XP</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function EditSheet({ receipt, extraInfo, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({ ...receipt, items: receipt.items || [] });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet onClose={onClose}>
      <h2>Editar gasto</h2>
      <SourceTags sources={[receipt.source]} />
      {receipt.folio && <p class="small muted" style="margin:4px 0">{receipt.docLabel || 'Documento'} · folio {receipt.folio}</p>}
      <ReceiptForm draft={draft} setDraft={setDraft} extraInfo={extraInfo} />
      {confirm ? (
        <div class="btns"><button class="btn ghost" onClick={() => setConfirm(false)}>No</button><button class="btn danger" onClick={() => onDelete(receipt)}>Sí, eliminar</button></div>
      ) : (
        <div class="btns">
          <button class="btn danger" style="flex:0 0 auto" aria-label="Eliminar" onClick={() => setConfirm(true)}>🗑️</button>
          <button class="btn ghost" onClick={onClose}>Cancelar</button>
          <button class="btn primary" onClick={() => onSave(draft)}>Guardar</button>
        </div>
      )}
    </Sheet>
  );
}
