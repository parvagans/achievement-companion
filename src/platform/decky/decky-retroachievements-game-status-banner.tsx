import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { buildRetroAchievementsCompactGamePresentation } from "./decky-retroachievements-compact-game-model";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { raRecipes, raTheme } from "./ra-theme";

type BannerKind = "in-progress" | "beaten" | "mastered";

function ModeSkullIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5c-4.5 0-7.5 3.25-7.5 7.4 0 2.45 1.25 4.5 3.25 5.7V20h8.5v-4.4c2-1.2 3.25-3.25 3.25-5.7 0-4.15-3-7.4-7.5-7.4Z" fill="currentColor" />
      <path d="M8.2 10.6h2.2v2.2H8.2zm5.4 0h2.2v2.2h-2.2z" fill="#071b29" />
      <path d="M11 15h2l-1 1.6-1-1.6Z" fill="#071b29" />
      <path d="M10 18v2m4-2v2" stroke="#071b29" strokeWidth="1.2" />
    </svg>
  );
}

export function DeckyRetroAchievementsGameStatusBanner({
  snapshot,
  achievementMode,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
}): JSX.Element {
  const presentation = buildRetroAchievementsCompactGamePresentation(snapshot, achievementMode);
  const awardState = presentation.completionStatus;
  const kind: BannerKind = awardState?.startsWith("mastered") === true
    ? "mastered"
    : awardState?.startsWith("beaten") === true
      ? "beaten"
      : "in-progress";
  const awardMode = awardState === undefined ? undefined : awardState.endsWith("hardcore") ? "Hardcore" : "Softcore";
  const totalCount = Math.max(0, presentation.summary.totalCount ?? snapshot.achievements.length);
  const remainingCount = Math.max(0, totalCount - Math.max(0, presentation.summary.unlockedCount));
  const awardLabel = kind === "mastered" ? "Mastered" : "Beaten";
  // RA game progress maps HighestAwardDate to this field; it is the earned award date here.
  const awardTimestamp = awardState !== undefined && snapshot.game.lastUnlockAt !== undefined
    ? new Date(snapshot.game.lastUnlockAt)
    : undefined;
  const modeLabel = achievementMode === "both" ? "Both" : achievementMode === "hardcore" ? "Hardcore" : "Softcore";

  return (
    <section
      aria-label="Achievement mode progress"
      data-ra-fullscreen-game-status-banner={kind}
      data-ra-fullscreen-game-status-mode={achievementMode}
      style={raRecipes.gameStatusBanner.root(kind)}
    >
      <span aria-hidden="true" style={raRecipes.gameStatusBanner.accent(kind)} />
      <div style={raRecipes.gameStatusBanner.main}>
        <span style={raRecipes.gameStatusBanner.modeChip}>
          {achievementMode === "hardcore" ? <ModeSkullIcon /> : null}
          <span>{modeLabel}</span>
        </span>
        {presentation.points !== undefined ? (
          <span style={raRecipes.gameStatusBanner.points}>
            <DeckyRetroAchievementsPointsIcon size={13} />
            {`Points ${presentation.points.toLocaleString()}`}
          </span>
        ) : null}
      </div>
      <div style={raRecipes.gameStatusBanner.statusPanel}>
        {kind === "in-progress" ? (
          <>
            <img alt="" aria-hidden="true" src={steamDeckIconUrl} style={raRecipes.gameStatusBanner.neutralWatermark} />
            <div style={raRecipes.gameStatusBanner.statusText}>
              <span style={raRecipes.gameStatusBanner.eyebrow}>Next milestone</span>
              <strong style={raRecipes.gameStatusBanner.remaining}>{`${remainingCount.toLocaleString()} achievements remaining`}</strong>
            </div>
          </>
        ) : (
          <>
            <span aria-hidden="true" style={raRecipes.gameStatusBanner.awardWatermark}>
              <DeckyGameStatusIcon kind={kind} size={96} color={kind === "mastered" ? raRecipes.gameAward.mastered.color : raTheme.color.beatenFlagWhite} accentColor={kind === "mastered" ? raTheme.color.hardcore : raTheme.color.beatenFlagBlack} />
            </span>
            <span style={{ ...raRecipes.compactGame.statusEmblem(kind), width: 50, height: 50, flex: "0 0 50px" }}>
              <DeckyGameStatusIcon kind={kind} size={39} color={kind === "mastered" ? raRecipes.gameAward.mastered.color : raTheme.color.beatenFlagWhite} accentColor={kind === "mastered" ? raTheme.color.hardcore : raTheme.color.beatenFlagBlack} glow={kind === "mastered" ? "rgba(242, 216, 127, 0.42)" : "rgba(255, 255, 255, 0.3)"} />
            </span>
            <div style={raRecipes.gameStatusBanner.statusText}>
              <strong style={{ ...raRecipes.compactGame.statusTitle(kind), fontSize: 17 }}>{awardLabel}</strong>
              <span style={raRecipes.gameStatusBanner.awardDate}>{awardMode}{awardTimestamp !== undefined ? ` · ${awardTimestamp.toLocaleDateString()}` : ""}</span>
              {awardTimestamp !== undefined ? <span style={raRecipes.gameStatusBanner.awardDate}>{awardTimestamp.toLocaleTimeString()}</span> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
