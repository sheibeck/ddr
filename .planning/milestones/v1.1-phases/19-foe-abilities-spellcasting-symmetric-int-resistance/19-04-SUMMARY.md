---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
plan: 04
subsystem: test-infrastructure
tags: [tests, determinism, draw-count, counting-rng, chip-label, ui-copy, phase-gate, node-test]

requires:
  - phase: 19-01
    provides: FOE_ABILITIES registry, bestiary abilities kits, sp.fleesBelow
  - phase: 19-02
    provides: resistRoll, conditionsOf foeEffect chip, parity comparables strippers
  - phase: 19-03
    provides: engine/foeAbilities.js resolver, combat.js ability-gate wiring, 11 event types
provides:
  - "test/determinism/foe-abilities.test.js: D-15 determinism suite proving Humans-t2/Magical-t4/Demons-t5/Walking-Dead-t5/Beasts-t5 caster fights are replay-identical, draw-pinned, and JSON-lossless mid-fight"
  - "test/unit/foe-turn-draw-count.test.js Section 4: abilities:[] identity, nothing-ready zero-extra-draw, D-04 gated-draw-per-kind table, FULL_FIGHTS restated as a CI-maintained invariant"
  - "test/unit/foe-damage.test.js: Phase 18 zero-foe-wp-decrement invariant extended to engine/foeAbilities.js"
  - "mazeworld.html: FOE_EFFECT_LABEL + CONDITION_COPY.foeEffect + paintConditions branch (Weakened/Dazed chip labels), plus test/unit/foe-effect-chip.test.js closing RESEARCH Pitfall 6"
  - "Phase 19 gate: npm test 882/882, parity 30/30 byte-identical, frozen files unchanged, build:www builds"
affects: []

tech-stack:
  added: []
  patterns:
    - "self-deriving seed pin: a determinism test that re-scans for the first matching seed on every run, rather than trusting a hand-written literal, so a roster/kit/chargen drift fails at the derivation test first"
    - "source-assertion test for non-module UI copy (mazeworld.html has no ESM surface): fs.readFileSync + regex/string-index checks, mirroring test/unit/foe-damage.test.js's invariant pattern"

key-files:
  created:
    - test/determinism/foe-abilities.test.js
    - test/unit/foe-effect-chip.test.js
  modified:
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/foe-damage.test.js
    - mazeworld.html

key-decisions:
  - "All five D-15 pinned seeds measured to the SAME value (seed 1) — each spec's tier/type combination rolls its wanted caster on the very first seed scanned; test 1 (firstCasterSeed) re-derives this from scratch every run, so a future roster/kit change that removes the caster from seed 1 fails loudly at that test rather than silently desyncing a later pin"
  - "VISITS stayed at 12 (never raised to 24): the first 12-visit per-visit log for every one of the five specs already produced a foeCast, and the union of kinds across all five logs already covered bolt/drain/debuff/summon — the D-15 'raise VISITS' escape hatch was not needed"
  - "heal never fired in any of the five per-visit logs (no pinned foe starts below maxWP) — this is expected, not a gap; the beasts-t5 FULL FIGHT happened to show the Stalka Beast healing itself mid-fight after taking damage, and 19-03's own unit tests (test/unit/foe-abilities.test.js) already exercise heal directly via a below-maxWP fixture"
  - "foeFled (lowHp, the Djinni <25% HP flee) did not fire within any of the five pinned encounters' full fights or 12-visit logs — not required by this plan's must_haves and not claimed as covered here; 19-03's own tests already cover the fleesBelow branch directly"
  - "mid-fight FID-04 snapshot source was 'mid-fight' (captured after a real foeCast) for all five specs, not the after-startCombat fallback — every spec's caster cast within the fight's own attack loop before the fight resolved"

patterns-established:
  - "Section 4 of the FID-02 draw-count file is now the append-only home for every future ability-kind draw-cost pin (D-04 gated-draw table), keeping Sections 1-3 byte-identical forever"

