---
phase: 53-joiner-level-cap
plan: 01
subsystem: encounters
tags: [joiner, engine-gate, parity, draw-count, deliberate-divergence, level-cap]

# Dependency graph
requires:
  - phase: 52-foe-cadence-damage-curve
    plan: 03
    provides: "the closed Phase 52 measurement gate (crit-doubles-the-dice rule, Herman sp.strikesAs, the DMG-02 guard, the AFTER bot readout) — this plan's engine edit and its own measured-zero declaration follow the identical measure-first-then-declare discipline"
provides:
  - "engine/encounters.js#meetJoiner — const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth); with an unchanged draw sequence (d10, rollCharacter, wp d20, discarded d20)"
  - "test/unit/joiner-level-cap.test.js (new, 9 tests) — SC1 (cap + draw-count/cursor equality), SC2 (wp formula + abilities deepStrictEqual a natively-rolled level-2 twin), SC3 (narration/key-set/rail-card + Company-panel source pins)"
  - "test/parity/divergence-records.test.js's JOIN-02 guard — EXPECTED = [] plus a standing 31-site Joiner-exposure replay (replaySiteEvents)"
  - "test/parity/FIXTURE-INVENTORY.md's Phase 53 section — the Joiner-exposure predictor table, the live-scan re-run (empty diff), MOVED SET (0), draw-count pins, byte-identical-elsewhere"
  - "tools/initiative-fixture-scan-output.txt re-run on the edited engine (byte-identical to the Phase 52 AFTER)"
