import { Focusable, type FocusableProps } from "@decky/ui";
import type { NormalizedProfile, RecentUnlock } from "@core/domain";
import type { CSSProperties, FocusEventHandler, JSX, ReactNode } from "react";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { formatDeckyRelativeTime, formatProfileMemberSince } from "./decky-stat-helpers";
import { DeckySteamExternalLinkIcon, DeckySteamHuntersIcon } from "./decky-steam-icons";
import type {
  SteamFullScreenProfileSummary,
  SteamProfileGameSummary,
} from "./decky-steam-full-screen-profile-data";
import type { SteamHuntersProfile } from "../../providers/steamhunters";
import barChartIconUrl from "./assets/bar-chart.svg";
import calendarIconUrl from "./assets/calendar.svg";
import checkCircleIconUrl from "./assets/check-circle.svg";
import crownIconUrl from "./assets/crown.svg";
import libraryIconUrl from "./assets/library.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import starIconUrl from "./assets/star.svg";
import steamIconUrl from "./assets/steam.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import xpIconUrl from "./assets/xp.svg";

export interface SteamFullScreenProfileDashboardProps {
  readonly profile: NormalizedProfile;
  readonly summary: SteamFullScreenProfileSummary;
  readonly steamHuntersProfile: SteamHuntersProfile | undefined;
  readonly recentUnlocks: readonly RecentUnlock[];
  readonly refreshedAt: number | undefined;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onOpenProviderSettings: () => void;
  readonly onOpenExternalUrl: (url: string) => void;
}

const BLUE_ICON_FILTER =
  "brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(1250%) hue-rotate(165deg) brightness(101%) contrast(102%)";
const GOLD_ICON_FILTER =
  "brightness(0) saturate(100%) invert(78%) sepia(63%) saturate(754%) hue-rotate(350deg) brightness(102%) contrast(92%)";

type DashboardGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const scrollFocusedDashboardContent: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedDashboardGamepadContent: DashboardGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function formatCount(value: number | undefined): string {
  return value !== undefined ? value.toLocaleString() : "-";
}

function formatPercent(value: number | undefined): string {
  return value !== undefined ? `${value}%` : "-";
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
    color: "rgba(242, 246, 251, 0.98)",
  };
}

function getDashboardGridStyle(): CSSProperties {
  return {
    display: "grid",
    // Gaming Mode's visible route is 854 CSS pixels wide. These minimums,
    // including the grid gap, remain inside its content viewport.
    gridTemplateColumns: "minmax(192px, 0.9fr) minmax(248px, 1fr) minmax(248px, 1.04fr)",
    gridTemplateRows: "minmax(192px, 1fr) minmax(174px, 0.9fr)",
    gridTemplateAreas: '"profile progress insights" "profile activity recent"',
    alignItems: "stretch",
    gap: 8,
    width: "100%",
    minWidth: 0,
  };
}

function getPanelStyle(gridArea: string): CSSProperties {
  return {
    gridArea,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    height: "100%",
    padding: 10,
    border: "1px solid rgba(35, 156, 215, 0.52)",
    borderRadius: 14,
    background:
      "linear-gradient(155deg, rgba(10, 38, 56, 0.92), rgba(6, 25, 39, 0.92) 56%, rgba(10, 31, 46, 0.94))",
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
    color: "rgba(211, 228, 247, 0.96)",
    fontSize: "clamp(0.86rem, 1.25vw, 1.02rem)",
    fontWeight: 850,
    letterSpacing: "0.075em",
    lineHeight: 1.12,
    textTransform: "uppercase",
  };
}

function getPanelSubtitleStyle(): CSSProperties {
  return {
    color: "rgba(176, 207, 235, 0.78)",
    fontSize: "0.76em",
    lineHeight: 1.2,
  };
}

