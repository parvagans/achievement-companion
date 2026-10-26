import type { ProviderId } from "@core/domain";
import { findDeckyScrollableAncestor } from "./decky-scroll-viewport";

export type DeckyCompactGameOverviewFocusTarget =
  | { readonly kind: "achievements" }
  | { readonly kind: "actions" }
  | { readonly kind: "recommendation"; readonly achievementId: string; readonly index: number }
  | { readonly kind: "expand" }
  | { readonly kind: "recommendation-options" };

export interface DeckyCompactGameOverviewState {
  readonly expanded: boolean;
  readonly focusTarget?: DeckyCompactGameOverviewFocusTarget;
  readonly scrollTop?: number;
}

const stateByGame = new Map<string, DeckyCompactGameOverviewState>();

function stateKey(providerId: ProviderId, gameId: string): string {
  return JSON.stringify([providerId, gameId]);
}

export function readDeckyCompactGameOverviewState(
  providerId: ProviderId,
  gameId: string,
): DeckyCompactGameOverviewState {
  return stateByGame.get(stateKey(providerId, gameId)) ?? { expanded: false };
}

export function writeDeckyCompactGameOverviewState(
  providerId: ProviderId,
  gameId: string,
  patch: Partial<DeckyCompactGameOverviewState>,
): DeckyCompactGameOverviewState {
  const current = readDeckyCompactGameOverviewState(providerId, gameId);
  const next = { ...current, ...patch };
  stateByGame.set(stateKey(providerId, gameId), next);
  return next;
}

export function checkpointDeckyCompactGameOverview(
  providerId: ProviderId,
  gameId: string,
  focusTarget: DeckyCompactGameOverviewFocusTarget,
  element: HTMLElement,
): DeckyCompactGameOverviewState {
  const scrollTop = findDeckyScrollableAncestor(element)?.scrollTop;
  return writeDeckyCompactGameOverviewState(providerId, gameId, {
    focusTarget,
    ...(scrollTop !== undefined ? { scrollTop } : {}),
  });
}

export function resetDeckyCompactGameOverviewState(): void {
  stateByGame.clear();
}
