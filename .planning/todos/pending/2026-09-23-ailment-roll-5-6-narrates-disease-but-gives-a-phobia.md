---
created: 2026-09-23T00:30:00.000Z
title: Ailment rolls 5–6 narrate "Disease" but actually give a phobia
area: ui
files:
  - content/afflictions.js:13-14 (rows 5 and 6 — kind "Disease", phobia:true, loss null)
  - engine/encounters.js:632-642 (rollAffliction — emits afflictionRolled {roll, kind}, then phobiaAcquired and returns; no disease is applied)
  - src/browser/eventNarration.js:895-897 (Oracle line prints e.kind → "Disease.")
  - src/browser/narrationLines.js:1549 (rail line prints e.kind → "Disease.")
---

## Problem

Reported on the Pixel 7 (v1.8 build, 2026-09-23), depth 1. User's words: "Even though it says disease, I never got disease, but a new phobia instead. This is the Oracle, but the rail said the same thing":

```
A new fear settles in: Fire.
Something is wrong with you. The die turns up 5. Disease.
Table 6, roll 6: The dice decide — Ailment.
Not today. The lock wins this round.
```

**Root cause, confirmed by reading the code:** the engine does what canon says. `AFFLICTIONS` rows 5 and 6 are `{ kind: "Disease", phobia: true, loss: null }`. Canon treats them as a disease of the mind: the roll gives a phobia, not HP loss or a timed affliction. `rollAffliction` emits `afflictionRolled` with `kind: "Disease"` and then `phobiaAcquired`, with no `afflictionCaught`. Both narration tables print the raw `kind`, so the player is told "Disease" and never gets one. Only the words are wrong; the dice and the rules are not.

## Solution

Presentation-only fix, with no engine or content change, so parity stays untouched:
- In `eventNarration.js` `afflictionRolled` and `narrationLines.js` `afflictionRolled`, read `AFFLICTIONS[e.roll - 1]?.phobia`, or check whether a `phobiaAcquired` follows in the same event batch.
- When the row gives a phobia, say so in voice instead of "Disease.". For example: "Something is wrong with you. The die turns up 5. Not your body — your nerve." Then the existing "A new fear settles in: Fire." follows.
- Keep "Disease"/"Poison" for the real affliction rows.
- Pin with a narration test for roll 5, roll 6, and one real Disease row (2 or 8). Keep the family-friendly sarcasm voice.

Alternative (NOT preferred): rename `kind` in `content/afflictions.js`. That is a content edit that may move parity comparables and the engine-gate fixtures.
