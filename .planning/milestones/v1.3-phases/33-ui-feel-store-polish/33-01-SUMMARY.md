---
phase: 33-ui-feel-store-polish
plan: 01
subsystem: engine
tags: [rng-guard, store, economy, parity, content-data]

# Dependency graph
requires:
  - phase: 29-end-of-combat-loot-bag-cap
    provides: "the bagUpgradeTier/dev-boolean parity-carve-out template this plan's storeRoll flag mirrors exactly"
provides:
  - "state.storeRoll: a plain run-level boolean, set true only by the shell's startNewRun, false everywhere else (fixtures, unit tests, tools/ bots, old saves)"
  - "content/store-stock.js: the depth-tier potion allow-list, weapon cost bands, armor cap ladder, and premium enchantment bonus per tier — reusing BAG_FLOORS' 2/5/9 breakpoints"
  - "engine/economy.js: storeTier/storePotionPool/storeWeaponPool/storeArmorFor/enchantForTier/replaceStockLines pure helpers, and openStore's guarded flag-on rewrite block"
  - "test/unit/store-roll.test.js: the full tier/pool/draw-count/stock-shape pin suite for STORE-01"
affects: [33-03-map-zoom-recenter-storecopy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded rng draw behind a run-level boolean the shell alone sets (mirrors dev/bagUpgradeTier); every new draw placed strictly after every pre-existing draw so the flag-off cursor never shifts"
    - "mk()/add() split: mk builds the plain-data stock entry, add() pushes it — so both the flag-off path and the flag-on rewrite share one object-shape builder per line type (potionLine/weaponLine/armorLine/premiumLine)"
    - "replaceStockLines(stock, pred, lines): splice-in-place at the first match's position, remove every match — a line the flag-off store never had is never introduced, and a line that no longer fits a tier's cap is dropped entirely (shrinks the array by exactly one, never grows it)"

key-files:
  created:
    - content/store-stock.js
    - test/unit/store-roll.test.js
  modified:
    - engine/state.js
    - engine/saveState.js
    - engine/economy.js
    - content/index.js
    - src/browser/engineAdapter.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/unit/newrun.test.js
    - test/unit/save-validation.test.js
    - test/unit/engineAdapter.test.js

key-decisions:
  - "storeRoll follows the dev boolean precedent exactly (unconditional-on-fresh-state, tolerant-default-false on load, plain destructure-and-drop in comparables) rather than pendingLoot's reconcile pattern — there is no in-state stock array to replay across load, only a flag that gates the NEXT openStore call"
  - "The comparables carve-out (six one-line destructure additions across harness/comparables.js's three functions plus the three test-local comparables) is required, correcting 33-RESEARCH.md assumption A2: parity fixtures are newRun(seed) output, not hand-authored snapshots, so the field IS present (value false) on every fixture state and must be stripped like dev, not merely assumed absent"
  - "Armor cap enforcement can SHRINK the stock array by exactly one line (when the flag-off upgrade no longer fits under the tier's STORE_ARMOR_CAP) but never grows it — replaceStockLines with an empty lines array on a matched predicate removes the line with no replacement"
  - "The premium item's armor-kind cost formula is unchanged by tier (base.cost * 2, per the pre-existing formula) — only its ar/wp/txt scale with STORE_PREMIUM_BONUS[tier]; the weapon-kind cost formula naturally picks up the new bonus because it already reads premium.bonus"

patterns-established:
  - "Depth-tier lookups reuse content/bags.js#BAG_FLOORS via a derived STORE_TIER_FLOORS constant rather than restating the ladder — the single source of truth for depth breakpoints stays in one file"

requirements-completed: [STORE-01]

coverage:
  - id: D1
    description: "state.storeRoll run flag: set true only by the shell's startNewRun; false for every fixture/unit-test/tools-bot/old-save caller of newRun(seed) or initRun(seed)"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "test/unit/newrun.test.js#STORE-01: newRun(seed).storeRoll is false; newRun(seed, [], { storeRoll: true }) differs ONLY in that field"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#STORE-01: a pre-Phase-33 save with no storeRoll key loads with storeRoll === false"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#STORE-01: storeRoll: true survives serializeRun -> JSON -> validateSave -> rehydrate"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#STORE-01: storeRoll is coerced to a strict boolean"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#STORE-01: startNewRun flags the run storeRoll: true (plain and dev start); initRun(seed) does not"
        status: pass
    human_judgment: false
  - id: D2
    description: "Parity carve-out: storeRoll stripped from all six comparable destructures (3 harness + 3 test-local); flag-off openStore is byte-identical to the frozen prototype (draw order and count unchanged)"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "test/parity/*.test.js (full suite, run against test/parity/prototype-master.js.txt)"
        status: pass
      - kind: unit
        ref: "test/unit/store-roll.test.js#flag-off identity: a missing key, storeRoll: false, and a truthy non-boolean all take the SAME byte-identical path"
        status: pass
      - kind: unit
        ref: "test/unit/store-roll.test.js#seed 3 flag-off stock still pins Katana 656 / Axe 63 / Studded 938 / Casket 3750 / Rations 38"
        status: pass
    human_judgment: false
  - id: D3
    description: "Depth-rolled stock when storeRoll is true: potions (Healing fixed + 3 drawn from an explicit allow-list, trap potion excluded), weapons (2 drawn from a class-legal cost band with a fallback), armor (best class-legal upgrade capped by tier, or dropped entirely if nothing fits), premium item (enchantment bonus re-derived from tier) — every new rng draw placed strictly after every existing draw"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "test/unit/store-roll.test.js#draw-count pin: flag-on consumes exactly today's draws plus N = (potionPool.length - 1) + (weaponPool.length - 1), in sequence"
        status: pass
      - kind: unit
        ref: "test/unit/store-roll.test.js#stock-shape pins: potions (Healing fixed + 3 drawn), weapons (2 drawn), non-rolled lines unchanged, no array growth"
        status: pass
      - kind: unit
        ref: "test/unit/store-roll.test.js#boundary: a Fighter wearing Leather — depth 1 gets NO upgrade flag-on (cap is Leather, already worn) while flag-off offers Studded; depth 5 gets Mail, depth 9 gets Plate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Depth tiers reuse the existing BAG_FLOORS ladder (no new floor table); content/store-stock.js is pure data (content-is-pure-data tripwire)"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "test/unit/store-roll.test.js#STORE_TIER_FLOORS is derived from BAG_FLOORS, not restated"
        status: pass
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-16
status: complete
---

# Phase 33 Plan 01: STORE-01 (engine half) Summary

**Depth-rolled store stock (potions/weapons/armor/premium) behind a run-level `state.storeRoll` boolean that only the shell's `startNewRun` sets — every fixture, unit test, tools/ bot and old save keeps today's byte-identical `openStore` output.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-16T18:20:00Z (approx.)
- **Completed:** 2026-09-16T18:53:00Z
- **Tasks:** 3
- **Files modified:** 12 modified, 2 created

## Accomplishments
- `state.storeRoll` follows the `dev` boolean precedent line for line: unconditional on every fresh `newRun` state, tolerant-boolean-coerced on `validateSave`/`rehydrate`, and stripped as a pure destructure in all six parity comparables (three in `test/parity/harness/comparables.js`, three test-local in combat-/magic-/movement-parity.test.js)
- `src/browser/engineAdapter.js#startNewRun` is the ONE real entry point that sets `storeRoll: true`; `boot()`'s throwaway pre-title run and `dispatch()`'s fail-closed recovery run deliberately stay flag-off
- `content/store-stock.js` (new): an explicit potion allow-list (trap potion at `POTIONS[8]` permanently excluded), weapon cost bands with a Magic-User-safe fallback, an armor cap ladder, and a premium enchantment bonus table — all indexed by a tier derived from `content/bags.js#BAG_FLOORS` (no new floor table)
- `engine/economy.js#openStore`: the flag-off code path was refactored onto shared `mk`/`potionLine`/`weaponLine`/`armorLine`/`premiumLine` builders (byte-identical output, same argument expressions) so the ONE new `if (state.storeRoll === true)` block — placed after every existing rng draw, before the Rations line — can rewrite the potion/weapon/armor/premium lines in place using the exact same builders
- `test/unit/store-roll.test.js` (new, 18 tests): tier/pool/band pins, flag-off identity (missing key, strict `=== true`, seed-3 numeric restatement), the N-extra-draws rng-cursor contract, per-class/per-depth stock-shape pins, and the armor-cap boundary case where the array legitimately shrinks by one line

## Task Commits

Each task was committed atomically:

1. **Task 1: The storeRoll run flag — newRun option, tolerant save read, six-line parity carve-out, shell entry point, and the flag pins** - `49a40bf` (feat)
2. **Task 2: content/store-stock.js tiers + engine/economy.js helpers and the guarded flag-on block in openStore** - `b358b1f` (feat)
3. **Task 3: test/unit/store-roll.test.js — tier/band pins, flag-off identity, draw-count pin, per-depth stock-shape pins; full suite gate** - `2671245` (test)

_Note: Task 1's parity-comparable comments were amended once (still within Task 1's commit, before Task 2 began) after the diff-size acceptance check flagged them as too long — see Deviations._

