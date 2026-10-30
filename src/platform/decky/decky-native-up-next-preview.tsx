import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNativeGamePageSurfaceVisible } from "./decky-native-game-page-visibility";
import { DeckyNativeUpNextPreviewCard } from "./decky-native-up-next-preview-card";
import type { GameDetailSnapshot } from "@core/domain";
import { useDeckySettings } from "./decky-settings";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { useDeckyProviderConfigs } from "./providers/provider-config-store";
import { getDeckyAccountRevision, subscribeDeckyAccountRevision } from "./decky-account-revision";
import { loadDeckyGameDetailState } from "./decky-app-services";
import { buildDeckyCompactUpNextModel } from "./decky-compact-up-next-model";
import { loadDeckyCompactGameState, loadDeckyCompactRecommendationGameState, readDeckyCompactGameState, readDeckyCompactRecommendationGameState } from "./decky-compact-session-resources";
import { readDeckySteamGameDetailState } from "./decky-steam-game-detail-cache";
import { subscribeDeckyGameDetailPublication } from "./decky-game-detail-publication";
import { getDeckyRetroAchievementsDataCoordinator, getDeckyRetroAchievementsGameResourceRevision, isDeckyRetroAchievementsGameResourceFresh } from "./providers/retroachievements/backend-transport";
import { createNativeUpNextPreviewSession, measureNativeUpNextPreviewPlacement, nativeUpNextPresentation, placeNativeUpNextPreview, shouldShowNativeUpNextPreview, type NativeUpNextIdentity, type PreviewRect } from "./decky-native-up-next-preview-model";
import { appDetailsClasses } from "@decky/ui";

