import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";

/** Decorative companion to the Current Game label; activity is owned by presence. */
export function DeckyRetroAchievementsActiveGameDot(): JSX.Element {
  return <span aria-hidden="true" data-ra-active-game-dot style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.color.success, marginRight: 6, verticalAlign: "middle" }} />;
}
