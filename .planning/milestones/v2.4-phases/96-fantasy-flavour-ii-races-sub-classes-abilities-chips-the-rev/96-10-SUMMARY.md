---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 10
subsystem: testing
tags: [flavour, rules-layer, sweep, coverage, criterion-4]

requires:
  - phase: 96-05
    provides: the roller reveal, Hero dossier and trait line surfaces
  - phase: 96-06
    provides: the ability and skill surfaces and the Final Sheet tricks
  - phase: 96-07
    provides: the chip tap cards and the UP YOUR SLEEVE card
  - phase: 95-07
    provides: the Gear, store, loot and drop surfaces the Phase 95 probes sweep
provides:
  - test/unit/flavor-sweep.test.js, the automated half of ROADMAP criterion 4 (S1 to S4 over 20 description surfaces)
  - a coverage test tying the probes to the Surfaces table in docs/TEXT-LAYERS.md
  - two todo tests that keep two un-dressed surfaces visible (findings, not fixes)
affects: [96-11]

tech-stack:
  added: []
  patterns:
    - "A surface is one probe { covers, paint(), expect() }; expect() computes flavour lines and RULES bodies from the lookups and the content tables, never from the DOM"
    - "A todo test records a known gap and turns green by itself when the gap is closed"

key-files:
  created:
    - test/unit/flavor-sweep.test.js
  modified: []

key-decisions:
  - "Index size guard is 300 and the real index holds 397 strings; to clear 300 the index also holds every single good, bad and neutral footer entry the footer lines are joined from (a leak could be one clause)"
  - "Final Sheet tricks is swept on the tricks section only (the surface's name); the worn and bag sections are recorded as a todo finding"
  - "S3 compares body lines in document order; the Grimoire and combat spell expectations are ordered by spell level then name, the rule the product documents for both lists"

patterns-established:
  - "Sweep teeth: fragments built with the real mountRules in a recording document, doctored one assertion at a time"

requirements-completed: [FLAVOR-03, FLAVOR-04, FLAVOR-06]

coverage:
  - id: D1
    description: "Every one of the 20 description surfaces passes S1 (flavour present, number-free), S2 (no rules sentence outside a RULES body), S3 (RULES bodies equal the unchanged rules text) and S4 (toggle contract), Always show the rules off and on"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/flavor-sweep.test.js: 'surface ...' x 23 (13 Phase 95 surfaces, 7 Phase 96 surfaces, Chip tap cards in four states)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sweep cannot pass vacuously: the index is guarded, a probe that paints nothing or expects no flavour or body is reported, and each of S1 to S4 is proven able to go red"
    requirement: FLAVOR-06
    verification:
      - kind: unit
        ref: "test/unit/flavor-sweep.test.js: 'index:' and 'teeth:' x 6"
        status: pass
    human_judgment: false
  - id: D3
    description: "A surface added to docs/TEXT-LAYERS.md without a probe fails, and the seven Phase 96 surfaces each have a probe"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/flavor-sweep.test.js: 'coverage:' x 3 and 'coverage teeth:'"
        status: pass
    human_judgment: false
  - id: D4
    description: "No description on any screen still reads like a rulebook sentence, as a person judges it on a phone"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "The second half of ROADMAP criterion 4 is a device walk; the automated sweep covers the 20 listed surfaces only"

duration: 70min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 10: The flavour sweep Summary

**One table-driven test paints all 20 description surfaces through the real shell code and proves the flavour states no number, no rulebook sentence is left outside a RULES body, and each RULES body equals the unchanged rules text; it also found two surfaces nobody dressed.**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `06186afa` | sweep harness (S1 to S4, index, runner), teeth, and the 13 Phase 95 surfaces |
| 2 | `95dfabff` | the seven Phase 96 surfaces (Chip tap cards in four states), the coverage test, two todo findings |

## What the file does

