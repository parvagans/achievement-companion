# Verified Steam Deck runbook

Read this entire runbook before using the Deck. Run commands from the repository
root on Windows PowerShell. The single interface is:

```powershell
node tools/deck/cli.mjs help
```

All connection constants are centralized in `tools/deck/config.mjs`.

## Connection invariants

Use:

```powershell
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"
$sshConfig = "C:\Users\aingl\.ssh\config"
& $ssh -F $sshConfig -o BatchMode=yes -o ConnectTimeout=8 ghast "echo connected"
```

Never call bare `ssh ghast`; the Codex PowerShell runtime may not load the user's
OpenSSH configuration. Do not resolve `ghast` via DNS, add a `HostName` override,
or repeatedly retry an unresolved alias. If the first connection fails, inspect
`C:\Users\aingl\.ssh\config` before any other connection action.

This is a permanent connection rule. Codex can run under a different
PowerShell/OpenSSH environment from the user's normal terminal, so a bare
`ssh ghast` alias-resolution failure can be a false negative and is not
sufficient evidence that the Deck is unreachable. Every Deck SSH operation,
including the initial connectivity test, must use the explicit Windows OpenSSH
executable and `-F C:\Users\aingl\.ssh\config` shown above. Diagnose or modify
the SSH configuration only when that explicit command also fails.

No `ssh -t`, sudo password, sudoers edit, SSH credential request, or SSH config
change is part of this workflow.

Verified service operations:

```powershell
& $ssh -F $sshConfig -o BatchMode=yes -o ConnectTimeout=8 ghast "systemctl is-active plugin_loader.service"
& $ssh -F $sshConfig -o BatchMode=yes -o ConnectTimeout=8 ghast "sudo -n /usr/bin/systemctl restart --no-block plugin_loader.service"
```

Healthy status is exactly `active`. Prefer the CLI's bounded implementation:

```powershell
node tools/deck/cli.mjs restart-decky --timeout-ms 30000
```

Restart only after backend/plugin Python changes, when the plugin/backend is
wedged, or when investigation proves it necessary. A normal frontend change does
not require a Decky restart.

## Installed locations

- Plugin root: `/home/deck/homebrew/plugins/achievement-companion`
- Frontend bundle: `/home/deck/homebrew/plugins/achievement-companion/dist/index.js`
- Backend entry: `/home/deck/homebrew/plugins/achievement-companion/main.py`
- Plugin logs: `/home/deck/homebrew/logs/achievement-companion`
- Steam logs: `/home/deck/.local/share/Steam/logs`
- Local frontend artifact: `dist/index.js`
- Local debug artifacts: `%TEMP%\achievement-companion-deck-artifacts`

## Build and frontend deployment

The proven fast loop is:

```powershell
node tools/deck/cli.mjs deploy
```

It fails on the first error and performs, in order:

1. Build `dist/index.js` using the repository's clean, notice-sync, and Rollup
   steps.
2. Start or reuse the owned CDP tunnel.
3. Copy `dist/index.js` and every emitted file in `dist/assets` with the explicit
   Windows `scp.exe`, then verify local/remote SHA-256 equality for the bundle
   and each asset.
4. Rediscover `SharedJSContext`.
5. execute `Page.reload({ ignoreCache: true })`.
6. wait, with a bounded timeout, for `document.readyState === "complete"`,
   `DeckyPluginLoader`, `DFL`, and a populated Steam `appStore`.

Useful individual operations:

```powershell
node tools/deck/cli.mjs build
node tools/deck/cli.mjs copy
node tools/deck/cli.mjs reload
node tools/deck/cli.mjs ready --timeout-ms 180000
node tools/deck/cli.mjs deploy --no-build
```

Do not replace the reload step with a service restart for frontend work.

## CDP tunnel and targets

Steam CEF listens on Deck loopback port `8080`. The owned local tunnel defaults
to `127.0.0.1:18081`; its state file is
`%TEMP%\achievement-companion-cdp-tunnel-18081.json`. Do not scatter or duplicate
these connection numbers; update `tools/deck/config.mjs` if configuration changes.

```powershell
node tools/deck/cli.mjs tunnel up
node tools/deck/cli.mjs tunnel status
node tools/deck/cli.mjs tunnel down
node tools/deck/cli.mjs targets
```

`tunnel up` validates an existing owned tunnel, avoids duplicates, detects stale
state, and recreates a dead tunnel. `tunnel down` stops only the process recorded
in the owned state file.

Expected target families include:

- `SharedJSContext`
- `Steam Big Picture Mode`
- `QuickAccess_uid*`
- `MainMenu_uid*`
- `notificationtoasts_uid*`

Target IDs and `uid*` suffixes change after reload. Every operation rediscovers
targets by stable title/URL metadata; never persist a target ID.

Examples:

```powershell
node tools/deck/cli.mjs eval --target shared --expression "document.title"
node tools/deck/cli.mjs screenshot --mode cdp --target "Steam Big Picture Mode"
node tools/deck/cli.mjs screenshot --mode cdp --target QuickAccess
```

## Controller input

Use the CLI so it selects the visible target and applies a bounded delay:

```powershell
node tools/deck/cli.mjs up
node tools/deck/cli.mjs down
node tools/deck/cli.mjs left
node tools/deck/cli.mjs right
node tools/deck/cli.mjs a
node tools/deck/cli.mjs b
node tools/deck/cli.mjs y
node tools/deck/cli.mjs l1
node tools/deck/cli.mjs r1
node tools/deck/cli.mjs qam
node tools/deck/cli.mjs input down down a --delay-ms 120
```

