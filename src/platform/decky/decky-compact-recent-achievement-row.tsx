import { Focusable } from "@decky/ui";
import type { GameDetailSnapshot, NormalizedMetric, RecentUnlock } from "@core/domain";
import { useEffect, useRef, useState, type CSSProperties, type RefCallback } from "react";
import type { SteamHuntersGameData } from "../../providers/steamhunters";
import { loadDeckyGameDetailState, loadDeckySteamHuntersGameData } from "./decky-app-services";
import { getAchievementDetailCounts, formatProviderAchievementPointsText } from "./decky-achievement-detail-helpers";
import { getSteamAchievementCommunityPercent } from "./decky-achievement-row-presentation";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { achievementCompanionAchievementRowRecipes, achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { raTheme } from "./ra-theme";
import { steamTheme } from "./steam-theme";

export interface DeckyCompactRecentAchievementRowProps {
  readonly unlock: RecentUnlock;
  readonly gameMetrics?: readonly NormalizedMetric[] | undefined;
  readonly timestampText?: string | undefined;
  readonly onActivate: () => void;
  readonly onActivated?: ((target: HTMLElement) => void) | undefined;
  readonly onCancel: () => void;
  readonly onFocused?: ((target: HTMLElement) => void) | undefined;
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly preferredFocus?: boolean | undefined;
  readonly dataAttributes?: Readonly<Record<string, string>>;
}

const EMPTY_GAME_METRICS: readonly NormalizedMetric[] = [];

function getRowStyle(isSteam: boolean, mode: RecentUnlock["achievement"]["unlockMode"], focused: boolean): CSSProperties {
  const accentColor = isSteam
    ? steamTheme.color.unlocked
    : mode === "hardcore" ? raTheme.color.hardcore
      : mode === "softcore" ? raTheme.color.softcore : raTheme.color.unlocked;
  return {
    ...achievementCompanionAchievementRowRecipes.surface("compact", accentColor, focused),
    display: "grid",
    gridTemplateColumns: "40px minmax(0, 1fr) minmax(68px, auto)",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minWidth: 0,
    // Reserve the two-line title slot so short and long unlocks share one QAM row height.
    height: 88,
    padding: 9,
    borderRadius: qamTheme.radius.large,
    boxSizing: "border-box",
    color: qamTheme.color.textPrimary,
    cursor: "pointer",
    outline: "none",
  };
}

const artworkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  alignSelf: "center",
  justifyContent: "center",
  width: 40,
  minWidth: 40,
  height: 40,
  lineHeight: 0,
};

const mainStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  color: qamTheme.color.textPrimary,
  fontSize: qamTheme.type.compact.title,
  fontWeight: 800,
  lineHeight: 1.17,
  minWidth: 0,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
};

