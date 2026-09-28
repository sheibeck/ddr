---
created: 2026-09-27T23:55:00.000Z
title: Every foe-targeted spell can be resisted
area: rules
files:
  - engine/magic.js:42-45 (RESIST_IMMUNE_KINDS)
  - engine/magic.js:152-172 (the p.25 resistance check in castSpell)
  - engine/derived.js:2228 (resistRoll: intel >= 12 gate, d20 roll-high)
  - engine/derived.js:2234+ (controlResistRoll: the past-the-knee control resist, RULES-18)
  - engine/combat.js (resistControl)
---

## Problem

User (2026-09-27): "does every spell have a chance to be resisted? It should."

Today, no. There are two resist checks:
1. **The canon p.25 check** (`castSpell`): only a non-thrown spell can be resisted, and only by an intelligent target (`resistRoll`: intel >= 12; below that, no roll at all). `RESIST_IMMUNE_KINDS` = thrown, ward, might, regen, heal, reveal, foresee, summon, mirror.
   - **Thrown damage spells can never be resisted** by any foe.
   - **A foe with intel < 12 never resists** any spell under this check. Most beasts fall here.
2. **The RULES-18 control resist** (Phase 75.3): past the depth knee, Freeze, Stone, Doze/Sleep, Weaken, Stupid, Blind and Shrink each get a depth-scaled resist. Below the knee this check draws nothing.

The self and ally kinds (ward, might, regen, heal, reveal, foresee, summon, mirror) don't target a foe, so "resisted" doesn't apply to them unless the user says otherwise.

## Solution

A rule change against canon p.25, so it's a deliberate design decision (the user's call). Before implementing, settle:
- **Scope:** every spell aimed at a foe, thrown damage included. Confirm that self and ally spells stay unresistable.
- **The chance:**
  - does every foe get some floor chance (e.g. a small base plus an intel-scaled part, keeping intel >= 12 as the strong resisters)?
  - does a resisted thrown spell do nothing, half damage (a "save for half"), or something else?
  - how does it stack with the RULES-18 depth resist (one roll or two)?
- **Foe casters vs the hero:** engine/foeAbilities.js uses resistRoll for the hero's side. Decide whether the hero gets the same universal chance.
- Every resist gets its Oracle and rail line (the existing spellResisted / resistFailed events), and the roll-high phrasing plus the chip and foe-card ranges must agree (roll-sign-consistency, authored-ranges).
- It moves balance: it's a big lever for casters. It needs parity measurement, re-pins with traced causes, and a bot re-measure of the tail and class matrix (Phase 79.1's START row passed at the limit on four targets).

## User rulings (2026-09-27)
- **Now, before this release.** "Every spell cast on an enemy should have a chance to be resisted based on their intelligence. High intelligence is more chance to resist. I'd like this in now. I want the resist rolls noted in the Oracle, too."
- **A resisted damage spell has no effect** (the whole spell fizzles, like other spells).
- **Scale: half-intel.** The resist faces on a d20 are max(1, round(intel / 2)), so the chance is faces / 20: intel 1–2 → 5%, 6 → 15%, 10 → 25%, 16 → 40%.
- Every resist roll, whether it succeeds or fails, is noted in the Oracle with its roll.