`input` validates the whole sequence, dispatches it through one CDP WebSocket
session, applies the configurable inter-input delay (safe default: 160 ms), and
returns one final structured checkpoint with route, semantic focus, complete
`.gpfocus`, target inventory, and recovery status. A dispatch failure is explicit.

Verified mappings:

| Deck input | Mechanism |
| --- | --- |
| UP/DOWN/LEFT/RIGHT | CDP `Input.dispatchKeyEvent`, Arrow keys |
| A | Focused GamepadUI `vgp_onbuttondown`, `detail.button = 1` (`OK`) |
| B | CDP `Input.dispatchKeyEvent`, Escape |
| Y | Focused GamepadUI `vgp_onbuttondown`, `detail.button = 4` (`OPTIONS`) |
| QAM | Ctrl+2 in `Steam Big Picture Mode` |
| L1 | GamepadUI `vgp_onbuttondown`, `detail.button = 5` |
| R1 | GamepadUI `vgp_onbuttondown`, `detail.button = 6` |

A, Y, L1, and R1 are GamepadUI events dispatched in the active visible Steam target;
A is targeted at the actual focused element so native text fields open Steam's
keyboard. Do not substitute PageUp, PageDown, DOM clicking, or a direct route
mutation.

GamepadUI's abstract face-button values are not the raw controller enum: `3` is
`SECONDARY` (X) and `4` is `OPTIONS` (Y). A visible `Y` footer action must use
Decky's `onOptionsButton` / `onOptionsActionDescription`, and the harness `y`
command must dispatch button `4`. Using `onSecondaryButton` while labeling the
action Y creates a false automated pass for X and does not handle physical Y.

## Focus inspection

At a meaningful checkpoint, or while diagnosing an unexpected state, run:

```powershell
node tools/deck/cli.mjs focus
```

Routine known paths should use `input`, `navigate`, or a named scenario so the
harness performs intermediate focus checks internally. Do not insert a separate
Codex reasoning cycle between every deterministic D-pad press.

The probe reports all `.gpfocus` elements plus activeElement context, visible
label/text, tag/role, classes, attributes, rectangle, visibility, and navigation
clues. A single visible `.gpfocus` entry with the intended semantic label is the
source of truth. `document.activeElement` is only supporting context.

For static diagnostics:

```powershell
node tools/deck/cli.mjs focus-order
```

This inventories visible/offscreen controls, rectangles, clipping clues, scroll
margins, duplicate labels, and invisible focusables. DOM order is never proof of
GamepadUI navigation order; actual input followed by `focus` is the oracle.

Achievement Companion's current Steam implementation restores a real `.gpfocus`
node after compact and full-screen child-route returns. A visible cyan ring with
an empty `.gpfocus` result is a failure; capture it rather than treating the ring
as proof.

## Semantic navigation and named scenarios

Keep target and route knowledge in `tools/deck/navigation.mjs` and
`tools/deck/scenarios.mjs`; discover it without reading implementation code:

```powershell
node tools/deck/cli.mjs scenario list
node tools/deck/cli.mjs navigate down --until steam-compact-achievements --max 30 --delay-ms 120
node tools/deck/cli.mjs goto steam-compact --mode fast
node tools/deck/cli.mjs goto steam-fullscreen-games-search --mode evidence
```

`navigate` accepts `up`, `down`, `left`, or `right`, checks current focus first,
sends one controller-equivalent input at a time inside the harness, and stops at
the requested semantic target or the explicit maximum. It returns moves made,
route/context, final `.gpfocus`, and match state; it cannot loop indefinitely.

Physically verified named scenarios:

| Scenario | Verified test-ready state |
| --- | --- |
| `steam-compact` | Compact Steam profile, `Open Steam profile full-screen` |
| `steam-compact-profile` | Alias for compact Steam profile |
| `steam-compact-activity-calendar` | Compact Steam Profile, current Activity calendar day |
| `steam-compact-game` | First recent game compact page, `Open game full-screen` |
| `steam-view-achievements` | Retained profile route, Activity section and first achievement row |
| `steam-fullscreen-profile` | `/routes/achievement-companion/full-screen/profile/steam`, Profile |
| `steam-fullscreen-games` | Same retained route, Games |
| `steam-fullscreen-games-search` | Games, `Search your games` |
| `steam-fullscreen-perfect` | Games, `Perfected (count)` |
| `steam-fullscreen-activity` | Same retained route, Activity |
| `steam-fullscreen-activity-filter` | Activity, selected underline filter |
| `steam-fullscreen-settings` | Same retained route, Settings, `Account, selected` in the Account / Full-Screen Settings / Updates pill row |
| `ra-compact` | Fresh RA API-refresh loading state, then compact Profile with `Open Profile Full-Screen` |
| `ra-compact-profile` | Alias for the compact RA Profile |
| `ra-compact-activity-calendar` | Compact RA Activity Calendar with the current day focused inside the grid |
| `ra-compact-selected-day` | Latest active RA calendar date selected, with matching achievement and grouped game rows |
| `ra-compact-recent-activity` | First newest-sorted RA recent achievement row |
| `ra-compact-recently-played` | Focused RA recently played game row |
| `ra-compact-settings` | RA QAM Settings with the API settings action focused |
| `ra-fullscreen-profile` | `/routes/achievement-companion/full-screen/profile/retroachievements` |
| `ra-view-all-achievements` | `/routes/achievement-companion/full-screen/achievement-history/retroachievements` |

