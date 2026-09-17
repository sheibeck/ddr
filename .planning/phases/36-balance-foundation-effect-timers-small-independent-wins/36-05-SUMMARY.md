---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 05
subsystem: engine
tags: [joiner, dismiss, engine-action, new-event, no-rng, voice, rail, deferred-uat]

# Dependency graph
requires:
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 04)
    provides: "engine/encounters.js#resolveJoiner, content/flavor.js's JOINER_MURDER_LINES bank, and the eventNarration.js/toasts.js/rail.js/safety-scan.test.js edit sites this plan extends"
provides:
  - "engine action dismissJoiner { i? } — engine/actions.js ACTION_TYPES + validate case, engine/engine.js dispatch case, engine/encounters.js#dismissJoiner (directly after resolveJoiner)"
  - "new events joinerDismissed { name, sub } and dismissRefused { reason: noParty | inCombat | badIndex }"
  - "content/flavor.js JOINER_PARTING_LINES (5 lines)"
  - "src/browser/eventNarration.js EVENT_NARRATION.joinerDismissed / .dismissRefused"
  - "src/browser/toasts.js TOAST_FOR.joinerDismissed / .dismissRefused, FEATURE_EVENTS += dismissRefused, NARRATIVE_ACTIONS += dismissJoiner"
  - "src/browser/rail.js RAIL_FAMILY.joinerDismissed (COMPANY / dull)"
  - "test/unit/dismiss-joiner.test.js — engine, validation, purity, narration/toast/rail proofs (20 tests)"
