---
phase: 90-spell-skill-audit
plan: 09
subsystem: spells
tags: [door-illusion, chameleon-tongue, size-of-the-behemoth, illusion-school, illusionist-book, scroll-table, fumbles, narration, chips, fixtures, spell-10]
requires:
  - phase: 90-04
    provides: the one depth-rising resist (foeResistsSpell) every foe-targeted spell rolls
  - phase: 90-06
    provides: the school gates (canCast, schoolClosed, MU_CHART), school-gates.test.js iterating SPELLS, the derived roll path for appended rows, rollGrimoire's derived stream
  - phase: 90-07
    provides: spellEffectSquares and the Special rows; the fixture record this plan extends
  - phase: 90-08
    provides: the control-spell patterns (holdFoe, misdirectFoe, the one-tail-per-spell shape, the chips and ledger shape); SPELLS at 38 rows
provides:
  - "Door Illusion (Illusion 1), Chameleon Tongue (Illusion 3), Size of the Behemoth (Illusion 4) appended after Duplicate Foe (SPELLS is 41 rows, all ten slate spells in): combat-only, roll derived, gated by the chart with no extra code"
  - "combat.js#doorIllusionEscape (the cleverest foe's one resist, then the Smoke flee path with reason door), #behemothRoar (rout below the caster's level, per-foe cower for the rest), #fleeRefusal (the one never-flee predicate flee() and Door Illusion read), #parleyBlockedReason (the one parley predicate parley(), castSpell and the combat menu read)"
  - "derived.js#fluency(c, combat) reading the fight-scoped C.tongue (the fluency-2 Magical branch of canParley finally has a source); #foeSwingChain caps a cowering foe at 3 faces and #foeWeakened halves its damage; tongue joins SPELL_SELF_KINDS"
  - "castSpell refuses a Door Illusion the hero may not flee with and a Chameleon Tongue the fight's parley rules refuse BEFORE the charge is spent, with a reason line (the user's fairness rule)"
  - "rollGrimoire appends Door Illusion and one random Illusion spell (a derived-stream pick) to a new Illusionist's book: the canon p.17 three illusions"
  - "test/unit/scroll-pool.test.js: the user's scroll-table requirement pinned at depths 1, 2, 3, 4 and 9 (both schools at every band, all ten slate spells where the level allows, never Lesser Summon or Phantom Host)"
  - "scroll fumble rows (Door none, Tongue the new insulted effect, Behemoth weakened), the Cowering chip, Oracle and rail lines for every new event and reason, greyed Tongue and Door menu rows with the reason, ledger 90-09.json (26 rows)"
  - "the measured, declared fixture record for the full slate"
