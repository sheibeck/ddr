---
quick_id: 260927-rsx
status: complete
date: 2026-09-27
---

# Quick 260927-rsx: every spell cast on a foe can be resisted (summary)

(Written by the orchestrator from the executor's returned text. Commits 045ca32e, e1f9dc0c, bb8a580c, 5fe0e1b3; merged together with 260927-opf.)

**Result:** every foe a spell targets rolls a roll-high d20 and resists on the top `max(1, round(intel/2))` faces: intel 1–2 5%, 3 10%, 6 15%, 10 25%, 16 40%. There is no intel-12 gate, and thrown damage is included. A resist means no effect. This covers the hero's casts, scrolls' free casts, Joiners' `allyCast`, and the staff and amulet powers (Birch, Walnut, Oak/Amulet of Stone, Pine, Cedar). Self kinds never roll: summon, ward, might, regen, heal, reveal, foresee, mirror, senses. Foes casting at the hero keep canon p.25 `resistRoll` (intel ≥ 12), now a separate hero-only function.

## Engine
- `engine/derived.js` gains foeSpellResistFaces, foeSpellResistRoll, foeSpellResistCheck (a derived stream keyed by cursor, spell, caster, acts, round and foe index, so the main rng never moves), SPELL_SELF_KINDS, spellTargetsFoe and foeWeakened.
- `engine/combat.js#foeResistsSpell` always pushes spellResisted or resistFailed with the roll fields.
- `roomWeakenResists`: a per-foe intel resist, then the RULES-18 room depth resist, unchanged. A resisted foe is marked `weakenResisted`, which is cleared when the Weaken fades.
- **Order of checks:** the intel resist first, then the depth resist for controls it didn't stop.
- **Draw order:** the resist draws nothing from the main rng. A resisting foe skips only its own draws; cast-wide draws stay first. This is documented in ROLL-LEDGER (`[resist:foe-intel]`) and SPELLS.md.

## Copy
- **Oracle:** always writes both outcomes, with the roll, the range and the intel. A Joiner's cast reads "<Joiner>'s".
- **Rail and fight log:** a failed resist folds into the effect it let through, and a successful resist stands as its own miss line. Resists are never dismissible cards.
- **Foe card:** "INT n · resists your spells on 16–20 (d20)".
- **Spell rows:** each shows the target's resist range.
- The weakened line names the foes that resisted.

## Deviations
- The caster is part of the stream key, so a Joiner never copies the hero's roll.
- A per-foe `weakenResisted` field was added.
- The foe the spell lands on rolls (canon rolled the first live foe).
- Sense Presence is a self spell, so it no longer rolls.
- Fumbled scrolls don't roll.

## Tests
- spell-resist.test.js (17) and spell-resist-copy.test.js (6).
- authored-ranges, roll-sign-consistency and rollDirection-checks extended.
- Declared re-pins via `harness/spellResistActs.js` (a no-resist act).

## Measurements
- Fixture inventory byte-identical; parity 66/66, no carve-out.
- State pins:
  - solo-2: floor 5 → 4 (step 10, Philly resists).
  - solo-magicuser-sorcerer: floor 4 → 3 (step 100).
  - solo-1: hash moved, same outcome.
- Sorcerer stall seed 4 → 6.
- Ledger `docs/narrative-pass/why/q-260927-rsx.json` (8 rows). The review page was regenerated.

## Gates (worktree, combined with opf)
npm test 7,544/7,544; parity 66/66; build:www + boot:check PASS.
