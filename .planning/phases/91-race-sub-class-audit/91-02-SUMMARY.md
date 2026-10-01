---
phase: 91-race-sub-class-audit
plan: 02
subsystem: chargen-identity
tags: [wizard, cleric, grimoire, school-gates, identity, fixtures, ident-13, ident-15]
requires:
  - phase: 90-spell-skill-audit
    provides: the school-gate data (MU_CHART null = never learned, canLearn/canCast/schoolClosed), the Wizard's lost Illusion school, the spell list as it stands
  - phase: 91-race-sub-class-audit (plan 01)
    provides: docs/IDENTITY-AUDIT.md rows, the Q2 A / Q3 B rulings, the scope notes for this plan
provides:
  - "engine/character.js#topUpWizardDamage: the Wizard's named day-one direct-damage guarantee (derived stream only)"
  - "MU_CHART.Cleric.offense = null: the Cleric's offense ban as gate data, one gate and no name check"
  - "traits wizard-day-one and cleric-heal-start, SUB_NOTE.Wizard and SUB_NOTE.Cleric rewritten"
  - "test/unit/wizard-day-one.test.js and test/unit/cleric-offense-ban.test.js"
  - "the declared chargen drift (one fixture seed, three pins, one DRAW_INVENTORY count, one snapshot)"
affects: [91-03, 91-09, 91-10, phase-92]
tech-stack:
  added: []
  patterns:
    - "a class rule as chart data (null school), never a name check"
    - "a named guarantee that is a no-op today, pinned by base-commit book digests"
key-files:
  created:
    - test/unit/wizard-day-one.test.js
    - test/unit/cleric-offense-ban.test.js
    - docs/narrative-pass/why/91-02.json
  modified:
    - engine/character.js
    - content/mu-chart.js
    - content/identity.js
    - content/flavor.js
    - docs/IDENTITY-AUDIT.md
    - docs/SPELL-AUDIT.md
    - docs/SPELLS.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/fixtures/action-script.chargen.json
key-decisions:
  - "The direct-damage predicate is engine/derived.js#dealsDamage as it stands (exactly DAMAGE_SPELL_KINDS.has(kind) since Phase 90 removed Lesser Summon), so no dealsDirectDamage export was added"
  - "The Wizard step fires only when no usable level-1 direct-damage spell is in the book, draws one spell from the full pool with dr.d(pool.length), and never touches the main rng (36 main draws unchanged)"
  - "The Cleric ban is MU_CHART.Cleric.offense = null: Strength (offense school, a buff) goes with it, as 91-01 noted"
  - "The Wizard trait reads 'level 1' with a space: the footer hygiene test bans a hyphen before a digit"
requirements-completed: [IDENT-13, IDENT-15]
status: complete
duration: ~one session
completed: 2026-10-01
---

# Phase 91 Plan 02: The Wizard's day-one damage and the Cleric's offense ban Summary

**A Wizard now has a named, pinned guarantee of a castable direct-damage level-1 spell (1,000 seeds, every race), and a Cleric can never learn, be dealt, copy or cast an offense spell (one `null` in the gate data, no name check) while always starting with a castable Heal; the only chargen drift is the Cleric's, fully declared.**

## What was built

- **IDENT-13 (Task 1).** `engine/character.js#topUpWizardDamage(book, sub, dr)`, called at the end of `rollGrimoire`'s day-one top-ups with the grimoire derived stream `dr` already in scope. Wizard only; returns the book untouched (zero draws) when it already holds a level-1 direct-damage spell usable now; otherwise draws one spell from the full level-1 direct-damage pool (every SPELLS row the Wizard can learn at effective level 1 whose own kind deals damage) in SPELLS order. Today that pool is Freeze alone.
- **IDENT-15 (Task 2).** `MU_CHART.Cleric.offense` is `null` with a DELIBERATE RULES CHANGE comment. `canLearn`, `grantableAt` (rollGrimoire walks, `findGrimoire`), `readScroll`'s scribe gate, `canCast`/`castSpell` (`spellSchoolLocked`, forbidden, no charge), the combat menu and the tolerant save load all follow it. The Cleric's Heal and Major Heal must-have grants stay (comment updated to name IDENT-15); `rollGrimoire`'s day-one damage top-up finds nothing for a Cleric and ends quietly. A scroll that rolls an offense spell still free-casts (Q3 B), pinned.
- **Traits and prose.** Wizard good `wizard-day-one`, Cleric good `cleric-heal-start`; the Cleric footer now carries the generated "never learns offense, special or illusion spells" line. `SUB_NOTE.Wizard` no longer says "Every school of magic" (it names the schools it learns and "never Illusion"); `SUB_NOTE.Cleric` states the ban and the Heal start in the house voice and drops "a shield" (user 2026-10-01). No Cleric HP rule is stated (Q2 A).
- **Docs.** `docs/IDENTITY-AUDIT.md` Wizard and Cleric rows updated (new order, verdicts `fixed engine/text (91-02)`, pins filled); `docs/SPELL-AUDIT.md` and `docs/SPELLS.md` gate tables show the Cleric's offense as never; `docs/narrative-pass/why/91-02.json` (6 rows, each `after` from the live corpus) and the regenerated review pages.

