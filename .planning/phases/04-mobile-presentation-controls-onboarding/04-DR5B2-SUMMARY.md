---
phase: 04-mobile-presentation-controls-onboarding
plan: DR5B2 (device-review revision round 5, Pass B2 — player-facing copy/voice cleanup + combat feedback, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [voice, copy, tone, combat-feedback, encounter-overlay, oracle-log, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR2: the over-map .mw-overlay (#enc-panel)/hasActiveEncounter(), FEATURE_EVENT_TITLE + beatsTitleFor(events), HIT/MISS strike badge (C.lastStrike)"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-04: EVENT_NARRATION (src/browser/eventNarration.js) data-driven event->copy table + formatEventsCoverage guard"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "src/browser/viewModels.js#oracleLogViewModel's ROLL_SPAN_RE pattern (Oracle tab's own separate dice-reveal gating, unmodified by this pass)"
provides:
  - "stripRollDetail(lines) in mazeworld.html's engineMove(): the over-map feature-landing overlay (state.beats) now shows narration prose only, never the <span class=\"roll\">...</span> dice-mechanics detail; the Oracle log (unmodified for-loop over the same formatEvents() html array) still shows the full dice-transparent line"
  - "\"Encounter dot\" -> \"Encounter\" (MARKS_LEGEND row name + FEATURE_EVENT_TITLE's encounterRolled label)"
  - "Removed the leftover dev/diagnostic Oracle line (\"Movement is now walking through the engine.\")"
  - "teleported narration rewritten to \"You teleport to an unknown location on this floor...\" + a deadpan family-friendly tail"
  - ".mw-badge-hit/.mw-badge-miss get a CSS keyframe pop-in animation (auto-replays every Strike press because #enc-body is destroyed/recreated by renderEncounter() every call); #enc-round (a persistent element) gets a remove+reflow+re-add pulse restart"
  - "Voice cleanup of EVENT_NARRATION's 8 feature-landing buckets (trap, chest/box, one-way door, climb/wall, gorge/crevice, descent, encounter/dot) and the classic combat script's player/foe hit, miss, kill, and encounter-cleared lines, matching design/Mazeworld Mobile.dc.html's deadpan family-friendly tone"
affects: [05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "The encounter overlay and the Oracle log both render from the SAME formatEvents(events) html array (engineMove's dispatch() call) but now diverge at the point of use: state.beats.groups[0].lines gets stripRollDetail(html) applied, while the unchanged `for (const line of html) window.logLine(line);` still gets the full array — one array, two presentations, no engine/adapter change needed."
    - "Every EVENT_NARRATION entry touched in this pass keeps its dice-mechanics clause (any text that should vanish from the overlay) entirely INSIDE its own <span class=\"roll\">...</span>, trailing punctuation included, so stripRollDetail's regex removal always leaves a clean, grammatically complete sentence behind rather than a dangling fragment (e.g. a stray \" vs 5.\" or \" .\"). This is a stronger convention than the pre-existing codebase pattern (which sometimes spans only the bare number, leaving \"vs N\" as plain text outside the span) — deliberately tightened here because Group 1's stripping now depends on it."
    - "stripRollDetail() operates at GROUP granularity, not per-line: if removing dice content from every line in a beats group would leave the group completely empty, it falls back to showing the untouched original lines rather than an empty overlay. In real gameplay this only matters for a line whose ENTIRE content is dice-only (e.g. chestLockRolled) appearing in isolation — which encounters.js never actually does (chestLockRolled always co-occurs with chestOpened or chestLocked, which carry real prose) — verified interactively via node, not just by inspection."
    - "renderEncounter()'s combat branch already fully rebuilds #enc-body via body.innerHTML = \"\" on every call (pre-existing, unchanged) — so the HIT/MISS badge is a genuinely NEW DOM node every Strike press, and a plain CSS entrance animation on it auto-replays with zero JS reflow trick needed. The JS remove+reflow+re-add restart pattern is reserved for #enc-round, the one element in that render path that DOES persist across calls (only its textContent is reset)."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR5B2-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/eventNarration.js

key-decisions:
  - "Only the specific string \"Encounter dot\" -> \"Encounter\" rename mandated by the plan was applied to the two REACHABLE, player-facing spots (MARKS_LEGEND, FEATURE_EVENT_TITLE). The identical string inside the classic (pre-engine-routing) move()/beginEvent()/encounterDot() functions was left untouched — per 04-DR2-SUMMARY.md, that whole code path is dead (window.move is unconditionally overwritten by engineMove()), so editing it would change zero player-visible behavior while adding unrelated diff noise to a dead function."
  - "flashMessage() (mazeworld.html) has no live call sites anywhere in the current codebase — grep confirms only its own function definition. It is dormant scaffolding from 04-06 awaiting a future wiring point, so there is no flash-toast copy to voice-clean yet; documented here rather than silently skipped so a future pass knows this was checked, not missed."
  - "content/epitaphs.js's EPITAPHS/CAUSE_TEXT banks (including EPITAPHS.abandon, added in 04-DR5B1) were inspected and NOT touched — they already match the mock's deadpan/dark-but-family-friendly voice exactly (e.g. \"The dice were perfectly fair. That was the whole problem.\"), so rewriting them here would be redundant churn, not a genuine cleanup."
  - "The deathcard's plain UI chrome (the <h3>Dead</h3> heading, the CONFIRM button label) was left as-is — the actual player-facing 'death lines' (the epitaph/deathNote body text) are the EPITAPHS/CAUSE_TEXT content banks above, which already carry the voice; re-wording generic UI chrome labels was judged out of the '8 feature buckets + hit/miss/kill/defeat' scope the plan explicitly named, to keep this pass tightly scoped and low-risk rather than drifting into a broader UI-copy pass."
  - "Did NOT touch the other ~150 EVENT_NARRATION entries (combat.js/magic.js/economy.js/items.js sections) — per the plan's explicit instruction, that full-vocabulary rewrite (plus a family-friendly safety scan) is Phase 5's VOX generator scope. This pass only reworded the 8 feature-landing buckets the plan named plus the classic combat script's hit/miss/kill/defeat lines (which are NOT engine-routed narration — combat still runs through mazeworld.html's own say() calls, not EVENT_NARRATION, so those two surfaces needed separate edits)."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1/04-DR2/04-DR3/04-DR4/04-DR5A/04-DR5B1-SUMMARY.md's own precedent.

duration: ~75min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR5B2: Device-review round 5, Pass B2 (player-facing copy/voice cleanup + combat feedback) Summary

Applied the user's live device-review "Pass B2" to the Delve, Die, Repeat Android build: the over-map encounter/feature-landing overlay now shows narration prose only (the dice-roll mechanics detail stays in the Oracle log, unchanged), "Encounter dot" is renamed to "Encounter" everywhere it's player-visible, a leftover developer/diagnostic Oracle line is gone, the teleport landing reads in-voice, the STRIKE hit/miss badge and round counter now visibly re-trigger on every attack press (so two misses in a row read as two distinct attacks instead of looking static), and the high-visibility feature-landing and combat hit/miss/kill/defeat copy has been rewritten in the game's deadpan, dark-but-family-friendly voice to match the design mock's tone. Three atomic commits, each independently rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next group landed.

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-09-08
- **Groups:** 3 (encounter panel wording + dev-message cleanup; combat fresh-attack feedback; voice cleanup of high-visibility player messages) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 2 (`mazeworld.html`, `src/browser/eventNarration.js`)

## Accomplishments

### Group 1 — Encounter panel + wording + dev-message (`c235c86`)

1. **Encounter overlay drops the dice-roll detail; Oracle keeps it.** Added `stripRollDetail(lines)` inside `engineMove()` (mazeworld.html's trailing module script), applied only to the copy handed to `state.beats.groups[0].lines` (the over-map overlay). It strips every `<span class="roll">...</span>` occurrence (and drops any resulting empty/whitespace-only line, with a group-level fallback to the untouched lines if stripping would leave the overlay completely blank). The unmodified `for (const line of html) window.logLine(line);` call right below it still receives the FULL `html` array from `formatEvents(events)` — the Oracle log's dice transparency is completely unaffected.
2. **"Encounter dot" -> "Encounter".** Renamed in `MARKS_LEGEND`'s row name and `FEATURE_EVENT_TITLE`'s `encounterRolled` label — the two places this string is actually player-visible. The identical string inside the classic script's dead `beginEvent()`/`encounterDot()` functions (unreachable — `window.move` is overwritten by `engineMove()`, per 04-DR2-SUMMARY.md) was left untouched; it renders to no one.
3. **Removed the dev/diagnostic Oracle line.** Deleted `window.logLine(\`<span class="banner">Movement is now walking through the engine.</span>\`);` from the boot sequence — this was a leftover plumbing note, never player copy.
4. **Teleport line rewritten.** `eventNarration.js`'s `teleported` now reads: *"You teleport to an unknown location on this floor… the maze does not offer refunds."*

### Group 2 — Combat fresh-attack feedback (`cb83345`)

1. **HIT/MISS badge visibly re-triggers every Strike press.** Investigation confirmed `renderEncounter()`'s combat branch already fully rebuilds `#enc-body` (`body.innerHTML = ""`) on every call, so the badge is a genuinely NEW DOM node each press — no JS remove+reflow+re-add trick was needed for it. Added a CSS `@keyframes mwStrikePop` entrance animation to `.mw-badge-hit`/`.mw-badge-miss`, which auto-plays on every fresh mount. Two consecutive MISS badges now visibly pop in twice, not once.
2. **Round counter pulse.** `#enc-round` (the round-N indicator) is the ONE element in that render path that persists across calls — only its `textContent` is reset, not the node itself — so it genuinely needed the classic remove+reflow+re-add restart pattern: `rd.classList.remove("mw-round-tick"); void rd.offsetWidth; rd.classList.add("mw-round-tick");` right after setting its text, paired with a `@keyframes mwRoundTick` highlight-flash. This gives a second, independent "a new attack just happened" cue.

### Group 3 — Voice cleanup of high-visibility player messages (`4190afa`)

1. **EVENT_NARRATION's 8 feature-landing buckets reworded** (trap: `trapAvoided`/`trapDisarmed`/`trapDoubled`/`trapSprung`/`trapPoisoned`; chest/box: `chestOpened`/`chestLockRolled`/`chestLocked`/`scrollFound`; one-way door: `oneWayBlocked`; climb/wall: `climbedOver`/`fellClimbing`; gorge/crevice: `leaptOver`/`fellInGorge`; descent: `floorChanged`; encounter/dot: `encounterRolled`) — matching the mock's deadpan, dark-but-family-friendly tone (e.g. *"You clock it a half-step early."*, *"The box gives up its secrets."*, *"Someone built this door to work exactly once, and used their turn already."*, *"Gravity remembers you exist — N wp."*, *"The dice decide — {result}."*). Every rewritten line keeps its dice-mechanics clause entirely inside its own `<span class="roll">` (trailing punctuation included), so Group 1's `stripRollDetail` always leaves a complete, clean sentence behind rather than a dangling fragment.
2. **Classic combat script's hit/miss/kill/defeat lines reworded** (`mazeworld.html`, NOT engine-routed narration — combat still runs its own `say()` calls): player Strike miss (*"Miss — the air remains unharmed."*), player Strike hit-crit tail (*"critical, doubled, and thoroughly deserved"*), foe kill (*"{name} drops, permanently unbothered by how this ends."*), encounter-cleared/victory (*"Nothing left standing. You, mostly, in one piece."*), foe miss on player (*"Swings, and finds nothing."*), foe hit on player (*"Connects for N"*). Dice detail (die/roll/need values) is untouched in all of these — this surface is the Oracle log directly, not the stripped overlay.
3. **Verified `flashMessage()` has no live call sites** — it is dormant 04-06 scaffolding awaiting a future wiring point, so there is no flash-toast copy to clean up yet.
4. **Verified `content/epitaphs.js`'s EPITAPHS/CAUSE_TEXT banks already match the target voice** (added/reworded across 04-DR5B1 and earlier) and left them untouched.

## Task Commits

1. **Group 1 — Encounter panel wording + dev-message cleanup** — `c235c86` (fix)
2. **Group 2 — Combat fresh-attack feedback (badge + round-tick animations)** — `cb83345` (feat)
3. **Group 3 — Voice cleanup of feature-landing + combat lines** — `4190afa` (feat)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — `stripRollDetail()` + its call site in `engineMove()`; `MARKS_LEGEND`/`FEATURE_EVENT_TITLE` "Encounter" rename; removed dev Oracle line; `@keyframes mwStrikePop`/`mwRoundTick` CSS + `.mw-badge-hit`/`.mw-badge-miss` animation + `#enc-round`'s remove+reflow+re-add restart in `renderEncounter()`; reworded player/foe hit, miss, kill, and encounter-cleared `say()` lines in `playerStrike()`/`killFoe()`/`afterPlayerAction()`/`foeTurn()`.
- `src/browser/eventNarration.js` — reworded `oneWayBlocked`, `climbedOver`, `leaptOver`, `fellClimbing`, `fellInGorge`, `floorChanged`, `teleported`, `trapAvoided`, `trapDisarmed`, `trapDoubled`, `trapSprung`, `trapPoisoned`, `chestOpened`, `chestLockRolled`, `chestLocked`, `scrollFound`, `encounterRolled`.

## Decisions Made

See `key-decisions` in the frontmatter above (dead-code "Encounter dot" left alone, `flashMessage()`'s dormant status documented rather than silently skipped, `content/epitaphs.js` inspected-and-untouched, deathcard UI chrome left alone as out of the named scope, and the deliberate "keep the ~150 remaining EVENT_NARRATION entries as Phase 5 VOX scope" boundary).

## Deviations from Plan

### Auto-fixed / scoped issues

None required a checkpoint or user decision. All three groups were independently verifiable (build + full test suite) and matched the plan's explicit instructions directly. Two minor tightenings applied along the way, both low-risk and documented rather than silent:

**1. [Rule 1 — bug-adjacent tightening] Roll-span convention strengthened for overlay safety**
- **Found during:** Group 3, while designing the group-3 rewrites to survive Group 1's `stripRollDetail`.
- **Issue:** the pre-existing codebase convention sometimes wraps only the bare die-roll NUMBER in `<span class="roll">`, leaving "vs N" as plain text immediately after it (e.g. the original `trapAvoided`). Stripping only the span would have left a dangling " vs 5." fragment in the overlay.
- **Fix:** every EVENT_NARRATION entry touched in this pass now keeps its ENTIRE dice-mechanics clause (including trailing punctuation) inside one `<span class="roll">`, so removal always leaves a complete sentence.
- **Files modified:** `src/browser/eventNarration.js`
- **Commit:** `4190afa`

**2. [Scope-limit, documented] `stripRollDetail` falls back at group granularity, not per-line**
- If removing dice content from EVERY line in a beats group would leave the group completely empty, the function falls back to the untouched original lines rather than showing a blank overlay. Verified via a standalone node check that this never actually triggers in real gameplay (a dice-only line like `chestLockRolled` always co-occurs with a prose line like `chestOpened`/`chestLocked` in the same group) — documented as a deliberate defensive fallback, not a gap.

## Known Stubs / Threat Flags

None. This was pure presentation-layer copy/CSS/JS wiring (narration strings, a CSS keyframe animation, and a small JS helper) reusing existing engine seams (`formatEvents()`, `state.beats`, `C.lastStrike`) — no new network endpoints, auth paths, or schema changes at a trust boundary. No `GameState.rngState` mutation from presentation code (no rng draws were added or touched).

## Verification

- `npm run build:www` — succeeds at all three commit checkpoints.
- `npm test` — **462/462 green** at every checkpoint (unchanged count — this pass reworded existing narration copy strings, added no new event types, and every test asserting these entries checks `e.type`/dynamic fields, never the literal copy text, per a targeted grep pass before editing).
- `npm run test:quick` — **373/373 green** at every checkpoint.
- `formatEventsCoverage.test.js`'s two guardrail tests (every canonical engine-emitted type still narrates a non-empty string; no dead/typo `EVENT_NARRATION` keys) both still pass — no keys were removed or renamed, only their builder bodies' copy text changed.
- No headless-DOM/visual harness exists in this project (consistent with prior `04-DR*-SUMMARY.md` notes) — the on-device "feel" of the badge/round-tick animations and the actual read of the reworded copy in context are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `function stripRollDetail(lines)`, its call site `lines: stripRollDetail(html)` inside `engineMove`, `name: "ENCOUNTER"` in `MARKS_LEGEND`, `encounterRolled: ["Encounter", "stamp"]` in `FEATURE_EVENT_TITLE`, no remaining `window.logLine(\`<span class="banner">Movement is now walking through the engine.</span>\`)`, `@keyframes mwStrikePop`, `@keyframes mwRoundTick`, `.mw-round-tick`, `rd.classList.remove("mw-round-tick")`, `void rd.offsetWidth`, `rd.classList.add("mw-round-tick")`, "the air remains unharmed", "thoroughly deserved", "permanently unbothered", "Nothing left standing.", "Swings, and finds nothing.", "Connects for".
- FOUND: `src/browser/eventNarration.js` — "You teleport to an unknown location on this floor", "The dice decide —", "half-step early", "gives up its secrets", "Gravity remembers you exist", "The air gets worse, and takes it personally.".
- FOUND commit `c235c86` (fix(04-dr5b2): encounter overlay drops dice detail, Encounter dot renamed, dev message removed).
- FOUND commit `cb83345` (feat(04-dr5b2): STRIKE badge and round counter visibly re-trigger every press).
- FOUND commit `4190afa` (feat(04-dr5b2): voice cleanup for high-visibility feature-landing and combat lines).
- FOUND: `npm test` 462/462 and `npm run test:quick` 373/373 at final state.

## Next Phase Readiness

- All three Pass B2 groups are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next (badge/round-tick animation feel, encounter-overlay readability, and the reworded copy's actual read in context are the main things to confirm on-device).
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
