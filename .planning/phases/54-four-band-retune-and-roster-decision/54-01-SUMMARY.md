---
phase: 54-four-band-retune-and-roster-decision
plan: 01
subsystem: difficulty-curve
tags: [four-band, identity-pins, bot-readout, parity-guard, ledger]

# Dependency graph
requires:
  - phase: 53-joiner-level-cap
    plan: 01
    provides: "the closed Phase 53 engine (commit 78572c5) — the curve this plan's scaffold is proven byte-identical against"
provides:
  - "tools/lib/band-readout.mjs — FOUR_BANDS, BAND_REACH_FLOORS, bandReadout(results, opts), formatBandReadout(readout); wired into tools/tune-difficulty.mjs's printReport (after printSharedReadout, before Outcome:) and --json (bands key); tools/lib/tuning-bot.mjs untouched"
  - "engine/difficulty.js — WALL_FROM_DEPTH/WALL_TO_DEPTH/WALL_FOE_POWER_AT_START/END, BREAKAWAY_FROM_DEPTH/TO_DEPTH/FOE_POWER_AT_START/END, ENDGAME_CANON_FROM_DEPTH, WALL_HAZARD_SCALE, WALL_/BREAKAWAY_ABILITY_THREAT_AT_START/END (14 constants, all at identity); bandLerp/bandFoePowerFor/bandAbilityThreatFor; difficultyCurve wired for WALL_FROM_DEPTH <= d < COMBAT_SCALE_FROM_DEPTH, byte-identical to the Phase 53 curve at every depth 1..50"
  - ".planning/phases/54-four-band-retune-and-roster-decision/readouts/before-start-depth-20.txt — the BEFORE --start-depth=20 slice, run once on the untouched engine, the diff target for Plan 02's every rung"
  - "test/parity/divergence-records.test.js's BAND-02 guard — EXPECTED = [], 31-site maxDepthEver < WALL_FROM_DEPTH, difficultyCurve(1) byte-identical, the floor-2 exposure check on the movement site"
  - "docs/DIFFICULTY-RETUNE.md's ### v1.7 · Phase 54 H3 — the four bands verbatim, the numeric targets table, the structural bound (USER RULING A), BEFORE by reference + the depth-20 slice + the Phase 53 curve table, the scaffold section naming commit 258e04dc3572714e2c717ebf9aaf3256c5fba154"
