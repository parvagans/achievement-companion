import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useRef, useState, type CSSProperties, type ElementType, type ReactNode, type Ref } from "react";
import type { GameCommunityMaster } from "@core/domain";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import type { NativeRetroAchievementsCommunityModels, NativeRetroAchievementsCommunityRow } from "./decky-native-retroachievements-community-model";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";

export interface NativeSteamCommunitySectionPrimitives {
  readonly Section: ElementType<{
    readonly children?: ReactNode;
    readonly label?: string;
    readonly showRule?: boolean;
    readonly availableOffline?: boolean;
    readonly "data-achievement-companion-native-community"?: string;
  }>;
  readonly Body: ElementType<{
    readonly children?: ReactNode;
    readonly className?: string;
  }>;
}

const palette = {
  text: "#dcdedf",
  muted: "#8b929a",
  panel: "rgba(10, 14, 18, 0.72)",
  row: "rgba(255, 255, 255, 0.025)",
  rule: "rgba(255, 255, 255, 0.075)",
  neutralIcon: "rgba(255, 255, 255, 0.10)",
  masteryIcon: "rgba(218, 160, 14, 0.22)",
  mastery: "#e5a80d",
  selected: "rgba(255, 255, 255, 0.10)",
  focused: "#dcdedf",
  focusedText: "#23262e",
} as const;

const COMMUNITY_PANEL_BODY_HEIGHT = 266;
const LATEST_MASTER_ROW_CLASS = "achievement-companion-native-community-master-row";
const LATEST_MASTER_META_CLASS = "achievement-companion-native-community-master-row__meta";
const COMMUNITY_MODE_BUTTON_CLASS = "achievement-companion-native-community-mode-button";
const LATEST_MASTER_FOCUS_STYLES = `
[data-achievement-companion-native-community="true"] .${COMMUNITY_MODE_BUTTON_CLASS}.Panel.Focusable {
  transform: none !important;
  transition: background 100ms ease, color 100ms ease, box-shadow 100ms ease;
}
[data-achievement-companion-native-community="true"] .${COMMUNITY_MODE_BUTTON_CLASS}.Panel.Focusable.gpfocus {
  color: ${palette.focusedText} !important;
  background: ${palette.focused} !important;
  box-shadow: inset 0 0 0 2px rgba(35, 38, 46, 0.72) !important;
}
[data-achievement-companion-native-community-masters-scroll="true"] .${LATEST_MASTER_ROW_CLASS}.Panel.Focusable {
  transform: none !important;
  transition: background 100ms ease, color 100ms ease, box-shadow 100ms ease;
}
[data-achievement-companion-native-community-masters-scroll="true"] .${LATEST_MASTER_ROW_CLASS}.Panel.Focusable.gpfocus {
  color: ${palette.focusedText} !important;
  background: ${palette.focused} !important;
  box-shadow: inset 0 0 0 2px rgba(35, 38, 46, 0.72) !important;
}
[data-achievement-companion-native-community-masters-scroll="true"] .${LATEST_MASTER_ROW_CLASS}.Panel.Focusable.gpfocus .${LATEST_MASTER_META_CLASS} {
  color: ${palette.focusedText} !important;
}
`;

function revealLatestMasterRow(row: HTMLElement): void {
  const scroller = row.closest<HTMLElement>("[data-achievement-companion-native-community-masters-scroll='true']");
  if (scroller === null) return;
  const header = scroller.querySelector<HTMLElement>("[data-achievement-companion-native-community-masters-header='true']");
  const rowBounds = row.getBoundingClientRect();
  const scrollerBounds = scroller.getBoundingClientRect();
  const visibleTop = scrollerBounds.top + (header?.getBoundingClientRect().height ?? 0) + 4;
  const visibleBottom = scrollerBounds.bottom - 4;
  if (rowBounds.top < visibleTop) {
    scroller.scrollTop += rowBounds.top - visibleTop;
  } else if (rowBounds.bottom > visibleBottom) {
    scroller.scrollTop += rowBounds.bottom - visibleBottom;
  }
}

