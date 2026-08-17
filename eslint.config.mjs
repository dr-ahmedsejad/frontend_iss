// @ts-check
import nextPlugin from '@next/eslint-plugin-next';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Flat config ESLint 9 + Next.js 16.
 *
 * Choix : config minimaliste mais utile.
 * - `next/recommended` : règles core-web-vitals + erreurs Next courantes
 * - `tseslint.recommended` : règles TS classiques (no-unused-vars, no-explicit-any en warn)
 * - Garde la règle custom `no-restricted-syntax` qui interdit `process.env.NEXT_PUBLIC_API_URL`
 *   en dehors de `lib/` (source unique = `@/lib/api`).
 *
 * On désactive volontairement quelques règles trop bruyantes vu le code existant
 * (no-explicit-any en warn vs error, react-hooks/exhaustive-deps en warn).
 * À ré-activer en `error` au fur et à mesure qu'on assainit les fichiers.
 */
const eslintConfig = [
  // Ignore folders
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },

  // TypeScript règles de base
  ...tseslint.configs.recommended,

  // Next.js règles
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // React Hooks règles (nécessaire pour les `// eslint-disable-next-line react-hooks/...`)
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Ajustements globaux pour la dette existante
  {
    rules: {
      // 'any' explicite : warn (pas error) — il y en a quelques-uns en chart.js types
      '@typescript-eslint/no-explicit-any': 'warn',
      // Variables non utilisées : ignorer celles préfixées par _
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },

  // Interdit l'accès direct à process.env.NEXT_PUBLIC_API_URL en dehors de lib/.
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='NEXT_PUBLIC_API_URL']",
          message:
            "Ne pas utiliser process.env.NEXT_PUBLIC_API_URL directement. Importer { API_BASE_URL } ou { apiUrl } depuis '@/lib/api' (source unique de vérité).",
        },
      ],
    },
  },
];

export default eslintConfig;
