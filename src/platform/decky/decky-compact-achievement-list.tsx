import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEventHandler } from "react";
import { Focusable, type FocusableProps } from "@decky/ui";
import checkCircleIconUrl from "./assets/check-circle.svg";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import {
  DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS,
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
} from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { findDeckyScrollContainerAncestor } from "./decky-scroll-viewport";
import { registerCompactAchievementCancelCallback } from "./decky-full-screen-cancel-bridge";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import {
  getCompactAchievementFilterCounts,
  getCompactAchievementLoadActions,
  matchesCompactAchievementFilter,
  matchesCompactAchievementModeFilter,
  type CompactAchievementFilter,
  type CompactAchievementListViewModel,
  type CompactAchievementModeFilter,
  type CompactAchievementRowViewModel,
  type CompactAchievementTone,
} from "./decky-compact-achievement-model";
import {
  readDeckyCompactAchievementPageState,
  writeDeckyCompactAchievementPageState,
  type DeckyCompactAchievementPageState,
} from "./decky-compact-achievement-page-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { DeckySteamAchievementStatusIcon } from "./decky-steam-achievement-status-icon";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raRecipes, raTheme } from "./ra-theme";

type DeckyGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

export interface DeckyCompactAchievementListProps {
  readonly embedded: boolean;
  readonly focusRestorationReady?: boolean;
  readonly model: CompactAchievementListViewModel;
  readonly onBack: () => void;
  readonly onOpenAchievement: (achievementId: string) => void;
}

const FILTERS: readonly CompactAchievementFilter[] = ["all", "unlocked", "locked"];
const MODE_FILTERS: readonly CompactAchievementModeFilter[] = ["all", "hardcore", "softcore"];

function getRootStyle(embedded: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: embedded ? 0 : "0 16px 4px",
  };
}

function getHeadingStyle(isSteam: boolean): CSSProperties {
  return {
    margin: 0,
    ...(isSteam ? steamRecipes.text("compact", "heading") : raRecipes.text("compact", "heading")),
    color: isSteam ? steamTheme.color.accent : raTheme.color.accent,
    fontSize: isSteam ? steamTheme.type.compact.heading : raTheme.type.compact.heading,
    fontWeight: 850,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getRowsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };
}

function getRowStyle(row: CompactAchievementRowViewModel, isFocused: boolean, isSteam: boolean): CSSProperties {
  if (row.metadataPlacement === "rail") {
    return {
      ...(isSteam ? steamRecipes.card("compact", "raised") : raRecipes.compactAchievementRow(row.tone, isFocused)),
      background: isSteam
        ? isFocused ? steamTheme.surface.focusedContentCard : steamTheme.surface.contentCard
        : isFocused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard,
      ...(isSteam && isFocused ? { borderColor: steamTheme.color.borderStrong, boxShadow: steamTheme.focus.shadow } : {}),
      display: "grid",
      gridTemplateColumns: "40px minmax(0, 1fr) minmax(42px, auto)",
      alignItems: "start",
      padding: "9px",
    };
  }
  if (!isSteam) {
    const state = row.tone === "hardcore"
      ? raRecipes.achievementState.hardcore
      : row.tone === "softcore"
        ? raRecipes.achievementState.softcore
        : row.stateIndicator === "unlocked"
          ? raRecipes.achievementState.unlocked
          : row.stateIndicator === "locked"
            ? raRecipes.achievementState.locked
            : undefined;
    const stateSurface = row.tone === "hardcore"
      ? raTheme.surface.hardcore
      : row.tone === "softcore"
        ? raTheme.surface.softcore
        : row.stateIndicator === "locked"
          ? raTheme.surface.locked
          : "rgba(0, 0, 0, 0)";
    return {
      ...raRecipes.card("compact", true),
      display: "grid",
      gridTemplateColumns: "40px minmax(0, 1fr)",
      gap: raTheme.space.sm,
      width: "100%",
      minWidth: 0,
      padding: "9px 9px",
      border: `1px solid ${isFocused ? raTheme.focus.border : state?.color ?? raTheme.color.borderSubtle}`,
      borderLeftWidth: 3,
      background: `linear-gradient(180deg, ${stateSurface}, ${stateSurface}), ${isFocused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard}`,
      boxShadow: isFocused ? raTheme.focus.shadow : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 2px 8px rgba(0, 0, 0, 0.16)",
    };
  }
  const accent = row.tone === "hardcore"
    ? "rgba(214, 178, 74, 0.78)"
    : row.tone === "softcore"
      ? "rgba(214, 221, 232, 0.72)"
      : row.stateIndicator === "unlocked"
        ? "rgba(34, 211, 238, 0.72)"
        : row.stateIndicator === "locked"
          ? "rgba(248, 113, 113, 0.5)"
          : "rgba(255, 255, 255, 0.12)";
  return {
    display: "grid",
    gridTemplateColumns: "40px minmax(0, 1fr)",
    gap: 8,
    width: "100%",
    minWidth: 0,
    padding: "9px 9px",
    boxSizing: "border-box",
    border: `1px solid ${accent}`,
    borderLeftWidth: 3,
    borderRadius: 12,
    background: isFocused ? steamTheme.surface.focusedContentCard : steamTheme.surface.contentCard,
    boxShadow: isFocused ? steamTheme.focus.shadow : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 2px 8px rgba(0, 0, 0, 0.16)",
  };
}

