import type { CSSProperties } from "react";
import type { NormalizedGame, RecentlyPlayedGame } from "@core/domain";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { raRecipes } from "./ra-theme";

type RetroAchievementsGameIconGame = Pick<NormalizedGame | RecentlyPlayedGame, "providerId" | "title" | "metrics">;

export function getRetroAchievementsGameIconAward(
  game: RetroAchievementsGameIconGame,
): "beaten" | "mastered" | undefined {
  const state = getRetroAchievementsCompletionIndicatorState(game);
  return state?.startsWith("mastered") === true
    ? "mastered"
    : state?.startsWith("beaten") === true
      ? "beaten"
      : undefined;
}

export interface DeckyRetroAchievementsGameIconProps {
  readonly game: RetroAchievementsGameIconGame;
  readonly src?: string | undefined;
  readonly size: number;
  readonly fit?: "cover" | "contain";
  readonly style?: CSSProperties;
}

/** The only game-icon prestige frame. Focus stays on the parent row/card. */
export function DeckyRetroAchievementsGameIcon({
  game,
  src,
  size,
  fit = "cover",
  style,
}: DeckyRetroAchievementsGameIconProps): JSX.Element {
  const award = getRetroAchievementsGameIconAward(game);
  const prominent = award !== undefined && size >= 96;
  const frameWidth = raRecipes.gameIcon.frameWidth(size, award);
  const sweepInset = frameWidth / 2 + 1;
  const sweepRadius = Math.max(2, raRecipes.gameIcon.radius(size) - sweepInset);
  return (
    <span
      aria-hidden="true"
      className="ac-ra-game-icon"
      data-ac-ra-game-icon={award ?? "regular"}
      style={{ ...raRecipes.gameIcon.frame(size, award), ...style }}
    >
      {award !== undefined ? (
        <>
          <svg className="ac-ra-game-icon__sweep" viewBox={`0 0 ${size} ${size}`} focusable="false">
            <rect className="ac-ra-game-icon__sweep-tail" x={sweepInset} y={sweepInset} width={size - 2 * sweepInset} height={size - 2 * sweepInset} rx={sweepRadius} pathLength={100} />
            <rect className="ac-ra-game-icon__sweep-body" x={sweepInset} y={sweepInset} width={size - 2 * sweepInset} height={size - 2 * sweepInset} rx={sweepRadius} pathLength={100} />
            <rect className="ac-ra-game-icon__sweep-front" x={sweepInset} y={sweepInset} width={size - 2 * sweepInset} height={size - 2 * sweepInset} rx={sweepRadius} pathLength={100} />
            <rect className="ac-ra-game-icon__sweep-head" x={sweepInset} y={sweepInset} width={size - 2 * sweepInset} height={size - 2 * sweepInset} rx={sweepRadius} pathLength={100} />
          </svg>
          <span className="ac-ra-game-icon__corner ac-ra-game-icon__corner--top-right" />
          <span className="ac-ra-game-icon__corner ac-ra-game-icon__corner--bottom-right" />
          <span className="ac-ra-game-icon__corner ac-ra-game-icon__corner--bottom-left" />
          <span className="ac-ra-game-icon__corner ac-ra-game-icon__corner--top-left" />
          {prominent ? <span className="ac-ra-game-icon__reveal" /> : null}
        </>
      ) : null}
      <span className="ac-ra-game-icon__artwork" style={raRecipes.gameIcon.artwork(size, award)}>
        {src !== undefined ? (
          <DeckyGameArtwork compact fluid frameless src={src} size={size} fit={fit} title={game.title} />
        ) : (
          <span style={raRecipes.gameIcon.fallback(size)}>{game.title.trim().slice(0, 2).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}
