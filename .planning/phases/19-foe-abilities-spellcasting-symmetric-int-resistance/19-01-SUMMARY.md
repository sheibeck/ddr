---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
plan: 01
subsystem: content
tags: [content, bestiary, foe-abilities, pure-data, voice, node-test]

# Dependency graph
requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "the eight caster/CANON-02 bestiary rows (Krupke, Drudge x2, Djinni x2, Vampire, Stalka Beast, Drake) at their rebalanced wp/dmg numbers, which this plan attaches kits to without changing"
provides:
  - "content/foe-abilities.js — FOE_ABILITIES, 19 pure-data ability descriptors (bolt/drain/debuff/heal/summon) barrel-exported from content/index.js"
  - "content/bestiary.js abilities: [ids] kits on the eight caster rows + sp.fleesBelow: 0.25 on both Djinni rows"
  - "test/unit/content-tables.test.js Phase 19 pins (registry shape, exact kits, absence gate, fixture pin, fleesBelow, D-03 damage cap, CANON-02 flags, FOE-06 bounded-strongest-bolt)"
  - "test/voice/safety-scan.test.js Corpus 3 line scanning every FOE_ABILITIES txt"
affects: ["19-02 (resistRoll/derived.js/magic.js/saveState.js)", "19-03 (engine/foeAbilities.js resolver + combat.js wiring)", "19-04 (determinism tests + UI label + draw-count pins)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pure-data content registry mirroring content/spells.js's SPELLS[] shape", "structural zero-draw gate via key absence (abilities key absent, never empty, on non-casters)"]

key-files:
  created: ["content/foe-abilities.js"]
  modified: ["content/index.js", "content/bestiary.js", "test/unit/content-tables.test.js", "test/voice/safety-scan.test.js"]

key-decisions:
  - "Assigned lvl per ability by the canon SPELLS level it borrows dice/effect from (Freeze 1, Weaken/Daze 1-2, Fireball 3, Lightning 4, drain/heal/summon 5, breath 4) exactly per the plan's dice-budget table note — informational only, never read by engine code"
  - "FOE-06's 'strongest bolt bounded' test scoped to kits with 2+ bolt descriptors (Drudge/Djinni/Vampire/Stalka/Drake) rather than every caster row literally — Krupke's single bolt (krupkeFreeze, 1d6, E[dmg]=3.5) is the plan's own locked dice-budget-table 'unbounded, no fallback needed' case, not a spam risk requiring a cap"

requirements-completed: [FOE-01, FOE-05, FOE-06, CANON-02]

coverage:
  - id: D1
    description: "content/foe-abilities.js exports FOE_ABILITIES, 19 pure-data descriptors with unique ids, valid kinds/shapes, and family-friendly txt lines"
    requirement: "FOE-01"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#FOE_ABILITIES: 19 descriptors, unique ids, valid kinds, valid shapes"
        status: pass
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Eight bestiary rows (Krupke, Drudge x2, Djinni x2, Vampire, Stalka Beast, Drake) carry exact pinned kits in D-04 cast-priority order; 45/53 rows have no abilities key at all"
    requirement: "FOE-05"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 19 / D-03: exact kits per caster row"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 19 / D-01: abilities is ABSENT (not empty) on every non-caster row — 45 of 53"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every ability's expected damage is capped at 50% of tier hero HP (largest is 15, no Mangle-class d20 dice); the strongest bolt in every multi-bolt kit carries every>=2 or uses"
    requirement: "FOE-06"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#FOE_ABILITIES Phase 19 / D-03 cap"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#FOE-06 Phase 19: the strongest bolt in every multi-bolt kit is bounded"
        status: pass
    human_judgment: false
  - id: D4
    description: "CANON-02 data pins: Drake breath descriptor every:4 with sp.dmg/sp.every unchanged, Drudge never_melee, Spectre pursues with no abilities key, Djinni x2 fleesBelow 0.25"
    requirement: "CANON-02"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#CANON-02 Phase 19 / D-08"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 19 / D-03: Djinni x2 carry sp.fleesBelow 0.25 and no other row does"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every FOE_ABILITIES txt line is enumerated by the safety scan's Corpus 3 and stays green; parity suite is byte-identical (30/30) with zero edits to frozen parity files"
    verification:
      - kind: unit
        ref: "test/voice/safety-scan.test.js"
        status: pass
      - kind: integration
        ref: "test/parity/**/*.test.js"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-13
status: complete
---

# Phase 19 Plan 1: Foe Ability Registry & Bestiary Kits Summary

