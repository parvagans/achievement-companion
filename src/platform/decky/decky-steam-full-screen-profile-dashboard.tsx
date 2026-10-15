import { Focusable, type FocusableProps } from "@decky/ui";
import type { NormalizedProfile, RecentUnlock } from "@core/domain";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type FocusEventHandler,
  type JSX,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { formatDeckyRelativeTime, formatFullscreenLastSync, formatProfileMemberSince, formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import type {
  SteamFullScreenProfileSummary,
  SteamProfileGameSummary,
} from "./decky-steam-full-screen-profile-data";
import { hasMeaningfulSteamHuntersProfile, type SteamHuntersProfile } from "../../providers/steamhunters";
import { useDeckySettings } from "./decky-settings";
import { steamRecipes, steamTheme } from "./steam-theme";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import crownIconUrl from "./assets/achievement-badge/crown-laurel.svg";
import libraryIconUrl from "./assets/library.svg";
import masteredIconUrl from "./assets/mastered.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import rankAchievementsIconUrl from "./assets/rank-achievements.svg";
import rankCompletedGamesIconUrl from "./assets/rank-completed-games.svg";
import rankPointsIconUrl from "./assets/rank-points.svg";
import starIconUrl from "./assets/star.svg";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import xpIconUrl from "./assets/xp.svg";

export interface SteamFullScreenProfileDashboardProps {
  readonly profile: NormalizedProfile;
  readonly isActive?: boolean;
  readonly summary: SteamFullScreenProfileSummary;
  readonly steamHuntersProfile: SteamHuntersProfile | undefined;
  readonly recentUnlocks: readonly RecentUnlock[];
  readonly refreshedAt: number | undefined;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
}

const DASHBOARD_LIST_ARTWORK_SIZE = 40;
const DASHBOARD_FOCUS_RING_CLASS = "achievement-companion-steam-profile-focus-ring";
const DASHBOARD_FOCUS_RING_ACTIVE_CLASS = "achievement-companion-steam-profile-focus-ring--active";

type DashboardGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;
type DashboardPanelId = "activity" | "recent";

interface DashboardFocusTarget {
  readonly panelId: DashboardPanelId;
  readonly rowIndex?: number;
}

function SteamProfileDashboardFocusStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }

    const style = ownerDocument.createElement("style");
    style.dataset["achievementCompanionSteamProfileFocusStyles"] = "true";
    style.textContent = `
.${DASHBOARD_FOCUS_RING_CLASS}.gpfocus,
.${DASHBOARD_FOCUS_RING_CLASS}.gpfocuswithin,
.${DASHBOARD_FOCUS_RING_CLASS}:focus,
.${DASHBOARD_FOCUS_RING_CLASS}:focus-within,
.${DASHBOARD_FOCUS_RING_CLASS}.${DASHBOARD_FOCUS_RING_ACTIVE_CLASS} {
  outline: 2px solid ${steamTheme.focus.border} !important;
  outline-offset: 1px !important;
  box-shadow: ${steamTheme.focus.shadow} !important;
  background: ${steamTheme.surface.focusedContentStat} !important;
}
.${DASHBOARD_FOCUS_RING_ACTIVE_CLASS}:not(.${DASHBOARD_FOCUS_RING_CLASS}) {
  outline: 2px solid ${steamTheme.focus.border} !important;
  outline-offset: 1px !important;
  box-shadow: ${steamTheme.focus.shadow} !important;
  background: ${steamTheme.focus.background} !important;
}
`;
    ownerDocument.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

const scrollFocusedDashboardContent: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedDashboardGamepadContent: DashboardGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function focusDashboardTarget(source: HTMLElement, target: DashboardFocusTarget): boolean {
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-profile-dashboard]");
  const panel = dashboard?.querySelector<HTMLElement>(`[data-steam-profile-panel="${target.panelId}"]`);
  const selector = target.rowIndex === undefined
    ? "[data-steam-profile-panel-header] [role=button]"
    : `[data-steam-profile-row-index="${target.rowIndex}"]`;
  const focusTarget = panel?.querySelector<HTMLElement>(selector);

  if (focusTarget === undefined || focusTarget === null) {
    return false;
  }

  return takeDeckySteamGamepadFocus(focusTarget);
}