function getIconFrameStyle(isUnlocked: boolean, isSteam: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    width: 40,
    minWidth: 40,
    lineHeight: 0,
    opacity: isUnlocked ? 1 : 0.9,
    filter: isSteam
      ? (isUnlocked ? steamRecipes.achievementState.unlocked.artworkFilter : steamRecipes.achievementState.locked.artworkFilter)
      : (isUnlocked ? raRecipes.achievementState.unlocked.artworkFilter : raRecipes.achievementState.locked.artworkFilter),
  };
}

function getMainStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 };
}

function getTitleLineStyle(): CSSProperties {
  return { display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: "3px 5px", minWidth: 0 };
}

function getTitleStyle(isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "title") : raRecipes.text("compact", "title")),
    color: isSteam ? steamTheme.color.textPrimary : raTheme.color.textPrimary,
    fontSize: isSteam ? steamTheme.type.compact.title : raTheme.type.compact.title,
    fontWeight: 800,
    lineHeight: 1.17,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getDescriptionStyle(isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "body") : raRecipes.text("compact", "body")),
    color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary,
    fontSize: isSteam ? steamTheme.type.compact.body : raTheme.type.compact.body,
    lineHeight: 1.2,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getSecondaryStyle(tone: CompactAchievementTone, isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")),
    color: tone === "hardcore"
      ? raTheme.color.hardcore
      : tone === "softcore"
        ? raTheme.color.softcore
        : isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary,
    fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata,
    fontWeight: 650,
    lineHeight: 1.18,
  };
}

function getRailStyle(isSteam: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: isSteam ? 5 : 3,
    minWidth: 42,
  };
}

function getStateIndicatorStyle(): CSSProperties {
  return {
    width: 18,
    height: 18,
    filter: steamTheme.iconFilter.success,
  };
}

function getLockedStateIndicatorStyle(): CSSProperties {
  return {
    display: "inline-flex",
    width: 18,
    height: 18,
    color: steamRecipes.achievementState.locked.color,
  };
}

function getRailMetadataStyle(isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text("compact", "metadata") : raRecipes.text("compact", "metadata")),
    color: isSteam ? steamTheme.color.textPrimary : raTheme.color.textPrimary,
    fontSize: isSteam ? steamTheme.type.compact.metadata : raTheme.type.compact.metadata,
    fontWeight: 750,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
}

