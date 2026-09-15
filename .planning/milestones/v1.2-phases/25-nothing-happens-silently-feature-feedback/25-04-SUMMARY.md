---
phase: 25-nothing-happens-silently-feature-feedback
plan: 04
subsystem: ui
tags: [toasts, wiring, css, tones, presentation, feature-feedback, feed-01, feed-02, feed-03, feed-04, feed-05, feed-06]

# Dependency graph
requires:
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 02
    provides: "TOAST_FOR (189 builders), TONES, MAX_TOASTS=4, ORACLE_ONLY, decorateMisses wired into engineAdapter.dispatch"
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 03
    provides: "toastsForAction(type, events, ctx) — the per-action aggregation/priority/cap pipeline, contract [{text, tone, priority}]"
provides:
  - "mazeworld.html: seven explicit toast-tone colors (--moss-soft/--stamp-soft/--amber root tokens; miss recolored, dodge/block/beat added), host cap raised to 4"
  - "mazeworld.html: dispatchWithToasts(action) — the single post-dispatch seam every action (move/abandon/buyItem/leaveStore/resolveJoiner/inventoryAction/engineCombatAction/camp) now flows through"
  - "test/unit/shell-toast-wiring.test.js — 14 source-assertion + behavioural tests locking the CSS tones, host cap, single seam, dead-name removal, and a real equipRejected-to-toast proof"
  - "Device checklist (non-blocking, Pixel 7) in this SUMMARY for the orchestrator's phone-push offer"
affects: [25-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single post-dispatch seam: dispatchWithToasts(action) wraps dispatch(action) and raises toastsForAction(action.type, result.events, {}) through window.mzToast for every returned toast, then returns the result unchanged — every render-tail caller (state set, logLine, paint, renderEncounter, noteCombat, hapticForEvents, beats synthesis) is byte-identical to before, only the dispatch() call itself is swapped"
    - "line-comments-before-block-comments source-scan ordering: a naive `/\\*...*\\/` stripper run before `//` stripping treats any `/*` substring INSIDE a `//` doc comment (e.g. `@capacitor/*`, `icons/optimized/*.png`) as an unterminated block-comment opener and silently swallows real code up to the next unrelated `*/`; stripping `//` lines first removes those substrings before the block pass ever sees them (documented in both the fix commit and the new test file)"

key-files:
  created:
    - test/unit/shell-toast-wiring.test.js
  modified:
    - mazeworld.html

key-decisions:
  - "Hoisted `import { toastsForAction } from \"./src/browser/toasts.js\";` to the very first line of the module script (before the storage.js/engineAdapter.js import block) rather than beside the engineAdapter import as the plan's read_first anchor suggested — that natural position sits inside a pre-existing false block-comment span caused by a `@capacitor/*` mention two lines above it, which a naive comment-stripping source-scan (used by this plan's own Task 2 <verify> one-liner and the new wiring test) reads as an unterminated `/*` opener and swallows, deleting the import from the scanned text. Hoisting is a zero-behavior-change relocation (ES module imports are hoisted regardless of position) that keeps the plan's literal verify command passing without editing unrelated historical doc comments."
  - "Split what the plan called \"Task 1\" and \"Task 2\" into two commits along the diff's natural hunk boundaries rather than the exact task-numbered split — the CSS-tone/root-token hunk was clean and isolated (staged and committed alone via `git add -p`), but the host-cap-to-4 change and the old switch/spell-name-helper deletion landed in the SAME edit call (both are inside `window.mzToast`'s immediate neighborhood) and could not be cleanly separated without temporarily reintroducing dead code; the cap bump was folded into the Task 2 commit alongside the deletions instead. All of both tasks' acceptance criteria are satisfied; only the commit-message-to-task-number mapping shifted slightly."

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06]

