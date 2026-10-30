# RetroAchievements data reliability

Authoritative architecture for the 0.38.2 reliability overhaul (2026-10-29).
Official guidance: https://api-docs.retroachievements.org/ and
https://api-docs.retroachievements.org/v1/get-game-list.html . RA recommends
reasonable bursts, reuse/preloading and aggressive caching of game lists; it
publishes no numeric request allowance. These defaults are product policy,
not a claim about provider quotas. Unlocks and mastery can change after resets
or set revisions, so they remain revalidatable.

## Ownership and decisions

1. Every shipped Decky RA HTTP operation, including credential validation,
   enters main.py and backend/ra_scheduler.py. Frontend transports never own
   pacing, retries or provider cooldown. RA redirects are rejected before an
   unaccounted second HTTP request can occur. Steam redirect behavior is unchanged.
2. backend/ra_coordinator.py owns raw API resource identity, freshness, validation,
   persistence, last-known-good fallback, generations and retry eligibility.
   backend/ra_state.py stores these records in the Decky settings directory's
   retroachievements.sqlite3 using standard-library SQLite transactions.
3. Frontend retroachievements-data-coordinator.ts joins entry requests, trusts
   backend freshness metadata, returns independent presentation copies and bounds
   foreground RPC waits. It does not have a competing provider TTL table.
4. QAM, full-screen, badges and native Steam projections use one canonical
   GetGameInfoAndUserProgress variant (g + a=1). Community and avatars are optional. Public avatar images do not require profile API calls.
   Presentation/session caches retain navigation and ready snapshots; they may
   reuse RA data only while its canonical resource remains fresh.
5. Public catalogue/metadata resources are independent of credentials. Account
   resources use a nonreversible credential fingerprint, schema and normalized
   endpoint parameters. API keys never occur in persisted request identities or
   logs. Frontend account revisions reject late results. Steam app IDs identify
   shortcuts; only verified ROM hashes resolve RA game IDs.
6. Existing browser dashboard/mastery/history records remain migration fallbacks.
   They never prove canonical freshness. Subset relationship checkpoints remain
   browser-persisted derived projections, with source expiry copied from canonical
   metadata rather than independent TTLs. ROM mappings are bounded and valid only
   for the exact shortcut identity, platform and accepted full hash.
7. No polling is implied by freshness. Refresh happens on relevant entry, explicit
   refresh or targeted lifecycle/reconciliation. Ordinary background completion updates
   cache for a later entry. Confirmed presence/lifecycle changes update only the
   current-game presentation, as described in the regression follow-up below.

## Resource catalogue and default freshness

Endpoint names below have API_ prefix and .php suffix. Seconds are defined once
in backend/ra_coordinator.py. A fresh record causes no HTTP dispatch.

| Resource | Endpoint | Freshness | Trigger / priority |
| --- | --- | --- | --- |
| Profile / avatar | GetUserProfile | 10 minutes | Profile required; other-user avatars optional |
| Rich Presence | GetUserSummary (g=0,a=0) | 45 seconds | Independent entry/lifecycle resource |
| Recent unlocks | GetUserRecentAchievements | 3 minutes | Profile recent preview |
| Recent games | GetUserRecentlyPlayedGames | 10 minutes | Profile; normal priority |
| Completion library pages | GetUserCompletionProgress | 30 minutes | Profile counts, Games, award reuse |
| Game schema and user progress | GetGameInfoAndUserProgress | 15 minutes; active game 2 minutes | QAM/full-screen/badge/native required |
| Batched subset user progress | GetUserProgress | 15 minutes | Subsets section |
| Set / parent metadata | GetGameExtended | 7 days | Low-priority subset verification |
| Systems | GetConsoleIDs | 30 days | Icons and identification |
| Console game/hash list | GetGameList | 30 days | Identification/subset discovery; low priority |
| Community distribution | GetAchievementDistribution | 2 hours | Explicit Community section |
| Community progression | GetGameProgression | 2 hours | Explicit Community section |
| Latest masters | GetGameRankAndScore | 2 hours | Explicit Community section |
| Historical date range | GetAchievementsEarnedBetween | 10 minutes | Explicit resumable history import |
| Complete history checkpoint | Local projection | 3 minutes | Activity/history entry, incremental after expiry |
| Calendar | Local verified history projection | Snapshot at profile entry | No provider requests |
| Shortcut mapping | Local identity + hash | Until identity/hash changes | Never use title guesses |

## Surface refresh matrix

| Surface | Required entry resources | Optional work |
| --- | --- | --- |
| QAM profile | Profile, summary, recent unlocks/games, completion pages, first/current game's required progress | Cache-only calendar; no history import/community |
| Full-screen Profile/Games | Retained canonical-fresh provider snapshot, otherwise same entry group | No lifetime scan |
| Activity/history | Profile identity plus durable historical checkpoint | Bounded initial/resumed or incremental import |
| QAM/full-screen game | Canonical required game record | Community only when entered; Subsets only when entered |
| Game badge | Shortcut metadata/hash mapping and canonical game record | No community; no redundant completion enrichment if known |
| Native achievements / Activity / Up Next / information | Verified mapping and same canonical game record | Only applicable native section work |
| Native Community | Identity-verified base projection | Optional authoritative statistics, separate sample populations |
| Game start/exit | Mark mapped game's progress stale | No whole-library invalidation |
| Account/credentials changed | Reject old revision, isolate scope | Public provider resources still reusable backend-side |
| Achievement mode changed | Reproject verified rows | No provider refresh needed |
| Manual profile refresh | Revalidate only profile resource group | No historical import or owned-game fan-out |
| Manual retry | Failed resource/group; join existing work | Backend eligibility/cooldown always enforced |

## Scheduling, bounds and failure behavior

One async scheduler serializes actual HTTP. Starts are separated by 750ms plus
0-150ms jitter; first dispatch has 0-2s startup jitter. Queue capacity is 128.
Missing required content has highest priority, stale required revalidation next,
normal recent data next, optional community/history/catalogue work last. Aging
promotes waiting work every 15s, preventing permanent optional starvation.
Equivalent operations share one future; disappearing consumers cannot cancel
other waiters. Socket operations run off the event loop. Never cancel a thread
then dispatch an overlapping replacement request.

Backend resource entry waits default to 8s; frontend entry groups/RPCs to 9s.
Already-requested backend jobs have a 60s queue eligibility budget and bounded
socket timeouts. A foreground deadline returns valid last-known-good data or a
recoverable error. Backend work may complete into durable cache afterward.
A 429 settles waiters promptly and activates a shared restart-safe cooldown.
Retry-After supports seconds and HTTP dates; absent/invalid values use jittered
60s exponential backoff capped at 15 minutes. Manual retries cannot bypass it.
Transient network/408/425/5xx attempts are capped at two; authentication, invalid
JSON and unsupported resources are not automatically retried. Per-resource
failure eligibility persists (auth 15 minutes, 404 5 minutes, other failures
30 seconds, rate limits per cooldown). Recovery invalidates freshness without
removing good payloads or bypassing these failures.

Memory: 128 records / 32MiB on each coordinator; records over 16MiB bypass memory.
Persistent raw/derived resource payloads: 2048 records / 64MiB, individual 32MiB.
History: 250,000 events / 64MiB and reset proofs up to 16MiB. Overflow fails the
transaction and does not advance coverage or silently discard verified events.
Diagnostics export replaces one bounded aggregate report; existing logs rotate.

