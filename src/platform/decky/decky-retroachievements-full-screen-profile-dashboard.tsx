import { Focusable, GamepadButton, NavEntryPositionPreferences, type GamepadEvent } from "@decky/ui";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import calendarIconUrl from "./assets/calendar.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { DeckySystemIcon } from "./decky-system-pill";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { raRecipes, raTheme } from "./ra-theme";
import { formatProfileMemberSince } from "./decky-stat-helpers";
import { DeckyRetroAchievementsRankTrendIndicator } from "./decky-ra-rank-trend-indicator";

type Model = ReturnType<typeof import("./decky-retroachievements-full-screen-profile-data").buildRetroAchievementsFullScreenProfileModel>;

function pageStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px calc(env(safe-area-inset-bottom, 0px) + 48px)",
    boxSizing: "border-box",
    overflow: "hidden",
    color: raTheme.color.textPrimary,
    background: raTheme.surface.page,
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    flex: "1 1 auto",
    overflow: "hidden",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gridTemplateRows: "minmax(0, 1fr)",
    gridTemplateAreas: '"profile profile systems systems systems systems"',
    alignItems: "stretch",
    gap: 6,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
  };
}

function panelStyle(area: string): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    gridArea: area,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    padding: 12,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function systemsPanelStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    gridArea: "systems",
    alignSelf: "start",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    padding: 12,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function systemsRailStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "0 0 auto",
    gap: 8,
    minWidth: 0,
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
    paddingBottom: 2,
    boxSizing: "border-box",
  };
}

function systemsRailViewportStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr) 28px",
    alignItems: "center",
    columnGap: 4,
    minWidth: 0,
    width: "100%",
  };
}

function systemsRailArrowStyle(visible: boolean): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 28,
    height: 34,
    border: `1px solid ${raTheme.color.borderStrong}`,
    borderRadius: raTheme.radius.small,
    background: "rgba(6, 27, 42, 0.94)",
    color: raTheme.color.accent,
    fontSize: 20,
    fontWeight: 850,
    lineHeight: 1,
    pointerEvents: "none",
    visibility: visible ? "visible" : "hidden",
    boxSizing: "border-box",
  };
}

function systemCardStyle(focused: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: 10,
    rowGap: 8,
    flex: "0 0 calc((100% - 16px) / 3)",
    minWidth: 0,
    minHeight: 100,
    padding: "8px 10px",
    border: `1px solid ${raTheme.color.borderSubtle}`,
    borderRadius: raTheme.radius.medium,
    background: focused ? raTheme.focus.compactBackground : raTheme.surface.interactive,
    borderColor: focused ? raTheme.focus.compactBorder : raTheme.color.borderSubtle,
    boxShadow: focused ? raTheme.focus.compactShadow : "none",
    outline: "none",
    boxSizing: "border-box",
  };
}

function scrollSystemCardIntoView(target: HTMLElement): void {
  const rail = target.closest<HTMLElement>("[data-ra-profile-system-rail]");
  if (rail === null) return;

  const left = target.offsetLeft;
  const right = left + target.offsetWidth;
  const visibleLeft = rail.scrollLeft;
  const visibleRight = rail.scrollLeft + rail.clientWidth;
  if (left < visibleLeft) {
    rail.scrollLeft = Math.max(0, left);
  } else if (right > visibleRight) {
    rail.scrollLeft = right - rail.clientWidth;
  }
}

