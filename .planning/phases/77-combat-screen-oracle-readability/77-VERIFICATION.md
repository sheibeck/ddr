---
phase: 77-combat-screen-oracle-readability
status: passed
verified: 2026-09-26
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 8/8 requirements
human_verification:
  - "In a fight, open SPELLS, ABILITIES, ITEMS and SOCIAL: every row shows its whole label and description inside its border at the S, M and L text sizes."
  - "SPELLS lists level 1 A to Z (a Summoner's Lesser Summon among them), then level 2, and so on."
  - "Wear a ring and carry a cloak in the bag. The ring row reads 'EQUIPPED · READY' and works; the cloak row is greyed and reads NOT EQUIPPED with its reason. The ITEMS count matches the rows you can use."
  - "THE FIGHT SO FAR and the round strip read in the order things happened: a riposte round reads miss, then 'pays', then 'falls'. Only identical back-to-back lines fold into ×N."
  - "Fumble a Shield scroll (low-INT non-Magic-User): the targeted foe shows 'SHIELDED · n' and its long press explains it. A fumbled Mirror Self shows 'MIRRORED · n', and the long press gives the range you now hit it on."
  - "A Magic User reading a too-advanced scroll sees the cast first and then 'Too advanced to copy into your book', never a refusal, on the ORACLE tab, the fight log and the rail."
  - "Every foe card shows its family after its name ('ZIT · BEASTS'), and a deep elite reads 'DREAD … · FAMILY'."
  - "Tap the oldest row of a long THE FIGHT SO FAR: it reveals its table dice, fully visible above the gesture bar."
  - "Use Smoke: the hero card shows 'SMOKE · n', which counts down and clears. Tapping it explains the effect, what Smoke does, the rounds left and the source. Tapping mid-round opens the card without skipping the round. Party members' chips show under them in YOUR LOT."
  - "When dazed, the strike's roll line lists 'dazed −2'. The onset reads '−2 to hit for N rounds', weakened says your blows do half damage, and both fades say the effect ended. With a torch in the dark there is no dark term; without one, 'dark −3'."
---

# Phase 77: Combat Screen & Oracle Readability — Verification

**Verdict:** passed on automated evidence. The device checks are batched into the milestone-close Pixel 7 checklist. The full per-plan lists are in the 77-0x SUMMARYs.

## Requirement coverage

| Req | Evidence | Status |
|-----|----------|--------|
| CMBUI-07 | 77-01: combat submenu rows grow to fit (`flex:none`, wrapping label and description, a 13px pad), measured in headless Chrome at 412px; `combat-submenu-fit.test.js` | ✓ |
| CMBUI-08 | 77-01: SPELLS sort by effective level (`spellLevelFor`), then name, and the LVL label matches | ✓ |
| CMBUI-09 | 77-06: `foeFamily(foe)` puts "NAME · FAMILY" on the card, with the same bestiary test as foe details; `foe-family-card.test.js` | ✓ |
| CMBUI-10 | 77-02: the event-order fold (`order:"event"`) for the fight log, round strip and beats. The rail keeps its priority fold, byte-identical over a 182-case corpus | ✓ |
| CMBUI-11 | 77-05: the scroll cast-then-copy-note fold (`scrollCopyChain`) and the Oracle stamp (`stampScrollCopyNotes`); the rail title becomes "NOT FOR THE BOOK"; 21 tests on the real engine | ✓ |
| CMBUI-12 | 77-06: the oldest fight-log row carries the same action's `encounterRolled` dice, with scroll-into-view hardening | ✓ |
| CMBUI-13 | 77-03: `conditionsOf` / `memberConditionsOf`, the `heroConditions.js` table and coverage guard, and measured "instead of" text. 77-04: foe chips for every fumble-given effect, plus long-press odds. 77-07: `toHitBreakdown` puts condition terms into the strike mods, with honest dazed and weakened onset and fade lines. 77-08: the YOUR LOT chip rows and the shared label and tap-text composition | ✓ |
| CMBUI-14 | 77-01: ITEMS marks worn rows EQUIPPED and greys bagged wearables (NOT EQUIPPED, matching the engine's notWorn check); the count covers usable rows only | ✓ |

## Automated gates (master 53894a7e)
- `npm test`: **7015/7015**. Parity: **64/64**. `boot:check`: PASS.
- The engine changes are 77-03's enumerators and 77-07's event payloads and `toHitBreakdown`. Every roll, face, draw and state is byte-identical, a zero recorded under `## Phase 77` in FIXTURE-INVENTORY. **No parity fixture, state pin or shell snapshot moved.**

## Carried to Phase 79 (copy pass)
- The stale "(now 19–20)" wording in docs/ROLL-LEDGER.md.
- The two-word heroOut label "Can't act" (pinned by shell-combat-actions.test.js).
- Acuteness (a die swap, with no signed mod) and the Anklet of Invisibility's "gear" label.
- The new chip labels and explanations, listed in 77-08-SUMMARY.
