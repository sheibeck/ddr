---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
status: passed
verified: 2026-09-26
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 12/12 requirements
human_verification:
  - "RULES-01: pulling '+25 HP' twice on one hero gives two equal flat steps (linear, not compounding)"
  - "RULES-02: a floors 1–3 red-dot wilmst cache pays about 100 × depth, not a store buy-out"
  - "RULES-03: a level-1 Summoner rolls and casts an offense spell; a new Warlock/Apprentice never holds a spell that says 'not open to you yet'; a Summoner casting Heal restores about half what a Cleric's does (minimum 1)"
  - "RULES-04: the combat SPELLS menu has no row at all for a level- or school-locked spell; an out-of-charges spell stays listed and disabled; the Hero-tab Grimoire still lists everything"
  - "RULES-05: with Sense Presence on a dark square the Oracle reads 'You felt them coming. You go first.', never 'You cannot see what you are fighting', and a crit can land in the dark"
  - "RULES-06: a floor-2 trap at about 21 HP never kills on a '−1 HP' line; after a fight where a foe swings twice, the YOUR LOT card and the top HP bar agree"
  - "RULES-07: an ailment roll of 5 or 6 reads as a fear or phobia, not 'Disease.'"
  - "RULES-08: swapping new armor over a destroyed worn piece says the old piece was destroyed and is gone (and the Gear sheet warns before the swap)"
  - "RULES-12: a wanderer that interrupts a step onto a chest/trap/exit is fought first, then the tile still resolves once the fight and any spoils settle"
  - "RULES-13: a Magic User's bagged staff shows NOT WIELDED on the Gear tab and combat ITEMS and does nothing when tapped; a wielded staff fights as a d8 melee weapon and its charged power works from the weapon slot"
  - "RULES-14: casting Bubble throws the next hit back at the attacker in full, then pops into a small (~25 HP) pool that soaks the rest of that round"
  - "RULES-15: an unfed 100-square day or camp leaves a spent spell book empty (and says why) until the party actually eats; the 20-square trickle still works"
---

# Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs: Verification

**Verdict:** passed on automated evidence. The device checks above are batched into the milestone-close Pixel 7 checklist.

## Requirement coverage

| Req | Evidence | Status |
|-----|----------|--------|
| RULES-01 | 75-02: Table-4 HP dots are verified linear at identity and at the shipped dials. 13 pins in `hp-growth-linear.test.js`; no code change was needed (Phase 54 had already flattened it) | ✓ |
| RULES-02 | 75-02: `WILMST_CACHE_PER_DEPTH` 300 → 100, still through `lootFor`, with no new draw. Readout: survival unchanged, gold down (L20 11,584 → 9,664) | ✓ |
| RULES-03 | 75-05: the Summoner offense gate is deleted, and `grantableAt` applies the school gate on all four grant paths (the accepted reading is school gate only; canon grants are kept). 75-10: Summoner `healMul: 0.5` as chart data, applied to Heal and the Regeneration tick (floor, min 1), with 15 tests | ✓ |
| RULES-04 | 75-03: the combat SPELLS menu filters through the engine's `canCast`. Locked spells are hidden, and out-of-charges spells stay visible and disabled. The Hero-tab Grimoire is unchanged | ✓ |
| RULES-05 | 75-06: `c.senses` joins the unconditional "you go first" branch, and `combatInDark` and the dark no-crit rule honour senses | ✓ |
| RULES-06 | 75-01: an explicit root-cause session (500 engine seeds plus an 8-path shell audit) found that the 2026-09-22 `planBeat` last-frame fix fully explains the symptom, with no new cause. 75-08: standing guards (boundary cases, an engine loss-narration sweep, and `hp-surface-guard.test.js` across all 8 beat-ending paths). The debug session is closed as resolved | ✓ |
| RULES-07 | 75-04: an ailment roll of 5–6 narrates `AFFLICTIONS[…].phobia` on the Oracle and the rail. The engine and content are unchanged (canon kept) | ✓ |
| RULES-08 | 75-04: the `destroyedArmorPiece` helper and an additive `{discarded, destroyed}` payload on `equipItem`, `takeLoot` and `takeItem`, plus paired narration and the Gear sheet warning | ✓ |
| RULES-12 | 75-12: `resolveFeature` is the one dispatch. `state.pendingTile` is recorded on an interrupted step and resolved by `resolvePendingTile` after combat, spoils, a find or the store settle, if the hero is still on the tile. It is transient until Phase 76 and carved out of the comparables | ✓ |
| RULES-13 | 75-07: `STAFF_WEAPON` (d8) and `weaponRow` / `wieldedStaff`, with wield and unwield on every weapon path and save tolerance. 75-09: a bagged staff is refused as `notWielded`, and the bot wields staves. 75-11: the Gear tab, gear sheet, hero sheet and combat ITEMS show WIELDED, EQUIPPED or NOT WIELDED | ✓ |
| RULES-14 | 75-06: Bubble is `{mirror: true, popPool: 25}`. It reflects the full next blow through `damageFoe(kind: "reflect")`, then pops into a one-round pool. Shield is byte-identical, and old reflecting-ward saves tolerant-load | ✓ |
| RULES-15 | 75-12: the `newDay` book refill (hero and members) moved into the fed branch. `wentHungry.booksKept` and `rationsEaten.refilled` are narrated, and the 20-square trickle is unchanged | ✓ |

## Automated gates

- Full `npm test` on master after the final merge: **6218/6218 pass, 0 fail, 0 todo** (up from 5,986 at the Phase 74 close).
- Parity: **56/56 pass**. The prototype master hash is unchanged (`a1f4d0dc…`).
- **Moved fixtures:** only 75-05's, which are declared and regenerated: chargen seeds 24 and 29, and the combat `lose-apprentice` scenario (seed 127). Seed 15 was predicted but did not move. Every other plan measured zero.
- The `divergence-records` exposure guard proves that no other Phase 75 rule reaches a fixture replay, and a companion test proves the guard can actually fail.
- **Declared state-pin re-pins,** each traced to the rule that moved it, with comments: 75-02 (gold only), 75-05 (gated Magic User sub-classes) and 75-12 (the `solo-thief-pilfer` tile resume). The Phase 72 direction tests are unedited.
- **Readouts:** the ledger is in `docs/DIFFICULTY-RETUNE.md` (the v2.1 Phase 75 H2), machine-checked against `tools/readouts/75-*.txt`. Mean death depth went 7.87 → 7.54, and the median held at 7, inside the floors 5–7 average-run target. No dial was retuned.
- `npm run boot:check`: 4/4 PASS on master.

## Notes

- **Accepted planner calls:**
  - RULES-03 legality is the school gate only.
  - A wielded staff is not magic against magic-only foes.
  - A Summoner's Heal scroll heals half.
  - A fled hero still triggers the pending tile.
  - `pendingTile` resets on load until Phase 76.
- **Logged for later:**
  - Heal lines narrate the raw roll, not the clamped gain (todo for Phase 79).
  - The hero sheet damage range omits some bonuses (todo).
  - An Elven Joiner never gets thin bones (todo).
