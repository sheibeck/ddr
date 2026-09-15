---
phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
plan: 04
subsystem: engine
tags: [engine, magic, freeze, killFoe, parity, fixture-divergence, fid-06, ledger, sanity-readout]

# Dependency graph
requires:
  - phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
    provides: "Plan 01: spellLevelFor/ATTACK_SPELL_KINDS/castableAttackSpells (engine/derived.js); Plan 02: rollGrimoire's guaranteed day-one attack spell + chargenDivergenceFor/stripDeclaredFields precedent; Plan 03: playerStrike's Wizard rule, Summon/Phantom Host at level 1"
provides:
  - "engine/magic.js — a successful Freeze routes its kill through combat.js#killFoe (sp/coin/treasure/kills/party-split) after emitting frozenSolid, instead of only flagging the foe dead; a kill-twice foe is revived by killFoe's lives rule (not frozen while standing); castSpell's spellAboveLevel diagnostic now reads the effective level via derived.js#spellLevelFor, matching canCast"
  - "test/unit/freeze-pays-out.test.js — hit/miss/kill-twice/party-split/non-Freeze-thrown/spellAboveLevel coverage (9 tests)"
  - "test/parity/fixtures/action-script.magic.json — a per-scenario `divergence` record on cast-damage (the ONE parity scenario that casts Freeze), measured before/after + rationale"
  - "test/parity/harness/comparables.js — stripScenarioDivergence(state, divergence), the scenario-scoped analog of stripParleyDivergence/chargenDivergenceFor"
  - "test/parity/magic-parity.test.js, test/parity/full-suite.test.js — scenario-scoped strip + machine-checked before/after assertions; the cast-damage event assertion now requires BOTH frozenSolid and foeKilled"
  - "test/parity/FIXTURE-INVENTORY.md — 'Phase 23 caster divergences' section recording the phase's complete FID-06 ledger (chargen seeds 15/24 from Plan 02 + this scenario)"
  - "docs/CLASS-PASS.md — 'Phase 23 note' smoke readout under Outliers / Findings, answering the IDENT-01 finding carried forward from Phase 22"
affects: [24-every-subclass-and-race-one-good-one-bad, 26-mass-playtest-and-class-pass-ledger]

tech-stack:
  added: []
  patterns:
    - "stripScenarioDivergence(state, divergence) — a per-SCENARIO fixture divergence strip (fixture.scenarios[].divergence), companion to Plan 02's per-SEED chargenDivergenceFor/stripDeclaredFields; both reuse the same stripDeclaredFields primitive, applied at BOTH of a domain's independent replay sites, selected only when the fixture record is present"
    - "A scenario's own before/after values are asserted on BOTH the prototype and engine sides BEFORE the field is stripped, so the divergence record is machine-checked, never a silent carve-out"

key-files:
  created:
    - test/unit/freeze-pays-out.test.js
  modified:
    - engine/magic.js
    - test/parity/fixtures/action-script.magic.json
    - test/parity/harness/comparables.js
    - test/parity/magic-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/CLASS-PASS.md

key-decisions:
  - "Freeze's new branch sets t.frozen=true and pushes frozenSolid BEFORE calling killFoe (not after), so the narration always precedes the payout event, even on the kill-twice revive path where killFoe returns without a foeKilled event at all."
  - "A kill-twice (lives>1) foe revived by killFoe from a Freeze hit has its frozen flag explicitly cleared (`if (t.alive) t.frozen = false`) — a standing foe is never narrated as frozen, matching the plan's canon note (\"you have to kill it twice\")."
  - "spellAboveLevel's condition and its `need` field both route through the SAME spellLevelFor(c.sub, sp) call (not cached in a local variable) — mirrors canCast's own two-call pattern in the plan's read_first notes and keeps the diagnostic and the gate structurally identical for every (sub, spell) pair."
  - "stripScenarioDivergence lives directly above chargenDivergenceFor in comparables.js (the FID-06 helper neighborhood) and is a pure passthrough to stripDeclaredFields — it carries no Freeze-specific knowledge, so a future scenario-scoped divergence in ANY fixture can reuse it verbatim."
  - "The magic-parity.test.js well-formedness test (\"magic fixture divergence records are narrow and well-formed\") mirrors chargen-parity.test.js's identical test verbatim in structure (at-most-N records, non-empty fields, real before!=after per field) rather than inventing a new shape."

