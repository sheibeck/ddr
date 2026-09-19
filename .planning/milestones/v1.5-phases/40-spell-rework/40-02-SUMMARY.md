---
phase: 40-spell-rework
plan: 02
subsystem: engine
tags: [spell-mechanics, dot, timers, data-flags, bot-tuning, dice]

# Dependency graph
requires:
  - phase: 40-spell-rework plan 01
    provides: "content/spells.js's niche/flag contract (onHit, aoe, lesser, roll:'derived', kind:'dot'); NICHE_LABELS; the day-one damage guarantee"
provides:
  - "engine/magic.js: castSpell's thrown branch reads sp.aoe/sp.onHit (never a spell name); the new dot branch (Ice, one d4+1 draw, guarded on sp.dmg); the summon branch's lesser track (ALLY_NAMES/LESSER_ALLY_NAMES, never doubled/backfires); the weaken branch's spell:weaken rounds-cadence timer; stupid branch drops the old d10 nap"
  - "engine/combat.js: foeTurn's f.dot tick gains the ice frozen-solid/killFoe payoff; allyCast's third Freeze name check repointed + its own weaken d4+1 timer on state.c; foeTurn's tail clears C.weakened/foeToHitPenalty + narrates weakenFaded on the spell:weaken timer's own transition; foeTurn's f.stupid skip (no counter, lasts the fight); playerStrike's need-5 floor now covers a stupid foe too; Shrink's real half damage at all three foe-melee sites (hero/member/pursuitStrike)"
  - "tools/lib/tuning-bot.mjs: chooseSpell's KILL/DAMAGE tiers repointed to sp.onHit/sp.aoe; the dot kind scores with its own x3 mean-tick constant, skipped when the target already carries dot"
  - "src/browser/{eventNarration,toasts,rail}.js: iceApplied/weakenFaded/foeStupefied fully narrated; dotTick branches on by; allySummoned/allyPending branch on lesser; weakened names its rounds"
  - "test/unit/spell-mechanics.test.js (new, 28 tests)"
affects: [40-03-utility-visibility, 40-05-shell-close]

tech-stack:
  added: []
  patterns:
    - "A spell's own duration lives on engine/effects.js's shared c.timers shape (id 'spell:weaken') exactly like an ability cooldown or an item effect — combat.js#foeTurn's ONE tickRounds(c) call per turn feeds both the generic item/ability narration and a spell-specific expiry check off the same transitions list, never a second tick"
    - "A per-foe DOT record (f.dot = {left, dmg, by}) is now shared by TWO independent sources (Poisoned Edge, Ice) that never read each other's identity except through the by field — the one dispatch point (foeTurn's tick block) owns the shared mechanics (the tick itself, the kill check) while by-specific payoffs (Ice's freeze) sit immediately after, gated on by"
    - "The one-tick-already-spent invariant (38-03 SUMMARY) generalizes past ability cooldowns to spell timers and dot records: a cast IS the round's action, so the SAME dispatch's own afterPlayerAction->foeTurn tail always ticks a freshly-started record once before the cast function returns"

key-files:
  created:
    - test/unit/spell-mechanics.test.js
  modified:
    - engine/magic.js
    - engine/combat.js
    - tools/lib/tuning-bot.mjs
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/unit/magic.test.js
    - test/voice/safety-scan.test.js
    - docs/SPELLS.md
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "Tasks 1 and 2 landed in a single commit (8bb080e) instead of two — both edit the SAME functions (castSpell's kind switch, foeTurn's per-foe loop and tail) and the TDD test file was authored holistically as one file per the plan's own 'extend test/unit/spell-mechanics.test.js' instruction for Task 2; splitting the interleaved engine hunks into two commits would mean re-implementing in two passes with no traceability benefit over one well-documented commit. Task 3 (docs + gate) is its own commit (dc98804), matching the plan's own 3-task structure at the commit-count level everywhere it was practical to separate cleanly."
  - "Following 40-01-SUMMARY's own precedent (and the ABIL-01/04 precedent from Phase 38): REQUIREMENTS.md's SPELL-01/SPELL-03 checkboxes are NOT marked complete by this plan, despite both being named in this plan's own frontmatter. 40-05-PLAN.md's own frontmatter explicitly re-lists SPELL-01 and states 'the phase closes: ... SPELL-01..07 marked complete' — the phase-close plan sweeps every SPELL requirement's checkbox, including SPELL-03 and SPELL-04 (also never marked by 40-01 despite finishing their mechanics), not the plan that finishes the underlying mechanics."
  - "The tuning-bot's dot x3 multiplier (mean of the real d4+1 duration, 3.5) keeps Ice below Acid's own x2-on-a-heavier-base score (318 vs 310.5 at level 5 vs 1 foe) — measured live, not assumed; test/unit/tuning-bot.test.js's existing acidVsIce/acidAlreadyTicking pins needed zero edits because the new math happens to preserve the same ordering the old placeholder-x1 scoring produced."
  - "Weaken's member-cast branch (allyCast) starts its OWN spell:weaken record on the HERO's state.c (not the member's own sheet) — matching the existing C.weakened/C.foeToHitPenalty fields it already shares with the hero's own cast, so there is exactly one 'is the party weakened' answer regardless of who cast it."

