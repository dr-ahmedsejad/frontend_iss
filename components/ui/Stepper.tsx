'use client';

import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps:       Step[];
  currentStep: number;  // 0-indexed
  className?:  string;
}

/** Indicateur d'étapes pour wizards (preinscription, génération document…). */
export default function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  return (
    <div className={`flex items-start gap-0 ${className}`}>
      {steps.map((step, i) => {
        const isDone    = i < currentStep;
        const isActive  = i === currentStep;
        const isLast    = i === steps.length - 1;

        return (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone
                  ? 'bg-emerald-500 text-white'
                  : isActive
                  ? 'text-white shadow-glow-primary'
                  : 'bg-gray-100 text-gray-400'
              }`}
                style={isActive ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
                {isDone ? <Check size={14} /> : i + 1}
              </div>
              {/* Label */}
              <div className="mt-1.5 text-center">
                <p className={`text-[11px] font-semibold whitespace-nowrap ${
                  isActive ? 'text-iss-primary' : isDone ? 'text-emerald-600' : 'text-iss-gray'
                }`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[10px] text-iss-gray/70 hidden sm:block">{step.description}</p>
                )}
              </div>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-12px] transition-all ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
