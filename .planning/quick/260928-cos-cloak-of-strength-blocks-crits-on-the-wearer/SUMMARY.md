---
quick_id: 260928-cos
status: complete
date: 2026-09-28
---

# Quick 260928-cos: the Cloak of Strength blocks crits on the wearer (summary)

(The orchestrator wrote this from the executor's returned text. Commits: 4dc96b7b (the failing tests), a6e6c6b6 (the rule, chip and narration), b9a1c474 (the ledgers and docs). Merged in fcba6ecf.)

**Result:** the Cloak of Strength now does what its text says. While its effect is live, a foe's critical hit against the wearer lands as an ordinary hit, and the Oracle and rail say so. The wearer's own crits are back; before this fix, the cloak blocked them by mistake. The cloak has its own "Crit-proof" chip and no longer uses "Braced".

## What changed
- **Content:** the cloak is `eff: { critWard: 1 }` and `act: { kind: "critWard", effect: 50, cd: 50 }`. Its txt was already accurate.
- **Engine:**
  - `derived.js#critWardOf(c)` returns the name of the live warding item, or null. Like `eff()`, it reads only the timer records.
  - `noCritFor` now covers only Guard and Soldier.
  - `combat.js#wardCrit` is called at every site where a foe crit lands on a body: foeTurn's hero branch (Soldier's extra crit face included), foeTurn's member branch (it reads the Joiner's own sheet), and pursuitStrike.
  - `playerStrike` drops the cloak from the wearer's own-crit ban.
  - **No random draws moved.** The crit is read off the to-hit roll that was already drawn; only the doubling is dropped.
- **UI:**
  - The chip is "Crit-proof" (squares, good tone). Its tap line reads: "No critical hit lands on you: a foe's best roll is an ordinary hit. Ordinary hits still count."
  - Oracle: "Your Cloak of Strength turns Wolf's critical aside: 20 on the d20, an ordinary hit instead. The cloak will not let anyone forget it."
  - Rail: "Your Cloak of Strength turns Wolf's critical into an ordinary hit (20 on the d20)."
  - The Fighter's Brace keeps its own "Bracing" chip.
- **Bot:** the round-1 buff list renames the kind only.

## Tests
New file `test/unit/cloak-crit-ward.test.js`, 14 tests:
- A top-face swing at a wearer deals 31, not 37, and uses the same 2 draws.
- Without the cloak, or worn but unused, the crit lands.
- The Soldier's two crit faces are both warded.
- A pursuer's parting crit is warded.
- Armour soaks the ordinary amount.
- A Joiner is protected by its own cloak only.
- The wearer's own crit returns.
- Guard and Soldier never crit.
- The chip and use lines are right.
- An old save whose cloak carries `eff.noCrit` loads, and the ward holds.

## Deviations
- **Joiners get no chip.** No Joiner can use an item today, so a warded Joiner can't happen in play. The engine path is still tested.
- **An inverted pin was rewritten** in `item-wiring.test.js`, which pinned the old bug.
- **Renamed kinds and payloads** were carried into item-activation, bot-tactics, upgrade-why and identity-contract.
- **Two `PINNED_OUTSIDE_CONTENT` rows** were added to authored-ranges for the new "N on the dN" wording.
- **The frozen `tools/lib/event-variants.mjs` was left untouched.**

## Measure and re-pin
- **Fixture inventory:** byte-identical.
- **State pins:** all 8 byte-identical.
- **Parity:** one declared record moved, data only: action-script.movement's chargenDivergence `worn.cloak.eff` is now `{critWard:1}`. Parity is 66/66 with no carve-out.
- **Old saves:** no migration needed, because `eff()` and `critWardOf()` read the content through ACTIVATION_OF.
- **Records:** FIXTURE-INVENTORY has the appended subsection. `docs/ROLL-LEDGER.md` has a closing section. The why ledger is `q-260928-z2-cos.json`. GEAR-BALANCE, GEAR-SLOTS and ABILITIES are corrected.

**Gates (in the worktree):** npm test passed 7,637/7,637, parity passed 66/66, and build:www plus boot:check passed.
