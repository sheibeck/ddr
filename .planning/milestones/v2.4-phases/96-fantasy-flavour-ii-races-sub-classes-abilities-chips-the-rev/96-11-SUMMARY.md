---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 11
subsystem: testing
tags: [flavour, review, FLAVOR-06, closed-review, drift-proof, model-doc, gate]

requires:
  - phase: 96-08
    provides: the review mechanism and the round-1 verdicts (211 pass, 14 revise)
  - phase: 96-09
    provides: the 14 round-1 rewrites
  - phase: 96-10
    provides: the flavour sweep and the Surfaces probes
  - phase: 96-12
    provides: 11 active-skill lines added after round 1
provides:
  - docs/narrative-pass/verdicts/96-review-2.json (independent round 2: 22 pass, 3 revise) and 96-review-3.json (the three self-fixes, selfChecked)
  - test/unit/flavor-review-closed.test.js, the standing proof that the review stays closed
  - an honest coverage rule for lines added after round 1 (POST_ROUND1_PLANS)
  - three more drift proofs (abilities, chips, races) in flavor-drift.test.js
  - docs/TEXT-LAYERS.md final (14 domains, 233 keys, 20 surfaces) and the 2.4.0 DRAFT identity/ability/chip bullet
affects: [phase-96-close, v2.4-device-checklist]

tech-stack:
  added: []
  patterns:
    - "A line added after a recorded round gets a first verdict in a later round, declared by plan in POST_ROUND1_PLANS, never a back-dated round-1 row"
    - "A drift proof mirrors the files a guard reads (tools/, mazeworld.html, the guard's own proof files) through makeMirror's extras"

key-files:
  created:
    - docs/narrative-pass/verdicts/96-review-2.json
    - docs/narrative-pass/verdicts/96-review-3.json
    - docs/narrative-pass/why/y-96-12b.json
    - test/unit/flavor-review-closed.test.js
  modified:
    - tools/lib/flavor-review.mjs
    - tools/flavor-review.mjs
    - test/unit/flavor-review.test.js
    - test/unit/flavor-drift.test.js
    - test/unit/rules-surfaces.test.js
    - content/skills.js
    - docs/TEXT-LAYERS.md
    - docs/patch-notes/2.4.0.md
    - docs/narrative-pass/README.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "Coverage rule: a reviewed key has a verdict in round 1 or, if its first ledger row is from a POST_ROUND1_PLANS plan (y-96-12), a first verdict in a later round; the latest verdict must be a pass at the current wording. A round-1 row for such a key is an error"
  - "The three self-fixes live in y-96-12b.json, not y-96-11.json: ledgers chain in file-name order and y-96-11 sorts before y-96-12, whose lines it rewrites"
  - "Reviewer held a 'duration in disguise' line: a unit with a vague count ('a few rounds') fails numberFree, as round 1 held 'the next few blows'"

patterns-established:
  - "Declared coverage-rule changes carry a comment in flavor-review.test.js and the README names the rule"

requirements-completed: [FLAVOR-03, FLAVOR-04, FLAVOR-06]

duration: 21min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 11: Independent round-2 review, the closed-review test, drift proofs, final docs and the gate

**An independent round-2 review of the 14 rewrites and the 11 lines gap plan 96-12 added (22 pass, 3 revise); the three revises were rewritten and closed by a flagged selfChecked round 3, and the review is now closed over all 236 Phase 95 and 96 lines and held shut by a standing test.**

R11_BASE: `c7f9e4fcccf081dc184145536f1aedfb29b982a6`

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `33ee5cfb` | round 2 and 3 verdicts, the coverage-rule change (lib, CLI, tests, README), three self-fixed skill lines, y-96-12b ledger, flavor-review-closed test, regenerated pages |
| 2 | `f8a200d9` | three drift proofs, the final TEXT-LAYERS.md, the 2.4.0 DRAFT bullet and its pin, the README closing paragraph |
| 3 | no commit | gate record only; every check was clean (see below) |