affects: ["36-06 (mazeworld.html Company sheet, two-tap DISMISS confirm, bridge window.mzDismissJoiner)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dismissJoiner mirrors resolveJoiner's pure/no-rng shape exactly (a plain roster splice via state.party), so it adds zero draws and no serialized field — the JOIN-01 engine half of the roadmap's SC-5"
    - "refusals are events, never silent returns (FEED-02 precedent): dismissRefused { reason } gets its own EVENT_NARRATION entry and a block()-priority toast so the rail's block-fallback shows NOTHING DOING, matching campFailed/joinerRefused"
    - "dismissJoiner joins NARRATIVE_ACTIONS (mirroring resolveJoiner) so the rail's parting-line card carries the actual JOINER_PARTING_LINES sentence rather than the toast-table fallback text"

key-files:
  created:
    - test/unit/dismiss-joiner.test.js
  modified:
    - engine/encounters.js
    - engine/actions.js
    - engine/engine.js
    - content/flavor.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/unit/narrativeToasts.test.js
    - test/voice/safety-scan.test.js

key-decisions:
  - "The plan's own assumption (dismissRefused as a real third event type, not a silent no-op) was implemented exactly as surfaced — every refusal in this codebase is an event with a toast-table block() entry, so a silent return would have regressed FEED-02."
  - "The applyAction rngState-unchanged assertion needed a one-time makeRng round-trip normalization in the test fixture before capturing the 'before' snapshot: mulberry32's constructor coerces a signed seed to unsigned via `>>> 0`, so the FIRST makeRng() call on a freshly-captured newRun() cursor can change getState()'s numeric representation (bit-identical, JS-number-different) even with zero draws. This is a pre-existing engine/rng.js artifact (also why many fixture-style tests elsewhere seed `rngState: 1` directly) — not something dismissJoiner introduces or that needed an engine fix."

requirements-completed: [JOIN-01]

coverage:
  - id: D1
    description: "dismissJoiner(state, i=0, events) is a pure, no-rng engine action: removes party[i] (default 0) and pushes joinerDismissed { name, sub }; refuses inCombat FIRST (state.combat truthy), then noParty (empty/missing/non-array party, fail-open, no key injected), then badIndex — party is untouched on any refusal"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/dismiss-joiner.test.js (6 pure-behavior tests: default-index removal, i-omitted, empty-party, undefined/null/non-array party, in-combat-first ordering, bad-index)"
        status: pass
      - kind: other
        ref: "grep -c '^export function dismissJoiner(' engine/encounters.js == 1 (line 542, after resolveJoiner at line 515); grep -c 'reason: \"inCombat\"'/'reason: \"noParty\"'/'reason: \"badIndex\"'/'state.party.splice(i, 1)' each == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateAction accepts { type: 'dismissJoiner' } and { i: 0 }, rejects i: -1 / '0' / 1.5 with the exact reason string; applyAction dispatches through engine.js beside resolveJoiner, drawing zero rng and leaving the input state unmutated"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/dismiss-joiner.test.js (validateAction test + 2 applyAction tests: full dismiss, empty-party refusal)"
        status: pass
      - kind: other
        ref: "grep -c '\"dismissJoiner\",' engine/actions.js == 1; grep -c 'dismissJoiner.i must be a non-negative integer when present' engine/actions.js == 1; grep -c 'case \"dismissJoiner\":' engine/engine.js == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "EVENT_NARRATION.joinerDismissed picks one of five JOINER_PARTING_LINES deterministically (name length, no rng), html-escapes the name; EVENT_NARRATION.dismissRefused names each reason distinctly; TOAST_FOR carries both (feature/beat for the dismissal, block for every refusal reason); RAIL_FAMILY.joinerDismissed is COMPANY/dull; dismissRefused has no RAIL_FAMILY row (falls to the block fallback); NARRATIVE_ACTIONS includes dismissJoiner; both coverage guards (toastsCoverage/formatEventsCoverage) and the voice-safety scan stay green"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/dismiss-joiner.test.js (narration/toast/rail section: 8 tests); test/unit/narrativeToasts.test.js; test/voice/safety-scan.test.js; test/unit/toastsCoverage.test.js; test/unit/formatEventsCoverage.test.js; test/unit/rail.test.js"
        status: pass
      - kind: other
        ref: "node -e checks: flavor.js JOINER_PARTING_LINES 5/true; toasts.js NARRATIVE_ACTIONS == 'camp,dismissJoiner,move,resolveJoiner', FEATURE_EVENTS includes dismissRefused; rail.js RAIL_FAMILY.joinerDismissed matches exactly, no dismissRefused key"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm test prints '# fail 0'; fixtures untouched; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0; no test/parity/mazeworld.html/package.json/package-lock.json byte touched by this plan"
    requirement: JOIN-01
    verification:
      - kind: other
        ref: "npm test 2264/2264 (# fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt unchanged; git diff --stat -- test/parity mazeworld.html package.json package-lock.json empty"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 05: dismissJoiner Engine Action & Parting-Line Vocabulary Summary

**A new no-rng engine action `dismissJoiner` — registered beside `resolveJoiner` — removes a party member and pushes its own `joinerDismissed` event with a deterministic sarcastic parting line, refusing with a named `dismissRefused` reason (noParty/inCombat/badIndex) rather than failing silently, so Plan 06's Company-panel DISMISS control has a complete engine + presentation seam to dispatch into.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-17T17:08:30Z
- **Completed:** 2026-09-17T17:17:00Z
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `engine/encounters.js` gains `export function dismissJoiner(state, i = 0, events = [])` directly after `resolveJoiner`. Order of checks: `state.combat` truthy refuses `inCombat` FIRST (a fight's allies stay put; `endCombat` syncs them separately); then an empty/missing/non-array `state.party` refuses `noParty` (fail-open, no key injected); then an out-of-range `i` refuses `badIndex`; otherwise `state.party.splice(i, 1)` removes the member and `joinerDismissed { name, sub }` is pushed. Zero rng, zero new serialized field — a plain data mutation exactly like `resolveJoiner`.
- `engine/actions.js` gains `"dismissJoiner"` in `ACTION_TYPES` (directly after `"resolveJoiner"`) and a validate case: `i`, when present, must be a non-negative integer (`dismissJoiner.i must be a non-negative integer when present`), matching the `buyItem.idx`/`useItem.i` contract.
- `engine/engine.js` extends its `encounters.js` import to include `dismissJoiner` and adds `case "dismissJoiner": dismissJoiner(next, action.i ?? 0, events); break;` beside `resolveJoiner`.
- `content/flavor.js` gains `JOINER_PARTING_LINES` (5 lines, `{name}` token) — the Joiner gets the last word, family-friendly sarcasm.
- `src/browser/eventNarration.js` gains `EVENT_NARRATION.joinerDismissed` (deterministic pick from name length, html-escaped, mirroring `joinerLeft`/`joinerMurdered`) and `.dismissRefused` (three named-reason sentences plus a `badIndex`/unknown fallback).
- `src/browser/toasts.js`: `NARRATIVE_ACTIONS` extended to `["move", "camp", "resolveJoiner", "dismissJoiner"]`; `TOAST_FOR.joinerDismissed` (fallback/coverage text, priority feature, tone beat — replaced by the Oracle line on the `dismissJoiner` action via the narrative ctx); `TOAST_FOR.dismissRefused` (block, priority 0, per-reason text); `"dismissRefused"` added to `FEATURE_EVENTS`'s Refusals group.
- `src/browser/rail.js` gains `RAIL_FAMILY.joinerDismissed: { icon: "◇", title: "COMPANY", tone: "dull" }`; no `dismissRefused` row — its `PRIORITY.block` priority falls through `railFamilyFor`'s own block fallback to `NOTHING DOING` / dull, per the v1.4 "a refusal never looks like an outcome" invariant.
- `test/unit/narrativeToasts.test.js`'s `NARRATIVE_ACTIONS` exact-set pin extended to `["camp", "dismissJoiner", "move", "resolveJoiner"]`.
- `test/voice/safety-scan.test.js` imports and scans `JOINER_PARTING_LINES` (both the completeness/load-bearing meta-tests and the family-friendly corpus scan), and adds the three `dismissRefused` reason branches to `BRANCH_TOGGLES` so `EVENT_NARRATION.dismissRefused`'s named-reason branches are all exercised.
- `test/unit/dismiss-joiner.test.js` (new, 20 tests): pure `dismissJoiner` semantics (default index, i-omitted, empty/fail-open party, in-combat-first ordering, bad index), `validateAction`/`applyAction` boundary proofs (rngState-unchanged, input-untouched, JSON round-trip, empty-party refusal), `EVENT_NARRATION`/`TOAST_FOR`/`FEATURE_EVENTS`/`NARRATIVE_ACTIONS` proofs, `RAIL_FAMILY`/`railCardFor` proofs for both a dismissal and a refusal, and a `JOINER_PARTING_LINES` data-shape sanity check.
- Full gate: `npm test` 2264/2264 (`# fail 0`); `test/parity/fixtures` untouched; `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); no `test/parity`/`mazeworld.html`/`package.json`/`package-lock.json` byte touched by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: The dismissJoiner engine action — handler, ACTION_TYPES/validation, dispatch case, plus the parting/refusal narration, toast, rail and flavor entries in the same commit (coverage guards)** — `e5dcff8` (feat) — `feat(36-05): dismissJoiner engine action, dismissRefused/joinerDismissed events, narration/toast/rail entries (JOIN-01)`
   - `engine/encounters.js`, `engine/actions.js`, `engine/engine.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/unit/narrativeToasts.test.js`, `test/voice/safety-scan.test.js`, `test/unit/dismiss-joiner.test.js` (new)
2. **Task 2: Gate + SUMMARY (rng/serialized-field statements, the surfaced assumption, deferred on-device checks)** — this commit (docs) — no source files changed, gate re-verified green.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: `test/unit/dismiss-joiner.test.js` was written first (RED — failed on the missing `JOINER_PARTING_LINES` export, since none of the plan's engine/content/presentation edits existed yet) and run to confirm failure before any implementation file was touched. All 20 tests then ran GREEN in a single pass once the full set of engine/content/presentation edits landed together (they are mutually load-bearing — the coverage guards and the exact-set pins require every file to change in the same commit)._

## Files Created/Modified

- `engine/encounters.js` - `dismissJoiner(state, i, events)` (new export, directly after `resolveJoiner`)
- `engine/actions.js` - `"dismissJoiner"` ACTION_TYPES entry + validate case
- `engine/engine.js` - import extended; dispatch case beside `resolveJoiner`
- `content/flavor.js` - `JOINER_PARTING_LINES` (new, 5 lines)
- `src/browser/eventNarration.js` - `EVENT_NARRATION.joinerDismissed` (new); `.dismissRefused` (new)
- `src/browser/toasts.js` - `NARRATIVE_ACTIONS` extended; `TOAST_FOR.joinerDismissed`/`.dismissRefused` (new); `FEATURE_EVENTS` += `"dismissRefused"`
- `src/browser/rail.js` - `RAIL_FAMILY.joinerDismissed` (new)
- `test/unit/narrativeToasts.test.js` - `NARRATIVE_ACTIONS` exact-set pin extended to four
- `test/voice/safety-scan.test.js` - `JOINER_PARTING_LINES` import + push loop (new); three `dismissRefused` reason branches added to `BRANCH_TOGGLES`
- `test/unit/dismiss-joiner.test.js` - new file, 20 tests

## Decisions Made

- **The `dismissRefused` third event type was implemented exactly as the plan's own surfaced assumption specified:** a silent no-return refusal would have regressed FEED-02 ("nothing happens silently"), so every refusal path (`noParty`/`inCombat`/`badIndex`) is a real event with its own `EVENT_NARRATION` line and a `block()`-priority toast-table entry.
- **`dismissJoiner` joins `NARRATIVE_ACTIONS`**, mirroring `resolveJoiner`'s existing membership — this is what makes the rail's `joinerDismissed` card carry the actual `JOINER_PARTING_LINES` sentence (via the shell's `ctx.narrate` hook) instead of the toast table's terser fallback text, matching the CONTEXT's "the Joiner gets the last word" framing.
- **Test-fixture rngState normalization:** the `applyAction` zero-draw proof needed one `makeRng(state.rngState).getState()` round-trip applied to a freshly-captured `newRun()` cursor before snapshotting "before" state — `mulberry32`'s constructor coerces a signed seed to its unsigned bit-pattern via `>>> 0`, so the very first `makeRng()` call on a fresh cursor can change `getState()`'s numeric representation (same bits, different JS number) even with zero draws. This is a pre-existing `engine/rng.js` artifact (the same reason many other test fixtures in this codebase seed `rngState: 1` directly rather than reading it off a live `newRun()`), not a dismissJoiner defect — no engine change was made or needed.

## Deviations from Plan

None. Every locked API surface (the `dismissJoiner` signature and check order, the exact five `JOINER_PARTING_LINES`, the narration/toast/rail entries, the `NARRATIVE_ACTIONS`/`FEATURE_EVENTS` extensions, the validate-case reason string) matches the plan verbatim.

## Issues Encountered

One test-authoring wrinkle (not a source-code issue): the first draft of the `applyAction` zero-draw proof compared `next.rngState` against a `before` snapshot taken directly off a fresh `newRun()`'s cursor, which fails due to the signed/unsigned `mulberry32` constructor artifact described above (2 test failures, both in the new test file only — no other suite affected). Fixed by normalizing the cursor through one `makeRng(...).getState()` round-trip before capturing `before`, matching the pattern other pure-action tests in this codebase already use (`test/unit/parley.test.js`'s `next.rngState = rng.getState()` before its own zero-draw dispatch). No auto-fix budget was needed elsewhere; every other assertion passed on the first full run after the implementation landed.

## Assumptions surfaced

- **`dismissRefused { reason }` as a genuine third event type** (not a silent no-op): named-reason refusals are events in this codebase (FEED-02, Phase 25) — a silent return on `noParty`/`inCombat`/`badIndex` would have broken that standing contract. This was explicitly called out in the plan's own objective text as "not in CONTEXT verbatim" and implemented per that surfaced assumption.
- **The `NARRATIVE_ACTIONS` extension and its pin update:** adding `dismissJoiner` to `NARRATIVE_ACTIONS` (mirroring `resolveJoiner`, whose `joinerLeft` snark reaches the rail the same way) required updating the exact-set pin in `test/unit/narrativeToasts.test.js` from three to four entries — done in the same commit as the source change so the suite never sat red between them.

## rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** adds zero draws. `dismissJoiner` is a pure data mutation (a plain `state.party.splice(i, 1)`, identical in kind to `resolveJoiner`/`swapPartyMember`) with no `rng` parameter at all. `applyAction` still persists `next.rngState = rng.getState()` unconditionally after every dispatch (existing engine.js behavior, unchanged by this plan) — since `dismissJoiner` never calls `rng.d()`/`.next()`, that persisted value is bit-identical to what `makeRng(state.rngState).getState()` already yields before the dispatch (proven by `test/unit/dismiss-joiner.test.js`'s applyAction tests, once the fixture's own cursor is normalized through the same round-trip first — see Decisions Made above).
- **serialized_field_impact:** none. `dismissJoiner` splices `state.party` — an existing top-level field, already carved out of every parity comparable since Phase 7/25.1. No new field is added anywhere; `joinerDismissed`/`dismissRefused` are events, not state.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol, no device pause was taken. This plan is engine-side only (no `mazeworld.html` edit — the Company sheet, two-tap DISMISS confirm, and the `window.mzDismissJoiner` bridge are Plan 06). The following checks only make sense once Plan 06 wires the button, and are queued for the aggregated end-of-run Pixel 7 batch:

1. After a DISMISS confirm on the Hero tab's Company panel, the rail shows a COMPANY card in the dull tone carrying one of the five `JOINER_PARTING_LINES` sentences, and the Oracle log carries the same line (never a toast, never inline text — the v1.4 rail-is-the-one-feedback-surface ruling).
2. The Company panel is empty afterwards, and the next Joiner met can be accepted without a swap line (since `PARTY_CAP` is 1 and the roster is now genuinely empty, not just displaying zero members).
3. No toast or inline text appears anywhere for the parting line — only the rail card and the Oracle log.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06 of Phase 36 (`mazeworld.html` Company sheet + `SUB_NOTE` sync) builds directly on this plan's `dismissJoiner` action and its complete `joinerDismissed`/`dismissRefused` vocabulary — the shell only needs a `window.mzDismissJoiner(i)` bridge dispatching through the existing `dispatchWithToasts` seam (the same one `mzResolveJoiner` already uses) plus the two-tap inline confirm UI (the Phase 33 `mw-drop-confirm` precedent).
- `engine/encounters.js#dismissJoiner`, `engine/actions.js`'s validation, `engine/engine.js`'s dispatch case, and the full narration/toast/rail vocabulary are complete and reusable as-is; no further engine work is needed for JOIN-01.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (`engine/encounters.js`, `engine/actions.js`, `engine/engine.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/unit/narrativeToasts.test.js`, `test/voice/safety-scan.test.js`, `test/unit/dismiss-joiner.test.js`, this SUMMARY.md); task commit hash (`e5dcff8`) found in `git log --oneline --all`.
