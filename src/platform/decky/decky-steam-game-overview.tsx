import type { CSSProperties } from "react";
import { Navigation as DeckyNavigation } from "@decky/ui";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckySteamFullscreenGameArtwork } from "./decky-steam-fullscreen-game-artwork";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { getSteamFullscreenGameArtworkUrl, getSteamHuntersBaseGameBannerUrl } from "./decky-steam-game-artwork";
import { useSteamStoreHeaderArtwork } from "./decky-steam-store-artwork";
import { DeckySteamProgressSummary } from "./decky-steam-progress-summary";
import {
  DeckySteamHuntersCommunitySection,
  DeckySteamHuntersCompletionHealthSection,
  DeckySteamHuntersSetDetailsSection,
} from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamExternalLinkIcon, DeckySteamHuntersIcon, DeckySteamPlayIcon } from "./decky-steam-icons";
import type { SteamHuntersGameEnrichment } from "../../providers/steamhunters";
import steamIconUrl from "./assets/steam.svg";
import { steamRecipes, steamTheme } from "./steam-theme";
import {
  DeckyFullScreenGameOverviewLayout,
  DeckyFullScreenGameTitle,
} from "./decky-full-screen-game-overview-layout";

type SteamGame = GameDetailSnapshot["game"];

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDate(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Date(value).toLocaleDateString();
}

function formatGameRefreshTime(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getIdentityPanelStyle(): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen", "raised"),
    background: steamTheme.surface.contentCard,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 7,
    minHeight: 0,
    minWidth: 0,
    padding: 10,
    boxSizing: "border-box",
  };
}

function getProviderStyle(): CSSProperties {
  return { ...steamRecipes.text("fullscreen", "body"), display: "inline-flex", alignItems: "center", gap: 6, color: steamTheme.color.textSecondary, fontWeight: 700 };
}

function getSteamProviderIconStyle(): CSSProperties {
  return {
    filter: "invert(1)",
  };
}

function getMetadataStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 8px",
    paddingTop: 6,
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: steamTheme.color.textSecondary,
    fontSize: "0.75em",
    lineHeight: 1.2,
  };
}

function getMetadataValueStyle(): CSSProperties {
  return { color: steamTheme.color.textPrimary, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function openSteamStore(appId: number): void {
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
  DeckyNavigation.NavigateToExternalWeb(`https://steamhunters.com/apps/${appId}`);
}

function launchSteamGame(appId: number): void {
  const libraryDetailsLaunchSource = 100 as Parameters<typeof SteamClient.Apps.RunGame>[3];
  SteamClient.Apps.RunGame(String(appId), "", 0, libraryDetailsLaunchSource);
}

function SteamGameIdentityPanel({
  game,
  refreshedAt,
  steamHuntersEnrichment,
  achievementSetMismatch,
}: {
  readonly game: SteamGame;
  readonly refreshedAt: number | undefined;
  readonly steamHuntersEnrichment: SteamHuntersGameEnrichment | undefined;
  readonly achievementSetMismatch?: { readonly steamCount: number; readonly steamHuntersCount: number } | undefined;
}): JSX.Element {
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const hunterBannerUrl = getSteamHuntersBaseGameBannerUrl(steamHuntersEnrichment);
  const storeBannerUrl = useSteamStoreHeaderArtwork(game.appid);
  const fallbackBannerUrl = hunterBannerUrl ?? storeBannerUrl;
  const lastPlayed = formatDate(game.lastPlayedAt);
  const refreshTime = formatGameRefreshTime(refreshedAt);

  return (
    <div style={getIdentityPanelStyle()}>
      {artworkUrl !== undefined || fallbackBannerUrl !== undefined ? (
        <DeckySteamFullscreenGameArtwork
          src={artworkUrl ?? fallbackBannerUrl!}
          {...(artworkUrl !== undefined && fallbackBannerUrl !== undefined ? { fallbackSrc: fallbackBannerUrl } : {})}
          fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
          dense
        />
      ) : null}
      <DeckyFullScreenGameTitle color={steamTheme.color.textPrimary} title={game.title} />
      <div style={getProviderStyle()}><img alt="" height={16} src={steamIconUrl} style={getSteamProviderIconStyle()} width={16} />Steam</div>
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
        {lastPlayed !== undefined ? <><span>Last played</span><span style={getMetadataValueStyle()}>{lastPlayed}</span></> : null}
        {game.playtimeForeverMinutes !== undefined ? <><span>Total Steam hours</span><span style={getMetadataValueStyle()}>{formatSteamPlaytimeMinutes(game.playtimeForeverMinutes)}</span></> : null}
        {game.playtimeDeckForeverMinutes !== undefined ? <><span>Total Deck hours</span><span style={getMetadataValueStyle()}>{formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes)}</span></> : null}
      </div>
      {refreshTime !== undefined ? <div style={{ marginTop: "auto", color: "#86a7bb", fontSize: "0.7em", textAlign: "center" }}>{`Game data refreshed ${refreshTime}`}</div> : null}
      {achievementSetMismatch !== undefined ? (
        <div style={{ color: steamTheme.color.textSecondary, fontSize: "0.68em", textAlign: "center" }}>
          {`SteamHunters data is for ${achievementSetMismatch.steamHuntersCount} achievements; Steam has ${achievementSetMismatch.steamCount}.`}
        </div>
      ) : null}
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
  readonly refreshedAt: number | undefined;
}

export function DeckySteamGameOverview({
  game,
  achievements,
  totalAchievementCount,
  completionPercent,
  steamHuntersEnrichment,
  updatedLabel,
  refreshedAt,
}: DeckySteamGameOverviewProps): JSX.Element {
  const steamHunters = buildDeckySteamHuntersGameViewModel({ achievements, enrichment: steamHuntersEnrichment, totalAchievementCount });
  const remainingCount = game.summary.totalCount === undefined ? undefined : Math.max(0, game.summary.totalCount - game.summary.unlockedCount);
  const lastUnlock = achievements.reduce<number | undefined>((latest, achievement) =>
    achievement.isUnlocked && achievement.unlockedAt !== undefined && (latest === undefined || achievement.unlockedAt > latest)
      ? achievement.unlockedAt
      : latest, undefined);
  const hasCommunity = steamHunters?.hasCommunityStats === true;
  return (
    <div data-ac-steam-theme="fullscreen" style={{ height: "100%" }}>
      <DeckyFullScreenGameOverviewLayout
        identity={<SteamGameIdentityPanel game={game} refreshedAt={refreshedAt} steamHuntersEnrichment={steamHuntersEnrichment} achievementSetMismatch={steamHunters?.achievementSetMismatch} />}
        progress={
          <DeckySteamProgressSummary
            completionPercent={completionPercent}
            fillHeight
            unlockedValue={formatCount(game.summary.unlockedCount)}
            totalValue={formatCount(totalAchievementCount)}
            remainingValue={remainingCount === undefined ? undefined : formatCount(remainingCount)}
            lastUnlockValue={formatDate(lastUnlock)}
          />
        }
        community={hasCommunity && steamHunters !== undefined ? <DeckySteamHuntersCommunitySection model={steamHunters} compact fillHeight /> : undefined}
        setDetails={
          <DeckySteamHuntersSetDetailsSection
            model={steamHunters}
            totalAchievementCount={totalAchievementCount}
            updatedLabel={updatedLabel}
          />
        }
        setStatus={steamHunters !== undefined ? <DeckySteamHuntersCompletionHealthSection model={steamHunters} title="Achievement Set Status" /> : undefined}
      />
    </div>
  );
}
