import { routerHook } from "@decky/api";
import { useEffect, useMemo, useState } from "react";
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
import { DeckyFullScreenTerminalBackBridge } from "./decky-full-screen-terminal-back";
import {
  beginDeckyCompactOriginFullScreenSession,
  clearDeckyFullScreenSession,
  consumeDeckyCompactOriginFullScreenSession,
  isDeckyCompactOriginFullScreenSessionRoot,
  type DeckyFullScreenSessionRoot,
} from "./decky-full-screen-session";
import { createDeckyFullScreenTerminalReturn } from "./decky-full-screen-terminal-return";
import { dispatchDeckyScrollReset } from "./decky-scroll-viewport";
import {
  resetSteamGameSectionActiveSection,
  resetSteamGameSectionPageStates,
} from "./decky-steam-game-section-state";
import { beginDeckySteamFullScreenRefreshSession } from "./decky-app-services";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { resetDeckySteamActivityPageState } from "./decky-steam-full-screen-activity-state";
import { resetDeckySteamGamesPageState } from "./decky-steam-full-screen-games-state";
import { requestDeckySteamCompactFocusRestore } from "./decky-steam-compact-focus-state";
import {
  consumeNextFullScreenCompletionProgressFilter,
  markNextFullScreenCompletionProgressFilter,
} from "./decky-full-screen-navigation-state";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import {
  getAdjacentSteamFullScreenSessionTab,
  type SteamFullScreenSessionTab,
} from "./decky-steam-full-screen-session-navigation";
import { createDeckyRouteRegistration } from "./decky-route-registration";
import {
  buildDeckyFullScreenAchievementHistoryRoute,
  buildDeckyFullScreenAchievementRoute,
  buildDeckyFullScreenCompletionProgressRoute,
  buildDeckyFullScreenGameRoute,
  buildDeckyFullScreenProfileRoute,
  buildDeckyFullScreenProviderSettingsRoute,
  buildDeckyFullScreenSettingsRoute,
  DECKY_FULL_SCREEN_ROUTE_PATTERNS,
} from "./decky-routes";

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

function resetDeckySteamFullScreenSessionState(): void {
  steamFullScreenSessionTab = "profile";
  resetDeckySteamActivityPageState();
  resetDeckySteamGamesPageState();
  resetSteamGameSectionPageStates();
}

const deckyFullScreenTerminalReturn = createDeckyFullScreenTerminalReturn({
  consumeSession: consumeDeckyCompactOriginFullScreenSession,
  clearSession: clearDeckyFullScreenSession,
  navigateBack: () => DeckyNavigation.NavigateBack(),
  openDeckyQuickAccessMenu: () => {
    DeckyNavigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
    requestDeckySteamCompactFocusRestore();
  },
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

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

function getDeckyFullScreenSessionRoot(
  target: NavigationTarget,
): DeckyFullScreenSessionRoot | undefined {
  if (target.surface !== "full-screen") {
    return undefined;
  }

  switch (target.view) {
    case "profile":
      return target.providerId === undefined ? undefined : "profile";
    case "game":
      return target.providerId === undefined || target.gameId === undefined
        ? undefined
        : "game";
    case "achievement-history":
      return target.providerId === undefined
        ? undefined
        : "achievement-history";
    case "completion-progress":
      return target.providerId === undefined
        ? undefined
        : "completion-progress";
    case "settings":
      return "settings";
    default:
      return undefined;
  }
}

function beginDeckyCompactFullScreenEntry(rootRoute: DeckyFullScreenSessionRoot): void {
  // A newer compact launch supersedes any pending terminal handoff.
  deckyFullScreenTerminalReturn.cancelPendingReopen();
  beginDeckyCompactOriginFullScreenSession(rootRoute);
}

function navigateBackFromFullScreenRoot(rootRoute: DeckyFullScreenSessionRoot): void {
  deckyFullScreenTerminalReturn.handleRootBack(rootRoute);
}

export function clearDeckyCompactOriginFullScreenSession(): void {
  deckyFullScreenTerminalReturn.clear();
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

  return buildDeckyFullScreenGameRoute(target.providerId, target.gameId);
}

function navigateToFullScreenGame(
  providerId: string,
  gameId: string,
): void {
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

  const route = buildFullScreenGameRoute({
    view: "game",
    surface: "full-screen",
    providerId,
    gameId,
  });
  if (route !== undefined) {
    // A Steam Game Page launch did not originate in AC's compact panel.
    clearDeckyCompactOriginFullScreenSession();
    DeckyNavigation.Navigate(route);
  }

  return route;
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

  return buildDeckyFullScreenAchievementRoute(
    target.providerId,
    target.gameId,
    target.achievementId,
  );
}

function navigateToFullScreenAchievement(
  providerId: string,
  gameId: string,
  achievementId: string,
): void {
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

  return buildDeckyFullScreenProfileRoute(target.providerId);
}

function buildFullScreenAchievementHistoryRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "achievement-history" ||
    target.providerId === undefined
  ) {
    return undefined;
  }

  return buildDeckyFullScreenAchievementHistoryRoute(target.providerId);
}

