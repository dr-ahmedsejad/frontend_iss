import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SIGA — Services en ligne',
  description: 'Portail public SIGA',
};

/** Layout minimaliste pour les routes publiques (pré-inscription, vérification documents). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="flex-1">{children}</main>
      <footer className="text-center py-6 text-xs text-gray-400">
        © {new Date().getFullYear()} Institut Supérieur de la Statistique — Mauritanie
      </footer>
    </div>
  );
}
