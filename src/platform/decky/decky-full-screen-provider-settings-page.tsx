import type { ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckySteamProviderSettingsPage } from "./providers/steam";
import { DeckyRetroAchievementsProviderSettingsPage } from "./providers/retroachievements";
import { formatDeckyProviderLabel } from "./providers";

export interface DeckyFullScreenProviderSettingsPageProps {
  readonly providerId: ProviderId;
  readonly onBack: () => void;
}

export function DeckyFullScreenProviderSettingsPage({
  providerId,
  onBack,
}: DeckyFullScreenProviderSettingsPageProps): JSX.Element {
  if (providerId === "retroachievements") {
    return <DeckyRetroAchievementsProviderSettingsPage providerId={providerId} onBack={onBack} />;
  }

  if (providerId === "steam") {
    return <DeckySteamProviderSettingsPage providerId={providerId} onBack={onBack} />;
  }

  return (
    <PlaceholderState
      title="Achievement Companion"
      description={`No provider settings page is available for ${formatDeckyProviderLabel(providerId)} yet.`}
      state={{
        status: "error",
        isStale: false,
        isRefreshing: false,
        error: {
          kind: "unsupported",
          userMessage: `No provider settings page is available for ${formatDeckyProviderLabel(providerId)} yet.`,
          retryable: false,
          providerId,
        },
      }}
      footer={<span>Use Back to return to Settings.</span>}
    />
  );
}
