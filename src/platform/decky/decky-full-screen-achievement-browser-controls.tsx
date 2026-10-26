import {
  Focusable,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  TextField,
  showContextMenu,
} from "@decky/ui";
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type FC } from "react";
import caretDownIconUrl from "./assets/caret-down.svg";
import searchIconUrl from "./assets/search.svg";
import {
  ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS,
  ACHIEVEMENT_BROWSER_SORT_OPTIONS,
  formatAchievementBrowserDisplayLabel,
  formatAchievementBrowserSortLabel,
  type AchievementBrowserDisplayMode,
  type AchievementBrowserSort,
} from "./decky-achievement-browser-options";
import {
  clearDeckyFullscreenOnScreenKeyboardOpen,
  markDeckyFullscreenOnScreenKeyboardOpen,
} from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { raTheme } from "./ra-theme";
import { steamTheme } from "./steam-theme";

const FullScreenAchievementSearchField = TextField as unknown as FC<
  ComponentProps<typeof TextField> & { readonly placeholder?: string }
>;

function getToolbarStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 0.38fr)", gap: 8, width: "100%", minWidth: 0 };
}

function getSearchWrapStyle(): CSSProperties {
  return { position: "relative", minWidth: 0, height: 42 };
}

function getSearchFieldStyle(isSteam: boolean, focused: boolean): CSSProperties {
  const theme = isSteam ? steamTheme : raTheme;
  return {
    width: "100%",
    height: 42,
    minHeight: 42,
    padding: "0 12px 0 38px",
    boxSizing: "border-box",
    border: `1px solid ${focused ? theme.focus.border : theme.color.borderSubtle}`,
    borderRadius: theme.radius.medium,
    color: theme.color.textPrimary,
    background: focused ? theme.surface.focusedContentCard : theme.surface.contentCard,
    boxShadow: focused ? theme.focus.shadow : "none",
    fontSize: 14,
  };
}

function getTriggerStyle(isSteam: boolean, focused: boolean, open: boolean): CSSProperties {
  const theme = isSteam ? steamTheme : raTheme;
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    minWidth: 0, minHeight: 42, padding: "0 14px", boxSizing: "border-box",
    border: `1px solid ${focused || open ? theme.focus.border : theme.color.borderSubtle}`,
    borderRadius: theme.radius.medium,
    color: theme.color.textPrimary,
    background: focused || open ? theme.surface.focusedContentCard : theme.surface.contentCard,
    boxShadow: focused || open ? theme.focus.shadow : "none",
    fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
  };
}

export interface DeckyFullScreenAchievementBrowserControlsProps {
  readonly displayMode: AchievementBrowserDisplayMode;
  readonly isSteam: boolean;
  readonly onBack: () => void;
  readonly onChangeDisplayMode: (displayMode: AchievementBrowserDisplayMode) => void;
  readonly onChangeQuery: (query: string) => void;
  readonly onChangeSort: (sort: AchievementBrowserSort) => void;
  readonly query: string;
  readonly sort: AchievementBrowserSort;
  readonly supportedSorts: readonly AchievementBrowserSort[];
}

export function DeckyFullScreenAchievementBrowserControls({
  displayMode, isSteam, onBack, onChangeDisplayMode, onChangeQuery, onChangeSort, query, sort, supportedSorts,
}: DeckyFullScreenAchievementBrowserControlsProps): JSX.Element {
  const [searchFocused, setSearchFocused] = useState(false);
  const [triggerFocused, setTriggerFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu> | undefined>();
  const unregisterCancelRef = useRef<(() => void) | undefined>();
  const theme = isSteam ? steamTheme : raTheme;

  const closeMenu = (): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
    setMenuOpen(false);
    requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };
  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label="Sort and view achievements" onCancel={closeMenu}>
        <MenuGroup label="SORT BY">
          {ACHIEVEMENT_BROWSER_SORT_OPTIONS.filter((option) => supportedSorts.includes(option.value)).map((option) => (
            <MenuItem key={option.value} selected={sort === option.value} onClick={() => { onChangeSort(option.value); closeMenu(); }}>
              {option.label}
            </MenuItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup label="DISPLAY">
          {ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS.map((option) => (
            <MenuItem key={option.value} selected={displayMode === option.value} onClick={() => { onChangeDisplayMode(option.value); closeMenu(); }}>
              {option.label}
            </MenuItem>
          ))}
        </MenuGroup>
      </Menu>,
      triggerRef.current,
      { bModal: true, bFitToWindow: true, bShiftToFitWindow: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => closeMenu, []);

  return <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={getToolbarStyle()}>
    <Focusable
      aria-label="Search achievements control"
      data-achievement-companion-steam-filter-control="true"
      flow-children="vertical"
      noFocusRing
      onCancel={onBack}
      onFocus={(event) => { setSearchFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={(event) => { setSearchFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchFocused(false); }}
      tabIndex={-1}
      style={getSearchWrapStyle()}
    >
      <img alt="" aria-hidden="true" src={searchIconUrl} style={{ position: "absolute", left: 13, top: 13, zIndex: 1, width: 16, height: 16, filter: theme.iconFilter.primary, pointerEvents: "none" }} />
      <FullScreenAchievementSearchField
        aria-label="Search achievements"
        bShowClearAction={query.length > 0}
        placeholder="Search achievements…"
        value={query}
        onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)}
        onBlur={(event) => clearDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)}
        onChange={(event) => onChangeQuery(event.currentTarget.value)}
        style={getSearchFieldStyle(isSteam, searchFocused)}
      />
    </Focusable>
    <Focusable
      ref={triggerRef}
      aria-expanded={menuOpen}
      aria-label={`Sort & View. Sort: ${formatAchievementBrowserSortLabel(sort)}. Display: ${formatAchievementBrowserDisplayLabel(displayMode)}.`}
      data-achievement-companion-steam-filter-control="true"
      noFocusRing role="button"
      onActivate={openMenu} onClick={openMenu}
      onCancel={() => { if (menuRef.current !== undefined) closeMenu(); else onBack(); }}
      onFocus={(event) => { setTriggerFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={(event) => { setTriggerFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onBlur={() => setTriggerFocused(false)}
      style={getTriggerStyle(isSteam, triggerFocused, menuOpen)}
    >
      <span>Sort &amp; View</span>
      <img alt="" aria-hidden="true" src={caretDownIconUrl} style={{ width: 12, height: 12, filter: theme.iconFilter.primary }} />
    </Focusable>
  </Focusable>;
}
