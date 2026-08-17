import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// `next/font/google` self-host Cairo au build (woff2 dans /_next/static).
// → Zero DNS Google Fonts en runtime, zero FOUT, zero layout shift.
// Les poids 300-900 couvrent tous les usages (light → black).
const cairo = Cairo({
  subsets: ['latin', 'arabic'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SIGA',
  description: 'Système Intégré de Gestion Académique',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={cairo.variable}>
      <body className={cairo.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