### RetroAchievements QAM entry and route contract

On a fresh Achievement Companion QAM visit, the provider chooser opens with the
single real `.gpfocus` on `RetroAchievements provider, configured` (or
`RetroAchievements provider, needs setup` when credentials are absent). This is
the RA entry point. Press A on that focused provider card to open the
RetroAchievements compact dashboard. Do not open the separate QAM `Provider
Settings` action to choose a provider; that action opens the shared full-screen
settings route.

The verified QAM provider-entry focus was captured on the physical Deck in the active `QuickAccess` target; after real A, the visible dashboard showed provider
`RetroAchievements`, account `parvagans`, and the recent `Dragon Ball Z: The
Legacy of Goku II` game. QAM's CEF frame can report `/routes/login` while its
visible provider chooser/dashboard is active; use the semantic `.gpfocus` and
visible provider label as the QAM assertion, not that frame URL.

Achievement Companion full-screen routes use these exact RetroAchievements
provider IDs:

| Surface | RA route |
| --- | --- |
| Profile | `/routes/achievement-companion/full-screen/profile/retroachievements` |
| Game | `/routes/achievement-companion/full-screen/game/retroachievements/:gameId` |
| Achievement | `/routes/achievement-companion/full-screen/achievement/retroachievements/:gameId/:achievementId` |
| Achievement history | `/routes/achievement-companion/full-screen/achievement-history/retroachievements` |
| Completion progress | `/routes/achievement-companion/full-screen/completion-progress/retroachievements` |
| Provider-specific settings | `/routes/achievement-companion/full-screen/provider-settings/retroachievements` |
| Shared provider settings | `/routes/achievement-companion/full-screen/settings` (provider is selected in the page footer; this route has no provider ID) |

When adding an RA automation scenario, assert the RA provider ID in the route
and provider context. Never substitute `/steam` routes or the shared settings
route for an RA profile/game/achievement route.

Scenarios inspect current state, use actual controller/GamepadUI navigation, and
prefer labels, stable attributes, routes, and visible context over DOM position.
QAM recovery uses bounded B input to return from content to the tab strip, then
semantic targets (`quickaccess_tab_999`, `Achievement Companion`, and the
fresh chooser focus `RetroAchievements provider, configured`). Compact Profile
readiness is context-based so retained row
focus can be normalized semantically instead of treated as a load failure.

### Physically verified RA compact interactions

These RA QAM patterns were exercised with real controller input on the Deck. The
route table above remains authoritative; the shared /full-screen/settings
route has no provider suffix, so verify that RetroAchievements is the selected
provider in its footer instead of expecting a provider-specific URL.

- A fresh Achievement Companion visit focuses the configured RetroAchievements
  provider. A starts a live dashboard API refresh and immediately shows the RA
  compact loading surface (`raCompactLoading: true`). Wait semantically for the
  completed `ra-compact-profile-context`; do not use a fixed delay or treat the
  loading surface as a failure. The completed profile focuses Open Profile
  Full-Screen as its initial action. Opening the RA full-screen Profile uses the existing
  /routes/achievement-companion/full-screen/profile/retroachievements route;
  B returns to the compact profile action and its viewport resets to the top.
- The profile's Recently Played current-game card remains between the
  full-screen profile action and RetroAchievements Overview. Its View
  achievements action uses the existing RA game/achievement navigation.
- Down from the current-game View achievements action reaches the first visible
  mode points card (Hardcore when both modes are shown, Softcore when it is the
  only mode). This is a passive `data-ra-profile-overview-focus` stop; A leaves
  the profile in place. The next Down reaches the passive Beaten card with
  `data-ra-profile-beaten-focus`. The other overview and completion cards do
  not add controller stops. The card text keeps the established icon-and-text
  layout; do not add symmetric spacer columns to center it against the card.
- Open RetroAchievements Settings from the profile. Rank Display and
  Achievement Mode are native Decky DropdownItem controls; Site, Casual, Both
  ranks and Hardcore, Softcore, Both modes were exercised. Closing the native
  menu returns focus to the exact dropdown trigger. Open RetroAchievements API
  settings full-screen routes to /routes/achievement-companion/full-screen/settings
  with RetroAchievements selected and Username focused. B returns to that QAM
  API action; B again returns to the profile's Settings action.
- The RA Activity Calendar matches Steam's focus pattern: the calendar card is
  one focus stop and shows its outer focus ring before A. A enters the day grid;
  only the focused day receives the compact day focus ring. B returns focus to
  the calendar entry. While the grid remains active it shows `Press B to exit`.
  Selecting a day does not exit the grid: Down may move into the filtered
  activity rows, and returning Up through the calendar entry restores focus to
  the selected or last-focused day without requiring B followed by A. The
  heatmap legend uses five 10x10 square swatches with
  Steam's blue/cyan intensity ramp and geometry.
- In the calendar grid, Up/Down moves one day and Left/Right one week. A selects
  a local date. The ra-compact-selected-day EVIDENCE scenario was run after
  deployment; if the grid is already active it sends B to return to the card,
  then selects a date with real unlock data and verifies the actual achievements
  under Recent Activity and games grouped by that date's unlocks under Recently
  Played. Verify selected-day labels and counts against live data rather than
  assuming a particular date has activity.
