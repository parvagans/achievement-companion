import {
  DeckyFullScreenFooterOverlay,
  type DeckyFullScreenFooterNavigationItem,
} from "./decky-full-screen-footer-overlay";

export type DeckySteamGameSectionId = "overview" | "achievements" | "achievement-groups" | "community";


export interface DeckySteamGameSection {
  readonly id: DeckySteamGameSectionId;
  readonly label: string;
}

export function getAdjacentSteamGameSectionId(
  sections: readonly DeckySteamGameSection[],
  currentSection: DeckySteamGameSectionId,
  direction: "previous" | "next",
): DeckySteamGameSectionId {
  const currentIndex = sections.findIndex((section) => section.id === currentSection);
  const nextIndex = direction === "previous"
    ? currentIndex <= 0 ? sections.length - 1 : currentIndex - 1
    : currentIndex < 0 || currentIndex === sections.length - 1 ? 0 : currentIndex + 1;
  return sections[nextIndex]?.id ?? "overview";
}

export function DeckySteamGameSectionNavigation({
  activeSection,
  sections,
  onPreviousSection,
  onNextSection,
  onBack,
  onHeightChange,
}: {
  readonly activeSection: DeckySteamGameSectionId;
  readonly sections: readonly DeckySteamGameSection[];
  readonly onPreviousSection: () => void;
  readonly onNextSection: () => void;
  readonly onBack: () => void;
  readonly onHeightChange: (height: number) => void;
}): JSX.Element {
  return (
    <DeckyFullScreenFooterOverlay
        activeNavigationItemId={activeSection}
        ariaLabel="Steam game sections"
        navigationItems={sections satisfies readonly DeckyFullScreenFooterNavigationItem[]}
        onBack={onBack}
        onHeightChange={onHeightChange}
        onNextNavigationItem={onNextSection}
        onPreviousNavigationItem={onPreviousSection}
      />
  );
}
