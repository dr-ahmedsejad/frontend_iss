'use client';

import { Check } from 'lucide-react';
import type { StatutDeliberation } from '@/types/evaluations';

const STEPS: { key: StatutDeliberation; label: string }[] = [
  { key: 'preparation', label: 'Préparation' },
  { key: 'en_cours',    label: 'En cours'    },
  { key: 'validee',     label: 'Validée'     },
  { key: 'cloturee',    label: 'Clôturée'   },
];

interface DeliberationStatusBarProps {
  statut: StatutDeliberation;
  className?: string;
}

export default function DeliberationStatusBar({ statut, className = '' }: DeliberationStatusBarProps) {
  const currentIdx = STEPS.findIndex(s => s.key === statut);

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {STEPS.map((step, i) => {
        const isDone   = i < currentIdx;
        const isActive = i === currentIdx;
        const isLast   = i === STEPS.length - 1;

        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone
                  ? 'bg-emerald-500 text-white'
                  : isActive
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400'
              }`}
                style={isActive ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
                {isDone ? <Check size={13} /> : i + 1}
              </div>
              <p className={`text-[10px] font-semibold mt-1 whitespace-nowrap ${
                isActive ? 'text-iss-primary' : isDone ? 'text-emerald-600' : 'text-iss-gray'
              }`}>
                {step.label}
              </p>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1.5 mb-4 transition-all ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
