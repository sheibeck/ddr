---
phase: 91-race-sub-class-audit
plan: 05
subsystem: combat-identity
tags: [ident-16, parley-01, master-of-arms, never-flees, parley-rewards, foe-spoils, derived-stream, narration, fixtures]
requires:
  - phase: 90-spell-skill-audit
    provides: fleeRefusal and parleyBlockedReason (90-09), Door Illusion and Chameleon Tongue, the derived-stream and narration-ledger patterns
  - phase: 91-race-sub-class-audit
    provides: docs/IDENTITY-AUDIT.md rows and rulings (91-01), the footer entries list the audit parses
provides:
  - "engine/derived.js#neverFlees(c) and NEVER_FLEES: the one never-leaves-a-fight predicate (Samurai, Master of Arms)"
  - "combat.js#fleeRefusal reads it; flee, Smoke, the tracked withdrawal and the Door Illusion cast and scroll all refuse a Master of Arms (fleeRefused masterOfArms, castRefused masterOfArmsStays), zero draws"
  - "combat.js#foeSpoils(state, f, rng, events, opts): the purse and item-drop check shared by killFoe (main rng, byte-identical) and parley (derived stream)"
  - "a won parley pays the full killSpFor sum, every live foe's spoils into the pending pile and the Humans tip on top, with parleyWon { count, sp, gold, items }"
  - "greyed FLEE row (NEVER plus a one-line reason) for the Master of Arms and the Samurai; the bot fights on; the PARLEY row says what a parley is and what it pays"
  - "six parley traits reading can always parley with X with their own roll bonus; moa-never-leaves replaces moa-withdraw"
