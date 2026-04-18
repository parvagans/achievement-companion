import { routerHook } from "@decky/api";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
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
import { dispatchDeckyScrollReset } from "./decky-scroll-viewport";
import { DeckyFullScreenProviderSettingsPage } from "./providers/retroachievements/provider-settings-page";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";

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

let isFullScreenGameRouteRegistered = false;
let isFullScreenAchievementRouteRegistered = false;
let isFullScreenAchievementHistoryRouteRegistered = false;
let isFullScreenProfileRouteRegistered = false;
let isFullScreenCompletionProgressRouteRegistered = false;
let isFullScreenSettingsRouteRegistered = false;
let isFullScreenProviderSettingsRouteRegistered = false;

type FullScreenGameRouteBackBehavior = "decky-panel" | "completion-progress";
type FullScreenAchievementRouteBackBehavior = "game" | "achievement-history";
let nextFullScreenGameRouteBackBehavior: FullScreenGameRouteBackBehavior = "decky-panel";
let nextFullScreenAchievementRouteBackBehavior: FullScreenAchievementRouteBackBehavior = "game";
let shouldSuppressNextFullscreenRouteUnmountAction = false;

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
  markNextFullScreenGameRouteBackBehavior(backBehavior);

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

function markNextFullScreenGameRouteBackBehavior(
  behavior: FullScreenGameRouteBackBehavior,
): void {
  nextFullScreenGameRouteBackBehavior = behavior;
}

function consumeNextFullScreenGameRouteBackBehavior(): FullScreenGameRouteBackBehavior {
  const behavior = nextFullScreenGameRouteBackBehavior;
  nextFullScreenGameRouteBackBehavior = "decky-panel";
  return behavior;
}

function markNextFullScreenAchievementRouteBackBehavior(
  behavior: FullScreenAchievementRouteBackBehavior,
): void {
  nextFullScreenAchievementRouteBackBehavior = behavior;
}

function consumeNextFullScreenAchievementRouteBackBehavior(): FullScreenAchievementRouteBackBehavior {
  const behavior = nextFullScreenAchievementRouteBackBehavior;
  nextFullScreenAchievementRouteBackBehavior = "game";
  return behavior;
}

function suppressNextFullscreenRouteUnmountAction(): void {
  shouldSuppressNextFullscreenRouteUnmountAction = true;
}

function consumeNextFullscreenRouteUnmountActionSuppression(): boolean {
  const shouldSuppress = shouldSuppressNextFullscreenRouteUnmountAction;
  shouldSuppressNextFullscreenRouteUnmountAction = false;
  return shouldSuppress;
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
  backBehavior: FullScreenAchievementRouteBackBehavior = "game",
  suppressCurrentRouteUnmount = false,
): void {
  if (suppressCurrentRouteUnmount) {
    suppressNextFullscreenRouteUnmountAction();
  }

  registerFullScreenAchievementRoute();
  markNextFullScreenAchievementRouteBackBehavior(backBehavior);

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
  const shouldReturnToCompletionProgress = useMemo(
    () => consumeNextFullScreenGameRouteBackBehavior() === "completion-progress",
    [],
  );
  const shouldReturnToDeckyPanel = !shouldReturnToCompletionProgress;
  const detailScrollKey =
    params.providerId !== undefined && params.gameId !== undefined
      ? `game-detail:${params.providerId}:${params.gameId}`
      : undefined;

  const returnToDeckyPanel = (): void => {
    if (shouldReturnToCompletionProgress) {
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
                  "game",
                  shouldReturnToDeckyPanel,
                );
              }
            : undefined
        }
        onBack={() => {
          if (shouldReturnToDeckyPanel) {
            suppressNextFullscreenRouteUnmountAction();
          }

          returnToDeckyPanel();
        }}
        {...(shouldReturnToCompletionProgress
          ? {
              backLabel: "Back",
              backDescription: "Return to the full-screen completion progress page.",
              backFooter: "Use Back to return to the full-screen completion progress page.",
            }
          : {})}
        providerId={params.providerId}
      />
  );

  if (!shouldReturnToDeckyPanel) {
    return content;
  }

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToDeckyPanel}>
      {content}
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenAchievementRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementRouteParams>();
  const shouldReturnToAchievementHistory = useMemo(
    () => consumeNextFullScreenAchievementRouteBackBehavior() === "achievement-history",
    [],
  );

  const returnToGamePage = (): void => {
    DeckyNavigation.NavigateBack();
  };

  return (
      <DeckyFullScreenAchievementPage
        achievementId={params.achievementId}
        {...(shouldReturnToAchievementHistory
          ? {
              backLabel: "Back",
              backDescription: "Return to the full-screen achievement history page.",
            }
          : {})}
        gameId={params.gameId}
        onBack={returnToGamePage}
        providerId={params.providerId}
      />
  );
}

function DeckyFullScreenAchievementHistoryRoute(): JSX.Element {
  const params = useParams<FullScreenAchievementHistoryRouteParams>();

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToDeckyPanel}>
      <DeckyFullScreenAchievementHistoryPage
        providerId={params.providerId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToDeckyPanel();
        }}
        onOpenAchievementDetail={(gameId, achievementId) => {
          if (params.providerId !== undefined) {
            navigateToFullScreenAchievement(params.providerId, gameId, achievementId, "achievement-history", true);
          }
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenProfileRoute(): JSX.Element {
  const params = useParams<FullScreenProfileRouteParams>();

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToDeckyPanel}>
      <DeckyFullScreenProfilePage
        providerId={params.providerId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToDeckyPanel();
        }}
        onOpenAchievementHistory={(providerId) => {
          registerFullScreenAchievementHistoryRoute();
          const route = buildFullScreenAchievementHistoryRoute({
            view: "achievement-history",
            surface: "full-screen",
            providerId,
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenSettings={() => {
          registerFullScreenSettingsRoute();
          const route = buildFullScreenSettingsRoute({
            view: "settings",
            surface: "full-screen",
          });
          if (route !== undefined) {
            suppressNextFullscreenRouteUnmountAction();
            DeckyNavigation.Navigate(route);
          }
        }}
        onOpenCompletionProgress={(providerId) => {
          registerFullScreenCompletionProgressRoute();
          const route = buildFullScreenCompletionProgressRoute({
            view: "completion-progress",
            surface: "full-screen",
            providerId,
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

function DeckyFullScreenCompletionProgressRoute(): JSX.Element {
  const params = useParams<FullScreenCompletionProgressRouteParams>();

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToDeckyPanel}>
      <DeckyFullScreenCompletionProgressPage
        providerId={params.providerId}
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToDeckyPanel();
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
  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToDeckyPanel}>
      <DeckyFullScreenSettingsPage
        onBack={() => {
          suppressNextFullscreenRouteUnmountAction();
          returnToDeckyPanel();
        }}
        onOpenProviderSettings={(providerId) => {
          navigateToFullScreenProviderSettings(providerId);
        }}
      />
    </DeckyFullscreenRouteLeaveBoundary>
  );
}

function DeckyFullScreenProviderSettingsRoute(): JSX.Element {
  const params = useParams<FullScreenProviderSettingsRouteParams>();
  const providerId = params.providerId ?? RETROACHIEVEMENTS_PROVIDER_ID;

  const returnToSettingsPage = (): void => {
    DeckyNavigation.NavigateBack();
  };

  return (
    <DeckyFullscreenRouteLeaveBoundary onUnmount={returnToSettingsPage}>
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