affects: [90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a refusal that must cost nothing lives in castSpell's ladder before c.spellsUsed++, reads one predicate exported from combat.js, and the combat menu reads the same predicate to grey the row"
    - "an appended grant that must not disturb a rolled book goes at the very end of rollGrimoire and draws from the call's derived stream after every existing draw"
key-files:
  created:
    - test/unit/escape-talk-rout-spells.test.js
    - test/unit/scroll-pool.test.js
    - test/unit/illusionist-book.test.js
    - docs/narrative-pass/why/90-09.json
  modified:
    - content/spells.js
    - content/scroll-fumbles.js
    - content/flavor.js
    - engine/combat.js
    - engine/derived.js
    - engine/magic.js
    - engine/character.js
    - engine/scrollFumble.js
    - src/browser/combatMenu.js
    - src/browser/foeConditions.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/SPELLS.md
    - docs/SPELL-AUDIT.md
    - docs/ROLL-LEDGER.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "The Illusionist's two grants (Door Illusion when not rolled, then one random Illusion spell) are appended at the very end of rollGrimoire, after the day-one top-ups, not beside Mirror Self: Door Illusion counted as a second ready level-1 spell would shrink the top-up and change the rolled part of every Illusionist's book. The random pick is the last draw on the derived stream, so no existing draw moves; the main rng is untouched (33 draws, as pinned)"
  - "Behemoth's cower is a per-foe flag (f.cowering), not the room's Weaken fields, so a Weaken's expiry (which clears C.weakened and C.foeToHitPenalty) can never lift it; foeSwingChain caps it at 3 faces before the insult and blind (blind stays last) and foeWeakened is true for it"
  - "parleyBlockedReason names its reasons parleySpent, ninja, masterOfArms, walkingDead, noTalk (canParley's gate at that fluency) and wilmsryVsMagical; castRefused carries that reason (or fleeRefusal's samurai) as its own reason, so the Oracle, the rail and the menu copy share one vocabulary"
  - "canParley(state, fluencyOverride) keeps its exact behaviour (a fluency-2 Wilmsry vs Magical still passes it and parley() then refuses); parley() reads parleyBlockedReason in its old order"
patterns-established:
  - "a fumbled spell can be a no-op (Door Illusion: the door does not open) or set an existing fight flag (Chameleon Tongue: the parley insult) with no new engine state"
requirements-completed: [SPELL-10]
duration: about 5h
completed: 2026-10-01
status: complete
---

# Phase 90 Plan 09: Door Illusion, Chameleon Tongue, Size of the Behemoth, the Illusionist's book and the scroll table Summary

**The last three of the ten slate spells, each Illusion, each gated by the chart with no extra code: Door Illusion walks you out of a fight through the flee path Smoke uses (the cleverest foe gets one resist), Chameleon Tongue IS the fight's one parley at fluency 2 (+4, Magical foes allowed, the Walking Dead never), and Size of the Behemoth routs the foes below your level and cows the rest for the fight; a refused Tongue or Door never costs a charge unexplained, a new Illusionist starts with three illusions, and the scroll roll table is pinned at every depth band with both new schools in it.**

## What was built

- **Content** (`content/spells.js`, `content/scroll-fumbles.js`, `content/flavor.js`): three rows appended after Duplicate Foe (41 rows), all `school: illusion`, `roll: "derived"`, `combatOnly: true`: Door Illusion `{ lvl 1, kind door, niche defensive }`, Chameleon Tongue `{ lvl 3, kind tongue, fluency 2, niche answer }`, Size of the Behemoth `{ lvl 4, kind behemoth, niche control }`, each with the slate's text (Door's resist stated in plain words, the Tongue's +4, the Behemoth's "top three numbers (6–8 on a d8, 18–20 on a d20)"). Fumble rows: Door `none` (the door does not open), Tongue the new `insulted` effect (sets `C.parleyInsulted`, the very flag a failed parley sets), Behemoth the existing `weakened` effect (d4+1). `SUB_NOTE.Illusionist` now names Mirror Self, Door Illusion and one more.
- **Door Illusion** (`engine/combat.js#doorIllusionEscape`): the live foe with the highest `intel` (the first in `C.foes` order on a tie) rolls the one depth-rising resist; a resist is `doorIllusionSeen { foe }` and the turn is spent; otherwise `forfeitLoot "fled"`, `fled { reason: "door" }`, `endCombat` with no flee roll and no parting blow (`pursuitStrike` is never called), Joiners leaving with the hero. `fleeRefusal(state)` is the one never-flee predicate (`"samurai"`); `flee()` now reads it (behaviour unchanged) and so does `castSpell`. Zero main-rng draws.
- **Chameleon Tongue** (`magic.js` tongue branch, `derived.js#fluency(c, combat)`, `combat.js#parleyBlockedReason`): `fluency` is the larger of the item source and `combat.tongue` (never stacked); the cast sets `C.tongue = 2`, pushes `tongueCast`, calls `parley()` and returns (a failed parley already runs the foes' turn, so it never runs twice). `parleyBlockedReason(state, fluencyOverride)` names why a parley cannot happen in `parley()`'s own order; `parley()` reads it for its refusals (behaviour unchanged), `castSpell` reads it before the charge, and the combat menu reads it to grey the row.
- **Size of the Behemoth** (`engine/combat.js#behemothRoar`): per foe in `C.foes` order, the one resist; a failer below the caster's level gets `alive false, fled true` (no `foeKilled`, no experience, no spoils), any other failer `f.cowering = true`; then `behemothCast { routed, cowering }`. `derived.js#foeSwingChain` caps a cowering foe at `COWER_FACES` (3) after the Weaken cap and before the insult and blind; `foeWeakened` is true for it (half damage at all four damage sites).
- **The refusal ladder** (`engine/magic.js#castSpell`): a `door` spell is refused when `fleeRefusal` names a reason and a `tongue` spell when `parleyBlockedReason` does, as `castRefused { spell, reason }` before `c.spellsUsed++`, with the turn unspent; a scroll's free cast of a refused spell is still consumed (RULES-10) and the line says why.
- **The Illusionist's book** (`engine/character.js#rollGrimoire`): Door Illusion (when it was not rolled) and one random Illusion spell it does not hold (through `grantableAt`, any level: a level-5 pick waits in the book) are appended at the very end of the function; the pick is the last draw on the call's derived stream.
- **Scroll roll table** (`test/unit/scroll-pool.test.js`, 10 tests): at depths 1, 2, 3, 4 and 9 the pool handed to `rng.pick` is exactly `SPELLS.filter(lvl <= min(5, depth + 1))` (19, 29, 36, 41, 41 rows), holds every slate spell allowed there (depth 1: Open/Lock, Door Illusion, Fly, Senseless; depth 2 adds Stop Time and Chameleon Tongue; depth 3 adds Enchant Character and Size of the Behemoth; depth 4 and deeper all ten), has both a Special and an Illusion row at every band and never Lesser Summon or Phantom Host. Reading: a Fighter (intelligence reader) whose scroll rolls Door Illusion escapes, a Warlock Magic User free-casts an Illusion scroll and does not copy it, a Wizard copies Stop Time but not Door Illusion, an Illusionist copies an Illusion scroll it is high enough for (and gets `scrollTooAdvanced` plus a free cast when not).
- **Surfaces**: foe chip Cowering (no count, one-line rule, no hidden number); the Chameleon Tongue and Door Illusion menu rows read disabled with the reason (`COMBAT_MENU_COPY.tongueBlocked` / `doorBlocked`) and stay tappable; Oracle lines and rail twins for `doorIllusionSeen`, `tongueCast`, `foeRouted`, `foeCowers`, `behemothCast`, the door flee, seven new `castRefused` reasons (each ends "No spell charge was spent" / "Nothing spent") and the `insulted` and Door fumbles; a failed resist folds behind a foe's own rout or cower line and behind the door escape on the rail. Ledger `docs/narrative-pass/why/90-09.json` (26 rows, every "after" read from the corpus); `narrative-review.mjs --check` in sync (721 rows).
- **Docs**: `docs/SPELLS.md` (a Phase 90 plan 09 section with the scroll pool by band), `docs/SPELL-AUDIT.md` (the three rows built with real text, engine and Pinned-by cells; the must-have-grants row; the pool counts), `docs/ROLL-LEDGER.md` (the draws), `docs/USABLE-FEATURES-AUDIT.md` (three rows), `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 09").

## Fixture drift

Predicted, then measured against the plan base a060c0b6 (an extracted tree, `git archive`), every moved entry declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 09") and regenerated alone. `test/parity/prototype-master.js.txt` is untouched; `roll-high-baseline.mjs save` was never run; `C.tongue` and `f.cowering` live inside `state.combat`, already carved out of every `*Comparable()`, so no new carve-out was needed.

**Cause.** The three rows are `roll: "derived"`, so no chargen main-rng cursor moved (`chargen-rng-pin.test.js` passes unedited: 33 for the Illusionist, 37 for the Apprentice; verified main-cursor-identical against the base for all eight Magic User sub-classes over seeds 1–500). What moved is content: (1) the Illusionist and the Apprentice (the two sub-classes that learn Illusion) can be dealt a spliced row, shifting every other spliced row's derived position, and the Illusionist's book gains the two appended grants (measured against the base over seeds 1–500: Illusionist 500 books changed, Apprentice 164, Wizard, Warlock, Sorcerer, Court Mage, Cleric and Summoner 0); (2) a scroll's `rng.pick(options)` is over 19, 29, 36 and 41 rows at depths 1 to 4+ (it was 18, 27, 33 and 38). The one new draw is derived: `roll-high-guard.test.js` DRAW_INVENTORY `engine/character.js` `selection` 13 to 14.

- **Parity (66 of 66 pass).** Chargen seed 8 (an Illusionist) `[Stupidity, Freeze, Acid, Insane, Mirror Self, Summon]` to `[Stupidity, Door Illusion, Freeze, Acid, Insane, Mirror Self, Chameleon Tongue]` (Door Illusion lands in the low walk and pushes Summon out of the six-spell cut; the random grant is Chameleon Tongue; `maxWP`, `wp`, `rations` unchanged; the record gains SPELL-10). Seeds 7, 15, 24, 29 and every no-grimoire seed unchanged; combat, magic, movement, economy and encounters scenarios unmoved.
- **Pins (re-recorded alone).** `roll-high-state-pins`: 2 of 8 labels (solo-magicuser-sorcerer 313/true/3 to 400/false/4; deep-8 300/false/11 to 300/false/11, the hash only), traced per bot step against the extracted base tree (first divergence: solo-magicuser-sorcerer at step 0, the depth-1 scroll read picks Sense Presence where the base read Turn Walking Dead; deep-8 at step 80, the first scroll read picks Death where the base picked Regeneration). solo-1, solo-2, solo-thief-pilfer, party-1, party-fighter-knight, deep-14 and `roll-high-save-compat` unmoved. `bot-tactics` Pilfer trio: seed 2 now stalls (depth 7 at 5000 actions under identity dials; seed 1 stalls too), swapped for seed 5 (505 actions, depth 4), the smallest untaken seed that dies naturally; the Sorcerer and Troll Knight trios re-confirmed in the test's own order. `guaranteed-attack-spell` special-school adjacency bound 8 to 9 (worst case Illusionist seed 174219, because the old reference algorithm never makes the two appended grants).
- **Table pins moved by the new rows (not fixtures):** `spell-table`, `content-tables`, `scroll-fumble-table`, `day-one-damage`, `removed-spells-load`, `special-timed-spells`, `control-slate-spells` (41 rows, the ten `roll: "derived"` rows, the tail order), `spell-resist` (`tongue` is a self kind), `fluency` (the second argument), `foe-conditions` (the Cowering chip, `tongue` not a foe status), `hero-conditions` (`tongue` not a hero condition), `usable-features-audit` (the doc lists all 41 spells). `chargen-rng-pin` and `scroll-fumble-resolve`, on the plan's list, needed no change (the cursors did not move; the resolve test iterates the table).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design] The Illusionist's grants are appended at the end of rollGrimoire, not beside Mirror Self**
- **Found during:** Task 1
- **Issue:** the plan replaces the Mirror Self grant line with the three grants in place. In place, Door Illusion would count as a second ready level-1 spell before the day-one top-up (`ready()` reaches 2 at once), shrinking the top-up and changing the rolled part of every Illusionist's book; and the random pick's `dr` draw would come before the spare-splice draws, moving them.
- **Fix:** Mirror Self stays where it was; Door Illusion (when not rolled) and the random pick come after the damage top-up, the pick being the last draw on `dr`. Documented in the JSDoc, `docs/SPELLS.md` and `docs/SPELL-AUDIT.md`; flagged below. **Commit:** 57c8d9b9.

**2. [Rule 3 - Blocking] Files outside the plan's list had to move**
- `docs/SPELL-AUDIT.md`, `docs/ROLL-LEDGER.md`, `docs/USABLE-FEATURES-AUDIT.md` (its doc-sync test lists every SPELLS name), `test/unit/fluency.test.js` (arity 2), `spell-resist`, `hero-conditions`, `foe-conditions` (the `tongue` coverage guards, test-owned), `guaranteed-attack-spell`, `bot-tactics`, `removed-spells-load`, `special-timed-spells`, `control-slate-spells` (pins), plus `test/parity/fixtures/action-script.chargen.json` (on the plan's list; `action-script.magic.json` needed no change). **Commits:** 57c8d9b9, 8d021233, 00645373.

**3. [Rule 2 - Missing critical] A Door Illusion row is also greyed, and every refusal says nothing was spent**
- The plan greys only the Tongue row; the menu also reads `fleeRefusal` for a Door Illusion row (reachable through the same predicate), and every new `castRefused` line ends by saying no spell charge was spent, so the user's fairness rule is on the screen and not only in the engine. **Commit:** 8d021233.

TDD note: the tests were written after the Task 1 implementation within the same task (one commit per task, tests with code), not first; there is no separate `test(...)` RED commit and the new tests were never run red. They pin each behavior bullet and pass.

## Flagged for the user

- **The Illusionist's grants come after the day-one top-ups** (Deviation 1). An alternative is the plan's in-place order, which changes the rolled part of every Illusionist's book; say if you want it.
- **A Door Illusion row is never greyed in the real menu**: the Samurai is not a Magic User, so the refusal is reachable only when a Samurai reads a Door Illusion scroll (the scroll is consumed, the line says why).
- **No "Fled" state on the foe card**: the card renders live foes only, so a routed foe simply leaves it; the plan's optional "Fled" chip was not built.
- **Chameleon Tongue pays whatever `parley()` pays**: Phase 91's PARLEY-01 rewards will apply to it unchanged, and a level-3 caster against level-3 foes parleys on 8–20 (65%), 4–20 (85%) at best.
- **Phase 92 note (for STATE, the orchestrator owns the write):** watch Magic User death depth with Door Illusion in the book (a free escape, every Illusionist now starts with it); the bot has no rule for it. The scroll pool is 41 spells from depth 4.
- **Joiner Magic Users do not cast the three yet**; `behemothRoar` takes `caster.by` and `caster.level` for 90-10.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface: `C.tongue` and `f.cowering` are combat-scoped fields, the three rows read the existing chart, and a refused cast spends nothing.

## Human verification (deferred to end of run)

1. Cast Door Illusion in a bad fight: you leave at once (no flee roll), the spoils are left behind; against a clever foe it sometimes fails and you lose the turn ("... is not buying it").
2. Cast Chameleon Tongue against Magical foes: the parley happens at +4 ("+4 for the tongue" on the roll line); after a parley has been tried, the Tongue row in the spell menu is greyed with the reason, and tapping it says nothing was spent.
3. Cast Size of the Behemoth on a mixed group: the weaker foes flee, the rest show "Cowering" and hit rarely and softly for the rest of the fight, even after a Weaken you cast runs out.
4. Roll a new Illusionist: its Grimoire has Mirror Self, Door Illusion and one more illusion; the Hero tab blurb says so.
5. Read several scrolls on floor 1 and on floor 4+: now and then a Special or Illusion spell comes up (Door Illusion, Open/Lock, Fly and Senseless from floor 1; the rest as the floors deepen).

## Verification

- `npm test` (full run, after the last file change): 9,038 tests, 9,036 pass, **0 fail**, 2 skipped (base on master 8,977 / 8,975 / 0 / 2; +61 new). None of the known worktree CRLF doc-ledger failures appeared. `www/index.html` build-artefact tests skip (no `www/`).
- `node --test "test/parity/**/*.test.js"`: 66 of 66. `node tools/narrative-review.mjs --check`: in sync (721 rows). `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0; `--check-ledgers --after`: 0 errors. `node --test test/unit/school-gates.test.js`: passes unchanged with the three rows in `SPELLS`.
- Acceptance greps: SPELLS has 41 rows with the last three Door Illusion, Chameleon Tongue, Size of the Behemoth; the four exports (`doorIllusionEscape`, `behemothRoar`, `fleeRefusal`, `parleyBlockedReason`) are in `engine/combat.js`; `cowering` appears in `engine/derived.js`; `foeRouted` is in `eventNarration.js` and `narrationLines.js`; `Door Illusion` and `Phantom Host` are in `scroll-pool.test.js`; `### Phase 90 plan 09` is once in FIXTURE-INVENTORY; `Size of the Behemoth` is in `docs/SPELLS.md`; `git diff` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them).

## Commits

- `57c8d9b9` feat(90-09): Door Illusion, Chameleon Tongue and Size of the Behemoth, and the Illusionist's three illusions (Task 1)
- `8d021233` feat(90-09): pin the scroll roll table per depth band, narrate the three Illusion spells, chips and menu reasons (Task 2)
- `00645373` test(90-09): measure, declare and regenerate only what the last three slate spells and the Illusionist's book moved (Task 3)

## Self-Check: PASSED

Created files exist (`test/unit/escape-talk-rout-spells.test.js`, `test/unit/scroll-pool.test.js`, `test/unit/illusionist-book.test.js`, `docs/narrative-pass/why/90-09.json`, this summary) and commits `57c8d9b9`, `8d021233` and `00645373` are on the worktree branch; the full suite is fail 0.