- RA game/list/detail automation is maintained as `ra-compact-game`,
  `ra-game-view-achievements`, and `ra-game-achievement-detail-return`.
  The first route starts from a recent game row, waits through the RA API
  loading state, and lands on `Open game full-screen`. The second follows the
  equal primary `View game achievements` action and waits for `All (N)` in the
  QAM achievement list. The third opens the first focused achievement with A,
  then uses B and checks its stable achievement ID and exact QAM `scrollTop`.
  An EVIDENCE run on the 0.7.0 build of October 7, 2026 verified these
  controller routes and early-row return; the observed scroll offset was 0
  before and after B. Deep-scroll restoration and every filter combination
  remain to be checked on the device before claiming them verified.
- QAM automation context now includes `raCompactGame`,
  `raCompactAchievementList`, and `raCompactAchievementDetail`. The list rows
  expose `data-achievement-companion-compact-achievement-id` and
  `data-ac-ra-achievement-tone`; semantic matchers should use those stable
  attributes, not title text or ordinal row positions. QAM can occasionally
  reopen with no visible `.gpfocus` after hot reload. The RA setup scenario
  closes and reopens QAM once, then waits for any visible Quick Access focus;
  that focus may already be the RetroAchievements provider rather than a tab.

Use the maintained provider-aware harness and report physical results only for
scenarios run in EVIDENCE mode after deployment.
### FAST mode

Use `--mode fast` for repeated development cycles after route and expected state
are known. It uses a 120 ms scenario delay, reuses the tunnel, batches inputs,
uses one CDP session per deterministic or semantic segment, omits success logs
and screenshots, and checks `.gpfocus` only at meaningful boundaries. Failures
still capture a Gamescope screenshot and full structured state.

### EVIDENCE mode

Use `--mode evidence` before declaring a controller/UI regression passing. It
uses a 200 ms scenario delay and captures Gamescope screenshots for meaningful
scenario checkpoints while retaining route and `.gpfocus` assertions. Add
explicit controller inputs and screenshots for the behavior under test. Example:

```powershell
node tools/deck/cli.mjs goto steam-fullscreen-games-search --mode evidence
node tools/deck/cli.mjs input a --delay-ms 200
node tools/deck/cli.mjs screenshot --mode gamescope
node tools/deck/cli.mjs input b --delay-ms 200
node tools/deck/cli.mjs screenshot --mode gamescope
```

The scenario accelerates setup. Opening the keyboard, pressing B, proving the
keyboard dismissed, proving Games stayed open, and proving Search focus restored
are the regression and must remain real controller/GamepadUI operations. Apply
the same rule to Back routes, focus restoration, tabs, and child navigation;
never bypass the behavior under test with DOM clicks, route mutation, fake focus,
or synthetic application state.

## Session reuse and performance profiling

The owned SSH CDP tunnel persists across CLI invocations and is health-checked
before reuse. Within a batched input or navigate/input-until segment, one CDP
WebSocket is reused for dispatch and focus evaluation. Targets are discovered by
stable metadata at operation boundaries and after transitions; IDs are never
cached across hard reload, CEF/Decky restart, or target recreation. If a selected
target disappears mid-checkpoint, the harness rediscovers and retries once, then
fails clearly.

Profile the physical path without guessing:

```powershell
node tools/deck/cli.mjs profile
node tools/deck/cli.mjs profile --no-screenshot
```

The verified representative profile measured about 355 ms for explicit SSH,
543 ms for first tunnel validation/creation, 63 ms for target discovery, 71 ms
for active-target probing, 124 ms for WebSocket open plus round trip, 467 ms for
a full focus checkpoint, and 1.84 s for a Gamescope screenshot. Local startup
was about 194 ms for PowerShell, 52 ms for Node, and 75 ms for CLI help. The main
iteration win is eliminating many process/reasoning/SSH/CDP cycles, reusing one
session per segment, and avoiding success screenshots—not weakening verification.

## Scenario failure contract

On any semantic mismatch, bounded maximum, target/session failure, or readiness
timeout, the scenario stops. It returns the current route/context and full
`.gpfocus`, captures a Gamescope screenshot (CDP fallback), and collects relevant
logs when requested or in EVIDENCE failure mode. Do not keep pressing buttons or
hide a regression behind wider retry counts. Recover only from observed state.

## Achievement Companion Steam regression probes

Use semantic labels and stable domain identities; never replay a blind number of
inputs. These sequences were proven against the current Steam implementation.

### Compact entry and viewport

- Provider entry restores the compact Profile's remembered semantic focus after
  asynchronous Steam and SteamHunters data settle. The `steam-compact` scenario
  then navigates UP, bounded by `steam-compact-profile`, to normalize its
  test-ready focus to `Open Steam profile full-screen`.
- The compact Profile places Activity Calendar as its own section between SteamHunters Profile and Recent Activity. Its fixed card defaults to four weeks, and every supported 4/6/8/10/12-week choice fills the same width and height. The calendar initially exposes one `Activity calendar, Last N weeks. Press A to use.` focus stop; days remain passive until A enters the grid. The active grid shows `Press B to exit`, and B returns to the calendar entry without closing QAM. Within the active grid, Up/Down moves one day and Left/Right moves one week. A selects a local date; selecting that date again clears it without exiting the grid. Down may move into the filtered activity rows, and returning Up through the calendar entry restores the selected or last-focused day without another B/A cycle. While selected, Recent Activity shows every achievement from that date and Recently Played shows only games represented by those unlocks, regardless of configured QAM count limits. The date survives achievement detail -> B and clears with the compact session. Verify with `node tools/deck/cli.mjs goto steam-compact-activity-calendar --mode evidence`.
- Traverse every compact Profile control with real UP/DOWN input. Each focused
  `.gpfocus` rectangle must remain inside the QuickAccess viewport, through the
  final `Settings` action.
