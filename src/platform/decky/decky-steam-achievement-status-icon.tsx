export interface DeckySteamAchievementStatusIconProps {
  readonly isUnlocked: boolean;
  readonly size?: number;
}

/** Shared Steam achievement state mark for compact and full-screen rows. */
export function DeckySteamAchievementStatusIcon({
  isUnlocked,
  size = 28,
}: DeckySteamAchievementStatusIconProps): JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 28 28" width={size}>
      {isUnlocked ? (
        <>
          <circle cx="14" cy="14" fill="currentColor" r="12" />
          <path d="m8.5 14.2 3.5 3.5 7.5-7.6" fill="none" stroke="#07141d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        </>
      ) : (
        <>
          <circle cx="14" cy="14" fill="none" r="11" stroke="currentColor" strokeWidth="2" />
          <rect fill="currentColor" height="8" rx="1.5" width="10" x="9" y="12" />
          <path d="M11.5 12v-2.1a2.5 2.5 0 0 1 5 0V12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <circle cx="14" cy="15.5" fill="#07141d" r="1" />
        </>
      )}
    </svg>
  );
}