affects: [53-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scriptedFirstD10(first, seed) — a test-only rng wrapper whose FIRST d(sides) call asserts sides===10 and returns a scripted value WITHOUT touching the delegate; every other call forwards to a private makeRng(seed), so a capped roll and a native roll of the resulting level share the identical rollCharacter/wp-d20 stream — the only way to prove SC2 by deepStrictEqual"
    - "measure-before-declare for a phase whose predicted moved set is zero: a live scan diff, the full parity suite, and a standing engine-only exposure replay (not just an assumption from FIXTURE-INVENTORY.md's pre-existing 'no fixture meets a Joiner' note) all had to independently confirm MOVED SET (0) before it was declared"

key-files:
  created:
    - test/unit/joiner-level-cap.test.js
  modified:
    - engine/encounters.js
    - test/parity/divergence-records.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - tools/initiative-fixture-scan-output.txt

key-decisions:
  - "The plan's must_haves literally predicted 'pendingJoiner adds exactly lvl/level/wp/maxWP on top of the rollCharacter sheet' (4 new keys) — measured reality is that level/wp/maxWP already exist on a bare rollCharacter sheet (level:1, wp/maxWP from the class roll) and are OVERRIDDEN by meetJoiner's spread, not added; the only genuinely NEW key (by Object.keys set difference) is lvl. Wrote SC3's shape test to the measured truth (added=['lvl'], plus a separate assertion that level/wp/maxWP are pre-existing keys that get overridden) rather than the plan's predicted literal — a measured-first correction, not a deviation from the rule itself."
  - "SEED_FT=1 (Fighter/Knight/Fridgian) and SEED_MU=7 (Magic User/Wizard/Human) were measured by a smallest-seed search over 1..500, exactly as the plan specified; rollCharacter's own splitTableAbilities call means a Knight's sheet already carries one kit-active ability (secondWind) before grantLevelAbilities ever runs, so the capped level-2 Joiner's total abilities array is 3 items (1 kit + 2 pool), not the plan's guessed 2 — the SC2 abilities-length assertion was written against the measured grantLevelAbilities return value (which IS exactly 2 additions per Fighter/Thief) and a robust '>' comparison for the level-5 negative check, rather than a hand-typed absolute count."
  - "Zero re-pins needed across all eight pre-existing Joiner test files, exactly as the plan predicted: every existing assertion is a relative comparison (pendingJoiner.lvl == c.joiner.lvl, a frozen-shape check, or a hand-replayed draw-order control) that never hardcodes a literal rolled level — the default fixedState() floor depth of 1 silently absorbed the cap (any would-be level 2-5 roll on those fixtures already becomes 1) without a single test edit."
  - "The plan's acceptance-criteria prose asked for six FIXTURE-INVENTORY.md H3 sub-headings to each grep -c 1 across the WHOLE document, but the document's own established convention (Phase 45/51/52 sections) already reuses generic H3 titles like '### The live scan (tools/initiative-fixture-scan.mjs, re-run on the edited engine)' and '### Moved set — declared records' verbatim across phases — a whole-document grep for these necessarily returns >1 (confirmed: 2 and 4 respectively, pre-existing before this plan's edit). Verified via a phase-scoped extraction (sed from the Phase 53 H2 to EOF, then grep -c) instead, which returns exactly 1 for all six — the plan's actual machine-checked <verify> block only greps the unique Phase 53 H2 line, so this is a prose-vs-convention mismatch, not a gate failure."

requirements-completed: [JOIN-02, JOIN-03]

coverage:
  - id: D1
    description: "meetJoiner's Level Table roll is clamped to the floor it is met on (Math.min(rolled, state.floor.depth)) with the d10-then-rollCharacter-then-two-d20 draw sequence completely unchanged — pinned by SC1's cap test, control test (floor 5/9/low-roll), and draw-count/cursor-equality test"
    requirement: "JOIN-02"
    verification:
      - kind: unit
        ref: "test/unit/joiner-level-cap.test.js — 'SC1: a d10 of 9 (Level Table 5) met on floor 2 arrives as level 2 …', 'SC1 control: …', 'SC1: the capped meet draws exactly as many rng calls as the uncapped meet …' (9/9 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "grantLevelAbilities and both 20*lvl+d20 wp rolls receive the CAPPED level — a floor-2 capped Joiner's pendingJoiner/c.joiner/joinerMet are deepStrictEqual to a natively-rolled level-2 Joiner from the same stream, and its abilities equal grantLevelAbilities(twin, key, 2)"
    requirement: "JOIN-02"
    verification:
      - kind: unit
        ref: "test/unit/joiner-level-cap.test.js — 'SC2: wp is 20 * 2 + the FIRST d20 …', 'SC2: a floor-2 capped Joiner (rolled 5) is deepStrictEqual to a natively-rolled level-2 Joiner …'"
        status: pass
    human_judgment: false
  - id: D3
    description: "joinerMet/joinerRefused narration, event key sets, c.joiner's frozen 7-key shape, and the rail-card/Company-panel source reads are byte-identical to today — pinned by literal narrateEvent/LINE_FOR snapshots and mazeworld.html/heroTab.js regex source pins"
    requirement: "JOIN-02"
    verification:
      - kind: unit
        ref: "test/unit/joiner-level-cap.test.js — 'SC1/SC3: a Wilmsry meeting a Magic User Joiner …', 'SC3: c.joiner keeps its frozen 7-key shape …', 'SC3: joinerMet and joinerRefused render byte-identical …', 'SC3: the rail card and the Company panel read the SAME capped lvl field …'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The moved parity set is MEASURED as zero (scan Part B diff empty, full parity suite green with zero fixture edits, a 31-site Joiner-exposure replay reporting 0 joinerMet everywhere) and declared in FIXTURE-INVENTORY.md's Phase 53 section, guarded by a standing JOIN-02 test in divergence-records.test.js"
    requirement: "JOIN-03"
    verification:
      - kind: unit
        ref: "test/parity/divergence-records.test.js — 'JOIN-02: the holders declaring Phase 53 are exactly the measured moved set — zero, and no replay site ever meets a Joiner' (42/42 parity tests pass)"
        status: pass
      - kind: other
        ref: "node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt (empty); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false

# Metrics
duration: ~1h
completed: 2026-09-20
status: complete
---

# Phase 53 Plan 01: Joiner Level Cap Summary

**`meetJoiner` now clamps the Level Table roll to `min(rolled, state.floor.depth)` with the draw sequence byte-identical, pinned by 9 new SC1-SC3 tests and zero re-pins across the eight pre-existing Joiner test files, with the moved parity set MEASURED (not assumed) as zero across three independent checks and declared with a standing JOIN-02 guard.**

## Performance

- **Duration:** ~1h
- **Completed:** 2026-09-20
- **Tasks:** 3 (Tasks 1+2 share one commit per the plan's own ground rules; Task 3 is the SUMMARY/docs commit)
- **Files modified:** 5 (1 new test file, 4 modified — `tools/initiative-fixture-scan-output.txt` regenerated byte-identical)

## Accomplishments

- **Task 1 (the cut + Joiner-test triage + the SC1/SC2/SC3 pin file):**
  - `engine/encounters.js#meetJoiner`: `const lvl = SPELL_LEVEL_TABLE[rng.d(10) - 1];` became `const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth);` — inline, no helper (per the plan's own preferred discretion), no explicit `[1, 5]` clamp (depth >= 1 and the table is 1-5, so `min` already bounds it). Added a `DELIBERATE RULES CHANGE (Phase 53, JOIN-02, 2026-09-20)` JSDoc paragraph and a matching inline comment (2 occurrences total, confirmed by grep). All 3 direct `rng.` calls inside `meetJoiner`'s body are unchanged (d10, wp d20, discarded d20) — no new draw.
  - Baseline triage: ran the eight pre-existing Joiner test files BEFORE the edit (223 pass, 0 fail) and AFTER (232 pass — 223 + the 9 new tests — 0 fail). Zero re-pins needed — see the Re-pin ledger below.
  - `test/unit/joiner-level-cap.test.js` (new, 9 tests): `scriptedFirstD10(first, seed)` (a test-only rng that scripts only the first `d(10)` call, forwarding everything else to a private `makeRng(seed)`), `countingRng` (copied verbatim from `test/unit/foe-turn-draw-count.test.js`), `fixedFighter`/`fixedFloor`/`fixedState` (copied from `joiner-acquisition.test.js`, with `identity-world.test.js`'s `pendingJoiner: null` default folded in). `SEED_FT=1` (Fighter/Knight/Fridgian), `SEED_MU=7` (Magic User/Wizard/Human), both measured by a smallest-seed search over 1..500. All 9 tests green.

- **Task 2 (measure the parity set + declare + guard, ONE feat commit with Task 1):**
  - Live scan re-run on the edited engine: `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt` — **EMPTY**, byte-identical to the Phase 52 committed AFTER. Regenerated `tools/initiative-fixture-scan-output.txt` (git shows no diff — truly byte-identical, not merely re-written).
  - Full parity suite: `node --test test/parity/*.test.js` — **42/42 pass, fail 0** (41 + the new JOIN-02 guard test), `git diff --stat -- test/parity/fixtures/` empty (zero fixture edits).
  - A 31-site Joiner-exposure replay (engine-only scratch script, mirroring `fixtureRoster.js`'s dispatch shape but passing FULL action objects so movement's `dir` survives): **0 `joinerMet` events, 0 `encounterRolled` "Joiner" results, `pendingJoiner` never truthy anywhere**, across all 14 chargen seeds + 1 movement script + 6 combat scenarios + 4 magic scenarios + 1 economy script + 5 encounters scenarios.
  - Declared in `test/parity/FIXTURE-INVENTORY.md`'s new `## Phase 53: Joiner level capped by floor depth (JOIN-02) — measured zero: no replay site meets a Joiner` section: the predictor table (31 rows), the live-scan re-run result, `MOVED SET (0)`, the draw-count pins, and byte-identical-elsewhere. `node tools/fixture-inventory.mjs`'s output diffs cleanly against the document's own generated block (confirmed by `node --test test/parity/fixture-inventory.test.js`, 5/5 pass) — the roster block is untouched, only the appended section changed.
  - `test/parity/divergence-records.test.js`'s new `JOIN-02: the holders declaring Phase 53 are exactly the measured moved set — zero, and no replay site ever meets a Joiner` test: part (a) asserts the declared-Phase-53 holder set equals the literal `EXPECTED = []`; part (b) is a standing, in-test `replaySiteEvents` replay of all 31 sites, asserting zero `joinerMet`/Joiner-result/pendingJoiner exposure and that the guard covers exactly 31 sites.
  - Gates (Task 2): `node --test test/parity/*.test.js` 42/42 pass; `npm test` 3382/3382 pass (3372 base + 9 new joiner-level-cap tests + 1 new JOIN-02 guard test), fail 0; `npm run build:www` exit 0; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
  - **ONE feat commit for Tasks 1+2:** `78572c5` — `feat(53-01): Joiner level capped by floor depth — meetJoiner min(rolled, depth), SC1-SC3 pins, measured zero fixture moves declared + JOIN-02 guard (JOIN-02, JOIN-03)`. `AFTER_SHA = 78572c5115014b581fb2084b7588141122d56101` (Plan 02's readouts run against this commit).

- **Task 3 (gates + this SUMMARY):** all gates re-verified at HEAD (see below); this SUMMARY written with the SC1-SC4 proof map, the re-pin ledger, the measured-zero evidence, and the deferred device checks.

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2 (engine cut, SC1-SC3 pins, triage, parity measurement + declaration + guard)** — `78572c5` (feat)
2. **Task 3 (SUMMARY + gates)** — (this commit) (docs)

**Plan metadata:** (this commit or the next) — SUMMARY + STATE + ROADMAP + REQUIREMENTS

## Files Created/Modified

- `engine/encounters.js` — `meetJoiner`'s `const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth);` + the Phase 53 DELIBERATE RULES CHANGE JSDoc paragraph and inline comment.
- `test/unit/joiner-level-cap.test.js` (new) — `scriptedFirstD10`, `countingRng` (copied), `SEED_FT`/`SEED_MU`, 9 `SC1:`/`SC2:`/`SC3:` tests.
- `test/parity/divergence-records.test.js` — new `JOIN-02` guard test + `replaySiteEvents`/`JOIN02_INTERNAL_FNS` helpers.
- `test/parity/FIXTURE-INVENTORY.md` — new `## Phase 53` section (predictor table, live-scan result, `MOVED SET (0)`, draw-count pins, byte-identical-elsewhere).
- `tools/initiative-fixture-scan-output.txt` — re-run on the edited engine (byte-identical to the Phase 52 AFTER).

## Re-pin ledger

**0 re-pins needed** across all eight pre-existing Joiner test files — the plan's own prediction held exactly.

| File | Pass before | Pass after | Change | Why |
|---|---|---|---|---|
| `joiner-acquisition.test.js` | 12 | 12 | none | every assertion compares `pendingJoiner.lvl` to `c.joiner.lvl` (relative) or hand-replays the draw order; no literal rolled level is asserted |
| `cutthroat-joiner.test.js` | 18 | 18 | none | Cutthroat offer tests compare `cutthroat.c.joiner` to a `control` rolled the same way (relative); no literal level asserted |
| `dismiss-joiner.test.js` | 20 | 20 | none | dismissal tests operate on a `fixedPending()` sheet built directly, never through `meetJoiner` |
| `encounters.test.js` | 30 | 30 | none | no test in this file asserts a literal Joiner level |
| `identity-contract.test.js` | 72 | 72 | none | no test in this file asserts a literal Joiner level |
| `identity-world.test.js` | 22 | 22 | none | the Wilmsry/Cutthroat refusal tests assert `c.joiner.cls`/`refused.reason` (class/reason, not level) — default `fixedState()` floor depth (1) silently caps any rolled level to 1 without breaking a single assertion |
| `ability-pool.test.js` | 15 | 15 | none | the frozen 7-key `c.joiner` shape pin and the `pendingJoiner.abilities` array-type check are both level-independent |
| `tuning-bot.test.js` | 34 | 34 | none | no test in this file asserts a literal Joiner level; `forceParty`'s own `--party` distribution shift is documented as by-design (Plan 02's ledger), not re-pinned here |
| **Total** | **223** | **223** (+9 new = 232 in the combined run) | **none** | — |

## Measured zero — evidence

- **Scan Part B diff (empty):** `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt` produced no output — byte-identical to the Phase 52 committed AFTER. Part A's `MOVED SET (3)` / `INITIATIVE EXPOSURE: 3 of 31 replay sites` are Phase 51's own invariant set, unrelated to this phase.
- **Full parity suite:** `node --test test/parity/*.test.js` → **42 tests, 42 pass, 0 fail** (41 + the new JOIN-02 guard). `git diff --stat -- test/parity/fixtures/` → empty (zero fixture edits).
- **31-site Joiner-exposure replay** (engine-only, no prototype sandbox needed — this proves exposure, not byte-parity): every one of the 14 chargen seeds, the movement script, all 6 combat scenarios, all 4 magic scenarios, the economy script, and all 5 encounters scenarios reports **0 `joinerMet` events**, **no `encounterRolled` "Joiner" result**, and **`pendingJoiner` never truthy**. `TOTAL SITES: 31 (expected 31)`. This same replay lives on as `test/parity/divergence-records.test.js`'s `JOIN-02` guard.
- **`MOVED SET (0)`**: no fixture JSON edited; no `+53` `divergence` record exists in any fixture file; declared in `test/parity/FIXTURE-INVENTORY.md`'s Phase 53 section and pinned by the `JOIN-02` guard's `EXPECTED = []` assertion.

## Gates (re-verified at HEAD, Task 3)

```
npm test 2>&1 | tail -12
  1..3377
  # tests 3382
  # suites 0
  # pass 3382
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 38396.1672
```

```
npm run build:www
  [build-www]   @capacitor/haptics: rewrote relative specifiers in 2 .js file(s) to add .js extension
  [build-www] vendored 7 @capacitor/* packages into www/vendor/
  [build-www] stamped version 1.5.0 (6) into www/index.html
  [build-www] wrote www/index.html (mazeworld.html + injected import map)
  [build-www] done
  exit 0
```

```
git hash-object test/parity/prototype-master.js.txt
  a1f4d0dc29782218d8e5aab65bc5989c33f917f0
```

```
git diff <PRE_EDIT=6bf6d0a> --stat -- test/parity/harness/comparables.js tools/lib/tuning-bot.mjs src/browser/ mazeworld.html engine/saveState.js
  (empty — all five untouched)
```

```
git diff <PRE_EDIT=6bf6d0a> -- test/unit/foe-turn-draw-count.test.js test/unit/combat.test.js | grep -c '^-[^-]'
  0
```

```
node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt
  (empty)
```

```
git log --oneline <PRE_EDIT=6bf6d0a>..HEAD
  78572c5 feat(53-01): Joiner level capped by floor depth — meetJoiner min(rolled, depth), SC1-SC3 pins, measured zero fixture moves declared + JOIN-02 guard (JOIN-02, JOIN-03)
```

`npm run boot:check` is environment-blocked on this machine (pre-existing finding, `.planning/STATE.md`'s open Blockers/Concerns) and was NOT run as a gate.

**AFTER_SHA (for Plan 02's readouts): `78572c5115014b581fb2084b7588141122d56101`**

## Schema

No persisted schema change: `c.joiner`'s frozen 7-key shape (`cls, lvl, maxWP, name, race, sub, wp`), `state.pendingJoiner`'s shape, and both event payload shapes (`joinerMet`: `type, name, race, sub, lvl`; `joinerRefused`: `type, reason, name, sub, cls, lvl`) are byte-identical to before this phase — pinned by `test/unit/joiner-level-cap.test.js`'s SC3 tests. There is no migration task. An existing save with an already-recruited over-level member tolerant-loads and keeps its level exactly as rolled (the greenfield ruling: no reconcile-and-narrate ceremony) — only NEW Joiners met after this change are capped.

## Decisions Made

- Wrote SC3's `pendingJoiner` key-set assertion against the MEASURED reality (only `lvl` is a genuinely new key; `level`/`wp`/`maxWP` pre-exist on a bare `rollCharacter` sheet and are overridden, not added) rather than the plan's predicted 4-key literal — see key-decisions above for the full accounting.
- Wrote SC2's abilities-count assertion against the measured `grantLevelAbilities` return value (exactly 2 additions for a capped level-2 Fighter/Thief) rather than the plan's predicted total-array length (which also includes a pre-existing kit-active ability like `secondWind` for a Knight) — the deepStrictEqual-vs-twin assertion and the level-5-negative `>` comparison hold regardless of the exact literal count.
- Verified the plan's "each grep -c prints 1" acceptance-criteria prose for FIXTURE-INVENTORY.md's six H3 sub-headings via a phase-scoped extraction rather than a whole-document grep, since two of those generic H3 titles are already reused verbatim by Phase 51/52's own sections (pre-existing before this plan's edit) — the plan's actual machine-checked `<verify>` block only greps the unique Phase 53 H2 line, which does print 1.
- Zero fixture moves, zero re-pins, zero draw-shape changes — the simplest possible outcome for a rules change whose only lever is a `Math.min` on an already-drawn value.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, no missing critical functionality, no blocking issues encountered. The three items under "Decisions Made" above are measurement corrections to the plan's own predicted literals (per the plan's own "measured, never hand-typed" discipline), not deviations from any instruction, rule, or prohibition.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — plan executed exactly as written; three test assertions were written to measured values instead of the plan's predicted literals where measurement diverged from prediction, all disclosed above.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 has `AFTER_SHA = 78572c5115014b581fb2084b7588141122d56101` to run its `tune-difficulty`/`tune-classes` readouts and `docs/DIFFICULTY-RETUNE.md` ledger entry against.
- The `--party` tuning-bot harness's post-cap distribution shift (now recruiting a depth-1, or `--start-depth`, ally) is the expected, by-design JOIN-03 evidence Plan 02's readout will surface — `tools/lib/tuning-bot.mjs#forceParty` itself is untouched (confirmed by the fence diff above).
- No blockers. `npm test` 3382/3382, `npm run build:www` green, master hash and every prohibited file (`comparables.js`, `tuning-bot.mjs`, `src/browser/`, `mazeworld.html`, `engine/saveState.js`) untouched.

## Success criteria → proof

| # | Success criterion (ROADMAP.md Phase 53 / this plan's own success_criteria) | Proof |
|---|---|---|
| SC1 | A level-5-rolled Joiner met on floor 2 arrives as level 2 with an unchanged draw count — pinned by name. | `test/unit/joiner-level-cap.test.js`: `SC1: a d10 of 9 (Level Table 5) met on floor 2 arrives as level 2 — pendingJoiner.lvl/level, c.joiner.lvl and joinerMet.lvl all read 2`; `SC1 control: the same scripted stream on floor 5 is NOT capped (level 5) and on floor 9 stays at the table ceiling (5); a d10 of 1 on floor 5 stays level 1 (the cap never raises)`; `SC1: the capped meet draws exactly as many rng calls as the uncapped meet and leaves the delegate cursor at the same getState; the draw after meetJoiner equals the hand-replayed control's next draw`. |
| SC2 | Abilities and wp of the capped Joiner equal a natively-rolled level-2 Joiner's — pinned by name. | `test/unit/joiner-level-cap.test.js`: `SC2: wp is 20 * 2 + the FIRST d20 after rollCharacter (maxWP mirrors it) for the floor-2 capped Joiner; the floor-5 uncapped twin reads 20 * 5 + the same d20`; `SC2: a floor-2 capped Joiner (rolled 5) is deepStrictEqual to a natively-rolled level-2 Joiner (d10 of 3) from the same stream — pendingJoiner, c.joiner and the joinerMet event`. |
| SC3 | `joinerMet`/`joinerRefused` narration and the rail card render unchanged; payload shapes pinned. | `test/unit/joiner-level-cap.test.js`: `SC1/SC3: a Wilmsry meeting a Magic User Joiner rolled 5 on floor 2 is refused with joinerRefused.lvl 2, pendingJoiner stays null, and the payload key sets are pinned`; `SC3: c.joiner keeps its frozen 7-key shape; pendingJoiner's ONLY new key is lvl …`; `SC3: joinerMet and joinerRefused render byte-identical through narrateEvent and LINE_FOR …`; `SC3: the rail card and the Company panel read the SAME capped lvl field — source pins on mazeworld.html and src/browser/heroTab.js`. |
| SC4 | The moved set is measured (zero) and declared in FIXTURE-INVENTORY.md; the master hash and every fixture untouched; JOIN-02 guard standing. | Scan Part B diff empty; `node --test test/parity/*.test.js` 42/42 pass with zero fixture edits; 31-site exposure replay 0 joinerMet everywhere; `test/parity/FIXTURE-INVENTORY.md`'s `## Phase 53` section; `test/parity/divergence-records.test.js`'s `JOIN-02` guard test. |
| — | The tree is green in one commit whose SHA is Plan 02's AFTER. | Commit `78572c5` (Tasks 1+2); `AFTER_SHA = 78572c5115014b581fb2084b7588141122d56101`. |

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. Meet a Joiner on floor 1 — the rail card's roll text reads `skill level I`, and after accepting, the Hero tab's Company panel shows the same level; on floor 2 it never exceeds `II`.
2. An old save carrying a level-V ally loads and the Company panel still shows level V (tolerant load, no reconcile — only NEW Joiners are capped).
3. The Oracle's `joinerMet` line and the Wilmsry refusal line read exactly as before (no new copy) — a capped-level Joiner's recruitment line reads identically to a native same-level Joiner's.

## Self-Check: PASSED

- FOUND: engine/encounters.js
- FOUND: test/unit/joiner-level-cap.test.js
- FOUND: test/parity/divergence-records.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: tools/initiative-fixture-scan-output.txt
- FOUND: .planning/phases/53-joiner-level-cap/53-01-SUMMARY.md
- FOUND commit: 78572c5 (Tasks 1+2)
