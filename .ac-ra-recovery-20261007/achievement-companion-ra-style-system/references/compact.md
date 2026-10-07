# Compact RA surfaces

Inspect the current component and its Steam counterpart before changing structure:

| RA | Steam structural reference |
| --- | --- |
| `decky-retroachievements-compact-profile.tsx` | `decky-steam-compact-profile.tsx` |
| `decky-retroachievements-compact-game-overview.tsx` | `decky-steam-compact-game-overview.tsx` |
| RA branches in `decky-compact-achievement-list.tsx` | Steam branches in that shared component |
| RA branches in `decky-achievement-detail-view.tsx` | Steam branches in that shared component |

The compact game has centered RA artwork without a banner card, a centered system label, equal primary Open Full-Screen and View Achievements actions, passive progress and data sections, and conditional completion status. Hardcore and Softcore mode cards show a title above the unlock count. Hide a disabled mode entirely and let the remaining card expand. Community median cards show only available real data.

The achievement list keeps Steam row geometry and action sizes. RA adds mode/status/points/rarity meaning. The right rail's rarity is a slim progress bar plus rounded percent and “players” label; it must fit within the existing row height. `Show 5 more` and `Show all` appear together while more rows remain and share a left-right `Focusable` group. The initial page size is 12. Preserve the selected filter and mode, visible count, row ID, and scrollTop after detail B. Both selected and unfocused rows retain their RA semantic border.

The detail uses the Steam hierarchy: achievement heading and description, unlock date/time when present, provider stats, then a game action. There are no duplicate legacy action clusters. The selected Achievement Mode setting controls unlock state and which mode-specific data appears.
