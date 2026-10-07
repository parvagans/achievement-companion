import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Focusable, PanelSection, PanelSectionRow, type FocusableProps } from "@decky/ui";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import {
  ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement,
  registerCompactAchievementCancelCallback,
} from "./decky-full-screen-cancel-bridge";
import { scrollDeckyFocusTargetIntoView, scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import type {
  CompactAchievementDetailBlock,
  CompactAchievementDetailStat,
  CompactAchievementDetailViewModel,
  CompactAchievementTone,
} from "./decky-compact-achievement-model";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raRecipes, raTheme } from "./ra-theme";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import usersIconUrl from "./assets/users.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import rankPointsIconUrl from "./assets/rank-points.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

type DeckyGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

export interface DeckyAchievementDetailViewProps {
  readonly model: CompactAchievementDetailViewModel;
  readonly onBack: () => void;
  readonly onOpenCompactGame: () => void;
  readonly onOpenFullScreenGame?: (() => void) | undefined;
}

function getStandaloneRootStyle(): CSSProperties {
  return { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "0 16px 4px" };
}

function getCardStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.card("compact", "raised") : raRecipes.card("compact", true)),
    display: "flex", flexDirection: "column", gap: 11, width: "100%", minWidth: 0,
    padding: 12, boxSizing: "border-box", borderRadius: isSteam ? steamTheme.radius.large : raTheme.radius.large,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 2px 10px rgba(0, 0, 0, 0.2)",
  };
}

function getRowStyle(): CSSProperties {
  return { display: "flex", gap: 9, alignItems: "center", minWidth: 0 };
}

function getTextBlockStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", minWidth: 0, gap: 3 };
}

function getTitleLineStyle(): CSSProperties {
  return { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 6px", minWidth: 0 };
}

function getTitleStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "title") : raRecipes.text("compact", "title")),
    color: isSteam ? steamTheme.color.textPrimary : raTheme.color.textPrimary, fontSize: isSteam ? steamTheme.type.compact.title : raTheme.type.compact.title, fontWeight: isSteam ? steamTheme.type.weight.strong : 850,
    lineHeight: 1.14, minWidth: 0, overflowWrap: "anywhere",
  };
}

function getDescriptionStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "body") : raRecipes.text("compact", "body")),
    margin: 0, color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary, fontSize: isSteam ? steamTheme.type.compact.body : raTheme.type.compact.body,
    lineHeight: 1.32, whiteSpace: "pre-wrap",
  };
}

function getBadgeRowStyle(): CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 };
}

function getBadgeStyle(tone: "default" | "success" | "points", isSteam = false): CSSProperties {
  if (isSteam) {
    const color = tone === "success" ? steamTheme.color.success : tone === "points" ? steamTheme.color.rewardGold : steamTheme.color.accent;
    return { ...steamRecipes.badge(color), fontWeight: steamTheme.type.weight.strong, lineHeight: 1, minHeight: 27, padding: "4px 9px", borderRadius: steamTheme.radius.small };
  }
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 27,
    padding: "4px 9px", boxSizing: "border-box", borderRadius: 8,
    border: `1px solid ${tone === "success" ? "rgba(48, 224, 145, 0.34)" : tone === "points" ? "rgba(245, 190, 54, 0.32)" : raTheme.color.borderSubtle}`,
    background: tone === "success" ? raTheme.surface.success : tone === "points" ? "rgba(124, 89, 17, 0.15)" : raTheme.surface.interactive,
    color: tone === "success" ? raTheme.color.success : tone === "points" ? raTheme.color.points : raTheme.color.textSecondary,
    fontSize: "0.69em", fontWeight: 750, lineHeight: 1,
  };
}

function getSectionStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 };
}

function getSectionLabelStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "heading") : {}),
    color: isSteam ? steamTheme.color.accent : raTheme.color.accent, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, fontWeight: isSteam ? steamTheme.type.weight.strong : 850, letterSpacing: "0.07em",
    lineHeight: 1.2, textTransform: "uppercase",
  };
}

