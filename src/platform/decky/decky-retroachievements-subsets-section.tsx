import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, RelatedGameSummary } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import {
  Focusable,
  GamepadButton,
  NavEntryPositionPreferences,
  type GamepadEvent,
} from "@decky/ui";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullScreenAchievementRow } from "./decky-full-screen-achievement-row";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { takeDeckySteamGamepadFocus, requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { DeckyRetroAchievementsSubsetDiscoveryPanel, buildSubsetDiscoveryPanel } from "./decky-retroachievements-subset-discovery-panel";
import type { RetroAchievementsSubsetDiscoveryStatus } from "../../providers/retroachievements/retroachievements.provider";
import { getRetroAchievementsFirstSubsetTarget } from "./decky-retroachievements-subset-navigation";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { raRecipes, raTheme } from "./ra-theme";

const RA_SUBSET_NAVIGATION_SOUND_URL = "/sounds/deck_ui_navigation.wav";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getSectionStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 10, width: "100%" };
}

function getSubsetCardStyle(isFocused: boolean, isExpanded: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    gridTemplateRows: "auto auto",
    columnGap: 14,
    rowGap: 6,
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    padding: "12px 14px",
    border: `1px solid ${isFocused ? raTheme.focus.border : raTheme.color.borderSubtle}`,
    borderRadius: raTheme.radius.large,
    boxSizing: "border-box",
    background: isExpanded
      ? `${raTheme.surface.selected}, ${raTheme.surface.contentCard}`
      : raTheme.surface.contentCard,
    boxShadow: isFocused ? raTheme.focus.shadow : "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.16)",
  };
}

function getSubsetTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getSubsetTitleStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "title"),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getSubsetMetadataStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "metadata"), color: raTheme.color.textSecondary };
}

function getSubsetCountStyle(): CSSProperties {
  return { color: raTheme.color.accent, fontSize: "0.95em", fontWeight: raTheme.type.weight.strong, lineHeight: 1.15 };
}

function getSubsetPercentStyle(): CSSProperties {
  return { color: raTheme.color.textPrimary, fontSize: "1.1em", fontWeight: raTheme.type.weight.strong, lineHeight: 1 };
}

function getExpansionIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    alignSelf: "stretch",
    gridColumn: "3",
    gridRow: "2",
    color: raTheme.color.textSecondary,
  };
}

function getExpandedAchievementsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8, padding: "4px 8px 10px" };
}

function getExpandedStateStyle(kind: "loading" | "error"): CSSProperties {
  return {
    ...raRecipes.card("fullscreen"),
    background: raTheme.surface.contentCard,
    padding: "14px 16px",
    color: kind === "error" ? raTheme.color.danger : raTheme.color.textSecondary,
    fontSize: raTheme.type.fullscreen.body,
  };
}

function getCompletionPercent(subset: RelatedGameSummary): number {
  return subset.progress?.completionPercent
    ?? (subset.progress?.totalCount !== undefined && subset.progress.totalCount > 0
      ? Math.round((subset.progress.unlockedCount / subset.progress.totalCount) * 100)
      : 0);
}

