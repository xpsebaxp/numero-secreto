// Exportar archivos (CSV / respaldo JSON) según el entorno.
export async function saveFile(filename, text, mime = 'text/plain') {
  // 1) claude.ai artifact
  if (window.claude && typeof window.claude.use === 'function') {
    const d = await Promise.race([window.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 5000))]).catch(() => null);
    if (d) { await d.save({ filename, data: new Blob([text], { type: mime }) }); return 'saved'; }
  }
  // 2) APK (Capacitor) con plugins Filesystem + Share
  if (window.Capacitor?.isNativePlatform?.()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const r = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: r.uri });
    return 'shared';
  }
  // 3) Navegador normal
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
