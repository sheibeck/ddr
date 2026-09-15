---
phase: 22-class-aware-harness-before-matrix
plan: 02
subsystem: testing
tags: [harness, bot-policy, tuning-proxy, dev-only, magic-users, chooseSpell]

requires:
  - phase: 22-class-aware-harness-before-matrix (Plan 01)
    provides: "engine/state.js#newRun(seed, exclude, { startDepth, force }) — the dev-only force option playRun now forwards unchanged"
provides:
  - "tools/lib/tuning-bot.mjs#chooseSpell(state, ctx) — the ONE Magic-User spell-scoring table (kill/damage/disable/heal/ward-opener tiers), replacing findCastableAttackSpell's thrown-only rule"
  - "tools/lib/tuning-bot.mjs#isTalkFirst(state) — names the five identity talkers (Con Artist, Woodsman vs Beasts, Bard vs Humans, Wilmsry non-Magical, Elven vs Humans)"
  - "tools/lib/tuning-bot.mjs#botLine(opts) — the single emitter of the ledger's grep-stable Bot: parameter line"
  - "tools/lib/tuning-bot.mjs#decideAction — sub-class-aware priority chain (talk-first parley, Bard sing, Summon in/out of combat, Mirror Self opener, Wizard strike-refused fallback, scroll reading)"
  - "tools/lib/tuning-bot.mjs#playRun — honors opts.startDepth/opts.force (HARN-04); returns stuck/outcome/startDepth/floorsGained/encountersSurvived"
  - "reachTable/actionsPerFloorDist/sharedJson exclude stuck runs from depth stats; sharedJson reports stuck/completed counts and bot.startDepth"
  - "test/unit/tuning-bot.test.js — one synthetic-state test per new policy branch, the two refusal-loop fixes (plus a third loop this plan's own Mirror Self opener introduced), the stuck bucket, HARN-04 startDepth idempotency, and botLine's contract"
affects: [22-03, 22-04]

tech-stack:
  added: []
  patterns:
    - "single scoring-table function (chooseSpell) replacing a class of per-kind if/else policy rules — tiers documented once in the function's own JSDoc, cited by name (kill/damage/disable/heal/ward-opener) so the ledger's Bot proxy section and the code never drift"
    - "ctx.fleeBlocked/ctx.strikeBlocked mirror the existing ctx.parleyBlocked Rule-1 pattern: set on a *Refused event, cleared on encounterStarted, so a bot never re-picks an action the engine just refused without a foe turn"

key-files:
  created: []
  modified:
    - tools/lib/tuning-bot.mjs
    - test/unit/tuning-bot.test.js

key-decisions:
  - "Acid's expected-damage constant is x2 (\"two rounds of ticks\") per Task 1's action-step text, even though the plan objective's illustrative \"Resulting order\" numbers (Acid 309) read as if no multiplier were applied (309 is the plain, unmultiplied expected value; x2 gives 318). No test pins the literal score, and Claude's Discretion is explicitly invoked for this exact constant in the plan's flagged_planner_assumption, so the operative Task 1 instruction (x2) was implemented and the discrepancy is documented in chooseSpell's own JSDoc so a future reader isn't confused by the mismatch."
  - "Found and fixed a THIRD refusal-style loop this plan's own Mirror Self opener introduced: canCast() never checks charges left, so a round-1 Illusionist/Wizard with Mirror Self in the grimoire but 0 charges remaining would have castSpell refuse with noChargesLeft (no foe turn, round never advances) every turn forever. Added an explicit chargesLeft > 0 guard to the opener step. Caught by re-running the plan's own wizardStuck acceptance check after the first implementation pass (one of three seeds still hit the 3,000-action cap) — Rule 1 auto-fix, committed as part of Task 1."
  - "chooseSpell's tier gate for kind===death reads C (state.combat) defensively even though the function is only ever called from decideAction's in-combat branch, for future-proofing against a direct out-of-combat caller."
  - "lowestCastableUtilitySpellIdx (Wizard fallback, step g) ranks by sp.lvl ascending with first-found tie-break, not by chooseSpell's own tier scores — utility spells like Detect Magic/Strength never receive a chooseSpell score at all (they're in the never-auto-cast list), so a separate, simpler ranking was needed for 'burn whatever charge is cheapest' rather than reusing chooseSpell's table."

requirements-completed: [HARN-02, HARN-04]

