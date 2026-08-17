'use client';

/**
 * Cellule d'emploi du temps — affichage adapte selon le type de seance.
 *
 * Deux modes :
 *  - Standard : prof + EM + salle + badge type (utilise pour CM, TD, TP, PR, ...)
 *  - Special  : libelle du type centre, sans prof/EM/salle (Sport, Instruction
 *               militaire, Conferences, etc.). Le flag vient de la BD via
 *               `Seance.is_special` -> `type_seance_is_special` dans l'API.
 *
 * Pour ajouter un nouveau type special : aucune modif de code. L'admin coche
 * `is_special` dans Parametres -> Seances.
 */

interface CellEmploiData {
  id?:                       number;
  type_seance:               string | null;
  type_seance_label?:        string | null;
  type_seance_is_special?:   boolean;
  prof_nom?:                 string | null;
  em_code?:                  string | null;
  em_intitule?:              string | null;
  salle_nom?:                string | null;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  CM: { bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5' },
  TD: { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', color: '#2E7D32' },
  TP: { bg: 'rgba(255,152,0,0.10)',  border: '#FF9800', color: '#EF6C00' },
  PR: { bg: 'rgba(156,39,176,0.10)', border: '#9C27B0', color: '#6A1B9A' },
};
const DEFAULT_TYPE  = { bg: 'rgba(96,125,139,0.08)', border: '#607D8B', color: '#37474F' };
// Style pastel sobre pour les types speciaux (Sport, IM, ...)
const SPECIAL_STYLE = { bg: 'rgba(244,162,97,0.12)', border: '#F4A261', color: '#9C4221' };

export default function CellEmploi({ e }: { e: CellEmploiData }) {
  const typeLabel = e.type_seance_label || e.type_seance || '—';

  // Mode special : type centre, sans details
  if (e.type_seance_is_special) {
    return (
      <div style={{
        background: SPECIAL_STYLE.bg,
        border: `1px solid ${SPECIAL_STYLE.border}`,
        borderRadius: 8,
        padding: '8px 4px',
        minHeight: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: SPECIAL_STYLE.color,
          letterSpacing: 0.3,
        }}>
          {typeLabel}
        </div>
      </div>
    );
  }

  // Mode standard : prof / EM / salle / badge type
  const tc = TYPE_COLORS[typeLabel] ?? DEFAULT_TYPE;
  return (
    <div className="relative" style={{
      background: tc.bg,
      border: `1px solid ${tc.border}`,
      borderRadius: 8,
      padding: '22px 4px 6px 4px',
      minHeight: 70,
    }}>
      <span style={{
        position: 'absolute', top: 3, right: 4,
        background: 'rgba(255,255,255,0.92)', border: `1px solid ${tc.border}`,
        color: tc.color, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
      }}>{typeLabel}</span>
      {e.salle_nom && (
        <span style={{
          position: 'absolute', top: 3, left: 4,
          background: 'rgba(255,255,255,0.92)', border: '1px solid #607D8B',
          color: '#37474F', borderRadius: 8, padding: '1px 6px', fontSize: 10,
        }}>{e.salle_nom}</span>
      )}
      <div style={{ fontWeight: 700, fontSize: 12, color: tc.color }}>{e.em_code || '—'}</div>
      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.3 }}
           title={e.em_intitule ?? ''}
           className="truncate">
        {e.em_intitule || '—'}
      </div>
      {e.prof_nom && (
        <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginTop: 4 }}
             className="truncate">
          {e.prof_nom}
        </div>
      )}
    </div>
  );
}
