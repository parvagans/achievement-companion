import { Focusable, Navigation } from "@decky/ui";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import {
  groupNativeRetroAchievementsActivityItems,
  type NativeRetroAchievementsActivityItem,
} from "./decky-native-retroachievements-activity-model";
import { buildDeckyNativeSteamAchievementsRoute } from "./decky-game-page-achievement-route";

const MAX_EVENT_ACHIEVEMENTS = 7;
const visibleDaysByApp = new Map<number, number>();

export interface NativeSteamActivityStyles {
  readonly AppActivityDay?: string;
  readonly AppActivityDate?: string;
  readonly Rule?: string;
  readonly Event?: string;
  readonly EventHeadline?: string;
  readonly EventActorAvatar?: string;
  readonly SpanEvent?: string;
  readonly ActorName?: string;
  readonly EventBody?: string;
  readonly ActivityAchievementUnlocked?: string;
  readonly PrimaryAchievement?: string;
  readonly AchievementRemainder?: string;
  readonly AchievementHoverContainer?: string;
  readonly Icon?: string;
  readonly TextSection?: string;
  readonly Name?: string;
  readonly Desc?: string;
  readonly Achieved?: string;
  readonly Featured?: string;
}

const tileStyle: CSSProperties = {
  alignItems: "center",
  boxSizing: "border-box",
  color: "#dcdedf",
  display: "flex",
  flex: "0 0 33%",
  gap: 4,
  minHeight: 84,
  minWidth: 0,
  maxWidth: "33%",
  padding: "6px 10px 6px 6px",
  margin: 6,
};

function unlockLabel(item: NativeRetroAchievementsActivityItem): string {
  const mode = item.achievement.unlockMode;
  return "Unlocked " + new Date(item.unlockedAt).toLocaleString()
    + (mode === "hardcore" ? " · Hardcore" : mode === "softcore" ? " · Softcore" : "");
}

