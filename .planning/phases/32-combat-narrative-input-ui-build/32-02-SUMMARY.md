---
phase: 32-combat-narrative-input-ui-build
plan: 02
subsystem: ui
tags: [vanilla-js, combat-narrative, toasts, aria-live, tdd-style-source-assertions]

requires:
  - phase: 32-combat-narrative-input-ui-build
    plan: "01"
    provides: "src/browser/inputGuards.js + window.__mzInputGuards (no button wired yet)"
  - phase: 31-combat-start-gating-effect-hygiene
    provides: "C.pending Fight! gate, dispatchWithToasts -> noteCombat wiring, CONDITION_COPY.afraid/ward"
provides:
  - "toastsForAction(type, events, ctx, opts) — optional opts.limit (default MAX_TOASTS) on the pipeline tail only; groupers/dedupe/priority-sort untouched"
  - "dispatchWithToasts routing seam: while the POST-dispatch state has a combat, every folded non-refusal toast becomes a window.__mzRoundCard line (uncapped, { limit: Infinity }); refusals and everything out of combat stay on the MAX_TOASTS-capped toast host, as a single if/else"
  - "renderEncounter Round Card region: a <section class=\"round-card\"> built between the foe roster and the Fight!/action bar, textContent-only lines, a preview header pre-Fight! and a \"Round N\" header per fought round, persisting across sub-menu re-renders and refusal taps"
  - "Persistent sr-only #enc-round-live aria-live=\"polite\" announcer (sibling of #enc-body, never rebuilt) via syncRoundCardLive(), seq-gated so a Spells/Items re-render never re-announces the same card"
  - ".round-card CSS: max-height:40%/overflow-y:auto/touch-action:manipulation, no animation — the action bar's coordinates never move between rounds"
  - "S.lastExchange/S.exchangeN fully removed (classic act()/startCombat/endCombat sites + the renderEncounter block that read them); superseded by window.__mzRoundCard, which is presentation-only and never serialized"
  - "test/unit/shell-round-card.test.js — region/announcer/CSS source pins + a behavioural routing-exclusivity proof over every TOAST_FOR type + the uncapped-card/MAX_TOASTS-capped-host contract + voice safety of the new copy"
affects: ["32-03"]

tech-stack:
  added: []
  patterns:
    - "Routing exclusivity as a single if/else inside the ONE pipeline function (dispatchWithToasts), never a wrapper around window.mzToast — makes 'never both toasted and carded' structural, not just conventional"
    - "Presentation-only transient state lives on window (window.__mzRoundCard), matching the existing window.__mzLootReport precedent — never on S, since serializeRun spreads S wholesale"
    - "A persistent sr-only aria-live sibling of an innerHTML-churned region, updated by textContent only on a monotonic seq change, survives the region's own full rebuild without re-announcing on unrelated re-renders"

key-files:
  created:
    - test/unit/shell-round-card.test.js
  modified:
    - mazeworld.html
    - src/browser/toasts.js
    - test/unit/shell-toast-wiring.test.js

key-decisions:
  - "Routed on the POST-dispatch state.combat, not the pre-dispatch wasCombat that 32-RESEARCH.md's Assumption A2 flagged as the safer default — the plan itself calls this out explicitly (Task 1, step 2c) as a deliberate correction: the action that ENDS combat (a kill, a flee, a death) must still toast its own lines, since a successful flee hides the panel, a kill swaps to the loot card, and a death shows the death card, where a card-routed line would be invisible. The encounter-starting move, conversely, has a post-dispatch combat, so its encounterStarted fold correctly lands on the preview card per design §6.4. Implemented exactly as the plan specified; no independent deviation."
  - "ROUND_CARD_COPY: { preview: \"The stare-down\", round: (n) => `Round ${n} · how that went` } — family-friendly sarcasm, passes the voice safety scan (test/unit/shell-round-card.test.js and test/voice/safety-scan.test.js both green)."
  - "The old .exchange block's read site (renderEncounter, after the spell menu) was deleted in Task 1 rather than deferred to Task 2, because Task 1's own acceptance criteria requires zero lastExchange/exchangeN occurrences in source before Task 1's commit lands. The plan explicitly permitted either task to own this deletion (\"do it here if you prefer\") — no scope or behavior deviation, just an earlier-than-minimum timing of a step the plan already assigned discretion over."

