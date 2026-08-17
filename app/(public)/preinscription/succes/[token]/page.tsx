'use client';

import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PreinscriptionSuccesPage() {
  const { token } = useParams();

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
        <CheckCircle2 size={40} className="text-emerald-500" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-iss-dark mb-2">Dossier soumis avec succès !</h1>
        <p className="text-sm text-iss-gray leading-relaxed">
          Votre demande de pré-inscription a bien été reçue. Vous recevrez une réponse par email
          ou vous pouvez suivre l&apos;état de votre dossier à tout moment.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-2">
        <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Numéro de suivi</p>
        <p className="font-mono text-lg font-bold text-iss-dark tracking-widest break-all">
          {String(token)}
        </p>
        <p className="text-xs text-iss-gray">Conservez ce numéro pour suivre l&apos;état de votre dossier</p>
      </div>

      {/* QR code placeholder — le backend génère un QR dans le PDF */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-iss-gray mb-2">Lien de suivi de votre dossier :</p>
        <a href={`/preinscription/suivi/${token}`}
          className="text-xs text-iss-primary font-medium break-all hover:underline">
          {typeof window !== 'undefined' ? window.location.origin : ''}/preinscription/suivi/{token}
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <a href={`/preinscription/suivi/${token}`}
          className="w-full py-3 rounded-xl text-sm font-bold text-white text-center hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          Suivre mon dossier
        </a>
        <Link href="/"
          className="w-full py-3 rounded-xl text-sm font-medium text-iss-gray border border-gray-200 text-center hover:bg-gray-50 transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