## Start-of-plan checks (Task 1 step 0)

- The 1,000-seed forced-Wizard sweep and the every-race x 200 sweep were run on the unmodified base (1823e0ed): **0 failures**. The existing top-up already gave every Wizard a castable Freeze, so the new step is the explicit, named guarantee that keeps it true. It never fires today: every Wizard book is byte-identical to the base (sha256 over seeds 1 to 1000 pinned in the test), as is every other non-Cleric Magic User sub (seeds 1 to 200).
- Level-1 spells after Phase 90: Heal, Shield, Strength, Doze, Freeze, Map the Floor, Mirror Self, Stun, Weaken, plus Open/Lock and Door Illusion (derived rows). The only level-1 direct-damage spell is **Freeze** (`kind: thrown`).
- `dealsDamage(sp)` is exactly `DAMAGE_SPELL_KINDS.has(sp.kind)` (Phase 90 removed the lesser summon), so **no `dealsDirectDamage` export was added**; the step reads `dealsDamage`.
- Phase 90 stored the Summoner's Summon exception as `SPELL_LEVEL_OVERRIDES = { Summoner: { Summon: 1 } }`, read only through `spellLevelFor`; the Wizard step uses the same `spellLevelFor` (usable-now) rule `rollGrimoire` already uses. `MU_CHART.Wizard.illusion` is `null` on master (confirmed before rewriting the blurb).

## Flagged assumptions (for the user's review)

