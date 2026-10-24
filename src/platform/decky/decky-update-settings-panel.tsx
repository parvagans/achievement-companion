import { Focusable, TextField, ToggleField, type GamepadEvent } from "@decky/ui";
import { useEffect, useState, type CSSProperties } from "react";
import { APP_VERSION } from "../../generated/version";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import { isDeckyDeveloperUpdateModeEnabled } from "./decky-update-developer-mode";
import {
  checkForDeckyUpdateManually,
  useDeckyUpdateState,
  verifyAndInstallDeckyUpdate,
} from "./decky-update-service";
import { getDeckyUpdateStatusText } from "./decky-update-status-text";
import { DeckySettingsToggleRow } from "./decky-settings-controls";
import { steamRecipes, steamTheme } from "./steam-theme";
import { DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

export interface DeckyUpdateSettingsPanelProps {
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
  readonly compact?: boolean;
}

const cardStyle: CSSProperties = { ...steamRecipes.card("fullscreen"), padding: 14 };

function formatLastChecked(timestamp: number | undefined): string {
  if (timestamp === undefined) return "Never";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function UpdateAction({
  disabled = false,
  label,
  onActivate,
  onGamepadDirection,
  compact = false,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onActivate: () => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
  readonly compact?: boolean;
}): JSX.Element {
  if (compact) return <DeckyCompactPillActionItem label={label} disabled={disabled} onClick={onActivate} stretch />;
  return <Focusable
    className="ac-settings-action"
    noFocusRing
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled}
    aria-label={label}
    {...(!disabled ? { onActivate, onClick: onActivate } : {})}
    {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
    style={{
      minHeight: 44,
      display: "grid",
      placeItems: "center",
      padding: "8px 12px",
      border: `1px solid ${steamTheme.color.borderStrong}`,
      borderRadius: steamTheme.radius.small,
      background: steamTheme.surface.contentStat,
      color: steamTheme.color.textPrimary,
      fontSize: steamTheme.type.fullscreen.body,
      fontWeight: steamTheme.type.weight.strong,
      opacity: disabled ? .55 : 1,
      scrollMargin: "20px 0 55px",
    }}
  >{label}</Focusable>;
}

function UpdateToggle({
  checked,
  description,
  label,
  onChange,
  onGamepadDirection,
  compact = false,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
  readonly compact?: boolean;
}): JSX.Element {
  if (compact) return <ToggleField
    label={<span style={{ color: steamTheme.color.textPrimary, fontSize: steamTheme.type.compact.body, fontWeight: steamTheme.type.weight.strong }}>{label}</span>}
    description={<span style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.compact.metadata }}>{description}</span>}
    checked={checked} onChange={onChange}
  />;
  return <DeckySettingsToggleRow label={label} description={description} checked={checked} onChange={onChange} {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} />;
}

