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

Today `canRead` lets only a Magic User, or someone with the Runes/Signs skill, read a scroll, and a Pilfer never can. Everyone else is refused before the scroll is spent (`scrollRefused`, reason `noRunes`).

## Solution

**Rule (user rulings, 2026-09-24):**
- **Anyone** (every class, sub-class and race) may attempt to read any scroll. `canRead`'s class/skill gate and the Pilfer lockout go away.
- **Magic Users always succeed.** They keep today's path unchanged: cast, plus the grimoire copy when the spell is learnable.
- **Everyone else makes an intelligence roll** against their own `c.intel`: a d20 checked against intel, reusing the existing check's shape (`resistRoll`: today d20 < intel; after the Phase 73 mirror, expressed roll-high). On a success, the scroll's spell is cast through the free-cast path (`scrollCast`). On a failure, nothing is cast.
- **The scroll is consumed on every attempt**, success or failure. This carries over from ruling 1 and was not revoked.
- Narrate both outcomes, in voice. A failure should read as squinting at runes you can't make out while the scroll crumbles, not as a refusal.

**Decide in the Phase 75 discuss:**
- A non-Magic-User with **Runes/Signs**: automatic success like a Magic User (the skill's whole point today), a bonus on the intelligence roll, or nothing?
- **A Pilfer reading a scroll:** does the RULES-09 fumble also apply (a 1 makes it explode for d10), or does the intelligence roll cover scrolls on its own?
- **Low-intel characters:** `resistRoll` skips its roll below intel 12. That gate is for foe abilities and should NOT carry over. Every non-Magic-User reader rolls, and a low intel just means worse odds.

**Engine gate:** the intelligence roll is a new draw. Take it from a derived rng stream (`makeRng(hash(seed, "scrollRead", …))`) so it doesn't reorder the main stream. Measure, declare and regenerate only the moved fixtures. Every new event gets an `EVENT_NARRATION` entry. Update the class and sub-class blurbs that mention scrolls or Runes/Signs, per VOX-04.
