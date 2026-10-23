import { Focusable, GamepadButton, Menu, MenuItem, showContextMenu, type GamepadEvent } from "@decky/ui";
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import { steamRecipes, steamTheme } from "./steam-theme";
import caretDownIconUrl from "./assets/caret-down.svg";

export function getCardStyle(nested = false): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen"),
    background: nested ? steamTheme.surface.contentStat : steamTheme.surface.contentCard,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    minWidth: 0,
  };
}

export function moveActivityGamepadFocus(
  event: GamepadEvent,
  source: HTMLElement,
  target: HTMLElement | null | undefined,
): void {
  if (!takeDeckySteamGamepadFocus(target)) {
    return;
  }

  // Let GamepadUI perform the focus transfer through its registered node. Stop
  // only this directional navigation so it cannot continue into Steam chrome.
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function handleActivityFilterDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const row = source.closest<HTMLElement>("[data-activity-header-row]");
  const controls = Array.from(row?.querySelectorAll<HTMLElement>("[data-steam-activity-filter='true']") ?? []);
  const index = controls.indexOf(source);
  const button = event.detail.button;
  const target = button === GamepadButton.DIR_LEFT ? controls[index - 1] ?? source
    : button === GamepadButton.DIR_RIGHT ? controls[index + 1] ?? source
    : button === GamepadButton.DIR_DOWN ? (row?.dataset["activityHeaderRow"] === "tabs"
      ? dashboard?.querySelector<HTMLElement>("[data-activity-header-row='filters'] [data-steam-activity-filter='true']")
      : dashboard?.querySelector<HTMLElement>("[data-steam-activity-row='true'], [data-activity-trend-bar]")) ?? source
    : button === GamepadButton.DIR_UP ? dashboard?.querySelector<HTMLElement>("[data-activity-header-row='tabs'] [aria-selected='true']") ?? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

export function handleActivityTrendDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const bars = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-activity-trend-bar]") ?? []);
  const index = bars.indexOf(source);
  const button = event.detail.button;
  const target = button === GamepadButton.DIR_LEFT ? bars[index - 1] ?? source
    : button === GamepadButton.DIR_RIGHT ? bars[index + 1] ?? source
    : button === GamepadButton.DIR_DOWN ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-selected='true'], [data-steam-activity-calendar-current='true']") ?? source
    : button === GamepadButton.DIR_UP ? dashboard?.querySelector<HTMLElement>("[data-activity-header-row='filters'] [data-steam-activity-filter='true']") ?? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

export function handleActivityCalendarDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const cells = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-calendar-day='true']") ?? []);
  const index = cells.indexOf(source);
  const row = index % 7;
  const column = Math.floor(index / 7);
  const columnCount = Math.ceil(cells.length / 7);
  const button = event.detail.button;
  let target: HTMLElement | null | undefined;
  if (button === GamepadButton.DIR_UP) {
    target = row > 0 ? cells[index - 1] : dashboard?.querySelector<HTMLElement>("[data-activity-trend-bar]") ?? source;
  } else if (button === GamepadButton.DIR_DOWN) {
    target = row < 6 && cells[index + 1] !== undefined
      ? cells[index + 1]
      : dashboard?.querySelector<HTMLElement>("[data-activity-selected-period]") ?? source;
  } else if (button === GamepadButton.DIR_LEFT) {
    target = column > 0
      ? cells[index - 7]
      : dashboard?.querySelector<HTMLElement>("[data-activity-subview='analytics']") ?? source;
  } else if (button === GamepadButton.DIR_RIGHT) {
    target = column < columnCount - 1 ? cells[index + 7] ?? source : source;
  }
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

export function handleActivityRowDirection(event: GamepadEvent, onRevealMore: (lastRowIndex: number) => boolean): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const rows = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-row='true']") ?? []);
  const index = rows.indexOf(source);
  const button = event.detail.button;
  if (button === GamepadButton.DIR_DOWN && rows[index + 1] === undefined && onRevealMore(index)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const target = button === GamepadButton.DIR_UP
    ? rows[index - 1]
      ?? dashboard?.querySelector<HTMLElement>("[data-activity-header-row='filters'] [data-steam-activity-filter='true']")
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter-selected='true']")
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter='true']")
    : button === GamepadButton.DIR_DOWN
      ? rows[index + 1] ?? source
      : button === GamepadButton.DIR_RIGHT || button === GamepadButton.DIR_LEFT ? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

