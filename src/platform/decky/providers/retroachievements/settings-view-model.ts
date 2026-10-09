export type RetroAchievementsRefreshOperation = "idle" | "refreshing" | "refreshed" | "error";

export interface RetroAchievementsRefreshActionPresentation {
  readonly title: string;
  readonly success: boolean;
  readonly danger: boolean;
}

export function getRetroAchievementsRefreshActionPresentation(
  operation: RetroAchievementsRefreshOperation,
): RetroAchievementsRefreshActionPresentation {
  switch (operation) {
    case "refreshing":
      return { title: "Refreshing RetroAchievements…", success: false, danger: false };
    case "refreshed":
      return { title: "RetroAchievements refreshed", success: true, danger: false };
    case "error":
      return { title: "Refresh failed — try again", success: false, danger: true };
    case "idle":
      return { title: "Refresh RetroAchievements", success: false, danger: false };
  }
}
