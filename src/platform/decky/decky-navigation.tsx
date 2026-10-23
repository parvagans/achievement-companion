import { routerHook } from "@decky/api";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { NavigationPort, NavigationTarget } from "@core/platform";
import {
  Navigation as DeckyNavigation,
  QuickAccessTab,
  useParams,
} from "@decky/ui";
import { DeckyFullScreenProfilePage } from "./decky-full-screen-profile-page";
import { openDeckyAchievementDetailModal } from "./decky-achievement-detail-modal";
import { DeckyFullScreenAchievementHistoryPage } from "./decky-full-screen-achievement-history-page";
import { DeckyFullScreenCompletionProgressPage } from "./decky-full-screen-completion-progress-page";
import { DeckyFullScreenGamePage } from "./decky-full-screen-game-page";
import { DeckyFullScreenSettingsPage } from "./decky-full-screen-settings-page";
import { DeckyFullScreenAboutPage } from "./decky-full-screen-about-page";
import { DeckyFullScreenProviderSettingsPage } from "./decky-full-screen-provider-settings-page";
import { DeckyRetroAchievementsProviderSettingsPage } from "./providers/retroachievements";
import {
  DeckyFullScreenFooterOverlay,
  RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
  useDeckyFullscreenOnScreenKeyboardLifecycle,
} from "./decky-full-screen-footer-overlay";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
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
import {
  beginDeckyProviderFullScreenDataSession,
  clearDeckyRetroAchievementsRelatedGameIndex,
  endDeckyProviderFullScreenDataSession,
  getDeckyProviderFullScreenDataSessionRevision,
  subscribeDeckyProviderFullScreenDataSession,
} from "./decky-app-services";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { resetDeckyActivityPageState } from "./decky-steam-full-screen-activity-state";
import { rememberDeckyGamesProfileShortcut, rememberDeckyGamesSystem, resetDeckyGamesPageState } from "./decky-steam-full-screen-games-state";
import { jumpDeckySteamProfileTabToTop } from "./decky-steam-profile-jump-top";
import { requestDeckySteamCompactFocusRestore } from "./decky-steam-compact-focus-state";
import {
  consumeNextFullScreenCompletionProgressFilter,
  markNextFullScreenCompletionProgressFilter,
} from "./decky-full-screen-navigation-state";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import {
  getAdjacentProviderFullScreenSessionTab,
  getProviderFullScreenSessionTabs,
  type ProviderFullScreenSessionTab,
} from "./decky-steam-full-screen-session-navigation";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { isDeckyProviderSettingsWebReturnPending } from "./decky-provider-settings-web-return";
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

type ProviderSettingsTab = "retroachievements" | "steam";
type ProviderSettingsFooterTab = ProviderSettingsTab | "about";
let nextFullScreenSettingsProvider: ProviderSettingsFooterTab = "retroachievements";
let restoreGeneralSettingsLinkProvider: ProviderSettingsTab | undefined;
let selectActiveFullScreenSettingsTab: ((tab: ProviderSettingsFooterTab) => void) | undefined;
const PROVIDER_SETTINGS_FOOTER_NAVIGATION_ITEMS = [
  { id: "retroachievements", label: "RetroAchievements" },
  { id: "steam", label: "Steam" },
  { id: "about", label: "General" },
] as const;

let activeProviderFullScreenSessionId: string | undefined;
let providerFullScreenSessionTab: ProviderFullScreenSessionTab = "profile";
const providerFullScreenSessionListeners = new Set<() => void>();

