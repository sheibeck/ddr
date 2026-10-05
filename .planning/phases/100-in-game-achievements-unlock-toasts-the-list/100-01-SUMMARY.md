---
phase: 100-in-game-achievements-unlock-toasts-the-list
plan: 01
subsystem: ui
tags: [achievements, rail, unlock-banner, listener-fan-out, voice-corpus]
requires:
  - phase: 98
    provides: content/achievements.js catalog (77 entries, names, lines, listOrder, ingame icons)
  - phase: 99
    provides: the adapter's one setAchievementListener slot and its { unlocks, reveals, progress } payload
provides:
  - "src/browser/achievementBus.js: createAchievementBus, shared achievementEvents (subscribe/publish/size)"
  - "src/browser/achievementCard.js: ACHIEVEMENT_CARD_COPY, card builders, pending queue, drain gate, Earned strip view"
  - "ACHIEVEMENT_CARD_COPY registered in the safety scan and the voice corpus"
affects: [100-02, 100-03, 100-04, 100-05, 101 Play mirror]
tech-stack:
  added: []
  patterns: [closure-bound fan-out in front of a single-slot listener, pure queue plus ctx-boolean drain gate]
key-files:
  created:
    - src/browser/achievementBus.js
    - src/browser/achievementCard.js
    - test/unit/achievement-bus.test.js
    - test/unit/achievement-card.test.js
    - test/unit/achievement-card-queue.test.js
  modified:
    - test/voice/safety-scan.test.js
    - tools/lib/voice-corpus.mjs
key-decisions:
  - "The card reuses RAIL_HOLD.level (12000); no RAIL_HOLD key added, rail.js untouched"
  - "Summary and strip views deduplicate ids, so one id twice is one entry (summary needs 2 distinct)"
  - "bannerNext also filters the stored pending list through the catalog, so a tampered queue can never put unknown text on a card"
  - "A null or malformed queue comes back as the shared frozen empty queue; a valid queue with nothing added comes back as the very same object"
patterns-established:
  - "Only a strict true counts for each bannerNext ctx flag; a missing ctx blocks (ready false), so the safe default is to show nothing"
requirements-completed: []  # AUI-01 is only partly delivered here (pure core); 100-04 wires the shell
status: complete
duration: ~25min
completed: 2026-10-05
---

# Phase 100 Plan 01: Unlock banner core Summary

**A pure, headless banner core: a closure-bound listener fan-out (`achievementEvents`) so the adapter's one slot can feed the banner and Phase 101, one dismissible non-decision rail card per unlock, and a pending queue that holds in a fight, collapses past three, hands death to an Earned strip and loses nothing.**

## What was built

- `src/browser/achievementBus.js` (no imports): `createAchievementBus()` returns a frozen `{ subscribe, publish, size }` of closures; `achievementEvents` is the shared instance. Each subscriber runs in its own try/catch with a swallowing catch on any thenable; `publish` snapshots the subscriber set and returns undefined.
- `src/browser/achievementCard.js` (imports only the catalog and `RAIL_HOLD`): copy bank, `achievementIconSrc`, `achievementCardFor`, `achievementSummaryCard`, `emptyBannerQueue`, `bannerEnqueue`, `bannerNext`, `earnedStripView`, per the plan's card_spec.
- Voice tooling: `ACHIEVEMENT_CARD_COPY` is walked by `collectAuthoredStrings` (labels `ACHIEVEMENT_CARD_COPY.*`, so the Phase 98 count of 231 stays exact) and registered in `BANK_REGISTRY` as a `rail-cards` bank.

## Surfaces for the next plans

`bannerNext(queue, ctx)` ctx fields (booleans, only a strict `true` counts):

| field | the shell passes |
|-------|------------------|
| `ready` | a hero is loaded and the dungeon is visible (a store or loot screen still counts as ready) |
| `fighting` | `S.combat` is up |
| `dead` | the hero is dead |
| `fade` | the stairs fade is running |
| `decision` | a decision card is pending on the rail |
| `railBusy` | a rail card is currently up |

Returns frozen `{ queue, card, strip }`. `card` is `kind: "achievement"` (`achievementId`, `iconSrc`, lines `[name, line]`) or `kind: "achievement-many"` (`opensList: true`, `achievementIds`, lines `[lead, ...names, hint]`). `strip` is `{ label, items: [{ id, name, iconSrc }] }` or null. The shell stores the returned `queue` back.

Final strings of `ACHIEVEMENT_CARD_COPY`:

- `title`: "ACHIEVEMENT"
- `many.title`: "ACHIEVEMENTS"
- `many.lead`: "{n} at once. The dungeon keeps score and has run out of fingers."
- `many.hint`: "Tap for the full ledger."
- `strip.label`: "EARNED, POSTHUMOUSLY"

Other constants: `ACHIEVEMENT_COLLAPSE_OVER` = 3, `ACHIEVEMENT_ICON_DIR` = "achievements/". Icon paths are page-relative, e.g. `achievements/ingame/ach_depth_t1.png` (plan 100-05 ships the folder). Shell wiring: register `achievementEvents.publish` as the adapter's one listener; enqueue `payload.unlocks` only (never `reveals`); write every name and line with `textContent`.

Catalog order note for fixtures: `unicorn` sorts before `tourist` (list order is depth_t1..t3, unicorn, death_falling, ...).

## Tasks and commits

| Task | Commit | Files |
|------|--------|-------|
| 1. Achievement bus | 135733dd | achievementBus.js, achievement-bus.test.js |
| 2. Copy bank, icon helper, card builders, voice registration | e15f7c5b | achievementCard.js, achievement-card.test.js, safety-scan.test.js, voice-corpus.mjs |
| 3. Queue, drain gate, collapse, Earned strip | 3c202ea9 | achievementCard.js, achievement-card-queue.test.js |

## Test counts (targeted only)

- test/unit/achievement-bus.test.js: 13 pass
- test/unit/achievement-card.test.js: 8 pass (covers all 77 entries, icon files on disk)
- test/unit/achievement-card-queue.test.js: 19 pass (gate matrix, 3 vs 4 boundary, 200 seeded none-lost scenarios)
- test/voice/safety-scan.test.js: 11 pass (one new test)
- test/unit/rail.test.js: 49 pass, unchanged
- test/unit/voice-corpus.test.js: 29 pass
- test/unit/stale-terms.test.js: 6 pass
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0

No full `npm test`, no bots (project rules).

## Deviations from Plan

None. The plan executed as written. One small design choice within its latitude: summary and strip views deduplicate ids.

No edits to `mazeworld.html`, `engine/`, `content/`, `rail.js`, `engineAdapter.js` or the Phase 99 modules.

## Known Stubs

None.

## Threat Flags

None. Both modules are pure data in and out; no network, storage, analytics or Play call.

## Human verification (deferred to end of run)

Nothing in this plan is device-reachable (pure modules). The first on-device banner check is listed by plan 100-04.

## Self-Check: PASSED

- FOUND: src/browser/achievementBus.js, src/browser/achievementCard.js, the three test files
- FOUND commits: 135733dd, e15f7c5b, 3c202ea9
