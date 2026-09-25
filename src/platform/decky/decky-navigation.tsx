import { routerHook } from "@decky/api";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigationPort, NavigationTarget } from "@core/platform";
import {
  Navigation as DeckyNavigation,
  QuickAccessTab,
  useParams,
} from "@decky/ui";
import { DeckyFullScreenProfilePage } from "./decky-full-screen-profile-page";
import { DeckyFullScreenAchievementPage } from "./decky-full-screen-achievement-page";
import { DeckyFullScreenAchievementHistoryPage } from "./decky-full-screen-achievement-history-page";
import { DeckyFullScreenCompletionProgressPage } from "./decky-full-screen-completion-progress-page";
import { DeckyFullScreenGamePage } from "./decky-full-screen-game-page";
import { DeckyFullScreenSettingsPage } from "./decky-full-screen-settings-page";
import { DeckyFullScreenProviderSettingsPage } from "./decky-full-screen-provider-settings-page";
import {
  DeckyFullScreenFooterOverlay,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
} from "./decky-full-screen-footer-overlay";
import { dispatchDeckyScrollReset } from "./decky-scroll-viewport";
import { resetSteamGameSectionActiveSection } from "./decky-steam-game-section-state";
import { beginDeckySteamFullScreenRefreshSession } from "./decky-app-services";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import {
  clearNextFullScreenSettingsBackTarget,
  consumeNextFullScreenCompletionProgressFilter,
  consumeNextFullscreenRouteUnmountActionSuppression,
  markFullScreenGameRouteBackBehavior,
  markNextFullScreenSettingsBackTarget,
  popFullScreenGameRouteBackBehavior,
  peekNextFullScreenSettingsBackTarget,
  resolveFullScreenGameRouteAchievementReturnTarget,
  resolveFullScreenGameRouteBackBehavior,
  shouldSuppressGameRouteUnmountWhenOpeningAchievement,
  suppressNextFullscreenRouteUnmountAction,
  type FullScreenGameRouteBackBehavior,
} from "./decky-full-screen-navigation-state";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import {
  getAdjacentSteamFullScreenSessionTab,
  type SteamFullScreenSessionTab,
} from "./decky-steam-full-screen-session-navigation";

const FULL_SCREEN_GAME_ROUTE_BASE = "/achievement-companion/full-screen/game";
const FULL_SCREEN_GAME_ROUTE_PATTERN = `${FULL_SCREEN_GAME_ROUTE_BASE}/:providerId/:gameId`;
const FULL_SCREEN_ACHIEVEMENT_ROUTE_BASE = "/achievement-companion/full-screen/achievement";
const FULL_SCREEN_ACHIEVEMENT_ROUTE_PATTERN =
  `${FULL_SCREEN_ACHIEVEMENT_ROUTE_BASE}/:providerId/:gameId/:achievementId`;
const FULL_SCREEN_ACHIEVEMENT_HISTORY_ROUTE_BASE =
  "/achievement-companion/full-screen/achievement-history";
const FULL_SCREEN_ACHIEVEMENT_HISTORY_ROUTE_PATTERN =
  `${FULL_SCREEN_ACHIEVEMENT_HISTORY_ROUTE_BASE}/:providerId`;
const FULL_SCREEN_PROFILE_ROUTE_BASE = "/achievement-companion/full-screen/profile";
const FULL_SCREEN_PROFILE_ROUTE_PATTERN = `${FULL_SCREEN_PROFILE_ROUTE_BASE}/:providerId`;
const FULL_SCREEN_COMPLETION_PROGRESS_ROUTE_BASE =
  "/achievement-companion/full-screen/completion-progress";
const FULL_SCREEN_COMPLETION_PROGRESS_ROUTE_PATTERN =
  `${FULL_SCREEN_COMPLETION_PROGRESS_ROUTE_BASE}/:providerId`;
const FULL_SCREEN_SETTINGS_ROUTE_BASE = "/achievement-companion/full-screen/settings";
const FULL_SCREEN_SETTINGS_ROUTE_PATTERN = FULL_SCREEN_SETTINGS_ROUTE_BASE;
const FULL_SCREEN_PROVIDER_SETTINGS_ROUTE_BASE =
  "/achievement-companion/full-screen/provider-settings";