function DashboardPanel({
  gridArea,
  title,
  subtitle,
  action,
  children,
}: {
  readonly gridArea: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section style={getPanelStyle(gridArea)}>
      {title !== undefined ? (
        <div style={getPanelHeaderStyle()}>
          <div style={getPanelHeadingGroupStyle()}>
            <div style={getPanelTitleStyle()}>{title}</div>
            {subtitle !== undefined ? <div style={getPanelSubtitleStyle()}>{subtitle}</div> : null}
          </div>
          {action}
        </div>
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
    border: "3px solid #36b9ff",
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
    color: "#f2f6fb",
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
    color: "#f2f6fb",
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
    color: "#59cbff",
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
    color: "rgba(194, 219, 241, 0.82)",
    fontSize: "0.76em",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function getDividerStyle(): CSSProperties {
  return { height: 1, flexShrink: 0, backgroundColor: "rgba(90, 184, 229, 0.22)" };
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
    color: "rgba(229, 239, 248, 0.9)",
    fontSize: "0.77em",
    lineHeight: 1.2,
  };
}

function getIconStyle(size: number, tone: "blue" | "gold" = "blue"): CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    filter: tone === "gold" ? GOLD_ICON_FILTER : BLUE_ICON_FILTER,
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

function getProvidersTitleStyle(): CSSProperties {
  return {
    color: "rgba(189, 215, 239, 0.88)",
    fontSize: "0.76em",
    fontWeight: 850,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function getProviderRowsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4 };
}

function getProviderRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    padding: "4px 8px",
    border: "1px solid rgba(66, 153, 198, 0.28)",
    borderRadius: 10,
    backgroundColor: "rgba(16, 54, 75, 0.48)",
  };
}

function getProviderNameStyle(): CSSProperties {
  return {
    color: "rgba(243, 248, 252, 0.96)",
    fontSize: "0.78em",
    fontWeight: 750,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getProviderStateStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#59cbff",
    fontSize: "0.68em",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function ProviderRow({ kind, label, state }: {
  readonly kind: "steam" | "steamhunters";
  readonly label: string;
  readonly state: string;
}): JSX.Element {
  return (
    <div style={getProviderRowStyle()}>
      {kind === "steam" ? (
        <img alt="" src={steamIconUrl} style={getIconStyle(20)} />
      ) : (
        <DeckySteamHuntersIcon color="#59cbff" size={20} />
      )}
      <div style={getProviderNameStyle()}>{label}</div>
      <div style={getProviderStateStyle()}>
        <span aria-hidden="true" style={getStatusDotStyle()} />
        {state}
      </div>
    </div>
  );
}

function getProfileActionsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 5, marginTop: "auto" };
}

function SteamProfileIdentityPanel({
  profile,
  refreshedAt,
  onOpenProviderSettings,
  onOpenExternalUrl,
}: Pick<
  SteamFullScreenProfileDashboardProps,
  "profile" | "refreshedAt" | "onOpenProviderSettings" | "onOpenExternalUrl"
>): JSX.Element {
  const memberSince = formatProfileMemberSince(profile.metrics);
  const profileUrl = profile.identity.profileUrl;
  const avatarUrl = addProfileAvatarCacheBustParam(profile.identity.avatarUrl, refreshedAt);

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

      <div style={getDividerStyle()} />
      <div style={getProvidersTitleStyle()}>Connected providers</div>
      <div style={getProviderRowsStyle()}>
        <ProviderRow kind="steam" label="Steam" state="Connected" />
        <ProviderRow kind="steamhunters" label="SteamHunters" state="Enrichment" />
      </div>

      <div style={getProfileActionsStyle()}>
        <DeckyFullscreenActionRow>
          <DeckyFullscreenActionButton
            contentAlign="left"
            compact
            disabled={profileUrl === undefined}
            fullWidth
            icon={<DeckySteamExternalLinkIcon size={18} />}
            label="View Steam Profile"
            primary
            onClick={() => {
              if (profileUrl !== undefined) {
                onOpenExternalUrl(profileUrl);
              }
            }}
          />
          <DeckyFullscreenActionButton
            contentAlign="left"
            compact
            fullWidth
            icon={<DeckySteamHuntersIcon size={18} />}
            label="Provider Settings"
            onClick={onOpenProviderSettings}
          />
        </DeckyFullscreenActionRow>
      </div>
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
    color: "#f5f9fd",
    fontSize: "clamp(1.35rem, 2.55vw, 2.1rem)",
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
    gridTemplateColumns: "28px minmax(0, 1fr)",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    padding: "6px 8px",
    border: "1px solid rgba(74, 154, 194, 0.28)",
    borderRadius: 11,
    backgroundColor: "rgba(13, 46, 65, 0.56)",
    boxSizing: "border-box",
  };
}

function getMetricTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 };
}

