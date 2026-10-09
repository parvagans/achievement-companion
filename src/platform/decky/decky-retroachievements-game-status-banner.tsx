import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import { getCompletionPercent } from "./decky-completion-progress-bar";
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

function getSummaryStyle(): CSSProperties {
  return {
    color: raTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function BannerProgressBar({ percent, kind }: { readonly percent: number; readonly kind: BannerKind }): JSX.Element {
  const captionInsideFill = percent >= 25;
  const caption = `${percent}%`;
  return (
    <div
      aria-label="Mode achievement progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${caption} complete`}
      role="progressbar"
      style={raRecipes.gameStatusBanner.progressTrack(kind)}
    >
      <div style={raRecipes.gameStatusBanner.progressFill(kind, percent)}>
        {captionInsideFill ? <span style={raRecipes.gameStatusBanner.progressCaption}>{caption}</span> : null}
      </div>
      {!captionInsideFill ? <span style={{ ...raRecipes.gameStatusBanner.progressCaption, position: "absolute", inset: 0, justifyContent: "center" }}>{caption}</span> : null}
    </div>
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
  const summary = presentation.summary;
  const totalCount = Math.max(0, summary.totalCount ?? snapshot.achievements.length);
  const unlockedCount = Math.max(0, summary.unlockedCount);
  const remainingCount = Math.max(0, totalCount - unlockedCount);
  const percent = Math.trunc(getCompletionPercent({ ...summary, totalCount }) ?? 0);
  const awardLabel = kind === "mastered" ? "Mastered" : "Beaten";
  // RA game progress maps HighestAwardDate to this field; it is the earned award date here.
  const awardTimestamp = awardState !== undefined && snapshot.game.lastUnlockAt !== undefined
    ? new Date(snapshot.game.lastUnlockAt)
    : undefined;
  const modeLabel = achievementMode === "both" ? "Both" : achievementMode === "hardcore" ? "Hardcore" : "Softcore";
  const countLabel = kind === "in-progress"
    ? `${unlockedCount.toLocaleString()} unlocked · ${totalCount.toLocaleString()} total · ${percent}% complete`
    : `${unlockedCount.toLocaleString()} / ${totalCount.toLocaleString()} achievements`;

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
        <div style={getSummaryStyle()}>{countLabel}</div>
        <BannerProgressBar kind={kind} percent={percent} />
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
              <DeckyGameStatusIcon kind={kind} size={96} color={raRecipes.gameAward[kind].color} accentColor={kind === "mastered" ? raTheme.color.hardcore : raTheme.color.accentStrong} />
            </span>
            <span style={{ ...raRecipes.compactGame.statusEmblem(kind), width: 50, height: 50, flex: "0 0 50px" }}>
              <DeckyGameStatusIcon kind={kind} size={39} color={raRecipes.gameAward[kind].color} accentColor={kind === "mastered" ? raTheme.color.hardcore : raTheme.color.accentStrong} glow={kind === "mastered" ? "rgba(242, 216, 127, 0.42)" : "rgba(43, 195, 242, 0.42)"} />
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
