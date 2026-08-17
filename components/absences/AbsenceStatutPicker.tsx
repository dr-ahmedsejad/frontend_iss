'use client';

import { StatutPresence } from '@/types/absences';
import { getStatutStyle } from './StatutBadge';

interface Props {
  statut: number;
  onChange: (statut: number) => void;
  canFullCycle?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const AGENT_CYCLE = [StatutPresence.Present, StatutPresence.Absent];
const FULL_CYCLE  = [
  StatutPresence.Present,
  StatutPresence.Absent,
  StatutPresence.Sanctionne,
  StatutPresence.Justifiee,
];

export default function AbsenceStatutPicker({
  statut, onChange, canFullCycle = false, disabled, size = 'sm',
}: Props) {
  const cycle = canFullCycle ? FULL_CYCLE : AGENT_CYCLE;
  const st = getStatutStyle(statut);

  function next() {
    if (disabled) return;
    const idx = cycle.indexOf(statut as StatutPresence);
    onChange(cycle[(idx + 1) % cycle.length]);
  }

  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  return (
    <button
      onClick={next}
      disabled={disabled}
      title={`${st.label} — cliquer pour changer`}
      className={`${dim} rounded-lg font-bold transition-all hover:scale-110 active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{ background: st.bg, color: st.color }}
    >
      {st.abbr}
    </button>
  );
}
