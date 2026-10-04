import { Focusable, ToggleField } from "@decky/ui";
import {
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  type AchievementCompanionCount,
} from "@core/settings";
import {
  useEffect,
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
    color: "#f2f6fb",
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
    color: "#69cfff",
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: "0.055em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
}

function getActionStyle(isFocused: boolean, emphasis: "primary" | "secondary"): CSSProperties {
  const isPrimary = emphasis === "primary";

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: 38,
    padding: "8px 12px",
    border: isFocused
      ? "1px solid rgba(54, 185, 255, 0.92)"
      : isPrimary
        ? "1px solid rgba(54, 185, 255, 0.52)"
        : "1px solid rgba(54, 142, 191, 0.3)",
    borderRadius: 8,
    background: isFocused
      ? "linear-gradient(180deg, rgba(17, 91, 139, 0.78), rgba(8, 53, 82, 0.9))"
      : isPrimary
        ? "linear-gradient(180deg, rgba(10, 63, 96, 0.82), rgba(7, 43, 67, 0.92))"
        : "linear-gradient(150deg, rgba(9, 35, 51, 0.88), rgba(7, 27, 41, 0.94))",
    boxShadow: isFocused
      ? "0 0 0 1px rgba(54, 185, 255, 0.72), 0 0 13px rgba(54, 185, 255, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : "inset 0 1px 0 rgba(125, 211, 252, 0.05), 0 4px 12px rgba(0, 0, 0, 0.14)",
    boxSizing: "border-box",
    color: "#f2f6fb",
    cursor: "pointer",
    outline: "none",
  };
}

function getActionTitleStyle(): CSSProperties {
  return {
    display: "block",
    color: "#f2f6fb",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getActionDescriptionStyle(): CSSProperties {
  return {
    display: "block",
    marginTop: 3,
    color: "#8ebfe0",
    fontSize: 10,
    lineHeight: 1.25,
  };
}

function getCompactSettingLabelStyle(): CSSProperties {
  return {
    color: "#f2f6fb",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getCompactSettingDescriptionStyle(): CSSProperties {
  return {
    color: "#8ebfe0",
    fontSize: 10,
    lineHeight: 1.25,
  };
}

function getChevronStyle(): CSSProperties {
  return { width: 17, height: 17, flexShrink: 0 };
}

function getSettingsCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid rgba(54, 142, 191, 0.18)",
    borderRadius: 9,
    background: "linear-gradient(150deg, rgba(9, 35, 51, 0.9), rgba(7, 27, 41, 0.96))",
    boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.035)",
  };
}

function getCountPickerStyle(isFocused: boolean, isExpanded: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 70,
    padding: "9px 12px",
    border: isFocused ? "1px solid rgba(54, 185, 255, 0.92)" : "1px solid transparent",
    borderRadius: 7,
    background: isFocused
      ? "rgba(18, 78, 113, 0.64)"
      : isExpanded
        ? "rgba(10, 58, 86, 0.58)"
        : "transparent",
    boxShadow: isFocused ? "inset 0 0 0 1px rgba(54, 185, 255, 0.48)" : "none",
    boxSizing: "border-box",
    color: "#f2f6fb",
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
    background: "rgba(85, 111, 130, 0.55)",
    color: "#f2f6fb",
    fontSize: 16,
    fontWeight: 500,
  };
}

function getCountValueChevronStyle(): CSSProperties {
  return {
    width: 0,
    height: 0,
    borderLeft: "8px solid transparent",
    borderRight: "8px solid transparent",
    borderTop: "9px solid #f2f6fb",
    transform: "translateY(2px)",
  };
}

function getCountOptionsStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 6,
    margin: "4px 12px 10px",
    padding: 6,
    border: "1px solid rgba(54, 142, 191, 0.3)",
    borderRadius: 7,
    background: "rgba(4, 24, 37, 0.96)",
    boxShadow: "0 8px 18px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(125, 211, 252, 0.04)",
  };
}

function getCountOptionStyle(isFocused: boolean, isSelected: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    minHeight: 36,
    padding: "7px 12px",
    border: isFocused
      ? "1px solid rgba(54, 185, 255, 0.96)"
      : isSelected
        ? "1px solid rgba(54, 185, 255, 0.55)"
        : "1px solid rgba(54, 142, 191, 0.24)",
    borderRadius: 5,
    background: isFocused
      ? "rgba(18, 88, 129, 0.9)"
      : isSelected
        ? "rgba(11, 70, 105, 0.72)"
        : "rgba(5, 29, 44, 0.66)",
    boxShadow: isFocused ? "0 0 9px rgba(54, 185, 255, 0.34)" : "none",
    color: "#f2f6fb",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
    outline: "none",
    boxSizing: "border-box",
  };
}

function getToggleFieldWrapperStyle(): CSSProperties {
  return { padding: "0 12px" };
}

