export interface DeckyOverviewMenuNavigation {
  /** Reopen the suspended menu frame after a modal or state change. */
  restoreCurrent: (focusKey?: string) => void;
  /** Reopen the parent frame, normally after removing the current subject. */
  restoreParent: (focusKey?: string) => void;
}

export interface DeckyOverviewMenuItem {
  readonly key: string;
  readonly label: string;
  readonly onSelect?: (navigation: DeckyOverviewMenuNavigation) => void;
  readonly items?: readonly DeckyOverviewMenuItem[];
  /** Apply this item without dismissing the native menu, then navigate within the same popup. */
  readonly keepMenuOpenOnSelect?: boolean;
  readonly selected?: boolean;
  readonly tone?: "positive" | "emphasis" | "destructive";
}

export interface DeckyOverviewMenuFrame {
  readonly label: string;
  readonly items: readonly DeckyOverviewMenuItem[];
  readonly path: readonly string[];
}

export function resolveDeckyOverviewMenuFrame(
  rootLabel: string,
  rootItems: readonly DeckyOverviewMenuItem[],
  path: readonly string[],
): DeckyOverviewMenuFrame | undefined {
  let label = rootLabel;
  let items = rootItems;
  for (const key of path) {
    const parent = items.find((item) => item.key === key);
    if (parent?.items === undefined) return undefined;
    label = parent.label;
    items = parent.items;
  }
  return { label, items, path };
}

export function getDeckyOverviewMenuParentPath(path: readonly string[]): readonly string[] | undefined {
  return path.length === 0 ? undefined : path.slice(0, -1);
}

export function getDeckyOverviewMenuParentFocusKey(path: readonly string[]): string | undefined {
  return path.at(-1);
}
import type { NormalizedAchievement } from "@core/domain";
import type { GameOverviewSuggestion, RetroAchievementsGameGoal } from "./decky-game-overview-recommendations";
import { isAchievementCompleteForPin } from "./decky-game-overview-recommendations";
import type { RetroAchievementsAchievementMode } from "@core/settings";

export interface DeckyGameOverviewActions {
  readonly suggestions: readonly GameOverviewSuggestion[];
  readonly hiddenSuggestions: readonly NormalizedAchievement[];
  readonly goalComplete?: boolean;
  readonly goal?: RetroAchievementsGameGoal;
  readonly onFocusedPinChange?: (id: string | null) => void;
  readonly onTogglePin?: (achievementId: string) => void;
  readonly achievementMode?: RetroAchievementsAchievementMode;
  readonly onOpenAchievement: (achievementId: string, onClose?: () => void) => void;
  readonly onJumpToAchievement: (achievementId: string) => void;
  readonly onDismissSuggestion: (achievementId: string) => void;
  readonly onRestoreSuggestion: (achievementId: string) => void;
  readonly onRestoreAllSuggestions: () => void;
  readonly onFocusedSuggestionChange: (achievementId: string | null) => void;
  readonly onOpenCommunity?: () => void;
}


