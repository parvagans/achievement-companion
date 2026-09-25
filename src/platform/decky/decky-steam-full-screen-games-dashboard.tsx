import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { Focusable, Menu, MenuItem, TextField, showContextMenu, type FocusableProps } from "@decky/ui";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FC,
} from "react";
import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";
import type { CompletionProgressSort } from "./decky-completion-progress-grouping";
import { DeckyFullScreenFooterOverlay, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { DeckyGameArtwork } from "./decky-game-artwork";
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

const STEAM_GAMES_FOCUS_CLASS = "achievement-companion-steam-games-focus";
const STEAM_GAMES_INITIAL_RENDER_LIMIT = 12;
const STEAM_GAMES_RENDER_STEP = 12;
const STEAM_GAMES_SEARCH_CLASS = "achievement-companion-steam-games-search";
const STEAM_GAMES_LIST_CLASS = "achievement-companion-steam-games-list";
const STEAM_GAMES_ICON_FILTERS = {
  blue:
    "brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(1250%) hue-rotate(165deg) brightness(101%) contrast(102%)",
  gold:
    "brightness(0) saturate(100%) invert(78%) sepia(63%) saturate(754%) hue-rotate(350deg) brightness(102%) contrast(92%)",
  light:
    "brightness(0) saturate(100%) invert(94%) sepia(13%) saturate(467%) hue-rotate(172deg) brightness(104%) contrast(97%)",
  red:
    "brightness(0) saturate(100%) invert(43%) sepia(92%) saturate(2924%) hue-rotate(329deg) brightness(104%) contrast(102%)",
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
  border-color: rgba(39, 194, 255, 0.92) !important;
  box-shadow: inset 0 0 0 2px #27c2ff, inset 0 0 14px rgba(24, 174, 239, 0.2) !important;
}
.${STEAM_GAMES_SEARCH_CLASS}:focus,
.${STEAM_GAMES_SEARCH_CLASS}:focus-within {
  outline: 2px solid #27c2ff !important;
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
    color: "#f2f6fb",
    background:
      "radial-gradient(ellipse at 74% 6%, rgba(19, 100, 148, 0.12), transparent 38%), linear-gradient(180deg, #06131d 0%, #071620 64%, #06121b 100%)",
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
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr)",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    minHeight: 58,
    padding: "7px 9px",
    border: "1px solid rgba(65, 132, 177, 0.24)",
    borderRadius: 8,
    boxSizing: "border-box",
    background: "linear-gradient(145deg, rgba(13, 35, 49, 0.96), rgba(10, 27, 39, 0.96))",
  };
}

function getMetricValueStyle(): CSSProperties {
  return { color: "#f4f7fb", fontSize: 16, fontWeight: 900, lineHeight: 1 };
}