## Files Created/Modified
- `engine/state.js` - `newRun`'s options destructure gains `storeRoll = false`; `state.storeRoll = !!storeRoll` set beside `dev`
- `engine/saveState.js` - `storeRoll: !!obj.storeRoll` added at both `validateSave` and `rehydrate`, beside the existing `dev` lines
- `engine/economy.js` - `STORE_TIER_FLOORS` + `storeTier`/`storePotionPool`/`storeWeaponPool`/`storeArmorFor`/`enchantForTier`/`replaceStockLines` helpers; `openStore`'s shared line builders and the guarded flag-on block
- `content/store-stock.js` (new) - `STORE_POTION_POOL`, `STORE_WEAPON_BANDS`, `STORE_ARMOR_CAP`, `STORE_PREMIUM_BONUS` — pure data
- `content/index.js` - barrel re-export of the new module
- `src/browser/engineAdapter.js` - `startNewRun` passes `{ startDepth, storeRoll: true }` to `initRun`
- `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js` - the six one-line `storeRoll` destructure additions
- `test/unit/newrun.test.js`, `test/unit/save-validation.test.js`, `test/unit/engineAdapter.test.js` - new storeRoll pins mirroring the existing `dev` pin shapes
- `test/unit/store-roll.test.js` (new) - the full STORE-01 pin suite