- Compact game pages initially focus `Open game full-screen`. Their informational
  cards are native readable focus stops; traverse through `Game Info section`
  and confirm each focused card scrolls into view.
- Close and reopen QAM, re-enter Achievement Companion, and require one visible
  semantic `.gpfocus` before continuing.

### Exact child-route restoration

For achievement and game return checks, record the semantic label before A and
compare it with `.gpfocus` after B. Returning merely to the list or nearest row
does not pass.

1. In compact achievements, test an early row, a middle row, and a row that
   requires scrolling. A opens detail; detail must focus its real achievement
   heading (for example `Achievement Viaduct Dominator III`), never the outer
   `Achievement details` wrapper. Navigate to `Open <game> compact game overview`
   and press A to prove the game action remains focusable; B must restore the
   exact originating achievement row and keep it visible.
2. In full-screen Activity, open a timestamped achievement such as the currently
   visible target, then B. The same achievement label must be focused on return.
3. In full-screen Games, open a game, then B. The exact originating game label
   must be focused.
4. In a full-screen game achievement list, open a scrolled row, then B. The exact
   row must be focused inside the visible viewport; inspect its rectangle and the
   scroll container bounds.
   On a long list, move to `steam-game-achievements-more`, press A, and verify
   focus transfers to the first newly revealed row. Open it and press B to
   confirm the exact row returns. Rows render in increments of 36.
5. In DLC / Groups, expand Base Game with A, move to an achievement, open it with
   A, then press B. The same group must remain expanded and the exact originating
   achievement row must regain visible `.gpfocus`; returning to Overview fails.

### Full-screen primitive focus contracts

Treat each visible full-screen section as one active GamepadUI focus tree. Unmount
inactive section trees rather than leaving hidden focusable nodes mounted. Build
content navigation with nested `Focusable` containers and explicit directional
ownership only where Steam's geometric navigation is ambiguous. Do not solve
these paths with React keyboard handlers, arbitrary DOM `.focus()`, or a second
custom navigation system.

For full-screen Games, verify the complete graph rather than only its first edge:

1. Initial focus is the first game row. Up moves to `Search your games`; another
   Up stays there.
2. Left/Right traverses Search, All, Played, Unfinished, Perfected, Skipped, and
   Sort. The outer boundaries stay on Search or Sort. From any toolbar control,
   Down moves to the first visible game row.
3. Down moves through every rendered row, not only row one. Left/Right on a game
   row stays on that row. Up from row one returns to Search.
4. Down from row 12 reaches `Show 12 more games`; Up returns to row 12. A expands
   the list and transfers `.gpfocus` to the first appended row. Up/Down must then
   continue across the old/new boundary.
5. Search A opens Steam's keyboard; B closes it and restores Search. Sort A opens
   the native modal menu; B closes it and restores Sort. Opening a game and B must
   restore the exact originating game row.

For full-screen Activity, Up from the first achievement moves once to
`All Unlocks`; repeated Up stays there, and one Down returns to the first
achievement. Never accumulate a hidden directional offset that requires matching
extra Down presses. All five filters must remain visible in one row. Moving
Down through the initial 24 achievements must load the next rows automatically:
row 24 moves directly to row 25 with no Show More control.

The Activity calendar accepts only 4, 6, 8, 10, or 12 complete Monday-Sunday
weeks and defaults to 12. The Full-Screen Settings pill panel provides the same native 4/6/8/10/12-week selector independently from QAM. Changing the
week total changes the columns inside the existing card; the card's outer width
and height remain fixed. Heat uses four nonzero levels derived from the nearest
rank 90th percentile of nonzero counts in the visible window, so an old outlier
cannot flatten recent activity. Future days in the current week are passive.

The calendar is part of the controller tree. From `Current Streak`, Right enters
today; Up/Down moves one day and Left/Right moves one week. A on a calendar day
filters the achievement list to that local date, and A again clears it. Selecting
any normal Activity filter clears the date. Down from Sunday enters the first
filtered achievement, and Right from an achievement returns to the selected day
(or today when no date is selected). The selected date remains active
through achievement detail -> B and clears if a later week setting removes it
from the visible window. Verify with
`node tools/deck/cli.mjs scenario steam-fullscreen-activity-calendar --mode evidence`.

For DLC / Groups, group headers and achievements are one vertical primitive tree.
A expands/collapses the focused group, Up on Base Game stays on Base Game, and
Down from an expanded header enters its first achievement. A directional press
must never leave hidden achievement focus active or make A open an unrelated
achievement. Preserve Steam's navigation sound on successful controller moves.

### Steam profile Games and Activity Y-to-top

The retained Steam profile footer shows `Y Top` on Games and Activity. One Y
press from a scrolled Games row focuses `Search your games` and resets the game
list scroll to zero. From a scrolled Activity row it focuses `All Unlocks` and
resets the unlock list scroll to zero. The footer owns this face-button action
while the active tab is Games or Activity; Profile and Settings leave the Y
slot hidden. Verify real `.gpfocus`, scroll position, and the unchanged route.

### Game Achievements Y-to-top

The game-section footer displays `Y Top` only while Achievements is active.
The focused achievement row and its owning browser publish the native GamepadUI
`OPTIONS` action through `onOptionsButton`; Y scrolls to the top and transfers
visible `.gpfocus` to the `All` filter. Do not implement this action with
`onSecondaryButton`: that is X.

