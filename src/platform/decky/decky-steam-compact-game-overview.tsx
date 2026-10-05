import type { GameDetailSnapshot } from "@core/domain";
import { Focusable, type FocusableProps } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEventHandler, type ReactNode } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { loadDeckySteamHuntersEnrichedGameDetail } from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { registerCompactGameDetailCancelCallback } from "./decky-full-screen-cancel-bridge";
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamCompactAction } from "./decky-steam-compact-profile";
import {
  getSteamHuntersAchievementSetStatusPresentation,
} from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import steamIconUrl from "./assets/steam.svg";
import starIconUrl from "./assets/star.svg";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import { steamRecipes, steamTheme } from "./steam-theme";

const MIN_TITLE_FONT_SIZE_PX = 12;

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function formatReleaseDate(value: string | undefined): string {
  if (value === undefined) {
    return "—";
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString() : value;
}

function getRootStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    minWidth: 0,
    padding: "0 16px 4px",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    fontFamily: steamTheme.type.fontFamily,
  };
}

function getHeroStyle(): CSSProperties {
  return {
    ...steamRecipes.card("compact", "raised"),
    display: "flex",
    width: "100%",
    height: 124,
    minWidth: 0,
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.22)",
    boxSizing: "border-box",
  };
}

function getHeroFallbackStyle(): CSSProperties {
  return {
    display: "grid",
    width: "100%",
    height: "100%",
    placeItems: "center",
    color: "rgba(186, 226, 252, 0.92)",
    fontSize: 28,
    fontWeight: 850,
    letterSpacing: "0.08em",
    background: "radial-gradient(circle at 25% 25%, rgba(31, 177, 240, 0.3), transparent 44%), linear-gradient(135deg, #0e3b59, #0a1926)",
  };
}

function getTitleStyle(fontSizePx: number | undefined): CSSProperties {
  return {
    minWidth: 0,
    color: "rgba(247, 251, 255, 0.99)",
    fontSize: fontSizePx === undefined ? 16 : fontSizePx,
    fontWeight: 850,
    lineHeight: 1.16,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProviderStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: steamTheme.type.compact.metadata,
    fontWeight: 750,
    lineHeight: 1,
  };
}

function getPrimaryActionLabelStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minWidth: 0,
    color: "#f2f6fb",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.15,
  };
}

function getSectionCardStyle(isFocused: boolean): CSSProperties {
  return {
    ...steamRecipes.card("compact", "card"),
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
    padding: "9px 10px",
    boxShadow: isFocused ? "inset 0 0 0 1px rgba(54, 185, 255, 0.09)" : "none",
    boxSizing: "border-box",
  };
}

/** A low-emphasis focus target lets controller focus scroll through passive game information. */
function CompactGameSectionFocusTarget({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const onFocus: FocusEventHandler<HTMLElement> = (event) => {
    setIsFocused(true);
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };
  const onGamepadFocus: NonNullable<FocusableProps["onGamepadFocus"]> = (event) => {
    setIsFocused(true);
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };

  return (
    <Focusable
      aria-label={`${label} section`}
      noFocusRing
      onActivate={() => {}}
      onFocus={onFocus}
      onGamepadFocus={onGamepadFocus}
      onBlur={() => setIsFocused(false)}
      role="group"
      style={getSectionCardStyle(isFocused)}
    >
      {children}
    </Focusable>
  );
}

function getSectionLabelStyle(): CSSProperties {
  return {
    ...steamRecipes.text("compact", "heading"),
    color: steamTheme.color.accent,
    fontSize: steamTheme.type.compact.metadata,
    fontWeight: 850,
    letterSpacing: "0.055em",
    lineHeight: 1.1,
    textTransform: "uppercase",
  };
}

function getProgressSummaryStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "rgba(242, 248, 255, 0.98)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getSnapshotGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
    width: "100%",
  };
}

function getSnapshotMetricStyle(): CSSProperties {
  return {
    ...steamRecipes.metricTile("compact"),
    display: "grid",
    gridTemplateColumns: "26px minmax(0, 1fr)",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    minHeight: 48,
    padding: "7px 8px",
    boxSizing: "border-box",
  };
}

function getMetricLabelStyle(): CSSProperties {
  return {
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
    lineHeight: 1.1,
    textTransform: "uppercase",
  };
}

function getMetricValueStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    ...steamRecipes.text("compact", "body"),
    color: steamTheme.color.textPrimary,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.15,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getMetricSecondaryStyle(): CSSProperties {
  return {
    ...steamRecipes.text("compact", "caption"),
    color: steamTheme.color.textMuted,
    fontSize: 10,
    lineHeight: 1.12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getSteamHuntersStatsStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 5,
    width: "100%",
  };
}

function getSteamHuntersStatStyle(): CSSProperties {
  return {
    ...steamRecipes.metricTile("compact"),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 0,
    minHeight: 48,
    padding: "6px 4px",
    boxSizing: "border-box",
    textAlign: "center",
  };
}

function getSetStatusDetailRowsStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: 10,
    lineHeight: 1.25,
    textAlign: "center",
  };
}

function getSetStatusDetailRowStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "100%",
  };
}

function getGameInfoStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "5px 10px",
    width: "100%",
    paddingTop: 2,
  };
}

function getGameInfoRowStyle(): CSSProperties {
  return {
    display: "contents",
  };
}

function getGameInfoLabelStyle(): CSSProperties {
  return {
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: 10,
    lineHeight: 1.2,
  };
}

function getGameInfoValueStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textPrimary,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "right",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getInitials(title: string): string {
  return title
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AC";
}

function formatPersonalGameDuration(durationMilliseconds: number | undefined): string {
  if (durationMilliseconds === undefined || !Number.isFinite(durationMilliseconds) || durationMilliseconds < 0) {
    return "—";
  }

  const totalDays = Math.floor(durationMilliseconds / (24 * 60 * 60 * 1000));
  if (totalDays < 7) {
    return totalDays === 1 ? "1 day" : `${totalDays} days`;
  }

  const totalMonths = Math.floor(totalDays / 30.4375);
  if (totalMonths < 12) {
    return totalMonths === 1 ? "1 mo" : `${totalMonths} mos`;
  }

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  const fraction = remainingMonths >= 9 ? "3/4" : remainingMonths >= 6 ? "1/2" : remainingMonths >= 3 ? "1/4" : undefined;
  return fraction === undefined
    ? `${years} yr${years === 1 ? "" : "s"}`
    : `${years} ${fraction} yrs`;
}

function getPersonalAchievementDuration(snapshot: GameDetailSnapshot): string {
  const unlockedAt = snapshot.achievements
    .map((achievement) => achievement.unlockedAt)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const firstUnlockAt = unlockedAt.length === 0 ? undefined : Math.min(...unlockedAt);
  if (firstUnlockAt === undefined) {
    return "—";
  }

  const lastActivityAt = Math.max(
    snapshot.game.lastPlayedAt ?? Number.NEGATIVE_INFINITY,
    ...unlockedAt,
  );
  return formatPersonalGameDuration(lastActivityAt - firstUnlockAt);
}

function SteamCompactGameTitle({ title }: { readonly title: string }): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null);
  const [fontSizePx, setFontSizePx] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const element = titleRef.current;
    const ownerWindow = element?.ownerDocument.defaultView;
    if (element === null || ownerWindow === null || ownerWindow === undefined || element.clientWidth === 0) {
      return;
    }

    const currentSize = Number.parseFloat(ownerWindow.getComputedStyle(element).fontSize);
    const nextSize = element.scrollWidth > element.clientWidth && Number.isFinite(currentSize)
      ? Math.max(MIN_TITLE_FONT_SIZE_PX, Math.floor((currentSize * element.clientWidth / element.scrollWidth) * 10) / 10)
      : undefined;
    setFontSizePx((current) => current === nextSize ? current : nextSize);
  }, [fontSizePx, title]);

  return <div ref={titleRef} title={title} style={getTitleStyle(fontSizePx)}>{title}</div>;
}

function SnapshotMetric({
  iconUrl,
  iconStyle,
  label,
  secondary,
  value,
}: {
  readonly iconUrl: string;
  readonly iconStyle?: CSSProperties;
  readonly label: string;
  readonly secondary?: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getSnapshotMetricStyle()}>
      <img alt="" aria-hidden="true" src={iconUrl} style={{ width: 22, height: 22, filter: steamTheme.iconFilter.accent, ...iconStyle }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, textAlign: "center" }}>
        <span style={getMetricLabelStyle()}>{label}</span>
        <span style={getMetricValueStyle()}>{value}</span>
        {secondary !== undefined ? <span style={getMetricSecondaryStyle()}>{secondary}</span> : null}
      </div>
    </div>
  );
}

