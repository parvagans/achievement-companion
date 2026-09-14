import { Focusable, type FocusableProps } from "@decky/ui";
import type { CSSProperties, FocusEventHandler, JSX, ReactNode } from "react";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { formatDeckyRelativeTime, formatSteamPlaytimeMinutes } from "./decky-stat-helpers";
import type { SteamFullScreenProfileSummary, SteamProfileGameSummary } from "./decky-steam-full-screen-profile-data";

function formatCount(value: number | undefined): string {
  return value !== undefined ? value.toLocaleString() : "-";
}

function getSectionGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    width: "100%",
    minWidth: 0,
  };
}

function getRecentGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
    width: "100%",
    minWidth: 0,
  };
}

function getCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    height: "100%",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.075)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.025))",
    boxSizing: "border-box",
  };
}

function getTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.74em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
    minWidth: 0,
  };
}

function getPlaytimeGridStyle(count: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(0, 1fr))`,
    gap: 8,
    width: "100%",
    minWidth: 0,
  };
}

function getStatTileStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid rgba(255, 255, 255, 0.055)",
    backgroundColor: "rgba(255, 255, 255, 0.028)",
  };
}

function getStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.68em",
    fontWeight: 800,
    letterSpacing: "0.075em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "1em",
    fontWeight: 750,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.66)",
    fontSize: "0.82em",
    lineHeight: 1.3,
  };
}

function getQuietMetadataStyle(): CSSProperties {
  return {
    ...getMetaStyle(),
    paddingTop: 2,
    color: "rgba(255, 255, 255, 0.52)",
    fontSize: "0.76em",
  };
}

function getGameLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  };
}

function getGameTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  };
}

function getGameTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.98em",
    fontWeight: 750,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

const scrollFocusedContent: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedGamepadContent: NonNullable<FocusableProps["onGamepadFocus"]> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function SteamProfileCard({
  children,
  onActivate,
}: {
  readonly children: ReactNode;
  readonly onActivate?: () => void;
}): JSX.Element {
  const isActionable = onActivate !== undefined;

  return (
    <Focusable
      noFocusRing
      {...(isActionable ? { role: "button" } : {})}
      onActivate={onActivate ?? (() => {})}
      {...(isActionable ? { onClick: onActivate } : {})}
      onFocus={scrollFocusedContent}
      onGamepadFocus={scrollFocusedGamepadContent}
      style={getCardStyle()}
    >
      {children}
    </Focusable>
  );
}

function SteamProfileStatTile({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div style={getStatTileStyle()}>
      <div style={getStatLabelStyle()}>{label}</div>
      <div style={getStatValueStyle()}>{value}</div>
    </div>
  );
}

function SteamProfileCardGrid({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style: CSSProperties;
}): JSX.Element {
  return (
    <Focusable
      flow-children="left-right"
      noFocusRing
      onActivate={() => {}}
      onFocus={scrollFocusedContent}
      onGamepadFocus={scrollFocusedGamepadContent}
      style={style}
    >
      {children}
    </Focusable>
  );
}

function SteamProfileGameCard({
  title,
  game,
  kind,
  onOpenGameDetail,
}: {
  readonly title: string;
  readonly game: SteamProfileGameSummary | undefined;
  readonly kind: "most-played" | "closest-to-perfect" | "recent";
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  if (game === undefined) {
    return (
      <SteamProfileCard>
        <div style={getTitleStyle()}>{title}</div>
        <div style={getMetaStyle()}>
          {kind === "closest-to-perfect"
            ? "No unfinished game with a scanned achievement set is available."
            : kind === "most-played"
              ? "No recorded playtime is available in the cached library scan."
              : "No recently played games are available."}
        </div>
      </SteamProfileCard>
    );
  }

  const achievementLabel = game.totalAchievements !== undefined
    ? `${formatCount(game.unlockedAchievements)} / ${formatCount(game.totalAchievements)} achievements`
    : `${formatCount(game.unlockedAchievements)} achievements unlocked`;
  const lines = [
    kind === "closest-to-perfect" && game.completionPercent !== undefined
      ? `${game.completionPercent}% complete${game.achievementsRemaining !== undefined ? ` · ${formatCount(game.achievementsRemaining)} remaining` : ""}`
      : undefined,
    kind === "recent" && game.lastPlayedAt !== undefined
      ? `Played ${formatDeckyRelativeTime(game.lastPlayedAt) ?? "recently"}`
      : undefined,
    game.totalPlaytimeMinutes !== undefined
      ? `${formatSteamPlaytimeMinutes(game.totalPlaytimeMinutes) ?? "0m"} total`
      : undefined,
    game.steamDeckPlaytimeMinutes !== undefined
      ? `${formatSteamPlaytimeMinutes(game.steamDeckPlaytimeMinutes) ?? "0m"} on Steam Deck`
      : undefined,
  ].filter((line): line is string => line !== undefined);

  return (
    <SteamProfileCard onActivate={() => { onOpenGameDetail(game.gameId); }}>
      <div style={getTitleStyle()}>{title}</div>
      <div style={getGameLayoutStyle()}>
        {game.artworkUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.artworkUrl} size={54} title={game.title} />
        ) : null}
        <div style={getGameTextStyle()}>
          <div style={getGameTitleStyle()}>{game.title}</div>
          <div style={getMetaStyle()}>{achievementLabel}</div>
          {lines.map((line) => <div key={line} style={getMetaStyle()}>{line}</div>)}
        </div>
      </div>
    </SteamProfileCard>
  );
}

export function SteamAccountOverview({ summary }: { readonly summary: SteamFullScreenProfileSummary }): JSX.Element {
  const account = summary.account;
  const achievements = summary.achievements;

  return (
    <SteamProfileCardGrid style={getSectionGridStyle()}>
      <SteamProfileCard>
        <div style={getTitleStyle()}>Steam Account</div>
        <div style={getStatGridStyle()}>
          <SteamProfileStatTile label="Level" value={formatCount(account.level)} />
          <SteamProfileStatTile label="Badges" value={formatCount(account.badges)} />
        </div>
        {account.xp !== undefined ? <div style={getMetaStyle()}>{`${formatCount(account.xp)} XP`}</div> : null}
        {account.xpProgressPercent !== undefined ? (
          <DeckyCompletionProgressBar compact percent={account.xpProgressPercent} />
        ) : null}
        {account.xpToNextLevel !== undefined && account.nextLevel !== undefined ? (
          <div style={getMetaStyle()}>{`${formatCount(account.xpToNextLevel)} XP to Level ${account.nextLevel}`}</div>
        ) : null}
      </SteamProfileCard>

      <SteamProfileCard>
        <div style={getTitleStyle()}>Achievements</div>
        <div style={getStatGridStyle()}>
          <SteamProfileStatTile label="Unlocked" value={formatCount(achievements.unlocked)} />
          <SteamProfileStatTile label="Perfect" value={formatCount(achievements.perfectGames)} />
        </div>
        <SteamProfileStatTile
          label="Achievement Completion"
          value={achievements.completionPercent !== undefined ? `${achievements.completionPercent}%` : "-"}
        />
      </SteamProfileCard>
    </SteamProfileCardGrid>
  );
}

export function SteamLibraryProgress({ summary }: { readonly summary: SteamFullScreenProfileSummary }): JSX.Element {
  const library = summary.library;
  const playtimeStats = [
    library.totalPlaytimeMinutes !== undefined
      ? { label: "Total Playtime", value: formatSteamPlaytimeMinutes(library.totalPlaytimeMinutes) ?? "0m" }
      : undefined,
    library.steamDeckPlaytimeMinutes !== undefined
      ? { label: "Steam Deck", value: formatSteamPlaytimeMinutes(library.steamDeckPlaytimeMinutes) ?? "0m" }
      : undefined,
    library.lastTwoWeeksPlaytimeMinutes !== undefined
      ? { label: "Last 2 Weeks", value: formatSteamPlaytimeMinutes(library.lastTwoWeeksPlaytimeMinutes) ?? "0m" }
      : undefined,
  ].filter((stat): stat is { readonly label: string; readonly value: string } => stat !== undefined);

  return (
    <SteamProfileCard>
      <div style={getTitleStyle()}>Library Progress</div>
      <div style={getStatGridStyle()}>
        <SteamProfileStatTile label="Owned Games" value={formatCount(library.ownedGames)} />
        <SteamProfileStatTile label="Played" value={formatCount(library.playedGames)} />
        <SteamProfileStatTile label="Unplayed" value={formatCount(library.unplayedGames)} />
        <SteamProfileStatTile label="In Progress" value={formatCount(library.inProgressGames)} />
        <SteamProfileStatTile label="Perfect Games" value={formatCount(summary.achievements.perfectGames)} />
        <SteamProfileStatTile
          label="Completion"
          value={summary.achievements.completionPercent !== undefined ? `${summary.achievements.completionPercent}%` : "-"}
        />
      </div>
      {playtimeStats.length > 0 ? (
        <>
          <div style={getTitleStyle()}>Playtime</div>
          <div style={getPlaytimeGridStyle(playtimeStats.length)}>
            {playtimeStats.map((stat) => <SteamProfileStatTile key={stat.label} {...stat} />)}
          </div>
        </>
      ) : null}
      {library.lastLibraryScanAt !== undefined ? (
        <div style={getQuietMetadataStyle()}>{`Last library scan: ${formatDeckyRelativeTime(library.lastLibraryScanAt) ?? "unknown"}`}</div>
      ) : null}
    </SteamProfileCard>
  );
}

export function SteamLibraryHighlights({
  summary,
  onOpenGameDetail,
}: {
  readonly summary: SteamFullScreenProfileSummary;
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  return (
    <SteamProfileCardGrid style={getSectionGridStyle()}>
      <SteamProfileGameCard title="Most Played" game={summary.mostPlayedGame} kind="most-played" onOpenGameDetail={onOpenGameDetail} />
      <SteamProfileGameCard title="Closest to Perfect" game={summary.closestToPerfectGame} kind="closest-to-perfect" onOpenGameDetail={onOpenGameDetail} />
    </SteamProfileCardGrid>
  );
}

export function SteamRecentActivity({
  games,
  onOpenGameDetail,
}: {
  readonly games: readonly SteamProfileGameSummary[];
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  return (
    <SteamProfileCardGrid style={getRecentGridStyle()}>
      {games.length > 0
        ? games.map((game) => (
          <SteamProfileGameCard
            key={game.gameId}
            title="Recent Game"
            game={game}
            kind="recent"
            onOpenGameDetail={onOpenGameDetail}
          />
        ))
        : <SteamProfileGameCard title="Recent Activity" game={undefined} kind="recent" onOpenGameDetail={onOpenGameDetail} />}
    </SteamProfileCardGrid>
  );
}
