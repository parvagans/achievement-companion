import {
  Focusable,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  TextField,
  showContextMenu,
} from "@decky/ui";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FC,
} from "react";
import caretDownIconUrl from "./assets/caret-down.svg";
import searchIconUrl from "./assets/search.svg";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import {
  achievementCompanionQamTheme as qamTheme,
  getQamCompactFocusControlStyle,
} from "./decky-qam-theme";
import type {
  CompactAchievementDisplayMode,
  CompactAchievementSort,
} from "./decky-compact-achievement-model";
import {
  ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS,
  ACHIEVEMENT_BROWSER_SORT_OPTIONS,
  formatAchievementBrowserDisplayLabel,
  formatAchievementBrowserSortLabel,
} from "./decky-achievement-browser-options";

const CompactAchievementSearchField = TextField as unknown as FC<
  ComponentProps<typeof TextField> & { readonly placeholder?: string }
>;

export function formatCompactAchievementSortLabel(sort: CompactAchievementSort): string {
  return formatAchievementBrowserSortLabel(sort);
}

function getToolbarStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "stretch",
    gap: 6,
    width: "100%",
    minWidth: 0,
  };
}

function getSearchWrapStyle(): CSSProperties {
  return {
    position: "relative",
    flex: "1 1 auto",
    minWidth: 0,
    height: 36,
  };
}

function getSearchIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 10,
    top: 10,
    zIndex: 1,
    width: 15,
    height: 15,
    filter: qamTheme.decorative.iconFilter,
    pointerEvents: "none",
  };
}

function getSearchFieldStyle(focused: boolean): CSSProperties {
  return {
    width: "100%",
    height: 36,
    minHeight: 36,
    padding: "0 8px 0 32px",
    boxSizing: "border-box",
    border: `1px solid ${focused ? qamTheme.focus.compactBorder : qamTheme.color.borderSubtle}`,
    borderRadius: qamTheme.radius.small,
    color: qamTheme.color.textPrimary,
    background: focused ? qamTheme.surface.focusedContentStat : qamTheme.surface.contentStat,
    boxShadow: focused ? qamTheme.focus.compactShadow : "none",
    fontFamily: qamTheme.type.fontFamily,
    fontSize: qamTheme.type.compact.body,
  };
}

function getMenuTriggerStyle(focused: boolean, open: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: "0 0 auto",
    minWidth: 106,
    minHeight: 36,
    padding: "0 10px",
    boxSizing: "border-box",
    border: `1px solid ${qamTheme.color.borderSubtle}`,
    borderRadius: qamTheme.radius.small,
    color: qamTheme.color.textPrimary,
    background: qamTheme.surface.contentStat,
    fontFamily: qamTheme.type.fontFamily,
    fontSize: qamTheme.type.compact.metadata,
    fontWeight: qamTheme.type.weight.strong,
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...(focused || open
      ? { ...getQamCompactFocusControlStyle(), background: qamTheme.surface.focusedContentStat }
      : {}),
  };
}

export interface DeckyCompactAchievementBrowserControlsProps {
  readonly displayMode: CompactAchievementDisplayMode;
  readonly onBack: () => void;
  readonly onChangeDisplayMode: (displayMode: CompactAchievementDisplayMode) => void;
  readonly onChangeQuery: (query: string) => void;
  readonly onChangeSort: (sort: CompactAchievementSort) => void;
  readonly onControlFocus?: () => void;
  readonly query: string;
  readonly sort: CompactAchievementSort;
  readonly supportedSorts: readonly CompactAchievementSort[];
}

export function DeckyCompactAchievementBrowserControls({
  displayMode,
  onBack,
  onChangeDisplayMode,
  onChangeQuery,
  onChangeSort,
  onControlFocus,
  query,
  sort,
  supportedSorts,
}: DeckyCompactAchievementBrowserControlsProps): JSX.Element {
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortFocused, setSortFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const releasePopupRef = useRef<(() => void) | undefined>(undefined);
  const sortLabel = formatCompactAchievementSortLabel(sort);
  const displayLabel = formatAchievementBrowserDisplayLabel(displayMode);

  const closeMenu = (): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    releasePopupRef.current?.();
    releasePopupRef.current = undefined;
    setMenuOpen(false);
    requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };

  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    releasePopupRef.current = beginDeckyCompactPopup();
    menuRef.current = showContextMenu(
      <Menu label="Sort and view achievements" onCancel={closeMenu}>
        <MenuGroup label="SORT BY">
          {ACHIEVEMENT_BROWSER_SORT_OPTIONS.filter((option) => supportedSorts.includes(option.value)).map((option) => (
            <MenuItem
              key={option.value}
              selected={sort === option.value}
              onClick={() => {
                onChangeSort(option.value);
                closeMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup label="DISPLAY">
          {ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS.map((option) => (
            <MenuItem
              key={option.value}
              selected={displayMode === option.value}
              onClick={() => {
                onChangeDisplayMode(option.value);
                closeMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </MenuGroup>
      </Menu>,
      triggerRef.current,
      { bModal: true, bFitToWindow: true, bShiftToFitWindow: true },
    );
  };

  useEffect(() => () => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    releasePopupRef.current?.();
    releasePopupRef.current = undefined;
  }, []);

  return (
    <Focusable
      aria-label="Achievement browser controls"
      flow-children="left-right"
      noFocusRing
      tabIndex={-1}
      style={getToolbarStyle()}
    >
      <Focusable
        aria-label="Search achievements control"
        data-ac-compact-achievement-search="true"
        flow-children="vertical"
        noFocusRing
        onCancel={onBack}
        onFocus={() => {
          setSearchFocused(true);
          onControlFocus?.();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchFocused(false);
        }}
        tabIndex={-1}
        style={getSearchWrapStyle()}
      >
        <img alt="" aria-hidden="true" src={searchIconUrl} style={getSearchIconStyle()} />
        <CompactAchievementSearchField
          aria-label="Search achievements"
          bShowClearAction={query.length > 0}
          placeholder="Search achievements…"
          value={query}
          onChange={(event) => onChangeQuery(event.currentTarget.value)}
          style={getSearchFieldStyle(searchFocused)}
        />
      </Focusable>

      <Focusable
        ref={triggerRef}
        aria-expanded={menuOpen}
        aria-label={`Sort & View. Sort: ${sortLabel}. Display: ${displayLabel}.`}
        noFocusRing
        onActivate={openMenu}
        onCancel={() => {
          if (menuRef.current !== undefined) closeMenu();
          else onBack();
        }}
        onClick={openMenu}
        onFocus={() => {
          setSortFocused(true);
          onControlFocus?.();
        }}
        onGamepadFocus={() => {
          setSortFocused(true);
          onControlFocus?.();
        }}
        onBlur={() => setSortFocused(false)}
        role="button"
        style={getMenuTriggerStyle(sortFocused, menuOpen)}
      >
        <span>Sort &amp; View</span>
        <img
          alt=""
          aria-hidden="true"
          src={caretDownIconUrl}
          style={{ width: 12, height: 12, filter: qamTheme.decorative.iconFilter }}
        />
      </Focusable>
    </Focusable>
  );
}
