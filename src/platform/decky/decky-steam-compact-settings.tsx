import { Focusable, Menu, MenuItem, showContextMenu } from "@decky/ui";
import {
  ACTIVITY_CALENDAR_WEEK_OPTIONS,
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  type ActivityCalendarWeeks,
  type AchievementCompanionCount,
} from "@core/settings";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  useDeckySteamProviderConfig,
  writeValidatedDeckySteamProviderConfig,
} from "./providers/steam/config";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import { steamRecipes, steamTheme } from "./steam-theme";

export interface DeckySteamCompactSettingsProps {
  readonly onBack: () => void;
  readonly onOpenApiSettings: () => void;
}

function getRootStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    minWidth: 0,
    padding: "0 16px 4px",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    fontFamily: steamTheme.type.fontFamily,
  };
}

function getSectionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  };
}

function getSectionTitleStyle(): CSSProperties {
  return {
    color: steamTheme.color.accent,
    fontSize: steamTheme.type.compact.heading,
    fontWeight: steamTheme.type.weight.strong,
    letterSpacing: "0.055em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
}

function getActionStyle(isFocused: boolean, emphasis: "primary" | "secondary"): CSSProperties {
  const isPrimary = emphasis === "primary";

  return {
    ...steamRecipes.action("compact", isPrimary),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: 38,
    padding: "8px 12px",
    ...(isFocused ? { border: `1px solid ${isPrimary ? steamTheme.focus.primaryBorder : steamTheme.focus.border}` } : {}),
    borderRadius: steamTheme.radius.small,
    background: isFocused
      ? isPrimary ? steamTheme.focus.primaryBackground : steamTheme.surface.focusedContentCard
      : isPrimary ? steamTheme.surface.primaryAction : steamTheme.surface.contentCard,
    boxShadow: isFocused
      ? isPrimary ? steamTheme.focus.primaryShadow : steamTheme.focus.shadow
      : "inset 0 1px 0 rgba(125, 211, 252, 0.05), 0 4px 12px rgba(0, 0, 0, 0.14)",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    cursor: "pointer",
    outline: "none",
  };
}

function getActionTitleStyle(): CSSProperties {
  return {
    display: "block",
    color: steamTheme.color.textPrimary,
    fontSize: steamTheme.type.compact.body,
    fontWeight: steamTheme.type.weight.strong,
    lineHeight: 1.1,
  };
}

function getActionDescriptionStyle(): CSSProperties {
  return {
    display: "block",
    marginTop: 3,
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: steamTheme.type.compact.metadata,
    lineHeight: 1.25,
  };
}

function getCompactSettingLabelStyle(): CSSProperties {
  return {
    color: steamTheme.color.textPrimary,
    fontSize: steamTheme.type.compact.body,
    fontWeight: steamTheme.type.weight.strong,
    lineHeight: 1.1,
  };
}

function getCompactSettingDescriptionStyle(): CSSProperties {
  return {
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: steamTheme.type.compact.metadata,
    lineHeight: 1.25,
  };
}

function getChevronStyle(): CSSProperties {
  return { width: 17, height: 17, flexShrink: 0, filter: steamTheme.iconFilter.accent };
}

function getSettingsCardStyle(): CSSProperties {
  return {
    ...steamRecipes.card("compact", "raised"),
    background: steamTheme.surface.contentCard,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.035)",
  };
}

function getCountPickerStyle(isFocused: boolean, isExpanded: boolean): CSSProperties {
  return {
    ...steamRecipes.interactiveRow("compact"),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 70,
    padding: "9px 12px",
    border: isFocused ? `1px solid ${steamTheme.color.borderStrong}` : "1px solid transparent",
    borderRadius: 7,
    background: isFocused
      ? steamTheme.surface.focusedContentStat
      : isExpanded
        ? `${steamTheme.surface.selected}, ${steamTheme.surface.contentStat}`
        : steamTheme.surface.contentStat,
    boxShadow: isFocused ? "inset 0 0 0 1px rgba(54, 185, 255, 0.48)" : "none",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    cursor: "pointer",
    outline: "none",
  };
}

function getCountPickerTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: "1 1 auto" };
}

function getCountValueStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    width: 72,
    minHeight: 38,
    flex: "0 0 72px",
    borderRadius: 4,
    background: steamTheme.surface.contentStat,
    color: steamTheme.color.textPrimary,
    fontSize: steamTheme.type.compact.heading,
    fontWeight: steamTheme.type.weight.medium,
  };
}

function getCountValueChevronStyle(): CSSProperties {
  return {
    width: 0,
    height: 0,
    borderLeft: "8px solid transparent",
    borderRight: "8px solid transparent",
    borderTop: `9px solid ${steamTheme.color.textPrimary}`,
    transform: "translateY(2px)",
  };
}

function SteamCompactSettingsAction({
  ariaLabel,
  children,
  emphasis,
  isInitialFocusTarget = false,
  onActivate,
  onCancel,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly emphasis: "primary" | "secondary";
  readonly isInitialFocusTarget?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Focusable
      autoFocus={isInitialFocusTarget}
      noFocusRing
      preferredFocus={isInitialFocusTarget}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      {...(isInitialFocusTarget
        ? { "data-achievement-companion-steam-settings-initial-focus": "true" }
        : {})}
      onActivate={onActivate}
      onClick={onActivate}
      onCancel={onCancel}
      onFocus={() => setIsFocused(true)}
      onGamepadFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={getActionStyle(isFocused, emphasis)}
    >
      {children}
    </Focusable>
  );
}

function SteamCompactCountPicker<Value extends number>({
  description,
  id,
  label,
  onBack,
  onChange,
  options,
  value,
}: {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly onBack: () => void;
  readonly onChange: (value: Value) => void;
  readonly options: readonly Value[];
  readonly value: Value;
}): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const releasePopupRef = useRef<(() => void) | undefined>(undefined);

  const closeMenu = (): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    releasePopupRef.current?.();
    releasePopupRef.current = undefined;
    setIsMenuOpen(false);
    requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };

  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) {
      return;
    }

    setIsMenuOpen(true);
    releasePopupRef.current = beginDeckyCompactPopup();
    menuRef.current = showContextMenu(
      <Menu label={label} onCancel={closeMenu}>
        {options.map((option) => (
          <MenuItem
            key={option}
            selected={value === option}
            onClick={() => {
              onChange(option);
              closeMenu();
            }}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>,
      triggerRef.current,
      { bModal: true, bMatchWidth: true },
    );
  };

  useEffect(() => () => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    releasePopupRef.current?.();
    releasePopupRef.current = undefined;
  }, []);

  return (
    <Focusable
      ref={triggerRef}
      noFocusRing
      role="button"
      tabIndex={0}
      aria-expanded={isMenuOpen}
      aria-label={`${label}: ${value}. Select to choose a count.`}
      data-achievement-companion-count-picker-trigger={id}
      onActivate={openMenu}
      onClick={openMenu}
      onCancel={onBack}
      onFocus={() => setIsFocused(true)}
      onGamepadFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={getCountPickerStyle(isFocused, isMenuOpen)}
    >
      <span style={getCountPickerTextStyle()}>
        <span style={getCompactSettingLabelStyle()}>{label}</span>
        <span style={getCompactSettingDescriptionStyle()}>{description}</span>
      </span>
      <span aria-hidden="true" style={getCountValueStyle()}>
        <span>{value}</span>
        <span style={getCountValueChevronStyle()} />
      </span>
    </Focusable>
  );
}