requirements-completed: []

coverage:
  - id: D1
    description: "No engine or bot rule keys on a spell's display name — Lightning's every-foe case reads sp.aoe==='all', Freeze's frozen-solid kill reads sp.onHit==='freeze' in both castSpell and allyCast and the bot's KILL tier"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/spell-mechanics.test.js (Lightning/Fireball tests); grep -rn 'sp\\.n === \"' engine/ tools/lib/ (0 matches)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ice is a real DOT: a cast puts f.dot={left:d4+1, dmg:d6, by:'ice'} on the target, ticks d6 a round in foeTurn's existing dot block, and when the last tick leaves the foe standing it freezes solid and dies through killFoe (pays like any kill)"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/spell-mechanics.test.js (9 Ice tests: cast, resist, payoff x4, narration)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lesser Summon conjures a weaker ally than Summon: level clamp(c.level-1,1,3), d4 rounds, its own four-name table, and NEVER the Summoner's doubling or backfire"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/spell-mechanics.test.js (5 Lesser Summon tests); test/unit/identity-contract.test.js (Summoner GOOD, re-pinned)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Control spells carry an explicit scope x duration: Weaken is every foe for d4+1 rounds on a c.timers['spell:weaken'] record whose expiry clears C.weakened/C.foeToHitPenalty and narrates weakenFaded; Stupidity is one foe for the rest of the fight (t.stupid, foeStupefied, hit as if asleep); Shrink's half damage is real at every foe-damage line"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/spell-mechanics.test.js (5 Weaken tests, 3 Stupidity tests, 3 Shrink tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new event type (iceApplied, weakenFaded, foeStupefied) has EVENT_NARRATION + TOAST_FOR + RAIL_FAMILY entries and passes the voice scan; dotTick narrates 'from the ice' when by==='ice'"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js, test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js (all green)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The tuning bot still casts every reshaped kind (dot scores in the damage tier); every existing parity fixture is byte-identical (no fixture casts Ice/Weaken/Stupidity/Shrink/Lesser Summon) — confirmed by the suite"
    requirement: "SPELL-03"
    verification:
      - kind: unit
        ref: "npm test (2739/2739, # fail 0); test/parity/*.test.js green; git status --porcelain test/parity/fixtures empty"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/SPELLS.md's Offense mechanics section and FIXTURE-INVENTORY.md's Plan 02 paragraph record every mechanic and its draw statement"
    verification:
      - kind: other
        ref: "grep -c '(appended by Plan 02)' docs/SPELLS.md == 0; grep -c '## Offense mechanics (Plan 02)' docs/SPELLS.md == 1; grep -c '### Plan 02' test/parity/FIXTURE-INVENTORY.md == 1"
        status: pass
    human_judgment: false

duration: 80min
completed: 2026-09-18
status: complete
---

# Phase 40 Plan 02: Offense Mechanics Summary

**engine/magic.js's data-flag-driven thrown branch (no spell is name-keyed anywhere in the engine or bot), Ice's real per-round DOT with a frozen-solid payoff through killFoe, Lesser Summon's safe never-backfires cast branch, and the control axis made real — Weaken's rounds-cadence timer, Stupidity's fight-long skip, and Shrink's genuine half damage.**

## Performance

- **Duration:** ~80 min
- **Tasks:** 3
- **Files modified:** 12 (1 new, 11 modified)

## Accomplishments

- `engine/magic.js#castSpell`'s thrown branch reads `sp.aoe === "all"` (Lightning) and `sp.onHit === "freeze"` (Freeze) instead of comparing against the literal spell name — research Pitfall 2 closed at every site, including the third name-keyed Freeze check in `engine/combat.js#allyCast` (a member's own cast) and `tools/lib/tuning-bot.mjs#chooseSpell`'s KILL tier.
- A new `dot` branch (Ice) puts `t.dot = { left: rng.d(4) + 1, dmg: sp.dmg, by: "ice" }` on the target — one draw, no to-hit roll (like Acid), resistible, guarded on `sp.dmg` (T-40-03), refreshes rather than stacks on a recast. `engine/combat.js#foeTurn`'s existing `f.dot` tick block (Phase 38's Poisoned Edge template) gains the payoff: when an ice dot's last tick leaves the foe standing, it freezes solid and dies through `killFoe` (pays like any kill) — `by` is the only switch, so a Poisoned Edge dot running out is completely unaffected.
- The summon branch splits into two tracks on `sp.lesser === true`: Lesser Summon is never doubled, never backfires (the `d8` check is skipped outright), levels one under the caster (`clamp(c.level-1,1,3)`), rounds a plain `d4`, and picks from its own `LESSER_ALLY_NAMES` table; `allySummoned`/`allyPending` gain `lesser: true` only on that branch, while the persisted ally object itself gains no new field.
- Weaken now has the "explicit duration" its `txt` has always promised: `rng.d(4) + 1` rounds on a `spell:weaken` timer (`engine/effects.js#startEffect`), with `combat.js#foeTurn`'s tail clearing `C.weakened`/`C.foeToHitPenalty` and narrating `weakenFaded` on the SAME `tickRounds(c)` call's own effect->null transition — the one-tick-already-spent invariant (38-03) applies here too: a cast's own trailing `foeTurn` already spends the first tick. A member's own Weaken cast (`allyCast`) draws its own `d4+1` and starts the identical record on the hero's `state.c`.
- Stupidity drops the old `rng.d(10)` nap draw outright — `t.stupid = true` disables the foe for the rest of the fight via `foeTurn`'s own per-round skip (no counter, mirrors Pommel Strike's `f.stunned` pattern); `playerStrike`'s need-5 floor ("5 to hit a dozing creature") now also covers a stupid foe. Shrink's half damage is real at all three foe-melee damage sites (`foeTurn`'s hero/member branches, `pursuitStrike`) — a shrunk-and-weakened foe is quartered (`ceil` applied twice, independently).
- `test/unit/spell-mechanics.test.js` (new, 28 tests): every behavior above, measured against the real engine (not hand-guessed draw sequences), including the one-tick-already-spent invariant for both the Ice dot and the Weaken timer, the Lesser Summon draw-count proof, and the shrunk-halving proof at all three foe-melee sites.
- `docs/SPELLS.md`'s "Offense mechanics (Plan 02)" section and `test/parity/FIXTURE-INVENTORY.md`'s new "Plan 02" paragraph record every mechanic's draw statement and why zero fixtures moved.

## Task Commits

1. **Tasks 1 + 2: data flags, Ice DOT + freeze payoff, Lesser Summon, Weaken timer, Stupidity, Shrink** (landed together — see Decisions) - `8bb080e` (feat)
2. **Task 3: docs/SPELLS.md "Offense mechanics" + FIXTURE-INVENTORY.md Plan 02 paragraph + plan gate** - `dc98804` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/magic.js` — data-flag thrown branch, the `dot` branch (+`iceApplied`), the lesser-summon summon branch (+`ALLY_NAMES`/`LESSER_ALLY_NAMES`), the Weaken timer, Stupidity's dropped nap draw
- `engine/combat.js` — `foeTurn`'s ice payoff + `f.stupid` skip + the three shrunk halvings; `allyCast`'s Freeze repoint + weaken timer; `foeTurn`'s tail weaken expiry; `playerStrike`'s stupid need-5 floor
- `tools/lib/tuning-bot.mjs` — `chooseSpell`'s `onHit`/`aoe`/`dot` repoints + JSDoc
- `src/browser/eventNarration.js`, `toasts.js`, `rail.js` — `iceApplied`/`weakenFaded`/`foeStupefied` narrated; `dotTick`/`allySummoned`/`allyPending`/`weakened` extended
- `test/unit/magic.test.js` — the three pre-existing Weaken tests re-pinned to the new d4 draw
- `test/voice/safety-scan.test.js` — `BASE_EVENT`/`BRANCH_TOGGLES` extended (`by: "ice"`, `lesser: true`, `rounds: 0`)
- `test/unit/spell-mechanics.test.js` (new, 28 tests)
- `docs/SPELLS.md`, `test/parity/FIXTURE-INVENTORY.md` — the ledger sections

## Decisions Made

- Tasks 1 and 2 landed in one commit instead of two (see key-decisions above and the Deviations section below) — the interleaved engine functions and the holistically-authored test file made a clean split impractical without re-implementing in two passes.
- REQUIREMENTS.md's SPELL-01/SPELL-03 checkboxes are left unmarked, following 40-01-SUMMARY's own precedent within this same phase — Plan 05 sweeps every SPELL requirement at phase close.
- The tuning bot's `dot` x3 multiplier (mean of the real d4+1 duration) keeps Ice correctly ranked below Acid without needing to touch `test/unit/tuning-bot.test.js`'s existing acid-vs-ice pins.
- `allyCast`'s Weaken branch starts its `spell:weaken` timer on the HERO's own `state.c`, not the casting member's sheet — matching the existing party-wide `C.weakened`/`C.foeToHitPenalty` fields.

## Deviations from Plan

### Process deviation (not a Rule 1-3 auto-fix)

**Tasks 1 and 2 committed together.** The plan's own task split asks for two separate TDD commits (Task 1's `test/unit/spell-mechanics.test.js` FIRST, then Task 2's "Extend" of the same file). Because both tasks' engine changes land in the SAME functions (`castSpell`'s kind switch, `foeTurn`'s per-foe loop and tail) and the test file was authored as one coherent whole covering both tasks' behaviors (per the plan's own instruction to extend, not replace, the file), separating the already-interleaved diff into two commits after the fact would require re-implementing the engine changes in two literal passes for no functional or review benefit — the single commit's message documents both tasks' scope explicitly and in full. This is a workflow/traceability decision, not a code defect; every acceptance criterion for both tasks is independently verified (see the grep table in the commit message and the coverage block above).

No Rule 1/2/3 auto-fixes were needed — the plan's own `<mechanics_spec>` was precise enough (exact draw orders, exact field shapes) that the implementation matched on the first pass; the only iteration was re-measuring two pre-existing test pins (`test/unit/magic.test.js`'s Weaken tests) that the plan itself flagged would need a d4 value added, and fixing two of my OWN newly-authored `spell-mechanics.test.js` tests whose fakeRng sequences underflowed against the real trailing `afterPlayerAction` tail (test-authoring corrections, not engine bugs).

---

**Total deviations:** 1 process deviation (commit structure), 0 auto-fixed engine issues.
**Impact on plan:** No scope creep, no architectural changes, no code behavior differs from the plan's own `<mechanics_spec>`.

## Issues Encountered

None beyond the test-authoring corrections noted above (both fixed before commit, part of the green suite).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 40 plans):

1. **Cast Ice on a tough foe** — the fight log shows "Ice climbs …" then a d6 tick each round ("… takes N from the ice") and "freezes solid" at the end, with the kill paid (sp/gold/loot as normal). This plan only wires the mechanic and its narration; Plan 05's grimoire-row rendering is separate.
2. **Cast Weaken** — the fight log shows "They hit softer now, for N rounds" and, when it runs out, "Their arms remember how to swing." A re-cast mid-window should read a fresh rounds count, not stack.
3. **Cast Stupidity on a foe, then watch it for several rounds** — every round after the cast, the foe "stands there, thinking about nothing" and never swings or casts, for the rest of that fight.
4. **A level-1 Summoner's Lesser Summon** brings a small ally (a "sort of"/"in a small way" line) for at most 4 rounds and never backfires, even on repeated casts.
5. **Lightning still hits every foe** in a multi-foe fight — one roll per foe, independent hit/miss.
6. **Shrink a foe and let it swing** — its blow should visibly land softer than an equivalent unshrunk foe's; if it is also Weakened, softer still.

## Next Phase Readiness

- `content/spells.js`'s data flags now have real engine consumers everywhere they're read (Plan 01's contract fully wired) — Plan 03 (utility visibility, scroll fix, `c.senses` expiry) can build directly on this without touching offense mechanics again.
- The `c.timers` shared shape (Phase 36) now has three consumer families (ability cooldowns, item effects, and this plan's `spell:weaken`) — Plan 04's Map the Floor reveal window is the next natural user of the same `squares`-cadence half of the same module.
- No blockers. `npm test`: 2739/2739, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).

---
*Phase: 40-spell-rework*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `engine/magic.js`, `engine/combat.js`, `tools/lib/tuning-bot.mjs`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/unit/spell-mechanics.test.js`, `docs/SPELLS.md` ("## Offense mechanics (Plan 02)" section present), `test/parity/FIXTURE-INVENTORY.md` ("### Plan 02" section present) all exist with the expected content.
Verified in git log: `8bb080e`, `dc98804` both present on `master`.
