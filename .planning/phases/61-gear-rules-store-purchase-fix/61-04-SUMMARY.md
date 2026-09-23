---
phase: 61-gear-rules-store-purchase-fix
plan: 04
subsystem: gear-economy
tags: [view-models, store, ui, upgrade-explanation, family-friendly-voice]

# Dependency graph
requires:
  - phase: 61-02
    provides: "engine/derived.js#gearCompareParts, src/browser/upgradeWhy.js#upgradeWhyText, src/browser/viewModels.js#lootCompare's additive `why` field"
  - phase: 61-03
    provides: "engine/economy.js#storeBuyRefusal(c, line) — the ONE pre-payment refusal predicate this plan's store row reads"
provides:
  - "src/browser/viewModels.js#storeRowState(c, line) — the ONE view model a store stock row reads for disabled/reason/advice, built on storeBuyRefusal + lootCompare"
  - "src/browser/viewModels.js#STORE_ROW_COPY (bagFull) — frozen row-reason copy, walked by hp-not-wp and the voice scan"
  - "src/browser/storeScreen.js store rows now render rs.disabled/rs.compareLine/rs.reasonText/rs.showUsable instead of a gold-only disabled expression"
  - "test/unit/store-rows.test.js — storeRowState behavior/purity/agreement-sweep/DOM-render suite"
  - "regenerated thief-store.store.txt / mu-store.store.txt DOM snapshots (declared)"