function getStatusStyle(isError: boolean): CSSProperties {
  return {
    minHeight: 15,
    color: isError ? "#ff9b9b" : "#8ebfe0",
    fontSize: 10,
    lineHeight: 1.25,
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

function SteamCompactCountPicker({
  description,
  id,
  label,
  onBack,
  onChange,
  value,
}: {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly onBack: () => void;
  readonly onChange: (value: AchievementCompanionCount) => void;
  readonly value: AchievementCompanionCount;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [focusedOption, setFocusedOption] = useState<AchievementCompanionCount | undefined>();

  const selectCount = (nextValue: AchievementCompanionCount): void => {
    onChange(nextValue);
    setIsExpanded(false);
  };

  return (
    <div>
      <Focusable
        noFocusRing
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${label}: ${value}. Select to choose a count.`}
        data-achievement-companion-count-picker-trigger={id}
        onActivate={() => setIsExpanded((expanded) => !expanded)}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        onCancel={onBack}
        onFocus={() => setIsFocused(true)}
        onGamepadFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={getCountPickerStyle(isFocused, isExpanded)}
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
      {isExpanded ? (
        <div aria-label={`${label} options`} style={getCountOptionsStyle()}>
          {ACHIEVEMENT_COMPANION_COUNT_OPTIONS.map((option) => (
            <Focusable
              key={option}
              autoFocus={value === option}
              noFocusRing
              preferredFocus={value === option}
              role="button"
              tabIndex={0}
              aria-label={`Show ${option} ${label.toLowerCase()} items`}
              data-achievement-companion-count-picker-option={`${id}:${option}`}
              onActivate={() => selectCount(option)}
              onClick={() => selectCount(option)}
              onCancel={() => {
                setIsExpanded(false);
              }}
              onFocus={() => setFocusedOption(option)}
              onGamepadFocus={() => setFocusedOption(option)}
              onBlur={() => setFocusedOption(undefined)}
              style={getCountOptionStyle(focusedOption === option, value === option)}
            >
              {option}
            </Focusable>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DeckySteamCompactSettings({
  onBack,
  onOpenApiSettings,
}: DeckySteamCompactSettingsProps): JSX.Element {
  const config = useDeckySteamProviderConfig(STEAM_PROVIDER_ID);
  const [recentAchievementsCount, setRecentAchievementsCount] = useState<AchievementCompanionCount>(
    config?.recentAchievementsCount ?? 5,
  );
  const [recentlyPlayedCount, setRecentlyPlayedCount] = useState<AchievementCompanionCount>(
    config?.recentlyPlayedCount ?? 5,
  );
  const [includePlayedFreeGames, setIncludePlayedFreeGames] = useState(
    config?.includePlayedFreeGames ?? false,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ readonly message: string; readonly isError: boolean } | undefined>();

  useEffect(() => {
    setRecentAchievementsCount(config?.recentAchievementsCount ?? 5);
    setRecentlyPlayedCount(config?.recentlyPlayedCount ?? 5);
    setIncludePlayedFreeGames(config?.includePlayedFreeGames ?? false);
  }, [
    config?.includePlayedFreeGames,
    config?.recentAchievementsCount,
    config?.recentlyPlayedCount,
  ]);

  const saveSettings = async (): Promise<void> => {
    if (config === undefined || isSaving) {
      setStatus({ message: "Steam account settings are unavailable right now.", isError: true });
      return;
    }

    setIsSaving(true);
    setStatus(undefined);
    try {
      const result = await writeValidatedDeckySteamProviderConfig(
        {
          steamId64: config.steamId64,
          language: config.language,
          recentAchievementsCount,
          recentlyPlayedCount,
          includePlayedFreeGames,
        },
        "",
      );
      setStatus({ message: result.userMessage, isError: !result.saved });
    } catch {
      setStatus({ message: "Unable to save Steam display settings right now.", isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-achievement-companion-steam-compact-settings style={getRootStyle()}>
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
            onChange={setRecentAchievementsCount}
            value={recentAchievementsCount}
          />
          <SteamCompactCountPicker
            description="Games to show in Recently Played."
            id="recently-played"
            label="Recently Played"
            onBack={onBack}
            onChange={setRecentlyPlayedCount}
            value={recentlyPlayedCount}
          />
          <div style={getToggleFieldWrapperStyle()}>
            <ToggleField
              label={<span style={getCompactSettingLabelStyle()}>Show free games</span>}
              description={
                <span style={getCompactSettingDescriptionStyle()}>
                  Include played free games in Recently Played.
                </span>
              }
              checked={includePlayedFreeGames}
              highlightOnFocus
              onChange={setIncludePlayedFreeGames}
            />
          </div>
        </div>
      </section>

      <div style={getStatusStyle(status?.isError ?? false)}>{status?.message}</div>
      <SteamCompactSettingsAction
        ariaLabel="Save Steam compact profile settings"
        emphasis="primary"
        onActivate={() => { void saveSettings(); }}
        onCancel={onBack}
      >
        <span style={getActionTitleStyle()}>{isSaving ? "Saving..." : "Save Settings"}</span>
      </SteamCompactSettingsAction>
      <SteamCompactSettingsAction
        ariaLabel="Back to Steam profile"
        emphasis="secondary"
        onActivate={onBack}
        onCancel={onBack}
      >
        <span style={getActionTitleStyle()}>Back to Steam Profile</span>
      </SteamCompactSettingsAction>
    </div>
  );
}
