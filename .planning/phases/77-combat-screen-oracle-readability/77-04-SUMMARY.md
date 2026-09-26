---
phase: 77-combat-screen-oracle-readability
plan: 04
subsystem: combat-ui
tags: [foe-chips, conditions, scroll-fumble, long-press, CMBUI-13]
requires:
  - phase: 75.1-pilfer-fumbles-scroll-reading
    provides: "the foe ward/Bubble/rebound, Mirror Self, might/strengthBoost, regen and senses fields (75.1-03 mechanics, 75.1-05 resolveScrollFumble)"
  - phase: 75.3-deep-floor-encounter-scaling
    provides: "the held/resisted chips and elite foes (75.3-03/04)"
provides:
  - "FOE_CONDITIONS entries, labels and descriptions for every fumble-given foe effect: Shielded, Bubbled, Rebound, Mirrored, Strong, Regenerating, Senses"
  - "foeDetails.js#foeConditionEffect for a mirrored foe ('you hit it only on <range>') and a held foe ('you hit it on <range>')"
  - "the foe coverage guard with engine/scrollFumble.js scanned and no exclusion parked for Phase 77"
affects: [77-08, 79]
tech-stack:
  added: []
  patterns:
    - "One engine field with two shapes gets one table entry per shape (shielded/bubbled both read `ward`), so each label keeps its own FOE_CONDITION_DESC key"
key-files:
  created: []
  modified:
    - src/browser/foeConditions.js
    - src/browser/foeDetails.js
    - test/unit/foe-conditions.test.js
    - test/unit/foeDetails.test.js
decisions:
  - "Rebound is a chip, not bookkeeping. A free-action item blow caught by a Bubble leaves `rebound` visible until the foes next move, and the player should see their blow is coming back."
  - "The foe ward shows as Shielded · n (a plain pool, including a popped Bubble's one-round film) or a bare Bubbled (armed). These are two table entries on the one `ward` field."
  - "A held foe joins the long press's you-part effect (the same floor-at-5 as asleep). This closes a gap left by 75.3-04."
metrics:
  duration: ~35 min
  completed: 2026-09-26
status: complete
---

# Phase 77 Plan 04: Foe effect chips for fumble gifts Summary

When a fumbled helpful scroll strengthens a foe, the foe's card now shows it: Shielded · n, Bubbled, Rebound, Mirrored · n, Strong, Regenerating and Senses. All are tone bad. Each description was written from the resolver and the engine code that uses the effect. A long press on a mirrored foe also gives the measured range you now hit it on.

**Plan base SHA:** `b7d33827ad6a5429ed2e38011ea8470030de81bf`

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Chips for every fumble-given foe effect | `faa4452e` (test, RED), `604a5342` (feat, GREEN) |
| 2 | The long press states the new chips' to-hit effect | `51be5269` (test, RED), `22c5ed1f` (feat, GREEN) |

## New FOE_CONDITIONS entries (table order: after Frenzied, before Weakened)

| key | field(s) | label | tone | rounds | applied by / consumed by |
| --- | -------- | ----- | ---- | ------ | ------------------------ |
| shielded | `ward` (plain pool > 0) | Shielded | bad | `ward.rounds` → "Shielded · n" | resolveHelpful (Shield) or damageFoe's Bubble pop / damageFoe soak, foeTurn tail tick |
| bubbled | `ward` (`mirror: true`) | Bubbled | bad | none (armed, never ticked) | resolveHelpful (Bubble) / damageFoe's catch |
| rebound | `rebound` (> 0) | Rebound | bad | none | damageFoe's hero-side catch / foeTurn head throw-back |
| mirror | `mirror` | Mirrored | bad | `mirror` → "Mirrored · n" | resolveHelpful (Mirror Self) / targetStrikeFaces cap, foeTurn tail tick |
| might | `might`, `strengthBoost` | Strong | bad | none (rest of fight) | resolveHelpful (Strength) / foeLevelBase |
| regen | `regen` | Regenerating | bad | none (rest of fight) | resolveHelpful (Regeneration) / foeTurn per-foe heal |
| senses | `senses` | Senses | bad | none | resolveHelpful (Sense Presence) / nothing reads it mid-fight |

