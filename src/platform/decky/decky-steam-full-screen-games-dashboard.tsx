import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import {
  Focusable,
  GamepadButton,
  Menu,
  MenuItem,
  NavEntryPositionPreferences,
  TextField,
  showContextMenu,
  type GamepadEvent,
} from "@decky/ui";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FC,
  type RefCallback,
} from "react";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import {
  DeckyFullScreenFooterOverlay,
  clearDeckyFullscreenOnScreenKeyboardOpen,
  markDeckyFullscreenOnScreenKeyboardOpen,
  RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
  useDeckyFullscreenOnScreenKeyboardLifecycle,
} from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  DeckyRetroAchievementsGameIcon,
  DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH,
} from "./decky-retroachievements-game-icon";
import { filterRetroAchievementsGamesBySystem, getRetroAchievementsSystemKey } from "./decky-retroachievements-full-screen-profile-data";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
} from "./decky-retroachievements-completion-indicator";
import { scrollDeckyFocusTargetIntoView, scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { formatSteamPlaytimeMinutes, getSteamCompletionProgressGameDetailId } from "./decky-stat-helpers";
import {
  getSteamHeroArtworkSources,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH,
  STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
} from "./decky-steam-game-artwork";
import {
  clampSteamGamesPercent,
  formatSteamGamesActivityDate,
  getSteamGamesPercentage,
  selectSteamGames,
  type SteamGamesFilter,
  type SteamGamesSort,
} from "./decky-steam-full-screen-games-data";
import caretDownIconUrl from "./assets/caret-down.svg";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import crownIconUrl from "./assets/achievement-badge/crown-laurel.svg";
import searchIconUrl from "./assets/search.svg";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { jumpDeckySteamProfileTabToTop } from "./decky-steam-profile-jump-top";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import {
  readDeckyGamesPageState,
  rememberDeckyGamesControls,
  rememberDeckyGamesFocus,
  rememberDeckyGamesProfileShortcut,
  rememberDeckyGamesRenderLimit,
  rememberDeckyGamesScrollTop,
  rememberDeckyGamesSystemFilter,
  resetDeckyGamesPageState,
} from "./decky-steam-full-screen-games-state";
import { useDeckySettings } from "./decky-settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { getRetroAchievementsPlayedGameProgress } from "./decky-retroachievements-compact-profile-model";
import { steamRecipes, steamTheme } from "./steam-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

const STEAM_GAMES_FOCUS_CLASS = "achievement-companion-steam-games-focus";
const STEAM_GAMES_INITIAL_RENDER_LIMIT = 12;
const STEAM_GAMES_RENDER_STEP = 12;
const STEAM_GAMES_SEARCH_CLASS = "achievement-companion-steam-games-search";
const STEAM_GAMES_LIST_CLASS = "achievement-companion-steam-games-list";
const STEAM_GAMES_ICON_FILTERS = {
  blue: steamTheme.iconFilter.accent,
  gold: steamTheme.iconFilter.reward,
  light: steamTheme.iconFilter.primary,
} as const;
const SteamGamesSearchField = TextField as unknown as FC<
  ComponentProps<typeof TextField> & { readonly placeholder?: string }
>;

const STEAM_GAMES_SORT_OPTIONS: readonly { readonly value: SteamGamesSort; readonly label: string }[] = [
  { value: "recent", label: "Last played" },
  { value: "completion", label: "Highest completion" },
  { value: "fewest_remaining", label: "Fewest remaining" },
];

const RA_GAMES_SORT_OPTIONS: readonly { readonly value: SteamGamesSort; readonly label: string }[] = [
  { value: "recent", label: "Last unlock" },
  { value: "completion", label: "Highest completion" },
  { value: "fewest_remaining", label: "Fewest remaining" },
];

export interface DeckySteamFullScreenGamesDashboardProps {
  readonly snapshot: CompletionProgressSnapshot;
  readonly isActive?: boolean;
  readonly initialFilter?: CompletionProgressSelectionFilter;
  readonly showSteamProfileFooter?: boolean;
  readonly onBack: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenActivity: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value > 0 && value < 1 ? 1 : 0,
  })}%`;
}

function normalizeInitialFilter(
  filter: CompletionProgressSelectionFilter | undefined,
): SteamGamesFilter {
  return filter === undefined || filter === "subsets" ? "all" : filter;
}

function SteamGamesRouteStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }

    const style = ownerDocument.createElement("style");
    style.dataset["achievementCompanionSteamGamesStyles"] = "true";
    style.textContent = `