affects: [54-02, 54-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bandLerp(a, b, t) — the a === b short-circuit returns a for ANY t (identity by construction, no float drift), else the endpoint-exact (1-t)*a + t*b — the same discipline as the existing >= guard technique (graceFor, COMBAT_SCALE_FROM_DEPTH's over)"
    - "band-readout.mjs is a NEW report file that imports percentile from tuning-bot.mjs (read-only) and adds a print call in tune-difficulty.mjs — zero bytes of the frozen bot policy touched"
    - "measure-before-scaffold: the Phase 53 curve was captured via node -e BEFORE any engine edit, then re-captured after the scaffold landed — the diff of the two JSON captures is the byte-identity proof, never assumed"

key-files:
  created:
    - tools/lib/band-readout.mjs
    - test/unit/band-readout.test.js
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/before-start-depth-20.txt
  modified:
    - tools/tune-difficulty.mjs
    - engine/difficulty.js
    - test/difficulty/difficulty.test.js
    - test/unit/combat-scaling.test.js
    - test/parity/divergence-records.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "hazardScale's ternary keeps the ORIGINAL outer branch (d < HAZARD_FROM_DEPTH || d >= HAZARD_CANON_FROM_DEPTH ? ... : ramp) and nests the new Wall check inside the outer '1' branch, rather than restructuring the whole expression — this is the smallest edit that keeps floor 1 a literal 1 with zero new arithmetic on that path, while still satisfying the plan's 'depths >= ENDGAME_CANON_FROM_DEPTH are the literal 1 by the final branch' requirement"
  - "combat-scaling.test.js's cap-boundaries test widens its foePower/abilityThreat lower bound to Math.min(BASE, the four band AT_START/AT_END constants) rather than leaving it at BASE — depths 6 and 10 (in the plan's own boundary-depth list) now sit inside the Wall/Breakaway band, whose values may (in a later rung) legitimately dip below the Phase 21/27 BASE"
  - "the depth-6-first-divergence test's abilityThreat assertion is now conditional (Object.is 1 only outside WALL_FROM_DEPTH..ENDGAME_CANON_FROM_DEPTH-1, else compared against expectedBandAbilityThreat(d)) since Phase 54 legitimately ends 'abilityThreat is identity for the WHOLE depth < COMBAT_SCALE_FROM_DEPTH range' as a claim — this is a measured correction to the OLD test's assumption, not a loosening: at scaffold values the comparison still resolves to exactly 1 everywhere, so behavior is unchanged"

requirements-completed: [BAND-01, BAND-02]

coverage:
  - id: BAND-01
    description: "The four bands are recorded verbatim in the ledger plus the numeric targets table (median 5-7, p90 10-13, reach>=16 2.0-6.0%, reach>=20 <=0.5%, depth-20 slice byte-identical on every rung); the reach>=16/band-share/per-band-cause instrument exists without touching the frozen bot policy"
    requirement: "BAND-01"
    verification:
      - kind: unit
        ref: "test/unit/band-readout.test.js (8/8 pass); docs/DIFFICULTY-RETUNE.md's #### Target — the four bands, verbatim (BAND-01) and #### Target as numbers (BAND-01) sections (grep-verified below)"
        status: pass
      - kind: other
        ref: "readouts/before-start-depth-20.txt run on the untouched engine (git diff --stat 78572c5 -- engine/ content/ empty at run time)"
        status: pass
    human_judgment: false
  - id: BAND-02
    description: "The band-curve scaffolding (WALL_/BREAKAWAY_/ENDGAME_ constants + bandFoePowerFor/bandAbilityThreatFor + the Wall hazard band) lands at identity values; difficultyCurve is byte-identical to Phase 53's curve at every depth 1..50; new structural pins (floor 1 exact, foePower===1 literal for d>=16, the depth-20 curve object equality, Wall-steps-up, draw-free) are green; the BAND-02 measured-zero parity guard stands"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js (18/18 pass, 7 new Phase 54 tests); test/unit/combat-scaling.test.js (22/22 pass); test/parity/divergence-records.test.js (6/6 pass, BAND-02 guard); test/determinism/foe-abilities.test.js (13/13 pass, zero file edits)"
        status: pass
      - kind: other
        ref: "diff of the two node -e curve captures (1..25,35,50) — empty; 'scaffold identity OK 5..20' printed"
        status: pass
    human_judgment: false

# Metrics
duration: ~2h
completed: 2026-09-21
status: complete
---

# Phase 54 Plan 01: Four-Band Scaffold & Readout Instrument Summary

**Landed the four-band curve SCAFFOLD (14 new identity-valued constants in `engine/difficulty.js`, `bandFoePowerFor`/`bandAbilityThreatFor`/`bandLerp`, a Wall hazard band) proven byte-identical to the Phase 53 curve at every depth 1..50, the `Four-band readout` instrument (`tools/lib/band-readout.mjs`) added to `tools/tune-difficulty.mjs` without touching the frozen bot policy, the BEFORE `--start-depth=20` slice captured on the untouched engine, a BAND-02 measured-zero parity guard, and the Phase 54 ledger H3 opening in `docs/DIFFICULTY-RETUNE.md` recording the four bands verbatim, the numeric targets, and USER RULING A's structural bound.**

## Success criteria → proof

| # | Success criterion | Proof |
|---|---|---|
| SC1 (bands verbatim + numbers) | `docs/DIFFICULTY-RETUNE.md`'s `### v1.7 · Phase 54 — four-band retune & roster decision` H3, sitting between the Phase 53 H3 (line 2767) and the v1.2 H2 (line 3494) | `#### Target — the four bands, verbatim (BAND-01)` (grep -c 1), `#### Target as numbers (BAND-01)` (grep -c 1); verbatim quote confirmed: `grep -c 'Roguelike golden ratio: a standard run ends within the first 25–35% of total depth'` = 1, `grep -c 'The Endgame\*\* — the true test; victory rare and celebrated'` = 1 |
| SC2 (scaffold, identity) | `engine/difficulty.js`'s 14 new constants all at identity; `difficultyCurve` byte-identical to Phase 53's | empty `diff` of the two `node -e` curve captures (below); `node --test test/difficulty/difficulty.test.js test/unit/combat-scaling.test.js` all green with the new Phase 54 pins named below |
| SC5 (no flat-damage nerf; gates green) | no `content/` edit; `npm test`/`build:www` green at every commit | `git diff --stat 78572c5 -- content/` empty; totals below |

## Constants introduced (all at identity)

| Constant | Value (scaffold) | Band |
|---|---|---|
| `WALL_FROM_DEPTH` | 5 | Wall |
| `WALL_TO_DEPTH` | 8 | Wall |
| `WALL_FOE_POWER_AT_START` | 1.0 | Wall |
| `WALL_FOE_POWER_AT_END` | 1.0 | Wall |
| `BREAKAWAY_FROM_DEPTH` | 9 | Breakaway |
| `BREAKAWAY_TO_DEPTH` | 15 | Breakaway |
| `BREAKAWAY_FOE_POWER_AT_START` | 1.0 | Breakaway |
| `BREAKAWAY_FOE_POWER_AT_END` | 1.0 | Breakaway |
| `ENDGAME_CANON_FROM_DEPTH` | 16 | Endgame |
| `WALL_HAZARD_SCALE` | 1.0 | Wall |
| `WALL_ABILITY_THREAT_AT_START` | 1.0 | Wall |
| `WALL_ABILITY_THREAT_AT_END` | 1.0 | Wall |
| `BREAKAWAY_ABILITY_THREAT_AT_START` | 1.0 | Breakaway |
| `BREAKAWAY_ABILITY_THREAT_AT_END` | 1.0 | Breakaway |

Verified via `node -e`:
```
5 8 9 15 16 1 1 1 1 1 1 1 1 1 21 1 0.5 2
```
(`WALL_FROM_DEPTH WALL_TO_DEPTH BREAKAWAY_FROM_DEPTH BREAKAWAY_TO_DEPTH ENDGAME_CANON_FROM_DEPTH WALL_FOE_POWER_AT_START WALL_FOE_POWER_AT_END BREAKAWAY_FOE_POWER_AT_START BREAKAWAY_FOE_POWER_AT_END WALL_HAZARD_SCALE WALL_ABILITY_THREAT_AT_START WALL_ABILITY_THREAT_AT_END BREAKAWAY_ABILITY_THREAT_AT_START BREAKAWAY_ABILITY_THREAT_AT_END COMBAT_SCALE_FROM_DEPTH FOE_GRACE_AT_1 FOE_GRACE_AT_2 HAZARD_FROM_DEPTH` — matches the plan's predicted output exactly.)

## Identity evidence

```
scaffold identity OK 5..20
```

The two `node -e` captures of `difficultyCurve(d)` for d in [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,35,50] — one taken on the untouched engine (commit `78572c5`, before Task 2's edit), one taken on the scaffolded engine (after Task 2) — diff **empty**:

```
diff "$SCRATCH/phase53-curve.json" "$SCRATCH/scaffold-curve.json"
(no output)
```

`node --test test/determinism/foe-abilities.test.js` — 13/13 pass, `git diff --stat 78572c5 -- test/determinism/foe-abilities.test.js` empty (zero edits — the scaffold is identity, so the tier-5 seeds at `state.floor.depth = 5` see no change).

New Phase 54 test names, all green:
- `test/difficulty/difficulty.test.js` (7 new, 18/18 total): `Phase 54 (BAND-02) structural pins: …`, `Phase 54 (BAND-01) floor-1 parity: …`, `Phase 54 (BAND-02) Filter cushion 2..4: …`, `Phase 54 (BAND-01) Endgame identity — the --start-depth 20 yardstick: …`, `Phase 54 (BAND-02) band curve 5..15: …`, `Phase 54 (BAND-02) the Wall steps UP from the floor-4 grace and foePower never steps DOWN across 5..20 …`, `Phase 54 (BAND-02) difficultyCurve stays draw-free: …`
- `test/unit/combat-scaling.test.js` (2 new tests + `PHASE_54_PINS`, 22/22 total): `Phase 54 band pins match engine/difficulty.js — recorded in docs/DIFFICULTY-RETUNE.md's Phase 54 H3`, `band 5..15 (Phase 54, BAND-02): …`, `Endgame identity band (Phase 54, BAND-01): …`, `band wiring (Phase 54, BAND-02): …` (plus the re-scoped `cap boundaries`, `monotone`, `D-19 wiring identity`, `D-18`, `depth-6 first divergence` tests)

## BEFORE depth-20 slice

`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` — run once on the untouched engine (`git diff --stat 78572c5 -- engine/ content/` empty at run time), saved to `.planning/phases/54-four-band-retune-and-roster-decision/readouts/before-start-depth-20.txt`:

```
tune-difficulty: 50 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=20  p50=20  p90=22  max=27

Action-count distribution:
  min=9  p50=104  p90=331  max=690

Death-cause breakdown:
  cut down by a Herman 11 (22.0%)
  ...
```

`Four-band readout` block from the same transcript:

```
Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 20:32  21:7  22:7  23:2  25:1  27:1
  mean death depth=20.78  floors gained p50=0 mean=0.78  encounters survived mean=2.94
  reach: >=5 100.0%  >=8 100.0%  >=9 100.0%  >=10 100.0%  >=13 100.0%  >=16 100.0%  >=20 100.0%
  band share of deaths: Filter 1-4 0.0% | Wall 5-8 0.0% | Breakaway 9-15 0.0% | Endgame 16-20 64.0% | beyond 20 36.0%
  top causes — Filter: (none)
  top causes — Wall: (none)
  top causes — Breakaway: (none)
  top causes — Endgame: cut down by a Herman 8, cut down by a Stalka Beast 8, cut down by a Djinni 4, cut down by a Drarl 4, cut down by a Vampire 4
```

This is the yardstick Plan 02 diffs every rung's own `--start-depth=20` slice against — it must stay byte-identical (16+ is identity by construction, unaffected by any 5-15 dial move).

## Guard

`test/parity/divergence-records.test.js`'s **`BAND-02: the holders declaring Phase 54 are exactly the measured moved set — zero; no replay site ever reaches WALL_FROM_DEPTH (floor 5) and difficultyCurve(1..4) is byte-identical to the Phase 53 curve`** test:
- Part (a): declared Phase-54 divergence holders `=== []` (measured, not assumed).
- Part (b): all 31 replay sites (14 chargen seeds + 1 movement script + 6 combat scenarios + 4 magic scenarios + 1 economy script + 5 encounters scenarios) assert `maxDepthEver < WALL_FROM_DEPTH` — `totalSites === 31`.
- Part (c): `difficultyCurve(1)` `deepStrictEqual` to the pasted Phase 53 literal (floor 1 ONLY — floors 2-4 are Filter-rung territory under USER RULING A, measured not pinned here).
- Part (d): the one site that descends (movement, seed 256) emits no `combatStarted`/`struckByFoe`/`trapSprung`/`fellClimbing`/`fellInGorge` event while `state.floor.depth >= 2`.

## Gates

```
npm test 2>&1 | tail -8
  1..3396
  # tests 3401
  # suites 0
  # pass 3401
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
```

```
npm run build:www
  ... [build-www] done
  exit 0
```

```
git hash-object test/parity/prototype-master.js.txt
  a1f4d0dc29782218d8e5aab65bc5989c33f917f0
```

```
git diff --stat 78572c5 -- test/parity/harness/comparables.js tools/lib/tuning-bot.mjs test/parity/fixtures/
  (empty)
```

```
git diff --stat 78572c5 -- content/
  (empty)
```

`npm run boot:check` is environment-blocked on this machine (pre-existing finding, `.planning/STATE.md`'s open Blockers/Concerns) and was NOT run as a gate.

## Schema

No persisted schema change: `difficultyCurve` is a pure lookup on `depth` — its returned object's key set (`depth, breather, dots, darkBlobs, darkRadius, foeCap, foeBonus, foeLvlBias, foePower, hazardScale, abilityThreat, waterPools`) is unchanged, pinned by the `deepStrictEqual` literal pins across all three plan-committed test files. No consumer (`engine/combat.js`, `engine/foeAbilities.js`, `engine/movement.js`, `engine/encounters.js`, `engine/maze.js`) was edited. No migration task.

## Commits

| Commit | Type | Subject |
|---|---|---|
| `c1a0a87` | feat | four-band readout block in tune-difficulty (tools/lib/band-readout.mjs) + BEFORE --start-depth=20 slice on the untouched engine (BAND-01) |
| `258e04d` | feat | four-band curve scaffolding at identity — WALL_/BREAKAWAY_/ENDGAME_ constants, bandFoePowerFor/bandAbilityThreatFor, Wall hazard band; Phase 53 curve pinned 1..4 / 16..50, band 5..15 pins, BAND-02 measured-zero guard (BAND-02) — **the ladder's base; Plan 02's rungs branch from here** |
| `240819c` | docs | Phase 54 ledger H3 — the four bands verbatim + numeric targets, the structural bound, BEFORE by reference + the depth-20 slice + the Phase 53 curve table, the scaffold section (BAND-01) |

Full SHAs: `c1a0a87c7d72938a081eada0bbe586d652af17db`, `258e04dc3572714e2c717ebf9aaf3256c5fba154`, `240819c` (docs commit, full sha to be confirmed at the metadata commit below).

## Deviations from Plan

### Auto-fixed Issues

**None** — plan executed exactly as written. Three implementation choices were made where the plan left explicit discretion or a measured value diverged slightly from the plan's own worked example, documented below (not deviations from any rule or prohibition):

1. **[Discretion] hazardScale ternary shape** — kept the original outer branch (`d < HAZARD_FROM_DEPTH || d >= HAZARD_CANON_FROM_DEPTH ? ... : ramp`) and nested the new Wall check inside the `1` branch, rather than writing three parallel top-level branches. Verified structurally identical to the plan's stated invariant ("depths >= ENDGAME_CANON_FROM_DEPTH are the literal 1 by the final branch, never by arithmetic") — floor 1 (d=1) hits the inner `d >= HAZARD_CANON_FROM_DEPTH && d <= WALL_TO_DEPTH` check, which is false, falling through to the literal `1` with zero arithmetic, exactly as before.
2. **[Measured] cap-boundaries / monotone / depth-6-divergence test re-scoping** — the plan's own read_first called these "TO PARAMETRISE" / "TO RE-SCOPE" without dictating the exact new bound formula; the landed form (`Math.min(BASE, the four band AT_START/AT_END constants)` for the floor, and a conditional `Object.is(…, 1)` vs. `expectedBandAbilityThreat(d)` comparison split at `WALL_FROM_DEPTH`/`ENDGAME_CANON_FROM_DEPTH`) was derived directly from the plan's own band-formula description and verified against the actual scaffold values before committing.
3. **[Environment] `node --test` directory-path argument** — `node --test test/difficulty/` (a bare directory with trailing slash, exactly as the plan's own `<verify>` block writes it) fails with `MODULE_NOT_FOUND` on this Windows/Git-Bash machine, reproducing identically with **zero content changes** (confirmed by running it standalone before any edit landed). This is a pre-existing environment quirk, not a code regression — every verification in this SUMMARY instead targets the explicit file path (`test/difficulty/difficulty.test.js`), and the actual `npm test` gate (which globs files, not directories) is unaffected and green throughout.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — plan executed exactly as written; one environment quirk (directory-arg to `node --test`) is noted for the orchestrator's awareness, unrelated to any code change in this plan.

## Issues Encountered

None, aside from the environment quirk noted above (pre-existing, not caused by this plan).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Commit `258e04dc3572714e2c717ebf9aaf3256c5fba154`** is the ladder's base — Plan 02's rungs branch from here, moving ONLY the 14 Phase 54 constants (and, per USER RULING A, `FOE_GRACE_AT_2` / `HAZARD_SCALE_AT_START` as Filter rungs).
- `.planning/phases/54-four-band-retune-and-roster-decision/readouts/before-start-depth-20.txt` is on disk — Plan 02 diffs every rung's own `--start-depth=20` slice against it (must stay byte-identical).
- `tools/tune-difficulty.mjs`'s `Four-band readout` block gives Plan 02 the reach ≥16/≥20 and band-share numbers BAND-01 needs, with zero bot-policy changes.
- No blockers. `npm test` 3401/3401, `npm run build:www` green, master hash and every prohibited file (`comparables.js`, `tuning-bot.mjs`, `content/`) untouched.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. A natural run on the post-retune debug APK feels like it dies at floors 5–7, not 3–4 (the scaffold itself changes nothing — this is the phase-level check the ladder (Plan 02) must earn, not this plan).
2. Start-at-depth 20 from Settings feels unchanged from the v1.5/v1.6 rounds (the depth-20 yardstick this plan proved byte-identical).
3. The Oracle/rail copy for traps, wall-falls and foe hits reads exactly as before (no shell change this phase).

## Self-Check: PASSED

- FOUND: tools/lib/band-readout.mjs
- FOUND: test/unit/band-readout.test.js
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/before-start-depth-20.txt
- FOUND: engine/difficulty.js
- FOUND: test/difficulty/difficulty.test.js
- FOUND: test/unit/combat-scaling.test.js
- FOUND: test/parity/divergence-records.test.js
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/54-01-SUMMARY.md
- FOUND commit: c1a0a87 (Task 1)
- FOUND commit: 258e04d (Task 2)
- FOUND commit: 240819c (Task 3, ledger)
