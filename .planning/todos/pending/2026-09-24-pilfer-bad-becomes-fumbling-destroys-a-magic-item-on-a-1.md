---
created: 2026-09-24T22:01:37.633Z
title: Pilfer's bad becomes fumbling — a rolled 1 destroys the magic item being used
area: engine
resolves_phase: 75
files:
  - engine/items.js:1278-1292 (useItem — the Phase 24 IDENT-07 "heal-only" Pilfer refusal, reason "pilfer")
  - engine/magic.js:579-585 (canRead — `if (c.sub === "Pilfer") return false`)
  - engine/magic.js:627 (scrollRefused reason "pilfer")
  - content/flavor.js:50 (SUB_NOTE.Pilfer — "Try to use anything that doesn't heal, though, and your own hands simply refuse")
  - test/parity/prototype-master.js.txt:693 (canon Pilfer note — never edited)
---

## Problem

User (2026-09-24, mid v2.1 run), asking to add this to the current milestone: "The Pilfer needs to change its bad ability. Instead of only being able to use heal items, if the Pilfer ever rolls a one when using a magic item it is destroyed. Because they are constantly fiddling with things like an ADHD teenager."

Today, the Pilfer's "one good, one bad" (Phase 24, IDENT-07) forbids using any magic item that doesn't heal:
- `useItem` refuses with `reason: "pilfer"` for everything except the `heal`/`full` potions and `kind:"tool"` kit.
- `canRead` returns false for a Pilfer, so scrolls never work.

This is a hard lockout from a whole category of loot. The user wants a risk instead of a wall.

## Solution

**The new bad (user ruling):**
- A Pilfer can use magic items under the normal rules. The heal-only refusal is removed.
- Each time a Pilfer uses a magic item, the Pilfer rolls a die. On a roll of 1 (the worst face — this matches the v2.1 roll-high convention, where 1 is always worst), the item is **destroyed**, and it **explodes, dealing damage** (user addition, 2026-09-24: "If the magic item is destroyed, it will deal damage as it explodes.").
- **Ruled 2026-09-24:** the fumbled use does NOT take effect. User's words: "it no longer works and it turns to dust". The item fails, explodes for damage, and crumbles to dust; nothing is left in the bag or slot.
- The Pilfer's good (traps disarm themselves, locks open) is unchanged.

**Decide in the Phase 75 discuss:**
- The die. A d20 gives a 5% fumble per use, which is the natural default for the user's "rolls a one".
- The explosion damage:
  - **How much — ruled 2026-09-24: d10 damage** (user: "d10 damage on magic item explode").
  - Who takes it. The Pilfer only, or also the party and/or the foes in a fight?
  - Whether armor soaks it or it bypasses armor.
  - Whether it can kill: it should, since the engine already handles death from any HP loss (death epitaph line).
  - The damage roll is another derived-stream draw, like the fumble roll.
- Which items count as "magic items":
  - Potions, staves, wands and use-activated cloaks/jewelry are clear cases.
  - Worn passive items (armor, rings that only sit there) aren't "used", so they're probably exempt.
  - Torches and other `kind:"tool"` kit are mundane, so they're exempt, as today.
  - Scrolls: covered by RULES-10. Anyone reads a scroll on an intelligence roll, Magic Users always succeed, and the scroll is always consumed. Open question: does a Pilfer ALSO roll the fumble when reading, so the scroll can explode on top of failing?
- The narration: a new event (e.g. `pilferFumbled`) with an `EVENT_NARRATION` entry, in the voice. The user's framing is "constantly fiddling with things like an ADHD teenager"; keep it family-friendly and don't name a diagnosis in player text. Something like "fiddled with it until it came apart".

**Engine gate:**
- The fumble roll is a NEW rng draw. Take it from a derived stream (`makeRng(hash(seed, "pilferFumble", …))`) so it doesn't reorder the main stream for unrelated fixtures.
- Removing the refusal moves any fixture where a Pilfer used or read an item. Measure the moved fixtures, declare each, and regenerate only those. The prototype master is never edited.

**Text:**
- Rewrite `SUB_NOTE.Pilfer` (content/flavor.js:50) to state both sides, per VOX-04 (every blurb names its advantage and disadvantage).
- Update `docs/CLASS-PASS.md` and the Phase 24 identity contract row for Pilfer.

**Tests:**
- Replace the IDENT-07 refusal tests with fumble tests: a forced roll of 1 destroys the item, any other roll keeps it, tools never fumble, and a destroyed item is gone from the bag or worn slot.
