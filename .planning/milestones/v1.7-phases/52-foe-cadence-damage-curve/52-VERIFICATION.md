---
phase: 52-foe-cadence-damage-curve
verified: 2026-09-21T03:20:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 576e70e); criterion 4's "every flagged row fixed" is satisfied under the user's recorded ruling (two cliffs fixed; 65 curve-height cells ruled hand-to-54, none silent); device checks deferred to the Phase 55 batch
behavior_unverified: 0
overrides_applied: 1
human_verification:
  - "Cadence (Pixel 7): a Bat/Rat or China Wolf fight at depth 5 shows at most 2 foe attack lines between two of your actions"
  - "Ability replaces swings (Pixel 7): a Stalka Beast turn is EITHER two swings OR one bolt/heal — never two hits and a bolt in the same turn"
  - "Herman (Pixel 7, dev start-at-depth 5–8): a Herman crit reads ≤ 37 and never one-shots a full-HP level-5 hero; his ordinary hit reads 26–31 (was 41 / 50)"
  - "Crit feel (Pixel 7): a tier-5 foe's crit reads roughly 27–37, not 50–60; ordinary hits are unchanged"
gaps: []
---

# Phase 52 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *every foe attacks an honest, countable number of times per round, and no single hit can spike past a smooth depth-scaled damage curve.*

Three plans, three sequential waves. 52-01 pinned the cadence rules (already correct after Phase 51 removed the double turn) and built the two audit tools with the BEFORE readout. 52-02 fixed the two cliffs in one green commit — a foe crit doubles the dice, not the `lvl² + bonus + dice` sum (hero, member and pursuit sites, via `foeLevelBase(f)`), and Herman's flat 25 became the literal `sp.strikesAs: 5` — re-pinned, declared the one moved fixture, appended the AFTER audit. 52-03 applied the user's ruling to the remaining flags, ran the AFTER bot readout, and wrote the ledgers. **Human verification is deferred** to the Phase 55 batched device session (frontmatter list).

## Evidence (orchestrator re-run at HEAD `576e70e`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | A plain foe swings once per round, an `sp.atk: 2` foe swings twice, a frenzied foe doubles its own swing count — each pinned by a dedicated unit test | `test/unit/foe-cadence.test.js`: plain → 1, `atk: 2` → 2, frenzied → 2, frenzied `atk: 2` → 4 (events per foe turn). Rule unchanged (`combat.js` `swings = (frenzied ? 2 : 1) × (sp.atk ‖ 1)`) |
| 2 | When a foe ability fires, a resolver test proves that turn contains the ability and zero ordinary swings — the Stalka Beast two-hits-plus-frost log is provably impossible | Same file: ability turn → one `foeCast` + effect, zero swing events; melee turn → ≤ 2 swings, zero casts; a 12-case sweep over the Stalka kit shows "two hits + a bolt in ONE `foeTurn`" cannot occur. The user's log was the Phase 51 double turn (swings in one foe turn, the bolt in the back-to-back second) |
| 3 | A bot readout records attacks-per-player-action for the Bat/Rat and China Wolf floor-5 fights at ≤ the foe's `sp.atk` (≤ 2× if frenzied), committed in `docs/DIFFICULTY-RETUNE.md` | `tools/cadence-audit.mjs` (40 seeds, depth 5, real `startCombat`/`fight`/`playerStrike`): Bat/Rat 10 fights sampled, China Wolf 6 — both `INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS`; output committed (`tools/cadence-audit-output.txt`, re-run diff empty at close) and quoted under `### v1.7 · Phase 52 — cadence & damage curve`; the invariant is also a unit pin |
| 4 | A committed script reports max single-hit damage by depth for every bestiary foe and flags any hit ≥ 60 % of a level-appropriate character's max HP; every flagged row (Herman's floor-5 crit among them) is fixed and re-measured clean | `tools/damage-curve-audit.mjs` (analytic, rng-free, every row × tier × 4 bands, Magic-User/Fighter bars at the bot's median level per band): BEFORE **116 flagged cells** (level-base 72, deep-tier 21, row-dice 23) → AFTER **65** (level-base 14, deep-tier 21, row-dice 30). Herman `critMax` 82 / 100 → **37 / 37**, ordinary hit 41 / 50 → 26–31 — the reported "80 on floor 5" is gone. **Override (user ruling at plan approval, recorded in 52-CONTEXT.md):** the remaining 65 cells are the curve's height, not cliffs — trimming their dice would collapse tier 3 and be re-tuned by Phase 54 anyway; each carries an explicit Disposition in the BESTIARY-REBALANCE Phase 52 addendum (21 tier-5 "deliberate deep-tier threat (Endgame band)", 44 tier 2–4 "curve height — a Phase 54 dial") — none silent |
| 5 | Every damage-curve fix carries a before/after row in `content/BESTIARY-REBALANCE.md`; any moved parity fixtures are measured, declared and regenerated per the engine gate | Phase 52 addendum: engine-wide crit tier maxima, the Herman before/after table, the full still-flagged table with rulings. Fixtures: scan Part B on the edited engine → exactly `combat.json#lose` moved (a Shriek natural 1 at action 3; end `wp` 50 → 51), declared `+52` with measured values, DMG-02 MOVED SET guard in `divergence-records.test.js`, FIXTURE-INVENTORY.md Phase 52 section; comparables untouched; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged (re-run); draw pins: zero minus-lines (the crit rule and `strikesAs` add no draws) |
| — | `npm test` fail 0; `build:www`; measurement gate | **3,372 / 0** (3,351 at phase start + 10 cadence + 9 crit-curve + 2 guards; re-run by the orchestrator); `build:www` exit 0. BEFORE = Phase 51 AFTER (`608a0e5`, reused); AFTER (`049ab50`, identical flags): solo death depth p50/p90 4/6 → 4/6, party 5/7 → 5/7, class smoke pooled mean 3.80 → (recorded in the ledger); medians unchanged — a spike-only fix, as designed |

## Notes the reader should have

- **What actually changed for the player:** ordinary hits are identical; only a natural-1 crit is different (dice doubled instead of everything doubled), and Herman hits like a level-five foe instead of a level-five foe plus a flat 25. The average run is unaffected; the "one bad roll ends a full-HP run" spike is what went.
- **Why 65 cells stay flagged:** under the strict 60 %-of-a-Magic-User bar, a plain tier-4 foe's crit (16 + 12 = 28) and every tier-5 hit sit over the bar by construction — that is the level of the curve, which is Phase 54's dial. Ruled, not skipped.
- `test/determinism/foe-abilities.test.js`'s `walking-dead-t5` full-fight pin was re-measured live (23 → 48 draws, 1 → 3 attacks, same death outcome): the smaller crit takes two more of the hero's own strikes to lose the same way — allowed by the plan's escalation rule, recorded in the 52-02 SUMMARY.
- Executor deviations: the audit tool's `## Herman` prose was hardcoded to the BEFORE state (made rule-conditional); an inherited Phase 51 scan-column drift was verified invariant and absorbed by this phase's regeneration; the gsd commit helper drops the session trailers — 52-03 amended its final unpushed commit to add them.
- `npm run boot:check` remains environment-blocked on this machine (Phase 50 note); not a gate.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| CAD-01 | Complete | criterion 1 |
| CAD-02 | Complete | criterion 2 |
| CAD-03 | Complete | criterion 3 |
| DMG-01 | Complete | criterion 4 (audit tool + committed BEFORE/AFTER) |
| DMG-02 | Complete under the recorded ruling (two cliffs fixed; curve height → Phase 54) | criteria 4, 5 |
