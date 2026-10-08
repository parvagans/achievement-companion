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
  onHeightChange,
  secondaryActionLabel,
  onSecondaryAction,
  ariaLabel = "Steam game sections",
}: {
  readonly activeSection: DeckySteamGameSectionId;
  readonly sections: readonly DeckySteamGameSection[];
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