function getEmptyStyle(isSteam: boolean): CSSProperties {
  return {
    padding: "14px 10px",
    borderRadius: 12,
    color: isSteam ? "rgba(255, 255, 255, 0.68)" : raTheme.color.textMuted,
    fontSize: "0.78em",
    lineHeight: 1.25,
    textAlign: "center",
    background: isSteam ? steamTheme.surface.contentStat : raTheme.surface.contentStat,
  };
}

function formatFilterLabel(
  filter: CompactAchievementFilter,
  counts: Readonly<Record<CompactAchievementFilter, number>>,
): string {
  const label = filter === "all" ? "All" : filter === "unlocked" ? "Unlocked" : "Locked";
  return `${label} (${counts[filter].toLocaleString()})`;
}

function formatModeFilterLabel(filter: CompactAchievementModeFilter): string {
  return filter === "all" ? "All" : filter === "hardcore" ? "Hardcore" : "Softcore";
}

function readScrollTop(target: EventTarget | null, fallback: number): number {
  return target instanceof HTMLElement
    ? findDeckyScrollContainerAncestor(target)?.scrollTop ?? fallback
    : fallback;
}

function readSteamScrollTop(target: EventTarget | null, fallback: number): number {
  const element = target as HTMLElement | null;
  const HTMLElementConstructor = element?.ownerDocument?.defaultView?.HTMLElement;
  return HTMLElementConstructor !== undefined && element instanceof HTMLElementConstructor
    ? findDeckyScrollContainerAncestor(element)?.scrollTop ?? fallback
    : fallback;
}

