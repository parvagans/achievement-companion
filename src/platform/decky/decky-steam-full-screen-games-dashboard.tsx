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
  type FocusableProps,
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
  type RefObject,
  type RefCallback,
} from "react";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import type { CompletionProgressSort } from "./decky-completion-progress-grouping";
import {
  DeckyFullScreenFooterOverlay,
  markDeckyFullscreenOnScreenKeyboardOpen,
  RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
  useDeckyFullscreenOnScreenKeyboardLifecycle,
} from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
} from "./decky-retroachievements-completion-indicator";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { formatSteamPlaytimeMinutes, getSteamCompletionProgressGameDetailId } from "./decky-stat-helpers";
import {
  getSteamFullscreenGameArtworkUrl,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH,
  STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
} from "./decky-steam-game-artwork";
import {
  clampSteamGamesPercent,
  getSteamGamesPercentage,
  selectSteamGames,
  summarizeSteamGamesDashboard,
  type SteamGamesDashboardSummary,
  type SteamGamesFilter,
} from "./decky-steam-full-screen-games-data";
import barChartIconUrl from "./assets/bar-chart.svg";
import calendarIconUrl from "./assets/calendar.svg";
import caretDownIconUrl from "./assets/caret-down.svg";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import clockIconUrl from "./assets/clock.svg";
import crownIconUrl from "./assets/crown.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import listIconUrl from "./assets/list.svg";
import prohibitedIconUrl from "./assets/prohibited.svg";
import searchIconUrl from "./assets/search.svg";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { jumpDeckySteamProfileTabToTop } from "./decky-steam-profile-jump-top";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import {
  readDeckyGamesPageState,
  rememberDeckyGamesControls,
  rememberDeckyGamesFocus,
  rememberDeckyGamesRenderLimit,
  rememberDeckyGamesScrollTop,
} from "./decky-steam-full-screen-games-state";
import { useDeckySettings } from "./decky-settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { raTheme } from "./ra-theme";
import { getRetroAchievementsPlayedGameProgress } from "./decky-retroachievements-compact-profile-model";
import { steamRecipes, steamTheme } from "./steam-theme";

const STEAM_GAMES_FOCUS_CLASS = "achievement-companion-steam-games-focus";
const STEAM_GAMES_INITIAL_RENDER_LIMIT = 12;
const STEAM_GAMES_RENDER_STEP = 12;
const STEAM_GAMES_SEARCH_CLASS = "achievement-companion-steam-games-search";
const STEAM_GAMES_LIST_CLASS = "achievement-companion-steam-games-list";
const STEAM_GAMES_ICON_FILTERS = {
  blue: steamTheme.iconFilter.accent,
  gold: steamTheme.iconFilter.reward,
  light: steamTheme.iconFilter.primary,
  red: steamTheme.iconFilter.danger,
} as const;
const SteamGamesSearchField = TextField as unknown as FC<
  ComponentProps<typeof TextField> & { readonly placeholder?: string }
>;

