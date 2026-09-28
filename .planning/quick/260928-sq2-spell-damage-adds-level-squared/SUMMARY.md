---
quick_id: 260928-sq2
status: complete
date: 2026-09-28
---

# Quick 260928-sq2: spell damage adds level² (summary)

(Written by the orchestrator from the executor's returned text. Commits 3a00b59d (engine and tests) and b62bd424 (texts, ledger, docs and re-pins).)

**Result:** an offensive spell's damage is its dice (plus any flat `dmg` bonus) + the caster's level², the same term a weapon strike gets. The helper is `engine/derived.js#spellLevelSq`. The amount still passes through spellDamageFor, afraidDamage and damageFoe, and there are no new rng draws.

| Site | Before | After |
|---|---|---|
| Thrown (Freeze, Fireball, Mangle; Lightning per foe) | dice × mult + spellDmg | dice + level² + spellDmg |
| Earthquake | each foe: roll × mult; you: half of that | each foe: roll + level²; you: half the roll only |
| Fireballs | each bolt: dice | each bolt: dice; the first bolt to hit each foe adds level² |
| Acid, Ice | every tick: dice | the first tick adds level² |
| Joiner allyCast | dice × mult + spellDmg | dice + the Joiner's level² + spellDmg |
| Stun reach, heals, Apprentice backfire, scroll fumbles | — | unchanged |

**Judgment calls (reported to the user):**
- Fireballs adds level² once per foe, not per bolt.
- Acid and Ice add it to the first tick only.
- Earthquake's self-damage is half the roll only.
- Scroll fumbles keep the old multiplier (self-inflicted).
- The Pine Staff gets none (item damage).
- Noxious Vapor deals no damage, so it's unchanged.

**Texts:**
- Spells: "…for <dice> + your level² damage".
- Oracle and rail: "(the roll +9, for your level)".
- authored-ranges section 9 pins every damage text, plus Freeze's d4 against FREEZE_HOLD_DIE.
- Ledger `q-260928-z-sq2.json` (10 rows). The review page was regenerated. ROLL-LEDGER and SPELLS.md have new sections.

**Tests:**
- New: spell-damage-level-sq.test.js (19).
- Re-pinned: afraid, magic, freeze-rule, freeze-pays-out, control-at-depth, control-spells-depth, party-combat, spell-resist.
- bot-tactics: the forced Sorcerer seed 3 → 1.

**Measure:**
- Fixture inventory byte-identical; parity 66/66; no parity record moved.
- State pins, 4/8 moved, each traced to a Freeze hit:

| Label | Before → after |
|---|---|
| solo-1 | depth 4 → 5 |
| solo-2 | dead d3 → alive d4 |
| party-1 | alive → dead d3 |
| deep-8 | d9 → d10 |

- The pre-switch save's hash was re-recorded; the mu.hero.txt snapshot changed.

**Gates (worktree):** npm test 7,617/7,617; parity 66/66; build:www + boot:check PASS; ledger check 0 errors.

**Follow-ups:**
- `tools/lib/tuning-bot.mjs#expectedDamage` still scores spells on dice only (it undercounts level²). This is fixed before the 79.2 sweep.
- Expect a real balance shift, since spell damage now outgrows the bestiary.
