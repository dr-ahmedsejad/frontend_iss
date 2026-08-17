'use client';

import { Check, X } from 'lucide-react';
import { StatutPresence } from '@/types/absences';

interface Props {
  statut: number;
  onChange: (statut: number) => void;
  disabled?: boolean;
  nom?: string;
  matricule?: string;
}

export default function PresentAbsentToggle({ statut, onChange, disabled, nom, matricule }: Props) {
  const isAbsent = statut === StatutPresence.Absent;

  return (
    <button
      onClick={() => onChange(isAbsent ? StatutPresence.Present : StatutPresence.Absent)}
      disabled={disabled}
      aria-label={isAbsent ? 'Marquer présent' : 'Marquer absent'}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 text-left"
      style={{
        background: isAbsent ? 'rgba(200,32,32,0.08)' : 'rgba(0,102,51,0.06)',
        border: `1.5px solid ${isAbsent ? '#C82020' : '#006633'}`,
        minHeight: '60px',
      }}
    >
      <div>
        {nom && <p className="text-sm font-semibold text-gray-900">{nom}</p>}
        {matricule && <p className="text-xs text-gray-500 mt-0.5">{matricule}</p>}
      </div>
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-3"
        style={{ background: isAbsent ? '#C82020' : '#006633' }}
      >
        {isAbsent
          ? <X size={16} className="text-white" />
          : <Check size={16} className="text-white" />
        }
      </span>
    </button>
  );
}