export function ActivityFilterButton({ label, ariaLabel, selected, disabled = false, subview, onClick, onBack }: {
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly subview?: "activity" | "analytics";
  readonly label: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role={subview === undefined ? "button" : "tab"}
      aria-label={ariaLabel ?? label}
      aria-pressed={subview === undefined ? selected : undefined}
      aria-selected={subview === undefined ? undefined : selected}
      aria-disabled={disabled}
      data-activity-subview={subview}
      data-steam-activity-filter="true"
      data-steam-activity-filter-selected={selected ? "true" : "false"}
      preferredFocus={selected}
      onActivate={() => { if (!disabled) onClick(); }}
      onClick={() => { if (!disabled) onClick(); }}
      onCancel={onBack}
      onGamepadDirection={handleActivityFilterDirection}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...getSteamCompactAchievementFilterStyle(selected, focused),
        opacity: disabled ? 0.45 : 1,
        width: "100%",
        minWidth: 0,
        minHeight: subview === undefined ? 36 : 38,
        boxSizing: "border-box",
        padding: "7px 10px",
        fontSize: subview === undefined ? 12 : 16,
        fontWeight: subview === undefined ? 700 : 800,
        whiteSpace: "nowrap",
        ...(subview === undefined ? {} : {
          borderRadius: steamTheme.radius.small,
          background: selected
            ? focused ? steamTheme.surface.focusedSelectedContentStat : steamTheme.surface.selectedContentStat
            : focused ? steamTheme.surface.focusedContentStat : "transparent",
        }),
      }}
    >
      {label}
    </Focusable>
  );
}

export function ActivityDropdown<Value extends string>({ title, options, value, label, active, onChange, onBack }: {
  readonly title: string;
  readonly options: readonly { value: Value; label: string; disabled?: boolean }[];
  readonly value: Value;
  readonly label: string;
  readonly active: boolean;
  readonly onChange: (value: Value) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu>>();
  const unregisterCancelRef = useRef<() => void>();
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = (restoreFocus = true): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
    setMenuOpen(false);
    if (restoreFocus) requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };
  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label={title} onCancel={() => closeMenu()}>
        {options.map((option) => <MenuItem key={option.value} selected={value === option.value} disabled={option.disabled ?? false} onClick={() => { if (!option.disabled) { onChange(option.value); closeMenu(); } }}>{option.label}</MenuItem>)}
      </Menu>,
      triggerRef.current,
      { bModal: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(() => closeMenu());
  };
  useEffect(() => () => {
    menuRef.current?.Hide();
    unregisterCancelRef.current?.();
  }, []);

  return <Focusable
    ref={triggerRef}
    className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
    noFocusRing
    role="button"
    aria-label={`${title}: ${label}`}
    aria-expanded={menuOpen}
    data-steam-activity-filter="true"
    aria-haspopup="menu"
    onActivate={openMenu}
    onClick={openMenu}
    onCancel={() => { if (menuRef.current !== undefined) closeMenu(); else onBack(); }}
    onGamepadDirection={handleActivityFilterDirection}
    onFocus={() => setFocused(true)}
    onGamepadFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    style={{
      ...getSteamCompactAchievementFilterStyle(active, focused),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      width: "100%",
      minWidth: 0,
      minHeight: 36,
      boxSizing: "border-box",
      padding: "7px 10px",
      fontSize: 12,
      fontWeight: 700,
      overflow: "hidden",
    }}
  >
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    <img src={caretDownIconUrl} alt="" aria-hidden="true" style={{ width: 10, height: 10, flexShrink: 0, filter: steamTheme.iconFilter.accent }} />
  </Focusable>;
}

