import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import { useCallback } from "react";
import { Field, PanelSection, PanelSectionRow } from "@decky/ui";
import type { CSSProperties } from "react";
import {
  DeckyCompletionProgressBar,
  getCompletionPercent,
  type DeckyCompletionProgressBarTone,
} from "./decky-completion-progress-bar";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
  RetroAchievementsCompletionIndicator,
} from "./decky-retroachievements-completion-indicator";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckySystemPill } from "./decky-system-pill";
import { DeckySteamCompactGameOverview } from "./decky-steam-compact-game-overview";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import { ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement } from "./decky-full-screen-cancel-bridge";
import {
  formatRetroAchievementsBeatenAtText,
  formatRetroAchievementsMasteredAtText,
  shouldRenderRetroAchievementsModeSummaryCard,
} from "./decky-achievement-detail-helpers";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { DeckyCompactAchievementList } from "./decky-compact-achievement-list";
import {
  buildCompactAchievementListModel,
  type CompactAchievementModeFilter,
} from "./decky-compact-achievement-model";


export interface DeckyGameDetailViewProps {
  readonly state: ResourceState<GameDetailSnapshot> & {
    readonly data: GameDetailSnapshot;
  };
  readonly onBackToDashboard: () => void;
  readonly onOpenFullScreenPage: (() => void) | undefined;
  readonly onOpenCompactAchievements: (() => void) | undefined;
  readonly onOpenAchievementDetail: (achievementId: string) => void;
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatProgressSummary(snapshot: GameDetailSnapshot): string {
  const summary = snapshot.game.summary;
  const parts = [`${formatCount(summary.unlockedCount)} unlocked`];

  if (summary.totalCount !== undefined) {
    parts.push(`${formatCount(summary.totalCount)} total`);
  }

  return parts.join(" / ");
}

function formatDataSourceLabel(isCachedView: boolean): string {
  return isCachedView ? "Cached snapshot" : "Live snapshot";
}

function getAchievementModeProgressSummary(
  achievements: GameDetailSnapshot["achievements"],
  modeFilter: CompactAchievementModeFilter,
): {
  readonly unlockedCount: number;
  readonly points: number | undefined;
} {
  let unlockedCount = 0;
  let points = 0;
  let hasPoints = false;

  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== modeFilter) {
      continue;
    }

    unlockedCount += 1;
    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }

  return {
    unlockedCount,
    points: hasPoints ? points : undefined,
  };
}

function getGameDetailSectionCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getGameDetailSystemPillStyle(): CSSProperties {
  return {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function getGameDetailOverviewIconFrameStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    minWidth: 72,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.04)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  };
}

function getGameDetailOverviewLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    textAlign: "center",
  };
}

function getGameDetailOverviewTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "1.18em",
    fontWeight: 800,
    lineHeight: 1.15,
    textAlign: "center",
  };
}

function getGameDetailOverviewActionRowStyle(): CSSProperties {
  return {
    justifyContent: "center",
  };
}

function getGameDetailSummaryLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.88em",
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: "center",
  };
}

function getGameDetailCompletionStatusStyle(
  tone: DeckyCompletionProgressBarTone,
): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    gap: 7,
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 24,
    padding: "3px 9px",
    borderRadius: 999,
    border:
      tone === "retroachievements-mastered"
        ? "1px solid rgba(232, 201, 102, 0.42)"
        : "1px solid rgba(214, 221, 232, 0.32)",
    background:
      tone === "retroachievements-mastered"
        ? "linear-gradient(180deg, rgba(232, 201, 102, 0.13), rgba(214, 178, 74, 0.055))"
        : "linear-gradient(180deg, rgba(214, 221, 232, 0.13), rgba(188, 198, 211, 0.055))",
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.96)"
        : "rgba(231, 237, 245, 0.96)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.04em",
    lineHeight: 1,
    textTransform: "uppercase",
    boxSizing: "border-box",
  };
}

function getGameDetailCompletionTimingStyle(
  tone: DeckyCompletionProgressBarTone,
): CSSProperties {
  return {
    alignSelf: "center",
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.84)"
        : "rgba(221, 228, 236, 0.84)",
    fontSize: "0.78em",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
  };
}