Verify Y from a row far enough down to require scrolling, then repeat after this
sequence: Achievements -> DLC / Groups -> expand Base Game -> enter a grouped
achievement -> Achievements -> move down. In both cases one `y` input must focus
`All`, the footer must still show `Y Top`, and the route must remain the same.

### Steam refresh parity

Ordinary Steam manual refresh must merge the dashboard/QAM
`recentlyPlayedGames` projection into the stored full-screen Games scan. A newly
played game present after QAM refresh must therefore appear in full-screen Games
without a full library scan, while existing scanned achievement totals and
statuses remain intact. Unit-test the merge with a recent game absent from the
scan. End-to-end proof requires a genuinely newly played game; do not claim that
part from cached data alone.

### Compact achievement game action

The QAM individual-achievement page wrapper is not a focus owner. Its real child
controls own GamepadUI focus, including `Open <game> compact game overview`.
Traverse to that action and activate it with A; do not accept mouse clickability
or a visually highlighted non-`.gpfocus` wrapper as proof.

### Compact View Achievements detail-return state

Treat the game-owned compact `View Achievements` list as a separate lifecycle
from Recent Achievements and Recently Played. Exercise `All`, `Unlocked`, and
`Locked` independently. For each selected filter, record the filter's
`aria-checked`, the originating row's
`data-achievement-companion-compact-achievement-id`, the real QAM scroll
container's `scrollTop`, and the row rectangle immediately before A. After B,
all four values must match and the row rectangle must remain wholly inside the
454 px QuickAccess viewport.

The Steam list checkpoints the real owner-window scroll container again on the
row's A/open event, after GamepadUI has completed its focus scroll. Do not move
this checkpoint back to focus-only timing: a lower unlocked row was physically
observed returning partly below the viewport when only the earlier focus event
was stored. Proven examples include `Piercing Through, Locked` at scrollTop 118
and `Astronomer's Orbs Mastery II, Unlocked` at scrollTop 65.33.

Filter navigation remains the native `Focusable` radiogroup with
`flow-children="left-right"`. LEFT/RIGHT moves focus; A selects. Do not add
direction handlers or change the filter on focus.

The compact locked-state rail uses the same shared gray outlined lock-in-circle
glyph as the Steam full-screen achievement row. A red prohibited symbol is a
visual regression. Verify the shared glyph on at least one locked QAM row while
that row has the visible `.gpfocus`.

### Compact Settings native count menus

`Recent Activity`, `Recently Played`, and `Activity Calendar` use Decky's native modal `Menu` opened
with `showContextMenu`, not an inline HTML-style option list. Press A on each
trigger and require a centered GamepadUI menu with its title and Cancel plus
3/5/7/10 for activity/player counts or 4/6/8/10/12 for calendar weeks, with
Steam's A Select/B Back legend. The menu's actual `.gpfocus` lives
in the `Steam Big Picture Mode` target even though it was launched from QAM.

Test B/cancel and selection separately. B must close only the menu and restore
the exact QAM trigger `.gpfocus` without changing its value. Selecting a new
value must close the menu, update the trigger label, restore that same trigger
`.gpfocus`, and save immediately without a confirmation message. The Settings
page has no Save Settings or Back to Steam Profile actions; B returns to the
compact Profile after any pending write. Recent Activity, Recently Played, and
Activity Calendar must all show the selected count immediately on return. The
dashboard snapshot retains the maximum supported recent collections and applies
the configured counts as presentation slices, so increasing Recently Played
must not require leaving Achievement Companion or reloading the provider. Show
free games also saves immediately, but it may refresh dashboard membership.
While the native modal owns navigation, `useQuickAccessVisible()` reports false;
keep the compact tree and session alive for this bounded popup lifetime. Do not
interpret that temporary visibility change as a real QAM close.

### Providers menu game-page badge disclosure

The Providers menu exposes `Game Page Badge settings, collapsed` as one native
focus stop below Provider Settings. It starts collapsed with a down chevron.
Press A to expand it in place; `.gpfocus` must remain on
`Game Page Badge settings, expanded`, the chevron must point up, and Down must
enter `Show game page badge`. Up returns to the disclosure, and A collapses it
without moving focus. The maintained semantic targets are
`game-page-badge-settings-collapsed` and
`game-page-badge-settings-expanded`.

Open at least one native position or color dropdown from the expanded section.
Selecting an option and B/cancel are separate checks: each must return to the
still-expanded disclosure content with `.gpfocus` on the exact originating
dropdown. Guard the popup lifetime before Decky's native menu hides QAM; that
temporary `useQuickAccessVisible() === false` state is not a compact-session
close. A real QAM close must still reset the next Providers visit to
`Game Page Badge settings, collapsed`.

### Steam surface session reset boundaries

State persists across ordinary parent/child navigation within one surface
session. For compact View Achievements, filter, scroll checkpoint, and semantic
achievement ID survive detail -> B. For full-screen Games, a selected filter
survives game -> B and focus returns to the exact originating game; the proven
Perfected case returned to `Open Geometry Survivor` with `mastered=true`.

A real surface exit starts a new session. Close QAM completely, reopen it, and
require the fresh provider chooser with one visible `.gpfocus` (currently
`RetroAchievements provider, configured`), rather than the prior compact route,
filter, or row. A compact-origin full-screen handoff and a native modal menu are
not QAM exits.

