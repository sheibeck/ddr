---
phase: 100-in-game-achievements-unlock-toasts-the-list
plan: 04
subsystem: ui
tags: [achievements, rail, unlock-banner, death-screen, bridge-registry, listener-fan-out]
requires:
  - phase: 100-01
    provides: achievementBus fan-out and the pure banner queue, card builders and Earned strip view
  - phase: 100-03
    provides: window.mzOpenAchievements, mzRefreshAchievementsSheet, mzSyncAchievementsCount
  - phase: 99
    provides: the adapter's one setAchievementListener slot
provides:
  - "mazeworld.html: the achievement rail card (icon path, kind stamp, drain hook, summary-card tap), renderEarnedStrip on the death panel, the module glue and window.__mzAchBanner"
  - "src/browser/bridge.js: the __mzAchBanner entry; docs/SHELL-MODULES.md bridge table regenerated"
  - "test/unit/achievement-banner-shell.test.js: 35 tests"
affects: [100-05, 101]
tech-stack:
  added: []
  patterns: [renderRail asks a bridge for the next held card before it paints, presentation-only parcel read once per death through a bridge member]
key-files:
  created:
    - test/unit/achievement-banner-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/shell-map-rail.test.js
key-decisions:
  - "The beat-end path needed no new renderRail call: the beat runner clears its run before onSettle, onSettle calls window.paint(), and paint() ends in renderRail(); pinned by a source-anchored test"
  - "setAchievementListener(achievementEvents.publish) sits right after setRunRecordedListener(onRunRecorded), before the `await boot(` line; the banner is the first subscriber, Phase 101 subscribes to the same bus"
  - "The strip builder replaces any existing #cb-over-earned in its host, so a redraw never doubles it"
patterns-established:
  - "An unlock card is a normal rail card (railPush, holdForCard, railDismissKind) gated by bannerNext fed with real shell state; no new rail code path"
requirements-completed: [AUI-01]
status: complete
duration: ~45min
completed: 2026-10-05
---

# Phase 100 Plan 04: The unlock banner on screen Summary

**Every unlock now reaches the screen as a lingering, tap-dismissed rail card with its in-game icon, name and sarcastic line: queued through the fan-out, held through fights, shown one at a time on a free rail, collapsed past three into a card that opens the list, and turned into an Earned strip above the death panel's buttons.**

## What was built

- Classic script, `renderRail`: the drain hook sits right after the `!vm || !copy` guard (`window.__mzAchBanner?.drain?.()`; a true answer returns, because the drain pushes the card and re-enters renderRail itself). A card's `iconSrc` builds the icon img (empty alt, aria-hidden) and wins over `iconKey`. `railEl.dataset.cardKind = "achievement"` is stamped for achievement kinds and deleted for any other card.
- The `#mw-rail` body tap reads `tapped = window.__mzRail.card` before the clear and ends with `if (tapped && tapped.opensList) { window.mzOpenAchievements?.(); }` (no `};` inside the handler, so rail-dismiss Section B is unchanged and passes).
- `renderCombatOver` (dead branch) calls `renderEarnedStrip(over, window.__mzAchBanner?.takeStrip?.() ?? null)` after the rank line and before the buttons. `renderEarnedStrip` builds `div.cb-over-earned#cb-over-earned` > `p.cb-over-earned-label` + `ul.cb-over-earned-list` > `li.cb-over-earned-item` > `img.cb-over-earned-icon` + `span.cb-over-earned-name`, createElement and textContent only, no copy literal.
- Module script, one labelled block right after `window.__mzRail = emptyRail();`: `bannerQueue`, `deathStrip`, `onAchievementBanner`, `bannerCtx`, `settleDeathStrip`, `drainAchievementBanner`, `takeDeathStrip`, `clearDeathStrip`, and `window.__mzAchBanner = { onEvent, drain, takeStrip, clearStrip }`. Three imports on their own lines. Registration beside `setRunRecordedListener(onRunRecorded)`. `showTitleScreen` calls `clearDeathStrip()` beside the death-record reset (the queue is not cleared).
- Bridge: `__mzAchBanner` in `src/browser/bridge.js` (owner the module; consumers renderRail, renderCombatOver, showTitleScreen, tools/layout-check.mjs); `node tools/bridge-doc.mjs --write` regenerated the table (68 rows); `--check` exits 0.

## `__mzAchBanner` surface as built

| Member | Behaviour |
|--------|-----------|
| `onEvent(payload)` | the bus subscriber; enqueues `payload.unlocks` only; on any unlock or reveal calls `mzSyncAchievementsCount` and `mzRefreshAchievementsSheet` (each in its own try); on an unlock schedules one `queueMicrotask(renderRail)`; total |
| `drain()` | dead: parks the strip and returns false; else `bannerNext(queue, ctx)`, stores the queue, pushes the card with `railPush`, calls `renderRail`, returns true; total |
| `takeStrip()` | when dead, settles then returns the parked strip (same object on every call); alive: null (and drops a stale parcel) |
| `clearStrip()` | parks null |

ctx for `bannerNext`: `ready` = hero loaded (`s.c`) and `dungeonVisible()`; `fighting` = `combatScreenUp()`; `dead` = `s.dead === true`; `fade` = `__mzStairsFade.active()`; `decision` = `railLocked()` (this also covers a pending torch offer, via `__mzRail.pending`); `railBusy` = the rail holds a card.

## Beat-end finding

A renderRail already follows the last round's playback. `createBeat.fireOnEnd` sets `run = null` before calling `onEnd`, so `active()` is already false; the runner's `onEnd` calls `onSettle`, which in the shell is `() => { window.paint(); window.renderEncounter(); }`, and `paint()` ends with `renderRail();`. By then `S.combat` is cleared and `combatScreenUp()` is false, so the held card is offered the moment the playback ends. No call was added; a source-anchored test pins both links.