function getMetricLabelStyle(): CSSProperties {
  return {
    color: "rgba(178, 208, 235, 0.78)",
    fontSize: "0.63em",
    fontWeight: 800,
    letterSpacing: "0.07em",
    lineHeight: 1.1,
    textTransform: "uppercase",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getMetricValueStyle(): CSSProperties {
  return {
    color: "rgba(245, 249, 253, 0.98)",
    fontSize: "0.98em",
    fontWeight: 850,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function MetricTile({ iconUrl, label, value, tone = "blue" }: {
  readonly iconUrl: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: "blue" | "gold";
}): JSX.Element {
  return (
    <div style={getMetricTileStyle()}>
      <img alt="" src={iconUrl} style={getIconStyle(23, tone)} />
      <div style={getMetricTextStyle()}>
        <div style={getMetricLabelStyle()}>{label}</div>
        <div style={getMetricValueStyle()}>{value}</div>
      </div>
    </div>
  );
}

function SteamProgressPanel({ summary }: { readonly summary: SteamFullScreenProfileSummary }): JSX.Element {
  const total = summary.achievements.total;
  const unlocked = summary.achievements.unlocked;
  const remaining = total !== undefined ? Math.max(0, total - unlocked) : undefined;
  const completionPercent = summary.achievements.completionPercent;

  return (
    <DashboardPanel gridArea="progress" title="Your Progress (Steam)" subtitle="Across all tracked games">
      <div style={getProgressHeroStyle()}>
        <div style={getProgressValueStyle()}>
          {total !== undefined ? `${formatCount(unlocked)} / ${formatCount(total)}` : formatCount(unlocked)}
        </div>
        <div style={getProgressLabelStyle()}>achievements unlocked</div>
      </div>
      {completionPercent !== undefined ? (
        <div style={getProgressBarRowStyle()}>
          <DeckyCompletionProgressBar breathe percent={completionPercent} showCaption={false} />
          <span style={getProgressPercentStyle()}>{formatPercent(completionPercent)}</span>
        </div>
      ) : null}
      <div style={getMetricGridStyle()}>
        <MetricTile iconUrl={trophyIconUrl} label="Unlocked" value={formatCount(unlocked)} />
        <MetricTile iconUrl={pieChartIconUrl} label="Remaining" value={formatCount(remaining)} />
        <MetricTile iconUrl={crownIconUrl} label="Perfected" tone="gold" value={formatCount(summary.achievements.perfectGames)} />
        <MetricTile iconUrl={barChartIconUrl} label="Completion avg" value={formatPercent(completionPercent)} />
      </div>
    </DashboardPanel>
  );
}

function getStatusMetricTileStyle(): CSSProperties {
  return {
    ...getMetricTileStyle(),
    gridTemplateColumns: "28px minmax(0, 1fr)",
    padding: "6px 8px",
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
    <DashboardPanel
      gridArea="insights"
      title="SteamHunters Profile"
      subtitle="SteamHunters totals, separate from your Steam library"
    >
      <div style={getMetricGridStyle()}>
        <StatusMetricTile
          icon={<DeckySteamHuntersIcon color="#36b9ff" size={23} />}
          label="Points"
          value={formatCount(steamHuntersProfile?.points)}
        />
        <MetricTile
          iconUrl={pieChartIconUrl}
          label="Avg. completion"
          value={formatPercent(steamHuntersProfile?.averageGameCompletion)}
        />
        <MetricTile iconUrl={libraryIconUrl} label="Tracked games" value={formatCount(steamHuntersProfile?.trackedGames)} />
        <MetricTile
          iconUrl={crownIconUrl}
          label="Unrestricted points"
          tone="gold"
          value={formatCount(steamHuntersProfile?.unrestrictedPoints)}
        />
        <MetricTile iconUrl={checkCircleIconUrl} label="Legendary unlocks" value={formatCount(steamHuntersProfile?.legendaryAchievements)} />
        <MetricTile
          iconUrl={barChartIconUrl}
          label="Obtainable completion"
          value={formatPercent(steamHuntersProfile?.obtainableAverageGameCompletion)}
        />
      </div>
    </DashboardPanel>
  );
}

function getListStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getListRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    padding: 4,
    border: "1px solid rgba(66, 153, 198, 0.24)",
    borderRadius: 10,
    backgroundColor: "rgba(10, 37, 53, 0.62)",
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

function DashboardListRow({ children, ariaLabel, onActivate }: {
  readonly children: ReactNode;
  readonly ariaLabel: string;
  readonly onActivate: () => void;
}): JSX.Element {
  return (
    <Focusable
      aria-label={ariaLabel}
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      onActivate={onActivate}
      onClick={onActivate}
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
  onOpenAchievementHistory,
  onOpenAchievementDetail,
}: Pick<
  SteamFullScreenProfileDashboardProps,
  "recentUnlocks" | "onOpenAchievementHistory" | "onOpenAchievementDetail"
>): JSX.Element {
  const visibleUnlocks = recentUnlocks.slice(0, 3);
  return (
    <DashboardPanel
      gridArea="activity"
      title="Recent Activity"
      subtitle="Latest 3 achievement unlocks"
      action={(
        <DeckyFullscreenActionButton compact label="View All" onClick={onOpenAchievementHistory} />
      )}
    >
      {visibleUnlocks.length > 0 ? (
        <div style={getListStyle()}>
          {visibleUnlocks.map((recentUnlock) => {
            const unlockedAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
            return (
              <DashboardListRow
                key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}
                ariaLabel={`Open ${recentUnlock.achievement.title}`}
                onActivate={() => {
                  onOpenAchievementDetail(recentUnlock.game.gameId, recentUnlock.achievement.achievementId);
                }}
              >
                <DashboardArtwork
                  height={32}
                  src={recentUnlock.achievement.badgeImageUrl}
                  title={recentUnlock.achievement.title}
                  width={32}
                />
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
        </div>
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

function SteamRecentGameRow({ game, onOpenGameDetail }: {
  readonly game: SteamProfileGameSummary;
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  const achievementLabel = game.totalAchievements !== undefined
    ? `${formatCount(game.unlockedAchievements)} / ${formatCount(game.totalAchievements)} achievements`
    : `${formatCount(game.unlockedAchievements)} unlocked`;

  return (
    <DashboardListRow
      ariaLabel={`Open ${game.title}`}
      onActivate={() => {
        onOpenGameDetail(game.gameId);
      }}
    >
      <DashboardArtwork
        height={32}
        src={game.artworkUrl}
        title={game.title}
        width={56}
      />
      <div style={getListTextStyle()}>
        <div style={getListTitleStyle()}>{game.title}</div>
        <div style={getListMetaStyle()}>{achievementLabel}</div>
        {game.completionPercent !== undefined ? (
          <div style={getGameProgressStyle()}>
            <DeckyCompletionProgressBar compact percent={game.completionPercent} showCaption={false} />
            <span style={getListTitleStyle()}>{formatPercent(game.completionPercent)}</span>
          </div>
        ) : null}
      </div>
      <span aria-hidden="true" />
    </DashboardListRow>
  );
}

function SteamRecentlyPlayedPanel({ summary, onOpenCompletionProgress, onOpenGameDetail }: Pick<
  SteamFullScreenProfileDashboardProps,
  "summary" | "onOpenCompletionProgress" | "onOpenGameDetail"
>): JSX.Element {
  const visibleGames = summary.recentGames.slice(0, 3);
  return (
    <DashboardPanel
      gridArea="recent"
      title="Recently Played"
      subtitle="Your latest Steam games"
      action={(
        <DeckyFullscreenActionButton compact label="View All" onClick={onOpenCompletionProgress} />
      )}
    >
      {visibleGames.length > 0 ? (
        <div style={getListStyle()}>
          {visibleGames.map((game) => (
            <SteamRecentGameRow key={game.gameId} game={game} onOpenGameDetail={onOpenGameDetail} />
          ))}
        </div>
      ) : (
        <div style={getEmptyListStyle()}>No recently played games are available.</div>
      )}
    </DashboardPanel>
  );
}

export function SteamFullScreenProfileDashboard({
  profile,
  summary,
  steamHuntersProfile,
  recentUnlocks,
  refreshedAt,
  onOpenCompletionProgress,
  onOpenAchievementHistory,
  onOpenGameDetail,
  onOpenAchievementDetail,
  onOpenProviderSettings,
  onOpenExternalUrl,
}: SteamFullScreenProfileDashboardProps): JSX.Element {
  return (
    <div data-steam-full-screen-profile-dashboard style={getDashboardStyle()}>
      <div style={getDashboardGridStyle()}>
        <SteamProfileIdentityPanel
          profile={profile}
          refreshedAt={refreshedAt}
          onOpenProviderSettings={onOpenProviderSettings}
          onOpenExternalUrl={onOpenExternalUrl}
        />
        <SteamProgressPanel summary={summary} />
      <SteamInsightsPanel steamHuntersProfile={steamHuntersProfile} />
        <SteamRecentActivityPanel
          recentUnlocks={recentUnlocks}
          onOpenAchievementHistory={onOpenAchievementHistory}
          onOpenAchievementDetail={onOpenAchievementDetail}
        />
        <SteamRecentlyPlayedPanel
          summary={summary}
          onOpenCompletionProgress={onOpenCompletionProgress}
          onOpenGameDetail={onOpenGameDetail}
        />
      </div>
    </div>
  );
}
