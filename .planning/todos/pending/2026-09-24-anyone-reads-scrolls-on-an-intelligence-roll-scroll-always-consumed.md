---
created: 2026-09-24T22:20:00.000Z
title: Anyone can read a scroll on an intelligence roll; Magic Users always succeed; the scroll is consumed either way
area: engine
resolves_phase: 75
files:
  - engine/magic.js:579-585 (canRead — Magic User or Runes/Signs; a Pilfer is always refused)
  - engine/magic.js:~586-655 (readScroll — refusals before `c.scrolls--`, then scrollRead → optional grimoire copy (Magic Users) → scrollCast)
  - engine/derived.js:1427 (resistRoll — the existing intelligence check, d20 < c.intel)
  - engine/character.js:507 (c.intel — a d20 rolled once at chargen)
  - content/flavor.js (SUB_NOTE / class blurbs that mention scrolls or Runes/Signs)
---

## Problem

User, 2026-09-24, over three messages:
1. "All thieves should have a 50% chance to successfully read a scroll. Regardless of the outcome, the scroll is destroyed after the attempt."
2. Then, superseding the 50% part: "Actually, scrolls should be usable by anyone by giving them an intelligence roll. Magic-users always succeed."
3. Then: "Anyone who fails their scroll read attempt by more than half the required number is a fumble and the scroll affects the caster instead of the target."

Today `canRead` lets only a Magic User, or someone with the Runes/Signs skill, read a scroll, and a Pilfer never can. Everyone else is refused before the scroll is spent (`scrollRefused`, reason `noRunes`).

## Solution

**Rule (user rulings, 2026-09-24):**
- **Anyone** (every class, sub-class and race) may attempt to read any scroll. `canRead`'s class/skill gate and the Pilfer lockout go away.
- **Runes/Signs reads automatically (ruled 2026-09-24).** A non-Magic-User with the Runes/Signs skill reads every scroll automatically, just like a Magic User: no intelligence roll and no fumble. User: "Runes/Signs on a non-magic-user means they can read them automatically, just like a magic-user." They get the free cast only; the grimoire copy stays Magic-User-only.
- **Magic Users always succeed.** They keep today's path unchanged: cast, plus the grimoire copy when the spell is learnable.
- **Everyone else** (no Magic User class, no Runes/Signs) **makes an intelligence roll** against their own `c.intel`: a d20 checked against intel, reusing the existing check's shape (`resistRoll`: today d20 < intel; after the Phase 73 mirror, expressed roll-high). On a success, the scroll's spell is cast through the free-cast path (`scrollCast`). On a failure, nothing is cast.
- **A bad failure is a FUMBLE (ruling 3):** a read that misses by more than half the required number backfires. The scroll's spell takes effect **on the reader instead of its target** (e.g. a Fireball burns the reader). Magic Users never fumble, because they always succeed.
- **The scroll is consumed on every attempt**, success or failure. This carries over from ruling 1 and was not revoked.
- Narrate both outcomes, in voice. A failure should read as squinting at runes you can't make out while the scroll crumbles, not as a refusal.

**Decide in the Phase 75 discuss:**
- **The fumble arithmetic in the roll-high convention.** Phase 75 lands after the Phase 73 mirror, and the user reasons roll-high. The recommended reading is that the "required number" is the target T you must meet or beat, and a fumble is `T − roll > T / 2`, i.e. rolling below half the target.
  - Worked example: intel 14 today (roll-under, success on 1–13) becomes a roll-high target of 8+. A fumble is then a roll of 3 or less (misses 8 by 5 or more): 15% of reads, against 50% plain failures.
  - Beware: the same words read roll-under give different odds (for intel 14, only a natural 20 would fumble). Confirm the reading with the user and show both numbers.
- **Self-targeted scrolls on a fumble** (healing, Shield, Sense Presence, map reveals), where "the caster instead of the target" is the same person. Options: the effect goes to the foe (a healed or shielded enemy), it inverts (e.g. a heal harms), or it simply fizzles. Also: a fumble outside combat, with no foe present.
- **Multi-target scrolls** (area damage) on a fumble: the reader takes one hit, or every hit?
- **A Pilfer reading a scroll:** does the RULES-09 fumble also apply (a 1 makes it explode for d10), or does the intelligence roll cover scrolls on its own?
- **Low-intel characters:** `resistRoll` skips its roll below intel 12. That gate is for foe abilities and should NOT carry over. Every non-Magic-User reader rolls, and a low intel just means worse odds.

**Engine gate:** the intelligence roll is a new draw. Take it from a derived rng stream (`makeRng(hash(seed, "scrollRead", …))`) so it doesn't reorder the main stream. Measure, declare and regenerate only the moved fixtures. Every new event gets an `EVENT_NARRATION` entry. Update the class and sub-class blurbs that mention scrolls or Runes/Signs, per VOX-04.
