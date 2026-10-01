---
phase: 91-race-sub-class-audit
plan: 06
subsystem: combat-identity
tags: [ident-17, bard, sing, once-per-fight, spell-echo, castspell-free-mode, derived-stream, narration, audit]
requires:
  - phase: 90-spell-skill-audit
    provides: the reworked offense and protection spells, the one shared rising resist (foeResistsSpell / foeResistsEffect), the derived-stream and narration-ledger patterns
  - phase: 91-race-sub-class-audit
    provides: docs/IDENTITY-AUDIT.md rows and the IDENT-17 ruling (91-01), the footer entries list the audit parses
provides:
  - "content/songs.js: SONG_TITLES (the five old song names plus eleven templated titles with a {spell} slot) and SONG_SCHOOLS (offense, protection), re-exported from content/index.js"
  - "engine/combat.js: songPool(level), songReady(state) once per fight (state.combat.sang), sing() picking and resolving one spell from derivedRng(cursor, 'song', acts)"
  - "engine/magic.js: castSpell opts { free, afterRng }, a charge-free, book-free, backfire-free cast whose foe turn runs on the main rng; a call without opts is byte-identical"
  - "sang { title, spell, level } and actionRefused sungThisFight, both narrated on the Oracle and the rail; the four per-song events retired"
  - "the SING menu row (READY / SUNG THIS FIGHT), the bot singing once in every fight, the Bard's footer, trait and blurb stating the song and the dim-witted foes plainly"
affects: [91-07, 91-10, phase-91.2, phase-92]
tech-stack:
  added: []
  patterns:
    - "a free/scoped option on the one resolver (castSpell opts) instead of a second resolver, so a song is the same code path a Magic User's cast is"
    - "pick-then-resolve from ONE derived stream keyed on the main cursor, the main rng left to the foe turn"
key-files:
  created:
    - content/songs.js
    - test/unit/bard-song.test.js
    - test/unit/bard-song-lines.test.js
    - docs/narrative-pass/why/91-06.json
  modified:
    - engine/combat.js
    - engine/magic.js
    - src/browser/combatMenu.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/tuning-bot.mjs
    - tools/lib/voice-corpus.mjs
    - tools/lib/event-variants.mjs
    - content/index.js
    - content/identity.js
    - content/flavor.js
    - test/parity/harness/comparables.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/IDENTITY-AUDIT.md
    - docs/ROLL-LEDGER.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/unit/combat.test.js
    - test/unit/cast-refusals.test.js
    - test/unit/combatMenu.test.js
    - test/unit/tuning-bot.test.js
    - test/unit/control-at-depth.test.js
    - test/unit/control-at-depth-rules.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/spell-depth-resist.test.js
    - test/unit/usable-features-audit.test.js
    - test/unit/combat-gear-lock.test.js
    - test/unit/rations-audit.test.js
key-decisions:
  - "SING is a combat action once per fight (the user's change of 2026-09-30); the flag lives on the fight (state.combat.sang) so it can never leak between fights"
  - "the song's pool is every offense and protection spell at or below the Bard's level in SPELLS order; 'defense' is the protection school"
  - "a song resolves through castSpell with { free: true, afterRng: rng } rather than a second resolver; the pick, the title and every roll of the spell come from the song stream, the foe turn from the main rng"
  - "the Bard has no school bonus, so a song is cast like an Apprentice's or Illusionist's spell (+0 school bonus), not a Wizard's (+3 offense): the plan's 'as a Magic User of the Bard's level' is read as the baseline Magic User"
  - "a sung Death the Bard cannot afford fizzles and the round passes to the foes (the song is spent; there is no charge to refund)"
  - "resistControl and controlCapRounds are no longer called by anything, but stay exported: nine unit pins still exercise them"
  - "the dead C.inspired term and its chip are left for a later cleanup (deferred-items.md): removing them touches nine files and the 79-07 chip copy"
requirements-completed: [IDENT-17]
status: complete
duration: about 3h
completed: 2026-10-01
---