function createDashboardHorizontalFocusHandler(
  direction: "ArrowLeft" | "ArrowRight",
  target: DashboardFocusTarget | undefined,
): KeyboardEventHandler<HTMLDivElement> | undefined {
  if (target === undefined) {
    return undefined;
  }

  return (event) => {
    if (event.key !== direction || !focusDashboardTarget(event.currentTarget, target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };
}

function formatCount(value: number | undefined): string {
  return value !== undefined ? value.toLocaleString() : "-";
}

function formatPercent(value: number | undefined): string {
  return value !== undefined ? `${value}%` : "-";
}

function formatSteamHuntersPercent(value: number | undefined): string {
  return value !== undefined
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
    : "-";
}

function formatGlobalRank(value: number | undefined): string {
  return value !== undefined ? `#${value.toLocaleString()}` : "-";
}

function getFallbackInitials(title: string): string {
  const initials = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "AC";
}

function getDashboardStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    color: steamTheme.color.textPrimary,
  };
}

function getDashboardGridStyle(hasInsightsPanel: boolean): CSSProperties {
  return {
    display: "grid",
    // Constrain both dashboard rows to the frame above Steam's fixed footer.
    flex: "1 1 auto",
    minHeight: 0,
    // The upper row has three panels. The lower row divides the same viewport
    // evenly, so activity and recently played meet at the center.
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gridTemplateRows: "minmax(210px, 0.5fr) minmax(174px, 1fr)",
    gridTemplateAreas: hasInsightsPanel
      ? '"profile profile progress progress insights insights" "activity activity activity recent recent recent"'
      : '"profile profile profile progress progress progress" "activity activity activity recent recent recent"',
    alignItems: "stretch",
    gap: 8,
    width: "100%",
    minWidth: 0,
  };
}

function getPanelStyle(gridArea: string): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen", "raised"),
    background: steamTheme.surface.contentCard,
    gridArea,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    height: "100%",
    padding: 10,
    boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.06), 0 8px 22px rgba(0, 0, 0, 0.16)",
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function getPanelHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
  };
}

function getPanelHeadingGroupStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  };
}

function getPanelTitleStyle(): CSSProperties {
  return {
    color: steamTheme.color.textPrimary,
    fontSize: "clamp(0.86rem, 1.25vw, 1.02rem)",
    fontWeight: 850,
    letterSpacing: "0.075em",
    lineHeight: 1.12,
    textTransform: "uppercase",
  };
}

function getPanelSubtitleStyle(): CSSProperties {
  return {
    color: steamTheme.color.textSecondary,
    fontSize: "0.76em",
    lineHeight: 1.2,
  };
}

function DashboardPanel({
  gridArea,
  panelId,
  title,
  subtitle,
  action,
  onHeaderKeyDownCapture,
  children,
}: {
  readonly gridArea: string;
  readonly panelId?: DashboardPanelId;
  readonly title?: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly onHeaderKeyDownCapture?: KeyboardEventHandler<HTMLDivElement> | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      {...(panelId !== undefined ? { "data-steam-profile-panel": panelId } : {})}
      style={getPanelStyle(gridArea)}
    >
      {title !== undefined ? (
        <Focusable
          flow-children="left-right"
          noFocusRing
          // The heading is a controller-flow group; only its visible action is focusable.
          tabIndex={-1}
          {...(panelId !== undefined ? { "data-steam-profile-panel-header": "true" as const } : {})}
          onKeyDownCapture={onHeaderKeyDownCapture}
          style={getPanelHeaderStyle()}
        >
          <div style={getPanelHeadingGroupStyle()}>
            <div style={getPanelTitleStyle()}>{title}</div>
            {subtitle !== undefined ? <div style={getPanelSubtitleStyle()}>{subtitle}</div> : null}
          </div>
          {action}
        </Focusable>
      ) : null}
      {children}
    </section>
  );
}

function getAvatarIdentityStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minWidth: 0,
  };
}

function getAvatarFrameStyle(): CSSProperties {
  return {
    width: 70,
    height: 70,
    flex: "0 0 70px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `3px solid ${steamTheme.color.accent}`,
    borderRadius: 999,
    overflow: "hidden",
    background: "linear-gradient(145deg, rgba(54, 185, 255, 0.22), rgba(5, 22, 34, 0.96))",
    boxShadow: "0 0 18px rgba(54, 185, 255, 0.26)",
    boxSizing: "border-box",
  };
}

function getAvatarFallbackStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    color: steamTheme.color.textPrimary,
    fontSize: "1.45em",
    fontWeight: 850,
    letterSpacing: "0.04em",
  };
}

function getIdentityTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getDisplayNameStyle(): CSSProperties {
  return {
    color: steamTheme.color.textPrimary,
    fontSize: "clamp(1.05rem, 1.55vw, 1.35rem)",
    fontWeight: 850,
    lineHeight: 1.08,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProviderStatusStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: steamTheme.color.accent,
    fontSize: "0.82em",
    fontWeight: 700,
  };
}

function getStatusDotStyle(): CSSProperties {
  return {
    width: 9,
    height: 9,
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: "#20e889",
    boxShadow: "0 0 10px rgba(32, 232, 137, 0.46)",
  };
}

function getMottoStyle(): CSSProperties {
  return {
    color: steamTheme.color.textSecondary,
    fontSize: "0.76em",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function getDividerStyle(): CSSProperties {
  return { height: 1, flexShrink: 0, backgroundColor: steamTheme.color.borderSubtle };
}

function getProfileFactsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 5, minWidth: 0 };
}

function getProfileFactStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr)",
    alignItems: "center",
    gap: 8,
    color: steamTheme.color.textSecondary,
    fontSize: "0.77em",
    lineHeight: 1.2,
  };
}

function getIconStyle(size: number, tone: "blue" | "gold" | "purple" = "blue"): CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    filter: tone === "gold" ? steamTheme.iconFilter.reward : tone === "purple" ? steamTheme.iconFilter.accent : steamTheme.iconFilter.accent,
  };
}

function ProfileFact({ iconUrl, children }: { readonly iconUrl: string; readonly children: ReactNode }): JSX.Element {
  return (
    <div style={getProfileFactStyle()}>
      <img alt="" src={iconUrl} style={getIconStyle(16)} />
      <span>{children}</span>
    </div>
  );
}

function SteamProfileIdentityPanel({
  profile,
  refreshedAt,
}: Pick<
  SteamFullScreenProfileDashboardProps,
  "profile" | "refreshedAt"
>): JSX.Element {
  const memberSince = formatProfileMemberSince(profile.metrics);
  const avatarUrl = addProfileAvatarCacheBustParam(profile.identity.avatarUrl, refreshedAt);
  const refreshTime = formatFullscreenLastSync(refreshedAt);

  return (
    <DashboardPanel gridArea="profile">
      <div style={getAvatarIdentityStyle()}>
        <div style={getAvatarFrameStyle()}>
          {avatarUrl !== undefined ? (
            <DeckyGameArtwork src={avatarUrl} size={66} title={profile.identity.displayName} />
          ) : (
            <span style={getAvatarFallbackStyle()}>{getFallbackInitials(profile.identity.displayName)}</span>
          )}
        </div>
        <div style={getIdentityTextStyle()}>
          <div style={getDisplayNameStyle()}>{profile.identity.displayName}</div>
          <div style={getProviderStatusStyle()}>
            <span aria-hidden="true" style={getStatusDotStyle()} />
            Steam account
          </div>
          {profile.motto !== undefined ? <div style={getMottoStyle()}>{profile.motto}</div> : null}
        </div>
      </div>

      <div style={getDividerStyle()} />
      <div style={getProfileFactsStyle()}>
        {memberSince !== undefined ? (
          <ProfileFact iconUrl={calendarIconUrl}>{`Member since ${memberSince}`}</ProfileFact>
        ) : null}
        {profile.steamLevel !== undefined ? (
          <ProfileFact iconUrl={xpIconUrl}>{`Steam level ${formatCount(profile.steamLevel)}`}</ProfileFact>
        ) : null}
        {profile.badgeCount !== undefined ? (
          <ProfileFact iconUrl={starIconUrl}>{`${formatCount(profile.badgeCount)} badges`}</ProfileFact>
        ) : null}
      </div>
      {refreshTime !== undefined ? <div style={{ marginTop: "auto", color: steamTheme.color.textMuted, fontSize: steamTheme.type.fullscreen.caption, textAlign: "left" }}>{refreshTime}</div> : null}
    </DashboardPanel>
  );
}

function getProgressHeroStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    padding: "2px 0",
    textAlign: "center",
  };
}

