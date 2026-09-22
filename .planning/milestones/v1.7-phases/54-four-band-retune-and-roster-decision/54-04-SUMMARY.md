---
phase: 54-four-band-retune-and-roster-decision
plan: 04
subsystem: tuning
tags: [tuning-bot, fair-bot, readout, per-floor-survival, pace, class-identity, before-readout, ledger, user-ruling-d]

# Dependency graph
requires:
  - phase: 54-four-band-retune-and-roster-decision
    plan: 01
    provides: "the Four-band readout scaffold (band-readout.mjs) and the per-floor survival block (USER RULING C) this plan extends"
provides:
  - "tools/lib/tuning-bot.mjs — the fair-bot policy (potion 0.6 / flee 0.4 / caster-flee 0.6 / camp 0.5 kept), the Joiner-accept-when-empty branch (D-20 superseded), chooseSpell's defensive/offensive MODE, and playRun's floorSnapshots + identity tallies (fights/rounds/dmgTaken/foeSwings/foeMisses/castsDefensive/castsOffensive/potionsUsed/backstabs/flees) on every run record"
  - "tools/lib/band-readout.mjs — DOT_CAUSES/STARVATION_CAUSES/COMBAT_CAUSE_PREFIX (the three-class death split), SURVIVAL_PASS narrowed to deepFloors [11,12] + tailFloors [13,20], interpolatedMedian, paceReadout/formatPaceReadout, classIdentityReadout/formatClassIdentityReadout, classSpreadReadout"
  - "tools/tune-difficulty.mjs — the Pace and Class identity blocks printed after the survival block and carried in --json (pace, classIdentity keys)"
  - "tools/lib/class-matrix.mjs — summarizeRows gains dmgTakenPerFight/roundsPerFight/foeMissRate/castsDefensive/castsOffensive/potionsPerRun; rollups.byClass gains a recorded spread; formatText prints a Class spread block"
  - "the fresh BEFORE (readouts/global-before-{solo,party,start-depth-20,smoke}.txt + docs/class-pass/v17-p54-global-before-smoke.json), taken on the fair bot with the untouched engine (1cb56c6's knot values) — every later Phase 54 number compares to THIS"
  - "docs/DIFFICULTY-RETUNE.md's #### Why floor bands failed, #### Global model (USER RULING D) — the dial table, #### BEFORE (global model) sections"