coverage:
  - id: D1
    description: "All seven toast tones (hit, miss, hurt, dodge, magic, block, beat) resolve to explicit CSS colors; hit/miss/hurt/dodge are four distinct values (YOU green family vs THEM red family); magic/block/beat are distinct from each other and from the four combat tones; miss no longer references --ink-soft"
    requirement: "FEED-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js — 'every TONES entry has a .mw-toast[data-tone=...] rule...', 'FEED-03: hit/miss/hurt/dodge resolve to four distinct colors...', 'FEED-03: magic/block/beat are distinct...', 'miss is no longer the ink-soft grey'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The toast host trims to a cap of 4 (not 3); the fixed-position/pointer-events:none/no-CLS contract and the prefers-reduced-motion rule are unchanged"
    requirement: "FEED-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js — 'the toast host trims to a cap of 4, not 3', 'the toast host keeps its fixed, non-layout contract', 'the reduced-motion rule survives byte-identical'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every action's dispatch() call (move, abandon, buyItem, leaveStore, resolveJoiner, inventory take/leave/drop/equip/unequip/sell, useItem, attack/flee/parley/sing/castSpell/drinkPotion/readScroll, camp) routes through ONE dispatchWithToasts(action) seam; exactly one bare dispatch( call survives (inside the helper itself)"
    requirement: "FEED-01, FEED-02, FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js — 'the module script imports toastsForAction...', 'dispatchWithToasts(action) is defined exactly once...', 'every dispatch() call site is routed through dispatchWithToasts...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The old per-action switch (window.mzCombatFeedback) and its spell-name helper are deleted with zero occurrences remaining; window.mzSpellCharges (a different, still-live helper) survives; the DR18 hand-written equip-rejection toast literal is deleted; the two pre-dispatch 'already at full health' guards use tone block, not miss"
    requirement: "FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js — 'the old per-action switch and its spell-name helper are gone', 'the DR18 hand-written equip-rejection toast is deleted', 'the two pre-dispatch full-health guards use the block tone, not miss'"
        status: pass
    human_judgment: false
  - id: D5
    description: "An equipRejected(reason: woodsman) event run through the real toastsForAction yields exactly one block-toned toast naming the reason — proving the deleted hand-written DR18 toast is replaced by the table, not lost"
    requirement: "FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js#'an equipRejected(reason: woodsman) event yields one block toast via toastsForAction...'"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test stays fully green (1321 pass, 0 fail: 1307 baseline + 14 new); the other mazeworld.html source-assertion tests (parley-button-mirror, foe-effect-chip, tutorial, save-validation) stay green; the parity suite stays 33/33 with a clean tree; npm run build:www still succeeds"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "npm test (1321/1321); node --test test/unit/parley-button-mirror.test.js test/unit/foe-effect-chip.test.js test/unit/tutorial.test.js test/unit/save-validation.test.js (58/58); node --test \"test/parity/**/*.test.js\" (33/33, clean tree); npm run build:www"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Pixel 7 device checklist is on-device visual/motion verification (aggregate wording legibility, red-vs-green distinctness, reduced-motion, no layout shift) that cannot be fully proven by an automated source-assertion test — explicitly non-blocking"
    verification: []
    human_judgment: true
    rationale: "Color distinctness at arm's length, motion-off behavior, and layout-shift-under-4-toasts are visual/perceptual judgments that need a human looking at the actual device; the CSS-distinctness half (four resolved hex values, non-collision) is already automated in D1 above."

# Metrics
duration: 35min
completed: 2026-09-15
status: complete
---

# Phase 25 Plan 04: Shell Toast Wiring Summary

**Every dispatched action in mazeworld.html now raises its toasts through one seam (`dispatchWithToasts`), the old hand-written switch is deleted, and all seven toast tones resolve to explicit, mutually-distinct colors with the host cap raised to 4.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 new)

## Accomplishments

