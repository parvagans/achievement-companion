import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";

export interface DeckyFullScreenGameSpotlightActionsProps {
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
}

export function DeckyFullScreenGameSpotlightActions({
  backLabel,
  onBack,
  onRefresh,
}: DeckyFullScreenGameSpotlightActionsProps): JSX.Element {
  return (
    <DeckyFullscreenActionRow centered>
      <DeckyFullscreenActionButton
        label={backLabel}
        isFullscreenBackAction
        onClick={onBack}
      />
      <DeckyFullscreenActionButton label="Refresh" onClick={onRefresh} />
    </DeckyFullscreenActionRow>
  );
}
