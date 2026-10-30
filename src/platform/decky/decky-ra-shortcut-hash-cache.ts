import type { DeckySteamShortcutMetadata } from "./decky-steam-shortcut-metadata";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageTextPreservingExisting } from "./storage";

const STORAGE_KEY = "achievement-companion:decky:ra-shortcut-hash-matches:v1";
const MAX_MATCHES = 100;

interface VerifiedHashMatch {
  readonly appId: string;
  readonly shortcutIdentity: string;
  readonly consoleId: string;
  readonly romHash: string;
  readonly gameId: string;
  readonly title: string;
  readonly storedAt: number;
}

function shortcutIdentity(metadata: DeckySteamShortcutMetadata): string {
  // Titles can change without changing the ROM. Paths and platform tags cannot.
  return JSON.stringify([
    metadata.appId,
    metadata.platformTag,
    metadata.platformLabel,
    metadata.tags,
    metadata.exe,
    metadata.startDir,
  ]);
}

function normalizeHash(value: string): string | undefined {
  const hash = value.trim().toLowerCase();
  return /^[0-9a-f]{32}$/u.test(hash) ? hash : undefined;
}

function readMatches(now: number): VerifiedHashMatch[] {
  const raw = readDeckyStorageText(STORAGE_KEY);
  if (raw === undefined) return [];
  try {
    const parsed = JSON.parse(raw) as { readonly version?: unknown; readonly entries?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter((entry): entry is VerifiedHashMatch => {
      if (typeof entry !== "object" || entry === null) return false;
      const record = entry as Record<string, unknown>;
      return typeof record["appId"] === "string" &&
        typeof record["shortcutIdentity"] === "string" &&
        typeof record["consoleId"] === "string" &&
        typeof record["romHash"] === "string" && normalizeHash(record["romHash"]) !== undefined &&
        typeof record["gameId"] === "string" && /^\d+$/u.test(record["gameId"]) &&
        typeof record["title"] === "string" &&
        typeof record["storedAt"] === "number" && Number.isFinite(record["storedAt"]) &&
        record["storedAt"] <= now;
    });
  } catch {
    return [];
  }
}

export function readDeckyRaShortcutHashMatch(
  metadata: DeckySteamShortcutMetadata,
  consoleId: string,
  romHash: string,
  now = Date.now(),
): { readonly gameId: string; readonly title: string } | undefined {
  const normalizedHash = normalizeHash(romHash);
  if (normalizedHash === undefined) return undefined;
  const identity = shortcutIdentity(metadata);
  const match = readMatches(now).find((entry) =>
    entry.appId === metadata.appId && entry.shortcutIdentity === identity &&
    entry.consoleId === consoleId && entry.romHash === normalizedHash);
  return match === undefined ? undefined : { gameId: match.gameId, title: match.title };
}

export function writeDeckyRaShortcutHashMatch(
  metadata: DeckySteamShortcutMetadata,
  consoleId: string,
  romHash: string,
  gameId: string,
  title: string,
  now = Date.now(),
): boolean {
  const normalizedHash = normalizeHash(romHash);
  if (normalizedHash === undefined || !/^\d+$/u.test(gameId) || title.trim().length === 0) return false;
  const identity = shortcutIdentity(metadata);
  const entries = readMatches(now).filter((entry) =>
    !(entry.appId === metadata.appId && entry.consoleId === consoleId));
  entries.unshift({
    appId: metadata.appId,
    shortcutIdentity: identity,
    consoleId,
    romHash: normalizedHash,
    gameId,
    title,
    storedAt: now,
  });
  return writeDeckyStorageTextPreservingExisting(
    STORAGE_KEY,
    JSON.stringify({ version: 1, entries: entries.slice(0, MAX_MATCHES) }),
  );
}

export function invalidateDeckyRaShortcutHashMatch(appId: string): void {
  const entries = readMatches(Date.now()).filter((entry) => entry.appId !== appId);
  if (entries.length === 0) removeDeckyStorageText(STORAGE_KEY);
  else writeDeckyStorageTextPreservingExisting(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
}
