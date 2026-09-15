import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";

export interface DeckyFullScreenGameSpotlightActionsProps {
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly centered?: boolean;
}

export function DeckyFullScreenGameSpotlightActions({
  backLabel,
  onBack,
  onRefresh,
  centered = true,
}: DeckyFullScreenGameSpotlightActionsProps): JSX.Element {
  return (
    <DeckyFullscreenActionRow centered={centered}>
      <DeckyFullscreenActionButton
        label={backLabel}
        isFullscreenBackAction
        onClick={onBack}
      />
      <DeckyFullscreenActionButton label="Refresh" onClick={onRefresh} />
    </DeckyFullscreenActionRow>
  );
}