function getProgressValueStyle(): CSSProperties {
  return {
    color: steamTheme.color.textPrimary,
    fontSize: "clamp(1.18rem, 2.2vw, 1.78rem)",
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "0.015em",
  };
}

function getProgressLabelStyle(): CSSProperties {
  return { color: "rgba(180, 209, 235, 0.76)", fontSize: "0.78em", lineHeight: 1.2 };
}

function getProgressBarRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
  };
}

function getProgressPercentStyle(): CSSProperties {
  return { color: "#f2f6fb", fontSize: "1.08em", fontWeight: 900, lineHeight: 1 };
}

function getMetricGridStyle(columns = 2): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 7,
    minWidth: 0,
  };
}

function getMetricTileStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    padding: "6px 8px",
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: 11,
    background: steamTheme.surface.contentStat,
    boxSizing: "border-box",
  };
}

function getMetricTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    minWidth: 0,
    width: "100%",
    textAlign: "center",
  };
}

function getMetricLabelStyle(): CSSProperties {
  return {
    color: "rgba(178, 208, 235, 0.78)",
    fontSize: "0.53em",
    fontWeight: 800,
    letterSpacing: "0.035em",
    lineHeight: 1.05,
    textTransform: "uppercase",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  };
}

function getMetricValueStyle(compact = false): CSSProperties {
  return {
    color: "rgba(245, 249, 253, 0.98)",
    fontSize: compact ? "0.82em" : "0.98em",
    fontWeight: 850,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getRankTrendStyle(trend: "up" | "down"): CSSProperties {
  return {
    color: trend === "up" ? "#43dd7f" : "#ff5d5d",
    fontSize: "0.9em",
    fontWeight: 900,
    marginRight: 2,
  };
}

function MetricTile({ iconUrl, label, value, tone = "blue", compactValue = false, rankTrend }: {
  readonly iconUrl: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: "blue" | "gold" | "purple";
  readonly compactValue?: boolean;
  readonly rankTrend?: "up" | "down" | "unchanged" | undefined;
}): JSX.Element {
  return (
    <div style={getMetricTileStyle()}>
      <img alt="" src={iconUrl} style={getIconStyle(23, tone)} />
      <div style={getMetricTextStyle()}>
        <div style={getMetricLabelStyle()}>{label}</div>
        <div style={getMetricValueStyle(compactValue)}>
          {rankTrend === "up" || rankTrend === "down" ? (
            <span aria-label={rankTrend === "up" ? "Rank improved" : "Rank declined"} style={getRankTrendStyle(rankTrend)}>
              {rankTrend === "up" ? "↑" : "↓"}
            </span>
          ) : null}
          {value}
        </div>
      </div>
    </div>
  );
}

function SteamProgressPanel({ summary }: { readonly summary: SteamFullScreenProfileSummary }): JSX.Element {
  const total = summary.achievements.total;
  const unlocked = summary.achievements.unlocked;
  const completionPercent = summary.achievements.completionPercent;
  const hasAchievementData = summary.achievements.scope === "library-scan" || summary.recentGames.length > 0;

  return (
    <DashboardPanel gridArea="progress" title="Your Progress (Steam)">
      <div style={getProgressHeroStyle()}>
        <div style={getProgressValueStyle()}>
          {!hasAchievementData ? "—" : total !== undefined ? `${formatCount(unlocked)} / ${formatCount(total)}` : formatCount(unlocked)}
        </div>
        <div style={getProgressLabelStyle()}>{!hasAchievementData ? "Achievement data unavailable" : summary.achievements.scope === "library-scan" ? "achievements unlocked in scanned games" : "achievements unlocked in recent games"}</div>
      </div>
      {hasAchievementData && completionPercent !== undefined ? (
        <div style={getProgressBarRowStyle()}>
          <DeckyCompletionProgressBar breathe percent={completionPercent} showCaption={false} steamTheme />
          <span style={getProgressPercentStyle()}>{formatPercent(completionPercent)}</span>
        </div>
      ) : null}
      <div style={getMetricGridStyle()}>
        <MetricTile iconUrl={libraryIconUrl} label="Owned" value={formatCount(summary.library.ownedGames)} />
        <MetricTile iconUrl={trophyIconUrl} label="Played" value={formatCount(summary.library.playedGames)} />
        <MetricTile iconUrl={pieChartIconUrl} label="In progress" value={formatCount(summary.library.inProgressGames)} />
        <MetricTile iconUrl={crownIconUrl} label="Perfected" tone="gold" value={formatCount(summary.achievements.perfectGames)} />
      </div>
    </DashboardPanel>
  );
}

function getStatusMetricTileStyle(): CSSProperties {
  return {
    ...getMetricTileStyle(),
  };
}

function StatusMetricTile({ icon, label, value }: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getStatusMetricTileStyle()}>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <div style={getMetricTextStyle()}>
        <div style={getMetricLabelStyle()}>{label}</div>
        <div style={getMetricValueStyle()}>{value}</div>
      </div>
    </div>
  );
}