function DeckySubsetExpansionIcon({ isExpanded }: { readonly isExpanded: boolean }): JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" height="24" viewBox="0 0 24 24" width="24">
      <path
        d={isExpanded ? "M12 19V8m0 0-7 7m7-7 7 7" : "M12 5v11m0 0-7-7m7 7 7-7"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function getSubsetArtworkUrl(subset: RelatedGameSummary): string | undefined {
  // RA's ImageIcon is the square set icon shown on the site. Box art is only a
  // fallback because it can be a screenshot placeholder for subset sets.
  return subset.coverImageUrl ?? subset.boxArtImageUrl;
}

export function DeckyRetroAchievementsSubsetsSection({
  subsets,
  achievementMode,
  expandedSubsetIds,
  subsetDetails,
  onExpandedSubsetIdsChange,
  onLoadSubsetAchievements,
  onBack,
  onFocusSubset,
  onFocusSubsetAchievement,
  onOpenSubsetAchievementDetail,
  discoveryStatus,
  platformLabel,
  onContinueDiscovery,
}: {
  readonly subsets: readonly RelatedGameSummary[];
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly expandedSubsetIds: readonly string[];
  readonly subsetDetails: Readonly<Record<string, ResourceState<GameDetailSnapshot>>>;
  readonly onExpandedSubsetIdsChange: (subsetIds: readonly string[]) => void;
  readonly onLoadSubsetAchievements: (subsetId: string) => void;
  readonly onBack: () => void;
  readonly onFocusSubset: (gameId: string) => void;
  readonly onFocusSubsetAchievement: (subsetId: string, achievementId: string) => void;
  readonly onOpenSubsetAchievementDetail: (subsetId: string, achievementId: string) => void;
  readonly discoveryStatus?: RetroAchievementsSubsetDiscoveryStatus | undefined;
  readonly platformLabel?: string | undefined;
  readonly onContinueDiscovery?: (() => void) | undefined;
}): JSX.Element {
  const [focusedSubsetId, setFocusedSubsetId] = useState<string | undefined>(undefined);
  const navigationSoundRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const discoveryHadFocus = useRef(false);
  const panel = buildSubsetDiscoveryPanel(discoveryStatus);
  useLayoutEffect(() => {
    if (!discoveryHadFocus.current || discoveryStatus?.running) return;
    const root = rootRef.current;
    const action = root?.querySelector<HTMLElement>("[data-ra-subset-discovery-action] [role='button']:not([aria-disabled='true'])");
    const target = action ?? root?.querySelector<HTMLElement>("[data-achievement-companion-ra-subset-id]");
    if (target !== null && target !== undefined) {
      if (action === null || action === undefined) discoveryHadFocus.current = false;
      return requestDeckySteamGamepadFocusAfterMount(target);
    }
  }, [discoveryStatus?.running, panel === undefined, panel?.disabled]);

  const toggleSubset = (subsetId: string): void => {
    const isExpanded = expandedSubsetIds.includes(subsetId);
    onExpandedSubsetIdsChange(
      isExpanded
        ? expandedSubsetIds.filter((currentSubsetId) => currentSubsetId !== subsetId)
        : [...expandedSubsetIds, subsetId],
    );
    if (!isExpanded) onLoadSubsetAchievements(subsetId);
  };

  const handleSubsetFocus = (subsetId: string, target: HTMLElement): void => {
    discoveryHadFocus.current = false;
    setFocusedSubsetId(subsetId);
    onFocusSubset(subsetId);
    scrollDeckyFocusTargetIntoView(target);
  };

  const playSubsetNavigationSound = (ownerDocument: Document): void => {
    const sound = navigationSoundRef.current ?? ownerDocument.createElement("audio");
    if (navigationSoundRef.current === null) {
      sound.preload = "auto";
      sound.src = RA_SUBSET_NAVIGATION_SOUND_URL;
      navigationSoundRef.current = sound;
    }
    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  };

  const handleFirstSubsetDirection = (event: GamepadEvent): void => {
    if (event.detail.button !== GamepadButton.DIR_UP && event.detail.button !== GamepadButton.DIR_DOWN) return;
    const source = event.currentTarget as HTMLElement;
    const target = getRetroAchievementsFirstSubsetTarget(source, event.detail.button === GamepadButton.DIR_UP ? "up" : "down");
    if (!takeDeckySteamGamepadFocus(target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (target !== source) playSubsetNavigationSound(source.ownerDocument);
  };

  useEffect(() => () => {
    const sound = navigationSoundRef.current;
    sound?.pause();
    sound?.removeAttribute("src");
    sound?.load();
    navigationSoundRef.current = null;
  }, []);

  return (
    <Focusable
      ref={rootRef}
      data-achievement-companion-ra-subsets-section
      flow-children="vertical"
      navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
      noFocusRing
      tabIndex={-1}
      style={getSectionStyle()}
    >
      {onContinueDiscovery !== undefined ? <DeckyRetroAchievementsSubsetDiscoveryPanel status={discoveryStatus} platformLabel={platformLabel}
        onContinue={onContinueDiscovery} onBack={onBack}
        onFocus={() => { discoveryHadFocus.current = true; }}
        onDirection={(event) => {
          const source = event.currentTarget as HTMLElement;
          const target = rootRef.current?.querySelector<HTMLElement>("[data-achievement-companion-ra-subset-id]");
          if (target !== undefined && target !== null && takeDeckySteamGamepadFocus(target)) {
            event.preventDefault(); event.stopPropagation(); playSubsetNavigationSound(source.ownerDocument);
          }
        }} /> : null}
      {subsets.map((subset, subsetIndex) => {
        const isExpanded = expandedSubsetIds.includes(subset.gameId);
        const detailState = subsetDetails[subset.gameId];
        const artworkUrl = getSubsetArtworkUrl(subset);
        const totalCount = subset.progress?.totalCount ?? subset.totalAchievementCount;
        const completionPercent = getCompletionPercent(subset);
        const progressLabel = subset.progress !== undefined && totalCount !== undefined
          ? `${formatCount(subset.progress.unlockedCount)} / ${formatCount(totalCount)}`
          : "Progress unavailable";
        const expandedAchievements = detailState !== undefined
          && (detailState.status === "success" || detailState.status === "stale")
          && detailState.data !== undefined
          ? sortAchievementsForDisplay(projectRetroAchievementsFullScreenAchievements(detailState.data, achievementMode))
          : [];
        return (
          <Focusable
            key={subset.gameId}
            data-achievement-companion-ra-subset-container
            flow-children="vertical"
            navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
            noFocusRing
            tabIndex={-1}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <Focusable
              className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
              noFocusRing
              preferredFocus
              role="button"
              aria-expanded={isExpanded}
              aria-label={`${subset.title}, ${progressLabel} achievements, ${completionPercent}% complete. ${isExpanded ? "Collapse" : "Expand"}.`}
              data-achievement-companion-ra-subset-id={subset.gameId}
              onActivate={() => toggleSubset(subset.gameId)}
              onClick={() => toggleSubset(subset.gameId)}
              {...(subsetIndex === 0 ? { onGamepadDirection: handleFirstSubsetDirection } : {})}
              onFocus={(event) => handleSubsetFocus(subset.gameId, event.currentTarget)}
              onGamepadFocus={(event) => {
                if (event.currentTarget !== null) handleSubsetFocus(subset.gameId, event.currentTarget as HTMLElement);
              }}
              onBlur={() => setFocusedSubsetId((current) => current === subset.gameId ? undefined : current)}
              onCancel={onBack}
              style={getSubsetCardStyle(focusedSubsetId === subset.gameId, isExpanded)}
            >
              <DeckyGameArtwork
                compact
                fit="contain"
                height={72}
                {...(artworkUrl !== undefined ? { src: artworkUrl } : {})}
                size={72}
                title={subset.title}
                width={72}
              />
              <span style={getSubsetTextStyle()}>
                <span style={getSubsetTitleStyle()}>{subset.title}</span>
                <span style={getSubsetMetadataStyle()}>
                  {subset.platformLabel ?? "Unknown system"}
                  {totalCount !== undefined ? ` · ${formatCount(totalCount)} achievements` : ""}
                </span>
                <span style={getSubsetCountStyle()}>{progressLabel}</span>
                <DeckyCompletionProgressBar percent={completionPercent} showCaption={false} />
              </span>
              <span style={getSubsetPercentStyle()}>{completionPercent}%</span>
              <span aria-hidden="true" style={getExpansionIconStyle()}>
                <DeckySubsetExpansionIcon isExpanded={isExpanded} />
              </span>
            </Focusable>
            {isExpanded ? (
              <Focusable
                flow-children="vertical"
                navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
                noFocusRing
                tabIndex={-1}
                style={getExpandedAchievementsStyle()}
              >
                {detailState?.status === "loading" ? (
                  <span style={getExpandedStateStyle("loading")}>Loading subset achievements…</span>
                ) : detailState?.status === "error" ? (
                  <span style={getExpandedStateStyle("error")}>Subset achievements unavailable.</span>
                ) : expandedAchievements.length === 0 ? (
                  <span style={getExpandedStateStyle("error")}>No subset achievements available.</span>
                ) : (
                  expandedAchievements.map((achievement) => (
                    <DeckyFullScreenAchievementRow
                      key={achievement.achievementId}
                      achievement={achievement}
                      onBack={onBack}
                      onFocusAchievement={(achievementId) => onFocusSubsetAchievement(subset.gameId, achievementId)}
                      onOpenAchievementDetail={(achievementId) => onOpenSubsetAchievementDetail(subset.gameId, achievementId)}
                      steamHuntersAchievement={undefined}
                      gamePageGradient
                    />
                  ))
                )}
              </Focusable>
            ) : null}
          </Focusable>
        );
      })}
    </Focusable>
  );
}
