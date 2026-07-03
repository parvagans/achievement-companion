import { callDeckyBackendMethod } from "./decky-backend-bridge";

export interface DeckySteamShortcutMetadata {
  readonly appId: string;
  readonly title: string;
  readonly platformTag?: string;
  readonly platformLabel?: string;
  readonly tags?: readonly string[];
  readonly exe?: string;
  readonly startDir?: string;
}

export interface DeckySteamShortcutRomHashInfo {
  readonly appId: string;
  readonly shortcutRomPathDetected: boolean;
  readonly shortcutRomPathSource?: string;
  readonly romHashAttempted: boolean;
  readonly romHashStatus: "resolved" | "skipped" | "error";
  readonly romHashAlgorithm?: "md5";
  readonly romHash?: string;
  readonly hashResolverSkippedReason?: string;
  readonly hashRejectedReason?: string;
}

function normalizeShortcutMetadata(value: unknown): DeckySteamShortcutMetadata | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const appId = typeof record["appId"] === "string" ? record["appId"].trim() : "";
  const title = typeof record["title"] === "string" ? record["title"].trim() : "";
  if (appId === "" || title === "") {
    return undefined;
  }

  const platformTag =
    typeof record["platformTag"] === "string" && record["platformTag"].trim().length > 0
      ? record["platformTag"].trim()
      : undefined;
  const platformLabel =
    typeof record["platformLabel"] === "string" && record["platformLabel"].trim().length > 0
      ? record["platformLabel"].trim()
      : platformTag;
  const tags = Array.isArray(record["tags"])
    ? record["tags"].filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : undefined;
  const exe = typeof record["exe"] === "string" && record["exe"].trim().length > 0 ? record["exe"].trim() : undefined;
  const startDir =
    typeof record["startDir"] === "string" && record["startDir"].trim().length > 0
      ? record["startDir"].trim()
      : undefined;

  return {
    appId,
    title,
    ...(platformTag !== undefined ? { platformTag } : {}),
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(exe !== undefined ? { exe } : {}),
    ...(startDir !== undefined ? { startDir } : {}),
  };
}

export async function loadDeckySteamShortcutMetadata(
  appId: string,
): Promise<DeckySteamShortcutMetadata | undefined> {
  const metadata = await callDeckyBackendMethod<unknown>("get_steam_shortcut_metadata", {
    appId,
  });
  return normalizeShortcutMetadata(metadata);
}

function normalizeShortcutRomHashInfo(value: unknown): DeckySteamShortcutRomHashInfo | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const appId = typeof record["appId"] === "string" ? record["appId"].trim() : "";
  const romHashStatus =
    record["romHashStatus"] === "resolved" || record["romHashStatus"] === "skipped" || record["romHashStatus"] === "error"
      ? record["romHashStatus"]
      : undefined;
  if (appId === "" || romHashStatus === undefined) {
    return undefined;
  }

  const shortcutRomPathSource =
    typeof record["shortcutRomPathSource"] === "string" && record["shortcutRomPathSource"].trim().length > 0
      ? record["shortcutRomPathSource"].trim()
      : undefined;
  const romHashAlgorithm =
    record["romHashAlgorithm"] === "md5" ? "md5" : undefined;
  const romHash =
    typeof record["romHash"] === "string" && record["romHash"].trim().length > 0
      ? record["romHash"].trim().toLowerCase()
      : undefined;
  const hashResolverSkippedReason =
    typeof record["hashResolverSkippedReason"] === "string" && record["hashResolverSkippedReason"].trim().length > 0
      ? record["hashResolverSkippedReason"].trim()
      : undefined;
  const hashRejectedReason =
    typeof record["hashRejectedReason"] === "string" && record["hashRejectedReason"].trim().length > 0
      ? record["hashRejectedReason"].trim()
      : undefined;

  return {
    appId,
    shortcutRomPathDetected: record["shortcutRomPathDetected"] === true,
    ...(shortcutRomPathSource !== undefined ? { shortcutRomPathSource } : {}),
    romHashAttempted: record["romHashAttempted"] === true,
    romHashStatus,
    ...(romHashAlgorithm !== undefined ? { romHashAlgorithm } : {}),
    ...(romHash !== undefined ? { romHash } : {}),
    ...(hashResolverSkippedReason !== undefined ? { hashResolverSkippedReason } : {}),
    ...(hashRejectedReason !== undefined ? { hashRejectedReason } : {}),
  };
}

export async function loadDeckySteamShortcutRomHashInfo(
  appId: string,
): Promise<DeckySteamShortcutRomHashInfo | undefined> {
  const value = await callDeckyBackendMethod<unknown>("get_steam_shortcut_rom_hash", {
    appId,
  });
  return normalizeShortcutRomHashInfo(value);
}
