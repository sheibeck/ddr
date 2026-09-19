---
phase: 46-honest-names-dead-exports-the-tutorial-decision
plan: 03
subsystem: shell
tags: [dead-code, settings, tutorial, honest-names, tolerant-load]

requires:
  - phase: 46
    provides: "46-01's narrationLines rename and 46-02's winGame/won removal — this plan's two deletions are independent of both, no import surface overlap"
provides:
  - "src/browser/settings.js with exactly four persisted fields (sound, haptics, textSize, confirmBeforeQuit); the controlScheme setting and its 'dpad' default/allowed value are gone; readSettings's existing merge-only-SETTINGS_DEFAULTS-keys mechanism IS the tolerant load for an old blob carrying the retired key"
  - "src/browser/tutorial.js (the 04-era coach-mark sequencer, zero references) deleted along with its ten sequencer/tutorialSeen tests"
  - "test/unit/icons.test.js (git mv'd from tutorial.test.js, history follows) carrying the fifteen surviving icons.js pins unchanged"
  - "PROJECT.md Key Decisions row + onboarding Active row, and REQUIREMENTS.md's UX-06 backlog row, all recording that the 04-era sequencer was deleted in Phase 46 and UX-06 is rebuilt from scratch on the Phase 47 modular shell"
affects: [46-04, 47, 48]

tech-stack:
  added: []
  patterns:
    - "Fragment-built retired-literal test pin (the shell-map-invariants RETIRED-map idiom): a new settings.test.js pin builds the retired key/value from string fragments (\"control\" + \"Scheme\", \"dp\" + \"ad\") so the test proving a retired identifier's tolerant handling never itself spells that identifier — keeping the plan's own zero-straggler grep clean of its own pin"
    - "Tolerant load by omission (settings.js precedent, mirrors saveState.js#foldLegacyCounters): readSettings() already only merges SETTINGS_DEFAULTS keys from a persisted blob — removing a key from SETTINGS_DEFAULTS IS the tolerant load; no fold, no migration code required"

key-files:
  created:
    - test/unit/icons.test.js
  modified:
    - src/browser/settings.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js
    - mazeworld.html
    - src/browser/icons.js
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "A pre-existing mazeworld.html comment (predates this plan, present at the phase-start baseline 2afe0e5) spelled the retired 'controlScheme' identifier by name and was not in Task 1's files_modified list or read_first. Fixed it (Rule 3 — blocking: the task's own explicit zero-straggler grep gate cannot return zero without this one-line comment edit) rather than leave it, since the task names the grep as the literal, primary proof of NAME-02's D-pad row. This creates a one-line conflict with the task's separate 'git diff --stat HEAD~1 -- engine/ content/ mazeworld.html prints nothing' acceptance line (which assumed no mazeworld.html touch was needed); the more specific, repeatedly-named zero-straggler grep took priority. engine/ and content/ remain untouched (confirmed below)."
  - "A git-add pathspec error mid-Task-2 (mixing a `git rm`'d path in the same `git add` call as still-pending edits) caused the first Task 2 commit to land with only the tutorial.js deletion + the tutorial.test.js->icons.test.js rename, missing the icons.js citation update and both .planning docs edits that were meant to ride in the same commit. Corrected in-place with `git reset --soft HEAD~1` (moves HEAD back one commit, index/working tree untouched — not `--amend`, not `--hard`, no shared history rewritten) followed by staging every intended file and re-committing once, so Task 2 still lands as exactly one commit with its full intended content and grep."
  - "The two dpad1/dpad2/dpad3 fragment-built test pins in shell-map-invariants.test.js and shell-map-viewport.test.js, and the frozen test/parity/prototype-master.js.txt, are pre-existing survivors of the controlScheme|dpad grep — verified present at baseline 2afe0e5 (before this phase started) via `git show 2afe0e5:...`. They pin a different retired concept entirely (the physical on-screen D-pad HTML element/CSS class, already removed pre-Phase-46) and are out of this task's scope (not in files_modified, unrelated content). Left untouched per the deviation-rules scope boundary."

requirements-completed: [DEAD-05]