# Phase 91 Plan 06: The Bard sings once per fight Summary

**IDENT-17, the hero Bard: SING is a once-per-fight combat action whose song is one random offense or defense spell at or below the Bard's level, cast at full strength and free of charges through castSpell's new free mode under a sung title; the dim-witted-foes drawback is stated plainly.**

## What was built

- **The song table** (`content/songs.js`): `SONG_TITLES` holds the five old song names (used as they stand) and eleven templated titles with a `{spell}` slot ("An Ode to {spell}", "{spell}, in a Minor Key", "The {spell} Blues", ...); `SONG_SCHOOLS` is offense and protection. Two titles for one spell are two songs, never merged.
- **castSpell's free mode** (`engine/magic.js`): a sixth parameter `opts = { free, afterRng }`. `free` skips the charge check, the book/level/school refusal, the charge spend and the Apprentice backfire draw; every other branch is unchanged. `afterRng` carries the trailing foe turn (four `afterPlayerAction` sites, the Death too-weak branch included). A call without opts is byte-identical (pinned).
- **The song** (`engine/combat.js`): `songPool(level)` (SPELLS order, never empty at level 1), `songReady(state)` (a Bard in a live, joined fight that has not sung), `sing(state, rng, events, now)`: refuse pending / no fight / wrongClass / sungThisFight, then set `combat.sang`, derive `derivedRng(cursor, "song", acts)`, pick the spell and the title from it, push `sang`, and cast the spell with `{ free: true, afterRng: rng }`. The main rng draws nothing for the song itself. The five fixed songs, `resistControl` x2, `controlCapRounds` and the squares cooldown (`c.songAt`) are gone from Sing.
- **The menu** (`combatMenu.js`): the SING row reads `songReady`; READY, then SUNG THIS FIGHT (greyed); the description says "Once per fight: sing a random offense or defense spell of your level or lower, at full strength, no charges spent."
- **The bot** (`tuning-bot.mjs`): `if (songReady(state)) return { type: "sing" }` after talk-first, so a Bard sings once in every fight at any level.
- **The text**: `sang` quotes the title and names the spell on the Oracle ("You sing "An Ode to Freeze". The song lands as Freeze.") and the rail ("Song: An Ode to Freeze (Freeze)"); the second song is "One song a fight. The audience has had enough." on both; the four per-song builders (beastsSoothed, songIgnored, lullabyRolled, thunderRolled) and the rail fold's beastsSoothed entry are retired. `bard-song`, `bard-target`, the footer and `SUB_NOTE.Bard` state the song rule and "foes with intelligence no higher than 3 always attack you when a Joiner is in the fight" (worded "no higher than 3" because the footer hygiene guard bans "3 or less").

## Phase 90 check (the plan's start-of-plan verify)

Phase 90 added no offense or protection spell that castSpell cannot resolve for a non-Magic-User caster: every kind in the pool (ward, might, status, thrown, stun, weaken, acid, stupid, blind, shrink, blast, quake, vapor, volley, petrify, insane, death, turn, gate, senses) reads only `c.level`, `c.sub` (for the school bonus and the Apprentice and Summoner clauses, both inert for a Bard), the foes and the state. Two findings, both handled: (1) a Wizard carries a +3 offense school bonus (`MU_CHART`), so a Wizard's Freeze throws easier than a song's; the Bard has no chart row, so a song is cast at +0 like an Apprentice's or Illusionist's spell. This is the plan's "as a Magic User of the Bard's level" read as the baseline Magic User, flagged below. (2) Death's "too weak" branch refunds a charge (`spellsUsed--`); in free mode there is no charge, so it fizzles, spends the round and refunds nothing.

## Flagged assumption (IDENT-17, for your review)

"Full strength, as a Magic User of the Bard's level would cast it" is implemented with the Bard's own +0 school bonus, so a song is never weaker than the spell cast by a baseline (Apprentice or Illusionist) Magic User of the same level, but IS weaker than a Wizard's offense spell (+3 to hit on thrown spells, a longer Special stretch irrelevant here). If you want songs to carry a Wizard's bonus, it is one line (a school-bonus override in the free branch); I did not give the Bard a Wizard's +3 because that is a sub-class identity, not a level.

