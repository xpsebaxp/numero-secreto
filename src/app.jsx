import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { openStorage } from './platform/storage.js';
import { aiAvailability } from './platform/ai.js';
import { monthStats, monthHistory, flatten } from './lib/analytics.js';
import { computeGame } from './lib/gamification.js';
import { learnCategory } from './lib/categories.js';
import { generateDemo } from './lib/demo.js';
import { currentMonthKey, monthKey, shiftMonth, monthLabel, daysInMonth } from './lib/format.js';
import { Home } from './views/Home.jsx';
import { Receipts } from './views/Receipts.jsx';
import { Analysis } from './views/Analysis.jsx';
import { Goals } from './views/Goals.jsx';
import { Settings } from './views/Settings.jsx';
import { ScanSheet, EditSheet } from './components/ScanSheet.jsx';
import { Confetti } from './components/ui.jsx';

const VIEWS = ['inicio', 'boletas', 'analisis', 'metas', 'ajustes'];
const DEFAULTS = { budget: 0, catBudgets: {}, learned: {}, goals: [], challenges: [], ocr: true, aiAuto: false, closedMonths: {} };
const viewFromHash = () => { const h = location.hash.replace('#', ''); return VIEWS.includes(h) ? h : 'inicio'; };

export function App() {
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState(null);
  const [warning, setWarning] = useState('');
  const [settings, setSettings] = useState(DEFAULTS);
  const [months, setMonths] = useState({});
  const [view, setView] = useState(viewFromHash());
  const [mk, setMk] = useState(currentMonthKey());
  const [scan, setScan] = useState(null);
  const [edit, setEdit] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [ai, setAi] = useState({ mode: null, images: false });
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const monthsRef = useRef(months); monthsRef.current = months;

  // ---------- Carga ----------
  useEffect(() => {
    (async () => {
      const { backend: b, data, warning: w } = await openStorage();
      setBackend(b); if (w) setWarning(w);
      setSettings({ ...DEFAULTS, ...(data.settings || {}) });
      setMonths(data.months || {});
      setLoading(false);
    })();
    const onHash = () => { setView(viewFromHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { aiAvailability(settings).then(setAi); }, [settings.apiKey]);

  const toast = (m) => { const id = Math.random(); setToasts((t) => [...t, { id, m }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200); };
  const fail = (e) => toast('⚠️ ' + (e?.message || 'No se pudo guardar'));

  // ---------- Persistencia ----------
  const update = (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next; setSettings(next);
    backend.saveSettings(next).catch(fail);
  };
  const writeMonths = (next, keys) => {
    monthsRef.current = next; setMonths(next);
    for (const k of new Set(keys)) backend.saveMonth(k, next[k] || []).catch(fail);
  };

  const actions = {
    add(r) {
      const k = monthKey(r.date); const cur = monthsRef.current;
      writeMonths({ ...cur, [k]: [...(cur[k] || []), r] }, [k]);
      update({ learned: learnCategory(settingsRef.current.learned || {}, r, r.category) });
      toast(<span>Guardado · <span class="x">+{r.source === 'manual' ? 10 : 15} XP</span></span>);
      setScan(null); setMk(k);
    },
    save(r) {
      const cur = monthsRef.current; const keys = [];
      const next = { ...cur };
      for (const k of Object.keys(next)) if (next[k].some((x) => x.id === r.id)) { next[k] = next[k].filter((x) => x.id !== r.id); keys.push(k); }
      const k = monthKey(r.date); next[k] = [...(next[k] || []), r]; keys.push(k);
      writeMonths(next, keys);
      update({ learned: learnCategory(settingsRef.current.learned || {}, r, r.category) });
      setEdit(null); toast('Cambios guardados');
    },
    remove(r) {
      const k = monthKey(r.date); const cur = monthsRef.current;
      writeMonths({ ...cur, [k]: (cur[k] || []).filter((x) => x.id !== r.id) }, [k]);
      setEdit(null); toast('Gasto eliminado');
    },
    markExtra(r, v) {
      const k = monthKey(r.date); const cur = monthsRef.current;
      writeMonths({ ...cur, [k]: cur[k].map((x) => (x.id === r.id ? { ...x, extra: v } : x)) }, [k]);
      toast(v ? 'Marcado como extraordinario' : 'Marcado como gasto normal');
    },
    loadDemo() {
      const demo = generateDemo(); const cur = monthsRef.current; const next = { ...cur };
      for (const [k, list] of Object.entries(demo)) next[k] = [...(next[k] || []).filter((r) => !r.demo), ...list];
      writeMonths(next, Object.keys(demo));
      if (!settingsRef.current.budget) update({ budget: 1100000 });
      toast('🎲 Datos de ejemplo cargados'); location.hash = 'inicio';
    },
    clearDemo() {
      const cur = monthsRef.current; const next = {}; const keys = [];
      for (const [k, list] of Object.entries(cur)) { const f = list.filter((r) => !r.demo); if (f.length !== list.length) keys.push(k); next[k] = f; }
      writeMonths(next, keys); toast('Datos de ejemplo eliminados');
    },
    async wipe() {
      await backend.wipe().catch(fail);
      monthsRef.current = {}; setMonths({});
      const s = { ...DEFAULTS, apiKey: settingsRef.current.apiKey };
      settingsRef.current = s; setSettings(s); backend.saveSettings(s).catch(fail);
      toast('Datos borrados');
    },
    async importData(j) {
      const next = { ...monthsRef.current };
      for (const [k, list] of Object.entries(j.months)) {
        const ids = new Set((next[k] || []).map((r) => r.id));
        next[k] = [...(next[k] || []), ...list.filter((r) => !ids.has(r.id))];
      }
      writeMonths(next, Object.keys(j.months));
      update({ ...j.settings, apiKey: settingsRef.current.apiKey });
    },
  };

  // ---------- Derivados ----------
  const st = useMemo(() => monthStats(months, mk, settings), [months, mk, settings]);
  const history = useMemo(() => monthHistory(months, mk, 6), [months, mk]);
  const game = useMemo(() => computeGame(months, settings), [months, settings]);
  const all = useMemo(() => flatten(months), [months]);
  const prevCumulative = useMemo(() => {
    const prev = st.prevMonths; if (!prev.length) return null;
    return Array.from({ length: st.dim }, (_, i) => prev.reduce((a, p) => a + months[p].filter((r) => Number(r.date.slice(8, 10)) <= Math.min(i + 1, daysInMonth(p))).reduce((x, r) => x + r.total, 0), 0) / prev.length);
  }, [months, st.mk]);
  const firstMk = useMemo(() => Object.keys(months).filter((k) => months[k].length).sort()[0] || currentMonthKey(), [months]);

  // ---------- Celebraciones (insignias nuevas / subida de nivel) ----------
  useEffect(() => {
    if (loading) return;
    const got = game.badges.filter((b) => b.got).map((b) => b.id);
    const seen = settings.seenBadges;
    if (!seen) { update({ seenBadges: got, seenLevel: game.level.n }); return; }
    const fresh = game.badges.filter((b) => b.got && !seen.includes(b.id));
    const lvUp = game.level.n > (settings.seenLevel || 1);
    if (fresh.length || lvUp) {
      setCelebration({ badges: fresh, level: lvUp ? game.level : null });
      update({ seenBadges: [...new Set([...seen, ...got])], seenLevel: Math.max(game.level.n, settings.seenLevel || 1) });
    }
  }, [game.xp, game.badges.filter((b) => b.got).length, loading]);

  if (loading) return <div class="loading"><div class="spin" /><span>Cargando tus boletas…</span></div>;

  const go = (v) => { location.hash = v; };
  const titles = { inicio: null, boletas: 'Boletas', analisis: 'Análisis', metas: 'Metas y logros', ajustes: 'Ajustes' };
  const showMonth = ['inicio', 'boletas', 'analisis'].includes(view);
  const cur = currentMonthKey();

  return (
    <>
      <div class="app">
        <header class="top">
          <div class="brand"><span class="logo" aria-hidden="true">🧾</span>{titles[view] || 'Mis Boletas'}</div>
          {showMonth && (
            <div class="month-pick">
              <button aria-label="Mes anterior" disabled={mk <= firstMk} onClick={() => setMk(shiftMonth(mk, -1))}>‹</button>
              <span>{mk.slice(0, 4) === cur.slice(0, 4) ? monthLabel(mk).replace(/ \d{4}$/, '') : monthLabel(mk)}</span>
              <button aria-label="Mes siguiente" disabled={mk >= cur} onClick={() => setMk(shiftMonth(mk, 1))}>›</button>
            </div>
          )}
        </header>

        {view === 'inicio' && <Home st={st} settings={settings} game={game} prevCumulative={prevCumulative} onEdit={setEdit} onScan={() => setScan({})} go={go} />}
        {view === 'boletas' && <Receipts st={st} onEdit={setEdit} onScan={() => setScan({})} onManual={() => setScan({ manual: true })} />}
        {view === 'analisis' && <Analysis st={st} months={months} history={history} settings={settings} ai={ai} setMonth={setMk} onEdit={setEdit} onMarkExtra={actions.markExtra} />}
        {view === 'metas' && <Goals settings={settings} game={game} months={months} st={monthStats(months, cur, settings)} update={update} toast={toast} />}
        {view === 'ajustes' && <Settings settings={settings} months={months} storageMode={backend.mode} storageWarning={warning} ai={ai} update={update} actions={actions} toast={toast} />}
      </div>

      <nav class="nav" aria-label="Secciones">
        <div class="nav-in">
          <a href="#inicio" class={view === 'inicio' ? 'on' : ''}><span class="ni">🏠</span>Inicio</a>
          <a href="#analisis" class={view === 'analisis' ? 'on' : ''}><span class="ni">📊</span>Análisis</a>
          <button class="scan" aria-label="Escanear boleta" onClick={() => setScan({})}>📷</button>
          <a href="#metas" class={view === 'metas' ? 'on' : ''}><span class="ni">🏆</span>Metas</a>
          <a href="#ajustes" class={view === 'ajustes' ? 'on' : ''}><span class="ni">⚙️</span>Ajustes</a>
        </div>
      </nav>

      {scan && <ScanSheet settings={settings} ai={ai} allReceipts={all} startManual={scan.manual} onSave={actions.add} onClose={() => setScan(null)} />}
      {edit && <EditSheet receipt={edit} extraInfo={st.extras.get(edit.id)?.reason || monthStats(months, monthKey(edit.date), settings).extras.get(edit.id)?.reason} onSave={actions.save} onDelete={actions.remove} onClose={() => setEdit(null)} />}

      <div class="toasts" aria-live="polite">{toasts.map((t) => <div class="toast">{t.m}</div>)}</div>

      {celebration && (
        <>
          <Confetti />
          <div class="celebrate" onClick={() => setCelebration(null)}>
            <div class="box" onClick={(e) => e.stopPropagation()}>
              {celebration.level ? (
                <><span class="e">{celebration.level.icon}</span><h2>¡Subiste a nivel {celebration.level.n}!</h2><p>Ahora eres <b>{celebration.level.name}</b>.{celebration.badges.length ? ` Y desbloqueaste ${celebration.badges.length} insignia${celebration.badges.length > 1 ? 's' : ''}: ${celebration.badges.map((b) => b.icon + ' ' + b.name).join(', ')}.` : ''}</p></>
              ) : celebration.badges.length === 1 ? (
                <><span class="e">{celebration.badges[0].icon}</span><h2>¡Nueva insignia!</h2><p><b>{celebration.badges[0].name}</b>: {celebration.badges[0].desc}.</p></>
              ) : (
                <><span class="e">🏅</span><h2>¡{celebration.badges.length} insignias nuevas!</h2><p>{celebration.badges.map((b) => b.icon + ' ' + b.name).join(' · ')}</p></>
              )}
              <button class="btn primary block" onClick={() => setCelebration(null)}>¡Genial!</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
