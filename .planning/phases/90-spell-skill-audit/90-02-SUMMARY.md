---
phase: 90-spell-skill-audit
plan: 02
subsystem: abilities
tags: [pommel-strike, abilities, joiners, fighter, stun, narration, bot, fixture-drift, abil-07]
requires:
  - phase: 90-01
    provides: the skill audit row for Pommel Strike (ruled -> 90-02) and the Q1 to Q11 rulings
  - phase: 89
    provides: the Joiner ability pipeline (alliesTurn policy, memberStrike) the Joiner half runs through
provides:
  - "Pommel Strike as a real strike that also stuns, for the hero (playerStrike, descriptor stunOnHit) and for Joiner Fighters (memberStrike mod stunOnHit)"
  - "test/unit/pommel-strike.test.js: 19 pins (hero and Joiner hit, miss, kill, shatter, double strike, cooldown, draw count, plain-strike parity, text)"
  - "the fair bot's valuation: a ready Pommel Strike replaces a plain strike in any round"
affects: [90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "the ability-strike descriptor (C.abilityStrike) grows one field, stunOnHit, read once after the attack loop; the member path passes the same field in memberStrike's mod"
key-files:
  created:
    - test/unit/pommel-strike.test.js
    - docs/narrative-pass/why/90-02.json
  modified:
    - engine/abilities.js
    - engine/combat.js
    - content/abilities.js
    - content/skills.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/tuning-bot.mjs
    - test/unit/abilities.test.js
    - test/unit/party-abilities.test.js
    - test/unit/abilities-catalog.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/days-farm.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/ABILITIES.md
    - docs/SKILL-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "The stun rides the existing ability-strike descriptor as stunOnHit (the Kata and Death Touch pattern); one stun per strike however many blows land"
  - "Flagged assumption ABIL-07 (unclassified probe): a hit means any landed blow of the strike on the target; a double strike stuns once; a killing blow stuns nobody; a Skeleton shattered by the blow is simply dead; the 4-round cooldown is spent on use whether or not the blow lands (the Kata and Feint precedent)"
  - "A soaked hit (the foe's armour swallowed the damage) still counts as a landed blow and stuns"
  - "The fair bot uses a ready Pommel Strike in any round when nothing else applies; a Joiner's policy (round-1 opener only) is unchanged"
requirements-completed: [ABIL-07]
status: complete
duration: ~one long session
completed: 2026-09-30
---

# Phase 90 Plan 02: Pommel Strike strikes and stuns (ABIL-07) Summary

**Pommel Strike is now a real strike that also stuns, for the hero and for Joiner Fighters: the plain strike's roll, weapon damage, crits and extra attacks, and a landed blow that leaves the target standing also costs it its next turn, cooldown still 4, no new rng draw.**

## What was built

- **Hero** (`engine/abilities.js`, `engine/combat.js#playerStrike`): `case "pommelStrike"` sets `C.abilityStrike = { key: "pommelStrike", stunOnHit: true }` and calls `playerStrike` (which tail-calls `afterPlayerAction` once). `playerStrike` tracks whether a blow of this strike reached the damage seam on the target; after the attack loop, with `stunOnHit`, a landed blow and a target still alive, it calls `applyPommel` and pushes one `pommelStruck` after the strike's own hit events. `foeTurn`'s existing stunned skip takes the lost turn in the same dispatch.
- **Joiner Fighter** (`engine/combat.js#resolveMemberAbility`, `#memberStrike`): `case "pommelStrike"` calls `memberStrike` with `mod { key, stunOnHit: true }`; after a landed blow that leaves the target standing it applies `applyPommel` and pushes `pommelStruck` carrying `member`. Pommel Strike stays the Joiner's round-1 opener (`pickMemberAbility` unchanged).
- **Text** (`content/abilities.js`, `content/skills.js`, identical): "the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn". The combat menu row and the Hero tab read it from content. The text does not repeat "cooldown 4 rounds": no other ability's text does (the menu shows the cooldown as its cost chip).
- **Narration** (`eventNarration.js`, `narrationLines.js`): `pommelStruck` now reads as the blow's follow-through. Oracle: "The pommel follows through to Viper's temple. Viper sees stars and loses its next turn." Rail: "Viper sees stars and loses its next turn." A Joiner's name still leads; a bare payload renders "It" and "its", never "undefined". No new event type, so no new coverage entry. `docs/narrative-pass/why/90-02.json` carries four rows (the two lines chained from 79-04's afters, and the two text rows), the "after"s read from the live corpus; `node tools/narrative-review.mjs` 615 -> 617 rows, `--check` in sync.
- **Bot** (`tools/lib/tuning-bot.mjs#chooseAbility`): before, Pommel Strike was a round-1 opener only (a stun-only ability the bot spent once a fight); a later round fell through to a plain attack. Now, when it is ready and no opener, damage or defensive ability applies, the bot uses it in any round (it is never worse than STRIKE). A Kata (or any damage ability) still outranks it. Pinned in `bot-tactics.test.js`. No bot readout was run (Phase 92).
- **Ledgers**: `docs/ABILITIES.md` (catalog text, the resolution table now lists Pommel Strike as a strike, the member table row), and the `docs/SKILL-AUDIT.md` Pommel Strike row (text, engine, rule, Joiner, verdict `fixed engine (90-02)`, pinned by `test/unit/pommel-strike.test.js`).

## Tests

- New `test/unit/pommel-strike.test.js` (19 tests, red first against the stun-only engine, then green): hero hit (event order abilityUsed, struck via pommelStrike, pommelStruck, foeStunned; damage equal to the same roll of a plain strike; the flag consumed), hero miss (no stun, no pommelStruck, cooldown started), same cooldown for hit and miss (cd 4), kill (no stun), Skeleton shatter (simply dead), no extra draw (a landed hit draws exactly 2; a miss draws what a plain miss draws), Barbarian double strike (one stun, two blows; one blow landing is enough; a second blow that kills stuns nobody), never worse than a plain strike, cooldown refusal; Joiner hit (7 damage, `member`), miss (`allyMissed` via pommelStrike, 4-round cooldown on the member's sheet), kill, two draws; the text.
- Prohibition ("Pommel Strike must never cost the hero its own attack: on the same roll it is never worse than a plain strike"): pinned by the damage-parity and never-worse tests (same roll, same foe damage, plus the stun).
- Existing assertions re-pinned (before -> after):
  - `abilities.test.js` "round economy: a non-strike ability (pommelStrike)": it used Pommel Strike as its non-strike rung on filler draws; Pommel Strike strikes now, so the rung is pinned on Brace.
  - `abilities.test.js` "pommelStrike: pushes pommelStruck" and "Task 2: pommelStrike's f.stunned makes the target skip ...": the stun fired on bare filler draws (no swing); both now feed a landed blow (raw 3, damage die 4) first.
  - `party-abilities.test.js` "pommelStrike/dirtyTrick/poisonedEdge/hamstring/mark ... zero draws": Pommel Strike left that list (it draws two now) and has its own test.
  - `abilities-catalog.test.js`: the pinned Pommel Strike text.
  - `bot-tactics.test.js`: one new case (round-3 use, cooldown, Kata outranks it); the existing cases are unchanged.

## Fixture drift

Parity fixtures never dispatch an ability (the action scripts are chargen, movement and plain fights); measured against the plan base 63c5fcae.

- `node --test "test/parity/**/*.test.js"`: 66 tests, 66 pass. **Zero parity drift.** `test/parity/prototype-master.js.txt` untouched.
- `roll-high-save-compat.test.js` and `test/unit/fixtures/hazard-commit/golden.json`: unchanged.
- **`roll-high-state-pins.test.js`: 1 of 8 labels moved, `party-fighter-knight`**: 400 / alive / depth 4 -> **297 / dead / depth 3**, hash `a1ecbfbb...` -> `5d0bb1f6...`. A per-step state-hash trace against a scratch tree of the plan base shows steps 1 to 99 byte-identical; the first divergence is bot step 100, the hero's round-1 opener: the base's Pommel Strike only stunned (the Joiner then killed the foe); the new one swings (stealthStrike, struck via pommelStrike, foeKilled), and the stream moves on. Only this label was pasted by hand from `node tools/roll-high-baseline.mjs pins` (hashed identically twice) with a dated comment; `save` was not run. The other seven labels re-measured byte-identical.
- **`days-farm.test.js`, camp-guard regression**: seed 55434 (a Summoner solo start that recruits a Joiner; its Pommel Strike is a Joiner Fighter's) went campGuard 200 -> 0 (campFailed 0 either way); seed 15839 (a Barbarian) went 195 -> 0 (not traced). Re-pinned to the first `seedList(120)` Summoner solo start whose measured run fires the guard: **seed 293004** (index 37), campGuard 139, campFailed 0. The assertion is unchanged.
- The full account (predictor, scan, entries) is the "### Phase 90 plan 02" section of `test/parity/FIXTURE-INVENTORY.md`.

## Flagged assumption (ABIL-07, unclassified probe) for the user's review

"A hit also makes the target lose its next turn" was built as: any landed blow of the strike on the target stuns (a double strike stuns once, never twice); a killing blow stuns nobody; a Skeleton shattered by the blow is simply dead; a miss stuns nothing; and the 4-round cooldown is spent on use whether or not the blow lands (the Kata and Feint precedent). Two small edges the plan did not name: a hit the foe's armour soaks (no damage) still counts as a landed blow and stuns; and a foe with extra lives that dies and revives from the blow is alive afterwards and is stunned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seed pin in `days-farm.test.js` moved by the new rule and the bot change**
- **Found during:** Task 3 (the full-suite run)
- **Issue:** the camp-guard regression pinned seed 55434, whose run no longer reaches the situation (campGuard 200 -> 0).
- **Fix:** measured the new behaviour of 120 seeds, re-pinned to seed 293004 with a dated comment, declared in FIXTURE-INVENTORY.
- **Files modified:** `test/unit/days-farm.test.js`, `test/parity/FIXTURE-INVENTORY.md`
- **Commit:** 2f820020

**2. [Plan reading] SKILL-AUDIT verdict updated, which the plan's file list did not name**
- The project rules ask for the Pommel Strike row's verdict and pin to be updated; `docs/SKILL-AUDIT.md` was added to the work (`test/unit/skill-audit.test.js` still requires the row to name 90-02, which `fixed engine (90-02)` does).

TDD note: Task 1 was committed as one commit (the failing test file was written and run red against the old engine first, 17 of 19 failing for the right reasons, then the implementation made it green); there is no separate `test(...)` RED commit.

## Known Stubs

None.

## Threat Flags

None (no new network, auth, file or schema surface).

## Human verification (deferred to end of run)

1. A Fighter with Pommel Strike uses it on a foe: the Oracle shows a normal hit with its damage, then the foe loses its turn; on a miss nothing is stunned and the ability still cools down 4 rounds.
2. With a Joiner Fighter in the party, round 1: the Joiner opens with Pommel Strike, hits and stuns (the rail names the Joiner).

## Verification

- `npm test` (full run, after the last change): 8,727 tests, 8,725 pass, **0 fail**, 2 skipped. None of the known worktree CRLF doc-ledger failures appeared in this worktree.
- `node tools/narrative-review.mjs --check`: in sync.
- `git diff --stat` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs`, `docs/narrative-pass/corpus-base.json`: empty.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them).

## Commits

- 09efd9e8: feat(90-02): Pommel Strike is a real strike that also stuns, for the hero and Joiner Fighters
- 103b23c9: feat(90-02): narrate Pommel Strike's stun as the blow's follow-through; the bot uses it in place of a plain strike
- 2f820020: test(90-02): measure and declare the Pommel Strike drift; abilities and skill ledgers state the new rule

## Self-Check: PASSED

Created and present: `test/unit/pommel-strike.test.js`, `docs/narrative-pass/why/90-02.json`; commits 09efd9e8, 103b23c9, 2f820020 exist; full suite fail 0.
