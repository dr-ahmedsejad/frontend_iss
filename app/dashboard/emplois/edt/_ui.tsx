'use client';

/**
 * Primitives partagées par les écrans IPGEI.
 *
 * Le préfixe `_` exclut ce fichier du routage App Router. Il évite de recopier
 * l'en-tête, les états vides et les jetons de couleur dans une douzaine de pages.
 */
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Vert institutionnel — repris du socle en attendant des design tokens. */
export const VERT       = '#006633';
export const VERT_CLAIR = '#008844';
export const DEGRADE    = `linear-gradient(135deg,${VERT},${VERT_CLAIR})`;

export const INPUT =
  'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 ' +
  'focus:outline-none focus:bg-white focus:border-[#006633] transition-all';

export const SELECT = INPUT + ' appearance-none';

export const BTN_PRIMAIRE =
  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white ' +
  'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all';

export const BTN_SECONDAIRE =
  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-iss-dark ' +
  'border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 ' +
  'disabled:cursor-not-allowed transition-all';

export const CARTE = 'bg-white rounded-2xl shadow-card border border-gray-100';

// ── En-tête de page ──────────────────────────────────────────────────────────
export function EnTetePage({
  icone, titre, sousTitre, actions,
}: {
  icone: ReactNode; titre: string; sousTitre?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: DEGRADE }}>
            {icone}
          </div>
          <h1 className="text-xl font-bold text-iss-dark">{titre}</h1>
        </div>
        {sousTitre && <p className="text-sm text-iss-gray">{sousTitre}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ── États ────────────────────────────────────────────────────────────────────
export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-iss-gray">
      <Loader2 size={16} className="animate-spin" /> {texte}
    </div>
  );
}

export function Vide({ texte, action }: { texte: string; action?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="text-sm text-iss-gray">{texte}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Erreur({ erreur }: { erreur: unknown }) {
  if (!erreur) return null;
  const message = erreur instanceof Error ? erreur.message : 'Une erreur est survenue.';
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Indicateurs ──────────────────────────────────────────────────────────────
export function Tuile({
  label, valeur, detail, icone,
}: { label: string; valeur: ReactNode; detail?: ReactNode; icone?: ReactNode }) {
  return (
    <div className={`${CARTE} p-4`} style={{ borderLeft: `3px solid ${VERT}` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-iss-gray uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-iss-dark mt-1">{valeur}</p>
          {detail && <p className="text-xs text-iss-gray mt-0.5">{detail}</p>}
        </div>
        {icone && <div className="text-[#006633] opacity-70">{icone}</div>}
      </div>
    </div>
  );
}

const TONS_BADGE: Record<string, string> = {
  neutre:  'bg-gray-100 text-gray-700 border-gray-200',
  vert:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  rouge:   'bg-red-50 text-red-700 border-red-200',
  ambre:   'bg-amber-50 text-amber-700 border-amber-200',
  bleu:    'bg-blue-50 text-blue-700 border-blue-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
};

export type TonBadge = keyof typeof TONS_BADGE;

export function Badge({ children, ton = 'neutre' }: { children: ReactNode; ton?: TonBadge }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${TONS_BADGE[ton]}`}>
      {children}
    </span>
  );
}

/** Couleur d'une décision de jury : favorable → vert, défavorable → rouge. */
export function tonDecision(decision: string): TonBadge {
  if (decision === 'admis' || decision === 'autorise_cnim') return 'vert';
  // « Exclu » n'existe plus : le droit de redoublement épuisé mène à une
  // réorientation, pas à un renvoi.
  if (decision === 'reoriente')                            return 'rouge';
  // Le rattrapage n'est ni un succès ni un échec : une seconde chance.
  if (decision === 'autorise_rattrapage')                  return 'ambre';
  if (decision === 'sortant')                              return 'vert';
  if (decision === 'redoublant')                            return 'ambre';
  return 'neutre';
}

export function tonStatutPermutation(statut: string): TonBadge {
  return ({
    demandee:  'ambre',
    accordee:  'bleu',
    validee:   'violet',
    appliquee: 'vert',
    refusee:   'rouge',
  } as Record<string, TonBadge>)[statut] ?? 'neutre';
}

// ── Toast minimal ────────────────────────────────────────────────────────────
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-lg"
         style={{ background: DEGRADE }}>
      {message}
    </div>
  );
}

/**
 * Formate une note décimale renvoyée par l'API (chaîne) pour l'affichage.
 * Les notes transitent en `string` pour préserver la précision décimale : les
 * convertir en `number` trop tôt réintroduirait les erreurs de flottant.
 */
export function fmtNote(valeur: string | null | undefined, vide = '—'): string {
  if (valeur === null || valeur === undefined || valeur === '') return vide;
  const n = Number(valeur);
  return Number.isFinite(n) ? n.toFixed(2) : vide;
}

/** Formate un coefficient : 8.00 → « 8 », 1.50 → « 1.5 ». */
export function fmtCoef(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const n = Number(valeur);
  return Number.isFinite(n) ? String(parseFloat(n.toFixed(2))) : '—';
}