## Fixture drift (IDENT-17, hero)

Measured, not assumed. **No parity fixture, no roll-high state pin, no save-compat `expected` moved**: no fixture hero is a Bard and no script holds a `sing`; none of the eight pinned bot runs is a Bard; `castSpell` without `opts` is byte-identical, so every non-Bard run is unchanged. `node tools/fixture-inventory.mjs --json` shows the same roster; `node --test "test/parity/**/*.test.js"` passes untouched; `node tools/roll-high-baseline.mjs pins` hashes every label as before (and `save` was never run); `test/parity/prototype-master.js.txt` is untouched. The new serialized fact `combat.sang` and the prototype's `c.songAt` are carved out of all three `*Comparable()` functions (a tripwire for a future Bard parity script). The 19 bot-driven test files (the bot-run pins): 358 tests, 358 pass. A smoke (not a balance run) of six forced-Bard bot runs: 34 songs in 44 fights, 0 refusals, nine distinct spells, 23 distinct titles, no exception.

What did move, declared with before/after in `test/parity/FIXTURE-INVENTORY.md` ("Phase 91 plan 06"): the unit pins and guard lists that named the old song (combat, cast-refusals, control-at-depth and its RULES-18 guard, the draw inventory `combat.js` amount 23 to 20 and selection 3 to 5, the SING menu row, the bot test, the hero-conditions coverage guard, spell-depth-resist, the usable-features audit and its doc), the Bard's identity text, the 91-06 why-ledger (35 rows) and the regenerated review pages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two stale pins from plan 91-03, fixed first in their own commit (as instructed)**
- **Found during:** the start of the plan (deferred-items.md from 91-05).
- **Fix:** `combat-gear-lock.test.js`'s payload table gained the `teleportPick` row; `rations-audit.test.js`'s `engine/movement.js` rng-line pin was re-measured at 21: the three added matching lines are "Pure; no rng." doc comments, the d8, d8 and d20 teleport draws are the same declared ones (confirmed against the commit before 91-03, which read 18). Dated comment added.
- **Commit:** 0aee7fa9