coverage:
  - id: D1
    description: "chooseSpell replaces the thrown-only cast rule with a single kill/damage/disable/heal/ward-opener scoring table; every tier fires under a forced synthetic state"
    requirement: "HARN-02"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Death gate — costs 25 wp, only cast when the post-cost wp stays above the flee line"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: DAMAGE-tier ordering — Mangle > Fireball(s) > Acid/Lightning > Ice, Lightning scales with live-foe count"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: disables score only at 2+ live foes; weaken is skipped once C.weakened is set"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Heal fires below potionThreshold once potions run out; Major Heal outranks Heal"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Shield/Bubble score a round-1 WARD-OPENER below every other tier, including KILL"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mirror Self round-1 opener, Summon in/out of combat, Bard sing, and talk-first parley for the five identity talkers all fire under synthetic states"
    requirement: "HARN-02"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Mirror Self is a round-1 opener that precedes the KILL tier; skipped once already up or off round 1"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Summon in combat — round 1, no ally yet, charges remain; Phantom Host follows the same rule"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Summon out of combat — no pendingAlly and more than half of maxCharges left"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: Bard sings on round 1 once ready; a level-1 song only does anything vs Beasts/Lair Beasts"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: talk-first identities try parley at round 1, once, before anything else"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: isTalkFirst names the five identity talkers and nobody else"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both v1.1-baseline refusal loops (Samurai flee-refused, Wizard strike-refused) are fixed and the six planning-time stuck seeds finish under 3,000 actions"
    requirement: "HARN-02"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: a Samurai never flees; a generically flee-blocked character fights instead"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: a strike-refused Wizard casts something else while charges remain, else flees (unless flee is also blocked)"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-02: observe sets fleeBlocked/strikeBlocked on refusal events, clears both (plus parleyBlocked) on encounterStarted"
        status: pass
      - kind: other
        ref: "node -e playRun(seed,{maxActions:3000}) over [229652,783982,894848,926524,1195770,1274960] -> stuckCount 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "playRun honors startDepth/force (HARN-04), reports stuck/outcome/floorsGained/encountersSurvived, and the shared readout excludes stuck runs from depth stats while still counting them toward encounter/ability tallies"
    requirement: "HARN-04"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-04: stuck is its own outcome bucket, excluded from the depth-stat readouts"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-04: playRun(seed, { startDepth }) is deterministic; startDepth:1/force:undefined matches the bare default"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js#HARN-04: botLine emits the grep-stable Bot: line, appending seeds/workers/startDepth in order"
        status: pass
    human_judgment: false
  - id: D5
    description: "The bot policy stays a non-gating tuning proxy: no synthetic-state test asserts a death-depth/rank/reach number from a real playRun, and tune-difficulty/tune-economy keep running unchanged with the extended Bot: line"
    verification:
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=3 (exit 0); node tools/tune-economy.mjs --seeds=3 (exit 0); npm test -> 978/978"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-14
status: complete
---

# Phase 22 Plan 02: Class-Aware Bot Policy & startDepth Plumbing Summary

**Replaced the Magic User bot's thrown-only cast rule with a single kill/damage/disable/heal/ward-opener scoring table (`chooseSpell`), added talk-first parley/sing/summon/Mirror-Self openers, fixed two v1.1 refusal loops plus a third one this plan's own Mirror Self opener introduced, and threaded `startDepth`/`force` + a `stuck` outcome bucket through `playRun` — 18 new synthetic-state tests, full suite 978/978.**

## Performance

- **Duration:** 40 min
- **Completed:** 2026-09-14
- **Tasks:** 3/3 completed
- **Files modified:** 2 (both modified, none created)

## Accomplishments