function getStatusStyle(tone: CompactAchievementTone, isSteam = false): CSSProperties {
  const color = tone === "hardcore"
    ? raTheme.color.hardcore
    : tone === "softcore"
      ? raTheme.color.softcore
      : tone === "locked" ? raTheme.color.locked : raTheme.color.unlocked;
  return {
    ...(isSteam ? steamRecipes.card("compact", "interactive") : {}),
    display: "flex", flexDirection: "column", gap: 3, padding: "9px 10px", borderRadius: 11,
    ...(isSteam ? {} : { border: `1px solid ${raTheme.color.borderSubtle}`, background: raTheme.surface.interactive }),
    color: isSteam && tone === "locked" ? steamTheme.color.locked : color, fontSize: isSteam ? steamTheme.type.compact.body : "0.8em", fontWeight: isSteam ? steamTheme.type.weight.strong : 800, lineHeight: 1.2,
  };
}

function getStatusSecondaryStyle(isSteam = false): CSSProperties {
  return { ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")), color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, fontWeight: 600 };
}

function getStatsGridStyle(columns: 2 | 3): CSSProperties {
  return {
    display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6, minWidth: 0,
  };
}

function getStatStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.metricTile("compact") : raRecipes.metric("compact")),
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    minWidth: 0, minHeight: 48, padding: "7px 5px", boxSizing: "border-box", borderRadius: 10,
    ...(isSteam ? {} : { border: `1px solid ${raTheme.color.borderSubtle}`, background: raTheme.surface.interactive }),
    textAlign: "center",
  };
}

function getStatLabelStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "caption")),
    color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textMuted, fontSize: isSteam ? steamTheme.type.compact.caption : raTheme.type.compact.caption, fontWeight: isSteam ? steamTheme.type.weight.medium : 750,
    letterSpacing: "0.04em", lineHeight: 1.15, textTransform: "uppercase",
  };
}

function getStatValueStyle(isSteam = false, metricKey?: string): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")),
    color: isSteam ? steamTheme.color.textPrimary : metricKey === "points" ? raTheme.color.points : metricKey === "retro-points" ? raTheme.color.retroPoints : raTheme.color.textPrimary, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, fontWeight: isSteam ? steamTheme.type.weight.strong : 800,
    lineHeight: 1.15, minWidth: 0, overflowWrap: "anywhere",
  };
}

function getStatSecondaryStyle(isSteam = false): CSSProperties {
  return { ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")), color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textMuted, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, lineHeight: 1.2 };
}

function getTimestampStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 };
}

function getRarityTrackStyle(isSteam = false): CSSProperties {
  return { ...(isSteam ? steamRecipes.progressTrack : raRecipes.progressTrack), height: 6, borderRadius: 999, overflow: "hidden" };
}

