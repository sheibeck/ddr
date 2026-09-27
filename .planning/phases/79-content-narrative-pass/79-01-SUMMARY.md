---
phase: 79-content-narrative-pass
plan: 01
subsystem: narrative-tooling
status: complete
tags: [vox-05, roll-04, tooling, corpus, narrative-pass]
requires: []
provides:
  - "tools/lib/voice-corpus.mjs: buildCorpus, auditRegistry, domainOf, ownerOf, SURFACES, BANK_REGISTRY, CONTENT_FIELDS, NON_COPY_EXPORTS, NON_IMPORTABLE, OWNER_RULES, lexJs"
  - "tools/lib/event-variants.mjs: BASE_EVENT, BRANCH_TOGGLES, TYPE_FIELDS, variantsFor (frozen after 79-01; only 79-12 may extend)"
  - "tools/lib/voice-checks.mjs: ROLL_UNDER_PATTERNS, HYGIENE_RULES, scanRollUnder, scanHygiene, scanTwins, scanSafety, validateLedgers, readLedgers"
  - "tools/voice-inventory.mjs: the CLI every rewrite plan runs"
  - "docs/narrative-pass/corpus-base.json: the phase-base snapshot at cd560cc"
  - "docs/narrative-pass/README.md: the method"
affects: [79-02, 79-03, 79-04, 79-05, 79-06, 79-07, 79-08, 79-09, 79-10, 79-11, 79-12, 79-13]
tech-stack:
  added: []
  patterns:
    - "corpus rebuilt from the tree at run time; registry completeness guard instead of a hard-coded line list"
    - "ownership as data (OWNER_RULES), first match wins, default 79-12"
    - "every check carries violation and clean fixtures (teeth both ways)"
key-files:
  created:
    - tools/lib/event-variants.mjs
    - tools/lib/voice-corpus.mjs
    - tools/lib/voice-checks.mjs
    - tools/voice-inventory.mjs
    - test/unit/voice-corpus.test.js
    - docs/narrative-pass/README.md
    - docs/narrative-pass/corpus-base.json
  modified: []
decisions:
  - "The corpus uses its own nesting-aware lexer instead of tools/ident-sweep.mjs#stripJs: stripJs closes a template early at a nested template (eventNarration.js#foeShattered) and treats a quote in a regex literal as a string, so every comment after that point survived"
  - "Builder `before` values in a why-ledger compare number-blind against the base: builder renderings come from synthetic events, so a plan quoting a real event's numbers still matches its base variant"
  - "checkAfter checks only the last plan to touch a key; an earlier plan's after that a later row superseded is history"
  - "A space before a lone ? is not a spacing error: ? is the house unknown-value marker (rollRange.js, FOE_DETAILS_COPY.hpUnknown)"
  - "Raw literals holding a {token} are template entries (a literal is source, not a rendering)"
metrics:
  duration: "about 65 minutes"
  completed: 2026-09-27
  tasks: 3
  files: 7
---

# Phase 79 Plan 01: Narration corpus, checks and the phase-base snapshot Summary

One command (`node tools/voice-inventory.mjs`) now lists every player-facing string in the game with its surface, trigger, narration domain and owning Phase 79 plan. It checks them for roll-under phrasing, rendering leaks, twin-number disagreements and banned words, validates each plan's why-ledger against a committed phase-base snapshot, and a completeness guard stops a new copy bank from slipping past it.

**Plan base SHA:** `cd560cc8dafe63495bd80f45816c3bf30dae7ec1` (recorded as `base` in the snapshot).

## What was built

- **The corpus** (`tools/lib/voice-corpus.mjs`) has five sources:
  - every EVENT_NARRATION builder (`oracle:<type>`, 300) and every LINE_FOR builder (`rail:<type>`, 282), each rendered through the fixed synthetic events;
  - 64 registered copy banks (`bank:`), plus 79-03's pre-registered IDENTITY_TRAITS and generated IDENTITY_FOOTER source;
  - 15 content tables (`content:`);
  - a comment-stripped raw literal sweep of src/browser (not the two narration files), engine and mazeworld.html, including its markup (`raw:`).
  - The output is deterministic: two builds are byte-identical, sorted by surface order and then key.
