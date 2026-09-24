---
created: 2026-09-24T22:20:00.000Z
title: Thieves read scrolls at 50%; the scroll is consumed whatever happens
area: engine
resolves_phase: 75
files:
  - engine/magic.js:579-585 (canRead — Magic User or Runes/Signs; a Pilfer is always refused)
  - engine/magic.js:~586-655 (readScroll — refusals before `c.scrolls--`, then scrollRead → optional grimoire copy (Magic Users) → scrollCast)
  - content/flavor.js (Thief SUB_NOTE blurbs)
---

## Problem

User, 2026-09-24, while ruling on the Pilfer fumble: "All thieves should have a 50% chance to successfully read a scroll. Regardless of the outcome, the scroll is destroyed after the attempt."

Today `canRead` lets only a Magic User, or someone with the Runes/Signs skill, read a scroll, and a Pilfer never can. A Thief without Runes/Signs is refused before the scroll is spent (`scrollRefused`, reason `noRunes`).

## Solution

**Rule (user ruling):**
- Every Thief sub-class (Pickpocket, Pilfer, Cat Burglar, Cutthroat, Cloaker, Ninja, Con Artist, Acrobat) may attempt to read any scroll.
- The attempt succeeds 50% of the time. On success, the scroll's spell is cast through the existing free-cast path (`scrollCast`). On failure, nothing is cast.
- The scroll is consumed either way (`c.scrolls--` happens on every attempt).
- Narrate both outcomes. A failure should read as a thief squinting at runes they can't make out while the scroll crumbles, not as a refusal.

**Decide in the Phase 75 discuss:**
- A Thief who HAS Runes/Signs: still 50%, or guaranteed like today?
- A Pilfer reading a scroll: does the RULES-09 fumble also apply (fail, then explode for damage), or does the 50% roll replace the fumble for scrolls?
- The die: a d2, or a d20 at 11+ in the roll-high convention.

**Engine gate:** the 50% roll is a new draw from a derived rng stream (`makeRng(hash(seed, "thiefScroll", …))`). Measure, declare and regenerate only the moved fixtures. Every new event gets an `EVENT_NARRATION` entry. Update the Thief blurbs per VOX-04.