function getModeProgressGridStyle(singleColumn: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: singleColumn ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
    gap: 10,
    alignItems: "stretch",
    minWidth: 0,
    width: "100%",
  };
}

function getModeProgressCardStyle(mode: CompactAchievementModeFilter): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${isHardcore ? "rgba(214, 178, 74, 0.28)" : "rgba(214, 221, 232, 0.2)"}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: isHardcore ? "rgba(214, 178, 74, 0.8)" : "rgba(214, 221, 232, 0.72)",
    background: isHardcore
      ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
      : "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.14)",
  };
}

function getModeProgressCardTitleStyle(mode: CompactAchievementModeFilter): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    color: isHardcore ? "rgba(232, 201, 102, 0.95)" : "rgba(220, 225, 233, 0.95)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getModeProgressCardLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.84em",
    lineHeight: 1.2,
  };
}

function getModeProgressCardPointsStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

export function DeckyGameDetailView({
  state,
  onBackToDashboard,
  onOpenFullScreenPage,
  onOpenCompactAchievements,
  onOpenAchievementDetail,
}: DeckyGameDetailViewProps): JSX.Element {
  const compactGameDetailBackButtonRef = useCallback((node: HTMLDivElement | null) => {
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(node);
  }, []);
  const snapshot = state.data;
  const game = snapshot.game;
  const isSteamGame = game.providerId === "steam";
  const headerArtworkUrl = game.coverImageUrl;
  const achievementListModel = buildCompactAchievementListModel(snapshot);
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const completionIndicatorState = getRetroAchievementsCompletionIndicatorState(game);
  const isBeaten =
    completionIndicatorState === "beaten-hardcore" || completionIndicatorState === "beaten-softcore";
  const isMasteredHardcore = completionIndicatorState === "mastered-hardcore";
  const completionStatusLabel = isMasteredHardcore ? "Mastered" : isBeaten ? "Beaten" : undefined;
  const completionStatusAriaLabel =
    completionIndicatorState !== undefined
      ? formatRetroAchievementsCompletionIndicatorLabel(completionIndicatorState)
      : undefined;
  const completionTone = isMasteredHardcore
    ? "retroachievements-mastered"
    : isBeaten
      ? "retroachievements-beaten"
      : "default";
  const masteredAtText = formatRetroAchievementsMasteredAtText(game);
  const beatenAtText = formatRetroAchievementsBeatenAtText(game);
  const completionAtText = isMasteredHardcore ? masteredAtText : beatenAtText;
  const softcoreModeProgress = getAchievementModeProgressSummary(snapshot.achievements, "softcore");
  const hardcoreModeProgress = getAchievementModeProgressSummary(snapshot.achievements, "hardcore");
  const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "softcore",
    summary: game.softcoreSummary,
    points: softcoreModeProgress.points,
  });
  const showHardcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "hardcore",
    summary: game.hardcoreSummary,
    points: hardcoreModeProgress.points,
  });
  const visibleModeCardCount = Number(showSoftcoreModeCard) + Number(showHardcoreModeCard);
  const isCachedView = state.status === "stale";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;

  if (isSteamGame) {
    return (
      <>
        <DeckySteamCompactGameOverview
          onBack={onBackToDashboard}
          onOpenFullScreen={onOpenFullScreenPage}
          onViewAchievements={onOpenCompactAchievements}
          snapshot={snapshot}
        />
      </>
    );
  }

  return (
    <>
      <PanelSection title="GAME OVERVIEW">
        <PanelSectionRow>
          <div style={getGameDetailSectionCardStyle()}>
            <div style={getGameDetailOverviewLayoutStyle()}>
              <DeckySystemPill
                label={game.platformLabel ?? "Unknown system"}
                iconSize={16}
                iconUrl={game.providerId === RETROACHIEVEMENTS_PROVIDER_ID ? game.systemIconUrl : undefined}
                style={getGameDetailSystemPillStyle()}
              />
              <div style={getGameDetailOverviewIconFrameStyle()}>
                {headerArtworkUrl !== undefined ? (
                  <DeckyGameArtwork compact src={headerArtworkUrl} size={48} title={game.title} />
                ) : null}
              </div>
              <div style={getGameDetailOverviewTitleStyle()}>{game.title}</div>
              <DeckyCompactPillActionGroup style={getGameDetailOverviewActionRowStyle()}>
                <DeckyCompactPillActionItem
                  label="Back"
                  onClick={onBackToDashboard}
                  onCancelButton={onBackToDashboard}
                  elementRef={compactGameDetailBackButtonRef}
                  dataAttributes={{
                    "data-achievement-companion-compact-game-detail-back": "true",
                  }}
                />

                {onOpenFullScreenPage !== undefined ? (
                  <DeckyCompactPillActionItem
                    label={isSteamGame ? "Open Full-Screen" : "Open Game"}
                    onClick={onOpenFullScreenPage}
                    onCancelButton={onBackToDashboard}
                  />
                ) : null}
              </DeckyCompactPillActionGroup>
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="PROGRESS SUMMARY">
        <PanelSectionRow>
          <div style={getGameDetailSectionCardStyle()}>
            <div style={getGameDetailSummaryLineStyle()}>{formatProgressSummary(snapshot)}</div>
            {completionStatusLabel !== undefined && completionStatusAriaLabel !== undefined ? (
              <div
                aria-label={completionStatusAriaLabel}
                style={getGameDetailCompletionStatusStyle(completionTone)}
                title={completionStatusAriaLabel}
              >
                <RetroAchievementsCompletionIndicator game={game} />
                <span>{completionStatusLabel}</span>
              </div>
            ) : (
              <RetroAchievementsCompletionIndicator game={game} />
            )}
            {completionAtText !== undefined && completionTone !== "default" ? (
              <div style={getGameDetailCompletionTimingStyle(completionTone)}>{completionAtText}</div>
            ) : null}
            {completionPercent !== undefined ? (
              <DeckyCompletionProgressBar
                compact
                percent={completionPercent}
                tone={completionTone}
              />
            ) : null}
            {showSoftcoreModeCard || showHardcoreModeCard ? (
            <div style={getModeProgressGridStyle(visibleModeCardCount === 1)}>
              {showSoftcoreModeCard ? (
                <div style={getModeProgressCardStyle("softcore")}>
                  <div style={getModeProgressCardTitleStyle("softcore")}>Softcore</div>
                  <div style={getModeProgressCardLineStyle()}>
                    {`${formatCount(softcoreModeProgress.unlockedCount)} unlocked`}
                  </div>
                  <div style={getModeProgressCardPointsStyle()}>
                    {softcoreModeProgress.points !== undefined
                      ? `${formatCount(softcoreModeProgress.points)} points`
                      : "Points unavailable"}
                  </div>
                </div>
              ) : null}
              {showHardcoreModeCard ? (
                <div style={getModeProgressCardStyle("hardcore")}>
                  <div style={getModeProgressCardTitleStyle("hardcore")}>Hardcore</div>
                  <div style={getModeProgressCardLineStyle()}>
                    {`${formatCount(hardcoreModeProgress.unlockedCount)} unlocked`}
                  </div>
                  <div style={getModeProgressCardPointsStyle()}>
                    {hardcoreModeProgress.points !== undefined
                      ? `${formatCount(hardcoreModeProgress.points)} points`
                      : "Points unavailable"}
                  </div>
                </div>
              ) : null}
            </div>
            ) : null}
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="ACHIEVEMENTS">
        <PanelSectionRow>
          <DeckyCompactAchievementList
            embedded
            model={achievementListModel}
            onBack={onBackToDashboard}
            onOpenAchievement={onOpenAchievementDetail}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Snapshot">
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={`${formatDataSourceLabel(isCachedView)} · ${formatTimestamp(refreshTimestamp)}`}
            label="Updated"
          />
        </PanelSectionRow>

        {state.error ? (
          <PanelSectionRow>
            <Field bottomSeparator="none" description={state.error.userMessage} label="Snapshot note" />
          </PanelSectionRow>
        ) : null}
      </PanelSection>
    </>
  );
}