- **IDENT-13 (unclassified probe):** "direct-damage" means a spell whose own kind deals damage to a foe (`engine/derived.js` `DAMAGE_SPELL_KINDS` via `dealsDamage`), never a summon or a buff. "Castable on day one" means `canCast` at level 1 plus a spell charge left (level-1 heroes have 4).
- **IDENT-15 (unclassified probe):** "offensive spells" means the offense school (MU_CHART's offense column), which includes its buff Strength. Bard songs and staves are not Cleric casting. A Cleric may still free-cast an offense scroll (Q3 B, ruled, pinned here, text by 91-10).

## Fixture drift (IDENT-13, IDENT-15)

Predicted before measuring, then measured live against the base 1823e0ed. Full record: `test/parity/FIXTURE-INVENTORY.md` "### Phase 91 plan 02".

- **The Wizard step moves nothing.** Every Wizard and every other non-Cleric sub's book and rng cursor is byte-identical to the base; the Wizard's main-rng draw count stays 36.
- **The Cleric loses the offense school from both main-rng shuffles:** `rollGrimoire` draws 10 values where it drew 34 (low pool 13 to 5, high 16 to 5, day-one spare 7 to 2). Any fixture or pin with a Cleric hero moves; nothing else does.
- Moved entries, each declared with before/after and regenerated alone:
  1. `action-script.chargen.json` seed 35 (Magic User / Cleric / Troll): record gains `grimoire`. Before (prototype): Freeze, Stupidity, Sense Presence, Weaken, Insane, Shield, Heal, Major Heal. After (engine): Turn Walking Dead, Shield, Heal, Sense Presence, Regeneration, Plane Gate, Bubble, Major Heal. No other compared field moves (the name, drawn after the grimoire, is carved out of parity).
  2. `chargen-rng-pin.test.js`: `ROLL_CHARACTER_PINS[35]` 1447918666 to 440012114; `NEW_RUN_PINS[35]` 642742802 to 898507590; Cleric draw count 34 to 10. The same count in `day-one-damage`, `grimoire-legality` and `guaranteed-attack-spell`.
  3. `roll-high-guard.test.js#DRAW_INVENTORY`: `engine/character.js` selection 14 to 15 (the derived-stream pick).
  4. Shell snapshot `mu.hero` (1 of 8; the other seven re-wrote identically and were restored): the Wizard's blurb and its footer's Good line.
- **Not moved:** the other 5 parity fixtures' scenarios (no Cleric hero among them), `roll-high-state-pins` (0 of 8 labels moved), `roll-high-save-compat` (`expected` hash unchanged), the fixture roster (`tools/fixture-inventory.mjs --json` byte-identical to the base), `test/determinism`, `test/persistence`, `test/roundtrip`, `test/voice`. `test/parity/prototype-master.js.txt` is untouched; `roll-high-baseline.mjs save` was never run.
- New serialized fields: none (nothing to carve out of the three `*Comparable()` functions). New events: none.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Tests and docs that pinned what this plan moved, outside the plan's file list**
- **Found during:** Tasks 2 and 3 (targeted runs)
- **Issue:** the Cleric change broke pins that restate the Cleric's draw count (34) or its offense access, and the identity-audit probe leaned on `wizard-day-one` being pre-registered.
- **Fix:** re-recorded only the moved values with declarations: `grimoire-legality.test.js` and `guaranteed-attack-spell.test.js` (Cleric 34 to 10; the day-one damage sweep skips the Cleric and asserts it holds none), `magic.test.js` (the Cleric's Demons-doubling Fireball is now a scroll cast: same 46), `removed-spells-load.test.js` (an old Cleric's offense spells drop on load), `roll-high-guard.test.js` (DRAW_INVENTORY), `identity-audit.test.js` (the two built traits left the pre-registered list; the non-live-row probe clones a live row), `docs/SPELLS.md` (the Phase 90 gate table the spell-audit test reads, plus the stale Cleric day-one row), the `mu.hero` shell snapshot.
- **Commits:** 66c55200, 77b47fe1

**2. [Rule 1 - Bug] The trait text first read "level-1"**
- **Found during:** Task 2 (footer hygiene test: no hyphen before a digit)
- **Fix:** the trait reads "always starts with a level 1 direct-damage spell it can cast on day one"; the ledger and tests use that text.
- **Commit:** 66c55200

**3. SUB_NOTE.Wizard lost its "Apprentice joke".** The plan said to keep it, but the Apprentice clause was the "flat refusal to teach anybody who isn't an Apprentice" itself, which 91-01 found has no engine rule; keeping it would state a false rule. The melee refusal and the closing joke stay.

**4. TDD note.** Task 1's sweep already passed on the base (measured), so no honest RED exists for the Wizard step; the tests, written first, pass on the base for the book digests and sweeps and only the helper-export tests needed the new function.

**5. Test scope.** Per the user's 2026-10-01 rule the full `npm test` was not run. Run instead (all green): the parity glob, every test that names or pins a Cleric or Wizard, the identity/audit/voice/narrative/spell/school/save/chargen/joiner/party/menu/engine-named groups, and the determinism, persistence, roundtrip and voice directories (see counts below).

## Tests run

- `node --test "test/parity/**/*.test.js"`: 66 pass, 0 fail.
- The plan's Task 1 and Task 2 verify sets, plus roll-high state pins, save-compat, guard, shell snapshots, magic, removed-spells-load, spell-audit, school-gates, identity-audit: 360 pass, 0 fail in one run.
- Wider selections: 1,994 pass (hero, roller, spell, scroll, joiner, party, audit, grimoire, fixture, voice, narrative, identity, school, chargen, save and load groups); 592 pass (doc, blurb, text, copy, class, content, sweep, wording, menu, engine groups); 139 pass (determinism, persistence, roundtrip, voice). 0 fail in every run.
- `node tools/narrative-review.mjs --check`: in sync (exit 0). `git diff --stat -- test/parity/prototype-master.js.txt`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.

## Findings for the audit

- Canon grants a Cleric Heal Wound, Turn Walking Dead and Cure Disease automatically (rulebook p.17); the game grants only Heal and Major Heal as must-haves (Turn Walking Dead is rolled, Cure Disease does not exist). Recorded on the `cleric-heal-start` row.
- A Cleric's level-1 usable book is exactly Heal and Shield (Map the Floor is behind divination gate 3); the day-one "two usable spells" top-up makes both a certainty.
- The Cleric's double damage against Demons (CANON-04) now reaches only a scroll cast (Q3 B); the Cleric's own spells never damage anything. Its Joiner form falls back to its staff (`bestAttackSpell` is null), confirmed in the Joiner test.
- Strength (offense school, a buff) leaves the Cleric with the ban, as 91-01 noted; if the user wants a Cleric to keep a buff, that is a chart decision, not an engine one.
- An old Cleric save loses its offense spells on load (the Phase 90 tolerant load), Heal and Major Heal stay.
- Phase 92: the Cleric is now a melee-and-heal class by rule; bot readouts for it will move more than any other class.

## Human verification (deferred to end of run)

1. Roll new characters until a Wizard comes up (three times): each Grimoire shows a level-1 spell that hurts (for example Freeze), castable in the first fight.
2. Roll a Cleric: the Grimoire holds Heal and no offense spell; the Hero tab's footer says it never learns offense spells and starts with Heal; the combat spell menu offers no Freeze.
3. Open a Wizard's Hero tab: the blurb and footer say it never learns Illusion spells (and no longer claim every school).

## Self-Check: PASSED

- FOUND: engine/character.js (`export function topUpWizardDamage`), test/unit/wizard-day-one.test.js, test/unit/cleric-offense-ban.test.js, docs/narrative-pass/why/91-02.json
- FOUND commits: c3314f08 (Task 1), 66c55200 (Task 2), 77b47fe1 (Task 3)
- `grep -c "### Phase 91 plan 02" test/parity/FIXTURE-INVENTORY.md` prints 1; `grep -c "cleric-heal-start" content/identity.js` and `wizard-day-one` print 1 each