requirements-completed: [FOE-01, FOE-06, FOE-08, FOE-09, FID-04]

coverage:
  - id: D-15-seed-derivation
    description: "Each of the five pinned seeds is the FIRST seed in 1..300 whose forced-tier roster contains the wanted caster with a non-empty abilities kit, re-derived by the suite itself on every run"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js#FOE-09 / D-15: each pinned seed is the FIRST seed in 1..300 that rolls its caster with a kit"
        status: pass
    human_judgment: false
  - id: D-15-full-fight
    description: "Each of the five encounters (Humans-t2/Magical-t4/Demons-t5/Walking-Dead-t5/Beasts-t5) plays out replay-identically at its pinned seed with pinned total draws, attack count, and outcome"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js#FOE-09 / D-15 {key}: a full fight ... is replay-identical and pins ... draws / ... attacks"
        status: pass
    human_judgment: false
  - id: D-15-per-visit
    description: "12 direct foeTurn visits per encounter against an unkillable hero produce pinned, replay-identical per-visit draw arrays; the Drudge never melees; a Walking Dead summon that queues also joins"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js#FOE-09 / D-15 {key}: 12 foeTurn visits pin per-visit draws ... and are replay-identical"
        status: pass
    human_judgment: false
  - id: D-15-coverage
    description: "Across the five per-visit logs, bolt/drain/debuff/summon all fire at least once (no vacuous pass)"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js#FOE-09 / D-15 coverage: ... every resistible or queued kind fires"
        status: pass
    human_judgment: false
  - id: FID-04-json-roundtrip
    description: "A mid-fight state.combat snapshot carrying f.abilities/f.cd/f.uses and a live C.pendingFoes is JSON-lossless for every pinned encounter"
    requirement: "FID-04"
    verification:
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js#FID-04 / D-14: the mid-fight combat snapshot ... is JSON-lossless"
        status: pass
    human_judgment: false
  - id: FOE-01-identity
    description: "abilities: [] on every foe reproduces the six Section-1 micro pins (0/1/2/2/3/6) with identical event types — an empty kit is draw-identical to no kit"
    requirement: "FOE-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js#Phase 19 / FOE-01 identity: abilities: [] reproduces the six Section-1 micro pins"
        status: pass
    human_judgment: false
  - id: FOE-06-nothing-ready
    description: "A caster with an exhausted uses cap or a still-cooling every-N ability draws only its melee to-hit (1), never the d6; never_melee with nothing ready draws 0"
    requirement: "FOE-06"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js#Phase 19 / RESEARCH Pitfall 3"
        status: pass
    human_judgment: false
  - id: FOE-06-gated-draws
    description: "The exact rng cost of each ability kind (bolt/drain/debuff/heal/summon/never_melee/resist/armour-soak) is pinned via countingRng on a fixed hero"
    requirement: "FOE-06"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js#Phase 19 / D-04 gated draws (10 rows)"
        status: pass
    human_judgment: false
  - id: FOE-01-full-fights-restated
    description: "The five pre-Phase-19 FULL_FIGHTS totals (12/101/111/66/32) are unchanged and exactly 8 bestiary rows carry an abilities kit; the four fixture-roster creatures (Bat/Rat, Shriek, Viper, Dante) carry none"
    requirement: "FOE-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js#FID-02 restated post-Phase-19"
        status: pass
    human_judgment: false
  - id: seam-invariant-extended
    description: "engine/foeAbilities.js is added to the Phase 18 zero-foe-side-wp-decrement invariant scan alongside combat.js/magic.js/items.js"
    requirement: "FOE-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-damage.test.js#invariant: engine/combat.js, engine/magic.js, engine/items.js and engine/foeAbilities.js contain zero foe-side wp decrements"
        status: pass
    human_judgment: false
  - id: FOE-08-chip-labels
    description: "mazeworld.html renders a live foeEffect debuff as 'Weakened N rds' / 'Dazed N rds' via FOE_EFFECT_LABEL, with a 'Hexed' fallback for an unmapped kind, and never leaks the raw engine key"
    requirement: "FOE-08"
    verification:
      - kind: unit
        ref: "test/unit/foe-effect-chip.test.js (4 tests: label-map cross-check, branch-order/CONDITION_COPY row, conditionsOf-to-label end-to-end, fallback)"
        status: pass
      - kind: manual
        ref: "On the phone, a Weakened or Dazed chip appears in the condition row during a caster fight with its rounds counting down, and is gone once the fight ends"
        status: pending
    human_judgment: true
  - id: phase-gate
    description: "Full npm test 0 failures above the 683 pre-phase baseline, parity 30/30 byte-identical, frozen fixtures/master/manifests unchanged since d5fc90a, build:www succeeds and www/index.html carries FOE_EFFECT_LABEL"
    requirement: "FOE-09"
    verification:
      - kind: unit
        ref: "npm test (882/882 pass, 0 fail); node --test \"test/parity/**/*.test.js\" (30/30 pass); npm run build:www"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-14
