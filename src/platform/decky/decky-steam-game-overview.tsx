import type { CSSProperties } from "react";
import { Navigation as DeckyNavigation } from "@decky/ui";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckySteamFullscreenGameArtwork } from "./decky-steam-fullscreen-game-artwork";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { DeckySteamProgressSummary } from "./decky-steam-progress-summary";
import {
  DeckySteamHuntersCommunitySection,
  DeckySteamHuntersCompletionHealthSection,
  DeckySteamHuntersSetDetailsSection,
} from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { STEAM_PROVIDER_ICON_SRC } from "./providers/steam/icon";
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamExternalLinkIcon, DeckySteamHuntersIcon, DeckySteamPlayIcon } from "./decky-steam-icons";
import { suppressNextFullscreenRouteUnmountAction } from "./decky-full-screen-navigation-state";
import type { SteamHuntersGameEnrichment } from "../../providers/steamhunters";

type SteamGame = GameDetailSnapshot["game"];

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDate(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Date(value).toLocaleDateString();
}

function formatReleaseDate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString() : value;
}

function getOverviewGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.8fr)",
    gap: 12,
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
  };
}

function getIdentityPanelStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 7,
    minHeight: 0,
    minWidth: 0,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(125, 190, 255, 0.16)",
    background: "linear-gradient(180deg, rgba(10, 29, 41, 0.84), rgba(8, 20, 30, 0.72))",
    boxSizing: "border-box",
  };
}

function getTitleStyle(title: string): CSSProperties {
  const titleLength = title.trim().length;
  const isLongTitle = titleLength >= 24;
  const isVeryLongTitle = titleLength >= 36;

  return {
    color: "rgba(255, 255, 255, 0.98)",
    // Keep longer titles from consuming the vertical space needed by the
    // action buttons and metadata in the bounded Steam overview frame.
    fontSize: isVeryLongTitle ? "0.92em" : isLongTitle ? "1em" : "1.28em",
    fontWeight: 800,
    lineHeight: isLongTitle ? 1.08 : 1.15,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getProviderStyle(): CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255, 255, 255, 0.74)", fontSize: "0.86em", fontWeight: 700 };
}

function getMetadataStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 8px",
    paddingTop: 6,
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: "0.75em",
    lineHeight: 1.2,
  };
}

function getMetadataValueStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.86)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getDashboardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    height: "100%",
    minHeight: 0,
    minWidth: 0,
  };
}

function getDashboardTopRowStyle(hasCommunity: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: hasCommunity ? "minmax(0, 1.6fr) minmax(250px, 1fr)" : "minmax(0, 1fr)",
    flex: "1 1 auto",
    gap: 8,
    minHeight: 0,
    minWidth: 0,
  };
}

function openSteamStore(appId: number): void {
  suppressNextFullscreenRouteUnmountAction();
  // Steam diverts Store and s.team URLs before its visible external browser
  // can attach them. A self-contained redirect document mounts that browser
  // first, then replaces its initial history entry with the Store page.
  const storeUrl = `https://store.steampowered.com/app/${appId}`;
  const redirectDocument = `<script>location.replace(${JSON.stringify(storeUrl)})</script>`;
  DeckyNavigation.NavigateToExternalWeb(
    `data:text/html;charset=utf-8,${encodeURIComponent(redirectDocument)}`,
  );
}

function openSteamHunters(appId: number): void {
  suppressNextFullscreenRouteUnmountAction();
  DeckyNavigation.NavigateToExternalWeb(`https://steamhunters.com/apps/${appId}`);
}

function launchSteamGame(appId: number): void {
  suppressNextFullscreenRouteUnmountAction();
  const libraryDetailsLaunchSource = 100 as Parameters<typeof SteamClient.Apps.RunGame>[3];
  SteamClient.Apps.RunGame(String(appId), "", 0, libraryDetailsLaunchSource);
}

