---
phase: 20-parley-balance-language-system
reviewed: 2026-09-14T13:17:18Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - engine/combat.js
  - engine/derived.js
  - mazeworld.html
  - src/browser/eventNarration.js
  - test/parity/combat-parity.test.js
  - test/parity/full-suite.test.js
  - test/parity/harness/comparables.js
  - test/parity/FIXTURE-INVENTORY.md
  - test/unit/combat.test.js
  - test/unit/fluency.test.js
  - test/unit/parley.test.js
  - test/unit/parley-button-mirror.test.js
  - test/unit/parley-carveout.test.js
  - test/voice/safety-scan.test.js
  - tools/tune-difficulty.mjs
  - docs/PARLEY-REBALANCE.md
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-09-14T13:17:18Z
**Depth:** standard
**Files Reviewed:** 16 (grouped above; `04eb229..HEAD` diff on each)
**Status:** issues_found

## Summary

This phase rewrites parley's payout formula (`killSpFor`-derived structural
half, D-01/D-02), tightens the Humans wilmst bonus odds (D-03), caps parley
to one attempt per encounter with a failure-aggro cost (D-05/D-06/D-20), and
wires a graduated `fluency(c)` tier (D-09..D-11) into `canParley`/`parley`,
plus the mazeworld.html classic mirror (D-17) and the parity carve-out
(`stripParleyDivergence`, D-13/D-18).

I traced every locked decision in `20-CONTEXT.md` against the landed code:

