---
phase: 90-spell-skill-audit
plan: 05
subsystem: spells
tags: [doze, stun, ice, wake-on-hit, hold, area-freeze, joiner, narration, bot, ledgers, spell-11, spell-12]
requires:
  - phase: 90-01
    provides: the spell audit rows and the Q3 A, Q4 A and Q5 A rulings
  - phase: 90-03
    provides: strengthRoll (Strength's d10 on every damage roll), which Ice's per-foe damage reads
  - phase: 90-04
    provides: the one depth-rising resist (foeResistsSpell = foeResistsEffect) every reached foe rolls, and the Ice text row hand-off
provides:
  - "combat.js#dozeFoes, #stunFoe and #iceStorm: the shared Doze, Stun and Ice tails for the hero's cast, a scroll's free cast and a Joiner's allyCast, the Joiner's name on every line"
  - "Doze sleeps exactly d4 foes (the target first), each its own d4, marked dozing; foeDamage.js#damageFoe wakes a dozing foe the first time it takes damage (foeWoke); only Doze's sleep wakes (Q3 A)"
  - "Stun holds ONE foe (the aimed one) for a d4 through holdFoe kind stunned; a hit never ends it; holdFoe takes explicit rounds and never shortens a longer hold"
  - "Ice is kind blast (aoe all, onHit freeze, d10): no to-hit roll, d10 + level² to every foe in C.foes order, each survivor frozen d4 rounds unless it resists (the resist stops only the freeze); the dot kind, iceApplied, foeTurn's ice payoff and frozenSolid are gone"
  - "test/unit/doze-stun-ice.test.js (38 pins) and docs/narrative-pass/why/90-05.json (24 rows)"
affects: [90-06, 90-07, 90-08, 90-10, 90-11, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "one shared tail per effect in combat.js (the freezeFoe precedent), so the hero, a scroll and a Joiner are one rule"
    - "a combat-scoped mark (foe.dozing) read by the damage seam, so 'a hit wakes it' is one place, whoever deals the hit"
key-files:
  created:
    - test/unit/doze-stun-ice.test.js
    - docs/narrative-pass/why/90-05.json
  modified:
    - content/spells.js
    - content/scroll-fumbles.js
    - engine/combat.js
    - engine/magic.js
    - engine/foeDamage.js
    - engine/derived.js
    - engine/scrollFumble.js
    - src/browser/foeConditions.js
    - src/browser/foeDetails.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/rail.js
    - tools/lib/tuning-bot.mjs
    - test/parity/harness/comparables.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/ROLL-LEDGER.md
    - docs/SPELLS.md
    - docs/SPELL-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/narrative-pass/why/q-260928-z-sq2.json
key-decisions:
  - "Built exactly the ruled branches: Q3 A (only Doze's sleep carries the dozing mark), Q4 A (a single d4 reach, no level multiplier), Q5 A (Ice a blast kind with no to-hit; iceStorm is therefore exported)"
  - "A longer live hold stands when a new hold is shorter or equal; the new cast's controlHeld line is still pushed and names the hold in force (kind and rounds of the longer)"
  - "Doze's mark is its own foe-card chip key (Dozing) rather than a label switch on Asleep, because the chip tables tie every description to one key; Stun's hold reuses the Held chip labelled Stunned"
  - "The Ice foe chip and its label and description were removed (nothing writes an Ice dot any more); a stray old-save ice dot is a plain tick that just ends"
  - "The event-order corpus was NOT regenerated through its switch (it re-runs the whole real engine for every worst-case and walk case and would have re-recorded 80 unrelated cases); the one case that moved was recomputed alone"
patterns-established:
  - "events for a spell with no to-hit roll introduce themselves with a cast line (iceCast) because there is no spellThrown to open the chain"
requirements-completed: [SPELL-11, SPELL-12]
status: complete
duration: ~one long session
completed: 2026-10-01
---

# Phase 90 Plan 05: Doze and Stun swapped, Ice freezes the room (SPELL-11, SPELL-12) Summary

**Doze now sleeps d4 foes (the target first, each its own d4) and any hit wakes a dozing foe; Stun holds one foe for d4 rounds and a hit never ends it; Ice is the area version of Freeze (no to-hit, d10 + level² to every foe, a survivor frozen d4 rounds unless it resists), all three for the hero, a scroll and a Joiner through shared tails in combat.js.**

## What was built

- **Shared tails (`engine/combat.js`).** `dozeFoes(state, sp, rng, events, caster)`: the d4 reach is drawn first on the main rng; the reached foes are the aimed foe then the other live foes in `C.foes` order; per foe the one depth-rising resist, then (on a fail) its own d4 on the main rng, `f.asleep = max(f.asleep, d4)`, `f.dozing = true`, `dozed { target, rounds, by? }`; a cast that sleeps nobody pushes one `dozeFailed`. `stunFoe`: one d4 and `holdFoe` kind `stunned`. `iceStorm`: an `iceCast` line, then per live foe in order `rollDice(d10) + strengthRoll + level² + spellDmg` through `damageFoe` (a `spellHit`, or a Joiner's `allySpellHit`), a kill through `killFoe` (no freeze line), else `freezeFoe` (a d4, the resist, a frozen hold). `holdFoe(state, foe, kind, source, events, opts)` now requires `opts.rounds` (the depth default and its `controlHoldRoundsFor` import are gone) and never shortens a longer live hold.
- **The wake (`engine/foeDamage.js`).** After a hit's damage is applied, a foe with `dozing` loses its sleep and the mark and a `foeWoke` line is pushed unless the hit killed it. A blow a ward or natural armour absorbed returns earlier and wakes nobody. Any damage through the seam wakes it, whoever deals it (blow, spell, acid tick, a Joiner). `foeTurn` clears the mark when the sleep runs out (the asleep skip and the held skip). Q3 A: Noxious Vapor's, Insane's, a staff's and a song's sleeps carry no mark and stay plain (pinned).
- **Wiring.** `castSpell`: `status` calls `dozeFoes` (left `SINGLE_TARGET_KINDS`); `stun` is `"target"` and calls `stunFoe`; the new `blast` kind calls `iceStorm`; the `dot` branch is gone. `allyCast`: `status`, `stun` and `blast` call the same three tails with the Joiner caster (its old single nap is gone). `foeTurn`: the f.dot ice payoff and the selfDot `then: "heavy"` hand-off are removed (Poisoned Edge's tick and Acid's selfDot stay). `derived.js`: `blast` joins `ATTACK_SPELL_KINDS` and `DAMAGE_SPELL_KINDS`; `dot` leaves the latter.
- **Content.** Doze, Stun and Ice rows reworked (Ice `kind: "blast"`, `aoe: "all"`, `onHit: "freeze"`, d10, niche multi; array position, lvl and school kept). Scroll fumble rows: Doze and Stun stay `out` asleep d4; Ice is `{ side: "area", effect: "damage" }`; no row carries `then` and `resolveHarmful` no longer passes it through.
- **Surfaces.** Foe card: a Dozing chip (a hit wakes it), the Held chip reads Stunned for kind `stunned` (a hit does not end it), the plain Asleep sentence says a hit does not wake it, the Ice chip is gone; `foeDetails.js` floors Dozing like Asleep. Oracle and rail: `dozed` (reach, a Joiner named), `dozeFailed`, `foeWoke`, `iceCast`, Stun's `controlHeld`/`foeStillHeld` word; a failed resist folds behind Stun's hold. `stunned`, `iceApplied` and `frozenSolid` entries (Oracle, rail, fold list, rail family) were removed because the engine no longer emits them (none is a frozen corpus input in `tools/lib/event-variants.mjs`).
- **Bot.** `expectedSpellDamage` scores Ice per live foe like Lightning (the dot branch is gone); `chooseSpell` keeps Ice in the DAMAGE tier (its `onHit` flag no longer catches it as a Freeze hold: `!sp.aoe`), scores Stun as a one-foe hold (allowed against a lone foe, 230/450, skipped while the target is held) and Doze as a multi-foe sleep (two-foe gate, +0 to +4 as the room grows, skipped when everyone sleeps). No bot readout was run.
- **Ledgers and docs.** `docs/narrative-pass/why/90-05.json` (24 rows: 9 new lines, labels and sentences, 6 changed lines and sentences and spell texts, 9 removals; every `after` read from `buildCorpus`); the Ice text row in `q-260928-z-sq2.json` had its `after` and `why` extended per the 90-04 hand-off (a 90-NN row cannot chain after a `q-` row); `node tools/narrative-review.mjs` 639 -> 657 rows, `--check` in sync. `docs/SPELL-AUDIT.md` (Doze, Stun, Ice rows `fixed engine (90-05)`, Noxious Vapor pinned plain), `docs/ROLL-LEDGER.md` (a Phase 90 plan 05 section, notes on C3, C7, C8, C9, X10), `docs/SPELLS.md` (the area-freeze Ice, Doze and Stun), `test/parity/FIXTURE-INVENTORY.md`.

## Fixture drift

Measured against the plan base 0c4cb0e4 (`### Phase 90 plan 05` in `test/parity/FIXTURE-INVENTORY.md`).

- **Predictor.** A run can only move if it casts Doze, Stun or Ice (hero, scroll or Joiner), reads a scroll that rolls one, or is a fair-bot run whose spell choice changes (the bot now scores Stun against a lone foe, Ice as area damage, Doze as a multi-foe sleep). Parity fixtures sit on floors 1 to 3 and cast only Freeze, Heal and a Fireball.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, **zero parity drift**. `test/parity/prototype-master.js.txt` untouched. `roll-high-state-pins.test.js`: **0 of 8 labels moved**, none re-recorded, `roll-high-baseline.mjs save` never run. `roll-high-save-compat` unchanged.
- **`DRAW_INVENTORY` (declared in the file):** `engine/combat.js` amount 20 -> 22 (+3 tagged draws: the Doze reach, the per-sleeper d4, Stun's hold d4; -1 for allyCast's old sleeping d4); `engine/magic.js` amount 17 -> 13 (-4: Stun's d6 reach and per-foe d4, Doze's single d4, the dot branch's d4). `iceStorm` adds no `.d(` (rollDice plus freezeFoe's existing draw).
- **Moved entries, each re-recorded alone:**
  1. `days-farm.test.js` camp-guard pin: seed 293004 (campGuard 139) now plays out with campGuard 0 (the bot casts the reworked spells); a measured scan of the Summoner solo starts in seedList(120) (55434, 277166, 293004, 395951, 530574, 681035) found the first that fires the guard: **seed 530574** (index 67), campGuard 10, campFailed 0. Only the seed and its comment changed.
  2. `test/unit/fixtures/event-order/default-fold-corpus.json`: ONE case, `resist-folds` (the retired `stunned { count }` event became Stun's `controlHeld`; the dozed line gained "A hit wakes it"). The recorded events are inputs, so the whole-corpus switch (`MZ_REGEN_EVENT_ORDER_CORPUS`) would have re-run the real engine and re-recorded 80 unrelated cases; it was not used and the other 181 cases are byte-identical.
  3. `test/unit/fixtures/shell-snapshots/mu.hero.txt`: the Doze Grimoire row (hand-pasted, one line).
- **Main-rng draws that moved.** Doze: a d4 reach before the first resist; a resisted reached foe draws no sleeping d4. Stun: one d4 in all (before a d6 and a d4 per foe that failed). Ice: a damage die and, for a survivor, a freeze d4 per foe (before one d4 for the dot's duration, then a d6 a round). A Joiner's Doze and Stun likewise. No check or threshold was flipped.

### Pins re-pinned (before -> after, each named in its test)

`spell-mechanics.test.js` (the Ice dot cast, resist, payoff and kill-twice pins became the area freeze's; the iceApplied narration pin became iceCast; the Poisoned Edge dot pins kept), `scroll-fumble-table.test.js` and `scroll-fumble-resolve.test.js` (Ice's row is area damage with no `then`; a fumbled Ice hits the reader's side), `reader-fumble-mechanics.test.js` (an old Ice selfDot with `then: "heavy"` just ends: no heavy blow), `spell-depth-resist.test.js`, `control-spells-depth.test.js`, `control-at-depth.test.js` and `control-at-depth-rules.test.js` (Doze C7/C9 reach first, Stun C8 one foe, Ice C3 retired, `holdFoe` requires `rounds`, the `dozeFoes` exemption replaces `foeTurn`'s), `party-combat.test.js` and `spell-resist.test.js` and `spell-resist-copy.test.js` (a Joiner's Doze draws a reach and says `dozed` with `by`; the room-spell fold pin uses Weaken), `spell-damage-level-sq.test.js` (Ice d10 + level² per foe; Stun holds one foe at every level), `authored-ranges.test.js` (Ice's text), `spell-table.test.js`, `spell-level-overrides.test.js`, `summoner-heal.test.js`, `day-one-damage.test.js` (blast in the attack and damage kinds), `strength-spell.test.js` (the one f.dot left is Poisoned Edge's), `foe-conditions.test.js` and `shell-spells-40.test.js` (Dozing and Stunned chips, no Ice chip), `narrationLinesTable.test.js`, `tuning-bot.test.js` (Ice's expected damage, Stun against a lone foe, plus new Ice/Stun/Doze scoring pins), `event-order-fold.test.js` (the one scenario), `shell-tab-snapshots.test.js`, `days-farm.test.js`. `test/unit/guaranteed-attack-spell.test.js` and `test/unit/magic.test.js` needed no change.

## Flagged for the user

1. **SPELL-11 assumption (unclassified probe).** "A hit wakes it" means ANY damage the dozing foe takes through `damageFoe`, whoever deals it (your blow, a spell, an acid tick, a Joiner); a blow a ward or armour fully absorbs wakes nobody. "d4 foes" starts at your current target and then follows `C.foes` order; each sleeper rolls its own d4; Stun's "one foe" is your current target (a dead pick falls to the first live foe).
2. **Stun on a longer hold.** When a Stun (or Freeze or Ice) meets a longer hold still running, the longer hold stands and the new cast's line reports the hold in force (its kind and rounds), so a Stun on a Frozen foe with 4 turns left reads "frozen" with 4. A hold never shortens.
3. **Ice has no up-front resist, and Ice counts as an attack spell.** A Wizard who knows Ice now refuses melee (it is in `ATTACK_SPELL_KINDS`), and a Joiner Magic User may pick it. The Q5 B alternative (Freeze's to-hit per foe) and Q3 B / Q4 B were not built.
4. **Dead branches left in place on purpose:** `allySpellHit`'s `effect: "asleep"` branch (Oracle and rail) is no longer emitted but stays in the builders (removing it would be a ledger removal for a variant line); `dotTick`'s `by === "ice"` wording stays so an old save's leftover ice dot still reads "the ice" for its one last tick.
5. **`tools/voice-sample-output.txt`** (the generated review aid) still lists `stunned`, `iceApplied` and `frozenSolid`; nothing reads it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The event-order corpus switch would have re-recorded 80 unrelated cases.** `MZ_REGEN_EVENT_ORDER_CORPUS=1` re-runs the real engine for every worst-case and walk case, and the engine has moved on since 77-02 (new foe abilities, hero resist events), so regenerating wholesale changed far more than this plan. I reverted it and recomputed only `resist-folds` (events, lines, linesIdx) with a throwaway script; every other case is byte-identical. **Commit:** 39a5d789.

**2. [Rule 1 - Bug] A Joiner's old `by: "you"` resist-event convention rendered "you's Doze".** The corpus renders `dozed` with `by: "you"`; the new builders use a `joinerOf` helper (an absent `by` or "you" is the hero) so the hero's lines never name a possessive "you". **Commit:** 39a5d789.

**3. [Rule 2 - plan wording] The Ice chip and its label/description were removed, not kept.** Nothing writes an Ice dot any more, so `FOE_CONDITION_COPY.ice` and `FOE_CONDITION_DESC.ice` and the `dot` chip's Ice branch went with the spell (two ledger removal rows); the plan only said to drop held kinds nothing produces.

### Plan adjustments (not bugs)

- **TDD order.** A RED commit (`26c4e6b1`, the new test file failing on the missing exports) precedes the implementation.
- **Files outside the plan's list**, all pins or docs the rules moved: `src/browser/foeDetails.js` and `rail.js`, `test/parity/harness/comparables.js` (the `dozing` carve-out), `test/unit/` files listed under Pins above plus `test/unit/fixtures/shell-snapshots/mu.hero.txt`, `docs/SPELL-AUDIT.md`, `docs/narrative-pass/why/q-260928-z-sq2.json`, `test/unit/days-farm.test.js`.
- **Event names chosen by the executor** (the plan left them open): `dozeFailed` (nobody slept), `iceCast` (Ice's cast line, since it has no `spellThrown`), `foeWoke` (as planned). `stunned { count }`, `iceApplied` and `frozenSolid` are no longer emitted; their narration entries were removed (none is a frozen corpus input in `event-variants.mjs`, which is untouched, as is `corpus-base.json`).

## Known Stubs

None.

## Threat Flags

None. A pure engine rule change plus text; no new network, auth or file surface.

## Human verification (deferred to end of run)

1. Cast Doze on a group: several foes show "Dozing"; hit one and it wakes (the Oracle says so) while the others keep sleeping.
2. Cast Stun on one foe: it shows "Stunned" with a count; hitting it does not end the stun; the count runs down on its turns.
3. Cast Ice on a group: every foe takes damage and some show "Frozen" with a count; a foe the damage kills gets no freeze line.

## Commits

- 26c4e6b1: test(90-05): failing tests for Doze d4 foes and wake-on-hit, one-foe Stun, area Ice (RED)
- 113b3de1: feat(90-05): Doze sleeps d4 foes and a hit wakes them, Stun holds one foe, Ice freezes the room (engine, content, fumble rows, pins)
- 39a5d789: feat(90-05): chips, lines and the bot say what Doze, Stun and Ice now do (surfaces, 90-05 ledger, corpus case, bot)
- e8fdeafa: docs(90-05): measure and declare the fixture drift; ledgers and audit rows state the reworked Doze, Stun and Ice

## Results

- `npm test` (final full run, after the last file change except this SUMMARY): **8,848 tests, 8,846 pass, 0 fail, 2 skipped** (base 8,806 / 8,804 / 0 / 2; +42). None of the known worktree CRLF doc-ledger failures appeared in this run. The full suite was re-run after every fix that followed a failure.
- `node --test "test/parity/**/*.test.js"`: 66 / 66. `node tools/narrative-review.mjs` then `--check`: 657 rows, pages in sync. `git diff --stat -- test/parity/prototype-master.js.txt tools/lib/event-variants.mjs docs/narrative-pass/corpus-base.json`: empty.
- Acceptance greps: `export function dozeFoes` 1, `export function stunFoe` 1, `dozing` in `foeDamage.js` 5, no SPELLS row of kind `dot` and Ice carries `aoe: "all"` and `onHit: "freeze"`, `### Phase 90 plan 05` in FIXTURE-INVENTORY 1, `dozeFoes|stunFoe` in ROLL-LEDGER 7.
- `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` untouched (the orchestrator owns those writes).

## Self-Check: PASSED

- Files present: `test/unit/doze-stun-ice.test.js`, `docs/narrative-pass/why/90-05.json`, this file.
- Commits 26c4e6b1, 113b3de1, 39a5d789 and e8fdeafa exist on `worktree-agent-af57ca50a82df88c8`.
- Full suite fail 0 after the last source change.
