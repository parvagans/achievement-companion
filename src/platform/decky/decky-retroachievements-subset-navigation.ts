/** Extends the existing first-card boundary to include the discovery action. */
export function getRetroAchievementsFirstSubsetTarget(source: HTMLElement, direction: "up" | "down"): HTMLElement {
  const container = source.closest<HTMLElement>("[data-achievement-companion-ra-subset-container]");
  const root = source.closest<HTMLElement>("[data-achievement-companion-ra-subsets-section]");
  if (direction === "up") return root?.querySelector<HTMLElement>("[data-ra-subset-discovery-action] [role='button']:not([aria-disabled='true'])") ?? source;
  return container?.querySelector<HTMLElement>("[data-achievement-companion-achievement-id]")
    ?? root?.querySelectorAll<HTMLElement>("[data-achievement-companion-ra-subset-id]")[1] ?? source;
}
