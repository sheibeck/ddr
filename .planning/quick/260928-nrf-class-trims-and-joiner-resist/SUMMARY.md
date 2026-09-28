---
quick_id: 260928-nrf
status: complete
date: 2026-09-28
---

# Quick 260928-nrf: class trims and Joiner resist (summary)

(The orchestrator wrote this from the executor's returned text. There are 11 commits on base 16bd2654, each rule a RED test commit then its fix: d3460a85/2c7a2680 flee, b20214e2/84632de1 Sweep, 5791c725/fc3e2856 Kata/Feint, 0c6324d7/33c2beab Acrobat, 729ce4cd/a0ae743c Joiner resist, and 4dd80236 for the copy, ledgers and re-pins. It merged cleanly into master. The user picked each rule on 2026-09-28 after the 260928-abl audit.)

## Rules
| Rule | Before | After |
|---|---|---|
| Thief flee | +5 (canon): a Human Thief in light armour escapes on 9–20 (60%) | +3 (`FLEE_THIEF_BONUS`), a deliberate deviation: 11–20 (50%) |
| Sweep | half damage to every living foe, even a lone one | refuses with fewer than 2 living foes: `tooFewFoes`, no turn, cooldown or draw spent. One rule (`abilities.js#abilityShortfall` / `abilityUnavailableReason`) is read by the hero, the menu, Joiners and the bot |
| Kata / Feint | auto-hit + level damage, once per fight | `needShift: +3` (`KATA_FEINT_NEED_SHIFT`) + level damage, once per fight. A miss is an ordinary `strikeMissed` and the use is still spent |
| Acrobat, when struck | foes hit on their top 3 faces | top 4 (`ACROBAT_FOE_FACES`). The Acrobat's own strike need of 5 is untouched |
| Joiner resist | a foe bolt or drain on a Joiner was never resisted | `memberResist` rolls `resistRoll` on the Joiner's own intel, a main-rng d20 after the ability gate and target pick, before the damage dice. A resist blocks the damage and the drain heal. Events `memberResisted` / `memberResistFailed` |
| Riposte | — | unchanged (the user kept the consistent 260928-hrs rule) |

## Re-pins, each traced by bisect
- **party-fighter-knight:** 180/dead/2 → 400/alive/3, from rule 5 only. At step 134, Krupke's Freeze hits Hilda (intel 9); she rolls 12 against 16–20 and fails, and the damage die moves.
- **deep-14:** 50/dead/14 → 35/dead/14, from rule 4 only. At step 20 a Drarl rolls 5 on a d8, which now hits the Acrobat.
- **bot-tactics Knight no-stall seed:** 3 → 4, from rule 3. A Joiner's Feint misses at step 385, and seed 3 now survives to the action cap.
- **DIALS merge pin:** it applies the ruling over Phase 54's `best.json`.
- **Unit pins:** flee rows, the Kata/Feint auto-hit pins, the one-foe Sweep armour pin, the member-bolt draw count, the Acrobat pins and catalog texts.
- **Parity:** 66/66 with no carve-out, and the fixture inventory is byte-identical. The one replay that reaches a changed rule (`action-script.combat.json#flee`, a Thief) still escapes. Declared in FIXTURE-INVENTORY.

## New copy (the why ledger `q-260928-z4-nrf.json` has 20 rows; the review page has 534 rows)
- **Sweep:**
  - text: "…; needs two or more foes"
  - menu row: "NEEDS TWO OR MORE FOES"
  - Oracle refusal: "Sweep: needs two or more foes, and there is only one. A wide arc at a single foe is a swing with extra steps."
- **Kata and Feint:**
  - texts: "your die has three more faces that land this strike, and it adds your level in damage; once per fight"
  - a miss reads "… Kata is spent all the same: one perfect form, one imperfect result."
- **Acrobat:** "foes land only on their top four faces".
- **Joiner resist:**
  - Oracle: "Ada resists Krupke's spell. 16 vs 16–20 (intel 10). Somebody on your side was paying attention." / "Ada fails to resist Krupke's spell. 12 vs 16–20 (intel 10). Shrugging it off is harder than it looks."
  - rail twins state the roll and range.

## Judgment calls (reported to the user)
1. **Joiners get the same trims,** following the one-catalog precedent from 260927-opf.
2. **The +3 is capped at the die,** so an untouchable foe stays untouchable. Kata and Feint no longer land on magic-only or dagger-only foes; the old auto-hit did.
3. **Side fix:** a Joiner's need shift now skips an untouchable foe, as the hero's always did.
4. **The Sweep row is disabled-styled but still tappable,** so the engine's refusal explains it.
5. **The "spent all the same" miss clause** is on Kata and Feint only.
6. **The bot's ability scoring is unchanged:** it has no expected-value model for strike abilities. It reads Sweep availability.
7. **The thiefFlee ablation tool** now reads the constant.
8. **The historical "Thief +5" readings** stay in CLASS-PASS.md as dated history.

## Gates (worktree)
- npm test: 7,693/7,693.
- Parity: 66/66.
- build:www: PASS.
- boot:check: no-uncaught, painted and title PASS; `graves` is flaky. It fails about 1 run in 3–5, the same on base 16bd2654, so it is not caused by this change.
- No bot runs.
