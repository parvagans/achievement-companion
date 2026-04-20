import type { ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckySteamSetupScreen } from "./providers/steam";
import { DeckyRetroAchievementsSetupScreen } from "./providers/retroachievements";
import { formatDeckyProviderLabel } from "./providers";

export interface DeckyFirstRunSetupScreenProps {
  readonly providerId: ProviderId;
  readonly onBackToProviders: () => void;
}

export function DeckyFirstRunSetupScreen({
  providerId,
  onBackToProviders,
}: DeckyFirstRunSetupScreenProps): JSX.Element {
  if (providerId === "retroachievements") {
    return (
      <DeckyRetroAchievementsSetupScreen
        providerId={providerId}
        onBackToProviders={onBackToProviders}
      />
    );
  }

  if (providerId === "steam") {
    return <DeckySteamSetupScreen providerId={providerId} onBackToProviders={onBackToProviders} />;
  }

  return (
    <PlaceholderState
      title="Achievement Companion"
      description={`No setup screen is available for ${formatDeckyProviderLabel(providerId)} yet.`}
      state={{
        status: "error",
        isStale: false,
        isRefreshing: false,
        error: {
          kind: "unsupported",
          userMessage: `No setup screen is available for ${formatDeckyProviderLabel(providerId)} yet.`,
          retryable: false,
          providerId,
        },
      }}
      footer={<span>Use Back to return to the provider chooser.</span>}
    />
  );
}
