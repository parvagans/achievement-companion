import { Focusable, Navigation } from "@decky/ui";
import { useState, type CSSProperties, type JSX } from "react";
import type { NativeRetroAchievementsActivityItem } from "./decky-native-retroachievements-activity-model";
import { buildDeckyNativeSteamAchievementsRoute } from "./decky-game-page-achievement-route";

const cardStyle: CSSProperties = {
  alignItems: "center",
  background: "linear-gradient(90deg, rgba(41, 65, 84, 0.95), rgba(27, 40, 53, 0.95))",
  borderRadius: 3,
  boxSizing: "border-box",
  color: "#dcdedf",
  display: "flex",
  gap: 12,
  minHeight: 70,
  padding: "9px 12px",
  width: "100%",
};

function ActivityCard({ item, appId }: { readonly item: NativeRetroAchievementsActivityItem; readonly appId: number }): JSX.Element {
  const [focused, setFocused] = useState(false);
  const { achievement, unlockedAt } = item;
  const openAchievements = (): void => Navigation.Navigate(buildDeckyNativeSteamAchievementsRoute(appId));

  return (
    <Focusable
      role="button"
      aria-label={`${achievement.title}, RetroAchievements achievement unlocked ${new Date(unlockedAt).toLocaleString()}`}
      onActivate={openAchievements}
      onClick={openAchievements}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      noFocusRing
      style={{
        ...cardStyle,
        outline: focused ? "2px solid #66c0f4" : "none",
        outlineOffset: 1,
      }}
      data-achievement-companion-ra-activity-id={achievement.achievementId}
    >
      {achievement.badgeImageUrl ? (
        <img src={achievement.badgeImageUrl} alt="" style={{ width: 48, height: 48, flexShrink: 0, objectFit: "contain" }} />
      ) : null}
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {achievement.title}
        </span>
        {achievement.description ? (
          <span style={{ fontSize: 12, opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {achievement.description}
          </span>
        ) : null}
        <span style={{ color: "#a4d007", fontSize: 11 }}>
          Unlocked {new Date(unlockedAt).toLocaleString()}
          {achievement.unlockMode === "hardcore" ? " · Hardcore" : achievement.unlockMode === "softcore" ? " · Softcore" : ""}
        </span>
      </span>
    </Focusable>
  );
}

export function DeckyNativeRetroAchievementsActivity({
  items,
  appId,
}: {
  readonly items: readonly NativeRetroAchievementsActivityItem[];
  readonly appId: number;
}): JSX.Element {
  return (
    <section data-achievement-companion-ra-activity="true" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      <div style={{ alignItems: "baseline", display: "flex", gap: 10, marginBottom: 3 }}>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, textTransform: "uppercase" }}>Activity</span>
        <span style={{ color: "#8f98a0", fontSize: 12 }}>Recent RetroAchievements</span>
      </div>
      {items.map((item) => <ActivityCard key={item.achievement.achievementId} item={item} appId={appId} />)}
    </section>
  );
}
