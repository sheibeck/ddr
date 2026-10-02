---
phase: 91-race-sub-class-audit
plan: 07
subsystem: combat-identity
tags: [ident-17, bard, joiner, sing, allycast, derived-stream, ward, narration, audit]
requires:
  - phase: 91-race-sub-class-audit
    provides: songPool, SONG_TITLES, the sang event, castSpell's free mode and the song stream pattern (91-06)
  - phase: 90-spell-skill-audit
    provides: the Joiner cast path (allyCast, allyThrow, the shared tails with a `by`) and the spell-record timers on a Joiner's sheet (90-10)
  - phase: 89-item-audit-fixes
    provides: the Joiner damage pipeline (applyFoeDamageToMember), memberView and the Joiner item policy
provides:
  - "engine/combat.js#pickSong(level, stream): the one song pick (spell, then title) that the hero's sing() and a Joiner Bard's turn share"
  - "engine/combat.js#alliesTurn: a Joiner Bard's first turn of every fight is its song, once per fight (ally.sang), on derivedRng(cursor, 'memberSong', partyIdx, acts), no charge, the main rng untouched"
  - "engine/combat.js#allyCast: every songPool(5) kind resolves for a Joiner caster (free option), 'you' being the Joiner"
  - "applyFoeDamageToMember reads a Joiner's own ward (Bubble first, Shield before armour) and foeTurn's tail ticks and fades it; memberStrike reads a Joiner's Sense Presence flag"
  - "member forms of sang, wardRaised, wardAbsorbed, wardShattered, wardFaded, wardReflected, strengthCast, sensesGained, earthquakeSelfDamage, deathCast and deathSpellTooWeak on the Oracle and the rail"
