import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Focusable } from "@decky/ui";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersEnrichedGameDetail,
} from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  buildAchievementStatus,
  formatAchievementUnlockRatePercent,
  formatCount,
  formatTimestamp,
  getAchievementDescriptionText,
  getUnlockRatePercent,
  shouldHideSteamAchievementDetailStats,
} from "./decky-achievement-detail-helpers";
import { getSteamFullscreenGameArtworkUrl, getSteamHuntersBaseGameBannerUrl } from "./decky-steam-game-artwork";
import {
  DeckyFullScreenLoadingState,
  getDeckyFullScreenLoadingPageStyle,
} from "./decky-full-screen-loading-state";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import {
  getSteamHuntersAchievementEnrichment,
  getSteamHuntersGameEnrichment,
  type SteamHuntersAchievement,
} from "../../providers/steamhunters";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { formatSteamHuntersPercentage, formatSteamHuntersPlayersUnlocked } from "./decky-steam-hunters-presentation";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { useSteamStoreHeaderArtwork } from "./decky-steam-store-artwork";
import calendarIconUrl from "./assets/calendar.svg";
import checkCircleIconUrl from "./assets/check-circle.svg";
import starIconUrl from "./assets/star.svg";
import steamIconUrl from "./assets/steam.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import usersIconUrl from "./assets/users.svg";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raTheme } from "./ra-theme";

export interface DeckyFullScreenAchievementPageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly achievementId: string | undefined;
}

function getPageStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    minHeight: 0,
    padding: "clamp(18px, 3.5vh, 38px) clamp(20px, 4vw, 54px)",
    boxSizing: "border-box",
    overflow: "hidden",
    color: raTheme.color.textPrimary,
    background: raTheme.surface.page,
  };
}

function getAchievementPanelStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "clamp(10px, 1.5vh, 14px)",
    width: "100%",
    maxWidth: 1_060,
    maxHeight: "100%",
    padding: "14px clamp(16px, 2vw, 22px)",
    boxSizing: "border-box",
    overflow: "hidden",
    border: `1px solid ${raTheme.color.borderStrong}`,
    borderLeft: `4px solid ${raTheme.color.accentStrong}`,
    borderRadius: raTheme.radius.panel,
    background: raTheme.surface.raised,
    boxShadow: "inset 0 1px 0 rgba(196, 234, 255, 0.08), 0 18px 46px rgba(0, 0, 0, 0.26)",
  };
}

function getHeroStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(260px, 0.82fr)",
    gap: "clamp(18px, 3vw, 38px)",
    alignItems: "center",
    minWidth: 0,
  };
}

function getAchievementIdentityStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "clamp(96px, 11vw, 124px) minmax(0, 1fr)",
    gap: "clamp(14px, 2vw, 24px)",
    alignItems: "center",
    minWidth: 0,
  };
}

function getBadgeFrameStyle(isUnlocked: boolean, isSteam: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    aspectRatio: "1",
    overflow: "hidden",
    borderRadius: 18,
    border: isUnlocked ? "2px solid rgba(242, 190, 55, 0.94)" : isSteam ? "1px solid rgba(150, 174, 192, 0.28)" : `1px solid ${raTheme.color.borderSubtle}`,
    background: isSteam ? "linear-gradient(145deg, rgba(17, 50, 73, 0.92), rgba(7, 24, 38, 0.96))" : raTheme.surface.raised,
    boxShadow: isUnlocked
      ? "inset 0 1px 0 rgba(255, 243, 190, 0.13), 0 0 22px rgba(240, 180, 36, 0.16)"
      : isSteam ? "inset 0 1px 0 rgba(255, 255, 255, 0.06)" : "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.05) brightness(0.84)",
  };
}

function getBadgeFallbackStyle(isSteam: boolean): CSSProperties {
  return {
    color: isSteam ? "rgba(181, 218, 245, 0.76)" : raTheme.color.textSecondary,
    fontSize: "1.4em",
    fontWeight: 800,
    letterSpacing: "0.09em",
  };
}

function getAchievementTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  };
}

function getGameTitleStyle(): CSSProperties {
  return {
    color: raTheme.color.textSecondary,
    fontSize: "clamp(0.78rem, 1.45vw, 1rem)",
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function getAchievementTitleStyle(): CSSProperties {
  return {
    color: raTheme.color.textPrimary,
    fontSize: "clamp(1.45rem, 3vw, 2.25rem)",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  };
}

function getMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getMetaPillStyle(tone: "default" | "success" = "default"): CSSProperties {
  const success = tone === "success";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 30,
    padding: "0 11px",
    boxSizing: "border-box",
    borderRadius: 999,
    border: `1px solid ${success ? "rgba(64, 231, 141, 0.36)" : raTheme.color.borderSubtle}`,
    background: success ? raTheme.surface.success : raTheme.surface.interactive,
    color: success ? raTheme.color.success : raTheme.color.textSecondary,
    fontSize: "0.82em",
    fontWeight: 750,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
}

function getMetaIconStyle(tone: "default" | "success" = "default"): CSSProperties {
  return {
    width: 18,
    height: 18,
    filter: tone === "success"
      ? "brightness(0) saturate(100%) invert(79%) sepia(79%) saturate(493%) hue-rotate(91deg) brightness(105%) contrast(94%)"
      : "brightness(0) saturate(100%) invert(86%) sepia(27%) saturate(584%) hue-rotate(166deg) brightness(100%) contrast(98%)",
  };
}

function getDescriptionStyle(isSteam: boolean): CSSProperties {
  return {
    margin: 0,
    color: isSteam ? "rgba(188, 216, 242, 0.94)" : raTheme.color.textSecondary,
    fontSize: "clamp(0.92rem, 1.7vw, 1.16rem)",
    lineHeight: 1.38,
    whiteSpace: "pre-wrap",
  };
}

function getGameArtworkFrameStyle(isSteam: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    aspectRatio: "460 / 215",
    overflow: "hidden",
    borderRadius: 16,
    border: isSteam ? "1px solid rgba(108, 174, 220, 0.28)" : `1px solid ${raTheme.color.borderSubtle}`,
    background: isSteam ? "linear-gradient(145deg, rgba(12, 34, 51, 0.96), rgba(5, 17, 28, 0.96))" : raTheme.surface.card,
    boxShadow: "inset 0 1px 0 rgba(228, 244, 255, 0.06), 0 8px 22px rgba(0, 0, 0, 0.2)",
  };
}

function getGameArtworkStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center center",
  };
}

function getGameArtworkFallbackStyle(isSteam: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    background: isSteam ? "linear-gradient(145deg, rgba(27, 70, 99, 0.84), rgba(8, 24, 39, 0.98))" : raTheme.surface.raised,
    color: isSteam ? "rgba(191, 221, 246, 0.88)" : raTheme.color.accent,
    fontSize: "1.15em",
    fontWeight: 800,
    letterSpacing: "0.08em",
  };
}

function getPrimaryStatsStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  };
}

function getCommunityHeadingStyle(isSteam: boolean): CSSProperties {
  return {
    margin: "2px 0 -2px",
    color: isSteam ? "rgba(173, 208, 239, 0.92)" : raTheme.color.textSecondary,
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getCommunityStatsStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  };
}

function getMetricCardStyle(isSteam: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    alignItems: "center",
    gap: 12,
    minHeight: 74,
    padding: "10px 14px",
    boxSizing: "border-box",
    borderRadius: 16,
    border: isSteam ? "1px solid rgba(90, 157, 203, 0.2)" : `1px solid ${raTheme.color.borderSubtle}`,
    background: isSteam ? "linear-gradient(145deg, rgba(11, 39, 59, 0.86), rgba(7, 26, 41, 0.9))" : raTheme.surface.card,
    boxShadow: "inset 0 1px 0 rgba(205, 235, 255, 0.045)",
    minWidth: 0,
  };
}

