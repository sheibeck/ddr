---
phase: 26-mass-playtest-class-pass-ledger
plan: 04
subsystem: testing
tags: [class-pass, ledger, standing-test, structure, provenance, cannot-act, play-02, play-03, phase-close]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 01
    provides: "tools/class-pass-diff.mjs exports (metaParity, cannotActCells, cellKey, buildVerdicts, renderMarkdown, isCannotAct)"
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 02
    provides: "docs/class-pass/after.json + after-depth20.json, ledger AFTER heading/provenance/transcripts, engine pinned d1e3235"
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 03
    provides: "docs/class-pass/verdicts.json, ledger Outliers (Phase 26) + Handoff to Phase 27 sections — eight H2 sections total"
provides:
  - "test/unit/class-pass-ledger.test.js — the standing structural/provenance/cannot-act guard for docs/CLASS-PASS.md + docs/class-pass/*.json, run by the default `npm test`"
  - "Phase 26 close: full suite green (1421/1421), parity suite green (33/33), engine/content/src/shell/tools tree proven identical to the AFTER pin, harness proven identical to the BEFORE pin"
affects: []

tech-stack:
  added: []
  patterns:
    - "A ledger-guard test re-derives every expectation through the diff script's own exported helpers (metaParity, cannotActCells, cellKey, buildVerdicts, renderMarkdown) rather than hand-deriving a parallel copy of the rules, so drift is caught structurally, not by inspection"
    - "section(doc, headingRegex)/h2s(doc) doc-parsing helpers (mirroring test/parity/fixture-inventory.test.js's DOC_PATH pattern) let a Markdown ledger be asserted against like structured data without a Markdown parser dependency"

key-files:
  created:
    - test/unit/class-pass-ledger.test.js
  modified: []

key-decisions:
  - "No ledger fix was needed: all 11 structural/provenance/cannot-act assertions passed against the ledger and JSONs exactly as Plans 26-02/26-03 left them — Plan 26-04 added zero lines to docs/CLASS-PASS.md or docs/class-pass/verdicts.json."
  - "Plan 26-04's own phase-close acceptance criterion (commit-range grep against a hardcoded `f7f294b` anchor, asserting zero engine/content/src/mazeworld.html/tools-lib touches across `f7f294b..HEAD`) does not print 0 as literally written, and this is expected, not a defect: `f7f294b` is the 'docs(26): smart discuss context' commit, which chronologically precedes Phase 25.1 (Device Feedback Batch) — a separate, already-completed, already-summarized phase inserted and executed between Phase 26's context-gathering and its actual Wave 1-4 execution. `git log --oneline f7f294b..HEAD -- engine content src mazeworld.html tools/tune-classes.mjs tools/lib` surfaces eight Phase-25.1 commits plus exactly one Phase-26 commit: `d1e3235 fix(26-02): close the encounter when the opening foe turn kills the last foe (ward reflect / acid) — gap closure for the AFTER cannot-act gate`. That single commit is Plan 26-02's own already-reviewed, already-tested, already-ledger-documented ('this phase's own gap-closure fix') engine bugfix, and `d1e3235` IS the AFTER pin itself — the authoritative phase-close check (`git diff --quiet d1e3235 -- engine content src mazeworld.html tools`) asserts the tree is unchanged SINCE that pin, and it passes (rc=0, verified below). Re-scoping the same grep to the true Phase-26 execution window (`8b52ef0^..HEAD`, i.e. right after Phase 25.1's own close commit) confirms exactly one engine-touching commit in that window: `d1e3235`, and no others. No history was rewritten and no plan file was edited to force a literal 0 — the correct, already-passing gate is the pin-diff, and it is documented here rather than silently worked around."

requirements-completed: [PLAY-03, PLAY-02]