coverage:
  - id: D1
    description: "The controlScheme setting deleted end to end: settings.js is a four-field model, an old persisted blob carrying the retired key/value loads tolerantly (pinned by a fragment-built test that never spells the retired identifier), the 5-key pins in settings.test.js and shell-gear-toolbar.test.js are re-pinned to 4, and the zero-straggler grep for controlScheme|dpad returns nothing outside the frozen prototype file and two unrelated pre-existing D-pad-element pins"
    requirement: "NAME-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/settings.test.js test/unit/shell-gear-toolbar.test.js test/unit/shell-map-invariants.test.js test/unit/shell-map-viewport.test.js — # pass 99 (net across the four files), # fail 0"
        status: pass
      - kind: unit
        ref: "npm test — # pass 3241, # fail 0"
        status: pass
      - kind: other
        ref: "grep -rnE \"controlScheme|dpad\" src/ engine/ content/ tools/ mazeworld.html test/ | grep -vE \"prototype-master.js.txt|shell-map-invariants.test.js|shell-map-viewport.test.js\" — (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tutorial.js and its ten sequencer/tutorialSeen tests deleted; the fifteen icons.js pins the test file also carried moved verbatim (git mv, history follows) to test/unit/icons.test.js; icons.js's header citation repointed; the decision recorded in PROJECT.md (Key Decisions + onboarding Active row) and REQUIREMENTS.md's UX-06 row"
    requirement: "DEAD-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/icons.test.js — # tests 15, # fail 0"
        status: pass
      - kind: unit
        ref: "npm test — # pass 3231, # fail 0"
        status: pass
      - kind: other
        ref: "grep -rnE \"tutorial\" src/ engine/ content/ tools/ mazeworld.html test/ — (empty); test -f src/browser/tutorial.js and test -f test/unit/tutorial.test.js both fail; www/src/browser/tutorial.js absent after build:www"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-19
status: complete
---

# Phase 46 Plan 03: controlScheme + tutorial.js Deletion Summary

**Deleted the `controlScheme` setting (four-field settings model, old blobs drop the key on read) and `src/browser/tutorial.js` (the 04-era coach-mark sequencer, zero references) with its ten tests, moving the fifteen icons.js pins the test file also held to `test/unit/icons.test.js` and recording the tutorial decision in PROJECT.md and REQUIREMENTS.md.**

## Performance

- **Duration:** ~35min
- **Started:** 2026-09-19 (mid-afternoon session)
- **Completed:** 2026-09-19T21:34:03Z
- **Tasks:** 3
- **Files modified:** 8 (4 in Task 1's commit, 5 in Task 2's commit, 1 new SUMMARY)

## Accomplishments

- `src/browser/settings.js`: `SETTINGS_DEFAULTS`/`ALLOWED_VALUES` now carry exactly four fields (`sound`, `haptics`, `textSize`, `confirmBeforeQuit`); header prose reworded (five→four, six→four); `readSettings()`'s existing "merge only `SETTINGS_DEFAULTS` keys" mechanism is unchanged and IS the tolerant load — an old blob's retired key is simply never copied
- `test/unit/settings.test.js`: the defaults/round-trip/invalid-value tests re-pinned to the four fields; the Phase 33 handedness key-list pin (`Object.keys(SETTINGS_DEFAULTS)`) updated to the 4-entry list; a new fragment-built pin — `Phase 46 (NAME-02): a stored control-scheme key is ignored silently` — proves the tolerant drop without ever spelling `controlScheme`/`dpad` as literals (built from `"control" + "Scheme"` / `"dp" + "ad"`), also asserting the settings source itself doesn't contain either fragment-joined string
- `test/unit/shell-gear-toolbar.test.js`: the `SETTINGS_DEFAULTS` key-order pin drops the retired key, title says "exactly 4 fields"
- `src/browser/tutorial.js` deleted (98 lines); `test/unit/tutorial.test.js` `git mv`'d to `test/unit/icons.test.js` — the ten sequencer/tutorialSeen tests removed, the fifteen icons.js pins (`FEATURE_ICONS`, `PLAYER_MARKER_ICON`, `featureKeyForCell`, `drawFeatureIcon` rotation + scale) kept verbatim, `makeFakeCtx` kept, `withFakeLocalStorage`/`flushStorage` import removed (tutorial-only helpers)
- `src/browser/icons.js`'s header citation repointed from `test/unit/tutorial.test.js` to `test/unit/icons.test.js`
- `.planning/PROJECT.md`: a new Key Decisions row records the tutorial.js deletion and rationale; the onboarding Active row (L53) gains "— rebuilt from scratch on the modular shell (Phase 46 deleted the 04-era sequencer)"
- `.planning/REQUIREMENTS.md`: the UX-06 backlog row reworded to state the same
- Both zero-straggler greps (`controlScheme|dpad` and `tutorial`) return empty over `src/ engine/ content/ tools/ mazeworld.html test/`, modulo the documented pre-existing/unrelated survivors below

## Task Commits

