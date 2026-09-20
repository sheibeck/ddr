---
phase: 48-stale-docs-comments-test-names-purge
plan: 03
subsystem: testing
tags: [docs-sweep, test-names, narration-lines, stale-terms]

requires:
  - phase: 48-stale-docs-comments-test-names-purge
    plan: 01
    provides: tools/stale-terms.mjs (criterion-1 tripwire) and tools/comment-only-diff.mjs
  - phase: 48-stale-docs-comments-test-names-purge
    plan: 02
    provides: the narration-line vocabulary already applied to mazeworld.html + src/browser/*.js
provides:
  - "26 narration-pipeline/engine-facing test files: no describe()/test() title, comment, local identifier, or assertion message presents a toast/Round Card as a live surface"
  - "test/unit/round-card-worst-case.test.js renamed (git mv) to test/unit/fight-log-worst-case.test.js, citations re-pointed"
  - "tools/stale-terms.mjs: fixed a --paths filtering bug that dropped directory-prefix ALLOWED entries when scoped to individual files; 8 new ALLOWED entries (class B/C/flagged)"
affects: [48-04-PLAN.md, 48-05-PLAN.md]

tech-stack:
  added: []
  patterns:
    - "tools/stale-terms.mjs --paths <files...> now filters ALLOWED entries against the actually-scanned sources (fileMatchesAllowEntry), not against the --paths list itself — a directory-prefix entry stays active when --paths names individual files inside that directory"

key-files:
  created: []
  modified:
    - test/unit/fight-log-worst-case.test.js (renamed from round-card-worst-case.test.js)
    - test/unit/linesForAction.test.js
    - test/unit/narrativeLines.test.js
    - test/unit/narrationLinesCoverage.test.js
    - test/unit/party-combat.test.js
    - test/unit/fightLog.test.js
    - test/voice/safety-scan.test.js
    - test/unit/clarity-cause-lines.test.js
    - test/unit/combatMenu.test.js
    - test/unit/combatPanel.test.js
    - test/unit/usable-features-audit.test.js
    - test/unit/armorDisplay.test.js
    - test/unit/movement.test.js
    - test/unit/cutthroat-joiner.test.js
    - test/unit/ability-pool.test.js
    - test/unit/spell-utility.test.js
    - test/unit/parley.test.js
    - test/unit/worn-slots.test.js
    - test/unit/rations-audit.test.js
    - test/unit/item-wiring.test.js
    - test/unit/loot-narration.test.js
    - test/unit/dismiss-joiner.test.js
    - test/unit/characterSheetViewModel.test.js
    - test/unit/conditions.test.js
    - tools/stale-terms.mjs

key-decisions:
  - "Dropped the Round Card mention from fight-log-worst-case.test.js's head comment entirely (rather than keeping it as a class-B ALLOWED sentence) to match the plan's own read_first note that Task 1 should have no survivor beyond the linesForAction.test.js:68 message — kept the survivor count minimal"
  - "Rewrote the class-B 'Phase 39 (GEAR-02): the retired ... counters' comments in conditions.test.js/item-wiring.test.js/movement.test.js in place (still naming the retired field, still explaining what replaced it) rather than deleting them — they explain an absence, which is exactly the class-B case the phase's ground rules keep"
  - "Left usable-features-audit.test.js:566's `line?.toasts?.[0]?.text` fallback untouched — `.toasts` is a field/property name (a defensive read of a shape no live LINE_FOR builder ever returns), not a local identifier, and the bounded rule forbids changing field names even when the branch is provably dead; flagged as a class-'flagged' survivor with a note recommending a future behaviour-level cleanup, not fixed here"
  - "Fixed a real tools/stale-terms.mjs bug (Rule 1): --paths scoping to individual files (as this plan's own literal acceptance-criteria commands do) silently dropped every directory-prefix ALLOWED entry, because the filter tested the ALLOWED entry's own file string against the requested --paths instead of testing it against the sources actually being scanned — without this, Task 1/2's class-D fixture-literal survivors could never be listed under a per-file --paths invocation"

requirements-completed: []

coverage: []

duration: ~50min
completed: 2026-09-20
status: complete
---

# Phase 48 Plan 03: Test Names — Narration-Pipeline & Engine-Facing Suites Summary

**Renamed every toast-titled `describe`/`test` string, local `toast*` identifier, and assertion message across 26 narration-pipeline and engine-facing test files to the line vocabulary, `git mv`'d `round-card-worst-case.test.js` to `fight-log-worst-case.test.js`, and fixed a `stale-terms.mjs` scoping bug that was hiding valid class-D survivors from per-file `--paths` runs — two commits, `npm test` 3288/0 throughout, zero engine/content/src/mazeworld.html bytes touched.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2
- **Files modified:** 26 (25 test files + `tools/stale-terms.mjs`, shared across both tasks)

## Accomplishments

- **Task 1 (narration-pipeline suites):** `git mv test/unit/round-card-worst-case.test.js test/unit/fight-log-worst-case.test.js`, rewrote its head comment (dropped the Round Card mention entirely) and its "toast host" retirement comment; re-pointed `combatMenu.test.js`/`combatPanel.test.js`'s two citations each to the new file name ("its fixed* helpers" rather than a line-number pointer, since the head-comment edit shifted line numbers). Renamed 21 toast-titled tests in `linesForAction.test.js`, 8 in `narrativeLines.test.js`, 2 in `narrationLinesCoverage.test.js`, 3 in `party-combat.test.js`, 2 in `fightLog.test.js`, 1 in `safety-scan.test.js`, and the template + explicit title in `clarity-cause-lines.test.js`, to the line vocabulary — plus every local `toast*` identifier in those files (`backstabToast`/`strikeToast`/`backstabToasts`/`goblinToasts`/`toastOnlyMoveEvents`/`deadToast`/`missingToast`/`TOAST_CASES`/`toasts`/`toastText`) and their assertion messages.
- **Task 2 (engine-facing suites):** renamed toast-titled tests and local identifiers in `usable-features-audit.test.js`, `armorDisplay.test.js`, `movement.test.js`, `ability-pool.test.js`, `rations-audit.test.js`; renamed local `toast`/`toastWithSenses`/`toastTexts`/`toastText`/`feedLine` identifiers in `cutthroat-joiner.test.js`, `spell-utility.test.js`; rewrote comments in `characterSheetViewModel.test.js`, `dismiss-joiner.test.js`, `loot-narration.test.js`, `worn-slots.test.js`; rewrote `parley.test.js`'s two citations of the deleted `test/unit/parley-button-mirror.test.js` to describe what the 504-case matrix replays now (engine-vs-prose-oracle only — no second engine left to mirror); kept `conditions.test.js`/`item-wiring.test.js`/`movement.test.js`'s Phase 39 (GEAR-02) "retired counter" comments as class-B absence explanations (still naming the retired field, since the comment's job is explaining why the test's baseline state omits it); confirmed `item-activation.test.js`'s `foldLegacyCounters` title/pins are already fully allowed (class C, Plan 01) and untouched.
- **`tools/stale-terms.mjs`:** fixed a real scoping bug (Rule 1) where `--paths <individual files>` silently dropped every directory-prefix `ALLOWED` entry (e.g. the `test/unit/` class-D fixture-literal entry), because the filter tested the entry's own `file` string against the requested `--paths` list instead of testing it against the sources actually being scanned. Added 8 new `ALLOWED` entries: 1 class-B (`linesForAction.test.js:68`), 3 class-B (`conditions.test.js`/`item-wiring.test.js`/`movement.test.js` GEAR-02 comments), 1 class-C (`usable-features-audit.test.js`'s `const fields` doc-sync pin), and 1 flagged survivor (`usable-features-audit.test.js:566`'s dead `.toasts` fallback).

## Task Commits

1. **Task 1: file rename + narration-pipeline suites** — `9b602cf` (docs)
2. **Task 2: engine-facing suites** — `c2679b2` (docs)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP/REQUIREMENTS update is the final commit for this plan._

## Per-file `test(`/`assert.` count pairs (26 files, 649de2b → HEAD)

| File | `test(` before→after | `assert.` before→after |
| --- | --- | --- |
| linesForAction.test.js | 53 → 53 | 117 → 117 |
| narrativeLines.test.js | 14 → 14 | 44 → 44 |
| narrationLinesCoverage.test.js | 9 → 9 | 24 → 24 |
| party-combat.test.js | 39 → 39 | 134 → 134 |
| fightLog.test.js | 13 → 13 | 55 → 55 |
| safety-scan.test.js | 7 → 7 | 11 → 11 |
| clarity-cause-lines.test.js | 19 → 19 | 55 → 55 |
| fight-log-worst-case.test.js (was round-card-worst-case.test.js) | 2 → 2 | 11 → 11 |
| combatMenu.test.js | 22 → 22 | 95 → 95 |
| combatPanel.test.js | 19 → 19 | 43 → 43 |
| usable-features-audit.test.js | 9 → 9 | 23 → 23 |
| armorDisplay.test.js | 15 → 15 | 72 → 72 |
| movement.test.js | 76 → 76 | 254 → 254 |
| cutthroat-joiner.test.js | 18 → 18 | 70 → 70 |
| ability-pool.test.js | 15 → 15 | 62 → 62 |
| spell-utility.test.js | 29 → 29 | 85 → 85 |
| parley.test.js | 17 → 17 | 126 → 126 |
| worn-slots.test.js | 59 → 59 | 187 → 187 |
| rations-audit.test.js | 23 → 23 | 76 → 76 |
| item-wiring.test.js | 12 → 12 | 47 → 47 |
| loot-narration.test.js | 8 → 8 | 26 → 26 |
| dismiss-joiner.test.js | 20 → 20 | 48 → 48 |
| characterSheetViewModel.test.js | 16 → 16 | 53 → 53 |
| conditions.test.js | 32 → 32 | 60 → 60 |
| spell-mechanics.test.js | 28 → 28 | 103 → 103 |
| item-activation.test.js | 24 → 24 | 106 → 106 |

All 26 pairs identical before/after. `git diff -U0 649de2b -- <all 26 files> | grep -E "^-[^-]" | grep "assert" | grep -viE "toast" | wc -l` → `0` (every removed assertion line carried the stale word). `git diff -U0 649de2b -- test/unit | grep -E "^-[^-]" | grep -c "flightLeft: 0"` → `0` (no fixture literal touched).

## Rename evidence

`git diff-tree -M -r --name-status 9b602cf` reports:
```
R095	test/unit/round-card-worst-case.test.js	test/unit/fight-log-worst-case.test.js
```
(a 95%-similarity rename, not a delete+create). Also confirmed via `git log -1 -M --name-status 9b602cf` (same `R095` line) and `git show --stat -M100% 9b602cf`.

**Finding (not a defect in the work, a git-CLI quirk):** the plan's literal acceptance command `git log --diff-filter=R --name-status --oneline -1 -- test/unit/fight-log-worst-case.test.js | grep -c "^R"` prints `0`, not `1`, in this environment — `diff.renames` is unset (defaults to off for `git log`, unlike `git status`), AND separately, `git log` restricted by a **single new-path pathspec** never re-forms the rename pair even with `-M` added, because the pathspec limits the pre-image side out of the diff before rename detection runs. Both `git log -1 -M --name-status 9b602cf` (no pathspec) and `git diff-tree -M -r --name-status 9b602cf` (the tree-level primitive) confirm the rename is real and correctly recorded in history — the pathspec-restricted `git log` command is simply not a reliable way to query it. No repo-config change was made (git config is off-limits per the safety protocol).

## Combined `stale-terms.mjs` table — all 26 files (final)

```
| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad|dpad` | 0 | 0 | 0 | yes |
| toast | `toast` | 2 | 2 | 0 | yes |
| classic-engine | `dead classic|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 0 | 0 | 0 | no |
| wornSlots | `wornSlots` | 0 | 0 | 0 | yes |
| legacy-counters | `flightLeft|flightCooldown|c\.ether` | 19 | 19 | 0 | yes |
| recentre | `recent(er|re).*(every|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card|roundcard` | 0 | 0 | 0 | yes |
| retired-bridges | `__mz(...)\b` | 0 | 0 | 0 | yes |
| retired-files | `toasts\.js|...|round-card-worst-case` | 0 | 0 | 0 | yes |
| legacy-won | `won: false|state\.won|winGame` | 13 | 0 | 13 | no |

exit=0
```

`node tools/stale-terms.mjs --paths <all 26 files>` → **exit 0**, `## Unlisted` empty, `## Allow-list rot` empty (verified both as the two per-task scoped runs and as one combined run over all 26 paths).

## Survivors kept (file:line, class, reason)

| File:Line | Class | Reason |
| --- | --- | --- |
| `test/unit/linesForAction.test.js:68` | B | "no default cap — every folded line is returned (the capped toast host is retired)" — the no-default-cap assertion states why |
| `test/unit/conditions.test.js:17` | B | cleanChar's doc comment explains why the baseline character omits haste/invis/ether/acute/flightLeft/flightCooldown and what replaced them |
| `test/unit/item-wiring.test.js:271` | B | explains why the Cloak of Ether test no longer sets `c.ether` |
| `test/unit/movement.test.js:658` | B | explains why the step-tick test reads `c.timers` instead of the retired scalar counters |
| `test/unit/usable-features-audit.test.js:533` | C | doc-sync pin — the doc's §6 expiry table still names the pre-Phase-39 field names as retirement rows; the test asserts the doc names them (Plan 05 annotates the doc) |
| `test/unit/item-activation.test.js` (title + 3 body lines) | C | `foldLegacyCounters` pin — its input MUST carry the legacy keys and its assertions prove they are deleted (Plan 01's existing entry; unchanged) |
| `test/unit/usable-features-audit.test.js:566` | flagged | `line?.toasts?.[0]?.text` — dead defensive fallback reading a shape no live `LINE_FOR` builder ever returns; `.toasts` is a field name, not a local identifier, so the bounded rule forbids touching it even though the branch is provably unreachable. **Recommend a future behaviour-level cleanup to delete the dead ternary branch entirely** — not done here. |
| 7 files' `flightLeft: 0, flightCooldown: 0` literals (`ability-pool`, `armorDisplay`, `combatMenu`, `combatPanel`, `fight-log-worst-case`, `item-wiring`, `parley`, `party-combat`, `spell-mechanics`, `spell-utility`, `usable-features-audit`) | D | inert legacy keys in hand-built test-state literals — out of DOCS-03 scope; Plan 04's last task removes these in one revertible commit |

## Split with Plan 04 (recorded, not chased)

`node tools/stale-terms.mjs --paths test` still reports unlisted hits (dpad 14, toast 72, wornSlots 7, round-card 11, retired-bridges 41, retired-files 12) confined entirely to files outside this plan's 26: `test/unit/bridge-registry.test.js`, `test/unit/harness/shellSandbox.js`, `test/unit/inputGuards.test.js`, and the 16 `test/unit/shell-*.test.js` suites (`shell-abilities`, `shell-armor-display`, `shell-clarity-43`, `shell-combat-actions`, `shell-combat-over`, `shell-company-panel`, `shell-fight-gate`, `shell-fight-log`, `shell-gear-39`, `shell-gear-toolbar`, `shell-map-invariants`, `shell-map-rail`, `shell-map-viewport`, `shell-narration-wiring`, `shell-oracle-panel`, `shell-party-camp`, `shell-worn-slots`). This is exactly Plan 04's stated scope (shell-* source-pin suites, the harness, the parity comparables, the class-D fixture-literal hygiene commit) — verified no file from this plan's 26 appears in that unlisted list.

## Gate results (exact counts)

- `ls test/unit | grep -iE "toast|dpad|round-card"` → empty; `echo $?` → `1`
- `grep -rn "round-card-worst-case" test/ src/ tools/` → `tools/stale-terms.mjs:83` only (the tool's own retired-files regex source string, excluded from its own scan by `SELF_PATH`) — zero hits in test/ or src/
- `grep -rniE "^\s*(test|describe|it)\(.*toast" <all 26 files>` → `0`
- `node --test <all 26 files>` — Task 1's 10 files: `# pass 247`, `# fail 0`; Task 2's 16 files: `# pass 544`, `# fail 0`
- `npm test` (both commits) → `# tests 3288`, `# pass 3288`, `# fail 0`
- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0`; `git diff --stat -- test/unit/fixtures/` → empty
- `git status --porcelain engine/ content/ src/ mazeworld.html test/parity/` → empty (fence untouched)
- `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)

## Renamed titles (old → new), by file

**linesForAction.test.js** (21): every "…yields one toast…"/"…one block toast"/"…struck/strikeMissed toast"/"…order block toast…"/"…dedupe into one toast"/"…produce two toasts…"/"…collapse into one toast"/"…stays its own toast…"/"…combined toast"/"…resist toast, no magic hit toast" → "…resist line, no magic-hit line"/"…dozed toast"/"…fold into one toast" (×5)/"…keeps its own toast" (×3)/"…one hit toast, roll first…"/"…one miss toast, roll first…" — each renamed "toast(s)" → "line(s)" per the plan's locked wording list; local `backstabToast`→`backstabLine`, `strikeToast`→`strikeLine`, `backstabToasts`→`backstabLines`, `goblinToasts`→`goblinLines`; messages "should yield exactly one toast" (×3), "the backstab feature toast is present", "the your-round toast is present", "your outcome sorts before the feature toast", "duplicate event type … collapses to one toast", "the encounter-start toast is present" all reworded to "line".

**narrativeLines.test.js** (8): CARD_EVENTS/no-toast-only-move-event title, ctx.narrate direct-mapped title, ctx.narrate-never-replaces title, ctx.narrate-fallback-never-blank title, ordering-three-same-priority title, adjacency-trap-toast-only title, empty-no-toasts title, tableFour-toast-their-prose title — all renamed per plan wording; local `toastOnlyMoveEvents`→`lineOnlyMoveEvents`, loop var `toast`→`line`; message "a toast text must never be blank"→"a line text must never be blank".

**narrationLinesCoverage.test.js** (2 titles + doc comments): "every engine-emitted event type is either toasted or explicitly Oracle-only"→"…either has a LINE_FOR builder or is explicitly Oracle-only"; "presentation toast modules are pure…"→"presentation narration modules are pure…"; local `deadToast`→`deadLine`, `missingToast`→`missingLine`; header/NAMED_LEGIBILITY_EVENTS comments reworded.

**party-combat.test.js** (3): "DFB-05 narration + toast: …"→"DFB-05 Oracle + line: …"; "DFB-05 toast: a cast is exactly one toast…"→"DFB-05 line: a cast is exactly one line…"; "DFB-05 coverage: …FEATURE_EVENTS with narration and toast…"→"…with an Oracle sentence and a line…"; local `toasts`→`lines` (5 call sites), `toastText`→`lineText`.

**fightLog.test.js** (2): "partition: PRIORITY.block toasts fold to dull-only fight-log lines…"→"PRIORITY.block lines fold to dull-only fight-log entries…"; "count equality: …equals the uncapped folded toast count"→"…folded line count".

**safety-scan.test.js** (1 + 3 comments): "LINE_FOR: every toast builder renders family-friendly…"→"…every line builder renders…"; three "(toast architecture)"/"(toast table)" comments reworded; message "Banned copy in toast table:"→"Banned copy in LINE_FOR table:".

**clarity-cause-lines.test.js** (20 generated + 1 explicit): template title `` Toast: ${type} … `` → `` Line: ${type} … `` (19 generated cases); "Toast: deathSpellTooWeak is a block-priority toast naming the fee"→"Line: deathSpellTooWeak is a block-priority line naming the fee"; local `TOAST_CASES`→`LINE_CASES`, `const toast`→`const line`.

**fight-log-worst-case.test.js** (was round-card-worst-case.test.js): head comment rewritten (path + dropped Round Card mention), "toast host that once capped it is retired" comment reworded to "there is no per-type cap left to hit".

**combatMenu.test.js / combatPanel.test.js**: no title changes — both citations of `round-card-worst-case.test.js` (2 each) re-pointed to `fight-log-worst-case.test.js`'s fixed* helpers.

**ability-pool.test.js** (1): "abilityLearned narration: eventNarration/toasts/rail all cover it"→"…eventNarration/narrationLines/rail all cover it"; local `toast`→`feedLine` (renamed rather than reusing `line`, already bound to the EVENT_NARRATION string in the same scope).

**armorDisplay.test.js** (1 + 3 comments): "ARMOR-02 reproduction: the armorSoaked toast's wear equals…"→"…the armorSoaked line's wear equals…"; head-comment/section-comment "toast" mentions (×3) reworded to "line".

**movement.test.js** (1 + 1 class-B comment): "campFailed narration and toast render the numbers and the member clause"→"campFailed Oracle sentence and line render…"; local `toast`→`line`; GEAR-02 comment reworded (kept, class B).

**cutthroat-joiner.test.js** (0 titles, 1 comment + 3 locals): "Task 1 covers the murder mechanics + narration/toast/rail entries" comment reworded; local `toast`→`line` (3 field reads).

**rations-audit.test.js** (1 + 1 comment): "narration: LINE_FOR.rationsEaten/.wentHungry render the terse toast texts"→"…terse line texts"; section-comment reworded.

**usable-features-audit.test.js** (1 + locals): "doc-sync: every refused {type, reason} pair produces distinct, non-empty toast/Oracle text…"→"…non-empty line/Oracle text…"; local `toastTexts`→`lineTexts`, `toast`→`line`, `toastText`→`lineText` (message "two reasons share the same toast text"→"…same line text"); `.toasts` property access on line 566 intentionally left untouched (see Survivors table).

**spell-utility.test.js** (0 titles, 1 local): `toastWithSenses`→`lineWithSenses`.

**worn-slots.test.js** (0 titles, 2 comments): "dispatch + actions.js validation + toast/Oracle copy" (×2, header + inline) reworded to "…LINE_FOR/Oracle copy".

**dismiss-joiner.test.js** (0 titles, 1 comment): "EVENT_NARRATION/toast-table/rail entries" reworded to "…LINE_FOR-table/rail entries".

**loot-narration.test.js** (0 titles, 1 message): "must not be ORACLE_ONLY — it needs a toast"→"…it needs a LINE_FOR builder".

**characterSheetViewModel.test.js** (0 titles, 1 comment): "so the sheet can never disagree with the toast/gear panel"→"…the line/gear panel".

**parley.test.js** (0 titles, 2 comments): both citations of the deleted `test/unit/parley-button-mirror.test.js` rewritten to describe the current 504-case matrix as the sole engine-vs-prose-oracle replay.

**item-wiring.test.js / conditions.test.js**: comments reworded in place, kept spelling the retired field names as class-B absence explanations (see Survivors table).

**spell-mechanics.test.js / item-activation.test.js**: no toast-vocabulary edits needed — `spell-mechanics.test.js` only carried the (out-of-scope, class-D) `flightLeft: 0` fixture literal; `item-activation.test.js`'s `foldLegacyCounters` pins were already fully class-C-allowed from Plan 01.

## Expected value I believe is wrong (flagged, not fixed)

`test/unit/usable-features-audit.test.js:566` — `line?.toasts?.[0]?.text` is dead code: no `LINE_FOR` builder in `src/browser/narrationLines.js` returns a `{ toasts: [...] }` shape (confirmed via `grep -n "toasts:" src/browser/narrationLines.js` → no matches), so this ternary branch never executes in any real invocation. It reads as a leftover defensive check from before the Phase 46 `toasts.js` → `narrationLines.js` rename, when the return shape may have briefly used that name. Renaming `.toasts` → `.lines` would be behaviourally inert (both are always `undefined`) but is a field-name change, which the bounded test-body rule for this phase forbids regardless of provable inertness. Recommend removing the dead branch entirely (`line?.text` alone suffices) in a future behaviour-level pass — not done here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a `tools/stale-terms.mjs` `--paths` scoping bug that broke this plan's own literal acceptance-criteria commands**
- **Found during:** Task 1, first scoped `stale-terms.mjs --paths <10 files>` run — `flightLeft: 0, flightCooldown: 0` lines in `combatMenu.test.js`/`combatPanel.test.js`/`party-combat.test.js`/`round-card-worst-case.test.js` reported as `unlisted` under `legacy-counters` even though a class-D `ALLOWED` entry (`file: "test/unit/"`) already covers them.
- **Issue:** The CLI's `--paths` handling filtered `ALLOWED` via `ALLOWED.filter((a) => paths.some((p) => fileUnderPrefix(a.file, p)))` — testing whether the entry's OWN `file` string (a directory prefix like `"test/unit/"`) falls under one of the requested `--paths` entries (individual filenames). A directory prefix is never "under" a specific filename inside it, so every directory-scoped `ALLOWED` entry silently dropped out whenever `--paths` named individual files — exactly what this plan's own acceptance-criteria commands do (they list 10 and 16 individual files, never a bare directory).
- **Fix:** Changed the filter to test against the actually-scanned `sources` (post path-filter) using the existing `fileMatchesAllowEntry` helper: `ALLOWED.filter((a) => sources.some((s) => fileMatchesAllowEntry(s.path, a.file)))`. An entry now stays active in a scoped run exactly when it could match one of the files actually being scanned, regardless of whether `--paths` was itself a directory or a list of individual files.
- **Files modified:** `tools/stale-terms.mjs`
- **Verification:** Re-ran the same scoped commands — `flightLeft`/`flightCooldown` lines now report correctly under `## Allowed survivors` (class D), `unlisted` returns to 0, and `## Allow-list rot` stays empty (the entry still matches at least one in-scope hit).
- **Committed in:** `9b602cf` (Task 1 commit)

**2. [Rule 4-adjacent, resolved without an architectural change — see "Expected value I believe is wrong"] `usable-features-audit.test.js:566`'s dead `.toasts` fallback**
- Not auto-fixed — flagged per the plan's own instruction ("If a test would need a body change beyond the bounded rule to reach zero, DO NOT make it — list it as a survivor"). Documented above with a class-`flagged` `ALLOWED` entry and a recommendation for a future behaviour-level pass.

---

**Total deviations:** 1 auto-fixed (1 tooling bug), 1 flagged-not-fixed (dead code, field-name boundary).
**Impact on plan:** The tooling fix was necessary for this plan's own literal acceptance criteria to be checkable at all — without it, every scoped `--paths <individual files>` run would spuriously report class-D survivors as unlisted. No scope creep — the fix is confined to the CLI's `--paths` filtering, not the term list or scan logic. The flagged dead-code item is genuinely out of scope for a names/comments sweep.

## Issues Encountered

None blocking. The `git log --diff-filter=R --name-status --oneline -1 -- <new-path>` rename-detection command from the plan's literal acceptance criteria does not print `R` in this environment (see "Rename evidence" above) — verified via three alternate commands that the rename is correctly recorded in git history; this is a `git log` pathspec/rename-detection interaction, not a defect in the work.

## Human verification (deferred to end of run)

None — no user-visible change. This plan touches only `describe`/`test` title strings, comments, local identifier names, and assertion MESSAGE strings inside test files; zero expected values, conditions, fixture literals, event types, or field names changed (proven by the per-file count table, the removed-assertion-line filter, and the fixture-literal grep, all above). `npm test` (3288/0, unchanged pass count) and the Phase-47 DOM-snapshot smoke (10/10, no fixture diff) confirm no behavioural or rendering change anywhere in the codebase.

## Next Phase Readiness

- `tools/stale-terms.mjs` now carries 8 seeded (Plan 01) + 6 (Plan 02) + 8 (this plan) = 22 `ALLOWED` entries, plus the `--paths` scoping fix that Plan 04/05 will also depend on when they run their own per-file scoped checks.
- Plan 04 has a clean, verified starting point: the full `--paths test` unlisted list is confined to `bridge-registry.test.js`, `test/unit/harness/shellSandbox.js`, `inputGuards.test.js`, and the 16 `shell-*.test.js` suites — exactly its stated scope (shell-* source-pin suites, the harness, the parity comparables) plus the class-D fixture-literal hygiene commit it owns.
- DOCS-01/DOCS-03 remain open per this plan's instruction — Plan 05 closes them once `test/`, `docs/`, and `.claude/CLAUDE.md` are all swept and the final combined tripwire run is recorded.
- `test/unit/usable-features-audit.test.js:566`'s dead `.toasts` fallback is a candidate for a small follow-up behaviour-level cleanup (delete the branch) — not urgent, flagged for whoever next touches that file.

---
*Phase: 48-stale-docs-comments-test-names-purge*
*Plan: 03*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: test/unit/fight-log-worst-case.test.js
- FOUND: tools/stale-terms.mjs
- FOUND: .planning/phases/48-stale-docs-comments-test-names-purge/48-03-SUMMARY.md
- FOUND: commit 9b602cf
- FOUND: commit c2679b2