- **The completeness guard** (`auditRegistry`) imports every src/browser and content module. It lists every export holding copy-like strings that is not a bank, a walked table or a declared non-copy export (30 of those, each with a reason). At the base it lists zero. A scratch copy of the tree with one new frozen object of sentences lists exactly that export.
- **The synthetic events** (`tools/lib/event-variants.mjs`) are the safety scan's BASE_EVENT and BRANCH_TOGGLES, copied, plus:
  - the roll-high fields, the voice-sample overrides and one toggle for every branch Phases 75.1–78 added;
  - 79-02's `gained` and Table 4 `row`/`stat`/`amount`;
  - `TYPE_FIELDS` (per-type field shapes) and `only`-scoped toggles.
- **The checks** (`tools/lib/voice-checks.mjs`):
  - 8 ROLL-04 patterns and 7 hygiene rules. Each has violation and clean fixtures, run against every dash variant (hyphen-minus, U+2013, U+2014, U+2212), the number words one to six and upper case;
  - `scanTwins` and `scanSafety`;
  - `validateLedgers`: schema, before from the base or an earlier plan, `--after`, `--coverage`.
- **The CLI** (`tools/voice-inventory.mjs`):
  - filters: `--owner`, `--surface`, `--domain`, `--key`;
  - output: `--table`, `--json`;
  - checks: `--roll-under`, `--hygiene`, `--twins`, `--safety`, `--count`;
  - other modes: `--diff`, `--check-ledgers [--plan] [--after] [--coverage]`, `--self-test`, `--base-sha`/`--out` (snapshot).
- **The method** (`docs/narrative-pass/README.md`) covers:
  - the rubric, the house line shape, the ROLL-04 phrasing rule and the standing rulings;
  - the key scheme, surfaces, domains and ownership;
  - the ledger schema and reasons, the per-plan procedure, the handed-on rule and the no-new-banks rule.
- **The standing test** (`test/unit/voice-corpus.test.js`, 27 tests) covers:
  - completeness (live tree and scratch copy), builder coverage, determinism, order and floors;
  - domain precedence, ownership, the lexer, every pattern's and rule's teeth, and PLAYER_WP sameness;
  - scanTwins, scanSafety, validateLedgers and readLedgers (BOM, CRLF);
  - the standing check of every `docs/narrative-pass/why/*.json` (passes on zero files) and the CLI self-test.

## The phase-base snapshot

`docs/narrative-pass/corpus-base.json` holds 1,871 entries and 3,735 texts in 627,474 bytes (LF), with `base` and `command` fields and no timestamps. A second run was byte-identical, and a regenerated corpus's `entries` equals the committed file's.

| Surface | Entries | Floor (test) |
| --- | --- | --- |
| blurbs | 39 | 31 |
| oracle | 327 | 261 |
| rail | 287 | 229 |
| refusals | 38 | 30 |
| rail-cards | 140 | 112 |
| combat-screen | 203 | 162 |
| items | 110 | 88 |
| spells | 87 | 69 |
| foes | 78 | 62 |
| death | 120 | 96 |
| boards | 182 | 145 |
| panels | 190 | 152 |
| map | 21 | 16 |
| title | 17 | 13 |
| other | 32 | none |
| **texts** | **3,735** | **2,990** |

| Owner | Entries |
| --- | --- |
| 79-02 | 28 |
| 79-03 | 55 |
| 79-04 | 229 |
| 79-05 | 240 |
| 79-06 | 323 |
| 79-07 | 203 |
| 79-08 | 142 |
| 79-09 | 199 |
| 79-10 | 51 |
| 79-11 | 345 |
| 79-12 | 56 |

`absent` at the base lists the two pre-registered 79-03 sources, `content/identity.js#IDENTITY_TRAITS` and `src/browser/identityFooter.js#footerLines` (both modules missing until 79-03 merges).

## The base worklist

### Roll-under (ROLL-04), 44 key-rule pairs

