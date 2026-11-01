import { useState } from 'preact/hooks';
import { CATEGORIES } from '../lib/categories.js';
import { MoneyInput, Switch } from './ui.jsx';
import { clp, todayISO } from '../lib/format.js';

const SRC = { ted: ['ted', '✓ Timbre electrónico'], ocr: ['', 'Texto (OCR)'], ai: ['ai', '✨ IA'], manual: ['', 'Manual'] };

export function SourceTags({ sources = [] }) {
  return <div class="sources">{[...new Set(sources)].map((s) => SRC[s] && <span class={'tag ' + SRC[s][0]}>{SRC[s][1]}</span>)}</div>;
}

export function ReceiptForm({ draft, setDraft, extraInfo }) {
  const [showItems, setShowItems] = useState(false);
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const items = draft.items || [];
  const itemsSum = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const setItem = (i, k, v) => { const it = items.slice(); it[i] = { ...it[i], [k]: v }; set('items', it); };

  return (
    <div>
      <label for="f-m">Comercio</label>
      <input id="f-m" value={draft.merchant} placeholder="Ej: Líder, Copec, Farmacia…" onInput={(e) => set('merchant', e.currentTarget.value)} />
      <div class="grid2">
        <div><label for="f-t">Total</label><MoneyInput id="f-t" value={draft.total} onChange={(v) => set('total', v)} /></div>
        <div><label for="f-d">Fecha</label><input id="f-d" type="date" value={draft.date} max={todayISO()} onInput={(e) => set('date', e.currentTarget.value)} /></div>
      </div>
      <label>Categoría</label>
      <div class="cats">
        {CATEGORIES.map((c) => <button type="button" class={draft.category === c.id ? 'on' : ''} onClick={() => set('category', c.id)}>{c.icon} {c.name}</button>)}
      </div>
      <div class="grid2">
        <div><label for="f-r">RUT emisor</label><input id="f-r" value={draft.rut || ''} placeholder="Opcional" onInput={(e) => set('rut', e.currentTarget.value)} /></div>
        <div><label for="f-n">Nota</label><input id="f-n" value={draft.note || ''} placeholder="Opcional" onInput={(e) => set('note', e.currentTarget.value)} /></div>
      </div>

      <label style="display:flex;justify-content:space-between;align-items:center">
        <span>Detalle ({items.length} ítem{items.length === 1 ? '' : 's'}{itemsSum ? ` · ${clp(itemsSum)}` : ''})</span>
        <button type="button" class="link" onClick={() => setShowItems(!showItems)}>{showItems ? 'Ocultar' : 'Ver / editar'}</button>
      </label>
      {showItems && (
        <div class="items">
          {items.map((it, i) => (
            <div class="it">
              <input value={it.desc} aria-label="Descripción" onInput={(e) => setItem(i, 'desc', e.currentTarget.value)} />
              <MoneyInput value={it.amount} onChange={(v) => setItem(i, 'amount', v)} />
              <button type="button" aria-label="Quitar ítem" onClick={() => set('items', items.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" class="btn small ghost" onClick={() => set('items', [...items, { desc: '', amount: 0 }])}>+ Agregar ítem</button>
        </div>
      )}

      <Switch title="Gasto extraordinario" desc={extraInfo && draft.extra == null ? `Detectado automáticamente: ${extraInfo}` : 'Compras grandes o fuera de lo habitual'}
        on={draft.extra === true || (draft.extra == null && !!extraInfo)}
        onChange={(v) => set('extra', v)} />
    </div>
  );
}