Descriptions (FOE_CONDITION_DESC):
- **shielded:** "Your shield scroll picked the wrong side: it soaks up blows before they reach it, until it breaks or the count runs out."
- **bubbled:** "Your bubble, on its side now: the next blow at it is caught whole, sent back if you threw it, and then it thins to a film for the rest of the round."
- **rebound:** "Its bubble caught your blow whole, and it throws that same blow straight back at you when the foes next move."
- **mirror:** "Copies of it everywhere, and only one is real: every strike at it, yours or your party's, lands only on the very top roll until the count runs out."
- **might:** "Your Strength went to it instead: it gained a second helping of hit points on the spot, and every blow it lands hits harder for the rest of the fight."
- **regen:** "It knits itself back together a little every round, even while it naps, for the rest of the fight."
- **senses:** "It can sense your presence now. Since it is already fighting you, this changes nothing at all."

Every description is one line, voice-safe and says HP (never WP). None states a digit, so the digit rule holds.

## NOT_A_CONDITION changes (test/unit/foe-conditions.test.js)

- **Removed:** `ward` and `mirror` (both parked with "CMBUI-13 (Phase 77) draws its indicator"), and `rebound`. All three are chips now.
- **Added:** `heroBlind` and `heroShrunk`. Adding `engine/scrollFumble.js` to ENGINE_FILES exposed these two. They are the reader's own fumble flags, a hero-side condition in `engine/derived.js#conditionsOf`.
- **Added:** `elite` (RULES-17). The title on the foe's name shows it, and it is set on the spawn literal, which the scan never sees.
- A new guard test asserts that no reason defers to Phase 77 or CMBUI-13 and that every fumble-gift field is covered. The self-check asserts the scan finds ward, rebound, mirror, might, strengthBoost, regen, senses, held, resisted, heroBlind and heroShrunk.

## New long-press lines (foeDetails.js)

- **Mirrored:** `Mirrored · 2 — you hit it only on 20 (d20). <desc>`. The range comes from `heroHitOddsVs(state, foe).text`, and the test asserts the two are equal. The template is the new `FOE_DETAILS_COPY.effectYouOnly`.
- **Held:** `Frozen · 2 — you hit it on 16–20 (d20). <desc>` for a level-1 Magic User, the same floored odds as Asleep.
- Shielded, Bubbled, Rebound, Strong, Regenerating, Senses and Unmoved return null and keep `<text> — <desc>`. With a minimal state (no full hero) the clause is dropped without throwing. Every earlier pinned line is unchanged.

## Verification

- `node --test test/unit/foe-conditions.test.js test/unit/hp-not-wp.test.js test/voice/safety-scan.test.js`: 69/69.
- `node --test test/unit/foeDetails.test.js test/unit/foe-conditions.test.js test/unit/roll-sign-consistency.test.js` plus the neighbouring shell/chip tests: 153/153.
- `npm test`: **6781/6781, 0 failures** (this includes parity).
- `git diff --quiet b7d33827 -- engine/ mazeworld.html test/parity/` exits 0, so no engine, shell or fixture changes. No FIXTURE-INVENTORY entry is needed. No bot runs.
- Foe-card taps still only aim. The chips stay text inside the card's tag line, and the shell was not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] A held foe's long press gave no odds**
- **Found during:** Task 2
- **Issue:** 75.3-04's Held chip floors the hero's swing at 5 faces, just like Asleep. Its long-press line still used the plain `<text> — <desc>` with no measured range, which misses the plan's done-criterion ("explains every effect ... with the measured odds where the effect moves a roll").
- **Fix:** Added `held` to EFFECT_YOU_KEYS and a test for it.
- **Files modified:** src/browser/foeDetails.js, test/unit/foeDetails.test.js
- **Commit:** `22c5ed1f`

**2. [Rule 2 - Transparency] Rebound became a chip rather than staying an exclusion**
- **Found during:** Task 1
- **Issue:** 75.1-03 kept `rebound` on NOT_A_CONDITION as bookkeeping. A caught blow from a free-action item stays stored until the foes next move, and during that time the foe card showed no sign of it.
- **Fix:** Added the Rebound chip (tone bad, bare label).
- **Commit:** `604a5342`

## Known Stubs

None.

## Human check (milestone-close Pixel 7 batch)

- Fumble a Shield scroll in a fight with a low-INT non-Magic-User. The targeted foe should show "SHIELDED · n", and a long press should explain it.
- A fumbled Mirror Self should show "MIRRORED · n", and the long press should give the range you now hit it on.

## Self-Check: PASSED

- FOUND: src/browser/foeConditions.js, src/browser/foeDetails.js, test/unit/foe-conditions.test.js, test/unit/foeDetails.test.js
- FOUND commits: faa4452e, 604a5342, 51be5269, 22c5ed1f