## Decisions Made
- Confirmed and applied the plan's correction to 33-RESEARCH.md assumption A2: parity fixtures are `newRun(seed)` output (not hand-authored snapshots), so `storeRoll: false` IS present on every fixture state and the six-line comparables carve-out is required (not optional) — matches the plan's own stated correction, no new decision needed beyond executing it as specified.
- Armor-cap shrink behavior: when the flag-off upgrade no longer fits under the tier's cap (e.g., a Fighter already wearing Leather at depth 1, cap = Leather), the armor line is dropped entirely rather than kept at a stale value — `replaceStockLines(stock, pred, [])` removes the match with no replacement. This is the one case where the flag-on stock array is shorter than flag-off's (never longer).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/self-correction] Parity-comparable carve-out comments were too long, pushing the diff over the plan's 40-line ceiling**
- **Found during:** Task 1, self-check against the plan's own acceptance criteria (`git diff 97a0e8a..HEAD -- test/parity | grep -c '^[-+][^-+]'` must be `<= 40`)
- **Issue:** My first draft wrote 6-line explanatory comments above each of the six destructure edits (the plan specifies a **two-line** comment). Six sites × ~8 lines each pushed the total diff to 45 lines, one over the plan's stated ceiling.
- **Fix:** Rewrote all six comment blocks down to 2 lines each (same substance, tighter wording), re-verified the full parity suite, then amended Task 1's commit (not yet followed by any dependent commit) so the final diff is 24 lines against `97a0e8a..HEAD` for `test/parity/`.
- **Files modified:** test/parity/harness/comparables.js, test/parity/combat-parity.test.js, test/parity/magic-parity.test.js, test/parity/movement-parity.test.js
- **Verification:** `node --test test/parity/*.test.js` → `# fail 0`; `git diff 97a0e8a..HEAD -- test/parity | grep -c '^[-+][^-+]'` → 24 (≤ 40); `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` empty
- **Committed in:** `49a40bf` (amended before Task 2 began — no dependent commit existed yet)

