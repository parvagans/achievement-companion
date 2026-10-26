import { Focusable } from "@decky/ui";
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { DeckyOverviewMenuButton } from "./decky-full-screen-game-overview-content";
import { DeckySteamCompactAction } from "./decky-steam-compact-profile";
import {
  checkpointDeckyCompactGameOverview,
  readDeckyCompactGameOverviewState,
  type DeckyCompactGameOverviewFocusTarget,
} from "./decky-compact-game-overview-state";
import {
  readDeckyCompactFocusRestoreRequest,
  requestDeckyCompactFocusRestore,
  subscribeToDeckyCompactFocusRestore,
} from "./decky-compact-focus-restore";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";
import trophyIconUrl from "./assets/trophy-filled.svg";

export function DeckyCompactGameOverviewActions({
  providerId,
  gameId,
  onCancel,
  onOpenAchievements,
  onOpenFullScreen,
  onOpenGameInfo,
}: {
  readonly providerId: string;
  readonly gameId: string;
  readonly onCancel: () => void;
  readonly onOpenAchievements: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onOpenGameInfo: (onClose: () => void) => void;
}): JSX.Element {
  const achievementsRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const restoreRequest = useSyncExternalStore(
    subscribeToDeckyCompactFocusRestore,
    readDeckyCompactFocusRestoreRequest,
    readDeckyCompactFocusRestoreRequest,
  );

  const checkpoint = (target: DeckyCompactGameOverviewFocusTarget, element: HTMLElement): void => {
    checkpointDeckyCompactGameOverview(providerId, gameId, target, element);
  };

  useLayoutEffect(() => {
    const saved = readDeckyCompactGameOverviewState(providerId, gameId).focusTarget;
    const target = saved?.kind === "actions"
      ? actionsRef.current
      : saved?.kind === "achievements" || saved === undefined
        ? achievementsRef.current
        : null;
    if (target !== null) requestDeckySteamGamepadFocusAfterMount(target);
  }, [gameId, providerId, restoreRequest]);

  const restoreActionsFocus = (): void => {
    requestDeckyCompactFocusRestore();
  };
  const menuItems = [
    { key: "game-info", label: "Game Info", onSelect: () => onOpenGameInfo(restoreActionsFocus) },
    ...(onOpenFullScreen === undefined
      ? []
      : [{ key: "open-full-screen", label: "Open Full-Screen", onSelect: onOpenFullScreen }]),
  ];
  const label: ReactNode = <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Actions <span aria-hidden="true">▾</span></span>;

  return <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(104px, auto)", gap: 7, width: "100%", minWidth: 0 }}>
    <DeckySteamCompactAction
      ariaLabel="View game achievements"
      elementRef={(node) => { achievementsRef.current = node; }}
      onActivate={onOpenAchievements}
      onActivated={(element) => checkpoint({ kind: "achievements" }, element)}
      onCancel={onCancel}
      onFocused={(element) => checkpoint({ kind: "achievements" }, element)}
      preferredFocus={readDeckyCompactGameOverviewState(providerId, gameId).focusTarget === undefined}
      scrollToTopOnFocus
      style={{ minHeight: 38, padding: "0 12px" }}
      tone="primary"
    >
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", color: theme.color.textPrimary, fontSize: 11, fontWeight: 800 }}>
        <img alt="" aria-hidden="true" src={trophyIconUrl} style={{ width: 15, height: 15, filter: theme.decorative.iconFilter }} />
        Achievements
      </span>
    </DeckySteamCompactAction>
    <DeckyOverviewMenuButton
      compact
      displayLabel={label}
      elementRef={(node) => { actionsRef.current = node; }}
      items={menuItems}
      label="Game Actions"
      minHeight={38}
      onActivated={(element) => checkpoint({ kind: "actions" }, element)}
      onCancel={onCancel}
      onFocused={(element) => checkpoint({ kind: "actions" }, element)}
      preserveCompactSession
      scrollToTopOnFocus
    />
  </Focusable>;
}
