import type { DashboardSnapshot } from "@core/domain";

export interface SteamBadgeSummaryCardDescriptor {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function getSteamBadgeSummaryCards(profile: Pick<DashboardSnapshot["profile"], "badgeCount" | "playerXp">): readonly SteamBadgeSummaryCardDescriptor[] {
  return [
    {
      label: "Badges",
      value: profile.badgeCount !== undefined ? formatCount(profile.badgeCount) : "-",
      ...(profile.playerXp !== undefined ? { secondary: `${formatCount(profile.playerXp)} XP` } : {}),
    },
    {
      label: "Total XP",
      value: profile.playerXp !== undefined ? formatCount(profile.playerXp) : "-",
    },
  ];
}