status: complete
---

# Phase 19 Plan 4: Determinism Suite, Draw-Count Section 4, Chip Labels & Phase Gate Summary

**Closes Phase 19 with the D-15 determinism proof for the five caster encounters parity never exercises (all five self-derive to pinned seed 1), a CI-maintained draw-cost invariant for every ability kind (Section 4 of the FID-02 file), the D-21 "Weakened"/"Dazed" chip labels in `mazeworld.html`, and a green phase gate — `npm test` 882/882, parity 30/30, zero frozen-file drift.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 5 (2 new: `test/determinism/foe-abilities.test.js`, `test/unit/foe-effect-chip.test.js`; 3 modified: `test/unit/foe-turn-draw-count.test.js`, `test/unit/foe-damage.test.js`, `mazeworld.html`)

## Accomplishments

- Built `test/determinism/foe-abilities.test.js` (13 tests): a self-deriving pinned-seed suite forcing Humans tier 2 (Krupke), Magical tier 4 (Drudge), Demons tier 5 (Djinni), Walking Dead tier 5 (Vampire) and Beasts tier 5 (Stalka Beast) — every seed independently measured to `1`, and re-derived from scratch by the suite's own first test on every run. Proves replay-identity (events + stripped state + draw count + rng cursor) for both a full fight and a 12-visit direct-`foeTurn` log per encounter, a kind-coverage union (bolt/drain/debuff/summon all fire), and a JSON-lossless mid-fight `state.combat` snapshot carrying `f.abilities`/`f.cd`/`f.uses` (FID-04).
- Appended Section 4 to `test/unit/foe-turn-draw-count.test.js` (13 new tests, Sections 1-3 byte-unchanged): `abilities: []` reproduces the six Section-1 micro pins (0/1/2/2/3/6) identically; a caster with an exhausted `uses` cap or a still-cooling `every`-N ability draws only its melee to-hit (never the d6); a `never_melee` caster with nothing ready draws 0; a 10-row `GATED_DRAWS` table pins the exact rng cost of bolt/drain/debuff/heal/summon/never_melee/resist/armour-soak; the five `FULL_FIGHTS` totals are restated (still 12/101/111/66/32) and exactly 8 bestiary rows carry an `abilities` kit, none of them the four fixture-roster creatures.
- Extended the Phase 18 zero-foe-wp-decrement invariant in `test/unit/foe-damage.test.js` to scan `engine/foeAbilities.js` alongside `combat.js`/`magic.js`/`items.js` — zero violations (the resolver heals by capped direct assignment and delivers hero/member damage exclusively through `applyFoeDamageToPlayer`/`member.wp -=`).
- Landed the D-21 UI copy in `mazeworld.html`: `CONDITION_COPY.foeEffect` fallback row (`"Hexed"`/`"rds"`), `const FOE_EFFECT_LABEL = { weakened: "Weakened", dazed: "Dazed" }`, and a `paintConditions` label-chain branch between the `phobia` and generic-fallback branches — 10 lines inserted, 0 removed. `test/unit/foe-effect-chip.test.js` (4 tests) source-asserts the branch order, cross-checks the label-map keys against `content/foe-abilities.js`'s live debuff `effect` values, and proves `conditionsOf`'s `foeEffect` chip resolves end-to-end to `"Weakened"`/`"Dazed"` with a numeric `remaining`.
- Phase gate: `npm test` 882/882 (0 fail, well above the 683 pre-phase baseline), parity 30/30 byte-identical, `test/parity/fixtures`/`prototype-master.js.txt`/`package.json`/`package-lock.json` unchanged since `d5fc90a`, `npm run build:www` succeeds and `www/index.html` carries `FOE_EFFECT_LABEL`.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-15 determinism suite (test/determinism/foe-abilities.test.js)** - `1147538` (test)
2. **Task 2: Section 4 draw-count pins + foeAbilities.js seam invariant (test/unit/foe-turn-draw-count.test.js, test/unit/foe-damage.test.js)** - `31e30fa` (test)
3. **Task 3: D-21 chip labels + test/unit/foe-effect-chip.test.js + phase gate (mazeworld.html)** - `2dba6b5` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `test/determinism/foe-abilities.test.js` — new: the D-15 determinism suite (13 tests)
- `test/unit/foe-turn-draw-count.test.js` — modified: `BESTIARY` import added, Section 4 appended (13 tests); Sections 1-3 byte-unchanged (verified via `git diff -U0 d5fc90a` — 0 removed lines)
- `test/unit/foe-damage.test.js` — modified: invariant file list + title extended to include `engine/foeAbilities.js` (same 22-test count before/after)
- `mazeworld.html` — modified: `CONDITION_COPY.foeEffect` row, `FOE_EFFECT_LABEL` constant, one `paintConditions` branch (10 insertions, 0 removals since `d5fc90a`)
- `test/unit/foe-effect-chip.test.js` — new: D-21 source-assertion + cross-check + end-to-end suite (4 tests)

