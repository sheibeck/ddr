---
quick_id: 260927-opf
status: complete
date: 2026-09-27
---

# Quick 260927-opf: one-shot strikes are once per fight (summary)

(Written by the orchestrator from the executor's returned text. Commits 014026db, 909ca0bc, bb8a580c, 5fe0e1b3; merged together with 260927-rsx.)

**Result:** Feint, Kata, Death Touch, Silent Step and Overhead Blow (borderline, flagged) are now `cd: "fight"`, like Last Stand: spent after one use until the fight ends, for the hero and for Joiners. A second use refuses with the new reason `spent`: no draw, no turn. Oracle: "Feint: spent for this fight. It works once, and you have had your once." Menu: "READY · ONCE PER FIGHT", then "ONCE PER FIGHT · SPENT". Pommel Strike (a stun) keeps its cooldown.

## Evidence
One-use kill rate against a full-HP foe at the same depth: real engine, shipped dials, 400 fights per cell.

| Ability | Kill rate (d1–d20) | Max damage (d20) |
|---|---|---|
| Silent Step | 52–87% | 114 |
| Kata | 50–84% | 146 |
| Feint | 35–74% | 112 |
| Last Stand | 34–76% | 149 |
| Death Touch | 23–61% | 149 |
| Overhead Blow | 14–43%, about a plain strike's 9–46% | 149 |
| Pommel Strike | ~0% | a stun; excluded |

## Mechanism
- It reuses the existing once-a-fight record (`cd: "fight"` → ONCE_A_FIGHT): endCombat clears it, a mid-fight save keeps it (SAV-06), and a missing record means ready.
- The `spent` reason also fixes Second Wind, Smoke and the others, which used to say "ready again in 998 rounds".
- Joiners: `pickMemberAbility` already filters on `isReady`.
- Bot: `chooseAbility` checks `isReady`, and now aims these at the hardest foe.

## Tests
- once-per-fight.test.js and once-per-fight-copy.test.js.
- Re-pins: the Kata cooldown pins move to Pommel Strike, Brace and Dirty Trick; abilities-catalog canon texts; bot-tactics.
- Stall seeds: Knight 5 → 7 (the run now survives to the action cap on floor 16); Sorcerer 4 → 6.

## Measurements
- Fixture inventory byte-identical; parity 66/66.
- State pin deep-14: 52 / dead / floor 14 → 154 / dead / floor 15 (step 19, Silent Step's per-fight mark).
- The thief.hero.txt snapshot was regenerated ("once a fight" → "once per fight").
- Ledger `q-260927-opf.json` (16 rows). Ledgers are named `q-…` so they sort after `79-*` for the before/after chain.

## For the user
**Overhead Blow is borderline:** its kill rate is about a plain strike's, because the two lost faces cancel the double damage. It may deserve its 3-round cooldown back.