- `mazeworld.html` CSS: three new root tokens (`--moss-soft`, `--stamp-soft`, `--amber`) plus recolored/added `.mw-toast[data-tone="..."]` rules — `miss` moved off `--ink-soft` grey onto a muted moss so YOU (hit/miss) and THEM (hurt/dodge) stay in distinct green/red families even when muted; `dodge` (muted stamp), `block` (amber), and `beat` (explicit ink) are new. The host's `position:fixed`/`pointer-events:none` contract and the `prefers-reduced-motion` rule are byte-identical to before.
- `window.mzToast`'s visible cap raised from 3 to 4 (`host.children.length > 4`), matching `toastsForAction`'s `MAX_TOASTS`.
- A new `dispatchWithToasts(action)` helper in the module script scope is now the ONE post-dispatch seam every action flows through: `move`, `abandon`, `buyItem`, `leaveStore`, `resolveJoiner`, `inventoryAction` (covers `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot`/`sellItem`), `engineCombatAction` (covers `attack`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll`/`useItem`), and `camp` — exploration, camp, store, Joiner, inventory and combat events all toast now, not only the combat bar.
- The old `window.mzCombatFeedback` per-action switch and its `window.mzSpellName` helper are deleted entirely; `window.mzSpellCharges` (a different, still-live helper the grimoire renderer uses) was left untouched.
- The DR18 hand-written equip-rejection toast (`"You cannot use that."`) is deleted — `equipRejected` now toasts from the `TOAST_FOR` table in the amber block tone with its actual reason (woodsman/acrobat/noArmor/tooHeavy/wrongClass/notBetter/notEquippable).
- The two pre-dispatch "already at full health" potion guards (the only toasts not driven by an engine event, since no dispatch happens) changed tone from `miss` to `block` — a refusal never looks like a missed swing.
- New `test/unit/shell-toast-wiring.test.js` (14 tests): every `TONES` entry has an explicit CSS color; hit/miss/hurt/dodge resolve to four distinct values and magic/block/beat are distinct from those and each other; miss no longer references `--ink-soft`; host cap is 4 not 3; the fixed/no-CLS/reduced-motion contracts survive; the module script imports `toastsForAction` and defines `dispatchWithToasts` exactly once; exactly one bare `dispatch(` call survives (inside the helper); `dispatchWithToasts(` appears >= 9 times; the old switch/spell-name-helper names (built from string fragments so the test itself never spells them) have zero occurrences; the DR18 toast literal is gone; both full-health guards use `block`; and a behavioural test proves a real `equipRejected(reason: woodsman)` event yields one block toast via `toastsForAction`.
- Final suite: `npm test` 1321 pass / 0 fail (1307 baseline + 14 new); the other mazeworld.html source-assertion tests (`parley-button-mirror`, `foe-effect-chip`, `tutorial`, `save-validation`) 58/58; `node --test "test/parity/**/*.test.js"` 33/33 with a clean `test/parity` tree; `npm run build:www` succeeds. No engine file touched.

## Field Reference for 25-05

- `dispatchWithToasts(action)` (module scope) → `{ state, events, html }`, identical shape to `dispatch(action)` — the ONE seam 25-05's standing guards can point at if they need to assert every action toasts.
- `.mw-toast[data-tone="..."]` now covers all seven `TONES` values with explicit colors; `--moss-soft`/`--stamp-soft`/`--amber` are the new root tokens.
- `test/unit/shell-toast-wiring.test.js`'s `stripComments()` helper (line-comments-before-block-comments ordering) is the safe pattern for any future mazeworld.html source-scan that needs accurate bare-`dispatch(`-style counting — copy it rather than the naive block-then-line order used elsewhere in the repo (e.g. `test/determinism/rng-no-math-random.test.js`, which is safe today only because `engine/`/`content/` never contain a `/*`-looking substring inside a `//` comment; mazeworld.html does).

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS tones (explicit colors, no CLS, reduced-motion kept) + host cap 4** - `3efdfc2` (feat) — the clean, isolated CSS-tone/root-token hunk.
2. **Task 2: dispatchWithToasts helper; route every dispatch call site; delete the old switch, the spell-name helper and the DR18 equip toast; retone the two guards** - `287b661` (feat) — this commit also carries the host-cap-to-4 line and the DR13 comment update above `window.mzToast`, since both landed in the same edit as the switch/helper deletion inside the same function neighborhood (see Decisions Made below).
3. **Task 3: shell-toast-wiring.test.js (source assertions) + full suite + device checklist** - (this commit, following this SUMMARY)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `mazeworld.html` - CSS: three new root tokens + tone rules for miss/dodge/block/beat; `window.mzToast` cap 4; new `dispatchWithToasts(action)` helper; all 8 dispatch call sites routed; `mzCombatFeedback`/`mzSpellName` deleted; DR18 equip toast literal deleted; two full-health guards retoned to block
- `test/unit/shell-toast-wiring.test.js` - new, 14 tests

## Decisions Made

See `key-decisions` in the frontmatter above (hoisting the `toastsForAction` import to dodge a pre-existing false block-comment span in the source-scan; the Task 1/Task 2 commit-boundary split following the diff's natural hunks rather than the plan's exact task numbering).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hoisted the toasts.js import to escape a pre-existing false block-comment span**
- **Found during:** Task 2, running the plan's own literal `<verify>` one-liner
- **Issue:** Placing `import { toastsForAction } from "./src/browser/toasts.js";` beside the `engineAdapter.js` import (as the plan's `read_first` anchor suggested) put it two lines below a pre-existing doc comment mentioning `@capacitor/*` — the `/*` inside that literal text is read by a naive `/\*...*\/` block-comment-stripping regex (used by the plan's own verify one-liner AND by the standing pattern in `test/determinism/rng-no-math-random.test.js`) as an unterminated block-comment opener, silently swallowing ~10,700 characters of real code — including the import line itself — up to the next unrelated `*/`. This is a pre-existing characteristic of the file (confirmed: `mazeworld.html` has 145 `/*` substrings but only 141 real `*/` closers, with the mismatch traced to three `@capacitor/*` mentions and multiple `icons/optimized/*.png` mentions inside `//` comments elsewhere in the file, unrelated to this plan's own edits).
- **Fix:** Moved the import to the very first line inside `<script type="module">`, before any comment that mentions a `/*`-looking substring — a zero-behavior-change relocation (ES module imports are hoisted regardless of source position). Documented the root cause inline at the new import site and in `test/unit/shell-toast-wiring.test.js`'s own `stripComments()` doc comment, using a line-comments-first stripping order that is immune to this specific failure mode (verified safe for the whole file: no line pairs a `/*` opener with a `//` occurring before its own same-line `*/` closer).
- **Files modified:** `mazeworld.html`
- **Verification:** The plan's Task 2 `<verify>` one-liner exits 0; `test/unit/shell-toast-wiring.test.js`'s import-position test passes; full suite green.
- **Committed in:** `287b661` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking-issue fix, required by this plan's own verify gate; no scope creep — no unrelated doc comment elsewhere in the file was edited)
**Impact on plan:** The fix is a pure import-position change with no functional effect; every acceptance criterion in the plan passes as written.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Device checklist (non-blocking, Pixel 7)

The following items are **look-for-only** — none of them block phase or plan completion. The orchestrator offers a phone push at phase close; run these after installing that build.

1. Roll a Fridgian, take a hit → expect a red toast reading something like `"<Foe> hits you (N) · hide 2 soaked"`.
2. Roll a Guard, get missed on a roll of 5 → expect a muted-red (dodge tone) toast reading something like `"<Foe> misses you · Guard"`.
3. Roll a Wizard with Freeze known, tap Strike → expect an amber (block tone) toast reading `"Wizards don't punch. Cast Freeze."`.
4. Roll a Bard, camp until disturbed → expect a toast reading something like `"Camp disturbed · Bard: the singing carried"`.
5. Roll a Pickpocket, open a store → expect an amber (block-adjacent/feature) toast reading something like `"Shop open · Pickpocket: buys x1.25, sells x0.75"`.
6. Fight a multi-attack foe → expect ONE toast reading `"<Foe> hits you K of M (N)"`, never M separate "hits you" toasts.
7. Trigger a 3+ foe round → expect ONE collapsed toast reading `"3 foes swing, K land (N)"`.
8. At character level 1-2, take a miss → expect `"You miss <Foe> — <quip>"` with the Oracle line showing the roll first, then the quip; at level 3, expect a plain `"You miss <Foe>"` with no quip.
9. Compare a red (hurt/dodge) toast against a green (hit/miss) toast side by side at arm's length — the color difference should be unmistakable, not just "slightly darker".
10. Trigger any refusal (Wizard melee, Samurai flee, an illegal equip) → confirm the toast is amber, never the old grey.
11. With Android's "Remove animations" accessibility setting on, confirm toasts appear and disappear with no slide/fade motion.
12. Stack 4 toasts at once (e.g. a busy combat round) → confirm no panel shifts, resizes, or reflows anywhere on screen.

## Next Phase Readiness

- 25-05 (if it lands standing coverage/manifest/purity guards for the toast pipeline) can point them directly at `dispatchWithToasts` and the now-single dispatch seam — no shell wiring work remains.
- The Device checklist above is ready for the orchestrator's phone-push offer at phase close; no item blocks phase completion.
- No blockers for 25-05.

---
*Phase: 25-nothing-happens-silently-feature-feedback*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: test/unit/shell-toast-wiring.test.js
- FOUND: .planning/phases/25-nothing-happens-silently-feature-feedback/25-04-SUMMARY.md
- FOUND commit: 3efdfc2 (Task 1)
- FOUND commit: 287b661 (Task 2)
- FOUND commit: d3afbdb (Task 3)
