const navigationSounds = new WeakMap<Document, HTMLAudioElement>();

/** GamepadUI does not play its move cue when a section transfers focus itself. */
export function playDeckySteamNavigationSound(document: Document): void {
  let sound = navigationSounds.get(document);
  if (sound === undefined) {
    sound = document.createElement("audio");
    sound.preload = "auto";
    sound.src = "/sounds/deck_ui_navigation.wav";
    navigationSounds.set(document, sound);
  }
  sound.currentTime = 0;
  void sound.play().catch(() => undefined);
}
