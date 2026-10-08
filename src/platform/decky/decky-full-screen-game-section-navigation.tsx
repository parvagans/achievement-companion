import {
  DeckyFullScreenFooterOverlay,
  type DeckyFullScreenFooterNavigationItem,
} from "./decky-full-screen-footer-overlay";

export type DeckyFullScreenGameSectionId = "overview" | "achievements" | "achievement-groups" | "subsets" | "community";

export interface DeckyFullScreenGameSection {
  readonly id: DeckyFullScreenGameSectionId;
  readonly label: string;
}

export function buildFullScreenGameSections({
  provider,
  hasAchievementGroups,
  hasSubsets,
  hasCommunity,
}: {
  readonly provider: "steam" | "retroachievements";
  readonly hasAchievementGroups?: boolean;
  readonly hasSubsets?: boolean;
  readonly hasCommunity?: boolean;
}): readonly DeckyFullScreenGameSection[] {
  return [
    { id: "overview", label: "Overview" },
    { id: "achievements", label: "Achievements" },
    ...(provider === "steam" && hasAchievementGroups === true
      ? [{ id: "achievement-groups" as const, label: "DLC / Groups" }]
      : []),
    ...(provider === "retroachievements" && hasSubsets === true
      ? [{ id: "subsets" as const, label: "Subsets" }]
      : []),
    ...(hasCommunity === true ? [{ id: "community" as const, label: "Community" }] : []),
  ];
}

export function getAdjacentFullScreenGameSectionId(
  sections: readonly DeckyFullScreenGameSection[],
  currentSection: DeckyFullScreenGameSectionId,
  direction: "previous" | "next",
): DeckyFullScreenGameSectionId {
  const currentIndex = sections.findIndex((section) => section.id === currentSection);
  const nextIndex = direction === "previous"
    ? currentIndex <= 0 ? sections.length - 1 : currentIndex - 1
    : currentIndex < 0 || currentIndex === sections.length - 1 ? 0 : currentIndex + 1;
  return sections[nextIndex]?.id ?? "overview";
}

export function DeckyFullScreenGameSectionNavigation({
  activeSection,
  sections,
  onPreviousSection,
  onNextSection,
  onHeightChange,
  secondaryActionLabel,
  onSecondaryAction,
  ariaLabel = "Game sections",
}: {
  readonly activeSection: DeckyFullScreenGameSectionId;
  readonly sections: readonly DeckyFullScreenGameSection[];
  readonly onPreviousSection: () => void;
  readonly onNextSection: () => void;
  readonly onHeightChange: (height: number) => void;
  readonly secondaryActionLabel?: string;
  readonly onSecondaryAction?: (document: Document) => void;
  readonly ariaLabel?: string;
}): JSX.Element {
  return (
    <DeckyFullScreenFooterOverlay
      activeNavigationItemId={activeSection}
      ariaLabel={ariaLabel}
      navigationItems={sections satisfies readonly DeckyFullScreenFooterNavigationItem[]}
      onHeightChange={onHeightChange}
      onNextNavigationItem={onNextSection}
      onPreviousNavigationItem={onPreviousSection}
      {...(secondaryActionLabel !== undefined ? { secondaryActionLabel } : {})}
      {...(onSecondaryAction !== undefined ? { onSecondaryAction } : {})}
    />
  );
}
