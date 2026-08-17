import { StatutPresence } from '@/types/absences';

interface Props {
  statut: number;
  className?: string;
  abbr?: boolean;
}

export const STATUTS: Record<number, { label: string; abbr: string; color: string; bg: string }> = {
  [StatutPresence.Present]:    { label: 'Présent',    abbr: 'P', color: '#006633', bg: 'rgba(0,102,51,0.10)'   },
  [StatutPresence.Absent]:     { label: 'Absent',     abbr: 'A', color: '#C82020', bg: 'rgba(200,32,32,0.10)'  },
  [StatutPresence.Sanctionne]: { label: 'Sanctionné', abbr: 'S', color: '#B8960C', bg: 'rgba(184,150,12,0.10)' },
  [StatutPresence.Justifiee]:  { label: 'Justifiée',  abbr: 'J', color: '#1a5c8f', bg: 'rgba(26,92,143,0.10)'  },
};

export function getStatutStyle(statut: number) {
  return STATUTS[statut] ?? STATUTS[StatutPresence.Absent];
}

export default function StatutBadge({ statut, className = '', abbr = false }: Props) {
  const st = getStatutStyle(statut);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ background: st.bg, color: st.color }}
    >
      {abbr ? st.abbr : st.label}
    </span>
  );
}
