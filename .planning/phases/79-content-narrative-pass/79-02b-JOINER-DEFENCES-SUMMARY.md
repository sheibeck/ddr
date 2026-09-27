---
phase: 79-content-narrative-pass
plan: 02b
status: complete
subsystem: engine combat (foe swings at a Joiner)
tags: [joiner, party, to-be-hit, foe-die, user-ruling-2026-09-27]
requires: [79-02]
provides:
  - "engine/derived.js#foeToHitVs/foeToHitBreakdown(state, vs, sheet): every personal term reads the body being swung at"
  - "engine/derived.js#foeSwingVsMember(state, f, sheet): the Joiner twin of foeSwingVsHero (one shared blind/Weaken/insult chain)"
  - "engine/derived.js#PARTY_WIDE_ITEM_EFFECTS: content-backed party-wide item effects (the Crystal Staff)"
  - "foeDie(sheet, f) on the member branch: the Joiner's own foeStrikeStep"
affects: [79.1]
tech-stack:
  added: []
  patterns:
    - "one rule, two bodies: the hero's and a Joiner's odds come from the same function, fed a different sheet"
key-files:
  created:
    - test/unit/joiner-defences.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/difficulty.js
    - docs/ROLL-LEDGER.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/rollDirection.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/hero-size-rules.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/roll-high-save-compat.test.js
    - test/unit/fixtures/roll-high/pre-switch-save.json
decisions:
  - "A Joiner's odds use the hero's own function with the Joiner's sheet as the body, so there is one source of truth per term and no second member-only chain"
  - "The Crystal Staff stays party-wide through a content-backed PARTY_WIDE_ITEM_EFFECTS list keyed by activation. The Cloak of Invisibility, the Invisible potion and Mirror Self stay personal because their text says 'you'"
  - "A Thief Joiner gets its own CLASS_MITIGATION evasion (identity 0, so it moves nothing today)"
  - "Side effect, accepted: ROLL-LEDGER finding O2 is resolved. A Joiner's Sidestep now comes before the Weaken cap, as the hero's does"
metrics:
  completed: 2026-09-27
  tasks: 1
  commits: 3
---

# Phase 79 Quick Fix 79-02b: Joiners Use Only Their Own Defences Summary

When a foe swings at a Joiner, only the Joiner's own race, size, sub-class, class evasion, gear and self-effects count now. The hero's Acrobat override, Guard −1, gear, Mirror Self, invisibility and Dwarven foe die no longer protect a Joiner. Battle Roar and the Crystal Staff still cover the whole party. The fix adds no rng draws.

**Base:** `90fa443e27c7fa9472e85481d210430b7182ea80`

## Commits

| Step | Commit |
|------|--------|
| RED: failing tests | b5f8882e |
| GREEN: the fix, re-pins, ledger and inventory | 3bd44340 |
| SUMMARY | this commit |

## How it works

- `foeToHitVs(state, vs, sheet)` and `foeToHitBreakdown(state, vs, sheet)` read every personal term from the body being swung at:
  - For `vs === "hero"`, that is the hero's sheet.
  - For `vs === "member"`, it is the Joiner's own sheet. A missing sheet counts as a blank body, and the hero's traits are never used.
- `foeSwingVsMember(state, f, sheet)` is the Joiner twin of `foeSwingVsHero`. Both share one private tail, `foeSwingChain`: blind, then the Weaken cap, then the insult last.
- The member branch of `engine/combat.js#foeTurn` now makes two calls: `foeDie(mSheet, f)` and `foeSwingVsMember(state, f, mSheet)`. The old hand-built chain (about 60 lines) is gone, so there is one source per term.
- `foeDie` accepts a missing sheet (step 0). A present sheet with no race still throws, because `src/browser/foeDetails.js` uses `safe(…)` and relies on that throw to drop the odds line for a minimal state. `foeDetails.test.js` pins this.
- The member branch passes `null` for a Joiner sheet with no known race row, so a hand-built or damaged Joiner reads as a blank body and does not throw (tolerant load). The check reads `RACES[sheet.race]`, never a race name.
- No race-name or sub-class-name check was added. The two sub-class checks (Acrobat, Guard) are the ones the hero always had, now read from the body. The size seam guard is tightened: `sizeAxisStep(` is called from derived.js only.