export function DeckyUpdateSettingsPanel({ onGamepadDirection, compact = false }: DeckyUpdateSettingsPanelProps): JSX.Element {
  const settings = useDeckySettings();
  const state = useDeckyUpdateState();
  const developerMode = isDeckyDeveloperUpdateModeEnabled();
  const [localUrl, setLocalUrl] = useState(settings.localUpdateManifestUrl);
  useEffect(() => setLocalUrl(settings.localUpdateManifestUrl), [settings.localUpdateManifestUrl]);
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "verifying" || state.status === "installing";
  const statusText = getDeckyUpdateStatusText(state);
  const metadataSize = compact ? steamTheme.type.compact.metadata : steamTheme.type.fullscreen.metadata;

  return <section
    onFocusCapture={compact ? (event) => scrollDeckyFocusTargetIntoView(event.target as HTMLElement) : undefined}
    style={{ ...(compact ? { padding: 0, color: steamTheme.color.textPrimary } : cardStyle), display: "flex", flex: "0 0 auto", flexDirection: "column", gap: 9, minWidth: 0 }} data-achievement-companion-update-settings>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "3px 12px" }}>
      {!compact ? <div style={{ color: steamTheme.color.textSecondary, fontSize: metadataSize, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>UPDATES</div> : null}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, color: steamTheme.color.textSecondary, fontSize: metadataSize }}>
        <span style={{ color: steamTheme.color.textPrimary, fontWeight: steamTheme.type.weight.strong }}>v{APP_VERSION}</span>
        <span aria-hidden="true">·</span><span>{developerMode && settings.updateSource === "local" ? "Local feed" : "Stable"}</span>
        <span aria-hidden="true">·</span><span>Last checked {formatLastChecked(state.lastCheckedAt ?? settings.lastUpdateCheckedAt)}</span>
      </div>
    </div>
    <UpdateToggle
      compact={compact}
      label="Automatic Update Checks"
      description="Check daily and when your Deck reconnects to the internet."
      checked={settings.automaticUpdateChecks}
      {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
      onChange={(automaticUpdateChecks) => {
        void saveDeckySettings({ ...readDeckySettings(), automaticUpdateChecks });
      }}
    />
    <div data-achievement-companion-update-variable-content style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {state.available !== undefined && (state.status === "updateAvailable" || state.status === "unsupported" || state.status === "error") ? <div style={{ padding: 9, border: `1px solid ${steamTheme.status.success.border}`, borderRadius: steamTheme.radius.small, background: steamTheme.status.success.surface }}>
        <div style={{ color: steamTheme.color.success, fontSize: metadataSize, fontWeight: steamTheme.type.weight.strong }}>UPDATE AVAILABLE · {state.available.version}</div>
        {state.available.releaseNotes !== undefined ? <div style={{ marginTop: 3, color: steamTheme.color.textSecondary, fontSize: metadataSize, lineHeight: 1.3, overflowWrap: "anywhere" }}>{state.available.releaseNotes}</div> : null}
      </div> : null}
      {statusText !== undefined ? <div role="status" style={{ color: state.status === "error" ? steamTheme.color.danger : state.status === "unsupported" ? steamTheme.color.warning : steamTheme.color.textSecondary, fontSize: metadataSize, lineHeight: 1.3, overflowWrap: "anywhere" }}>{statusText}</div> : null}
    </div>
    <div data-achievement-companion-update-actions style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
      <UpdateAction compact={compact} disabled={busy} label={state.status === "checking" ? "Checking…" : "Check for Updates"} {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => { void checkForDeckyUpdateManually(); }} />
      {state.available !== undefined ? <UpdateAction compact={compact} disabled={busy} label={state.status === "downloading" ? "Downloading…" : state.status === "verifying" ? "Verifying…" : state.status === "installing" ? "Installing…" : "Update"} {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => { void verifyAndInstallDeckyUpdate(); }} /> : null}
    </div>
    {developerMode && !compact ? <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 10, borderTop: `1px solid ${steamTheme.color.borderSubtle}` }}>
      <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>DEVELOPER UPDATES</div>
      <UpdateToggle
        label="Local update source"
        description={settings.updateSource === "local" ? "Using the local manifest URL below." : "Using the production stable feed."}
        checked={settings.updateSource === "local"}
        {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
        onChange={(useLocal) => {
          void saveDeckySettings({ ...readDeckySettings(), updateSource: useLocal ? "local" : "production" });
        }}
      />
      {settings.updateSource === "local" ? <div className="ac-steam-settings-input" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <TextField
          label="Local manifest URL"
          description="Use the development PC's LAN address, not localhost."
          value={localUrl}
          onChange={(event) => setLocalUrl(event.currentTarget.value)}
        />
        <UpdateAction label="Save Local Feed" {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => {
          void saveDeckySettings({ ...readDeckySettings(), localUpdateManifestUrl: localUrl.trim() });
        }} />
      </div> : null}
    </div> : null}
  </section>;
}