function SteamGameIdentityPanel({
  game,
  releaseDate,
}: {
  readonly game: SteamGame;
  readonly releaseDate: string | undefined;
}): JSX.Element {
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const lastPlayed = formatDate(game.lastPlayedAt);

  return (
    <div style={getIdentityPanelStyle()}>
      {artworkUrl !== undefined ? (
        <DeckySteamFullscreenGameArtwork
          src={artworkUrl}
          fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
          dense
        />
      ) : null}
      <div style={getTitleStyle(game.title)}>{game.title}</div>
      <div style={getProviderStyle()}><img alt="" height={16} src={STEAM_PROVIDER_ICON_SRC} width={16} />Steam</div>
      {game.appid !== undefined ? (
        <DeckyFullscreenActionRow>
          <DeckyFullscreenActionButton
            fullWidth
            label="Play Game"
            icon={<DeckySteamPlayIcon size={20} />}
            onClick={() => launchSteamGame(game.appid!)}
            contentAlign="left"
            primary
          />
          <DeckyFullscreenActionButton fullWidth contentAlign="left" icon={<DeckySteamExternalLinkIcon size={20} />} label="View on Steam" onClick={() => openSteamStore(game.appid!)} />
          <DeckyFullscreenActionButton fullWidth contentAlign="left" icon={<DeckySteamHuntersIcon size={20} />} label="View on SteamHunters" onClick={() => openSteamHunters(game.appid!)} />
        </DeckyFullscreenActionRow>
      ) : null}
      <div style={getMetadataStyle()}>
        {game.appid !== undefined ? <><span>App ID</span><span style={getMetadataValueStyle()}>{game.appid}</span></> : null}
        {releaseDate !== undefined ? <><span>Release date</span><span style={getMetadataValueStyle()}>{releaseDate}</span></> : null}
        {lastPlayed !== undefined ? <><span>Last played</span><span style={getMetadataValueStyle()}>{lastPlayed}</span></> : null}
        {game.playtimeForeverMinutes !== undefined ? <><span>Total Steam hours</span><span style={getMetadataValueStyle()}>{formatSteamPlaytimeMinutes(game.playtimeForeverMinutes)}</span></> : null}
        {game.playtimeDeckForeverMinutes !== undefined ? <><span>Total Deck hours</span><span style={getMetadataValueStyle()}>{formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes)}</span></> : null}
      </div>
    </div>
  );
}

export interface DeckySteamGameOverviewProps {
  readonly game: SteamGame;
  readonly achievements: readonly NormalizedAchievement[];
  readonly totalAchievementCount: number;
  readonly completionPercent: number | undefined;
  readonly steamHuntersEnrichment: SteamHuntersGameEnrichment | undefined;
  readonly updatedLabel: string;
}

export function DeckySteamGameOverview({
  game,
  achievements,
  totalAchievementCount,
  completionPercent,
  steamHuntersEnrichment,
  updatedLabel,
}: DeckySteamGameOverviewProps): JSX.Element {
  const steamHunters = buildDeckySteamHuntersGameViewModel({ achievements, enrichment: steamHuntersEnrichment });
  const remainingCount = game.summary.totalCount === undefined ? undefined : Math.max(0, game.summary.totalCount - game.summary.unlockedCount);
  const lastUnlock = achievements.reduce<number | undefined>((latest, achievement) =>
    achievement.isUnlocked && achievement.unlockedAt !== undefined && (latest === undefined || achievement.unlockedAt > latest)
      ? achievement.unlockedAt
      : latest, undefined);
  const hasCommunity = steamHunters?.hasCommunityStats === true;
  const releaseDate = formatReleaseDate(steamHunters?.enrichment.app.releaseDate);

  return (
    <div style={getOverviewGridStyle()}>
      <SteamGameIdentityPanel game={game} releaseDate={releaseDate} />
      <div style={getDashboardStyle()}>
        <div style={getDashboardTopRowStyle(hasCommunity)}>
          <DeckySteamProgressSummary
            completionPercent={completionPercent}
            fillHeight
            unlockedValue={formatCount(game.summary.unlockedCount)}
            totalValue={formatCount(totalAchievementCount)}
            remainingValue={remainingCount === undefined ? undefined : formatCount(remainingCount)}
            lastUnlockValue={formatDate(lastUnlock)}
          />
          {hasCommunity && steamHunters !== undefined ? <DeckySteamHuntersCommunitySection model={steamHunters} compact fillHeight /> : null}
        </div>
        {steamHunters !== undefined ? <DeckySteamHuntersCompletionHealthSection model={steamHunters} title="Completion Status" /> : null}
        <DeckySteamHuntersSetDetailsSection
          model={steamHunters}
          totalAchievementCount={totalAchievementCount}
          updatedLabel={updatedLabel}
        />
      </div>
    </div>
  );
}
