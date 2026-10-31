import type { CSSProperties, ReactNode } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import type { SavedPinnedAchievement } from "./decky-game-overview-preferences";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyAchievementArtwork } from "./decky-achievement-artwork";
import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";

const twoLines: CSSProperties = {
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere",
};

export function pinnedCompletionModeLabel(mode: SavedPinnedAchievement["completionMode"]): string {
  return mode === "hardcore" ? "Hardcore" : mode === "softcore" ? "Softcore" : "Both";
}

/** Presentation only: the modal retains all actions, focus, loading and pin ownership. */
export function DeckyPinnedAchievementCard({ pin, snapshot, loading, actions }: {
  readonly pin: SavedPinnedAchievement;
  readonly snapshot: GameDetailSnapshot | undefined;
  readonly loading: boolean;
  readonly actions: ReactNode;
}): JSX.Element {
  const achievement = snapshot?.achievements.find((item) => item.achievementId === pin.achievementId);
  const metadata = pin.providerId === "retroachievements"
    ? [snapshot?.game.platformLabel, pinnedCompletionModeLabel(pin.completionMode)].filter(Boolean).join(" · ") : undefined;
  return <article data-ac-pin-game={pin.gameId} style={{ padding: 10, marginBottom: 8, border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.medium, background: theme.surface.contentCard, minWidth: 0 }}>
    <div data-ac-pin-game-identity style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
      {snapshot ? <DeckyGameArtwork compact size={32} title={snapshot.game.title} {...(snapshot.game.coverImageUrl ? { src: snapshot.game.coverImageUrl } : {})} /> : null}
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <strong title={snapshot?.game.title} style={{ ...twoLines, fontSize: theme.type.compact.title, lineHeight: 1.25 }}>{snapshot?.game.title ?? `Game #${pin.gameId}`}</strong>
        {metadata ? <div data-ac-pin-mode style={{ color: theme.color.textSecondary, fontSize: theme.type.compact.metadata, lineHeight: 1.25, overflowWrap: "anywhere" }}>{metadata}</div> : null}
      </div>
    </div>
    <div data-ac-pin-achievement-row style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div data-ac-pin-achievement-info style={{ flex: "1 1 240px", minWidth: 0 }}>
        {achievement ? <div style={{ display: "grid", gridTemplateColumns: achievement.badgeImageUrl ? "40px minmax(0, 1fr)" : "minmax(0, 1fr)", alignItems: "center", gap: 8, minWidth: 0 }}>
          {achievement.badgeImageUrl ? <DeckyAchievementArtwork size={40} src={achievement.badgeImageUrl} /> : null}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <strong style={{ ...twoLines, fontSize: theme.type.compact.title, lineHeight: 1.2 }}>{achievement.title}</strong>
            {achievement.description ? <div style={{ ...twoLines, fontSize: theme.type.fullscreen.metadata, lineHeight: 1.3, color: theme.color.textSecondary }}>{achievement.description}</div> : null}
          </div>
        </div> : <div role="status" style={{ fontSize: theme.type.fullscreen.metadata, lineHeight: 1.3 }}>{loading ? "Loading pinned achievement…" : "Pinned achievement information is unavailable. Your pin is saved."}</div>}
      </div>
      <div data-ac-pin-actions style={{ flex: "0 0 auto", maxWidth: "100%", minWidth: 0 }}>{actions}</div>
    </div>
  </article>;
}
