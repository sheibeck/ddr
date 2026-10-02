---
created: 2026-10-02T12:31:00.000Z
title: Make racial starting hit points in race text accurate
area: content
files:
  - content/flavor.js
  - content/identity.js
  - engine/derived.js (starting hp)
---

## Problem

User, 2026-10-02, on the v2.3 debug build: "The Troll for instance says it starts with 75 hitpoints, but my new troll actually started with 105. Let's make sure that racial starting hit points are accurate!"

The Troll blurb and footer say 75 hit points (checklist A10; Phase 91 identity text). A newly rolled Troll actually started with 105. The 75 is probably the race base alone, before class or sub-class hp, a Large/Troll multiplier, or the first-level roll are added, but this has not been verified. Other races may have the same mismatch.

## Solution

Trace starting hp for every race, class and sub-class combination in the engine (derived.js and the roller). Choose a wording rule with the user, for example "starts with 75 hp plus your class's" or a range. Then fix every race text that states hp, and pin it with a test that compares each stated value with the engine's actual starting hp for every combination, so the two can never drift apart again.

Truth-in-advertising, so this belongs before Release 2.3.0 (checklist A10 would fail). It could ride with Phase 92.2.
