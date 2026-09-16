---
phase: 34-combat-screen-rebuild
plan: 02
subsystem: ui
tags: [vanilla-js, fight-log, routing-seam, aria-live, source-assertion-tests]

# Dependency graph
requires:
  - phase: 34-01
    provides: "src/browser/fightLog.js (fightLogLinesFor/appendFightLog/dullFightLogLine/fightLogRows/toggleFightLogEntry/fightLogAnnouncement), toasts.js's opts.withIdx + oracleDetailText"
provides:
  - "dispatchWithToasts routes on wasCombat||inCombat (ONE if/else) into the whole-fight window.__mzFightLog (narrative + dull refusals, uncapped); out-of-combat lines stay on the MAX_TOASTS-capped toast queue"
  - "window.__mzFightEnd — the ending action's own folded lines, parked for Plan 05's over-panel instead of toasting into a vanished panel"
  - "window.__mzCombatMenu reset-on-every-dispatch site (Plan 04 owns the actual submenu content)"
  - "renderFightLog(host) / syncFightLogLive(log) — the newest-first, tap-to-reveal-in-place fight log + seq-gated aria-live announcer, replacing the Round Card entirely"
  - "noteCombat's rep.over (won|soothed) tag and the beats.over:\"fled\" surface for a successful flee"
  - "the DR18 CSS rule scoped to #enc-body .evt so the fight log can show its own dice on tap"
affects: [34-03-shell-combat-screen, 34-04-shell-combat-actions, 34-05-shell-combat-over]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single routing if/else keyed on wasCombat||inCombat (checks BOTH sides of dispatch so the action that ends combat still gets its own lines captured, onto window.__mzFightEnd rather than a toast the closing panel would never show)"
    - "in-place DOM toggle (roll.hidden flip + re-assigned window.__mzFightLog) with zero renderEncounter() call, so a log tap never re-arms the guarded decision buttons"

key-files:
  created:
    - test/unit/shell-fight-log.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-toast-wiring.test.js
    - test/unit/round-card-worst-case.test.js
  deleted:
    - test/unit/shell-round-card.test.js

key-decisions:
  - "Flee ending routed through noteCombat's existing beats-branch: after.beats = { groups: [{ title: \"You got out\", tone: \"moss\", lines: [] }], i: 0, action: null, over: \"fled\" } — reuses the beats surface Plan 05 already renders, rather than inventing a new presentation channel for the flee case"
  - "window.__mzFightEnd is populated only when the dispatch both wasCombat and is no longer inCombat (the ending action) — a plain in-combat dispatch never touches it, and a fresh fight/noteCombat's fresh-fight branch clears any stale parcel from a PREVIOUS fight"
  - "window.__mzCombatMenu reset lives inside dispatchWithToasts itself (not a later plan's call site) per CONTEXT's 'reset on every dispatch' spec, even though no plan before 34-04 writes a non-null value to it yet"

patterns-established:
  - "Pattern: a log/announcer element is read through ONE bridge object (window.__mzFightLogVM) exposing only the pure module's read/derive functions — the classic script never imports fightLog.js a second time"

requirements-completed: [CSCR-04, CSCR-09]

coverage:
  - id: D1
    description: "dispatchWithToasts routes EVERY folded line of an action that was in combat before OR after dispatch into window.__mzFightLog (narrative and dull refusals alike, uncapped) via ONE if/else; out-of-combat lines still go to the MAX_TOASTS-capped toast host exactly as before"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#SOURCE: dispatchWithToasts routes on exactly one if (wasCombat || inCombat), never re-checks PRIORITY.block itself"
        status: pass
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js#Phase 34: dispatchWithToasts routes log-vs-toast via a single if/else, uncapped log + MAX_TOASTS-capped queue"
        status: pass
    human_judgment: false
  - id: D2
    description: "window.__mzFightLog accumulates for the whole fight, is null out of combat, and the ending action's lines land on window.__mzFightEnd instead of a toast"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#SOURCE: dispatchWithToasts routes on exactly one if (wasCombat || inCombat)... (appendFightLog/window.__mzFightEnd pins)"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderFightLog(host) renders the › log newest-first via window.__mzFightLogVM.rows, textContent-only, with an in-place tap-to-reveal roll line that never re-arms the decision buttons"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#renderFightLog(host) reads window.__mzFightLogVM.rows, builds entries via textContent, tags revealable entries, toggles in place"
        status: pass
    human_judgment: false
  - id: D4
    description: "the persistent #enc-round-live announcer announces only NEW entries (seq-gated) and clears when the log clears; the DR18 rule no longer hides dice inside the fight log (scoped to #enc-body .evt)"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#guard-helper region defines syncFightLogLive(log)... / DR18's dice-hiding rule is scoped to #enc-body .evt"
        status: pass
    human_judgment: false
  - id: D5
    description: "window.__mzRoundCard, ROUND_CARD_COPY, syncRoundCardLive, roundCardSeq and the .round-card CSS are fully retired (zero non-comment occurrences)"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#renderEncounter region calls renderFightLog(...) and carries zero Round Card artifacts / syncRoundCardLive has zero occurrences anywhere in CODE"
        status: pass
    human_judgment: false
  - id: D6
    description: "noteCombat tags the end-of-fight report with rep.over (won|soothed), builds an over:'fled' beat on a successful flee, and clears window.__mzFightEnd on a fresh fight"
    requirement: CSCR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#noteCombat tags rep.over (won|soothed), the flee beat carries over:\"fled\", and window.__mzFightEnd is cleared on a fresh fight"
        status: pass
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js#the flee beat title \"You got out\" is clear of content/safety-wordlist.js BANNED"
        status: pass
    human_judgment: false
  - id: D7
    description: "the persistent aria-live announcer is preserved intact (CSCR-08's aria-live clause; the rest of CSCR-08 — guardTap on the new screen's action/submenu/FIGHT!/loot/over-panel buttons — is built in Plans 03-05, not this plan)"
    requirement: CSCR-08
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-log.test.js##enc-round-live is a persistent sr-only aria-live=\"polite\" aria-atomic=\"true\" sibling of #enc-body inside #enc-panel"
        status: pass
    human_judgment: false
  - id: D8
    description: "Engine/content/parity untouched; full suite and build stay green; log line count = folded count (refusals included) proven across a 400-seed sweep with dice present"
    requirement: CSCR-09
    verification:
      - kind: unit
        ref: "npm test — 1999/1999 (1998 baseline minus 13 deleted shell-round-card tests plus 14 new shell-fight-log tests)"
        status: pass
      - kind: unit
        ref: "test/unit/round-card-worst-case.test.js (both scenarios: lines.length === folded.length every seed, rollSeeds 400/400)"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-16