affects: [91-10, phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "one resolver, a charge-free option: the Joiner's song is allyCast with { free: true }, not a second resolver"
    - "a Joiner's combat-scoped self-effects (ward, senses) live on its fight entry and die with the fight; its timed spell records live on its own sheet"
key-files:
  created:
    - test/unit/joiner-bard-song.test.js
    - docs/narrative-pass/why/91-07.json
  modified:
    - engine/combat.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/event-variants.mjs
    - test/parity/harness/comparables.js
    - test/unit/bard-song-lines.test.js
    - test/unit/roll-high-guard.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/IDENTITY-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "A Joiner Bard sings on its first turn of the fight, after the free round-1 item use and a saving potion (at or below a third of its hit points), before any ability, cast or strike; the potion wins because a random spell is not what a dying Joiner needs"
  - "'You' in a sung spell is the singer: ward and Bubble are `ally.ward`, Strength a `spell:Strength` record on the Joiner's own sheet, Sense Presence `ally.senses`, Earthquake's backlash and Death's fee come out of `ally.wp`"
  - "Death keeps the hero's refusal at 26 hp or less, so its fee never downs a Joiner (only Earthquake's backlash can)"
  - "A sung Turn Walking Dead fixates nothing: fixation is a hero-only targeting rule and the alternative was to aim it at the hero in the Joiner's place"
  - "The Joiner's song is cast at +0 school bonus, the same flagged assumption as the hero's (a Bard has no chart row)"
  - "A Joiner's live Strength now rolls its d10 on a Joiner's thrown spell too (allyThrow), as the hero's does; zero draws and no change for any Joiner without one"
requirements-completed: [IDENT-17]
status: complete
duration: about 2h
completed: 2026-10-01
---

# Phase 91 Plan 07: Joiner Bards sing Summary

**IDENT-17, the Joiner half: a Joiner Bard sings one random offense or protection spell of its own level on its first turn of every fight, resolved as its own cast through the Joiner cast path with no charges, so a sung Shield wards the Joiner, a sung Strength is the Joiner's, and a sung Earthquake's backlash comes out of the Joiner, never the hero.**

## What was built

- **The song** (`engine/combat.js#alliesTurn`): for a classed Joiner whose sheet is a Bard and whose entry has no `sang`, the turn is the song. `ally.sang = true`; `derivedRng(<main cursor>, "memberSong", partyIdx, acts)`; `pickSong(ally.lvl, stream)` (the helper `sing()` now uses too, the same two draws in the same order, so the hero's song is byte-identical); a `sang { title, spell, level, member }` event; then `allyCast(..., stream, events, { free: true })`; `continue`. The main rng draws nothing for the song. The flag lives on the fight's own ally entry, so the next fight sings again, and it is independent of the hero's `combat.sang` (a hero Bard and a Joiner Bard each sing once; one hero `sing` action produces both songs).
- **The Joiner cast path covers the whole pool** (`allyCast`, in place; its `opts.free` skips the charge). New branches: ward and Bubble, Strength, Sense Presence, Acid, Stupidity, Blind, Shrink, Earthquake, Noxious Vapor, Fireballs, Petrify, Insane, Death, Turn Walking Dead, Plane Gate. Each is the hero's rule (magic.js) in the hero's draw order at the Joiner's level, the Joiner's name on the cast line and every resist, with no Afraid and no `spellDamageFor` (the reading `iceStorm` already uses for a Joiner). `allyThrow` adds a live Strength's d10 (zero draws for any Joiner without one).
- **"You" is the singer.** Shield and Bubble are `ally.ward` (the Joiner's own combat entry): `applyFoeDamageToMember` reads an armed Bubble first (the whole blow goes back, the ward pops to a 25 hp film for the round) and a Shield pool after the Pendant and Brace, before the armour soak, exactly where the hero's pipeline reads them; `foeTurn`'s tail ticks the Joiner's ward and fades it with `wardFaded { member }`. Strength is a `spell:Strength` record on the Joiner's own sheet, so `memberStrike` rolls the extra d10. Sense Presence is `ally.senses`. Earthquake's backlash (half the dice, none if warded) and Death's 25 hp fee come out of `ally.wp`; a lethal backlash goes through `downMember`.
- **Narration:** the `member` forms of eleven events on both surfaces (the hero's lines are unchanged and pinned), ledger `docs/narrative-pass/why/91-07.json` (22 rows, each `after` read from the live corpus), four scoped corpus toggles, review pages regenerated.
- **Audit:** `docs/IDENTITY-AUDIT.md` `bard-song` is `fixed engine (91-06, 91-07)` with the Joiner pins; three findings for Phase 91.1 (below).

## Start-of-plan inventory

- **What the Joiner cast path resolved after Phase 90:** `thrown` (Freeze, Fireball, Mangle), `thrown` with `aoe: "all"` (Lightning), `blast` (Ice), `status` (Doze), `stun`, `weaken`, `heal`, `timed` (Speed of Sound, Enchant Character), `timestop`, `misdirect`, `behemoth`.
- **songPool(5) kinds it did not support, now added:** `ward` (Shield, Bubble), `might` (Strength), `senses` (Sense Presence), `acid`, `stupid`, `blind`, `shrink`, `quake`, `vapor`, `volley`, `petrify`, `insane`, `death`, `turn`, `gate`.
- **Where a self-effect was written:** a Joiner's heal went to `ally.wp` (clamped to `ally.maxWP`); its timed spells went to a `spell:<name>` record on its own sheet (`startSpellEffect(sheet, ...)`). Neither a ward nor a flag had a home, so the ward and the Sense Presence flag went on the fight's ally entry (like `braced` and `opened`).
- **How a Joiner's own HP loss is applied:** `member.wp -= dmg` then `downMember` at 0, inside `applyFoeDamageToMember`; the backlash and fee use the same writes and the same `downMember`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Carve-outs beyond `sang`**
- **Found during:** Task 1.
- **Issue:** the plan names the allies' `sang` flag for the comparables; the ward and Sense Presence flag are also brand-new serialized fields on the same entry.
- **Fix:** `stripFoeAbilityState` strips `sang`, `ward` and `senses` from every ally entry (beside `opened`), shared by all three `*Comparable()` functions.
- **Commit:** 22eef33c.

**2. [Rule 3 - Blocking] The draw inventory moves**
- **Found during:** Task 1 (`roll-high-guard.test.js`, not in the plan's file list).
- **Issue:** the Joiner twins of the hero's tagged draws add `.d(` sites to `engine/combat.js`: amount 20 to 27, selection 5 to 7, mishap-on-1 0 to 1 (all on the derived song stream).
- **Fix:** DRAW_INVENTORY re-measured and the change explained in its comment; declared in FIXTURE-INVENTORY. `roll-ledger-sync` and the invariant tests pass untouched.
- **Commit:** 22eef33c.

**3. [Rule 3 - Blocking] The shared corpus base event makes the Joiner form the default**
- **Found during:** Task 2.
- **Issue:** `tools/lib/event-variants.mjs`'s base event carries `member: "the companion"`, so adding a `member` branch to a builder makes the Joiner form the default rendering (and `member: null` the hero's), which would leave a plain Shield ward and a restarted Strength unread by the voice guards.
- **Fix:** four scoped toggles appended at the end (ids stable), documented in the file. The file is outside the plan's list.
- **Commit:** 844ca69c.

### Plan items that came out differently, with the reason

- **"A lethal Death cost downs the Joiner" is not reachable.** The plan's behavior bullet lists a lethal Death fee through `downMember`. The hero's Death refuses at 26 hp or less (`deathSpellTooWeak`), and "resolved as if cast by a Magic User" keeps that rule, so the fee can never kill its caster. The lethal path is Earthquake's backlash (pinned with a 1 hp Joiner). A Joiner under 27 hp that sings Death gets the refusal line with its name on it, spends the song and loses nothing.
- **A sung Turn Walking Dead fixates nothing.** The hero's fixation (survivors swing only at the caster) is a hero-only rule in `pickFoeTarget` with its own chip text. Setting it for a Joiner's cast would aim the dead at the hero in the Joiner's place, the exact thing the plan's prohibition forbids. The Joiner's Turn is therefore a little better than the hero's; flagged for Phase 91.1.
- **The ward and Sense Presence flag live on the fight entry, not the sheet.** The plan says "the Joiner's sheet" for the ward; a ward is combat-scoped and the entry dies with the fight (as the hero's ward is cleared at `endCombat`), which also avoids leaking a stale ward into the persistent party sheet. Strength is on the sheet (a squares-timed record, as Phase 90 stored the Joiner's other spell records).
- **Sense Presence for a Joiner** has no darkness read except its Stealth crit (memberStrike), and the song comes on the first turn, after any ambush: its whole effect is that the dark no longer stops the Joiner's Stealth crit. The Oracle and rail lines claim only that.
- **TDD:** a RED commit (43 of 45 failing) precedes the GREEN commit. The non-Bard byte-identical pin was measured on an extracted tree of the base commit and pasted into the test as literals.

### Authentication gates

None.

## Fixture drift (IDENT-17, Joiners)

Measured, not assumed, and declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 91 plan 07: Joiner Bards sing (IDENT-17)").

- **Parity: 66 of 66 unmoved.** No parity fixture carries a party or a Bard. `test/parity/prototype-master.js.txt` is untouched; `sang`, `ward` and `senses` are carved out of all three `*Comparable()` functions.
- **State pins: 8 of 8 unmoved; save-compat unchanged.** No pinned run has a Joiner Bard (the two party pins' Joiners are a Court Mage and a Fighter). `roll-high-baseline.mjs save` was never run, no label re-recorded. A non-Bard Joiner is byte-identical: six seeded two-turn runs (Soldier and Wizard) give the same event count, main-rng state and events digest on the base tree and on this one.
- **What did move (declared):** the `roll-high-guard.test.js` draw inventory (amount +7, selection +2, mishap +1, all on the derived stream; none is the main rng), the Joiner forms in the narration, the 91-07 ledger (22 rows), four corpus toggles, and the `bard-song` audit row.
- **Not run (Phase 92 only):** any bot readout or fit sweep. A Joiner Bard in a bot run now sings once a fight, so such a run shifts; none of the pinned runs has one.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file or trust-boundary surface: the song is engine arithmetic on a derived stream, and the new per-Joiner fields are transient combat-entry state.

## Findings for Phase 91.1

- A Joiner Bard does not carry the hero Bard's dim-witted-foes drawback (the ruling names only the hero's targeting). Recorded in `docs/IDENTITY-AUDIT.md`.
- A sung Turn Walking Dead fixates nothing, and a sung Sense Presence only helps the Joiner's Stealth crit (above).
- The identity text (`content/identity.js`, the footer and blurb) still states the song as the hero's; a Joiner Bard's song is visible in the Oracle, the rail and YOUR LOT, but no identity line says Joiner Bards sing. Not in this plan's files; for 91-10's wording pass if wanted.

## Human verification (deferred to end of run)

For the batched Pixel 7 checklist at milestone close:

1. Take on a Bard Joiner and start a fight: on its first turn the Oracle and the rail say it sings a named song and what it does; it does not sing again that fight.
2. When a Bard Joiner's song is a ward (Shield), the Joiner's HP in YOUR LOT drops less on the next hit.
3. When the song is Earthquake or Death, the HP that drops is the Joiner's in YOUR LOT, never the hero's; a Joiner at 26 hp or less that sings Death gets the "needs at least 27" line with its name and loses nothing.

## Verification

Targeted runs (no full `npm test`, per the user's 2026-10-01 ruling): the Joiner tests (joiner-bard-song 46 tests, bard-song, bard-song-lines, joiner-combat-items, joiner-armour-soak, joiner-defences, joiner-live-hp, joiner-casters, joiner-item-use, joiner-item-lines, joiner-item-chips, joiner-race-to-be-hit, joiner-level-cap, joiner-acquisition, bot-joiner-items), party-combat, party-abilities, party-model, combat, magic, spell-skill-audit-fixes, spell-mechanics, control-at-depth and its rules guard, the roll-high guard, state pins, save-compat and ledger-sync, identity-audit and identity-contract, the narration coverage, table and lines tests, narrative-review, voice-corpus, stale-terms, hp-surface-guard, hero-conditions, tuning-bot, the voice hygiene and safety scans, the parity glob (66), determinism and roundtrip: **1108 tests, 1108 pass, 0 fail, 0 skipped.** `node tools/narrative-review.mjs --check` in sync; `node tools/voice-inventory.mjs --check-ledgers --after` 0 errors; `git diff` on `test/parity/prototype-master.js.txt`, STATE.md, ROADMAP.md and REQUIREMENTS.md is empty. Acceptance greps: `"memberSong"` 1, `pickSong(` 4, `sang` in comparables 5, `### Phase 91 plan 07` once.

## Commits

- 0e5d3ad0: test(91-07): add failing tests for the Joiner Bard's once-per-fight song (IDENT-17)
- 22eef33c: feat(91-07): a Joiner Bard sings once per fight through the Joiner cast path (IDENT-17)
- 844ca69c: feat(91-07): narrate a Joiner Bard's song by name, pin the audit row, declare the drift (IDENT-17)

## Self-Check: PASSED

Created files exist (`test/unit/joiner-bard-song.test.js`, `docs/narrative-pass/why/91-07.json`, this summary); the three task commits are in git log; the acceptance greps hold; STATE.md, ROADMAP.md, REQUIREMENTS.md and `test/parity/prototype-master.js.txt` are untouched.