function resetDeckyProviderFullScreenSessionState(providerId: string): void {
  providerFullScreenSessionTab = "profile";
  resetDeckyActivityPageState(providerId);
  resetDeckyGamesPageState(providerId);
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

function setProviderFullScreenSessionTab(tab: ProviderFullScreenSessionTab): void {
  if (providerFullScreenSessionTab === tab) {
    return;
  }

  providerFullScreenSessionTab = tab;
  for (const listener of providerFullScreenSessionListeners) {
    listener();
  }
}

function subscribeToProviderFullScreenSession(listener: () => void): () => void {
  providerFullScreenSessionListeners.add(listener);
  return () => providerFullScreenSessionListeners.delete(listener);
}

function getProviderSessionTabForNavigationTarget(target: NavigationTarget): ProviderFullScreenSessionTab | undefined {
  if (
    target.surface !== "full-screen" ||
    (target.providerId !== STEAM_PROVIDER_ID && target.providerId !== RETROACHIEVEMENTS_PROVIDER_ID)
  ) {
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
      return target.providerId === STEAM_PROVIDER_ID || target.providerId === RETROACHIEVEMENTS_PROVIDER_ID
        ? "settings"
        : undefined;
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

/** Missing-account provider cards enter the shared settings route on their own tab. */
export function openDeckyProviderSettingsFromQam(providerId: ProviderSettingsTab): void {
  nextFullScreenSettingsProvider = providerId;
  beginDeckyCompactFullScreenEntry("settings");
  DeckyNavigation.Navigate(buildDeckyFullScreenSettingsRoute());
  DeckyNavigation.CloseSideMenus();
}

/** Update notifications enter the shared settings route on its General tab. */
export function openDeckyUpdatesFromNotification(): void {
  if (selectActiveFullScreenSettingsTab !== undefined) {
    selectActiveFullScreenSettingsTab("about");
    return;
  }
  nextFullScreenSettingsProvider = "about";
  DeckyNavigation.Navigate(buildDeckyFullScreenSettingsRoute());
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
  openDeckyAchievementDetailModal({ providerId, gameId, achievementId });
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

function DeckyFullScreenGameRouteContent({ providerId, gameId }: { readonly providerId: string | undefined; readonly gameId: string | undefined }): JSX.Element {
  const detailScrollKey =
    providerId !== undefined && gameId !== undefined
      ? `game-detail:${providerId}:${gameId}`
      : undefined;

  const returnFromGamePage = (): void => {
    if (providerId !== undefined && gameId !== undefined) {
      resetSteamGameSectionActiveSection(providerId, gameId);
    }

    if (detailScrollKey !== undefined) {
      dispatchDeckyScrollReset(detailScrollKey);
    }

    navigateBackFromFullScreenRoot("game");
  };

  return (
    <>
      <DeckyFocusStyles />
      {isDeckyCompactOriginFullScreenSessionRoot("game")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromGamePage} />
        : null}
      <DeckyFullScreenGamePage
        gameId={gameId}
        onOpenAchievementDetail={
          providerId !== undefined && gameId !== undefined
            ? (achievementId, achievementGameId = gameId) => {
                navigateToFullScreenAchievement(
                  providerId,
                  achievementGameId,
                  achievementId,
                );
              }
            : undefined
        }
        onBack={returnFromGamePage}
        providerId={providerId}
      />
    </>
  );
}

function DeckyFullScreenGameRoute(): JSX.Element {
  const params = useParams<FullScreenGameRouteParams>();
  return <DeckyFullScreenGameRouteContent providerId={params.providerId} gameId={params.gameId} />;
}

const legacyAchievementRoutesToSkip = new Set<string>();

function DeckyFullScreenAchievementRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementRouteParams>();
  const openedRouteRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (params.providerId === undefined || params.gameId === undefined || params.achievementId === undefined) {
      return;
    }

    const route = buildDeckyFullScreenAchievementRoute(params.providerId, params.gameId, params.achievementId);
    if (legacyAchievementRoutesToSkip.delete(route)) {
      DeckyNavigation.NavigateBack();
      return;
    }
    if (openedRouteRef.current === route) {
      return;
    }
    openedRouteRef.current = route;
    let active = true;
    openDeckyAchievementDetailModal({
      providerId: params.providerId,
      gameId: params.gameId,
      achievementId: params.achievementId,
      onClose: () => {
        if (!active) return;
        // Direct links have no mounted source. Keep the associated game as their
        // return page; a later Back skips this legacy URL in native history.
        legacyAchievementRoutesToSkip.add(route);
        DeckyNavigation.Navigate(buildDeckyFullScreenGameRoute(params.providerId!, params.gameId!));
      },
    });
    return () => { active = false; };
  }, [params.achievementId, params.gameId, params.providerId]);

  return <DeckyFullScreenGameRouteContent providerId={params.providerId} gameId={params.gameId} />;
}

function DeckyFullScreenAchievementHistoryRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementHistoryRouteParams>();
  const returnFromAchievementHistory = (): void => {
    navigateBackFromFullScreenRoot("achievement-history");
  };

  return (
    <>
      <DeckyFocusStyles />
      {isDeckyCompactOriginFullScreenSessionRoot("achievement-history")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromAchievementHistory} />
        : null}
      <DeckyFullScreenAchievementHistoryPage
        providerId={params.providerId}
        onBack={returnFromAchievementHistory}
        onOpenProfile={() => {
          if (params.providerId !== undefined) DeckyNavigation.Navigate(buildDeckyFullScreenProfileRoute(params.providerId));
        }}
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
          nextFullScreenSettingsProvider = params.providerId === RETROACHIEVEMENTS_PROVIDER_ID
            ? "retroachievements"
            : "steam";
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
 * A provider's Profile, Games, Activity, provider-specific tabs, and Settings are views within one
 * full-screen visit, not entries in the Decky route history. The session shell
 * stays mounted so a single Back press leaves the visit, while only the active
 * tab's GamepadUI tree is rendered. Game and achievement details still use real
 * routes above this session so their Back semantics remain hierarchical.
 */
function DeckyProviderFullScreenSession({
  providerId,
  onBack,
}: {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
}): JSX.Element {
  const providerTabs = getProviderFullScreenSessionTabs(providerId);
  const [activeTab, setActiveTab] = useState<ProviderFullScreenSessionTab>(() =>
    providerTabs.includes(providerFullScreenSessionTab) ? providerFullScreenSessionTab : "profile"
  );
  const restoringRaAccountFromWeb = isDeckyProviderSettingsWebReturnPending("retroachievements");
  const [gamesViewRevision, setGamesViewRevision] = useState(0);
  const retroAchievementsSettingsRootRef = useRef<HTMLDivElement>(null);
  const steamSettingsRootRef = useRef<HTMLDivElement>(null);
  const dataSessionRevision = useSyncExternalStore(
    subscribeDeckyProviderFullScreenDataSession,
    getDeckyProviderFullScreenDataSessionRevision,
    getDeckyProviderFullScreenDataSessionRevision,
  );

  useEffect(() => {
    activeProviderFullScreenSessionId = providerId;
    const unsubscribe = subscribeToProviderFullScreenSession(() => {
      setActiveTab(providerTabs.includes(providerFullScreenSessionTab) ? providerFullScreenSessionTab : "profile");
    });

    return () => {
      unsubscribe();
      if (activeProviderFullScreenSessionId === providerId) {
        activeProviderFullScreenSessionId = undefined;
      }
    };
  }, [providerId]);

  useLayoutEffect(() => {
    if (activeTab !== "settings" || providerId !== RETROACHIEVEMENTS_PROVIDER_ID || restoringRaAccountFromWeb) {
      return;
    }

    const root = retroAchievementsSettingsRootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    const frame = ownerWindow.requestAnimationFrame(() => {
      const firstControl = root.querySelector<HTMLElement>("input") ?? root.querySelector<HTMLElement>(".ac-settings-action[tabindex='0'], .Panel.Focusable[role='button']");
      takeDeckySteamGamepadFocus(firstControl);
    });

    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [activeTab, providerId, restoringRaAccountFromWeb]);

  useLayoutEffect(() => {
    if (activeTab !== "settings" || restoreGeneralSettingsLinkProvider !== providerId) return;
    const root = providerId === RETROACHIEVEMENTS_PROVIDER_ID
      ? retroAchievementsSettingsRootRef.current
      : steamSettingsRootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const link = root.querySelector<HTMLElement>("[data-settings-general-link='true']");
      if (takeDeckySteamGamepadFocus(link)) restoreGeneralSettingsLinkProvider = undefined;
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [activeTab, providerId]);

  const selectTab = (tab: ProviderFullScreenSessionTab): void => {
    if (!providerTabs.includes(tab)) return;
    setProviderFullScreenSessionTab(tab);
    setActiveTab(tab);
  };

  const openGames = (initialFilter?: CompletionProgressSelectionFilter): void => {
    if (initialFilter !== undefined && providerId !== undefined) {
      // Apply Profile shortcuts once to the saved Games state. Later visits
      // restore the user's current search, status, sort, system and scroll.
      rememberDeckyGamesProfileShortcut(providerId, initialFilter === "subsets" ? "all" : initialFilter);
      setGamesViewRevision((currentRevision) => currentRevision + 1);
    }
    selectTab("games");
  };

  const openSystemGames = (system: { readonly systemId: string; readonly title: string }): void => {
    if (providerId !== RETROACHIEVEMENTS_PROVIDER_ID) return;
    rememberDeckyGamesSystem(providerId, system);
    setGamesViewRevision((currentRevision) => currentRevision + 1);
    selectTab("games");
  };

  const exitSession = (): void => {
    restoreGeneralSettingsLinkProvider = undefined;
    if (providerId !== undefined) {
      endDeckyProviderFullScreenDataSession(providerId);
      resetDeckyProviderFullScreenSessionState(providerId);
    }
    onBack();
  };

  const openGeneralSettings = (): void => {
    if (providerId !== STEAM_PROVIDER_ID && providerId !== RETROACHIEVEMENTS_PROVIDER_ID) return;
    restoreGeneralSettingsLinkProvider = providerId;
    nextFullScreenSettingsProvider = "about";
    DeckyNavigation.Navigate(buildDeckyFullScreenSettingsRoute());
  };

  return (
    <>
      <DeckyFocusStyles />
      {activeTab === "profile" ?
        <DeckyFullScreenProfilePage
          key={`${providerId ?? "missing"}-profile-${dataSessionRevision}`}
          providerId={providerId}
          isActive={activeTab === "profile"}
          showSteamProfileFooter={false}
          onBack={exitSession}
          onOpenAchievementHistory={() => selectTab("activity")}
          onOpenAchievementDetail={(profileProviderId, gameId, achievementId) => {
            navigateToFullScreenAchievement(profileProviderId, gameId, achievementId);
          }}
          onOpenSettings={() => {
            if (providerId === STEAM_PROVIDER_ID || providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
              selectTab("settings");
            }
          }}
          onOpenExternalUrl={(url) => {
            nextFullScreenSettingsProvider = "steam";
            DeckyNavigation.NavigateToExternalWeb(url);
          }}
          onOpenCompletionProgress={(_profileProviderId, initialFilter) => openGames(initialFilter)}
          onOpenSystem={openSystemGames}
          onOpenGameDetail={(profileProviderId, gameId) => {
            navigateToFullScreenGame(profileProviderId, gameId);
          }}
        />
      : null}
      {activeTab === "games" ?
        <DeckyFullScreenCompletionProgressPage
          key={`${providerId ?? "missing"}-games-${gamesViewRevision}-${dataSessionRevision}`}
          providerId={providerId}
          isActive={activeTab === "games"}
          showSteamProfileFooter={false}
          onBack={exitSession}
          onOpenProfile={() => selectTab("profile")}
          onOpenActivity={() => selectTab("activity")}
          onOpenGameDetail={(gameId) => {
            if (providerId !== undefined) {
              navigateToFullScreenGame(providerId, gameId);
            }
          }}
        />
      : null}
      {activeTab === "activity" ?
        <DeckyFullScreenAchievementHistoryPage
          key={`${providerId ?? "missing"}-activity-${dataSessionRevision}`}
          providerId={providerId}
          isActive={activeTab === "activity"}
          showSteamProfileFooter={false}
          onBack={exitSession}
          onOpenGames={() => openGames()}
          onOpenProfile={() => selectTab("profile")}
          onOpenSettings={() => selectTab("settings")}
          onOpenAchievementDetail={(gameId, achievementId) => {
            if (providerId !== undefined) {
              navigateToFullScreenAchievement(providerId, gameId, achievementId);
            }
          }}
        />
      : null}
      {activeTab === "settings" && providerId === STEAM_PROVIDER_ID ?
        <div ref={steamSettingsRootRef}>
        <DeckyFullScreenSettingsPage
          isActive={activeTab === "settings"}
          reserveSteamProfileFooter
          onOpenGeneralSettings={openGeneralSettings}
          onOpenProviderSettings={(providerId) => {
            navigateToFullScreenProviderSettings(providerId);
          }}
          onOpenExternalUrl={(url) => {
            DeckyNavigation.NavigateToExternalWeb(url);
          }}
          onOpenActivity={() => selectTab("activity")}
          onOpenProfile={() => selectTab("profile")}
        />
        </div>
      : null}
      {activeTab === "settings" && providerId === RETROACHIEVEMENTS_PROVIDER_ID ?
        <div ref={retroAchievementsSettingsRootRef} data-provider-settings-retroachievements="true">
          <DeckyRetroAchievementsProviderSettingsPage
            providerId={RETROACHIEVEMENTS_PROVIDER_ID}
            onBack={exitSession}
            inProviderSwitcher
            onRebuildSubsetIndex={clearDeckyRetroAchievementsRelatedGameIndex}
            onOpenGeneralSettings={openGeneralSettings}
            onOpenExternalUrl={(url) => { nextFullScreenSettingsProvider = "retroachievements"; DeckyNavigation.NavigateToExternalWeb(url); }}
          />
        </div>
      : null}
      <DeckyFullScreenFooterOverlay
        activeNavigationItemId={activeTab}
        ariaLabel={`${providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "RetroAchievements" : "Steam"} profile navigation`}
        navigationItems={providerId === RETROACHIEVEMENTS_PROVIDER_ID
          ? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS
          : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        {...(activeTab === "games" || activeTab === "activity"
          ? {
              secondaryActionLabel: "Top",
              onSecondaryAction: (document: Document) => { jumpDeckySteamProfileTabToTop(document, activeTab); },
            }
          : {})}
        onPreviousNavigationItem={() => {
          selectTab(getAdjacentProviderFullScreenSessionTab(providerTabs, activeTab, "previous"));
        }}
        onNextNavigationItem={() => {
          const nextTab = getAdjacentProviderFullScreenSessionTab(providerTabs, activeTab, "next");
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

  if (providerId === STEAM_PROVIDER_ID || providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return (
      <>
        {terminalBackBridge}
        <DeckyProviderFullScreenSession providerId={providerId} onBack={returnFromProfile} />
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
        nextFullScreenSettingsProvider = providerId === "retroachievements"
          ? "retroachievements"
          : "steam";
        DeckyNavigation.Navigate(buildDeckyFullScreenSettingsRoute());
      }}
      onOpenExternalUrl={(url) => {
        DeckyNavigation.NavigateToExternalWeb(url);
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
      <DeckyFocusStyles />
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
  const [activeProvider, setActiveProvider] = useState<ProviderSettingsFooterTab>(() => {
    const initialProvider = nextFullScreenSettingsProvider;
    nextFullScreenSettingsProvider = "retroachievements";
    return initialProvider;
  });
  const restoringRaAccountFromWeb = isDeckyProviderSettingsWebReturnPending("retroachievements");
  const selectFooterTab = (tab: ProviderSettingsFooterTab): void => setActiveProvider(tab);
  const keyboardAnchorRef = useRef<HTMLSpanElement>(null);
  const retroAchievementsRootRef = useRef<HTMLDivElement>(null);
  useDeckyFullscreenOnScreenKeyboardLifecycle(keyboardAnchorRef);
  useEffect(() => {
    selectActiveFullScreenSettingsTab = selectFooterTab;
    return () => {
      if (selectActiveFullScreenSettingsTab === selectFooterTab) {
        selectActiveFullScreenSettingsTab = undefined;
      }
    };
  }, []);
  useLayoutEffect(() => {
    if (activeProvider !== "retroachievements" || restoringRaAccountFromWeb) return;
    const root = retroAchievementsRootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const firstControl = root.querySelector<HTMLElement>("input") ?? root.querySelector<HTMLElement>(".ac-settings-action[tabindex='0'], .Panel.Focusable[role='button']");
      takeDeckySteamGamepadFocus(firstControl);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [activeProvider, restoringRaAccountFromWeb]);
  const returnFromSettings = (): void => {
    navigateBackFromFullScreenRoot("settings");
  };

  return (
    <>
      {isDeckyCompactOriginFullScreenSessionRoot("settings")
        ? <DeckyFullScreenTerminalBackBridge onBack={returnFromSettings} />
        : null}
      <span ref={keyboardAnchorRef} hidden aria-hidden="true" />
      {activeProvider === "about" ? <DeckyFullScreenAboutPage onOpenExternalUrl={(url) => {
        nextFullScreenSettingsProvider = "about";
        DeckyNavigation.NavigateToExternalWeb(url);
      }} />
      : activeProvider === "steam" ? <DeckyFullScreenSettingsPage
        reserveSteamProfileFooter
        onOpenProviderSettings={(providerId) => {
          navigateToFullScreenProviderSettings(providerId);
        }}
        onOpenExternalUrl={(url) => {
          nextFullScreenSettingsProvider = "steam";
          DeckyNavigation.NavigateToExternalWeb(url);
        }}
        /> : <div ref={retroAchievementsRootRef} data-provider-settings-retroachievements="true"><DeckyRetroAchievementsProviderSettingsPage providerId="retroachievements" onBack={returnFromSettings} inProviderSwitcher onRebuildSubsetIndex={clearDeckyRetroAchievementsRelatedGameIndex} onOpenExternalUrl={(url) => { nextFullScreenSettingsProvider = "retroachievements"; DeckyNavigation.NavigateToExternalWeb(url); }} /></div>}
      <DeckyFullScreenFooterOverlay
        ariaLabel="Provider settings navigation"
        activeNavigationItemId={activeProvider}
        navigationItems={PROVIDER_SETTINGS_FOOTER_NAVIGATION_ITEMS}
        onPreviousNavigationItem={() => selectFooterTab(activeProvider === "retroachievements" ? "about" : activeProvider === "steam" ? "retroachievements" : "steam")}
        onNextNavigationItem={() => selectFooterTab(activeProvider === "retroachievements" ? "steam" : activeProvider === "steam" ? "about" : "retroachievements")}
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

export function closeDeckyFullScreenSettingsOnDismount(): void {
  const settingsPath = buildDeckyFullScreenSettingsRoute();
  const currentPath = window.location.pathname;
  if (currentPath === settingsPath || currentPath === `/routes${settingsPath}`) {
    DeckyNavigation.NavigateBack();
  }
}

export function createDeckyNavigationPort(): NavigationPort {
  return {
    go(target) {
      if (target.surface === "full-screen") {
        if (buildFullScreenAchievementRoute(target) !== undefined) {
          // An achievement opened from QAM keeps that panel as its modal backdrop.
          navigateToFullScreenAchievement(target.providerId!, target.gameId!, target.achievementId!);
          return;
        }

        const providerSessionTab = getProviderSessionTabForNavigationTarget(target);
        if (
          providerSessionTab !== undefined &&
          target.providerId !== undefined &&
          activeProviderFullScreenSessionId === target.providerId
        ) {
          // Compact-panel Profile actions must reveal the existing visit rather
          // than push another full-screen route or restart its refresh session.
          setProviderFullScreenSessionTab(providerSessionTab);
          DeckyNavigation.CloseSideMenus();
          return;
        }

        if (target.providerId === STEAM_PROVIDER_ID || target.providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
          // The prior route tree has fully unmounted by the time a new visit is
          // launched, so stale cleanup cannot repopulate these session stores.
          resetDeckyProviderFullScreenSessionState(target.providerId);
          beginDeckyProviderFullScreenDataSession(target.providerId);
        }

        if (providerSessionTab !== undefined && target.providerId !== undefined) {
          setProviderFullScreenSessionTab(providerSessionTab);
          const profileRoute = buildFullScreenProfileRoute({
            view: "profile",
            surface: "full-screen",
            providerId: target.providerId,
          });
          if (profileRoute !== undefined) {
            // Provider compact tabs share the profile route/session. The
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
          nextFullScreenSettingsProvider = target.providerId === STEAM_PROVIDER_ID
            ? "steam"
            : "retroachievements";
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
