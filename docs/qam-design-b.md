# Compact QAM: Design B

The Steam and RetroAchievements compact dashboards share a game-first header and
recommendation presentation. The native Decky title bar is unchanged.

- `DeckyCompactProfileHeader` stays outside the nullable Up Next card. Its 38px
  avatar-only Profile action has a 24px avatar and a provider/account-specific
  accessible name. RA retains the current-game label and active indicator.
  A separate 38px thumbtack shortcut opens Pinned Achievements. Both utility
  controls are transparent until focused, with native footer action descriptions.
- Game identity retains 46px art and uses the existing 16px title token with 1.2
  leading and two lines. Only RA displays sourced platform metadata.
- `DeckyCompactUpNextContent` retains 48px achievement art beside its label and
  two-line 14px title. Its two-line 12px description is a sibling below identity,
  spanning the recommendation width. There is no fixed/minimum recommendation
  height or empty description slot. Missing/failed achievement art releases its
  column. The existing details modal provides the complete description.
- Achievements, Pin/Unpin and suggestion options retain their action row and target
  dimensions. Secondary Skip and controller Options/List remain distinct shortcuts.
- Loading, completion and empty recommendations are passive. Details, Retry and
  Restore Suggestions remain actionable. A disappearing control or changed game
  restores a saved Up Next target to Achievements; an absent game falls back to
  Profile. Existing ref identity guards remain in place across rerenders.
- Fresh entry retains Profile focus and its existing top-scroll behavior. Return
  checkpoints take precedence. Changing initial focus to Up Next requires device
  evidence that game identity and progress remain visible.

Presentation uses shared theme roles without changing global spacing tokens,
recommendation selection, cache behavior, provider APIs or progress calculations.

## Verification

The Profile avatar has a dedicated inline-flex frame and image with explicit
24px width/height, min/max dimensions and fixed flex basis. The control is fixed
at 38px (including its border); focus only changes paint. The header uses
`minmax(0, 1fr) auto` columns and non-wrapping heading/label text. This avoids the
previous inline artwork span: its ignored width/height let a percentage-sized
image use its intrinsic dimensions, producing a 538px-tall shortcut from a 512px
avatar in local Chromium.

Run `node --import tsx scripts/check-qam-header-layout.mts` for a local headless
Chromium check (`AC_LAYOUT_BROWSER` can select the browser executable). It renders
the actual header with only native Decky/scroll boundaries substituted, measures
both providers at 268/284/320px widths with missing/32/512/2048px avatars and
normal/dark plus focused/light states, and writes measurements and a screenshot to
`.tmp/qam-header`. All 48 corrected cases measured 38px controls and 24px avatars.
This is browser geometry evidence, not a Steam Deck runtime pass.

## On-demand calendars and pinned viewer

Both calendars default to collapsed. Provider-specific localStorage preferences
survive QAM closure and restarts without backend settings. A selected date remains
active while collapsed: the disclosure shows the filter and a Clear date action.
Clearing or collapsing restores real focus to the disclosure. Existing calendars,
aggregation, day-navigation and date-filter calculations remain unchanged.

The pinned viewer uses `openDeckyStandardModal`, its native ConfirmModal/Close/Back
contract, shared content/tab styles and compact-popup ownership. Provider tabs
reflect configured accounts with credentials; counts enumerate the existing
account-scoped pin preferences. Unpin uses the same shared mutation/subscription
path as other views. Canonical publication retains completion-retirement ownership.

Hydration checks canonical/session caches first and runs missing game loads for
rows near the scroll viewport through one serial lane and existing request
coordinators, without force-refresh. Offscreen pins do not trigger requests merely
because the modal opened. It stops
on rate limiting, retains unavailable pins, reuses per-open results across tabs,
and rejects results after cancellation/account changes. It stores no second pin
database or independent canonical cache.

Details closes the viewer before opening the existing achievement modal, retaining
compact-popup ownership across the handoff. Back returns to the pin's entry.
Details → View Game opens the compact game overview. Back from that game's branch
reopens the viewer on its original provider/entry and restores the source dashboard
even for a cross-provider pin. Closing the QAM session cancels that one-shot return.
The viewer's actions are Details and Unpin; there is no View in Achievements action.
Ordinary closure restores the header thumbtack.
Unpin selects a surviving neighbor, provider tab or native Close for empty lists.

Pinned Achievements and What's New opt into the shared native Close scroll guard.
When Close is already visible, focusing it preserves its ancestors' scroll offsets
instead of letting the outer dialog re-center. Their content viewports remain
scrollable. The guard releases when Close loses focus or the modal closes and does
not prevent native navigation from revealing an offscreen Close button. Native
Close/B, modal footprint and What's New release copy are unchanged.

`node --import tsx scripts/check-qam-enhancements-layout.mts` verifies representative
Steam/RA list geometry and calendar disclosures in Chromium. Native Steam modal
dimensions, focus trapping, footer clearance and controller paths still require
the user's hardware pass. No deployment is part of this implementation.

Automated coverage includes rendered recommendation structure, long and missing
content, label variants, vanished-control/game focus decisions, provider composition,
existing QAM behavior, theme recipes and compact session restoration. TypeScript and
the production build are required. These checks do not establish physical focus or
viewport fit.

The user owns Steam Deck UI verification for this change. Check both providers:

1. Fresh QAM entry and close/reopen: header, game, progress, recommendation and
   actions fit when content permits; no unintended initial scrolling.
2. Profile full-screen return, achievement modal return, achievement-list return,
   and deep-scroll return restore the originating action and useful scroll position.
3. Directional traversal through Profile, recommendation, the horizontal action row
   and lower sections; visible native focus and working Back.
4. Pin/unpin, skip to the last recommendation, completed/empty/all-hidden states,
   Retry, suggestion-menu select/cancel, and game changes preserve useful focus.
5. No games, missing/failed artwork, long titles/descriptions, RA Beat/Master,
   Hardcore/Softcore/Both, and connection/authentication banners.
6. Dark and light themes and custom palettes: text, focus, semantic labels and
   progress remain distinguishable. Check the narrow header at the actual QAM width.
