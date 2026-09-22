import { useLayoutEffect, useRef } from "react";
import {
  DeckyFullScreenFooterOverlay,
  type DeckyFullScreenFooterNavigationItem,
} from "./decky-full-screen-footer-overlay";

export type DeckySteamGameSectionId = "overview" | "achievements" | "achievement-groups" | "community";

const STEAM_TAB_TRANSITION_SOUND_URL = "/sounds/deck_ui_tab_transition_01.wav";

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
  const soundAnchorRef = useRef<HTMLSpanElement>(null);
  const tabTransitionSoundRef = useRef<HTMLAudioElement | null>(null);

  useLayoutEffect(() => {
    const ownerDocument = soundAnchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }
    const tabTransitionSound = ownerDocument.createElement("audio");
    tabTransitionSound.preload = "auto";
    tabTransitionSound.src = STEAM_TAB_TRANSITION_SOUND_URL;
    tabTransitionSoundRef.current = tabTransitionSound;

    return () => {
      tabTransitionSound.pause();
      tabTransitionSound.removeAttribute("src");
      tabTransitionSound.load();
      tabTransitionSoundRef.current = null;
    };
  }, []);

  return (
    <>
      <span ref={soundAnchorRef} hidden aria-hidden="true" />
      <DeckyFullScreenFooterOverlay
        activeNavigationItemId={activeSection}
        ariaLabel="Steam game sections"
        navigationItems={sections satisfies readonly DeckyFullScreenFooterNavigationItem[]}
        onBack={onBack}
        onHeightChange={onHeightChange}
        onNextNavigationItem={() => {
          onNextSection();
          playSteamTabTransitionSound(tabTransitionSoundRef.current);
        }}
        onPreviousNavigationItem={() => {
          onPreviousSection();
          playSteamTabTransitionSound(tabTransitionSoundRef.current);
        }}
      />
    </>
  );
}

function playSteamTabTransitionSound(sound: HTMLAudioElement | null): void {
  if (sound === null) {
    return;
  }

  sound.currentTime = 0;
  void sound.play().catch(() => undefined);
}
