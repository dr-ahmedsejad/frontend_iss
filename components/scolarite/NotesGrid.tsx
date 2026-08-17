'use client';

import { memo, useCallback, useRef } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import type { FicheNote } from '@/types/evaluations';

interface NotesGridProps {
  fiches:    FicheNote[];
  locked?:   boolean;
  hasTP?:    boolean;
  onlyExam?: boolean;
  onChange?: (updated: FicheNote) => void;
}

type TypeNote = 'CC' | 'TP' | 'EXAM';
const ALL_TYPES: { key: TypeNote; label: string }[] = [
  { key: 'CC',   label: 'CC'   },
  { key: 'TP',   label: 'TP'   },
  { key: 'EXAM', label: 'Exam' },
];

function inputClass(isLocked: boolean): string {
  return `w-16 text-center border rounded-lg px-1.5 py-1 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary ${
    isLocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white hover:border-iss-primary'
  }`;
}

// F-3 : Ligne extraite + memoisee. Le parent met a jour `fiches` par un map qui
// preserve la reference des autres lignes -> seule la ligne editee re-render
// (gain INP estime 200ms -> 30ms sur grosses promos).
interface NoteRowProps {
  fiche:        FicheNote;
  types:        { key: TypeNote; label: string }[];
  hasTP:        boolean;
  locked:       boolean;
  onCellChange: (inscriptionElement: number, type: TypeNote, val: number | null) => void;
}

const NoteRow = memo(function NoteRow({
  fiche, types, hasTP, locked, onCellChange,
}: NoteRowProps) {
  const parseNote = (v: string): number | null => {
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    return Math.min(20, Math.max(0, n));
  };
  return (
    <tr>
      <td className="font-mono text-xs">{fiche.etudiant_matricule}</td>
      <td className="font-medium text-sm">{fiche.etudiant_nom}</td>
      {types.map(({ key }) => {
        const isTPCol    = key === 'TP';
        const tpLocked   = isTPCol && !hasTP;
        const cellLocked = locked || tpLocked;
        const cell       = fiche[key.toLowerCase() as 'cc' | 'tp' | 'exam'];
        return (
          <td key={key} className="text-center">
            <input
              type="number"
              min={0} max={isTPCol ? 5 : 20} step={0.25}
              value={cell.valeur ?? ''}
              disabled={cellLocked}
              onChange={e => onCellChange(fiche.inscription_element, key, parseNote(e.target.value))}
              className={`${inputClass(cellLocked)} ${tpLocked ? 'bg-amber-50 border-amber-100' : ''}`}
              title={tpLocked ? 'Pas de TP pour cet élément' : undefined}
            />
          </td>
        );
      })}
    </tr>
  );
});

/**
 * Tableau de saisie des notes — composant CONTRÔLÉ.
 * Il ne fait AUCUN appel réseau : chaque frappe remonte la fiche modifiée au
 * parent via `onChange`. La persistance est déclenchée uniquement par le parent
 * (bouton « Tout enregistrer »). Source unique de vérité = la prop `fiches`.
 * → plus d'auto-save différée, donc plus de double-écriture ni de perte au
 *   changement d'élément avant la fin d'un debounce.
 */
export default function NotesGrid({ fiches, locked = false, hasTP = true, onlyExam = false, onChange }: NotesGridProps) {
  // En rattrapage : afficher uniquement la colonne EXAM, renommée "Rattrapage"
  const TYPES = onlyExam
    ? [{ key: 'EXAM' as TypeNote, label: 'Rattrapage' }]
    : ALL_TYPES;

  // Ref stable vers les fiches : permet à `updateCell` de garder la même
  // référence d'un render à l'autre (sinon la memo de NoteRow saute et toutes
  // les lignes se re-render à chaque frappe).
  const fichesRef = useRef<FicheNote[]>(fiches);
  fichesRef.current = fiches;

  const updateCell = useCallback((
    inscriptionElement: number,
    typeNote: TypeNote,
    valeur: number | null,
  ) => {
    const fiche = fichesRef.current.find(r => r.inscription_element === inscriptionElement);
    if (!fiche) return;
    const k = typeNote.toLowerCase() as 'cc' | 'tp' | 'exam';
    onChange?.({ ...fiche, [k]: { ...fiche[k], valeur } });
  }, [onChange]);

  return (
    <div className="relative">
      {locked && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <Lock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-700">
            La saisie est verrouillée — session ou délibération clôturée.
          </p>
        </div>
      )}
      {onlyExam && !locked && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-700">
            Session de rattrapage — seule la colonne <strong>Rattrapage</strong> est saisie (CC et TP conservés de la session normale).
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left">Matricule</th>
              <th className="text-left">Étudiant</th>
              {TYPES.map(t => {
                const isTPCol = t.key === 'TP';
                const tpLocked = isTPCol && !hasTP;
                return (
                  <th key={t.key} className="text-center w-20">
                    {t.label}
                   
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fiches.map(fiche => (
              <NoteRow
                key={fiche.inscription_element}
                fiche={fiche}
                types={TYPES}
                hasTP={hasTP}
                locked={locked}
                onCellChange={updateCell}
              />
            ))}
          </tbody>
        </table>

        {fiches.length === 0 && (
          <div className="flex flex-col items-center py-12 text-iss-gray gap-2">
            <AlertTriangle size={24} />
            <p className="text-sm">Aucun étudiant inscrit à cet élément</p>
          </div>
        )}
      </div>
    </div>
  );
}