patterns-established:
  - "Card-vs-toast routing lives entirely inside dispatchWithToasts's own loop; any future third destination (if ever needed) should extend that same if/else chain rather than adding a second routing site."

requirements-completed: [CMBUI-02, CMBUI-03]

coverage:
  - id: D1
    description: "toastsForAction gains an optional opts.limit (default MAX_TOASTS) on its pipeline tail only — groupers, dedupeByType, priority sort, and the default (no-opts) call output are byte-for-byte unchanged"
    requirement: "CMBUI-02"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js (94 tests, unchanged on disk, all green)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#toasts.js carries the opts/limit option this plan adds"
        status: pass
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js#Phase 32: toasts.js carries the limit option once, and the old literal MAX_TOASTS slice is gone"
        status: pass
    human_judgment: false
  - id: D2
    description: "dispatchWithToasts routes every in-combat, non-refusal folded toast to window.__mzRoundCard (uncapped via { limit: Infinity }); refusals and everything out of combat stay on the existing MAX_TOASTS-capped toast host, via a single if/else so no event is ever both toasted and carded"
    requirement: "CMBUI-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#SOURCE: dispatchWithToasts contains exactly one routing if/else and exactly one window.mzToast call"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#BEHAVIOUR: every TOAST_FOR type routes to exactly one of card/toast when in combat, and the two sets partition the manifest"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#UNCAPPED card, capped host (CONTEXT Area 1 #5): six folded toasts all reach the card, but only MAX_TOASTS reach the queue"
        status: pass
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js#Phase 32: dispatchWithToasts routes card-vs-toast via a single if/else, uncapped card + MAX_TOASTS-capped queue"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Round Card renders in renderEncounter between the foe roster and the Fight!/action bar: a preview header before Fight!, a \"Round N\" header per fought round, every line via textContent (never innerHTML), no line cap (the old slice(-6) contract is gone), persisting across sub-menu re-renders and refusal taps and clearing at endCombat"
    requirement: "CMBUI-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#renderEncounter round-card region: reads window.__mzRoundCard and builds the card between the foe roster and the Fight! gate"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#renderEncounter round-card region: every line is textContent, never innerHTML"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#the last-exchange machinery is fully gone: zero lastExchange/exchangeN/S.roundCard/state.roundCard in source"
        status: pass
    human_judgment: false
  - id: D4
    description: "A persistent sr-only #enc-round-live aria-live=\"polite\" aria-atomic=\"true\" announcer, sibling of #enc-body, updated by textContent only on a card seq change — a Spells/Items sub-menu re-render of the SAME card never re-announces"
    requirement: "CMBUI-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-round-card.test.js##enc-round-live is a persistent sr-only aria-live=\"polite\" aria-atomic=\"true\" sibling of #enc-body inside #enc-panel"
        status: pass
      - kind: unit
        ref: "test/unit/shell-round-card.test.js#syncRoundCardLive never assigns innerHTML on the announcer and gates announcement on rc.seq"
        status: pass
    human_judgment: true
    rationale: "Whether the WebView on the actual Android target (not just Node's DOM-free source assertions) reliably re-announces this region through TalkBack cannot be proven by a source-level test — it needs a real screen reader on-device. Flagged in Human verification below; deferred to end-of-run UAT per this run's rule."
  - id: D5
    description: "No new dismiss gate: the Round Card has no tap-to-dismiss gesture, and no existing 1-tap decision surface (loot, joiner, find, death, Move on) gained one"
    requirement: "CMBUI-03"
    verification: []
    human_judgment: true
    rationale: "This is an absence claim (no handler was added) — confirmed by code review during implementation (the card region assigns no .onclick/.addEventListener anywhere) but not pinned by a dedicated negative-assertion test in this plan; safest to route through human UAT rather than claim automated proof that doesn't exist yet."

duration: 12min
completed: 2026-09-16
status: complete
---

# Phase 32 Plan 02: Combat Narrative & Input UI Build — Round Card Summary

**Round Card: dispatchWithToasts now routes every in-combat, non-refusal folded toast (uncapped, via a new `toastsForAction` `limit` option) to a persistent `renderEncounter` block between the foe roster and the action bar, replacing the old `S.lastExchange` footnote and its per-event toast stack.**

## Performance

