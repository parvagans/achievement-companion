import type { SteamLibraryScanStore } from "@core/platform";
import {
  createSteamClient,
  scanSteamLibraryAchievements,
  type SteamLibraryAchievementScanSummary,
  type SteamProviderConfig,
  STEAM_PROVIDER_ID,
} from "../../providers/steam";
import type { SteamOSAppRuntime } from "./create-steamos-app-runtime";
import { createSteamOSSteamTransport } from "./steamos-adapters";

export type SteamOSSteamLibraryScanOverview = Pick<
  SteamLibraryAchievementScanSummary,
  | "ownedGameCount"
  | "scannedGameCount"
  | "gamesWithAchievements"
  | "unlockedAchievements"
  | "totalAchievements"
  | "perfectGames"
  | "completionPercent"
  | "scannedAt"
>;

function isSteamLibraryScanStore(
  value: SteamOSAppRuntime["adapters"]["steamLibraryScanStore"] | undefined,
): value is SteamLibraryScanStore<SteamOSSteamLibraryScanOverview, SteamLibraryAchievementScanSummary> {
  return value !== undefined;
}

export function canRunSteamOSSteamLibraryScan(
  config: SteamProviderConfig | undefined,
): config is SteamProviderConfig {
  return config !== undefined && config.hasApiKey && config.steamId64.trim() !== "";
}

export function createSteamOSSteamLibraryScanOverview(
  summary: SteamLibraryAchievementScanSummary,
): SteamOSSteamLibraryScanOverview {
  return {
    ownedGameCount: summary.ownedGameCount,
    scannedGameCount: summary.scannedGameCount,
    gamesWithAchievements: summary.gamesWithAchievements,
    unlockedAchievements: summary.unlockedAchievements,
    totalAchievements: summary.totalAchievements,
    perfectGames: summary.perfectGames,
    completionPercent: summary.completionPercent,
    scannedAt: summary.scannedAt,
  };
}

export async function loadSteamOSSteamLibraryScanOverview(
  store: SteamOSAppRuntime["adapters"]["steamLibraryScanStore"] | undefined,
): Promise<SteamOSSteamLibraryScanOverview | undefined> {
  if (!isSteamLibraryScanStore(store)) {
    return undefined;
  }

  const cachedOverview = await store.readOverview(STEAM_PROVIDER_ID);
  return cachedOverview;
}

export async function runSteamOSSteamLibraryScan(args: {
  readonly runtime: SteamOSAppRuntime | undefined;
  readonly config: SteamProviderConfig | undefined;
}): Promise<SteamOSSteamLibraryScanOverview> {
  const { runtime } = args;
  const config = args.config;

  if (runtime === undefined || !canRunSteamOSSteamLibraryScan(config)) {
    throw new Error("Steam library scan unavailable.");
  }

  const scanStore = runtime.adapters.steamLibraryScanStore;
  if (!isSteamLibraryScanStore(scanStore)) {
    throw new Error("Steam library scan cache unavailable.");
  }

  const summary = await scanSteamLibraryAchievements(
    config,
    {
      client: createSteamClient(createSteamOSSteamTransport(runtime.adapters.client)),
    },
  );
  const overview = createSteamOSSteamLibraryScanOverview(summary);

  await scanStore.writeOverview(STEAM_PROVIDER_ID, overview);

  return overview;
}
