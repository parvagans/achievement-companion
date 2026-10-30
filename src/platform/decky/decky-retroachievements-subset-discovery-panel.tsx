import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useReducer } from "react";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { raRecipes, raTheme } from "./ra-theme";
import type { RetroAchievementsSubsetDiscoveryStatus } from "../../providers/retroachievements/retroachievements.provider";
import { buildSubsetDiscoveryPanel } from "./decky-retroachievements-subset-discovery-model";
export { buildSubsetDiscoveryPanel };

export function DeckyRetroAchievementsSubsetDiscoveryPanel({ status, platformLabel, onContinue, onBack, onDirection, onFocus }: {
  readonly status: RetroAchievementsSubsetDiscoveryStatus | undefined;
  readonly platformLabel?: string | undefined;
  readonly onContinue: () => void;
  readonly onBack: () => void;
  readonly onDirection: (event: GamepadEvent) => void;
  readonly onFocus: () => void;
}) {
  const [, updateEligibility] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    if (status?.retryAt === undefined || status.retryAt <= Date.now()) return;
    // One UI eligibility transition; never an API retry or a polling loop.
    const timer = setTimeout(updateEligibility, Math.min(2_147_483_647, status.retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status?.retryAt]);
  const model = buildSubsetDiscoveryPanel(status);
  if (model === undefined) return null;
  return <div role="status" style={{ ...raRecipes.card("fullscreen"), padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 auto", minWidth: 0 }}>
      <span style={{ color: raTheme.color.textSecondary, fontSize: raTheme.type.fullscreen.metadata }}>{platformLabel ?? "Console"} catalogue · {model.label}</span>
      <span style={{ color: raTheme.color.textPrimary, fontSize: raTheme.type.fullscreen.metadata }}>{model.progress}</span>
      <DeckyCompletionProgressBar percent={model.percent} showCaption={false} compact />
    </div>
    <Focusable data-ra-subset-discovery-action flow-children="horizontal" tabIndex={-1} noFocusRing onCancel={onBack} onGamepadFocus={onFocus} onFocus={onFocus}>
      <DeckyFullscreenActionButton label={model.action} compact disabled={model.disabled} onClick={onContinue}
        onGamepadDirection={(event) => { if (event.detail.button === GamepadButton.DIR_DOWN) onDirection(event); }} />
    </Focusable>
  </div>;
}
