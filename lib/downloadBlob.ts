/**
 * Coordination des téléchargements de blob (PDF, Excel, etc.).
 *
 * Pendant qu'un téléchargement est en cours (génération côté serveur lente
 * comme wkhtmltopdf qui prend 5-10 s), le browser peut interrompre les autres
 * requêtes — produisant des "Failed to fetch" parasites. apiFetch / apiFetchBlob
 * consultent `isDownloadingRecently()` pour silencieusement ignorer ces erreurs.
 *
 * - markDownloadStart() : appelé par apiFetchBlob avant le fetch.
 * - markDownloadEnd()   : appelé en finally (succès ou erreur).
 * - downloadBlob()      : appelle markDownloadEnd() pour étendre la fenêtre
 *                          jusqu'à l'écriture du fichier sur disque.
 */
let _activeDownloads = 0;
let _lastDownloadAt  = 0;

export function markDownloadStart(): void {
  _activeDownloads++;
  _lastDownloadAt = Date.now();
}

export function markDownloadEnd(): void {
  if (_activeDownloads > 0) _activeDownloads--;
  _lastDownloadAt = Date.now();
}

/**
 * True si un download est en cours OU vient de se terminer (fenêtre par défaut 15 s).
 * Utilisé pour silencieusement ignorer les "Failed to fetch" parasites.
 * Fenêtre large car wkhtmltopdf peut prendre 10 s + délais navigateur post-download.
 */
export function isDownloadingRecently(windowMs = 15000): boolean {
  if (_activeDownloads > 0) return true;
  return Date.now() - _lastDownloadAt < windowMs;
}

export function downloadBlob(blob: Blob, filename: string) {
  _lastDownloadAt = Date.now();
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  // Non-bubbling click bypasses Next.js router's document-level listener
  a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
  document.body.removeChild(a);
  // Délai allongé : certains navigateurs téléchargent encore le blob à la première
  // ms et peuvent rencontrer une erreur si on revoke trop vite.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