coverage:
  - id: D1
    description: "test/unit/class-pass-ledger.test.js: 11 tests covering fixed H2 section order (Handoff last), AFTER placeholder replaced in place with BEFORE/Rulings anchors intact, the 30-row good/bad table present exactly once, AFTER heading hash == after.json/after-depth20.json meta.commit, BEFORE/AFTER meta parity modulo commit, identical 143-cell key sets, a hard zero-cannot-act assertion plus a NaN walk, verdicts.json schema/editorial rules, Outliers (Phase 26) == revisit set, and the three rendered blocks byte-identical to a fresh render"
    requirement: "PLAY-03"
    verification:
      - kind: automated
        ref: "node --test test/unit/class-pass-ledger.test.js -> '# tests 11 / # pass 11 / # fail 0'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ledger test never asserts a balance number (no meanDepth/p50Depth/reach/meanKills/delta compared to a numeric literal, no revisit/accept row count pinned)"
    requirement: "PLAY-03"
    verification:
      - kind: other
        ref: "grep -v '^\\s*//' test/unit/class-pass-ledger.test.js | grep -Ec '\\.(meanDepth|p50Depth|reach5|reach10|meanKills|delta), -?[0-9]|=== \"revisit\"\\)\\.length, [0-9]|=== \"accept\"\\)\\.length, [0-9]' -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full suite green at the new floor (1410 + 11 ledger tests); parity suite green"
    requirement: "PLAY-02"
    verification:
      - kind: automated
        ref: "npm test -> '# tests 1421 / # pass 1421 / # fail 0'; node --test \"test/parity/**/*.test.js\" -> '# tests 33 / # pass 33 / # fail 0'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Engine/content/src/shell/tools tree proven identical to the AFTER pin; harness proven identical to the BEFORE pin; prototype-master untouched over the phase"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "git diff --quiet d1e32357474a0f232515a19660ea3ed12c3f8b07 -- engine content src mazeworld.html tools (rc=0); git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib (rc=0); git log --oneline 1b4daed..HEAD -- test/parity/prototype-master.js.txt | wc -l -> 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~40min
completed: 2026-09-15
status: complete
---

# Phase 26 Plan 04: Class-Pass Ledger Standing Test Summary

**Turned the class-pass ledger's contract into `test/unit/class-pass-ledger.test.js` (11 passing tests, re-deriving every expectation through the diff script's own exports) with zero ledger fixes needed, then closed Phase 26 with a 1421/1421 full suite, a 33/33 parity suite, and the engine/content/src/shell/tools tree proven byte-identical to the AFTER pin.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-15
- **Tasks:** 2 of 2 complete
- **Files modified:** 1 created (`test/unit/class-pass-ledger.test.js`), 0 ledger/JSON files touched

## Accomplishments

- **Standing ledger guard created and green on the first run:** `test/unit/class-pass-ledger.test.js` (316 lines) — 11 `node:test` cases, each re-deriving its expectation through `tools/class-pass-diff.mjs`'s own exports (`metaParity`, `cannotActCells`, `cellKey`, `buildVerdicts`, `renderMarkdown`) rather than hand-restating the rules. `node --test test/unit/class-pass-ledger.test.js` -> `# tests 11 / # pass 11 / # fail 0` on the first attempt — no ledger fix was needed; Plans 26-02/26-03's acceptance criteria had already checked every one of these facts.
- **All eleven assertions verified independently before writing the test**, so the test file encodes facts already confirmed true of the repo:
  1. Eight H2 headings, fixed order, `## Handoff to Phase 27` last.
  2. No literal `<hash>` / `Nothing recorded yet` placeholder text remains; BEFORE heading hash `5565b222564f8ee2a944e03c1e4a3c27cae09b40` starts with both `before.json` and `before-depth20.json`'s `meta.commit` (`5565b22`); Rulings section carries `### Sub-class rulings`, `### Race rulings`, the IDENT-10 dagger KEEP ruling, the Freeze-pays-out ruling, the Good/bad table heading, and mentions IDENT-05/06/07/09/10.
  3. The `| Sub / Race | GOOD | BAD |` header occurs exactly once in the whole ledger; the table body (header+separator+30 rows) is exactly 32 `| `-prefixed lines.
  4. AFTER heading hash `d1e32357474a0f232515a19660ea3ed12c3f8b07` starts with both `after.json` and `after-depth20.json`'s `meta.commit` (`d1e3235`, equal to each other); the AFTER section carries the backticked short hash, both verbatim `Bot:` lines, the `### Pin and provenance (Phase 26 capture)` sub-heading, exactly two `### AFTER transcript — tune-classes` sub-headings, and its first non-blank line is `**Zero cannot-act cells.**`.
  5. `metaParity(before.meta, after.meta).ok` and `metaParity(beforeDeep.meta, afterDeep.meta).ok` are both `true`; the two `Bot:` lines match modulo `seeds=`/`startDepth=`; `before.meta.commit !== after.meta.commit`.
  6. Natural and depth-20 BEFORE/AFTER pairs each share exactly 143 cell keys; `after.meta.cells === 143`.
  7. `cannotActCells(after)` is `[]`; every `after.json` cell has `stuck === 0`, `completed === n`, and `meanKills >= 0.5`; `afterDeep`'s cells have `stuck === 0`; a full object walk of both files finds no `NaN`.
  8. `verdicts.json` schema `class-pass-verdicts/1`; `meta.after.commit`/`meta.before.commit` match the JSONs; 24 subs, 6 races, `cannotAct.length === 0`, `cells.inBand + cells.outOfBand.length === 143`; only the one out-of-band row (Ninja) carries a verdict/reason, both non-empty; no row's band is `cannot act`; no `fine` row is `revisit`; no `deep.*` row carries a `band`/`verdict` key.
  9. The Outliers (Phase 26) section's revisit set is empty and the section contains the exact sentence "No revisit rows — every out-of-band row was accepted." with zero `| `-prefixed data rows.
  10. `buildVerdicts({ before, after, beforeDeep, afterDeep, prior: verdicts })` rendered fresh through `renderMarkdown` for `after`/`outliers`/`handoff` are each byte-identical substrings of the ledger, and `JSON.stringify` of the fresh build equals `JSON.stringify(verdicts)` — `verdicts.json` is a fixed point of its own generator.
  11. The Handoff section carries all ten required sub-headings and is the last H2 section in the file.
