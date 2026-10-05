let selectedDay: number | undefined;

export function readDeckySteamCompactActivityDay(): number | undefined {
  return selectedDay;
}

export function setDeckySteamCompactActivityDay(day: number | undefined): void {
  selectedDay = day;
}

export function resetDeckySteamCompactActivityState(): void {
  selectedDay = undefined;
}
