import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { DeckySteamCompactGameOverview } from "./decky-steam-compact-game-overview";
import { DeckyRetroAchievementsCompactGameOverview } from "./decky-retroachievements-compact-game-overview";

export interface DeckyGameDetailViewProps {
  readonly state: ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot };
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly onBackToDashboard: () => void;
  readonly onOpenFullScreenPage: (() => void) | undefined;
  readonly onOpenCompactAchievements: (() => void) | undefined;
  readonly onOpenAchievementDetail: (achievementId: string) => void;
}

export function DeckyGameDetailView({
  state,
  achievementMode,
  onBackToDashboard,
  onOpenFullScreenPage,
  onOpenCompactAchievements,
}: DeckyGameDetailViewProps): JSX.Element {
  const isSteamGame = state.data.game.providerId === "steam";
  if (isSteamGame) {
    return (
      <DeckySteamCompactGameOverview
      onBack={onBackToDashboard}
      onOpenFullScreen={onOpenFullScreenPage}
      onViewAchievements={onOpenCompactAchievements}
      snapshot={state.data}
      />
    );
  }

  return (
    <DeckyRetroAchievementsCompactGameOverview
      achievementMode={achievementMode}
      onBack={onBackToDashboard}
      onOpenFullScreen={onOpenFullScreenPage}
      onViewAchievements={onOpenCompactAchievements}
      snapshot={state.data}
    />
  );
}