export function DeckyNativeUpNextPreview({ identity, appId, badge, focused, hovered }: {
  readonly identity: NativeUpNextIdentity;
  readonly appId: string;
  readonly badge: HTMLElement;
  readonly focused: boolean;
  readonly hovered: boolean;
}): JSX.Element | null {
  const settings = useDeckySettings();
  const configs = useDeckyProviderConfigs();
  const { providerId, gameId } = identity;
  const accountId = providerId === "steam" ? configs.steam?.steamId64 : configs.retroAchievements?.username.toLowerCase();
  const accountRevision = useSyncExternalStore(subscribeDeckyAccountRevision, () => getDeckyAccountRevision(providerId), () => 0);
  const key = JSON.stringify([appId, providerId, gameId, accountId, accountRevision]);
  const preferences = useDeckyGameOverviewPreferences(providerId, gameId);
  const pageVisible = useNativeGamePageSurfaceVisible(badge, appId);
  const presentation = nativeUpNextPresentation(settings.gamePageUpNextDescription, focused, hovered);
  const active = accountId !== undefined && shouldShowNativeUpNextPreview(settings.gamePageUpNextPreview, focused, hovered,
    { pageVisible, badgeEnabled: settings.showGamePageAchievementBadge });
  const [loaded, setLoaded] = useState<{ key: string; snapshot: GameDetailSnapshot }>();
  const session = useMemo(() => createNativeUpNextPreviewSession({
    read: () => providerId === "retroachievements" ? readDeckyCompactRecommendationGameState(gameId) ?? readDeckyCompactGameState(providerId, gameId)
      : readDeckyCompactGameState(providerId, gameId) ?? readDeckySteamGameDetailState(gameId),
    load: () => {
      const loader = () => loadDeckyGameDetailState(providerId, gameId, { forceRefresh: false, recommendationOnly: true, entryPoint: "native-up-next-preview" });
      return providerId === "retroachievements" ? loadDeckyCompactRecommendationGameState(gameId, loader) : loadDeckyCompactGameState(providerId, gameId, loader);
    },
  }), [key]);
  const matches = (snapshot: GameDetailSnapshot): boolean => snapshot.game.providerId === providerId && snapshot.game.gameId === gameId;
  useEffect(() => {
    if (!active) return;
    let current = true;
    const cached = session.read()?.data;
    if (cached !== undefined && matches(cached)) setLoaded({ key, snapshot: cached });
    void session.load().then((state) => {
      if (current && accountRevision === getDeckyAccountRevision(providerId) && state.data !== undefined && matches(state.data)) setLoaded({ key, snapshot: state.data });
    }).catch(() => undefined);
    return () => { current = false; };
  }, [active, session]);
  useEffect(() => {
    if (accountId === undefined || settings.gamePageUpNextPreview === "hidden") return;
    let current = true;
    const unsubscribe = subscribeDeckyGameDetailPublication((snapshot) => {
      if (current && matches(snapshot) && accountRevision === getDeckyAccountRevision(providerId)) setLoaded({ key, snapshot });
    });
    let revision = providerId === "retroachievements" ? getDeckyRetroAchievementsGameResourceRevision(gameId) : undefined;
    const unsubscribeCanonical = providerId !== "retroachievements" ? undefined : getDeckyRetroAchievementsDataCoordinator().subscribeResource({ path: "API_GetGameInfoAndUserProgress.php", query: { g: gameId, a: 1 } }, () => {
      const next = getDeckyRetroAchievementsGameResourceRevision(gameId);
      if (!current || !session.requested() || next === undefined || next === revision || !isDeckyRetroAchievementsGameResourceFresh(gameId)) return;
      revision = next;
      // A published fresh revision is reconstructed locally through the canonical owner.
      void loadDeckyCompactRecommendationGameState(gameId, () => loadDeckyGameDetailState(providerId, gameId, { forceRefresh: false, recommendationOnly: true, entryPoint: "native-up-next-revision" })).then((state) => {
        if (current && accountRevision === getDeckyAccountRevision(providerId) && state.data !== undefined && matches(state.data)) setLoaded({ key, snapshot: state.data });
      }).catch(() => undefined);
    });
    return () => { current = false; unsubscribe(); unsubscribeCanonical?.(); };
  }, [key, settings.gamePageUpNextPreview === "hidden"]);
  const snapshot = loaded?.key === key ? loaded.snapshot : undefined;
  const target = useMemo(() => snapshot === undefined ? undefined : buildDeckyCompactUpNextModel({ snapshot, pinnedAchievement: preferences.pinnedAchievement,
    hiddenAchievementIds: preferences.hiddenAchievementIds, goal: preferences.retroAchievementsGoal, achievementMode: settings.retroAchievementsAchievementMode }).suggestions[0],
  [snapshot, preferences.pinnedAchievement, preferences.hiddenAchievementIds, preferences.retroAchievementsGoal, settings.retroAchievementsAchievementMode]);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<PreviewRect>();
  useLayoutEffect(() => {
    if (!active || target === undefined) return;
    const document = badge.ownerDocument;
    const window = document.defaultView;
    const container = badge.parentElement;
    const header = Array.from(container?.children ?? []).find((element) => typeof element.className === "string" && element.className.includes(appDetailsClasses.Header)) ?? container?.firstElementChild;
    if (window === null || header === undefined || header === null || header === badge) return;
    const measure = (): void => {
      const card = cardRef.current;
      if (card === null || !badge.isConnected) return;
      const shell = badge.querySelector<HTMLElement>("[data-ac-game-page-badge-variant]");
      const badgeRect = badge.getBoundingClientRect();
      const anchor = shell?.getBoundingClientRect() ?? badgeRect;
      const pageScale = badgeRect.width / Math.max(1, badge.offsetWidth);
      card.style.width = `${anchor.width / pageScale}px`;
      // Measure the shell's width, not its silhouette: Classic's capsule radius
      // is unsuitable for multiline content. The card owns its Minimal radius.
      const obstacles = Array.from(header.querySelectorAll<HTMLElement>('button,a[href],[tabindex]:not([tabindex="-1"]),[role="button"]'));
      for (const sibling of Array.from(container?.children ?? [])) {
        if (sibling === badge || sibling === header) continue;
        if (["absolute", "fixed"].includes(window.getComputedStyle(sibling).position)) obstacles.push(sibling as HTMLElement);
      }
      const rects = obstacles.filter((element) => window.getComputedStyle(element).visibility !== "hidden" && window.getComputedStyle(element).display !== "none")
        .map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
      // Never crop text to force a fit. Prefer a usable compact indication when
      // the full description has no safe slot; A still opens the details page.
      const next = measureNativeUpNextPreviewPlacement(card, (size) => placeNativeUpNextPreview(anchor, header.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, size, rects));
      setPlacement((previous) => previous?.left === next?.left && previous?.top === next?.top && previous?.right === next?.right && previous?.bottom === next?.bottom ? previous : next);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(badge); resize.observe(header); if (cardRef.current !== null) resize.observe(cardRef.current);
    const mutation = new MutationObserver(measure);
    mutation.observe(badge, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measure);
    badge.addEventListener("transitionend", measure);
    document.addEventListener("scroll", measure, true);
    return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener("resize", measure); badge.removeEventListener("transitionend", measure); document.removeEventListener("scroll", measure, true); };
  }, [active, presentation, target?.achievement, badge, settings.gamePageAchievementBadgePosition, settings.gamePageAchievementBadgeSize, settings.gamePageAchievementBadgeStyle]);
  if (!active || target === undefined) return null;
  const origin = badge.getBoundingClientRect();
  const scaleX = origin.width / Math.max(1, badge.offsetWidth);
  const scaleY = origin.height / Math.max(1, badge.offsetHeight);
  return <DeckyNativeUpNextPreviewCard target={target} presentation={presentation} elementRef={(element) => { cardRef.current = element; }}
    style={{ position: "absolute", left: ((placement?.left ?? origin.left) - origin.left) / scaleX, top: ((placement?.top ?? origin.top) - origin.top) / scaleY,
      visibility: placement === undefined ? "hidden" : "visible" }} />;
}