function GameInfoRow({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div style={getGameInfoRowStyle()}>
      <span style={getGameInfoLabelStyle()}>{label}</span>
      <span style={getGameInfoValueStyle()}>{value}</span>
    </div>
  );
}

export function DeckySteamCompactGameOverview({
  snapshot,
  onBack,
  onOpenFullScreen,
  onViewAchievements,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly onBack: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onViewAchievements: (() => void) | undefined;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const initialFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    readonly sourceSnapshot: GameDetailSnapshot;
    readonly enrichedSnapshot: GameDetailSnapshot;
  } | undefined>(undefined);
  const displayedSnapshot =
    enrichmentResult !== undefined && enrichmentResult.sourceSnapshot === snapshot
      ? enrichmentResult.enrichedSnapshot
      : snapshot;
  const game = displayedSnapshot.game;
  const enrichment = getSteamHuntersGameEnrichment(displayedSnapshot);
  const steamHunters = buildDeckySteamHuntersGameViewModel({
    achievements: displayedSnapshot.achievements,
    enrichment,
  });
  const completionPercent = getCompletionPercent(game.summary);
  const status = steamHunters === undefined
    ? undefined
    : getSteamHuntersAchievementSetStatusPresentation(steamHunters.completionHealth);
  const completionHealth = steamHunters?.completionHealth;
  const personalAchievementDuration = getPersonalAchievementDuration(displayedSnapshot);
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);

  useLayoutEffect(() => registerCompactGameDetailCancelCallback(rootRef.current, onBack), [onBack]);
  useLayoutEffect(
    () => requestDeckySteamGamepadFocusAfterMount(initialFocusTargetRef.current),
    [],
  );

  useEffect(() => {
    if (getSteamHuntersGameEnrichment(snapshot) !== undefined) {
      return;
    }

    let cancelled = false;
    void loadDeckySteamHuntersEnrichedGameDetail(snapshot)
      .then((enrichedSnapshot) => {
        if (!cancelled) {
          setEnrichmentResult({ sourceSnapshot: snapshot, enrichedSnapshot });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnrichmentResult({ sourceSnapshot: snapshot, enrichedSnapshot: snapshot });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  return (
    <section data-ac-steam-theme="compact" ref={rootRef} style={getRootStyle()}>
      <div style={getHeroStyle()}>
        {artworkUrl === undefined ? (
          <div aria-hidden="true" style={getHeroFallbackStyle()}>{getInitials(game.title)}</div>
        ) : (
          <DeckyGameArtwork compact height={120} size={120} src={artworkUrl} title={game.title} width={264} />
        )}
      </div>

      <SteamCompactGameTitle title={game.title} />
      <div style={getProviderStyle()}>
        <img alt="" aria-hidden="true" height={14} src={steamIconUrl} style={{ filter: "invert(1)" }} width={14} />
        <span>Steam</span>
      </div>

      {onOpenFullScreen !== undefined ? (
        <DeckySteamCompactAction
          ariaLabel="Open game full-screen"
          elementRef={(node) => { initialFocusTargetRef.current = node; }}
          onActivate={onOpenFullScreen}
          onCancel={onBack}
          preferredFocus
          scrollToTopOnFocus
          tone="primary"
        >
          <span style={getPrimaryActionLabelStyle()}>
            <img alt="" aria-hidden="true" src={externalLinkIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span>Open Full-Screen</span>
          </span>
        </DeckySteamCompactAction>
      ) : null}

      {onViewAchievements !== undefined ? (
        <DeckySteamCompactAction
          ariaLabel="View game achievements full-screen"
          onActivate={onViewAchievements}
          onCancel={onBack}
          tone="primary"
        >
          <span style={getPrimaryActionLabelStyle()}>
            <img alt="" aria-hidden="true" src={trophyIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span>View Achievements</span>
          </span>
        </DeckySteamCompactAction>
      ) : null}

      <CompactGameSectionFocusTarget label="Your Progress">
        <div style={getSectionLabelStyle()}>Your Progress</div>
        <div style={getProgressSummaryStyle()}>
          <img alt="" aria-hidden="true" src={trophyIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
          <span>{`${formatCount(game.summary.unlockedCount)} / ${formatCount(game.summary.totalCount)} achievements`}</span>
        </div>
        {completionPercent !== undefined ? <DeckyCompletionProgressBar compact percent={completionPercent} steamTheme /> : null}
      </CompactGameSectionFocusTarget>

      <CompactGameSectionFocusTarget label="Play Time and Steam Deck">
        <div style={getSnapshotGridStyle()}>
          <SnapshotMetric
            iconUrl={clockIconUrl}
            label="Play Time"
            value={formatSteamPlaytimeMinutes(game.playtimeForeverMinutes) ?? "—"}
          />
          <SnapshotMetric
            iconStyle={{ width: 26, height: 15, objectFit: "contain" }}
            iconUrl={steamDeckIconUrl}
            label="Steam Deck"
            value={formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes) ?? "—"}
          />
        </div>
      </CompactGameSectionFocusTarget>

      <CompactGameSectionFocusTarget label="Achievement Set Status">
        <div style={getSectionLabelStyle()}>Achievement Set Status (SteamHunters)</div>
        {status === undefined ? (
          <div style={{ color: "rgba(174, 207, 231, 0.78)", fontSize: 10, lineHeight: 1.25, textAlign: "center" }}>SteamHunters data unavailable.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: status.color, fontSize: 12, fontWeight: 850, lineHeight: 1.12, textAlign: "center" }}>
              {status.icon}
              <span>{status.headline}</span>
            </div>
            <div style={getSetStatusDetailRowsStyle()}>
              <div style={getSetStatusDetailRowStyle()}>
                <span>{completionHealth?.hasPaidDlc === undefined ? "DLC status unavailable" : completionHealth.hasPaidDlc ? "DLC required" : "No DLC required"}</span>
                <span aria-hidden="true">•</span>
                <span>{`${formatCount(completionHealth?.unobtainableCount)} unobtainable`}</span>
              </div>
              <div style={getSetStatusDetailRowStyle()}>
                <span>{`${formatCount(completionHealth?.conditionalCount)} conditions`}</span>
                <span aria-hidden="true">•</span>
                <span>{`${formatCount(completionHealth?.brokenButObtainableCount)} broken but obtainable`}</span>
              </div>
            </div>
          </>
        )}
      </CompactGameSectionFocusTarget>

      <CompactGameSectionFocusTarget label="SteamHunters Stats">
        <div style={getSectionLabelStyle()}>SteamHunters Stats</div>
        <div style={getSteamHuntersStatsStyle()}>
          <div style={getSteamHuntersStatStyle()}>
            <img alt="" aria-hidden="true" src={trophyIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.reward }} />
            <span style={getMetricLabelStyle()}>My Points</span>
            <span style={getMetricValueStyle()}>{formatCount(steamHunters?.progressPoints?.earned)}</span>
          </div>
          <div style={getSteamHuntersStatStyle()}>
            <img alt="" aria-hidden="true" src={starIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span style={getMetricLabelStyle()}>My Unlock %</span>
            <span style={getMetricValueStyle()}>{completionPercent === undefined ? "—" : `${completionPercent}%`}</span>
          </div>
          <div style={getSteamHuntersStatStyle()}>
            <img alt="" aria-hidden="true" src={calendarIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span style={getMetricLabelStyle()}>Duration</span>
            <span style={getMetricValueStyle()}>{personalAchievementDuration}</span>
          </div>
        </div>
      </CompactGameSectionFocusTarget>

      <CompactGameSectionFocusTarget label="Game Info">
        <div style={getSectionLabelStyle()}>Game Info</div>
        <div style={getGameInfoStyle()}>
          <GameInfoRow label="App ID" value={game.appid?.toString() ?? "—"} />
          <GameInfoRow label="Release date" value={formatReleaseDate(steamHunters?.enrichment.app.releaseDate)} />
          <GameInfoRow label="Total Steam hours" value={formatSteamPlaytimeMinutes(game.playtimeForeverMinutes) ?? "—"} />
          <GameInfoRow label="Total Deck hours" value={formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes) ?? "—"} />
        </div>
      </CompactGameSectionFocusTarget>
    </section>
  );
}