- **Duration:** ~12 min (commit-to-commit)
- **Started:** 2026-09-16T12:57:41-04:00 (first commit)
- **Completed:** 2026-09-16T13:04:47-04:00 (last commit)
- **Tasks:** 3
- **Files modified:** 3 (1 created new test file, 2 modified — mazeworld.html, src/browser/toasts.js — plus 1 re-pinned test file)

## Accomplishments
- `src/browser/toasts.js`: `toastsForAction(type, events, ctx = {}, opts = {})` now accepts an optional `limit` (default `MAX_TOASTS`) that only changes the pipeline's final slice — every grouper, `dedupeByType`, and the priority sort are byte-identical to before this option existed; the default (no-opts) call output is unchanged.
- `dispatchWithToasts` (mazeworld.html) is retargeted: it samples `roundBefore` (the round the player is ACTING in, from the pre-dispatch state), dispatches, then reads `inCombat` from the POST-dispatch `result.state.combat`. It requests the toast pipeline UNCAPPED (`{ limit: Infinity }`) and partitions the result with a single `if (inCombat && t.priority !== PRIORITY.block)`: non-refusal in-combat lines go to `window.__mzRoundCard`, everything else (refusals, and everything out of combat) goes to the existing `window.mzToast` host, still capped at `MAX_TOASTS`. This is the one and only routing seam — an event can never be both toasted and carded.
- `renderEncounter` builds the Round Card as a `<section class="round-card">` immediately after the foe roster and before the `C.pending` Fight! gate: a preview header ("The stare-down") before Fight!, a `Round N · how that went` header per fought round, and one `<p>` per folded line, all via `textContent` (never `innerHTML`) — closing a real (if low-severity) tampering surface the old `.exchange` block's `innerHTML` template didn't have to worry about, since toast text is always plain prose.
- A persistent `#enc-round-live` sr-only `aria-live="polite" aria-atomic="true"` node, sibling of `#enc-body`, is updated by `syncRoundCardLive()` only when the card's `seq` changes — a Spells/Items sub-menu re-render of the same card never re-announces.
- `.round-card` CSS: `max-height:40%` + `overflow-y:auto` + `touch-action:manipulation`, no animation — a busy round scrolls inside the card instead of pushing the action bar's coordinates around between rounds. The old `.exchange`/`exflash` CSS and keyframes are gone.
- `S.lastExchange`/`S.exchangeN` are removed entirely (the classic `act()`/`startCombat()`/`endCombat()` sites and the `renderEncounter` read block) — `window.__mzRoundCard` supersedes them in the same visual slot, presentation-only, never serialized (never an `S` field; `serializeRun` spreads `S` wholesale).
- `test/unit/shell-round-card.test.js` (new, 13 tests): region/announcer/CSS source pins, a routing-exclusivity proof that runs the REAL `toastsForAction` pipeline over every `TOAST_FOR` type (card-set/toast-set partition, every `REFUSAL_TYPES` entry stays a toast, a synthetic six-toast round proves the card is genuinely uncapped while the host stays capped at `MAX_TOASTS`), and a voice-safety scan of the new header copy against `content/safety-wordlist.js`.
- `test/unit/shell-toast-wiring.test.js` re-pinned with 5 new Phase 32 tests (import line, the routing region's structural shape, the toasts.js limit-option pin, the full-health block toasts still exactly 2, `window.mzToast` still defined exactly once).
- Full suite: `npm test` → **1882/1882 pass, 0 fail** (baseline 1864 + 5 new shell-toast-wiring tests + 13 new shell-round-card tests). `npm run build:www` exit 0. `git diff --stat 9174e6e..HEAD -- engine content test/parity` empty — zero engine/content/parity files touched across the whole plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: toastsForAction limit option; route in-combat toasts uncapped to the round card; delete S.lastExchange/S.exchangeN; re-pin shell-toast-wiring** - `a49fa52` (feat)
2. **Task 2: render the Round Card in renderEncounter, its CSS, the persistent aria-live announcer, and the header copy** - `8760bf4` (feat)
3. **Task 3: pin the Round Card region, routing exclusivity and copy voice safety in shell-round-card.test.js** - `add440d` (test)

**Plan metadata:** commit pending (final `docs(32-02)` metadata commit, made after this SUMMARY)

## Files Created/Modified
- `src/browser/toasts.js` — `toastsForAction` gains an optional `opts.limit` (default `MAX_TOASTS`) on the pipeline tail only
- `mazeworld.html` — the third toasts.js import (`PRIORITY, MAX_TOASTS, narrativeToastText`); `dispatchWithToasts`'s routing rewrite + `window.__mzRoundCard`; `ROUND_CARD_COPY`; `.round-card` CSS (replacing `.exchange`/`exflash`); the static `#enc-round-live` region; the `renderEncounter` round-card build region; `syncRoundCardLive()`; the `S.lastExchange`/`S.exchangeN` deletions across `act()`/`startCombat()`/`endCombat()`/`renderEncounter`
- `test/unit/shell-toast-wiring.test.js` — 5 new Phase 32 routing re-pins, header comment updated
- `test/unit/shell-round-card.test.js` — new: 13 tests covering the region, the announcer, the CSS, routing exclusivity (structural + behavioural), and voice safety

## Decisions Made
See `key-decisions` in the frontmatter above — routing on post-dispatch `state.combat` (a deliberate, plan-specified correction to RESEARCH's own flagged assumption), the exact header copy, and the earlier-than-strictly-required timing of the old `.exchange` read-site deletion (both within the plan's own discretion, not independent deviations).

## Deviations from Plan

None — plan executed exactly as written. The one place the plan itself calls out a departure from `32-RESEARCH.md`'s Assumption A2 (routing on post-dispatch `state.combat` rather than pre-dispatch `wasCombat`) was a plan-authored decision with its own inline rationale (Task 1, step 2c), not something discovered or altered during execution.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's rule, on-device verification is batched at the end of the autonomous run, not per-plan. Pixel 7 checklist for this plan's surface (CMBUI-02/03):

1. Walk into an encounter — the panel shows head → foe roster → the "The stare-down" card holding the encounter line → Fight!, and NO narrative toast appears at the top of the screen.
2. Tap Fight! — the card becomes "Round 1 · how that went" with the initiative line (and any pre-emptive strike / "Afraid" line), still no toast.
3. Tap Strike — the card is replaced by that round's lines, the topbar counter reads the next round, the action bar has not moved.
4. Open Spells / tap a cooling Use item / tap Potion at full health — the card persists and the refusal ("Already at full health." / the engine's reason) arrives as a toast.
5. A long round (several foes) scrolls inside the card rather than pushing the action bar.
6. Kill the last foe — the loot card appears and the kill line is a toast over it; flee — the panel hides and the flee line is a toast.
7. TalkBack on: a new round is announced once, opening Spells does not re-announce (this is D4's `human_judgment: true` item above — the WebView's actual live-region behavior cannot be proven by a source-level test).

Never instruct a pause for device checks; this list is for the end-of-run UAT batch.

## Next Phase Readiness
- The Round Card DOM, its routing seam, and `window.__mzRoundCard` are fully live and tested; 32-03 (guard wiring on the ~10 named decision buttons, including the round-card action bar, plus `window.move`'s `DISMISS_SETTLE_MS` clause) can build directly on top of this render without further changes to the routing or the card region itself.
- `window.__mzInputGuards` (from 32-01) is still unconsumed by any button — 32-03 owns wiring `isArmed`/`isSettled` onto the button list design §6.3 enumerates, including the round-card action bar this plan renders.
- No blockers.

## Self-Check

- `test -f test/unit/shell-round-card.test.js` → FOUND
- `test -f mazeworld.html` → FOUND
- `test -f src/browser/toasts.js` → FOUND
- Commit `a49fa52` (feat, Task 1) → FOUND in `git log --oneline --all`
- Commit `8760bf4` (feat, Task 2) → FOUND in `git log --oneline --all`
- Commit `add440d` (test, Task 3) → FOUND in `git log --oneline --all`
- `npm test` → 1882 pass, 0 fail
- `npm run build:www` → exit 0
- `git diff --stat 9174e6e..HEAD -- engine content test/parity` → empty (no engine/content/parity file touched across this plan)
- `git status --porcelain test/unit/narrativeToasts.test.js test/unit/oracleLogViewModel.test.js test/unit/shell-oracle-panel.test.js test/unit/feedback-payload.test.js test/unit/toastsForAction.test.js test/unit/toastTable.test.js test/unit/toastsCoverage.test.js` → empty (all seven §6.8 "unchanged" files genuinely untouched on disk)

## Self-Check: PASSED

---
*Phase: 32-combat-narrative-input-ui-build*
*Completed: 2026-09-16*