export function DeckySteamCompactSettings({
  onBack,
  onOpenApiSettings,
}: DeckySteamCompactSettingsProps): JSX.Element {
  const config = useDeckySteamProviderConfig(STEAM_PROVIDER_ID);
  const settings = useDeckySettings();
  const [recentAchievementsCount, setRecentAchievementsCount] = useState<AchievementCompanionCount>(
    config?.recentAchievementsCount ?? 5,
  );
  const [recentlyPlayedCount, setRecentlyPlayedCount] = useState<AchievementCompanionCount>(
    config?.recentlyPlayedCount ?? 5,
  );
  const [activityCalendarWeeks, setActivityCalendarWeeks] = useState<ActivityCalendarWeeks>(
    settings.steamCompactActivityCalendarWeeks,
  );
  const configRef = useRef(config);
  const valuesRef = useRef({
    recentAchievementsCount: config?.recentAchievementsCount ?? 5,
    recentlyPlayedCount: config?.recentlyPlayedCount ?? 5,
    activityCalendarWeeks: settings.steamCompactActivityCalendarWeeks,
  });
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const nextValues = {
      recentAchievementsCount: config?.recentAchievementsCount ?? 5,
      recentlyPlayedCount: config?.recentlyPlayedCount ?? 5,
    };
    configRef.current = config;
    valuesRef.current = { ...valuesRef.current, ...nextValues };
    setRecentAchievementsCount(nextValues.recentAchievementsCount);
    setRecentlyPlayedCount(nextValues.recentlyPlayedCount);
  }, [
    config?.recentAchievementsCount,
    config?.recentlyPlayedCount,
  ]);

  useEffect(() => {
    const nextWeeks = settings.steamCompactActivityCalendarWeeks;
    valuesRef.current.activityCalendarWeeks = nextWeeks;
    setActivityCalendarWeeks(nextWeeks);
  }, [settings.steamCompactActivityCalendarWeeks]);

  const persistSettings = (): void => {
    const values = { ...valuesRef.current };
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const currentConfig = configRef.current;
      if (currentConfig === undefined) return;
      await Promise.all([
        writeValidatedDeckySteamProviderConfig({
          steamId64: currentConfig.steamId64,
          language: currentConfig.language,
          recentAchievementsCount: values.recentAchievementsCount,
          recentlyPlayedCount: values.recentlyPlayedCount,
        }, ""),
        saveDeckySettings({
          ...readDeckySettings(),
          steamCompactActivityCalendarWeeks: values.activityCalendarWeeks,
        }),
      ]);
    }).catch(() => undefined);
  };

  const updateRecentAchievementsCount = (value: AchievementCompanionCount): void => {
    setRecentAchievementsCount(value); valuesRef.current.recentAchievementsCount = value; persistSettings();
  };
  const updateRecentlyPlayedCount = (value: AchievementCompanionCount): void => {
    setRecentlyPlayedCount(value); valuesRef.current.recentlyPlayedCount = value; persistSettings();
  };
  const updateActivityCalendarWeeks = (value: ActivityCalendarWeeks): void => {
    setActivityCalendarWeeks(value); valuesRef.current.activityCalendarWeeks = value; persistSettings();
  };
  return (
    <div data-ac-steam-theme="compact" data-achievement-companion-steam-compact-settings style={getRootStyle()}>
      <section style={getSectionStyle()}>
        <div style={getSectionTitleStyle()}>Steam Settings</div>
        <SteamCompactSettingsAction
          ariaLabel="Open Steam API settings full-screen"
          emphasis="primary"
          isInitialFocusTarget
          onActivate={onOpenApiSettings}
          onCancel={onBack}
        >
          <span style={{ display: "block", minWidth: 0 }}>
            <span style={getActionTitleStyle()}>API Settings</span>
            <span style={getActionDescriptionStyle()}>Steam ID64, API key, and language</span>
          </span>
          <img alt="" src={chevronRightIconUrl} style={getChevronStyle()} />
        </SteamCompactSettingsAction>
      </section>

      <section style={getSectionStyle()}>
        <div style={getSectionTitleStyle()}>Compact Profile</div>
        <div style={getSettingsCardStyle()}>
          <SteamCompactCountPicker
            description="Achievements to show in Recent Activity."
            id="recent-achievements"
            label="Recent Activity"
            onBack={onBack}
            onChange={updateRecentAchievementsCount}
            options={ACHIEVEMENT_COMPANION_COUNT_OPTIONS}
            value={recentAchievementsCount}
          />
          <SteamCompactCountPicker
            description="Games to show in Recently Played."
            id="recently-played"
            label="Recently Played"
            onBack={onBack}
            onChange={updateRecentlyPlayedCount}
            options={ACHIEVEMENT_COMPANION_COUNT_OPTIONS}
            value={recentlyPlayedCount}
          />
          <SteamCompactCountPicker
            description="Weeks shown in the Activity Calendar."
            id="activity-calendar-weeks"
            label="Activity Calendar"
            onBack={onBack}
            onChange={updateActivityCalendarWeeks}
            options={ACTIVITY_CALENDAR_WEEK_OPTIONS}
            value={activityCalendarWeeks}
          />
        </div>
      </section>

    </div>
  );
}