function formatCount(value: number): string {
  return Math.trunc(value).toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function formatAvailabilityDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match === null) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function milestoneTone(row: NativeRetroAchievementsCommunityRow): CSSProperties {
  return row.id === "mastered"
    ? { color: palette.mastery, background: palette.masteryIcon }
    : { color: palette.text, background: palette.neutralIcon };
}

function MilestoneIcon({ row }: { readonly row: NativeRetroAchievementsCommunityRow }): JSX.Element {
  if (row.id === "beaten") {
    return <DeckyGameStatusIcon kind="beaten" size={34} color={palette.text} />;
  }
  if (row.id === "mastered" || row.id === "completed") {
    return <DeckyGameStatusIcon kind="mastered" size={35} color={row.id === "mastered" ? palette.mastery : palette.text} />;
  }
  return <span aria-hidden="true" style={{ fontSize: 25, fontWeight: 700 }}>✓</span>;
}

function formatMasteredDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getInitials(username: string): string {
  const parts = username.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (parts.length > 1) return `${parts[0]![0] ?? ""}${parts.at(-1)![0] ?? ""}`.toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function moveCommunityFocus(event: GamepadEvent, target: HTMLElement | null | undefined): void {
  if (target === null || target === undefined || !takeDeckySteamGamepadFocus(target)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  playDeckySteamNavigationSound(target.ownerDocument);
}

function LatestMasterRow({ master, index, elementRef, onGamepadDirection }: {
  readonly master: GameCommunityMaster;
  readonly index: number;
  readonly elementRef?: Ref<HTMLDivElement>;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const [avatarFailed, setAvatarFailed] = useState(false);
  return (
    <Focusable
      ref={elementRef}
      aria-label={`${master.username}, mastery ${master.rank ?? index + 1}, ${formatMasteredDate(master.masteredAt)}`}
      onActivate={() => {}}
      onFocus={(event) => {
        revealLatestMasterRow(event.currentTarget);
      }}
      onGamepadFocus={(event) => {
        if (event.currentTarget instanceof HTMLElement) {
          revealLatestMasterRow(event.currentTarget);
        }
      }}
      onGamepadDirection={onGamepadDirection}
      className={LATEST_MASTER_ROW_CLASS}
      style={{
        minHeight: 48,
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr) 96px",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        color: palette.text,
        background: index % 2 === 0 ? palette.row : "transparent",
        borderBottom: `1px solid ${palette.rule}`,
        boxSizing: "border-box",
      }}
      data-achievement-companion-native-community-master={master.userUlid ?? master.username}
    >
      <span className={LATEST_MASTER_META_CLASS} style={{ color: palette.muted, fontSize: 14, textAlign: "right" }}>
        {master.rank ?? "—"}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 30, height: 30, flex: "0 0 30px", borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", color: palette.text, background: palette.neutralIcon, fontSize: 11, fontWeight: 700 }}>
          {master.avatarUrl !== undefined && !avatarFailed
            ? <img alt="" aria-hidden="true" src={master.avatarUrl} onError={() => { setAvatarFailed(true); }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : getInitials(master.username)}
        </span>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, fontWeight: 550 }}>
          {master.username}
        </span>
      </span>
      <span className={LATEST_MASTER_META_CLASS} style={{ fontSize: 13, textAlign: "right", color: palette.muted }}>
        {formatMasteredDate(master.masteredAt)}
      </span>
    </Focusable>
  );
}

function CommunityModeButton({
  label,
  selected,
  onActivate,
  elementRef,
  onGamepadDirection,
}: {
  readonly label: "Casual" | "Hardcore";
  readonly selected: boolean;
  readonly onActivate: () => void;
  readonly elementRef?: Ref<HTMLDivElement>;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  return (
    <Focusable
      ref={elementRef}
      className={COMMUNITY_MODE_BUTTON_CLASS}
      role="tab"
      aria-selected={selected}
      aria-label={`${label} playtime stats`}
      onActivate={onActivate}
      onClick={onActivate}
      {...(onGamepadDirection === undefined ? {} : { onGamepadDirection })}
      style={{
        minWidth: 92,
        minHeight: 34,
        padding: "4px 12px",
        display: "grid",
        placeItems: "center",
        borderRadius: 5,
        color: selected ? palette.text : palette.muted,
        background: selected ? palette.selected : "transparent",
        fontSize: 14,
        lineHeight: 1,
        fontWeight: selected ? 650 : 500,
        boxSizing: "border-box",
      }}
      data-achievement-companion-native-community-mode={label.toLowerCase()}
      data-achievement-companion-selected={selected ? "true" : "false"}
    >
      {label}
    </Focusable>
  );
}

function playerCaption(row: NativeRetroAchievementsCommunityRow): string | undefined {
  if (row.playerCount === undefined) return undefined;
  const count = `${formatCount(row.playerCount)} players`;
  return row.playerPercent === undefined ? count : `${count} (${formatPercent(row.playerPercent)})`;
}

export function DeckyNativeRetroAchievementsCommunity({
  models,
  primitives,
}: {
  readonly models: NativeRetroAchievementsCommunityModels;
  readonly primitives: NativeSteamCommunitySectionPrimitives;
}): JSX.Element {
  const [selectedMode, setSelectedMode] = useState<"casual" | "hardcore">(
    models.hardcore !== undefined ? "hardcore" : "casual",
  );
  const model = selectedMode === "hardcore"
    ? models.hardcore ?? models.casual
    : models.casual ?? models.hardcore;
  const Section = primitives.Section;
  const Body = primitives.Body;
  const hasLatestMasters = models.latestMasters.length > 0;
  const visibleLatestMasters = models.latestMasters;
  const casualModeRef = useRef<HTMLDivElement>(null);
  const hardcoreModeRef = useRef<HTMLDivElement>(null);
  const latestMasterRefs = useRef<Array<HTMLDivElement | null>>([]);
  const focusSelectedMode = (event: GamepadEvent): void => {
    moveCommunityFocus(
      event,
      model?.modeLabel === "Hardcore" ? hardcoreModeRef.current : casualModeRef.current,
    );
  };
  const focusLatestMaster = (event: GamepadEvent, index: number): void => {
    moveCommunityFocus(event, latestMasterRefs.current[index]);
  };
  const handleCasualDirection = (event: GamepadEvent): void => {
    if (event.detail.button !== GamepadButton.DIR_RIGHT) return;
    moveCommunityFocus(event, hardcoreModeRef.current ?? latestMasterRefs.current[0]);
  };
  const handleHardcoreDirection = (event: GamepadEvent): void => {
    if (event.detail.button === GamepadButton.DIR_LEFT) {
      moveCommunityFocus(event, casualModeRef.current);
    } else if (event.detail.button === GamepadButton.DIR_RIGHT) {
      focusLatestMaster(event, 0);
    }
  };
  const handleLatestMasterDirection = (event: GamepadEvent, index: number): void => {
    if (event.detail.button === GamepadButton.DIR_LEFT) {
      focusSelectedMode(event);
    } else if (event.detail.button === GamepadButton.DIR_UP) {
      focusLatestMaster(event, index - 1);
    } else if (event.detail.button === GamepadButton.DIR_DOWN) {
      focusLatestMaster(event, index + 1);
    }
  };
  if (model === undefined && !hasLatestMasters) return <></>;
  return (
    <Section
      availableOffline
      data-achievement-companion-native-community="true"
    >
      <Body>
        <style>{LATEST_MASTER_FOCUS_STYLES}</style>
        <div
          style={{
            width: "min(1060px, 100%)",
            margin: 0,
            paddingTop: 12,
            display: "grid",
            gridTemplateColumns: model !== undefined && hasLatestMasters ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 520px)",
            gap: 20,
            color: palette.text,
          }}
        >
          {model !== undefined && <div style={{ minWidth: 0 }}>
            <div style={{ minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ color: palette.text, fontSize: 18, fontWeight: 650, whiteSpace: "nowrap" }}>Playtime Stats</div>
              <Focusable
                role="tablist"
                aria-label="Playtime Stats mode"
                flow-children="left-right"
                tabIndex={-1}
                style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, minWidth: 0 }}
              >
                {models.casual !== undefined && (
                  <CommunityModeButton
                    label="Casual"
                    selected={model.modeLabel === "Casual"}
                    onActivate={() => { setSelectedMode("casual"); }}
                    elementRef={casualModeRef}
                    onGamepadDirection={handleCasualDirection}
                  />
                )}
                {models.hardcore !== undefined && (
                  <CommunityModeButton
                    label="Hardcore"
                    selected={model.modeLabel === "Hardcore"}
                    onActivate={() => { setSelectedMode("hardcore"); }}
                    elementRef={hardcoreModeRef}
                    onGamepadDirection={handleHardcoreDirection}
                  />
                )}
              </Focusable>
            </div>
            <div style={{ height: COMMUNITY_PANEL_BODY_HEIGHT, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 8, background: palette.panel }}>
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {model.rows.map((row, index) => {
              const caption = playerCaption(row);
              const duration = formatRetroAchievementsCommunityDuration(row.medianSeconds);
              return (
                <div
                  key={row.id}
                  style={{
                    flex: "1 1 0",
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "52px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 14px",
                    background: index % 2 === 0 ? palette.row : "transparent",
                    borderBottom: index < model.rows.length - 1 ? `1px solid ${palette.rule}` : undefined,
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 25, fontWeight: 700, ...milestoneTone(row) }}>
                    <MilestoneIcon row={row} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: palette.text, fontSize: 17, lineHeight: 1.2, fontWeight: 500 }}>{row.label}</div>
                    {caption !== undefined && <div style={{ marginTop: 4, color: palette.muted, fontSize: 15, lineHeight: 1.2 }}>{caption}</div>}
                  </div>
                  {duration !== undefined && (
                    <div style={{ minWidth: 120, textAlign: "right" }}>
                      <div style={{ color: palette.text, fontSize: 19, lineHeight: 1.1, fontWeight: 650 }}>{duration}</div>
                      <div style={{ marginTop: 4, color: palette.muted, fontSize: 13 }}>median time</div>
                    </div>
                  )}
                </div>
              );
              })}
              </div>
            {model.achievementsAvailableSince !== undefined && (
              <div style={{ padding: "12px 16px", color: palette.muted, textAlign: "center", fontSize: 14, borderTop: `1px solid ${palette.rule}` }}>
                Achievements available since {formatAvailabilityDate(model.achievementsAvailableSince)}
              </div>
            )}
            </div>
          </div>}
          {hasLatestMasters && <div style={{ minWidth: 0 }}>
            <div style={{ minHeight: 38, display: "flex", alignItems: "center", color: palette.text, fontSize: 18, fontWeight: 650 }}>
              Latest Masters
            </div>
            <div data-achievement-companion-native-community-masters-scroll="true" style={{ height: COMMUNITY_PANEL_BODY_HEIGHT, overflowY: "auto", overflowX: "hidden", borderRadius: 8, background: palette.panel, scrollbarWidth: "thin", scrollPaddingTop: 36 }}>
              <div data-achievement-companion-native-community-masters-header="true" style={{ position: "sticky", top: 0, zIndex: 1, minHeight: 30, display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) 96px", alignItems: "center", gap: 8, padding: "4px 10px", color: palette.muted, background: "rgba(10, 14, 18, 0.96)", borderBottom: `1px solid ${palette.rule}`, boxSizing: "border-box", fontSize: 12, fontWeight: 650 }}>
                <span style={{ textAlign: "right" }}>#</span>
                <span>User</span>
                <span style={{ textAlign: "right" }}>Mastered</span>
              </div>
              {visibleLatestMasters.map((master, index) => (
                <LatestMasterRow
                  key={master.userUlid ?? `${master.username}:${master.masteredAt}`}
                  master={master}
                  index={index}
                  elementRef={(element) => { latestMasterRefs.current[index] = element; }}
                  onGamepadDirection={(event) => { handleLatestMasterDirection(event, index); }}
                />
              ))}
            </div>
          </div>
          }
        </div>
      </Body>
    </Section>
  );
}
