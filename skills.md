# Decky Compact Panel Reference

Reusable notes for Achievement Companion compact Quick Access Menu work.

## Primary files

- `src/platform/decky/bootstrap.tsx` — compact-panel layout, provider chooser cards, Game Page Badge settings, focus behavior, and compact-panel state transitions.
- `src/index.tsx` — Decky plugin metadata and the compact-panel header title (`titleView`).
- `src/platform/decky/decky-game-page-achievement-bubble.tsx` — the achievement badge rendered on Steam game pages, separate from the compact-panel settings.
- `tests/createAppServices.test.ts` — source-contract and behavior checks that cover compact-panel structure.

## Provider chooser contract

- Keep Steam, RetroAchievements, and Provider Settings as separate controller-focusable actions.
- Preserve `Focusable` activation, Back behavior, and focus-driven scrolling when changing visual styles.
- Configured providers display `Configured`; do not expose `Connected` as the provider-selection status.
- Provider rows use the established blue accent for Steam/RetroAchievements and a neutral settings treatment. Setup states may use the existing amber accent.
- Decorative provider icons, status dots, and chevrons must not create additional focus stops.

## Compact-panel typography and color

- Provider names are styled by `getChooserProviderCardTitleStyle` in `bootstrap.tsx`.
- Provider status text is styled by `getChooserProviderCardStatusStyle` in `bootstrap.tsx`.
- Game Page Badge labels and descriptions use `getGamePageBadgeLabelStyle` and `getGamePageBadgeDescriptionStyle`.
- `ToggleField`, `DropdownItem`, and `PanelSection` are native `@decky/ui` components. Pass styled React nodes to their `label`/`description` props when local typography or color is required; do not assume they accept arbitrary `style` props.
- Keep the compact-panel title on one line through `titleView` in `src/index.tsx` when the native header wraps it.

## Controller and layout safeguards

- Treat each provider/settings card as one focus stop. Do not add focusable wrappers around decorative content.
- Preserve one-press A activation and sensible focus restoration after returning from a provider dashboard or settings.
- Keep cards readable at Quick Access Menu width; avoid fixed desktop widths and horizontal overflow.
- Visual changes are not validated by TypeScript alone. Device/runtime verification is separate and must follow the Home Steam Deck no-copy/no-restart workflow.

## Validation

- `npm.cmd run typecheck`
- `git diff --check`
- Run the focused relevant test when available. The large `tests/createAppServices.test.ts` suite currently contains unrelated baseline failures; report those separately rather than hiding them.
