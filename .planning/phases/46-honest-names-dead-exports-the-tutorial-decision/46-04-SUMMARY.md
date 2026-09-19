---
phase: 46-honest-names-dead-exports-the-tutorial-decision
plan: 04
subsystem: tooling
tags: [name-hygiene, dead-code, grep-gate, closing-summary, ident-sweep]

requires:
  - phase: 46-03
    provides: "controlScheme setting + tutorial.js deletions (NAME-02 D-pad row, DEAD-05) — the last edits this plan's closing sweep needed to be clean"
provides:
  - "tools/ident-sweep.mjs — a single-pass comment-stripped identifier grep over src/, engine/, content/, tools/, mazeworld.html, with --self-test; reusable by Phase 48's grep list"
  - "the recorded NAME-02 sweep over toast|dpad-d-pad|flightLeft-flightCooldown|c.ether|wornSlots: exactly five survivors, all inside engine/saveState.js#foldLegacyCounters, zero elsewhere"
  - "ROADMAP Phase 46 success criteria 1-5 verified verbatim at the final commit, with command + output for each"
  - "the phase's closing record: consolidated rename/deletion ledger (46-01..04, with commit hashes), consolidated test ledger (3,242 -> 3,231, every delta explained), and the deferred Pixel 7 UAT batch"
affects: [47, 48]

tech-stack:
  added: []
  patterns:
    - "Single-pass comment/string state machine (code|line-comment|block-comment|squote|dquote|backtick), not two sequential 'strip // then strip /* */' passes — immune to both the @capacitor/* line-comment pitfall AND a JSDoc block comment quoting example text (e.g. \"Thief +5\") corrupting a separately-tracked, file-wide string state (the latter was a real bug caught live during this task's own development, before commit — see Deviations)."

key-files:
  created:
    - tools/ident-sweep.mjs
    - .planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-04-SUMMARY.md
  modified: []

key-decisions:
  - "Rejected the two-pass 'strip // line comments first, then strip /* block */ comments' design the module header originally documented as the safe precedent (it protects against the @capacitor/* pitfall alone) — a first live run against src/browser/narrationLines.js surfaced 13 false-positive 'toast' hits inside JSDoc block comments quoting example strings like \"Thief +5\", because the separate line-comment pass tracks quote state globally across the whole file with no notion of block comments, and a quote character inside a block comment desynchronizes that global string-tracking for everything after it. Replaced with a single combined state machine (code|line|block|squote|dquote|backtick) that is structurally immune to both failure modes at once, since it only checks for quote characters while in the 'code' state."

requirements-completed: [NAME-01, NAME-02, DEAD-04, DEAD-05]

coverage:
  - id: D1
    description: "tools/ident-sweep.mjs built (single-pass comment stripper, --self-test) and its recorded run over the criterion-3 regex list finds exactly the five foldLegacyCounters survivors and nothing else"
    requirement: "NAME-02"
    verification:
      - kind: unit
        ref: "node tools/ident-sweep.mjs --self-test — self-test: PASS"
        status: pass
      - kind: other
        ref: "node tools/ident-sweep.mjs \"toast\" \"dpad|d-pad\" \"flightLeft|flightCooldown\" \"c\\.ether\" \"wornSlots\" — ident-sweep toast: 0, dpad|d-pad: 0, flightLeft|flightCooldown: 5 (all engine/saveState.js), c\\.ether: 0, wornSlots: 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ROADMAP Phase 46 success criteria 1-5 verified verbatim at the final commit"
    requirement: "NAME-01, NAME-02, DEAD-04, DEAD-05"
    verification:
      - kind: other
        ref: "see ## Success criteria below — every command from ROADMAP.md's Phase 46 section run and its output recorded"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm test fail 0 at 3,231 with the full test-delta ledger since the phase-start baseline (3,242) explained; engine/ diff limited to the six won files; content/ untouched; zero fixture moves; master hash unchanged; build:www and boot:check green"
    requirement: "DEAD-04"
    verification:
      - kind: unit
        ref: "npm test — # pass 3231, # fail 0"
        status: pass
      - kind: other
        ref: "git diff --stat 39c5a0f -- engine/ (six files) ; git diff --stat 39c5a0f -- content/ (empty) ; git status --porcelain test/parity/fixtures (empty) ; git hash-object test/parity/prototype-master.js.txt (a1f4d0dc...) ; npm run build:www (exit 0) ; npm run boot:check (4 PASS)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-19
