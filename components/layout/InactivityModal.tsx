'use client';

import { Clock } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';

interface Props {
  countdown:    number;
  onContinue:   () => void;
  onLogoutNow:  () => void;
}

/** Modal d'avertissement avant déconnexion automatique pour inactivité. */
export default function InactivityModal({ countdown, onContinue, onLogoutNow }: Props) {
  // Le modal est toujours "open" tant qu'il est rendu (montage conditionnel parent)
  const dialogRef = useModalA11y<HTMLDivElement>({ open: true, onClose: onContinue });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        aria-describedby="inactivity-desc"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100"
          style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={20} className="text-white" />
            </div>
            <div>
              <h3 id="inactivity-title" className="text-white font-bold text-base">Session inactive</h3>
              <p className="text-white/80 text-xs">Déconnexion automatique imminente</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 text-center">
          <div className="w-16 h-16 rounded-full border-4 border-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-extrabold text-iss-secondary">{countdown}</span>
          </div>
          <p id="inactivity-desc" className="text-sm text-iss-dark font-medium mb-1">
            Vous serez déconnecté dans <strong>{countdown} seconde{countdown !== 1 ? 's' : ''}</strong>
          </p>
          <p className="text-xs text-iss-gray">Aucune activité détectée depuis 19 minutes</p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onLogoutNow}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors">
            Se déconnecter
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            Continuer la session
          </button>
        </div>
      </div>
    </div>
  );
}
