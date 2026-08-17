/**
 * Validation côté client des uploads de fichiers.
 *
 * Côté serveur, il faut TOUJOURS revalider — ce module est une protection UX
 * (éviter qu'un user upload 500 MB puis se prenne un timeout 30s) et une
 * première barrière contre les abus.
 *
 * Pour les inputs gérés par <FileDropzone>, la validation est déjà incluse.
 * Ce helper sert pour les <input type="file"> natifs.
 *
 * @example
 *   <input type="file" onChange={e => {
 *     const f = e.target.files?.[0];
 *     if (!f) return;
 *     const err = validateUpload(f, { maxSizeMb: 5, accept: '.pdf,image/*' });
 *     if (err) { toast.error(err); return; }
 *     setFile(f);
 *   }} />
 */

export interface UploadValidationOptions {
  /** Taille max en Mo (défaut : 5) */
  maxSizeMb?: number;
  /** Liste de MIME types ou extensions séparés par virgule, ex. ".pdf,image/*" */
  accept?: string;
}

/**
 * Valide un File. Retourne null si OK, sinon un message d'erreur en français.
 */
export function validateUpload(file: File, opts: UploadValidationOptions = {}): string | null {
  const { maxSizeMb = 5, accept } = opts;

  // 1. Taille
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo, max ${maxSizeMb} Mo).`;
  }

  // 2. Type (MIME ou extension)
  if (accept) {
    const accepted = accept.split(',').map(s => s.trim().toLowerCase());
    const mime     = file.type.toLowerCase();
    const ext      = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    const ok = accepted.some(a =>
      a === mime ||
      a === ext  ||
      (a.endsWith('/*') && mime.startsWith(a.slice(0, -1))),
    );
    if (!ok) return `Type de fichier non autorisé. Acceptés : ${accept}`;
  }

  return null;
}
