/** Keeps SteamHunters rates compact and distinct from Steam global percentages. */
export function formatSteamHuntersPercentage(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}