status: complete
---

# Phase 34 Plan 02: Fight Log Seam, Renderer, Announcer Summary

**Re-routed the Phase 32 seam from the single-round Round Card to the whole-fight › log: `dispatchWithToasts` now writes every folded line (narrative and dull refusals alike, uncapped) to `window.__mzFightLog` via one `wasCombat||inCombat` if/else, parks the ending action's own lines on `window.__mzFightEnd` for Plan 05's over-panel, and `renderFightLog`/`syncFightLogLive` render it newest-first with in-place tap-to-reveal — the Round Card is fully retired.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-09-16T18:45:32-04:00 (approx.)
- **Completed:** 2026-09-16T19:04:49-04:00
- **Tasks:** 3
- **Files modified:** 4 (1 core + 3 test files, 1 test file deleted)

## Accomplishments
- `dispatchWithToasts` re-routed: a single `if (wasCombat || inCombat)` sends every folded line (narrative AND dull refusals, uncapped via `fightLogLinesFor`) to `window.__mzFightLog`; there is no toast for any in-combat line any more. Out of combat, the toast queue is byte-identical to before (same `toastsForAction(..., { limit: Infinity })` call, same `MAX_TOASTS` cap).
- The action that ENDS combat (a kill, a flee, a death) parks its own folded lines on `window.__mzFightEnd` instead of toasting them into a panel that's about to close — Plan 05 reads this for the over-panel.
- `window.__mzCombatMenu` resets on every dispatch (the reset site Plan 04's submenu will populate).
- `renderFightLog(host)` replaces the Round Card block in `renderEncounter`: newest-first via `window.__mzFightLogVM.rows`, every line via `textContent`, a hidden `.cb-log-roll` per revealable entry toggled IN PLACE on tap (no re-render, never calls `renderEncounter()` — a log tap must not re-arm the guarded action buttons).
- `syncFightLogLive(log)` replaces `syncRoundCardLive`: the persistent `#enc-round-live` sr-only node now announces only NEW entries via `fightLogAnnouncement`'s seq gate.
- The DR18 "no dice in the encounter panel" rule is scoped from `#enc-body p .roll` to `#enc-body .evt p .roll` — the legacy beats/joiner/find narration blocks still hide their dice, but the new `.cb-log-roll` element (a different DOM shape entirely) is unaffected and shows its dice on tap.
- `noteCombat` tags `rep.over` (`"won"` or `"soothed"`) on every win/soothe report and builds a `beats.over:"fled"` surface (title "You got out") on a successful flee — both consumed by Plan 05's over-panel branch.
- Every Round Card artifact (`window.__mzRoundCard`, `ROUND_CARD_COPY`, `roundCardSeq`, `.round-card` CSS, `syncRoundCardLive`) is fully retired — zero non-comment occurrences confirmed by source-assertion test.
- `test/unit/shell-round-card.test.js` replaced by `test/unit/shell-fight-log.test.js` (14 tests); `shell-toast-wiring.test.js`'s Phase 32 routing pin re-pinned to the new single if; `round-card-worst-case.test.js` retargeted so log line count = folded count (refusals included) across a 400-seed sweep, with dice revealed on 400/400 seeds in both scenarios.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-route dispatchWithToasts to window.__mzFightLog, bridge fightLog.js, tag noteCombat, scope the DR18 rule** - `ba2933e` (feat)
2. **Task 2: renderFightLog + syncFightLogLive replace the Round Card block; .cb-log CSS** - `b36bf8a` (feat)
3. **Task 3: Replace shell-round-card with shell-fight-log; re-pin shell-toast-wiring; retarget round-card-worst-case** - `7986f7c` (test)

## Files Created/Modified
- `mazeworld.html` - dispatchWithToasts rewrite, window.__mzFightLogVM bridge, renderFightLog/syncFightLogLive, .cb-log* CSS, scoped DR18 rule, noteCombat's over tags, ROUND_CARD_COPY/roundCardSeq/round-card block removed
- `test/unit/shell-fight-log.test.js` - new, 14 tests (replaces shell-round-card.test.js)
- `test/unit/shell-round-card.test.js` - deleted
- `test/unit/shell-toast-wiring.test.js` - Phase 32 routing pin re-pinned to Phase 34's wasCombat||inCombat single if
- `test/unit/round-card-worst-case.test.js` - retargeted to fightLogLinesFor; log line count = folded count; added rollSeeds tracking

## Decisions Made
- See `key-decisions` in frontmatter: the flee ending reuses the existing `beats` surface (`over:"fled"`) rather than a new presentation channel; `window.__mzFightEnd` is populated only on the actual ending dispatch and cleared on a fresh fight; `window.__mzCombatMenu`'s reset lives in `dispatchWithToasts` itself per CONTEXT's "reset on every dispatch" spec even though no plan before 34-04 writes a non-null value to it yet.
- Requirements: this plan marks CSCR-04 and CSCR-09 complete (both fully satisfied by this plan's own scope). CSCR-08 is NOT marked complete here — this plan preserves the persistent `aria-live` announcer intact (its own slice of CSCR-08), but the requirement's full text ("every decision button on the new screen... goes through guardTap") covers action/submenu/FIGHT!/loot/over-panel buttons that Plans 03-05 build; marking it complete now would be premature. REQUIREMENTS.md's traceability table already carried CSCR-04/CSCR-09 as complete from 34-01 (idempotent re-confirmation here).

## Deviations from Plan

None — plan executed exactly as written. One clarification made during test authoring: Task 3's item (f) BEHAVIOUR partition test, as literally specified ("for every TOAST_FOR type, `fightLogLinesFor("attack", [{type}])` yields only 'dull' lines iff priority===block"), does not require every type to yield a NON-EMPTY line set — `spellThrown` is a chain-intermediate type that legitimately folds to ZERO lines when passed alone (it needs a following `spellHit`/`spellMissed` to produce output via `toastsForAction`'s real fold pipeline, confirmed directly against the pipeline: `toastsForAction("attack", [{type:"spellThrown",...}], {}, {limit:Infinity})` returns `[]`). Wrote the test to assert tone-consistency across whatever lines a type DOES produce (0 or more), rather than requiring exactly one line per type — this is the faithful reading of "yields only dull lines iff..." (a claim about the CONTENTS of the produced set, not its cardinality), and it is proven correct by the REFUSAL_TYPES/narrative-types coverage assertions in the same test, all of which DO produce output.

## Issues Encountered

None.

## Human verification (deferred to end of run)

No device check was run for this plan (per the project's Deferred UAT protocol — autonomous runs batch device checks at milestone close). The following Pixel 7 checks are queued for the end-of-run batch:

1. Start a fight, tap STRIKE twice — the › log shows the newest line at the TOP of the log section and older lines below, no toast appears anywhere during the fight.
2. Tap a "You hit …" line — a gold dice line ("N vs M. You hit … for K hp.") appears under it without the screen re-rendering; tap again — it hides.
3. Tap a greyed action that the engine refuses (e.g. Parley twice) — the refusal appears as a dimmer › line, never as a toast.
4. With TalkBack on, one new log batch is announced once, and reopening/closing a submenu does not repeat it.
5. After the fight ends, the next fight starts with an empty log.

## Next Phase Readiness
- Plan 03 can now move the `renderFightLog(body)` call into the middle band of the three-band layout it builds, and Plan 04/05 can read `window.__mzFightEnd` and `beats.over`/`rep.over` for the over-panel and `window.__mzCombatMenu` for the submenu.
- No blockers. `npm test` 1999/1999, `npm run build:www` exit 0, engine/content/parity untouched, master hash unchanged.

---
*Phase: 34-combat-screen-rebuild*
*Completed: 2026-09-16*

## Self-Check: PASSED

All created/modified files found on disk (`mazeworld.html`, `test/unit/shell-fight-log.test.js`, `test/unit/shell-toast-wiring.test.js`, `test/unit/round-card-worst-case.test.js`, this SUMMARY.md); `test/unit/shell-round-card.test.js` confirmed deleted. All three task commit hashes (`ba2933e`, `b36bf8a`, `7986f7c`) found in `git log`.