affects: [91-08, 91-10, phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "one exported predicate in derived.js read by the engine refusal, the menu and the bot (neverFlees)"
    - "extract a shared helper from a hot path with golden before/after values recorded from the base code (foeSpoils)"
    - "a new roll that must not move any existing draw is keyed on the main cursor after every main draw and drawn from derivedRng"
key-files:
  created:
    - test/unit/moa-never-leaves.test.js
    - test/unit/parley-rewards.test.js
    - docs/narrative-pass/why/91-05.json
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/magic.js
    - src/browser/combatMenu.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/tuning-bot.mjs
    - content/identity.js
    - content/flavor.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/IDENTITY-AUDIT.md
    - docs/PARLEY-REBALANCE.md
    - docs/FLEE.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "fleeRefusal stays the exported predicate (90-09's tests and castSpell read it) and now delegates to the new neverFlees, which the menu and the bot import from derived.js"
  - "A Master of Arms' refused Door Illusion uses its own castRefused reason, masterOfArmsStays, because masterOfArms is already the Chameleon Tongue's parley refusal and would have printed the wrong line"
  - "withdrawalDenied is retired outright (builders, lists and tests) rather than kept: the coverage guards fail an entry nothing emits"
  - "stripParleyDivergence needed no extension: the parley scenario's action-path record skips the per-action byte diff and pins only declared end-state fields, so the fixture's declared after-values were re-measured and re-declared instead"
  - "the Helm of Knowledge text (Phase 89-09) already says you can always parley, so it was left alone"
requirements-completed: [IDENT-16, PARLEY-01]
status: complete
duration: about 4h
completed: 2026-10-01
---

# Phase 91 Plan 05: The Master of Arms never leaves a fight; a parley pays Summary

**A Master of Arms can leave a fight by no route at all (one predicate, `neverFlees`, shared with the Samurai and read by flee, Smoke, Door Illusion, the menu and the bot), and a successful parley now pays the fight's full experience plus every live foe's normal spoils from a derived stream, with the Humans tip on top and a card that says so.**

## What was built

- **IDENT-16.** `derived.js#neverFlees(c)` / `NEVER_FLEES` (Samurai, Master of Arms). `combat.js#fleeRefusal` delegates to it (`"samurai"` / `"masterOfArms"`); `flee()` refuses with `fleeRefused { reason }` in every round, round 1 of a tracked fight and 1 HP included, with zero draws, before the Cloaker vanish, the tracked withdrawal and Smoke are even reached. The Master of Arms branch of the tracked withdrawal is gone (every other Fighter's clean exit runs its same three statements) and the `withdrawalDenied` event, its Oracle and rail builders and its table entries are retired. The combat menu's FLEE row for a Master of Arms or a Samurai is disabled, cost `NEVER`, one-line reason in the house voice, never odds and never the WITHDRAW label; it stays tappable so the engine's own refusal explains. The bot reads `neverFlees` at both flee sites (the low-HP flee and the Wizard fallback) and fights.
- **PARLEY-01.** `foeSpoils(state, f, rng, events, opts)` is `killFoe`'s purse and item-drop block moved out unchanged (the bag-upgrade check and `offerLoot` included); `killFoe` calls it, so a kill is byte-identical (pinned against goldens recorded from the base code). `parley()` pays `heroSpFor(round(Σ killSpFor))`, never halved; keeps its main-rng draws exactly (d20, experience d6 per live foe, the tip d6 and amount d6); then rolls `foeSpoils` for each live foe in `C.foes` order from `derivedRng(<cursor>, "parleySpoils", <acts>)` (coin as `goldGained` why `"parley spoils"`, drops into `state.pendingLoot`); pushes `parleyWon { count, sp, gold, items }`; then `checkLevel` and `endCombat`. Chameleon Tongue's cast goes through `parley()`, so it pays the same.
- **Surfaces.** `parleyWon` Oracle line and rail twin (the rail folds the roll into it), `goldGained` "parley spoils" phrasing, `fleeRefused` and `castRefused` lines for the Master of Arms, `COMBAT_MENU_COPY.parleyDesc` rewritten (what a parley is, what it pays, what failing costs), plus `neverFlees`, `neverFleesReason` and `doorBlocked.masterOfArms`.
- **Identity text.** `moa-never-leaves` replaces `moa-withdraw`; the six parley traits read "can always parley with X" and state their own bonus as the engine applies it (Elven +3 vs Humans, Woodsman +3, Con Artist +4, Wilmsry +4; Bard and Court Mage add none, so claim none); `SUB_NOTE["Master of Arms"]` states the new drawback and keeps the +2, the armour patching and the abilities joke.

## Escape paths gated (the audit's `unstated:moa-escape-routes`)

All pinned in `test/unit/moa-never-leaves.test.js` for the Master of Arms and the Samurai:

1. Ordinary flee d20: refused every round, zero draws, no foe turn.
2. Cloaker's free vanish: a Cloaker's (a Thief); a Master of Arms or Samurai never reaches it (flee refuses first).
3. Tracked round-1 withdrawal (dead code: nothing sets `C.tracked`): refused for both; every other Fighter still withdraws cleanly.
4. Smoke (a live smoke window turns a flee into an escape): refused, since the refusal sits ahead of it; a Pilfer still escapes through it.
5. Door Illusion, cast and scroll (scroll via `readScroll` over 60 `state.acts` values): refused through `castSpell` before any charge, the turn unspent; a read scroll stays spent (RULES-10) and the reader is told why.
6. A successful parley: closed to a Master of Arms by `parleyBlockedReason` (it can never parley); open to a Samurai by design (the audit says so).

No item, staff or scroll ends a fight by leaving (checked: `grep` over `endCombat`/`fled` in engine files).

## Flagged assumption (PARLEY-01, for your review)

"The fight's normal spoils" is read as each live foe's coin purse and item-drop check exactly as `killFoe` rolls them (the Pickpocket's extra take included, which 91-08's Q1 change will carry through `gainWilmst`), and NOT the Cooking ration a slain beast gives: a parleyed beast walks away alive, so nothing is cooked. Foes already slain in the fight paid when they died and are skipped. A second thing worth your eye: a kill damps the hero's experience by party size (PARTY-06), but a parley has never split experience with Joiners, so a hero with a party gets the full sum from a parley and a share from kills. I left that as it was (the ruling says "never halved"); say if a parley should be split too.

## Fixture drift (IDENT-16, PARLEY-01)

Predicted, then measured against the plan base 79740d4c, declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 91 plan 05") and regenerated alone. `test/parity/prototype-master.js.txt` is untouched; `roll-high-baseline.mjs save` was never run; no new serialized field was added (`parleyWon` is an event, the spoils reuse `pendingLoot`), so no `*Comparable()` carve-out was needed.

- **Kills: byte-identical** (six seeded `killFoe` goldens from the base code: events, gold, experience, pile, rations, rng cursor).
- **Parity (66 of 66 after one declaration).** `action-script.combat.json` scenario `parley` (seed 303), declared engine-side `after`: `sp` 1 to 2 (full experience of the one live level-1 foe; the old half of 2 was 1), `gold` 50 to 60 (the talked-down Ned's purse from the derived stream); `wp` 51, `kills` 0, `rations` 8 unchanged, no drop. `stripParleyDivergence` was not extended (the scenario's action-path record skips the per-action diff).
- **Roll-high pins: 0 of 8 labels moved**, `roll-high-save-compat` unmoved (no pinned run wins a parley or is a Master of Arms trying to flee). Nothing re-recorded.
- **Unit pins moved:** `parley.test.js` (seed-303 pin sp 5 to 10 and gold 50 to 60 on its cursorless rng, payout 33 to 65 and 8 to 15, the Humans tip now tip plus spoils, the D-02 property reads "never more than the kill"), `combat.test.js` (`spGained` 8 to 15), `identity-contract.test.js` and `identity-combat.test.js` (the Master of Arms bad half), `linesForAction.test.js` (adjacency probe now uses `vanishDenied`), and the four narration table lists that named `withdrawalDenied`. `parley-carveout.test.js` needed no change (the carve-out is untouched).
- **Docs:** `IDENTITY-AUDIT.md` rows (`moa-never-leaves` fixed engine and text, `unstated:moa-escape-routes` fixed engine, `moa-withdraw` retired, the six parley traits and their three unstated-bonus rows fixed text, the Samurai row, rows reordered to the audit test's order), `identity-audit.test.js` pre-registered list (moa-never-leaves is live now), `PARLEY-REBALANCE.md` section, `FLEE.md`, `USABLE-FEATURES-AUDIT.md`, ledger `91-05.json` (26 rows) with regenerated review pages (`narrative-review --check` in sync, `voice-inventory --check-ledgers --after` 0 errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narration moved into Tasks 1 and 2**
- **Found during:** Tasks 1 and 2
- **Issue:** the coverage guards (`EVENT_NARRATION has no entries for event types the engine never emits`, the LINE_FOR dead-entry guard, the every-event-has-narration guards) fail the moment the engine stops emitting `withdrawalDenied` or starts emitting `parleyWon`, so the narration could not wait for Task 3.
- **Fix:** the Master of Arms `fleeRefused` and `castRefused` lines and the retirement of `withdrawalDenied` went into Task 1's commit; `parleyWon`, `goldGained` "parley spoils", the rail fold and the PARLEY row went into Task 2's. The ledger rows and review pages stayed in Task 3, so `narrative-review.test.js` is red between the Task 2 and Task 3 commits and green at the end.
- **Commits:** d96baa3e, db985fe8

**2. [Rule 1 - Bug] The Master of Arms' door refusal needed its own castRefused reason**
- **Issue:** `fleeRefusal` returns `"masterOfArms"` and castSpell passes the reason through, but `castRefused` reason `"masterOfArms"` already means the Chameleon Tongue's "one answer, and it is not a sentence" line.
- **Fix:** castSpell pushes `"masterOfArmsStays"` for the door case, with its own Oracle, rail and menu lines. `fleeRefused` (the flee action) keeps `"masterOfArms"` as the plan states.
- **Commit:** d96baa3e

**3. [Rule 3 - Blocking] Files outside the plan's list had to move**
- `test/unit/identity-audit.test.js` (moa-never-leaves left the pre-registered list), `test/unit/combat.test.js` (the parley experience), `test/unit/linesForAction.test.js`, `test/parity/fixtures/action-script.combat.json` (the fixture's declared after-values), `docs/FLEE.md` and `docs/USABLE-FEATURES-AUDIT.md` (they described the retired denial), `test/unit/narrationLinesCoverage.test.js`, `narrationLinesTable.test.js`, `fightLog.test.js`, `shell-fight-log.test.js` (the retired event's list entries). None of `comparables.js`, `parley-carveout.test.js`, `docs/ROLL-LEDGER.md` or `treasure-tables.js` needed an edit (see the key decisions).
- **Commits:** d96baa3e, db985fe8, 9e5ccf83

TDD note: tests were written alongside each task's implementation inside the one task commit, not as separate failing-first commits; the kill goldens were recorded from the base code before `foeSpoils` was extracted and the extraction was checked identical before the test was written.

## Deferred Issues

Two failures in the targeted run belong to the base commit, not to this plan, and were left alone (scope boundary; logged in `deferred-items.md`): `test/unit/combat-gear-lock.test.js` "payload table covers exactly ACTION_TYPES" (plan 91-04's new `teleportPick` action is missing from that table) and `test/unit/rations-audit.test.js` "engine/movement.js's rng.-bearing line count" (21 against 18). Neither file nor `engine/movement.js` / `engine/actions.js` changed here (`git diff 79740d4c HEAD` empty for the engine files).

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface: `parleyWon` is an event, the spoils use the existing `pendingLoot`, and the refusal paths add no input.

## Human verification (deferred to end of run)

1. As a Master of Arms, open SOCIAL in a fight: FLEE is greyed out with a one-line reason and no odds; the same for a Samurai.
2. As a Bard (or anyone who can talk to Humans), win a parley against Humans: the Oracle says what it paid, the loot screen offers the dropped items, and the experience matches a won fight.
3. Read the PARLEY row's description: it says what a parley is, what it pays, and what failing costs.
4. The Hero tab footer for an Elf says "can always parley with Humans, +3 on that parley roll".

## Verification

- Per the standing testing rule the full `npm test` was not run. Run: `moa-never-leaves.test.js` 18 of 18, `parley-rewards.test.js` 18 of 18, the plan's Task 1 verify list (identity-contract, identity-combat, combatMenu, flee-ledger, flee-retune) pass, `node --test "test/parity/**/*.test.js"` 66 of 66, `roll-high-state-pins`, `roll-high-save-compat` and `roll-high-guard` 24 of 24, `identity-audit` and `identity-footer` pass, `node tools/narrative-review.mjs --check` in sync, `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` 0 and `--check-ledgers --after` 0 errors. A sweep of the 167 test files that mention parley, flee, the Master of Arms, the identity text, the menu or the narration tables: 4,211 tests, 4,209 pass, the 2 failures being the base-commit ones above.
- Acceptance greps: `neverFlees(` is in `engine/combat.js`, `src/browser/combatMenu.js` and `tools/lib/tuning-bot.mjs`; `reason: "masterOfArms"` is in `engine/combat.js`; `foeSpoils(` appears 4 times, `"parleySpoils"` once, `parleyWon` twice; `moa-never-leaves` once and `can always parley with` six times in `content/identity.js`; `### Phase 91 plan 05` once in FIXTURE-INVENTORY; `git diff` for `test/parity/prototype-master.js.txt`, STATE.md, ROADMAP.md and REQUIREMENTS.md is empty.

## Commits

- `d96baa3e` feat(91-05): the Master of Arms never leaves a fight; one predicate for every escape (IDENT-16)
- `db985fe8` feat(91-05): a won parley pays full experience, the fight's spoils and the Humans tip, and says so (PARLEY-01)
- `9e5ccf83` feat(91-05): say what the engine does: Master of Arms never leaves, every parley trait reads can always parley; measure and declare
- `54d64017` chore(91-05): keep the parleySpoils stream key written once in combat.js

## Self-Check: PASSED

Created files exist (`test/unit/moa-never-leaves.test.js`, `test/unit/parley-rewards.test.js`, `docs/narrative-pass/why/91-05.json`, this summary) and commits `d96baa3e`, `db985fe8`, `9e5ccf83` and `54d64017` are on the worktree branch.