affects: [62-gear-tab-layout-rebuild, 63-action-sheet-combat-lock-accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-state-from-engine-predicate: a UI row's disabled flag reads the engine's own pre-payment refusal predicate (storeBuyRefusal) directly, rather than restating a subset of the rule (the gold-only expression this plan replaces) — the same 'never restate a verdict' discipline Plan 02's lootCompare/gearCompareParts split established."

key-files:
  created:
    - test/unit/store-rows.test.js
  modified:
    - src/browser/viewModels.js
    - src/browser/storeScreen.js
    - test/unit/hp-not-wp.test.js
    - test/voice/safety-scan.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/storeScreen.test.js
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt

key-decisions:
  - "storeRowState's reasonText branches on cmp.legal (the item's own legality), not on which refusal reason storeBuyRefusal currently returns — so an illegal item's row always names why, even on the rare row where gold is ALSO short (storeBuyRefusal checks gold first and would otherwise report insufficientGold instead of the legality reason). This is the plan's own literal spec ('cmp.line when refusal is a legality reason (gear && cmp && !cmp.legal)') and was verified byte-for-byte against the muStore fixture's Warded-plate row (Magic User, insufficient gold AND wrongClass — both before and after this plan show the row disabled; only the copy text changes from the old usable-suffix to the can't-use reason)."
  - "showUsable is gated on cmp.legal, not on the item's kind — a staff (class-restricted via usableBy but never routed through lootCompare's weapon/armor branches) keeps its usable suffix exactly as before, since storeRowState's `gear` flag is weapon/armor-only per the plan's own field definition."
  - "The DOM test (Task 2) renders directly via renderStoreScreen(host, state, {}) into createRecordingDocument(), reading row.innerHTML for the compare-line/can't-use-reason text (the recording DOM's textContent getter reads empty for an innerHTML-set element, per its own header comment) — simpler than routing through the full mazeworld.html shellSandbox for a two-row assertion."

requirements-completed: [STORE-02, STORE-03]

coverage:
  - id: D1
    description: "storeRowState(c, line) reads storeBuyRefusal + lootCompare only, returning { disabled, refusal, reasonText, compareLine, showUsable }; a 400+-pair agreement sweep across 6 newRun seeds x 3 gold levels x 2 bag states x every real openStore stock line proves disabled === (line.sold || storeBuyRefusal(c, line) !== null), and applyAction's buyItem emits 'bought' iff the row reads enabled"
    requirement: STORE-02
    verification:
      - kind: unit
        ref: "test/unit/store-rows.test.js#agreement sweep: across seeds/classes/gold-levels/bag-states..."
        status: pass
      - kind: unit
        ref: "test/unit/store-rows.test.js — illegal/bag-full/gold-short/sold/non-gear row behavior, purity"
        status: pass
    human_judgment: false
  - id: D2
    description: "A store row shows its refusal reason: a can't-use line for an illegal weapon/armor, 'bag full — sell or drop something first' for a bag-bound refusal (lockpicks, tools, a not-better gear buy on a full bag); a gold shortfall shows nothing extra (the price already says it)"
    requirement: STORE-02
    verification:
      - kind: unit
        ref: "test/unit/store-rows.test.js — 'an illegal weapon (wrongClass) row...', 'a full bag + a not-better weapon...', 'a full bag + lockpicks...', 'gold short on a food line...'"
        status: pass
      - kind: automated_ui
        ref: "test/unit/shell-tab-snapshots.test.js#thief-store.store — the Torch row on a full bag is now disabled with the bagFull reason (a real row-state gap this plan closes, not a cosmetic change)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Weapon/armor/premium store rows show the explained upgrade-or-not line as advice that never disables BUY; the Spiked Staff row (level-3 Quarter-Staff Magic User) is enabled and reads the exact CONTEXT-pinned explanation"
    requirement: STORE-03
    verification:
      - kind: unit
        ref: "test/unit/store-rows.test.js#Spiked Staff row: enabled, no refusal, no reasonText, the explained compareLine ending 'not an upgrade'"
        status: pass
      - kind: unit
        ref: "test/unit/store-rows.test.js#a full bag + an UPGRADE weapon: enabled..., compareLine ends ' · upgrade'"
        status: pass
      - kind: automated_ui
        ref: "test/unit/store-rows.test.js#DOM: renderStoreScreen renders the Spiked Staff row enabled with its compare line, and an illegal Broadsword row disabled with its can't-use reason"
        status: pass
    human_judgment: false
  - id: D4
    description: "STORE_ROW_COPY is scanned by both the hp-not-wp guard and the voice safety scan; UPGRADE_WHY_COPY (imported but not yet scanned since Plan 02) joins the voice scan too; the source pins (shell-clarity-43, storeScreen.test.js's import line) and STORE_ROLL_COPY's 2-occurrence pin stay green"
    verification:
      - kind: unit
        ref: "test/unit/hp-not-wp.test.js; test/voice/safety-scan.test.js; test/unit/shell-clarity-43.test.js; test/unit/shell-map-store-polish.test.js; test/unit/storeScreen.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "Exactly the two store DOM snapshots (thief-store.store, mu-store.store) move, deliberately, with the exact DOM change named; every other snapshot fixture is byte-identical; engine/, content/, test/parity/ and mazeworld.html are untouched by this plan"
    requirement: STORE-02
    verification:
      - kind: automated_ui
        ref: "test/unit/shell-tab-snapshots.test.js (both store fixtures pass after MZ_SNAPSHOT_UPDATE=1 regeneration; a plain re-run exits with only the 5 pre-existing, base-commit-identical CRLF-checkout failures — verified via git archive comparison, see Issues Encountered)"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine/ content/ test/parity/ mazeworld.html (empty); git diff --stat -- test/unit/fixtures/shell-snapshots/ (lists only the two store fixtures)"
        status: pass
    human_judgment: false

duration: ~100min
completed: 2026-09-23
status: complete
---

# Phase 61 Plan 04: Store Rows State the Engine's Reason and the Explained Upgrade Line Summary

**Every store stock row now reads one new view model, `storeRowState(c, line)`, built directly on the engine's own `storeBuyRefusal` (Plan 03) and `lootCompare` (Plan 02) — a row disables exactly when the engine would refuse, names the reason on the row (never a post-tap message), and shows the explained upgrade-or-not line as advice that never disables BUY; the fix also surfaced and closed a real pre-existing gap where a bag-full lockpicks/tool row looked clickable even though `buyFrom` already refused it.**

## Performance

- **Duration:** ~100 min
- **Completed:** 2026-09-23
- **Tasks:** 2
- **Files modified/created:** 9 (1 new test file, 8 modified)

## Accomplishments

- `src/browser/viewModels.js#storeRowState(c, line)` (new, exported): the ONE row-state predicate — `refusal = line.sold ? null : storeBuyRefusal(c, line)`, `disabled = !!line.sold || refusal !== null`, `reasonText` (a can't-use line when the item itself is illegal, `STORE_ROW_COPY.bagFull` for a bag-bound refusal, else `null`), `compareLine` (the `lootCompare` explanation for a legal weapon/armor row — pure advice, never read by `disabled`), `showUsable` (suppressed only when the item is illegal, since the can't-use reason already names who can use it).
- `STORE_ROW_COPY` (new, frozen): `{ bagFull: "bag full — sell or drop something first" }`, walked by `test/unit/hp-not-wp.test.js` and `test/voice/safety-scan.test.js`.
- `src/browser/storeScreen.js`: the stock loop now computes `rs = storeRowState(c, item)` once per row, sets `row.disabled = rs.disabled` (replacing the gold-only `!!item.sold || c.gold < item.cost`), gates the usable-by suffix on `rs.showUsable`, and composes the row's italic sub text from `[sub, rs.compareLine, rs.reasonText].filter(Boolean).join(" · ")` before appending the usable suffix. `STORE_ROLL_COPY` stays at exactly 2 occurrences; the repair-row special case is byte-identical.
- Closed a real, previously-invisible STORE-02 gap: Plan 03 already made `buyFrom` refuse a `giveLockpicks`/`giveTool` buy pre-payment when the bag is full (`storeBuyRefusal`'s `STOWING_EFFECTS` branch), but the STORE ROW never read that predicate — a bag-full Torch/lockpicks row looked clickable even though tapping BUY silently did nothing. This plan's row now shows it disabled with the `bagFull` reason, matching what `buyFrom` has done since Plan 03.
- `test/unit/store-rows.test.js` (new, 12 tests): the Spiked Staff acceptance case (`{ disabled: false, refusal: null, reasonText: null, compareLine: "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade", showUsable: true }`), every `<behavior>` edge (illegal weapon, bag-full weapon/lockpicks, an upgrade through a full bag, gold-short, a sold line, six non-gear effect kinds), purity, a `STORE_ROW_COPY` frozen/voice check, a 432-pair agreement sweep (6 seeds × 3 gold levels × 2 bag states × every real `openStore` stock line — well over the 100-pair floor) proving `disabled === (line.sold || storeBuyRefusal(c, line) !== null)` and `buyItem` emits `"bought"` iff the row reads enabled, and a DOM render test (`renderStoreScreen` into `createRecordingDocument()`) covering the Spiked Staff/Broadsword pair.
- Measured the DOM snapshot impact directly: `node --test shell-tab-snapshots.test.js` before any fixture write showed exactly `thief-store.store` and `mu-store.store` failing (confirmed via a normalized line-by-line diff — see below), regenerated deliberately with `MZ_SNAPSHOT_UPDATE=1`, then verified a plain re-run passes both.

## Measured snapshot diff (declared, per project rules)

**thief-store.store.txt:**
- Flail row: `d10+2 (usable by Fighters, Thieves)` → `d10+2 · d10+2 vs your d6/2 · −2 to hit · crits on 1 vs your 1–2 · 1.7 vs 1.0 a swing · upgrade (usable by Fighters, Thieves)` (compare line added; row stays disabled — a Thief, `usableBy` still names Fighters/Thieves).
- Spear row: `d8` → `d8 · d8 vs your d6/2 · −1 to hit · crits on 1 vs your 1–2 · 1.4 vs 1.0 a swing · upgrade` (compare line added; row stays disabled — legality-gated, pre-existing).
- Warded leather row: `AR 7, 25 hp · enchanted (usable by Fighters, Thieves)` → `AR 7, 25 hp · enchanted · AR 7 vs your AR 6 · upgrade (usable by Fighters, Thieves)` (compare line added).
- Torch row: `disabled` flag flips **false → true**; sub gains `· bag full — sell or drop something first`. This is the real fix described above, not a cosmetic change — `buyFrom` already refused this buy pre-payment (Plan 03); the row now reflects it.

**mu-store.store.txt:**
- Spear row: `d8` → `d8 · d8 vs your d6 · 1.1 vs 0.9 a swing · upgrade` (compare line added).
- Quarter Staff row: `d6` → `d6 · 0.9 vs 0.9 a swing · not an upgrade` (compare line added; stays enabled — a not-better weapon never disables BUY).
- Warded plate row: `AR 17, 65 hp · enchanted (usable by Fighters — not you)` → `AR 17, 65 hp · enchanted · can't use (Fighter only)` (the usable-suffix wording replaced by the can't-use reason; `disabled` unchanged — this Magic User's gold is already short of the 4,000 wm price, so `storeBuyRefusal` returns `insufficientGold` first in both the old and new code paths, and `reasonText`'s legality branch is independent of which refusal reason is currently active per the plan's own spec).

No other row in either fixture changed. No hero/gear fixture changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: storeRowState view model + STORE_ROW_COPY, test-first** - `e06ff66` (feat)
2. **Task 2: Store rows render the state; copy scans; pins and store snapshots updated; full checks** - `72300c2` (feat)

**Requirements doc:** `5c4f186` (docs: mark STORE-03 complete in REQUIREMENTS.md)

_Note: Task 1's commit includes the whole of `test/unit/store-rows.test.js`, including the DOM-render assertions the plan assigns to Task 2 — the file was authored as one cohesive suite in a single pass and Task 2 added no further edits to it, mirroring Plan 02's own documented precedent for a shared-file task pair landing as one commit per file._

## Files Created/Modified

- `src/browser/viewModels.js` — `storeRowState(c, line)`, `STORE_ROW_COPY`, one new `storeBuyRefusal` import
- `src/browser/storeScreen.js` — the stock loop reads `storeRowState`; disabled/sub composition rewritten; header comment updated
- `test/unit/store-rows.test.js` — NEW: 12 tests (behavior, purity, voice, agreement sweep, DOM render)
- `test/unit/hp-not-wp.test.js` — `STORE_ROW_COPY` added to the imported/walked copy-object list
- `test/voice/safety-scan.test.js` — `UPGRADE_WHY_COPY` and `STORE_ROW_COPY` imported and pushed into `collectAuthoredStrings`
- `test/unit/shell-clarity-43.test.js` — the store-rows source pin repointed to `storeRowState`/`rs.*`
- `test/unit/storeScreen.test.js` — the import-line pin extended for `storeRowState` (deviation, see below)
- `test/unit/fixtures/shell-snapshots/thief-store.store.txt`, `mu-store.store.txt` — regenerated (declared above)

## Decisions Made

- `reasonText`'s legality branch checks `cmp.legal` directly rather than `refusal.reason`, per the plan's own literal field spec — this means an illegal item's row always shows the can't-use reason even on the rare row where gold is ALSO short (verified against the muStore Warded-plate fixture row, where both conditions hold simultaneously and the disabled flag is unchanged either way).
- The DOM test renders `renderStoreScreen` directly into `createRecordingDocument()` rather than routing through the full `mazeworld.html` shell sandbox — simpler for a focused two-row assertion, and `renderStoreScreen` already has a documented `host`/`host.ownerDocument`/`deps`-only contract that needs no sandbox.
- Task 1's commit carries the whole `test/unit/store-rows.test.js` file (including Task 2's DOM assertions) since both were authored together in one pass on one new file — see Task Commits note above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `test/unit/storeScreen.test.js`'s import-line pin for the new `storeRowState` import**
- **Found during:** Task 2 (updating `storeScreen.js`'s import line)
- **Issue:** `test/unit/storeScreen.test.js` (not in this plan's own `<files>` list, but a real existing test) pins the exact literal `import { armorDisplay, usableBy } from "./viewModels.js";` string. Adding `storeRowState` to that import line — required by Task 2's own `<action>` — would break this pre-existing test.
- **Fix:** Updated the pin's regex to `import \{ armorDisplay, usableBy, storeRowState \} from "\.\/viewModels\.js";` with a one-line comment noting the Phase 61 addition.
- **Files modified:** `test/unit/storeScreen.test.js`
- **Verification:** `node --test test/unit/storeScreen.test.js` — 8/8 pass.
- **Committed in:** `72300c2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the existing test suite green after Task 2's own required import-line edit. No scope creep — the fix is a one-line regex update to an existing pin, not new functionality.

## Issues Encountered

- **`npm test` in this Windows worktree checkout reports 12 pre-existing failures, confirmed identical against the untouched base commit (`2f9214b`, verified via `git archive HEAD` into a scratch directory and re-running the full suite there — same 12 test names, same failure text).** Breakdown: 4 stale milestone-ledger/AFTER-block snapshots (`Outliers (Phase 26)...`, `AFTER, Outliers and Handoff blocks...`, `Handoff to Phase 27...`, `v1.5 AFTER section...`), 3 flee-ledger before/after table drifts, and 5 DOM-snapshot CRLF-checkout drifts (`thief.hero`, `thief.gear`, `thief.gear-confirms`, `mu.hero`, `mu.gear` — the Hero/Gear tab fixtures, unrelated to this plan's Store-only changes). All 12 are already documented by Plans 01–03's own SUMMARYs as pre-existing CRLF/EOL checkout artifacts on this dev machine (no `.gitattributes eol=lf` pin) — none touch this plan's files (`git diff --stat -- engine/ content/ test/parity/ mazeworld.html` is empty), so none were fixed here per the SCOPE BOUNDARY rule. Two of the 7 DOM-snapshot fixtures in that CRLF-affected set — `thief-store.store` and `mu-store.store` — WERE this plan's own deliberate regeneration target and now pass; the other 5 (Hero/Gear tabs) were deliberately left at their pre-existing CRLF-mismatched state (explicitly reverted via `git checkout --` after the `MZ_SNAPSHOT_UPDATE=1` run touched all seven fixtures as a side effect) to honor the project's standing ruling that only the two store snapshots may move in this plan.
- `npm run build:www` initially failed with `@capacitor/core is not installed` — this worktree had no `node_modules/` at all (git worktrees do not share `node_modules` with the main checkout). Ran `npm install --prefer-offline --no-audit --no-fund` (zero `package.json`/`package-lock.json` changes — confirmed via `git diff --stat`, restoring already-declared dependencies from the local npm cache in 14s) to restore the worktree's own dependency tree. This is a worktree environment bootstrap step, not a Rule-3-excluded "referenced package" install (no new or unverified package was added). After this, `build:www` exits 0 and `boot:check` also passes (exit 0, all four `PASS` lines) — better than STATE.md's documented `boot:check` environment blocker, which did not reproduce here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STORE-02 and STORE-03 are both now fully closed (REQUIREMENTS.md marked complete for both — STORE-02 was already checked by Plan 03; STORE-03 flips to complete in this plan's docs commit).
- `storeRowState` is exported and available for Phase 62's Gear tab rebuild if a similar row-state contract is useful there; no new engine surface, no new serialized state — purely presentational.
- The pre-existing CRLF/EOL environment noise (12 failures, unrelated to this plan) remains tracked via Plans 01–03's own deferred-items ledgers; not new to this plan, not blocking.

---
*Phase: 61-gear-rules-store-purchase-fix*
*Plan: 04*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `src/browser/viewModels.js` (storeRowState, STORE_ROW_COPY)
- FOUND: `src/browser/storeScreen.js` (storeRowState wired in)
- FOUND: `test/unit/store-rows.test.js`
- FOUND: `test/unit/fixtures/shell-snapshots/thief-store.store.txt` (regenerated)
- FOUND: `test/unit/fixtures/shell-snapshots/mu-store.store.txt` (regenerated)
- FOUND commit `e06ff66` (Task 1)
- FOUND commit `72300c2` (Task 2)
- FOUND commit `5c4f186` (docs: REQUIREMENTS.md)
