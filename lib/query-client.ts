import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient — partage entre Providers (mount React) et code
 * imperatif (lib/api.ts pour _forceLogout). Cree paresseusement au premier
 * accès cote client uniquement.
 */
let _client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (_client) return _client;
  _client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            30_000,            // 30 s : suffit pour la majorite des listes
        gcTime:               5 * 60_000,        // garbage collect 5 min apres demount
        retry:                1,                 // 1 retry auto sur erreur transitoire
        refetchOnWindowFocus: false,             // backend a deja rate-limiting
      },
      mutations: {
        retry: 0,
      },
    },
  });
  return _client;
}