## Measured D-15 Pins (recorded per the plan's `<output>` contract)

**Seeds** (all five self-derive to seed 1 within the first scan — `SEED_SEARCH_LIMIT = 300`; test 1 re-scans from seed 1 every run):

| key | seed | seeds scanned to first match |
|---|---|---|
| humans-t2 | 1 | 1 |
| magical-t4 | 1 | 1 |
| demons-t5 | 1 | 1 |
| walking-dead-t5 | 1 | 1 |
| beasts-t5 | 1 | 1 |

**FULL_FIGHT_PINS:**

| key | foeNames | totalDraws | attacks | outcome |
|---|---|---|---|---|
| humans-t2 | [Krupke, Krupke] | 76 | 6 | won |
| magical-t4 | [Drudge, Drudge] | 46 | 4 | won |
| demons-t5 | [Djinni, Djinni] | 63 | 5 | won |
| walking-dead-t5 | [Vampire, Vampire] | 36 | 2 | died |
| beasts-t5 | [Stalka Beast, Stalka Beast] | 71 | 5 | died |

**PER_VISIT_PINS (VISITS = 12; never raised to 24 — every spec already produced a foeCast, and bolt/drain/debuff/summon were all covered at 12):**

| key | per-visit draws |
|---|---|
| humans-t2 | [4,4,4,4,5,4,4,4,4,4,5,5] |
| magical-t4 | [2,2,2,2,2,2,2,2,2,2,2,4] |
| demons-t5 | [4,4,4,4,5,4,4,4,4,4,5,5] |
| walking-dead-t5 | [4,6,4,6,7,5,11,10,10,9,9,8] |
| beasts-t5 | [4,6,4,6,5,4,6,8,6,4,7,5] |

