import type { NormalizedAchievement } from "@core/domain";
import { useState, type CSSProperties } from "react";
import { DeckyAchievementArtwork } from "./decky-achievement-artwork";
import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";

const twoLines: CSSProperties = { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" };

/** Description is a sibling of identity so it uses the entire recommendation width. */
export function DeckyCompactUpNextContent({ label, achievement }: {
  readonly label: string;
  readonly achievement: Pick<NormalizedAchievement, "title" | "description" | "badgeImageUrl">;
}): JSX.Element {
  const [failedArtwork, setFailedArtwork] = useState<string>();
  const artwork = achievement.badgeImageUrl && achievement.badgeImageUrl !== failedArtwork ? achievement.badgeImageUrl : undefined;
  return <>
    <div data-ac-up-next-identity onErrorCapture={() => setFailedArtwork(achievement.badgeImageUrl)} style={{ display: "grid", gridTemplateColumns: artwork ? "48px minmax(0, 1fr)" : "minmax(0, 1fr)", alignItems: "center", gap: 9, minWidth: 0 }}>
      {artwork ? <DeckyAchievementArtwork size={48} src={artwork} /> : null}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ color: theme.color.accent, fontSize: theme.type.compact.caption, fontWeight: 800, letterSpacing: "0.055em", lineHeight: 1.2 }}>{label}</span>
        <strong style={{ ...twoLines, fontSize: theme.type.compact.title, lineHeight: 1.2 }}>{achievement.title}</strong>
      </div>
    </div>
    {achievement.description ? <span data-ac-up-next-description style={{ ...twoLines, color: theme.color.textSecondary, fontSize: theme.type.fullscreen.metadata, lineHeight: 1.3 }}>{achievement.description}</span> : null}
  </>;
}
