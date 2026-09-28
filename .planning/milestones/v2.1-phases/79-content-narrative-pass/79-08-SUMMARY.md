---
phase: 79-content-narrative-pass
plan: 08
status: complete
subsystem: narration (Oracle and rail, powers domain)
tags: [VOX-05, ROLL-04, powers, spells, scroll-fumbles, foe-abilities, narration]
requires:
  - 79-01 (voice corpus, checks, CLI, base snapshot)
  - 79-04 (the fight domain's lines and the possessive helpers reused here)
provides:
  - "the powers-domain Oracle and rail lines that failed the rubric, rewritten fact-first"
  - "Strength's HP boost stated on the cast line (additive `gained`/`maxWP` on strengthCast)"
  - "docs/narrative-pass/why/79-08.json (56 rows)"
affects: [79-12, 79-13]
tech-stack:
  added: []
  patterns:
    - "a d6-table spell (Insanity, Noxious Vapor) names what its face did; faces with their own follow-up event add nothing"
    - "a helpful fumble on a foe says what it did, per effect, from the event's own numbers"
key-files:
  created:
    - docs/narrative-pass/why/79-08.json
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - engine/magic.js (strengthCast gains additive gained/maxWP)
    - engine/scrollFumble.js (might-effect fumbleOnFoe gains additive gained)
    - test/unit/spell-mechanics.test.js
    - test/unit/foe-abilities.test.js
    - test/unit/clarity-cause-lines.test.js
    - test/unit/fixtures/event-order/default-fold-corpus.json (declared regeneration)
    - test/parity/FIXTURE-INVENTORY.md (### Plan 79-08, a measured zero)
    - docs/CLARITY.md
decisions:
  - "foeDrained's `stolen` is the FOE's gain after its own cap, not the hp you lost (foeBolted states that), and a drain may land on a Joiner; both lines now state the foe's gain"
  - "Weaken and Mirror Self reuse the grimoire's roll-high wording (79-05): 'no more than its die's top three faces hit', 'only on their die's top face'"
  - "Stun is narrated as sleep ('drop asleep for d4 rounds'), which is what the engine does, not 'freeze in place'"
  - "Strength states '+N damage on every blow until you make camp' (movement.js#newDay clears might and the boost), and the HP from the new `gained` field"
  - "Durations with a die (Stun's d4, Vapor's d6+2) are written in dice notation, like Ice's existing 'd6 a round'"
metrics:
  completed: 2026-09-27
  tasks: 2
  commits: 2
---

# Phase 79 Plan 08: The Powers Domain's Narration Summary

Every spell, ability, foe-ability and scroll-fumble line that failed the rubric now says who did what to whom, and the result, before any joke. Strength's HP boost is stated on its cast line, and the foe-side ward and bubble lines read "Its" on a nameless event. Lines that passed are byte-identical.

**Plan base:** `089699296fb43f4fb8349f0364081c423308e91d`

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Judge the powers domain and rewrite what fails (and the two extra-scope fixes, with their pins) | fc77ddac |
| 2 | Re-pin and record: the ledger, the fold corpus, the inventory declaration | ad75d163 |

## Check counts (`--owner 79-08`)

| Check | Base | After |
|---|---|---|
| `--roll-under` | 0 | 0 |
| `--hygiene` | 0 | 0 |
| `--twins` | 0 | 0 |
| `--safety` | 0 | 0 |
| all four, `--count` | 0 | **0** |

The worklist held no roll-under or hygiene hits at the base: the ROLL-04 phrases the scan could have assigned here (Battle Roar, Smoke, Mirror Self, Weaken) were owned by 79-04 (fight builders) and 79-05 (content text). The bare-event "It's" leaks are not a hygiene rule, so they were judged by hand.

`--check-ledgers --plan 79-08 --after --coverage`: 0 errors. The 56 ledger keys equal the 56 keys `--diff --owner 79-08` reports changed. `node --test test/unit/voice-corpus.test.js`: 27/27.

## Pass/fail table

Rubric points: 1 fact, 2 natural, 3 joke after the fact, 4 accurate. "Bare" means the `{ type }`-only rendering.

**Failed, rewritten** (Oracle and rail twin unless noted):

| Key | Failed | Note |
|---|---|---|
| weakened | 1; 2 | never said who or what; "1 rounds"; rail "(3)" |
| stunned | 1, 4, 2 | a bare count; "freeze" for what is sleep; "1 freeze", "0 freeze in place" |
| shrunk | 1, 2 | a bare count; the half hp and half damage never stated |
| blinded | 1; 2 | never said what blindness does, or "for the fight"; "1 rounds" |
| stupefied | 1 | never said it lasts the fight |
| mirrorSelf | 1; 2 | the effect never stated; "1 rounds"; rail "(3)" |
| sensesGained | 1 | the effect and its length never stated |
| wardRaised (Shield branch) | 1; bare | "N points" of what; bare "The ward raises a ward" |
| strengthCast | 1, number | "+3" of what; the HP boost was silent (extra scope) |
| earthquake | 1, 4 | a unitless number; "everyone" is every foe |
| vaporRolled | 1 | the d6 face printed with no meaning |
| insaneRolled | 1 | the d6 face printed with no meaning; faces 1, 4 and 5 had no line at all |
| insaneNoTarget | 2 | "turn insane at" |
| planeGated (Oracle) | 1, 2 | a bare count; "1 are" |
| spellHit | 1, 4 | no "who" on the Oracle; "6 hp (×2)" read as 12 |
| acidApplied, dozed, iceApplied | 2; rail 1 | "1 rounds"; the rail's bare "(3)" |
| spellSchoolLocked | 1 (refusal "why") | now names the level the school opens at, like spellAboveLevel |
| castRefused (exploreOnly) | 1, 3 | the joke was the whole reason |
| abilityRefused (cooldown, notLowEnough) | 1 | "3 rounds" of what; Last Stand never named its quarter-hp line |
| deathSpellTooWeak | 4 | refused at 26 hp, where paying leaves 1 hp: "would not survive" was not true |
| foeDebuffed (Oracle) | 1, 3 | the joke came first and the foe was never named |
| foeDrained | 4 | printed the foe's gain as "hp of yours"; the rail as a second copy of your loss; wrong on a Joiner |
| fumbleOnFoe | 1; bare | "helps it instead" never said how; no-foe case read "the wrong side" |
| foeWardSoaked, foeWardBroken, foeBubbleCaught | bare hygiene; 1 | "It's ward/bubble" (extra scope, from 79-04); "2 wasted" is damage |
| rail:foeArmorSoaked | bare hygiene | "It's armour" |
| rail:heroResisted | bare hygiene | "its's spell" |

**Passed, untouched** (byte-identical): abilityUsed, allyPending, allySummoned, backfireSelfDamage, deathCast, earthquakeSelfDamage, floorMapped, foeCast, foeHealed, heroResistFailed, insaneFled, insaneStruckAlly, noChargesLeft, nothingToThrowAt, nothingToTurn, gateRefused, petrified, regenerationCast, resistFailed, scrollCast, scrollCopiedToGrimoire, scrollDeciphered, scrollFumbled, scrollGarbled, scrollRead, scrollRefused, scrollTooAdvanced, senseDanger, spellAboveLevel, spellBackfired, spellMissed, spellNotKnown, spellResisted, spellThrown, summonBackfired, swept, volley, walkingDeadTurned, fumbleOnReader, fumbleOnSide; oracle:foeArmorSoaked, oracle:heroResisted, rail:planeGated, rail:foeDebuffed; the Bubble branch of wardRaised; the other abilityRefused and castRefused reasons; and the raw `engine/magic.js#ALLY_NAMES` and `#LESSER_ALLY_NAMES` literals.

Synthetic-event artifacts, not rewritten: "Heal heals Viper instead" (the synthetic `spell` is always Heal or Summon), "a Apprentice's doubled creatures" (summonBackfired's `sub` is always Summoner in the engine), "7,15 shots" (volley's synthetic `rolls`), "you have 10 of 5" (Last Stand's synthetic have/max), and "0 rounds" on bare events.

## Changed lines (before → after, representative real events)

Oracle:
- Weaken: `They hit softer now, for 3 rounds.` → `Every foe is weakened for 3 rounds: no more than its die's top three faces hit, and it does half damage. They hit softer now.`
- Stun: `2 freeze in place.` → `2 foes drop asleep for d4 rounds each.` (none: `The stun puts nobody to sleep.`)
- Shrink: `2 shrink to half size.` → `2 foes shrink to half size: half their hp and half their damage, for the fight.`
- Blind: `Viper cannot see a thing for 3 rounds.` → `Viper cannot see a thing for 3 rounds: it hits only on its die's top face.` (no timer: `for the rest of the fight`)
- Stupidity: `Viper forgets what it is doing.` → `Viper forgets what it is doing, for the rest of the fight.`
- Mirror Self: `A mirror image holds for 3 rounds.` → `A mirror image holds for 3 rounds: foes hit you only on their die's top face (the top two if you insulted them).`
- Sense Presence: `Your senses sharpen.` → `Your senses sharpen: nothing gets the jump on you, and the dark costs you nothing, until your next fight ends.`
- Shield: `Shield raises a ward: 50 points.` → `Shield raises a ward: it soaks the next 50 hp of damage.`
- Strength: `Might surges: +7.` → `Might surges: +7 damage on every blow until you make camp, and +40 hp (max 80).` (recast: `… until you make camp. Your hp was already doubled for the day.`)
- Earthquake: `The floor heaves. 8 to everyone in the room.` → `The floor heaves. 8 damage to every foe in the room.`
- Noxious Vapor: `Noxious vapor: 5.` → `Noxious vapor: 5. Every foe falls asleep for d6+2 rounds.` (a 4: `Noxious vapor: 4, the bad one. Every foe that breathes it drops, unless its own d10 shows a 1; then it only sleeps.`)
- Insanity: `Insanity takes Viper: 5.` → `Insanity takes Viper: 5, and it flies into a frenzy: twice the swings from here on.` (1: `, and it simply keels over`; 4: `, and it tries to lie down for a nap, d4 rounds`; 2/3/6 unchanged, their own lines follow)
- `There is no one here to turn insane at.` → `There is no one here to drive insane.`
- Plane Gate: `1 are gated straight back out.` → `1 foe is gated straight back out to the Planes.`
- Spell hit: `Hit. 6 hp (×2).` → `Hit. Viper takes 6 hp (the roll ×2, for your level).`
- Acid / Doze / Ice: `1 rounds` → `1 round`.
- School gate: `Heal is not open to you yet.` → `Heal's school opens to you at level 3; you are 1.`
- Explore-only: `Map the Floor needs quieter surroundings.` → `Map the Floor only works out of a fight. It needs quieter surroundings.`
- Cooldown: `Pommel Strike: 3 rounds. Your arm has opinions.` → `Pommel Strike: ready again in 3 rounds. Your arm has opinions.`
- Last Stand: `Last Stand: you are not desperate enough yet (30 of 50 hp).` → `Last Stand: only at a quarter of your hp or less, and you have 30 of 50. You are not desperate enough yet.`
- Death: `Death: the fee is 25 hp, and you would not survive paying it.` → `Death: the fee is 25 hp, and you need at least 27 to pay it. The spell refuses to be what kills you.`
- Foe debuff: `Your arms feel like someone else's. Weakened: your blows do half damage for 2 rounds.` → `Krupke weakens you: your blows do half damage for 2 rounds. Your arms feel like someone else's.` (daze: `Djinni dazes you: −2 to hit for 3 rounds. The room keeps moving after you stop.`)
- Foe drain: `Wraith: it drinks 4 hp of yours and looks better for it.` → `Wraith drinks it in: +4 hp for itself. It looks better for it.`
- Helpful fumble on a foe: `Heal helps Viper instead.` → `Heal heals Viper instead: +2 hp.` (regen, ward, Bubble, might, mirror and senses each say what they did; with no foe left: `… is wasted: there is no foe left for it to help.`)
- Foe ward and bubble: `It's ward gives out.` → `Its ward gives out.`; `Viper's ward drinks 2 of it — 3 left.` → `Viper's ward drinks 2 of your blow — 3 left in it.`; `Viper's bubble swallows your blow whole — 2 wasted.` → `… — 2 damage wasted.`

Rail twins: the same facts in the rail's short form, e.g. `Every foe weakened, 3 rounds: top three faces to hit, half damage.`, `2 foes drop asleep, d4 rounds each.`, `Might surges: +7 damage till camp, +40 hp.`, `Wraith drinks it in (+4 hp).` (was `Wraith drains you (−4 hp).`), `Heal hits Viper (6, the roll ×2 for your level)`, `Viper dozes off, 3 rounds.` (was `(3)`), `Its armour shrugs it off.`, `You resist its spell.` (was `its's spell`).

The full record, one row per changed key, is `docs/narrative-pass/why/79-08.json` (56 rows).

## Extra scope (orchestrator)

- **Nameless foe ward/bubble lines (from 79-04).** `oracle:`/`rail:` foeWardSoaked, foeWardBroken and foeBubbleCaught now use 79-04's module-private `possessive` / `railPossessive` helpers (no new helpers). rail:foeArmorSoaked and rail:heroResisted had the same leak and use them too. Pinned in `test/unit/foe-abilities.test.js` ("narration (79-08): foeWardSoaked, foeWardBroken and foeBubbleCaught read 'Its' …").
- **Strength's HP boost.** `engine/magic.js`'s `strengthCast` event gains additive `gained` (the HP the cast added: the old max on the day's first cast, 0 on a recast) and `maxWP`. The foe-side might fumble (`fumbleOnFoe`, effect "might") gains `gained` the same way. Both lines state the number. Pinned in `test/unit/spell-mechanics.test.js` ("Strength: the cast line states the damage and the HP the cast added"), which drives the engine and checks the event and both lines, including the recast.

## Re-pinned and new tests

- `test/unit/clarity-cause-lines.test.js` (not in the plan's list; no sibling owns it): the Oracle and rail `deathSpellTooWeak` and `foeDrained` cases, each with a "VOX-05 (79-08)" comment.
- `test/unit/spell-mechanics.test.js`: the new Strength test. The existing `/softer now\./` match still passes.
- `test/unit/foe-abilities.test.js`: two new tests (the debuff/drain order and the nameless possessives).
- None of the other plan-listed test files pinned a changed wording.

**Fold corpus (declared regeneration).** `test/unit/fixtures/event-order/default-fold-corpus.json`, regenerated with `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`. The diff is four `text` lines, one recorded `dozed` and one recorded zero-count `stunned`, each in two copies: "Orc dozes off (2)." → "Orc dozes off, 2 rounds." and "0 freeze in place." → "The stun puts nobody to sleep." No event, order, fold or priority moved. Declared under `## Phase 79` / `### Plan 79-08` in `test/parity/FIXTURE-INVENTORY.md` (appended at the end of the file).

## Gates

- The four guards pass unedited: `formatEventsCoverage`, `narrationLinesCoverage`, `roll-sign-consistency` and `honest-gains` (59/59).
- `node --test "test/parity/**/*.test.js"`: 66/66. `node --test test/parity/fixture-inventory.test.js`: 5/5.
- `git diff --quiet 08969929 -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness content` exits 0. The prototype hash is `a1f4d0dc…` (unchanged).
- `npm test`: **7,409/7,409 pass** (the base's 7,406 plus the three new tests), run with the regenerated corpus in the tree.
- No bot runs (user ruling). The floorRegen lines were not touched (79-02c removes them).
- `boot:check` was not run: this plan changes no shell file, and the worktree has no `www/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] foeDrained printed the foe's gain as your loss**
- **Found during:** Task 1.
- **Issue:** `stolen` is the foe's own heal after its cap (engine/foeAbilities.js). The Oracle called it "hp of yours", and the rail printed it as "(−4 hp)", a second copy of the loss foeBolted already states. On a drain that hit a Joiner, neither was the hero's.
- **Fix:** both lines now state the foe's gain. `test/unit/clarity-cause-lines.test.js` re-pinned.
- **Commit:** fc77ddac.

**2. [Rule 2 - Missing] the engine events needed the Strength number**
- **Issue:** the orchestrator's extra scope asks the Strength line to state the HP it adds, and the event did not carry it. The plan's truth says engine/ stays byte-identical, and the orchestrator allows the additive field.
- **Fix:** additive `gained`/`maxWP` on `strengthCast` and `gained` on the might fumble. Events only, zero draws. Declared as a measured zero in FIXTURE-INVENTORY.md.
- **Commit:** fc77ddac.

### Not in the plan's file list

`engine/magic.js`, `engine/scrollFumble.js` (the extra scope), `test/unit/clarity-cause-lines.test.js` (a pin on two changed lines), the fold corpus and `test/parity/FIXTURE-INVENTORY.md` (declarations the orchestrator asked for), and `docs/CLARITY.md` (its table quotes the two changed CLARITY lines, and now reads them).

## Handed on

- **79-13 (voice sample):** `tools/voice-sample-output.txt` still quotes the old powers lines ("freeze in place", "They hit softer now", "it drinks 0 hp of yours", "is not open to you yet"). No test reads it; regenerate it with the final sample.
- **79-12 (closure):** `docs/UAT-v1.5.md`, `docs/UAT-v1.7.md`, `docs/USABLE-FEATURES-AUDIT.md` and `docs/ABILITIES.md` quote some old lines as history. They are records, not live copy, so they were left alone.

## Known Stubs

None.

## Threat Flags

None. This is presentation copy plus two additive event fields; no new surface.

## Self-Check: PASSED

- Files exist: docs/narrative-pass/why/79-08.json (56 rows), src/browser/eventNarration.js, src/browser/narrationLines.js and this SUMMARY.
- Commits fc77ddac and ad75d163 are on the branch (base 08969929).
- `--owner 79-08 --roll-under --hygiene --twins --safety --count` prints 0. `--check-ledgers --plan 79-08 --after --coverage` reports 0 errors.