function SteamInsightsPanel({ steamHuntersProfile }: {
  readonly steamHuntersProfile: SteamHuntersProfile | undefined;
}): JSX.Element {
  return (
    <DashboardPanel gridArea="insights" title="SteamHunters Profile">
      <div style={getSteamInsightsMetricsStyle()}>
        <div style={getMetricGridStyle()}>
          <StatusMetricTile
            icon={<DeckySteamHuntersIcon color="#36b9ff" size={23} />}
            label="Points"
            value={formatCount(steamHuntersProfile?.points)}
          />
          <MetricTile
            iconUrl={rankPointsIconUrl}
            label="Points"
            value={formatGlobalRank(steamHuntersProfile?.globalPointsRank)}
            compactValue
            rankTrend={steamHuntersProfile?.globalPointsRankTrend}
          />
          <MetricTile
            iconUrl={pieChartIconUrl}
            label="Avg. completion"
            value={formatSteamHuntersPercent(steamHuntersProfile?.averageGameCompletion)}
          />
          <MetricTile
            iconUrl={rankAchievementsIconUrl}
            label="Achievements"
            value={formatGlobalRank(steamHuntersProfile?.globalAchievementsRank)}
            compactValue
            rankTrend={steamHuntersProfile?.globalAchievementsRankTrend}
          />
          <MetricTile
            iconUrl={masteredIconUrl}
            label="Legendary unlocks"
            tone="gold"
            value={formatCount(steamHuntersProfile?.legendaryAchievements)}
          />
          <MetricTile
            iconUrl={rankCompletedGamesIconUrl}
            label="Completed games"
            value={formatGlobalRank(steamHuntersProfile?.globalCompletedGamesRank)}
            compactValue
            rankTrend={steamHuntersProfile?.globalCompletedGamesRankTrend}
          />
        </div>
      </div>
    </DashboardPanel>
  );
}

function SteamLibraryInsightsPanel({ library }: {
  readonly library: SteamFullScreenProfileSummary["library"];
}): JSX.Element {
  return (
    <DashboardPanel gridArea="insights" title="Steam Library">
      <div style={getSteamInsightsMetricsStyle()}>
        <div style={getMetricGridStyle()}>
          {library.totalPlaytimeMinutes !== undefined ? <MetricTile
            iconUrl={clockIconUrl}
            label="Playtime"
            value={formatSteamPlaytimeMinutes(library.totalPlaytimeMinutes) ?? "-"}
          /> : null}
          {library.steamDeckPlaytimeMinutes !== undefined ? <MetricTile
            iconUrl={steamDeckIconUrl}
            label="Steam Deck"
            value={formatSteamPlaytimeMinutes(library.steamDeckPlaytimeMinutes) ?? "-"}
          /> : null}
          {library.lastTwoWeeksPlaytimeMinutes !== undefined ? <MetricTile
            iconUrl={calendarIconUrl}
            label="Last 2 weeks"
            value={formatSteamPlaytimeMinutes(library.lastTwoWeeksPlaytimeMinutes) ?? "-"}
          /> : null}
          {library.unplayedGames !== undefined ? <MetricTile
            iconUrl={libraryIconUrl}
            label="Unplayed games"
            value={formatCount(library.unplayedGames)}
          /> : null}
        </div>
      </div>
    </DashboardPanel>
  );
}

function getSteamInsightsMetricsStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: 0,
  };
}

function getListStyle(): CSSProperties {
  return { display: "flex", flex: "1 1 auto", flexDirection: "column", gap: 4, minWidth: 0, minHeight: 0 };
}

function getListRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flex: "1 1 0",
    minHeight: 0,
    padding: 4,
    border: "1px solid rgba(66, 153, 198, 0.24)",
    borderRadius: 10,
    background: steamTheme.surface.contentStat,
    boxSizing: "border-box",
  };
}

function getListTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
}

function getListTitleStyle(): CSSProperties {
  return {
    color: "rgba(247, 250, 253, 0.98)",
    fontSize: "0.76em",
    fontWeight: 800,
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getListMetaStyle(): CSSProperties {
  return {
    color: "rgba(176, 207, 235, 0.78)",
    fontSize: "0.67em",
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getListTrailingStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    color: "rgba(192, 217, 240, 0.82)",
    fontSize: "0.65em",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

function getEmptyListStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 86,
    color: "rgba(180, 208, 232, 0.68)",
    fontSize: "0.75em",
    textAlign: "center",
  };
}

function getMissingArtworkStyle(width: number, height: number): CSSProperties {
  return {
    display: "flex",
    width,
    height,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background:
      "linear-gradient(160deg, rgba(77, 180, 238, 0.2), rgba(255, 255, 255, 0.03))",
    color: "rgba(220, 237, 250, 0.86)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.05em",
  };
}

function DashboardArtwork({
  src,
  title,
  width,
  height,
}: {
  readonly src: string | undefined;
  readonly title: string;
  readonly width: number;
  readonly height: number;
}): JSX.Element {
  if (src === undefined) {
    return (
      <span aria-hidden="true" style={getMissingArtworkStyle(width, height)}>
        {getFallbackInitials(title)}
      </span>
    );
  }

  return (
    <DeckyGameArtwork
      compact
      height={height}
      size={height}
      src={src}
      title={title}
      width={width}
    />
  );
}

function getListArtworkSlotStyle(): CSSProperties {
  return {
    display: "flex",
    flex: `0 0 ${DASHBOARD_LIST_ARTWORK_SIZE}px`,
    alignItems: "center",
    justifyContent: "center",
    width: DASHBOARD_LIST_ARTWORK_SIZE,
    height: DASHBOARD_LIST_ARTWORK_SIZE,
  };
}

function DashboardFocusableList({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <Focusable flow-children="vertical" noFocusRing tabIndex={-1} style={getListStyle()}>
      {children}
    </Focusable>
  );
}

function DashboardListRow({ children, ariaLabel, focusRowIndex, onActivate, onKeyDownCapture }: {
  readonly children: ReactNode;
  readonly ariaLabel: string;
  readonly focusRowIndex?: number;
  readonly onActivate: () => void;
  readonly onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement> | undefined;
}): JSX.Element {
  return (
    <Focusable
      aria-label={ariaLabel}
      className={`${DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} ${DASHBOARD_FOCUS_RING_CLASS}`}
      focusClassName={DASHBOARD_FOCUS_RING_ACTIVE_CLASS}
      focusWithinClassName={DASHBOARD_FOCUS_RING_ACTIVE_CLASS}
      noFocusRing
      role="button"
      tabIndex={0}
      {...(focusRowIndex !== undefined ? { "data-steam-profile-row-index": focusRowIndex } : {})}
      onActivate={onActivate}
      onClick={onActivate}
      onKeyDownCapture={onKeyDownCapture}
      onFocus={scrollFocusedDashboardContent}
      onGamepadFocus={scrollFocusedDashboardGamepadContent}
      style={getListRowStyle()}
    >
      {children}
    </Focusable>
  );
}

function SteamRecentActivityPanel({
  recentUnlocks,
  recentGameCount,
  onOpenAchievementHistory,
  onOpenAchievementDetail,
}: Pick<
  SteamFullScreenProfileDashboardProps,
  "recentUnlocks" | "onOpenAchievementHistory" | "onOpenAchievementDetail"
> & { readonly recentGameCount: number }): JSX.Element {
  const visibleUnlocks = recentUnlocks.slice(0, 3);
  const recentHeaderFocusHandler = createDashboardHorizontalFocusHandler("ArrowRight", { panelId: "recent" });
  return (
    <DashboardPanel
      gridArea="activity"
      panelId="activity"
      title="Recent Activity"
      onHeaderKeyDownCapture={recentHeaderFocusHandler}
      action={(
        <DeckyFullscreenActionButton
          compact
          focusClassName={DASHBOARD_FOCUS_RING_ACTIVE_CLASS}
          label="View All"
          onClick={onOpenAchievementHistory}
        />
      )}
    >
      {visibleUnlocks.length > 0 ? (
        <DashboardFocusableList>
          {visibleUnlocks.map((recentUnlock, index) => {
            const unlockedAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
            const recentGameFocusTarget = recentGameCount > 0
              ? { panelId: "recent" as const, rowIndex: Math.min(index, recentGameCount - 1) }
              : undefined;
            return (
              <DashboardListRow
                key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}
                ariaLabel={`Open ${recentUnlock.achievement.title}`}
                focusRowIndex={index}
                onActivate={() => {
                  onOpenAchievementDetail(recentUnlock.game.gameId, recentUnlock.achievement.achievementId);
                }}
                onKeyDownCapture={createDashboardHorizontalFocusHandler("ArrowRight", recentGameFocusTarget)}
              >
                <div style={getListArtworkSlotStyle()}>
                  <DashboardArtwork
                    height={DASHBOARD_LIST_ARTWORK_SIZE}
                    src={recentUnlock.achievement.badgeImageUrl}
                    title={recentUnlock.achievement.title}
                    width={DASHBOARD_LIST_ARTWORK_SIZE}
                  />
                </div>
                <div style={getListTextStyle()}>
                  <div style={getListTitleStyle()}>{recentUnlock.achievement.title}</div>
                  <div style={getListMetaStyle()}>{recentUnlock.game.title}</div>
                </div>
                <div style={getListTrailingStyle()}>
                  <span>Unlocked</span>
                  {unlockedAt !== undefined ? <span>{formatDeckyRelativeTime(unlockedAt)}</span> : null}
                </div>
              </DashboardListRow>
            );
          })}
        </DashboardFocusableList>
      ) : (
        <div style={getEmptyListStyle()}>No recent achievement unlocks are available.</div>
      )}
    </DashboardPanel>
  );
}

function getGameProgressStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 8,
  };
}

