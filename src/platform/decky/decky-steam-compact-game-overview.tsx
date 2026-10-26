import type { GameDetailSnapshot } from "@core/domain";
import { Focusable, type FocusableProps } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEventHandler, type ReactNode } from "react";
import { getCompletionPercent } from "./decky-completion-progress-bar";
import {
  getDeckyProviderFullScreenDataSessionRevision,
  getDeckySteamHuntersProfileStateForFullScreenEntryInitial,
  loadDeckySteamHuntersEnrichedGameDetail,
  subscribeDeckyProviderFullScreenDataSession,
} from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { registerCompactGameDetailCancelCallback } from "./decky-full-screen-cancel-bridge";
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import {
  getSteamHuntersAchievementSetStatusPresentation,
} from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { getSteamFullscreenGameArtworkUrl, getSteamHuntersBaseGameBannerUrl } from "./decky-steam-game-artwork";
import { getSteamHuntersGameEnrichment, hasMeaningfulSteamHuntersProfile } from "../../providers/steamhunters";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import { formatSteamHuntersCompletionDuration } from "./decky-steam-hunters-presentation";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { useSteamStoreHeaderArtwork } from "./decky-steam-store-artwork";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import starIconUrl from "./assets/star.svg";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import { steamRecipes, steamTheme } from "./steam-theme";
import { achievementCompanionQamTheme as qamTheme, getQamPassiveCardFocusStyle } from "./decky-qam-theme";
import { useDeckySettings } from "./decky-settings";
import { readDeckySteamProviderConfig } from "./providers/steam";
import { DeckyCompactGameOverviewActions } from "./decky-compact-game-overview-actions";
import { DeckyCompactGameOverviewUpNext } from "./decky-compact-game-overview-up-next";
import { openDeckyOverviewDetails } from "./decky-full-screen-game-overview-content";
import { buildDeckySteamGameInfoRows, formatDeckyOverviewDate, formatDeckyOverviewDateTime } from "./decky-overview-format";
import { DeckyResponsiveGameTitle } from "./decky-responsive-game-title";

const COMPACT_STEAM_BANNER_HEIGHT_PX = 108;

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
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
    background: steamTheme.surface.contentCard,
    display: "flex",
    width: "100%",
    height: COMPACT_STEAM_BANNER_HEIGHT_PX,
    minWidth: 0,
    overflow: "hidden",
    padding: 0,
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
    color: qamTheme.color.textPrimary,
    fontSize: 28,
    fontWeight: 850,
    letterSpacing: "0.08em",
    background: qamTheme.surface.contentStat,
  };
}

function getTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    color: "rgba(247, 251, 255, 0.99)",
    fontSize: 16,
    fontWeight: 850,
    lineHeight: 1.16,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    ...getQamPassiveCardFocusStyle(isFocused),
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

function getSteamHuntersStatsStyle(columns = 3): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
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
  return <DeckyResponsiveGameTitle title={title} preferredFontSize={16} minimumFontSize={14} style={getTitleStyle()} />;
}

function SnapshotMetric({
  icon,
  iconUrl,
  iconStyle,
  label,
  secondary,
  value,
}: {
  readonly icon?: ReactNode;
  readonly iconUrl?: string;
  readonly iconStyle?: CSSProperties;
  readonly label: string;
  readonly secondary?: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getSnapshotMetricStyle()}>
      {icon ?? (iconUrl !== undefined ? <img alt="" aria-hidden="true" src={iconUrl} style={{ width: 22, height: 22, filter: steamTheme.iconFilter.accent, ...iconStyle }} /> : null)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, textAlign: "center" }}>
        <span style={getMetricLabelStyle()}>{label}</span>
        <span style={getMetricValueStyle()}>{value}</span>
        {secondary !== undefined ? <span style={getMetricSecondaryStyle()}>{secondary}</span> : null}
      </div>
    </div>
  );
}