Exit Achievement Companion full-screen completely and open it again. Require
the Profile start section and default per-page state; the Games filter must be
All rather than a previously selected filter. Reset full-screen stores both on
terminal exit and at the start of a new Steam visit. The new-visit reset is
authoritative because cleanup from the previously unmounted page can otherwise
write stale state after the terminal reset. Do not reset these stores on native
child-route Back.

### Full-screen Games Search keyboard Back

1. Enter `steam-fullscreen-games-search` and require `Search your games` as the
   sole application `.gpfocus` before editing.
2. While the input is only focused, confirm the custom section footer is
   visible.
3. Press A. Steam's keyboard must open; the keyboard owns the lower screen and
   the custom footer must be absent so it cannot cover keys.
4. Press B once. The keyboard must close, the retained full-screen Games
   section must remain active, the query must remain intact, and `Search your
   games` must regain the visible application `.gpfocus`. The custom footer must
   return.
5. Press B again. Only this second B may perform the normal terminal route Back.

The application marks editing from the TextField activation, yields the first B
to Steam, and clears that marker in the shared cancel path. Keep the official
Steam keyboard-dismiss subscription as an additional cleanup path, but do not
depend on it for controller B: the physical Deck does not emit that callback
reliably for this dismissal path.

### Full-screen Settings editable-input footer and keyboard

Enter `steam-fullscreen-settings`. Account is initially selected and focused in
one horizontal Account / Full-Screen Settings / Updates pill row beneath the
compact `STEAM SETTINGS` heading. The pills reuse the Games/Activity filter focus
and selected treatment. Left/Right moves real `.gpfocus`; A selects one section
and replaces the single bounded panel below. Account populates its fields,
Full-Screen Settings contains the Activity Calendar 4/6/8/10/12-week native
selector, and Updates contains version, channel, automatic-check, status, and
manual update controls. Only variable update/status/feed copy may scroll in its
bounded region; the selected panel and bottom-pinned Check/Update actions must
remain fully above the persistent footer. Select Updates, press Down once for
`Automatic Update Checks`, then Down again for `Check for Updates`. Select
Account, press Down to reach an editable field such as `SteamID64`, and use the
same focused -> A -> keyboard -> B
sequence as Games Search. The footer is visible while the input is merely
focused, absent while the Steam keyboard is open, and restored after B.
Settings must remain active and the same input must hold `.gpfocus`; preserve
its existing keyboard/Back behavior. Games and Settings deliberately share the
same keyboard lifecycle helper and cancel priority.

QAM `Provider Settings` is distinct from the QAM provider chooser. It opens the
standalone `/full-screen/settings` route with
Steam selected under a two-pill `RetroAchievements` / `Steam` custom footer.
`node tools/deck/cli.mjs scenario provider-settings-qam --mode fast` verifies
the settings handoff and initial Account focus. L1 selects RetroAchievements and
focuses its native Username field; R1 returns to Steam and Account focus. The
RetroAchievements page scrolls within the viewport above the footer rather
than extending behind it. Its own Navigation Back row is omitted in this shared
route, while terminal B still returns to the QAM provider chooser. The retained
Steam Profile Settings route keeps its separate four-section footer.

On the standalone route, both the Steam settings card and Dangerous Zone end
at the same height, above the provider footer. Press A on SteamID64 or Web API
Key: the Steam keyboard hides the footer, but must not shrink or overlap the
three Account field wrappers. The Settings frame holds its pre-keyboard viewport
height until dismissal; B closes only the keyboard and restores the same input.
The same stable field geometry applies to retained Steam Profile Settings.
For RetroAchievements Username/API key, the shared footer likewise yields to
the keyboard and returns after B. Check the last RetroAchievements control by
real Down traversal; its focus rectangle must stay above the footer.

### Full-screen footer and L1/R1 ownership

The custom retained-session footer is authoritative. It owns one capture-phase
L1/R1 handler for Profile, Games, Activity, and Settings, updates the active
section label, remains visible during ordinary content/input focus, and yields
while Steam's onscreen keyboard is active. Perfected is a Games filter rather
than a retained top-level footer section.

Native `FooterLegend`/`actionDescriptionMap` was physically tested on Games. It
rendered Steam's actual `L1 Profile`, `R1 Activity`, `A Select`, and `B Back`
legend on normal rows and Search, and Steam correctly replaced that footer with
the keyboard while editing. However, publishing BUMPER_LEFT/BUMPER_RIGHT on the
focused node consumed the shoulder input: the displayed `R1 Activity` action did
not switch sections. It also requires every focused content/input node to
publish changing adjacent labels. Retain the custom footer until Decky exposes a
stable route-root action owner that both renders and invokes those shoulder
actions.

For regression, traverse Settings -> Activity -> Games -> Profile -> Games with
real L1/L1/L1/R1 input (allow section transitions to settle), inspecting the
active footer tab and one visible content `.gpfocus` after each move. Open Games
Search and Settings inputs afterward to repeat keyboard ownership checks.

On full-screen game tabs, Y Top reserves the same footer slot whether or not
the Achievements tab exposes Y. The footer portal remains mounted across tabs;
Y sits before the adjacent A Select and B Back hints when applicable;
compare its geometry through Overview -> Achievements -> DLC Groups ->
Community and back. The Achievements list initially mounts 36 rows so shoulder
switches remain responsive even for games with hundreds of achievements.

