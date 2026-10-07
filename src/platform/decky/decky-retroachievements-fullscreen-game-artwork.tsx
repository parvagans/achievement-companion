import type { CSSProperties } from "react";
import type { NormalizedGame } from "@core/domain";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { raRecipes } from "./ra-theme";

function getArtworkFrameStyle(variant: "default" | "compact"): CSSProperties {
  const isCompact = variant === "compact";

  return {
    ...raRecipes.artwork(isCompact ? "compact" : "fullscreen"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: isCompact ? 168 : "100%",
    minWidth: isCompact ? 140 : 0,
    maxWidth: isCompact ? 180 : 268,
    height: isCompact ? 168 : 256,
    maxHeight: isCompact ? 180 : 256,
    padding: isCompact ? 10 : 14,
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "hidden",
  };
}

export interface DeckyRetroAchievementsFullscreenGameArtworkProps {
  readonly game: NormalizedGame;
  readonly src?: string | undefined;
  readonly variant?: "default" | "compact";
}

export function DeckyRetroAchievementsFullscreenGameArtwork({
  game,
  src,
  variant = "default",
}: DeckyRetroAchievementsFullscreenGameArtworkProps): JSX.Element {
  return (
    <span aria-hidden="true" style={getArtworkFrameStyle(variant)}>
      <DeckyRetroAchievementsGameIcon game={game} src={src} fit="contain" size={variant === "compact" ? 148 : 220} />
    </span>
  );
}