| Rule | Key | Owner | Match |
| --- | --- | --- | --- |
| face-to-hit | bank:CLASS_NOTE.Fighter | 79-03 | a 5 to hit |
| face-to-hit | bank:CLASS_NOTE.Magic User | 79-03 | a 3 to hit |
| single-low-face | bank:RACE_NOTE.Elven | 79-03 | hit on a 5 |
| need-face | bank:SUB_NOTE.Acrobat | 79-03 | needs a 3 |
| face-to-hit | bank:SUB_NOTE.Cleric | 79-03 | A 4 to hit |
| need-better | bank:SUB_NOTE.Guard | 79-03 | needs one better |
| single-low-face | bank:SUB_NOTE.Soldier | 79-03 | criticals on a 2 |
| single-low-face | content:RACES.Elven.note | 79-03 | hits on 5 |
| need-better | oracle:battleRoarRaised | 79-04 | need two better |
| natural-low, low-range, face-to-hit | oracle:smokeThrown | 79-04 | need a natural 1 / a 1–2 / 1 to find |
| natural-low, low-range, face-to-hit | rail:smokeThrown | 79-04 | need a natural 1 / a 1–2 / 1 to find |
| need-better | oracle:itemEffectStarted | 79-11 | need two better (the unseen kind) |
| need-better | rail:itemEffectStarted | 79-11 | need two better (the unseen kind) |
| need-better | raw:mazeworld.html#CONDITION_EXPLAIN | 79-07 | need two better |
| need-better | content:JEWELRY.Anklet of Invisibility.txt | 79-05 | need two better |
| need-face | content:STAVES.Crystal Staff.txt | 79-05 | need a 1 |
| low-range | raw:engine/items.js#rollTreasureItem | 79-05 | 1–5 (Lockpicks) |
| low-range | raw:engine/economy.js#openStore | 79-05 | 1–5 (Lockpicks in stock) |
| need-better | content:ABILITIES.battleRoar.txt | 79-05 | needs two better |
| need-better | content:ABILITIES.overheadBlow.txt | 79-05 | need two better |
| need-better | content:ABILITIES.sidestep.txt | 79-05 | needs two better |
| natural-low, low-range, face-to-hit | content:ABILITIES.smoke.txt | 79-05 | need a natural 1 / a 1–2 / 1 to find |
| need-better | content:FIGHTER_SKILLS.Battle Roar.txt | 79-05 | needs two better |
| need-better | content:FIGHTER_SKILLS.Sidestep.txt | 79-05 | needs two better |
| single-low-face | content:FIGHTER_SKILLS.Stealth.txt | 79-05 | critical on a 2 |
| need-face, face-to-hit | content:SPELLS.Mirror Self.txt | 79-05 | need a 1 / a 1 to hit |
| single-low-face | content:SPELLS.Weaken.txt | 79-05 | hit on a 3 |
| low-range | content:THIEF_SKILLS.Locks.txt | 79-05 | 1–5 |
| low-range | content:THIEF_SKILLS.Locks.txt2 | 79-05 | 1–7 |
| natural-low, low-range, face-to-hit | content:THIEF_SKILLS.Smoke.txt | 79-05 | need a natural 1 / a 1–2 / 1 to find |
| face-to-hit | content:BESTIARY.Stink Bug.sp.note | 79-05 | 2 to hit |
| single-low-face | content:BESTIARY.Zit.sp.note | 79-05 | hittable only on a 4 |
| low-range | bank:EPITAPHS.trap.2 | 79-06 | 1–5 |
| low-range | bank:MARKS_LEGEND.4.desc | 79-10 | 1–5 |

This covers every item on docs/ROLL-LEDGER.md's "Handoffs → Phase 79" list:
- Mirror Self, the Crystal Staff, Weaken, Zit, Stink Bug, Smoke and the Lockpicks text;
- the "need two better" Battle Roar, Sidestep and unseen lines;
- CONDITION_EXPLAIN's unseen sentence.

Drat, the Skeleton and the Shadow were already digit-free, so they are correctly absent.

### Hygiene, 9 hits

