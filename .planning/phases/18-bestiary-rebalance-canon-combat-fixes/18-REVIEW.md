---
phase: 18-bestiary-rebalance-canon-combat-fixes
reviewed: 2026-09-14T00:32:57Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - content/bestiary.js
  - content/BESTIARY-REBALANCE.md
  - content/damage-multipliers.js
  - content/index.js
  - engine/combat.js
  - engine/foeDamage.js
  - engine/items.js
  - engine/magic.js
  - src/browser/eventNarration.js
  - test/unit/bestiary-yardstick.test.js
  - test/unit/combat.test.js
  - test/unit/content-tables.test.js
  - test/unit/foe-damage.test.js
  - test/unit/foe-turn-draw-count.test.js
  - test/unit/item-wiring.test.js
  - test/unit/magic.test.js
  - tools/bestiary-yardstick.mjs
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-09-14T00:32:57Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the new `engine/foeDamage.js` seam, its wiring into every damage-to-foe
call site in `engine/combat.js`, `engine/magic.js`, and `engine/items.js`, the
CANON-04 multiplier table (`content/damage-multipliers.js`), the nine-row
bestiary number changes, the yardstick tool, and the new narration
entry — tracing draw order, multiplier/halfDmg/soak ordering, physical-vs-spell
bypass gating, and rounding edge cases by hand and cross-checking against the
pinned rng-draw-count tests.

The engine logic itself is solid: the locked modifier order (multiplier →
halfDmg → gated d20 soak → apply) is implemented exactly as documented in
every call site, the d20 soak draw is correctly gated on
`physical && !crit && foe.sp.ar > 0` everywhere it's used, spell damage
correctly never draws the soak roll, ally/party/reflect/item damage correctly
never triggers the hero-only Trachea row, `killFoe` accounting stays entirely
at call sites, and `Math.round`/`Math.ceil` are applied in the documented
order with no double-application on multi-hit paths (volley, quake, `atk>1`).
Ran the full suite (`npm test`) — 796/796 passing, confirming no regression
was introduced. I did not find a correctness bug in the seam itself or its
callers; the two `npm test`-confirmed-correct code paths already have
extensive dedicated coverage (`foe-damage.test.js`, the Phase 18 sections of
`combat.test.js`/`magic.test.js`, `foe-turn-draw-count.test.js`'s draw pins).

What I did find are two provable documentation defects (one of them a
factual miscount that also leaked into this review's own task brief, which
quoted the same wrong number) and two minor narration/naming nits that are
low-risk today but are exactly the kind of thing that misleads the next
person working in this code (notably Phase 21, which the docs explicitly
say will use this document as its starting point).

## Warnings

### WR-01: `content/bestiary.js`'s header comment miscounts the number of rows this phase actually changed

**File:** `content/bestiary.js:11`
**Issue:** The header comment states: "Phase 18 (BEST-01/BEST-02) deliberately
moved ten entries away from the prototype's numbers." A `diff` against the
phase-start snapshot (`git show e01ac46:content/bestiary.js`) shows exactly
**nine** rows carry a number change and a `DELIBERATE RULES CHANGE` marker:
Drake, Stalka Beast, Djinni (T4), Djinni (T5), Krupke, Werebeast, Drudge (T4),
Drudge (T5), Vampire. `content/BESTIARY-REBALANCE.md`'s own "Change ledger"
table (lines 414-424) independently lists the same nine rows and no tenth.
Sterling is the likely source of the miscount — its verdict is "UNCHANGED wp
35 (D-19)" (only the pre-existing `sp.halfDmg` flag gets a new engine-side
effect; the bestiary.js row's numbers do not move) — but if that's the
intended tenth entry, the comment should say so explicitly rather than just
stating a bare, unverifiable "ten." This same inflated count was repeated
verbatim in this review task's own brief ("bestiary number changes (10
entries...)"), which is exactly the kind of downstream confusion a stale
source-of-truth comment causes. Phase 21 is explicitly documented as
starting its retune from this file and `BESTIARY-REBALANCE.md` — an
off-by-one here is low-severity today but will actively mislead whoever
reconciles "what moved in Phase 18" next.
**Fix:**
```diff
-// Phase 18 (BEST-01/BEST-02) deliberately moved ten entries away from the
-// prototype's numbers; the full before/after stat table, yardstick
+// Phase 18 (BEST-01/BEST-02) deliberately moved nine entries' numbers away
+// from the prototype's values (Drake, Stalka Beast, Djinni x2, Krupke,
+// Werebeast, Drudge x2, Vampire) and wired a tenth pre-existing flag
+// (Sterling's sp.halfDmg) into the engine without changing its own numbers;
+// the full before/after stat table, yardstick
 // methodology and per-creature rationale live in content/BESTIARY-REBALANCE.md
```
(or simply correct "ten" to "nine" if Sterling was never meant to be counted).