- `tools/lib/tuning-bot.mjs#chooseSpell(state, ctx)` replaces `findCastableAttackSpell`: one scoring table across KILL (400+: Freeze 410, Death 405 gated on post-cost wp, Turn/Gate 402), DAMAGE (300 + expected damage: thrown/volley/acid with Lightning scaling by live-foe count and Fireballs x4.5), DISABLE (200+, only at 2+ live foes), HEAL (100 + expected heal, below potionThreshold), and WARD-OPENER (50, round 1 only) tiers — documented once in the function's own JSDoc ("Numbers live here" table reproduced below for Plan 22-04's ledger transcription).
- `isTalkFirst(state)` names the five identity talkers (Con Artist, Woodsman vs Beasts/Lair Beasts, Bard vs Humans, Wilmsry vs non-Magical, Elven vs Humans); `decideAction` tries their parley at round 1 before sing/summon/attack.
- `decideAction` gained, in priority order after flee/parley and drink: talk-first parley, Bard sing (`songReady`, level-1 scoped to Beasts/Lair Beasts), Summon in combat (round 1, no ally, charges remain), a Mirror Self round-1 opener (must precede the scoring table since an Illusionist can also learn Freeze), a Wizard strike-refused fallback (cast the lowest-lvl castable non-quake/death spell, else flee), the scoring table, then attack. Out of combat gained Summon (no pendingAlly, charges > half of maxCharges) and scroll reading (`canRead`).
- Two v1.1-baseline refusal loops fixed via `ctx.fleeBlocked`/`ctx.strikeBlocked` (set on `fleeRefused`/`strikeRefused`, cleared on `encounterStarted`, mirroring the existing `ctx.parleyBlocked` pattern): a Samurai below the flee threshold now fights instead of re-picking a refused flee forever; a strike-refused Wizard casts something else or flees instead of re-picking a refused attack forever.
- **Self-inflicted loop found and fixed during Task 1's own verification pass:** the new Mirror Self opener called `canCast` without checking charges left — a charges-exhausted caster whose grimoire still listed Mirror Self would loop `noChargesLeft` (no foe turn, round never advances) forever. Added a `chargesLeft > 0` guard; the six planning-time stuck seeds (three Samurai, three Wizard) now all finish under 3,000 actions.
- `playRun(seed, opts, onStep)` now forwards `opts.startDepth`/`opts.force` straight to `newRun` (HARN-04) and returns `stuck`, `outcome` (`"dead"|"won"|"stuck"|"unknown"`), `startDepth` (the sanitized value), `floorsGained`, and `encountersSurvived` alongside the pre-existing fields; `cause` is unchanged for backward compatibility. `reachTable`/`actionsPerFloorDist` exclude stuck runs; `casterRateByBand`/`abilitySummary` still count every run. `sharedJson` adds `stuck`/`completed` counts and `bot.startDepth`.
- `botLine(opts)` is now the single emitter of the ledger's grep-stable `Bot:` parameter line (original prefix byte-for-byte, `seeds`/`workers` appended only when present, `startDepth` always last); `printSharedReadout` uses it and prints a new `Stuck: N of M runs...` line directly before it.
- `test/unit/tuning-bot.test.js` gained 18 new tests (11 -> 29) covering every new policy branch, both refusal fixes, the stuck bucket, HARN-04 startDepth idempotency (seeds 1 and 20, `stripVolatileFields`-compared), and `botLine`'s contract. The purity test's mutation-check list gained a caster-combat state and a Bard state.

## chooseSpell scoring table (verbatim — Plan 22-04 transcribes this into the ledger's Bot proxy section)

```
KILL    (400+): "Freeze" -> 410 (frozenSolid on hit)
                kind==="death" -> 405, only when c.wp - 25 > fleeAt * c.maxWP
                kind==="turn"  -> 402, only vs Walking Dead
                kind==="gate"  -> 402, only vs Demons/Walking Dead
DAMAGE  (300 + expected damage, ties -> higher sp.lvl):
                expected(sp) = sp.dmg.n * (sp.dmg.sides + 1) / 2 + sp.dmg.bonus
                kind==="thrown"/"volley"/"acid": Lightning's expected x liveFoes(state).length;
                volley (Fireballs) x4.5 (mean d8 balls); acid (Acid) x2 (two rounds of ticks,
                skipped when the target already carries `acid`)
DISABLE (200+, only when liveFoes(state).length >= 2):
                stun 230, weaken 220 (skipped when C.weakened), shrink 215, status (Doze) 210,
                stupid 205
HEAL    (100 + expected heal, only when c.wp / c.maxWP < ctx.opts.potionThreshold):
                heal (Heal/Major Heal)
WARD-OPENER (50, only when C.round === 1 and !c.ward):
                ward (Shield/Bubble)
Never auto-cast: quake, vapor, insane, blind, petrify, might, regen, reveal, foresee, senses,
                 summon, mirror (handled by decideAction's opener rules, not this table)
Tie-break: higher sp.lvl, then lower SPELLS index (first found wins).
```