function buildFullScreenCompletionProgressRoute(target: NavigationTarget): string | undefined {
  if (
    target.surface !== "full-screen" ||
    target.view !== "completion-progress" ||
    target.providerId === undefined
  ) {
    return undefined;
  }

  return buildDeckyFullScreenCompletionProgressRoute(target.providerId);
}

function buildFullScreenSettingsRoute(target: NavigationTarget): string | undefined {
  if (target.surface !== "full-screen" || target.view !== "settings") {
    return undefined;
  }

  return buildDeckyFullScreenSettingsRoute();
}

function buildFullScreenProviderSettingsRoute(providerId: string): string {
  return buildDeckyFullScreenProviderSettingsRoute(providerId);
}

function navigateToFullScreenProviderSettings(providerId: string): void {
  DeckyNavigation.Navigate(buildFullScreenProviderSettingsRoute(providerId));
}

function DeckyFullScreenGameRoute(): JSX.Element {
  const params = useParams<FullScreenGameRouteParams>();
  const detailScrollKey =
    params.providerId !== undefined && params.gameId !== undefined
      ? `game-detail:${params.providerId}:${params.gameId}`
      : undefined;

  const returnFromGamePage = (): void => {
    if (params.providerId !== undefined && params.gameId !== undefined) {
      resetSteamGameSectionActiveSection(params.providerId, params.gameId);
    }

    if (detailScrollKey !== undefined) {
      dispatchDeckyScrollReset(detailScrollKey);
    }

    navigateBackFromFullScreenRoot("game");
  };

  return (
    <>
      {isDeckyCompactOriginFullScreenSessionRoot("game")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromGamePage} />
        : null}
      <DeckyFullScreenGamePage
        gameId={params.gameId}
        onOpenAchievementDetail={
          params.providerId !== undefined && params.gameId !== undefined
            ? (achievementId) => {
                navigateToFullScreenAchievement(
                  params.providerId!,
                  params.gameId!,
                  achievementId,
                );
              }
            : undefined
        }
        onBack={returnFromGamePage}
        providerId={params.providerId}
      />
    </>
  );
}

function DeckyFullScreenAchievementRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementRouteParams>();

  return <DeckyFullScreenAchievementPage
    achievementId={params.achievementId}
    gameId={params.gameId}
    providerId={params.providerId}
  />;
}

function DeckyFullScreenAchievementHistoryRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementHistoryRouteParams>();
  const returnFromAchievementHistory = (): void => {
    navigateBackFromFullScreenRoot("achievement-history");
  };

  return (
    <>
      {isDeckyCompactOriginFullScreenSessionRoot("achievement-history")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromAchievementHistory} />
        : null}
      <DeckyFullScreenAchievementHistoryPage
        providerId={params.providerId}
        onBack={returnFromAchievementHistory}
        onOpenGames={() => {
          if (params.providerId === undefined) {
            return;
          }

          const route = buildFullScreenCompletionProgressRoute({
            view: "completion-progress",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenSettings={() => {
          const route = buildFullScreenSettingsRoute({ view: "settings", surface: "full-screen" });
          if (route !== undefined) {
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenAchievementDetail={(gameId, achievementId) => {
          if (params.providerId !== undefined) {
            navigateToFullScreenAchievement(params.providerId, gameId, achievementId);
          }
        }}
      />
    </>
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
function DeckySteamFullScreenSession({
  providerId,
  onBack,
}: {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
}): JSX.Element {
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
    resetDeckySteamFullScreenSessionState();
    onBack();
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
            navigateToFullScreenAchievement(profileProviderId, gameId, achievementId);
          }}
          onOpenSettings={() => selectTab("settings")}
          onOpenCompletionProgress={(_profileProviderId, initialFilter) => openGames(initialFilter)}
          onOpenGameDetail={(profileProviderId, gameId) => {
            navigateToFullScreenGame(profileProviderId, gameId);
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
              navigateToFullScreenGame(providerId, gameId);
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
              navigateToFullScreenAchievement(providerId, gameId, achievementId);
            }
          }}
        />
      </div> : null}
      {visitedTabs.has("settings") ? <div style={{ display: activeTab === "settings" ? "contents" : "none" }}>
        <DeckyFullScreenSettingsPage
          isActive={activeTab === "settings"}
          onOpenProviderSettings={(providerId) => {
            navigateToFullScreenProviderSettings(providerId);
          }}
          onOpenExternalUrl={(url) => {
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
  const providerId = params.providerId;
  const returnFromProfile = (): void => {
    if (providerId === STEAM_PROVIDER_ID) {
      dispatchDeckyScrollReset("dashboard");
    }

    navigateBackFromFullScreenRoot("profile");
  };
  const terminalBackBridge = isDeckyCompactOriginFullScreenSessionRoot("profile")
    ? <DeckyFullScreenTerminalBackBridge onBack={returnFromProfile} />
    : null;

  if (providerId === STEAM_PROVIDER_ID) {
    return (
      <>
        {terminalBackBridge}
        <DeckySteamFullScreenSession providerId={providerId} onBack={returnFromProfile} />
      </>
    );
  }

  return (
    <>
      {terminalBackBridge}
      <DeckyFullScreenProfilePage
      providerId={providerId}
      onBack={returnFromProfile}
      onOpenAchievementHistory={(profileProviderId) => {
        DeckyNavigation.Navigate(
          buildDeckyFullScreenAchievementHistoryRoute(profileProviderId),
        );
      }}
      onOpenAchievementDetail={(profileProviderId, gameId, achievementId) => {
        navigateToFullScreenAchievement(profileProviderId, gameId, achievementId);
      }}
      onOpenSettings={() => {
        DeckyNavigation.Navigate(buildDeckyFullScreenSettingsRoute());
      }}
      onOpenCompletionProgress={(profileProviderId, initialFilter) => {
        markNextFullScreenCompletionProgressFilter(initialFilter);
        DeckyNavigation.Navigate(
          buildDeckyFullScreenCompletionProgressRoute(profileProviderId),
        );
      }}
      onOpenGameDetail={(profileProviderId, gameId) => {
        navigateToFullScreenGame(profileProviderId, gameId);
      }}
      />
    </>
  );
}

function DeckyFullScreenCompletionProgressRoute(): JSX.Element {
  const params = useParams<FullScreenCompletionProgressRouteParams>();
  const initialFilter = useMemo<CompletionProgressSelectionFilter | undefined>(
    () => consumeNextFullScreenCompletionProgressFilter(),
    [],
  );

  const returnFromCompletionProgress = (): void => {
    navigateBackFromFullScreenRoot("completion-progress");
  };

  return (
    <>
      {isDeckyCompactOriginFullScreenSessionRoot("completion-progress")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromCompletionProgress} />
        : null}
      <DeckyFullScreenCompletionProgressPage
        providerId={params.providerId}
        {...(initialFilter !== undefined ? { initialFilter } : {})}
        onBack={returnFromCompletionProgress}
        onOpenProfile={() => {
          if (params.providerId === undefined) {
            return;
          }

          const route = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenActivity={() => {
          if (params.providerId === undefined) {
            return;
          }

          const route = buildFullScreenAchievementHistoryRoute({
            view: "achievement-history",
            surface: "full-screen",
            providerId: params.providerId,
          });
          if (route !== undefined) {
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenGameDetail={(gameId) => {
          if (params.providerId !== undefined) {
            navigateToFullScreenGame(params.providerId, gameId);
          }
        }}
      />
    </>
  );
}

function DeckyFullScreenSettingsRoute(): JSX.Element {
  const returnFromSettings = (): void => {
    navigateBackFromFullScreenRoot("settings");
  };

  return (
    <>
      {isDeckyCompactOriginFullScreenSessionRoot("settings")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromSettings} />
        : null}
      <DeckyFullScreenSettingsPage
        onOpenProviderSettings={(providerId) => {
          navigateToFullScreenProviderSettings(providerId);
        }}
        onOpenExternalUrl={(url) => {
          DeckyNavigation.NavigateToExternalWeb(url);
        }}
      />
    </>
  );
}

function DeckyFullScreenProviderSettingsRoute(): JSX.Element {
  const params = useParams<FullScreenProviderSettingsRouteParams>();
  const providerId = params.providerId ?? "retroachievements";

  const returnToSettingsPage = (): void => {
    DeckyNavigation.NavigateBack();
  };

  return (
    <DeckyFullScreenProviderSettingsPage
      providerId={providerId}
      onBack={returnToSettingsPage}
    />
  );
}

const fullScreenRouteRegistration = createDeckyRouteRegistration(routerHook, [
  { path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.profile, component: DeckyFullScreenProfileRoute },
  { path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.game, component: DeckyFullScreenGameRoute },
  { path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.achievement, component: DeckyFullScreenAchievementRoute },
  {
    path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.achievementHistory,
    component: DeckyFullScreenAchievementHistoryRoute,
  },
  {
    path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.completionProgress,
    component: DeckyFullScreenCompletionProgressRoute,
  },
  { path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.settings, component: DeckyFullScreenSettingsRoute },
  {
    path: DECKY_FULL_SCREEN_ROUTE_PATTERNS.providerSettings,
    component: DeckyFullScreenProviderSettingsRoute,
  },
]);

export function registerDeckyFullScreenRoutes(): () => void {
  fullScreenRouteRegistration.register();
  return fullScreenRouteRegistration.unregister;
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
          // The prior route tree has fully unmounted by the time a new visit is
          // launched, so stale cleanup cannot repopulate these session stores.
          resetDeckySteamFullScreenSessionState();
          beginDeckySteamFullScreenRefreshSession(STEAM_PROVIDER_ID);
        }

        if (steamSessionTab !== undefined) {
          setSteamFullScreenSessionTab(steamSessionTab);
          const profileRoute = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: STEAM_PROVIDER_ID,
          });
          if (profileRoute !== undefined) {
            // Steam's compact tabs share the profile route/session. The
            // origin remains that root profile, not an in-session footer tab.
            beginDeckyCompactFullScreenEntry("profile");
            DeckyNavigation.Navigate(profileRoute);
            DeckyNavigation.CloseSideMenus();
          }
          return;
        }

        const completionProgressRoute = buildFullScreenCompletionProgressRoute(target);
        if (completionProgressRoute !== undefined) {
          const sessionRoot = getDeckyFullScreenSessionRoot(target);
          if (sessionRoot !== undefined) {
            beginDeckyCompactFullScreenEntry(sessionRoot);
          }
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
          const sessionRoot = getDeckyFullScreenSessionRoot(target);
          if (sessionRoot !== undefined) {
            beginDeckyCompactFullScreenEntry(sessionRoot);
          }
          DeckyNavigation.Navigate(achievementHistoryRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        const settingsRoute = buildFullScreenSettingsRoute(target);
        if (settingsRoute !== undefined) {
          const sessionRoot = getDeckyFullScreenSessionRoot(target);
          if (sessionRoot !== undefined) {
            beginDeckyCompactFullScreenEntry(sessionRoot);
          }
          DeckyNavigation.Navigate(settingsRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        const profileRoute = buildFullScreenProfileRoute(target);
        if (profileRoute !== undefined) {
          const sessionRoot = getDeckyFullScreenSessionRoot(target);
          if (sessionRoot !== undefined) {
            beginDeckyCompactFullScreenEntry(sessionRoot);
          }
          DeckyNavigation.Navigate(profileRoute);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        if (target.providerId !== undefined && target.gameId !== undefined) {
          const sessionRoot = getDeckyFullScreenSessionRoot(target);
          if (sessionRoot !== undefined) {
            beginDeckyCompactFullScreenEntry(sessionRoot);
          }
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