| Rule | Key | Owner | Match |
| --- | --- | --- | --- |
| ascii-sign | oracle:encounterRolled | 79-02 | "— -15 HP" (the Table 4 roll line's hyphen-minus cell) |
| standalone-wp | raw:engine/combat.js#SONGS | 79-04 | "reduced to 1 wp" |
| standalone-wp | content:BESTIARY.Bat/Rat.sp.note | 79-05 | "1 wp each" |
| standalone-wp | content:BESTIARY.Viper.sp.note | 79-05 | "2 wp a round" |
| hyphen-range | content:LEAP_TABLE.0.ft … 3.ft | 79-05 | "3-4 feet", "5-8 feet", "8-12 feet", "12-15 feet" |

The hp-not-wp standing test does not walk bestiary notes or the SONGS table. That is why these wp/WP hits were not caught before.

### Twins, 2 hits (both 79-11)

- `rail:afflictionTick`: the rail prints "(−0 hp)" where the Oracle explains the hero is held at one hp (the `loss: 0` variant and the bare one).
- `rail:storeOpened`: the rail prints the Pickpocket price multipliers (×1.25, ×0.75), which the Oracle line omits.

### Safety: 0 hits.

## Pattern calibration decisions (Task 2)

Every hit was read and judged. The decisions:

1. **or-under** was tightened with a lookbehind that skips stat thresholds ("wit of 6 or under", "level 3 or lower"). `SUB_NOTE.Con Artist`'s "wit of 6 or under" compares a foe's wit, not a roll, so it is not a hit.
2. **face-to-hit** was widened to a bare unsigned count ("2 to hit", the Stink Bug note). A signed modifier ("+2 to hit", "−2 to hit") is Phase 74's display and stays excluded. This also catches the "1 to find" inside the Smoke texts, which were already hits.
3. **single-low-face** takes an optional article, which catches "hits on 5" in `content:RACES.Elven.note`. It stops before a dash, so "hit only on 18–20" never trips it, and "lands" is left out because "the die lands on a 4" is roll narration.
4. **need-face** has to be followed by to/on/if/and/or or the end of the phrase, so "you need 2 rations" and "needs level 3" are not hits. "or better", "more" and "better" are excluded.
5. **natural-low** matches only a success phrase ("need a natural 1", "natural 1 to find"). A mishap on a 1 is roll-high canon.
6. **spacing** drops the lone "?", because "? vs ?" and "HP ?" are the unknown-value marker, not a typo. The plan listed "?" among the punctuation, so this is recorded as a deliberate narrowing.
7. **Artifacts of the synthetic events**, fixed at the source rather than excepted:
   - `TYPE_FIELDS` gives bought, itemCooled, itemEffectFaded, itemEffectStarted, pilferFumbled and staffRecharged a string `item`, and rationsEaten its `eats`;
   - the Table 4 toggles are scoped (`only`) to tableFour and encounterRolled.

   This removed 22 "[object Object]" readings, 17 negative-amount readings and a false twin on rationsEaten.
8. **HYGIENE_EXCEPTIONS** (six, each with a reason):
   - itemEffectStarted "It: undefined squares." on the Oracle and the rail. This only happens in the bare variant; a real event always carries `left`.
   - braceHeld "(−[object Object])" on the Oracle and the rail, from the safety scan's soaked-object toggle. The real `soaked` is a number.
   - `raw:engine/difficulty.js#DOT_MIX_FAMILIES` "-N HP", which are dispatch-key cells that are never printed.
   - `raw:mazeworld.html#markup` "Built from the Mazeworld rulebook", which names the 1994 rulebook in the credits, not the retired working title.
9. **ROLL_PHRASING_EXCEPTIONS** is empty; every roll-under base hit is genuine.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The corpus uses its own lexer rather than tools/ident-sweep.mjs#stripJs**
- **Found during:** Task 1.
- **Issue:** stripJs does not track template literals nested inside `${}`. At `eventNarration.js#foeShattered`, `${e.by ?? "Something"}'s` closes the outer template early, the `'s` opens a phantom string, and every comment after it survives the strip. It also reads a quote inside a regex literal as a string opener. The raw sweep and the declaration scan need exact literal boundaries.
- **Fix:** `lexJs` in tools/lib/voice-corpus.mjs does the same single pass, with template nesting and regex literals tracked, and also blanks HTML comments. The module header explains why stripJs is not reused, and a lexer test pins the foeShattered shape. tools/ident-sweep.mjs is out of this plan's scope and was not edited.
- **Files modified:** tools/lib/voice-corpus.mjs.
- **Commit:** 817ba38a.

**2. [Rule 1 - Bug] CRLF working tree**
- **Found during:** Task 1.
- **Issue:** This checkout has `core.autocrlf=true`, so the files on disk are CRLF.
- **Fix:** Every source is read with CRLF normalised to LF, so the snapshot is identical on any checkout.
- **Commit:** 817ba38a.

**3. [Rule 2 - Correctness] Synthetic-event artifacts removed at the source**
- **Found during:** Task 2 calibration.
- **Issue:** The synthetic events printed readings no real event can produce ("[object Object]", negative amounts on unrelated types).
- **Fix:** `TYPE_FIELDS` and `only`-scoped toggles were added to tools/lib/event-variants.mjs, before the snapshot was taken, so the frozen list is the corrected one.
- **Commit:** 4e766ef8.

**4. [Scope note] Full suite run once, at Task 3**
- **Issue:** The plan asks for `npm test` at the end of Task 1 as well.
- **What was done:** This plan adds tooling files only, so the full suite ran once at Task 3: 7,269 of 7,269 green, which is 7,242 plus the 27 new tests. The targeted test ran at every step.

## Notes for the orchestrator (wave-1 merge)

- **79-02's ledger before-values.** The standing test validates every `docs/narrative-pass/why/*.json` against `corpus-base.json`, so each `before` must be one of the key's base texts (`node tools/voice-inventory.mjs --key <key>`).
  - Builder befores compare number-blind, so a real event's numbers still match.
  - A raw entry's texts show each `${…}` interpolation as "…". For example, `raw:engine/encounters.js#tableFour` reads "The maze, for once, gives something back. … hp.".
  - If 79-02 wrote its ledger without this tool, a row may need its `before` aligned after both merge. The test names the row.
- **79-03's merge.** content/identity.js and src/browser/identityFooter.js drop out of `absent` automatically.
  - The completeness guard fails if identityFooter.js exports any other copy-bearing value. 79-03's plan already keeps its helper tables non-copy or module-private.
  - The new files' inline literals fall to the raw sweep (owner 79-12 unless a rule places them).
- **The snapshot and 79-02/79-03 changes.** The snapshot is the phase base no matter which order the wave merges in. This plan changed no player-facing text: `git diff --quiet cd560cc -- engine content src mazeworld.html test/voice` exits 0.

## Deferred Issues

- tools/ident-sweep.mjs#stripJs mis-strips nested template literals (see deviation 1). It is used by ident-sweep's CLI and by test/unit/bridge-registry.test.js. It is out of scope here and should be fixed in a tooling quick task or by 79-12.

## Known Stubs

None. The only empty list is `ROLL_PHRASING_EXCEPTIONS`, which is empty on purpose: no roll-under base hit is a false positive.

## TDD Gate Compliance

- Task 1: RED `663c3c12` (test), then GREEN `817ba38a` (feat).
- Task 2: RED `ad72c8ea` (test), then GREEN `4e766ef8` (feat).
- Each RED run failed on the missing module before its implementation was committed.

## Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 RED | 663c3c12 | test(79-01): add failing tests for the narration corpus |
| 1 GREEN | 817ba38a | feat(79-01): the narration corpus with surface, trigger, domain and owner |
| 2 RED | ad72c8ea | test(79-01): add failing tests for the roll-under, hygiene, twin, safety and ledger checks |
| 2 GREEN | 4e766ef8 | feat(79-01): roll-under, hygiene, twin, safety and ledger checks and the voice-inventory CLI |
| 3 | b1149041 | docs(79-01): capture the phase-base corpus and write the narrative-pass method |

## Self-Check: PASSED

- All seven created files exist on disk.
- All five commits are in `git log`.
- `node --test test/unit/voice-corpus.test.js`: 27 of 27.
- `node tools/voice-inventory.mjs --self-test`: PASS.
- `npm test`: 7,269 of 7,269.
- The snapshot's `base` is cd560cc8dafe63495bd80f45816c3bf30dae7ec1.
- engine, content, src and mazeworld.html are byte-identical to the plan base.