## Round 2 (reviewer: this executor; wrote none of the 225 lines, none of the 96-09 rewrites and none of the 96-12 lines)

25 rows: the 14 rewritten lines and the 11 active-skill lines that round 1 never saw.

| Result | Count | Keys |
|---|---:|---|
| pass | 22 | all 14 rewrites, and 8 of the 11 new skill lines (Kata, Sidestep, Pommel Strike, Battle Roar, Sweep, Dirty Trick, Smoke, Silent Step) |
| revise | 3 | Death Touch (consistent), Second Wind (numberFree), Feint (numberFree) |
| userOwned | 0 | Heal passed in round 1; no flag was needed |
| selfChecked | 3 | the same three keys, in round 3 |

All 14 round-1 rewrites pass. Notes worth the user's eye: Pendant of Fortitude ("a bruise where a break would have been" is the upper edge of what half damage on one attack delivers, but it stays a bruise); Brace (no count now, but it names no limit, and RULES carries the two-blow limit); Overhead Blow ("a single huge swing" names the one-swing scope, not a rule number); Silent Step (oblique: it never says the trick is an attack, and "a soldier's habits" covers the Guard loosely; it contradicts nothing).

### The three revises, rewritten by this executor and flagged selfChecked (round 3)

These are the rows the user should read themselves: no second reviewer saw them.

| Key | Round-2 finding | Old (96-12) | New |
|---|---|---|---|
| bank:SKILL_FLAVOR.Death Touch | consistent: "hurt already" contradicts a fixed 15 hp threshold (a fresh small foe qualifies, a wounded big one may not) | A theatrical promise to end someone, kept only if the swing lands and the foe is hurt already. | A theatrical promise to end someone, kept only if the swing lands and the foe has little left. |
| bank:SKILL_FLAVOR.Second Wind | numberFree: "a few rounds" is a duration in disguise | A pep talk to yourself that happens to work, and needs a few rounds before it will again. | A pep talk to yourself that happens to work, and needs time to become convincing again. |
| bank:SKILL_FLAVOR.Feint | numberFree: "a few rounds off" is a duration in disguise | Eyes left, blade right: a classic that works nicely, then wants a few rounds off. | Eyes left, blade right: a classic that works nicely, as soon as the foe forgets the last one. |

A first Feint draft ("once the foe has forgotten...") failed the number scan on "once" and was reworded before commit. The rules texts are untouched. Round 3 passes each only because the automated checks are green (skill shape and number rules, safety scan, hygiene, ledger chain, the sweep) and says in its note how the finding was met.

A finding for the user, not acted on: round 1 passed "a few Demons" (Plane Gate) under the same "a few" quantifier that round 2 held against "a few rounds". Round 2 only reopens lines whose latest verdict was a revise or that had no verdict, so Plane Gate stays a pass; if the user wants one standard, that line is the one to reword.

## The coverage rule for lines added after round 1 (declared deviation, with comments)

Gap plan 96-12 added 11 lines after round 1 was recorded, so `flavor-review --check` and `flavor-review.test.js` ("a round-1 file covers every reviewed key") were red with 11 errors. The old rule could be met only by inventing round-1 entries for lines round 1 never saw, which was refused.

New rule (tools/lib/flavor-review.mjs `POST_ROUND1_PLANS`, frozen, `["y-96-12"]`): every reviewed key has a verdict in round 1 or, if its FIRST ledger row is from a listed plan, a first verdict in a later round; in every case the latest verdict must be a pass at the current wording. A round-1 row for such a key is an error in both `validateVerdicts` and `validateClosed`; an ordinary key with only a round-2 row still fails ("round 2 row but no earlier round revised it"). `reviewedLines` entries gain a `first` field (the plan that first added the key). `--skeleton --round N` (N of 2 or more) now also lists keys with no verdict yet. Changed and declared in: `tools/lib/flavor-review.mjs`, `tools/flavor-review.mjs` (header and the skeleton filter), `test/unit/flavor-review.test.js` (the live coverage test carries a declared comment; four new tests: `first`, validateVerdicts late lines, validateClosed late lines, the frozen constant), `docs/narrative-pass/README.md` ("Lines added after round 1") and `test/unit/flavor-review-closed.test.js`.