**2. [Rule 2 - Missing critical] A sung Death the Bard cannot afford**
- **Found during:** Task 1 (reading castSpell's Death branch).
- **Issue:** the too-weak branch does `c.spellsUsed--` (a refund) and returns without a foe turn; in free mode no charge was spent, so `spellsUsed` would go negative and the song would be a free action.
- **Fix:** in free mode the branch skips the refund, runs the foe turn on `afterRng` and returns; the song is spent. Pinned in `bard-song.test.js`.
- **Commit:** 6c964561

**3. [Rule 3 - Blocking] Tests and guards that named the old song**
- **Found during:** Tasks 1 to 3 (targeted runs).
- **Issue:** `cast-refusals.test.js` (not in the plan's file list), `control-at-depth.test.js` (four Bard Lullaby / Thunder tests), `control-at-depth-rules.test.js` (the audited-site list), `roll-high-guard.test.js` (the draw inventory), `hero-conditions.test.js` (coverage-guard self-check and the reasoned non-condition list), `spell-depth-resist.test.js` (a "sing is the one caller left" pin), `usable-features-audit.test.js` and `docs/USABLE-FEATURES-AUDIT.md`, `tuning-bot.test.js`, `docs/ROLL-LEDGER.md` C13, and `tools/lib/event-variants.mjs` (two scoped toggles so the corpus reaches the new sang and sungThisFight lines) all encoded the old song.
- **Fix:** each rewritten or retired with the reason named in its comment and in FIXTURE-INVENTORY; the four retired Lullaby / Thunder tests are replaced by one pin that a sung Doze at floor 20 rolls the shared rising resist and never `resistControl`.
- **Commits:** 6c964561, 5dfcd8f6, cf5f4506, eec44998

### Plan items not done, with the reason

- **Plan Task 1 step 4 (remove `C.inspired` from `toHit` / `toHitBreakdown` and any chip): not done.** Nothing writes `combat.inspired` any more, but it has readers in `derived.js` (three sites), `conditionEffects.js`, `heroConditions.js` and `mazeworld.html` (three label spots, a parallel-edited file) and pins in six test files (one digest-pinned), plus the voiced 79-07 chip copy and a ROLL-LEDGER row; the audit row `bard-song` already hands the chip's copy to 91-10. Zero behavior either way; logged in `deferred-items.md` for 91-10 or a later cleanup.
- **`mazeworld.html` was not touched.** Its `beastsSoothed` check (the "THEY STAND DOWN" outcome) is now dead; logged in `deferred-items.md`. This kept this plan out of the file the Phase 91.2 executor is editing.
- **`resistControl` and `controlCapRounds` stay exported** (no engine caller; nine unit pins still exercise them); the JSDoc and the audit say so.
- **No full `npm test`** (the user's testing ruling of 2026-10-01); only the touched and pinning tests ran, counts below.

## Deferred Issues

See `.planning/phases/91-race-sub-class-audit/deferred-items.md`: the dead Inspire chip and `C.inspired` reads, and the dead `beastsSoothed` branch in `mazeworld.html`.

## Known Stubs

None.

## Threat Flags

None (no new network, auth, file or trust-boundary surface; the song is pure engine arithmetic on a derived stream).

## Human verification (deferred to end of run)

For the batched Pixel 7 checklist at milestone close:

1. As a Bard, open the combat menu in a fight: SING says READY with a plain description; sing: the Oracle names the song's title and the spell it echoes, and the effect lands like that spell.
2. SING again in the same fight: it is greyed out (SUNG THIS FIGHT). In the next fight it is ready again.
3. The Hero tab says the Bard sings once per fight and that dim-witted foes always come for you when a Joiner is along.

## Verification

Targeted runs (no full `npm test`, per the user's ruling): the consolidated set of every test file I touched or that pins what I moved (the parity glob, bard-song, bard-song-lines, combat, magic, scroll-read, cast-refusals, spell-mechanics, combatMenu, identity-contract, identity-footer, identity-audit, the narration coverage and table guards, voice-corpus, narrative-review, safety-scan, stale-terms, hp-surface-guard, tuning-bot, the roll-high pins, guard and ledger sync, combat-gear-lock, rations-audit, control-at-depth and its rules guard, spell-depth-resist, control-spells-depth, hero-conditions, usable-features-audit, afraid, hero-out, item-audit-fixes, rollDirection and the three shell combat tests): **1220 tests, 1220 pass, 0 fail**. The 19 bot-driven pin files: 358 of 358. `node tools/narrative-review.mjs --check` reports the pages in sync; `node tools/voice-inventory.mjs --check-ledgers --after` reports 0 errors. `git diff` on `test/parity/prototype-master.js.txt`, STATE.md, ROADMAP.md and REQUIREMENTS.md is empty.

## Commits

- 0aee7fa9: test(91-06): fix the two stale pins 91-03 left
- 6c964561: feat(91-06): the Bard sings once per fight, a random offense or defense spell at full strength (IDENT-17)
- 5dfcd8f6: feat(91-06): the SING row, the bot, the narration and the Bard's text say once per fight (IDENT-17)
- cf5f4506: docs(91-06): declare the Bard song drift (no fixture or pin moved) and mark the audit rows (IDENT-17)
- eec44998: test(91-06): move the guards and the usable-features audit that named the old song

## Self-Check: PASSED

All created files exist (content/songs.js, test/unit/bard-song.test.js, test/unit/bard-song-lines.test.js, docs/narrative-pass/why/91-06.json), all five commits are in git log, and the acceptance greps hold (songPool 1, "free: true, afterRng: rng" 1, "opts.afterRng ?? rng" 4, SONG_TITLES export 1, sungThisFight on both surfaces, SONG_TITLES in the voice corpus 1, "once per fight" in identity.js 1).
