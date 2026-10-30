import { DeckyAchievementArtwork } from "./decky-achievement-artwork";
import { createUpNextPinAction } from "./decky-up-next-pin-action";
import { DeckyUpNextPinButton } from "./decky-up-next-pin-button";
import { DialogButton, Focusable, NavEntryPositionPreferences, Menu, MenuItem, showContextMenu } from "@decky/ui";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { NormalizedAchievement } from "@core/domain";
import type { GameOverviewSuggestion } from "./decky-game-overview-recommendations";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import { openDeckyStandardModal } from "./decky-standard-modal";
import { DeckyCompletionProgressBar, type DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyGameStatusIcon, type DeckyGameStatusIconKind } from "./decky-game-status-icon";
import { dedupeDeckyOverviewDetailRows, formatDeckyOverviewDateTime, type DeckyOverviewDetailRow } from "./decky-overview-format";
import { achievementCompanionAchievementRowRecipes, getQamCompactFocusControlStyle } from "./decky-qam-theme";
import { steamRecipes, steamTheme } from "./steam-theme";
import {
  getDeckyOverviewMenuParentFocusKey,
  getDeckyOverviewMenuParentPath,
  buildDeckyManageSuggestionsMenuItems,
  resolveDeckyOverviewMenuFrame,
  type DeckyGameOverviewActions,
  type DeckyOverviewMenuItem,
  type DeckyOverviewMenuNavigation,
} from "./decky-overview-menu-model";
export type { DeckyGameOverviewActions } from "./decky-overview-menu-model";

export const overviewPanelStyle: CSSProperties = {
  ...steamRecipes.card("fullscreen"), padding: 10, minHeight: 0, minWidth: 0,
  boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8,
};
export const overviewMetadataStyle: CSSProperties = steamRecipes.text("fullscreen", "metadata");

export function DeckyOverviewHeaderIndicators({ mode, goal }: {
  readonly mode: string;
  readonly goal: string;
}): JSX.Element {
  return <div data-ac-overview-header-indicators="true" aria-label={`${mode}. Goal: ${goal}`} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 5, minWidth: 0 }}>
    {[mode, `GOAL: ${goal}`].map((label) => <span key={label} style={{ ...steamRecipes.card("fullscreen", "raised"), padding: "3px 7px", borderRadius: steamTheme.radius.pill,
      color: steamTheme.focus.primaryBorder, fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong, letterSpacing: "0.025em", lineHeight: 1.15, whiteSpace: "nowrap" }}>{label}</span>)}
  </div>;
}

function frameKey(path: readonly string[]): string {
  return path.join("/");
}

function scheduleInDocument(element: HTMLElement, callback: () => void): void {
  const ownerWindow = element.ownerDocument.defaultView;
  if (ownerWindow === null) return;
  ownerWindow.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(callback));
}