### WR-02: `engine/foeDamage.js`'s own header comment is stale and misdescribes the shipped state

**File:** `engine/foeDamage.js:11-15`
**Issue:** The module header says: "This module's only rng draw is the
natural-armor d20 soak, and it is gated so that any creature without `sp.ar`
set ... draws nothing, keeping the parity suite byte-identical (**no call
site is routed through this seam yet in this plan; 18-03/18-04 do that
wiring**)." That parenthetical was accurate mid-plan (before 18-03/18-04
landed) but is false in the code as shipped: `engine/combat.js`,
`engine/magic.js`, and `engine/items.js` all import and call `damageFoe` at
every damage-to-foe site (confirmed by `git diff` against the phase-start
tree, and enforced by `test/unit/foe-damage.test.js`'s own "invariant: ...
contains zero foe-side wp decrements on code lines" test). A reader opening
this file cold — e.g. in Phase 19 or Phase 21 — will be told the seam is
still unused dead code, directly contradicting the file's own opening
paragraph three lines above ("Every path that deals damage to a foe ... is
meant to route through `damageFoe`") and the reality that it is the sole
foe-wp decrement site in the engine.
**Fix:**
```diff
-// This module's only rng draw is the natural-armor d20 soak, and it is
-// gated so that any creature without `sp.ar` set — including all four
-// fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante) — draws nothing,
-// keeping the parity suite byte-identical (no call site is routed through
-// this seam yet in this plan; 18-03/18-04 do that wiring).
+// This module's only rng draw is the natural-armor d20 soak, and it is
+// gated so that any creature without `sp.ar` set — including all four
+// fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante) — draws nothing,
+// keeping the parity suite byte-identical. Every foe-damage site in
+// engine/combat.js, engine/magic.js, and engine/items.js is routed through
+// this seam (wired by 18-03/18-04); test/unit/foe-damage.test.js's
+// "invariant" tests enforce it stays that way.
```

## Info

### IN-01: `earthquake` narration reports a single flat amount that CANON-04 can now make untrue per-target

**File:** `src/browser/eventNarration.js:241`
**Issue:** `earthquake: (e) => ... "${e.amount ?? 0} to everyone in the room."` —
this line is unchanged by Phase 18, but the semantics under it changed:
`engine/magic.js`'s quake handler (lines 168-178) now routes each foe's hit
through `damageFoe`, so a Walking Dead foe in the blast actually takes double
the reported `amount` while every other foe takes exactly the reported
amount. The engine-side comment at the call site already acknowledges this
("the event below reports the single rolled base, not the per-foe applied
amount"), so this is a known, deliberate scope limit rather than an
oversight — but the player-facing copy still asserts a uniform number ("to
everyone") that is no longer literally true in a mixed encounter containing
Walking Dead. Low priority (informational combat-log copy, not a mechanical
bug — each foe's own `wp` is still correct), but worth a follow-up once
Phase 19/21 revisits narration.
**Fix:** Either soften the wording ("The floor heaves. Everyone in the room
feels it.") to avoid promising a uniform number, or have the narration layer
read each foe's own applied damage from a per-foe event instead of the
single `earthquake` summary.

### IN-02: `mult` is overloaded with two unrelated meanings on the same `spellHit` event

**File:** `engine/magic.js:349-357`, `src/browser/eventNarration.js:267`
**Issue:** In the "thrown" spell branch, `const mult = Math.max(1, c.level -
sp.lvl)` (the p.26 caster-level-vs-spell-level area/duration multiplier) is
computed, then `damageFoe` internally computes and returns its own,
completely different `hit.mult` (the CANON-04 damage-source x creature-type
multiplier). The pushed `spellHit` event carries only the first one under the
field name `mult` (`events.push({ type: "spellHit", ..., mult })`), which
`eventNarration.js`'s `spellHit` builder then renders as `(×${e.mult})` when
`e.mult > 1`. The in-code comment at the call site does flag this
("`mult` in the event stays the level multiplier above (unrelated to the
seam's own multiplier)"), so it's intentional and covered by tests today —
but the on-screen `(×2)` badge a player sees for a "level-scaled area spell"
is visually indistinguishable from what a future CANON-04 UI affordance
(e.g. "×2 vs Demons") would look like, and any future contributor adding a
`hit.mult` readout to this same event will silently collide with the
existing field.
**Fix:** Rename the level-scaling field on the event (e.g. `levelMult`) to
free `mult` for the seam's own multiplier, or explicitly namespace both
(`areaMult` / `typeMult`) so a future narration change can't conflate them.

---

_Reviewed: 2026-09-14T00:32:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
