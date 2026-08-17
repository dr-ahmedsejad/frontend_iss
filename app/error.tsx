'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { captureError } from '@/lib/monitor';

/**
 * Boundary d'erreur globale Next.js (App Router).
 * Capture les erreurs runtime de tout segment enfant non géré localement.
 *
 * En dev, le message d'erreur est affiché. En prod, message générique
 * (Next.js fournit `error.message` mais on évite d'exposer la stack).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Branche sur le monitoring central (no-op par défaut, Sentry-compat — voir lib/monitor.ts)
  useEffect(() => {
    captureError(error, {
      digest: error.digest,
      url:    typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(200,32,32,0.10)' }}>
          <AlertTriangle size={28} style={{ color: '#C82020' }} />
        </div>

        <h1 className="text-xl font-bold text-iss-dark mb-2">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Désolé, quelque chose s&apos;est mal passé. Vous pouvez réessayer ou revenir à l&apos;accueil.
        </p>

        {/* Détails techniques en dev uniquement */}
        {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
        {isDev && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-100 text-left">
            <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1">
              Détail (dev)
            </p>
            <p className="text-xs text-red-800 break-all font-mono">{error.message}</p>
            {error.digest && (
              <p className="text-[10px] text-red-600/70 mt-1.5">digest : {error.digest}</p>
            )}
          </div>
        )}

        {/* Identifiant pour le support en prod */}
        {!isDev && error.digest && (
          <div className="mb-5 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-[11px] text-iss-gray">Référence support :</p>
            <p className="text-xs font-mono text-iss-dark mt-0.5">{error.digest}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <RotateCcw size={14} />
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            <Home size={14} />
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
