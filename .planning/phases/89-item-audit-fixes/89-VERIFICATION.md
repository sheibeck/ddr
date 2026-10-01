---
phase: 89-item-audit-fixes
status: passed
verified: 2026-09-30
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 4/4
human_verification:
  - "(89-02) Buy an Enlarge potion: the store line reads 150 wilmst and states \"+11 damage, and foes +1 to hit you\"."
  - "(89-02) Drink it: the Oracle and rail say +11 damage and foes +1 to hit; the Hero sheet's damage range rises by 11; the Enlarged chip explains the same."
  - "(89-02) As a Troll, drink Enlarge: the size reads Huge and the damage range rises by 11 again."
  - "(89-03) A Magic User with a Joiner wields a Poplar Staff while both are hurt and uses it: the Oracle and rail name both heals, and the Company panel's HP rises for the Joiner."
  - "(89-03) Use the Pendant of Fortitude, then take it off before any blow lands: the Oracle says the next blow is no longer halved, and the Pendant shows cooling."
  - "(89-03) Use the Pendant and take a hit with it on: the blow is halved as before."
  - "(89-04) Fight beside an armoured Joiner (a Fighter in Studded): some foe hits on the Joiner are \"soaked by <name>'s armour\" and its HP does not drop for those."
  - "(89-04) Keep fighting until the Joiner's armour gives out: the Oracle says so by name."
  - "(89-04) The hero's own armour line in the Gear tab does not change when only the Joiner is hit."
  - "(89-05) Recruit a Thief Joiner: the rail says what cloak it put on."
  - "(89-05) A hurt Joiner drinks a potion outside a fight (from the Company panel): its HP rises and the rail names it; the hero's potion count does not change."
  - "(89-05) Have a Joiner with a Cloak of Strength use it, then walk 50 squares: the rail says its cloak wore off, and 50 squares later that it is ready again."
  - "(89-05) Recruit a Magic User Joiner: the rail says what its scroll did (a spell copied into its book)."
  - "(89-05, 89-07) USE on a Joiner's Cloak of Flying or Helm of Knowledge is not offered: the \"Only the one in front can use this\" line shows in place of USE."
  - "(89-06) Start a fight beside a Thief Joiner wearing a Cloak of Strength: in round 1 the rail says it used the cloak, and its YOUR LOT card shows a Crit-proof chip."
  - "(89-06) Let a Joiner with potions drop to a third of its HP: on its turn it drinks instead of swinging, and its HP bar rises."
  - "(89-06) A Joiner with a Cloak of Speed used swings twice in a round."
  - "(89-06, 89-07) Outside a fight, a Joiner's live item (for example Cloak of Speed or Ring of Power) shows its chip in the Company panel, and a cooling item shows its cooldown chip."
  - "(89-07) Open the Hero tab with a Joiner: its card shows its armour (AR and durability), its healing potions, its worn cloak with a state, and its chips."
  - "(89-07) Out of a fight, tap DRINK on a hurt Joiner: the rail names it and its HP bar rises; DRINK is disabled at full HP with the reason shown."
  - "(89-07) Tap USE on a Joiner's ready Cloak of Strength: the rail says it used it, a Crit-proof chip appears on its card, and USE now shows \"live\" then \"cooling\"."
  - "(89-07) During a fight the Company card shows the one-line note and no buttons; YOUR LOT shows the Joiner's chips."
  - "(89-07) Tap/arrow movement both still work with the Company panel open and closed."
  - "(89-07) Tap a Joiner chip on the Company card: the rail shows the same tap text the hero's chip shows."
  - "(89-08) Drink Cure Poison while diseased (or carrying nothing): the Oracle says it only cures poison and what you have, the potion is still in the bag. Drink it while poisoned: \"Cured of poison.\" and it is gone. Same for Cure Disease."
  - "(89-08) With a Joiner whose armour is worn and hurt, open a store: a line reads \"Repair <Joiner>'s <armour>\" with its points and a price a tenth of the armour's cost per point. Buy it: the Hero tab's Company card shows its armour whole and your own armour is unchanged. Dismiss the Joiner from the Hero tab with the store open, then tap the line: it says no charge and nothing is taken."
  - "(89-08) Past floor 12, use the Oak Staff or the Amulet of Stone: stoned foes die outright (no \"held\" line); the roll detail shows \"(intel N, depth +M)\"."
  - "(89-08) Past floor 12, use the Cedar Staff: a foe that fails its resist stays asleep for the whole fight, not three rounds."
  - "(89-08) Use the Walnut Staff in a fight: the foes' hits are halved and they miss more (they only hit on a high roll), for the whole fight, at any depth."
  - "(89-08) Use the Birch Staff past floor 12: one resist line per foe, then a d4-round freeze, no separate \"unmoved\" line."
  - "(89-09) Open the Gear tab sheet for an Anklet of Invisibility, a Cloak of Invisibility and a Crystal Staff: each reads in \"to hit\" or \"on a d20\" terms, never \"faces\"."
  - "(89-09) In a store, read the Invisible potion and any staff line: plain words, the numbers the engine uses (charges and recharge on every staff)."
  - "(89-09) Read the Helm of Knowledge: it says you can always parley and what a parley is."
  - "(89-09) Load a save made before this build that carries a reworded item: its sheet shows the new text."
  - "(89-09) The Death potion reads \"you're dead!\"."
  - "(89-09) A weapon sheet shows its to-hit (\"−1 to hit\" on a Mace, \"+1 to hit\" and \"crits on the top 2 numbers of your strike die\" on a Rapier); Plate shows \"−2 to climb, leap and flee rolls\"; the Gear tab's bag meter shows what the bag carries."
  - "(89-10) Skim `docs/ITEM-AUDIT.md`: every row's verdict and pin reads true against what you saw on the device."
