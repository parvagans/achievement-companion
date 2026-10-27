import type { NormalizedAchievement } from "@core/domain";
import { getAchievementTypeBadgeDescriptor, getNativeAchievementTypeLabelStyle } from "./decky-achievement-type-badge";
import { nativeAchievementId } from "./decky-native-achievement-jump";

const ROW_SELECTOR = "div[style*='position: absolute']";

interface DecoratedCard {
  readonly label: HTMLElement;
  readonly title: HTMLElement;
  readonly previousTitlePadding: string;
  readonly previousTitleBoxSizing: string;
}

/** Adds semantic labels to the native full achievement list, not the Your Stuff carousel. */
export function observeNativeAchievementClassifications(
  document: Document,
  getAchievements: () => readonly NormalizedAchievement[] | undefined,
): () => void {
  const ownerWindow = document.defaultView;
  if (ownerWindow === null || document.body === null) return () => undefined;
  const decorated = new Map<HTMLElement, DecoratedCard>();
  let frame: number | undefined;
  let disposed = false;

  const clear = (card: HTMLElement): void => {
    const existing = decorated.get(card);
    if (existing === undefined) return;
    existing.label.remove();
    existing.title.style.paddingRight = existing.previousTitlePadding;
    existing.title.style.boxSizing = existing.previousTitleBoxSizing;
    decorated.delete(card);
  };

  const sync = (): void => {
    frame = undefined;
    if (disposed) return;
    const achievements = getAchievements();
    const byId = new Map<string, NormalizedAchievement>(achievements?.map((achievement) => [`ra:${achievement.achievementId}`, achievement] as const));
    const cards = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
    const visible = new Set(cards);
    for (const card of decorated.keys()) if (!visible.has(card) || !card.isConnected) clear(card);

    for (const card of cards) {
      const id = nativeAchievementId(card);
      const achievement = id === undefined ? undefined : byId.get(id);
      const classification = achievement?.classification;
      const descriptor = getAchievementTypeBadgeDescriptor(classification);
      const isListRow = card.parentElement?.style.position === "relative" && card.style.position === "absolute";
      const title = achievement === undefined ? undefined : [...card.querySelectorAll<HTMLElement>("div")].find((element) =>
        element.children.length === 0 && element.textContent?.trim() === achievement.title,
      );
      if (descriptor === undefined || !isListRow || title === undefined) {
        clear(card);
        continue;
      }
      const current = decorated.get(card);
      if (current !== undefined && current.label.parentElement === card && current.title === title
        && current.label.dataset["achievementCompanionClassificationId"] === id
        && current.label.textContent === descriptor.label) continue;
      clear(card);

      const label = document.createElement("span");
      label.dataset["achievementCompanionClassificationId"] = id;
      label.textContent = descriptor.label;
      Object.assign(label.style, {
        ...getNativeAchievementTypeLabelStyle(classification),
        pointerEvents: "none",
        position: "absolute",
        right: "10px",
        top: "15px",
        zIndex: "1",
      });
      decorated.set(card, {
        label,
        title,
        previousTitlePadding: title.style.paddingRight,
        previousTitleBoxSizing: title.style.boxSizing,
      });
      card.append(label);
      title.style.boxSizing = "border-box";
      title.style.paddingRight = `${Math.ceil(label.getBoundingClientRect().width) + 24}px`;
    }
  };

  const schedule = (): void => {
    if (disposed || frame !== undefined) return;
    frame = ownerWindow.requestAnimationFrame(sync);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
    for (const card of decorated.keys()) clear(card);
  };
}