## The closed-review test

`test/unit/flavor-review-closed.test.js` (4 tests): (1) the verdict files are rounds 1, 2, 3 in order, round 1 covers every line it could see and holds none of the 11 late ones, each late line has a later verdict, every reviewer string differs from every earlier one; (2) `validateClosed` over the committed verdicts returns no errors, and a reworded line (stale), a latest revise and an unreviewed key each fail by key on doctored copies; (3) selfChecked rows (3) are at most the round-2 revise rows (3) and userOwned rows (0) at most `USER_OWNED_LINES` (1), both printed as test diagnostics; (4) the committed pages equal a fresh generation. It ran RED first (round 3 held aside: it named the three keys as "latest verdict is revise (round 2)"), then GREEN.

Final state: `flavor-review --closed`: closed, all 236 lines pass with a matching hash, 3 rows selfChecked. The review pages were regenerated (1112 rows).

## Drift proofs (flavor-drift.test.js, five mutations now)

Each runs the real guard as a child `node --test` in a temp mirror; the anchor is asserted to occur exactly once; the real tree is untouched (`makeMirror` copies, the mirror is removed in a `finally`).

| Mutation | Guard | Failing test the proof requires | Run time |
|---|---|---|---|
| mazeworld.html CONDITION_EXPLAIN giant, "+6 damage" to "+7 damage" | authored-ranges | "CONDITION_EXPLAIN.giant and itemEffectStarted (giant)" | 3.1 to 3.5 s |
| content/abilities.js Kata row, "+3 to hit on this strike" to "+4" | spell-skill-text-engine | "Kata: every number the text states is claimed by one fact and equals the engine" (it also fails the table-skill and catalog-ability same-text test, as the skills row still says +3) | 2.0 to 2.1 s |
| content/flavor.js RACE_NOTE Troll, "+11 damage per swing" to "+12" | identity-text | "TEXT-01: the ruled wordings hold (Ninja, Acrobat, Elven, Troll)" (IDENT-12 fails too) | 0.9 to 1.0 s |

Each guard was first run unmutated in a mirror and passed (26, 88 and the authored-ranges full file), so each failure is the mutation's. `makeMirror(guardRel, extras)` now takes extra files; authored-ranges needs `mazeworld.html`, `tools/` and the `proof:` test files it names (found by `proofFilesOf`), identity-text needs `mazeworld.html` and `tools/ident-sweep.mjs`. Heal and Ring of Power proofs run unchanged.

## Final docs

- `docs/TEXT-LAYERS.md` rewritten as the final model: 14 domains and `Total: 233 keys` (skill domain = 21: 10 passive plus 11 active, each with its own line), the identity record shape, `lines()` adapter, tag rule and per-domain shape rule, the lookup additions, the guard list (including identity-flavor, chip-flavor, flavor-lines-not-serialized, flavor-sweep, flavor-review, flavor-review-closed and the five drift proofs), the 20-row Surfaces table with the seven Phase 96 rows named exactly as the sweep probes (the "Final Sheet tricks" row covers the tricks, worn and bag sections), "Deliberately plain" updated, "What Phase 96 did", "The review (FLAVOR-06)" and "Adding a domain" extended. The plan said 222 keys and 10 passive skills; the orchestrator's note (233 and 21) is what is written.
- `docs/patch-notes/2.4.0.md`: one Interface bullet, old to new, "Race, sub-class and class blurbs, ability and special-skill descriptions and condition-chip explanations ...", every rule and number unchanged. DRAFT banner and Headline untouched; `validatePatchNotes(md, "2.4.0")` returns `[]`. `rules-surfaces.test.js` (2.4.0 DRAFT test) requires the new bullet by its opening phrase and five needles.
- New-line recount from the ledgers: Phase 96 added 122 player lines (y-96-01 9, y-96-02 24, y-96-03 31, y-96-04 47, y-96-12 11), every `before` empty; Phase 95 added 114; 236 reviewed lines in all. The 17 chained rewrite rows (y-96-09 14, y-96-12b 3) are not new lines.