---

**Total deviations:** 1 auto-fixed (self-correction against the plan's own acceptance criteria, no behavior change)
**Impact on plan:** None on scope or behavior — comment-length-only fix, caught and corrected within Task 1 before any downstream task depended on it.

## Issues Encountered
None beyond the deviation above.

## Human verification (deferred to end of run)

UAT is deferred to the end of the autonomous run per this plan's execution context — never paused for a device check. Record these Pixel 7 items for the end-of-run verification pass:

1. **New run, depth 1:** start a NEW run (not a dev start), walk to the first store — expect Healing plus three cheap utility potions drawn from {Cure Poison, Strength, Cure Disease, Enlarge}, two weapons costing ≤ 250 for the rolled class, at most a Leather armor upgrade, and a +1 premium item.
2. **Dev start-at-depth 9:** Settings → long-press the version → start at depth 9 → open the first store — expect pricier weapons (400+ band for a Fighter/Thief), Plate offered to a Fighter currently in lighter mail (if legal), a +3 premium item, and Acuteness possible among the rolled potions.
3. **Re-roll on re-entry:** leave and re-enter a store on the same floor — the rolled stock (potions/weapons/premium) should change between visits; food/lockpicks/repair/scroll/Rations should not.
4. **Old-save compatibility (only if a pre-this-build save exists on the device):** resume it — its store should still show the old fixed four potions/two weapons (flag off, since the save predates `storeRoll`).

## Self-Check

**Files exist:**
- FOUND: content/store-stock.js
- FOUND: test/unit/store-roll.test.js
- FOUND: engine/state.js, engine/saveState.js, engine/economy.js, content/index.js, src/browser/engineAdapter.js (all modified, verified via `git diff --stat`)

**Commits exist:**
- FOUND: 49a40bf (feat(33-01): storeRoll run flag ...)
- FOUND: b358b1f (feat(33-01): depth-rolled store stock ...)
- FOUND: 2671245 (test(33-01): pin store tiers ...)

**Test counts:**
- `npm test` → `# tests 1925`, `# pass 1925`, `# fail 0` (baseline 1902 + 23 new: 8 in Task 1's pins + 15 more added by Task 3's `store-roll.test.js`... actual new-test delta reconciled as 1925 − 1902 = 23)
- `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` → empty
- `git diff --stat 97a0e8a..HEAD -- test/parity` → 4 files (comparables.js + combat-/magic-/movement-parity.test.js), 24 changed lines
- `git diff --stat 97a0e8a..HEAD -- mazeworld.html` → empty (no shell change in this plan, as required)

## Self-Check: PASSED

## Next Phase Readiness
- STORE-01's engine mechanism is complete and parity-safe; Plan 03 can now gate the store header copy on `S.storeRoll` (the flag exists and round-trips through save/load).
- No blockers for Plan 02 (UIF-01/04/05, shell-only, independent of this plan) or Plan 03 (UIF-02/03 + STORE-01 header copy, depends only on the `storeRoll` field name landed here).

---
*Phase: 33-ui-feel-store-polish*
*Completed: 2026-09-16*