## Hero-only terms removed from a Joiner's odds

| Term (the hero's) | Before (base 90fa443) | Now |
|---|---|---|
| Acrobat override (need 3) | set the Joiner's faces to 3 | the Joiner's own Acrobat only |
| Guard −1 | −1 on the Joiner | the Joiner's own Guard only |
| Gear `eff(c, "foeToHit")` (Anklet of Invisibility) | −2 on the Joiner | the Joiner's own live item effects only |
| Mirror Self (`c.mirror`) | 1 face on the Joiner | the Joiner's own `mirror` only |
| Invisibility (Cloak of Invisibility, Invisible potion) | 1 face on the Joiner | the Joiner's own effect only |
| Race `foeStrikeStep` on the foe die (Dwarven) | the hero's race set the foe's die against the Joiner | `foeDie(sheet, f)`: the Joiner's own race |
| Race `foeToHit` and size | already moved by 79-02 and 75.2 | now read inside `foeToHitVs` from the Joiner's sheet (one seam) |
| Thief evasion dial | hero only | a Thief Joiner's own (identity 0) |

Sidestep and Smoke were already the Joiner's own. They now come from the same function too, which puts Sidestep before the Weaken cap for both bodies (ROLL-LEDGER O2, resolved).

## Party-wide effects kept (content grep)

| Effect | Source | Why it stays party-wide |
|---|---|---|
| Battle Roar (hero's or any live member's) | content/abilities.js `battleRoar` and content/skills.js "Battle Roar": "every foe needs two better to hit anyone on your side" | explicit party wording |
| Crystal Staff invisibility | content/treasure-tables.js STAVES: "party invisible d10+5 squares; enemies need a 1" | explicit party wording, via `PARTY_WIDE_ITEM_EFFECTS` (a test pins the key to a real activation whose text names the party) |
| Foe-side combat conditions: blind foe, Weaken (`C.weakened`/`C.foeToHitPenalty`), `parleyInsulted`, `FOE_ACCURACY` dial | engine/magic.js, engine/combat.js, engine/difficulty.js | conditions on the foe, not defences of a body, so they apply to every target |

These stay personal because their text says "you": Mirror Self ("defensive · you · foes need a 1 to hit"), the Cloak of Invisibility ("invisible for 50 squares"), the Invisible potion ("invisible for a day") and the Anklet.

The grep also turned up the Poplar Staff ("1d20+10 hp to up to 6"). It is a heal, not a defence, so it is out of scope.

## Moved set (measured at the base, then after the fix)

- **Parity:** 66/66. Fixtures, `comparables.js` and the prototype master are unchanged (`a1f4d0dc…`), and the fixture roster JSON is byte-identical.
- **State pins:** one moved, `party-fighter-knight` (seed 606).
  - The first divergence is bot step 99. The Joiner, Hilda Stonecut, is a Dwarven Fighter/Woodsman beside a Human Knight hero.
  - The foe's die against her was d20 (the hero's race). It is now her own Dwarven d12, with atLeast going from 17 to 9.
  - Depth goes from 3 to 4. The draw is the same and in the same position.
  - The other seven labels are byte-identical.
- **Pre-switch save:** only `expected` was re-recorded.
  - The first divergence is dispatched index 98. The hero is an Elven Thief/Acrobat; the Joiner, Denn, is a Wilmsry Magic User/Apprentice.
  - The hero's Acrobat override (atLeast 18) no longer shields Denn, so the same roll of 17 now lands.
  - Depth goes from 4 to 3, and the hash from `70f1de84…` to `ab8b28cb…`.
