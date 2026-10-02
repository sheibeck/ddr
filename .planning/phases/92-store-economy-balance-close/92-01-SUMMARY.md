---
phase: 92-store-economy-balance-close
plan: 01
subsystem: tuning-bot
tags: [tuning-bot, bot-fixes, camp-gate, cloak-of-regeneration, usage-tally, cutpurse, bot-coverage, TUNE-10, ECON-11]
requires:
  - phase: 88-04
    provides: the Cloak of Regeneration as a heal over time (act.hot), the 88-04 finding this plan acts on
  - phase: 89-06
    provides: the Joiner camp stall finding (hero-only camp gate vs makeCamp's nightlyEats)
  - phase: 89-07
    provides: chooseMemberItem and the member-tagged itemUsed the tally mixed up
  - phase: 91.1-02
    provides: Cutpurse as a real strike that lifts gold (V11)
provides:
  - the fair bot's camp gate reads nightlyEats(state): a Joiner run no longer loops campFailed
  - the Cloak of Regeneration played as a heal over time (hero and Joiner), the out-of-fight potion waits on a live knit window
  - usage.memberItems, a Joiner's item uses counted apart from the hero's
  - Cutpurse played in any round as the never-worse-than-STRIKE fallback
  - the v2.3 bot-coverage table in docs/DIFFICULTY-RETUNE.md (Phase 92 H2)
affects: [92-02, 92-04]
tech-stack:
  added: []
  patterns: [bot-only fixes with hand-built probes plus one bounded real-run probe, moved pin traced against a git archive of the base and pasted by label]
key-files:
  created:
    - test/unit/bot-balance-close.test.js
  modified:
    - tools/lib/tuning-bot.mjs
    - tools/lib/class-matrix.mjs
    - tools/lib/days-farm.mjs
    - test/unit/tuning-bot.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/days-farm.test.js
    - test/unit/class-matrix.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/DIFFICULTY-RETUNE.md
decisions:
  - "The cloak trigger is missing hp >= knitWindowHeal (3 x d6 = 10.5, read from act.hot) OR below potionThreshold; a knit item with no hot record keeps the threshold test alone"
  - "The hero's out-of-fight potion waits only while its own knit window is live (itemEffectActive(c, \"knit\")); the camp gate after it is unchanged"
  - "days-farm's camp guard stays as a zero-cost regression counter (campGuard column kept), its tests assert the stall is gone"
  - "Cutpurse is added to the never-worse-than-STRIKE fallback beside Pommel Strike; the damage branch already played it against a foe above half hp"
metrics:
  tasks: 3
  commits: 3
  completed: 2026-10-01
status: complete
---

# Phase 92 Plan 01: the three bot fixes, Cutpurse and the v2.3 bot-coverage table Summary

The fair bot now camps on the whole party's nightly need (`c.rations >= nightlyEats(state)`), plays the Cloak of Regeneration as the heal over time it is, counts a Joiner's item uses apart from the hero's (`usage.memberItems`), plays Cutpurse as its strike fallback, and the Phase 92 H2 of `docs/DIFFICULTY-RETUNE.md` records how the bot plays every v2.3 rule the readout and the pass lean on. Bot-only: no engine, content, shell or parity-fixture byte changed, and no balance readout was run.

## What was built

**Task 1 (32c93162): the camp gate.** `decideAction` camps below `campThreshold` only when `c.rations >= nightlyEats(state)`, the number `makeCamp` refuses on. `RACES` left the import list (no longer read). Probes `camp gate:` in the new `test/unit/bot-balance-close.test.js` (a solo hero camps at its own appetite; with a Joiner, rations at the hero's appetite do not camp, at `nightlyEats` they do; a seed that used to loop `campFailed` now dies with none). The stall-swapped seeds were re-measured live and restored: tuning-bot water routing `[3, 5, 6]` to `[1, 4, 5]`, bot-tactics Sorcerer `[6, 2, 5]` to `[1, 2, 3]`, Troll Knight `[5, 2, 1]` to `[1, 2, 4]` (Pilfer trio left). days-farm's guard stays as a regression counter with a dated comment; its two tests now assert the stall is gone (`campGuard` 0, `campFailed` 0 on seed 863172, plus the mirror case).

**Task 2 (a6faf337): the cloak, the tally, Cutpurse, the coverage table.**
- `knitWindowHeal(it)` (exported) reads the item's own `activationFor(it).hot` (3 ticks x 3.5 = 10.5). `chooseFieldItem` and `chooseMemberItem` use a ready worn knit item once the missing hp covers it or the wearer is below `potionThreshold`; the hero's potion out of a fight waits while its own knit window is live (a Joiner's own live window is skipped). JSDoc rewritten for a heal over 30 squares.
- `makeTallies().usage` gains `memberItems`; `tallyUsage` routes an `itemUsed` that carries `member` there and never to `items`; `tallyIdentity`'s potion branch is guarded the same way; `class-matrix.mjs#aggregateUsage` rolls up a fourth category. The other usage events (`abilityUsed`, `toolUsed`, `scrollCast`) are hero-only in the engine (checked at every push site), so they needed no routing.
- Cutpurse joins Pommel Strike in `chooseAbility`'s never-worse-than-STRIKE fallback (the damage branch already played it against a foe above half hp; the fallback plays it in every other round).
- `docs/DIFFICULTY-RETUNE.md`: new H2 `## v2.3 balance close (Phase 92) — bot readouts` placed before `## v1.2 retune (Phase 27)` (still the last H2), with `### Phase 92 — the bot plays the v2.3 rules (92-01)` and a 25-row `Rule | Bot path | Verdict` table (4 `fixed here (92-01)`, 3 `not played: ...`, the rest `plays it`).

**Task 3 (8ce12781): measure, declare, regenerate.** The targeted gate (28 files, 531 tests) had exactly one failure, the `deep-14` state pin; it was traced against a `git archive` of the base and re-pinned alone, pasted by label (`save` never run). The `### Phase 92 plan 01` entry in `test/parity/FIXTURE-INVENTORY.md` declares it.

## Seeds restored or kept (measured live at identity dials, final bot)

| Test | Seeds | Measured |
| --- | --- | --- |
| tuning-bot water routing (1500 actions) | `[1, 4, 5]` restored | seed 1: dies at 1216 (depth 10, day 17); seed 4: dies at 527 (depth 6, day 7; was stuck at depth 5 with 1032 `campFailed` on the base); seed 5: dies at 673; all wade; seeds 3 and 6 also die (619, 322) |
| bot-tactics Sorcerer (5000 actions) | `[1, 2, 3]` restored | seed 1: 409 (depth 3; was stuck at depth 6 with 4216 `campFailed` on the base); seed 2: 1202 (depth 9); seed 3: 673 (depth 5); seeds 4, 5, 6 also die (318, 410, 107) |
| bot-tactics Troll Knight (5000 actions) | `[1, 2, 4]` restored | 586, 554, 418 actions, all die, 0 `campFailed`; seeds 3 and 5 die too (727, 453) |
| bot-tactics Pilfer | `[5, 3, 4]` kept | swaps were not camp-related |
| days-farm seed 863172 | pin kept | `campGuard` 200 on the base, 0 now; `campFailed` 0; dead at 915 either way |

## Moved labels

One state pin moved: `deep-14` 46 actions, dead, depth 14, `bbd29b1f...` to 48 actions, dead, depth 14, `e4802ee0...`. Cause (per-step trace against the base): at step 9 the Acrobat Thief stands at 75 of 89 hp (14 missing, ratio 0.84, above `potionThreshold`) and now uses its Cloak of Regeneration where the base walked on. The other seven labels are byte-identical (pins run twice). `roll-high-save-compat` passes untouched. Unit pins re-based: the three usage-shape pins (two in bot-tactics, one in class-matrix) and the days-farm guard tests.

## Bot findings (for the orchestrator; none needs an engine change)

- No new stall shape. The Joiner camp stall is the only one the probes found and it is gone: across the 17 measured runs above `campFailed` is 0 everywhere. Sorcerer seed 7 (not used by any test) still ends stuck at 5000 actions at depth 15 (day 25) with 0 `campFailed`: that is a long-lived deep run, not the camp loop (it was stuck with 2930 `campFailed` events on the base at depth 14).
- Eight scratch Thief/Pickpocket runs (identity dials, 3000 actions): none stuck, 38 extra drops, 49 `bagFull` events, 31 piles taken and 28 left, no loop: the Pickpocket's extra item is handled by the existing loot/`findFull` path.
- A Thief's round-1 `opener` slot is shared by Dirty Trick, Silent Step, Hamstring and Mark and `chooseAbility` takes the first ready one in kit order, so Silent Step is only played in round 1 when it comes first. Pre-existing; noted for the 92-04 read of the Thief rows.
- Readout caveats carried into 92-02: the bot never buys repairs and never sells (pre-existing simplifications, kept so the fair bot stays the bot the curve was fitted with); the ECON-11 readout should report the bag's sale value beside the gold held.
- The cloak change is a deliberate behaviour move: the bot now spends a cloak earlier (missing hp covers 10.5) and a hurt hero with a live window walks instead of drinking. A hero at very low hp with potions in the bag and a live window will walk up to 30 squares before a potion (the ruled shape, not softened).

## Fixture drift

- `test/parity/prototype-master.js.txt` not touched; `git diff --stat 710c3359 -- engine content src mazeworld.html test/parity/prototype-master.js.txt test/parity/fixtures` prints nothing; parity glob 66 / 66.
- State pins: 1 of 8 moved (`deep-14`), declared under `### Phase 92 plan 01` in `test/parity/FIXTURE-INVENTORY.md`, regenerated alone from `node tools/roll-high-baseline.mjs pins`; `roll-high-baseline.mjs save` never run. The only `Phase 92 plan 01` mention in `test/unit/roll-high-state-pins.test.js` is that label's comment.
- No new serialized field (`memberItems` lives on the bot's own tallies); DRAW_INVENTORY and the roster block untouched.
- `docs/DAYS-FARMING.md` and `docs/days-farming/days-farm.json` (a frozen Phase 82 measurement) were not touched.

## Deviations from Plan

None to the plan's rules. Notes: (1) the plan's Task 1 numbers (`1392 actions` for Sorcerer seed 1) moved with Task 2's cloak change (409 actions, depth 3); the comments carry the final-bot numbers. (2) The Cutpurse fallback is a one-line extension, because the damage branch already played Cutpurse against a foe above half hp (recorded in the coverage table). (3) `bot-joiner-items.test.js` needed no edit: its probes sit below `potionThreshold` or at a full heart, which the new trigger leaves unchanged; the new trigger is pinned in `bot-balance-close.test.js`.

## Known Stubs

None.

## Threat Flags

None (bot-only tooling; no network, auth or schema surface).

## Human verification (deferred to end of run)

1. None on the device: this plan changes only the tuning bot. At milestone close, skim the `### Phase 92 — the bot plays the v2.3 rules (92-01)` table in `docs/DIFFICULTY-RETUNE.md`: every rule you play with is listed, and the "not played" reasons read fair.

## Self-Check: PASSED

Verified present: `tools/lib/tuning-bot.mjs` (`export function knitWindowHeal`, `c.rations >= nightlyEats(state)`), `test/unit/bot-balance-close.test.js`, the `## v2.3 balance close (Phase 92)` H2 (last H2 is still `## v1.2 retune (Phase 27)`), `### Phase 92 plan 01` in `test/parity/FIXTURE-INVENTORY.md`; commits 32c93162, a6faf337, 8ce12781 all on master; the targeted gate 531 / 531 and parity 66 / 66.