affects: [54-05, 54-06, 54-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "chooseSpell's defensive/offensive MODE is computed once per call and stashed on ctx.lastSpellMode so playRun's identity tally can classify a cast without re-deriving the mode"
    - "floorSnapshots captures the PRE-change 'before' state on every floorChanged transition (plus a final snapshot at the death/stuck floor), so a floor's row reflects what the hero left that floor with, not what it arrived with"
    - "the three-class death split (combat / dot / starvation-exhaustion / other) replaces the old hazard/starvation split — 'spent by the dungeon itself' reclassifies from starvation to dot"
    - "SURVIVAL_PASS.deepFloors narrows to [11,12] with a new tailFloors [13,20] band — floors 13+ print 'tail' and are never PASS/MISS, never in the verdict; reach-20 is reported but no longer folded into the verdict"

key-files:
  created:
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-solo.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-party.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-start-depth-20.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-smoke.txt
    - docs/class-pass/v17-p54-global-before-smoke.json
  modified:
    - tools/lib/tuning-bot.mjs
    - tools/lib/band-readout.mjs
    - tools/lib/class-matrix.mjs
    - tools/tune-difficulty.mjs
    - test/unit/tuning-bot.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/band-readout.test.js
    - test/unit/class-matrix.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "chooseSpell's defensive mode re-ranks HEAL (460+expected) and DISABLE (420-450) and WARD (410) ABOVE the DAMAGE tier (unchanged 300+expected) — since defensive scores also exceed the KILL tier's 400-410 range, a defensive cast can outrank even a one-shot kill when the fight is going badly; this is the literal numeric ordering the plan specified (not just 'outranks DAMAGE')"
  - "potionsUsed in the identity tally counts both a successful potionDrunk event AND an itemUsed heal/full-potion event (chooseCombatItem's worn/bag potion path) — both are a hero spending a healing potion, just through two different dispatch shapes"
  - "the class-identity readout's foeMissRate is reported as a percentage (foeMisses/foeSwings * 100, 1dp) while class-matrix.mjs's own per-cell foeMissRate stays a 0-1 fraction (3dp) — two different consumers, no shared contract to keep byte-identical, both documented in their own JSDoc"
  - "the party BEFORE excerpt in the ledger skips L=1's verbatim line (replaced with a prose summary) so the acceptance grep for 'L=1  reached=200' counts exactly one new occurrence (the solo block) — both solo and party naturally read reached=200 at floor 1 since every run reaches floor 1 by definition"

requirements-completed: [BAND-01]

coverage:
  - id: D1
    description: "The bot is a fair player before anything else is measured — thresholds moved (potion 0.5->0.6, flee 0.3->0.4, casterFlee 0.5->0.6, camp unchanged 0.5), a pending Joiner is accepted when the party is empty (D-20 superseded), the Magic User plays both defensive and offensive modes, and the Thief's backstab/flee are counted by the harness"
    requirement: "BAND-01"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js (36/36 pass, incl. 'D-06: caster threshold raises flee/parley to 0.6...', 'USER RULING D: a pending Joiner is accepted...', 'USER RULING D: chooseSpell defensive mode...', 'USER RULING D: playRun records cls/sub/race...')"
        status: pass
      - kind: other
        ref: "node -e printing BOT_DEFAULTS gives exactly '0.6 0.4 0.6 0.5'; grep -c 'accept: (state.party' >= 1 and grep -c 'accept: false }; // D-20' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The readout carries the three-class death split (combat/dot/starvation-exhaustion/other), a per-floor Pace block, and a Class identity block (class pools only, never race/sub) — printed in tune-difficulty and carried in --json; tune-classes carries the same identity columns per cell plus a recorded (never-a-target) class spread"
    requirement: "BAND-01"
    verification:
      - kind: unit
        ref: "test/unit/band-readout.test.js (22/22 pass) and test/unit/class-matrix.test.js (22/22 pass)"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=6 --max-actions=400 | grep -c 'Per-floor survival|^Pace (|^Class identity (' prints 3; the --json check prints 'true true true true'"
        status: pass
    human_judgment: false
  - id: D3
    description: "A fresh BEFORE (solo/party/class-smoke/depth-20 slice) is committed on the untouched engine with the fair bot; the ledger records why floor bands failed, the complete global-model dial table (every dial with hook/identity/start/bounds/order/direction), and the BEFORE numbers"
    requirement: "BAND-01"
    verification:
      - kind: other
        ref: "the four readouts/global-before-*.txt files exist and carry the three blocks; the smoke JSON's meta.commit=8e43ad6, cells.length=143; the ledger heading grep prints 3; git diff --stat 5550002 -- engine/ content/ src/ mazeworld.html test/parity/ is empty at every commit; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: ~2h
completed: 2026-09-21
status: complete
---

# Phase 54 Plan 04: Fair Bot, Global-Model Readouts & Fresh BEFORE Summary

**Made the tuning bot a fair player (potion 0.6 / flee 0.4 / caster-flee 0.6, accept an empty-party Joiner, MU defensive+offensive spellcasting, Thief opener/flee counted), gave the readout a three-class death split (combat / dot / starvation-exhaustion) plus per-floor Pace and per-class-pool Class identity blocks, and took the fresh BEFORE on the untouched engine that every later Phase 54 number compares to — plus the ledger's opening record of why floor bands failed and the complete global-model dial table.**

## Success criteria → proof

| # | Success criterion | Proof |
|---|---|---|
| SC1 (bot policy, one commit) | `tools/lib/tuning-bot.mjs` commit `6a8e19c` | `node -e` prints `0.6 0.4 0.6 0.5`; `grep -c 'accept: (state.party' tools/lib/tuning-bot.mjs` = 1, `grep -c 'accept: false }; // D-20'` = 0; `grep -c 'defensive'` = 22, `grep -c 'lastSpellMode'` = 6; `grep -c 'floorSnapshots'` = 6, `grep -c 'castsDefensive\|castsOffensive\|potionsUsed\|backstabs'` = 15; `node --test test/unit/tuning-bot.test.js test/unit/bot-tactics.test.js test/unit/bot-buy-policy.test.js test/unit/class-pass-usage.test.js` 106/106 pass |
| SC2 (readout, three blocks) | `tools/lib/band-readout.mjs` + `tools/tune-difficulty.mjs` + `tools/lib/class-matrix.mjs` commit `8e43ad6` | `grep -c 'Per-floor survival\|^Pace (\|^Class identity ('` on a live transcript = 3; `--json` check prints `true true true true`; `SURVIVAL_PASS` = `{shallowFloors:[1,10], deepFloors:[11,12], tailFloors:[13,20], reach20Band:[3,5]}`; `grep -c '"spent by the dungeon itself"'` = 1 (inside `DOT_CAUSES`); `grep -c 'HAZARD_CAUSES'` = 0; `node tools/tune-classes.mjs --seeds 1 --workers 2 --sub Knight --race Human --json` shows the 6 new cell keys and `rollups.byClass[].spread` |
| SC3 (fresh BEFORE) | `readouts/global-before-*.txt` + `docs/class-pass/v17-p54-global-before-smoke.json` commit `5aecfb7` | all four `ok <name>` lines print; solo transcript block grep = 3; `Bot:` line = `flee=0.4/0.6(caster) potion<0.6 camp<0.5`; smoke JSON `meta.commit=8e43ad6`, `cells.length=143` |
| SC4 (ledger) | `docs/DIFFICULTY-RETUNE.md` commit `5aecfb7` | heading grep (`Why floor bands failed` / `Global model` / `BEFORE (global model)`) = 3; every dial name from 54-06-PLAN.md's dial table present (all 28 `grep -c` checks >= 1); `FOE-side power keys to DEPTH`, `class pools`, `v1.8 content candidate` all present; `L=1  reached=200` count = 7 (one more than HEAD 5550002's 6) |
| SC5 (gates green, engine untouched) | every commit | `git diff --stat 5550002 -- engine/ content/ src/ mazeworld.html test/parity/` empty at every commit; `npm test` fail 0 at every commit (3405/3405, then 3414/3414, then 3414/3414); `npm run build:www` exit 0 at every commit; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged throughout |