- **Phase close, full suite:** `npm test` -> `# tests 1421 / # pass 1421 / # fail 0` (the 1410-test floor Plan 26-03 left, plus this plan's 11 new ledger tests). `node --test "test/parity/**/*.test.js"` -> `# tests 33 / # pass 33 / # fail 0`.
- **Phase close, pin proofs:** `git diff --quiet d1e32357474a0f232515a19660ea3ed12c3f8b07 -- engine content src mazeworld.html tools` exits `0`; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` exits `0`; `git log --oneline 1b4daed..HEAD -- test/parity/prototype-master.js.txt | wc -l` prints `0`. The combined verify command (`npm test | tail -8 && git diff --quiet <AFTER pin> -- ... && git diff --quiet 5565b22 -- ... && echo PIN_CLEAN`) printed `PIN_CLEAN`.
- **Commit:** `test/unit/class-pass-ledger.test.js` committed alone at `a4f9048` (`test(26-04): class-pass ledger standing guard — sections, anchors, provenance, zero cannot-act`); `git status --porcelain` is empty afterward.

## Test Counts Before / After

| Metric | Before this plan | After this plan |
| --- | --- | --- |
| `npm test` total | 1410 (Plan 26-03's floor) | **1421** (`# fail 0`) |
| Ledger guard tests | 0 | **11** (`# pass 11 / # fail 0`) |
| Parity suite (`test/parity/**/*.test.js`) | 33 | **33** (unchanged — no engine file touched this plan) |

## Deviations from Plan

**None requiring a code or ledger change.** All 11 assertions passed on the first run against the ledger and JSONs exactly as Plans 26-02/26-03 left them; no `docs/CLASS-PASS.md` or `docs/class-pass/verdicts.json` edit was made by this plan.

**One acceptance-criteria clarification (not a Rule 1-4 fix — a pre-existing, already-approved fact from an earlier wave, documented here rather than silently worked around):** Plan 26-04's own Task 2 acceptance criteria included a commit-range grep (`git log --format=%H f7f294b..HEAD | ... | grep -Ec "^ (engine|content|src)/| mazeworld.html | tools/tune-classes.mjs| tools/lib/"`) intended to print `0`, asserting "no phase commit touched the engine, content, shell or harness." Run as literally specified, it prints `19`, not `0`. Root cause, fully diagnosed: `f7f294b` (`docs(26): smart discuss context`) is the commit that gathered Phase 26's *context*, which chronologically precedes Phase 25.1 (Device Feedback Batch) — a separate, already-completed, already-summarized phase that was inserted and fully executed *between* Phase 26's context-gathering and its actual Wave 1-4 execution (see `git log --oneline f7f294b..HEAD`, which shows eight `feat(25.1-0N)`/`docs(25.1)` commits interleaved before Phase 26's own `feat(26-01)` work begins). Re-running the same grep against the true Phase-26 execution window (`8b52ef0^..HEAD`, i.e. starting right after Phase 25.1's own close commit) surfaces exactly one engine-touching commit: `d1e3235 fix(26-02): close the encounter when the opening foe turn kills the last foe (ward reflect / acid) — gap closure for the AFTER cannot-act gate`. That commit is Plan 26-02's own already-reviewed, already-tested engine bugfix — the ledger's AFTER section names it verbatim as "this phase's own gap-closure fix" — and its hash, `d1e3235`, **is the AFTER pin itself**. The phase's authoritative, already-passing gate (`git diff --quiet d1e3235 -- engine content src mazeworld.html tools`, verified `rc=0` above) asserts the tree is unchanged *since* that pin, which is the correct and sufficient no-further-engine-drift proof for a plan (26-04) whose own `files_modified` list is a single test file. No git history was rewritten, no plan file was edited, and no ledger content was altered to force a literal `0` on the stale grep — this note documents the discrepancy instead, per the standing instruction to record deviations rather than weaken a check.

## Known Stubs

None.

## Threat Flags

None — this plan added a test file that reads existing committed files (the ledger, the four class-pass JSONs, `verdicts.json`) and asserts structure/provenance/the cannot-act invariant against them; no new network endpoint, auth path, file-write path, or schema change was introduced.

## Issues Encountered

None beyond the acceptance-criteria clarification documented above (a stale assumption in the plan's own Task 2 acceptance criteria about the commit range, not a bug in the ledger, the diff script, or the new test).

## User Setup Required

None.

## Phase 26 Close

Phase 26 (Mass Playtest & Class-Pass Ledger, PLAY-02/PLAY-03) is complete:

- `tools/class-pass-diff.mjs` (Plan 26-01) — the dev-only, zero-dependency Markdown/verdicts renderer, itself covered by 12 tests in `test/unit/class-pass-diff.test.js`.
- `docs/class-pass/after.json` / `after-depth20.json` (Plan 26-02) — the AFTER matrix at BEFORE volume (143 cells x 40 seeds natural, 143 x 10 at depth 20), captured on pin `d1e3235`, zero cannot-act cells.
- `docs/class-pass/verdicts.json` + the ledger's AFTER comparison block, `## Outliers (Phase 26 — revisit list)`, and `## Handoff to Phase 27` (Plan 26-03) — every sub-class and race judged against the AFTER mu; only Ninja (too strong, accept) and Wilmsry (fine, accept by the plan's named exception) carry a written verdict; zero revisit rows.
- `test/unit/class-pass-ledger.test.js` (this plan, Plan 26-04) — the standing guard, 11 tests, zero balance numbers pinned.
- **Phase-close proof:** `npm test` 1421/1421; parity suite 33/33; `git diff --quiet d1e3235 -- engine content src mazeworld.html tools` rc=0; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` rc=0; `test/parity/prototype-master.js.txt` untouched since `1b4daed`.
- **Phase 26 changed engine code exactly once, deliberately and already reviewed:** the `d1e3235` gap-closure fix in `engine/combat.js` (Plan 26-02), needed to unblock the cannot-act hard gate after a genuine regression was found (a ward-reflect/acid kill on the last foe could leave combat open with nothing alive). That fix is now the AFTER pin itself; no engine/content/src/shell file has changed since.

**Unverified / left to a human:** none identified for this plan. Phase 27 (the human DR round) is the next consumer of `## Handoff to Phase 27`'s yardstick, roll-ups, and the single accepted-but-strong row (Ninja).

---
*Phase: 26-mass-playtest-class-pass-ledger*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: test/unit/class-pass-ledger.test.js
- FOUND commit: a4f9048