- Both divergences were traced against an extracted base tree (`git archive 90fa443`), diffing each step's events.
- **Re-pinned unit rows:**
  - `feedback-payload.test.js` pinned the hero's Guard −1 on the member's swing (the leak). The member is now the Guard, and a Guard hero's plain member is pinned mod-free.
  - `hero-size-rules.test.js`: the `sizeAxisStep` caller audit no longer lists `combat.js#foeTurn`.
- **Unchanged:** `bot-tactics`, `foe-turn-draw-count` and `test/determinism/**`.
- **Informational sweep** (24 forced party seeds): 13 moved and 11 are identical. Balance is Phase 79.1's job, and no bot balance runs were done, per the user ruling.
- **Declared** in `test/parity/FIXTURE-INVENTORY.md` under `## Phase 79` / `### Joiner defences (user ruling 2026-09-27)`.

## ROLL-LEDGER

- Site row 26 (the foeTurn member branch) now lists the new ids.
- New foe-vs-member rows:
  - `hero-defences`
  - `elven`
  - `acrobat`
  - `guard`
  - `gear-foe-to-hit`
  - `mirror-self`
  - `invisibility`
  - `party-invisibility`
  - `thief-evasion`
  - `dwarven-foe-strike-step`
- Each row has a matching direction test in `rollDirection.test.js`, and `roll-ledger-sync` is green.
- The `member-sidestep` row and findings O1 and O2 are marked resolved, and size-audit row S2 has been updated.

## Member odds display check

No surface shows a Joiner's odds.
- **Foe details card:** reads `rollOdds.js#foeHitOddsVs`, which is `foeSwingVsHero` on `foeDie(state.c, foe)`. That is against the hero only, and the hero's path is unchanged.
- **YOUR LOT member chips:** come from `engine/derived.js#memberConditionsOf`, which reads only the member's own ability timers and Brace. No odds are shown, and no hero effect is claimed on a member.
- **`conditionEffects.js` what-if:** hero only.
- **Oracle `memberStruck`/`foeMissed` lines:** read the event's `mods`. The mod names a Joiner can now carry (Acrobat, Guard, gear, Mirror Self, invisible, evasion, its race) are the same names the hero's breakdown already emits.

No shell file needed a change.

## Deviations from Plan

1. **[Rule 1] Tolerance for a race-less sheet.** Making `foeDie` fully tolerant surfaced odds lines in `foeDetails.js` for a minimal state that is pinned to return null. Keeping it strict crashed `spell-mechanics.test.js`'s race-less Joiner. The resolution: `foeDie` accepts only a missing sheet, and the member branch passes `null` when the Joiner has no race row. `joiner-defences.test.js` pins the tolerant-load case.
2. **[Rule 2] A comment in `engine/difficulty.js#classEvasionFor`** said "never a party member". I updated it to the ruling (comment only).
3. **[Rule 3] Tests outside the listed set were re-pinned:** `feedback-payload.test.js` and `hero-size-rules.test.js`, as described above.
4. **Side effect: ROLL-LEDGER O2 is resolved.** Sidestep and Weaken now apply in one order for both bodies, because both read one function.

## Gates

- `npm test`: 7,368 tests, 7,367 pass, 1 fail. The one failure is the known `voice-corpus.test.js` "standing: every docs/narrative-pass/why/*.json ledger…" test, which another agent owns.
- Parity (`node --test "test/parity/**/*.test.js"`): 66/66.
- I did not run `boot:check`: this worktree has no built `www/`, and no shell file changed.
- A temporary `node_modules` junction to the main checkout was used and removed afterwards.

## Known Stubs

None.

## Threat Flags

None. The change is pure arithmetic over existing serialized fields, with no new state fields and no new surface.

## TDD Gate Compliance

RED `test(79-02b)` b5f8882e comes before GREEN `fix(79-02b)` 3bd44340. At the base, RED failed 8 of 10 unit rows and 8 of the new direction rows.

## Self-Check: PASSED

- `test/unit/joiner-defences.test.js` and this SUMMARY exist.
- Commits b5f8882e and 3bd44340 are on the branch, and neither deletes a file.