## Historical synchronization and reconciliation

Ordinary profile entry never imports history or starts calendar range queries.
Activity/history explicitly imports 31-day batches, up to 64 range operations
per run, at low priority. Saturated 500-record ranges split; a saturated single
second cannot prove complete coverage and reports an actionable partial error.
Validated events and cursor advance in one transaction. Interruption/restart
resumes the checkpoint. A complete import revalidates only its recent boundary,
with a five-minute overlap. Event identity preserves game, achievement, timestamp
and softcore/hardcore distinction. Limited recent feeds are previews, not proof
of complete history. Partial imports show their verified-through date.

Fresh relevant game progress reconciles history only when the complete schema,
award counters and dated per-mode unlock evidence agree. Known reset events can
then be removed; unknown retired IDs are preserved. Transactional game proofs
prevent late range requests from resurrecting reset events while allowing later
re-earned awards. No history entries are invented from totals.

Subset discovery persists each verification outcome and stops after five
verifications per run. Re-entry resumes unfinished candidates before stale
completed metadata; missing legacy expiry does not erase verified coverage. Source freshness
comes from canonical catalogue/metadata records, including persisted source
expiry for completed candidates. Optional discovery cannot block the base game.

## Loading, fallback and recovery contract

The existing DeckyCompactLoadingState, DeckyFullScreenLoadingState and loading
brand owners are retained. Fresh ready presentations open immediately. Stale or
missing required resources wait behind the branded loader, join equivalent work,
then present one ready snapshot, stale fallback or actionable failure. No normal
background callback swaps the visible page's progress or resets focus/filter/
scroll. Optional sections have their own bounded loading/error state. Community
and Subsets retries do not refresh the base page. RA recommendation auto-retry
loops were removed; user retry goes through canonical eligibility.

Developer Mode's General Settings/Updates area contains Data & Sync Diagnostics:
last success/failure, health, logical location/database size, resource/history
counts, active/pending requests, session HTTP counts/cache hit ratio, recent
provider errors, cooldown and history jobs. Refresh diagnostics reads local state.
Export writes aggregate allowlisted data to the Decky plugin logs directory as
retroachievements-diagnostics.json. It excludes credentials, usernames, raw
provider bodies, authenticated URLs, resource queries and ROM paths.

Recovery actions revalidate the profile or a specified RA game on next entry.
History checkpoint rebuild removes coverage and malformed event rows while
retaining verified events/reset proofs; Activity then resumes/reproves coverage.
It can be expensive and is a deliberate recovery action. A corrupt database is
quarantined (at most two backups), rebuilt with a conservative 60s cooldown.
Unsupported future schemas are preserved and reported unavailable.

## Diagnostic interpretation

Existing backend log rotation/redaction is reused. Structured events include
cache_hit/miss/stale/write/write_failed/invalidated/restored/reconciliation,
refresh_evaluated, request_joined/queued/started/completed/failed,
rate_limit_activated/expired, retry_scheduled/suppressed and resource_published.
Backend resource digest prefixes correlate evaluation/cache/network outcomes.
Events carry endpoint, entry point, reason, attempt, duration and safe error
status when appropriate. Only request_started counts actual HTTP dispatch;
frontend fetched is an RPC count. Cached fallbacks preserve rate-limit/auth/local
corruption classification and retry eligibility instead of being mislabeled as
generic network errors. Dashboard completion reports cache vs live
using canonical fetched-at metadata. Stale usable data is a completed degraded
presentation, not an empty-content failure. Logging failures cannot break loading.

## Validation record

Phases 1-6 implemented and validated incrementally with focused tests. Phase 7
full local checks: 747 Node tests, 131 offline Python tests, TypeScript, production
Rollup build, synchronized version 0.38.2 and diff whitespace validation passed.
The deterministic scheduler tests include 1,000 independent jittered schedules,
priority aging, shared cooldown across restarts, no cooldown dispatch, bounded
attempts and concurrent explicit refresh deduplication. Cache/history tests cover
account/generation isolation, corruption, write failure, reset proofs and resume.

Measured mocked workflows: repeat canonical-fresh profile 0 additional dispatches
and 0 history requests; eight concurrent equivalent backend reads 1 actual HTTP
request; 20 simultaneous explicit refreshes 1 HTTP request; recent awards 0
per-game progress calls; required game progress 0 optional community calls.
Baseline tests previously observed per-game award/detail fan-out and independently
cached surfaces; no numeric baseline is invented for unmeasured complete flows.

## Physical verification and remaining limits

The final frontend bundle is 2,587,753 bytes, SHA-256
051ed2a95a90b1cd8cf244b10f1cb6691a5aa239d01980b5640cc5b60fe311a7.
All 33 assets and the 17 deployed backend Python files were hash-verified.
The final RPC correction's main.py and ra_state.py hashes were rechecked after
copying. Decky's supported loader/reload_plugin route activated the backend;
readiness confirmed Decky/DFL and 393 Steam apps. Prior installed files were
saved in /tmp/ac-ra-before-0.38.2-1793287347258.tar before the first copy.

On the configured ghast Deck, real controller input verified:

- Cold QAM profile completed with Continue Playing and Hometown Hijinks already
  loaded. It sent seven initial HTTP requests (profile, summary, recent feed,
  recent games, completion library, systems, one game); no history or optional
  community requests. These were paced, with no 429 events.
- QAM to full-screen Profile, Games, Tony Hawk's Underground, Back to the exact
  Games row, then Back to QAM added zero HTTP dispatches while those records
  remained fresh. A later entry refreshed only the expired recent feed.
- QAM Recent Activity rendered sourced points/mode with no per-row detail fetch.
- Compact achievement list to detail modal and B returned to achievement 250336,
  preserving scrollTop 0 and real .gpfocus. The full-screen round trip similarly
  retained the originating Games row. No ordinary visible background replacement
  was observed. Existing branded loader owners and stale/error transitions are
  covered by the loading/source tests; the physical captures show ready pages.
- Corrected calendar and diagnostics RPCs succeeded with Decky's empty-payload
  call convention. SQLite reported healthy; no pending/active work, provider
  failures or cooldown. The sanitized diagnostics export succeeded on-device.
- The controller check ended on library home with QAM closed. No game was launched
  by automation. Later navigation was observed through aggregate diagnostics only.

Installed plugin/package metadata is root-owned and still reports 0.38.0.
Noninteractive sudo install and service restart require an unavailable password;
no password, ownership or sudoers changes were attempted. The source version and
validated frontend are 0.38.2, and the changed backend is active through supported
per-plugin reload. Full installed-version parity requires normal Decky package
installation. No commit, push, tag, release or publication was performed.

Native badge/Your Stuff/Activity/Community integrations have deterministic adapter
coverage; those specific host sections were not physically exercised on this
final build. Real-provider outage/429 injection was not performed against the live account;
offline tests cover it. A later history-page load completed a durable initial import: 52 date-range
dispatches, 1,058 verified stored events, complete checkpoint and zero pending
ranges. Background work settled without a cooldown. Coverage is proven through
the recorded checkpoint, and later resets still require reconciliation. No load test
was run against RA. The short successful device window is not a long-term
rate-limit guarantee. Very large accounts may need several explicit Activity
visits to finish the bounded initial import. Native helper code was unchanged;
no new native-helper release artifact or clean Linux helper build is claimed.