const FULL_SCREEN_PROVIDER_SETTINGS_ROUTE_PATTERN =
  `${FULL_SCREEN_PROVIDER_SETTINGS_ROUTE_BASE}/:providerId`;

interface FullScreenGameRouteParams {
  readonly providerId?: string;
  readonly gameId?: string;
}

interface FullScreenAchievementRouteParams {
  readonly providerId?: string;
  readonly gameId?: string;
  readonly achievementId?: string;
}

interface FullScreenAchievementHistoryRouteParams {
  readonly providerId?: string;
}

interface FullScreenProfileRouteParams {
  readonly providerId?: string;
}

interface FullScreenCompletionProgressRouteParams {
  readonly providerId?: string;
}

interface FullScreenProviderSettingsRouteParams {
  readonly providerId?: string;
}

let isSteamFullScreenSessionActive = false;
let steamFullScreenSessionTab: SteamFullScreenSessionTab = "profile";
const steamFullScreenSessionListeners = new Set<() => void>();

function setSteamFullScreenSessionTab(tab: SteamFullScreenSessionTab): void {
  if (steamFullScreenSessionTab === tab) {
    return;
  }

  steamFullScreenSessionTab = tab;
  for (const listener of steamFullScreenSessionListeners) {
    listener();
  }
}

function subscribeToSteamFullScreenSession(listener: () => void): () => void {
  steamFullScreenSessionListeners.add(listener);
  return () => steamFullScreenSessionListeners.delete(listener);
}

function getSteamSessionTabForNavigationTarget(target: NavigationTarget): SteamFullScreenSessionTab | undefined {
  if (target.providerId !== STEAM_PROVIDER_ID || target.surface !== "full-screen") {
    return undefined;
  }

  switch (target.view) {
    case "profile":
      return "profile";
    case "completion-progress":
      return "games";
    case "achievement-history":
      return "activity";
    case "settings":
      return "settings";
    default:
      return undefined;
  }
}

let isFullScreenGameRouteRegistered = false;
let isFullScreenAchievementRouteRegistered = false;
let isFullScreenAchievementHistoryRouteRegistered = false;
let isFullScreenProfileRouteRegistered = false;
let isFullScreenCompletionProgressRouteRegistered = false;
let isFullScreenSettingsRouteRegistered = false;
let isFullScreenProviderSettingsRouteRegistered = false;

function registerFullScreenGameRoute(): void {
  if (isFullScreenGameRouteRegistered) {
    return;
  }

  routerHook.addRoute(FULL_SCREEN_GAME_ROUTE_PATTERN, DeckyFullScreenGameRoute);
  isFullScreenGameRouteRegistered = true;
}

function registerFullScreenAchievementRoute(): void {
  if (isFullScreenAchievementRouteRegistered) {
    return;
  }

  routerHook.addRoute(FULL_SCREEN_ACHIEVEMENT_ROUTE_PATTERN, DeckyFullScreenAchievementRoute);
  isFullScreenAchievementRouteRegistered = true;
}

function registerFullScreenAchievementHistoryRoute(): void {
  if (isFullScreenAchievementHistoryRouteRegistered) {
    return;
  }

  routerHook.addRoute(
    FULL_SCREEN_ACHIEVEMENT_HISTORY_ROUTE_PATTERN,
    DeckyFullScreenAchievementHistoryRoute,
  );
  isFullScreenAchievementHistoryRouteRegistered = true;
}

function registerFullScreenProfileRoute(): void {
  if (isFullScreenProfileRouteRegistered) {
    return;
  }

  routerHook.addRoute(FULL_SCREEN_PROFILE_ROUTE_PATTERN, DeckyFullScreenProfileRoute);
  isFullScreenProfileRouteRegistered = true;
}

function registerFullScreenCompletionProgressRoute(): void {
  if (isFullScreenCompletionProgressRouteRegistered) {
    return;
  }

  routerHook.addRoute(
    FULL_SCREEN_COMPLETION_PROGRESS_ROUTE_PATTERN,
    DeckyFullScreenCompletionProgressRoute,
  );
  isFullScreenCompletionProgressRouteRegistered = true;
}

function registerFullScreenSettingsRoute(): void {
  if (isFullScreenSettingsRouteRegistered) {
    return;
  }

  routerHook.addRoute(FULL_SCREEN_SETTINGS_ROUTE_PATTERN, DeckyFullScreenSettingsRoute);
  isFullScreenSettingsRouteRegistered = true;
}

