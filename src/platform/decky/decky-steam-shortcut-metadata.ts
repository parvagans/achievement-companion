import { callDeckyBackendMethod } from "./decky-backend-bridge";

export interface DeckySteamShortcutMetadata {
  readonly appId: string;
  readonly title?: string;
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
  readonly romHashStatus: "resolved" | "skipped" | "error" | "ambiguous";
  readonly candidateCount?: number;
  readonly candidateExtension?: string;
  readonly archiveMemberExtension?: string;
  readonly candidateResults?: readonly { readonly source: string; readonly extension: string; readonly status: string; readonly reason?: string; readonly memberExtension?: string; readonly mediaReader?: string; readonly mediaReaderStatus?: string }[];
  readonly candidateRejections?: readonly { readonly source: string; readonly extension: string; readonly reason: string }[];
  readonly romHashAlgorithm?: "rcheevos";
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
  if (appId === "") {
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
    ...(title !== "" ? { title } : {}),
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
    record["romHashStatus"] === "resolved" || record["romHashStatus"] === "skipped" || record["romHashStatus"] === "error" || record["romHashStatus"] === "ambiguous"
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
    record["romHashAlgorithm"] === "rcheevos" ? "rcheevos" : undefined;
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
  const safeText = (value: unknown): string | undefined =>
    typeof value === "string" && /^[a-z0-9.-]{1,80}$/u.test(value) ? value : undefined;
  const candidateCount = typeof record["candidateCount"] === "number" && Number.isInteger(record["candidateCount"]) && record["candidateCount"] >= 0
    ? record["candidateCount"] : undefined;
  const candidateExtension = safeText(record["candidateExtension"]);
  const archiveMemberExtension = safeText(record["archiveMemberExtension"]);
  const candidateResults = Array.isArray(record["candidateResults"])
    ? record["candidateResults"].slice(0, 4).flatMap((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return [];
        const item = entry as Record<string, unknown>;
        const source = safeText(item["source"]);
        const extension = safeText(item["extension"]);
        const status = safeText(item["status"]);
        if (source === undefined || extension === undefined || status === undefined) return [];
        const reason = safeText(item["reason"]);
        const memberExtension = safeText(item["memberExtension"]);
        const mediaReader = safeText(item["mediaReader"]);
        const mediaReaderStatus = safeText(item["mediaReaderStatus"]);
        return [{ source, extension, status, ...(reason !== undefined ? { reason } : {}), ...(memberExtension !== undefined ? { memberExtension } : {}), ...(mediaReader !== undefined ? { mediaReader } : {}), ...(mediaReaderStatus !== undefined ? { mediaReaderStatus } : {}) }];
      })
    : undefined;
  const candidateRejections = Array.isArray(record["candidateRejections"])
    ? record["candidateRejections"].slice(0, 8).flatMap((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return [];
        const item = entry as Record<string, unknown>;
        const source = safeText(item["source"]);
        const extension = safeText(item["extension"]);
        const reason = safeText(item["reason"]);
        return source !== undefined && extension !== undefined && reason !== undefined ? [{ source, extension, reason }] : [];
      })
    : undefined;

  return {
    appId,
    shortcutRomPathDetected: record["shortcutRomPathDetected"] === true,
    ...(shortcutRomPathSource !== undefined ? { shortcutRomPathSource } : {}),
    romHashAttempted: record["romHashAttempted"] === true,
    romHashStatus,
    ...(candidateCount !== undefined ? { candidateCount } : {}),
    ...(candidateExtension !== undefined ? { candidateExtension } : {}),
    ...(archiveMemberExtension !== undefined ? { archiveMemberExtension } : {}),
    ...(candidateResults !== undefined ? { candidateResults } : {}),
    ...(candidateRejections !== undefined ? { candidateRejections } : {}),
    ...(romHashAlgorithm !== undefined ? { romHashAlgorithm } : {}),
    ...(romHash !== undefined ? { romHash } : {}),
    ...(hashResolverSkippedReason !== undefined ? { hashResolverSkippedReason } : {}),
    ...(hashRejectedReason !== undefined ? { hashRejectedReason } : {}),
  };
}

export async function loadDeckySteamShortcutRomHashInfo(
  appId: string,
  consoleId: number,
): Promise<DeckySteamShortcutRomHashInfo | undefined> {
  const value = await callDeckyBackendMethod<unknown>("get_steam_shortcut_rom_hash", {
    appId,
    consoleId,
  });
  return normalizeShortcutRomHashInfo(value);
}
