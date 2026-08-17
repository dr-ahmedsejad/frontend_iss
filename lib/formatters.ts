/** Formateurs utilitaires partagés : dates, notes, mentions, montants. */

/** Formate une date ISO en DD/MM/YYYY. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formate une date ISO en "12 mars 2026" (mois court). */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Formate une date ISO en "mars 2026". */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Formate une date ISO en DD/MM/YYYY HH:mm. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formate une note sur 20 avec 2 décimales (arrondi half-up : 15.125 → 15.13), ou '—'.
 *  Math.round(n*100)/100 force l'arrondi half-up (15.125 * 100 = 1512.5 → 1513 → 15.13)
 *  contrairement à toFixed() dont le comportement varie selon le navigateur. */
export function formatNote(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toFixed(2);
}

/** Retourne la mention LMD selon la moyenne. */
export function getMention(moyenne: number | null | undefined): string {
  if (moyenne === null || moyenne === undefined) return '—';
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Ajourné';
}

/** Couleur Tailwind de la mention. */
export function mentionColor(mention: string): string {
  switch (mention) {
    case 'Excellent': return 'text-emerald-700';
    case 'Très Bien': return 'text-emerald-600';
    case 'Bien':      return 'text-green-600';
    case 'Assez Bien': return 'text-blue-600';
    case 'Passable':  return 'text-yellow-600';
    default:          return 'text-red-600';
  }
}

/** Formate un montant en MRU. */
export function formatMontant(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(n) + ' MRU';
}