function getMetricIconStyle(tone: "blue" | "green" | "gold"): CSSProperties {
  const filter = tone === "green"
    ? "brightness(0) saturate(100%) invert(79%) sepia(79%) saturate(493%) hue-rotate(91deg) brightness(105%) contrast(94%)"
    : tone === "gold"
      ? "brightness(0) saturate(100%) invert(78%) sepia(63%) saturate(754%) hue-rotate(350deg) brightness(102%) contrast(92%)"
      : "brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(1250%) hue-rotate(165deg) brightness(101%) contrast(102%)";
  return { width: 31, height: 31, justifySelf: "center", filter };
}

function getMetricTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 };
}

function getMetricLabelStyle(isSteam: boolean): CSSProperties {
  return {
    color: isSteam ? "rgba(173, 207, 237, 0.78)" : raTheme.color.textSecondary,
    fontSize: "0.74em",
    fontWeight: 800,
    letterSpacing: "0.09em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getMetricValueStyle(tone: "default" | "success" = "default", isSteam = false): CSSProperties {
  return {
    color: tone === "success" ? (isSteam ? "rgba(82, 242, 156, 0.99)" : raTheme.color.success) : isSteam ? "rgba(255, 255, 255, 0.98)" : raTheme.color.textPrimary,
    fontSize: "clamp(1.05rem, 2vw, 1.42rem)",
    fontWeight: 800,
    lineHeight: 1.12,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getArtworkFallbackInitials(title: string): string {
  const initials = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "AC";
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function DeckyFullScreenAchievementInputSurface({
  children,
  surfaceStyle = getPageStyle(),
  useNativeFocus = false,
}: {
  readonly children: JSX.Element;
  readonly surfaceStyle?: CSSProperties;
  readonly useNativeFocus?: boolean;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) {
      return;
    }

    if (useNativeFocus) {
      return;
    }
    surface.focus({ preventScroll: true });
  }, [useNativeFocus]);

  return (
    <Focusable
      ref={surfaceRef}
      {...(useNativeFocus ? { focusable: true } : {})}
      aria-label="Achievement details"
      autoFocus={useNativeFocus}
      noFocusRing
      preferredFocus={useNativeFocus}
      role="region"
      {...(useNativeFocus ? { "data-ac-steam-theme": "fullscreen" } : { "data-ac-ra-theme": "fullscreen" })}
      style={useNativeFocus ? { ...surfaceStyle, color: steamTheme.color.textPrimary, background: steamTheme.surface.page } : surfaceStyle}
      tabIndex={0}
    >
      {children}
    </Focusable>
  );
}

function DeckyFullScreenAchievementLoadingState({
  hasRouteParameters,
  state,
  useSteamTheme,
}: {
  readonly hasRouteParameters: boolean;
  readonly state: ResourceState<GameDetailSnapshot>;
  readonly useSteamTheme: boolean;
}): JSX.Element {
  const isError = state.status === "error" || !hasRouteParameters;
  const title = isError ? "Unable to load achievement details" : "Loading achievement...";
  const description = !hasRouteParameters
    ? "The achievement route is missing the provider, game, or achievement identifier."
    : state.error?.userMessage ?? "Fetching the latest achievement data and community details.";

  return (
    <DeckyFullScreenLoadingState description={description} isError={isError} title={title} useSteamTheme={useSteamTheme} />
  );
}

function GameArtwork({ src, fallbackSrc, title, isSteam }: { readonly src: string | undefined; readonly fallbackSrc?: string | undefined; readonly title: string; readonly isSteam: boolean }): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);
  const [failedPrimary, setFailedPrimary] = useState(false);
  useEffect(() => { setHasImageError(false); setFailedPrimary(false); }, [src, fallbackSrc]);
  const displayedSource = failedPrimary ? fallbackSrc : src ?? fallbackSrc;
  return (
    <div style={getGameArtworkFrameStyle(isSteam)}>
      {displayedSource === undefined || hasImageError ? (
        <span style={getGameArtworkFallbackStyle(isSteam)}>{getArtworkFallbackInitials(title)}</span>
      ) : (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={displayedSource}
          onError={() => {
            if (!failedPrimary && fallbackSrc !== undefined && fallbackSrc !== src) setFailedPrimary(true);
            else setHasImageError(true);
          }}
          style={getGameArtworkStyle()}
        />
      )}
    </div>
  );
}