## Final CSS class list (for the plan 100-05 layout check)

Strip: `.cb-over-earned` (`#cb-over-earned`), `.cb-over-earned-label`, `.cb-over-earned-list` (flex-wrap, max-height 9.5em, overflow-y auto, overscroll contain), `.cb-over-earned-item`, `.cb-over-earned-icon` (32x32), `.cb-over-earned-name`. Death panel: `#cb-over`, `.cb-over-actions`, `.cb-over-btn`. Rail: `#mw-rail[data-card-kind="achievement"]`, `.mw-rail-icon` (44px wide there) and `.mw-rail-icon img` (44x44), `#mw-rail-icon`, `#mw-rail-title`, `#mw-rail-lines`. No animation or transition in any of them; the strip's two font sizes go through `--mw-text-scale`.

## Tasks and commits

| Task | Commit | Files |
|------|--------|-------|
| 1. Rail and death-panel changes (icon path, drain hook, summary tap, Earned strip) with sandbox tests | 88f8fc15 | mazeworld.html, achievement-banner-shell.test.js, shell-map-rail.test.js |
| 2. Module glue, listener registration, bridge entry, regenerated doc table, part 2 tests | d261fedf | mazeworld.html, bridge.js, SHELL-MODULES.md, achievement-banner-shell.test.js |

## Test counts (targeted only, no full `npm test`, no bots)

- achievement-banner-shell: 35 pass (new; 17 classic-script tests, 18 glue/anchor/bridge tests)
- Task 1 verify list (14 files): 201 pass, 0 fail; Task 2 verify list (10 files): 147 pass, 0 fail
- Extra shell neighbours run once: rail-dismiss, rail-overlay, shell-map-rail, shell-rail-over-panels, typed-text, shell-combat-over, shell-new-best, dead-lockdown, combat-beat-shell, shell-stairs-fade, layout-shell, shell-board, notes-sheet-shell, hud-menu-layout, reduced-motion, voice-corpus: 290 pass, 0 fail
- bridge-registry 10, shell-resume-line 6, achievements-sheet-shell 22, achievement-card-queue 19, achievement-bus 13, compliance-docs 14, stale-terms 6, shell-tab-snapshots 11 (no fixture moved)
- `node tools/bridge-doc.mjs --check`: exit 0

## Declared pin updates

| File | Test | Old | New |
|------|------|-----|-----|
| test/unit/shell-map-rail.test.js | (q) renderRail icon lines | `iconEl.textContent = iconKey ? "" : icon;` and `img.src = featureIconSrc(iconKey);` | `iconEl.textContent = (iconSrc \|\| iconKey) ? "" : icon;` and `img.src = iconSrc \|\| featureIconSrc(iconKey);` (an achievement card's iconSrc wins over iconKey on the same img path) |

Not in the plan's file list; it is the plan's own change to the same two lines. rail-dismiss Section B ordered anchor passes unedited. No shell snapshot fixture moved.

## Deviations from Plan

**1. [Rule 1 - pin premise] shell-map-rail (q) re-pinned** (see Declared pin updates). **Commit:** 88f8fc15

**2. Process note:** I wrote the implementation before the tests rather than strictly RED first; the tests were then written against the behavior list and all pass. No behavior bullet is uncovered.

No other deviations. Nothing in `engine/`, `content/`, the Phase 99 modules, `rail.js`, `achievementCard.js`, `achievementBus.js` or `achievementsSheet.js` changed. The only new `__mz` name is `__mzAchBanner`.

## Known Stubs

None.

## Threat Flags

None. The glue reads the shell's state and the pure queue and writes only the rail, the death panel and the DOM; a source test forbids network, storage, Capacitor and dispatch tokens in the block.

## Notes for plan 100-05

- Layout check: raise a card with `window.__mzRail = railPush(window.__mzRail, achievementCardFor(id))` then `renderRail()` (or push an `achievement-many` card), and a strip by stubbing `window.__mzAchBanner.takeStrip`/queueing through `window.__mzAchBanner.onEvent({unlocks:[{id,at}]})` with the hero dead; then measure `.cb-over-actions` buttons against the viewport. The strip list is capped at 9.5em and scrolls inside itself.
- Icon paths are page-relative (`achievements/ingame/ach_*.png`); the strip and the rail card both load them, so plan 100-05 must ship the folder in the web bundle.
- The Phase 101 subscription contract: `achievementEvents.subscribe(fn)` from `src/browser/achievementBus.js`; never call `setAchievementListener` again (a test pins exactly one call).
- `getAchievementRecord(` count inside the achievements-sheet block is unchanged; this plan added no reader.

## Human verification (deferred to end of run)

On the Pixel 7, once the debug APK includes plans 100-04 and 100-05:

1. Die on floor 1 with a fresh hero: read Special Snowflake in the Earned strip on the THAT IS THAT panel, above BURY THEM, with both buttons still reachable.
2. Earn a tier while walking: the card rises with the icon, ACHIEVEMENT, the name and the line, holds about twice the old length, and a tap dismisses it (the first tap right after it appears is ignored by the arm window).
3. Cross a tier inside a fight: no card during the fight or its last-round playback; it appears when the playback ends.
4. TalkBack: one card announces ACHIEVEMENT, the name and the line once.
5. The four-at-once collapse and the summary card's tap have no practical device route; they are covered by the unit and sandbox tests.

## Self-Check: PASSED

- FOUND: test/unit/achievement-banner-shell.test.js, __mzAchBanner in src/browser/bridge.js, renderEarnedStrip and the glue block in mazeworld.html
- FOUND commits: 88f8fc15, d261fedf