function findScrollableMenuAncestor(element: HTMLElement): HTMLElement | undefined {
  const ownerWindow = element.ownerDocument.defaultView;
  let current = element.parentElement;
  while (current !== null && ownerWindow !== null) {
    const overflowY = ownerWindow.getComputedStyle(current).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return undefined;
}

function DeckyOverviewMenuPopup({ rootLabel, getItems, trigger, initialPath, initialFocusKey, frameState, onClose, onRestoreAfterClose, onUnmount }: {
  readonly rootLabel: string;
  readonly getItems: () => readonly DeckyOverviewMenuItem[];
  readonly trigger: HTMLElement;
  readonly initialPath: readonly string[];
  readonly initialFocusKey?: string;
  readonly frameState: Map<string, { readonly focusKey?: string; readonly scrollTop?: number }>;
  readonly onClose: (restoreTrigger: boolean) => void;
  readonly onRestoreAfterClose: (path: readonly string[], focusKey?: string) => void;
  readonly onUnmount: () => void;
}): JSX.Element {
  const initialFrame = resolveDeckyOverviewMenuFrame(rootLabel, getItems(), initialPath)
    ?? resolveDeckyOverviewMenuFrame(rootLabel, getItems(), []);
  const [path, setPath] = useState<readonly string[]>(initialFrame?.path ?? []);
  const [revision, setRevision] = useState(0);
  const pathRef = useRef(path);
  const pendingFocusKeyRef = useRef(initialFocusKey);
  const cancelInFlightRef = useRef(false);
  const cancelRef = useRef<() => void>(() => undefined);
  pathRef.current = path;
  const frame = resolveDeckyOverviewMenuFrame(rootLabel, getItems(), path)
    ?? resolveDeckyOverviewMenuFrame(rootLabel, getItems(), []);

  const captureFrameState = (): void => {
    const markers = Array.from(trigger.ownerDocument.querySelectorAll<HTMLElement>("[data-ac-overview-menu-item]"));
    const marker = markers.find((candidate) => candidate.closest(".gpfocus") !== null);
    if (marker === undefined) return;
    const scrollable = findScrollableMenuAncestor(marker);
    frameState.set(frameKey(pathRef.current), {
      ...(marker.dataset["acOverviewMenuItem"] ? { focusKey: marker.dataset["acOverviewMenuItem"] } : {}),
      ...(scrollable !== undefined ? { scrollTop: scrollable.scrollTop } : {}),
    });
  };

  const moveToFrame = (requestedPath: readonly string[], requestedFocusKey?: string): void => {
    captureFrameState();
    const nextFrame = resolveDeckyOverviewMenuFrame(rootLabel, getItems(), requestedPath)
      ?? resolveDeckyOverviewMenuFrame(rootLabel, getItems(), []);
    if (nextFrame === undefined) return;
    const saved = frameState.get(frameKey(nextFrame.path));
    pendingFocusKeyRef.current = requestedFocusKey ?? saved?.focusKey;
    pathRef.current = nextFrame.path;
    setPath(nextFrame.path);
    setRevision((value) => value + 1);
  };

  const navigationFor = (currentPath: readonly string[], currentFocusKey?: string): DeckyOverviewMenuNavigation => ({
    restoreCurrent: (nextFocusKey) => moveToFrame(currentPath, nextFocusKey ?? currentFocusKey),
    restoreParent: (nextFocusKey) => moveToFrame(
      getDeckyOverviewMenuParentPath(currentPath) ?? [],
      nextFocusKey ?? getDeckyOverviewMenuParentFocusKey(currentPath),
    ),
  });

  const handleCancel = (): void => {
    if (cancelInFlightRef.current) return;
    cancelInFlightRef.current = true;
    const parentPath = getDeckyOverviewMenuParentPath(pathRef.current);
    if (parentPath === undefined) {
      captureFrameState();
      onClose(true);
      return;
    }
    moveToFrame(parentPath, getDeckyOverviewMenuParentFocusKey(pathRef.current));
    scheduleInDocument(trigger, () => { cancelInFlightRef.current = false; });
  };
  cancelRef.current = handleCancel;

  useEffect(() => {
    const unregister = registerDeckyFullscreenPopupCancel(() => cancelRef.current());
    return () => {
      unregister();
      onUnmount();
    };
  }, []);
  useEffect(() => {
    const saved = frameState.get(frameKey(path));
    const focusKey = pendingFocusKeyRef.current ?? saved?.focusKey;
    pendingFocusKeyRef.current = undefined;
    scheduleInDocument(trigger, () => {
      const markers = Array.from(trigger.ownerDocument.querySelectorAll<HTMLElement>("[data-ac-overview-menu-item]"));
      const marker = markers.find((candidate) => candidate.dataset["acOverviewMenuItem"] === focusKey);
      const target = marker?.closest<HTMLElement>(".Focusable, [tabindex]") ?? marker?.parentElement;
      if (target === undefined || target === null) return;
      if (saved?.scrollTop !== undefined) {
        const scrollable = findScrollableMenuAncestor(target);
        if (scrollable !== undefined) scrollable.scrollTop = saved.scrollTop;
      }
      requestDeckySteamGamepadFocusAfterMount(target);
    });
  }, [frameState, path, revision, trigger]);

  if (frame === undefined) return <Menu label={rootLabel} onCancel={handleCancel} />;
  const focusKey = frameState.get(frameKey(frame.path))?.focusKey;
  const navigation = navigationFor(frame.path, focusKey);
  return <Menu label={frame.label} onCancel={handleCancel}>
    {frame.items.map((item) => {
      const keepsPopupOpen = item.items !== undefined || item.keepMenuOpenOnSelect === true;
      const rememberItem = (): void => {
        frameState.set(frameKey(frame.path), { ...frameState.get(frameKey(frame.path)), focusKey: item.key });
      };
      return <MenuItem key={item.key} selected={item.selected ?? false} bInteractableItem={keepsPopupOpen}
      {...(item.tone !== undefined ? { tone: item.tone } : {})}
      onSelected={rememberItem}
      {...(item.items === undefined ? {} : { onMoveRight: () => { rememberItem(); moveToFrame([...frame.path, item.key]); } })}
      onClick={() => {
        rememberItem();
        if (item.items !== undefined) {
          moveToFrame([...frame.path, item.key]);
          return;
        }
        if (item.keepMenuOpenOnSelect === true) {
          item.onSelect?.(navigation);
          scheduleInDocument(trigger, () => setRevision((value) => value + 1));
          return;
        }
        captureFrameState();
        onClose(false);
        takeDeckySteamGamepadFocus(trigger);
        item.onSelect?.({
          restoreCurrent: (nextFocusKey) => onRestoreAfterClose(frame.path, nextFocusKey ?? focusKey),
          restoreParent: (nextFocusKey) => onRestoreAfterClose(
            getDeckyOverviewMenuParentPath(frame.path) ?? [],
            nextFocusKey ?? getDeckyOverviewMenuParentFocusKey(frame.path),
          ),
        });
      }}><span data-ac-overview-menu-item={item.key}>{item.label}{item.items !== undefined ? <span aria-hidden="true"> ›</span> : null}</span></MenuItem>;
    })}
  </Menu>;
}

/** Native menu and native return focus, shared by Actions, goals, and suggestions. */
export function DeckyOverviewMenuButton({ label, displayLabel, items, compact = false, deckyDialogButton = false, preserveCompactSession = false, preferredFocus = false, elementRef, onActivated, onFocused, onCancel, minHeight, scrollToTopOnFocus = false }: {
  readonly label: string; readonly items: readonly DeckyOverviewMenuItem[]; readonly compact?: boolean;
  readonly deckyDialogButton?: boolean;
  readonly displayLabel?: ReactNode;
  readonly preserveCompactSession?: boolean;
  readonly preferredFocus?: boolean;
  readonly elementRef?: (element: HTMLDivElement | null) => void;
  readonly onActivated?: (element: HTMLElement) => void;
  readonly onFocused?: (element: HTMLElement) => void;
  readonly onCancel?: () => void;
  readonly minHeight?: number;
  readonly scrollToTopOnFocus?: boolean;
}): JSX.Element {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu>>();
  const releaseCompactPopupRef = useRef<() => void>();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const frameStateRef = useRef(new Map<string, { readonly focusKey?: string; readonly scrollTop?: number }>());
  const openMenuAtRef = useRef<(path: readonly string[], focusKey?: string) => void>(() => undefined);
  const [focused, setFocused] = useState(false);
  const focusGeneration = useRef(0);
  const handlePopupUnmount = (): void => {
    menuRef.current = undefined;
    releaseCompactPopupRef.current?.(); releaseCompactPopupRef.current = undefined;
  };
  const hideMenu = (restoreFocus = false): void => {
    const menu = menuRef.current;
    menuRef.current = undefined;
    menu?.Hide();
    releaseCompactPopupRef.current?.(); releaseCompactPopupRef.current = undefined;
    if (restoreFocus && triggerRef.current !== null) requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };

  const restoreMenu = (path: readonly string[], focusKey?: string): void => {
    const trigger = triggerRef.current;
    if (trigger === null || menuRef.current !== undefined) return;
    if (preserveCompactSession && releaseCompactPopupRef.current === undefined) releaseCompactPopupRef.current = beginDeckyCompactPopup();
    scheduleInDocument(trigger, () => openMenuAtRef.current(path, focusKey));
  };

  openMenuAtRef.current = (requestedPath, requestedFocusKey) => {
    const trigger = triggerRef.current;
    if (trigger === null || menuRef.current !== undefined) return;
    const frame = resolveDeckyOverviewMenuFrame(label, itemsRef.current, requestedPath)
      ?? resolveDeckyOverviewMenuFrame(label, itemsRef.current, []);
    if (frame === undefined) return;
    const saved = frameStateRef.current.get(frameKey(frame.path));
    const focusKey = requestedFocusKey ?? saved?.focusKey;
    menuRef.current = showContextMenu(
      <DeckyOverviewMenuPopup rootLabel={label} getItems={() => itemsRef.current} trigger={trigger}
        initialPath={frame.path} {...(focusKey !== undefined ? { initialFocusKey: focusKey } : {})}
        frameState={frameStateRef.current} onClose={hideMenu} onRestoreAfterClose={restoreMenu} onUnmount={handlePopupUnmount} />,
      trigger, { bModal: true, bFitToWindow: true, bShiftToFitWindow: true },
    );
  };
  const openMenu = (): void => {
    if (triggerRef.current === null || menuRef.current !== undefined) return;
    onActivated?.(triggerRef.current);
    if (preserveCompactSession) releaseCompactPopupRef.current = beginDeckyCompactPopup();
    try {
      openMenuAtRef.current([], frameStateRef.current.get("")?.focusKey);
    } catch (error) {
      releaseCompactPopupRef.current?.(); releaseCompactPopupRef.current = undefined;
      throw error;
    }
  };
  useEffect(() => () => { menuRef.current?.Hide(); releaseCompactPopupRef.current?.(); }, []);
  const focus = (): void => {
    const target = triggerRef.current;
    if (target === null) return;
    const generation = ++focusGeneration.current;
    setFocused(true);
    if (scrollToTopOnFocus) {
      scrollDeckyFocusTargetToTop(target, () => focusGeneration.current === generation);
    }
    onFocused?.(target);
  };
  const blur = (): void => {
    focusGeneration.current += 1;
    setFocused(false);
  };
  if (deckyDialogButton) return <DialogButton ref={(node) => { triggerRef.current = node; elementRef?.(node); }} onClick={openMenu}
    style={{ flex: "0 0 160px", fontSize: 15, height: 40, minWidth: 160, padding: "0 12px", width: 160 }}>
    {displayLabel ?? label}
  </DialogButton>;
  return <Focusable ref={(node) => { triggerRef.current = node; elementRef?.(node); }} role="button" aria-label={label} noFocusRing preferredFocus={preferredFocus} onActivate={openMenu} onClick={openMenu} {...(onCancel !== undefined ? { onCancel } : {})}
    onFocus={focus} onGamepadFocus={focus} onBlur={blur} onGamepadBlur={blur}
    style={{ ...steamRecipes.action("fullscreen"), minHeight: minHeight ?? (compact ? 28 : 34), padding: "0 10px", flexShrink: 0,
      fontSize: steamTheme.type.fullscreen[compact ? "metadata" : "body"], display: "flex", alignItems: "center", justifyContent: "center",
      ...(focused ? compact
        ? { ...getQamCompactFocusControlStyle(), background: steamTheme.surface.focusedContentStat }
        : { background: steamTheme.surface.focusedContentStat, boxShadow: steamTheme.focus.shadow }
        : {}) }}>
    {displayLabel ?? <>{label} <span aria-hidden="true" style={{ marginLeft: 6 }}>▾</span></>}
  </Focusable>;
}

export function openDeckyOverviewDetails(
  title: string,
  rows: readonly DeckyOverviewDetailRow[],
  extra?: ReactNode,
  onClose?: () => void,
  options: { readonly preserveCompactSession?: boolean } = {},
): void {
  const uniqueRows = dedupeDeckyOverviewDetailRows(rows);
  openDeckyStandardModal({ title, viewportSafe: true, preserveCompactSession: options.preserveCompactSession === true, renderContent: () => <div
    data-ac-game-info-grid="true"
    style={{ maxHeight: "min(228px, calc(100vh - 300px))", overflowY: "auto", overscrollBehavior: "contain", padding: 3, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridAutoRows: "minmax(52px, auto)", gap: 6 }}>
    {uniqueRows.map((row, index) => <div key={`${row.key ?? row.label}-${index}`} style={{ ...steamRecipes.card("fullscreen", "raised"), padding: "6px 9px", display: "flex", minWidth: 0, minHeight: 52, boxSizing: "border-box", flexDirection: "column", justifyContent: "space-between", gap: 2 }}>
      <span style={overviewMetadataStyle}>{row.label}</span><span style={{ ...steamRecipes.text("fullscreen", "body"), textAlign: "right", overflowWrap: "anywhere" }}>{row.value}</span>
    </div>)}{extra}
  </div>, ...(onClose !== undefined ? { onClose } : {}) });
}

export function DeckyOverviewProgress({ headline, detail, percent, unlocked, total, remaining, lastUnlock, latestAchievement, points, statusIcon, tone = "default", steam = false, accent, children }: {
  readonly headline: string; readonly detail?: string; readonly percent?: number; readonly unlocked: number; readonly total: number;
  readonly remaining: number; readonly lastUnlock?: number; readonly latestAchievement?: NormalizedAchievement; readonly points?: string;
  readonly statusIcon?: ReactNode; readonly tone?: DeckyCompletionProgressBarTone; readonly steam?: boolean; readonly accent?: string; readonly children?: ReactNode;
}): JSX.Element {
  return <section aria-label="Your progress" style={{ ...overviewPanelStyle, justifyContent: "flex-start", gap: 6, height: "100%" }}>
    <div data-ac-progress-region="accomplishment" style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
      {statusIcon !== undefined ? <span data-ac-overview-milestone-icon="true" style={{ flex: "0 0 auto", display: "grid", placeItems: "center" }}>{statusIcon}</span> : null}
      <div style={{ minWidth: 0 }}>
        <div style={overviewMetadataStyle}>YOUR ACCOMPLISHMENT</div>
        <div style={{ ...steamRecipes.text("fullscreen", "hero"), color: accent ?? steamTheme.color.textPrimary, marginTop: 2 }}>{headline}</div>
        {detail ? <div style={overviewMetadataStyle}>{detail}</div> : null}
      </div>
    </div>
    <div data-ac-progress-region="progress" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ ...steamRecipes.text("fullscreen", "body"), display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{unlocked.toLocaleString()} / {total.toLocaleString()} unlocked</strong>
        {percent !== undefined ? <span>{Math.round(percent)}%</span> : null}
      </div>
      {percent !== undefined ? <DeckyCompletionProgressBar percent={percent} showCaption={false} tone={tone} steamTheme={steam} breathe={steam} /> : null}
      <div style={{ ...overviewMetadataStyle, display: "grid", gridTemplateColumns: points ? "1fr 1fr" : "1fr", gap: 6 }}>
        <span style={{ ...steamRecipes.card("fullscreen", "raised"), padding: "5px 7px" }}><strong>{remaining.toLocaleString()}</strong> remaining</span>
        {points ? <span style={{ ...steamRecipes.card("fullscreen", "raised"), padding: "5px 7px", textAlign: "right" }}>{points}</span> : null}
      </div>
    </div>
    {lastUnlock !== undefined ? <div data-ac-progress-region="latest-unlock" data-ac-latest-unlock="true" style={{ ...steamRecipes.card("fullscreen", "raised"), padding: "6px 8px", display: "grid", gridTemplateColumns: latestAchievement?.badgeImageUrl ? "32px minmax(0, 1fr)" : "1fr", alignItems: "center", gap: 8, minWidth: 0, flex: "0 0 auto", marginTop: "auto" }}>
      {latestAchievement?.badgeImageUrl ? <DeckyGameArtwork size={32} compact title={latestAchievement.title} src={latestAchievement.badgeImageUrl} /> : null}
      <div style={{ minWidth: 0 }}><div style={overviewMetadataStyle}>LATEST UNLOCK</div>
        {latestAchievement !== undefined ? <strong title={latestAchievement.title} style={{ ...steamRecipes.text("fullscreen", "body"), overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.1 }}>{latestAchievement.title}</strong> : null}
        <div style={overviewMetadataStyle}>{formatDeckyOverviewDateTime(lastUnlock)}</div>
      </div>
    </div> : null}
    {children}
  </section>;
}

function SuggestionRow({ suggestion, actions }: { readonly suggestion: GameOverviewSuggestion; readonly actions: DeckyGameOverviewActions }): JSX.Element {
  const [focused, setFocused] = useState(false);
  const achievement = suggestion.achievement;
  const pinAction = createUpNextPinAction(suggestion, actions.achievementMode ?? "both", actions.onTogglePin);
  const subtitle = suggestion.warning ?? suggestion.availabilityLabel ?? suggestion.groupLabel;
  const focus = (): void => { setFocused(true); actions.onFocusedSuggestionChange(achievement.achievementId); };
  const blur = (): void => { setFocused(false); actions.onFocusedSuggestionChange(null); };
  return <Focusable flow-children="left-right" noFocusRing tabIndex={-1} navEntryPreferPosition={NavEntryPositionPreferences.FIRST} style={{ display: "grid", gridTemplateColumns: pinAction ? "minmax(0,1fr) auto" : "minmax(0,1fr)", alignItems: "center", gap: 6, minHeight: 0 }}><Focusable noFocusRing role="button" data-ac-up-next-id={achievement.achievementId} aria-label={`${achievement.title}. ${achievement.description ?? ""}${subtitle ? `. ${subtitle}` : ""}`}
    onActivate={() => actions.onOpenAchievement(achievement.achievementId)} onClick={() => actions.onOpenAchievement(achievement.achievementId)}
    onOptionsActionDescription="Show in Achievements" onSecondaryActionDescription="Hide suggestion"
    onOptionsButton={(event) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) actions.onJumpToAchievement(achievement.achievementId); }}
    onSecondaryButton={(event) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) actions.onDismissSuggestion(achievement.achievementId); }}
    onGamepadFocus={focus} onGamepadBlur={blur} onFocus={focus} onBlur={blur}
    style={{ ...achievementCompanionAchievementRowRecipes.surface("compact", steamTheme.color.locked, focused), borderRadius: steamTheme.radius.medium,
      display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) 88px", alignItems: "center", alignSelf: "stretch", gap: 8, minHeight: 0, padding: "4px 8px", boxSizing: "border-box" }}>
    {achievement.badgeImageUrl ? <DeckyAchievementArtwork size={36} src={achievement.badgeImageUrl} /> : <span />}
    <div style={{ minWidth: 0, minHeight: 0, maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}>
        <strong title={achievement.title} style={{ ...steamRecipes.text("fullscreen", "body"), fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{achievement.title}</strong>
        <DeckyAchievementTypeBadge classification={achievement.classification} />
      </div>
      {achievement.description ? <span data-ac-up-next-row-description title={achievement.description} style={{ ...overviewMetadataStyle, minHeight: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.15 }}>{achievement.description}</span> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: steamTheme.type.fullscreen.caption, color: suggestion.warning || suggestion.availabilityLabel ? steamTheme.color.warning : steamTheme.color.textSecondary }}>
        {subtitle ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{subtitle}</span> : null}
      </div>
    </div>
    <div data-ac-up-next-rarity="true" style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", gap: 4, minWidth: 0 }}>
      {suggestion.rarityPercent !== undefined ? <><span style={{ ...overviewMetadataStyle, textAlign: "right", whiteSpace: "nowrap" }}>{Math.round(suggestion.rarityPercent)}% players</span><span aria-hidden="true" style={{ width: "100%", height: 3, background: steamTheme.surface.progressTrack, borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", width: `${suggestion.rarityPercent}%`, height: "100%", background: steamTheme.surface.progressFill }} /></span></> : null}
    </div>
  </Focusable><DeckyUpNextPinButton action={pinAction} onFocusedChange={(focused) => actions.onFocusedPinChange?.(focused ? achievement.achievementId : null)} /></Focusable>;
}

export function DeckyOverviewCompanion({ actions, completed, history, goalLabel }: {
  readonly actions?: DeckyGameOverviewActions; readonly completed: boolean; readonly history: ReactNode; readonly goalLabel?: string;
}): JSX.Element {
  if (actions?.suggestions[0]?.pinned) completed = false;
  const menuItems = actions === undefined ? [] : buildDeckyManageSuggestionsMenuItems(actions);
  const suggestions = completed ? [] : actions?.suggestions ?? [];
  return <section aria-label={completed ? "Milestone history" : "Up Next"} style={{ ...overviewPanelStyle, gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28 }}>
      <strong style={steamRecipes.text("fullscreen", "title")}>{completed ? "Your milestone" : "Up Next"}</strong>
      {menuItems.length > 0 ? <DeckyOverviewMenuButton label="Manage Suggestions" items={menuItems} compact /> : null}
    </div>
    {suggestions.length > 0 && actions !== undefined ? <Focusable flow-children="column" noFocusRing tabIndex={-1} style={{ display: "grid", gridTemplateRows: suggestions.length === 3 ? "repeat(3, minmax(0, 1fr))" : `repeat(${suggestions.length}, max-content)`, alignContent: "start", gap: 8, minHeight: 0, flex: "1 1 auto" }}>
      {suggestions.map((suggestion) => <SuggestionRow key={suggestion.achievement.achievementId} suggestion={suggestion} actions={actions} />)}
    </Focusable> : <div style={{ minHeight: 0, flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
      {!completed ? <div style={steamRecipes.text("fullscreen", "body")}>{actions?.hiddenSuggestions.length ? "Suggestions hidden. Restore them in Manage Suggestions." : `No eligible suggestions${goalLabel ? ` for ${goalLabel}` : ""} right now.`}</div> : null}
      {completed ? history : null}
    </div>}
  </section>;
}

export function DeckyOverviewMilestoneShowcase({ kind, color, glow, primaryLabel, title, supporting }: {
  readonly kind: DeckyGameStatusIconKind;
  readonly color: string;
  readonly glow?: string;
  readonly primaryLabel: string;
  readonly title: string;
  readonly supporting?: ReactNode;
}): JSX.Element {
  const rotation = kind === "beaten" ? "-12deg" : "-10deg";
  return <div data-ac-milestone-showcase={kind} style={{ position: "relative", isolation: "isolate", overflow: "hidden", minHeight: 0, flex: "1 1 auto", display: "flex", alignItems: "center", padding: "10px clamp(10px, 2vw, 22px)", borderRadius: steamTheme.radius.large }}>
    <span data-ac-milestone-watermark="true" aria-hidden="true" style={{ position: "absolute", zIndex: 0, right: "clamp(-22px, -1.5vw, -6px)", top: "50%", transform: `translateY(-50%) rotate(${rotation})`, opacity: 0.1, pointerEvents: "none", userSelect: "none" }}>
      <DeckyGameStatusIcon kind={kind} size="clamp(142px, 21vw, 214px)" color={color} {...(glow !== undefined ? { glow } : {})} />
    </span>
    <div style={{ position: "relative", zIndex: 1, minWidth: 0, maxWidth: "72%", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ ...overviewMetadataStyle, color, fontWeight: steamTheme.type.weight.strong, letterSpacing: "0.045em" }}>{primaryLabel}</div>
      <strong style={{ ...steamRecipes.text("fullscreen", "hero"), color: steamTheme.color.textPrimary, lineHeight: 1.12 }}>{title}</strong>
      {supporting !== undefined ? <div style={{ ...overviewMetadataStyle, color: steamTheme.color.textSecondary }}>{supporting}</div> : null}
    </div>
  </div>;
}

export interface DeckyOverviewSupportingMetric { readonly label: string; readonly value: string; readonly tone?: string; readonly weight?: number }

export function DeckyOverviewSupporting({ title, metrics, actions, onDetails }: {
  readonly title: string; readonly metrics: readonly DeckyOverviewSupportingMetric[]; readonly actions?: DeckyGameOverviewActions; readonly onDetails: (onClose?: () => void) => void;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const restoreGameInfo = (): void => {
    const target = rootRef.current?.querySelector<HTMLElement>("[aria-label='Game Info']");
    if (target !== undefined && target !== null) requestDeckySteamGamepadFocusAfterMount(target);
  };
  return <section ref={rootRef} aria-label={title} style={{ ...overviewPanelStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 10px" }}>
    <strong style={{ ...steamRecipes.text("fullscreen", "body"), flex: "0 0 auto" }}>{title}</strong>
    <div data-ac-overview-provider-metrics="true" style={{ flex: "1 1 auto", minWidth: 0, display: "grid", gridTemplateColumns: metrics.map((metric) => `minmax(72px, ${metric.weight ?? 1}fr)`).join(" ") || "minmax(0, 1fr)", gap: 5 }}>
      {metrics.map((metric) => <div key={metric.label} style={{ minWidth: 0, padding: "3px 6px", borderLeft: `1px solid ${steamTheme.color.borderSubtle}` }}>
        <div style={{ ...overviewMetadataStyle, fontSize: steamTheme.type.fullscreen.caption }}>{metric.label}</div>
        <strong style={{ ...steamRecipes.text("fullscreen", "metadata"), color: metric.tone ?? steamTheme.color.textPrimary, display: "block", whiteSpace: "pre-line", lineHeight: 1.15 }}>{metric.value}</strong>
      </div>)}
    </div>
    <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
      <DeckyFullscreenActionButton compact label="Game Info" onClick={() => onDetails(restoreGameInfo)} />
      {actions?.onOpenCommunity ? <DeckyFullscreenActionButton compact label="Community" onClick={actions.onOpenCommunity} /> : null}
    </Focusable>
  </section>;
}
