import { useMemo, useSyncExternalStore } from "react";
import type { KeyValueStore } from "@core/platform";
import {
  ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY,
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  loadAchievementCompanionSettings,
  normalizeAchievementCompanionSettings,
  parseAchievementCompanionSettings,
  saveAchievementCompanionSettings,
  serializeAchievementCompanionSettings,
  type AchievementCompanionSettings,
} from "@core/settings";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  writeDeckyStorageText,
} from "./storage";
import { publishDeckyRaNativeAchievementInvalidation } from "./decky-ra-native-achievement-invalidation";

let deckySettingsRevision = 0;
let cachedDeckySettingsText: string | undefined;
const deckySettingsListeners = new Set<() => void>();

function notifyDeckySettingsChanged(): void {
  deckySettingsRevision += 1;

  for (const listener of deckySettingsListeners) {
    listener();
  }
}

function subscribeDeckySettings(listener: () => void): () => void {
  deckySettingsListeners.add(listener);
  return () => {
    deckySettingsListeners.delete(listener);
  };
}

function readDeckySettingsText(): string | undefined {
  return cachedDeckySettingsText ?? readDeckyStorageText(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY);
}

export function readDeckySettings(): AchievementCompanionSettings {
  return parseAchievementCompanionSettings(readDeckySettingsText());
}

/** Personal SteamHunters lookups are optional; shared game/community data is separate. */
export function isDeckySteamHuntersPersonalDataEnabled(): boolean {
  return readDeckySettings().steamHuntersPersonalDataEnabled;
}

export function useDeckySettings(): AchievementCompanionSettings {
  const revision = useSyncExternalStore(
    subscribeDeckySettings,
    () => deckySettingsRevision,
    () => deckySettingsRevision,
  );

  return useMemo(() => readDeckySettings(), [revision]);
}

export function createDeckySettingsStore(): KeyValueStore {
  return {
    async read(key: string): Promise<string | undefined> {
      if (key !== ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY) {
        return undefined;
      }

      return readDeckySettingsText();
    },

    async write(key: string, value: string): Promise<void> {
      if (key !== ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY) {
        return;
      }

      const previousMode = readDeckySettings().retroAchievementsAchievementMode;
      cachedDeckySettingsText = value;
      writeDeckyStorageText(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY, value);
      notifyDeckySettingsChanged();
      if (previousMode !== readDeckySettings().retroAchievementsAchievementMode) {
        publishDeckyRaNativeAchievementInvalidation("achievement-mode-changed");
      }
    },

    async delete(key: string): Promise<void> {
      if (key !== ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY) {
        return;
      }

      const previousMode = readDeckySettings().retroAchievementsAchievementMode;
      cachedDeckySettingsText = undefined;
      removeDeckyStorageText(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY);
      notifyDeckySettingsChanged();
      if (previousMode !== readDeckySettings().retroAchievementsAchievementMode) {
        publishDeckyRaNativeAchievementInvalidation("achievement-mode-changed");
      }
    },
  };
}

export async function loadDeckySettings(): Promise<AchievementCompanionSettings> {
  const settings = await loadAchievementCompanionSettings(createDeckySettingsStore());
  cachedDeckySettingsText = serializeAchievementCompanionSettings(settings);
  return normalizeAchievementCompanionSettings(settings);
}

export async function saveDeckySettings(
  settings: AchievementCompanionSettings,
): Promise<boolean> {
  const wroteSettings = await saveAchievementCompanionSettings(
    createDeckySettingsStore(),
    settings,
  );
  cachedDeckySettingsText = serializeAchievementCompanionSettings(settings);
  notifyDeckySettingsChanged();
  return wroteSettings;
}

export const defaultDeckySettings = DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
