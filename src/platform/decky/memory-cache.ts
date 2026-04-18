import type { CacheEntry, CacheStore } from "@core/cache";

export function createMemoryCacheStore(
  initialEntries: readonly CacheEntry<unknown>[] = [],
): CacheStore {
  const entries = new Map<string, CacheEntry<unknown>>();

  for (const entry of initialEntries) {
    entries.set(entry.key, entry);
  }

  return {
    async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
      return entries.get(key) as CacheEntry<T> | undefined;
    },

    async write<T>(entry: CacheEntry<T>): Promise<void> {
      entries.set(entry.key, entry as CacheEntry<unknown>);
    },

    async delete(key: string): Promise<void> {
      entries.delete(key);
    },

    async clear(prefix?: string): Promise<void> {
      if (prefix === undefined) {
        entries.clear();
        return;
      }

      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      }
    },
  };
}
