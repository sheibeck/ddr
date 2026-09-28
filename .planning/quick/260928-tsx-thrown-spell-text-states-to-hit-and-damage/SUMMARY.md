---
quick_id: 260928-tsx
status: complete
date: 2026-09-28
---

# Quick 260928-tsx: thrown spell text states to-hit and damage (summary)

(Written by the orchestrator from the executor's returned text. Commit 14d82288.)

**Result:** Freeze, Fireball, Lightning and Mangle now state their to-hit range before bonuses (Freeze 5–10 on a d10; the others 5–8 on a d8) and label their dice as damage. Freeze's text follows the 2026-09-28 ruling: d6 damage, then frozen for d4 rounds unless the foe resists.

| Spell | After |
|---|---|
| Freeze | burst · one foe · hits on 5–10 (d10) before bonuses, for d6 damage; unless it resists, a survivor is frozen for d4 rounds, then it is just cold and angry |
| Fireball | burst · one foe · hits on 5–8 (d8) before bonuses, for 2d10+4 damage |
| Lightning | multi-target · every foe · hits each on 5–8 (d8) before bonuses, for d10+6 damage apiece |
| Mangle | burst · one foe · hits on 5–8 (d8) before bonuses, for 2d20+15 damage |

- "Before bonuses": the Grimoire and the combat row print `sp.txt` as-is, and the school and throw bonuses widen the range per hero.
- **Pins:** authored-ranges section 9 checks, from a real no-bonus cast, that each text's range and dice equal the engine's (the hit face walk, the min and max damage).
- control-spells-depth.test.js no longer lists Freeze in its "past floor 12 … three rounds" text test.
- **Ledger:** q-260928-tsx.json (4 rows). The review page was regenerated. The snapshot mu.hero.txt changed (Mangle's row).
- **Parity:** txt isn't serialized, so no carve-out was needed.

## Gates (worktree)
npm test 7,564/7,564; parity 66/66; build:www + boot:check PASS; ledger check 0 errors.

## Follow-ups
- **Pin "d4 rounds" against the engine's Freeze hold constant** once 79.2-01's Freeze rule lands. Until 79.2-01 merges, Freeze's text runs ahead of the engine.
- **For 999.15:** the texts give per-die damage, while the engine multiplies it by max(1, caster level − spell level). docs/SPELLS.md's old text table is stale.
