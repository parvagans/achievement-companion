import * as React from "react";
import { loadLocalComponent } from "./render-decky-component";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export function pinnedModalHarness({ pins = [], accounts = { steam: "current", retroachievements: "ra" }, metadata = {}, sourcePath, focusedAction = false }: { pins?: any[]; accounts?: Record<string, string | undefined>; metadata?: Record<string, unknown>; sourcePath?: string; focusedAction?: boolean } = {}) {
  const opened: any[] = [], details: any[] = [], removed: any[] = [];
  const focusedTargets: unknown[] = [];
  let booleanState = 0;
  const popup = createRequire(resolve("src/platform/decky/decky-pinned-achievements-modal.tsx"))("./decky-compact-popup-state");
  const navigation = createRequire(resolve("src/platform/decky/decky-pinned-achievements-modal.tsx"))("./decky-compact-navigation");
  const standard = loadLocalComponent("src/platform/decky/decky-standard-modal.tsx", {
    "./decky-steam-gamepad-focus": { takeDeckySteamGamepadFocus: () => true },
  }).exports;
  const loaded = loadLocalComponent("src/platform/decky/decky-pinned-achievements-modal.tsx", {
    react: { ...React, useLayoutEffect: () => {}, useState: (initial: unknown) => React.useState(typeof initial === "object" && initial !== null && !Array.isArray(initial) ? metadata : typeof initial === "boolean" && focusedAction && booleanState++ === 0 ? true : initial) },
    "./decky-game-overview-preferences": { useSavedPinnedAchievements: () => ({ pins, accounts }), unpinAchievement: (...args: unknown[]) => { removed.push(args); return true; } },
    "./decky-app-services": { loadDeckyGameDetailState: () => { throw Error("Unexpected request while rendering"); } },
    "./decky-standard-modal": { ...standard, openDeckyStandardModal: (args: unknown) => opened.push(args) },
    "./decky-achievement-detail-modal": { openDeckyAchievementDetailModal: (args: unknown) => details.push(args) },
    "./decky-steam-gamepad-focus": { requestDeckySteamGamepadFocusAfterMount: () => () => {}, takeDeckySteamGamepadFocus: (target: unknown) => { focusedTargets.push(target); return true; } },
    "./providers/provider-config-store": { readDeckyProviderConfigs: () => ({ steam: { steamId64: accounts.steam }, retroAchievements: { username: accounts.retroachievements } }) },
  }, sourcePath);
  return { ...loaded, opened, details, removed, popup, navigation, focusedTargets };
}