function SystemCard({
  system,
  index,
  onFocused,
  onExitLeft,
  onMoveRight,
}: {
  readonly system: Model["systems"][number];
  readonly index: number;
  readonly onFocused: (index: number, target: HTMLElement) => void;
  readonly onExitLeft: (() => boolean) | undefined;
  readonly onMoveRight: (() => boolean) | undefined;
}): JSX.Element {
  const focusCard = (target: EventTarget | null): void => {
    if (target instanceof HTMLElement) onFocused(index, target);
  };
  const handleBoundaryDirection = (event: GamepadEvent): void => {
    const moved = event.detail.button === GamepadButton.DIR_LEFT
      ? onExitLeft?.()
      : event.detail.button === GamepadButton.DIR_RIGHT
        ? onMoveRight?.()
        : false;
    if (moved !== true) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      focusClassName="achievement-companion-ra-profile-system--focused"
      focusWithinClassName="achievement-companion-ra-profile-system--focused"
      aria-label={`${system.title}, ${system.unlockedAchievements.toLocaleString()} unlocked achievements`}
      data-ra-profile-system={system.systemId}
      onActivate={() => {}}
      onClick={() => {}}
      onFocus={(event) => focusCard(event.currentTarget)}
      onGamepadFocus={(event) => focusCard(event.currentTarget)}
      {...(index === 0 ? { onGamepadDirection: handleBoundaryDirection } : {})}
      style={systemCardStyle(false)}
    >
      <div style={{ gridColumn: "1 / -1", minWidth: 0, color: raTheme.color.textSecondary, fontSize: 12, fontWeight: 700, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{system.title}</div>
      <div style={{ width: 48, height: 40, display: "grid", placeItems: "center", minWidth: 0, minHeight: 0 }}>
        {system.iconUrl !== undefined
          ? <DeckySystemIcon iconSize={44} iconUrl={system.iconUrl} />
          : <img alt="" src={gamepadIconUrl} style={{ width: 32, height: 32, filter: raTheme.iconFilter.primary }} />}
      </div>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ color: raTheme.color.textPrimary, fontSize: 22, fontWeight: 850, lineHeight: 1.05 }}>{system.unlockedAchievements.toLocaleString()}</div>
        <div style={{ color: raTheme.color.textMuted, fontSize: 10, lineHeight: 1.1 }}>unlocked achievements</div>
      </div>
      <div style={{ gridColumn: "1 / -1", height: 8, overflow: "hidden", borderRadius: 999, background: "rgba(76, 125, 157, 0.28)" }}>
        <div style={{ width: `${system.completionPercent ?? 0}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${raTheme.color.accentStrong}, ${raTheme.color.accent})` }} />
      </div>
    </Focusable>
  );
}

