/** Keeps SteamHunters rates compact and distinct from Steam global percentages. */
export function formatSteamHuntersPercentage(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

/** The public achievement feed exposes a rate, while the app feed exposes the player base. */
export function formatSteamHuntersPlayersUnlocked(localPercentage: number | undefined, playersPlayed: number | undefined): string {
  if (localPercentage === undefined || playersPlayed === undefined || playersPlayed <= 0) return "—";
  const estimatedUnlocked = Math.round(playersPlayed * localPercentage / 100);
  return `≈${estimatedUnlocked.toLocaleString()} / ${playersPlayed.toLocaleString()}`;
}

/** SteamHunters app completion-time fields are expressed in whole minutes. */
export function formatSteamHuntersCompletionDuration(minutes: number): string {
  const totalMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}