.${STEAM_GAMES_FOCUS_CLASS}.gpfocus,
.${STEAM_GAMES_FOCUS_CLASS}.gpfocuswithin,
.${STEAM_GAMES_FOCUS_CLASS}:focus,
.${STEAM_GAMES_FOCUS_CLASS}:focus-within {
  outline: none !important;
  border-color: ${steamTheme.color.accentStrong} !important;
  box-shadow: ${steamTheme.focus.insetShadow} !important;
}
.${STEAM_GAMES_SEARCH_CLASS}:focus,
.${STEAM_GAMES_SEARCH_CLASS}:focus-within {
  outline: 2px solid ${steamTheme.color.accentStrong} !important;
  outline-offset: 1px !important;
}
.${STEAM_GAMES_LIST_CLASS} {
  scrollbar-width: none;
}
.${STEAM_GAMES_LIST_CLASS}::-webkit-scrollbar {
  display: none;
}
[data-ac-ra-theme="fullscreen"] .Panel.Focusable.${STEAM_GAMES_FOCUS_CLASS}[data-ac-ra-profile-game-row="true"].gpfocus {
  background: ${steamTheme.surface.focusedContentCard} !important;
}
`;
    ownerDocument.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

type SteamGamesIconTone = keyof typeof STEAM_GAMES_ICON_FILTERS;

function IconAsset({
  src,
  size,
  tone = "blue",
}: {
  readonly src: string;
  readonly size: number;
  readonly tone?: SteamGamesIconTone;
}): JSX.Element {
  return (
    <img
      alt=""
      aria-hidden="true"
      src={src}
      style={{
        display: "block",
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        filter: STEAM_GAMES_ICON_FILTERS[tone],
      }}
    />
  );
}

function getPageStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    padding: "43px 14px 48px",
    boxSizing: "border-box",
    overflow: "hidden",
    color: steamTheme.color.textPrimary,
    background: steamTheme.surface.page,
  };
}

function getToolbarStyle(isRa: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isRa
      ? "minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr) 104px 112px"
      : "minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1.1fr) 104px 112px",
    alignItems: "stretch",
    gap: 8,
    minWidth: 0,
    padding: "4px 5px 0",
    boxSizing: "border-box",
    gridTemplateRows: "40px",
  };
}

function getSearchWrapStyle(): CSSProperties {
  return { position: "relative", minWidth: 0, height: 40 };
}

function getSearchIconStyle(): CSSProperties {
  return { position: "absolute", left: 12, top: 12, zIndex: 1, color: steamTheme.color.textSecondary, pointerEvents: "none" };
}

function getSearchFieldStyle(): CSSProperties {
  return {
    width: "100%",
    height: 40,
    minHeight: 40,
    padding: "0 12px 0 36px",
    boxSizing: "border-box",
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: 8,
    color: steamTheme.color.textPrimary,
    background: steamTheme.surface.contentStat,
    fontSize: 12,
  };
}

function getFilterButtonStyle(selected: boolean): CSSProperties {
  return {
    ...getSteamCompactAchievementFilterStyle(selected, false),
    minWidth: 0,
    height: 40,
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

function getSteamGamesToolbarFocusTarget(control: HTMLElement | null | undefined): HTMLElement | null | undefined {
  if (control?.dataset["steamGamesToolbarControl"] === "search") {
    return control.querySelector<HTMLElement>("input") ?? control;
  }
  return control;
}

function handleSteamGamesToolbarDirection(event: GamepadEvent): void {
  const button = event.detail.button;
  if (
    button !== GamepadButton.DIR_UP &&
    button !== GamepadButton.DIR_DOWN &&
    button !== GamepadButton.DIR_LEFT &&
    button !== GamepadButton.DIR_RIGHT
  ) {
    return;
  }

  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-games-dashboard]");
  const controls = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-games-toolbar-control]") ?? []);
  const firstRow = dashboard?.querySelector<HTMLElement>("[data-steam-games-row='true']");
  let target: HTMLElement | null | undefined;
  if (button === GamepadButton.DIR_UP) {
    target = source;
  } else if (button === GamepadButton.DIR_DOWN) {
    target = firstRow ?? source;
  } else {
    const sourceIndex = controls.indexOf(source);
    target = sourceIndex >= 0 ? controls[sourceIndex + (button === GamepadButton.DIR_LEFT ? -1 : 1)] ?? source : source;
  }
  if (!takeDeckySteamGamepadFocus(getSteamGamesToolbarFocusTarget(target)) && !takeDeckySteamGamepadFocus(target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function handleSteamGamesRowDirection(event: GamepadEvent): void {
  const button = event.detail.button;
  if (
    button !== GamepadButton.DIR_UP &&
    button !== GamepadButton.DIR_DOWN &&
    button !== GamepadButton.DIR_LEFT &&
    button !== GamepadButton.DIR_RIGHT
  ) {
    return;
  }

  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-games-dashboard]");
  const rows = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-games-row='true']") ?? []);
  const sourceIndex = rows.indexOf(source);
  let target: HTMLElement | null | undefined = source;
  if (button === GamepadButton.DIR_UP) {
    target = sourceIndex > 0
      ? rows[sourceIndex - 1]
      : dashboard?.querySelector<HTMLElement>("[data-steam-games-toolbar-control='search']");
  } else if (button === GamepadButton.DIR_DOWN) {
    target = rows[sourceIndex + 1] ?? source;
  }

  if (!takeDeckySteamGamepadFocus(getSteamGamesToolbarFocusTarget(target)) && !takeDeckySteamGamepadFocus(target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function getSortButtonStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    minWidth: 0,
    height: 40,
    padding: "0 10px",
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: 8,
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    background: steamTheme.surface.contentStat,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function SteamGamesStatusButton({ value, isRa, onChange, onBack }: {
  readonly value: SteamGamesFilter;
  readonly isRa: boolean;
  readonly onChange: (value: SteamGamesFilter) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const buttonRef = useRef<HTMLDivElement>(null);
  const activeMenuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterMenuCancelRef = useRef<(() => void) | undefined>(undefined);
  const options: readonly { readonly value: SteamGamesFilter; readonly label: string }[] = [
    { value: "all", label: "All games" },
    { value: "played", label: "Played" },
    { value: "remaining", label: "Achievements remaining" },
    { value: "unfinished", label: isRa ? "In Progress" : "Unfinished" },
    ...(isRa ? [
      { value: "completed" as const, label: "Any award" },
      { value: "beaten" as const, label: "Beaten" },
      { value: "mastered" as const, label: "Mastered" },
    ] : [
      { value: "mastered" as const, label: "Perfected" },
      { value: "beaten" as const, label: "No achievements" },
    ]),
  ];
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "All games";
  const closeMenu = (): void => {
    activeMenuRef.current?.Hide();
    activeMenuRef.current = undefined;
    unregisterMenuCancelRef.current?.();
    unregisterMenuCancelRef.current = undefined;
  };
  const openMenu = (): void => {
    if (activeMenuRef.current !== undefined || buttonRef.current === null) return;
    activeMenuRef.current = showContextMenu(
      <Menu label="Filter games by status" onCancel={closeMenu}>
        {options.map((option) => <MenuItem key={option.value} selected={option.value === value}
          onClick={() => { onChange(option.value); closeMenu(); }}>{option.label}</MenuItem>)}
      </Menu>,
      buttonRef.current,
      { bModal: true, bMatchWidth: true },
    );
    unregisterMenuCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => closeMenu, []);
  return <Focusable ref={buttonRef} className={STEAM_GAMES_FOCUS_CLASS} noFocusRing role="button"
    aria-label={`Status: ${selectedLabel}`} onActivate={openMenu} onClick={openMenu}
    onGamepadDirection={handleSteamGamesToolbarDirection} data-steam-games-toolbar-control="status"
    onCancel={() => { if (activeMenuRef.current !== undefined) closeMenu(); else onBack(); }}
    style={getSortButtonStyle()}>
    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{selectedLabel}</span>
    <IconAsset size={12} src={caretDownIconUrl} tone="light" />
  </Focusable>;
}

function SteamGamesSortButton({
  value,
  isRa,
  onChange,
  onBack,
}: {
  readonly value: SteamGamesSort;
  readonly isRa: boolean;
  readonly onChange: (value: SteamGamesSort) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const buttonRef = useRef<HTMLDivElement>(null);
  const activeMenuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterMenuCancelRef = useRef<(() => void) | undefined>(undefined);
  const options = isRa ? RA_GAMES_SORT_OPTIONS : STEAM_GAMES_SORT_OPTIONS;
  const selectedValue = value === "oldest" ? "recent" : value;
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? (isRa ? "Last unlock" : "Last played");

  const closeMenu = (): void => {
    activeMenuRef.current?.Hide();
    activeMenuRef.current = undefined;
    unregisterMenuCancelRef.current?.();
    unregisterMenuCancelRef.current = undefined;
  };
  const openMenu = (): void => {
    if (activeMenuRef.current !== undefined || buttonRef.current === null) {
      return;
    }

    const menu = showContextMenu(
      <Menu label="Sort games" onCancel={closeMenu}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === selectedValue}
            onClick={() => {
              onChange(option.value);
              closeMenu();
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>,
      buttonRef.current,
      { bModal: true, bMatchWidth: true },
    );
    activeMenuRef.current = menu;
    unregisterMenuCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };

  useEffect(() => closeMenu, []);

  return (
      <Focusable
        ref={buttonRef}
        className={STEAM_GAMES_FOCUS_CLASS}
        noFocusRing
        role="button"
        aria-label={`Sort: ${selectedLabel}`}
        onActivate={openMenu}
        onClick={openMenu}
        onGamepadDirection={handleSteamGamesToolbarDirection}
        data-steam-games-toolbar-control="sort"
        onCancel={() => {
          if (activeMenuRef.current !== undefined) {
            closeMenu();
          } else {
            onBack();
          }
        }}
        style={getSortButtonStyle()}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{selectedLabel}</span>
        <IconAsset size={12} src={caretDownIconUrl} tone="light" />
      </Focusable>
  );
}

function GamesSortToggle({ value, onChange, onBack }: {
  readonly value: SteamGamesSort;
  readonly onChange: (value: SteamGamesSort) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const oldest = value === "oldest";
  const toggle = (): void => onChange(value === "recent" ? "oldest" : "recent");
  return <Focusable
    className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
    noFocusRing
    role="button"
    aria-label={oldest ? "Sort: oldest first. Select for newest first." : value === "recent"
      ? "Sort: newest first. Select for oldest first."
      : "Select to sort by newest activity."}
    aria-pressed={oldest}
    preferredFocus={oldest}
    data-steam-games-toolbar-control="chronology"
    onActivate={toggle}
    onClick={toggle}
    onCancel={onBack}
    onGamepadDirection={handleSteamGamesToolbarDirection}
    onFocus={() => setFocused(true)}
    onGamepadFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    onGamepadBlur={() => setFocused(false)}
    style={{
      ...getSteamCompactAchievementFilterStyle(oldest, focused),
      width: "100%",
      minWidth: 0,
      minHeight: 36,
      boxSizing: "border-box",
      padding: "7px 10px",
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >{oldest ? "↑ Oldest" : "↓ Newest"}</Focusable>;
}

function RetroAchievementsSystemButton({
  systems,
  selectedSystemId,
  onChange,
  onBack,
}: {
  readonly systems: readonly { readonly systemId: string; readonly title: string }[];
  readonly selectedSystemId: string | undefined;
  readonly onChange: (system: { readonly systemId: string; readonly title: string } | undefined) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const buttonRef = useRef<HTMLDivElement>(null);
  const activeMenuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterMenuCancelRef = useRef<(() => void) | undefined>(undefined);
  const selectedLabel = systems.find((system) => system.systemId === selectedSystemId)?.title ?? "All Systems";
  const closeMenu = (): void => {
    activeMenuRef.current?.Hide();
    activeMenuRef.current = undefined;
    unregisterMenuCancelRef.current?.();
    unregisterMenuCancelRef.current = undefined;
  };
  const openMenu = (): void => {
    if (activeMenuRef.current !== undefined || buttonRef.current === null) return;
    activeMenuRef.current = showContextMenu(
      <Menu label="Filter by system" onCancel={closeMenu}>
        <MenuItem selected={selectedSystemId === undefined} onClick={() => { onChange(undefined); closeMenu(); }}>All Systems</MenuItem>
        {systems.map((system) => (
          <MenuItem
            key={system.systemId}
            selected={system.systemId === selectedSystemId}
            onClick={() => { onChange(system); closeMenu(); }}
          >
            {system.title}
          </MenuItem>
        ))}
      </Menu>,
      buttonRef.current,
      { bModal: true, bMatchWidth: true },
    );
    unregisterMenuCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => closeMenu, []);
  return (
    <Focusable
      ref={buttonRef}
      className={STEAM_GAMES_FOCUS_CLASS}
      noFocusRing
      role="button"
      aria-label={`Filter games by system: ${selectedLabel}`}
      onActivate={openMenu}
      onClick={openMenu}
      onGamepadDirection={handleSteamGamesToolbarDirection}
      data-steam-games-toolbar-control="system"
      onCancel={() => { if (activeMenuRef.current !== undefined) closeMenu(); else onBack(); }}
      style={getSortButtonStyle()}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{selectedLabel}</span>
      <IconAsset size={12} src={caretDownIconUrl} tone="light" />
    </Focusable>
  );
}

function getGameListStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    gap: 4,
    minHeight: 0,
    marginTop: 8,
    overflowX: "hidden",
    overflowY: "auto",
    padding: "4px 5px 5px",
    boxSizing: "border-box",
  };
}

function getGameRowStyle(providerId: string): CSSProperties {
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  return {
    ...steamRecipes.interactiveRow("fullscreen"),
    display: "grid",
    gridTemplateColumns: `${isRa ? DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH : STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px minmax(0, 1fr) minmax(155px, 0.55fr) 16px`,
    alignItems: "center",
    gap: 12,
    flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`,
    minWidth: 0,
    minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
    scrollMarginBlock: 0,
    padding: "2px 10px 2px 3px",
    boxSizing: "border-box",
  };
}

function getTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    color: steamTheme.color.textPrimary,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.2,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getProgressMetaStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "metadata"), minWidth: 0, color: steamTheme.color.textPrimary, fontSize: 12, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" };
}

function getSecondaryMetaStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "caption"), color: steamTheme.color.textSecondary, fontSize: 11, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getProgressTrackStyle(): CSSProperties {
  return { ...steamRecipes.progressTrack, height: 10 };
}

function SteamGamesRow({
  elementRef,
  game,
  onOpenGameDetail,
  onBack,
  providerId,
  listRef,
  mode,
  rowIndex,
  showSystemName,
  onRevealMore,
}: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly game: NormalizedGame;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onBack: () => void;
  readonly providerId: string;
  readonly listRef: { readonly current: HTMLDivElement | null };
  readonly mode: RetroAchievementsAchievementMode;
  readonly rowIndex: number;
  readonly showSystemName: boolean;
  readonly onRevealMore?: () => boolean;
}): JSX.Element {
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  const displaySummary = isRa
    ? getRetroAchievementsPlayedGameProgress(game, mode)
    : game.summary;
  const totalCount = displaySummary?.totalCount ?? game.summary.totalCount;
  const hasVerifiedProgress = isRa || game.scanStatus === "scanned";
  const completionPercent = hasVerifiedProgress && totalCount !== undefined && totalCount > 0 && displaySummary?.completionPercent !== undefined
    ? clampSteamGamesPercent(displaySummary.completionPercent)
    : hasVerifiedProgress && displaySummary?.totalCount !== undefined && displaySummary.totalCount > 0
      ? getSteamGamesPercentage(displaySummary.unlockedCount, displaySummary.totalCount)
      : undefined;
  const progressLabel = !isRa && game.scanStatus === "failed" ? "Scan unavailable"
    : !isRa && game.scanStatus === "no-achievements" ? "No achievements"
    : !hasVerifiedProgress ? "Progress unavailable"
    : totalCount !== undefined && totalCount > 0
      ? displaySummary === undefined ? "Progress unavailable" : `${formatCount(displaySummary.unlockedCount)} / ${formatCount(totalCount)} achievements`
      : totalCount === 0 ? "No achievements"
      : displaySummary !== undefined && displaySummary.unlockedCount > 0
        ? `${formatCount(displaySummary.unlockedCount)} unlocked achievements`
        : "Achievement total unavailable";
  const isPerfected = !isRa && game.status === "mastered";
  const raAward = isRa ? getRetroAchievementsCompletionIndicatorState(game) : undefined;
  const visibleRaAward = mode === "both" || raAward?.endsWith(mode) === true ? raAward : undefined;
  const artwork = getSteamHeroArtworkSources(game);
  const systemName = isRa && showSystemName ? getRetroAchievementsSystemKey(game)?.title ?? game.platformLabel : undefined;
  const awardLabel = visibleRaAward === undefined ? undefined : formatRetroAchievementsCompletionIndicatorLabel(visibleRaAward);
  const playtime = isRa ? undefined : formatSteamPlaytimeMinutes(game.playtimeForeverMinutes);
  const context = isRa
    ? [systemName, awardLabel ?? (game.lastUnlockAt === undefined ? undefined : `Last unlock ${formatSteamGamesActivityDate(game, providerId)}`)]
      .filter((value): value is string => value !== undefined).join(" · ")
    : [playtime === undefined ? undefined : `${playtime} played`, game.lastPlayedAt === undefined
      ? undefined : `Last played ${formatSteamGamesActivityDate(game, providerId)}`]
      .filter((value): value is string => value !== undefined).join(" · ");
  const openGame = (): void => {
    rememberDeckyGamesFocus(providerId, game.gameId);
    rememberDeckyGamesScrollTop(providerId, listRef.current?.scrollTop ?? 0);
    onOpenGameDetail(providerId === RETROACHIEVEMENTS_PROVIDER_ID ? game.gameId : getSteamCompletionProgressGameDetailId(game));
  };
  const focusGeneration = useRef(0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const scrollFocusedRow = (element: HTMLElement): void => {
    const generation = ++focusGeneration.current;
    const isStillFocused = (): boolean => focusGeneration.current === generation;
    if (rowIndex === 0 && listRef.current !== null) {
      scrollDeckyFocusTargetToTop(rowRef.current ?? element, isStillFocused, listRef.current);
      rememberDeckyGamesScrollTop(providerId, 0);
    } else {
      scrollDeckyFocusTargetIntoView(rowRef.current ?? element, listRef.current, isStillFocused);
    }
  };

  return (
    <Focusable
      ref={(node) => { rowRef.current = node; elementRef?.(node); }}
      className={STEAM_GAMES_FOCUS_CLASS}
      noFocusRing
      role="button"
      aria-label={`Open ${game.title}`}
      onActivate={openGame}
      onClick={openGame}
      onCancel={onBack}
      onFocus={(event) => { rememberDeckyGamesFocus(providerId, game.gameId); scrollFocusedRow(event.currentTarget); }}
      onGamepadFocus={(event) => { rememberDeckyGamesFocus(providerId, game.gameId); scrollFocusedRow(event.currentTarget as HTMLElement); }}
      onBlur={() => { focusGeneration.current += 1; }}
      onGamepadBlur={() => { focusGeneration.current += 1; }}
      onGamepadDirection={(event) => {
        if (event.detail.button === GamepadButton.DIR_DOWN && onRevealMore?.()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        handleSteamGamesRowDirection(event);
      }}
      style={getGameRowStyle(providerId)}
      data-steam-games-row="true"
      data-steam-games-row-index={rowIndex}
      {...(providerId === RETROACHIEVEMENTS_PROVIDER_ID ? { "data-ac-ra-profile-game-row": "true" } : {})}
    >
      {providerId === RETROACHIEVEMENTS_PROVIDER_ID ? <DeckyRetroAchievementsGameIcon
        game={game}
        src={game.coverImageUrl}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
      /> : <DeckyGameArtwork
        compact
        {...(game.appid !== undefined ? { steamAppId: game.appid } : {})}
        {...(artwork.fallbackSrc !== undefined ? { fallbackSrc: artwork.fallbackSrc } : {})}
        height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        {...(artwork.src !== undefined ? { src: artwork.src } : {})}
        title={game.title}
        width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}
      />}

      <div style={{ minWidth: 0 }}>
        <div style={getTitleStyle()}>{game.title}</div>
        {context.length > 0 ? <div style={getSecondaryMetaStyle()}>{context}</div> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <div style={{ ...getProgressMetaStyle(), display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{progressLabel}</span>
          {completionPercent !== undefined ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: steamTheme.color.textPrimary, flex: "0 0 auto" }}>
            {formatPercent(completionPercent)}{isPerfected ? <IconAsset size={13} src={crownIconUrl} tone="gold" /> : null}
          </span> : null}
        </div>
        {completionPercent !== undefined ? <div style={getProgressTrackStyle()}>
          <div style={{ width: `${completionPercent}%`, height: "100%", borderRadius: 999, background: qamTheme.surface.progressFill }} />
        </div> : null}
      </div>

      <IconAsset size={17} src={chevronRightIconUrl} tone="light" />
    </Focusable>
  );
}

export function DeckySteamFullScreenGamesDashboard({
  snapshot,
  isActive = true,
  initialFilter,
  showSteamProfileFooter = true,
  onBack,
  onOpenProfile,
  onOpenActivity,
  onOpenGameDetail,
}: DeckySteamFullScreenGamesDashboardProps): JSX.Element {
  const providerId = snapshot.providerId;
  const deckySettings = useDeckySettings();
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  const mode: RetroAchievementsAchievementMode = isRa
    ? deckySettings.retroAchievementsAchievementMode
    : "both";
  const shouldUseRequestedFilter = initialFilter !== undefined && initialFilter !== "all";
  const [initialPageState] = useState(() => {
    if (shouldUseRequestedFilter) {
      rememberDeckyGamesProfileShortcut(providerId, normalizeInitialFilter(initialFilter));
    }
    return readDeckyGamesPageState(providerId);
  });
  const dashboardRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchControlRef = useRef<HTMLDivElement>(null);
  const restorationTargetRef = useRef<HTMLDivElement | null>(null);
  const appendedGameFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const [appendedGameIdToFocus, setAppendedGameIdToFocus] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<SteamGamesFilter>(initialPageState.filter);
  const [query, setQuery] = useState(initialPageState.query);
  const [sort, setSort] = useState<SteamGamesSort>(initialPageState.sort);
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>(isRa ? initialPageState.system?.systemId : undefined);
  const [renderLimit, setRenderLimit] = useState(initialPageState.renderLimit);
  const hasMountedControls = useRef(false);
  const systems = useMemo(() => {
    const unique = new Map<string, { readonly systemId: string; readonly title: string }>();
    if (isRa) for (const game of snapshot.games) {
      const system = getRetroAchievementsSystemKey(game);
      if (system !== undefined) unique.set(system.systemId, system);
    }
    return [...unique.values()].sort((left, right) => left.title.localeCompare(right.title));
  }, [isRa, snapshot.games]);
  const scopedGames = useMemo(() => filterRetroAchievementsGamesBySystem(snapshot.games, selectedSystemId), [selectedSystemId, snapshot.games]);
  const visibleGames = useMemo(
    () => selectSteamGames({ games: scopedGames, filter, query, sort, mode }),
    [filter, mode, query, scopedGames, sort],
  );
  const renderedGames = visibleGames.slice(0, renderLimit);

  useDeckyFullscreenOnScreenKeyboardLifecycle(dashboardRef);

  useEffect(() => {
    if (!hasMountedControls.current) {
      hasMountedControls.current = true;
      return;
    }
    setRenderLimit(STEAM_GAMES_INITIAL_RENDER_LIMIT);
    rememberDeckyGamesControls(providerId, filter, query, sort, mode);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
  }, [filter, mode, providerId, query, sort]);
  const hasActiveFilters = filter !== "all" || query.trim().length > 0 || sort !== "recent" || selectedSystemId !== undefined;

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    const dashboard = dashboardRef.current;
    const ownerWindow = dashboard?.ownerDocument.defaultView;
    if (dashboard === null || dashboard === undefined || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    const frame = ownerWindow.requestAnimationFrame(() => {
      // Like the full-screen game page, a visible action must own GamepadUI
      // focus before the shared footer can receive the first L1/R1 press.
      const initialFocusTarget = restorationTargetRef.current
        ?? dashboard.querySelector<HTMLElement>("[data-steam-games-row='true']")
        ?? dashboard.querySelector<HTMLElement>("[role='button']");
      if (initialFocusTarget === null) {
        return;
      }

      if (!dashboard.contains(dashboard.ownerDocument.activeElement)) {
        takeDeckySteamGamepadFocus(initialFocusTarget);
        if (initialFocusTarget.dataset["steamGamesRowIndex"] === "0" && listRef.current !== null) {
          listRef.current.scrollTop = 0;
        } else if (initialPageState.scrollTop > 0 && listRef.current !== null) {
          listRef.current.scrollTop = initialPageState.scrollTop;
        } else {
          initialFocusTarget.scrollIntoView({ block: "center", inline: "nearest" });
        }
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  useLayoutEffect(() => {
    if (appendedGameIdToFocus === undefined || appendedGameFocusTargetRef.current === null) {
      return;
    }

    // Down on the final row expands the list, so hand GamepadUI focus to the
    // first appended row after React commits it.
    const target = appendedGameFocusTargetRef.current;
    takeDeckySteamGamepadFocus(target);
    scrollDeckyFocusTargetIntoView(target, listRef.current, () => target.isConnected &&
      (target.ownerDocument.activeElement === target || target.classList.contains("gpfocus")));
    setAppendedGameIdToFocus(undefined);
  }, [appendedGameIdToFocus, renderedGames]);

  const revealMoreGames = (focusAppendedRow: boolean): boolean => {
    if (renderedGames.length >= visibleGames.length) return false;
    const firstAppendedGame = visibleGames[renderedGames.length];
    if (focusAppendedRow && firstAppendedGame !== undefined) {
      setAppendedGameIdToFocus(firstAppendedGame.gameId);
    }
    setRenderLimit((current) => {
      const next = Math.min(visibleGames.length, current + STEAM_GAMES_RENDER_STEP);
      rememberDeckyGamesRenderLimit(providerId, next);
      return next;
    });
    return true;
  };
  const selectSystem = (system: { readonly systemId: string; readonly title: string } | undefined): void => {
    rememberDeckyGamesSystemFilter(providerId, system);
    setSelectedSystemId(system?.systemId);
    setRenderLimit(STEAM_GAMES_INITIAL_RENDER_LIMIT);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
  };
  const clearFilters = (): void => {
    if (!hasActiveFilters) return;
    resetDeckyGamesPageState(providerId);
    rememberDeckyGamesControls(providerId, "all", "", "recent", mode);
    setQuery("");
    setFilter("all");
    setSort("recent");
    setSelectedSystemId(undefined);
    setRenderLimit(STEAM_GAMES_INITIAL_RENDER_LIMIT);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
  };

  return (
    <>
      <main
        ref={dashboardRef}
        {...(isRa ? { "data-ac-ra-theme": "fullscreen" } : { "data-ac-steam-theme": "fullscreen" })}
        data-steam-full-screen-games-dashboard
        style={getPageStyle()}
      >
        <SteamGamesRouteStyles />

        <Focusable
          flow-children="vertical"
          navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
          noFocusRing
          tabIndex={-1}
          style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0 }}
        >
        <Focusable
          flow-children="left-right"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          noFocusRing
          tabIndex={-1}
          style={getToolbarStyle(isRa)}
        >
          <Focusable
            ref={searchControlRef}
            className={STEAM_GAMES_FOCUS_CLASS}
            flow-children="vertical"
            noFocusRing
            tabIndex={-1}
            onCancel={onBack}
            onGamepadDirection={handleSteamGamesToolbarDirection}
            data-steam-games-toolbar-control="search"
            style={getSearchWrapStyle()}
          >
            <span style={getSearchIconStyle()}>
              <IconAsset size={14} src={searchIconUrl} tone="light" />
            </span>
            <SteamGamesSearchField
              aria-label="Search your games"
              className={STEAM_GAMES_SEARCH_CLASS}
              placeholder="Search your games…"
              value={query}
              onClick={(event) => {
                markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument);
              }}
              onBlur={(event) => clearDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)}
              onChange={(event) => { setQuery(event.currentTarget.value); }}
              style={getSearchFieldStyle()}
            />
          </Focusable>

          <SteamGamesStatusButton value={filter} isRa={isRa} onBack={onBack} onChange={setFilter} />
          {isRa ? <RetroAchievementsSystemButton systems={systems} selectedSystemId={selectedSystemId} onChange={selectSystem} onBack={onBack} /> : null}
          <SteamGamesSortButton value={sort} isRa={isRa} onBack={onBack} onChange={setSort} />
          <GamesSortToggle value={sort} onChange={setSort} onBack={onBack} />
          <Focusable className={STEAM_GAMES_FOCUS_CLASS} noFocusRing role="button"
            aria-label="Clear Games filters" aria-disabled={!hasActiveFilters}
            onActivate={clearFilters} onClick={clearFilters} onCancel={onBack}
            onGamepadDirection={handleSteamGamesToolbarDirection}
            data-steam-games-toolbar-control="clear"
            style={{ ...getFilterButtonStyle(false), opacity: hasActiveFilters ? 1 : 0.5 }}>
            Clear Filters
          </Focusable>
        </Focusable>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 5px 0", color: steamTheme.color.textSecondary, fontSize: 11, lineHeight: 1.2 }}>
          <span aria-live="polite">{formatCount(visibleGames.length)} of {formatCount(snapshot.games.length)} games</span>
        </div>

        <Focusable
          ref={listRef}
          aria-live="polite"
          data-steam-games-list
          className={STEAM_GAMES_LIST_CLASS}
          flow-children="vertical"
          navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
          noFocusRing
          tabIndex={-1}
          onScroll={(event) => {
            const list = event.currentTarget;
            rememberDeckyGamesScrollTop(providerId, list.scrollTop);
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - STEAM_FULLSCREEN_GAME_ROW_HEIGHT) revealMoreGames(false);
          }}
          style={getGameListStyle()}
        >
          {visibleGames.length > 0 ? <>
            {renderedGames.map((game, rowIndex) => (
            <SteamGamesRow
              key={game.gameId}
              elementRef={initialPageState.focusGameId === game.gameId || appendedGameIdToFocus === game.gameId
                ? (node) => {
                    if (initialPageState.focusGameId === game.gameId) restorationTargetRef.current = node;
                    if (appendedGameIdToFocus === game.gameId) appendedGameFocusTargetRef.current = node;
                  }
                : undefined}
              game={game}
              providerId={providerId}
              listRef={listRef}
              mode={mode}
              rowIndex={rowIndex}
              showSystemName={selectedSystemId === undefined}
              {...(rowIndex === renderedGames.length - 1 && renderedGames.length < visibleGames.length
                ? { onRevealMore: () => revealMoreGames(true) } : {})}
              onBack={onBack}
              onOpenGameDetail={onOpenGameDetail}
            />
            ))}
          </> : (
            <div
              style={{
                display: "flex",
                flex: "1 1 auto",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 90,
                border: `1px solid ${steamTheme.color.borderSubtle}`,
                borderRadius: 8,
                color: steamTheme.color.textSecondary,
                background: steamTheme.surface.contentCard,
                fontSize: 12,
              }}
            >
              {snapshot.games.length === 0 ? "No games available." : "No games match the current filters."}
            </div>
          )}
        </Focusable>
        </Focusable>
      </main>

      {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay
        activeNavigationItemId="games"
        ariaLabel={`${isRa ? "RetroAchievements" : "Steam"} profile navigation`}
        navigationItems={isRa ? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        secondaryActionLabel="Top"
        onSecondaryAction={(document) => { jumpDeckySteamProfileTabToTop(document, "games"); }}
        onNextNavigationItem={onOpenActivity}
        onPreviousNavigationItem={onOpenProfile}
      /> : null}
    </>
  );
}