const STEAM_GAMES_SORT_OPTIONS: readonly {
  readonly value: CompletionProgressSort;
  readonly label: string;
}[] = [
  { value: "recent", label: "Most Recent" },
  { value: "title", label: "Title" },
  { value: "completion", label: "Completion %" },
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

type SteamGamesGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value > 0 && value < 1 ? 1 : 0,
  })}%`;
}

function formatModeProgressLabel(
  label: "Hardcore" | "Softcore",
  summary: NormalizedGame["summary"] | undefined,
): string | undefined {
  if (summary === undefined) return undefined;
  return summary.totalCount === undefined
    ? `${label} ${formatCount(summary.unlockedCount)} unlocked`
    : `${label} ${formatCount(summary.unlockedCount)}/${formatCount(summary.totalCount)}`;
}

function formatLastPlayed(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Never";
  }

  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
.${STEAM_GAMES_FOCUS_CLASS}[data-steam-games-filter].gpfocus[aria-pressed="true"] {
  box-shadow: ${steamTheme.focus.insetShadow}, ${steamTheme.selection.compactUnderline} !important;
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

function getSectionTitleStyle(): CSSProperties {
  return {
    marginBottom: 5,
    color: "#a9b8c9",
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: "0.04em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
}

function getSummaryGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr)) minmax(230px, 2.2fr)",
    gap: 6,
    minWidth: 0,
  };
}

function getMetricCardStyle(): CSSProperties {
  return {
    ...steamRecipes.metricTile("fullscreen"),
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr)",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    minHeight: 58,
    padding: "7px 9px",
    boxSizing: "border-box",
  };
}

function getMetricValueStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "title"), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 700, lineHeight: 1 };
}

function getMetricLabelStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "caption"), color: steamTheme.color.accent, fontSize: 9, lineHeight: 1.2, marginTop: 4, whiteSpace: "nowrap" };
}

function getMetricHelperStyle(): CSSProperties {
  return { color: "#9fb2c5", fontSize: 8, lineHeight: 1.15, marginTop: 2, whiteSpace: "nowrap" };
}

function MetricCard({
  iconUrl,
  iconTone = "blue",
  value,
  label,
  helper,
}: {
  readonly iconUrl: string;
  readonly iconTone?: SteamGamesIconTone;
  readonly value: string;
  readonly label: string;
  readonly helper?: string;
}): JSX.Element {
  return (
    <div style={getMetricCardStyle()}>
      <IconAsset size={27} src={iconUrl} tone={iconTone} />
      <div style={{ minWidth: 0 }}>
        <div style={getMetricValueStyle()}>{value}</div>
        <div style={getMetricLabelStyle()}>{label}</div>
        {helper !== undefined ? <div style={getMetricHelperStyle()}>{helper}</div> : null}
      </div>
    </div>
  );
}

function OverallProgressCard({ summary }: { readonly summary: SteamGamesDashboardSummary }): JSX.Element {
  return (
    <div style={{ ...getMetricCardStyle(), display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
        <div style={{ ...steamRecipes.text("fullscreen", "metadata"), color: steamTheme.color.accent, fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Completion Progress</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
        <div style={{ ...steamRecipes.progressTrack, height: 10 }}>
          <div
            style={{
              width: `${summary.completionPercent}%`,
              height: "100%",
              borderRadius: 999,
              background: steamRecipes.progressFill.completion,
            }}
          />
        </div>
        <span style={{ ...steamRecipes.text("fullscreen", "body"), fontWeight: 700 }}>
          {formatPercent(summary.completionPercent)}
        </span>
      </div>
      <div style={{ color: "#a7bdd2", fontSize: 9, lineHeight: 1 }}>
        {`${formatCount(summary.unlockedAchievements)} / ${formatCount(summary.totalAchievements)} achievements unlocked`}
      </div>
    </div>
  );
}

function getToolbarStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "180px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    marginTop: 12,
  };
}

function getSearchWrapStyle(): CSSProperties {
  return { position: "relative", minWidth: 0, height: 28 };
}

function getSearchIconStyle(): CSSProperties {
  return { position: "absolute", left: 10, top: 7, zIndex: 1, color: "#eef7ff", pointerEvents: "none" };
}

function getSearchFieldStyle(): CSSProperties {
  return {
    width: "100%",
    height: 28,
    minHeight: 28,
    padding: "0 10px 0 30px",
    boxSizing: "border-box",
    border: "1px solid rgba(65, 132, 177, 0.32)",
    borderRadius: 8,
    color: "#eef5fb",
    background: "rgba(10, 30, 43, 0.96)",
    fontSize: 10,
  };
}

function getFilterGroupStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5, minWidth: 0 };
}

function getFilterButtonStyle(selected: boolean): CSSProperties {
  return {
    ...getSteamCompactAchievementFilterStyle(selected, false),
    minWidth: 0,
    height: 28,
    padding: "0 7px",
    boxSizing: "border-box",
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
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
  let target: HTMLElement | null | undefined;
  if (button === GamepadButton.DIR_UP) {
    target = source;
  } else if (button === GamepadButton.DIR_DOWN) {
    target = dashboard?.querySelector<HTMLElement>("[data-steam-games-row='true']") ?? source;
  } else {
    const controls = Array.from(
      dashboard?.querySelectorAll<HTMLElement>("[data-steam-games-toolbar-control]") ?? [],
    );
    const sourceIndex = controls.indexOf(source);
    target = controls[sourceIndex + (button === GamepadButton.DIR_LEFT ? -1 : 1)] ?? source;
  }
  if (!takeDeckySteamGamepadFocus(target)) {
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
    target = rows[sourceIndex + 1]
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-games-show-more='true']")
      ?? source;
  }

  if (!takeDeckySteamGamepadFocus(target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function handleSteamGamesShowMoreDirection(event: GamepadEvent): void {
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
  const rows = Array.from(
    source.closest<HTMLElement>("[data-steam-full-screen-games-dashboard]")
      ?.querySelectorAll<HTMLElement>("[data-steam-games-row='true']") ?? [],
  );
  const target = button === GamepadButton.DIR_UP ? rows[rows.length - 1] : source;
  if (!takeDeckySteamGamepadFocus(target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function SteamGamesFilterButton({
  label,
  filter,
  selected,
  onSelect,
  onBack,
}: {
  readonly label: string;
  readonly filter: SteamGamesFilter;
  readonly selected: boolean;
  readonly onSelect: (filter: SteamGamesFilter) => void;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <Focusable
      className={STEAM_GAMES_FOCUS_CLASS}
      noFocusRing
      role="button"
      aria-label={label}
      aria-pressed={selected}
      data-steam-games-filter={filter}
      preferredFocus={selected}
      onActivate={() => { onSelect(filter); }}
      onClick={() => { onSelect(filter); }}
      onCancel={onBack}
      onGamepadDirection={handleSteamGamesToolbarDirection}
      data-steam-games-toolbar-control="true"
      style={getFilterButtonStyle(selected)}
    >
      {label}
    </Focusable>
  );
}

function getSortButtonStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: 105,
    height: 28,
    padding: "0 9px",
    border: "1px solid rgba(71, 126, 162, 0.34)",
    borderRadius: 8,
    boxSizing: "border-box",
    color: "#edf6fd",
    background: "rgba(10, 29, 42, 0.9)",
    fontSize: 9,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function SteamGamesSortButton({
  value,
  onChange,
  onBack,
}: {
  readonly value: CompletionProgressSort;
  readonly onChange: (value: CompletionProgressSort) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const buttonRef = useRef<HTMLDivElement>(null);
  const activeMenuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterMenuCancelRef = useRef<(() => void) | undefined>(undefined);
  const selectedLabel = STEAM_GAMES_SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Most Recent";

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
        {STEAM_GAMES_SORT_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
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
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#b8c8d8", fontSize: 9, whiteSpace: "nowrap" }}>Sort by</span>
      <Focusable
        ref={buttonRef}
        className={STEAM_GAMES_FOCUS_CLASS}
        noFocusRing
        role="button"
        aria-label={`Sort by ${selectedLabel}`}
        onActivate={openMenu}
        onClick={openMenu}
        onGamepadDirection={handleSteamGamesToolbarDirection}
        data-steam-games-toolbar-control="true"
        onCancel={() => {
          if (activeMenuRef.current !== undefined) {
            closeMenu();
          } else {
            onBack();
          }
        }}
        style={getSortButtonStyle()}
      >
        <span>{selectedLabel}</span>
        <IconAsset size={12} src={caretDownIconUrl} tone="light" />
      </Focusable>
    </div>
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

function getGameRowStyle(): CSSProperties {
  return {
    ...steamRecipes.interactiveRow("fullscreen"),
    display: "grid",
    gridTemplateColumns: `${STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px minmax(165px, 1.55fr) minmax(145px, 1.45fr) 96px 116px 16px`,
    alignItems: "center",
    gap: 8,
    flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`,
    minWidth: 0,
    minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
    padding: "2px 7px 2px 3px",
    boxSizing: "border-box",
  };
}

function getTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    color: steamTheme.color.textPrimary,
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.15,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProgressMetaStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "metadata"), color: steamTheme.color.textPrimary, fontSize: 10, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" };
}

function getSecondaryMetaStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "caption"), fontSize: 9.5, lineHeight: 1, whiteSpace: "nowrap" };
}

function getMetadataCellStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr)",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    paddingLeft: 8,
    borderLeft: "1px solid rgba(76, 148, 187, 0.22)",
    boxSizing: "border-box",
  };
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
}: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly game: NormalizedGame;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onBack: () => void;
  readonly providerId: string;
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly mode: RetroAchievementsAchievementMode;
}): JSX.Element {
  const displaySummary = providerId === RETROACHIEVEMENTS_PROVIDER_ID
    ? getRetroAchievementsPlayedGameProgress(game, mode) ?? game.summary
    : game.summary;
  const hardcoreProgressLabel = formatModeProgressLabel("Hardcore", game.hardcoreSummary);
  const softcoreProgressLabel = formatModeProgressLabel("Softcore", game.softcoreSummary);
  const totalCount = displaySummary.totalCount;
  const completionPercent = clampSteamGamesPercent(displaySummary.completionPercent ?? 0);
  const isPerfected = game.status === "mastered";
  const raAward = providerId === RETROACHIEVEMENTS_PROVIDER_ID
    ? getRetroAchievementsCompletionIndicatorState(game)
    : undefined;
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const playtime = formatSteamPlaytimeMinutes(game.playtimeForeverMinutes) ?? "Not played";
  const openGame = (): void => {
    rememberDeckyGamesFocus(providerId, game.gameId);
    rememberDeckyGamesScrollTop(providerId, listRef.current?.scrollTop ?? 0);
    onOpenGameDetail(providerId === RETROACHIEVEMENTS_PROVIDER_ID ? game.gameId : getSteamCompletionProgressGameDetailId(game));
  };
  const scrollFocusedRow: SteamGamesGamepadFocusHandler = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };

  return (
    <Focusable
      ref={elementRef}
      className={STEAM_GAMES_FOCUS_CLASS}
      noFocusRing
      role="button"
      aria-label={`Open ${game.title}`}
      onActivate={openGame}
      onClick={openGame}
      onCancel={onBack}
      onFocus={(event) => { rememberDeckyGamesFocus(providerId, game.gameId); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={(event) => { rememberDeckyGamesFocus(providerId, game.gameId); scrollFocusedRow(event); }}
      onGamepadDirection={handleSteamGamesRowDirection}
      style={getGameRowStyle()}
      data-steam-games-row="true"
    >
      {providerId === RETROACHIEVEMENTS_PROVIDER_ID ? <DeckyRetroAchievementsGameIcon
        game={game}
        src={game.coverImageUrl}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
      /> : <DeckyGameArtwork
        compact
        {...(game.appid !== undefined ? { steamAppId: game.appid } : {})}
        height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        {...(artworkUrl !== undefined ? { src: artworkUrl } : {})}
        title={game.title}
        width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}
      />}

      <div style={{ minWidth: 0 }}>
        <div style={getTitleStyle()}>{game.title}</div>
        {raAward !== undefined ? (
          <div style={{ ...getSecondaryMetaStyle(), color: raAward.startsWith("mastered") ? raTheme.color.mastered : raTheme.color.beaten }}>
            {formatRetroAchievementsCompletionIndicatorLabel(raAward)}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <div style={getProgressMetaStyle()}>
          {totalCount !== undefined
            ? `${formatCount(displaySummary.unlockedCount)} / ${formatCount(totalCount)} achievements`
            : game.scanStatus === "failed"
              ? "Scan unavailable"
              : "No achievements"}
        </div>
        {providerId === RETROACHIEVEMENTS_PROVIDER_ID && mode === "both" ? (
          <div style={{ ...getSecondaryMetaStyle(), display: "flex", gap: 8 }}>
            {hardcoreProgressLabel !== undefined ? <span>{hardcoreProgressLabel}</span> : null}
            {softcoreProgressLabel !== undefined ? <span>{softcoreProgressLabel}</span> : null}
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
          <div style={getProgressTrackStyle()}>
            <div
              style={{
                width: `${completionPercent}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #21b7ef, #2bcbff)",
              }}
            />
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, minWidth: 36, color: "#f3f7fb", fontSize: 12, fontWeight: 900 }}>
            {formatPercent(completionPercent)}
            {isPerfected ? <IconAsset size={14} src={crownIconUrl} tone="gold" /> : null}
          </span>
        </div>
      </div>

      <div style={getMetadataCellStyle()}>
        <IconAsset size={20} src={clockIconUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...getProgressMetaStyle(), overflow: "hidden", textOverflow: "ellipsis" }}>
            {providerId === RETROACHIEVEMENTS_PROVIDER_ID ? game.platformLabel ?? "RetroAchievements" : playtime}
          </div>
          <div style={getSecondaryMetaStyle()}>{providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "Platform" : "Total Playtime"}</div>
        </div>
      </div>

      <div style={getMetadataCellStyle()}>
        <IconAsset size={20} src={calendarIconUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...getProgressMetaStyle(), overflow: "hidden", textOverflow: "ellipsis" }}>
            {formatLastPlayed(providerId === RETROACHIEVEMENTS_PROVIDER_ID ? game.lastUnlockAt ?? game.lastPlayedAt : game.lastPlayedAt)}
          </div>
          <div style={getSecondaryMetaStyle()}>{providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "Last Unlock" : "Last Played"}</div>
        </div>
      </div>

      <IconAsset size={17} src={chevronRightIconUrl} tone="light" />
    </Focusable>
  );
}

function SteamGamesSummaryCards({ summary, providerId }: { readonly summary: SteamGamesDashboardSummary; readonly providerId: string }): JSX.Element {
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  return (
    <div style={getSummaryGridStyle()}>
      <MetricCard
        helper={isRa ? "Progress collection" : "(Steam Library)"}
        iconUrl={gamepadIconUrl}
        label={isRa ? "Games with progress" : "Games Tracked"}
        value={formatCount(summary.trackedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.playedCount, summary.trackedCount))}
        iconUrl={barChartIconUrl}
        label="Played"
        value={formatCount(summary.playedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.unfinishedCount, summary.trackedCount))}
        iconUrl={listIconUrl}
        label={isRa ? "In Progress" : "Unfinished"}
        value={formatCount(summary.unfinishedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.skippedCount, summary.trackedCount))}
        iconTone="red"
        iconUrl={prohibitedIconUrl}
        label={isRa ? "Beaten / Completed" : "Skipped"}
        value={formatCount(summary.skippedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.perfectedCount, summary.trackedCount))}
        iconTone="gold"
        iconUrl={crownIconUrl}
        label={isRa ? "Mastered" : "Perfected"}
        value={formatCount(summary.perfectedCount)}
      />
      <OverallProgressCard summary={summary} />
    </div>
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
  const initialPageState = useRef(readDeckyGamesPageState(providerId)).current;
  const dashboardRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchControlRef = useRef<HTMLDivElement>(null);
  const restorationTargetRef = useRef<HTMLDivElement | null>(null);
  const appendedGameFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const [appendedGameIdToFocus, setAppendedGameIdToFocus] = useState<string | undefined>(undefined);
  const shouldUseRequestedFilter = initialFilter !== undefined && initialFilter !== "all";
  const [filter, setFilter] = useState<SteamGamesFilter>(() => shouldUseRequestedFilter
    ? normalizeInitialFilter(initialFilter)
    : initialPageState.filter);
  const [query, setQuery] = useState(initialPageState.query);
  const [sort, setSort] = useState<CompletionProgressSort>(initialPageState.sort);
  const [renderLimit, setRenderLimit] = useState(shouldUseRequestedFilter
    ? STEAM_GAMES_INITIAL_RENDER_LIMIT
    : initialPageState.renderLimit);
  const hasMountedControls = useRef(false);
  const summary = useMemo(() => summarizeSteamGamesDashboard(snapshot), [snapshot]);
  const visibleGames = useMemo(
    () => selectSteamGames({ games: snapshot.games, filter, query, sort }),
    [filter, query, snapshot.games, sort],
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
  }, [filter, mode, providerId, query, sort]);
  const filterButtons = [
    { filter: "all" as const, label: `${isRa ? "All" : "All Games"} (${formatCount(summary.trackedCount)})` },
    { filter: "played" as const, label: `Played (${formatCount(summary.playedCount)})` },
    { filter: "unfinished" as const, label: `${isRa ? "In Progress" : "Unfinished"} (${formatCount(summary.unfinishedCount)})` },
    { filter: "mastered" as const, label: `${isRa ? "Mastered" : "Perfected"} (${formatCount(summary.perfectedCount)})` },
    { filter: "beaten" as const, label: `${isRa ? "Beaten" : "Skipped"} (${formatCount(summary.skippedCount)})` },
  ];

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
        if (initialPageState.scrollTop > 0 && listRef.current !== null) {
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

    // Expanding the page replaces the focused "Show more" action. Hand native
    // GamepadUI focus to the first appended row while that action still exists
    // in the previous controller tree, rather than leaving its focus offscreen.
    const target = appendedGameFocusTargetRef.current;
    takeDeckySteamGamepadFocus(target);
    scrollDeckyFocusTargetIntoView(target);
    setAppendedGameIdToFocus(undefined);
  }, [appendedGameIdToFocus, renderedGames]);

  const showMoreGames = (): void => {
    const firstAppendedGame = visibleGames[renderedGames.length];
    if (firstAppendedGame !== undefined) {
      setAppendedGameIdToFocus(firstAppendedGame.gameId);
    }
    setRenderLimit((current) => {
      const next = current + STEAM_GAMES_RENDER_STEP;
      rememberDeckyGamesRenderLimit(providerId, next);
      return next;
    });
  };
  const activateSearch = (): void => {
    const input = searchControlRef.current?.querySelector<HTMLInputElement>("input");
    if (input === null || input === undefined) {
      return;
    }

    markDeckyFullscreenOnScreenKeyboardOpen(input.ownerDocument);
    input.focus();
    input.click();
  };

  return (
    <>
      <main
        ref={dashboardRef}
        {...(isRa ? { "data-ac-ra-theme": "fullscreen" } : { "data-ac-steam-theme": "fullscreen" })}
        data-steam-full-screen-games-dashboard
        style={{ ...getPageStyle(), ...(isRa ? { background: raTheme.surface.page, color: raTheme.color.textPrimary } : {}) }}
      >
        <SteamGamesRouteStyles />
        <div style={getSectionTitleStyle()}>{isRa ? "Games with progress" : "Games"}</div>
        <SteamGamesSummaryCards summary={summary} providerId={providerId} />

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
          style={getToolbarStyle()}
        >
          <Focusable
            ref={searchControlRef}
            className={STEAM_GAMES_FOCUS_CLASS}
            noFocusRing
            role="button"
            aria-label="Search your games"
            onActivate={activateSearch}
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
              tabIndex={-1}
              value={query}
              onClick={(event) => {
                markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument);
              }}
              onChange={(event) => { setQuery(event.currentTarget.value); }}
              style={getSearchFieldStyle()}
            />
          </Focusable>

          <Focusable
            flow-children="left-right"
            navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
            noFocusRing
            tabIndex={-1}
            style={getFilterGroupStyle()}
          >
            {filterButtons.map((button) => (
              <SteamGamesFilterButton
                key={button.filter}
                filter={button.filter}
                label={button.label}
                selected={filter === button.filter}
                onBack={onBack}
                onSelect={setFilter}
              />
            ))}
          </Focusable>

          <SteamGamesSortButton value={sort} onBack={onBack} onChange={setSort} />
        </Focusable>

        <Focusable
          ref={listRef}
          aria-live="polite"
          data-steam-games-list
          className={STEAM_GAMES_LIST_CLASS}
          flow-children="vertical"
          navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
          noFocusRing
          tabIndex={-1}
          onScroll={(event) => { rememberDeckyGamesScrollTop(providerId, event.currentTarget.scrollTop); }}
          style={getGameListStyle()}
        >
          {visibleGames.length > 0 ? <>
            {renderedGames.map((game) => (
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
              onBack={onBack}
              onOpenGameDetail={onOpenGameDetail}
            />
            ))}
            {renderedGames.length < visibleGames.length ? <Focusable
              className={STEAM_GAMES_FOCUS_CLASS}
              noFocusRing
              role="button"
              aria-label={`Show ${Math.min(STEAM_GAMES_RENDER_STEP, visibleGames.length - renderedGames.length)} more games`}
              onActivate={showMoreGames}
              onClick={showMoreGames}
              onCancel={onBack}
              onGamepadDirection={handleSteamGamesShowMoreDirection}
              data-steam-games-show-more="true"
              style={{ ...getFilterButtonStyle(false), width: "100%", minHeight: 34 }}
            >
              {`Show ${Math.min(STEAM_GAMES_RENDER_STEP, visibleGames.length - renderedGames.length)} more`}
            </Focusable> : null}
          </> : (
            <div
              style={{
                display: "flex",
                flex: "1 1 auto",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 90,
                border: "1px solid rgba(66, 124, 160, 0.28)",
                borderRadius: 8,
                color: "#a9bdcf",
                background: "rgba(9, 29, 42, 0.82)",
                fontSize: 11,
              }}
            >
              No games match the current search and filter.
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
