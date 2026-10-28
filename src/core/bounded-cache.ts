/** Drop expired values before evicting the least recently used retained entries. */
export function pruneBoundedCache<TKey, TValue extends { readonly expiresAt: number }>(
  cache: Map<TKey, TValue>,
  now: number,
  limit: number,
): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > limit) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

export function readBoundedCache<TKey, TValue extends { readonly expiresAt: number }>(
  cache: Map<TKey, TValue>,
  key: TKey,
  now: number,
  limit: number,
): TValue | undefined {
  pruneBoundedCache(cache, now, limit);
  const entry = cache.get(key);
  if (entry !== undefined) {
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry;
}

export function writeBoundedCache<TKey, TValue extends { readonly expiresAt: number }>(
  cache: Map<TKey, TValue>,
  key: TKey,
  entry: TValue,
  now: number,
  limit: number,
): void {
  cache.delete(key);
  cache.set(key, entry);
  pruneBoundedCache(cache, now, limit);
}
