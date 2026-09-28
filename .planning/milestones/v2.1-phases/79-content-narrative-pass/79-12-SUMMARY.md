---
phase: 79-content-narrative-pass
plan: 12
subsystem: narrative-guards
status: complete
tags: [roll-04, vox-05, vox-04, voice-guards, narrative-pass, closure]
requires:
  - "79-01..79-11, 79-02b, 79-02c (merged at dispatch base 1968d3e8)"
provides:
  - "test/unit/roll-phrasing.test.js: the doc-synced ROLL-04 guard over the live corpus"
  - "docs/ROLL-LEDGER.md: ## Phase 79 roll phrasing closure (ROLL-04), append-only"
  - "test/voice/narrative-hygiene.test.js: corpus-wide hygiene and twin guard"
  - "corpus-wide tests in test/voice/safety-scan.test.js and test/unit/hp-not-wp.test.js"
  - "authored-ranges and roll-sign-consistency pins outside content; a roll-under stale-terms term"
  - "the house spelling (British: armour) as a hygiene rule; docs/narrative-pass/why/79-12.json"
affects: [79-13, 79.1]
tech-stack:
  added: []
  patterns:
    - "doc-synced guard: parse a ledger section (CRLF normalised) and compare with the code's tables"
    - "coverage registry: every corpus string stating a range is pinned here or in a named test"
key-files:
  created:
    - test/unit/roll-phrasing.test.js
    - test/voice/narrative-hygiene.test.js
    - docs/narrative-pass/why/79-12.json
  modified:
    - docs/ROLL-LEDGER.md
    - tools/lib/voice-checks.mjs
    - tools/lib/voice-corpus.mjs
    - tools/lib/event-variants.mjs
    - tools/stale-terms.mjs
    - tools/ident-sweep.mjs
    - test/unit/authored-ranges.test.js
    - test/unit/roll-sign-consistency.test.js
    - test/unit/stale-terms.test.js
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
    - src/browser/rollRange.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/gearTab.js
    - src/browser/gearSheet.js
    - src/browser/heroTab.js
    - src/browser/identityFooter.js
    - mazeworld.html
    - content/flavor.js
    - content/identity.js
    - content/races.js
    - content/spells.js
    - content/epitaphs.js
    - test/parity/FIXTURE-INVENTORY.md
decisions:
  - "House spelling is British: armour (corpus count 64 in 39 keys against armor's 31 in 22), and the -our family with it; item names (Cloak of Armor, Magic Armor) and code identifiers keep theirs"
  - "The Anklet's foe-swing modifier reads 'unseen' (MOD_LABEL.gear), guarded by a test that the Anklet is the only foeToHit item"
  - "The teleport, poison and won epitaph buckets and the teleport and poison causes are deleted (unreachable); a reverse death-copy guard pins it"
  - "The hidden rulebook-notes section in mazeworld.html is deleted (never shown, badly stale, held a roll-under line)"
  - "INSANITY stays as engine data (goInsane still stamps it) but leaves the player corpus; retiring it is an engine change"
  - "The Bat/Rat and Viper wp notes stay prototype-identical (D-14); the guards read them as playerNote renders them, with reasoned hygiene exceptions"
metrics:
  duration: "about 3 hours"
  completed: 2026-09-27
  tasks: 2
  files: 50
---

# Phase 79 Plan 12: The ROLL-04 closure and the corpus-wide voice guards Summary

A doc-synced test now fails the day any player-facing string reads roll-under again, every voice guard (safety, HP-not-WP, hygiene, twins, stale terms, the sign guard) runs over the whole narration corpus, every authored face count or fixed-die range is pinned to the engine, and every item the rewrite plans handed on is closed or recorded with its reason.

**Plan base SHA:** `1968d3e8e86233eda13541884dcc3d3bc998d065` (the dispatch base).

## Gates