requirements-completed: [IDENT-01, IDENT-02, IDENT-03, IDENT-04, FID-06]

coverage:
  - id: D1
    description: "A successful Freeze kill awards sp/coin/treasure roll/kill count/party split via killFoe exactly like a melee kill; frozenSolid still narrates it; a kill-twice foe is revived by killFoe's lives rule instead of dying, and is not left flagged frozen"
    requirement: "FID-06"
    verification:
      - kind: unit
        ref: "test/unit/freeze-pays-out.test.js — 'a Freeze kill pays sp/coin/kill count...', 'frozenSolid narrates before the kill is awarded', 'a lives-2 (kill-twice) foe is revived...', 'sp payout still splits across live party members'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A missed Freeze and a non-Freeze thrown spell are unaffected by the change (no frozenSolid/foeKilled on a miss; the plain t.wp<=0 kill path is unchanged for every other thrown spell)"
    verification:
      - kind: unit
        ref: "test/unit/freeze-pays-out.test.js — 'a missed Freeze throw pays nothing...', 'a non-Freeze thrown spell still kills via the plain t.wp<=0 path...'"
        status: pass
    human_judgment: false
  - id: D3
    description: "spellAboveLevel's need/condition reads the effective level via spellLevelFor, matching canCast — a Wizard is refused Phantom Host (need 3) while an Illusionist casts it at level 1 with no refusal"
    requirement: "IDENT-03"
    verification:
      - kind: unit
        ref: "test/unit/freeze-pays-out.test.js — 'spellAboveLevel names the effective level via spellLevelFor...', 'an Illusionist's level-1 Phantom Host is castable...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ONE parity-exposed Freeze cast (magic fixture's cast-damage scenario, seed 8) is declared with a measured before/after divergence record, machine-checked on both sides, and stripped only for that scenario; every other magic scenario and every other fixture stays byte-identical"
    requirement: "FID-06"
    verification:
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" (32/32, including 'magic fixture divergence records are narrow and well-formed') + git diff --stat against prototype-master.js.txt/combat/movement/economy/encounters fixtures (0 lines)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phase's complete FID-06 ledger (chargen seeds 15/24 + this magic scenario) is documented in FIXTURE-INVENTORY.md with measured before/after tables and draw accounting"
    verification:
      - kind: other
        ref: "test/parity/FIXTURE-INVENTORY.md 'Phase 23 caster divergences' section; roster block re-verified unchanged via node tools/fixture-inventory.mjs"
        status: pass
    human_judgment: false
  - id: D6
    description: "A smoke readout (3 tune-classes runs) is recorded in docs/CLASS-PASS.md as a directional signal only, answering the IDENT-01 finding carried forward from Phase 22, without writing the AFTER (Phase 26) or Rulings (Phase 24) sections"
    verification:
      - kind: other
        ref: "docs/CLASS-PASS.md 'Phase 23 note' paragraph; grep checks confirm Rulings/AFTER sections untouched and the note is purely additive"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-14
status: complete
---

# Phase 23 Plan 04: Freeze Pays Out + FID-06 Magic Divergence + Sanity Readout Summary

**A successful Freeze now routes its kill through `killFoe` (experience, coin, treasure, kill count, party split) instead of paying nothing, `spellAboveLevel` reads the effective level via `spellLevelFor`, the ONE parity scenario this changes is declared and machine-checked under FID-06, and a 120-run smoke readout closes the class-pass ledger's Phase 22 IDENT-01 finding as a directional (not final) signal.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-14T22:28:44Z (per STATE.md, end of Plan 03)
- **Completed:** 2026-09-14T22:48:12Z
- **Tasks:** 3
- **Files modified:** 7 modified, 1 created