**Kind/event coverage:** the per-visit union of `foeCast.kind` across all five specs is `{bolt, drain, debuff, summon}` — the full D-15 coverage requirement. `heal` did not fire in any 12-visit log (no pinned foe starts below `maxWP`); the `beasts-t5` FULL FIGHT did show the Stalka Beast healing itself mid-fight after taking damage from the hero (`foeHealed` observed there, informational only — not a pinned assertion). `foeFled { reason: "lowHp" }` (Djinni sub-25%-HP flee) did not fire in any of the five pinned encounters; not required by this plan and already covered directly by 19-03's own unit tests.

**Final gate numbers:** `npm test` → 882 pass, 0 fail (baseline was 683 pre-Phase-19; Phase 19 plans 01-04 together added 199 tests). Parity → 30/30 byte-identical. `build:www` → succeeds, `www/index.html` contains `FOE_EFFECT_LABEL`.

## Decisions Made

- All five pins landing on seed 1 was measured, not engineered — each spec's forced tier/type combination happens to roll the wanted caster on the very first seed scanned (see `key-decisions` in frontmatter for the full rationale on why this is not a red flag: test 1 independently re-derives every seed from scratch on every run).
- `VISITS` stayed at 12 (the D-15 "raise to 24" escape hatch in the plan was not exercised) because every spec already produced a `foeCast` and the five-spec union already covered bolt/drain/debuff/summon at 12 visits.
- No Section 1-3 pin, code line, or FULL_FIGHTS literal in `test/unit/foe-turn-draw-count.test.js` was touched — Section 4 is a pure append plus one new import line, verified via `git diff -U0 d5fc90a` showing zero removed lines.

## Deviations from Plan

None — plan executed exactly as written. Every pin in this plan was measured against the real, already-landed 19-01/19-02/19-03 engine; no mismatch was found against any of the plan's own predicted numbers (the D-04 gated-draw table's 10 rows, the Section-1 identity six pins, and the FULL_FIGHTS five totals all matched on first measurement), so nothing here needed to be reported as a 19-01..03 engine defect.

## Known Stubs

None. No hardcoded empty/placeholder data was introduced by this plan — every test file asserts against real, already-implemented engine/content behavior, and the `mazeworld.html` chip labels are wired to the live `conditionsOf` data path (not a mock).

## Threat Flags

None. This plan's `<threat_model>` (T-19-14 through T-19-SC) is fully addressed by the measured-not-adjusted pin discipline, the zero engine/content/src-browser diff gate (checked before every task commit), and the frozen-fixture/manifest diff gates — all verified green above. No new network endpoint, auth path, file-access pattern, or trust-boundary schema change was introduced.

## Issues Encountered

None. All three tasks' verification blocks passed on first measurement against the real post-19-03 engine; no auto-fix (Rules 1-3) was needed in any task.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 19 (Foe Abilities, Spellcasting & Symmetric INT Resistance) is now fully closed: all of FOE-01, FOE-02, FOE-03, FOE-04, FOE-06, FOE-07, FOE-08, FOE-09, CANON-02 and FID-04 are implemented (19-01..03) and now proven by a CI-maintained determinism/draw-count/UI-label test suite (19-04). `npm test` is green at 882/882, parity is byte-identical at 30/30, and every frozen file (`test/parity/prototype-master.js.txt`, `test/parity/fixtures/*.json`, `package.json`, `package-lock.json`) is untouched since the pre-phase anchor.
- The one `human_judgment: true` coverage row above (the on-device "a Weakened/Dazed chip appears and counts down" visual check) is a `verification: backstop` item per the plan's `must_haves.truths` — it is NOT gated on this plan's automated suite and is expected to be confirmed during the milestone's end-of-phase on-device DR pass, per STATE.md's `human_verify_mode: end-of-phase` config.
- ROADMAP.md's v1.1 order continues at Phase 20 (Parley Balance & Language System).

---
*Phase: 19-foe-abilities-spellcasting-symmetric-int-resistance*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files and all three task commit hashes (`1147538`, `31e30fa`, `2dba6b5`) verified present.
