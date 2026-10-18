import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type ReactNode,
  type RefCallback,
} from "react";
import {
  DropdownItem,
  Field,
  Focusable,
  NavEntryPositionPreferences,
  type FocusableProps,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  useQuickAccessVisible,
} from "@decky/ui";
import {
  GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS,
  GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS,
  GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_OPTIONS,
  type AchievementCompanionTheme,
  type GamePageAchievementBadgeColor,
  type GamePageAchievementBadgeColors,
  type GamePageAchievementBadgePosition,
  type GamePageAchievementBadgeSize,
} from "@core/settings";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
import { createDeckyNavigationPort, openDeckyProviderSettingsFromQam } from "./decky-navigation";
import {
  createDeckyPlatform,
  initialDeckyBootstrapState,
  initialDeckyActivityCalendarState,
  initialDeckyAchievementHistoryState,
  initialDeckyGameDetailState,
  initialDeckySteamHuntersProfileState,
  loadDeckyActivityCalendarState,
  getDeckyAchievementHistoryStateForFullScreenEntryInitial,
  getDeckySteamHuntersProfileStateForFullScreenEntryInitial,
  loadDeckyAchievementHistoryStateForFullScreenEntry,
  loadDeckyDashboardStateForFullScreenEntry,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersProfileStateForFullScreenEntry,
  startDeckyProviderProfileDataSession,
  consumeDeckyProviderFullScreenCompactReturnRefreshSuppression,
} from "./decky-app-services";
import { DeckyAchievementDetailView } from "./decky-achievement-detail-view";
import {
  setDeckyCompactNavigation,
  useDeckyCompactNavigation,
  returnFromDeckyCompactDestination,
  type DeckyCompactAchievementDestination,
  type DeckyCompactAchievementListDestination,
  type DeckyCompactGameDestination,
} from "./decky-compact-navigation";
import { DeckyDashboardView } from "./decky-dashboard-view";
import { useDeckyCompactDropdownPopupGuard } from "./decky-compact-dropdown-popup-guard";
import { DeckyCompactLoadingState } from "./decky-compact-loading-state";
import { DeckyGameDetailView } from "./decky-game-detail-view";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { shouldRefreshDashboardOnEntry } from "./dashboard-refresh";
import { useRetroAchievementsConnectionState } from "./providers/retroachievements/connection";
import { useSteamConnectionState } from "./providers/steam/connection";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import {
  readDeckyPluginSettingsExpanded,
  writeDeckyPluginSettingsExpanded,
  readDeckyThemeSettingsExpanded,
  writeDeckyThemeSettingsExpanded,
  readDeckyGamePageBadgeSettingsExpanded,
  writeDeckyGamePageBadgeSettingsExpanded,
} from "./decky-provider-menu-session-state";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { dispatchDeckyScrollReset, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { DeckyCompactAchievementList } from "./decky-compact-achievement-list";
import {
  buildCompactAchievementDetailModel,
  buildCompactAchievementListModel,
  type CompactAchievementTarget,
} from "./decky-compact-achievement-model";
import { resolveDeckyCompactAchievementResource } from "./decky-compact-achievement-resource";
import {
  claimDeckyCompactRetroAchievementsDashboardRefresh,
  claimDeckyCompactSteamDashboardRefresh,
  clearDeckyCompactSessionResources,
  loadDeckyCompactSteamDashboardState,
  loadDeckyCompactSteamGameState,
  readDeckyCompactSteamDashboardState,
  readDeckyCompactSteamGameState,
} from "./decky-compact-session-resources";
import {
  readDeckyCompactAchievementPageState,
  resetDeckyCompactAchievementPageState,
  writeDeckyCompactAchievementPageState,
} from "./decky-compact-achievement-page-state";
import {
  getDeckyProviderOptions,
  useDeckyProviderConfig,
  useDeckyProviderConfigs,
} from "./providers";
import {
  STEAM_PROVIDER_ID,
  type SteamProviderConfig,
  createDeckySteamLibraryScanDependencies,
  buildDeckySteamCompletionProgressSnapshotFromSummary,
  runAndCacheDeckySteamLibraryAchievementScan,
  useDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam";
import { resolveProviderDashboardPreferences } from "@core/provider-dashboard-preferences";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { readDeckyGamepadNavigationTrees } from "./decky-gamepad-navigation";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { readDeckySteamCompactFocusScrollTop } from "./decky-steam-compact-focus-state";
import { readDeckyRetroAchievementsCompactFocusScrollTop } from "./decky-retroachievements-compact-focus-state";
import {
  createDeckyProviderInitialFocusAttempt,
  requestDeckyProviderInitialFocus,
  shouldRequestDeckyProviderInitialFocus,
} from "./decky-provider-initial-focus";
import { steamRecipes, steamTheme } from "./steam-theme";
import { getDeckyGamePageAchievementBadgeColorPreview } from "./decky-game-page-achievement-badge-colors";
interface SteamLibraryScanActionState {
  readonly status: "idle" | "scanning" | "success" | "error";
  readonly message?: string;
}

type ProviderLauncherTone = "connected" | "setup" | "neutral";

const ACHIEVEMENT_COMPANION_THEME_DROPDOWN_OPTIONS = [
  { data: "ac-blue", label: "AC Blue" },
  { data: "ac-neon", label: "AC Neon" },
];

const GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_LABELS: Readonly<
  Record<GamePageAchievementBadgePosition, string>
> = {
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right",
};

const COMPACT_GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const satisfies readonly GamePageAchievementBadgePosition[];

const GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_DROPDOWN_OPTIONS =
  COMPACT_GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS.map((position) => ({
    data: position,
    label: GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_LABELS[position],
  }));

const GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_DROPDOWN_OPTIONS =
  GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_OPTIONS.map((size) => ({
    data: size,
    label: size.charAt(0).toUpperCase() + size.slice(1),
  }));

const GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_LABELS: Readonly<
  Record<GamePageAchievementBadgeColor, string>
> = {
  purple: "Purple",
  blue: "Blue",
  green: "Green",
  gray: "Gray",
  cyan: "Cyan",
  gold: "Gold",
  red: "Red",
};

function renderGamePageAchievementBadgeColorOptionLabel(
  color: GamePageAchievementBadgeColor,
): ReactNode {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          flex: "0 0 12px",
          border: "1px solid rgba(255,255,255,.76)",
          borderRadius: 999,
          background: getDeckyGamePageAchievementBadgeColorPreview(color),
          boxShadow: `0 0 7px ${getDeckyGamePageAchievementBadgeColorPreview(color)}`,
        }}
      />
      <span>{GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_LABELS[color]}</span>
    </span>
  );
}

const GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_DROPDOWN_OPTIONS =
  GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS.map((color) => ({
    data: color,
    label: renderGamePageAchievementBadgeColorOptionLabel(color),
  }));

function isGamePageAchievementBadgePosition(value: unknown): value is GamePageAchievementBadgePosition {
  return (
    typeof value === "string" &&
    GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS.includes(value as GamePageAchievementBadgePosition)
  );
}

function isGamePageAchievementBadgeSize(value: unknown): value is GamePageAchievementBadgeSize {
  return typeof value === "string" &&
    GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_OPTIONS.includes(value as GamePageAchievementBadgeSize);
}

function isGamePageAchievementBadgeColor(value: unknown): value is GamePageAchievementBadgeColor {
  return (
    typeof value === "string" &&
    GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS.includes(value as GamePageAchievementBadgeColor)
  );
}

function getChooserActionRowStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
  };
}

function getChooserProviderListStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
    width: "100%",
    minWidth: 0,
  };
}

function getProviderMenuDividerStyle(): CSSProperties {
  return {
    width: "calc(100% - 24px)",
    height: 1,
    margin: "5px 12px",
    flexShrink: 0,
    background: steamTheme.color.borderSubtle,
  };
}

