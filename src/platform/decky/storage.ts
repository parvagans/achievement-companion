function getAvailableStorages(): readonly Storage[] {
  const storages: Storage[] = [];

  try {
    const localStorageObject = globalThis.localStorage;
    if (localStorageObject !== undefined) {
      storages.push(localStorageObject);
    }
  } catch {
    // Ignore unavailable storage buckets.
  }

  try {
    const sessionStorageObject = globalThis.sessionStorage;
    if (
      sessionStorageObject !== undefined &&
      !storages.includes(sessionStorageObject)
    ) {
      storages.push(sessionStorageObject);
    }
  } catch {
    // Ignore unavailable storage buckets.
  }

  return storages;
}

export function readDeckyStorageText(storageKey: string): string | undefined {
  for (const storage of getAvailableStorages()) {
    try {
      const value = storage.getItem(storageKey);
      if (value !== null) {
        return value;
      }
    } catch {
      // Ignore and try the next storage bucket.
    }
  }

  return undefined;
}

export function writeDeckyStorageText(storageKey: string, value: string): boolean {
  let wroteValue = false;

  for (const storage of getAvailableStorages()) {
    try {
      storage.setItem(storageKey, value);
      wroteValue = true;
    } catch {
      // Ignore and keep trying the remaining storage bucket(s).
    }
  }

  return wroteValue;
}

/**
 * Atomically replace a single authoritative cache value in the preferred
 * storage. On quota/write failure, leave the previous value untouched rather
 * than falling back to a lower-priority store that reads could shadow.
 */
export function writeDeckyStorageTextPreservingExisting(storageKey: string, value: string): boolean {
  const storage = getPreferredReadableStorage(storageKey);
  if (storage === undefined) {
    return false;
  }

  try {
    storage.setItem(storageKey, value);
    return true;
  } catch {
    return false;
  }
}

function getPreferredReadableStorage(storageKey: string): Storage | undefined {
  return getAvailableStorages().find((storage) => {
    try { storage.getItem(storageKey); return true; } catch { return false; }
  });
}

/** The readable primary store is authoritative, even if a fallback is writable. */
export function removeDeckyStorageTextPreservingExisting(storageKey: string): boolean {
  const preferred = getPreferredReadableStorage(storageKey);
  if (preferred === undefined) return false;
  try { preferred.removeItem(storageKey); } catch { return false; }
  // Remove fallback copies so a subsequent read cannot resurrect the old setting.
  for (const storage of getAvailableStorages()) {
    if (storage !== preferred) {
      try { storage.removeItem(storageKey); } catch { /* Best-effort mirror cleanup. */ }
    }
  }
  return true;
}

export function removeDeckyStorageText(storageKey: string): boolean {
  let removedValue = false;

  for (const storage of getAvailableStorages()) {
    try {
      storage.removeItem(storageKey);
      removedValue = true;
    } catch {
      // Ignore and keep trying the remaining storage bucket(s).
    }
  }

  return removedValue;
}

export function removeDeckyStorageTextsByPrefix(storageKeyPrefix: string): boolean {
  let removedValue = false;

  for (const storage of getAvailableStorages()) {
    try {
      const keysToRemove: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null && key.startsWith(storageKeyPrefix)) {
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        storage.removeItem(key);
        removedValue = true;
      }
    } catch {
      // Ignore and keep trying the remaining storage bucket(s).
    }
  }

  return removedValue;
}
