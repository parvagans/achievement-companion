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

function getCardStyle(): CSSProperties {
  return {
    display: "flex", flexDirection: "column", gap: 11, width: "100%", minWidth: 0,
    padding: 12, boxSizing: "border-box", borderRadius: 14,
    border: "1px solid rgba(48, 152, 215, 0.22)",
    background: "linear-gradient(180deg, rgba(8, 31, 47, 0.97), rgba(7, 24, 38, 0.97))",
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

function getTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.99)", fontSize: "0.9em", fontWeight: 850,
    lineHeight: 1.14, minWidth: 0, overflowWrap: "anywhere",
  };
}

function getDescriptionStyle(): CSSProperties {
  return {
    margin: 0, color: "rgba(190, 220, 243, 0.88)", fontSize: "0.76em",
    lineHeight: 1.32, whiteSpace: "pre-wrap",
  };
}

function getBadgeRowStyle(): CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 };
}

function getBadgeStyle(tone: "default" | "success" | "points"): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 27,
    padding: "4px 9px", boxSizing: "border-box", borderRadius: 8,
    border: `1px solid ${tone === "success"
      ? "rgba(48, 224, 145, 0.34)"
      : tone === "points" ? "rgba(245, 190, 54, 0.32)" : "rgba(86, 163, 218, 0.28)"}`,
    background: tone === "success"
      ? "rgba(20, 117, 77, 0.16)"
      : tone === "points" ? "rgba(124, 89, 17, 0.15)" : "rgba(30, 79, 116, 0.18)",
    color: tone === "success"
      ? "rgba(69, 239, 154, 0.98)"
      : tone === "points" ? "rgba(255, 211, 88, 0.98)" : "rgba(223, 239, 251, 0.94)",
    fontSize: "0.69em", fontWeight: 750, lineHeight: 1,
  };
}

function getSectionStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 };
}

function getSectionLabelStyle(): CSSProperties {
  return {
    color: "#66d6ff", fontSize: "0.68em", fontWeight: 850, letterSpacing: "0.07em",
    lineHeight: 1.2, textTransform: "uppercase",
  };
}

function getStatusStyle(tone: CompactAchievementTone): CSSProperties {
  const color = tone === "hardcore"
    ? "rgba(252, 211, 77, 0.98)"
    : tone === "softcore"
      ? "rgba(220, 225, 233, 0.96)"
      : tone === "locked" ? "rgba(255, 255, 255, 0.68)" : "rgba(82, 242, 156, 0.98)";
  return {
    display: "flex", flexDirection: "column", gap: 3, padding: "9px 10px", borderRadius: 11,
    border: "1px solid rgba(255, 255, 255, 0.09)", background: "rgba(255, 255, 255, 0.035)",
    color, fontSize: "0.8em", fontWeight: 800, lineHeight: 1.2,
  };
}

function getStatusSecondaryStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.68)", fontSize: "0.86em", fontWeight: 600 };
}

function getStatsGridStyle(columns: 2 | 3): CSSProperties {
  return {
    display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6, minWidth: 0,
  };
}

function getStatStyle(): CSSProperties {
  return {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    minWidth: 0, minHeight: 48, padding: "7px 5px", boxSizing: "border-box", borderRadius: 10,
    border: "1px solid rgba(63, 142, 196, 0.17)", background: "rgba(10, 39, 58, 0.72)", textAlign: "center",
  };
}

function getStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(164, 201, 229, 0.8)", fontSize: "0.57em", fontWeight: 750,
    letterSpacing: "0.04em", lineHeight: 1.15, textTransform: "uppercase",
  };
}

function getStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)", fontSize: "0.75em", fontWeight: 800,
    lineHeight: 1.15, minWidth: 0, overflowWrap: "anywhere",
  };
}

function getStatSecondaryStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.66)", fontSize: "0.62em", lineHeight: 1.15 };
}

function getTimestampStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 };
}

function getRarityTrackStyle(): CSSProperties {
  return { height: 6, borderRadius: 999, overflow: "hidden", background: "rgba(255, 255, 255, 0.08)" };
}

function getRarityFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`, height: "100%", borderRadius: 999,
    background: "linear-gradient(90deg, rgba(147, 197, 253, 0.92), rgba(96, 165, 250, 0.98))",
  };
}

function getRarityCaptionStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.76)", fontSize: "0.72em", fontWeight: 700 };
}

function getGameRowStyle(isFocused: boolean): CSSProperties {
  return {
    display: "grid", gridTemplateColumns: "38px minmax(0, 1fr) 18px", alignItems: "center", gap: 8,
    width: "100%", minWidth: 0, padding: "8px 9px", boxSizing: "border-box", borderRadius: 11,
    border: isFocused ? "1px solid rgba(54, 185, 255, 0.92)" : "1px solid rgba(63, 142, 196, 0.2)",
    background: isFocused
      ? "linear-gradient(180deg, rgba(17, 91, 139, 0.78), rgba(8, 53, 82, 0.9))"
      : "rgba(10, 39, 58, 0.78)",
    boxShadow: isFocused
      ? "0 0 0 1px rgba(54, 185, 255, 0.72), 0 0 13px rgba(54, 185, 255, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  };
}

function getAchievementHeadingStyle(isFocused: boolean): CSSProperties {
  return {
    ...getRowStyle(),
    margin: "-3px",
    padding: 3,
    borderRadius: 9,
    border: isFocused ? "1px solid rgba(54, 185, 255, 0.2)" : "1px solid transparent",
    boxShadow: isFocused ? "inset 0 0 0 1px rgba(54, 185, 255, 0.07)" : "none",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };
}

function getGameTitleStyle(): CSSProperties {
  return {
    color: "rgba(246, 251, 255, 0.96)", fontSize: "0.72em", fontWeight: 750,
    lineHeight: 1.18, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
}

function getGamePlatformStyle(): CSSProperties {
  return { color: "rgba(166, 201, 228, 0.76)", fontSize: "0.62em", lineHeight: 1.15 };
}

function getChevronStyle(): CSSProperties {
  return {
    width: 18, height: 18,
    filter: "brightness(0) saturate(100%) invert(65%) sepia(90%) saturate(1150%) hue-rotate(161deg) brightness(101%) contrast(101%)",
  };
}

function DetailStat({ stat, fullWidth }: { readonly stat: CompactAchievementDetailStat; readonly fullWidth: boolean }): JSX.Element {
  return (
    <div style={{ ...getStatStyle(), ...(fullWidth ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={getStatLabelStyle()}>{stat.label}</div>
      <div style={getStatValueStyle()}>{stat.value}</div>
      {stat.secondary !== undefined ? <div style={getStatSecondaryStyle()}>{stat.secondary}</div> : null}
    </div>
  );
}

function DetailBlock({ block }: { readonly block: CompactAchievementDetailBlock }): JSX.Element {
  if (block.kind === "status") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle()}>{block.title}</div>
        <div style={getStatusStyle(block.tone)}>
          <span>{block.value}</span>
          {block.secondary !== undefined ? <span style={getStatusSecondaryStyle()}>{block.secondary}</span> : null}
        </div>
      </div>
    );
  }
  if (block.kind === "timestamp") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle()}>{block.title}</div>
        <div style={getTimestampStyle()}>
          <DetailStat stat={{ key: "date", label: "Date", value: block.value }} fullWidth={false} />
          <DetailStat stat={{ key: "time", label: "Time", value: block.secondary }} fullWidth={false} />
        </div>
      </div>
    );
  }
  if (block.kind === "stats") {
    return (
      <div style={getSectionStyle()}>
        <div style={getSectionLabelStyle()}>{block.title}</div>
        <div style={getStatsGridStyle(block.columns)}>
          {block.stats.map((stat) => <DetailStat key={stat.key} stat={stat} fullWidth={false} />)}
        </div>
      </div>
    );
  }
  return (
    <div style={getSectionStyle()}>
      <div style={getSectionLabelStyle()}>{block.title}</div>
      <div style={getRarityCaptionStyle()}>{block.caption}</div>
      <div
        aria-label="Achievement unlock rate" aria-valuemax={100} aria-valuemin={0}
        aria-valuenow={block.percent ?? 0} aria-valuetext={block.caption} role="progressbar"
        style={getRarityTrackStyle()}
      >
        <div style={getRarityFillStyle(block.percent ?? 0)} />
      </div>
      {block.stats.length > 0 ? (
        <div style={getStatsGridStyle(2)}>
          {block.stats.map((stat) => (
            <DetailStat key={stat.key} stat={stat} fullWidth={stat.key === "players"} />
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

  return (
    <div style={getSectionStyle()}>
      <div style={getSectionLabelStyle()}>Game</div>
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
        role="button" style={getGameRowStyle(isFocused)}
      >
        {model.game.artworkUrl !== undefined ? (
          <DeckyGameArtwork compact src={model.game.artworkUrl} size={36} title={model.game.title} />
        ) : <span />}
        <div style={getTextBlockStyle()}>
          <div style={getGameTitleStyle()}>{model.game.title}</div>
          <div style={getGamePlatformStyle()}>{model.game.platformLabel}</div>
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
  const compactAchievementBackButtonRef = useCallback((node: HTMLDivElement | null) => {
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(node);
  }, []);

  useLayoutEffect(
    () => model.showLegacyActions ? undefined : registerCompactAchievementCancelCallback(rootRef.current, onBack),
    [model.showLegacyActions, onBack],
  );

  const gameRow = <GameContextRow model={model} onBack={onBack} onOpen={onOpenCompactGame} />;
  return (
    <div ref={rootRef} style={getCardStyle()}>
      {model.gamePlacement === "before-achievement" ? gameRow : null}
      <Focusable
        aria-label={`Achievement ${model.title}`}
        noFocusRing
        onActivate={() => {}}
        onFocus={(event) => {
          const generation = ++headingFocusGeneration.current;
          setAchievementHeadingFocused(true);
          scrollDeckyFocusTargetToTop(event.currentTarget, () => headingFocusGeneration.current === generation);
        }}
        onGamepadFocus={((event) => {
          const generation = ++headingFocusGeneration.current;
          setAchievementHeadingFocused(true);
          scrollDeckyFocusTargetToTop(event.currentTarget, () => headingFocusGeneration.current === generation);
        }) satisfies DeckyGamepadFocusHandler}
        onBlur={() => {
          headingFocusGeneration.current += 1;
          setAchievementHeadingFocused(false);
        }}
        role="group"
        style={getAchievementHeadingStyle(achievementHeadingFocused)}
      >
        {model.iconUrl !== undefined ? (
          <DeckyGameArtwork compact src={model.iconUrl} size={model.gamePlacement === "after-details" ? 54 : 40} title={model.title} />
        ) : null}
        <div style={getTextBlockStyle()}>
          <div style={getTitleLineStyle()}>
            <span style={getTitleStyle()}>{model.title}</span>
            <DeckyAchievementTypeBadge classification={model.classification} />
          </div>
        </div>
      </Focusable>
      {model.description.length > 0 ? <p style={getDescriptionStyle()}>{model.description}</p> : null}
      {model.badges.length > 0 ? (
        <div style={getBadgeRowStyle()}>
          {model.badges.map((badge) => <span key={badge.key} style={getBadgeStyle(badge.tone)}>{badge.label}</span>)}
        </div>
      ) : null}
      {model.blocks.map((block, index) => <DetailBlock key={`${block.kind}:${index}`} block={block} />)}
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