const metadataStyle: CSSProperties = {
  color: qamTheme.color.textSecondary,
  fontSize: qamTheme.type.compact.metadata,
  fontWeight: 600,
  lineHeight: 1.18,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

interface RecentAchievementMetadata {
  readonly points?: number | undefined;
  readonly communityPercent?: number | undefined;
}

function getSteamHuntersAchievement(
  unlock: RecentUnlock,
  steamHuntersGameData: SteamHuntersGameData | undefined,
) {
  const appId = Number(unlock.game.gameId);
  if (steamHuntersGameData === undefined || steamHuntersGameData.app.appId !== appId) return undefined;
  const matches = steamHuntersGameData.achievements.filter(
    (achievement) => achievement.apiName === unlock.achievement.achievementId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolveCompactRecentAchievementMetadata(
  unlock: RecentUnlock,
  gameMetrics: readonly NormalizedMetric[],
  gameDetail: GameDetailSnapshot | undefined,
  steamHuntersGameData: SteamHuntersGameData | undefined,
): RecentAchievementMetadata {
  const detailedAchievement = gameDetail?.achievements.find(
    (achievement) => achievement.achievementId === unlock.achievement.achievementId,
  );
  const achievement = detailedAchievement ?? unlock.achievement;
  if (unlock.game.providerId === "steam") {
    const steamHuntersAchievement = getSteamHuntersAchievement(unlock, steamHuntersGameData);
    const communityPercent = getSteamAchievementCommunityPercent(achievement, steamHuntersAchievement);
    return {
      ...(steamHuntersAchievement?.points !== undefined
        ? { points: steamHuntersAchievement.points }
        : achievement.points !== undefined ? { points: achievement.points } : {}),
      ...(communityPercent !== undefined ? { communityPercent } : {}),
    };
  }

  const communityPercent = getAchievementDetailCounts(
    achievement.metrics,
    gameDetail?.game.metrics ?? gameMetrics,
  ).unlockRatePercent;
  return {
    ...(achievement.points !== undefined ? { points: achievement.points } : {}),
    ...(communityPercent !== undefined ? { communityPercent } : {}),
  };
}

async function loadCompactRecentAchievementMetadata(
  unlock: RecentUnlock,
  gameMetrics: readonly NormalizedMetric[],
): Promise<RecentAchievementMetadata> {
  const detailPromise = loadDeckyGameDetailState(unlock.game.providerId, unlock.game.gameId, { forceRefresh: false });
  const appId = Number(unlock.game.gameId);
  const steamHuntersPromise = unlock.game.providerId === "steam" && Number.isSafeInteger(appId) && appId > 0
    ? loadDeckySteamHuntersGameData(appId)
    : Promise.resolve<SteamHuntersGameData | undefined>(undefined);
  const [detailResult, steamHuntersResult] = await Promise.allSettled([detailPromise, steamHuntersPromise] as const);
  return resolveCompactRecentAchievementMetadata(
    unlock,
    gameMetrics,
    detailResult.status === "fulfilled" ? detailResult.value.data : undefined,
    steamHuntersResult.status === "fulfilled" ? steamHuntersResult.value : undefined,
  );
}

export function DeckyCompactRecentAchievementRow({
  unlock,
  gameMetrics: providedGameMetrics,
  timestampText,
  onActivate,
  onActivated,
  onCancel,
  onFocused,
  elementRef,
  preferredFocus = false,
  dataAttributes,
}: DeckyCompactRecentAchievementRowProps): JSX.Element {
  const gameMetrics = providedGameMetrics ?? EMPTY_GAME_METRICS;
  const [focused, setFocused] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isSteam = unlock.game.providerId === "steam";
  const mode = unlock.achievement.unlockMode;
  const statusText = isSteam ? "Unlocked" : mode === "hardcore" ? "Hardcore" : mode === "softcore" ? "Softcore" : "Unlocked";
  const statusColor = isSteam
    ? steamTheme.color.unlocked
    : mode === "hardcore" ? raTheme.color.hardcore
      : mode === "softcore" ? raTheme.color.softcore : raTheme.color.unlocked;
  const baseMetadata = resolveCompactRecentAchievementMetadata(unlock, gameMetrics, undefined, undefined);
  const metadataKey = `${unlock.game.providerId}:${unlock.game.gameId}:${unlock.achievement.achievementId}`;
  const [loadedMetadata, setLoadedMetadata] = useState<{ readonly key: string; readonly value: RecentAchievementMetadata }>();
  const effectiveMetadata = loadedMetadata?.key === metadataKey ? loadedMetadata.value : baseMetadata;
  const pointsText = effectiveMetadata.points === undefined
    ? undefined
    : formatProviderAchievementPointsText(unlock.game.providerId, effectiveMetadata.points);
  const communityPercent = effectiveMetadata.communityPercent;
  useEffect(() => {
    if (baseMetadata.points !== undefined && baseMetadata.communityPercent !== undefined) return undefined;
    let cancelled = false;
    void loadCompactRecentAchievementMetadata(unlock, gameMetrics).then((value) => {
      if (!cancelled) setLoadedMetadata({ key: metadataKey, value });
    });
    return () => { cancelled = true; };
  }, [baseMetadata.communityPercent, baseMetadata.points, gameMetrics, metadataKey, unlock]);
  const activate = (): void => {
    if (rowRef.current !== null) onActivated?.(rowRef.current);
    onActivate();
  };
  const focus = (target: HTMLElement): void => {
    setFocused(true);
    target.scrollIntoView({ block: "center", inline: "nearest" });
    onFocused?.(target);
  };
  const accessibleMetadata = [statusText, pointsText, communityPercent === undefined ? undefined : `${Math.round(communityPercent)}% players`, timestampText]
    .filter((value): value is string => value !== undefined)
    .join(", ");

  return (
    <Focusable
      {...dataAttributes}
      aria-label={`${unlock.achievement.title}, ${unlock.game.title}, ${accessibleMetadata}`}
      noFocusRing
      onActivate={activate}
      onBlur={() => setFocused(false)}
      onCancel={onCancel}
      onClick={activate}
      onFocus={(event) => focus(event.currentTarget)}
      onGamepadFocus={(event) => focus(event.currentTarget as HTMLElement)}
      preferredFocus={preferredFocus}
      ref={(node) => { rowRef.current = node; elementRef?.(node); }}
      role="button"
      tabIndex={0}
      style={getRowStyle(isSteam, mode, focused)}
    >
      <span style={artworkStyle}>
        {unlock.achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={unlock.achievement.badgeImageUrl} size={40} title={unlock.achievement.title} />
        ) : (
          <span style={titleStyle}>{unlock.achievement.title.slice(0, 1)}</span>
        )}
      </span>
      <span style={mainStyle}>
        <span style={titleStyle}>{unlock.achievement.title}</span>
        <span style={metadataStyle}>{unlock.game.title}</span>
        {timestampText !== undefined ? <span style={metadataStyle}>{timestampText}</span> : null}
      </span>
      <span style={achievementCompanionAchievementRowRecipes.rail("compact")}>
        <span style={achievementCompanionAchievementRowRecipes.status("compact", statusColor)}>{statusText}</span>
        {pointsText !== undefined ? (
          <span style={achievementCompanionAchievementRowRecipes.points("compact")}>
            {isSteam ? <DeckySteamHuntersIcon color={steamTheme.color.accent} size={12} /> : <DeckyRetroAchievementsPointsIcon size={12} />}
            {pointsText}
          </span>
        ) : null}
        {communityPercent !== undefined ? (
          <span style={achievementCompanionAchievementRowRecipes.rarity.root("compact")}>
            <span aria-hidden="true" style={achievementCompanionAchievementRowRecipes.rarity.track("compact")}>
              <span style={{ ...achievementCompanionAchievementRowRecipes.rarity.fill(communityPercent), display: "block" }} />
            </span>
            <span style={achievementCompanionAchievementRowRecipes.rarity.label("compact")}>{`${Math.round(communityPercent)}% players`}</span>
          </span>
        ) : null}
      </span>
    </Focusable>
  );
}
