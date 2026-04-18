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