status: complete
---

# Phase 46 Plan 04: NAME-02 Closing Gate & Phase Summary

**`tools/ident-sweep.mjs` — a single-pass comment-stripped identifier grep (code\|line\|block\|squote\|dquote\|backtick state machine, immune to the @capacitor/\* pitfall and a JSDoc-quote-corrupting-string-state bug caught live during development) proving NAME-02's recorded sweep finds exactly five `foldLegacyCounters` survivors and nothing else; ROADMAP Phase 46 criteria 1-5 verified verbatim, closing the phase at 3,231 tests (from a 3,242 baseline).**

## Performance

- **Duration:** ~50min
- **Started:** 2026-09-19
- **Completed:** 2026-09-19
- **Tasks:** 2
- **Files modified:** 2 (1 new tool in Task 1's commit, 1 new SUMMARY in Task 2's commit)

## Accomplishments

- `tools/ident-sweep.mjs` built: a single-pass `code|line-comment|block-comment|squote|dquote|backtick` state machine, strings kept, comments blanked, line count preserved so reported line numbers match the source; surface is every `.js`/`.mjs`/`.cjs` under `src/`, `engine/`, `content/`, `tools/` plus `mazeworld.html`
- `--self-test` proves the stripper's teeth: a line comment, a two-line block comment, and the `@capacitor/*` pitfall line are never reported; a live code line, a string literal, and a real trailing-comment-after-a-`//`-bearing-string case are handled correctly; an HTML comment, a CSS comment and a script line are handled correctly too — `self-test: PASS`
- Recorded NAME-02 run over `toast`, `dpad|d-pad`, `flightLeft|flightCooldown`, `c\.ether`, `wornSlots`: exactly five survivors, all inside `engine/saveState.js#foldLegacyCounters` — nothing else, matching the plan's `must_haves` exactly
- ROADMAP Phase 46 success criteria 1-5 verified verbatim at the final commit (every command run, every output recorded below)
- Consolidated test ledger: 3,242 (phase-start baseline) -> 3,231 (this plan's close), every delta explained
- Consolidated rename/deletion ledger across all four plans, with commit hashes (below)

## Task Commits

1. **Task 1: tools/ident-sweep.mjs — comment-stripped identifier grep over the shipped surface, with --self-test** — `84508dd` (feat)
2. **Task 2: closing gates — ROADMAP Phase 46 success criteria 1-5 verbatim, the consolidated ledgers, and 46-04-SUMMARY.md as the phase closing record** — this commit (docs; creates this file)

**Plan metadata:** committed via `<final_commit>` (STATE/ROADMAP/REQUIREMENTS)

## Success criteria

Every command below was run at the final commit (`84508dd` plus this SUMMARY's own commit) with output copied verbatim.

### Criterion 1 — `src/browser/toasts.js` absent, `narrationLines.js` honest exports, zero `toasts.js|TOAST_FOR|toastsForAction|dispatchWithToasts|toastLifetime|MAX_TOASTS`, coverage guards hold, each rename its own commit

```
$ test -f src/browser/toasts.js
exit 1 (absent)

$ grep -nE "^export (const|function) (LINE_FOR|linesForAction)\b" src/browser/narrationLines.js
900:export function linesForAction(type, events, ctx = {}, opts = {}) {
938:export const LINE_FOR = {

$ grep -cE "^export .*(MAX_TOASTS|TOAST_[A-Z_]*_MS|toastLifetime)" src/browser/narrationLines.js
0

$ grep -cE "function dispatchWithNarration\(action\)" mazeworld.html
1

$ grep -rnE "toasts\.js|TOAST_FOR|toastsForAction|dispatchWithToasts|toastLifetime|MAX_TOASTS" src/ mazeworld.html test/ tools/
(empty)

$ node --test test/unit/narrationLinesCoverage.test.js test/unit/formatEventsCoverage.test.js
# tests 11
# pass 11
# fail 0

$ git log --oneline 39c5a0f..HEAD
(see the full chronological list under Gate outputs below — seven non-docs commits, one rename/deletion per commit, dependency order)
```

**Holds.**

### Criterion 2 — zero `winGame|state.won|.won\b` outside the two fight-outcome survivors, `saveState.js` tolerant, abandon guard reads `dead` alone, comparables carry no `won` handling

```
$ grep -rnE "winGame|state\.won|\.won\b" engine/ src/ mazeworld.html test/ tools/ test/parity/harness/ | grep -vE "prototype-master\.js\.txt"
mazeworld.html:3802:  const copy = COMBAT_COPY.over[kind] || COMBAT_COPY.over.won;
mazeworld.html:3989:        buttons: [{ id: "cb-over-btn", label: COMBAT_COPY.over[b.over] ? COMBAT_COPY.over[b.over].btn : COMBAT_COPY.over.won.btn, cls: "", onTap: () => { S.beats = null; renderEncounter(); } }],

$ grep -cE "won" engine/saveState.js
0

$ node --test test/unit/save-validation.test.js
# tests 43
# pass 43
# fail 0

$ grep -cE 'if \(!next\.dead\) die\(next, "abandon"' engine/engine.js
1

$ grep -cE "version, won," test/parity/harness/comparables.js
3
```

Both survivors are `COMBAT_COPY.over.won` — the **fight-outcome** copy key ("THEY ARE DOWN"), a live identifier for winning a FIGHT, never the retired run-terminator flag (46-02's own SUMMARY records this distinction; restated here as the plan's must-have). `test/parity/prototype-master.js.txt` (excluded above) also still contains historical `won`/`winGame` text — the frozen master file, never edited, the third allowed survivor category.

**Premise correction restated (two sentences, from 46-02):** DEAD-04/ROADMAP criterion 2 describe removing "the harness carve-out that strips `won`" — no such carve-out existed before this phase (`won` was compared LIVE on both sides of the parity diff). Removing the engine field therefore required **adding** a prototype-side strip in all three comparables (the `stripRetiredCounterFields` precedent), which is what 46-02's harness commit did — `grep -cE "version, won,"` above (3) is that strip, not a carve-out removal.

**Holds.**

### Criterion 3 — the recorded NAME-02 grep, only allowed survivors are legacy-key tolerant-load reads

```
$ node tools/ident-sweep.mjs --self-test
self-test: PASS

$ node tools/ident-sweep.mjs "toast" "dpad|d-pad" "flightLeft|flightCooldown" "c\.ether" "wornSlots"
ident-sweep toast: 0
ident-sweep dpad|d-pad: 0
engine/saveState.js:517: if (typeof c.flightLeft === "number" && c.flightLeft > 0) {
engine/saveState.js:519: startEffect(c, "item:Cloak of Flying", { squares: c.flightLeft, cd: act.cd });
engine/saveState.js:520: } else if (typeof c.flightCooldown === "number" && c.flightCooldown > 0) {
engine/saveState.js:521: startCooldown(c, "item:Cloak of Flying", { squares: c.flightCooldown });
engine/saveState.js:524: for (const k of ["haste", "invis", "ether", "acute", "flightLeft", "flightCooldown"]) delete c[k];
ident-sweep flightLeft|flightCooldown: 5
ident-sweep c\.ether: 0
ident-sweep wornSlots: 0
(exit 1 — the five survivors below are the ONLY reason)
```

## NAME-02 allowed survivors

| File:Line | Text | Reason |
|---|---|---|
| `engine/saveState.js:517` | `if (typeof c.flightLeft === "number" && c.flightLeft > 0) {` | Tolerant-load read of a pre-Phase-39 save key inside `foldLegacyCounters`; deleted from `c` once folded, never re-serialized |
| `engine/saveState.js:519` | `startEffect(c, "item:Cloak of Flying", { squares: c.flightLeft, cd: act.cd });` | Same fold — the counter's value is read once to seed the modern `startEffect` timer |
| `engine/saveState.js:520` | `} else if (typeof c.flightCooldown === "number" && c.flightCooldown > 0) {` | Same fold, the cooldown counterpart |
| `engine/saveState.js:521` | `startCooldown(c, "item:Cloak of Flying", { squares: c.flightCooldown });` | Same fold |
| `engine/saveState.js:524` | `for (const k of ["haste", "invis", "ether", "acute", "flightLeft", "flightCooldown"]) delete c[k];` | The fold's own cleanup line — deletes all six retired counter keys (including the two named in the swept regex) from `c` after folding them into the modern effect/cooldown timers |

No other survivor exists anywhere in the swept surface. `c\.ether` matches none of the five lines above (the fold reads `c[meta.kind]` and the bare string `"ether"` inside the array literal, never a `c.ether` dot-access). `toast`, `dpad|d-pad`, and `wornSlots` are all zero.

**NAME-02 adjacency row:**

```
$ grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/
(empty)

$ grep -rn "__mzWornSlots" mazeworld.html src/ | wc -l
2
```

The kept slot-taxonomy bridge (`__mzWornSlots`, user decision, 46-CONTEXT.md) and the retired `wornSlots` option name are distinguished by case, not by proximity — exactly the CONTEXT's decision.

**NAME-02 ordering row:** see `git log --oneline 39c5a0f..HEAD` under Gate outputs below — seven non-docs commits (one rename/deletion per commit, in dependency order: module rename, shell-function rename, `won` shell layer, `won` engine layer, `controlScheme`, `tutorial.js`, `ident-sweep`), matching the plan's must-have exactly.

**Holds.**

### Criterion 4 — `tutorial.js` decided (deleted), recorded in PROJECT.md/REQUIREMENTS.md

```
$ test -f src/browser/tutorial.js
exit 1 (absent)

$ test -f test/unit/tutorial.test.js
exit 1 (absent)

$ grep -rn "tutorial" src/ engine/ content/ tools/ mazeworld.html test/
(empty)

$ grep -c "Phase 46 deleted the 04-era sequencer" .planning/PROJECT.md .planning/REQUIREMENTS.md
.planning/PROJECT.md:1
.planning/REQUIREMENTS.md:1

$ node --test test/unit/icons.test.js
# tests 15
# pass 15
# fail 0
```

**Holds.**

### Criterion 5 — `npm test` fail 0, no test deleted except `tutorial.test.js` (moved, not deleted — see Test ledger), engine diff limited to `winGame`/`won`, zero fixture moves, master hash unchanged, `build:www` green

```
$ npm test 2>&1 | grep -E "^# (pass|fail)"
# pass 3231
# fail 0

$ git diff --stat 39c5a0f -- engine/
 engine/death.js     |  6 +++---
 engine/engine.js    |  4 ++--
 engine/events.js    |  4 ----
 engine/movement.js  | 46 +++++++++++-----------------------------------
 engine/saveState.js | 24 ++++++++++++++----------
 engine/state.js     |  3 +--
 6 files changed, 31 insertions(+), 56 deletions(-)

$ git diff --stat 39c5a0f -- content/
(empty)

$ git status --porcelain test/parity/fixtures
(empty)

$ git hash-object test/parity/prototype-master.js.txt
a1f4d0dc29782218d8e5aab65bc5989c33f917f0

$ npm run build:www
[build-www] done
(exit 0)

$ npm run boot:check
PASS no-uncaught
PASS painted
PASS graves
PASS title
```

**Holds.** (`test/unit/tutorial.test.js` was `git mv`'d to `test/unit/icons.test.js` in 46-03, not deleted outright — history follows, `git log --follow` confirms; the ten tutorial-only tests inside it were the deletions, recorded in the Test ledger below.)

## Test ledger

| Step | Delta | Running total | Reason |
|---|---|---|---|
| Phase-start baseline (`39c5a0f`/`2be88a1`) | — | 3,242 | — |
| 46-01 Task 1 (module + export rename, dead-export deletion) | −2 | 3,240 | Two dead lifetime tests deleted (`MAX_TOASTS is 4`, the DFB-02 `toastLifetime` boundary table) — both pinned deleted constants/functions |
| 46-01 Task 2 (shell function rename) | 0 | 3,240 | Pure rename, no test count change |
| 46-02 Task 1 (shell layer `won` removal) | 0 | 3,240 | Anchors re-pointed, no test count change |
| 46-02 Task 2 (engine + harness + narration + tools + tests) | 0 (net) | 3,240 | −1 dormant `winGame` test deleted (called the removed function directly), +1 new DEAD-04 stale-save tolerant-load pin |
| 46-03 Task 1 (`controlScheme` deletion) | +1 | 3,241 | +1 new fragment-built NAME-02 tolerant-load pin (never spells the retired identifier) |
| 46-03 Task 2 (`tutorial.js` deletion) | −10 | 3,231 | Ten sequencer/`tutorialSeen` tests removed; the file itself moved (not deleted) to `test/unit/icons.test.js`, keeping its 15 `icons.js` pins verbatim |
| 46-04 (this plan) | 0 | 3,231 | No test change — a new gate tool, not a behavior change |

**3,242 → 3,231 (net −11), every delta explained; no test FILE deleted** — `toastTable.test.js`, `toastsForAction.test.js`, `toastsCoverage.test.js`, `narrativeToasts.test.js`, `shell-toast-wiring.test.js`, and `tutorial.test.js` were all `git mv`'d to honest names (history follows), never `git rm`'d outright.

## Consolidated rename/deletion ledger (46-01..04)

| # | What | Commit | Plan |
|---|---|---|---|
| 1 | `git mv src/browser/toasts.js -> narrationLines.js`; `TOAST_FOR -> LINE_FOR`, `toastsForAction -> linesForAction`, `narrativeToastText -> narrativeLineText`; six dead lifetime exports + two dead re-exports deleted; 35 importers + 5 test files moved | `3cf31ed` | 46-01 |
| 2 | Shell `dispatchWithToasts(action) -> dispatchWithNarration(action)` | `33c7170` | 46-01 |
| 3 | Shell layer: every `S.won` read removed (won card, `.stone.won`/`.deathcard` CSS, resume/title/rail/stair/snapshot checks -> `dead` alone) | `af9b313` | 46-02 |
| 4 | Engine layer: `winGame()` deleted, `state.won` guards removed, `saveState.js` tolerant of a stale `won: true`, `WON` event type deleted, death-note fallback plain, narration tables + tools + tests follow; parity harness gains one retired-field strip (`won`) in all three comparables | `990ad88` | 46-02 |
| 5 | `controlScheme` setting deleted — four-field settings model, old blobs drop the key on read (fragment-built tolerant-load pin) | `645980a` | 46-03 |
| 6 | `src/browser/tutorial.js` deleted; `tutorial.test.js` moved to `icons.test.js` (15 icons pins kept, 10 tutorial tests removed); decision recorded in PROJECT.md + REQUIREMENTS.md | `5e6be1b` | 46-03 |
| 7 | `tools/ident-sweep.mjs` built (the NAME-02 gate) | `84508dd` | 46-04 |

Seven non-docs commits total — `git log --oneline 39c5a0f..HEAD | grep -vcE "^[0-9a-f]+ docs\("` returns 7, matching every plan's own stated expectation across the whole phase.

## Gate outputs

Per commit, chronological (consolidated from the three prior SUMMARYs plus this plan's):

```
3cf31ed (46-01 Task 1, refactor: module + export rename, dead-export deletion, 35 importers + 5 test files moved)
  npm test: # pass 3240, # fail 0
  npm run build:www: exit 0
  npm run boot:check: 4 PASS
  fold dump: diff <before.json> <after.json> — (empty), byte-identical
  straggler grep: grep -rnE "toasts\.js|TOAST_FOR|toastsForAction|narrativeToastText|MAX_TOASTS|TOAST_[A-Z_]*_MS|toastLifetime" src/ engine/ content/ tools/ mazeworld.html test/ — (empty)

33c7170 (46-01 Task 2, refactor: shell dispatchWithToasts -> dispatchWithNarration)
  npm test: # pass 3240, # fail 0 (unchanged)
  npm run build:www: exit 0
  npm run boot:check: 4 PASS
  straggler grep: grep -rnE "dispatchWithToasts" src/ engine/ content/ tools/ mazeworld.html test/ — (empty)
  node tools/shell-sweep.mjs refs dispatchWithToasts: 0; refs dispatchWithNarration: 10

af9b313 (46-02 Task 1, refactor: shell layer S.won removal)
  npm test: # pass 3240, # fail 0
  (shell-only commit — engine still carries `won` at this point)

990ad88 (46-02 Task 2, refactor: engine + harness + narration + tools + tests, DEAD-04)
  npm test: # pass 3240, # fail 0
  node --test test/parity/*.test.js: # pass 39, # fail 0
  criterion-2 grep: (empty except the two COMBAT_COPY.over.won survivors)
  grep -rnwE "won|WON" engine/: (empty)
  fence: git status --porcelain test/parity/fixtures (empty); git hash-object prototype-master.js.txt = a1f4d0dc... (unchanged)

645980a (46-03 Task 1, refactor: controlScheme deletion, NAME-02 D-pad row)
  npm test: # pass 3241, # fail 0
  grep -rnE "controlScheme|dpad" src/ engine/ content/ tools/ mazeworld.html test/ | grep -vE "prototype-master\.js\.txt|shell-map-invariants\.test\.js|shell-map-viewport\.test\.js": (empty)

5e6be1b (46-03 Task 2, refactor: tutorial.js deletion, DEAD-05)
  npm test: # pass 3231, # fail 0
  node --test test/unit/icons.test.js: # tests 15, # fail 0
  grep -rnE "tutorial" src/ engine/ content/ tools/ mazeworld.html test/: (empty)

84508dd (46-04 Task 1, feat: tools/ident-sweep.mjs, the NAME-02 gate)
  node tools/ident-sweep.mjs --self-test: self-test: PASS
  recorded NAME-02 sweep: exactly the five foldLegacyCounters survivors (see above)
  npm test: # pass 3231, # fail 0
  npm run build:www: exit 0

(this commit, 46-04 Task 2, docs: this SUMMARY)
  ROADMAP criteria 1-5: all hold (see ## Success criteria above)
  npm run boot:check: 4 PASS
```

Engine-gate fence at phase close (final measurement): `git diff --stat 39c5a0f -- engine/` = the six `won`-removal files only; `content/` untouched; zero fixture moves; `test/parity/prototype-master.js.txt` hash unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`; `build:www` + `boot:check` both green.

## Artifacts this phase produced

- `tools/ident-sweep.mjs` — comment-stripped identifier grep (single-pass state machine), `--self-test`; the NAME-02 gate, reusable by Phase 48's grep list (with `-i`; Phase 48 wants comments INCLUDED for its docs/comment sweep, so it uses plain `grep` for that half, per the plan's own discretion note)
- `src/browser/narrationLines.js` (git mv from `toasts.js`) — exports `LINE_FOR`, `linesForAction`, `narrativeLineText`, `oracleDetailText`, `ORACLE_ONLY`, `FEATURE_EVENTS`, `CARD_EVENTS`, `NARRATIVE_ACTIONS`, `TONES`, `PRIORITY`, `slotWord`
- Shell `dispatchWithNarration(action)` — the single dispatch seam, formerly `dispatchWithToasts`
- Renamed tests: `narrationLinesTable.test.js`, `linesForAction.test.js`, `narrationLinesCoverage.test.js`, `narrativeLines.test.js`, `shell-narration-wiring.test.js`, `icons.test.js` (from `tutorial.test.js`)
- New pins: DEAD-04 stale-`won`-save tolerant load (`test/unit/save-validation.test.js`); NAME-02 `controlScheme` tolerant-load (`test/unit/settings.test.js`, fragment-built)
- Deletions: `src/browser/toasts.js`, `src/browser/tutorial.js`, `engine/movement.js#winGame`, `state.won` and its four guards, the `WON` event type, the six dead toast-lifetime exports, the two dead re-exports, the `controlScheme` setting

## Files Created/Modified

- `tools/ident-sweep.mjs` — new tool: single-pass `code|line|block|squote|dquote|backtick` comment stripper, file-discovery over the shipped surface, per-regex report, `--self-test`
- `.planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-04-SUMMARY.md` — this file

## Decisions Made

See `key-decisions` in the frontmatter: the two-pass-to-single-pass redesign, caught live during Task 1's own first recorded-sweep run (13 false-positive `toast` hits inside JSDoc block comments quoting example strings), before the tool was committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The initial two-pass stripper design (line comments first, then block comments) produced 13 false-positive `toast` hits**
- **Found during:** Task 1's first run of the plan's own recorded NAME-02 sweep (`node tools/ident-sweep.mjs "toast" ...`), before committing
- **Issue:** The module's original design (per its own header comment, modeled on the codebase's documented "line-comments-first" precedent) ran `stripLineComments` as a first pass tracking single/double/backtick string state ACROSS THE WHOLE FILE, then a separate `stripBlockComments` pass. That first pass has no notion of block comments — so a quote character appearing inside a `/** ... */` JSDoc comment (e.g. `mirrors eventNarration.js's needModsText format so the toast/Oracle/fight-log surfaces...` immediately followed elsewhere by JSDoc prose quoting `"Thief +5"`) was treated as opening a REAL string literal, desynchronizing the file-wide string-tracking state for everything after it. The result: 13 lines in `src/browser/narrationLines.js` and `engine/derived.js` — all inside comments — matched `toast` after stripping, when they should have matched zero.
- **Fix:** Replaced both passes with a single combined state machine (`code | line-comment | block-comment | squote | dquote | backtick`) that only checks for quote characters while in the `code` state — a quote inside either comment kind is never seen as a string delimiter, and a `//`/`/*`-looking substring inside a line comment is never seen as a new comment opener (the state machine only watches for the newline/`*/` that ends the CURRENT comment). This is structurally immune to both failure modes at once, not just the `@capacitor/*` one the original design targeted.
- **Files modified:** `tools/ident-sweep.mjs` (rewritten before its first commit — no prior commit to amend)
- **Verification:** Re-ran the recorded sweep — `ident-sweep toast: 0` (down from 13); `--self-test` still `PASS` (all eight self-test cases, including the `@capacitor/*` pitfall case, still resolve correctly under the unified design); full `npm test` unaffected (`# pass 3231, # fail 0` — this tool ships no engine/src changes)
- **Committed in:** `84508dd` (Task 1's own commit — caught and fixed before that commit was made; no bad commit ever landed)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a bug in the tool's own first draft, caught by the plan's own recorded-sweep step before committing)
**Impact on plan:** No scope creep, no architectural change — the fix is entirely internal to `tools/ident-sweep.mjs`'s stripping algorithm; the tool's CLI surface, output format, and `--self-test` contract are unchanged from the plan's specification.

## Issues Encountered

None beyond the one auto-fixed deviation above, caught and resolved before Task 1's commit landed. One plan-authored expectation did not measure exactly as predicted: the plan's Task 1 acceptance criteria state `grep -c "toast" src/browser/narrationLines.js` should print "a number greater than 50" as the positive control for comment stripping; the actual measured count is 45 matching lines (49 total occurrences via `grep -o | wc -l`). This is a fact about the file's current comment density, not a defect in the tool — the positive control's INTENT (a plain grep sees dozens of comment "toast" mentions where the comment-stripped `ident-sweep toast: 0` sees none) holds clearly regardless of the exact number; recorded here for honesty rather than silently rounding up.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Consolidated for the milestone-close Pixel 7 UAT round — no device pauses were taken across this entire phase (every plan's own desk proof — fold-dump diffs, the parity suite, the unit suite, the recorded greps — is the evidence that behavior is unchanged for every reachable path):

1. A save from the current Play build (which serialized `won: false`) still resumes and plays on — the dropped `won` key is silently ignored (tolerant load, pinned by `test/unit/save-validation.test.js`'s DEAD-04 test).
2. On a step, a fight round, and a camp, the RAIL card lines and the fight-log lines read exactly as before this build (no wording, tone, priority, or ordering change — a pure rename, proven by 46-01's byte-identical fold-dump).
3. "THEY ARE DOWN" still shows after a WON FIGHT (not a won run) — `COMBAT_COPY.over.won`, the fight-outcome copy key, is untouched by this phase.
4. Settings shows exactly four rows — sound, haptics, text size, confirm-before-quit — and each persists correctly across a relaunch.
5. An old persisted settings blob (from before this build, still carrying the retired `controlScheme`/`"dpad"` pair) loads without error and without surfacing any control for the dropped field.
6. Nothing else is user-visible across this entire phase — every change is a rename, a dead-code deletion, or a new dev-only tool.

## Next phase readiness

- New modules Phase 47 introduces should import from `src/browser/narrationLines.js` (never the retired `toasts.js` path).
- `window.__mzWornSlots` is confirmed live (kept by user decision) and is in the bridge set Phase 47's SHELL-04 registry must list.
- `tools/ident-sweep.mjs` is available for Phase 48's grep list — pass `-i` for case-insensitive runs; Phase 48's own comment/docs sweep (DOCS-01..03) wants comments INCLUDED, not excluded, so it uses plain `grep` for that half rather than this tool.
- `engine/`, `content/`, fixtures, and the master file are untouched by this plan; the whole phase's engine diff is exactly the six `won`-removal files from 46-02.
- No blockers for Phase 47.

---
*Phase: 46-honest-names-dead-exports-the-tutorial-decision*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: tools/ident-sweep.mjs
- FOUND: .planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-04-SUMMARY.md
- FOUND: commit 84508dd (Task 1 — tools/ident-sweep.mjs)
- FOUND: commit 857bb10 (Task 2 — this SUMMARY)
