export function scrollDeckyFocusTargetIntoView(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}
