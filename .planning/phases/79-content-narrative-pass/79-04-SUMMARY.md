---
phase: 79-content-narrative-pass
plan: 04
status: complete
subsystem: narration (Oracle and rail, fight domain)
tags: [VOX-05, ROLL-04, fight, narration, joiner]
requires:
  - 79-01 (voice corpus, checks, CLI, base snapshot)
  - 79-02 (honest gain lines; its tests unchanged here)
provides:
  - "the fight-domain Oracle and rail lines that failed the rubric, rewritten fact-first"
  - "Smoke, Battle Roar and Sidestep in faces (ROLL-04)"
  - "docs/narrative-pass/why/79-04.json (49 rows)"
affects: [79-08, 79-12, 79-13]
tech-stack:
  added: []
  patterns:
    - "module-private possessive(name, fallback) / railPossessive: a bare event reads 'its'/'the', never \"it's\"/\"that's\""
    - "a Joiner's own ability line reads 'them' where the hero's reads 'you'"
key-files:
  created:
    - docs/narrative-pass/why/79-04.json
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - engine/combat.js (one never-read literal: SONGS level-5 txt)
    - test/unit/fixtures/event-order/default-fold-corpus.json (declared regeneration)
    - test/parity/FIXTURE-INVENTORY.md (### Plan 79-04, a measured zero)
decisions:
  - "A foe's strike die scales with its level (derived.js#foeDie), so Smoke, Battle Roar and Sidestep speak in faces ('only on its die's top face', 'two fewer faces'), per the ROLL-04 phrasing rule"
  - "Lullaby and Cry of Thunder say 'up to N': the d6/d12 is how many foes the song can reach, not how many slept"
  - "fumbleHeavyBlow no longer prints the fumble table's `how` key ('Instead: death' read as the opposite of what happened)"
  - "The SONGS 'wp' literal is fixed in engine/combat.js (README ownership: 79-04 owns engine/combat.js literals); it is never read, so nothing moves"
metrics:
  completed: 2026-09-27
  tasks: 2
  commits: 3
---

# Phase 79 Plan 04: The Fight Domain's Narration Summary

Every fight line that failed the rubric now says who did what to whom, and the result, before it jokes. Smoke, Battle Roar and Sidestep speak in faces instead of roll-under. A Joiner's own ability lines stop claiming the hero's body, purse or armour. Lines that passed are byte-identical.

**Plan base:** `d39625ee07887d049a216e1801e467f923aabe41`

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Judge the fight domain and rewrite what fails | 2a70e144 |
| 2 | Re-pin, regenerate the fold corpus, write the ledger | 25d04e1f |

## Check counts (`--owner 79-04`)

| Check | Base | After |
|---|---|---|
| `--roll-under` | 12 (Smoke 12) + 2 (Battle Roar) | 0 |
| `--hygiene` | 1 (SONGS "wp") | 0 |
| `--twins` | 0 | 0 |
| `--safety` | 0 | 0 |
| all four, `--count` | 15 | **0** |

`--check-ledgers --plan 79-04 --after` (and with `--coverage`): 0 errors. `node --test test/unit/voice-corpus.test.js` passes.

## Pass/fail table

Rubric points: 1 fact, 2 natural, 3 joke after the fact, 4 accurate. "Bare" means the `{ type }`-only rendering (the VOX-05 empty rule).

**Failed, rewritten** (Oracle and rail twin unless noted):

| Key | Failed | Note |
|---|---|---|
| battleRoarRaised | ROLL-04; 3 (Oracle); 1 (rail) | "need two better" → "two fewer faces"; rail never said the effect |
| smokeThrown | ROLL-04; 4 | "a natural 1 … a 1–2" → the die's top face (top two if insulted); the hero's own Smoke names its free flee; a Joiner's covers only the Joiner |
| sidestepped | 1; 4 (Joiner) | effect never stated; a Joiner's covered "you" |
| braced | 1 | half damage never stated |
| braceHeld | 4; bare hygiene | the saving printed as a signed cost "(−3)"; bare "it's blow" |
| riposteReady | 1, 3 | the joke was the whole line |
| pommelStruck | 1; bare hygiene | the lost turn never stated; bare "it's temple" |
| marked | 1 | "+2" of what (it is damage) |
| taunted (Joiner branch) | 4 | a Joiner's Taunt claimed "you" and the hero's armour doubling |
| cutpursed (Joiner branch) | 1, 4 | a Joiner's cutpurse read "You lift" |
| beastsSoothed | 1 | a bare number, no "who" |
| lullabyRolled | 4 | the d6 is a ceiling, not a count of sleepers |
| thunderRolled | 4; rail 2 | same; rail "(2)" now says rounds |
| fumbleHeavyBlow | 3, 4 | "Instead: death/stone" printed the flavor key as the outcome |
| controlHeld | 2 | "1 rounds" |
| damageHalved | bare hygiene | "that's blow" |
| foeBubbleRebound, foeMirrorFaded, foeWardFaded | bare hygiene | "It's …" |
| backstabDenied | 1 | said why, not what it cost |
| oracle:poisonedEdgeApplied | 1, 3 | the image stood in for "poisoned" |
| oracle:dirtyTrickLanded | 3; bare hygiene | joke before the fact; bare lower-case "it" |
| oracle:phobiaAfraid | 4, 2 | "Harder to hit" read as a benefit |
| oracle:frenzy | 1 | the second swing never stated (the rail already said it) |
| oracle:spGained | hygiene | "worth 8 8 experience points" |
| oracle:struck (ninja branch) | 1, 2 | "A Ninja's two" |
| oracle:allySpellHit | bare hygiene | "Your ally's The spell" |
| oracle:encounterStarted | bare hygiene | "An encounter. something." |
| raw:engine/combat.js#SONGS | naming, 4 | "equals reduced to 1 wp" |

**Passed, untouched** (byte-identical): acidTick, allyCast, allyDeparted, allyJoined, allyMissed, allySpellMissed, allyStruck, armorDestroyed, armorSoaked, backstab, combatEnded, combatInDark, combatJoined, conArtistOpener, controlResisted, deathTouch, dotTick, encounterCleared, fearPassed, fled, fleeFailed, fleeRolled, foeBolted, foeBored, foeEffectFaded, foeFled, foeHoldBroken, foeKilled, foeMissed, foeOutOfSpells, foePursued, foeRegenerated, foeRevived, foeShattered, foeSightReturned, foeSlept, foeStillHeld, foeStunned, foeStupefied, foeSummoned, frozenSolid, goldGained, hamstrung, heroCameTo, heroLostTurn, lastStandCalled, memberAbilityUsed, memberDowned, memberRiposted, memberSecondWind (79-02's line), memberStruck, memberSwept, mirrorFaded, ninjaFirstStrike, parleyExhausted, parleyFailed, parleyInsulted, parleyRolled, regenFaded, riposted, sang, selfDotTick, sensesFaded, songIgnored, stealthStrike, strikeMissed, struckByFoe, sweptFoe, trackable, wardAbsorbed, wardFaded, wardReflected, wardShattered, warlockBoost, weakenFaded; the refusals actionRefused, fleeRefused, parleyRefused, strikeRefused, vanishDenied, withdrawalDenied; the rail twins of every Oracle-only fix above (rail:poisonedEdgeApplied, rail:dirtyTrickLanded, rail:phobiaAfraid, rail:frenzy, rail:struck, rail:allySpellHit, rail:encounterStarted); the other SONGS literals; and all nine ROUND_STRIP_COPY strings in fightLog.js (fightLog.js is unchanged).

Synthetic-event artifacts, not rewritten: "Viper swings at Viper" (the base event's `name` and `target` are both Viper), "the companion: …" prefixes on hero-only lines, and foeShattered's "poisonedEdge's best roll" (`by` is only ever "you" or a Joiner's name in the engine).

## Changed lines (before → after, representative real events)

Oracle:
- Battle Roar: `Loud enough. For two rounds they all need two better to hit anyone on your side.` → `For two rounds every foe has two fewer faces to hit anyone on your side. Loud enough.`
- Smoke (hero): `Gone. For two rounds they need a natural 1 to find you — a 1–2 if you insulted them.` → `For two rounds a foe finds you only on its die's top face (the top two if you insulted them), and a run just works. Gone, as far as anyone can tell.`
- Smoke (Joiner): `Ada: For two rounds a foe finds them only on its die's top face (the top two if you insulted them). Gone, as far as anyone can tell.`
- Sidestep: `Not where the blade is. Two rounds of that.` → `For two rounds every foe has two fewer faces to hit you. Not where the blade is.` (a Joiner's: "them")
- Brace: `Braced. The next one lands on your terms.` → `Braced. The next blow that lands on you does half damage.`
- Brace held: `Braced — Viper's blow lands half as hard (−3).` → `Braced — Viper's blow lands half as hard, 3 hp lighter.`
- Riposte: `Every miss is an invitation.` → `For one round every foe that misses you takes your weapon's damage. Every miss is an invitation.`
- Pommel: `The pommel finds Viper's temple. It will need a moment.` → `The pommel finds Viper's temple. Viper loses its next turn, and will need a moment.`
- Mark: `Studied. Every blow on Viper lands +2.` → `Studied. Every blow on Viper does +2 damage from here on.`
- Taunt (Joiner): `Ada: Every foe looks at you. Armour doubles. Good luck.` → `Ada: Every foe swings at them this round. Good luck to them.`
- Cutpurse (Joiner): `Ada: You lift 8 wilmst off Viper mid-fight. …` → `Ada lifts 8 wilmst off Viper mid-fight, into your purse. It has other problems.`
- Poisoned Edge: `The blade weeps into Viper. 3 rounds of that.` → `Viper is poisoned for 3 rounds. The blade weeps into it.`
- Dirty Trick: `Sand, thumb, elbow. Viper is blinded for 2 rounds.` → `Viper is blinded for 2 rounds. Sand, thumb, elbow.`
- Soothe: `2 calm right down.` → `2 beasts calm right down and wander off.`
- Lullaby: `2 nod off.` → `The lullaby reaches up to 2 of them. Any not above your level nod off.`
- Thunder: `Thunder rolls; 5 freeze for 3 rounds.` → `Thunder rolls: up to 5 of them freeze for 3 rounds. Any above your level shrug it off.`
- Heavy-blow fumble: `Petrify tried to be the end of you. Instead: stone, −12 hp. You are shaken.` → `Petrify backfires as a heavy blow: −12 hp. It meant to be the end of you; you are merely shaken.`
- Afraid: `… Harder to hit and softer blows for 2 rounds. …` → `… For 2 rounds your swings land less often and hit softer. …`
- Frenzy: `Something in your blood takes over. Frenzy.` → `Frenzy: something in your blood takes over, and you get a second wild swing.`
- Heavy armour: `Heavy armor gives you away.` → `Heavy armor gives you away: no sneak attack.`
- Ninja crit: `A Ninja's two. Critical!` → `A Ninja's top two faces. Critical!`
- Experience: `Talking your way out is worth 8 8 experience points.` → `… worth 8 experience points.`
- Bare events: `It's ward/mirror/bubble` → `Its …`; `that's blow` → `the blow`; `it's temple` → `its temple`; `Your ally's The spell` → `Your ally's spell`; `An encounter. something.` → `An encounter. Something.`; `1 rounds` → `1 round`.

Rail twins:
- `Loud enough. Two rounds of it.` → `Foes have two fewer faces to hit your side, for two rounds.`
- `Gone. They need a natural 1 to find you (a 1–2 if you insulted them).` → `Gone. Foes find you only on their die's top face (top two if insulted) for two rounds, and a run just works.`
- `Not where the blade is. Two rounds of that.` → `Foes have two fewer faces to hit you, for two rounds.`
- `Every miss is an invitation.` → `For one round every foe that misses you takes your weapon's damage.`
- `The pommel finds Viper's temple.` → `The pommel finds Viper's temple: it loses its next turn.`
- `Every blow on Viper lands +2.` → `Every blow on Viper does +2 damage.`
- `2 stand down.` → `2 beasts stand down and leave.`; `2 nod off.` → `Lullaby: up to 2 nod off.`; `Thunder rolls — 5 freeze (3).` → `Thunder rolls — up to 5 freeze, 3 rounds.`
- `Petrify: stone instead (−12 hp). Shaken.` → `Petrify backfires: a heavy blow (−12 hp). Shaken.`
- `Heavy armour gave you away.` → `Heavy armour gave you away: no sneak attack.`
- The Joiner branches of Taunt and Cutpurse, Brace/Brace held, and the bare-event possessives and plurals, as on the Oracle.

Engine literal: `engine/combat.js#SONGS` level 5 `txt`: `equals reduced to 1 wp` → `foes your level or lower drop to 1 hp`.

The full record, one row per changed key, is `docs/narrative-pass/why/79-04.json` (49 rows).

## Re-pinned tests

None of the fifteen test files in the plan's list pinned a changed wording: after Task 1, the full suite had exactly one failure, the fold-corpus comparison below. No test file was edited.

**Fold corpus (declared regeneration).** `test/unit/fixtures/event-order/default-fold-corpus.json`, regenerated with `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`. The diff is two lines: one recorded `riposteReady` line, in its `lines` and `linesIdx` copies, now reads `For one round every foe that misses you takes your weapon's damage.` No order, fold, priority or other line moved. Declared under `## Phase 79` / `### Plan 79-04` in `test/parity/FIXTURE-INVENTORY.md`.

## Gates

- The four guards run unedited: `formatEventsCoverage`, `narrationLinesCoverage`, `roll-sign-consistency` and `honest-gains` (59/59).
- `node --test test/voice/*.test.js`: 8/8, the safety scan.
- `node --test "test/parity/**/*.test.js"`: 66/66.
- `git diff --quiet d39625ee -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` exits 0. The prototype hash is `a1f4d0dc…` (unchanged).
- `npm test`: **7,346/7,346 pass** after Task 2. After Task 1 alone it was 7,345/7,346, the one failure being the fold corpus.
- No bot runs (user ruling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] engine/combat.js's SONGS literal**
- **Found during:** Task 1.
- **Issue:** The worklist's one hygiene hit (`standalone-wp`) is an engine literal, `raw:engine/combat.js#SONGS`. The plan's truth says engine/ stays byte-identical, while its acceptance requires `--hygiene --count` 0, and the method README gives 79-04 ownership of engine/combat.js literals.
- **Fix:** Changed the one never-read `txt` string. `sing()` reads only `n` and `lvl`, so no rule, draw, event or state moves. It was measured and declared as a zero under `### Plan 79-04` in `test/parity/FIXTURE-INVENTORY.md`. So `git diff d39625ee -- engine` shows that one line.
- **Commit:** 2a70e144.

**2. [Rule 1 - Bug] spGained printed its count twice**
- **Issue:** The count sat in a roll span and in `plural()`, so the Oracle read "worth 8 8 experience points". The duplicate existed so that the overlay's roll-stripped copy kept a number.
- **Fix:** The count now prints once, outside the roll span, and both copies read the same.

### Not in the plan's file list

`test/parity/FIXTURE-INVENTORY.md` (the declaration the orchestrator asked for) and `engine/combat.js` (above).

## Handed on

- **79-05 (content rules text):** the ability catalog's own `txt` still carries the roll-under phrases this plan removed from the narration:
  - `content:ABILITIES.smoke.txt`: "foes need a natural 1 to find you (a 1–2 if you insulted them)"
  - `battleRoar.txt`: "every foe needs two better to hit anyone on your side"
  - `sidestep.txt`: "every foe needs two better"
  - The faces wording used here fits them: "only on its die's top face", "two fewer faces".
- **79-08 (powers domain):** the same bare-event "It's" possessive in `oracle:foeWardSoaked`, `oracle:foeWardBroken` and `oracle:foeBubbleCaught` and their rail twins, which engine/foeDamage.js emits. The module-private `possessive` and `railPossessive` helpers this plan added fit them.
- **79-12 (closure):** the Oracle mixes "armor" and "armour", sometimes inside one line (armorSoaked: "Your armor takes … It costs the armour 2."). This is not a rubric failure, so it was left unchanged. It is a house-spelling decision.

## Known Stubs

None.

## Threat Flags

None. This is presentation copy only, with no new surface.

## Self-Check: PASSED

- Files exist: docs/narrative-pass/why/79-04.json (49 rows), src/browser/eventNarration.js, src/browser/narrationLines.js and this SUMMARY.
- Commits 2a70e144 and 25d04e1f are on the branch (base d39625ee).
- `--owner 79-04 --roll-under --hygiene --twins --safety --count` prints 0. `--check-ledgers --plan 79-04 --after` reports 0 errors.
