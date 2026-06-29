import { callDeckyBackendMethod } from "./decky-backend-bridge";

export interface DeckySteamShortcutMetadata {
  readonly appId: string;
  readonly title: string;
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

  return {
    appId,
    title,
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