function AchievementMetricCard({
  icon,
  iconUrl,
  iconTone = "blue",
  label,
  value,
  valueTone = "default",
  centered = false,
  isSteam = false,
  fullWidth = false,
}: {
  readonly icon?: ReactNode;
  readonly iconUrl?: string | undefined;
  readonly iconTone?: "blue" | "green" | "gold";
  readonly label: string;
  readonly value: string;
  readonly valueTone?: "default" | "success";
  readonly centered?: boolean;
  readonly isSteam?: boolean;
  readonly fullWidth?: boolean;
}): JSX.Element {
  return (
    <div style={{ ...getMetricCardStyle(isSteam), ...(fullWidth ? { gridColumn: "1 / -1" } : {}) }}>
      {icon ?? (iconUrl !== undefined ? <img alt="" aria-hidden="true" src={iconUrl} style={getMetricIconStyle(iconTone)} /> : null)}
      <div style={{ ...getMetricTextStyle(), ...(centered ? { alignItems: "center", textAlign: "center" } : {}) }}>
        <div style={getMetricLabelStyle(isSteam)}>{label}</div>
        <div style={getMetricValueStyle(valueTone, isSteam)}>{value}</div>
      </div>
    </div>
  );
}

function DeckyFullScreenAchievementContent({
  achievement,
  game,
  isSteamProvider,
  providerLabel,
  steamHuntersAchievement,
  steamHuntersPlayersPlayed,
  steamHuntersBannerUrl,
}: {
  readonly achievement: NormalizedAchievement;
  readonly game: GameDetailSnapshot["game"];
  readonly isSteamProvider: boolean;
  readonly providerLabel: string;
  readonly steamHuntersAchievement: SteamHuntersAchievement | undefined;
  readonly steamHuntersPlayersPlayed: number | undefined;
  readonly steamHuntersBannerUrl: string | undefined;
}): JSX.Element {
  const achievementStatus = buildAchievementStatus(achievement);
  const unlockTimestamp = achievement.hardcoreUnlockedAt ?? achievement.softcoreUnlockedAt ?? achievement.unlockedAt;
  const unlockRate = getUnlockRatePercent(achievement);
  const heroArtworkUrl = isSteamProvider
    ? getSteamFullscreenGameArtworkUrl(game)
    : game.boxArtImageUrl ?? game.coverImageUrl;
  const storeBannerUrl = useSteamStoreHeaderArtwork(isSteamProvider ? game.appid : undefined);
  const communityHeading = isSteamProvider ? "My SteamHunters" : providerLabel;
  const secondaryValues = isSteamProvider
    ? {
        points: steamHuntersAchievement?.points !== undefined ? formatCount(steamHuntersAchievement.points) : "—",
        unlockRate: steamHuntersAchievement?.localPercentage !== undefined
          ? formatSteamHuntersPercentage(steamHuntersAchievement.localPercentage)
          : "—",
        playersUnlocked: formatSteamHuntersPlayersUnlocked(steamHuntersAchievement?.localPercentage, steamHuntersPlayersPlayed),
      }
    : {
        points: achievement.points !== undefined ? formatCount(achievement.points) : "—",
        unlockRate: formatAchievementUnlockRatePercent(unlockRate),
        obtainability: achievement.isUnlocked ? "Unlocked" : "Locked",
        playersUnlocked: "—",
      };

  return (
    <article aria-label={achievement.title + " achievement details"} style={isSteamProvider
      ? { ...getAchievementPanelStyle(), ...steamRecipes.card("fullscreen", "raised"), borderLeft: "4px solid " + steamTheme.color.accent }
      : getAchievementPanelStyle()}>
      <div style={getHeroStyle()}>
        <div style={getAchievementIdentityStyle()}>
          <div style={getBadgeFrameStyle(achievement.isUnlocked, isSteamProvider)}>
            {achievement.badgeImageUrl !== undefined ? (
              <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={144} title={achievement.title} />
            ) : (
              <span style={getBadgeFallbackStyle(isSteamProvider)}>{providerLabel}</span>
            )}
          </div>
          <div style={getAchievementTextStyle()}>
            <div style={isSteamProvider ? { ...getGameTitleStyle(), ...steamRecipes.text("fullscreen", "metadata") } : getGameTitleStyle()}>{game.title}</div>
            <div style={isSteamProvider ? { ...getAchievementTitleStyle(), ...steamRecipes.text("fullscreen", "hero"), overflowWrap: "anywhere" } : getAchievementTitleStyle()}>{achievement.title}</div>
            {!isSteamProvider ? <div style={getMetaRowStyle()}>
              <span style={getMetaPillStyle()}>
                {isSteamProvider ? <img alt="" src={steamIconUrl} style={getMetaIconStyle()} /> : null}
                {providerLabel}
              </span>
              <span style={getMetaPillStyle(achievement.isUnlocked ? "success" : "default")}>
                {achievement.isUnlocked ? <img alt="" src={checkCircleIconUrl} style={getMetaIconStyle("success")} /> : null}
                {achievementStatus.value}
              </span>
            </div> : null}
            <p style={getDescriptionStyle(isSteamProvider)}>{getAchievementDescriptionText(achievement.description)}</p>
          </div>
        </div>
        <GameArtwork src={heroArtworkUrl} fallbackSrc={steamHuntersBannerUrl ?? storeBannerUrl} title={game.title} isSteam={isSteamProvider} />
      </div>

      <div style={getPrimaryStatsStyle()}>
        <AchievementMetricCard
          iconUrl={checkCircleIconUrl}
          iconTone={achievement.isUnlocked ? "green" : "blue"}
          label="Status"
          value={achievementStatus.value}
          valueTone={achievement.isUnlocked ? "success" : "default"}
          isSteam={isSteamProvider}
        />
        <AchievementMetricCard
          iconUrl={calendarIconUrl}
          label="Unlock date"
          value={unlockTimestamp !== undefined ? formatTimestamp(unlockTimestamp) : "Not unlocked"}
          isSteam={isSteamProvider}
        />
      </div>

      <div style={getCommunityHeadingStyle(isSteamProvider)}>{communityHeading}</div>
      <div style={isSteamProvider ? { ...getCommunityStatsStyle(), gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } : getCommunityStatsStyle()}>
        <AchievementMetricCard icon={isSteamProvider ? <DeckySteamHuntersIcon color={steamTheme.color.accent} size={31} /> : undefined} iconUrl={isSteamProvider ? undefined : trophyIconUrl} iconTone={isSteamProvider ? "blue" : "gold"} label="Points" value={secondaryValues.points} centered={isSteamProvider} isSteam={isSteamProvider} />
        <AchievementMetricCard iconUrl={usersIconUrl} label={isSteamProvider ? "Unlock rate" : communityHeading + " unlock rate"} value={secondaryValues.unlockRate} centered={isSteamProvider} isSteam={isSteamProvider} />
        {isSteamProvider
          ? <AchievementMetricCard iconUrl={usersIconUrl} label="Players Unlocked" value={secondaryValues.playersUnlocked} centered fullWidth isSteam={isSteamProvider} />
          : <AchievementMetricCard iconUrl={starIconUrl} iconTone="gold" label="Obtainability" value={secondaryValues.obtainability ?? "—"} />}
      </div>
    </article>
  );
}