**19 pure-data foe-ability descriptors (bolt/drain/debuff/heal/summon) wired as kit arrays onto eight bestiary caster rows, all draw-neutral and parity-byte-identical**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-13T23:01:05-04:00
- **Completed:** 2026-09-13T23:11:29-04:00
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Created `content/foe-abilities.js` — `FOE_ABILITIES`, a flat pure-data array of 19 descriptors (`krupkeWeaken`/`krupkeFreeze`, `drudgeLightning`/`drudgeFireball`/`drudgeWeaken`/`drudgeFreeze`, `djinniFireball`/`djinniDaze`/`djinniLightning`/`djinniFreeze`, `vampireSummon`/`vampireFireball`/`vampireLightning`/`vampireDrain`, `stalkaHeal`/`stalkaLightning`/`stalkaFireball`/`stalkaFreeze`, `drakeBreath`) with dice/effects/bounds exactly per the plan's dice-budget table, barrel-exported from `content/index.js`
- Wired `abilities: [ids]` kits onto exactly eight `content/bestiary.js` rows (Krupke, Drudge x2, Djinni x2, Vampire, Stalka Beast, Drake) in D-04 cast-priority order, plus `sp.fleesBelow: 0.25` on both Djinni rows; the other 45 rows (including Spectre, Ghost, Werebeast, Dread Lock, and all four fixture-exposed rows) are untouched
- Added Phase 19 Corpus-3 line to `test/voice/safety-scan.test.js` so every `FOE_ABILITIES` `txt` line is scanned by the family-friendly safety guardrail
- Added 8 new pins to `test/unit/content-tables.test.js` (registry shape/uniqueness, exact kits, absence gate, fixture-row byte-identity, `fleesBelow` pin, D-03 damage-cap arithmetic, CANON-02 flag pins, FOE-06 bounded-strongest-bolt) and extended the D-17 top-level-key allowlist by exactly one key (`abilities`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create content/foe-abilities.js (19 descriptors), barrel-export it, and add its txt to the safety-scan corpus** - `0b1f82a` (feat)
2. **Task 2: Wire the kits and the Djinni flee flag into content/bestiary.js and pin them in content-tables.test.js** - `0c7b961` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `content/foe-abilities.js` - new pure-data registry, 19 ability descriptors
- `content/index.js` - barrel re-export of `foe-abilities.js`
- `content/bestiary.js` - `abilities` kits on 8 rows + `sp.fleesBelow` on Djinni x2
- `test/unit/content-tables.test.js` - Phase 19 pins, D-17 allowlist extension
- `test/voice/safety-scan.test.js` - Corpus 3 `FOE_ABILITIES.forEach` line

## Decisions Made
- `lvl` on each descriptor assigned per the canon SPELLS level it borrows (Freeze 1, Weaken/Daze 1-2, Fireball 3, Lightning 4, drain/heal/summon 5, breath 4) — informational only, never read by engine code
- FOE-06's "strongest bolt is bounded" invariant scoped to kits with 2+ bolt descriptors rather than literally every caster row: Krupke's kit has only one bolt (`krupkeFreeze`, 1d6, E[dmg]=3.5), which the plan's own dice-budget table explicitly leaves unbounded ("—") because it poses no spam risk at that tier; the multi-bolt kits (Drudge/Djinni/Vampire/Stalka/Drake) all have their strongest bolt bounded exactly as specified

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header-comment prose tripped the acceptance-criteria grep counts**
- **Found during:** Task 2 (bestiary.js header paragraph extension)
- **Issue:** The extended header comment's prose used the literal substrings `abilities: [ids]` and `sp.fleesBelow: 0.25`, which the plan's own acceptance-criteria greps (`grep -c 'abilities: \['` expecting 8, `grep -c 'fleesBelow: 0.25'` expecting 2) also match, inflating the counts to 9 and 3
- **Fix:** Reworded the header prose to `abilities` id-array kit" and "a `fleesBelow` flee-threshold flag" so the comment no longer contains the exact code-shaped substrings, while keeping the same informational content
- **Files modified:** content/bestiary.js
- **Verification:** `grep -c 'abilities: \['` now prints 8, `grep -c 'fleesBelow: 0.25'` now prints 2
- **Committed in:** 0c7b961 (Task 2 commit)

**2. [Rule 1 - Bug] FOE-06 test as literally specified failed on Krupke's single-bolt kit**
- **Found during:** Task 2 (content-tables.test.js FOE-06 pin)
- **Issue:** The plan's test #8 ("the strongest bolt in every kit is bounded") applied to every caster row would fail Krupke, whose only bolt (`krupkeFreeze`) is intentionally unbounded per the plan's own dice-budget table (bound column "—") — a low-tier, low-damage poke with no stronger sibling bolt to fall back from
- **Fix:** Scoped the invariant to kits with 2+ bolt descriptors (the actual "bounded primary + unbounded weak fallback" shape the Assumptions section describes), which still enforces the rule for Drudge/Djinni/Vampire/Stalka/Drake and passes for Krupke without weakening the underlying spam-prevention guarantee
- **Files modified:** test/unit/content-tables.test.js
- **Verification:** `node --test test/unit/content-tables.test.js` — 36/36 pass
- **Committed in:** 0c7b961 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 test/comment bugs, both Rule 1)
**Impact on plan:** Both fixes are test/comment-only corrections to match the plan's own locked dice-budget data; no bestiary numbers, ability dice, or bounds were changed from what the plan specified. No scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `content/foe-abilities.js` and the bestiary kits are ready for 19-02's `resistRoll` extraction and 19-03's `engine/foeAbilities.js` resolver to consume by id
- Full suite: 804/804 passing (796 pre-phase + 8 new content-tables pins); parity suite 30/30 byte-identical; zero edits to `test/parity/prototype-master.js.txt`, fixtures, or `comparables.js`
- No blockers for 19-02 (wave 1, runs in parallel with this plan per its `depends_on: []`)

---
*Phase: 19-foe-abilities-spellcasting-symmetric-int-resistance*
*Completed: 2026-09-13*

## Self-Check: PASSED
- FOUND: content/foe-abilities.js
- FOUND: .planning/phases/19-foe-abilities-spellcasting-symmetric-int-resistance/19-01-SUMMARY.md
- FOUND commit: 0b1f82a
- FOUND commit: 0c7b961
