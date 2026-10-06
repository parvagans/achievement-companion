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
import { steamRecipes, steamTheme } from "./steam-theme";

export interface DeckyUpdateSettingsPanelProps {
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}

const cardStyle: CSSProperties = { ...steamRecipes.card("fullscreen"), padding: 10 };

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
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onActivate: () => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
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
      minHeight: 30,
      display: "grid",
      placeItems: "center",
      padding: "4px 10px",
      border: `1px solid ${steamTheme.color.borderStrong}`,
      borderRadius: steamTheme.radius.small,
      background: steamTheme.surface.interactive,
      color: steamTheme.color.textPrimary,
      fontSize: steamTheme.type.fullscreen.caption,
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
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  return <Focusable
    className="ac-settings-action"
    role="switch"
    tabIndex={0}
    aria-label={label}
    aria-checked={checked}
    onActivate={() => onChange(!checked)}
    {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
    style={{ borderRadius: steamTheme.radius.small, scrollMargin: "20px 0 55px" }}
  >
    <ToggleField
      label={<span style={{ fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.15 }}>{label}</span>}
      description={<span style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.regular, lineHeight: 1.15 }}>{description}</span>}
      checked={checked}
      highlightOnFocus
      onChange={onChange}
    />
  </Focusable>;
}

export function DeckyUpdateSettingsPanel({ onGamepadDirection }: DeckyUpdateSettingsPanelProps): JSX.Element {
  const settings = useDeckySettings();
  const state = useDeckyUpdateState();
  const developerMode = isDeckyDeveloperUpdateModeEnabled();
  const [localUrl, setLocalUrl] = useState(settings.localUpdateManifestUrl);
  useEffect(() => setLocalUrl(settings.localUpdateManifestUrl), [settings.localUpdateManifestUrl]);
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "verifying" || state.status === "installing";
  const statusText = state.status === "checking" ? "Checking…"
    : state.status === "downloading" ? "Downloading…"
    : state.status === "verifying" ? "Verifying…"
    : state.status === "installing" ? "Installing…"
    : state.status === "updateAvailable" ? `Update ${state.available?.version ?? ""} available`
    : state.message;

  return <div style={{ ...cardStyle, flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingBottom: 65, scrollPadding: "20px 0 55px" }} data-achievement-companion-update-settings>
    <div style={{ color: steamTheme.color.textSecondary, fontSize: 10, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".14em", lineHeight: 1.2 }}>UPDATES</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 12px", marginTop: 7, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption }}>
      <span>Installed Version</span><span style={{ color: steamTheme.color.textPrimary }}>v{APP_VERSION}</span>
      <span>Channel</span><span style={{ color: steamTheme.color.textPrimary }}>Stable</span>
      <span>Last Checked</span><span style={{ color: steamTheme.color.textPrimary }}>{formatLastChecked(state.lastCheckedAt ?? settings.lastUpdateCheckedAt)}</span>
    </div>
    <div style={{ marginTop: 7, borderRadius: steamTheme.radius.small, overflow: "hidden" }}>
      <UpdateToggle
        label="Automatic Update Checks"
        description="Check at most once every 24 hours without delaying startup."
        checked={settings.automaticUpdateChecks}
        {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
        onChange={(automaticUpdateChecks) => {
          void saveDeckySettings({ ...readDeckySettings(), automaticUpdateChecks });
        }}
      />
    </div>
    {developerMode ? <div style={{ marginTop: 7, padding: 7, border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.interactive }}>
      <div style={{ color: steamTheme.color.accent, fontSize: 10, fontWeight: steamTheme.type.weight.strong }}>DEVELOPER UPDATES</div>
      <UpdateToggle
        label="Local update source"
        description={settings.updateSource === "local" ? "Using the local manifest URL below." : "Using the production stable feed."}
        checked={settings.updateSource === "local"}
        {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
        onChange={(useLocal) => {
          void saveDeckySettings({ ...readDeckySettings(), updateSource: useLocal ? "local" : "production" });
        }}
      />
      {settings.updateSource === "local" ? <div className="ac-steam-settings-input" style={{ marginTop: 5 }}>
        <TextField
          label="Local manifest URL"
          description="Use the development PC's LAN address, not localhost."
          value={localUrl}
          onChange={(event) => setLocalUrl(event.currentTarget.value)}
        />
        <div style={{ marginTop: 5 }}><UpdateAction label="Save Local Feed" {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => {
          void saveDeckySettings({ ...readDeckySettings(), localUpdateManifestUrl: localUrl.trim() });
        }} /></div>
      </div> : null}
    </div> : null}
    {state.available !== undefined && (state.status === "updateAvailable" || state.status === "unsupported" || state.status === "error") ? <div style={{ marginTop: 7, padding: 7, border: `1px solid ${steamTheme.status.success.border}`, borderRadius: steamTheme.radius.small, background: steamTheme.status.success.surface }}>
      <div style={{ color: steamTheme.color.success, fontSize: 10, fontWeight: steamTheme.type.weight.strong }}>UPDATE AVAILABLE · {state.available.version}</div>
      {state.available.releaseNotes !== undefined ? <div style={{ marginTop: 3, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.25 }}>{state.available.releaseNotes}</div> : null}
    </div> : null}
    {statusText !== undefined ? <div style={{ marginTop: 6, color: state.status === "error" ? steamTheme.color.danger : state.status === "unsupported" ? steamTheme.color.warning : steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.2 }}>{statusText}</div> : null}
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5, marginTop: 7 }}>
      <UpdateAction disabled={busy} label={state.status === "checking" ? "Checking…" : "Check for Updates"} {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => { void checkForDeckyUpdateManually(); }} />
      {state.available !== undefined ? <UpdateAction disabled={busy} label={state.status === "downloading" ? "Downloading…" : state.status === "verifying" ? "Verifying…" : state.status === "installing" ? "Installing…" : "Update"} {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})} onActivate={() => { void verifyAndInstallDeckyUpdate(); }} /> : null}
    </div>
  </div>;
}