function ActivityAchievement({
  item, appId, styles,
}: {
  readonly item: NativeRetroAchievementsActivityItem;
  readonly appId: number;
  readonly styles: NativeSteamActivityStyles | undefined;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const open = (): void => Navigation.Navigate(buildDeckyNativeSteamAchievementsRoute(appId));
  const details = unlockLabel(item);
  const onFocused = (element: HTMLElement): void => {
    setFocused(true);
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return (
    <Focusable
      className={[styles?.PrimaryAchievement, styles?.Achieved, styles?.Featured].filter(Boolean).join(" ")}
      role="link"
      aria-label={item.achievement.title + ", " + details + ". View achievements"}
      title={details}
      onOKActionDescription="View Achievements"
      onActivate={open}
      onClick={open}
      onFocus={(event) => onFocused(event.currentTarget)}
      onGamepadFocus={(event) => onFocused(event.currentTarget as HTMLElement)}
      onBlur={() => setFocused(false)}
      onGamepadBlur={() => setFocused(false)}
      style={{
        ...tileStyle,
        background: focused ? "rgba(172,178,201,.1411764706)" : "transparent",
      }}
      data-achievement-companion-ra-activity-id={item.achievement.achievementId}
    >
      <span className={styles?.AchievementHoverContainer} style={{ flex: "0 0 64px", height: 64 }}>
        {item.achievement.badgeImageUrl ? (
          <img className={styles?.Icon} src={item.achievement.badgeImageUrl} alt="" style={{ height: 64, objectFit: "contain", width: 64 }} />
        ) : <span aria-hidden="true" style={{ background: "#343842", display: "block", height: 64, width: 64 }} />}
      </span>
      <span className={styles?.TextSection} style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <span className={styles?.Name} style={{ color: "rgba(255,255,255,.878)", fontSize: 14, fontWeight: 300, lineHeight: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.achievement.title}
        </span>
        {item.achievement.description ? (
          <span className={styles?.Desc} style={{ color: "rgba(255,255,255,.502)", display: "-webkit-box", fontSize: 13, fontWeight: 300, lineHeight: "16px", overflow: "hidden", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>
            {item.achievement.description}
          </span>
        ) : null}
      </span>
    </Focusable>
  );
}

function ActivityRemainder({ appId, count, styles }: {
  readonly appId: number;
  readonly count: number;
  readonly styles: NativeSteamActivityStyles | undefined;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const open = (): void => Navigation.Navigate(buildDeckyNativeSteamAchievementsRoute(appId));
  return (
    <Focusable
      className={styles?.AchievementRemainder}
      role="link"
      aria-label={String(count) + " more achievements. View achievements"}
      onOKActionDescription="View Achievements"
      onActivate={open}
      onClick={open}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onGamepadBlur={() => setFocused(false)}
      style={{
        ...tileStyle,
        background: focused ? "rgba(172,178,201,.1411764706)" : "rgba(172,178,201,.08)",
        fontSize: 14,
        justifyContent: "center",
      }}
    >
      +{count} more achievements
    </Focusable>
  );
}

function ActivityDay({ dayKey, items, appId, actorName, actorAvatarUrl, styles }: {
  readonly dayKey: string;
  readonly items: readonly NativeRetroAchievementsActivityItem[];
  readonly appId: number;
  readonly actorName: string | undefined;
  readonly actorAvatarUrl: string | undefined;
  readonly styles: NativeSteamActivityStyles | undefined;
}): JSX.Element {
  const shown = items.slice(0, MAX_EVENT_ACHIEVEMENTS);
  const hiddenCount = items.length - shown.length;
  const date = new Date(items[0]!.unlockedAt).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <div className={styles?.AppActivityDay} role="region" aria-label={date} data-achievement-companion-ra-activity-day={dayKey} style={{ marginBottom: 16, minWidth: 0, paddingTop: 4 }}>
      <h4 className={styles?.AppActivityDate} style={{ alignItems: "center", color: "#8a8a8a", display: "flex", fontSize: 14, fontWeight: 400, letterSpacing: 1, margin: "0 0 4px", textTransform: "uppercase" }}>
        {date}
        <span className={styles?.Rule} aria-hidden="true" style={{ background: "linear-gradient(to left, rgba(255,255,255,.15), rgba(255,255,255,.03))", flex: "1 1 auto", height: 1, marginInlineStart: 8 }} />
      </h4>
      <div className={styles?.Event} style={{ fontSize: 13, minWidth: 0 }}>
        <div className={styles?.EventHeadline} style={{ alignItems: "center", background: "rgba(172,178,201,.1411764706)", boxSizing: "border-box", display: "flex", height: 44, padding: 4 }}>
          {actorName && actorAvatarUrl ? (
            <img className={styles?.EventActorAvatar} src={actorAvatarUrl} alt="" style={{ boxSizing: "border-box", height: 36, objectFit: "cover", width: 36 }} />
          ) : actorName ? (
            <div className={styles?.EventActorAvatar} aria-hidden="true" style={{ alignItems: "center", background: "#20252d", color: "#9cc9df", display: "flex", fontSize: 16, height: 36, justifyContent: "center", width: 36 }}>
              {actorName.slice(0, 1).toUpperCase()}
            </div>
          ) : null}
          <span className={styles?.SpanEvent} style={{ color: "#8f939c", fontSize: 14, lineHeight: "16px", margin: "0 8px" }}>
            {actorName ? <><span className={styles?.ActorName} style={{ color: "#a9d4e9" }}>{actorName}</span> achieved</> : "Achievements unlocked"}
          </span>
        </div>
        <div className={styles?.EventBody} style={{ background: "rgba(172,178,201,.1411764706)", boxShadow: "inset 0 7px 10px rgba(0,0,0,.15)", minWidth: 0 }}>
          <Focusable
            className={styles?.ActivityAchievementUnlocked}
            flow-children="left-right"
            tabIndex={-1}
            noFocusRing
            style={{ alignItems: "center", display: "flex", minWidth: 0, overflowX: "auto", overflowY: "hidden", padding: 12, scrollbarWidth: "none" }}
          >
            {shown.map((item) => <ActivityAchievement key={item.achievement.achievementId} item={item} appId={appId} styles={styles} />)}
            {hiddenCount > 0 ? <ActivityRemainder appId={appId} count={hiddenCount} styles={styles} /> : null}
          </Focusable>
        </div>
      </div>
    </div>
  );
}

export function DeckyNativeRetroAchievementsActivity({
  items, appId, actorName, actorAvatarUrl, styles,
}: {
  readonly items: readonly NativeRetroAchievementsActivityItem[];
  readonly appId: number;
  readonly actorName?: string | undefined;
  readonly actorAvatarUrl?: string | undefined;
  readonly styles?: NativeSteamActivityStyles | undefined;
}): JSX.Element {
  const days = useMemo(() => groupNativeRetroAchievementsActivityItems(items), [items]);
  const [visibleDays, setVisibleDays] = useState(() => visibleDaysByApp.get(appId) ?? 1);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleDays(visibleDaysByApp.get(appId) ?? 1); }, [appId]);
  useEffect(() => {
    const target = revealRef.current;
    if (target === null || visibleDays >= days.length) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisibleDays(days.length);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleDays((count) => {
        const next = Math.min(count + 1, days.length);
        visibleDaysByApp.set(appId, next);
        return next;
      });
    }, { rootMargin: "0px 0px 180px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [appId, days.length, visibleDays]);

  return (
    <section data-achievement-companion-ra-activity="true" style={{ boxSizing: "border-box", marginBottom: 16, minWidth: 0, paddingInline: 10, width: "100%" }}>
      {days.slice(0, visibleDays).map((day) => (
        <ActivityDay key={day.dayKey} dayKey={day.dayKey} items={day.items} appId={appId} actorName={actorName} actorAvatarUrl={actorAvatarUrl} styles={styles} />
      ))}
      {visibleDays < days.length ? <div ref={revealRef} aria-hidden="true" style={{ height: 1 }} /> : null}
    </section>
  );
}