The local harness initially used outdated game-action/modal labels and one-step
filter-to-row movement; they were corrected using observed aria labels and
semantic navigation. The direct modal/Back check is physical evidence; the
entire legacy named scenario is not reported as a passing run.


## Rich Presence / Community / Subsets regression follow-up

The initial overhaul incorrectly coupled presence freshness to a 10-minute summary
cache. The corrected account-scoped presence resource shares the canonical
GetUserSummary(g=0,a=0) record and scheduler; it is current for 45 seconds.
The RA activity classification still uses its own 10-minute heartbeat threshold.
Provider presence timestamp and LastGameID always come from the same response.
A valid inactive response clears only presence fields; malformed responses and
network failures retain the last verified pair and all unrelated profile data.

retroachievements-presence-coordinator.ts owns entry, lifecycle and visibility
validation intent, single-flight consumers, generation/account guards and local
exit evidence. It does not send HTTP or perform transport retries. The Decky
adapter uses the existing resource coordinator and watches authoritative summary
updates. Cached points/ranks/collections/history remain unchanged by presence.
The two profile entry adapters wait behind the existing bounded branded loader
only when their required resources/presence need validation. A presence-only entry
reuses the retained dashboard and requests only the lightweight summary. Missing
current-game metadata/progress loads once through the existing canonical game
record when needed for the card/Up Next.

The existing Steam lifetime subscription notifies relevant shortcuts/emulators.
250ms event debounce coalesces exit/start bursts; duplicate lifetime states are
ignored. The first lifecycle validation can run while hidden; at most two
successful-but-not-yet-reflected follow-up checks occur after 15s and 30s more.
Failures and 429 stop those follow-ups. Transport retries and all cooldowns stay
backend-owned. Visible RA profiles share one 60s validation timer, removed when
no relevant profile is visible. There is no hidden continuous presence polling.
This recognizes emulator game switches and account activity on another device.
Local exit suppresses only the mapped game's heartbeat predating that exit;
a different game or newer account heartbeat remains valid.

QAM and full-screen use one presence projection, retaining focus and per-game
Up Next settings. Current Game falls back to Continue Playing on inactivity.
The full-screen identity card exposes the same current/continue-playing game.
No presence update rewrites the saved recent-games list or profile totals.
Structured presence_evaluated/skipped/joined/validated/published/failed events
include safe trigger/age/validation/freshness/game/change/subscriber/failure data.
They correlate with the existing backend queue/start/completion events.

Community now requests only its three optional statistic endpoints and reuses
the ready base snapshot. It does not re-fetch game detail, systems or avatar
profiles. Username-derived UserPic images (the documented RA profile image route)
load independently, preserving statistics readiness even if an image fails.
Both full-screen and native Community retain recoverable retry controls.

Subset discovery returns verified parent-linked children from each bounded batch,
persists partial coverage, and exposes a Continue action with truthful progress.
It no longer waits for an entire console index before exposing verified children
or reports every partial checkpoint as a generic unavailable page.

Automated follow-up verification includes the actual QAM and full-screen entry
services: a profile refreshed two minutes earlier issues one summary request and,
only for a genuinely missing active game, one canonical progress request. Profile,
completion, recent feeds, history and community receive no requests. Immediate
re-entry issues zero more requests. Deterministic tests cover delayed heartbeat,
exit, restart, remote/emulator switches, 429, duplicate events, late generations,
account changes, atomic merge and subscriber updates. Community readiness has
three API dependencies and zero avatar-profile dependencies. Subset batches
expose verified children and resume without re-verifying completed candidates.

The user owns this follow-up's physical UI test. No controller navigation or live
game launch is performed by the agent for this follow-up. The earlier physical
results above apply to the earlier bundle; they are not claims of a physical
pass for the Rich Presence fix. Source version remains 0.38.2 for this same logical
overhaul. Installed root-owned metadata remains unchanged during hot deployment.

Follow-up validation on 2026-10-29: 766 Node tests and 132 Python tests passed;
the final defensive timer-bound change also passed all 15 focused presence tests.
TypeScript checking, the production build, version consistency (0.38.2), and
`git diff --check` passed. The frontend and both changed backend modules were
deployed, the backend reloaded through Decky's supported plugin loader, and the
frontend hard-reloaded to readiness. Local/remote SHA-256 parity was verified:
frontend `fb97230b5eed8ec9436900c59ecb40f74e5f720ec1c98c2994d3b08aba245fe2`
(2,617,394 bytes), coordinator
`60cb0a830cf8edf9b61d8c90a9586681fe098a4d1233c3a79d1a088e92054964`,
diagnostics `3843a49335c1aef4d244e6f70344754f0adcd2a4cca715cb8f62e500a7f3155a`.
A read-only post-deployment health check reported healthy storage, zero queued
or active requests, zero failures, zero rate-limited requests and no cooldown
in the current backend session (27 requests sent). This is a short diagnostic
window, not evidence of a long-term rate-limit guarantee. Follow-up physical
Rich Presence, Community and Subsets behavior remains pending the user's UI pass.

### User-owned follow-up UI checklist

1. Refresh the RA profile, close it, and launch an RA game about two minutes
   later. Open QAM without manually refreshing. Current Game should identify it
   despite the still-fresh dashboard; Up Next settings should survive. Repeat
   with direct full-screen profile entry.
2. Open QAM and full-screen in succession, then reopen quickly. They should show
   the same active game without a second visible whole-profile refresh. Points,
   rank, totals and recent activity should remain stable.
3. Leave a profile visible during launch, exit and restart. Only the affected
   game presentation should change; controller focus and navigation should stay
   intact. An exited mapped game with an old heartbeat should fall back to
   Continue Playing; valid newer/other-device account activity should remain.
4. Switch ROMs inside an emulator without restarting its Steam process. With a
   profile visible, the shared check runs every 60 seconds; expect a change on
   the next check after RA publishes the new heartbeat. Entry freshness is 45
   seconds. Launch has at most two follow-ups, roughly 15 and 45 seconds after
   the initial check, rather than continuous hidden polling.
5. Open Community on native Steam and Achievement Companion game pages. Stats
   should become usable without leaving and reopening; avatar loading must not
   gate them. A real network failure should leave a working Retry action.
6. Open Subsets. Verified entries should appear even if discovery is partial;
   the progress message and Continue action should truthfully advance discovery.
   Open a subset and return, checking controller focus and Back behavior.
7. Check a delayed-heartbeat game and a game that never establishes RP. No
   unrelated whole-profile refresh or repeated loading loop should occur; old
   valid profile/game data and pinned/selected Up Next preferences should remain.

For a failure, record the game/emulator, QAM versus full-screen/native page,
approximate delay and observed versus expected game. Device diagnostics can
then be correlated without requiring a second repository audit.

## Post-overhaul corrections: navigation, optional publication and session recency

### Confirmed causes and decisions

- Cold badge routes initialized the full-screen section memo before the game
  loaded. Its dependencies watched optional communityStats rather than the
  eligibility inputs, so an RA game with no preloaded stats could retain the
  initial two-tab list. All entry paths use buildFullScreenGameSections; RA
  Community eligibility now lives there and does not read optional statistics.
  The page memo depends on the actual navigation booleans.
