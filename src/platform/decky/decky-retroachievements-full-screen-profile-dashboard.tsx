import { Focusable, NavEntryPositionPreferences } from "@decky/ui";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { raRecipes, raTheme } from "./ra-theme";
import { formatDeckyRelativeTime } from "./decky-stat-helpers";

type Model = ReturnType<typeof import("./decky-retroachievements-full-screen-profile-data").buildRetroAchievementsFullScreenProfileModel>;

function pageStyle(): CSSProperties {
  return {
    height: "100%",
    minHeight: 0,
    padding: "43px 14px 48px",
    boxSizing: "border-box",
    overflow: "hidden",
    color: raTheme.color.textPrimary,
    background: raTheme.surface.page,
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1.4fr)",
    gridTemplateRows: "minmax(160px, .9fr) minmax(0, 1.1fr)",
    gridTemplateAreas: '"identity progress" "activity games"',
    gap: 10,
    width: "100%",
    height: "100%",
    minHeight: 0,
  };
}

function panelStyle(area: string): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    gridArea: area,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  };
}

function titleStyle(): CSSProperties {
  return { color: raTheme.color.accent, fontSize: 12, fontWeight: 850, letterSpacing: "0.05em" };
}

function Metric({ label, value, detail }: { readonly label: string; readonly value: string; readonly detail?: string }): JSX.Element {
  return (
    <div style={{ ...raRecipes.metric("fullscreen"), minWidth: 0, padding: "9px 10px" }}>
      <div style={{ minWidth: 0, textAlign: "center", width: "100%" }}>
        <div style={{ fontSize: 18, fontWeight: 850 }}>{value}</div>
        <div style={{ color: raTheme.color.textSecondary, fontSize: 10 }}>{label}</div>
        {detail !== undefined ? <div style={{ color: raTheme.color.textMuted, fontSize: 8.5 }}>{detail}</div> : null}
      </div>
    </div>
  );
}

function ActionRow({ children, label, onActivate }: { readonly children: ReactNode; readonly label: string; readonly onActivate: () => void }): JSX.Element {
  return (
    <Focusable
      noFocusRing
      role="button"
      aria-label={label}
      onActivate={onActivate}
      onClick={onActivate}
      onFocus={(event) => scrollDeckyFocusTargetIntoView(event.currentTarget)}
      onGamepadFocus={(event) => scrollDeckyFocusTargetIntoView(event.currentTarget)}
      style={{ ...raRecipes.row("fullscreen"), flex: "0 0 58px", minHeight: 58, padding: 6 }}
    >
      {children}
    </Focusable>
  );
}