function getMetricLabelStyle(): CSSProperties {
  return { color: "#9ed5ff", fontSize: 9, lineHeight: 1.2, marginTop: 4, whiteSpace: "nowrap" };
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
      <div style={{ color: "#9ed5ff", fontSize: 10, fontWeight: 800, lineHeight: 1 }}>Completion Progress</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
        <div style={{ height: 10, overflow: "hidden", borderRadius: 999, background: "#183246" }}>
          <div
            style={{
              width: `${summary.completionPercent}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #22b8f1, #30c9ff)",
            }}
          />
        </div>
        <span style={{ color: "#f4f7fb", fontSize: 13, fontWeight: 900 }}>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    height: 28,
    padding: "0 7px",
    border: `1px solid ${selected ? "#26bffc" : "rgba(71, 126, 162, 0.34)"}`,
    borderRadius: 8,
    boxSizing: "border-box",
    color: selected ? "#f5fbff" : "#b9c9d9",
    background: selected
      ? "linear-gradient(180deg, rgba(31, 127, 184, 0.56), rgba(16, 71, 106, 0.62))"
      : "rgba(10, 29, 42, 0.88)",
    boxShadow: selected ? "0 0 10px rgba(26, 180, 244, 0.22)" : "none",
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
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
      onActivate={() => { onSelect(filter); }}
      onClick={() => { onSelect(filter); }}
      onCancel={onBack}
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
    display: "grid",
    gridTemplateColumns: `${STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px minmax(165px, 1.55fr) minmax(145px, 1.45fr) 96px 116px 16px`,
    alignItems: "center",
    gap: 8,
    flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`,
    minWidth: 0,
    minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
    padding: "2px 7px 2px 3px",
    border: "1px solid rgba(66, 124, 160, 0.28)",
    borderRadius: 8,
    boxSizing: "border-box",
    color: "#edf6fd",
    background: "linear-gradient(90deg, rgba(9, 29, 42, 0.96), rgba(10, 34, 48, 0.92))",
  };
}

function getTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    color: "#f3f7fb",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.15,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProgressMetaStyle(): CSSProperties {
  return { color: "#edf4fa", fontSize: 10, fontWeight: 750, lineHeight: 1, whiteSpace: "nowrap" };
}

function getSecondaryMetaStyle(): CSSProperties {
  return { color: "#aac0d3", fontSize: 9.5, lineHeight: 1, whiteSpace: "nowrap" };
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
  return { height: 10, overflow: "hidden", borderRadius: 999, background: "#183246" };
}

function SteamGamesRow({
  game,
  onOpenGameDetail,
  onBack,
}: {
  readonly game: NormalizedGame;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const totalCount = game.summary.totalCount;
  const completionPercent = clampSteamGamesPercent(game.summary.completionPercent ?? 0);
  const isPerfected = game.status === "mastered";
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const playtime = formatSteamPlaytimeMinutes(game.playtimeForeverMinutes) ?? "Not played";
  const openGame = (): void => {
    onOpenGameDetail(getSteamCompletionProgressGameDetailId(game));
  };
  const scrollFocusedRow: SteamGamesGamepadFocusHandler = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };

  return (
    <Focusable
      className={STEAM_GAMES_FOCUS_CLASS}
      noFocusRing
      role="button"
      aria-label={`Open ${game.title}`}
      onActivate={openGame}
      onClick={openGame}
      onCancel={onBack}
      onFocus={(event) => { scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={scrollFocusedRow}
      style={getGameRowStyle()}
      data-steam-games-row="true"
    >
      <DeckyGameArtwork
        compact
        height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
        {...(artworkUrl !== undefined ? { src: artworkUrl } : {})}
        title={game.title}
        width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}
      />

      <div style={{ minWidth: 0 }}>
        <div style={getTitleStyle()}>{game.title}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <div style={getProgressMetaStyle()}>
          {totalCount !== undefined
            ? `${formatCount(game.summary.unlockedCount)} / ${formatCount(totalCount)} achievements`
            : game.scanStatus === "failed"
              ? "Scan unavailable"
              : "No achievements"}
        </div>
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
          <div style={{ ...getProgressMetaStyle(), overflow: "hidden", textOverflow: "ellipsis" }}>{playtime}</div>
          <div style={getSecondaryMetaStyle()}>Total Playtime</div>
        </div>
      </div>

      <div style={getMetadataCellStyle()}>
        <IconAsset size={20} src={calendarIconUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...getProgressMetaStyle(), overflow: "hidden", textOverflow: "ellipsis" }}>
            {formatLastPlayed(game.lastPlayedAt)}
          </div>
          <div style={getSecondaryMetaStyle()}>Last Played</div>
        </div>
      </div>

      <IconAsset size={17} src={chevronRightIconUrl} tone="light" />
    </Focusable>
  );
}

function SteamGamesSummaryCards({ summary }: { readonly summary: SteamGamesDashboardSummary }): JSX.Element {
  return (
    <div style={getSummaryGridStyle()}>
      <MetricCard
        helper="(Steam Library)"
        iconUrl={gamepadIconUrl}
        label="Games Tracked"
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
        label="Unfinished"
        value={formatCount(summary.unfinishedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.skippedCount, summary.trackedCount))}
        iconTone="red"
        iconUrl={prohibitedIconUrl}
        label="Skipped"
        value={formatCount(summary.skippedCount)}
      />
      <MetricCard
        helper={formatPercent(getSteamGamesPercentage(summary.perfectedCount, summary.trackedCount))}
        iconTone="gold"
        iconUrl={crownIconUrl}
        label="Perfected"
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
  const dashboardRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<SteamGamesFilter>(() => normalizeInitialFilter(initialFilter));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CompletionProgressSort>("recent");
  const [renderLimit, setRenderLimit] = useState(STEAM_GAMES_INITIAL_RENDER_LIMIT);
  const summary = useMemo(() => summarizeSteamGamesDashboard(snapshot), [snapshot]);
  const visibleGames = useMemo(
    () => selectSteamGames({ games: snapshot.games, filter, query, sort }),
    [filter, query, snapshot.games, sort],
  );
  const renderedGames = visibleGames.slice(0, renderLimit);

  useEffect(() => {
    setRenderLimit(STEAM_GAMES_INITIAL_RENDER_LIMIT);
  }, [filter, query, sort]);
  const filterButtons = [
    { filter: "all" as const, label: `All Games (${formatCount(summary.trackedCount)})` },
    { filter: "played" as const, label: `Played (${formatCount(summary.playedCount)})` },
    { filter: "unfinished" as const, label: `Unfinished (${formatCount(summary.unfinishedCount)})` },
    { filter: "mastered" as const, label: `Perfected (${formatCount(summary.perfectedCount)})` },
    { filter: "beaten" as const, label: `Skipped (${formatCount(summary.skippedCount)})` },
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
      const initialFocusTarget = dashboard.querySelector<HTMLElement>("[data-steam-games-row='true']")
        ?? dashboard.querySelector<HTMLElement>("[role='button']");
      if (initialFocusTarget === null) {
        return;
      }

      if (!dashboard.contains(dashboard.ownerDocument.activeElement)) {
        initialFocusTarget.focus();
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  return (
    <>
      <main ref={dashboardRef} data-steam-full-screen-games-dashboard style={getPageStyle()}>
        <SteamGamesRouteStyles />
        <div style={getSectionTitleStyle()}>Games</div>
        <SteamGamesSummaryCards summary={summary} />

        <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={getToolbarStyle()}>
          <div style={getSearchWrapStyle()}>
            <span style={getSearchIconStyle()}>
              <IconAsset size={14} src={searchIconUrl} tone="light" />
            </span>
            <SteamGamesSearchField
              aria-label="Search your games"
              className={STEAM_GAMES_SEARCH_CLASS}
              placeholder="Search your games…"
              value={query}
              onChange={(event) => { setQuery(event.currentTarget.value); }}
              style={getSearchFieldStyle()}
            />
          </div>

          <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={getFilterGroupStyle()}>
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

        <div aria-live="polite" className={STEAM_GAMES_LIST_CLASS} style={getGameListStyle()}>
          {visibleGames.length > 0 ? <>
            {renderedGames.map((game) => (
            <SteamGamesRow
              key={game.gameId}
              game={game}
              onBack={onBack}
              onOpenGameDetail={onOpenGameDetail}
            />
            ))}
            {renderedGames.length < visibleGames.length ? <Focusable
              className={STEAM_GAMES_FOCUS_CLASS}
              noFocusRing
              role="button"
              aria-label={`Show ${Math.min(STEAM_GAMES_RENDER_STEP, visibleGames.length - renderedGames.length)} more games`}
              onActivate={() => { setRenderLimit((current) => current + STEAM_GAMES_RENDER_STEP); }}
              onClick={() => { setRenderLimit((current) => current + STEAM_GAMES_RENDER_STEP); }}
              onCancel={onBack}
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
        </div>
      </main>

      {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay
        activeNavigationItemId="games"
        ariaLabel="Steam profile navigation"
        navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        onBack={onBack}
        onNextNavigationItem={onOpenActivity}
        onPreviousNavigationItem={onOpenProfile}
      /> : null}
    </>
  );
}