On full-screen Profile Games and Activity, manual directional focus transfers
play Steam's general cursor sound (`deck_ui_misc_10.wav`). Games Tracked stays
inside its metric card. The Games, Activity, and game Achievements filters use
the QAM achievement filter's rounded card and cyan selected underline. On
Activity, left/right crosses all five filters, Down reaches the first
achievement, and further Down traverses rows across automatic loading
boundaries. Run
`node tools/deck/cli.mjs scenario steam-fullscreen-activity-filter --mode fast`
and `node tools/deck/cli.mjs scenario steam-fullscreen-activity-calendar --mode evidence`
after Activity navigation or calendar changes.

### Full-screen tabs

Start on a focused Activity item and send `l1`, `r1`, `r1`, `l1`. After every
input inspect `.gpfocus`, the visible footer tab, and the route. The expected
sequence is Games -> Activity -> Settings -> Activity, with one adjacent tab move
per shoulder input. Reverse movement must preserve a valid content focus. Native
tab switches must not strand focus on a hidden or stale tree.

### Compact/full-screen origin

Test at least these two origins:

- Compact Profile action -> full-screen Profile/Activity -> terminal B -> exact
  originating compact Profile action.
- Compact game -> `Open game full-screen` -> terminal B -> the same compact game
  action; another B -> the exact originating Profile game row.

After terminal B, `Navigation.OpenQuickAccessMenu(Decky)` may visually show QAM
before its Gamepad navigation context is active. The application activates the
owning native GamepadUI context/tree and takes the stored semantic target. Treat
the real restored `.gpfocus` as the pass condition; do not replace this with DOM
focus, synthetic clicks, or elapsed-time assumptions.

## Screenshots

```powershell
node tools/deck/cli.mjs screenshot --mode gamescope
node tools/deck/cli.mjs screenshot --mode cdp --target QuickAccess
node tools/deck/cli.mjs screenshot --mode cdp --target "Steam Big Picture Mode"
```

Gamescope is preferred for composed 1280x800 evidence because it includes the
main UI and QAM together. CDP captures one CEF target. Both write validated PNGs
to `%TEMP%\achievement-companion-deck-artifacts` and print the exact path. Inspect
the image yourself; do not ask the user to capture or interpret it.

## Logs

```powershell
node tools/deck/cli.mjs logs frontend --lines 100
node tools/deck/cli.mjs logs backend --lines 100
node tools/deck/cli.mjs logs decky --lines 100
node tools/deck/cli.mjs logs steam --lines 100
node tools/deck/cli.mjs logs all --lines 100
```

- `frontend`: Achievement Companion/Decky-filtered Steam `cef_log.txt`.
- `backend`: newest validated plugin log in the established plugin log directory.
- `decky`: `plugin_loader.service` journal.
- `steam`: unfiltered Steam `cef_log.txt` tail.

Outputs are bounded and secret-like values are redacted. Use `--out-dir` outside
the repository to save log JSON artifacts.

## Recovery and stopping conditions

- Connection failure: inspect the explicit SSH config after the first failure;
  do not try DNS, IP guessing, credential prompts, or repeated retries.
- Stale/dead CDP tunnel: run `tunnel up`; it owns detection/recovery.
- Target disappeared during a transition: rerun the command so it rediscovers
  targets; never reuse an old target ID.
- Frontend not ready: let the bounded `ready` result fail clearly, then inspect
  frontend/Steam/Decky logs.
- Backend wedged or changed: use `restart-decky`, then `ready`.
- Unexpected focus: stop pressing buttons, run `focus`, capture Gamescope, fetch
  relevant logs, and recover from observed state. Never use unbounded retries.

## Required evidence before claiming success

Retain or report:

- successful build/copy hash/reload/readiness output;
- actual `.gpfocus` before and after meaningful inputs;
- screenshot paths showing the relevant state;
- observed route transitions and Back return state;
- log inspection when behavior failed or produced console errors.

Return the UI to the library home with QAM closed before finishing. For an RA-only
task, do not enter a Steam Achievement Companion scenario as cleanup. After
toggling QAM closed, run `targets` and inspect the `SharedJSContext` URL. If it
still shows `/routes/decky/store`, send one real B, then rerun `targets`; finish
only after it reports `/routes/library/home` and a Gamescope screenshot confirms
QAM is closed.

## Post-UI-change maintenance checklist

Before finishing any task that changes Steam UI/controller behavior, determine:

1. Did a route change?
2. Did a page or section move?
3. Did a semantic target/label used by automation change?
4. Did initial focus change?
5. Did focus order change?
6. Did focus restoration change?
7. Did Back behavior change?
8. Did L1/R1 behavior change?
9. Did scrolling behavior change?
10. Did filter/search state behavior change?
11. Did keyboard/input behavior change?
12. Did footer behavior change?
13. Did QAM/full-screen origin behavior change?
14. Did a named harness scenario become incorrect?
15. Did a regression sequence need to change?

If yes to any relevant item, physically verify the new behavior, update the
affected regression test and semantic harness scenario, then update this global
skill/runbook in the same task. Finally, rerun the documented scenario.

Named scenarios are living contracts. When UI behavior makes one stale, update
its semantic targets and setup path. Do not accumulate fallback DOWN/UP presses
until it happens to work. For example, if Search moves from Games directly to a
toolbar and then Search, encode that semantic path and physically verify it.

Keep this runbook current rather than historical: replace stale routes, renamed
targets, obsolete workarounds, and outdated regression sequences. Do not leave
contradictory guidance active; historical behavior belongs in git history.