export function buildDeckyManageSuggestionsMenuItems(
  actions: DeckyGameOverviewActions,
  detailsAction: "modal" | "achievements" = "modal",
): readonly DeckyOverviewMenuItem[] {
  const visible = actions.suggestions.map(({ achievement, pinned }, index) => {
    const adjacent = actions.suggestions[index + 1]?.achievement ?? actions.suggestions[index - 1]?.achievement;
    return {
      key: `visible:${achievement.achievementId}`,
      label: achievement.title,
      items: [
        ...(actions.onTogglePin === undefined || !pinned && isAchievementCompleteForPin(achievement, actions.achievementMode ?? "both") ? [] : [{ key: "pin", label: pinned ? "Remove from Up Next" : "Set as Up Next", onSelect: () => actions.onTogglePin?.(achievement.achievementId) }]),
        ...(detailsAction === "modal" ? [{ key: "details", label: "View Details", onSelect: (navigation: DeckyOverviewMenuNavigation) => actions.onOpenAchievement(achievement.achievementId, () => navigation.restoreCurrent("details")) }] : []),
        { key: "show", label: "Show in Achievements", onSelect: () => actions.onJumpToAchievement(achievement.achievementId) },
        { key: "hide", label: "Hide Suggestion", tone: "destructive" as const, keepMenuOpenOnSelect: true, onSelect: (navigation: DeckyOverviewMenuNavigation) => {
          actions.onDismissSuggestion(achievement.achievementId);
          navigation.restoreParent(adjacent === undefined ? "hidden" : `visible:${adjacent.achievementId}`);
        } },
      ],
    };
  });
  const hiddenItems: readonly DeckyOverviewMenuItem[] = actions.hiddenSuggestions.map((achievement, index) => {
    const adjacent = actions.hiddenSuggestions[index + 1] ?? actions.hiddenSuggestions[index - 1];
    return {
      key: `hidden:${achievement.achievementId}`,
      label: achievement.title,
      items: [
        { key: "restore", label: "Restore Suggestion", tone: "positive", keepMenuOpenOnSelect: true, onSelect: (navigation) => {
          actions.onRestoreSuggestion(achievement.achievementId);
          navigation.restoreParent(adjacent === undefined ? undefined : `hidden:${adjacent.achievementId}`);
        } },
        ...(detailsAction === "modal" ? [{ key: "details", label: "View Details", onSelect: (navigation: DeckyOverviewMenuNavigation) => actions.onOpenAchievement(achievement.achievementId, () => navigation.restoreCurrent("details")) }] : []),
        { key: "show", label: "Show in Achievements", onSelect: () => actions.onJumpToAchievement(achievement.achievementId) },
      ],
    };
  });
  return [
    ...visible,
    ...(hiddenItems.length > 0 ? [{ key: "hidden", label: `Hidden Suggestions (${hiddenItems.length})`, items: hiddenItems }] : []),
    ...(hiddenItems.length > 0 ? [{ key: "restore-all", label: "Restore All Hidden", tone: "positive" as const, keepMenuOpenOnSelect: true, onSelect: (navigation: DeckyOverviewMenuNavigation) => {
      actions.onRestoreAllSuggestions();
      navigation.restoreCurrent(visible[0]?.key);
    } }] : []),
  ];
}

export interface RetroAchievementsGoalSettingsMenuArgs {
  readonly globalGoal: RetroAchievementsGameGoal;
  readonly gameGoalOverride?: RetroAchievementsGameGoal;
  readonly onSetGlobalGoal: (goal: RetroAchievementsGameGoal) => void;
  readonly onSetGameGoalOverride: (goal: RetroAchievementsGameGoal | undefined) => void;
}

export function buildRetroAchievementsGoalSettingsMenuItem(
  args: RetroAchievementsGoalSettingsMenuArgs,
): DeckyOverviewMenuItem {
  const effectiveGameGoal = args.gameGoalOverride ?? args.globalGoal;
  return { key: "goal-settings", label: "Goal Settings", items: [
      { key: "this-game", label: `This Game · ${effectiveGameGoal === "beat" ? "Beat" : "Master"}`, items: [
        { key: "use-global", label: `Use Global Default (${args.globalGoal === "beat" ? "Beat" : "Master"})`, selected: args.gameGoalOverride === undefined, keepMenuOpenOnSelect: true, onSelect: (navigation) => { args.onSetGameGoalOverride(undefined); navigation.restoreParent("this-game"); } },
        { key: "beat", label: "Beat", selected: args.gameGoalOverride === "beat", keepMenuOpenOnSelect: true, onSelect: (navigation) => { args.onSetGameGoalOverride("beat"); navigation.restoreParent("this-game"); } },
        { key: "master", label: "Master", selected: args.gameGoalOverride === "master", keepMenuOpenOnSelect: true, onSelect: (navigation) => { args.onSetGameGoalOverride("master"); navigation.restoreParent("this-game"); } },
      ] },
      { key: "global-default", label: `Global Default · ${args.globalGoal === "beat" ? "Beat" : "Master"}`, items: [
        { key: "beat", label: "Beat", selected: args.globalGoal === "beat", keepMenuOpenOnSelect: true, onSelect: (navigation) => { args.onSetGlobalGoal("beat"); navigation.restoreParent("global-default"); } },
        { key: "master", label: "Master", selected: args.globalGoal === "master", keepMenuOpenOnSelect: true, onSelect: (navigation) => { args.onSetGlobalGoal("master"); navigation.restoreParent("global-default"); } },
      ] },
    ] };
}

export function buildRetroAchievementsOverviewActionItems(args: RetroAchievementsGoalSettingsMenuArgs & {
  readonly onOpenExternal: () => void;
  readonly onOpenGameInfo: (navigation: DeckyOverviewMenuNavigation) => void;
}): readonly DeckyOverviewMenuItem[] {
  return [
    { key: "open-ra", label: "Open on RetroAchievements", onSelect: args.onOpenExternal },
    { key: "game-info", label: "Game Info", onSelect: args.onOpenGameInfo },
    buildRetroAchievementsGoalSettingsMenuItem(args),
  ];
}