1. **Task 1: delete the controlScheme setting — four-field settings model, tolerant read of old blobs pinned with fragment-built literals** — `645980a` (refactor)
2. **Task 2: delete tutorial.js, move tutorial.test.js → icons.test.js keeping the 15 icons pins, record the DEAD-05 decision in PROJECT.md and REQUIREMENTS.md** — `5e6be1b` (refactor)

**Plan metadata:** committed via `<final_commit>` (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Both grep proofs, verbatim

```
$ grep -rnE "controlScheme|dpad" src/ engine/ content/ tools/ mazeworld.html test/ | grep -vE "test/parity/prototype-master\.js\.txt|test/unit/shell-map-invariants\.test\.js|test/unit/shell-map-viewport\.test\.js"
(empty)
```

```
$ grep -rnE "tutorial" src/ engine/ content/ tools/ mazeworld.html test/
(empty)
```

The `controlScheme|dpad` grep's raw (unfiltered) output before excluding the three documented survivor files:

```
mazeworld.html:5156:    // handler below, which no longer reads controlScheme at all.   <- fixed by this plan (Deviations)
test/parity/prototype-master.js.txt:2771:document.getElementById("dpad")...             <- frozen prototype, pre-existing, never edited
test/unit/shell-map-invariants.test.js:79-81,114,401 (dpad1/dpad2/dpad3)                 <- pre-existing, unrelated (physical D-pad element)
test/unit/shell-map-viewport.test.js:101-102 ("dpad" test title/array)                   <- pre-existing, unrelated (physical D-pad element)
```

## The tutorial decision (DEAD-05)

**Deleted.** `src/browser/tutorial.js` (98 lines: the pure coach-mark sequencer + `mazeworld.tutorialSeen` persistence) had zero references outside its own test file — the module encoded the 04-era UI (fixed steps overlaid on a D-pad map; `04-10-PLAN.md` was already marked "re-plan, don't execute as-is" before this phase). UX-06 (first-run tutorial) is rebuilt from scratch on the Phase 47 modular shell — the stated reason SHELL-01..03 exist.

Recorded in three places, per the plan's must-have:
1. `.planning/PROJECT.md` Key Decisions table — new row: "`src/browser/tutorial.js` (the 04-era coach-mark sequencer) deleted; UX-06 first-run tutorial rebuilt from scratch on the Phase 47 modular shell — Phase 46, 2026-09-19 (user)".
2. `.planning/PROJECT.md`'s onboarding Active row (L53) — gains "— rebuilt from scratch on the modular shell (Phase 46 deleted the 04-era sequencer)".
3. `.planning/REQUIREMENTS.md`'s UX-06 backlog row — reworded to "first-run tutorial — rebuilt from scratch on the modular shell (Phase 46 deleted the 04-era sequencer; the reason SHELL-01..03 exist)".

## Test file moved, not deleted

`git mv test/unit/tutorial.test.js test/unit/icons.test.js` — history follows (`git log --follow --oneline -- test/unit/icons.test.js` returns 5 commits back to `04-03`'s original RED commit).

**Ten tutorial tests removed:**
1. `makeTutorialSequencer: current() starts at the first step`
2. `makeTutorialSequencer: next() advances through every fixed step in order`
3. `makeTutorialSequencer: next() past the last step completes the sequence`
4. `makeTutorialSequencer: dismiss() completes the sequence immediately from any step`
5. `makeTutorialSequencer: an empty step list starts already complete`
6. `getTutorialSeen(): unset store defaults to false (fail-open — tutorial shows on a genuine first run)`
7. `setTutorialSeen()/getTutorialSeen(): round-trips through storage.js (window.mzStorage's backing abstraction)`
8. `tutorial.js never touches raw localStorage directly (only via storage.js/window.mzStorage)`
9. `COACH_MARK_STEPS: exactly the ~4 fixed onboarding steps from 04-CONTEXT.md (move / trap / descend / starving)`
10. `COACH_MARK_STEPS: every step's copy stays within the 'no wall of text' length cap`

**Fifteen icons.js tests kept verbatim** (FEATURE_ICONS/PLAYER_MARKER_ICON/featureKeyForCell × 3, icons-import-cleanly, drawFeatureIcon rotation × 5, drawFeatureIcon scale × 3, drawFeatureIcon centered-rotation) — `node --test test/unit/icons.test.js` confirms `# tests 15, # fail 0`.

**Why the move, not a straight delete:** the CONTEXT's scouting note ("delete tutorial.test.js, 277 lines") missed that 15 of the file's 25 tests pin `src/browser/icons.js`, not `tutorial.js` — the plan itself flagged and corrected this in its objective text; this SUMMARY confirms the correction held.

## Tests re-pinned or deleted

| File | Kind | Reason |
|---|---|---|
| `test/unit/settings.test.js` | re-pinned | Defaults test retitled, drops the control-scheme assertion; round-trip test retitled "each of the 4 fields", drops the control-scheme write/expected key; invalid-value test's three control-scheme lines deleted; the Phase 33 handedness test's key-list pin now lists 4 keys, length 4 |
| `test/unit/settings.test.js` | new test added | `Phase 46 (NAME-02): a stored control-scheme key is ignored silently` — fragment-built retired key/value, proves tolerant drop on read and a no-op `writeSetting`, and that the settings source spells neither fragment-joined literal |
| `test/unit/shell-gear-toolbar.test.js` | re-pinned | `SETTINGS_DEFAULTS` key-order list drops the retired key (now 4 entries), title says "exactly 4 fields" |
| `test/unit/tutorial.test.js` → `test/unit/icons.test.js` | moved + ten tests deleted | See "Test file moved, not deleted" above |

`npm test` count: 3,241 (after Task 1: +1 net, the new fragment-built pin) → 3,231 (after Task 2: −10 net, the ten removed tutorial tests). Matches the plan's stated ledger exactly.

## NAME-02 allowed survivors (this plan)

None beyond the pre-existing, unrelated survivors already documented in the grep proof above (the two `dpad1/dpad2/dpad3` fragment pins and the frozen prototype file) — no new survivor was introduced by this plan's own edits.

## Storage keys

- **The retired `controlScheme` settings key:** dropped on read (never merged from a persisted blob once removed from `SETTINGS_DEFAULTS`), and the very next `writeSetting()` call rewrites the blob without it. No code anywhere names the key or its `"dpad"` value except the new fragment-built test pin, which builds both from string fragments specifically so it never spells them whole.
- **The `mazeworld.tutorialSeen` key:** never written by a shipped build (per 46-CONTEXT.md's Phase-33 research: the coach-mark overlay was never wired into the shell). No migration, fold, or reservation exists or was added — if a stale value under that key were ever present on a device, it is simply never read by anything now, since `getTutorialSeen`/`setTutorialSeen` no longer exist.

## Files Created/Modified

- `src/browser/settings.js` — four-field `SETTINGS_DEFAULTS`/`ALLOWED_VALUES`; header prose reworded; `readSettings`/`writeSetting` unchanged (the tolerant load was already structural)
- `test/unit/settings.test.js` — 5→4 re-pins across four existing tests; one new fragment-built tolerant-load test
- `test/unit/shell-gear-toolbar.test.js` — key-order pin drops the retired key
- `mazeworld.html` — one comment (L5156 area) reworded off the literal `controlScheme` spelling (see Deviations)
- `src/browser/tutorial.js` — deleted
- `test/unit/tutorial.test.js` → `test/unit/icons.test.js` — `git mv`, ten tests removed, header rewritten, fifteen icons.js pins kept
- `src/browser/icons.js` — header citation repointed to `test/unit/icons.test.js`
- `.planning/PROJECT.md` — new Key Decisions row + onboarding Active row annotation
- `.planning/REQUIREMENTS.md` — UX-06 backlog row annotation

## Decisions Made

See `key-decisions` in the frontmatter: the mazeworld.html comment fix (Rule 3, blocking — required for the task's own named grep gate), and the `git reset --soft HEAD~1` self-correction for Task 2's commit (a mechanical `git add` pathspec-ordering mistake, corrected without `--amend` and without touching the working tree/index state, before this plan handed back — no shared history was rewritten, nothing was force-pushed, and the two-commits-per-plan structure was preserved).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `mazeworld.html` carried a pre-existing comment spelling the retired `controlScheme` identifier**
- **Found during:** Task 1's post-edit zero-straggler grep (`grep -rnE "controlScheme|dpad" ... mazeworld.html test/`)
- **Issue:** A comment near `applySettings()` (L5156 at baseline `2afe0e5`, predating this entire phase) read "...the viewport gesture handler below, which no longer reads controlScheme at all." — a literal hit the task's own stated gate requires to be zero. `mazeworld.html` was not in Task 1's `files_modified` list, so this wasn't anticipated by the plan's read_first/action text.
- **Fix:** Reworded the comment to describe the same fact (tap-to-move is the only movement surface, nothing settings-gated in the gesture handler) without spelling the retired identifier.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -rnE "controlScheme|dpad" src/ engine/ content/ tools/ mazeworld.html test/` returns only the three pre-existing, unrelated survivors documented above; `git diff --stat 645980a~1 -- engine/ content/` still empty (only `mazeworld.html` gained the one-line comment edit, not engine/content)
- **Committed in:** `645980a` (Task 1's own commit)

**2. [Rule 3 - Blocking] A `git add` pathspec-ordering mistake left Task 2's first commit incomplete**
- **Found during:** Post-commit verification of Task 2 (`git status --short` after the first `git commit` for Task 2 showed `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `src/browser/icons.js`, and `test/unit/icons.test.js`'s content edits still unstaged)
- **Issue:** A single `git add` call mixed the already-`git rm`'d `src/browser/tutorial.js` path (which `git add` rejects with a "did not match any files" pathspec error, since the path no longer exists on disk) with the still-unstaged edits to `icons.js`/`icons.test.js`/PROJECT.md/REQUIREMENTS.md; the pathspec error aborted the whole `git add` before it reached the later files, so those edits were never staged, and the resulting commit landed with only the `git rm`/`git mv` content (missing the icons.js citation and both docs notes)
- **Fix:** `git reset --soft HEAD~1` (moves HEAD back one commit; index and working tree untouched — the removed commit's full content re-appears as staged/unstaged exactly as before, nothing discarded), then staged every intended file explicitly and re-committed once with the full intended message and content
- **Files modified:** none beyond what Task 2 already intended (`src/browser/tutorial.js`, `test/unit/tutorial.test.js`→`icons.test.js`, `src/browser/icons.js`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`)
- **Verification:** `git status --porcelain` clean after the re-commit; `git show --stat HEAD` lists all five intended files; `grep -c "Phase 46 deleted the 04-era sequencer" .planning/PROJECT.md` / `.planning/REQUIREMENTS.md` both return 1; `grep -c "test/unit/icons.test.js" src/browser/icons.js` returns 1; `npm test` still `# pass 3231, # fail 0` after the re-commit
- **Committed in:** `5e6be1b` (Task 2's corrected, final commit — no `--amend` used; the discarded intermediate commit was never pushed or reported to any caller)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues required for the plan's own stated gates to pass)
**Impact on plan:** No scope creep, no architectural change. The commit count and structure (two commits, one per deletion) held exactly as the plan specified once corrected; the extra file touched (`mazeworld.html`, one comment line) was necessary for Task 1's own named zero-straggler grep, not a new behavior.

## Issues Encountered

None beyond the two auto-fixed deviations above, both caught and resolved before this plan's work was handed back.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Consolidated for the milestone-close Pixel 7 UAT round — no device pauses were taken this plan (neither deletion has a UI control to begin with: no settings screen shows a control-scheme toggle, and the tutorial overlay was never wired into the shell):

1. On the Pixel 7, Settings still shows exactly four rows — sound, haptics, text size, confirm-before-quit — and each persists correctly across a relaunch (the four-field model, live).
2. An old persisted settings blob (from before this build, still carrying the retired `controlScheme`/`"dpad"` pair) loads without error and without surfacing any control for the dropped field — nothing else is user-visible; there is no tutorial overlay to check because none was ever shown by a shipped build.

## Next Phase Readiness

- `src/`, `engine/`, `content/`, `tools/`, `mazeworld.html`, and `test/` are clean of `controlScheme`/`dpad` (outside the two documented pre-existing, unrelated D-pad-element pins and the frozen prototype master) and of `tutorial` entirely.
- `engine/` and `content/` are untouched by this plan (`git diff --stat 39c5a0f -- engine/ content/` still lists only 46-02's six engine files, nothing from this plan); zero fixture moves; `test/parity/prototype-master.js.txt` hash unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.
- `git log --oneline 39c5a0f..HEAD | grep -vcE "^[0-9a-f]+ docs\("` returns 6 (46-01's 2 + 46-02's 2 + this plan's 2) — the phase's non-docs commit count matches the plan's own stated expectation exactly, despite the Task 2 self-correction (the correction replaced, not added to, that commit).
- Phase 46 Plan 04's closing NAME-02 zero-straggler grep inherits a clean surface from this plan; no blockers for Plan 04.

---
*Phase: 46-honest-names-dead-exports-the-tutorial-decision*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: .planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-03-SUMMARY.md
- FOUND: commit 645980a (Task 1 — controlScheme deletion)
- FOUND: commit 5e6be1b (Task 2 — tutorial.js deletion, icons.test.js move, docs notes)
- FOUND: test/unit/icons.test.js
- CONFIRMED: src/browser/tutorial.js absent