function SteamRecentGameRow({ game, focusRowIndex, onOpenGameDetail, onKeyDownCapture }: {
  readonly game: SteamProfileGameSummary;
  readonly focusRowIndex: number;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement> | undefined;
}): JSX.Element {
  const achievementLabel = game.totalAchievements !== undefined
    ? `${formatCount(game.unlockedAchievements)} / ${formatCount(game.totalAchievements)} achievements`
    : `${formatCount(game.unlockedAchievements)} unlocked`;

  return (
    <DashboardListRow
      ariaLabel={`Open ${game.title}`}
      focusRowIndex={focusRowIndex}
      onActivate={() => {
        onOpenGameDetail(game.gameId);
      }}
      onKeyDownCapture={onKeyDownCapture}
    >
      <div style={getListArtworkSlotStyle()}>
        <DashboardArtwork
          height={DASHBOARD_LIST_ARTWORK_SIZE}
          src={game.artworkUrl}
          title={game.title}
          width={DASHBOARD_LIST_ARTWORK_SIZE}
        />
      </div>
      <div style={getListTextStyle()}>
        <div style={getListTitleStyle()}>{game.title}</div>
        <div style={getListMetaStyle()}>{achievementLabel}</div>
        {game.completionPercent !== undefined ? (
          <div style={getGameProgressStyle()}>
            <DeckyCompletionProgressBar compact percent={game.completionPercent} showCaption={false} steamTheme />
            <span style={getListTitleStyle()}>{formatPercent(game.completionPercent)}</span>
          </div>
        ) : null}
      </div>
      <span aria-hidden="true" />
    </DashboardListRow>
  );
}

