let selectedDay: number | undefined;

export function readDeckyRetroAchievementsCompactActivityDay(): number | undefined {
  return selectedDay;
}

export function setDeckyRetroAchievementsCompactActivityDay(day: number | undefined): void {
  selectedDay = day;
}

export function resetDeckyRetroAchievementsCompactActivityState(): void {
  selectedDay = undefined;
}