---

# Phase 89: Item Audit & Fixes — Verification

**Goal:** Every item does what its text says: one audit table, every mismatch fixed (pinned) or ruled; the Enlarge potion worth drinking; every missing system built or re-ruled, party-wide effects included; Joiners use their items and their armour soaks like the hero's; TEXT-01 on every item row.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | The audit table has a row for every treasure, armour, weapon, cloak, jewel, staff, wand, potion and scroll (text / engine / canon), every mismatch fixed or ruled | 89-01 built `docs/ITEM-AUDIT.md` and the batched checkpoint (Rulings Q1–Q6, user 2026-09-30); 89-10 closed it: every row a final verdict and a pin, all 12 Systems entries `built`/`ruled`, 117 titled pins; `test/unit/item-audit.test.js` fails on any open verdict, missing pin file/title, open system or wrong pin count | ✓ |
| 2 | Every fix pinned so text and numbers can't drift; Gear tab, store, loot and find cards state what the engine does | 89-09 reworded every item row in TEXT-01 wording and refreshes saved item text on load (`canonItemText`, `refreshItemTexts`); 89-10's `item-text-engine.test.js` (21 tests) claims every stated number on every row and surface against real engine reads, with a mutation sweep over 80+ numbers; `authored-ranges`, `roll-sign-consistency` re-pinned | ✓ |
| 3 | Enlarge is worth drinking (report #6), its text states both sides | 89-02: +11 damage (size +2 plus +9 bulk, a Troll stacks to Huge), foes +1 to hit, 50 squares, price 150; text states both sides | ✓ |
| 4 | Party-wide item effects reach the whole party; every missing system built or re-ruled and listed | 89-03 Poplar Staff heals every party member (derived stream), Pendant joins the source link; 89-04 one Joiner damage pipeline (Pendant, Brace, armour soak, wear) from `memberSoak`; 89-05 Joiners wear carried gear on joining, use potions/worn items (`memberUseItem`, leader-only items refused per Q2), tick their timers, read the MU scroll (Q3); 89-06 automatic in-fight policy (round-1 item, drink at ⅓ HP, Speed swings twice) and Joiner item chips; 89-07 Company panel DRINK/USE and chips, bot policy; 89-08 one depth-rising resist for item effects (Q1, no floor-12 extras), cures by kind (Q5), Joiner armour repair (Q4), Walnut full Weaken (Q6); `item-text-engine` pins every `PARTY_WIDE_ITEM_EFFECTS` key | ✓ |

## Requirements

ITEM-01 ✓ · ITEM-05 ✓ (89-02) · ITEM-06 ✓ · ITEM-07 ✓ (89-04..07) · TEXT-01: item rows ✓ (89-09; spell, skill and identity rows remain with Phases 90 and 91)

## Automated checks

- Full `npm test` re-run by the orchestrator on master after the 89-10 merge (`16429d9b`): **8,682 tests, 8,680 pass, 0 fail, 2 skipped** (phase base 8,282 / 8,280).
- Parity `node --test "test/parity/**/*.test.js"`: 66/66. `test/parity/prototype-master.js.txt` untouched (last change f8c65f3d, Phase 1). `node tools/narrative-review.mjs --check`: in sync.
- Declared moves, each measured and recorded in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 02".."09") and its SUMMARY; roll-high state pins re-pasted by hand only for moved labels (89-04: 3, 89-05: 1, 89-06: 3, 89-09: 6 text-only, proven by running the pins with the old content), `roll-high-baseline.mjs save` never run.

## Findings carried forward

- **Phase 90:** spell sites still on the old control machinery move to the shared rising resist (`foeResistsEffect` / `risingResistFaces`; 90-04 amended); the user confirmed damage spells get the depth part too (90-CONTEXT).
- **Phase 91:** identity findings listed in `docs/ITEM-AUDIT.md` "Findings for other phases" (Joiner body traits, Wilmsry potions, race sell prices), ruled at the early 91 checkpoint.
- **Phase 92 (bot pass):** the fair bot's camp gate ignores the party's `nightlyEats` (a Joiner camp stall; 89-06 swapped a test seed); `tuning-bot` Regeneration logic (88-04); `tallyUsage` counts a member's `itemUsed` as the hero's (89-07). All in STATE.md Blockers.
- **Build note:** `www/index.html` is a gitignored local artefact read by the build-artefact tests; rebuild it with `npm run build:www` after a shell change merges (89-07).