**Known discrepancy (documented, not a bug):** the plan objective's illustrative "Resulting order vs 1 foe" text lists Acid at 309, which is the *unmultiplied* expected value (2d6+2 -> 9, +300). The implemented x2 "two rounds of ticks" constant (per the same task's action-step text) yields 318. No test pins the literal score — only relative winner selection — and the plan's own flagged_planner_assumption explicitly places this exact constant at Claude's Discretion, so the x2 reading (matching the operative instruction) was kept; both readings pass every acceptance test unchanged since Acid never has to out-rank Fireball/Lightning in any assertion in this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the thrown-only cast rule with the sub-class-aware policy and fix the two refusal loops** - `0515ca4` (feat)
2. **Task 2: Thread startDepth/force through playRun and add the stuck bucket to the shared readout** - `dce3216` (feat)
3. **Task 3: Extend the bot policy tests** - `123fc75` (test)

_No TDD gating on this plan (`tdd` not set on any task)._

## Files Created/Modified

- `tools/lib/tuning-bot.mjs` - `chooseSpell`/`isTalkFirst`/`botLine` added; `findCastableAttackSpell` removed; `decideAction`/`makeBotContext`/`observe` extended for HARN-02; `playRun`/`reachTable`/`actionsPerFloorDist`/`sharedJson`/`printSharedReadout` extended for HARN-04's startDepth/force plumbing and the stuck bucket
- `test/unit/tuning-bot.test.js` - 18 new HARN-02/HARN-04 tests, one existing D-05 assertion updated to reflect the scoring table superseding the old thrown-only rule, purity test's mutation-check list extended

## Decisions Made

See `key-decisions` in frontmatter — summarized: Acid's x2 multiplier follows the plan's literal action-step text over its illustrative example numbers (documented discrepancy); a third refusal loop (Mirror Self opener missing a charges-left guard) was found and fixed during this plan's own verification, not pre-existing; `chooseSpell`'s death-gate reads `state.combat` defensively; the Wizard fallback's utility-spell ranking is a separate, simpler lvl-ascending pick since utility spells never receive a `chooseSpell` score.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mirror Self opener missing a charges-left guard, causing a new refusal loop**
- **Found during:** Task 1 (self-verification of the wizardStuck acceptance check)
- **Issue:** The Mirror Self round-1 opener step called `canCast(state, sp)` to decide castability, but `canCast` never checks remaining charges. A charges-exhausted caster whose grimoire still listed Mirror Self would have `castSpell` refuse with `noChargesLeft` (no foe turn, `C.round` never advances) every turn, looping until the action cap — the same shape as the two refusal loops this task set out to fix.
- **Fix:** Added an explicit `chargesLeft > 0` guard to the Mirror Self opener condition in `decideAction`.
- **Files modified:** tools/lib/tuning-bot.mjs
- **Verification:** `wizardStuck` acceptance check (seeds 926524/1195770/1274960 at maxActions=3000) went from 1 stuck to 0 stuck; full suite stayed green.
- **Committed in:** `0515ca4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix directly caused by this plan's own new code; no scope creep, no architectural change.

## Issues Encountered

- Initial test-writing pass placed `mirror`/`ward` overrides inside the synthetic `state.combat` object (via the `fight()` test helper's `extra` param) instead of on `state.c` — both fields actually live on the character (`c.mirror`, `c.ward`, set by `magic.js#castSpell`), not on combat. Caught immediately by the two failing tests it produced (Mirror Self round-2 case, Shield ward-up case); fixed by moving both overrides onto the `c` object before the Task 3 commit. No engine or `tuning-bot.mjs` code was affected — test-authoring only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tools/lib/tuning-bot.mjs` is ready for Plan 22-03's `tools/tune-classes.mjs` matrix CLI: `playRun`'s `startDepth`/`force` pass-through and `stuck` bucket are exactly what the 143-cell matrix (and its depth-20 slice) needs; `botLine`/`sharedJson` already carry `startDepth` so the matrix's own `--start-depth` flag (Plan 22-03) only needs to set `opts.startDepth`, not touch the readout plumbing.
- The `chooseSpell` table above is the canonical source Plan 22-04 transcribes into `docs/CLASS-PASS.md`'s ledger — no further reconciliation needed.
- No blockers. `npm test`: 978/978 (960 baseline + 18 new). Parity suite untouched (this plan touches only `tools/` and `test/unit/tuning-bot.test.js`, no engine/content files).

---
*Phase: 22-class-aware-harness-before-matrix*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: tools/lib/tuning-bot.mjs
- FOUND: test/unit/tuning-bot.test.js
- FOUND: SUMMARY.md
- FOUND commit: 0515ca4
- FOUND commit: dce3216
- FOUND commit: 123fc75
