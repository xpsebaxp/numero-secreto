import { render } from 'preact';
import { App } from './app.jsx';
import './styles.css';

render(<App />, document.getElementById('root'));

// PWA: service worker solo fuera de claude.ai y fuera del APK (en ambos no aplica)
const inClaude = !!(window.claude && window.claude.use);
const inApk = !!window.Capacitor?.isNativePlatform?.();
if (!inClaude && !inApk && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