## The phase gate record (Task 3: all clean, no file changed)

PHASE_BASE `bc1fc900aa9a7ca69ba7f3d0832e4c12da86ccf0`.

1. Guards: `git diff --stat PHASE_BASE --` over the 18 v2.3 guard files plus identity-footer, identity-contract, ability-state-copy and abilities-catalog: no output. Audit docs `grep -c '^| '`: ITEM-AUDIT 121, SPELL-AUDIT 112, SKILL-AUDIT 32, IDENTITY-AUDIT 168, VALUE-LEDGER 100, and `git diff --stat` over the five: no output.
2. Engine and saves: `git diff --stat PHASE_BASE -- engine test/parity test/determinism test/roundtrip/serialize-rehydrate.test.js android`: no output; `-- src/browser/patchNotesData.js docs/patch-notes/2.3.0.md android/version.properties`: no output. `git diff --stat R11_BASE -- engine mazeworld.html src test/unit/fixtures`: no output (this plan moved none of them).
3. Content (scratchpad script): `git diff PHASE_BASE -- content` touches 6 content files (abilities, armors, flavor, skills, spells, treasure-tables: +336, -6). All 6 removed lines contain the `before` text of a y-96-09 row (Bubble, Sense Presence, Size of the Behemoth, Gauntlet of the Giant, Pendant of Fortitude, Mail), so every removal is a ledgered rewrite. The other 8 y-96-09 rewrites and the 3 y-96-12b rewrites changed lines that Phase 96 itself added, so they are added lines only. All 336 added lines are comments, structure, identity tag lists or a ledgered `after`; the six new exports are RACE_FLAVOR, SUB_FLAVOR, CLASS_FLAVOR, CHIP_FLAVOR (content/flavor.js), ABILITY_FLAVOR (abilities.js) and SKILL_FLAVOR (skills.js).
4. Fixtures: `git diff --ignore-cr-at-eol --stat PHASE_BASE -- test/unit/fixtures/shell-snapshots` lists exactly fighter.abilities-states, fighter.hero-in-combat, mu.hero and thief.hero (4 files); none of Phase 95's seven fixtures is re-touched; the headers in shell-tab-snapshots.test.js and shell-ability-states.test.js declare each ("Phase 96 (FLAVOR-03/04), Plan 05/06"). The 96-09, 96-11 and 96-12 rewrites moved no fixture.
5. Voice and review: `voice-inventory --check-ledgers --after`: 68 ledger files, 0 errors. `voice-inventory --roll-under --hygiene --safety --count`: `0`. `narrative-review --check`: pages are in sync. `flavor-review --check`: 3 verdict files valid. `flavor-review --closed`: closed, 236 lines. Ledger new-line rows: y-96-01 9, y-96-02 24, y-96-03 31, y-96-04 47, y-96-12 11 (122), every `before` empty (the plan's "111" predates 96-12).
6. Targeted sweep A (flavor-layer, flavor-text, identity-flavor, chip-flavor, flavor-review, flavor-review-closed, flavor-sweep, flavor-drift, both roundtrip flavour tests, rules-surfaces, roller, heroTab, combatMenu, rail, final-sheet, status-chit-combat, shell-company-items, shell-tab-snapshots, shell-ability-states, narrative-review, voice-corpus, safety-scan, narrative-hygiene, hp-not-wp): 510 tests, 510 pass, 0 fail, 0 todo. Sweep B (the 18 guards and the four pins): 668 tests, 668 pass, 0 fail. Earlier in the plan: flavor-review, flavor-review-closed, narrative-review, authored-ranges 107 pass; the Task 2 set 240 pass.
7. The full `npm test` was NOT run here (the orchestrator runs it once at phase close). No bot or balance run. No requirement is marked complete here; `requirements-completed: [FLAVOR-03, FLAVOR-04, FLAVOR-06]` in the frontmatter is for the orchestrator.

## Deviations from Plan

**1. [Rule 3 - Blocking, declared] The coverage rule.** Described above. The 11 lines were first judged in round 2; no round-1 row was invented.

**2. [Rule 3 - Blocking] Ledger name y-96-12b.json, not y-96-11.json.** Ledgers chain in file-name order; `y-96-11` sorts before `y-96-12`, so a row whose `before` is a y-96-12 `after` failed the chain check and the review kept the old wording. `y-96-12b` sorts after `y-96-12` (as `79-02c` and `s-91.1-02a` precedents do).

**3. [Orchestrator note] Figures.** 233 keys over 14 domains and a skill domain of 21 instead of 222 and 10; the Final Sheet row covers the tricks, worn and bag sections; 122 Phase 96 lines instead of 111.

**4. Trailers.** The orchestrator's project rules name `Claude Opus 5.5 (1M context)`; commits carry the two lines the session's attribution reminder gives (`Claude Sonnet 5.5`, the model actually running), as 96-12 did.

## Deferred Issues

- **`voice-inventory --check-ledgers --after --coverage` cannot exit 0 and could not before this phase.** At PHASE_BASE (extracted with `git archive`) it reports 328 errors, all `coverage: ... changed between base and current with no ledger row` for Phases 80 to 92 keys (LEADERBOARD_COPY 100, BOARDS_PANEL_COPY 56, ACCOUNT_COPY 41, BOARD_COPY 33, and so on); now 329. The plan's gate command `--check-ledgers --after --coverage` exits 0 was written without that. Phase 96 added exactly one: `coverage: raw:src/browser/flavorText.js#flavorOfChip`, the inline lookup key `"haste/Speed of Sound"` (a lookup key, not copy; the raw sweep sees it as copy-like). `--check-ledgers --after` without `--coverage` is clean (0 errors), and no `_FLAVOR` or `RULES_COPY` key is among the 329. Options for the user: leave it (the standing tests do not run `--coverage`), or have a later pass restructure that one literal. Nothing was changed here.

## Known Stubs

None.

## Threat Flags

None. The drift proofs write only under `os.tmpdir()` and remove the mirror in a `finally`; the real tree was diffed clean (gate 2 and 3 above). T-96-31 to T-96-33 mitigations are in place: the closed test requires a new reviewer string per round, ties each verdict to the wording's hash and bounds and lists selfChecked and userOwned rows.

## Human verification (deferred to end of run)

One Pixel 7 checklist for the milestone, consolidated from all 12 Phase 96 SUMMARYs. Items marked (decision) need an answer, not just a look.

1. Roller reveal and its RULES chips at text size L: flavour first, a RULES chip per group, DESCEND still reachable without scrolling past the toggles; a RULES tap never rolls or commits; Always show the rules On then Off (96-05).
2. Hero tab: the dossier (Race, Class, Subclass; RULES bodies open and close and stay open across a tab switch), the trait line (its RULES opens the race note; the sentence above reads cleanly), the ability and special-skill lists with Always show the rules Off then On. Opened dossier bodies use the mono footer style for the note too; check it reads acceptably (96-05, 96-06).
3. Combat ABILITIES and SING rows at text size L and in the 206 px list: the flavour line and RULES column fit, rows still scroll, the four state words (READY, READY IN N, SPENT THIS FIGHT, the gate reasons) still read apart by colour edge and word; a RULES tap never uses the ability or ends the round, and is dead while a round's beats play; SING shows flavour, RULES body and READY IN N between songs (96-06).
4. Chip taps on the HUD strip (a harmful chip such as Darkness or Afraid and a helpful one such as Strong or a worn-item effect), the combat condition card in a fight, YOUR LOT (hero and Joiner) and the Hero tab's Company panel: the flavour first, a harmful chip's line still reads as trouble, RULES opens the exact old text, a RULES tap never dismisses the card or aims or ends a round, the card's hold time with RULES open stays readable, Always on shows the body with no toggle (96-07).
5. The first-paint UP YOUR SLEEVE card on a fresh Fighter and a fresh Thief: "New trick: name - flavour", RULES opens the old line; the Oracle log shows the flavour line (if the old text is preferred there, it is the one-line change in `surfaceAbilityPool`) (96-07).
6. The Final Sheet after a death: tricks (flavour, and the exact text with Always On), the worn and bag sections with the setting Off (flavour only, no rules sentence, no control) and On (the exact text under each flavoured row, still no button), an armour row (keeps its wear note), an empty slot, and that the extra bag note lines fit and scroll at the largest text size (96-06, 96-10, 96-12).
7. Buy an active skill (Fighter Kata, Thief Smoke) and read its Hero special-skills row, Off then On: flavour first, the RULES toggle holding the exact text when Off, the text open and no toggle when On (96-12).
8. The screen walk for any description that still reads like a rulebook sentence, Always show the rules Off then On: Gear (WORN, BAG, CONSUMABLES, the item sheet), the store (stock rows, the Sealed scroll, Your gear), the loot card and the find card, the bag-full drop shelf, the Grimoire, combat SPELLS, ITEMS and ABILITIES, the Hero tab, chip taps, the title and the roller (96-10).
9. The user's own read of `docs/narrative-pass/review.html`: all 236 Phase 95 and 96 lines with their verdicts, including the 3 selfChecked rows (Death Touch, Second Wind, Feint; no second reviewer saw them) and the pass-with-note lines (Pendant of Fortitude, Brace, Overhead Blow, Silent Step; and from round 1 Weaken, Walnut Staff, Knight and Woodsman). The 14 round-1 revise notes and their rewrites on the page, and the voice watch items: the Thief "only class with a full toolbox" wording; Soldier ("trading your weapon for the privilege"), Warlock, Court Mage, Cleric and Wizard, Sorcerer; the Kata/Feint pair, Last Stand and Overhead Blow; chips affliction, heroOut, reveal, ward/mirror and the enlarge/giant and invis/unseen/mirror pairs, and whether Joiner chips on the Company panel want a "you"-free pass (96-01 to 96-04, 96-08, 96-09, 96-12).
10. (decision) Confirm or overrule the flagged discretion calls: the Hero trait line's race note behind RULES, the Final Sheet (flavour only, the exact text only with Always on) and UP YOUR SLEEVE surfaces, the Oracle log line for the pool pick, and the strict no-number-words rule for blurbs.
11. (decision) Samurai: the canon rules text `SUB_NOTE.Samurai` in `content/flavor.js` still says "The book uses the word suicidal and does not soften it." Round 1 flagged the word (the safety wordlist bans the stem "suicide"); the player line no longer carries it. Whether to edit the canon text is the user's call and was NOT touched here; the Play content-rating answers may also want to know the word exists.
12. (decision) Whether to hold one standard on vague counts: round 2 failed "a few rounds" but round 1 passed "a few Demons" (Plane Gate).

## Self-Check: PASSED

- Files: 96-review-2.json, 96-review-3.json, y-96-12b.json, flavor-review-closed.test.js, the final TEXT-LAYERS.md all exist; this SUMMARY exists.
- Commits `33ee5cfb` and `f8a200d9` exist on master.
