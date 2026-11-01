// Almacenamiento con dos backends:
//  - "cloud": base de datos del artifact de Claude (privada por usuario) cuando la app corre en claude.ai
//  - "local": localStorage del dispositivo (APK / PWA / navegador)
// Los datos se guardan en documentos: uno de ajustes y uno por mes con sus boletas.

const LS = 'boletapp:v1:';
const lsGet = (k) => { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch { return false; } };
const lsKeys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith(LS)).map((k) => k.slice(LS.length)); } catch { return []; } };
const lsDel = (k) => { try { localStorage.removeItem(LS + k); } catch { /* */ } };

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

function localBackend() {
  return {
    mode: 'local',
    async loadAll() {
      const settings = lsGet('settings');
      const months = {};
      for (const k of lsKeys()) if (k.startsWith('m:')) months[k.slice(2)] = lsGet(k)?.receipts || [];
      return { settings, months };
    },
    async saveSettings(s) { if (!lsSet('settings', s)) throw new Error('No se pudo guardar en este dispositivo'); },
    async saveMonth(mk, receipts) {
      if (!receipts.length) return lsDel('m:' + mk);
      if (!lsSet('m:' + mk, { receipts })) throw new Error('Almacenamiento lleno');
    },
    async wipe() { for (const k of lsKeys()) lsDel(k); },
  };
}

function cloudBackend(db, uid) {
  const col = db.collection('data/users/' + uid);
  // Una escritura a la vez por documento
  const queues = {};
  const enqueue = (id, fn) => { const prev = queues[id] || Promise.resolve(); const next = prev.catch(() => {}).then(fn); queues[id] = next; return next; };
  const retry = async (fn) => { try { return await fn(); } catch (e) { if (e?.code === 'unavailable') { await new Promise((r) => setTimeout(r, 600 + Math.random() * 800)); return fn(); } throw e; } };
  const errMsg = (e) => {
    if (e?.code === 'quota_exceeded') return 'Se llenó el espacio de la base de datos. Exporta y borra meses antiguos.';
    if (e?.code === 'invalid_argument') return 'No tienes permiso para guardar en esta app (pide acceso de Contributor o superior).';
    return e?.message || 'Error al guardar';
  };
  return {
    mode: 'cloud',
    async loadAll() {
      const snap = await col.get();
      const months = {}; let settings = null;
      for (const d of snap.docs) {
        if (!d.exists) continue;
        const data = d.data();
        if (d.id === 'settings') settings = JSON.parse(JSON.stringify(data));
        else if (d.id.startsWith('m-')) months[d.id.slice(2)] = JSON.parse(JSON.stringify(data.receipts || []));
      }
      return { settings, months };
    },
    saveSettings(s) { return enqueue('settings', () => retry(() => col.doc('settings').set(s))).catch((e) => { throw new Error(errMsg(e)); }); },
    saveMonth(mk, receipts) {
      const id = 'm-' + mk;
      return enqueue(id, () => retry(() => (receipts.length ? col.doc(id).set({ receipts }) : col.doc(id).delete()))).catch((e) => { throw new Error(errMsg(e)); });
    },
    async wipe() {
      const snap = await col.get();
      for (const d of snap.docs) await col.doc(d.id).delete();
    },
  };
}

export async function openStorage() {
  const hasClaude = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
  if (hasClaude) {
    try {
      const [db, user] = await Promise.all([withTimeout(window.claude.use('db'), 11000), withTimeout(window.claude.use('user'), 11000)]);
      const uid = db && user ? await user.id() : null;
      if (db && uid) {
        const b = cloudBackend(db, uid);
        // Primera lectura con límite de tiempo
        const data = await withTimeout(b.loadAll(), 12000);
        if (data) return { backend: b, data };
        return { backend: localBackend(), data: await localBackend().loadAll(), warning: 'No se pudo conectar con la base de datos; usando almacenamiento del navegador.' };
      }
    } catch (e) { console.warn('db no disponible', e); }
    return { backend: localBackend(), data: await localBackend().loadAll(), warning: 'Sin base de datos en la nube: los datos quedan solo en este navegador.' };
  }
  const b = localBackend();
  return { backend: b, data: await b.loadAll() };
}
