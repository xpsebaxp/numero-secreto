import { useState } from 'preact/hooks';
import { Switch, Confirm } from '../components/ui.jsx';
import { flatten } from '../lib/analytics.js';
import { catOf } from '../lib/categories.js';
import { saveFile } from '../platform/download.js';
import { LOCAL_ENGINES } from '../lib/scan.js';

const csvCell = (v) => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export function Settings({ settings, months, storageMode, storageWarning, ai, update, actions, toast }) {
  const [confirm, setConfirm] = useState(null);
  const [key, setKey] = useState(settings.apiKey || '');
  const all = flatten(months);
  const demoCount = all.filter((r) => r.demo).length;
  const inClaude = ai.mode === 'claude';

  const exportCSV = async () => {
    const head = ['fecha', 'hora', 'comercio', 'rut', 'categoria', 'total', 'extraordinario', 'origen', 'folio', 'nota', 'items'];
    const rows = all.map((r) => [r.date, r.time, r.merchant, r.rut, catOf(r.category).name, r.total, r.extra ? 'sí' : '', r.source, r.folio, r.note, (r.items || []).map((i) => i.desc + (i.amount ? ' ' + i.amount : '')).join(' | ')]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
    try { await saveFile('gastos.csv', csv, 'text/csv'); toast('CSV exportado'); } catch (e) { toast('No se pudo exportar: ' + (e?.message || 'cancelado')); }
  };
  const exportJSON = async () => {
    const { apiKey, ...safe } = settings;
    try { await saveFile('respaldo-boletas.json', JSON.stringify({ app: 'boletapp', v: 1, settings: safe, months }, null, 1), 'application/json'); toast('Respaldo exportado'); } catch (e) { toast('No se pudo exportar: ' + (e?.message || 'cancelado')); }
  };
  const importJSON = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== 'boletapp' || !j.months) throw new Error('Archivo no válido');
      await actions.importData(j);
      toast('Respaldo importado');
    } catch (e) { toast('No se pudo importar: ' + e.message); }
  };

  return (
    <div>
      <div class="section-title">Lectura de boletas</div>
      <div class="card">
        {LOCAL_ENGINES ? <Switch title="Leer texto de la foto (OCR)" desc="Además del timbre electrónico, extrae ítems y datos de boletas sin timbre. Funciona sin internet." on={settings.ocr !== false} onChange={(v) => update({ ocr: v })} />
          : <p class="small muted" style="margin:4px 0 8px">Esta versión web lee el timbre electrónico en tu navegador y usa IA para el detalle de productos. El OCR sin conexión viene en la app para Android.</p>}
        <Switch title="Usar IA automáticamente" desc={ai.mode ? 'Cada foto se envía a Claude para leer el detalle con más precisión.' : 'Configura la IA abajo para activarlo.'} on={!!settings.aiAuto && !!ai.mode} onChange={(v) => ai.mode && update({ aiAuto: v })} />
      </div>

      <div class="section-title">Inteligencia artificial (opcional)</div>
      <div class="card">
        {inClaude ? (
          <p class="small" style="margin:0">✨ Estás usando la app dentro de Claude: la IA funciona sin configurar nada. Cuando la uses por primera vez te pedirá permiso.</p>
        ) : (
          <>
            <p class="small muted" style="margin-top:0">Para usar IA en el teléfono necesitas una API key de Anthropic (console.anthropic.com). Se guarda solo en este dispositivo. Costo aproximado: menos de $5 CLP por boleta con Haiku.</p>
            <label for="k">API key</label>
            <input id="k" type="password" autocomplete="off" placeholder="sk-ant-…" value={key} onInput={(e) => setKey(e.currentTarget.value)} />
            <label for="mdl">Modelo</label>
            <select id="mdl" value={settings.aiModel || 'claude-haiku-5-5'} onChange={(e) => update({ aiModel: e.currentTarget.value })}>
              <option value="claude-haiku-5-5">Claude Haiku 5.5 (rápido y económico)</option>
              <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (más preciso)</option>
            </select>
            <div class="btns">
              {settings.apiKey && <button class="btn ghost" onClick={() => { setKey(''); update({ apiKey: '', aiAuto: false }); toast('API key eliminada'); }}>Quitar</button>}
              <button class="btn primary" disabled={!key || key === settings.apiKey} onClick={() => { update({ apiKey: key.trim() }); toast('API key guardada'); }}>Guardar key</button>
            </div>
          </>
        )}
      </div>

      <div class="section-title">Tus datos</div>
      <div class="card">
        <p class="small" style="margin-top:0">
          {storageMode === 'cloud' ? '☁️ Guardados en tu espacio privado de esta app en Claude (solo tú los ves).' : '📱 Guardados en este dispositivo. Exporta un respaldo de vez en cuando.'}
          {' '}{all.length} gastos registrados.
        </p>
        {storageWarning && <div class="notice">{storageWarning}</div>}
        <div class="btns"><button class="btn small" onClick={exportCSV} disabled={!all.length}>⬇️ Exportar CSV</button><button class="btn small" onClick={exportJSON}>💾 Respaldo</button></div>
        <label class="btn small ghost block" style="margin-top:8px;color:var(--ink)">📂 Importar respaldo<input type="file" accept="application/json,.json" class="sr" onChange={(e) => e.currentTarget.files[0] && importJSON(e.currentTarget.files[0])} /></label>
      </div>

      <div class="section-title">Datos de ejemplo</div>
      <div class="card">
        <p class="small muted" style="margin-top:0">Carga 4 meses de gastos ficticios para explorar los gráficos, sugerencias y logros. Puedes borrarlos después sin tocar tus datos reales.</p>
        {demoCount ? <button class="btn block ghost" onClick={() => setConfirm('demo')}>Quitar {demoCount} gastos de ejemplo</button>
          : <button class="btn block" onClick={() => actions.loadDemo()}>🎲 Cargar datos de ejemplo</button>}
      </div>

      <div class="card">
        <button class="btn block danger" onClick={() => setConfirm('wipe')}>Borrar todos mis datos</button>
      </div>
      <p class="small muted" style="text-align:center">Boletas · v1.0 · hecho con 💚 en Chile</p>

      {confirm === 'wipe' && <Confirm title="¿Borrar todo?" body="Se eliminarán todas las boletas, metas, retos y ajustes. No se puede deshacer." okLabel="Borrar todo" danger onOk={actions.wipe} onClose={() => setConfirm(null)} />}
      {confirm === 'demo' && <Confirm title="¿Quitar datos de ejemplo?" body="Solo se borran los gastos de ejemplo; tus boletas reales se mantienen." okLabel="Quitar" onOk={actions.clearDemo} onClose={() => setConfirm(null)} />}
    </div>
  );
}
