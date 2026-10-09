import type { CSSProperties } from "react";
import { getDeckyRetroAchievementsRankTrend, type RetroAchievementsRankKind } from "./decky-retroachievements-rank-trend";

export function DeckyRetroAchievementsRankTrendIndicator({ accountId, kind }: {
  readonly accountId: string;
  readonly kind: RetroAchievementsRankKind;
}): JSX.Element | null {
  const trend = getDeckyRetroAchievementsRankTrend(accountId, kind);
  if (trend === undefined) return null;
  const style: CSSProperties = {
    color: trend === "up" ? "#43dd7f" : "#ff5d5d",
    fontSize: "0.9em",
    fontWeight: 900,
    marginRight: 3,
  };
  return <span aria-label={trend === "up" ? "Rank improved" : "Rank declined"} style={style}>{trend === "up" ? "↑" : "↓"}</span>;
}