function getRarityFillStyle(percent: number, isSteam = false): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`, height: "100%", borderRadius: 999,
    background: isSteam ? steamRecipes.progressFill.completion : raRecipes.progressFill.completion,
  };
}

function getRarityCaptionStyle(isSteam = false): CSSProperties {
  return { ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")), color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, fontWeight: 700 };
}

function getGameRowStyle(isFocused: boolean, isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.interactiveRow("compact") : {}),
    display: "grid", gridTemplateColumns: "38px minmax(0, 1fr) 18px", alignItems: "center", gap: 8,
    width: "100%", minWidth: 0, padding: "8px 9px", boxSizing: "border-box", borderRadius: 11,
    border: isSteam
      ? `1px solid ${isFocused ? steamTheme.focus.border : steamTheme.color.borderSubtle}`
      : `1px solid ${isFocused ? raTheme.focus.border : raTheme.color.borderSubtle}`,
    background: isSteam
      ? isFocused ? steamTheme.focus.background : steamTheme.surface.interactive
      : isFocused ? raTheme.focus.background : raTheme.surface.interactive,
    boxShadow: isFocused ? raTheme.focus.shadow : "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  };
}

function getAchievementHeadingStyle(isFocused: boolean, isSteam = false, tone?: "hardcore" | "softcore" | "locked"): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.card("compact", "interactive") : {}),
    ...getRowStyle(),
    margin: "-3px",
    padding: 3,
    borderRadius: 9,
    border: isFocused ? `1px solid ${raTheme.focus.border}` : "1px solid transparent",
    boxShadow: isFocused ? raTheme.focus.insetShadow : "none",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
    ...(!isSteam && tone !== undefined ? { borderLeft: `3px solid ${tone === "hardcore" ? raTheme.color.hardcore : tone === "softcore" ? raTheme.color.softcore : raTheme.color.locked}` } : {}),
  };
}

function getGameTitleStyle(isSteam = false): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "body") : raRecipes.text("compact", "body")),
    color: isSteam ? steamTheme.color.textPrimary : raTheme.color.textPrimary, fontSize: isSteam ? steamTheme.type.compact.body : raTheme.type.compact.body, fontWeight: isSteam ? steamTheme.type.weight.strong : 750,
    lineHeight: 1.18, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
}

function getGamePlatformStyle(isSteam = false): CSSProperties {
  return { ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")), color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textMuted, fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata, lineHeight: 1.2 };
}

function getChevronStyle(): CSSProperties {
  return {
    width: 18, height: 18,
    filter: "brightness(0) saturate(100%) invert(65%) sepia(90%) saturate(1150%) hue-rotate(161deg) brightness(101%) contrast(101%)",
  };
}

function DetailStat({ stat, fullWidth, isSteam = false }: { readonly stat: CompactAchievementDetailStat; readonly fullWidth: boolean; readonly isSteam?: boolean }): JSX.Element {
  const iconUrl = stat.key === "date" ? calendarIconUrl : stat.key === "time" ? clockIconUrl : stat.key === "community-percentage" || stat.key === "rarity" ? pieChartIconUrl : stat.key === "players" || stat.key.endsWith("-unlocks") ? usersIconUrl : stat.key === "points" ? trophyIconUrl : stat.key === "retro-points" ? rankPointsIconUrl : undefined;
  return (
    <div style={{ ...getStatStyle(isSteam), ...(fullWidth ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        {isSteam && stat.key === "points" ? <DeckySteamHuntersIcon color={steamTheme.color.accent} size={15} /> : iconUrl !== undefined ? <img alt="" aria-hidden="true" src={iconUrl} style={{ width: 15, height: 15, filter: isSteam ? steamTheme.iconFilter.accent : stat.key === "points" ? raTheme.iconFilter.hardcore : stat.key === "hardcore-unlocks" ? raTheme.iconFilter.hardcore : stat.key === "softcore-unlocks" ? raTheme.iconFilter.softcore : raTheme.iconFilter.primary }} /> : null}
        <div style={getStatLabelStyle(isSteam)}>{stat.label}</div>
      </div>
      <div style={getStatValueStyle(isSteam, stat.key)}>{stat.value}</div>
      {stat.secondary !== undefined ? <div style={getStatSecondaryStyle(isSteam)}>{stat.secondary}</div> : null}
      {!isSteam && stat.communityProgress !== undefined ? (
        <div
          aria-label={`Community unlocks: ${stat.communityProgress.hardcorePercent.toFixed(2)}% hardcore, ${stat.communityProgress.softcorePercent.toFixed(2)}% softcore`}
          role="img" style={raRecipes.compactAchievementCommunity.track}
        >
          <span style={raRecipes.compactAchievementCommunity.segment("hardcore", stat.communityProgress.hardcorePercent)} />
          <span style={raRecipes.compactAchievementCommunity.segment("softcore", stat.communityProgress.softcorePercent)} />
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ block, isSteam = false }: { readonly block: CompactAchievementDetailBlock; readonly isSteam?: boolean }): JSX.Element {
  if (block.kind === "status") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle(isSteam)}>{block.title}</div>
        <div style={getStatusStyle(block.tone, isSteam)}>
          <span>{block.value}</span>
          {block.secondary !== undefined ? <span style={getStatusSecondaryStyle(isSteam)}>{block.secondary}</span> : null}
        </div>
      </div>
    );
  }
  if (block.kind === "timestamp") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle(isSteam)}>{block.title}</div>
        <div style={getTimestampStyle()}>
          <DetailStat stat={{ key: "date", label: "Date", value: block.value }} fullWidth={false} isSteam={isSteam} />
          <DetailStat stat={{ key: "time", label: "Time", value: block.secondary }} fullWidth={false} isSteam={isSteam} />
        </div>
      </div>
    );
  }
  if (block.kind === "stats") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle(isSteam)}>{block.title}</div>
        <div style={getStatsGridStyle(block.columns)}>
          {block.stats.map((stat) => <DetailStat key={stat.key} stat={stat} fullWidth={stat.key === "players" || (!isSteam && stat.fullWidth === true)} isSteam={isSteam} />)}
        </div>
      </div>
    );
  }
  return (
    <div style={getSectionStyle()}>
      <div style={getSectionLabelStyle(isSteam)}>{block.title}</div>
      <div style={getRarityCaptionStyle(isSteam)}>{block.caption}</div>
      <div
        aria-label="Achievement unlock rate" aria-valuemax={100} aria-valuemin={0}
        aria-valuenow={block.percent ?? 0} aria-valuetext={block.caption} role="progressbar"
        style={getRarityTrackStyle(isSteam)}
      >
        <div style={getRarityFillStyle(block.percent ?? 0, isSteam)} />
      </div>
      {block.stats.length > 0 ? (
        <div style={getStatsGridStyle(2)}>
          {block.stats.map((stat) => (
            <DetailStat key={stat.key} stat={stat} fullWidth={stat.key === "players"} isSteam={isSteam} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GameContextRow({
  model, onBack, onOpen,
}: {
  readonly model: CompactAchievementDetailViewModel;
  readonly onBack: () => void;
  readonly onOpen: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isSteam = model.providerId === "steam";

  return (
    <div style={getSectionStyle()}>
      <div style={getSectionLabelStyle(isSteam)}>Game</div>
      <Focusable
        aria-label={`Open ${model.game.title} compact game overview`}
        noFocusRing onActivate={onOpen} onCancel={onBack} onClick={onOpen}
        onFocus={(event) => {
          setIsFocused(true);
          scrollDeckyFocusTargetIntoView(event.currentTarget);
        }}
        onGamepadFocus={((event) => {
          setIsFocused(true);
          scrollDeckyFocusTargetIntoView(event.currentTarget);
        }) satisfies DeckyGamepadFocusHandler}
        onBlur={() => setIsFocused(false)}
        role="button" style={getGameRowStyle(isFocused, isSteam)}
      >
        {model.game.artworkUrl !== undefined ? (
          <DeckyGameArtwork compact src={model.game.artworkUrl} size={36} title={model.game.title} />
        ) : <span />}
        <div style={getTextBlockStyle()}>
          <div style={getGameTitleStyle(isSteam)}>{model.game.title}</div>
          <div style={getGamePlatformStyle(isSteam)}>{model.game.platformLabel}</div>
        </div>
        <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={getChevronStyle()} />
      </Focusable>
    </div>
  );
}

function AchievementDetailCard({
  model, onBack, onOpenCompactGame, onOpenFullScreenGame,
}: DeckyAchievementDetailViewProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const headingFocusGeneration = useRef(0);
  const [achievementHeadingFocused, setAchievementHeadingFocused] = useState(false);
  const isSteam = model.providerId === "steam";
  const compactAchievementBackButtonRef = useCallback((node: HTMLDivElement | null) => {
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(node);
  }, []);

  useLayoutEffect(
    () => model.showLegacyActions ? undefined : registerCompactAchievementCancelCallback(rootRef.current, onBack),
    [model.showLegacyActions, onBack],
  );

  const gameRow = <GameContextRow model={model} onBack={onBack} onOpen={onOpenCompactGame} />;
  return (
    <div data-ac-ra-achievement-detail={isSteam ? undefined : "true"} data-ac-steam-theme={isSteam ? "compact" : undefined} data-ac-ra-theme={!isSteam ? "compact" : undefined} ref={rootRef} style={getCardStyle(isSteam)}>
      {model.gamePlacement === "before-achievement" ? gameRow : null}
      <Focusable
        aria-label={`Achievement ${model.title}`}
        data-ac-ra-achievement-tone={isSteam ? undefined : model.isUnlocked ? model.unlockMode : "locked"}
        noFocusRing
        onActivate={() => {}}
        onFocus={(event) => {
          const generation = ++headingFocusGeneration.current;
          setAchievementHeadingFocused(true);
          if (isSteam) scrollDeckyFocusTargetToTop(event.currentTarget, () => headingFocusGeneration.current === generation);
          else scrollDeckyFocusTargetIntoView(event.currentTarget);
        }}
        onGamepadFocus={((event) => {
          const generation = ++headingFocusGeneration.current;
          setAchievementHeadingFocused(true);
          if (isSteam) scrollDeckyFocusTargetToTop(event.currentTarget, () => headingFocusGeneration.current === generation);
          else scrollDeckyFocusTargetIntoView(event.currentTarget);
        }) satisfies DeckyGamepadFocusHandler}
        onBlur={() => {
          headingFocusGeneration.current += 1;
          setAchievementHeadingFocused(false);
        }}
        role="group"
        style={getAchievementHeadingStyle(achievementHeadingFocused, isSteam, model.isUnlocked ? model.unlockMode : "locked")}
      >
        {model.iconUrl !== undefined ? (
          <div style={{ display: "flex", flex: "0 0 auto", width: model.gamePlacement === "after-details" ? 54 : 40, height: model.gamePlacement === "after-details" ? 54 : 40, filter: isSteam ? model.isUnlocked ? steamRecipes.achievementState.unlocked.artworkFilter : steamRecipes.achievementState.locked.artworkFilter : model.isUnlocked ? raRecipes.achievementState.unlocked.artworkFilter : raRecipes.achievementState.locked.artworkFilter }}>
            <DeckyGameArtwork compact src={model.iconUrl} size={model.gamePlacement === "after-details" ? 54 : 40} title={model.title} />
          </div>
        ) : null}
        <div style={getTextBlockStyle()}>
          <div style={getTitleLineStyle()}>
            <span style={getTitleStyle(isSteam)}>{model.title}</span>
            <DeckyAchievementTypeBadge classification={model.classification} />
          </div>
        </div>
      </Focusable>
      {model.description.length > 0 ? <p style={getDescriptionStyle(isSteam)}>{model.description}</p> : null}
      {model.badges.length > 0 ? (
        <div style={getBadgeRowStyle()}>
          {model.badges.map((badge) => <span key={badge.key} style={getBadgeStyle(badge.tone, isSteam)}>{badge.label}</span>)}
        </div>
      ) : null}
      {model.blocks.map((block, index) => <DetailBlock key={`${block.kind}:${index}`} block={block} isSteam={isSteam} />)}
      {model.gamePlacement === "after-details" ? gameRow : null}
      {model.showLegacyActions ? (
        <DeckyCompactPillActionGroup style={{ justifyContent: "center" }}>
          <DeckyCompactPillActionItem
            dataAttributes={{ "data-achievement-companion-compact-achievement-back": "true" }}
            elementRef={compactAchievementBackButtonRef}
            label="Back" onCancelButton={onBack} onClick={onBack}
          />
          {onOpenFullScreenGame !== undefined ? (
            <DeckyCompactPillActionItem label="Open Game" onCancelButton={onBack} onClick={onOpenFullScreenGame} />
          ) : null}
        </DeckyCompactPillActionGroup>
      ) : null}
    </div>
  );
}

export function DeckyAchievementDetailView(props: DeckyAchievementDetailViewProps): JSX.Element {
  if (props.model.panelTitle !== undefined) {
    return (
      <PanelSection title={props.model.panelTitle}>
        <PanelSectionRow><AchievementDetailCard {...props} /></PanelSectionRow>
      </PanelSection>
    );
  }
  return (
    <section aria-label="Achievement details" style={getStandaloneRootStyle()}>
      <AchievementDetailCard {...props} />
    </section>
  );
}