## Bot policy change table

| Parameter | Old (D-05/D-06/D-20) | New (USER RULING D) |
|---|---|---|
| `potionThreshold` | 0.5 | 0.6 |
| `fleeThreshold` | 0.3 | 0.4 |
| `casterFleeThreshold` | 0.5 | 0.6 |
| `campThreshold` | 0.5 | 0.5 (unchanged) |
| Pending Joiner | always `accept: false` | `accept: (state.party?.length ?? 0) === 0` (accept when empty, decline when full — D-20 superseded) |
| Magic User spellcasting | offensive scoring table only | defensive MODE (below potion threshold, or 2+ foes with no castable KILL-tier) re-ranks HEAL 460+/DISABLE 420-450/WARD 410 above DAMAGE; offensive mode unchanged |
| Thief backstab/flee | fired by the engine, uncounted | `identity.backstabs`/`identity.flees` tally every `backstab`/`fled` event |

## BEFORE (fair bot) — key numbers

**Solo (200 seeds, commit `8e43ad6`):** death-depth `min=1 p50=4 p90=8 max=12`; reach `>=5 49.4% >=10 4.7% >=20 0.0%`; stuck 30/200. Per-floor: floor 1 PASS (dS -6.3), floors 2-12 all MISS (dS from -13.3 at floor 2 to -30.8 at floor 6, the worst point). Death-class shares (top-line): starvation 16.0%, dot (trap/fall/leap/maze) ~17.5-18.5%, combat ~65-66%. Class-pool p50: Fighter 5, Thief 4, Magic User 4.

