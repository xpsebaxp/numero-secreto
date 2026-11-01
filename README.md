# 🧾 Mis Boletas

App para escanear boletas chilenas, controlar los gastos del mes y cumplir metas de ahorro con gamificación.

## Qué hace

- **Lee boletas** desde una foto:
  - **Timbre electrónico (PDF417)**: el código de barras del SII trae el RUT, la razón social, el folio, la fecha, el total y el primer ítem. Es dato tributario exacto y se lee sin internet.
  - **OCR en el teléfono** (Tesseract, español): extrae los ítems y lee boletas o vouchers sin timbre.
  - **IA opcional (Claude)**: lee el detalle con más precisión. Dentro de claude.ai no requiere configuración; en el APK usa tu API key de Anthropic.
- **Categoriza** automáticamente (más de 300 comercios y rubros chilenos) y **aprende** cuando corriges una categoría (por RUT y por nombre).
- **Análisis del mes**: gasto acumulado contra el ritmo del presupuesto, proyección de cierre, categorías contra tu promedio a la misma fecha, comercios top e historial de 6 meses.
- **Gastos extraordinarios**: detecta compras fuera de lo normal (en comparación con lo que sueles gastar en ese comercio o categoría, o según su peso en tu presupuesto). Puedes confirmar o descartar cada caso.
- **Sugerencias**: ritmo de gasto, alzas por categoría, compras hormiga, delivery, frecuencia de idas al súper, patrones de fin de semana… y, si quieres, un análisis personalizado con IA.
- **Metas y gamificación**: presupuesto mensual y topes por categoría, metas de ahorro con aportes, retos semanales, XP, 8 niveles, racha 🔥 e insignias.
- **Tus datos**: exportación a CSV (se abre en Excel) y respaldo/restauración en JSON.

## Estructura

```
src/
  lib/          lógica pura: timbre SII, parser de boletas, categorías, análisis, gamificación
  platform/     almacenamiento (claude.ai o dispositivo), IA (Claude) y descargas
  components/   hojas de escaneo/edición, gráficos SVG, UI
  views/        Inicio, Boletas, Análisis, Metas, Ajustes
public/vendor/  motor OCR + datos en español + lector PDF417 (todo local, funciona sin internet)
```

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
```

## Generar el APK

### Opción A: GitHub compila por ti (sin instalar nada)
1. Crea un repositorio en GitHub y sube esta carpeta.
2. GitHub Actions ejecuta `.github/workflows/apk.yml` automáticamente.
3. Entra a **Actions → la ejecución más reciente → Artifacts → mis-boletas-apk** y descarga el APK.
4. En el teléfono: abre el APK y acepta "instalar apps de origen desconocido".

### Opción B: Android Studio
```bash
npm install
npx cap add android
npm run apk:sync
npm run apk:open    # abre Android Studio → Build → Build APK(s)
```
Agrega el permiso de cámara en `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### Opción C: instalar como web app (PWA)
Publica `dist/` en un hosting con HTTPS (GitHub Pages, Netlify, Vercel). En Android abre la página en Chrome → menú ⋮ → **Instalar app**. Funciona sin conexión gracias al service worker.

## Privacidad
- El timbre y el OCR se procesan en el dispositivo; la foto no sale del teléfono.
- La IA solo se usa si la activas, y envía la imagen a Claude.
- En el APK y en la PWA los datos quedan en el teléfono (localStorage). Exporta respaldos de vez en cuando.
- Dentro de claude.ai los datos se guardan en el espacio privado de cada usuario de la app.

## Consejos para escanear
- Usa buena luz, sin sombras ni brillos sobre el papel térmico.
- Asegúrate de que el código de barras del timbre salga completo y nítido.
- Las boletas arrugadas se leen mejor si las estiras sobre una superficie plana.
