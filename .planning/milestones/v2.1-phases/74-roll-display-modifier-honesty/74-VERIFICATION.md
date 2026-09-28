---
phase: 74-roll-display-modifier-honesty
status: passed
verified: 2026-09-25
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 2/2 requirements
human_verification:
  - "Hero sheet and combat menu: a new level-1 hero's TO HIT reads the class range on d20 (Magic User 18–20, Fighter 16–20; a Thief with a Dagger 16–20); the combat menu's STRIKE row reads 'Hit 16–20 (d20) · … dmg' and FLEE reads an 'N–20 (d20)' range"
  - "Oracle and fight log, foe side: get insulted after a failed parley while Sidestep is up — the foe's line reads '(Sidestep +2, insulted −1)', and tapping that fight-log row reveals the same signs"
  - "Heights/water fear: a Heights climb reads '−2 on the climb' (or the live penalty) on both the Oracle and the rail"
  - "Foe details: long-pressing a foe shows 'You hit it on … · it hits you on …' with live modifiers; after casting Weaken the card's Weakened line reads 'it hits you only on 18–20 (d20)'; a magic-only foe without a magic weapon reads 'You cannot touch it'"
  - "Hero condition chips: tapping the Afraid chip in a fight opens with '−3 to hit (now …)'; tapping a live Anklet of Invisibility chip opens with its effect on the foes' swings"
  - "Item comparisons: a heavy weapon found or shopped while holding a Club reads '−2 to hit, worse than your Club'; a precise blade's crit range reads roll-high on your own die ('crits on 19–20')"
  - "No surface shows the same modifier with opposite signs, and no screen prints 'N+', a percent, or an old 'need N or less' number"
---

# Phase 74: Roll Display & Modifier Honesty — Verification

**Verdict:** passed on automated evidence. The device checks above are batched into the milestone-close Pixel 7 checklist.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| ROLL-02 | 74-01: the engine's own to-hit chains are extracted byte-identically into `engine/derived.js` (`targetStrikeFaces`, `heroStrikeFacesVs`, `foeSwingVsHero`), and the engine calls them; 135 equivalence tests check them against real engine events. 74-02: `rollRange.js` is the one range formatter ("16–20 (d20)"). 74-04: `rollOdds.js` feeds the hero sheet and the combat menu's STRIKE/FLEE rows. 74-06: foe details show two-way live odds. 74-03: the Oracle, fight-log and rail roll lines. 74-08: the range-format pin (18–20 / 17–20 / 16–20 at level 1) | ✓ |
| ROLL-03 | 74-02: one signed-modifier formatter keyed on the roller (`playerDelta`: foe rolls negate). 74-03: foe lines re-signed; the `needModsClause` ambiguity is closed; heights/water read "−N on the climb/leap". 74-05: comparisons say which way ("−2 to hit, worse than your Club"), and the device-trigger case is closed. 74-06/74-07: foe and hero condition effects are measured through the engine, never restated. 74-08: a build-failing cross-surface sign guard (`test/unit/roll-sign-consistency.test.js`) drives the real engine across the Oracle, fight log, rail, hero sheet, combat menu, foe details and lootCompare, plus a one-formatter source scan. The guard was proven by flipping a roller: 4 of 11 tests failed | ✓ |

## Automated gates

- Full `npm test` on master after the final merge: **5986/5986 pass, 0 fail, 0 todo** (up from 5,752 at the Phase 73 close).
- Parity: **53/53 pass**. Zero fixture, divergence-record, comparable or prototype-master moves (`git diff 0f6dc5c` against the declared untouched paths is clean). The engine diff is exactly `engine/combat.js` + `engine/derived.js`, the 74-01 byte-identical extraction, which the orchestrator accepted as the planner's judgment call because 74-CONTEXT requires foe details to reuse engine functions.
- The Phase 72 direction tests, the Phase 73 roll-high pins, the guard and `feedback-payload.test.js` all pass.
- Shell snapshots re-pinned deliberately, 3 in total: `mu.hero.txt` and `thief.hero.txt` (TO HIT now shows a range), and `thief-store.store.txt` (named-weapon verdict and roll-high crits).
- `npm run boot:check`: 4/4 PASS on master. One earlier run failed "graves" and passed on the rerun; that flakiness is the known Phase 50 environment problem.

## Notes

- Worktree-only line-ending noise: the shell-snapshot regenerator writes LF, so a worktree shows the snapshots as modified with an empty diff. The executors restore them before returning. Master stays clean.
- Handoffs recorded in `docs/ROLL-LEDGER.md` (Phase 74 display closure):
  - Phase 77: ability-timer indicators through `conditionEffects.js`'s `WHAT_IF` hook, and the Dazed chip text.
  - Phase 78: climb-card odds in the range format.
  - Phase 79: roll-under prose in content.