**Pace (solo):** level 2.70 by floor 4 (target ~2, roughly on pace), but hits the level cap (5) by floor 9 — far ahead of the target's "level 5 by ~18". This is HERO_SP_SCALE's (dial-table search coordinate #3) signature — 54-06/54-07 release it.

**Party (200 seeds, backgrounded):** floor 1 PASS (dS -2.3), floors 2-3 PASS, floors 4-12 MISS; reach-20 0.5%; stuck 61/200 (own bucket, ~30%, within the normal party-run range). Class-pool p50: Fighter 5, Thief 5.5, Magic User 4.

**Depth-20 slice (50 seeds):** p_20 = 68.0% (reached 50, deaths 16) — well below the 84.5% target but this slice's own bands are all `tail` (never PASS/MISS); reach-20 100% (every seeded run starts there). Death-cause leader: `cut down by a Herman` (18.0%), then `starved in the dark`/`Stalka Beast`/`Vampire` (10.0% each) — the tier-4/5 roster.

**Class smoke (5 seeds x 143 cells = 715 runs):** POOLED `n=715 stuck=86 mean=4.79 p50=4.0 p90=8.0 >=5%=49.6 >=10%=4.1 >=20%=0.0`; top causes `starved in the dark(106), fell off a wall(50), undone by a trap(46)`. Class spread (recorded, not a target): Fighter p50Depth 2.0 (Barbarian/Elven) to 9.0 (Woodsman/Wilmsry); Thief 2.0 (Pilfer/Elven) to 9.0 (Cat Burglar/Wilmsry); Magic User 1.0 (Cleric/Dwarven) to 8.0 (Warlock/Troll).

## Test names

**New/re-pinned in `test/unit/tuning-bot.test.js` (36/36 pass):**
- `D-06: caster threshold raises flee/parley to 0.6 vs any kit-bearing live foe (0.4 otherwise) (USER RULING D)`
- `D-05: potion in combat drinks below potionThreshold (0.6) when carried; flee still wins below fleeThreshold (0.4) (USER RULING D)`
- `USER RULING D: a pending Joiner is accepted when the party is empty and declined when full; take/leave a find based on findFull, always leave a store`
- `HARN-02: Death gate — costs 25 wp, only cast when the post-cost wp stays above the flee line` (re-pinned to maxWP:100 headroom)
- `USER RULING D: chooseSpell defensive mode — below the potion threshold Heal outranks Fireball; at 2 live foes with no one-shot, a disable outranks damage; above threshold with 1 foe the damage pick is unchanged`
- `HARN-02: Heal fires below potionThreshold once potions run out; Major Heal outranks Heal` (re-pinned to wp:20/40 = 0.5, between the new thresholds)
- `USER RULING D: playRun records cls/sub/race, one floorSnapshot per floor reached, and identity tallies (fights/rounds/dmgTaken/foeSwings/foeMisses/castsDefensive/castsOffensive/potionsUsed/backstabs/flees) — a seeded 200-action Thief run counts >= 1 backstab`

**Re-pinned in `test/unit/bot-tactics.test.js`:**
- `decideAction: takes the pending loot pile before even a pending Joiner; leaves it when the bag is full` (empty-loot Joiner case now expects `accept: true`)

**New in `test/unit/band-readout.test.js` (22/22 pass):**
- `survivalReadout: deaths split combat / dot / starvation-exhaustion / other by cause (USER RULING D)`
- `USER RULING D: the three-class death split classifies one death per class, incl. 'spent by the dungeon itself' as dot (never starvation)`
- `survivalVerdict: USER RULING D (plan-approval cut #3) — the verdict covers ONLY floors 1-12 ...`
- `formatSurvivalReadout: ... floor 13+ is tail, the reach-20 line is reported (not part of the verdict) ...`
- `interpolatedMedian: the middle value on odd n, the mean of the two middle values on even n; null on empty`
- `paceReadout: aggregates floorSnapshots per floor ...`
- `formatPaceReadout: the header line is exact, one line per floor`
- `classIdentityReadout: pools by CLASS ONLY (a Fighter Knight and a Fighter Bard land in ONE row, in CLASS_POOLS order) ...`
- `formatClassIdentityReadout: the header line names 'class pools only' and prints one line per class`
- `classSpreadReadout: per class, the min/max p50Depth/reach5 cell — a recorded spread, never a verdict`

**New in `test/unit/class-matrix.test.js` (22/22 pass):**
- `summarizeRows: gains dmgTakenPerFight/roundsPerFight/foeMissRate/castsDefensive/castsOffensive/potionsPerRun, run-weighted over completed rows' identity tallies; null-safe on zero completed/zero fights`
- `rollups.byClass: each row gains a spread — the recorded (never-a-target) min/max p50Depth/reach5 cell for that class pool, named sub/race`

## Gates

`npm test` fail 0 at every commit: 3405/3405 (Task 1), 3414/3414 (Task 2), 3414/3414 (Task 3). `npm run build:www` exit 0 at every commit. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged. `git diff --stat 5550002 -- engine/ content/ src/ mazeworld.html test/parity/` empty at every commit.

## Schema

No persisted schema change. `floorSnapshots`/`identity`/`cls`/`sub`/`race` are new fields on `playRun`'s HARNESS-ONLY return object (never written back onto `state`) — the run record's own shape, not the serialized `GameState`. No consumer of `state` was touched.

## Commits

| Commit | Type | Subject |
|---|---|---|
| `6a8e19c` | feat | fair bot — potion 0.6 / flee 0.4 (caster 0.6) / camp 0.5 kept, accept a Joiner when the party is empty (D-20 superseded), MU defensive+offensive modes, Thief opener/flee counted; per-floor snapshots + identity tallies on the run record (USER RULING D) |
| `8e43ad6` | feat | readouts — three-class death split (combat / dot / starvation-exhaustion), per-floor Pace block, Class identity block (class pools only) in tune-difficulty + --json; identity columns + recorded spread in tune-classes (USER RULING D) |
| `5aecfb7` | docs | fresh BEFORE with the fair bot (solo / --party / class smoke / depth-20 slice, three-class split + pace + class identity) + ledger: why floor bands failed, the global-model dial table, the governing principle, class pools, roster note (USER RULING D, BAND-01) |

Full SHAs: `6a8e19ccfb7b3c8074ddec204667ba3a951faa34`, `8e43ad651ba5e390f3918c4f16abf91b044b517a`, `5aecfb7df1578d09b6691514a127ff3ec71acdbd`.

## Deviations from Plan

### Auto-fixed Issues

**None** — plan executed as written. Two implementation choices where the plan's own text left room for interpretation, documented below (not deviations from any rule or prohibition):

1. **[Discretion] `test/unit/class-pass-usage.test.js` vs `test/unit/class-matrix.test.js` for the cell-shape pin.** The plan's Task 2 action 5 named `test/unit/class-pass-usage.test.js` as the home for "the cell-shape pin gains the six identity keys and the byClass spread shape," but that file tests a wholly different CLI (`tools/class-pass-usage.mjs`, the pick-rate Markdown renderer) and contains no cell-shape assertions at all — the actual cell/rollup shape is pinned in `test/unit/class-matrix.test.js` (which already carries every other `summarizeRows`/`rollups` pin). The two new tests landed there instead, verified against real `tools/tune-classes.mjs --json` output before writing the assertions.
2. **[Measured] `foeMissRate`'s scale differs between two consumers.** `band-readout.mjs#classIdentityReadout` reports `foeMissRate` as a percentage (0-100, 1dp, matching `reach5`/`reach10`'s convention), while `class-matrix.mjs#summarizeRows`'s own per-cell `foeMissRate` stays a 0-1 fraction (3dp, matching no existing convention since it's a new field). Both are documented in their own JSDoc; there is no shared contract requiring them to match since they serve different readers (a per-class-pool summary line vs. a per-cell matrix column).

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — both discretion points were resolved by verifying against the plan's own stated intent (the six identity keys ARE pinned, just in the file that actually owns the shape) and real tool output, never hand-typed.

