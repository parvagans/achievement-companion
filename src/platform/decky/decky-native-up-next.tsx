import { Focusable, Navigation, type GamepadEvent } from "@decky/ui";
import { useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import type { NativeRetroAchievementsProjection } from "./decky-native-retroachievements-projection";
import { buildDeckyNativeSteamAchievementsRoute } from "./decky-game-page-achievement-route";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { isGameOverviewGoalComplete, selectGameOverviewSuggestions } from "./decky-game-overview-recommendations";
import { buildDeckyManageSuggestionsMenuItems, buildRetroAchievementsGoalSettingsMenuItem, type DeckyGameOverviewActions, type DeckyOverviewMenuItem } from "./decky-overview-menu-model";
import { DeckyOverviewMenuButton } from "./decky-full-screen-game-overview-content";
import { focusNativeAchievementAfterNavigation } from "./decky-native-achievement-jump";
import { DeckyNativeAchievementTypeLabel, getAchievementTypeBadgeDescriptor } from "./decky-achievement-type-badge";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";

export const NATIVE_UP_NEXT_TAB_ID = "AchievementCompanionUpNext";

interface NativeTab {
  readonly id: string;
  readonly title: string;
  readonly content?: JSX.Element;
}

/** Keep Steam's descriptors and order intact while adding the RA Up Next tab. */
export function withNativeUpNextTab(tabs: readonly NativeTab[], content: JSX.Element): readonly NativeTab[] {
  const activity = tabs.findIndex((tab) => tab.id === "WhatsNew");
  if (activity < 0 || !tabs.some((tab) => tab.id === "YourStuff") || tabs.some((tab) => tab.id === NATIVE_UP_NEXT_TAB_ID)) {
    return tabs;
  }
  return [
    ...tabs.slice(0, activity + 1),
    { id: NATIVE_UP_NEXT_TAB_ID, title: "Up Next", content },
    ...tabs.slice(activity + 1),
  ];
}

const styles = `
.ac-native-up-next { box-sizing:border-box; color:#dcdedf; margin:0 auto; max-width:1160px; padding:16px 48px 28px; }
.ac-native-up-next * { box-sizing:border-box; }
.ac-native-up-next__toolbar { align-items:center; display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px 16px; margin-bottom:6px; }
.ac-native-up-next__toolbar-actions { align-items:center; display:flex; flex-wrap:wrap; gap:8px; }
.ac-native-up-next h2 { font-size:26px; font-weight:700; margin:0; }
.ac-native-up-next__meta { color:#a9b1ba; font-size:15px; margin-bottom:9px; }
.ac-native-up-next__bar { background:rgba(255,255,255,.14); border-radius:3px; height:5px; margin-bottom:18px; overflow:hidden; }
.ac-native-up-next__bar-fill { background:#66c0f4; height:100%; }
.ac-native-up-next__heading { color:#9fb1c0; font-size:15px; font-weight:700; letter-spacing:.07em; margin:0 0 12px; text-transform:uppercase; }
.ac-native-up-next__grid { display:grid; gap:12px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.ac-native-up-next__item.Panel { align-items:flex-start; background:rgba(172,178,201,.1); border:1px solid rgba(255,255,255,.12); border-radius:5px; color:#dcdedf; display:flex; gap:12px; min-height:116px; min-width:0; padding:14px; transform:none !important; }
.ac-native-up-next__item.Panel.gpfocus { background:rgba(172,178,201,.23); border-color:#dcdedf; box-shadow:inset 0 0 0 1px #dcdedf; }
.ac-native-up-next__badge { background:#232932; border-radius:4px; flex:0 0 64px; height:64px; object-fit:contain; width:64px; }
.ac-native-up-next__copy { flex:1 1 auto; min-width:0; }
.ac-native-up-next__title-row { align-items:flex-start; display:flex; gap:8px; justify-content:space-between; min-width:0; }
.ac-native-up-next__name { display:-webkit-box; flex:1 1 auto; font-size:16px; font-weight:600; line-height:1.25; min-width:0; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
.ac-native-up-next__classification { flex:0 0 auto; pointer-events:none; }
.ac-native-up-next__description { color:#a9b1ba; display:-webkit-box; font-size:14px; line-height:1.3; margin-top:5px; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
.ac-native-up-next__empty { background:rgba(172,178,201,.08); border-radius:5px; color:#a9b1ba; font-size:16px; padding:22px; }
.ac-native-up-next__browse.Panel { background:rgba(172,178,201,.1); border:1px solid rgba(255,255,255,.12); border-radius:4px; color:#dcdedf; display:inline-flex; font-size:15px; margin-top:18px; padding:10px 16px; transform:none !important; }
.ac-native-up-next__browse.Panel.gpfocus { background:rgba(172,178,201,.23); border-color:#dcdedf; box-shadow:inset 0 0 0 1px #dcdedf; }
@media (max-width:900px) { .ac-native-up-next { padding:16px 28px; } .ac-native-up-next__grid { grid-template-columns:1fr; } .ac-native-up-next__item.Panel { min-height:82px; } }
`;

export function DeckyNativeUpNext({ projection }: { readonly projection: NativeRetroAchievementsProjection }): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const suggestionRefs = useRef(new Map<string, HTMLDivElement>());
  const suggestionsMenuRef = useRef<HTMLDivElement | null>(null);
  const browseRef = useRef<HTMLDivElement | null>(null);
  const pendingSkipFocusRef = useRef<string | null | undefined>();
  const lastFocusedSuggestionIdRef = useRef<string | null>(null);
  const [focusedSuggestionId, setFocusedSuggestionId] = useState<string | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    let ancestor = root.parentElement;
    while (ancestor !== null) {
      const overflow = root.ownerDocument.defaultView?.getComputedStyle(ancestor).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && ancestor.scrollWidth > ancestor.clientWidth) {
        const scroller = ancestor;
        const keepHorizontalOrigin = (): void => {
          if (scroller.scrollLeft !== 0) scroller.scrollLeft = 0;
        };
        keepHorizontalOrigin();
        scroller.addEventListener("scroll", keepHorizontalOrigin, { passive: true });
        return () => { scroller.removeEventListener("scroll", keepHorizontalOrigin); };
      }
      ancestor = ancestor.parentElement;
    }
  }, []);
  const preferences = useDeckyGameOverviewPreferences("retroachievements", projection.raGameId);
  const snapshot = projection.detailSnapshot;
  const completed = snapshot !== undefined && isGameOverviewGoalComplete(snapshot, preferences.retroAchievementsGoal, projection.mode);
  const suggestions = useMemo(() => snapshot === undefined ? [] : selectGameOverviewSuggestions({
    snapshot,
    goal: preferences.retroAchievementsGoal,
    achievementMode: projection.mode,
    hiddenAchievementIds: preferences.hiddenAchievementIds,
  }), [snapshot, preferences.retroAchievementsGoal, preferences.hiddenAchievementIds, projection.mode]);
  const hiddenAchievements = useMemo(() => {
    const hiddenIds = new Set(preferences.hiddenAchievementIds);
    return snapshot?.achievements.filter((achievement) => !achievement.isUnlocked && hiddenIds.has(achievement.achievementId)) ?? [];
  }, [snapshot, preferences.hiddenAchievementIds]);
  const allSuggestions = useMemo(() => snapshot === undefined ? [] : selectGameOverviewSuggestions({
    snapshot,
    goal: preferences.retroAchievementsGoal,
    achievementMode: projection.mode,
  }), [snapshot, preferences.retroAchievementsGoal, projection.mode]);
  useLayoutEffect(() => {
    const pendingId = pendingSkipFocusRef.current;
    if (pendingId === undefined) return;
    pendingSkipFocusRef.current = undefined;
    const target = (pendingId === null ? undefined : suggestionRefs.current.get(pendingId))
      ?? suggestionsMenuRef.current ?? browseRef.current;
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [suggestions]);
  const percent = projection.total > 0 ? Math.round(projection.earned / projection.total * 100) : 0;
  const browse = (): void => Navigation.Navigate(buildDeckyNativeSteamAchievementsRoute(Number(projection.appId)));
  const browseAchievement = (achievementId: string): void => {
    const document = rootRef.current?.ownerDocument;
    if (document !== undefined) focusNativeAchievementAfterNavigation(document, achievementId);
    browse();
  };
  const skipSuggestion = (achievementId: string, restoreCardFocus: boolean): void => {
    if (restoreCardFocus) {
      const index = suggestions.findIndex(({ achievement }) => achievement.achievementId === achievementId);
      pendingSkipFocusRef.current = suggestions[index + 1]?.achievement.achievementId
        ?? suggestions[index - 1]?.achievement.achievementId ?? null;
    }
    if (!preferences.hideSuggestion(achievementId)) pendingSkipFocusRef.current = undefined;
  };
  const currentSuggestion = suggestions.find(({ achievement }) => achievement.achievementId === lastFocusedSuggestionIdRef.current)
    ?? suggestions[0];
  const menuActions: DeckyGameOverviewActions = {
    suggestions,
    hiddenSuggestions: hiddenAchievements,
    onOpenAchievement: browseAchievement,
    onJumpToAchievement: browseAchievement,
    onDismissSuggestion: (achievementId) => skipSuggestion(achievementId, false),
    onRestoreSuggestion: preferences.restoreSuggestion,
    onRestoreAllSuggestions: preferences.restoreAllSuggestions,
    onFocusedSuggestionChange: () => undefined,
  };
  const manageItems = buildDeckyManageSuggestionsMenuItems(menuActions, "achievements");
  const suggestionMenuItems: readonly DeckyOverviewMenuItem[] = [
    { key: "manage", label: `Manage Suggestions (${hiddenAchievements.length} hidden)`, items: manageItems.length > 0 ? manageItems : [{ key: "none", label: "No suggestions to manage" }] },
    { key: "restore-all", label: "Restore All Suggestions", tone: "positive", onSelect: preferences.restoreAllSuggestions },
    ...(currentSuggestion === undefined ? [] : [{ key: "skip", label: "Skip Current Suggestion", tone: "destructive" as const, onSelect: () => skipSuggestion(currentSuggestion.achievement.achievementId, false) }]),
  ];
  const goalMenu = buildRetroAchievementsGoalSettingsMenuItem({
    globalGoal: preferences.globalRetroAchievementsGoal,
    ...(preferences.retroAchievementsGoalOverride !== undefined ? { gameGoalOverride: preferences.retroAchievementsGoalOverride } : {}),
    onSetGlobalGoal: preferences.setGlobalRetroAchievementsGoal,
    onSetGameGoalOverride: preferences.setRetroAchievementsGameGoal,
  });

  return <div ref={rootRef} className="ac-native-up-next" data-achievement-companion-native-up-next="true">
    <style>{styles}</style>
    <div className="ac-native-up-next__toolbar"><h2>Up Next</h2><Focusable className="ac-native-up-next__toolbar-actions" flow-children="left-right" noFocusRing tabIndex={-1}>
      <DeckyOverviewMenuButton label="Goal Settings" displayLabel={`Goal: ${preferences.retroAchievementsGoal === "beat" ? "Beat" : "Master"} ▾`} items={goalMenu.items ?? []} deckyDialogButton />
      <DeckyOverviewMenuButton label="Suggestions" displayLabel="Suggestions ▾" items={suggestionMenuItems} deckyDialogButton elementRef={(element) => { suggestionsMenuRef.current = element; }} />
    </Focusable></div>
    <div className="ac-native-up-next__meta">{projection.title} · {projection.earned} / {projection.total} achievements · {percent}%</div>
    <div className="ac-native-up-next__bar"><div className="ac-native-up-next__bar-fill" style={{ width: `${percent}%` }} /></div>
    <div className="ac-native-up-next__heading">{completed ? `${preferences.retroAchievementsGoal} goal complete` : `Up Next · ${preferences.retroAchievementsGoal}`}</div>
    {suggestions.length > 0 ? <div className="ac-native-up-next__grid">
      {suggestions.map(({ achievement }) => <Focusable
        key={achievement.achievementId}
        ref={(element) => { if (element === null) suggestionRefs.current.delete(achievement.achievementId); else suggestionRefs.current.set(achievement.achievementId, element); }}
        className="ac-native-up-next__item"
        data-ac-native-up-next-id={achievement.achievementId}
        role="button"
        aria-label={`Show ${achievement.title} in Steam achievements${getAchievementTypeBadgeDescriptor(achievement.classification) ? `, ${getAchievementTypeBadgeDescriptor(achievement.classification)?.label}` : ""}`}
        onOKActionDescription="Achievements"
        {...(focusedSuggestionId === achievement.achievementId ? {
          onSecondaryActionDescription: "Skip",
          onSecondaryButton: (event: GamepadEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (!event.detail.is_repeat) skipSuggestion(achievement.achievementId, true);
          },
        } : {})}
        onFocus={() => { lastFocusedSuggestionIdRef.current = achievement.achievementId; setFocusedSuggestionId(achievement.achievementId); }}
        onGamepadFocus={() => { lastFocusedSuggestionIdRef.current = achievement.achievementId; setFocusedSuggestionId(achievement.achievementId); }}
        onBlur={() => setFocusedSuggestionId((current) => current === achievement.achievementId ? null : current)}
        onGamepadBlur={() => setFocusedSuggestionId((current) => current === achievement.achievementId ? null : current)}
        onActivate={() => browseAchievement(achievement.achievementId)}
        onClick={() => browseAchievement(achievement.achievementId)}
      >
        {achievement.badgeImageUrl ? <img className="ac-native-up-next__badge" src={achievement.badgeImageUrl} alt="" /> : <span className="ac-native-up-next__badge" aria-hidden="true" />}
        <span className="ac-native-up-next__copy"><span className="ac-native-up-next__title-row"><span className="ac-native-up-next__name">{achievement.title}</span>{getAchievementTypeBadgeDescriptor(achievement.classification) ? <span className="ac-native-up-next__classification"><DeckyNativeAchievementTypeLabel classification={achievement.classification} /></span> : null}</span><span className="ac-native-up-next__description">{achievement.description}</span></span>
      </Focusable>)}
    </div> : <div className="ac-native-up-next__empty">{completed ? `Your ${preferences.retroAchievementsGoal} goal is complete.` : projection.total === projection.earned ? "All achievements unlocked." : allSuggestions.length > 0 ? "All suggestions hidden. Restore them from Suggestions." : "No eligible suggestions are available."}</div>}
    <Focusable ref={(element) => { browseRef.current = element; }} className="ac-native-up-next__browse" role="link" onOKActionDescription="Achievements" onActivate={browse} onClick={browse}>View all achievements</Focusable>
  </div>;
}
