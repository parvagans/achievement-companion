import { useSyncExternalStore } from "react";
import type { ProviderId } from "@core/domain";

/**
 * Active-plugin-session navigation for Decky's compact/QAM surface. It deliberately
 * stores destinations only. Loading and transient UI remain component-local;
 * achievement list focus/scroll checkpoints live in their separate keyed page
 * state store. A recreated compact React tree reads this destination store
 * rather than falling back to the provider chooser. Closing the active plugin
 * (not merely hiding QAM) ends the session and restores the provider chooser.
 */
export interface DeckyCompactProviderSetupDestination {
  readonly kind: "provider-setup";
  readonly providerId: ProviderId;
}

export interface DeckyCompactProviderDashboardDestination {
  readonly kind: "provider-dashboard";
  readonly providerId: ProviderId;
}

export interface DeckyCompactGameDestination {
  readonly kind: "game";
  readonly providerId: ProviderId;
  readonly gameId: string;
  /** Presentation metadata from the selected row; it is not a second state owner. */
  readonly gameTitle: string;
}

export interface DeckyCompactAchievementListDestination {
  readonly kind: "achievement-list";
  readonly providerId: ProviderId;
  readonly gameId: string;
  /** Presentation metadata from the selected game; it is not a second data owner. */
  readonly gameTitle: string;
  readonly parent: "game";
}

export interface DeckyCompactAchievementDestination {
  readonly kind: "achievement";
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly achievementId: string;
  readonly gameTitle: string;
  readonly parent: "provider-dashboard" | "game" | "achievement-list";
}

export interface DeckyCompactSettingsDestination {
  readonly kind: "settings";
  readonly providerId: ProviderId;
}

export type DeckyCompactNavigationDestination =
  | { readonly kind: "provider-chooser" }
  | DeckyCompactProviderSetupDestination
  | DeckyCompactProviderDashboardDestination
  | DeckyCompactGameDestination
  | DeckyCompactAchievementListDestination
  | DeckyCompactAchievementDestination
  | DeckyCompactSettingsDestination;

const providerChooser: DeckyCompactNavigationDestination = { kind: "provider-chooser" };
let compactNavigation: DeckyCompactNavigationDestination = providerChooser;
const compactNavigationListeners = new Set<() => void>();

function notifyCompactNavigationListeners(): void {
  for (const listener of compactNavigationListeners) {
    listener();
  }
}

export function readDeckyCompactNavigation(): DeckyCompactNavigationDestination {
  return compactNavigation;
}

export function setDeckyCompactNavigation(
  nextDestination: DeckyCompactNavigationDestination,
): void {
  compactNavigation = nextDestination;
  notifyCompactNavigationListeners();
}

export function resetDeckyCompactNavigation(): void {
  setDeckyCompactNavigation(providerChooser);
}

/** The compact store owns one destination, not a second history stack. */
export function getDeckyCompactParentDestination(
  destination: DeckyCompactNavigationDestination,
): DeckyCompactNavigationDestination | undefined {
  switch (destination.kind) {
    case "provider-chooser":
      return undefined;
    case "provider-setup":
    case "provider-dashboard":
      return providerChooser;
    case "settings":
    case "game":
      return { kind: "provider-dashboard", providerId: destination.providerId };
    case "achievement-list":
      return {
        kind: "game",
        providerId: destination.providerId,
        gameId: destination.gameId,
        gameTitle: destination.gameTitle,
      };
    case "achievement":
      if (destination.parent === "provider-dashboard") {
        return { kind: "provider-dashboard", providerId: destination.providerId };
      }
      if (destination.parent === "achievement-list") {
        return {
          kind: "achievement-list",
          providerId: destination.providerId,
          gameId: destination.gameId,
          gameTitle: destination.gameTitle,
          parent: "game",
        };
      }
      return {
        kind: "game",
        providerId: destination.providerId,
        gameId: destination.gameId,
        gameTitle: destination.gameTitle,
      };
  }
}

/** Ignore callbacks retained by a destination that has already been left. */
export function returnFromDeckyCompactDestination(
  destination: DeckyCompactNavigationDestination,
): void {
  if (compactNavigation !== destination) {
    return;
  }
  const parent = getDeckyCompactParentDestination(destination);
  if (parent !== undefined) {
    setDeckyCompactNavigation(parent);
  }
}

export function useDeckyCompactNavigation(): DeckyCompactNavigationDestination {
  return useSyncExternalStore(
    (listener) => {
      compactNavigationListeners.add(listener);
      return () => compactNavigationListeners.delete(listener);
    },
    readDeckyCompactNavigation,
    readDeckyCompactNavigation,
  );
}

/** Test-only lifecycle reset; production dismount should use resetDeckyCompactNavigation. */
export function resetDeckyCompactNavigationForTests(): void {
  compactNavigation = providerChooser;
  compactNavigationListeners.clear();
}