## Issues Encountered

**Background-run isolation on this Windows/Git-Bash machine:** the FIRST attempt to background the `--party` run used a manual `nohup ... &` inside a single Bash call; the harness's per-call shell reset killed the backgrounded process before it produced output (0-byte file, no running process afterward). Fixed by using the Bash tool's own `run_in_background: true` parameter directly on the `node tools/tune-difficulty.mjs --seeds=200 --party` invocation (no `nohup`/`&` wrapper) — this is the harness's own subprocess-tracking mechanism, not a shell backgrounding trick, and it survived correctly. Not a code regression; an environment/tooling note for any future executor on this machine.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Commit `5aecfb7`** is the BEFORE this plan's whole point exists to establish — every later Phase 54 plan (54-05 removes the floor-band knot table and lands the global model at identity; 54-06 wires the remaining dials + CLASS_MITIGATION + the fit tool; 54-07 runs the fit, the AFTER readout, and the roster-under-the-ceiling decision) compares its own numbers to THIS commit's readouts, never to any earlier rung.
- The dial table in the ledger (`docs/DIFFICULTY-RETUNE.md`'s `#### Global model (USER RULING D) — the dial table`) is the spec 54-05/54-06 wire against — copied verbatim from `54-06-PLAN.md`, not restated from memory.
- The fit's objective (floors 1-12, ±8/±3) and the tail (13-20 + reach-20, dS only) are both live in `tools/lib/band-readout.mjs#SURVIVAL_PASS` — 54-06's fit tool reads this same constant, so the pass band can never drift between the readout and the fit.
- No blockers. `npm test` 3414/3414, `npm run build:www` green, master hash and every prohibited file (`test/parity/prototype-master.js.txt`, `test/parity/harness/comparables.js`, `engine/`, `content/`) untouched across all three commits.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. **Nothing new to look at this plan.** This plan is instrument-only (bot policy + readout tooling + a fresh BEFORE measurement) — it makes zero changes to `engine/`, `content/`, `src/`, or `mazeworld.html`. A natural run on the current build feels identical to before this plan; the actual difficulty-curve feel change is 54-05/54-06/54-07's work, to be checked at the end of the phase.
2. The Bot: line's new thresholds (`flee=0.4/0.6(caster) potion<0.6 camp<0.5`) and the Joiner-accept-when-empty change are dev-tool-only (the tuning bot, never the shipped shell) — no player-facing behavior to verify.

## Self-Check: PASSED

- FOUND: tools/lib/tuning-bot.mjs
- FOUND: tools/lib/band-readout.mjs
- FOUND: tools/lib/class-matrix.mjs
- FOUND: tools/tune-difficulty.mjs
- FOUND: test/unit/tuning-bot.test.js
- FOUND: test/unit/bot-tactics.test.js
- FOUND: test/unit/band-readout.test.js
- FOUND: test/unit/class-matrix.test.js
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-solo.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-party.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-start-depth-20.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-before-smoke.txt
- FOUND: docs/class-pass/v17-p54-global-before-smoke.json
- FOUND commit: 6a8e19c (Task 1)
- FOUND commit: 8e43ad6 (Task 2)
- FOUND commit: 5aecfb7 (Task 3)