function CompactAchievementRow({
  model,
  isSteam,
  onBack,
  onFocusRow,
  onOpen,
  preferredFocus,
}: {
  readonly model: CompactAchievementRowViewModel;
  readonly isSteam: boolean;
  readonly onBack: () => void;
  readonly onFocusRow: (target: EventTarget | null, achievementId: string) => void;
  readonly onOpen: (target: EventTarget | null) => void;
  readonly preferredFocus: boolean;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const handleFocus: FocusEventHandler<HTMLElement> = (event) => {
    setIsFocused(true);
    scrollDeckyFocusTargetIntoView(event.currentTarget);
    onFocusRow(event.currentTarget, model.achievementId);
  };
  const handleGamepadFocus: DeckyGamepadFocusHandler = (event) => {
    setIsFocused(true);
    scrollDeckyFocusTargetIntoView(event.currentTarget);
    onFocusRow(event.currentTarget, model.achievementId);
  };

  return (
    <Focusable
      data-achievement-companion-compact-achievement-id={model.achievementId}
      data-ac-ra-achievement-tone={isSteam ? undefined : model.tone}
      aria-label={`${model.title}, ${model.statusText}`}
      className={model.metadataPlacement === "rail" ? undefined : DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      onActivate={(event) => onOpen(event.currentTarget)}
      onBlur={() => setIsFocused(false)}
      onGamepadBlur={() => setIsFocused(false)}
      onCancel={onBack}
      onClick={(event) => onOpen(event.currentTarget)}
      onFocus={handleFocus}
      onGamepadFocus={handleGamepadFocus}
      preferredFocus={preferredFocus}
      role="button"
      style={getRowStyle(model, isFocused, isSteam)}
    >
      <div style={getIconFrameStyle(model.isUnlocked, isSteam)}>
        {model.iconUrl !== undefined ? (
          <DeckyGameArtwork compact src={model.iconUrl} size={38} title={model.title} />
        ) : null}
      </div>

      <div style={getMainStyle()}>
        <div style={getTitleLineStyle()}>
          <span style={getTitleStyle(isSteam)}>{model.title}</span>
          <DeckyAchievementTypeBadge classification={model.classification} />
        </div>
        {model.description !== undefined ? <div style={getDescriptionStyle(isSteam)}>{model.description}</div> : null}
        {model.metadataPlacement === "stack" ? (
          <>
            <div style={getSecondaryStyle(model.tone, isSteam)}>{model.statusText}</div>
            {model.metadata.map((item) => (
              <div key={item.key} style={getSecondaryStyle(model.tone, isSteam)}>
                {!isSteam && item.key === "points" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><DeckyRetroAchievementsPointsIcon size={12} />{item.value}</span> : item.value}
              </div>
            ))}
          </>
        ) : null}
        {model.timestampText !== undefined ? (
          <div style={getSecondaryStyle(model.tone, isSteam)}>{model.timestampText}</div>
        ) : null}
      </div>

      {model.metadataPlacement === "rail" ? (
        <div style={getRailStyle(isSteam)}>
          {!isSteam && model.isUnlocked && model.unlockMode !== undefined ? (
            <span style={{ color: model.unlockMode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore, fontSize: raTheme.type.compact.caption, fontWeight: 800, textTransform: "capitalize" }}>{model.unlockMode}</span>
          ) : null}
          {model.stateIndicator !== undefined ? (
            <span aria-label={model.statusText} role="img" style={{ color: model.stateIndicator === "unlocked" ? steamRecipes.achievementState.unlocked.color : steamRecipes.achievementState.locked.color }}>
              {model.stateIndicator === "unlocked" ? (
                <img alt="" aria-hidden="true" src={checkCircleIconUrl} style={getStateIndicatorStyle()} />
              ) : (
                <span style={getLockedStateIndicatorStyle()}>
                  <DeckySteamAchievementStatusIcon isUnlocked={false} size={18} />
                </span>
              )}
            </span>
          ) : null}
          {model.metadata.map((item) => {
            const rarityPercent = !isSteam && item.key === "rarity" ? Number.parseFloat(item.value) : undefined;
            return rarityPercent !== undefined && Number.isFinite(rarityPercent) ? (
              <div key={item.key} style={raRecipes.compactAchievementRarity.root}>
                <span aria-hidden="true" style={raRecipes.compactAchievementRarity.track}>
                  <span style={{ ...raRecipes.compactAchievementRarity.fill(rarityPercent), display: "block" }} />
                </span>
                <span style={raRecipes.compactAchievementRarity.label}>{`${Math.round(rarityPercent)}% players`}</span>
              </div>
            ) : (
              <span key={item.key} style={getRailMetadataStyle(isSteam)}>
                {!isSteam && item.key === "points" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><DeckyRetroAchievementsPointsIcon size={12} />{item.value}</span> : item.value}
              </span>
            );
          })}
        </div>
      ) : null}
    </Focusable>
  );
}

export function DeckyCompactAchievementList({
  embedded,
  focusRestorationReady = true,
  model,
  onBack,
  onOpenAchievement,
}: DeckyCompactAchievementListProps): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const [pageState, setPageState] = useState<DeckyCompactAchievementPageState>(() =>
    readDeckyCompactAchievementPageState(model.providerId, model.gameId, model.initialVisibleCount));
  const pageStateRef = useRef(pageState);
  const restoreAchievementIdRef = useRef(pageState.focusedAchievementId);
  const [focusedControl, setFocusedControl] = useState<string | undefined>();
  const isSteam = model.providerId === "steam";
  const refined = true;
  const counts = useMemo(() => getCompactAchievementFilterCounts(model.rows), [model.rows]);
  const filteredRows = useMemo(
    () => model.rows.filter((row) =>
      matchesCompactAchievementFilter(row, pageState.filter) &&
      (!model.supportsModeFilter || matchesCompactAchievementModeFilter(row, pageState.modeFilter))),
    [model.rows, model.supportsModeFilter, pageState.filter, pageState.modeFilter],
  );
  const visibleRows = filteredRows.slice(0, pageState.visibleCount);
  const { showFiveMore: canLoadMore, showAll: canShowAll } = getCompactAchievementLoadActions(pageState.visibleCount, filteredRows.length);

  useLayoutEffect(() => {
    const restoreAchievementId = restoreAchievementIdRef.current;
    if (!focusRestorationReady || embedded || restoreAchievementId === undefined) {
      return;
    }

    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-achievement-companion-compact-achievement-id='${restoreAchievementId}']`,
    ) ?? rootRef.current?.querySelector<HTMLElement>("[data-ac-compact-filter-selected='true']");
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [embedded, focusRestorationReady, model.gameId, model.providerId]);

  useLayoutEffect(() => {
    if (embedded || !focusRestorationReady || restoreAchievementIdRef.current !== undefined || isSteam) return;
    const target = rootRef.current?.querySelector<HTMLElement>("[data-ac-compact-filter-selected='true']");
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [embedded, focusRestorationReady, isSteam, model.gameId, model.providerId]);

  useLayoutEffect(() => {
    if (embedded) {
      return;
    }
    return registerCompactAchievementCancelCallback(rootRef.current, onBack);
  }, [embedded, onBack]);

  const commitPageState = (
    update: (current: DeckyCompactAchievementPageState) => DeckyCompactAchievementPageState,
  ): void => {
    // Persist before opening details can unmount the list in the same React batch.
    const next = update(pageStateRef.current);
    pageStateRef.current = next;
    writeDeckyCompactAchievementPageState(model.providerId, model.gameId, next);
    setPageState(next);
  };

  const rememberFocus = (target: EventTarget | null, achievementId: string): void => {
    commitPageState((current) => ({
      ...current,
      focusedAchievementId: achievementId,
      scrollTop: refined ? readSteamScrollTop(target, current.scrollTop) : readScrollTop(target, current.scrollTop),
    }));
  };

  return (
      <section aria-label={`${model.gameTitle} achievements`} data-ac-ra-achievement-list={isSteam ? undefined : "true"} data-ac-steam-theme={isSteam ? "compact" : undefined} data-ac-ra-theme={!isSteam ? "compact" : undefined} ref={rootRef} style={getRootStyle(embedded)}>
      {!embedded ? <h2 style={getHeadingStyle(isSteam)}>Achievements</h2> : null}

      {model.supportsModeFilter ? (
        <Focusable
          aria-label="Achievement mode filters"
          style={{ display: "flex", gap: 5, width: "100%", minWidth: 0 }}
          flow-children="left-right"
          role="radiogroup"
        >
          {MODE_FILTERS.map((filter) => {
            const active = pageState.modeFilter === filter;
            return (
              <Focusable
                aria-checked={active}
                aria-label={formatModeFilterLabel(filter)}
                style={raRecipes.filter(active, focusedControl === `mode:${filter}`)}
                key={filter}
                noFocusRing
                onActivate={() => commitPageState((current) => ({
                  ...current,
                  modeFilter: filter,
                  visibleCount: model.initialVisibleCount,
                  focusedAchievementId: undefined,
                  scrollTop: 0,
                }))}
                onCancelButton={onBack}
                onClick={() => commitPageState((current) => ({
                  ...current,
                  modeFilter: filter,
                  visibleCount: model.initialVisibleCount,
                  focusedAchievementId: undefined,
                  scrollTop: 0,
                }))}
                onFocus={(event) => { setFocusedControl(`mode:${filter}`); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
                onGamepadFocus={(event) => { setFocusedControl(`mode:${filter}`); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
                onBlur={() => setFocusedControl(undefined)}
                role="radio"
              >
                {formatModeFilterLabel(filter)}
              </Focusable>
            );
          })}
        </Focusable>
      ) : null}

      <Focusable
        aria-label="Achievement filters"
        className={refined ? undefined : DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS}
        style={refined ? { display: "flex", gap: 5, width: "100%", minWidth: 0 } : undefined}
        flow-children="left-right"
        role="radiogroup"
      >
        {FILTERS.map((filter) => {
          const active = pageState.filter === filter;
          const className = [
            DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS,
            active ? DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS : undefined,
          ].filter((value): value is string => value !== undefined).join(" ");
          const label = formatFilterLabel(filter, counts);
          return (
            <Focusable
              data-ac-compact-filter-selected={active ? "true" : undefined}
              aria-checked={active}
              aria-label={label}
              className={refined ? undefined : className}
              {...(refined ? {} : {
                focusClassName: DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS,
                focusWithinClassName: DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS,
              })}
              key={filter}
              noFocusRing
              onActivate={() => commitPageState((current) => ({
                ...current,
                filter,
                visibleCount: model.initialVisibleCount,
                focusedAchievementId: undefined,
                scrollTop: 0,
              }))}
              onCancelButton={onBack}
              onClick={() => commitPageState((current) => ({
                ...current,
                filter,
                visibleCount: model.initialVisibleCount,
                focusedAchievementId: undefined,
                scrollTop: 0,
              }))}
              onFocus={(event) => {
                setFocusedControl(filter);
                scrollDeckyFocusTargetIntoView(event.currentTarget);
              }}
              onGamepadFocus={(event) => {
                setFocusedControl(filter);
                scrollDeckyFocusTargetIntoView(event.currentTarget);
              }}
              onBlur={() => setFocusedControl(undefined)}
              role="radio"
              style={isSteam
                ? getSteamCompactAchievementFilterStyle(active, focusedControl === filter)
                : raRecipes.filter(active, focusedControl === filter)}
            >
              {label}
            </Focusable>
          );
        })}
      </Focusable>

      {visibleRows.length > 0 ? (
        <div style={getRowsStyle()}>
          {visibleRows.map((row) => (
            <CompactAchievementRow
              key={row.achievementId}
              model={row}
              isSteam={isSteam}
              onBack={onBack}
              onFocusRow={rememberFocus}
              onOpen={(target) => {
                commitPageState((current) => ({
                  ...current,
                  focusedAchievementId: row.achievementId,
                  scrollTop: refined
                    ? readSteamScrollTop(target, current.scrollTop)
                    : current.scrollTop,
                }));
                onOpenAchievement(row.achievementId);
              }}
              preferredFocus={
                embedded &&
                pageState.focusedAchievementId === row.achievementId
              }
            />
          ))}
        </div>
      ) : (
        <div style={getEmptyStyle(refined)}>
          {pageState.filter === "all"
            ? "No achievements were returned for this game."
            : `No ${pageState.filter} achievements match this filter.`}
        </div>
      )}

      {refined && (canLoadMore || canShowAll) ? (
        <Focusable flow-children="left-right" tabIndex={-1} style={{ display: "flex", gap: 6, minWidth: 0 }}>
          {(["Show 5 more", "Show all"] as const).filter((label) => label === "Show 5 more" ? canLoadMore : canShowAll).map((label) => (
            <Focusable
              key={label} role="button" noFocusRing onCancelButton={onBack}
              onFocus={(event) => { setFocusedControl(label); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
              onGamepadFocus={(event) => { setFocusedControl(label); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
              onBlur={() => setFocusedControl(undefined)}
              onActivate={() => commitPageState((current) => ({ ...current, visibleCount: label === "Show all" ? filteredRows.length : Math.min(filteredRows.length, current.visibleCount + 5) }))}
              onClick={() => commitPageState((current) => ({ ...current, visibleCount: label === "Show all" ? filteredRows.length : Math.min(filteredRows.length, current.visibleCount + 5) }))}
              style={{ ...raRecipes.action("compact", false, focusedControl === label), padding: "8px", fontSize: 11 }}
            >{label}</Focusable>
          ))}
        </Focusable>
      ) : canLoadMore || canShowAll ? (
        <DeckyCompactPillActionGroup>
          {canLoadMore ? (
            <DeckyCompactPillActionItem
              label="Show 5 more"
              onCancelButton={onBack}
              onClick={() => commitPageState((current) => ({
                ...current,
                visibleCount: Math.min(filteredRows.length, current.visibleCount + 5),
              }))}
            />
          ) : null}
          {canShowAll ? (
            <DeckyCompactPillActionItem
              label="Show all"
              onCancelButton={onBack}
              onClick={() => commitPageState((current) => ({ ...current, visibleCount: filteredRows.length }))}
            />
          ) : null}
        </DeckyCompactPillActionGroup>
      ) : null}
    </section>
  );
}
