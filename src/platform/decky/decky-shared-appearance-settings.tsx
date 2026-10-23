import { Focusable, type GamepadEvent } from "@decky/ui";
import { useState } from "react";
import {
  ACHIEVEMENT_COMPANION_THEME_OPTIONS,
  GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS,
  GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS,
  GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_OPTIONS,
  type AchievementCompanionTheme,
  type GamePageAchievementBadgeColor,
  type GamePageAchievementBadgeColors,
  type GamePageAchievementBadgePosition,
} from "@core/settings";
import { DeckySettingsDropdown } from "./decky-settings-dropdown";
import { DeckySettingsToggleRow } from "./decky-settings-controls";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import { steamTheme } from "./steam-theme";

const HIDDEN_THEME_OPTIONS: readonly AchievementCompanionTheme[] = ["ac-dune", "ac-pocket-lcd"];
const THEME_LABELS: Readonly<Partial<Record<AchievementCompanionTheme, string>>> = {
  "ac-blue": "Blue (Default)",
  "ac-pocket-lcd": "Pocket LCD",
  "ac-ra-classic": "RA Classic",
};
const POSITION_LABELS: Readonly<Record<GamePageAchievementBadgePosition, string>> = {
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right",
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function themeLabel(theme: AchievementCompanionTheme): string {
  return THEME_LABELS[theme] ?? titleCase(theme.slice(3));
}

export function DeckySharedAppearanceSettings({ onGamepadDirection }: {
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const [badgeDetailsOpen, setBadgeDetailsOpen] = useState(false);
  const themeOptions = ACHIEVEMENT_COMPANION_THEME_OPTIONS.filter(
    (theme) => !HIDDEN_THEME_OPTIONS.includes(theme) || theme === settings.theme,
  );
  const updateBadgeColor = (status: keyof GamePageAchievementBadgeColors, color: GamePageAchievementBadgeColor): void => {
    const current = readDeckySettings();
    void saveDeckySettings({ ...current, gamePageAchievementBadgeColors: { ...current.gamePageAchievementBadgeColors, [status]: color } });
  };

  return <div data-ac-shared-appearance-settings style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <DeckySettingsDropdown label="Theme" value={settings.theme} options={themeOptions} formatOption={themeLabel} onChange={(theme) => { void saveDeckySettings({ ...readDeckySettings(), theme }); }} onGamepadDirection={onGamepadDirection} />
    <DeckySettingsToggleRow label="Show game page badge" description="Show achievement progress on Steam and non-Steam game pages." checked={settings.showGamePageAchievementBadge} onChange={(showGamePageAchievementBadge) => { void saveDeckySettings({ ...readDeckySettings(), showGamePageAchievementBadge }); }} onGamepadDirection={onGamepadDirection} />
    <Focusable className="ac-settings-action" noFocusRing role="button" tabIndex={settings.showGamePageAchievementBadge ? 0 : -1} aria-disabled={!settings.showGamePageAchievementBadge} aria-expanded={badgeDetailsOpen && settings.showGamePageAchievementBadge} aria-label={`Badge appearance, ${badgeDetailsOpen && settings.showGamePageAchievementBadge ? "expanded" : "collapsed"}`} onActivate={() => { if (settings.showGamePageAchievementBadge) setBadgeDetailsOpen((open) => !open); }} onClick={() => { if (settings.showGamePageAchievementBadge) setBadgeDetailsOpen((open) => !open); }} onGamepadDirection={onGamepadDirection} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: steamTheme.color.textPrimary, opacity: settings.showGamePageAchievementBadge ? 1 : .55, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}>
      <span>Badge appearance</span><span style={{ color: steamTheme.color.accent }}>{badgeDetailsOpen ? "▴" : "▾"}</span>
    </Focusable>
    {badgeDetailsOpen && settings.showGamePageAchievementBadge ? <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 10, borderLeft: `2px solid ${steamTheme.color.borderSubtle}` }}>
      <DeckySettingsDropdown label="Badge size" value={settings.gamePageAchievementBadgeSize} options={GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_OPTIONS} formatOption={titleCase} disabled={!settings.showGamePageAchievementBadge} onChange={(gamePageAchievementBadgeSize) => { void saveDeckySettings({ ...readDeckySettings(), gamePageAchievementBadgeSize }); }} onGamepadDirection={onGamepadDirection} />
      <DeckySettingsDropdown label="Badge position" value={settings.gamePageAchievementBadgePosition} options={GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS} formatOption={(position) => POSITION_LABELS[position]} disabled={!settings.showGamePageAchievementBadge} onChange={(gamePageAchievementBadgePosition) => { void saveDeckySettings({ ...readDeckySettings(), gamePageAchievementBadgePosition }); }} onGamepadDirection={onGamepadDirection} />
      {(["perfected", "mastered", "beaten", "inProgress"] as const).map((status) => <DeckySettingsDropdown key={status} label={`${status === "inProgress" ? "In Progress" : titleCase(status)} color`} value={settings.gamePageAchievementBadgeColors[status]} options={GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS} formatOption={titleCase} disabled={!settings.showGamePageAchievementBadge} onChange={(color) => updateBadgeColor(status, color)} onGamepadDirection={onGamepadDirection} />)}
    </div> : null}
  </div>;
}