function registerFullScreenProviderSettingsRoute(): void {
  if (isFullScreenProviderSettingsRouteRegistered) {
    return;
  }

  routerHook.addRoute(
    FULL_SCREEN_PROVIDER_SETTINGS_ROUTE_PATTERN,
    DeckyFullScreenProviderSettingsRoute,
  );
  isFullScreenProviderSettingsRouteRegistered = true;
}

function buildFullScreenGameRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "game" ||
    target.providerId === undefined ||
    target.gameId === undefined
  ) {
    return undefined;
  }

  return `${FULL_SCREEN_GAME_ROUTE_BASE}/${encodeURIComponent(target.providerId)}/${encodeURIComponent(target.gameId)}`;
}

function navigateToFullScreenGame(
  providerId: string,
  gameId: string,
  backBehavior: FullScreenGameRouteBackBehavior = "decky-panel",
  suppressCurrentRouteUnmount = false,
): void {
  if (suppressCurrentRouteUnmount) {
    suppressNextFullscreenRouteUnmountAction();
  }

  registerFullScreenGameRoute();
  markFullScreenGameRouteBackBehavior(providerId, gameId, backBehavior);

  const route = buildFullScreenGameRoute({
    view: "game",
    surface: "full-screen",
    providerId,
    gameId,
  });
  if (route !== undefined) {
    DeckyNavigation.Navigate(route);
  }
}

export function openDeckyFullScreenGameFromLibraryGamePage(
  providerId: string,
  gameId: string,
): string | undefined {
  if (providerId === STEAM_PROVIDER_ID) {
    beginDeckySteamFullScreenRefreshSession(STEAM_PROVIDER_ID);
  }
  registerFullScreenGameRoute();
  markFullScreenGameRouteBackBehavior(providerId, gameId, "library-game-page");

  const route = buildFullScreenGameRoute({
    view: "game",
    surface: "full-screen",
    providerId,
    gameId,
  });
  if (route !== undefined) {
    DeckyNavigation.Navigate(route);
  }

  return route;
}

function returnToDeckyPanel(): void {
  dispatchDeckyScrollReset("dashboard");
  DeckyNavigation.NavigateBack();
  DeckyNavigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
}

function DeckyFullscreenRouteLeaveBoundary({
  children,
  onUnmount,
}: {
  readonly children: JSX.Element;
  readonly onUnmount: () => void;
}): JSX.Element {
  const onUnmountRef = useRef(onUnmount);

  useEffect(() => {
    onUnmountRef.current = onUnmount;
  }, [onUnmount]);

  useEffect(() => {
    return () => {
      if (consumeNextFullscreenRouteUnmountActionSuppression()) {
        return;
      }

      onUnmountRef.current();
    };
  }, []);

  return children;
}

function buildFullScreenAchievementRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "achievement" ||
    target.providerId === undefined ||
    target.gameId === undefined ||
    target.achievementId === undefined
  ) {
    return undefined;
  }

  return `${FULL_SCREEN_ACHIEVEMENT_ROUTE_BASE}/${encodeURIComponent(target.providerId)}/${encodeURIComponent(target.gameId)}/${encodeURIComponent(target.achievementId)}`;
}

function navigateToFullScreenAchievement(
  providerId: string,
  gameId: string,
  achievementId: string,
  suppressCurrentRouteUnmount = false,
): void {
  if (suppressCurrentRouteUnmount) {
    suppressNextFullscreenRouteUnmountAction();
  }

  registerFullScreenAchievementRoute();

  const route = buildFullScreenAchievementRoute({
    view: "achievement",
    surface: "full-screen",
    providerId,
    gameId,
    achievementId,
  });
  if (route !== undefined) {
    DeckyNavigation.Navigate(route);
  }
}

function buildFullScreenProfileRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "profile" ||
    target.providerId === undefined
  ) {
    return undefined;
  }

  return `${FULL_SCREEN_PROFILE_ROUTE_BASE}/${encodeURIComponent(target.providerId)}`;
}

function buildFullScreenAchievementHistoryRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "achievement-history" ||
    target.providerId === undefined
  ) {
    return undefined;
  }

  return `${FULL_SCREEN_ACHIEVEMENT_HISTORY_ROUTE_BASE}/${encodeURIComponent(target.providerId)}`;
}

function buildFullScreenCompletionProgressRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "completion-progress" ||
    target.providerId === undefined
  ) {
    return undefined;
  }

  return `${FULL_SCREEN_COMPLETION_PROGRESS_ROUTE_BASE}/${encodeURIComponent(target.providerId)}`;
}

function buildFullScreenSettingsRoute(target: NavigationTarget): string | undefined {
  if (target.surface !== "full-screen" || target.view !== "settings") {
    return undefined;
  }

  return FULL_SCREEN_SETTINGS_ROUTE_BASE;
}

function buildFullScreenProviderSettingsRoute(providerId: string): string {
  return `${FULL_SCREEN_PROVIDER_SETTINGS_ROUTE_BASE}/${encodeURIComponent(providerId)}`;
}

function navigateToFullScreenProviderSettings(providerId: string): void {
  registerFullScreenProviderSettingsRoute();
  suppressNextFullscreenRouteUnmountAction();
  DeckyNavigation.Navigate(buildFullScreenProviderSettingsRoute(providerId));
}

function DeckyFullScreenGameRoute(): JSX.Element {
  const params = useParams<FullScreenGameRouteParams>();
  const fullScreenGameRouteBackBehavior = useMemo(
    () => resolveFullScreenGameRouteBackBehavior(params.providerId, params.gameId),
    [params.providerId, params.gameId],
  );
  const achievementReturnTarget = useMemo(
    () => resolveFullScreenGameRouteAchievementReturnTarget(params.providerId, params.gameId),
    [params.providerId, params.gameId],
  );
  const shouldReturnToCompletionProgress = fullScreenGameRouteBackBehavior === "completion-progress";
  const shouldReturnToProfile = fullScreenGameRouteBackBehavior === "profile";
  const shouldReturnToAchievementDetail =
    fullScreenGameRouteBackBehavior === "achievement" && achievementReturnTarget !== undefined;
  const detailScrollKey =
    params.providerId !== undefined && params.gameId !== undefined
      ? `game-detail:${params.providerId}:${params.gameId}`
      : undefined;

  const returnFromGamePage = (): void => {
    if (params.providerId !== undefined && params.gameId !== undefined) {
      resetSteamGameSectionActiveSection(params.providerId, params.gameId);
    }

    if (fullScreenGameRouteBackBehavior === "library-game-page") {
      DeckyNavigation.NavigateBack();
      return;
    }

    if (shouldReturnToCompletionProgress || shouldReturnToProfile) {
      DeckyNavigation.NavigateBack();
      return;
    }

    if (shouldReturnToAchievementDetail && achievementReturnTarget !== undefined) {
      popFullScreenGameRouteBackBehavior(params.providerId, params.gameId);
      DeckyNavigation.NavigateBack();
      return;
    }

    if (detailScrollKey !== undefined) {
      dispatchDeckyScrollReset(detailScrollKey);
    }

    DeckyNavigation.NavigateBack();
    DeckyNavigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
  };

  const content = (
      <DeckyFullScreenGamePage
        gameId={params.gameId}
        onOpenAchievementDetail={
          params.providerId !== undefined && params.gameId !== undefined
            ? (achievementId) => {
                navigateToFullScreenAchievement(
                  params.providerId!,
                  params.gameId!,
                  achievementId,
                  shouldSuppressGameRouteUnmountWhenOpeningAchievement(fullScreenGameRouteBackBehavior),
                );
              }
            : undefined
        }
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnFromGamePage();
        }}
        {...(shouldReturnToCompletionProgress
          ? {
              backLabel: "Back",
              backFooter: "Use Back to return to the full-screen completion progress page.",
            }
          : {})}
        providerId={params.providerId}
      />
  );

  // Steam can unmount this route while opening its Home, Quick Access, and
  // header overlays. Those are Steam-owned navigation transitions, not an
  // Achievement Companion Back action. Explicit Back handlers retain the
  // return behavior above; passive route unmounts must not navigate anywhere.
  return content;
}

function DeckyFullScreenAchievementRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementRouteParams>();

  const returnToGamePage = (): void => {
    DeckyNavigation.NavigateBack();
  };

  return (
    <DeckyFullscreenRouteLeaveBoundary
      onUnmount={() => {
        returnToGamePage();
      }}
    >
      <DeckyFullScreenAchievementPage
        achievementId={params.achievementId}
        gameId={params.gameId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToGamePage();
        }}
        providerId={params.providerId}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenAchievementHistoryRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementHistoryRouteParams>();

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={() => {
      DeckyNavigation.NavigateBack();
    }}>
      <DeckyFullScreenAchievementHistoryPage
        providerId={params.providerId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          DeckyNavigation.NavigateBack();
        }}
        onOpenGames={() => {
          if (params.providerId === undefined) {
            return;
          }

          registerFullScreenCompletionProgressRoute();
          const route = buildFullScreenCompletionProgressRoute({
            view: "completion-progress",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenSettings={() => {
          registerFullScreenSettingsRoute();
          markNextFullScreenSettingsBackTarget("previous-fullscreen");
          const route = buildFullScreenSettingsRoute({ view: "settings", surface: "full-screen" });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenAchievementDetail={(gameId, achievementId) => {
          if (params.providerId !== undefined) {
            navigateToFullScreenAchievement(params.providerId, gameId, achievementId, true);
          }
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

/**
 * Steam's Profile, Games, Activity, and Settings are views within one
 * full-screen visit, not entries in the Decky route history. Keeping the
 * session mounted makes a single Back press leave the visit regardless of
 * how many footer tabs the player has visited. Game and achievement details
 * still use real routes above this session so their Back semantics remain
 * hierarchical.
 */
function DeckySteamFullScreenSession({ providerId }: { readonly providerId: string | undefined }): JSX.Element {
  const [activeTab, setActiveTab] = useState<SteamFullScreenSessionTab>(() => steamFullScreenSessionTab);
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<SteamFullScreenSessionTab>>(
    () => new Set<SteamFullScreenSessionTab>([steamFullScreenSessionTab]),
  );
  const [gamesInitialFilter, setGamesInitialFilter] = useState<CompletionProgressSelectionFilter>("all");
  const [gamesViewRevision, setGamesViewRevision] = useState(0);

  useEffect(() => {
    isSteamFullScreenSessionActive = true;
    const unsubscribe = subscribeToSteamFullScreenSession(() => {
      setActiveTab(steamFullScreenSessionTab);
    });

    return () => {
      unsubscribe();
      isSteamFullScreenSessionActive = false;
      steamFullScreenSessionTab = "profile";
    };
  }, []);

  const selectTab = (tab: SteamFullScreenSessionTab): void => {
    setSteamFullScreenSessionTab(tab);
    setVisitedTabs((currentTabs) => currentTabs.has(tab)
      ? currentTabs
      : new Set<SteamFullScreenSessionTab>([...currentTabs, tab]));
    setActiveTab(tab);
  };

  const openGames = (initialFilter: CompletionProgressSelectionFilter = "all"): void => {
    setGamesInitialFilter(initialFilter);
    // L1/R1 traversal must retain the already-mounted Games tree.  A
    // non-default profile shortcut still intentionally resets its filter.
    if (initialFilter !== "all") {
      setGamesViewRevision((currentRevision) => currentRevision + 1);
    }
    selectTab("games");
  };

  const exitSession = (): void => {
    suppressNextFullscreenRouteUnmountAction();
    returnToDeckyPanel();
  };

  return (
    <>
      {visitedTabs.has("profile") ? <div style={{ display: activeTab === "profile" ? "contents" : "none" }}>
        <DeckyFullScreenProfilePage
          providerId={providerId}
          isActive={activeTab === "profile"}
          showSteamProfileFooter={false}
          onBack={exitSession}
          onOpenAchievementHistory={() => selectTab("activity")}
          onOpenAchievementDetail={(profileProviderId, gameId, achievementId) => {
            navigateToFullScreenAchievement(profileProviderId, gameId, achievementId, true);
          }}
          onOpenSettings={() => selectTab("settings")}
          onOpenCompletionProgress={(_profileProviderId, initialFilter) => openGames(initialFilter)}
          onOpenGameDetail={(profileProviderId, gameId) => {
            navigateToFullScreenGame(profileProviderId, gameId, "profile", true);
          }}
        />
      </div> : null}
      {visitedTabs.has("games") ? <div style={{ display: activeTab === "games" ? "contents" : "none" }}>
        <DeckyFullScreenCompletionProgressPage
          key={`steam-games-${gamesViewRevision}`}
          providerId={providerId}
          isActive={activeTab === "games"}
          showSteamProfileFooter={false}
          initialFilter={gamesInitialFilter}
          onBack={exitSession}
          onOpenProfile={() => selectTab("profile")}
          onOpenActivity={() => selectTab("activity")}
          onOpenGameDetail={(gameId) => {
            if (providerId !== undefined) {
              navigateToFullScreenGame(providerId, gameId, "completion-progress", true);
            }
          }}
        />
      </div> : null}
      {visitedTabs.has("activity") ? <div style={{ display: activeTab === "activity" ? "contents" : "none" }}>
        <DeckyFullScreenAchievementHistoryPage
          providerId={providerId}
          isActive={activeTab === "activity"}
          showSteamProfileFooter={false}
          onBack={exitSession}
          onOpenGames={() => openGames()}
          onOpenSettings={() => selectTab("settings")}
          onOpenAchievementDetail={(gameId, achievementId) => {
            if (providerId !== undefined) {
              navigateToFullScreenAchievement(providerId, gameId, achievementId, true);
            }
          }}
        />
      </div> : null}
      {visitedTabs.has("settings") ? <div style={{ display: activeTab === "settings" ? "contents" : "none" }}>
        <DeckyFullScreenSettingsPage
          isActive={activeTab === "settings"}
          onBack={exitSession}
          onOpenProviderSettings={(providerId) => {
            navigateToFullScreenProviderSettings(providerId);
          }}
          onOpenExternalUrl={(url) => {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.NavigateToExternalWeb(url);
          }}
          onOpenActivity={() => selectTab("activity")}
          onOpenProfile={() => selectTab("profile")}
        />
      </div> : null}
      <DeckyFullScreenFooterOverlay
        activeNavigationItemId={activeTab}
        ariaLabel="Steam profile navigation"
        navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        onBack={exitSession}
        onPreviousNavigationItem={() => {
          selectTab(getAdjacentSteamFullScreenSessionTab(activeTab, "previous"));
        }}
        onNextNavigationItem={() => {
          const nextTab = getAdjacentSteamFullScreenSessionTab(activeTab, "next");
          if (activeTab === "profile" && nextTab === "games") {
            openGames();
            return;
          }
          selectTab(nextTab);
        }}
      />
    </>
  );
}

function DeckyFullScreenProfileRoute(): JSX.Element {
  const params = useParams<FullScreenProfileRouteParams>();

  return (
    <DeckyFullscreenRouteLeaveBoundary
      onUnmount={() => {
        returnToDeckyPanel();
      }}
    >
      <DeckySteamFullScreenSession providerId={params.providerId} />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenCompletionProgressRoute(): JSX.Element {
  const params = useParams<FullScreenCompletionProgressRouteParams>();
  const initialFilter = useMemo<CompletionProgressSelectionFilter | undefined>(
    () => consumeNextFullScreenCompletionProgressFilter(),
    [],
  );

  return (
    <DeckyFullscreenRouteLeaveBoundary
      onUnmount={() => {
        DeckyNavigation.NavigateBack();
      }}
    >
      <DeckyFullScreenCompletionProgressPage
        providerId={params.providerId}
        {...(initialFilter !== undefined ? { initialFilter } : {})}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          DeckyNavigation.NavigateBack();
        }}
        onOpenProfile={() => {
          if (params.providerId === undefined) {
            return;
          }

          registerFullScreenProfileRoute();
          const route = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenActivity={() => {
          if (params.providerId === undefined) {
            return;
          }

          registerFullScreenAchievementHistoryRoute();
          const route = buildFullScreenAchievementHistoryRoute({
            view: "achievement-history",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenGameDetail={(gameId) => {
          if (params.providerId !== undefined) {
            navigateToFullScreenGame(params.providerId, gameId, "completion-progress", true);
          }
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenSettingsRoute(): JSX.Element {
  const backTarget = useMemo(() => peekNextFullScreenSettingsBackTarget(), []);
  const shouldReturnToDeckyPanel = backTarget === "compact-panel";

  return (
    <DeckyFullscreenRouteLeaveBoundary
      onUnmount={() => {
        if (shouldReturnToDeckyPanel) {
          returnToDeckyPanel();
          return;
        }

        DeckyNavigation.NavigateBack();
      }}
    >
      <DeckyFullScreenSettingsPage
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          clearNextFullScreenSettingsBackTarget();
          if (shouldReturnToDeckyPanel) {
            returnToDeckyPanel();
            return;
          }

          DeckyNavigation.NavigateBack();
        }}
        onOpenProviderSettings={(providerId) => {
          navigateToFullScreenProviderSettings(providerId);
        }}
        onOpenExternalUrl={(url) => {
          suppressNextFullscreenRouteUnmountAction();
          DeckyNavigation.NavigateToExternalWeb(url);
        }}
        showSteamProfileFooter={!shouldReturnToDeckyPanel}
        onOpenActivity={() => {
          registerFullScreenAchievementHistoryRoute();
          const route = buildFullScreenAchievementHistoryRoute({
            view: "achievement-history",
            surface: "full-screen",
            providerId: STEAM_PROVIDER_ID,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenProfile={() => {
          registerFullScreenProfileRoute();
          const route = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: STEAM_PROVIDER_ID,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenProviderSettingsRoute(): JSX.Element {
  const params = useParams<FullScreenProviderSettingsRouteParams>();
  const providerId = params.providerId ?? "retroachievements";

  const returnToSettingsPage = (): void => {
    DeckyNavigation.NavigateBack();
  };

  return (
    <DeckyFullscreenRouteLeaveBoundary
      onUnmount={() => {
        returnToSettingsPage();
      }}
    >
      <DeckyFullScreenProviderSettingsPage
        providerId={providerId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToSettingsPage();
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

export function createDeckyNavigationPort(): NavigationPort {
  return {
    go(target) {
      if (target.surface === "full-screen") {
        const steamSessionTab = getSteamSessionTabForNavigationTarget(target);
        if (steamSessionTab !== undefined && isSteamFullScreenSessionActive) {
          // Compact-panel Profile actions must reveal the existing visit rather
          // than push another full-screen route or restart its refresh session.
          setSteamFullScreenSessionTab(steamSessionTab);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        if (target.providerId === STEAM_PROVIDER_ID) {
          beginDeckySteamFullScreenRefreshSession(STEAM_PROVIDER_ID);
        }

        if (steamSessionTab !== undefined) {
          setSteamFullScreenSessionTab(steamSessionTab);
          registerFullScreenProfileRoute();
          const profileRoute = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: STEAM_PROVIDER_ID,
          });
          if (profileRoute !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(profileRoute);
            DeckyNavigation.CloseSideMenus();
          }
          return;
        }

        const completionProgressRoute = buildFullScreenCompletionProgressRoute(target);
        if (completionProgressRoute !== undefined) {
          registerFullScreenCompletionProgressRoute();
          DeckyNavigation.Navigate(completionProgressRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        if (buildFullScreenAchievementRoute(target) !== undefined) {
          navigateToFullScreenAchievement(target.providerId!, target.gameId!, target.achievementId!);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        const achievementHistoryRoute = buildFullScreenAchievementHistoryRoute(target);
        if (achievementHistoryRoute !== undefined) {
          registerFullScreenAchievementHistoryRoute();
          DeckyNavigation.Navigate(achievementHistoryRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        const settingsRoute = buildFullScreenSettingsRoute(target);
        if (settingsRoute !== undefined) {
          registerFullScreenSettingsRoute();
          DeckyNavigation.Navigate(settingsRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        const profileRoute = buildFullScreenProfileRoute(target);
        if (profileRoute !== undefined) {
          registerFullScreenProfileRoute();
          // Opening Profile from the compact dashboard replaces whichever
          // full-screen tab was underneath Quick Access. Do not let that
          // tab's unmount fallback issue a competing Back navigation.
          suppressNextFullscreenRouteUnmountAction();
          DeckyNavigation.Navigate(profileRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        if (target.providerId !== undefined && target.gameId !== undefined) {
          navigateToFullScreenGame(target.providerId, target.gameId);
          DeckyNavigation.CloseSideMenus();
        }
        return;
      }

      DeckyNavigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
    },
    back() {
      DeckyNavigation.NavigateBack();
    },
  };
}