- The previous Subsets gate admitted every parent game. It now requires an
  actual verified parent-child relationship. Existing derived relationship
  storage is read without HTTP and publishes bounded discovery checkpoints to
  the mounted page. One optional discovery batch can discover new eligibility
  after game entry; it does not reload game detail. Failed verification retains
  previous verified evidence, including an incomplete catalogue's positives.
  Verified zero/unknown produce no tab. Explicit verified removals can replace
  old evidence. Late tab insertion does not move the active section; initial
  subset focus restoration runs once rather than on each checkpoint/render.
- Community's backend entry deadline could return before queued work finished;
  the optional view had no canonical subscriptions and therefore retained its
  failure until remounted. Optional Community RPCs now retain the existing
  scheduled job's eventual response. The canonical frontend owner keeps that
  operation single-flight after each 9s entry waiter, publishes completion, and
  settles a hung operation at a 65s completion boundary. The backend job retains
  its existing 60s budget. Native and Companion subscribe to the same three
  raw resources and derive content without refetching on notification. This is
  completion delivery, not polling, transport retry or a second cache.
- A height:100% loader nested in intrinsic-height PanelSection wrappers did not
  fill the screen. RA Community now has a continuous flex-height chain through
  the existing viewport/frame. The shared branded loader, artwork and footer
  are unchanged; Steam Community keeps its previous layout path.
- Presence projection cleared Current Game but had no session-recency handoff.
  Continue Playing then selected the unchanged older recent-games collection.
  The existing account-scoped presence owner now records at most 12 observed
  sessions and retains up to 64 known game summaries. observedSessionAt is
  separate from provider LastPlayed; no unlocks, timestamps or progress are
  fabricated. Exit/switch schedules one targeted Recently Played validation,
  joining existing work and backend cooldowns. A delayed/failed response leaves
  the observed candidate first unless newer authoritative activity takes over.
  LastPlayed reaching the observed heartbeat removes the ordering override.
  Bounded ended-session evidence remains for old-heartbeat suppression after
  restart, without suppressing a newer heartbeat or a different account game.
  QAM and full-screen entry/live projections share this owner. Existing Up Next
  goals, hidden/selected recommendations and mode preferences are untouched.
- Session evidence is stored in SQLite's existing state table under the backend
  credential/account scope. Writes carry that scope and reject old-account work;
  serialization is bounded and writes are ordered. No database schema or release
  version changes are required. Missing metadata is resolved through the existing
  canonical game resource only when needed.

### Statistics correctness

