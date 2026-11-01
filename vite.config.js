import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// VITE_TARGET=claude genera la versión para publicar dentro de claude.ai (sin motores wasm/OCR locales)
const claude = process.env.VITE_TARGET === 'claude';

export default defineConfig({
  base: './',
  plugins: [preact()],
  publicDir: claude ? 'public-claude' : 'public',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000, outDir: claude ? 'dist-claude' : 'dist' },
  optimizeDeps: { exclude: ['zxing-wasm'] },
});