- `npm test`: **7,468 of 7,468** (the base was 7,429; +39 new tests).
- `node tools/voice-inventory.mjs --roll-under --hygiene --twins --safety --count`: **0**.
- `node tools/voice-inventory.mjs --check-ledgers --after`: **0 errors across all 12 ledgers** (the 29 errors on 79-03's footer rows are reconciled). `--check-ledgers --plan 79-12 --after`: 0.
- `--check-ledgers --coverage`: 82 errors, down from about 113 at the base. None are new: the rest are 79-03's IDENTITY_TRAITS and identityFooter.js literals, 79-02's gain builders and `PARTY_WIDE_ITEM_EFFECTS`, all for 79-13.
- `git diff --quiet 1968d3e8 -- engine test/parity/fixtures test/parity/prototype-master.js.txt` exits 0. The prototype hash is unchanged (`a1f4d0dc…`). Parity 66/66 inside `npm test`.
- `node tools/stale-terms.mjs`: zero unlisted, zero rot.
- **boot:check was skipped.** The worktree has no node_modules, and the sandbox refused the junction to the main checkout's node_modules. `build:www` stopped at "@capacitor/core is not installed". I removed the partial `www/` it left (ignored, never committed). The orchestrator needs to run `npm run build:www && npm run boot:check` at merge.
- No bot balance run (user ruling 2026-09-26).

## The ROLL-04 guard (Task 1)

`test/unit/roll-phrasing.test.js` (8 tests) reads `docs/ROLL-LEDGER.md`'s new `## Phase 79 roll phrasing closure (ROLL-04)` section, with CRLF normalised. It fails on any of these:
- a corpus hit outside the exceptions;
- a doc pattern id or exception that differs from `tools/lib/voice-checks.mjs`;
- a doc example that does not trip its own pattern;
- a pattern without teeth both ways (every dash variant, number word and case);
- a rotted exception;
- a surface below its floor;
- a Closure list row that drops a handoff or its closing plan.

The ledger section was appended by a node script. The diff has **zero deletion lines**.

### Final pattern table

| Id | Catches | Doc example |
|---|---|---|
| need-face | a need phrase with a face count | "foes need a 1 to hit" |
| natural-low | a natural-low success phrase | "foes need a natural 1 to find you" |
| low-range | a low range tied to a roll | "1–5 on d10 against any lock" |
| or-under | N or under/less/lower/below (stat thresholds excluded) | "hits on a 5 or under" |
| face-to-hit | a bare face count to hit | "a 5 to hit" |
| single-low-face | a single low face that hits or crits | "hittable only on a 4" |
| penalty-to-hit | a penalty written on to-hit | "−3 on to-hit" |
| need-better | need(s) N better | "every foe needs two better" |

### Final exception tables

- **ROLL_PHRASING_EXCEPTIONS: empty, on purpose.** Every base hit was a genuine roll-under phrase and was rewritten.
- **HYGIENE_EXCEPTIONS (3):**
  - `content:BESTIARY.Bat/Rat.sp.note` and `content:BESTIARY.Viper.sp.note` (standalone-wp). Phase 18's D-14 holds these notes prototype-identical. Every surface renders them through `combatPanel.js#playerNote`, and a test proves that rendering is clean.
  - `raw:engine/difficulty.js#DOT_MIX_FAMILIES` (ascii-sign). A dispatch key, never printed.
- **Pruned as rot:**
  - itemEffectStarted and braceHeld, Oracle and rail (4 entries): the builders now have fallbacks;
  - the markup "Mazeworld rulebook" entry: its section is deleted.

### Range and sign pins

- **authored-ranges.test.js, section 8 (+14 tests, 45 in total).** These pin the narration, chip, menu and panel ranges to the engine:
  - CONDITION_EXPLAIN (invis, mirror, unseen, acute, giant, enlarge, heroBlind, tongue);
  - itemEffectStarted's invis, unseen, acute, giant and enlarge lines;
  - battleRoarRaised, sidestepped, blinded, fumbleOnFoe (mirror) and struck (the Ninja crit);
  - FOE_CONDITION_DESC.blind, COMBAT_MENU_COPY.parleyDesc and GEAR_COPY.healingDesc (7–25).
- **A coverage guard in authored-ranges.** Every non-content corpus key that states a face count or a fixed-die range is either pinned there or named with the test file that pins it: identity-footer for the blurbs, mapMarks for the legend, death-copy for the trap epitaph, roll-sign-consistency for Smoke, Mirror Self and Weaken. There is no rot.
- **roll-sign-consistency.test.js (+5 tests, 22 in total).** For Smoke, Mirror Self, Weaken and the Anklet, the faces the text states match the foe card's measured odds line, and the chip moves the same count. A fifth test proves the Anklet is the only content item with a `foeToHit` effect, which keeps the "unseen" label true.
- **stale-terms.** A new enforced term, `roll-under`, covers the retired phrase families. Test titles and messages were brought up to date: 6 rollDirection titles, the conditionEffects title, two joiner-defences messages and one content comment. Survivors:
  - class A: the pattern fixtures and the synthetic corpus row;
  - class B: the parity carve-out and three engine comments (engine/ is frozen for this plan);
  - class D: hand-built test item literals.
  A teeth test was added.

## The voice guards (Task 2)

- **safety-scan:** a corpus-wide test. Every corpus string is scanned, and templates are filled with the closed vocabularies. 0 hits, and every existing test is unchanged.
- **hp-not-wp:** a corpus-wide test. It checks that the corpus module's PLAYER_WP is the same as this file's. Bestiary notes are scanned as playerNote renders them, and a load-bearing check proves that rendering is needed.
- **narrative-hygiene.test.js (6 tests):**
  - zero hygiene hits and zero twin disagreements over the whole corpus;
  - no rotted exception;
  - the rule set covers VOX-05's encoding list;
  - the bestiary exceptions hold only because playerNote renders them clean.
- **The house-spelling rule** (`house-spelling`, 8th HYGIENE_RULE). The voice-corpus rule-list pin is updated on purpose.

## The house spelling (armor vs armour)

- **Count** (live corpus, dispatch base): "armour" 64 occurrences in 39 keys, "armor" 31 in 22. The rest of the -our family was already British: honour 2 / honor 1, rumour 3 / rumor 1, favour 2, colour 1, centre 1, grey 3, no other US form. `.claude/CLAUDE.md` sets no precedent either way.
- **Decision: British, "armour".** Every player-facing "armor" changed:
  - the Oracle lines (armorSoaked, armorDestroyed, foeArmorSoaked, backstabDenied, foeBolted, itemUnequipped);
  - the slot word, through `slotWord`;
  - the Gear tab labels (ARMOUR RATING, ARMOUR) and the empty-slot line;
  - the gear sheet;
  - the Hero tab stat label and the hero sheet's `<dt>Armour</dt>`;
  - the race notes, the identity traits and the footer field lines.
- The two US stragglers in the same lines were fixed too: "honor" and "rumor".
- **Kept:** the item names "Cloak of Armor" and "Magic Armor" (proper nouns and ids that reach state) and every code identifier.
- The decision and count are recorded in `docs/narrative-pass/README.md` (Standing rulings) and in the `house-spelling` rule's comment.

## Every handed-on item and how it closed

| Source | Item | Outcome | Commit |
|---|---|---|---|
| ORCH (ROLL-LEDGER) | Stale "(now 19–20)" wording in (b) | **Fixed** by an append-only correction in the closure section, with the measured "(19–20 instead of 16–20)" form | 6691522d |
| ORCH / 77-07 | Acuteness has no signed modifier | **Not a failure.** It swaps the die. Every roll line prints the die and range, and the chip states it (recorded in ROLL-LEDGER) | 6691522d |
| ORCH / 77-07 | The Anklet's foe-swing modifier reads "gear" | **Fixed.** `MOD_LABEL.gear` now reads "unseen", guarded by the only-foeToHit-item test; ledger row bank:MOD_LABEL.gear | 6691522d |
| ORCH / 77-08 | heroOut's "Can't act" label | **Not a failure.** It states what happened to whom; its style exemption stands (recorded in ROLL-LEDGER) | — |
| ORCH | Rerun `--owner 79-03` with the real tool | **Done.** `--owner 79-03 --roll-under --hygiene --safety --count` prints 0 | — |
| ORCH / 79-01 | `ident-sweep.mjs#stripJs` mis-strips nested templates | **Fixed.** A template is now copied whole with `${…}` nesting tracked (the module contract is kept), and `--self-test` gained the foeShattered case. The full suite, including the reduced-motion hash pins, is unchanged | f5cb522b |
| ORCH (a) | The capped store meal variant | **Fixed.** `{ only: ["bought"], gained: 3, meal: 8 }` was appended | f5cb522b |
| ORCH (b) | 29 `--after` errors on 79-03's IDENTITY_FOOTER rows | **Fixed.** `validateLedgers` accepts a multi-line key recorded as its lines joined by a space (exactly that; tested). All ledgers now report 0 | f5cb522b |
| ORCH / 79-06 | CAUSE_TEXT.maze is vague | **Not a failure.** It passes the rubric, the maze epitaphs name the table, and `DOT_CAUSES` stays in step untouched | — |
| ORCH / 79-06 | Dead poison, teleport and won buckets | **Fixed (greenfield).** The buckets and the two causes are deleted, and death-copy gained a reverse guard (every bucket is a die() cause). TAG_CAUSES keeps its codec slots; ledger rows have `after: ""` | dd51d92d |
| ORCH / 79-04, 79-09, 79-10 | armor vs armour (Oracle, panels, the Hero sheet `<dt>`) | **Fixed.** British, by count; see above | dd51d92d |
| ORCH / 79-08, 79-11 | UAT-v1.5, UAT-v1.7 and USABLE-FEATURES-AUDIT quote old lines | **Not a failure.** They are dated history records, not live copy | — |
| ORCH / 79-05, 79-08 | docs/ABILITIES.md and docs/SPELLS.md quote old catalog lines | **Not a failure** (design records, never rewritten wholesale). A status note now points at the live content and the guard | dd51d92d |
| ORCH / 79-07 | Sense Danger claims to name the next encounter | **Fixed.** The text now reads "…you act first, whatever turns up (the family it hints at is a hunch, not a promise)" | dd51d92d |
| ORCH / 79-07 | shell-spells-40.test.js:226 stale foresight sentence | **Fixed.** It now lists the live sentence | dd51d92d |
| ORCH / 79-07 | GEAR_COPY.healingDesc | **Closed by 79-09.** It is now also pinned to drinkPotion by authored-ranges | 6691522d |
| ORCH / 79-09 | EQUIP_REJECT_TEXT.tooHeavy | **Closed by 79-11** | — |
| ORCH / 79-09 | The store's "Healing" potion (+d10+2) against the Gear tab's HEALING POTION (7–25) | **Not a failure.** Each line is accurate for its own item. The similar names are a naming question for the user at the milestone review | — |
| ORCH / 79-10 | The hidden "departs from the rulebook" section | **Fixed (deleted).** It was never shown, badly stale and held the "dodged on 1–5" line; its CSS went too. 55 ledger rows with `after: ""` | 6691522d |
| ORCH / 79-10 | RAIL_COPY.quit | **Closed by 79-11** | — |
| ORCH / 79-11 | The INSANITY table | **Kept as engine data, out of the player corpus.** Since 79-11 nothing prints it. `engine/encounters.js#goInsane` still stamps it as `insanityRolled.result`, so retiring it is an engine change (open item below). It moved to NON_COPY_EXPORTS with that reason, with 6 ledger rows `after: ""`; the safety scan still reads it | f5cb522b |
| ORCH / 79-11 | darknessFell's duration and Night Vision clauses were invisible to the corpus | **Fixed.** Two `darknessFell` variants were appended; rows for oracle:darknessFell and rail:darknessFell | f5cb522b |
| ORCH / 79-11 | PARTY_WIDE_ITEM_EFFECTS coverage | **79-13's**, as addressed (a lookup key, not copy) | — |
| 79-02 | The encounterRolled row's before needs a Table 4 variant | **Not a failure.** The row validates (the standing test and `--check-ledgers` pass) | — |
| 79-02c | The floorRegen block in the voice sample; HERO_REGEN in fit files | **79-13's and 79.1's**, as addressed | — |
| 79-03 | MU_CHART bonuses on the protection, healing, divination and special schools are inert | **Escalated** (a rules question, open item below) | — |
| 79-03 | Elven and Dwarven prices, the Wilmsry haggle; the closed todo | Information only; no action | — |
| 79-03 | The Pilfer SUB_NOTE omits staves | **Fixed** (rubric 4): "a magic ring, amulet, cloak or staff", pinned to PILFER_FUMBLE_KINDS | dd51d92d |
| 79-03 | The Bard's "dragons hand over gifts" | **Fixed** (rubric 4). No engine rule does this; the Bard's real edge is that every Human parleys. Now "every Human in here will at least hear you out before swinging", pinned to canParley | dd51d92d |
| 79-03 | The Woodsman's "except dragons" and "no shield" | **Fixed** (rubric 4) for "except dragons": the Drake is a Beast and a Woodsman parleys it. Now "…every beast in here, the Drake included; whether it listens is the Drake's business". "No shield" is true, since the game has no shields, and stays | dd51d92d |
| 79-03 | The Thief's "leather at the very best" | **Fixed** (rubric 4). Studded is Fighter-and-Thief armour and Mail comes with Heft. Now "studded leather at the very best (mail, if you learn Heft)" | dd51d92d |
| 79-03 | The ROADMAP criterion 1 Summoner wording | The orchestrator's (a ROADMAP edit); not touched here | — |
| 79-04 | The smoke, battleRoar and sidestep catalog text | **Closed by 79-05** | — |
| 79-04 | The foeWard and foeBubble "It's" possessive | **Closed by 79-08** ("Its ward…", "Viper's ward…") | — |
| 79-05 | The Bat/Rat and Viper "wp" notes | **Not a player-facing failure.** The notes stay prototype-identical (D-14), and every surface prints them through playerNote as HP. They are excepted with that proof, and the hp-not-wp corpus test scans the rendering | f5cb522b |
| 79-05 | The Crystal Staff's "party invisible" | **Not a failure.** 79-02b kept the staff party-wide (PARTY_WIDE_ITEM_EFFECTS), so "party" is accurate | — |
| 79-06 | TAG_CAUSES | No action (append-only share-tag codes) | — |
| 79-07 | The combat screen static markup | **Closed by 79-10** | — |
| 79-08, 79-11 | The voice sample quotes old lines | **79-13's**, as addressed | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan staleness] "changes no engine file / fixtures byte-identical to the phase base"**
- The phase already changed engine files (79-02, 79-02b, 79-02c, 79-08, 79-09). Following the orchestrator, these must-haves were read against the dispatch base 1968d3e8: no engine file changed, and fixtures and the prototype are byte-identical to it.

**2. [Rule 1 - Bug] A test pinned 79-03's ledger `after` against later plans' changes**
- **Found during:** Task 2.
- **Issue:** identity-footer.test.js required every 79-03 row's `after` to equal the current text, which breaks as soon as any later plan changes a key 79-03 touched. `validateLedgers` checks only the last plan to touch a key.
- **Fix:** The test now skips keys a later ledger touches.
- **Commit:** dd51d92d

**3. [Scope, recorded] The house-spelling rule covers the -our family, not only armour**
- **Found during:** Task 2.
- Two US stragglers sat in lines already being changed ("honor", "rumor"). The counts show the corpus is British throughout, so the rule holds the whole family. Only those two strings moved beyond "armor".

**4. [Rule 2] Extra accuracy pins**
- identity-footer.test.js gained a test binding the four rewritten blurbs to the engine rules they state.
- death-copy.test.js gained the reverse reachability guard.

### Files touched outside the plan's list (named per the plan)

- **Content:** content/flavor.js, identity.js, races.js, spells.js, epitaphs.js; content/treasure-tables.js (one comment).
- **Shell:** src/browser/gearTab.js, gearSheet.js, heroTab.js, identityFooter.js, rollRange.js.
- **Tooling:** tools/lib/event-variants.mjs, voice-corpus.mjs; tools/ident-sweep.mjs.
- **Docs:** docs/narrative-pass/README.md, docs/ABILITIES.md, docs/SPELLS.md, test/parity/FIXTURE-INVENTORY.md.
- **Re-pinned tests:** rollDirection, conditionEffects, joiner-defences, clarity-cause-lines, gear-panels, gear-view-models, gear-sheet-model, destroyed-armor-swap, narrationLinesTable, size-voice, shell-spells-40, ether-wallwalk, identity-footer, death-copy, voice-corpus.

### Declared regenerations

- **Shell snapshots** (`MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`):
  - `mu.gear.txt` and `thief.gear.txt`: ARMOR → ARMOUR labels, and "ARMOUR · SWAP";
  - `thief.hero.txt`: the Thief class note.
  - Five other snapshot files showed CRLF-only noise and were restored with `git checkout --`.
- **The 77-02 event-order corpus** did not move.
- **FIXTURE-INVENTORY:** `### Plan 79-12` was appended at the end of `## Phase 79`. It is a measured zero with no carve-out.

## Open items returned to the orchestrator

1. **INSANITY retirement needs an engine change.** `engine/encounters.js#goInsane` still stamps `INSANITY[r-1]` as `insanityRolled.result`, and no surface reads it. Dropping the field and the table is an engine edit (an event field), so this plan did not make it.
2. **MU_CHART inert bonuses (from 79-03).** The protection, healing, divination and special school bonuses have no thrown spell to apply to. The user should rule whether they get an effect or stay flavour. This is a rules change and was not made here.
3. **Engine comments quoting pre-Phase-79 text.** `engine/combat.js` (Overhead Blow) and `engine/derived.js` (the PARTY_WIDE_ITEM_EFFECTS and foeToHitVs doc comments) still quote the old roll-under wording. They are allow-listed in stale-terms as class B, because engine/ was frozen for this plan. The next plan that touches those files should refresh the quotes and drop the survivors.
4. **boot:check** was not run here (no node_modules in the worktree, and the junction was refused). Run `npm run build:www && npm run boot:check` at merge.
5. **For 79-13:**
   - `--coverage` has 82 pre-existing errors (79-03's IDENTITY_TRAITS and identityFooter literals, 79-02's gain builders, PARTY_WIDE_ITEM_EFFECTS);
   - the voice sample still quotes old lines;
   - `bank:MOD_LABEL.gear` is new copy the review page should show.

## Known Stubs

None.

## Threat Flags

None. No network, auth, file or schema surface was added. The hidden section's external rulebook link was deleted along with the section.

## TDD Gate Compliance

- Task 1: RED `3e307f30` (the roll-phrasing test failed: the ledger section did not exist yet), then GREEN `6691522d`.
- Task 2: RED `6676b440` (narrative-hygiene failed on the missing house-spelling rule and the bestiary hits), then GREEN `dd51d92d` and `f5cb522b`.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 3e307f30 | test(79-12): add the failing doc-synced ROLL-04 roll-phrasing guard |
| 1 GREEN | 6691522d | feat(79-12): the ROLL-04 closure, range pins and roll-under tripwire |
| 2 RED | 6676b440 | test(79-12): add failing corpus-wide hygiene, twin, safety and HP-not-WP guards |
| 2 GREEN | dd51d92d | fix(79-12): close the handed-on copy items |
| 2 GREEN | f5cb522b | feat(79-12): the corpus-wide voice guards go green; tooling closure |

## Self-Check: PASSED

- Created files exist: test/unit/roll-phrasing.test.js, test/voice/narrative-hygiene.test.js, docs/narrative-pass/why/79-12.json, this SUMMARY.
- All five commits are in `git log` (3e307f30, 6691522d, 6676b440, dd51d92d, f5cb522b).
- `npm test` 7,468 / 7,468; voice-inventory checks 0; all ledgers `--after` 0 errors.