StarCraft 64's absent Casual completion median is valid, not a caching defect.
Normalization still requires a positive duration and a positive matching sample
count. There is no placeholder completion card. Explicit zero samples/null
timing clear an old median; absent optional fields retain previously verified
independent values. Backend partial progression/distribution responses merge
missing fields into their canonical previous payload before SQLite persistence.
Latest Masters failure does not erase an independently successful progression or
distribution response, or previously verified masters. Both presentations use
readRaCommunityPresentation over the same records. The API's documented
[progression fields](https://api-docs.retroachievements.org/v1/get-game-progression.html)
and [distribution query/count meaning](https://api-docs.retroachievements.org/v1/get-achievement-distribution.html)
were checked; median sample counts are not repurposed as independent totals.

### Deterministic request measurements

| Mocked action | Earlier contract | Corrected contract |
| --- | --- | --- |
| Community visibility check | 0 optional calls, but could hide the feature | 0 optional calls; RA tab eligible |
| Cold Community endpoint group | 3 canonical endpoint calls | 3 canonical endpoint calls |
| Fresh Community reopen | 0 further calls | 0 further calls |
| Late Community success, native + Companion | No mounted completion subscription | 3 total calls including both observers; 0 refetches to publish |
| Two-minute profile entry / active game missing | 1 summary + 1 required game call in prior follow-up | Same 2 calls; no dashboard/history/community fan-out |
| Confirmed exit and next profile entry | No targeted Recently Played synchronization | 1 Recently Played + 1 summary; no other endpoint calls |
| Repeated entry after exit | Fresh reuse | 0 additional calls |

The earlier counts are the preceding follow-up's mocked baseline where measured;
no numeric pre-overhaul whole-library baseline or live-load comparison is inferred.
New tests measure actual mock transport calls, single-flight late delivery, both
real entry services, canonical publication to both Community models, and zero
history dependencies. The extra exit call is required reconciliation, not a full
dashboard refresh. Discovery eligibility reads issue zero metadata requests;
new discovery still uses the existing bounded five-candidate scheduler policy.

### Validation and hardware boundary

Full validation passed 796 Node tests and 135 Python tests. A final partial-subset
failure preservation correction then passed all 18 subset tests and six focused
app-service subset integration tests. TypeScript and the production build were
rerun after that correction. The production build has only the existing upstream
semver circular-dependency warning. Version consistency remains 0.38.2; no commit,
push, tag, release or version edit was performed in this correction pass.

The user continues to own physical UI/controller testing. In particular, actual
Dragon Ball Z / StarCraft 64 / Bust-A-Move entry routes, native Community's first
paint, loader geometry, dynamic Subsets focus and Jetpack exit/Continue Playing
must still be exercised on hardware. Automated model/adapter tests are not claims
that those physical scenarios passed.

Final deployed runtime, 2026-10-29: frontend SHA-256
`2c9f573a9fc4e2364675db9de1fc907d5f727f611c6d7640eae8792e69f4bdfc`
(2,635,577 bytes), with 33 copied assets. Changed Python files are main.py
(`5d199114f7b99b576dfb7209b4876ca7b8480cec1257194d87df82f2a5377760`)
and ra_coordinator.py
(`9f5eace91dacbd41debc3d6b5ee402d195af8a67b4a6bc4d3edb3adb302aa335`).
All 17 installed Python source files and the frontend matched the checkout.
The supported Decky per-plugin loader activated the backend; frontend readiness
confirmed Decky/DFL after the final hard reload. Rollback runtime archive:
`/tmp/ac-before-post-regression-1793295019919.tar`.

Read-only SQLite verification before and after deployment reported schema 1,
integrity `ok`, 176 resource rows, 1,058 history events and ten game proofs,
unchanged. The new observation RPC responded, proving the new backend was active.
Readiness diagnostics reported healthy storage, no history import, no queued or
active requests and no cooldown. No real RA traffic was generated by these health
checks. Existing root-owned version metadata was not modified; artifact parity,
not that older metadata label, establishes deployment evidence.

## Final Subsets and Community UX corrections (2026-10-29)

This is a targeted correction of the preceding implementation, with no release
version or schema change. The user supplied two UI screenshots and the local
18.30.31 and achievement-companion logs. Physical controller/UI testing remains
user-owned; scripted resource/checkpoint verification is reported separately.

### Confirmed causes

1. Community's loading hierarchy still reused the Overview frame's top, side
   and bottom padding. Although the flex height had been repaired, the branded
   page background therefore remained an inset rectangle. The RA Community
   frame is now padding-free and the loader flexes into the entire inherited
   content viewport. Only ready statistics retain normal content insets. The
   existing shell still reserves the measured footer height, and the shared
   loading mark, animation, text, info card and colors are unchanged.
2. Continue discovery was already a native Focusable with A/touch activation;
   the first subset card's custom Up boundary explicitly focused itself.
   The action was also outside the subset section/focus tree. The compact status
   panel now sits under SUBSETS inside that vertical tree. Up reaches its enabled
   action; Down returns to the first card using the existing Steam focus helper
   and navigation sound. Completion restores action focus to the first remaining
   card only when that action owned focus. Cards, expansion, Back and their
   existing focus restoration remain intact.
3. The stalled counter was console-wide catalogue coverage, not 101 Tony Hawk
   subsets. The saved last-known-good PS2 catalogue contained 99 candidates;
   two new catalogue entries were absent from that snapshot. Many legacy verified
   entries had no metadataFreshUntil. Continuation iterated in catalogue order,
   spent its five-item budget revalidating those earlier entries and checkpointed
   incomplete before reaching the unresolved additions. Successful HTTP requests
   in the supplied log were real metadata revalidations, but did not necessarily
   increase coverage. The log digests correlate to saved public game metadata;
   the two 18:42 batches revalidated existing entries rather than proving that
   the two pending additions were attempted.

### Actual candidate evidence and repair

| Candidate | Screenshot/checkpoint evidence | Verified final state |
| --- | --- | --- |
| 45076 — Dragon Quest VIII: Journey of the Cursed King [Subset - Low Level] | Absent from the old 99-entry snapshot; successfully fetched at 18:43:18 local time and already verified by inspection | verified-parent, parent 2721; not fetched again during repair |
| 45320 — Naruto: Ultimate Ninja [Subset - S Rank] | Still unresolved at inspection; no cached metadata or corresponding verification request | One scheduled HTTP request; valid metadata, verified-parent, parent 21448 |

Before correction, the current live checkpoint had advanced to 100/101 while
still reporting incomplete; the screenshot's 99/101 was an earlier observation.
The corrected production provider was run against that saved checkpoint through
the existing canonical frontend transport and authenticated backend scheduler.
It requested only unresolved game 45320, validated identity/console/metadata,
published each outcome, persisted the complete checkpoint and reread it from
Steam storage. Result: **101/101 verified, complete=true, no remaining entries**.
Actual scheduler HTTP delta: **1**. No catalogue rebuild or cache clear occurred.
After runtime reload the same complete checkpoint remained saved. Tony Hawk's
children 20476 and 21437 remained verified under parent 2993.

### State, retry and presentation decisions

- Resume prioritizes pending/verifying/retry-later coverage before stale verified
  metadata. Legacy missing expiry does not mean unverified. Explicit stale
  metadata can still be revalidated through canonical policy after coverage is
  settled. Completed candidate work is not charged against the pending batch.
- Candidate states distinguish unresolved, verifying, verified-parent,
  verified-no-parent, retry-later and explicit 404/410 unsupported. Unsupported
  is terminal coverage, not a verified relationship. Wrong identity/console or
  invalid metadata is rejected and deferred, never counted verified. An existing
  verified relationship survives failed revalidation.
- Every verification outcome persists a checkpoint; in-progress notifications
  use the existing relationship owner. Interrupted verifying work can resume.
  Checkpoint write failure is explicitly surfaced rather than claimed saved.
- A Continue activation resumes the checkpoint; an existing operation is joined.
  The UI guards repeated activation and disables work while running/deferred.
  Candidate attempt/reason/retry eligibility is persisted. A provider cooldown or
  auth deferral pauses the console's remaining work as well, including unattempted
  candidates, and survives recreation. This is eligibility over the existing
  scheduler, not another HTTP retry loop. One UI-only eligibility timer enables
  the action when due; it never sends an API request.
- The small themed panel identifies the **console catalogue**, gives verified
  coverage and a progress bar, and integrates Continue/Retry. It is below the
  section heading; verified subset cards remain primary and unchanged. It hides
  when complete and saved, without a full-screen reload. It describes deferred,
  cooldown, invalid metadata and failed-save states truthfully. Existing progress
  on cards is retained during relationship-only checkpoint publication.
- Candidate diagnostics distinguish started/verified/rejected/unsupported from
  HTTP completion and record IDs, previous/current status, attempt, normalization,
  eligibility and outcome. Checkpoint events include save result and counts.
  Candidate-level events are emitted only in Developer Mode. Normal production
  receives bounded discovery/checkpoint events. Backend sanitization excludes
  credentials, raw URLs and metadata bodies.

### Validation and request impact

Focused validation passed before the full suites. Final Node run: **806 passed**;
Python: **136 passed**. Commands: `node scripts/run-tests.mjs`, then the final
`--node-only` run after the frontend-only cooldown/card-progress correction;
TypeScript `node node_modules/typescript/bin/tsc --noEmit`; production
`node tools/deck/cli.mjs build`; version and diff-whitespace checks.
Only the existing upstream semver circular-dependency build warning remains.
No automated failure is left unresolved.

Mocked 99/101 legacy checkpoint with 99 stale/missing expiries: **2 metadata
requests**, reaching 101/101; none of the 99 verified entries is repeated.
Four simultaneous continuations: **1 metadata operation**. Deferred continuation:
**0 further metadata calls**, including after provider recreation. A real PS2
resume needed **1 HTTP dispatch** because candidate 45076 had already completed.
No profile/history refresh or independent HTTP client was added. Existing
Community publication/visibility and subset visibility tests continue to pass.

Physical checks still pending: full-viewport loader at native Deck resolution,
controller Up/A/Down on a genuinely partial console's discovery action, focus
after action disappearance, Back, and existing subset expand/collapse. The
scripted live checkpoint repair is not a physical controller pass. The repaired
PS2 page should now show its two verified Tony Hawk subset cards without the
discovery panel; another partial console can exercise the action without
artificially invalidating PS2's completed checkpoint.

Final deployment evidence for this correction: frontend 2,646,994 bytes,
SHA-256 `7b6b466edd78ee5b04cee9dddd0d609cf854a177e738eacaedbf436b75ce6432`,
33 assets copied and frontend readiness confirmed. The only changed backend
module is diagnostics.py, SHA-256
`0c110a593db0bce871d9316cd48c9b4e4d50d8ae36b198fa8c629bfbfde8b70d`;
it was activated through Decky's supported per-plugin reload. All 17 Python
files plus the frontend matched the checkout. Runtime rollback archive:
`/tmp/ac-before-final-subset-ux-1793297286602.tar`.

SQLite remained at schema 1 with integrity `ok`, 226 cached resource rows,
1,058 historical events and 11 game proofs; no persistent data was cleared.
The final read-only check showed healthy storage, no pending/active requests,
no history import, no cooldown, and the PS2 checkpoint still complete at
101/101 with both Tony Hawk child IDs retained. Version consistency remained
0.38.2; version metadata, commits, pushes and tags were not changed in this pass.


## Independent audit remediation — ownership decisions

- Canonical frontend content versions use an instance epoch and monotonic content
  sequence, scoped by account and resource identity. Freshness is independent.
  Transport provenance follows the actual raw game response into normalized
  snapshots. Compact/full-screen, subset, badge and native caches check source
  versions on re-entry; mounted snapshots remain immutable. Dashboard reuse
  checks the complete required source-version vector. Restart never makes a
  persisted presentation authoritative merely through matching wall-clock dates.
- Completion page zero with the production 500-record query is served by one
  backend completion-collection resource, separate from legacy page rows. Its
  assembler owns all page HTTP operations through the same scheduler. It validates
  IDs, uniqueness, totals and coverage, then rechecks page zero for multi-page
  collections. One reconciliation pass is allowed. RA offers no snapshot token:
  these checks detect observable drift, and do not claim transactional provider
  isolation. Failure preserves the previous complete resource with an error.
- Consumer waiting, HTTP lifetime and publication ownership are separate. An
  active scheduler operation retains its shared future after entry deadlines.
  Community RPC delivery follows that completion; frontend wait boundaries remain
  bounded. Starting a replacement frontend operation advances publication ownership;
  a late authoritative response can publish, a superseded response cannot.
- SQLite's existing state table stores generation fences transactionally, including
  invalidations before the first resource row exists. Resource writes check both
  row and durable generations. No schema version change or cache wipe is required.
  Restore applies the fence before freshness checks. Failure deferrals carry the
  resource generation as well.
- A validated heartbeat during one relevant local process session records its
  process ID with the bounded observed-session evidence. ROM switches update that
  association. An unmapped exit consults this evidence independently of native
  projections; unknown exits remain unresolved for bounded checks. Different games
  and newer account heartbeats remain valid. Existing session persistence retains
  the association across restart.
- Subset removal requires an explicit valid parent field: positive integer parent
  or null for no parent. Missing/malformed values retain verified relationships
  through the existing deferred-verification checkpoint policy.


### Remediation verification and deployment

Final validation: 812 Node tests (`node scripts/run-tests.mjs --node-only`),
142 Python tests (`python -B scripts/run-python-tests-offline.py`), TypeScript
(`node node_modules/typescript/bin/tsc --noEmit --incremental false`), version
consistency and `git diff --check` pass. The production build succeeds with the
existing upstream semver circular-dependency warning. Versions remain 0.38.2.

Executable regressions cover obsolete compact/native presentations, superseded
frontend A/B responses and unsuperseded late completion, the delayed first SQLite
write, concurrent rejected durable writes and restart restoration, complete
501-game collection refresh, bounded mid-pagination drift, account-scoped
collection requests, late Community completion, unmapped emulator exits and
persisted process association, and malformed versus authoritative subset parents.
Mock measurements: obsolete presentation rebuild adds zero requests (two total
including the deliberate canonical refresh); A/B race uses two operations;
501-game collection uses three page calls including first-page verification,
fresh re-entry adds zero, concurrent refresh shares three; persistent drift is
bounded to four calls; first-write invalidation requires one rejected and one
replacement fetch; late Community success uses one operation across both waiters;
the emulator test uses one entry, one exit and two deliberate newer-account
validations; each malformed subset case joins concurrent continuation into one
metadata operation. These mocks do not establish fleet-wide provider limits.

The final runtime was deployed to production ghast. All 17 Python files match the
checkout; the frontend bundle and 33 emitted assets passed remote hash parity.
Backend activation used Decky's supported loader/reload_plugin route after the
documented service restart required an unavailable sudo password. Logs confirm
backend unload/load, and a cache-bypassing frontend reload reports Decky/DFL ready.

SHA-256:
- dist/index.js: 501eac1b82f6d18bef6ab89de7a38a1db21c57f95897842e49b4f2a9e2192cce
- main.py: 3bab932987617f97aae27a7778a39111c693886e2923eee663529e50b8572800
- ra_coordinator.py: 1ee86e247c15a2ef81e645e27a4d310a04ec97f2a3d7008d488fb83653b4e8fb
- ra_scheduler.py: 926e1ebbccdeef5786e7c546ab08d1c09e08b3310089ad8be907821783704588
- ra_state.py: 74271e6390b5109ee2e87f6c05f120f488a4c8aff8e8c700b1165aaba54c5183

SQLite remains schema 1 with integrity ok: 234 resources, 1,058 history events,
one history checkpoint and 14 game proofs. Pre/post full-table fingerprints
match, as do provider configuration/secrets, Companion preferences and the
persisted subset relationship checkpoint. Diagnostics show healthy storage,
zero active/pending requests, zero cooldown and no active history import.
Rollback runtime: /tmp/ac-before-audit-remediation.tar. No persistent data was
cleared; no versions, commits, tags or remote Git state were changed.

Actual launch/exit, emulator ROM switching, controller focus/Back and native
Community/loader geometry were not physically exercised in this remediation.
The user retains those checks. All seven code reproductions are resolved by
executable tests; this is not a blanket production release or fleet-rate guarantee.


## Second independent audit remediation — exact provenance and final publication

- Resource results now carry their exact frontend content revision, bound before
  subscriber delivery. Transport provenance uses that returned revision rather
  than querying a potentially newer record after awaiting. Source identity includes
  account revision, canonical query identity, coordinator epoch and content sequence.
- A small core provenance helper carries exact source dependencies through profile,
  completion collection and recent-game normalization. Dashboard snapshots retain a
  sorted unique source vector, including completion data used for award enrichment.
  Conflicting generations remain distinct and cannot match the current vector.
  Calendar/history/recommendation transformations preserve the snapshot's provenance;
  presentation commit never relabels old content with new sources. Re-entry rebuilds
  locally from fresh canonical resources; mounted snapshots remain atomic.
- Backend final publication occurs without an await between the final generation
  check, memory write and live return. History proofs and failure-state cleanup use
  transactional durable generation checks. Superseded reconciliation cannot publish
  or clear successor failure state.
- Bulk invalidation captures stable targets under an account-scoped entry barrier.
  Existing work is fenced synchronously; persisted targets are invalidated durably.
  New entries in that account wait and become successors after the barrier, including
  newly discovered query variants. Unrelated accounts proceed independently. Targeted
  invalidation uses the same barrier. This is invalidation coordination, not a new
  refresh or HTTP scheduling mechanism.
- Native mapping is a launch hint. Exit prefers the latest corroborated process game,
  including ROM transitions. Unknown shortcuts never acquire ownership by temporal
  overlap. An unmapped recognized emulator requires a bounded launch-time activity
  transition; existing corroborated sessions can carry ROM switches. Persisted evidence
  records mapped/emulator ownership; legacy records retain ordering value but cannot
  authorize exit suppression. Already-present remote activity is not reassigned merely
  because an emulator starts. Newer/different account activity remains authoritative.
- RA summary does not identify the originating device. A recognized emulator launch
  and a simultaneous remote game transition can remain observationally ambiguous;
  these rules are corroboration, not a provider-certified device identity. Unknown or
  legacy ownership is preserved as account activity without an unjustified exit fence.

Validation: 819 Node tests and 144 Python tests pass; TypeScript, version consistency
at 0.38.2 and production build pass (existing semver circular dependency warning).
New executable tests cover the transport/normalizer/compact race over twelve promise
interleavings; dashboard canonical changes during both calendar and recommendation
work; history-reconciliation invalidation with successor publication; concurrent bulk
invalidation and same-kind identity registration; stale ROM projection exit; unrelated
shortcut and existing remote activity; persisted legacy association safety.
Mock measurements: transport race uses two dispatches including deliberate refresh,
then zero additional reconstruction calls; dashboard re-entry uses zero additional
calls; backend A/B race uses exactly two operations and the next lookup is fresh;
unrelated shortcut exit triggers zero Recently Played calls; corroborated ROM exit
triggers one reconciliation after the switch reconciliation has settled. Original
coherent completion pagination and Community late-success regressions remain passing.

Deployment: production ghast frontend bundle and 33 assets passed parity, backend
activated through loader/reload_plugin, and frontend hard reload reports Steam/Decky
ready with 393 apps. SQLite integrity is ok; pre/post full-table fingerprints match
(234 resources, 1,058 history events, 14 game proofs, one history checkpoint), as do
provider settings and secret fingerprints. No persistent data was cleared. Diagnostics
show zero active/pending requests, zero cooldown, and no history import. Runtime
rollback: /tmp/ac-before-second-audit.tar. Final backend parity is checked after the
last invalidation-barrier validation. No versions, commits, tags or pushes changed.
Physical controller/gameplay/ROM-switch verification remains user-owned and unclaimed.

Final deployed SHA-256 values for this pass:
- Frontend: 0bb9dd63d9d056f156be90b4154af151dee1e9687f75bcba02b0027374545901
- main.py: 5cc7d86489d7d6547218d48de999ee0a1d836768a71f700d196fe86a60bf7f22
- ra_coordinator.py: 61f8ada480f53ecc424efa28a8229aefd26ca0dcbb74cd52bf0f3fa2c5ee3edb
- ra_state.py: 41784518f659fce532d7c642cb6213feb0dca6b75d8682fe46cf24bfe7ce9cb2
All 17 Python sources match the checkout after final activation. Backend-only final
barrier changes were followed by the complete 144-test Python suite. Frontend build
matches the final 819-test Node run. Diff whitespace and version checks pass.


## Targeted final-audit corrections — hydration, cancellation, sessions, retention

- SQLite hydration holds a revocable per-read token. Canonical publication and
  invalidation revoke outstanding reads before any further await. After reading,
  restoration either retains that authority or uses current memory; if the newer
  publication was evicted, it rereads SQLite. Thus same-generation explicit refresh
  is protected without treating an invalidation generation as a content revision.
  Tokens exist only while reads run and are cleaned on completion or cancellation.
- Bulk and targeted invalidations now have owned completion tasks, shielded from
  waiter cancellation and tracked until actual completion. The entry barrier belongs
  to that task. Shutdown drains these tasks before stopping backend services. Profile
  repair owns its complete kind group, so cancellation cannot skip later kinds.
  SQLite invalidation errors propagate; cancelled waiters leave diagnostic failure
  reporting on the retained task rather than a false success. Abrupt OS process loss
  is not a guaranteed completed operation; graceful plugin unload drains authorized
  durability work. No cache wipe or schema migration was introduced.
- Each Steam launch establishes ownership from its current mapping/classification.
  Prior process ownership is not inherited across launches. An observed unknown
  launch also prevents fallback to historical persisted ownership at exit. History
  remains available for Continue Playing; existing emulator ROM transitions remain
  associated within the current launch. No guaranteed OS process ID is invented.
- Frontend operations use unique mutable ownership tokens rather than reusable
  numeric generations. Clearing/invalidation revokes the token itself; deletion of
  metadata cannot make a late token valid again. Superseded operations fail authority
  checks; unsuperseded late work still publishes after consumer deadlines. Active
  ownership is retained only for actual unfinished work, and completion releases it.
  Content revisions share the bounded payload retention, are removed on eviction,
  and clear to zero. Their global monotonic sequence never resets on resource clear.

Executable regressions: delayed hydration versus same-generation refresh; hydration
versus invalidation; hydration after newer data is evicted with account isolation;
caller cancellation during multi-row invalidation and shutdown drain; matching entry
barrier and unrelated-account freshness; surfaced storage failure and successful retry;
cancellation of a multi-kind repair; reused shortcut with remote game 99, followed by
a genuine corroborated emulator launch; 2,000 identities, revision cleanup, late old
responses after clear/successor and account change. Existing audit tests remain intact.

Measured: 2,000 frontend payloads retain 128 content revisions, zero active owners
when settled, then zero revisions after clear. Delayed hydration uses one deliberate
refresh HTTP operation beyond original population and zero recovery calls, including
after eviction. Reused shortcut exit adds zero Recently Played calls. Legitimate
emulator sessions still reconcile on exit. Central pacing, retries, cooldown,
completion pagination and Community late completion retain their existing owners.

Local validation: 821 Node tests pass; final Python suite result and deployment
verification follow below. TypeScript, version consistency (0.38.2), whitespace
validation and production build pass, with the existing upstream semver warning.
No source version, commit, tag or remote Git state was changed. Physical gameplay
and controller verification remain unclaimed; this pass changes no UI layout.

Final validation for the four targeted corrections: **821 Node / 150 Python passed**.
TypeScript, production build, version consistency and diff whitespace pass. The build
is 2,657,250 bytes. Deployed artifact verification is **pending**: two explicit Windows
OpenSSH attempts with the configured ghast alias timed out at 192.168.0.17:22, even
with elevated network access. No remote copy, activation, database or settings change
was performed during this pass. Prior deployment evidence above is historical.

Prepared SHA-256 values (local artifacts, not deployed verification):
- Frontend: 36aa82a957372cd3b726f25df6e2331d25b4b3e38710ac013cf80e65e895d72b
- main.py: 74ca730b082e2df968d5a62ac40fead09d6d689870d0aaf0e4e09ae5bedb9be8
- ra_coordinator.py: 8580fe8441bcb6d1ba166e4bf220746625319875c4d142c48d6234aec50af417
- ra_state.py: 6366991d49579e37f1d6dbba7e21d63d7fcd2523411b769554afed441b2d901c
The implementation is prepared for independent re-audit; deployment/readiness,
post-update integrity, source parity and physical scenarios remain unverified.


### Targeted correction deployment completed

After the user powered on ghast, deployment completed using the exact validated
artifacts above. Frontend SHA-256 36aa82a957372cd3b726f25df6e2331d25b4b3e38710ac013cf80e65e895d72b
and all 33 assets passed parity; all 17 Python sources matched. Backend activation
used Decky's loader/reload_plugin; logs confirm unload/load. Cache-bypassing frontend
reload and readiness passed with Decky/DFL and 393 Steam apps available.

Read-only checks: SQLite schema 1, integrity ok, 234 resources, 1,058 history events,
14 game proofs and one history checkpoint. History events, history checkpoint, state
table, provider config and secrets fingerprints are unchanged. Browser subset
checkpoint and saved preference fingerprints match across activation. Resource and
proof table fingerprints changed: logs show a normal stale game 10272 progress
request and reconciliation at 21:16:00 UTC, before backend reload at 21:16:26 UTC.
These two tables are therefore not claimed byte-for-byte unchanged. No data was
cleared and no history import occurred. Final backend diagnostics: healthy storage,
zero active/pending/sent requests since activation, zero cooldown, historyActive 0.
Rollback runtime: /tmp/ac-before-targeted-audit.tar. Physical controller/gameplay
scenarios remain unclaimed. Version remains 0.38.2; no commits, pushes or tags.


## Targeted interaction corrections — launch identity, admission and shutdown

A retained native projection records its exact shortcut identity, including launch
options now exposed by the existing metadata endpoint. Steam launch notifications
establish a new session immediately, without trusting the retained game ID. A
local metadata read may corroborate mapped ownership only when the current identity
matches that retained proof. Per-launch tokens, account revision and disposal checks
reject late verification after exit/restart/account changes. Exits consult current
session evidence rather than passing an unchecked presentation ID. No RA request is
needed for identity verification. Missing metadata retains account activity.

Admission records its generation under the existing scope barrier before asynchronous
preparation. Each preparation boundary checks that admission; a changed generation
re-enters the barrier before becoming a successor. Refresh tasks receive the captured
generation, rather than reading whatever generation exists when their coroutine starts.
The final publication check remains synchronous with memory publication and return.
No lock spans HTTP work. Durable fencing and hydration tokens retain their prior roles.

Shutdown closes admission, owns a shielded completion task and settles all tracked
invalidations with return_exceptions before reporting a failure. Cancellation waits
for the owned drain. Every task retains its existing diagnostic failure reporting.
Plugin unload attempts all service cleanup and prepared-artifact cleanup before
rethrowing the first service failure. Existing cancellation tests now check unrelated
account reads before shutdown closes admission, preserving that isolation assertion.

Executable regressions traverse the registered Steam callback, real projection
lookup/identity check and real presence coordinator together, covering a retained
projection after shortcut reuse and a legitimate ROM-switch exit. The SQLite admission
race uses deterministic thread events: population plus successor requires two calls;
unrelated Bob adds one, with zero further calls on fresh re-entry. Shutdown tests cover
one/both failures, cancellation, empty/repeated shutdown, and plugin cleanup after error.
Unrelated shortcut exit adds zero Recently Played calls; legitimate emulator/ROM exit
adds one targeted reconciliation. Physical gameplay and controller tests remain user-owned.

Validation for this pass: 822 Node tests and 156 Python tests pass. TypeScript,
version consistency at 0.38.2, production build and diff whitespace checks pass.
Production bundle is 2,658,921 bytes (existing upstream semver circular warning).
No commits, pushes, tags, version changes or persistent-data clearing occurred.
Deployment completed after ghast became reachable again. Frontend and 33 assets
passed parity; all 17 Python sources match the checkout. Backend activation through
loader/reload_plugin and a cache-bypassing reload succeeded; Decky/DFL readiness
passed with 393 Steam apps. Logs confirm backend unload and load.

Deployed SHA-256:
- Frontend: 20e476e9b44cd1e9073a350ded7ab88c667bbcd5a01d7a485d88ab72f4b1a10c
- main.py: 5b5220bc587d4224be323f069a433bbe156bfba31c504f32c6e3a7d68d6ced14
- ra_coordinator.py: 86262ed9c6a4d7a9007bb3e1a44f77b48716fd52b0f84a3dd155bc0db1db1b41
- steam_shortcuts.py: f578215320f385b9abe6f06a7073624b5715f891fc676a3f6e23d75638cb9434

SQLite schema 1, integrity ok, 234 resources, 1,058 history events, 14 proofs and
one history checkpoint. All five table fingerprints matched across activation,
as did provider configuration/secrets, browser settings and subset checkpoint
fingerprints. Final diagnostics report healthy storage, zero active/pending/sent
requests since activation, no cooldown and no active history import. No persistent
data was cleared. Rollback runtime: /tmp/ac-before-interaction-corrections.tar.
Physical gameplay/controller verification remains user-owned and unclaimed.


## Final Rich Presence ordering correction

Launch verification supplies initial process evidence at revision zero. Each current
process now carries an evidenceRevision, incremented when heartbeat corroboration
changes its game association and when initial mapped verification is accepted.
A delayed initial mapping cannot replace any newer corroborated association, even
within the same launch token. Subsequent genuine ROM transitions still advance the
association. Relaunch starts a new revision-zero session; existing adapter token,
account, active-process and shortcut identity checks remain in force. No clock is
used as the ordering fence, and no additional refresh or polling owner was added.

The registered-callback integration fixture now delays the actual metadata bridge.
New tests cover 99, 99-to-20, multiple switches, returning to 99, completion after
exit, rapid relaunch, account change and changed shortcut identity. The ROM-switch
reproductions failed before this correction and pass afterward. Verification adds
zero presence requests; exit adds exactly one Recently Played reconciliation;
duplicate exits add zero. Newer account heartbeats remain valid. Existing ordinary
mapping, early verification and unrelated shortcut coverage remains intact.

Validation: 38 focused tests, 830 full Node tests, 156 Python tests, TypeScript,
version consistency (0.38.2), production build and git diff --check pass. Existing
upstream semver circular warning remains. Changes are limited to the presence
coordinator, lifecycle integration tests and this record.

Frontend deployed to ghast: SHA-256
067fce2784dae074782f2844e26be6b1543aa7215d14b87d3952517822636a9a.
Bundle and 33 assets passed parity. All 17 unchanged Python files match the checkout.
Frontend hard reload/readiness passed with 393 apps; Decky service is active.
SQLite schema 1, integrity ok; all five table fingerprints and provider settings/
secrets fingerprints matched pre/post deployment. Counts remain 234 resources,
1058 history events, 14 game proofs and one history checkpoint. Browser preferences
and subset checkpoint fingerprints also match. Live diagnostics report healthy
storage, zero active/pending/sent requests, no cooldown and no history import.
Rollback: /tmp/ac-before-presence-ordering.tar. No versions, commits, pushes, tags
or persistent data were changed/cleared. Physical gameplay/controller validation
remains user-owned; this resolves the executable ordering reproduction, not a claim
of physical release sign-off.


## Community focus lifecycle and title clipping (2026-10-30)

The asynchronous RA Community resource previously supplied its section entry focus
anchor only with ready statistics. The full-screen page consumed its restoration
nonce while that target was absent. On ghast, cold entry and subsequent ready
content had zero gpfocus nodes. A persistent existing SpotlightFocusTarget now
belongs to the page and wraps both loading and ready content; the inner statistics
card delegates focus to it. The existing restoration and footer handlers remain
unchanged; no new focus request, timer, synthetic event or request policy exists.

Device checks after deployment: native ra-community-summary focus exists during
The Legacy of Goku loading and survives ready publication; first L1 moves to
Achievements, first R1 wraps to Overview, returning/cached navigation and Back work.
On Cool Spot, L1 during confirmed loading immediately opens Achievements. Rapid
alternating shoulder inputs also return to the expected section. The original
reported ineffective physical first press was not reproduced by the harness before
the fix (its L1 navigated), so the confirmed pre-fix evidence is the missing native
focus target, not a claim that its physical event-consumption path was captured.

The RA full-screen identity group now reserves width against center facts; parvagans
is visibly complete on ghast. Shared QAM responsive titles retain fitting but allow
unclamped wrapping, including before measurement; Tony Hawk's Underground was
visually verified. Long-title markup and persistent focus ownership have regression
coverage alongside the real footer navigation functions. These checks complement,
not replace, the device focus/transition evidence above.

Validation: 833 Node tests, 156 Python tests, TypeScript, version check (0.38.2),
production build and git diff --check passed. Frontend SHA-256
294f6b923022801dfc2f065ac8534dcf4412f80b7e76eb6f3f81073666821224
and 33 assets passed deployed parity; hard reload/readiness passed. Backend and
persistent data were not replaced or cleared. Normal navigation may populate
canonical resources. Rollback frontend: /tmp/ac-before-community-focus.tar.
