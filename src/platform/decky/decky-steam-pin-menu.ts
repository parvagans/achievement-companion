import type { GameDetailSnapshot } from "@core/domain";
import { getUnfinishedSteamPinRows } from "./decky-game-overview-recommendations";
import type { DeckyOverviewMenuItem } from "./decky-overview-menu-model";

interface SteamPinPreferences {
  readonly steamPinIds: readonly string[] | undefined;
  readonly pinnedAchievement: { readonly achievementId: string } | undefined;
  pinAchievement(id: string): boolean;
}

export function buildSteamPinMenu(snapshot: GameDetailSnapshot | undefined, preferences: SteamPinPreferences): readonly DeckyOverviewMenuItem[] {
  if (snapshot === undefined) return [];
  const rows = getUnfinishedSteamPinRows(snapshot, preferences.steamPinIds ?? []);
  if (rows.length < 2) return [];
  return [{ key: "steam-pins", label: "Choose a Steam Pin for Up Next", items: rows.map(row => ({
    key: `steam-pin:${row.achievementId}`, label: row.title,
    selected: preferences.pinnedAchievement?.achievementId === row.achievementId,
    onSelect: () => { preferences.pinAchievement(row.achievementId); },
  })) }];
}
