import type { NextConfig } from 'next';

// ── Backend autorisé pour connect-src / img-src ──
// Lu depuis NEXT_PUBLIC_API_URL — fallback localhost en dev.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const isDev = process.env.NODE_ENV !== 'production';

// ── Content-Security-Policy ──
// Note : 'unsafe-inline' pour script-src/style-src reste nécessaire à cause de :
//  - Next.js bootstrap inline scripts (hydration)
//  - 872 attributs `style={...}` dans le code (refacto futur via design tokens)
// 'unsafe-eval' uniquement en dev pour Next HMR/Turbopack.
const cspDirectives: Record<string, string[]> = {
  'default-src':  ["'self'"],
  'script-src':   ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  'style-src':    ["'self'", "'unsafe-inline'"],
  'img-src':      ["'self'", 'data:', 'blob:', API_URL],
  // Cairo est self-host par next/font/google (woff2 servi depuis 'self')
  'font-src':     ["'self'", 'data:'],
  'connect-src':  ["'self'", API_URL, ...(isDev ? ['ws:', 'wss:'] : [])],
  'frame-src':    ["'none'"],
  'frame-ancestors': ["'none'"],   // anti-clickjacking
  'base-uri':     ["'self'"],
  'form-action':  ["'self'"],
  'object-src':   ["'none'"],      // bloque <object>/<embed>/<applet>
};

const CSP = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(' ')}`)
  .join('; ');

const securityHeaders = [
  // CSP : restreint script/style/img/connect aux origines connues
  { key: 'Content-Security-Policy',   value: CSP },
  // Anti-clickjacking (legacy, complète frame-ancestors)
  { key: 'X-Frame-Options',           value: 'DENY' },
  // Pas de MIME-sniffing (anti-XSS via fichier mal-typé)
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  // Pas de referer cross-origin
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Bloque l'accès aux APIs sensibles que l'app n'utilise pas
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  // Next 16 bloque par défaut les requêtes cross-origin vers les ressources du
  // serveur dev (fonts, HMR, internals) depuis un hôte non listé. Pour autoriser
  // l'accès LAN (ex. test multi-postes via http://<ip>:3001), on dérive l'hôte de
  // NEXT_PUBLIC_API_URL (localhost est déjà autorisé par défaut). Sans effet en prod.
  allowedDevOrigins: (() => {
    try {
      const host = new URL(API_URL).hostname;
      return host && host !== 'localhost' && host !== '127.0.0.1' ? [host] : [];
    } catch {
      return [];
    }
  })(),
  // Tree-shake aggressif sur les barrels lourds. Sans ca, lucide-react
  // (utilise dans 163 fichiers, 5-10 icones par page) trimballe ~50 KB
  // d'icones inutilisees par page. Gain attendu : -30 a -80 KB gzip / page.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'react-chartjs-2',
      'date-fns',
    ],
  },
  images: {
    // En mode Docker, le conteneur frontend ne peut pas resoudre
    // localhost:8090/media (qui pointe vers son propre localhost) pour
    // l'optimisation server-side. On desactive l'optimisation : Nginx sert
    // deja les images avec cache HTTP, c'est suffisant.
    unoptimized: true,
    // Genere automatiquement les remotePatterns depuis NEXT_PUBLIC_API_URL.
    // Couvre dev (localhost:8000), Docker local (localhost:8090) et prod
    // (https://siga.example.com) sans avoir a hardcoder le port.
    remotePatterns: (() => {
      try {
        const u = new URL(API_URL);
        const proto = u.protocol.replace(':', '') as 'http' | 'https';
        const port  = u.port || undefined;
        return [
          { protocol: proto, hostname: u.hostname, port },
          // Fallback dev local
          { protocol: 'http', hostname: 'localhost' },
          { protocol: 'http', hostname: '127.0.0.1' },
        ];
      } catch {
        return [
          { protocol: 'http' as const, hostname: 'localhost' },
          { protocol: 'http' as const, hostname: '127.0.0.1' },
        ];
      }
    })(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
