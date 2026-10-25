import { Focusable, Navigation as DeckyNavigation } from "@decky/ui";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { DeckySteamFullscreenGameArtwork } from "./decky-steam-fullscreen-game-artwork";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { getSteamHeroArtworkSources, getSteamHuntersBaseGameBannerUrl } from "./decky-steam-game-artwork";
import { useSteamStoreHeaderArtwork } from "./decky-steam-store-artwork";
import { getSteamHuntersAchievementSetStatusPresentation } from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamPlayIcon } from "./decky-steam-icons";
import type { SteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { steamRecipes, steamTheme } from "./steam-theme";
import { DeckyFullScreenGameOverviewLayout, DeckyFullScreenGameTitle } from "./decky-full-screen-game-overview-layout";
import { DeckyOverviewMenuButton, DeckyOverviewProgress, DeckyOverviewCompanion, DeckyOverviewMilestoneShowcase, DeckyOverviewSupporting, openDeckyOverviewDetails, overviewPanelStyle, type DeckyGameOverviewActions, type DeckyOverviewSupportingMetric } from "./decky-full-screen-game-overview-content";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { buildDeckySteamGameInfoRows, formatDeckyOverviewDate, formatDeckyOverviewDateTime } from "./decky-overview-format";

type SteamGame = GameDetailSnapshot["game"];
function openSteamStore(appId: number): void {
  const storeUrl = `https://store.steampowered.com/app/${appId}`;
  const redirectDocument = `<script>location.replace(${JSON.stringify(storeUrl)})</script>`;
  DeckyNavigation.NavigateToExternalWeb(`data:text/html;charset=utf-8,${encodeURIComponent(redirectDocument)}`);
}
function launchSteamGame(appId: number): void {
  const libraryDetailsLaunchSource = 100 as Parameters<typeof SteamClient.Apps.RunGame>[3];
  SteamClient.Apps.RunGame(String(appId), "", 0, libraryDetailsLaunchSource);
}
export interface DeckySteamGameOverviewProps {
  readonly game: SteamGame;
  readonly achievements: readonly NormalizedAchievement[];
  readonly totalAchievementCount: number;
  readonly completionPercent: number | undefined;
  readonly steamHuntersEnrichment: SteamHuntersGameEnrichment | undefined;
  readonly refreshedAt: number | undefined;
  readonly overviewActions: DeckyGameOverviewActions;
}
export function DeckySteamGameOverview({ game, achievements, totalAchievementCount, completionPercent, steamHuntersEnrichment, refreshedAt, overviewActions }: DeckySteamGameOverviewProps): JSX.Element {
  const model = buildDeckySteamHuntersGameViewModel({ achievements, enrichment: steamHuntersEnrichment, totalAchievementCount });
  const hunterBannerUrl = getSteamHuntersBaseGameBannerUrl(steamHuntersEnrichment);
  const storeBannerUrl = useSteamStoreHeaderArtwork(game.appid);
  const artwork = getSteamHeroArtworkSources(game, {
    ...(storeBannerUrl !== undefined ? { storeHeaderUrl: storeBannerUrl } : {}),
    ...(hunterBannerUrl !== undefined ? { steamHuntersBannerUrl: hunterBannerUrl } : {}),
  });
  const latestAchievement = achievements.reduce<NormalizedAchievement | undefined>((latest, achievement) => achievement.isUnlocked && achievement.unlockedAt !== undefined && (latest?.unlockedAt === undefined || achievement.unlockedAt > latest.unlockedAt) ? achievement : latest, undefined);
  const lastUnlock = latestAchievement?.unlockedAt;
  const completed = overviewActions.goalComplete === true;
  const app = model?.enrichment.app;
  const community = model?.communitySummary;
  const health = model ? getSteamHuntersAchievementSetStatusPresentation(model.completionHealth).headline : "Data unavailable";
  const rawReleaseDate = app?.releaseDate ?? game.metrics.find((metric) => metric.key === "released")?.value;
  const lastRefreshed = refreshedAt !== undefined ? formatDeckyOverviewDateTime(refreshedAt) : undefined;
  const steamPlaytime = formatSteamPlaytimeMinutes(game.playtimeForeverMinutes);
  const deckPlaytime = formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes);
  const details = (onClose?: () => void): void => openDeckyOverviewDetails(game.title, buildDeckySteamGameInfoRows({
    appId: String(game.appid ?? game.gameId),
    ...(rawReleaseDate !== undefined ? { releaseDate: formatDeckyOverviewDate(rawReleaseDate, game.releaseDateGranularity) } : {}),
    ...(steamPlaytime !== undefined ? { steamPlaytime } : {}),
    ...(deckPlaytime !== undefined ? { deckPlaytime } : {}),
    ...(app?.points !== undefined ? { setPoints: app.points.toLocaleString() } : {}),
    ...(lastRefreshed !== undefined ? { lastRefreshed } : {}),
  }), undefined, onClose);
  const supportingMetrics: readonly DeckyOverviewSupportingMetric[] = [
    { label: "Obtainability", value: health, tone: model?.completionHealth.unobtainableCount ? steamTheme.color.warning : steamTheme.color.success },
    ...(model?.completionHealth.unobtainableCount !== undefined ? [{ label: "Unobtainable", value: model.completionHealth.unobtainableCount.toLocaleString(), tone: model.completionHealth.unobtainableCount > 0 ? steamTheme.color.danger : steamTheme.color.textPrimary }] : []),
    ...(model?.completionHealth.conditionalCount !== undefined || model?.completionHealth.brokenButObtainableCount !== undefined ? [{ label: "Special cases", value: [model?.completionHealth.conditionalCount !== undefined ? `${model.completionHealth.conditionalCount} conditional` : undefined, model?.completionHealth.brokenButObtainableCount !== undefined ? `${model.completionHealth.brokenButObtainableCount} broken` : undefined].filter(Boolean).join("\n"), tone: steamTheme.color.warning, weight: 1.45 }] : []),
    ...(model?.completionHealth.hasPaidDlc !== undefined ? [{ label: "Paid DLC", value: model.completionHealth.hasPaidDlc ? "Required" : "Not required" }] : []),
    ...(community?.totalPlayers !== undefined ? [{ label: "Tracked", value: community.totalPlayers.toLocaleString() }] : []),
    ...(community?.perfectedPlayers !== undefined ? [{ label: "Perfected", value: `${community.perfectedPlayers.toLocaleString()}${community.totalPlayers !== undefined && community.totalPlayers > 0 ? ` (${(community.perfectedPlayers / community.totalPlayers * 100).toFixed(1)}%)` : ""}` }] : []),
  ];
  const history = completed ? <DeckyOverviewMilestoneShowcase kind="perfected" color={steamTheme.color.rewardGold} glow="rgba(242, 216, 127, 0.28)"
    primaryLabel="ALL ACHIEVEMENTS UNLOCKED" title={`${game.summary.unlockedCount.toLocaleString()} of ${totalAchievementCount.toLocaleString()} achievements`}
    {...(lastUnlock !== undefined ? { supporting: <>Final recorded unlock: {formatDeckyOverviewDateTime(lastUnlock)}</> } : {})} /> : null;
  return <div data-ac-steam-theme="fullscreen" style={{ height: "100%", minHeight: 0 }}><DeckyFullScreenGameOverviewLayout
    identity={<div style={{ ...overviewPanelStyle, flexDirection: "row", alignItems: "center", gap: 12 }}>
      {artwork.src !== undefined ? <div style={{ width: 164, flexShrink: 0 }}><DeckySteamFullscreenGameArtwork src={artwork.src} {...(artwork.fallbackSrc !== undefined ? { fallbackSrc: artwork.fallbackSrc } : {})} fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)} overview imageFit="cover" fallbackImageFit="contain" /></div> : null}
      <div style={{ flex: 1, minWidth: 0 }}><DeckyFullScreenGameTitle title={game.title} color={steamTheme.color.textPrimary} maxLines={2} /><div style={steamRecipes.text("fullscreen", "metadata")}>Steam · SteamHunters</div></div>
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {game.appid !== undefined ? <DeckyFullscreenActionButton compact label="Play Game" icon={<DeckySteamPlayIcon size={16} />} primary onClick={() => launchSteamGame(game.appid!)} /> : null}
        <DeckyOverviewMenuButton label="Actions" compact items={[
          ...(game.appid !== undefined ? [{ key: "steam", label: "View on Steam", onSelect: () => openSteamStore(game.appid!) }, { key: "steam-hunters", label: "View on SteamHunters", onSelect: () => DeckyNavigation.NavigateToExternalWeb(`https://steamhunters.com/apps/${game.appid}`) }] : []),
          { key: "game-info", label: "Game Info", onSelect: (navigation) => details(() => navigation.restoreCurrent("game-info")) },
        ]} />
      </Focusable>
    </div>}
    progress={<DeckyOverviewProgress headline={completed ? "PERFECTED" : "In Progress"} unlocked={game.summary.unlockedCount} total={totalAchievementCount} remaining={Math.max(0, totalAchievementCount - game.summary.unlockedCount)} {...(completionPercent !== undefined ? { percent: completionPercent } : {})} {...(lastUnlock !== undefined ? { lastUnlock } : {})} {...(latestAchievement !== undefined ? { latestAchievement } : {})} {...(model?.progressPoints ? { points: `${model.progressPoints.earned.toLocaleString()} SH points` } : {})} {...(completed ? { statusIcon: <DeckyGameStatusIcon kind="perfected" size={48} color={steamTheme.color.rewardGold} glow="rgba(242, 216, 127, 0.42)" /> } : {})} steam />}
    companion={<DeckyOverviewCompanion actions={overviewActions} completed={completed} history={history} />}
    supporting={<DeckyOverviewSupporting title="SteamHunters" metrics={supportingMetrics} actions={overviewActions} onDetails={details} />}
    completed={completed}
  /></div>;
}
