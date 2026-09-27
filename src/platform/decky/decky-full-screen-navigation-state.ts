import type { CompletionProgressSelectionFilter } from "./decky-completion-progress-summary-card-data";

let nextFullScreenCompletionProgressFilter: CompletionProgressSelectionFilter | undefined;

export function markNextFullScreenCompletionProgressFilter(
  filter: CompletionProgressSelectionFilter | undefined,
): void {
  nextFullScreenCompletionProgressFilter = filter;
}

export function consumeNextFullScreenCompletionProgressFilter(): CompletionProgressSelectionFilter | undefined {
  const filter = nextFullScreenCompletionProgressFilter;
  nextFullScreenCompletionProgressFilter = undefined;
  return filter;
}
