---
quick_id: 260928-hrs
status: complete
date: 2026-09-28
---

# Quick 260928-hrs: hero resist on the half-intel scale, and duration abilities last their stated rounds (summary)

(The orchestrator wrote this from the executor's returned text. Commits: 65283e34 (the engine and tests), 8c55ac37 (the copy, ledger and re-pins), 638a7f3c (the duration fix). Merged in b1515781, where the ROLL-LEDGER and FIXTURE-INVENTORY append conflicts were resolved by keeping both sections.)

## (A) The hero resists on the half-intel scale
User ruling: "Use the same half-intel scale for heroes now."
- **One helper for both sides.** `engine/derived.js#resistFaces(intel)` = max(1, round(intel/2)), and `resistRoll` is one roll-high d20 with no gate.
  - `foeSpellResistFaces` and `foeSpellResistRoll` were folded in.
  - The old canon p.25 gated `resistRoll` (INT 12+, faces INT−1) is deleted.
  - `foeSpellResistCheck` stays as the foe-only wrapper on its own random stream.
- **Draw position.** The hero still draws on the main stream, in canon's slot: after the ability gate's d6, before the effect's dice.
  - A hero with intel 12+ draws where it always did; only the threshold changed.
  - A hero below 12 now draws one d20 in that slot.
- **Events and copy.**
  - `heroResisted` and `heroResistFailed` fire on every roll and carry `faces`.
  - The rail lines add "(roll vs range, intel n)".
  - authored-ranges pins intel 1, 2, 6, 10, 16, 18 and 20.
- **Ledgers.** `docs/ROLL-LEDGER.md` has a new section, row 46 and `[resist:intel]` are rewritten, and `[resist:intel-gate]` is retired. SPELLS.md is updated. The why ledger is `q-260928-z3-hrs.json`, 2 rail rows.

## (B) Duration abilities last their stated rounds (the Smoke chip)
**Cause:** using an ability takes the round's action. The foes' turn in that same move ran with the effect active, then ticked the fresh timer before the player saw the chip, so the chip first read 1.

**Fix:** `abilities.js#abilityEffectTicks`. A "for N rounds" ability starts at N + 1, so it covers the use round's foe turn plus N full rounds, and the chip counts N → … → 1. Joiners get the same through `combat.js#startMemberAbilityTimer`.

| Ability | Foe turns covered before | After | Chip right after use |
|---|---|---|---|
| Sidestep | 2 | 3 | 2 (was 1) |
| Battle Roar | 2 | 3 | 2 (was 1) |
| Smoke | 2, 1 free flee | 3, 2 free flees | 2 (was 1) |
| Riposte | 1 | 2 | 1 (was none) |
| Taunt | 1 | 1 (unchanged; its text says "this round") | none |

New file `test/unit/ability-duration-rounds.test.js`, 11 tests; abilities and your-lot-chips pins are updated. The change is recorded in ABILITIES.md.

## Re-pins (traced)
- **Fixture inventory:** byte-identical after (A) and after (B). No replay reaches a hero resist, so there is no carve-out.
- **State pin party-fighter-knight:** 200/dead/2 → 180/dead/2. Its intel-2 Knight never rolled under canon; the first roll is bot step 139, Krupke's Weaken (10 vs 20, failed). The other seven labels are byte-identical.
- **FOE-09 full fights** (seed 1's hero has intel 20: canon resisted on 2–20, now 11–20):
  - magical-t4: 35/4 → 35/3, still won
  - walking-dead-t5: 48/3 → 36/2, still died
  - beasts-t5: 73/6 won → 48/3 died
  - humans-t2 and demons-t5 are unchanged
  - all five per-visit logs moved, because seed 3's intel-2 hero now rolls
- **Unit draw pins:** +1 d20 per hero-targeted ability in foe-abilities, foe-turn-draw-count, foe-cadence and condition-roll-mods. The DRAW_INVENTORY count for derived.js goes 3 → 2.

## Flags for the user
1. **Joiners still don't resist.** No Joiner resist existed, so adding one would be a new rule.
2. **Riposte got longer** ("for one round" now covers the use round plus one more). **Taunt did not.**

**Gates (in the worktree):** npm test passed 7,635/7,635 and parity passed 66/66. build:www passed. boot:check failed its `graves` check on the first run (no cause captured) and passed on two reruns.