function getPluginSettingsContentCardStyle(): CSSProperties {
  return {
    ...steamRecipes.card("compact"),
    // The native PanelSections have a gap; bridge it to join the disclosure and rows.
    margin: `-${steamTheme.space.xl}px 0 ${steamTheme.space.md}px`,
    borderTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

function getChooserProviderLauncherTone(
  providerId: ProviderId | "settings",
  connected: boolean,
): ProviderLauncherTone {
  if (providerId === "settings") {
    return "neutral";
  }

  return connected ? "connected" : "setup";
}

function getChooserPillGroupStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    marginInline: "auto",
    gap: "8px 10px",
  };
}

function getChooserProviderCardStyle(
  tone: ProviderLauncherTone,
  isFocused: boolean,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minWidth: 0,
    minHeight: 62,
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid ${
      isFocused
        ? tone === "setup"
          ? "rgba(245, 189, 82, 0.72)"
          : "var(--ac-chooser-focus-border, rgba(125, 190, 255, 0.7))"
        : "var(--ac-chooser-border, rgba(86, 137, 173, 0.24))"
    }`,
    background: isFocused ? steamTheme.surface.focusedContentCard : steamTheme.surface.contentCard,
    boxShadow: isFocused
      ? tone === "setup"
        ? "0 0 0 1px rgba(245, 189, 82, 0.5), 0 0 14px rgba(245, 189, 82, 0.28)"
        : "var(--ac-chooser-focus-shadow, 0 0 0 1px rgba(54, 185, 255, 0.8), 0 0 15px rgba(54, 185, 255, 0.45))"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045)",
    boxSizing: "border-box",
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.96)",
    transition:
      "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease, transform 120ms ease",
  };
}

function getChooserProviderCardSettingsIconStyle(): CSSProperties {
  return {
    width: 40,
    height: 40,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: steamTheme.surface.contentStat,
    color: "rgba(187, 211, 229, 0.9)",
    fontSize: 24,
    lineHeight: 1,
  };
}

function getChooserProviderCardBodyStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 3,
    minWidth: 0,
    flex: 1,
    padding: 0,
  };
}

function getChooserProviderCardDetailsStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  };
}

function getChooserProviderCardIconFrameStyle(tone: ProviderLauncherTone): CSSProperties {
  const accentColor =
    tone === "connected"
      ? "rgba(116, 176, 255, 0.24)"
      : tone === "setup"
        ? "rgba(214, 158, 46, 0.24)"
        : "rgba(255, 255, 255, 0.18)";

  return {
    width: 40,
    height: 40,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 10,
    border: `1px solid ${accentColor}`,
    background: steamTheme.surface.contentStat,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function getChooserProviderCardIconStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

function getChooserProviderCardTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "visible",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
    fontSize: "0.82em",
    fontWeight: 750,
    lineHeight: 1.2,
  };
}

function getChooserProviderCardStatusStyle(tone: ProviderLauncherTone): CSSProperties {
  const isConfigured = tone === "connected";

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: isConfigured ? "rgba(194, 239, 210, 0.94)" : "rgba(255, 225, 159, 0.96)",
    fontSize: "0.70em",
    fontWeight: 600,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

function getChooserProviderCardStatusDotStyle(tone: ProviderLauncherTone): CSSProperties {
  return {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRadius: 999,
    background: tone === "connected" ? "#4FD17A" : "#F5C542",
    boxShadow: tone === "connected" ? "0 0 7px rgba(79, 209, 122, 0.68)" : "0 0 7px rgba(245, 197, 66, 0.54)",
  };
}

function getChooserProviderCardChevronStyle(tone: ProviderLauncherTone): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 28,
    height: 28,
    flexShrink: 0,
    color: tone === "setup" ? "rgba(245, 197, 66, 0.92)" : "var(--ac-chooser-chevron, rgba(54, 185, 255, 0.94))",
  };
}

function ChooserProviderCardChevronGlyph(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getPluginSettingsDisclosureStyle(
  focused: boolean,
): CSSProperties {
  return {
    ...getChooserProviderCardStyle("connected", focused),
    marginBottom: 0,
  };
}

function PluginSettingsDisclosure({
  expanded,
  onToggle,
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`Plugin Settings, ${expanded ? "expanded" : "collapsed"}`}
      data-achievement-companion-plugin-settings-disclosure="true"
      onActivate={onToggle}
      onClick={onToggle}
      onFocus={(event) => {
        setFocused(true);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onGamepadFocus={(event) => {
        setFocused(true);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onBlur={() => setFocused(false)}
      onGamepadBlur={() => setFocused(false)}
      style={getPluginSettingsDisclosureStyle(focused)}
    >
      <span aria-hidden="true" style={getChooserProviderCardSettingsIconStyle()}>{"\u2699"}</span>
      <span style={getChooserProviderCardBodyStyle()}>
        <span style={getChooserProviderCardTitleStyle()}>Plugin Settings</span>
      </span>
      <span
        aria-hidden="true"
        style={{
          ...getChooserProviderCardChevronStyle("connected"),
          transform: expanded ? "rotate(-90deg)" : "rotate(90deg)",
          transition: "transform 120ms ease",
        }}
      >
        <ChooserProviderCardChevronGlyph />
      </span>
    </Focusable>
  );
}

function GamePageBadgeSizeDropdown({
  selectedSize,
  disabled,
  onChange,
}: {
  readonly selectedSize: GamePageAchievementBadgeSize;
  readonly disabled: boolean;
  readonly onChange: (size: GamePageAchievementBadgeSize) => void;
}): JSX.Element {
  const openGuardedMenu = useDeckyCompactDropdownPopupGuard();
  return (
    <DropdownItem
      label={<span style={getGamePageBadgeLabelStyle(disabled)}>Badge size</span>}
      description={<span style={getGamePageBadgeDescriptionStyle(disabled)}>Choose the badge size on game pages.</span>}
      disabled={disabled}
      menuLabel="Game Page Badge Size"
      onMenuWillOpen={openGuardedMenu}
      rgOptions={GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_DROPDOWN_OPTIONS}
      selectedOption={selectedSize}
      onChange={(option) => {
        if (isGamePageAchievementBadgeSize(option.data)) onChange(option.data);
      }}
    />
  );
}

function ThemeDropdown({ selectedTheme }: { readonly selectedTheme: AchievementCompanionTheme }): JSX.Element {
  const openGuardedMenu = useDeckyCompactDropdownPopupGuard();
  return (
    <DropdownItem
      label={<span style={getGamePageBadgeLabelStyle()}>Theme</span>}
      menuLabel="Achievement Companion Theme"
      onMenuWillOpen={openGuardedMenu}
      rgOptions={ACHIEVEMENT_COMPANION_THEME_DROPDOWN_OPTIONS}
      selectedOption={selectedTheme}
      onChange={(option) => {
        if (option.data !== "ac-blue" && option.data !== "ac-neon") return;
        void saveDeckySettings({ ...readDeckySettings(), theme: option.data });
      }}
    />
  );
}

function getGamePageBadgeLabelStyle(disabled = false): CSSProperties {
  return {
    color: disabled ? steamTheme.color.textMuted : steamTheme.color.textPrimary,
    opacity: disabled ? 0.58 : 1,
    fontSize: "0.9em",
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function getGamePageBadgeDescriptionStyle(disabled = false): CSSProperties {
  return {
    color: disabled ? steamTheme.color.textMuted : steamTheme.color.textSecondary,
    opacity: disabled ? 0.48 : 1,
    fontSize: "0.8em",
    lineHeight: 1.25,
  };
}

function GamePageBadgePositionDropdown({
  selectedPosition,
  disabled,
  onChange,
}: {
  readonly selectedPosition: GamePageAchievementBadgePosition;
  readonly disabled: boolean;
  readonly onChange: (position: GamePageAchievementBadgePosition) => void;
}): JSX.Element {
  const openGuardedMenu = useDeckyCompactDropdownPopupGuard();

  return (
    <DropdownItem
      label={<span style={getGamePageBadgeLabelStyle(disabled)}>Badge position</span>}
      description={
        <span style={getGamePageBadgeDescriptionStyle(disabled)}>
          Choose where the game page badge is anchored.
        </span>
      }
      disabled={disabled}
      menuLabel="Game Page Badge Position"
      onMenuWillOpen={openGuardedMenu}
      rgOptions={GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_DROPDOWN_OPTIONS}
      selectedOption={selectedPosition}
      onChange={(option) => {
        if (isGamePageAchievementBadgePosition(option.data)) {
          onChange(option.data);
        }
      }}
    />
  );
}

function GamePageBadgeColorDropdown({
  label,
  description,
  selectedColor,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly selectedColor: GamePageAchievementBadgeColor;
  readonly disabled: boolean;
  readonly onChange: (color: GamePageAchievementBadgeColor) => void;
}): JSX.Element {
  const openGuardedMenu = useDeckyCompactDropdownPopupGuard();

  return (
    <DropdownItem
      label={<span style={getGamePageBadgeLabelStyle(disabled)}>{label}</span>}
      description={<span style={getGamePageBadgeDescriptionStyle(disabled)}>{description}</span>}
      disabled={disabled}
      menuLabel={`${label} Badge Color`}
      onMenuWillOpen={openGuardedMenu}
      rgOptions={GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_DROPDOWN_OPTIONS}
      selectedOption={selectedColor}
      onChange={(option) => {
        if (isGamePageAchievementBadgeColor(option.data)) {
          onChange(option.data);
        }
      }}
    />
  );
}

function saveGamePageAchievementBadgeColor(
  status: keyof GamePageAchievementBadgeColors,
  color: GamePageAchievementBadgeColor,
): void {
  const currentSettings = readDeckySettings();
  void saveDeckySettings({
    ...currentSettings,
    gamePageAchievementBadgeColors: {
      ...currentSettings.gamePageAchievementBadgeColors,
      [status]: color,
    },
  });
}

const scrollFocusedLauncherElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

type DeckyGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const scrollFocusedLauncherGamepadElementIntoView: DeckyGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function ProviderLauncherCard({
  providerId,
  iconSrc,
  label,
  statusLabel,
  connected,
  ariaLabel,
  onClick,
  onFocused,
  preferredFocus = false,
  elementRef,
}: {
  readonly providerId: ProviderId | "settings";
  readonly iconSrc: string | undefined;
  readonly label: string;
  readonly connected?: boolean;
  readonly statusLabel?: string;
  readonly ariaLabel: string;
  readonly onClick: () => void;
  readonly onFocused?: () => void;
  readonly preferredFocus?: boolean;
  readonly elementRef?: RefCallback<HTMLDivElement>;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const tone = getChooserProviderLauncherTone(providerId, connected === true);

  return (
    <Focusable
      noFocusRing
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
      preferredFocus={preferredFocus}
      ref={elementRef}
      onActivate={onClick}
      onClick={onClick}
      onFocus={(event) => {
        setIsFocused(true);
        onFocused?.();
        scrollFocusedLauncherElementIntoView(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        onFocused?.();
        scrollFocusedLauncherGamepadElementIntoView(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      onGamepadBlur={() => {
        setIsFocused(false);
      }}
      style={getChooserProviderCardStyle(tone, isFocused)}
    >
      {iconSrc !== undefined ? (
        <span aria-hidden="true" style={getChooserProviderCardIconFrameStyle(tone)}>
          <img alt="" loading="lazy" src={iconSrc} style={getChooserProviderCardIconStyle()} />
        </span>
      ) : (
        <span aria-hidden="true" style={getChooserProviderCardSettingsIconStyle()}>{"\u2699"}</span>
      )}
      <span style={getChooserProviderCardBodyStyle()}>
        <span style={getChooserProviderCardTitleStyle()}>{label}</span>
        {statusLabel !== undefined ? (
          <span style={getChooserProviderCardDetailsStyle()}>
            <span aria-hidden="true" style={getChooserProviderCardStatusDotStyle(tone)} />
            <span style={getChooserProviderCardStatusStyle(tone)}>{statusLabel}</span>
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" style={getChooserProviderCardChevronStyle(tone)}><ChooserProviderCardChevronGlyph /></span>
    </Focusable>
  );
}

function formatSteamLibraryScanUpdatedLabel(scannedAt: string | undefined): string | undefined {
  if (scannedAt === undefined) {
    return undefined;
  }

  const parsed = Date.parse(scannedAt);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const elapsedMs = Date.now() - parsed;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  if (absoluteMs < 60_000) {
    const value = Math.max(1, Math.round(absoluteMs / 1000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "second");
  }

  if (absoluteMs < 3_600_000) {
    const value = Math.max(1, Math.round(absoluteMs / 60_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "minute");
  }

  if (absoluteMs < 86_400_000) {
    const value = Math.max(1, Math.round(absoluteMs / 3_600_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "hour");
  }

  const value = Math.max(1, Math.round(absoluteMs / 86_400_000));
  return formatter.format(elapsedMs >= 0 ? -value : value, "day");
}

const platform = createDeckyPlatform(createDeckyNavigationPort());
let lastDeckyDashboardSettingsSignature: string | undefined;

function loadGameDetailState(providerId: ProviderId, gameId: string): Promise<ResourceState<GameDetailSnapshot>> {
  return loadDeckyGameDetailState(providerId, gameId);
}

function isRenderableDashboardState(
  state: ResourceState<DashboardSnapshot>,
): state is ResourceState<DashboardSnapshot> & { readonly data: DashboardSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function DashboardScreen({
  providerId,
  onOpenGameDetail,
  onOpenAchievementDetail,
  onOpenProfile,
  onOpenAchievementHistory,
  onOpenCompletionProgress,
  onBackToProviders,
  onOpenSettings,
  isShowingSteamCompactSettings,
  isShowingRetroAchievementsCompactSettings,
  onCloseSteamCompactSettings,
  onCloseRetroAchievementsCompactSettings,
}: {
  readonly providerId: ProviderId;
  readonly onOpenGameDetail: (providerId: ProviderId, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onOpenAchievementHistory: (providerId: string) => void;
  readonly onOpenCompletionProgress: (providerId: string) => void;
  readonly onBackToProviders: () => void;
  readonly onOpenSettings: () => void;
  readonly isShowingSteamCompactSettings: boolean;
  readonly isShowingRetroAchievementsCompactSettings: boolean;
  readonly onCloseSteamCompactSettings: () => void;
  readonly onCloseRetroAchievementsCompactSettings: () => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const providerConfig = useDeckyProviderConfig(providerId);
  const retroAchievementsConnectionState = useRetroAchievementsConnectionState();
  const steamConnectionState = useSteamConnectionState();
  const quickAccessVisible = useQuickAccessVisible();
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState(0);
  const [steamLibraryScanState, setSteamLibraryScanState] = useState<SteamLibraryScanActionState>({
    status: "idle",
  });
  // A compact Steam visit mirrors the full-screen profile's fresh account
  // boundary. Cached dashboard data remains available to other surfaces, but
  // this view waits for Steam and, when enabled, the personal SteamHunters
  // lookup to settle before showing the profile.
  const initialProviderRefresh = useRef<boolean | undefined>(undefined);
  if (initialProviderRefresh.current === undefined) {
    initialProviderRefresh.current = providerId === STEAM_PROVIDER_ID
      ? claimDeckyCompactSteamDashboardRefresh()
      : providerId === "retroachievements"
        ? claimDeckyCompactRetroAchievementsDashboardRefresh()
        : false;
  }
  const dashboardForceRefreshNextLoad = useRef(initialProviderRefresh.current);
  const activityCalendarForceRefreshNextLoad = useRef(initialProviderRefresh.current);
  const previousQuickAccessVisible = useRef(quickAccessVisible);
  const dashboardPreferences = useMemo(
    () => resolveProviderDashboardPreferences(providerConfig, settings),
    [providerConfig, settings],
  );
  const steamLibraryAchievementScanSummary = useDeckySteamLibraryAchievementScanSummary(providerId);
  // Count settings are presentation slices over a maximum-size dashboard snapshot.
  const dashboardSettingsSignature = providerId;
  const requestDashboardReload = useCallback((forceRefresh: boolean) => {
    if (forceRefresh) {
      dashboardForceRefreshNextLoad.current = true;
      activityCalendarForceRefreshNextLoad.current = true;
    }

    setDashboardRefreshNonce((value) => value + 1);
  }, []);
  const requestSteamLibraryScan = useCallback(async () => {
    if (providerId !== STEAM_PROVIDER_ID || providerConfig === undefined || steamLibraryScanState.status === "scanning") {
      return;
    }

    const steamProviderConfig = providerConfig as SteamProviderConfig;
    setSteamLibraryScanState({ status: "scanning" });
    try {
      await runAndCacheDeckySteamLibraryAchievementScan(
        steamProviderConfig,
        createDeckySteamLibraryScanDependencies(),
      );
      setSteamLibraryScanState({ status: "success" });
    } catch {
      setSteamLibraryScanState({
        status: "error",
        message: "Steam library scan failed. Try again.",
      });
    }
  }, [providerConfig, providerId, steamLibraryScanState.status]);
  const dashboardLoader = useMemo(
    () => () => {
      const forceRefresh = dashboardForceRefreshNextLoad.current;
      dashboardForceRefreshNextLoad.current = false;

      if (forceRefresh) {
        startDeckyProviderProfileDataSession(providerId);
      }

      const loader = () => loadDeckyDashboardStateForFullScreenEntry(providerId);
      return providerId === STEAM_PROVIDER_ID
        ? loadDeckyCompactSteamDashboardState(loader, forceRefresh)
        : loader();
    },
    [dashboardRefreshNonce, providerId],
  );
  const initialDashboardState = providerId === STEAM_PROVIDER_ID
    ? readDeckyCompactSteamDashboardState() ?? initialDeckyBootstrapState
    : initialDeckyBootstrapState;
  const state = useAsyncResourceState(dashboardLoader, initialDashboardState);
  const activityCalendarLoader = useMemo(
    () => () => {
      const forceRefresh = activityCalendarForceRefreshNextLoad.current;
      activityCalendarForceRefreshNextLoad.current = false;

      return providerId === "retroachievements"
        ? loadDeckyActivityCalendarState(providerId, { forceRefresh })
        : Promise.resolve(initialDeckyActivityCalendarState);
    },
    [dashboardRefreshNonce, providerId],
  );
  const activityCalendarState = useAsyncResourceState(
    activityCalendarLoader,
    providerId === "retroachievements" && initialDashboardState.data?.activityCalendarUnlocks !== undefined
      ? { ...initialDeckyActivityCalendarState, data: initialDashboardState.data.activityCalendarUnlocks }
      : initialDeckyActivityCalendarState,
  );
  const steamActivityLoader = useMemo(
    () => () => providerId === STEAM_PROVIDER_ID
      ? loadDeckyAchievementHistoryStateForFullScreenEntry(providerId)
      : Promise.resolve(initialDeckyAchievementHistoryState),
    [dashboardRefreshNonce, providerId],
  );
  const steamActivityState = useAsyncResourceState(
    steamActivityLoader,
    providerId === STEAM_PROVIDER_ID
      ? getDeckyAchievementHistoryStateForFullScreenEntryInitial(providerId)
      : initialDeckyAchievementHistoryState,
  );
  const steamId = providerId === STEAM_PROVIDER_ID
    ? (providerConfig as SteamProviderConfig | undefined)?.steamId64.trim()
    : undefined;
  const steamHuntersPersonalDataEnabled = settings.steamHuntersPersonalDataEnabled;
  const steamHuntersProfileLoader = useMemo(
    () => () => {
      if (!steamHuntersPersonalDataEnabled || steamId === undefined || steamId.length === 0) {
        return Promise.resolve(getDeckySteamHuntersProfileStateForFullScreenEntryInitial(undefined));
      }

      return loadDeckySteamHuntersProfileStateForFullScreenEntry(STEAM_PROVIDER_ID);
    },
    [dashboardRefreshNonce, steamId, steamHuntersPersonalDataEnabled],
  );
  const steamHuntersProfileInitialState = providerId === STEAM_PROVIDER_ID
    ? getDeckySteamHuntersProfileStateForFullScreenEntryInitial(providerId)
    : initialDeckySteamHuntersProfileState;
  const steamHuntersProfileState = useAsyncResourceState(
    steamHuntersProfileLoader,
    steamHuntersProfileInitialState,
  );
  const steamHuntersProfile = steamHuntersPersonalDataEnabled
    && steamHuntersProfileInitialState.status !== "error"
    && steamHuntersProfileState.data?.steamId === steamId
    ? steamHuntersProfileState.data
    : undefined;
  const isSteamCompactProfileLoading =
    providerId === STEAM_PROVIDER_ID &&
    state.status !== "error" &&
    (!isRenderableDashboardState(state) || state.isRefreshing === true ||
      (steamHuntersPersonalDataEnabled && steamId !== undefined && steamId.length > 0 &&
        (steamHuntersProfileInitialState.status === "loading" ||
          steamHuntersProfileState.status === "idle" || steamHuntersProfileState.status === "loading" ||
          steamHuntersProfileState.status === "refreshing" || steamHuntersProfileState.isRefreshing === true)));
  const isRetroAchievementsCompactProfileLoading =
    providerId === "retroachievements" &&
    state.status !== "error" &&
    (!isRenderableDashboardState(state) || state.isRefreshing === true);
  const isCompactProfileLoading = isSteamCompactProfileLoading || isRetroAchievementsCompactProfileLoading;
  const dashboardReentryRefreshKey = `${providerId}:${state.status}:${state.data?.profile.providerId ?? "none"}:${state.error?.kind ?? "none"}:${state.error?.debugMessage ?? "none"}`;
  const lastDashboardReentryRefreshKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previousSettingsSignature = lastDeckyDashboardSettingsSignature;
    lastDeckyDashboardSettingsSignature = dashboardSettingsSignature;

    if (previousSettingsSignature === undefined || previousSettingsSignature === dashboardSettingsSignature) {
      return;
    }

    requestDashboardReload(true);
  }, [dashboardSettingsSignature, requestDashboardReload]);

  useEffect(() => {
    const becameVisible = quickAccessVisible && !previousQuickAccessVisible.current;
    previousQuickAccessVisible.current = quickAccessVisible;

    if (!becameVisible) {
      return;
    }

    if (consumeDeckyProviderFullScreenCompactReturnRefreshSuppression(providerId)) {
      return;
    }

    if (state.status === "success") {
      requestDashboardReload(true);
      return;
    }
  }, [quickAccessVisible, requestDashboardReload, state]);

  useEffect(() => {
    if (providerId === STEAM_PROVIDER_ID && readDeckyCompactSteamDashboardState() !== undefined) {
      lastDashboardReentryRefreshKey.current = undefined;
      return;
    }

    if (!shouldRefreshDashboardOnEntry({ providerId, state })) {
      lastDashboardReentryRefreshKey.current = undefined;
      return;
    }

    if (lastDashboardReentryRefreshKey.current === dashboardReentryRefreshKey) {
      return;
    }

    lastDashboardReentryRefreshKey.current = dashboardReentryRefreshKey;
    requestDashboardReload(true);
  }, [dashboardReentryRefreshKey, providerId, requestDashboardReload, state]);

  const visibleState = useMemo(() => {
    if (!isRenderableDashboardState(state)) {
      return state;
    }

    return {
      ...state,
      data: {
        ...state.data,
        recentAchievements: state.data.recentAchievements.slice(0, dashboardPreferences.recentAchievementsCount),
        recentUnlocks: state.data.recentUnlocks.slice(0, dashboardPreferences.recentAchievementsCount),
        recentlyPlayedGames: state.data.recentlyPlayedGames.slice(0, dashboardPreferences.recentlyPlayedCount),
      },
    };
  }, [dashboardPreferences.recentAchievementsCount, dashboardPreferences.recentlyPlayedCount, state]);
  const steamLibraryScanStatusLabel =
    providerId === STEAM_PROVIDER_ID
      ? steamLibraryScanState.status === "scanning"
        ? "Scanning library… this can take a few minutes"
        : steamLibraryScanState.status === "error"
          ? steamLibraryScanState.message
          : steamLibraryScanState.status === "success"
            ? "Library scan completed just now"
            : steamLibraryAchievementScanSummary !== undefined
              ? `Library scan updated ${formatSteamLibraryScanUpdatedLabel(steamLibraryAchievementScanSummary.scannedAt) ?? "just now"}`
              : "No full-library scan yet"
      : undefined;

  const steamLibraryScanButtonLabel =
    providerId === STEAM_PROVIDER_ID
      ? steamLibraryScanState.status === "scanning"
        ? "Scanning full Steam library…"
        : steamLibraryScanState.status === "success" || steamLibraryScanState.status === "error"
          ? "Scan full Steam library again"
          : steamLibraryAchievementScanSummary !== undefined
            ? "Scan full Steam library again"
            : "Scan full Steam library"
      : undefined;

  return isRenderableDashboardState(visibleState) && !isCompactProfileLoading ? (
    <DeckyDashboardView
      state={visibleState}
      {...(providerId === STEAM_PROVIDER_ID && state.data !== undefined
        ? {
            steamActivityKnownGames: [
              ...(steamLibraryAchievementScanSummary === undefined
                ? []
                : buildDeckySteamCompletionProgressSnapshotFromSummary(steamLibraryAchievementScanSummary).games),
              ...state.data.recentlyPlayedGames,
            ],
          }
        : {})}
      {...(providerId === STEAM_PROVIDER_ID && steamActivityState.data !== undefined
        ? { steamActivityEntries: steamActivityState.data.entries }
        : {})}
      {...(steamLibraryAchievementScanSummary !== undefined
        ? { steamLibraryAchievementScanSummary }
        : {})}
      onBackToProviders={onBackToProviders}
      onOpenSettings={onOpenSettings}
      isShowingSteamCompactSettings={isShowingSteamCompactSettings}
      onCloseSteamCompactSettings={onCloseSteamCompactSettings}
      isShowingRetroAchievementsCompactSettings={isShowingRetroAchievementsCompactSettings}
      onCloseRetroAchievementsCompactSettings={onCloseRetroAchievementsCompactSettings}
      onRefreshDashboard={() => {
        requestDashboardReload(true);
      }}
      {...(providerId === "retroachievements"
        ? {
            ...((activityCalendarState.data ?? state.data?.activityCalendarUnlocks) !== undefined
              ? { retroAchievementsActivityCalendarUnlocks: activityCalendarState.data ?? state.data?.activityCalendarUnlocks! }
              : {}),
            retroAchievementsConnectionState,
            onUpdateRetroAchievementsCredentials: onOpenSettings,
          }
        : {})}
      {...(providerId === "steam" ? { steamConnectionState, onUpdateSteamCredentials: onOpenSettings } : {})}
      onOpenGameDetail={onOpenGameDetail}
      onOpenAchievementDetail={onOpenAchievementDetail}
      onOpenProfile={onOpenProfile}
      onOpenAchievementHistory={onOpenAchievementHistory}
      onOpenCompletionProgress={onOpenCompletionProgress}
      {...(steamHuntersProfile !== undefined ? { steamHuntersProfile } : {})}
      {...(providerId === STEAM_PROVIDER_ID && steamLibraryScanButtonLabel !== undefined && steamLibraryScanStatusLabel !== undefined
        ? {
            steamLibraryScanAction: {
              label: steamLibraryScanButtonLabel,
              statusLabel: steamLibraryScanStatusLabel,
              disabled: providerConfig === undefined || steamLibraryScanState.status === "scanning",
              onClick: requestSteamLibraryScan,
            },
          }
        : {})}
    />
  ) : providerId === STEAM_PROVIDER_ID ? (
    <DeckyCompactLoadingState
      steamTheme
      description={state.error?.userMessage ?? (steamHuntersPersonalDataEnabled
        ? "Fetching the latest Steam profile and SteamHunters data."
        : "Fetching the latest Steam profile data.")}
      isError={state.status === "error"}
      onCancel={onBackToProviders}
      title={state.status === "error" ? "Steam profile unavailable" : "Loading Steam profile..."}
    />
  ) : providerId === "retroachievements" ? (
    <DeckyCompactLoadingState
      description={state.error?.userMessage ?? "Fetching the latest RetroAchievements profile and unlock activity."}
      isError={state.status === "error"}
      onCancel={onBackToProviders}
      title={state.status === "error" ? "RetroAchievements profile unavailable" : "Loading RetroAchievements profile..."}
    />
  ) : (
    <PlaceholderState
      title="Achievement Companion"
      description="Loading your selected provider dashboard."
      providerId={providerId}
      state={visibleState}
      footer={
        <div style={getChooserActionRowStyle()}>
          <DeckyCompactPillActionGroup style={getChooserPillGroupStyle()}>
            <DeckyCompactPillActionItem
              label="Back"
              ariaLabel="Return to provider chooser"
              onClick={onBackToProviders}
              onCancelButton={onBackToProviders}
            />
            <DeckyCompactPillActionItem
              label="Settings"
              onClick={onOpenSettings}
              onCancelButton={onBackToProviders}
            />
          </DeckyCompactPillActionGroup>
          <span>The compact panel will show your overview, recent achievements, and recently played games when data is ready.</span>
        </div>
      }
    />
  );
}

function GameDetailScreen({
  game,
  onOpenFullScreenGame,
  onOpenCompactAchievements,
  onBackToDashboard,
  onOpenAchievementDetail,
  onRequestScrollReset,
  scrollResetNonce,
}: {
  readonly game: DeckyCompactGameDestination;
  readonly onOpenFullScreenGame: (game: DeckyCompactGameDestination) => void;
  readonly onOpenCompactAchievements: (game: DeckyCompactGameDestination) => void;
  readonly onBackToDashboard: () => void;
  readonly onOpenAchievementDetail: (achievementId: string) => void;
  readonly onRequestScrollReset: () => void;
  readonly scrollResetNonce: number;
}): JSX.Element {
  const achievementMode = useDeckySettings().retroAchievementsAchievementMode;
  const loadSelectedGameDetail = useMemo(
    () => () => game.providerId === STEAM_PROVIDER_ID
      ? loadDeckyCompactSteamGameState(
        game.gameId,
        () => resolveDeckyCompactAchievementResource(game.providerId, game.gameId),
      )
      : loadGameDetailState(game.providerId, game.gameId),
    [game.gameId, game.providerId],
  );
  const initialGameDetailState = game.providerId === STEAM_PROVIDER_ID
    ? readDeckyCompactSteamGameState(game.gameId) ?? initialDeckyGameDetailState
    : initialDeckyGameDetailState;
  const loader = useAsyncResourceState(loadSelectedGameDetail, initialGameDetailState);
  return (
    <TopAlignedScrollViewport
      resetNonce={scrollResetNonce}
      scrollKey={`game-detail:${game.providerId}:${game.gameId}`}
    >
      {isRenderableGameDetailState(loader) ? (
        <DeckyGameDetailView
          achievementMode={achievementMode}
          onBackToDashboard={onBackToDashboard}
          onOpenAchievementDetail={onOpenAchievementDetail}
          onOpenFullScreenPage={
            platform.navigation !== undefined
              ? () => {
                  onRequestScrollReset();
                  onOpenFullScreenGame(game);
                }
              : undefined
          }
          onOpenCompactAchievements={() => {
            onRequestScrollReset();
            onOpenCompactAchievements(game);
          }}
          state={loader}
        />
      ) : game.providerId === STEAM_PROVIDER_ID ? (
        <DeckyCompactLoadingState
          steamTheme
          description={loader.error?.userMessage ?? "Fetching the latest Steam game and SteamHunters data."}
          isError={loader.status === "error"}
          onCancel={onBackToDashboard}
          title={loader.status === "error" ? "Steam game unavailable" : `Loading ${game.gameTitle}...`}
        />
      ) : (
        <DeckyCompactLoadingState
          description={loader.error?.userMessage ?? "Fetching game details from RetroAchievements."}
          isError={loader.status === "error"}
          onCancel={onBackToDashboard}
          title={loader.status === "error" ? "RetroAchievements game unavailable" : `Loading ${game.gameTitle}...`}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function CompactAchievementListScreen({
  destination,
  onBack,
  onOpenAchievement,
}: {
  readonly destination: DeckyCompactAchievementListDestination;
  readonly onBack: () => void;
  readonly onOpenAchievement: (achievementId: string) => void;
}): JSX.Element {
  const achievementMode = useDeckySettings().retroAchievementsAchievementMode;
  const loadAchievementList = useMemo(
    () => () => destination.providerId === STEAM_PROVIDER_ID
      ? loadDeckyCompactSteamGameState(
        destination.gameId,
        () => resolveDeckyCompactAchievementResource(destination.providerId, destination.gameId),
      )
      : resolveDeckyCompactAchievementResource(destination.providerId, destination.gameId),
    [destination.gameId, destination.providerId],
  );
  const initialGameDetailState = destination.providerId === STEAM_PROVIDER_ID
    ? readDeckyCompactSteamGameState(destination.gameId) ?? initialDeckyGameDetailState
    : initialDeckyGameDetailState;
  const loader = useAsyncResourceState(loadAchievementList, initialGameDetailState);
  const model = isRenderableGameDetailState(loader)
    ? buildCompactAchievementListModel(loader.data, achievementMode)
    : undefined;
  const restoredPageState = readDeckyCompactAchievementPageState(
    destination.providerId,
    destination.gameId,
    model?.initialVisibleCount ?? 12,
  );
  const [isScrollRestored, setIsScrollRestored] = useState(false);
  const handleScrollRestoreComplete = useCallback(() => setIsScrollRestored(true), []);
  const focusRestorationReady = restoredPageState.scrollTop <= 0 || isScrollRestored;

  return (
    <TopAlignedScrollViewport
      onRestoreAfterLayoutComplete={handleScrollRestoreComplete}
      restoreAfterLayout
      restoreScrollTop={restoredPageState.scrollTop}
      scrollKey={`achievement-list:${destination.providerId}:${destination.gameId}`}
    >
      {model !== undefined ? (
        <DeckyCompactAchievementList
          embedded={false}
          focusRestorationReady={focusRestorationReady}
          model={model}
          onBack={onBack}
          onOpenAchievement={onOpenAchievement}
        />
      ) : (
        <DeckyCompactLoadingState
          steamTheme={destination.providerId === STEAM_PROVIDER_ID}
          description={loader.error?.userMessage ?? (
            destination.providerId === STEAM_PROVIDER_ID
              ? "Fetching Steam achievements and SteamHunters data."
              : "Fetching achievements from RetroAchievements."
          )}
          isError={loader.status === "error"}
          onCancel={onBack}
          title={loader.status === "error" ? "Achievements unavailable" : `Loading ${destination.gameTitle} achievements...`}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function DeckySteamCompactAchievementDetailSurface({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const ownerWindow = surface?.ownerDocument.defaultView;
    if (surface === null || ownerWindow === null || ownerWindow === undefined) {
      return;
    }
    const frame = ownerWindow.requestAnimationFrame(() => {
      // The page wrapper must not own focus: a Focusable wrapper traps QAM's
      // vertical navigation before it can reach the clickable game context.
      const initialFocusTarget = surface.querySelector<HTMLElement>("[role='group'][aria-label^='Achievement ']")
        ?? surface.querySelector<HTMLElement>("[role='button']");
      takeDeckySteamGamepadFocus(initialFocusTarget);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={surfaceRef}
      aria-label="Achievement details"
    >
      {children}
    </div>
  );
}

function CompactAchievementDetailScreen({
  destination,
  onBack,
  onOpenCompactGame,
  onOpenFullScreenGame,
}: {
  readonly destination: DeckyCompactAchievementDestination;
  readonly onBack: () => void;
  readonly onOpenCompactGame: () => void;
  readonly onOpenFullScreenGame: () => void;
}): JSX.Element {
  const achievementMode = useDeckySettings().retroAchievementsAchievementMode;
  const loadAchievementGameDetail = useMemo(
    () => () => destination.providerId === STEAM_PROVIDER_ID
      ? loadDeckyCompactSteamGameState(
        destination.gameId,
        () => resolveDeckyCompactAchievementResource(destination.providerId, destination.gameId),
      )
      : resolveDeckyCompactAchievementResource(destination.providerId, destination.gameId),
    [destination.gameId, destination.providerId],
  );
  const initialGameDetailState = destination.providerId === STEAM_PROVIDER_ID
    ? readDeckyCompactSteamGameState(destination.gameId) ?? initialDeckyGameDetailState
    : initialDeckyGameDetailState;
  const loader = useAsyncResourceState(loadAchievementGameDetail, initialGameDetailState);
  const model = isRenderableGameDetailState(loader)
    ? buildCompactAchievementDetailModel(loader.data, destination.achievementId, achievementMode)
    : undefined;

  const detailContent = model === undefined ? undefined : (
    <DeckyAchievementDetailView
      model={model}
      onBack={onBack}
      onOpenCompactGame={onOpenCompactGame}
      onOpenFullScreenGame={
        model.showLegacyActions && platform.navigation !== undefined ? onOpenFullScreenGame : undefined
      }
    />
  );

  return (
    <TopAlignedScrollViewport
      key={`achievement:${destination.providerId}:${destination.gameId}:${destination.achievementId}`}
      scrollKey={`achievement:${destination.providerId}:${destination.gameId}:${destination.achievementId}`}
    >
      {model !== undefined ? (
        <DeckySteamCompactAchievementDetailSurface>
          {detailContent}
        </DeckySteamCompactAchievementDetailSurface>
      ) : (
        <DeckyCompactLoadingState
          steamTheme={destination.providerId === STEAM_PROVIDER_ID}
          description={loader.error?.userMessage ?? (
            destination.providerId === STEAM_PROVIDER_ID
              ? "Fetching the Steam achievement and SteamHunters data."
              : "Fetching achievement details from RetroAchievements."
          )}
          isError={loader.status === "error" || isRenderableGameDetailState(loader)}
          onCancel={onBack}
          title={loader.status === "error" || isRenderableGameDetailState(loader)
            ? "Achievement unavailable"
            : "Loading achievement details..."}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function DeckyBootstrapStateBridge(): JSX.Element {
  const providerConfigs = useDeckyProviderConfigs();
  const settings = useDeckySettings();
  const compactNavigation = useDeckyCompactNavigation();
  const [providerChooserFocusRequest, setProviderChooserFocusRequest] = useState(
    () => shouldRequestDeckyProviderInitialFocus(compactNavigation) ? 1 : 0,
  );
  const returnFromCompactDestination = useCallback(() => {
    returnFromDeckyCompactDestination(compactNavigation);
  }, [compactNavigation]);
  const returnToProviderChooser = useCallback(() => {
    // Back from a provider loader is a cancellation boundary. Invalidate its
    // in-flight work before another provider can mount so a fast B -> provider
    // handoff always starts the newly selected provider's own refresh.
    clearDeckyCompactSessionResources();
    returnFromDeckyCompactDestination(compactNavigation);
    dispatchDeckyScrollReset("providers");
    setProviderChooserFocusRequest((request) => request + 1);
  }, [compactNavigation]);
  const openProviderDashboard = useCallback((providerId: ProviderId) => {
    // A chooser selection must never reuse a previous provider's transient
    // loading state or cached promise, including when Back and A are batched
    // by GamepadUI before React commits the chooser in between.
    clearDeckyCompactSessionResources();
    setDeckyCompactNavigation({ kind: "provider-dashboard", providerId });
  }, []);
  const [detailScrollResetNonce, setDetailScrollResetNonce] = useState(0);
  const [providerListHasReceivedFocus, setProviderListHasReceivedFocus] = useState(false);
  const [pluginSettingsExpanded, setPluginSettingsExpanded] = useState(
    readDeckyPluginSettingsExpanded,
  );
  const [themeSettingsExpanded, setThemeSettingsExpanded] = useState(
    readDeckyThemeSettingsExpanded,
  );
  const [gamePageBadgeSettingsExpanded, setGamePageBadgeSettingsExpanded] = useState(
    readDeckyGamePageBadgeSettingsExpanded,
  );
  const providerInitialFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const providerConfigsSignature = `${providerConfigs.retroAchievements?.username ?? ""}:${providerConfigs.retroAchievements?.hasApiKey ? 1 : 0}:${providerConfigs.steam?.steamId64 ?? ""}:${providerConfigs.steam?.hasApiKey ? 1 : 0}`;
  const enabledProviders = useMemo(() => getDeckyProviderOptions(providerConfigs), [providerConfigs]);
  const visibleProviders = useMemo(
    () => enabledProviders.filter((provider) => provider.enabled),
    [enabledProviders],
  );
  const selectedProviderId = compactNavigation.kind === "provider-dashboard" || compactNavigation.kind === "settings"
    ? compactNavigation.providerId
    : undefined;
  const selectedGame = compactNavigation.kind === "game" ? compactNavigation : undefined;
  const selectedAchievementList = compactNavigation.kind === "achievement-list" ? compactNavigation : undefined;
  const selectedAchievement = compactNavigation.kind === "achievement" ? compactNavigation : undefined;
  const selectedProviderConfig =
    selectedProviderId === "retroachievements"
      ? providerConfigs.retroAchievements
      : selectedProviderId === "steam"
        ? providerConfigs.steam
        : undefined;
  const lastProviderConfigsSignature = useRef<string | undefined>(undefined);

  const setProviderInitialFocusTarget = useCallback((node: HTMLDivElement | null) => {
    providerInitialFocusTargetRef.current = node;
  }, []);

  useLayoutEffect(() => {
    if (selectedProviderId !== undefined || providerChooserFocusRequest === 0 || providerInitialFocusTargetRef.current === null) {
      return;
    }

    const attempt = createDeckyProviderInitialFocusAttempt({
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      requestFocus: (target) => requestDeckyProviderInitialFocus(target, {
        getNavigationTrees: readDeckyGamepadNavigationTrees,
      }),
    });
    attempt.start(providerInitialFocusTargetRef.current);

    return () => {
      attempt.cancel();
    };
  }, [providerChooserFocusRequest, selectedProviderId]);

  const openProviderFullScreenView = useCallback((
    providerId: string,
    view: "profile" | "achievement-history" | "completion-progress",
  ) => {
    dispatchDeckyScrollReset("dashboard");
    void platform.navigation?.go({
      view,
      providerId,
      surface: "full-screen",
    });
  }, []);

  useEffect(() => {
    const previousSignature = lastProviderConfigsSignature.current;
    lastProviderConfigsSignature.current = providerConfigsSignature;

    if (previousSignature === undefined || previousSignature === providerConfigsSignature) {
      return;
    }

    resetDeckyCompactAchievementPageState();
    setDeckyCompactNavigation({ kind: "provider-chooser" });
  }, [providerConfigsSignature]);

  useEffect(() => {
    if (selectedProviderId === undefined || selectedProviderConfig !== undefined) {
      return;
    }

    setDeckyCompactNavigation({ kind: "provider-chooser" });
  }, [selectedProviderConfig, selectedProviderId]);

  return (
    <>
      {selectedAchievement !== undefined ? (
        <CompactAchievementDetailScreen
          destination={selectedAchievement}
          onBack={() => {
            returnFromCompactDestination();
          }}
          onOpenCompactGame={() => {
            setDeckyCompactNavigation({
              kind: "game",
              providerId: selectedAchievement.providerId,
              gameId: selectedAchievement.gameId,
              gameTitle: selectedAchievement.gameTitle,
              returnToAchievement: {
                achievementId: selectedAchievement.achievementId,
                parent: selectedAchievement.parent,
              },
            });
          }}
          onOpenFullScreenGame={() => {
            void platform.navigation?.go({
              view: "game",
              providerId: selectedAchievement.providerId,
              gameId: selectedAchievement.gameId,
              surface: "full-screen",
            });
          }}
        />
      ) : selectedAchievementList !== undefined ? (
        <CompactAchievementListScreen
          destination={selectedAchievementList}
          onBack={() => {
            returnFromCompactDestination();
          }}
          onOpenAchievement={(achievementId) => {
            setDeckyCompactNavigation({
              kind: "achievement",
              providerId: selectedAchievementList.providerId,
              gameId: selectedAchievementList.gameId,
              gameTitle: selectedAchievementList.gameTitle,
              achievementId,
              parent: "achievement-list",
            });
          }}
        />
      ) : selectedGame !== undefined ? (
        <>
          <GameDetailScreen
            key={`${selectedGame.providerId}:${selectedGame.gameId}`}
            game={selectedGame}
            onOpenFullScreenGame={(game) => {
              void platform.navigation?.go({
                view: "game",
                providerId: game.providerId,
                gameId: game.gameId,
                surface: "full-screen",
              });
            }}
            onOpenCompactAchievements={(game) => {
              if (game.providerId === "retroachievements") {
                writeDeckyCompactAchievementPageState(game.providerId, game.gameId, {
                  filter: "all", modeFilter: "all", visibleCount: 12,
                  focusedAchievementId: undefined, scrollTop: 0,
                });
              }
              setDeckyCompactNavigation({
                kind: "achievement-list",
                providerId: game.providerId,
                gameId: game.gameId,
                gameTitle: game.gameTitle,
                parent: "game",
              });
            }}
            onBackToDashboard={() => {
              returnFromCompactDestination();
            }}
            onOpenAchievementDetail={(achievementId) => {
              setDeckyCompactNavigation({
                kind: "achievement",
                providerId: selectedGame.providerId,
                gameId: selectedGame.gameId,
                achievementId,
                gameTitle: selectedGame.gameTitle,
                parent: "game",
              });
            }}
            onRequestScrollReset={() => {
              setDetailScrollResetNonce((value) => value + 1);
            }}
            scrollResetNonce={detailScrollResetNonce}
          />
        </>
  ) : (
        <>
          {selectedProviderId === undefined ? (
            <TopAlignedScrollViewport scrollKey="providers">
              <>
                <PanelSection>
                  <PanelSectionRow>
                    <Focusable
                      // Prefer RA only on first entry; afterward native focus should resume the last card.
                      {...(!providerListHasReceivedFocus
                        ? { navEntryPreferPosition: NavEntryPositionPreferences.PREFERRED_CHILD }
                        : {})}
                      preferredFocus
                      style={getChooserProviderListStyle()}
                    >
                      {visibleProviders.map((provider, index) => (
                        <ProviderLauncherCard
                          key={provider.id}
                          providerId={provider.id}
                          iconSrc={provider.iconSrc}
                          label={provider.label}
                          connected={provider.connected}
                          ariaLabel={
                            provider.connected
                              ? `${provider.label} provider, configured`
                              : `${provider.label} provider, needs setup`
                          }
                          statusLabel={provider.connected ? "Configured" : "Set up"}
                          preferredFocus={index === 0}
                          onFocused={() => setProviderListHasReceivedFocus(true)}
                          {...(index === 0 ? { elementRef: setProviderInitialFocusTarget } : {})}
                          onClick={() => {
                            if (!provider.enabled) {
                              return;
                            }

                            if (
                              (provider.id === "retroachievements" && providerConfigs.retroAchievements === undefined) ||
                              (provider.id === "steam" && providerConfigs.steam === undefined)
                            ) {
                              openDeckyProviderSettingsFromQam(provider.id);
                              return;
                            }

                            openProviderDashboard(provider.id);
                          }}
                        />
                      ))}
                      <ProviderLauncherCard
                        providerId="settings"
                        iconSrc={undefined}
                        label="Provider Settings"
                        ariaLabel="Open provider settings"
                        preferredFocus={visibleProviders.length === 0}
                        onFocused={() => setProviderListHasReceivedFocus(true)}
                        {...(visibleProviders.length === 0 ? { elementRef: setProviderInitialFocusTarget } : {})}
                        onClick={() => {
                          void platform.navigation?.go({
                            view: "settings",
                            surface: "full-screen",
                          });
                        }}
                      />
                      <div
                        aria-orientation="horizontal"
                        data-achievement-companion-provider-menu-divider="true"
                        role="separator"
                        style={getProviderMenuDividerStyle()}
                      />
                      <PluginSettingsDisclosure
                        expanded={pluginSettingsExpanded}
                        onToggle={() => {
                          setPluginSettingsExpanded((expanded) => {
                            const nextExpanded = !expanded;
                            writeDeckyPluginSettingsExpanded(nextExpanded);
                            return nextExpanded;
                          });
                        }}
                      />
                    </Focusable>
                  </PanelSectionRow>
                </PanelSection>

                {pluginSettingsExpanded ? (
                  <PanelSection>
                    <div data-achievement-companion-plugin-settings-card="true" style={getPluginSettingsContentCardStyle()}>
                      <PanelSectionRow>
                        <Field
                          label="Theme Settings"
                          focusable
                          highlightOnFocus
                          onActivate={() => {
                            setThemeSettingsExpanded((expanded) => {
                              const nextExpanded = !expanded;
                              writeDeckyThemeSettingsExpanded(nextExpanded);
                              return nextExpanded;
                            });
                          }}
                        >{themeSettingsExpanded ? "▴" : "▾"}</Field>
                      </PanelSectionRow>
                      {themeSettingsExpanded ? (
                        <ThemeDropdown selectedTheme={settings.theme} />
                      ) : null}
                      <PanelSectionRow>
                        <Field
                          label="Game Badge Settings"
                          focusable
                          highlightOnFocus
                          onActivate={() => {
                            setGamePageBadgeSettingsExpanded((expanded) => {
                              const nextExpanded = !expanded;
                              writeDeckyGamePageBadgeSettingsExpanded(nextExpanded);
                              return nextExpanded;
                            });
                          }}
                        >{gamePageBadgeSettingsExpanded ? "▴" : "▾"}</Field>
                      </PanelSectionRow>
                      {gamePageBadgeSettingsExpanded ? (<>
                      <PanelSectionRow>
                        <ToggleField
                          label={<span style={getGamePageBadgeLabelStyle()}>Show game page badge</span>}
                          description={
                            <span style={getGamePageBadgeDescriptionStyle()}>
                              Show achievement progress on Steam and non-Steam game pages.
                            </span>
                          }
                          checked={settings.showGamePageAchievementBadge}
                          highlightOnFocus
                          onChange={(showGamePageAchievementBadge) => {
                            void saveDeckySettings({
                              ...readDeckySettings(),
                              showGamePageAchievementBadge,
                            });
                          }}
                        />
                      </PanelSectionRow>

                      <GamePageBadgeSizeDropdown
                        selectedSize={settings.gamePageAchievementBadgeSize}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(gamePageAchievementBadgeSize) => {
                          void saveDeckySettings({
                            ...readDeckySettings(),
                            gamePageAchievementBadgeSize,
                          });
                        }}
                      />

                      <GamePageBadgePositionDropdown
                        selectedPosition={settings.gamePageAchievementBadgePosition}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(gamePageAchievementBadgePosition) => {
                          void saveDeckySettings({
                            ...readDeckySettings(),
                            gamePageAchievementBadgePosition,
                          });
                        }}
                      />

                      <GamePageBadgeColorDropdown
                        label="Perfected color"
                        description="Color used for completed Steam achievement sets."
                        selectedColor={settings.gamePageAchievementBadgeColors.perfected}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(color) => saveGamePageAchievementBadgeColor("perfected", color)}
                      />
                      <GamePageBadgeColorDropdown
                        label="Mastered color"
                        description="Color used for mastered RetroAchievements games."
                        selectedColor={settings.gamePageAchievementBadgeColors.mastered}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(color) => saveGamePageAchievementBadgeColor("mastered", color)}
                      />
                      <GamePageBadgeColorDropdown
                        label="Beaten color"
                        description="Color used for beaten RetroAchievements games."
                        selectedColor={settings.gamePageAchievementBadgeColors.beaten}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(color) => saveGamePageAchievementBadgeColor("beaten", color)}
                      />
                      <GamePageBadgeColorDropdown
                        label="In Progress color"
                        description="Color used while a ready game is still in progress."
                        selectedColor={settings.gamePageAchievementBadgeColors.inProgress}
                        disabled={!settings.showGamePageAchievementBadge}
                        onChange={(color) => saveGamePageAchievementBadgeColor("inProgress", color)}
                      />
                      </>) : null}
                    </div>
                  </PanelSection>
                ) : null}
              </>
            </TopAlignedScrollViewport>
          ) : (
            <TopAlignedScrollViewport
              restoreAfterLayout={selectedProviderId === STEAM_PROVIDER_ID || selectedProviderId === "retroachievements"}
              restoreScrollTop={
                compactNavigation.kind !== "provider-dashboard"
                  ? undefined
                  : selectedProviderId === STEAM_PROVIDER_ID
                    ? readDeckySteamCompactFocusScrollTop()
                    : selectedProviderId === "retroachievements"
                      ? readDeckyRetroAchievementsCompactFocusScrollTop()
                      : undefined
              }
              scrollKey="dashboard"
            >
              <DashboardScreen
                key={selectedProviderId}
                providerId={selectedProviderId}
                onBackToProviders={() => {
                  returnToProviderChooser();
                }}
                onOpenSettings={() => {
                  void platform.navigation?.go({
                    view: "settings",
                    surface: "full-screen",
                    providerId: selectedProviderId,
                  });
                }}
                isShowingSteamCompactSettings={compactNavigation.kind === "settings" && selectedProviderId === STEAM_PROVIDER_ID}
                isShowingRetroAchievementsCompactSettings={compactNavigation.kind === "settings" && selectedProviderId === "retroachievements"}
                onCloseSteamCompactSettings={() => {
                  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: STEAM_PROVIDER_ID });
                }}
                onCloseRetroAchievementsCompactSettings={() => {
                  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "retroachievements" });
                }}
                onOpenGameDetail={(providerId, gameId, gameTitle) => {
                  setDeckyCompactNavigation({
                    kind: "game",
                    providerId,
                    gameId,
                    gameTitle,
                  });
                }}
                onOpenAchievementDetail={(target) => {
                  setDeckyCompactNavigation({
                    kind: "achievement",
                    providerId: target.game.providerId,
                    gameId: target.game.gameId,
                    achievementId: target.achievement.achievementId,
                    gameTitle: target.game.title,
                    parent: "provider-dashboard",
                  });
                }}
                onOpenProfile={(providerId) => {
                  openProviderFullScreenView(providerId, "profile");
                }}
                onOpenAchievementHistory={(providerId) => {
                  openProviderFullScreenView(providerId, "achievement-history");
                }}
                onOpenCompletionProgress={(providerId) => {
                  openProviderFullScreenView(providerId, "completion-progress");
                }}
              />
            </TopAlignedScrollViewport>
          )}
        </>
      )}
    </>
  );
}

export function DeckyBootstrap(): JSX.Element {
  useEffect(() => {
    console.debug("[Achievement Companion] Decky bootstrap mounted");
  }, []);

  return (
    <>
      <DeckyFocusStyles />
      <DeckyBootstrapStateBridge />
    </>
  );
}

export default DeckyBootstrap;
