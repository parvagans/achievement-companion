# RA data and semantic styling

Inspect `src/core/domain.ts`, `src/core/settings.ts`, `src/providers/retroachievements`, and the RA compact model before choosing a field or label. Never invent production values from a prototype.

- Hardcore is gold; Softcore is neutral/light gray. The shared shell stays navy and cyan.
- Beaten is a light completion status; Mastered is gold. Their availability and date depend on actual award metadata, not a guessed percentage.
- Points are achievement scores. RetroPoints use the verified true-ratio field. The achievement row's player percentage uses the normalized unlock-rate metric and is a percentage of players, not a completion percentage.
- `GameCommunityStats` median timings derive from RA Game Progression. `TimesUsedIn...Median` fields count contributors used in each median. The compact caption says “players”; do not reuse those counts as the game's total or as unrelated distinct-player totals. Omit a timing when its source has no valid samples.
- Achievement Mode can be Hardcore, Softcore, or Both. A single selected mode reclassifies unlock state from its own timestamps. Both retains the actual mode where known. Hidden modes leave no blank cards. The mode setting is not inferred from the prototype screenshot.
- Use the existing RA settings persistence and routes. The QAM list/detail share their state checkpoint by provider and game ID; a fresh game-to-list entry resets it, while detail B retains it.