export function DeckySteamCompactGameOverview({
  snapshot,
  onBack,
  onOpenFullScreen,
  onViewAchievements,
  onOpenAchievementDetail,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly onBack: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onViewAchievements: ((achievementId?: string) => void) | undefined;
  readonly onOpenAchievementDetail: (achievementId: string, onClose?: () => void) => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const rootRef = useRef<HTMLElement>(null);
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
  useSyncExternalStore(
    subscribeDeckyProviderFullScreenDataSession,
    getDeckyProviderFullScreenDataSessionRevision,
    getDeckyProviderFullScreenDataSessionRevision,
  );
  const steamHuntersProfileState = getDeckySteamHuntersProfileStateForFullScreenEntryInitial(STEAM_PROVIDER_ID);
  const currentSteamId = readDeckySteamProviderConfig(STEAM_PROVIDER_ID)?.steamId64.trim();
  const showSteamHuntersPoints = settings.steamHuntersPersonalDataEnabled
    && steamHuntersProfileState.data?.steamId === currentSteamId
    && hasMeaningfulSteamHuntersProfile(steamHuntersProfileState.data)
    && steamHunters?.progressPoints?.earned !== undefined;
  const showSteamUnlockPercent = completionPercent !== undefined;
  const showSteamDuration = personalAchievementDuration !== "—";
  const personalStatCount = Number(showSteamHuntersPoints) + Number(showSteamUnlockPercent) + Number(showSteamDuration);
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const hunterBannerUrl = getSteamHuntersBaseGameBannerUrl(enrichment);
  const storeBannerUrl = useSteamStoreHeaderArtwork(game.appid);
  const rawReleaseDate = steamHunters?.enrichment.app.releaseDate ?? game.metrics.find((metric) => metric.key === "released")?.value;
  const lastRefreshed = displayedSnapshot.refreshedAt === undefined ? undefined : formatDeckyOverviewDateTime(displayedSnapshot.refreshedAt);
  const steamPlaytime = formatSteamPlaytimeMinutes(game.playtimeForeverMinutes);
  const deckPlaytime = formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes);
  const openGameInfo = (onClose: () => void): void => openDeckyOverviewDetails(game.title, buildDeckySteamGameInfoRows({
    appId: String(game.appid ?? game.gameId),
    ...(rawReleaseDate !== undefined ? { releaseDate: formatDeckyOverviewDate(rawReleaseDate, game.releaseDateGranularity) } : {}),
    ...(steamPlaytime !== undefined ? { steamPlaytime } : {}),
    ...(deckPlaytime !== undefined ? { deckPlaytime } : {}),
    ...(steamHunters?.enrichment.app.points !== undefined ? { setPoints: steamHunters.enrichment.app.points.toLocaleString() } : {}),
    ...(lastRefreshed !== undefined ? { lastRefreshed } : {}),
  }), undefined, onClose, { preserveCompactSession: true });

  useLayoutEffect(() => registerCompactGameDetailCancelCallback(rootRef.current, onBack), [onBack]);

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
        {artworkUrl === undefined && hunterBannerUrl === undefined && storeBannerUrl === undefined ? (
          <div aria-hidden="true" style={getHeroFallbackStyle()}>{getInitials(game.title)}</div>
        ) : (
          <DeckyGameArtwork compact fallbackSrc={hunterBannerUrl ?? storeBannerUrl} fit="cover" fluid frameless height={COMPACT_STEAM_BANNER_HEIGHT_PX} size={COMPACT_STEAM_BANNER_HEIGHT_PX} {...(artworkUrl !== undefined ? { src: artworkUrl } : {})} title={game.title} width={264} />
        )}
      </div>

      <SteamCompactGameTitle title={game.title} />

      {onViewAchievements !== undefined ? <DeckyCompactGameOverviewActions providerId={game.providerId} gameId={game.gameId} onCancel={onBack} onOpenAchievements={() => onViewAchievements()} onOpenFullScreen={onOpenFullScreen} onOpenGameInfo={openGameInfo} /> : null}

      <DeckyCompactGameOverviewUpNext snapshot={displayedSnapshot} summary={game.summary} achievementMode="both" steamProgress onCancel={onBack} onOpenAchievementDetail={onOpenAchievementDetail} onOpenAchievements={(achievementId) => onViewAchievements?.(achievementId)} />

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

      <CompactGameSectionFocusTarget label="SteamHunters completion times">
        <div style={getSnapshotGridStyle()}>
          <SnapshotMetric icon={<DeckySteamHuntersIcon color={steamTheme.color.accent} size={22} />} label="Median 100%" value={steamHunters?.enrichment.app.medianCompletionTime === undefined ? "—" : formatSteamHuntersCompletionDuration(steamHunters.enrichment.app.medianCompletionTime)} />
          <SnapshotMetric icon={<DeckySteamHuntersIcon color={steamTheme.color.accent} size={22} />} label="Fastest 100%" value={steamHunters?.enrichment.app.fastestCompletionTime === undefined ? "—" : formatSteamHuntersCompletionDuration(steamHunters.enrichment.app.fastestCompletionTime)} />
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

      {personalStatCount > 0 ? <CompactGameSectionFocusTarget label={showSteamHuntersPoints ? "My SteamHunters Stats" : "My Steam Stats"}>
        <div style={getSectionLabelStyle()}>{showSteamHuntersPoints ? "My SteamHunters Stats" : "My Steam Stats"}</div>
        <div style={getSteamHuntersStatsStyle(personalStatCount)}>
          {showSteamHuntersPoints ? <div style={getSteamHuntersStatStyle()}>
            <DeckySteamHuntersIcon color={steamTheme.color.accent} size={17} />
            <span style={getMetricLabelStyle()}>Points</span>
            <span style={getMetricValueStyle()}>{formatCount(steamHunters?.progressPoints?.earned)}</span>
          </div> : null}
          {showSteamUnlockPercent ? <div style={getSteamHuntersStatStyle()}>
            <img alt="" aria-hidden="true" src={starIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span style={getMetricLabelStyle()}>Unlock %</span>
            <span style={getMetricValueStyle()}>{`${completionPercent}%`}</span>
          </div> : null}
          {showSteamDuration ? <div style={getSteamHuntersStatStyle()}>
            <img alt="" aria-hidden="true" src={calendarIconUrl} style={{ width: 17, height: 17, filter: steamTheme.iconFilter.accent }} />
            <span style={getMetricLabelStyle()}>Duration</span>
            <span style={getMetricValueStyle()}>{personalAchievementDuration}</span>
          </div> : null}
        </div>
      </CompactGameSectionFocusTarget> : null}

    </section>
  );
}