export function DeckyFullScreenAchievementPage({
  providerId,
  gameId,
  achievementId,
}: DeckyFullScreenAchievementPageProps): JSX.Element {
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    // A full-screen achievement is always opened from an already-loaded game
    // surface. Reuse that snapshot so the child route and its Back transition
    // do not perform two redundant provider refreshes.
    return () => loadDeckyGameDetailState(providerId, gameId, { forceRefresh: false });
  }, [gameId, providerId]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined && achievementId !== undefined;
  const loadedSnapshot = isRenderableGameDetailState(state) ? state.data : undefined;
  const [backgroundEnrichment, setBackgroundEnrichment] = useState<{
    readonly sourceSnapshot: GameDetailSnapshot;
    readonly enrichedSnapshot: GameDetailSnapshot;
  } | undefined>(undefined);

  useEffect(() => {
    if (
      loadedSnapshot === undefined ||
      loadedSnapshot.game.providerId !== STEAM_PROVIDER_ID ||
      getSteamHuntersGameEnrichment(loadedSnapshot) !== undefined
    ) {
      return;
    }

    let cancelled = false;
    void loadDeckySteamHuntersEnrichedGameDetail(loadedSnapshot).then((enrichedSnapshot) => {
      if (!cancelled && getSteamHuntersGameEnrichment(enrichedSnapshot) !== undefined) {
        setBackgroundEnrichment({ sourceSnapshot: loadedSnapshot, enrichedSnapshot });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadedSnapshot]);

  if (!isRenderableGameDetailState(state)) {
    return (
      <DeckyFullScreenAchievementInputSurface
        surfaceStyle={getDeckyFullScreenLoadingPageStyle()}
        useNativeFocus={providerId === STEAM_PROVIDER_ID}
      >
        <DeckyFullScreenAchievementLoadingState hasRouteParameters={hasRouteParameters} state={state} useSteamTheme={providerId === STEAM_PROVIDER_ID} />
      </DeckyFullScreenAchievementInputSurface>
    );
  }

  const snapshot =
    backgroundEnrichment?.sourceSnapshot === state.data
      ? backgroundEnrichment.enrichedSnapshot
      : state.data;
  const game = snapshot.game;
  const achievement =
    achievementId === undefined
      ? undefined
      : snapshot.achievements.find((entry) => entry.achievementId === achievementId);

  if (achievement === undefined) {
    return (
      <DeckyFullScreenAchievementInputSurface
        surfaceStyle={getDeckyFullScreenLoadingPageStyle()}
        useNativeFocus={providerId === STEAM_PROVIDER_ID}
      >
        <DeckyFullScreenAchievementLoadingState hasRouteParameters={false} state={{ ...state, status: "error" }} useSteamTheme={providerId === STEAM_PROVIDER_ID} />
      </DeckyFullScreenAchievementInputSurface>
    );
  }

  const resolvedProviderId = providerId ?? game.providerId;
  const isSteamProvider = shouldHideSteamAchievementDetailStats(resolvedProviderId);
  const steamHuntersAchievement = isSteamProvider
    ? getSteamHuntersAchievementEnrichment(snapshot, achievement.achievementId)
    : undefined;

  return (
    <DeckyFullScreenAchievementInputSurface useNativeFocus={isSteamProvider}>
      <DeckyFullScreenAchievementContent
        achievement={achievement}
        game={game}
        isSteamProvider={isSteamProvider}
        providerLabel={formatDeckyProviderLabel(resolvedProviderId)}
        steamHuntersAchievement={steamHuntersAchievement}
        steamHuntersPlayersPlayed={getSteamHuntersGameEnrichment(snapshot)?.app.playersQualifiedCount}
        steamHuntersBannerUrl={getSteamHuntersBaseGameBannerUrl(getSteamHuntersGameEnrichment(snapshot))}
      />
    </DeckyFullScreenAchievementInputSurface>
  );
}
