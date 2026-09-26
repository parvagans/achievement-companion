import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamExternalLinkIcon, DeckySteamHuntersIcon, DeckySteamPlayIcon } from "./decky-steam-icons";
import { suppressNextFullscreenRouteUnmountAction } from "./decky-full-screen-navigation-state";
import type { SteamHuntersGameEnrichment } from "../../providers/steamhunters";
import steamIconUrl from "./assets/steam.svg";

type SteamGame = GameDetailSnapshot["game"];

const MIN_GAME_TITLE_FONT_SIZE_PX = 15;

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

function getTitleStyle(fontSizePx: number | undefined): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: fontSizePx === undefined ? "1.28em" : `${fontSizePx}px`,
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProviderStyle(): CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255, 255, 255, 0.74)", fontSize: "0.86em", fontWeight: 700 };
}

function getSteamProviderIconStyle(): CSSProperties {
  return {
    filter: "invert(1)",
  };
}

function SteamGameTitle({ title }: { readonly title: string }): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null);
  const [fittedTitle, setFittedTitle] = useState<{
    readonly title: string;
    readonly fontSizePx: number;
  } | undefined>(undefined);
  const fontSizePx = fittedTitle?.title === title ? fittedTitle.fontSizePx : undefined;

  useLayoutEffect(() => {
    const element = titleRef.current;
    const ownerWindow = element?.ownerDocument.defaultView;
    if (element === null || ownerWindow === null || ownerWindow === undefined || element.clientWidth === 0) {
      return;
    }

    const currentFontSizePx = Number.parseFloat(ownerWindow.getComputedStyle(element).fontSize);
    if (!Number.isFinite(currentFontSizePx) || element.scrollWidth <= element.clientWidth) {
      return;
    }

    const nextFontSizePx = Math.max(
      MIN_GAME_TITLE_FONT_SIZE_PX,
      Math.floor((currentFontSizePx * element.clientWidth / element.scrollWidth) * 10) / 10,
    );
    if (nextFontSizePx >= currentFontSizePx) {
      return;
    }

    setFittedTitle((current) => current?.title === title && current.fontSizePx === nextFontSizePx
      ? current
      : { title, fontSizePx: nextFontSizePx });
  }, [fontSizePx, title]);

  return <div ref={titleRef} style={getTitleStyle(fontSizePx)}>{title}</div>;
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
  refreshedAt,
}: {
  readonly game: SteamGame;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const lastPlayed = formatDate(game.lastPlayedAt);
  const refreshTime = formatGameRefreshTime(refreshedAt);

  return (
    <div style={getIdentityPanelStyle()}>
      {artworkUrl !== undefined ? (
        <DeckySteamFullscreenGameArtwork
          src={artworkUrl}
          fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
          dense
        />
      ) : null}
      <SteamGameTitle title={game.title} />
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
  const steamHunters = buildDeckySteamHuntersGameViewModel({ achievements, enrichment: steamHuntersEnrichment });
  const remainingCount = game.summary.totalCount === undefined ? undefined : Math.max(0, game.summary.totalCount - game.summary.unlockedCount);
  const lastUnlock = achievements.reduce<number | undefined>((latest, achievement) =>
    achievement.isUnlocked && achievement.unlockedAt !== undefined && (latest === undefined || achievement.unlockedAt > latest)
      ? achievement.unlockedAt
      : latest, undefined);
  const hasCommunity = steamHunters?.hasCommunityStats === true;
  return (
    <div style={getOverviewGridStyle()}>
      <SteamGameIdentityPanel game={game} refreshedAt={refreshedAt} />
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
        <DeckySteamHuntersSetDetailsSection
          model={steamHunters}
          totalAchievementCount={totalAchievementCount}
          updatedLabel={updatedLabel}
        />
        {steamHunters !== undefined ? <DeckySteamHuntersCompletionHealthSection model={steamHunters} title="Achievement Set Status" /> : null}
      </div>
    </div>
  );
}
