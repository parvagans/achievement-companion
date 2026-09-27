import { useSyncExternalStore } from "react";
import type { ProviderId } from "@core/domain";

/**
 * Plugin-lifetime navigation for Decky's compact/QAM surface. It deliberately
 * stores destinations only; loading, focus, scroll, and transient UI remain
 * component-local. A recreated compact React tree reads this store rather
 * than falling back to the provider chooser.
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

export interface DeckyCompactAchievementDestination {
  readonly kind: "achievement";
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly achievementId: string;
  readonly gameTitle: string;
  readonly parent: "provider-dashboard" | "game";
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