export function DeckyRetroAchievementsFullScreenProfileDashboard({
  model,
  isActive,
  onOpenAchievementHistory,
  onOpenAchievementDetail,
  onOpenCompletionProgress,
  onOpenGameDetail,
}: {
  readonly model: Model;
  readonly isActive: boolean;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isActive) return;
    const root = rootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || root === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const target = root.querySelector<HTMLElement>("[role='button']");
      if (target !== null && !root.contains(root.ownerDocument.activeElement)) takeDeckySteamGamepadFocus(target);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  const memberSince = model.profile.metrics.find((metric) => metric.key === "member-since")?.value;
  return (
    <main ref={rootRef} data-ac-ra-theme="fullscreen" data-ra-full-screen-profile-dashboard style={pageStyle()}>
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={gridStyle()}>
        <section style={panelStyle("identity")}>
          <div style={titleStyle()}>RETROACHIEVEMENTS PROFILE</div>
          <div style={{ display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", alignItems: "center", gap: 14 }}>
            {model.profile.identity.avatarUrl !== undefined
              ? <img alt="" src={model.profile.identity.avatarUrl} style={{ width: 92, height: 92, borderRadius: 12, objectFit: "cover" }} />
              : <div style={{ width: 92, height: 92, display: "grid", placeItems: "center", borderRadius: 12, background: raTheme.surface.interactive, fontSize: 28, fontWeight: 900 }}>{model.profile.identity.displayName.slice(0, 2).toUpperCase()}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 25, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>{model.profile.identity.displayName}</div>
              {memberSince !== undefined ? <div style={{ color: raTheme.color.textSecondary, marginTop: 4 }}>{`Member since ${memberSince}`}</div> : null}
              {model.profile.motto !== undefined ? <div style={{ color: raTheme.color.textMuted, marginTop: 6 }}>{model.profile.motto}</div> : null}
            </div>
          </div>
          {model.ranks.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: `repeat(${model.ranks.length}, minmax(0, 1fr))`, gap: 7 }}>
            {model.ranks.map((rank) => <Metric key={rank.kind} label={rank.label} value={rank.value} />)}
          </div> : null}
        </section>

        <section style={panelStyle("progress")}>
          <div style={titleStyle()}>POINTS &amp; PROGRESS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}>
            {model.overviewMetrics.map((metric) => <Metric key={metric.key} label={metric.label} value={metric.value} {...(metric.detail !== undefined ? { detail: metric.detail } : {})} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}>
            <Metric label="Games with progress" value={model.completion.gamesWithProgress.toLocaleString()} />
            <Metric label="In Progress" value={model.completion.inProgress.toLocaleString()} />
            <Metric label="Beaten / Completed" value={model.completion.beaten.toLocaleString()} />
            <Metric label="Mastered" value={model.completion.mastered.toLocaleString()} />
          </div>
        </section>

        <section style={panelStyle("activity")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={titleStyle()}>RECENT ACTIVITY</div><Focusable noFocusRing role="button" onActivate={onOpenAchievementHistory} onClick={onOpenAchievementHistory} style={{ ...raRecipes.action("fullscreen", false), width: "auto", minHeight: 28, padding: "4px 10px", fontSize: 10 }}>View All</Focusable></div>
          <Focusable flow-children="vertical" navEntryPreferPosition={NavEntryPositionPreferences.FIRST} noFocusRing tabIndex={-1} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden" }}>
            {model.recentUnlocks.length > 0 ? model.recentUnlocks.map((entry) => (
              <ActionRow key={`${entry.game.gameId}:${entry.achievement.achievementId}:${entry.achievement.unlockMode ?? "unknown"}:${entry.unlockedAt ?? "unknown"}`} label={`Open ${entry.achievement.title}`} onActivate={() => onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId)}>
                {entry.achievement.badgeImageUrl !== undefined ? <img alt="" src={entry.achievement.badgeImageUrl} style={{ width: 46, height: 46, borderRadius: 7 }} /> : null}
                <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.achievement.title}</div><div style={{ color: raTheme.color.textSecondary, fontSize: 10 }}>{entry.game.title}</div></div>
                <div style={{ color: entry.achievement.unlockMode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore, fontSize: 9, textAlign: "right" }}>{entry.achievement.unlockMode ?? "Unlocked"}<br />{entry.unlockedAt !== undefined ? formatDeckyRelativeTime(entry.unlockedAt) : ""}</div>
              </ActionRow>
            )) : <div style={{ color: raTheme.color.textMuted }}>No recent unlocks are available.</div>}
          </Focusable>
        </section>

        <section style={panelStyle("games")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={titleStyle()}>RECENTLY PLAYED</div><Focusable noFocusRing role="button" onActivate={onOpenCompletionProgress} onClick={onOpenCompletionProgress} style={{ ...raRecipes.action("fullscreen", false), width: "auto", minHeight: 28, padding: "4px 10px", fontSize: 10 }}>View All</Focusable></div>
          <Focusable flow-children="vertical" navEntryPreferPosition={NavEntryPositionPreferences.FIRST} noFocusRing tabIndex={-1} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden" }}>
            {model.recentGames.length > 0 ? model.recentGames.map(({ game, progress }) => (
              <ActionRow key={game.gameId} label={`Open ${game.title}`} onActivate={() => onOpenGameDetail(game.gameId)}>
                <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl} size={46} />
                <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.title}</div><div style={{ color: raTheme.color.textSecondary, fontSize: 10 }}>{game.platformLabel ?? "RetroAchievements"}</div></div>
                <div style={{ fontWeight: 850 }}>{progress?.totalCount !== undefined ? `${progress.unlockedCount} / ${progress.totalCount}` : progress?.unlockedCount ?? 0}</div>
              </ActionRow>
            )) : <div style={{ color: raTheme.color.textMuted }}>No recently played games are available.</div>}
          </Focusable>
        </section>
      </Focusable>
    </main>
  );
}
