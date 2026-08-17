import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(0,102,51,0.08)' }}>
          <Compass size={28} style={{ color: '#006633' }} />
        </div>

        <h1 className="text-3xl font-extrabold text-iss-dark mb-1">404</h1>
        <h2 className="text-base font-semibold text-iss-dark mb-2">Page introuvable</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          La page demandée n&apos;existe pas ou a été déplacée.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Home size={14} />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
