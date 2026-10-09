import type { CSSProperties } from "react";
import calendarIconUrl from "./assets/calendar.svg";
import usersIconUrl from "./assets/users.svg";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { raTheme } from "./ra-theme";

function getGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 6,
  };
}

export function DeckyRetroAchievementsSetDetails({
  details,
}: {
  readonly details: readonly DeckyFullScreenGameMetadataPill[];
}): JSX.Element | null {
  if (details.length === 0) {
    return null;
  }

  const iconByKey: Readonly<Record<string, { readonly src?: string; readonly filter?: string; readonly points?: boolean }>> = {
    "total-players": { src: usersIconUrl, filter: raTheme.iconFilter.primary },
    "game-release-date": { src: calendarIconUrl, filter: raTheme.iconFilter.primary },
    points: { points: true },
    "retro-points": { points: true },
  };

  return (
    <DeckyFullScreenGameSpotlightCard
      title="Set Details"
      focusable={false}
      style={{ gap: 6, padding: 8, borderRadius: 14, background: raTheme.surface.gameOverviewCard }}
    >
      <div style={getGridStyle()}>
        {details.map((detail) => {
          const icon = iconByKey[detail.key];
          return (
            <DeckyFullScreenGameProgressStat
              dense
              themeVariant="ra"
              key={detail.key}
              label={detail.label}
              value={detail.value}
              {...(icon !== undefined
                ? { icon: icon.points ? <DeckyRetroAchievementsPointsIcon /> : <img alt="" aria-hidden="true" src={icon.src} style={{ width: 15, height: 15, objectFit: "contain", filter: icon.filter }} /> }
                : {})}
            />
          );
        })}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