function formatRefreshTime(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayLabel = startOfDate === startOfToday
    ? "Today"
    : startOfDate === startOfToday - 86_400_000
      ? "Yesterday"
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Last sync • ${dayLabel}, ${timeLabel}`;
}

function profileFactStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr)",
    alignItems: "center",
    gap: 8,
    color: raTheme.color.textSecondary,
    fontSize: "0.77em",
    lineHeight: 1.2,
  };
}

function profileFactIconStyle(tone: "blue" | "gold"): CSSProperties {
  return {
    width: 16,
    height: 16,
    flexShrink: 0,
    filter: tone === "gold" ? raTheme.iconFilter.hardcore : raTheme.iconFilter.primary,
  };
}

function ProfileFact({ iconUrl, tone = "blue", children }: { readonly iconUrl: string; readonly tone?: "blue" | "gold"; readonly children: ReactNode }): JSX.Element {
  return (
    <div style={profileFactStyle()}>
      <img alt="" src={iconUrl} style={profileFactIconStyle(tone)} />
      <span>{children}</span>
    </div>
  );
}

function ProfileStat({ label, value, icon }: { readonly label: string; readonly value: string; readonly icon?: JSX.Element }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: raTheme.color.textSecondary, fontSize: 14, lineHeight: 1.2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{icon}{label}</span>
      <span style={{ color: raTheme.color.textPrimary, fontWeight: 750, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function DeckyRetroAchievementsFullScreenProfileDashboard({
  model,
  isActive,
  onOpenExternalUrl,
  refreshedAt,
}: {
  readonly model: Model;
  readonly isActive: boolean;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const profileActionRef = useRef<HTMLDivElement>(null);
  const systemsRailRef = useRef<HTMLDivElement>(null);
  const leftSystemsArrowRef = useRef<HTMLSpanElement>(null);
  const rightSystemsArrowRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!isActive) return;
    const root = rootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || root === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const target = root.querySelector<HTMLElement>("[role='button']");
      if (target !== null && !root.contains(root.ownerDocument.activeElement)) takeDeckySteamGamepadFocus(target);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  useLayoutEffect(() => {
    const rail = systemsRailRef.current;
    const ownerWindow = rail?.ownerDocument.defaultView;
    if (!isActive || rail === null || ownerWindow === null || ownerWindow === undefined) return;
    const syncArrowVisibility = (): void => {
      const cards = [...rail.querySelectorAll<HTMLElement>("[data-ra-profile-system]")];
      const focusedIndex = cards.findIndex((card) => card.classList.contains("gpfocus"));
      if (leftSystemsArrowRef.current !== null) {
        leftSystemsArrowRef.current.style.visibility = cards.length > 1 && focusedIndex > 0 ? "visible" : "hidden";
      }
      if (rightSystemsArrowRef.current !== null) {
        rightSystemsArrowRef.current.style.visibility = cards.length > 1 && focusedIndex < cards.length - 1 ? "visible" : "hidden";
      }
    };
    const observer = new ownerWindow.MutationObserver(syncArrowVisibility);
    observer.observe(rail, { attributes: true, attributeFilter: ["class"], subtree: true });
    syncArrowVisibility();
    return () => observer.disconnect();
  }, [isActive, model.systems.length]);

  const memberSince = formatProfileMemberSince(model.profile.metrics, { month: "long" });
  const refreshTime = formatRefreshTime(refreshedAt);
  const selectedRank = model.ranks[0];
  const avatarUrl = addProfileAvatarCacheBustParam(model.profile.identity.avatarUrl, refreshedAt);
  const profileUrl = model.profile.identity.profileUrl
    ?? `https://retroachievements.org/user/${encodeURIComponent(model.profile.identity.displayName)}`;
  const focusProfileAction = (): boolean => takeDeckySteamGamepadFocus(
    profileActionRef.current?.querySelector<HTMLElement>("[role='button']"),
  );
  const focusSecondSystem = (): boolean => takeDeckySteamGamepadFocus(
    rootRef.current?.querySelectorAll<HTMLElement>("[data-ra-profile-system]")[1],
  );
  const handleSystemFocused = (_index: number, target: HTMLElement): void => scrollSystemCardIntoView(target);
  return (
    <main ref={rootRef} data-ac-ra-theme="fullscreen" data-ra-full-screen-profile-dashboard style={pageStyle()}>
      <DeckyFocusStyles />
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={gridStyle()}>
        <section style={panelStyle("profile")}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0, textAlign: "center" }}>
            <div style={{ width: 144, height: 144, flex: "0 0 144px", display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${raTheme.color.accent}`, borderRadius: 22, overflow: "hidden", background: "linear-gradient(145deg, rgba(54, 185, 255, 0.22), rgba(5, 22, 34, 0.96))", boxShadow: "0 0 18px rgba(54, 185, 255, 0.26)", boxSizing: "border-box" }}>
              {avatarUrl !== undefined
                ? <img alt="" src={avatarUrl} style={{ width: 138, height: 138, objectFit: "cover" }} />
                : <span style={{ color: raTheme.color.textPrimary, fontSize: "3em", fontWeight: 850, letterSpacing: "0.04em" }}>{model.profile.identity.displayName.slice(0, 2).toUpperCase()}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: "clamp(1.35rem, 2.2vw, 1.9rem)", fontWeight: 850, lineHeight: 1.08, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{model.profile.identity.displayName}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: raTheme.color.accent, fontSize: "0.82em", fontWeight: 700 }}><span aria-hidden="true" style={{ width: 9, height: 9, flexShrink: 0, borderRadius: 999, backgroundColor: "#20e889", boxShadow: "0 0 10px rgba(32, 232, 137, 0.46)" }} />RA account</div>
            </div>
          </div>
          <div style={{ height: 1, flexShrink: 0, backgroundColor: raTheme.color.borderSubtle }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", minWidth: 0 }}>
            {memberSince !== undefined ? <ProfileFact iconUrl={calendarIconUrl}>{`Member since ${memberSince}`}</ProfileFact> : null}
            {selectedRank !== undefined ? <ProfileFact iconUrl={trophyIconUrl} tone="gold"><DeckyRetroAchievementsRankTrendIndicator accountId={model.profile.identity.accountId} kind={selectedRank.kind} />{`${selectedRank.label} ${selectedRank.value}`}</ProfileFact> : null}
          </div>
          <div ref={profileActionRef} data-ra-profile-external-action>
            <DeckyFullscreenActionButton
              fullWidth
              contentAlign="left"
              icon={<img alt="" src={externalLinkIconUrl} style={{ width: 17, height: 17, filter: raTheme.iconFilter.primary }} />}
              label="View on RetroAchievements"
              onClick={() => onOpenExternalUrl(profileUrl)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${raTheme.color.borderSubtle}`, boxSizing: "border-box" }}>
            <ProfileStat label="Mastered Games" value={model.profileStats.mastered ?? "-"} />
            <ProfileStat label="Beaten Games" value={model.profileStats.beaten ?? "-"} />
            <ProfileStat icon={<DeckyRetroAchievementsPointsIcon size={14} />} label="Points Earned" value={model.profileStats.hardcorePoints ?? "-"} />
            <ProfileStat icon={<DeckyRetroAchievementsPointsIcon size={14} />} label="RetroPoints" value={model.profileStats.raPoints ?? "-"} />
          </div>
        </section>
        {model.systems.length > 0 ? (
          <Focusable
            flow-children="vertical"
            noFocusRing
            tabIndex={-1}
            style={systemsPanelStyle()}
            data-ra-profile-systems
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <img alt="" src={gamepadIconUrl} style={{ width: 24, height: 24, filter: raTheme.iconFilter.primary }} />
                <div style={{ color: raTheme.color.textPrimary, fontSize: 17, fontWeight: 850, letterSpacing: "0.08em", lineHeight: 1.1 }}>SYSTEMS</div>
              </div>
              <div style={{ color: raTheme.color.textSecondary, fontSize: 12, lineHeight: 1.2, textAlign: "right" }}>Top systems by unlocked achievements</div>
            </div>
            <div style={systemsRailViewportStyle()}>
              <span ref={leftSystemsArrowRef} aria-hidden="true" data-ra-profile-system-arrow="left" style={systemsRailArrowStyle(false)}>←</span>
              <Focusable
                ref={systemsRailRef}
                flow-children="left-right"
                navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
                noFocusRing
                tabIndex={-1}
                style={systemsRailStyle()}
                aria-label="Systems"
                data-ra-profile-system-rail
              >
                {model.systems.map((system, index) => (
                  <SystemCard
                    key={system.systemId}
                    index={index}
                    onFocused={handleSystemFocused}
                    onExitLeft={index === 0 ? focusProfileAction : undefined}
                    onMoveRight={index === 0 && model.systems.length > 1 ? focusSecondSystem : undefined}
                    system={system}
                  />
                ))}
              </Focusable>
              <span ref={rightSystemsArrowRef} aria-hidden="true" data-ra-profile-system-arrow="right" style={systemsRailArrowStyle(model.systems.length > 1)}>→</span>
            </div>
          </Focusable>
        ) : null}
      </Focusable>
      {refreshTime !== undefined ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, flex: "0 0 auto", width: "100%", minWidth: 0 }}>
          <div style={{ gridColumn: "1 / span 2", padding: "0 12px", boxSizing: "border-box", color: raTheme.color.textMuted, fontSize: 12, textAlign: "left" }}>{refreshTime}</div>
        </div>
      ) : null}
    </main>
  );
}