function SteamRecentlyPlayedPanel({ summary, recentUnlockCount, onOpenCompletionProgress, onOpenGameDetail }: Pick<
  SteamFullScreenProfileDashboardProps,
  "summary" | "onOpenCompletionProgress" | "onOpenGameDetail"
> & { readonly recentUnlockCount: number }): JSX.Element {
  const visibleGames = summary.recentGames.slice(0, 3);
  const recentHeaderFocusHandler = createDashboardHorizontalFocusHandler("ArrowLeft", { panelId: "activity" });
  return (
    <DashboardPanel
      gridArea="recent"
      panelId="recent"
      title="Recently Played"
      onHeaderKeyDownCapture={recentHeaderFocusHandler}
      action={(
        <DeckyFullscreenActionButton
          compact
          focusClassName={DASHBOARD_FOCUS_RING_ACTIVE_CLASS}
          label="View All"
          onClick={onOpenCompletionProgress}
        />
      )}
    >
      {visibleGames.length > 0 ? (
        <DashboardFocusableList>
          {visibleGames.map((game, index) => (
            <SteamRecentGameRow
              key={game.gameId}
              game={game}
              focusRowIndex={index}
              onKeyDownCapture={createDashboardHorizontalFocusHandler(
                "ArrowLeft",
                recentUnlockCount > 0
                  ? { panelId: "activity", rowIndex: Math.min(index, recentUnlockCount - 1) }
                  : undefined,
              )}
              onOpenGameDetail={onOpenGameDetail}
            />
          ))}
        </DashboardFocusableList>
      ) : (
        <div style={getEmptyListStyle()}>No recently played games are available.</div>
      )}
    </DashboardPanel>
  );
}

export function SteamFullScreenProfileDashboard({
  profile,
  isActive = true,
  summary,
  steamHuntersProfile,
  recentUnlocks,
  refreshedAt,
  onOpenCompletionProgress,
  onOpenAchievementHistory,
  onOpenGameDetail,
  onOpenAchievementDetail,
}: SteamFullScreenProfileDashboardProps): JSX.Element {
  const settings = useDeckySettings();
  const showSteamHuntersProfile = settings.steamHuntersPersonalDataEnabled
    && hasMeaningfulSteamHuntersProfile(steamHuntersProfile)
    && [
      steamHuntersProfile?.points,
      steamHuntersProfile?.globalPointsRank,
      steamHuntersProfile?.averageGameCompletion,
      steamHuntersProfile?.globalAchievementsRank,
      steamHuntersProfile?.legendaryAchievements,
      steamHuntersProfile?.globalCompletedGamesRank,
    ].some((value) => value !== undefined && value > 0);
  const library = summary.library;
  const showSteamLibraryFallback = !showSteamHuntersProfile
    && library.playedGames !== undefined
    && [library.totalPlaytimeMinutes, library.steamDeckPlaytimeMinutes, library.lastTwoWeeksPlaytimeMinutes, library.unplayedGames]
      .some((value) => value !== undefined && value > 0);
  const hasInsightsPanel = showSteamHuntersProfile || showSteamLibraryFallback;
  const dashboardRef = useRef<HTMLDivElement>(null);
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
      // Match the full-screen game page: GamepadUI dispatches route shoulder
      // events only after a real action owns focus. Starting at View All keeps
      // the first L1/R1 press with the shared footer instead of entering a row.
      const initialFocusTarget = dashboard.querySelector<HTMLElement>(
        "[data-steam-profile-panel='activity'] [data-steam-profile-panel-header] [role='button']",
      );
      if (initialFocusTarget === null) {
        return;
      }

      if (!dashboard.contains(dashboard.ownerDocument.activeElement)) {
        takeDeckySteamGamepadFocus(initialFocusTarget);
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  return (
    <div ref={dashboardRef} data-ac-steam-theme="fullscreen" data-steam-full-screen-profile-dashboard style={getDashboardStyle()}>
      <SteamProfileDashboardFocusStyles />
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={getDashboardGridStyle(hasInsightsPanel)}>
        <SteamProfileIdentityPanel
          profile={profile}
          refreshedAt={refreshedAt}
        />
        <SteamProgressPanel summary={summary} />
        {showSteamHuntersProfile ? <SteamInsightsPanel steamHuntersProfile={steamHuntersProfile} />
          : showSteamLibraryFallback ? <SteamLibraryInsightsPanel library={library} /> : null}
        <SteamRecentActivityPanel
          recentUnlocks={recentUnlocks}
          recentGameCount={summary.recentGames.slice(0, 3).length}
          onOpenAchievementHistory={onOpenAchievementHistory}
          onOpenAchievementDetail={onOpenAchievementDetail}
        />
        <SteamRecentlyPlayedPanel
          summary={summary}
          recentUnlockCount={recentUnlocks.slice(0, 3).length}
          onOpenCompletionProgress={onOpenCompletionProgress}
          onOpenGameDetail={onOpenGameDetail}
        />
      </Focusable>
    </div>
  );
}
