/**
 * Cache mémoire simple avec TTL.
 * Usage : const data = await getOrFetch('key', fetcher, 5 * 60_000)
 * Invalidation manuelle : invalidate('key') ou invalidateAll()
 */

interface CacheEntry<T> {
  value:     T;
  expiresAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, CacheEntry<any>>();

export async function getOrFetch<T>(
  key:       string,
  fetcher:   () => Promise<T>,
  ttlMs:     number = 5 * 60_000,
): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function invalidateAll(): void {
  store.clear();
}