- `killFoe`'s draw + arithmetic is byte-identical after the `killSpFor`
  extraction (confirmed against the pre-change inline formula via
  `git diff`, and via `test/unit/fluency.test.js`'s 5×4×3×5×6-case sweep).
- `C.parleyTried = true` is written (engine/combat.js:689) BEFORE the `d20`
  draw (line 699) and BEFORE the payout draws — a thrown error mid-`parley()`
  cannot leave a free retry.
- `need = Math.min(9 + bonus, 17)` is an inclusive `<= 17` ceiling (85%),
  matching D-08's stated target and the test suite's explicit "17 succeeds,
  18 fails" pin (test/unit/parley.test.js test 8).
- `C.parleyInsulted`'s `need += 1` / `mNeed += 1` is applied at exactly the
  two documented `foeTurn` sites (engine/combat.js:1256, 1279), is
  post-draw arithmetic (zero extra rng draws), and correctly does NOT reach
  the ability-bolt path (`resolveFoeAbility`, which has no to-hit `need` to
  widen) — matching D-06/D-20 and the "ability gate is a separate,
  zero-`need` path" invariant.
- The Wilmsry-vs-Magical refusal (engine/combat.js:681-688) is reachable
  ONLY for a fluency-2 Wilmsry vs Magical (gated by `canParley`'s own
  fluency check before the racial branch is ever reached), sits before
  `C.parleyTried` is set, and draws nothing — matching D-12.
- `stripParleyDivergence` (test/parity/harness/comparables.js:344-355)
  strips exactly `c.sp`, `c.gold`, `combat.parleyTried`,
  `combat.parleyInsulted`, is applied ONLY when `scenario.name === "parley"`
  at both of its two replay sites (test/parity/combat-parity.test.js:139,
  test/parity/full-suite.test.js:119), and `combatComparable` itself still
  exposes `c.sp`/`c.gold` for every other scenario — confirmed by
  `test/unit/parley-carveout.test.js` and by re-running the parity suite.
- Every new engine event type (`parleyInsulted`, `parleyExhausted`, plus the
  extended `parleyRefused`/`parleyRolled`/`goldGained`) has an
  `EVENT_NARRATION` entry, and `test/voice/safety-scan.test.js`'s
  `BASE_EVENT`/`BRANCH_TOGGLES` were extended to exercise every new ternary
  branch (`fluency: 2`/`0`, `why: "parley"`/`null`,
  `reason: "wilmsryVsMagical"`) through the family-friendly scanner.
- The mazeworld.html classic `canParley()`/`fluency()` mirror (lines
  4208-4229) is line-for-line identical in decision order to
  `engine/combat.js#canParley`/`engine/derived.js#fluency`, and is proven so
  by `test/unit/parley-button-mirror.test.js`'s 576-case matrix replay
  against the actual `fs.readFileSync`'d source (not a copy). The classic
  `parley()` function (mazeworld.html:4230) is confirmed genuinely dead —
  `grep` shows only `canParley()` is called from the render/keybinding paths;
  the actual button (`window.mzParley`, mazeworld.html:6277) dispatches
  `engineCombatAction("parley")` into the engine, never the classic function.
- `tools/tune-difficulty.mjs`'s new parley tally is read-only over the
  `events` array returned by `applyAction`; it does not feed back into
  `decideAction`'s policy or draw any rng of its own — confirmed by reading
  the diff, no dial/behavior change.

I ran the full parley-related unit suite (122 tests) and the parity suite
(`combat-parity.test.js`, `full-suite.test.js`) locally; all pass.

One real gap survived this trace (below, WARNING) — the `C.parleyInsulted`
aggro bonus is scoped, by the locked decision's own wording, to `foeTurn`'s
two call sites only, and does not reach `pursuitStrike` (the Spectre-style
melee punish on a successful flee). This is spec-compliant per D-06/D-20's
literal text ("in foeTurn"), but it is a real mechanical/narrative
inconsistency worth flagging since the narration text ("aiming with real
intent from here on") implies the effect is fight-wide.

## Warnings

### WR-01: `C.parleyInsulted`'s aggro bonus does not reach `pursuitStrike`

**File:** `engine/combat.js:520-539` (pursuitStrike), compare with `:1256` and `:1279` (the two foeTurn sites that do apply it)

**Issue:** A failed parley sets `C.parleyInsulted = true` and narrates
"You have made it personal... They will be aiming with real intent from
here on." (`parleyInsulted` event, src/browser/eventNarration.js). The
mechanical effect (`need += 1` / `mNeed += 1`) is applied at the two
`foeTurn` melee-swing sites (engine/combat.js:1256, 1279), but NOT inside
`pursuitStrike` (engine/combat.js:520-539), which computes its own
`need = foeToHitVs(state)` (line 528) and applies `C.foeToHitPenalty` but
never `C.parleyInsulted`. `pursuitStrike` fires on every successful `flee()`
exit (Cloaker escape, round-1 tracked withdrawal, and a normal
roll-vs-11 escape) when a live foe carries `sp.pursues` (the Spectre).
Concretely: insult the room with a failed parley, then flee successfully
while a Spectre-type foe is still alive — its parting strike uses the
un-widened `need`, silently understating the "aiming with real intent"
promise the narration just made.

This exactly matches the locked decision's literal scope (D-06: "every foe
to-hit roll **in `foeTurn`**"; D-20: "at BOTH `foeTurn` call sites"), so it
is not a violation of the written spec — but it is a real, currently
untested gap (no test in `parley.test.js`/`combat.test.js`/
`parley-carveout.test.js` exercises `parleyInsulted` + `pursuitStrike`
together), and no fixture or bestiary row currently exposes `sp.pursues` on
a fixture-pinned creature, so it will not surface until a future phase wires
a pursuing foe into a reachable parley-then-flee sequence.

**Fix:** Either (a) explicitly document in a comment on `pursuitStrike` that
`C.parleyInsulted` is deliberately excluded (mirroring the existing
`C.foeToHitPenalty` precedent already read there), so a future reader does
not assume it is an oversight, or (b) if the intent really is "every foe
to-hit roll for the rest of the fight" (matching the narration's plain-English
promise), add the same one-line guard `pursuitStrike` already has for
`C.foeToHitPenalty`:
```js
let need = foeToHitVs(state);
if (pursuer.blind) need = 1;
if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);
if (C.parleyInsulted) need += 1; // consistent with the foeTurn sites
```

## Info

### IN-01: `parleyRefused`'s generic fallback branch is now unreachable dead code

**File:** `src/browser/eventNarration.js` (the `parleyRefused` builder), compare with `engine/combat.js:686`

**Issue:** `parleyRefused` is only ever pushed from one call site
(`engine/combat.js:686`, always with `reason: "wilmsryVsMagical"`) — a
`grep` of `engine/combat.js` for `parleyRefused` confirms this is the only
push site in the entire engine. The narration builder's ternary
(`e.reason === "wilmsryVsMagical" ? ... : "Not this time, not with them."`)
therefore has a fallback branch that can never currently execute. This is
harmless (and `test/voice/safety-scan.test.js`'s branch toggles still
exercise it defensively), so it is not a functional defect — flagging only
because a future reader may reasonably (but incorrectly) assume some other
call site still produces a reason-less `parleyRefused`.

**Fix:** No action required; optionally add a one-line comment noting the
fallback is defensive/future-proofing only, not currently reachable.

---

_Reviewed: 2026-09-14T13:17:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Orchestrator disposition (2026-09-14, corrected)

- **WR-01 — FIXED (after a corrected premise):** the first disposition claimed the Spectre (the only `sp.pursues` creature) was Walking Dead and therefore unreachable by an insulted group. That was wrong — the Spectre is filed under **Demons** (`content/bestiary.js` ~L64-73), a TALKATIVE type at fluency >= 1 and for Con Artists / Wilmsry, so a failed parley followed by a flee past a Spectre IS reachable. Fix: `pursuitStrike` now applies the same post-draw `if (C.parleyInsulted) need += 1` as the two `foeTurn` sites (zero extra draws); `test/unit/parley.test.js` test 16 pins it (need N -> N+1 with the same literal roll). The 20-02 `pursuitStrike` md5 pin was a same-plan no-change guard and is intentionally superseded by this fix. Caught by the Phase 20 verifier.
- **IN-01 — accepted as-is:** the generic `parleyRefused` fallback line is defensive dead code behind a single push site; harmless, left for future refusal reasons.