- **Index:** `buildRulesIndex()` collects every string of at least twelve characters from SPELLS txt and the resist sentence, POTIONS, TOOLS, BAG_ITEMS, JEWELRY, CLOAKS, STAVES, the lockpicks line (read off the store's own stock row), ABILITIES txt and their "New trick" lines, both skill tables (txt and txt2), RACE_NOTE, CLASS_NOTE, SUB_NOTE, every RACES note, every race and sub-class footer (the displayed lines and the single entries), the three combat-menu rules sentences, the two Gear rules sentences and the four shell tables (CONDITION_EXPLAIN, FOE_EFFECT_EXPLAIN, HERO_OUT_EXPLAIN, HASTE_SPELL_EXPLAIN, evaluated out of mazeworld.html; each table is asserted found). **397 strings** (guard: 300). Each probe adds its own `extraRules`.
- **Assertions** return arrays of problems: `assertS1(flavours, text)`, `assertS2(text, index)`, `assertS3(expected, actual)`, `assertS4(root, always, openers)`. `visibleText` reads tag-stripped innerHTML, textContent and children, skipping every `.mw-rules-body` and any hidden descendant.
- **Runner:** every probe is painted with Always off (S1 to S4) and again with Always on (the same checks, S4's Always half, bodies unchanged). Vacuity guards: a probe must paint a root, expect at least one flavour line and at least one RULES body.
- **Teeth (6 tests):** a clean fragment passes all four; a rules sentence in the flavour slot fails S2; a body with one digit changed fails S3; "Hits for 10." fails S1 (digit), "Twice as sharp." fails S1 (number word), plus percent, die token and absent-flavour cases; an orphan body with no controlling toggle fails S4 (also a body that starts open and a toggle left on with Always on); a probe that paints nothing is reported through the real runner. I also reddened real surfaces by hand (a doctored Combat ITEMS body, a flavour line pushed into `extraRules`, a doctored ability body) and saw S3 and S2 go red; all reverted.

## The 20 probes (`covers`)

Phase 95 (13, named as the Surfaces table's first column): Grimoire; Combat SPELLS rows; Combat ITEMS rows (items, potion counter, scroll) (two states: counter and scroll, and a worn Ring of Power); Find card (jewel, blade, mail); Gear WORN rows (opener); Gear BAG cards (opener); Gear CONSUMABLES; Gear sheet (bag Anklet, worn weapon); Store stock rows; Sealed scroll; Your gear sell list; Loot list; Drop shelf.

Phase 96 (7): Roller reveal (Warlock Elven, Summoner Human on a fake clock); Hero dossier and trait line (Wilmsry Cat Burglar, Elven Wizard); Combat ABILITIES rows and SING (Fighter, Thief, Bard); Hero abilities and skills (Soldier, Cat Burglar with a level-two Locks); Final Sheet tricks (opener; dead Fighter and Thief); Chip tap cards, four probes under one name (HUD strip out of a fight with a harmful and two helpful chips; combat condition card; YOUR LOT hero Smoke and Joiner Sidestep; Company panel Joiner chip); UP YOUR SLEEVE card (fresh Fighter and Thief).

36 tests: 1 index, 6 teeth, 23 surface runs (20 surfaces, Chip tap cards in four states), 4 coverage (3 plus one with teeth), and 2 todo; 34 pass, 0 fail, 2 todo.

## Findings: surfaces the sweep found un-dressed (not fixed, per the file list)

The sweep is green on every named surface. It also found two places where a rulebook sentence still sits in the open. Both are recorded as `{ todo }` tests in the file, so they show in every run and go green by themselves once fixed. Neither is a surface the CONTEXT or the Surfaces table lists, and fixing either means editing a product file and re-pinning earlier plans' tests, which this plan's file list forbids, so I stopped at the finding.

1. **Final Sheet worn section.** `renderFinalSheet` prints each worn item's own rules `note` (for example the Cloak of Ether: "used, you walk through walls for ten squares (be in a corridor when it ends ...)") as a plain `mw-fs-note`. Phase 95 never dressed the Final Sheet and 96-06 dressed the tricks only. Fix would be a flavour line in the worn rows and, with Always on, a static `final:worn:<slot>` body (the same read-only pattern as the tricks), plus a view-model field and the final-sheet pins.
2. **Hero special-skills list, bought active skills.** An active skill (Kata, Death Touch, Sidestep, Pommel Strike, Battle Roar, Second Wind, Sweep; Feint, Dirty Trick, Smoke, Silent Step) has no skill flavour, and 96-06 deliberately renders such a row as today's markup, so its rules text is printed in the open on the Hero tab (rules-surfaces case (y) pins that). The probe sweeps the passive skills (all dressed); the todo covers the active rows. Fix would be to give such a row its twin ability's flavour and the skill text behind RULES, and to re-pin case (y).

Both are for the orchestrator to schedule (a small plan or a 96-11 add-on) or to decline. If they are declined the two todo tests are the record.

## Deviations from Plan

**1. [Rule 3 - Blocking] Index needed more strings to clear the 300 guard.** The sources the plan lists give 282 unique strings. The index also holds each single good, bad and neutral footer entry (the pieces `footerLines` joins), which are rules clauses a leak could print alone; that gives 397.

**2. Trailers.** The orchestrator's rulings name `Co-Authored-By: Claude Opus 5.5 (1M context)`; the session's attribution reminder, which the plan also points at, gives `Claude Sonnet 5.5`, the model actually running. Commits carry the reminder's two lines.

**3. Probe order is document order.** Grimoire and combat SPELLS expectations are ordered by spell level then name (the sort the product documents for both lists), and the Gear WORN list runs weapon, armour, cloak, jewelry.

No product file, engine byte, fixture or other test file was touched. `git diff --stat 673ee393 -- engine content src mazeworld.html docs` prints nothing.

## Tests run (targeted only, no full suite, no bot runs)

- flavor-sweep, rules-surfaces, roller, status-chit-combat, shell-company-items, final-sheet, heroTab, rules-layer: 191 tests, 189 pass, 0 fail, 2 todo (the two findings).
- Name filters: `teeth|index` 8 pass; `coverage|Coverage` 4 pass.
- `git ls-files --eol test/unit/flavor-sweep.test.js` shows `i/lf w/lf`.
- The sweep reads no flavour wording: expectations come from the lookups, so it stays green after 96-09 rewrites its 14 lines (any rewrite that stated a number would fail S1, as intended).

## Known Stubs

None.

## Threat Flags

None. The file reads and paints only. T-96-29: the index has a size guard, each probe must find flavours and bodies, and the teeth prove S1 to S4 can fail. T-96-30: expected bodies are computed from the content tables and the shell's tables (the chip bodies from the shell's own `conditionTapText` plus a check that each keeps its CONDITION_EXPLAIN sentence), no rules text was edited, and no guard file moved.

## Human verification (deferred to end of run)

Pixel 7 screen walk, Always show the rules Off and then On, reading for any description that still sounds like a rulebook sentence:
- Gear (WORN, BAG, CONSUMABLES, the item sheet), the store (stock rows, the Sealed scroll, Your gear), the loot card and the find card, the bag-full drop shelf.
- Spells: the Grimoire, combat SPELLS; combat ITEMS and ABILITIES (including SING).
- Hero: the dossier, the trait line, the ability list and the special-skills list (buy an active skill and look at its row: finding 2), the Company panel chip.
- Chip taps: the HUD strip, the combat condition card, YOUR LOT (hero and Joiner).
- Title and roller reveal, the UP YOUR SLEEVE card on a fresh Fighter and Thief.
- Final Sheet after a death: tricks (flavour, and the exact text with Always On) and the worn section (finding 1: the worn items' notes still read like rules).

## Self-Check: PASSED

- File found: test/unit/flavor-sweep.test.js (36 tests, LF).
- Commits found: 06186afa, 95dfabff.
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
