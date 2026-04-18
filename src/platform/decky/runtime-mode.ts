import type { DeckySmokeTestCacheMode } from "./smoke-test-cache";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "./storage";

export type DeckyRuntimeMode = "live" | DeckySmokeTestCacheMode;

const DECKY_RUNTIME_MODE_STORAGE_KEY = "achievement-companion:decky:runtime-mode";

function coerceRuntimeMode(value: unknown): DeckyRuntimeMode | undefined {
  if (
    value === "live" ||
    value === "empty" ||
    value === "fresh" ||
    value === "stale"
  ) {
    return value;
  }

  return undefined;
}

export function loadDeckyRuntimeMode(): DeckyRuntimeMode {
  return coerceRuntimeMode(readDeckyStorageText(DECKY_RUNTIME_MODE_STORAGE_KEY)) ?? "live";
}

export function writeDeckyRuntimeMode(mode: DeckyRuntimeMode): boolean {
  return writeDeckyStorageText(DECKY_RUNTIME_MODE_STORAGE_KEY, mode);
}

export function clearDeckyRuntimeMode(): boolean {
  return removeDeckyStorageText(DECKY_RUNTIME_MODE_STORAGE_KEY);
}