## Accomplishments

- `engine/magic.js`'s thrown branch: a hit Freeze now sets `t.frozen = true`, pushes `frozenSolid`, then calls `killFoe(state, t, rng, events)` — dropping the old hand-rolled `t.alive = false` / `t.wp = 0` (killFoe owns both). A kill-twice (`lives > 1`) foe is revived by killFoe's own lives rule instead of dying to Freeze (canon, "you have to kill it twice" — the prototype let Freeze bypass this); when revived, `t.frozen` is explicitly cleared since a standing foe is not frozen. A `DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, user decision)` comment documents the prototype's old behavior, the new one, the determinism guarantee (extra draws only after a successful hit), and the kill-twice note.
- `castSpell`'s `spellAboveLevel` refusal now checks `spellLevelFor(c.sub, sp) > c.level` and reports `need: spellLevelFor(c.sub, sp)` — the SAME helper `canCast` already consults, so the diagnostic can never disagree with the gate for an override cell (Summoner/Summon, Illusionist/Phantom Host).
- `test/unit/freeze-pays-out.test.js` (9 tests): a Freeze hit pays sp/coin/kill-count exactly like a melee kill; `frozenSolid` precedes `foeKilled`; a miss pays nothing; a kill-twice foe is revived (not killed) and left unfrozen; the sp payout still splits across a live party member via the shared `killFoe` routine; a non-Freeze thrown spell (Fireball) is unaffected; `spellAboveLevel` reports `need: 3` for a Wizard casting Phantom Host while an Illusionist casts the same spell with no refusal at all.
- FID-06: measured the ONE parity-exposed Freeze cast (`action-script.magic.json`'s `cast-damage` scenario, seed 8) live against both the frozen prototype and the patched engine, declared it via a per-scenario `divergence` record (`phase`, `requirements`, `fields`, `before`, `after`, `rationale`), added `stripScenarioDivergence` (comparables.js) as the scenario-scoped analog of Plan 02's `chargenDivergenceFor`/`stripDeclaredFields`, and wired it into both magic replay sites (`magic-parity.test.js`, `full-suite.test.js`) with before/after assertions on both sides plus a new "divergence records are narrow and well-formed" guard test. The cast-damage event assertion is now strict: it requires BOTH `frozenSolid` and `foeKilled` (previously "one way or another").
- `test/parity/FIXTURE-INVENTORY.md` gained a "Phase 23 caster divergences (IDENT-01..04 / FID-06)" section transcribing Plan 02's chargen seeds 15/24 tables and this plan's magic cast-damage before/after + draw accounting, plus a "byte-identical elsewhere" paragraph; the generated roster block was re-verified unchanged (`node tools/fixture-inventory.mjs`).
- `docs/CLASS-PASS.md` gained one additive "Phase 23 note" paragraph under Outliers / Findings, closing the loop on the IDENT-01 finding Phase 22 carried forward, with the three smoke means quoted against BEFORE and an explicit "this is a smoke signal, not the AFTER matrix" caveat.
- `npm test` 1036/1036 (1027 baseline + 9 new tests); `node --test "test/parity/**/*.test.js"` 32/32 (31 + this plan's magic well-formedness test).

## Task Commits

1. **Tasks 1-2: Freeze pays out via killFoe + FID-06 magic cast-damage divergence record + inventory ledger** - `0056625` (feat) — committed together per the plan's explicit instruction (parity was red between Task 1 and Task 2 by design, since the fixture's `cast-damage` scenario diverges the instant `killFoe` is wired in).
2. **Task 3: sanity readout + class-pass ledger note** - `cba0dad` (docs)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/magic.js` - Freeze routes through `killFoe` after `frozenSolid`; `spellAboveLevel` reads `spellLevelFor(c.sub, sp)`
- `test/unit/freeze-pays-out.test.js` - 9 tests covering hit/miss/kill-twice/party-split/non-Freeze/spellAboveLevel
- `test/parity/fixtures/action-script.magic.json` - `cast-damage` scenario gains a `divergence` record; the other three scenarios and `_note`/`spellIndex` are byte-identical except one appended sentence in `_note`
- `test/parity/harness/comparables.js` - `stripScenarioDivergence(state, divergence)`
- `test/parity/magic-parity.test.js` - scenario-scoped `cmp` selection, before/after assertions, tightened cast-damage event check, new well-formedness test
- `test/parity/full-suite.test.js` - same `cmp` selection + before/after assertions in the magic sub-test
- `test/parity/FIXTURE-INVENTORY.md` - "Phase 23 caster divergences" section
- `docs/CLASS-PASS.md` - "Phase 23 note" under Outliers / Findings

## Measured Evidence (quoted per the plan's `<output>` requirement)

**Cast-damage before/after (all fields, measured live against both the frozen prototype and the patched engine):**

| Field | BEFORE (frozen prototype) | AFTER (Phase 23 engine) |
|---|---|---|
| `c.sp` | 0 | 5 |
| `c.gold` | 50 | 51 |
| `c.kills` | 0 | 1 |
| `c.rations` | 4 | 5 |
| `c.items.length` | 0 | 0 (unchanged) |
| `c.wp` | 31 | 31 (unchanged) |
| `c.level` | 1 | 1 (unchanged) |
| `combat` | `null` after the action | `null` after the action (unchanged on both sides) |

**Engine event list (Phase 23 engine, cast-damage scenario):**
`spellThrown, spellHit, frozenSolid, foeKilled, goldGained, cooked, encounterCleared, combatEnded`

(the pre-Phase-23 engine's list for the same seed/action was `spellThrown, spellHit, frozenSolid, encounterCleared, combatEnded` — no payout events)

**Three smoke means vs BEFORE** (120 runs each: 6 races × 20 seeds, `tools/tune-classes.mjs --sub <Sub> --seeds 20`):

| Sub | BEFORE mean depth (143×40 matrix) | Phase 23 smoke (6 races × 20 seeds) | Stuck |
|---|---|---|---|
| Wizard | 2.48 | 2.44 | 0 of 120 |
| Summoner | 2.18 | 2.78 | 0 of 120 |
| Illusionist | 2.20 | 2.42 | 0 of 120 |

Explicitly a directional smoke signal (different sample size/flags than the pinned BEFORE `Bot:` line) — Summoner and Illusionist both moved up meaningfully; Wizard is flat within noise (plausible, since IDENT-01's actual failure case — "charges left, nothing castable" — is a subset of all Wizard runs, not the whole population this aggregate mean measures). The rigorous, paired AFTER matrix is Phase 26 (PLAY-02).

**Test counts:** `npm test` 1036/1036; `node --test "test/parity/**/*.test.js"` 32/32.

## Draft Rulings entry (for Phase 24): Freeze pays out

*(Phase 24 owns `docs/CLASS-PASS.md`'s Rulings section — this entry is drafted here for that phase to paste, per the plan's `<specifics>`.)*

**Ruling: Freeze pays out (landed Phase 23, commit `0056625`).** The prototype's Freeze spell marked its target dead and frozen without ever calling `killFoe` — a Freeze kill awarded zero experience, coin, treasure roll, kill count, or party split, even though every other lethal action in the game (a melee strike, any other thrown spell, Insanity's roll-1 kill, the death spell) pays through the same routine. This was ruled a bug in the port, not an intentional rule, because Freeze is the level-1 thrown spell most casters' guaranteed day-one attack spell (Plan 02, IDENT-02) resolves to — without this fix, a caster's "guaranteed way to win a fight" would have been a guaranteed way to win a fight for free XP. The fix: Freeze still narrates with `frozenSolid` (and the target still ends up `alive: false, frozen: true, wp: 0`), but the kill now routes through `killFoe` exactly like a melee kill — same sp formula (`killSpFor`), same coin roll, same treasure check, same kill count increment, same party-XP split. One canon consequence: a kill-twice (`lives: 2`) creature (e.g., Philly, Skeleton) now correctly shrugs off a single Freeze and stands back up at full wp, per the rulebook's "you have to kill it twice" — the prototype let Freeze bypass the lives rule entirely, one-shotting even a kill-twice creature. Experience-curve implication for casters: any run whose day-one attack spell happens to be Freeze now earns XP at the same rate a melee-focused sub does, closing a gap that (before this phase) made a Freeze-armed caster's early levels slower than a Fighter's for the identical number of kills.

## Petrify/Turn/Gate note (v1.3 spell-audit candidate, NOT changed here)

Per the plan's explicit scope: `petrify` (sets `alive=false`/`frozen=true`/`wp=0`, no `killFoe`), `turn` (Walking Dead only; sets `alive=false`/`turned=true`/`wp=0`), and `gate` (Walking Dead/Demons only; same shape) all bypass `killFoe` in exactly the same way Freeze used to — the user asked for Freeze only, so these three are deliberately left as-is. They are flagged here as a v1.3 spell-audit candidate (deferred item in `23-CONTEXT.md`'s "Broader spell audit" line): whether Petrify/Turn/Gate's no-payout behavior is intentional (they disable rather than "kill" in the fiction) or an oversight of the same shape as Freeze's is a design question for that future audit, not this plan.

## Decisions Made

- `t.frozen = true` and the `frozenSolid` push happen BEFORE `killFoe` is called (not after), so narration always precedes payout — including on the kill-twice revive path, where `killFoe` returns via its `lives > 1` branch with no `foeKilled` event at all.
- A revived (kill-twice) foe has `t.frozen` explicitly reset to `false` — a standing foe is never left narrated as frozen.
- `spellAboveLevel`'s condition and `need` field both call `spellLevelFor(c.sub, sp)` directly (not a cached local) — mirrors `canCast`'s existing two-call shape and keeps grep-verifiable acceptance criteria trivial (`grep -c "spellLevelFor(c.sub, sp)"` == 2).
- `stripScenarioDivergence` is a pure, Freeze-agnostic passthrough to `stripDeclaredFields` — placed directly above `chargenDivergenceFor` in `comparables.js` as the "FID-06 divergence helpers" neighborhood, so a future scenario-scoped divergence in any other fixture can reuse it without new code.
- The magic-parity well-formedness test is a structural copy of `chargen-parity.test.js`'s identical test (same four checks: record count ceiling, non-empty fields, presence of before/after/rationale, real difference per field) rather than a bespoke shape, keeping the two FID-06 guard tests recognizably the same pattern.

## Deviations from Plan

None - plan executed exactly as written. The measured cast-damage divergence (`sp 0→5, gold 50→51, kills 0→1, rations 4→5`) matched the planner's predicted values exactly, so no `items`/`wp`/`level` fields needed to be added to the declared `fields` array. The three smoke means (2.44/2.78/2.42) were quoted as measured, with no dial changed and no bot-policy edit.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 23 ("Casters Can Act") is complete: all four plans (spell-level overrides/attack-kind helpers, the guaranteed day-one attack spell, the Wizard melee rule + Summon/Phantom Host at level 1, and Freeze paying out) are landed, tested, and committed. `npm test` 1036/1036, parity 32/32, no undeclared carve-outs anywhere in the phase.
- Phase 24 ("Every Sub-class and Race: One Good, One Bad") can paste this plan's drafted Rulings entry directly into `docs/CLASS-PASS.md`'s Rulings section, and should treat Petrify/Turn/Gate's no-payout shape as a candidate line item for its own spell-audit scope (or explicitly defer it further to v1.3, per this plan's note).
- Phase 26 ("Mass Playtest & Class-Pass Ledger") owns the paired, rigorous AFTER matrix (same 143 cells/40 seeds/flags as BEFORE) — this plan's 120-run smoke is explicitly NOT that matrix and should not be cited as the AFTER reading.
- No blockers.

---
*Phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files confirmed present; both task commits (`0056625`, `cba0dad`) confirmed in git log.
