import { useEffect, useState } from 'preact/hooks';

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="sheet" role="dialog" aria-modal="true"><div class="grab" />{children}</div>
    </div>
  );
}

export function Confirm({ title, body, okLabel = 'Confirmar', danger, onOk, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <h2>{title}</h2>
      {body && <p class="lead">{body}</p>}
      <div class="btns">
        <button class="btn ghost" onClick={onClose}>Cancelar</button>
        <button class={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => { onOk(); onClose(); }}>{okLabel}</button>
      </div>
    </Sheet>
  );
}

export function Toggle({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} class={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} />;
}

export function Switch({ title, desc, on, onChange }) {
  return (
    <div class="switch">
      <div class="tx"><b>{title}</b>{desc && <small>{desc}</small>}</div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

// Campo de monto en CLP con separador de miles
export function MoneyInput({ value, onChange, placeholder, id }) {
  const [txt, setTxt] = useState(value ? Number(value).toLocaleString('es-CL') : '');
  useEffect(() => { const cur = Number(txt.replace(/\D/g, '')) || 0; if (cur !== (Number(value) || 0)) setTxt(value ? Number(value).toLocaleString('es-CL') : ''); }, [value]);
  return (
    <input id={id} inputMode="numeric" placeholder={placeholder || '$0'} value={txt ? '$' + txt : ''}
      onInput={(e) => { const n = Number(e.currentTarget.value.replace(/\D/g, '')) || 0; setTxt(n ? n.toLocaleString('es-CL') : ''); onChange(n); }} />
  );
}

export function Ring({ value = 0, size = 46, color = 'var(--xp)', children }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" stroke-width="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width="5" stroke-linecap="round"
        stroke-dasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="16">{children}</text>
    </svg>
  );
}

export function Confetti() {
  const colors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
  const pieces = Array.from({ length: 70 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.8 + Math.random() * 1.6, c: colors[i % colors.length], rot: Math.random() * 360 }));
  return <div class="confetti" aria-hidden="true">{pieces.map((p) => <i style={{ left: p.left + '%', background: p.c, animationDuration: p.dur + 's', animationDelay: p.delay + 's', transform: `rotate(${p.rot}deg)` }} />)}</div>;
}
