---
phase: 22-class-aware-harness-before-matrix
plan: 04
subsystem: testing
tags: [ledger, before-snapshot, class-pass, dev-only, class-matrix]

requires:
  - phase: 22-class-aware-harness-before-matrix (Plan 02)
    provides: "tools/lib/tuning-bot.mjs — chooseSpell/isTalkFirst/botLine, playRun's startDepth/force/stuck plumbing"
  - phase: 22-class-aware-harness-before-matrix (Plan 03)
    provides: "tools/tune-classes.mjs — the 143-cell worker_threads matrix CLI with --start-depth/--json/--out"
provides:
  - "docs/CLASS-PASS.md — the class-pass ledger: Bot proxy (chooseSpell table transcribed verbatim), reproduce commands, pinned BEFORE section (both transcripts verbatim), Outliers/Findings (stuck-loop fixes + IDENT-01 finding), headed Rulings (Phase 24) and AFTER (Phase 26) placeholders"
  - "docs/class-pass/before.json — natural-start matrix aggregates (143 cells x 40 seeds, 5720 runs), commit-pinned to 5565b22"
  - "docs/class-pass/before-depth20.json — depth-20 slice aggregates (143 cells x 10 seeds, 1430 runs), commit-pinned to 5565b22"
affects: [23, 24, 26, 27]

tech-stack:
  added: []
  patterns:
    - "BEFORE capture discipline mirrors docs/DIFFICULTY-RETUNE.md: commit pin proven via git diff --quiet both before launch and after the final commit, background runs with an EXIT=<code> sentinel, bounded polling (no foreground wait), single ledger commit containing the markdown + both aggregate JSONs together"

key-files:
  created:
    - docs/CLASS-PASS.md
    - docs/class-pass/before.json
    - docs/class-pass/before-depth20.json
  modified: []

key-decisions:
  - "Both BEFORE runs completed with 0 stuck cells (0 of 5,720 natural-start runs, 0 of 1,430 depth-20 runs) — the six planning-time stuck seeds from Plan 22-02's fix all finish well under the matrix's 5,000-action cap, so the Outliers section documents the (resolved) investigation rather than any live stuck cell"
  - "The IDENT-01 engine finding (a Wizard/Magic User with charges but no castable attack spell cannot melee — playerStrike refuses unconditionally while any charge remains) is documented as a Phase 23 finding, not fixed here — Phase 22's scope explicitly excludes engine rule changes beyond the dev-only force option from Plan 22-01"
  - "An unrelated, out-of-band modification to .planning/PROJECT.md (a new Evolution row about a depth-20 difficulty target, timestamped mid-run at 16:33, not made by this plan) was left untouched and excluded from the commit — it is outside this plan's files_modified scope (docs/CLASS-PASS.md, docs/class-pass/before*.json only) and staging it would have been an undocumented scope violation"

requirements-completed: [PLAY-01]

coverage:
  - id: D1
    description: "The natural-start BEFORE matrix (143 cells x 40 seeds, 5720 runs) completed against the pinned, proven-clean engine; aggregate JSON on disk with correct meta (seeds=40, startDepth=1, maxActions=5000, workers=4, 143 cells, commit=5565b22, no rows key, 0 stuck)"
    requirement: "PLAY-01"
    verification:
      - kind: other
        ref: "node -e verify script: '40 1 5000 4 143 false' printed; meta.commit matches git rev-parse --short HEAD; git diff --quiet HEAD -- engine content src mazeworld.html rc=0; git diff --name-only 1b4daed HEAD -- engine content src mazeworld.html = 'engine/character.js engine/state.js'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The depth-20 BEFORE slice (143 cells x 10 seeds, 1430 runs) completed against the same pinned engine and identical bot parameters (Bot: line equal apart from seeds/startDepth); aggregate JSON on disk with correct meta (seeds=10, startDepth=20, 143 cells, no rows key, every cell n=10, every non-null meanDepth >= 20)"
    requirement: "PLAY-01"
    verification:
      - kind: other
        ref: "node -e verify script: '10 20 143 false true true' printed; Bot: line parity check (seeds/startDepth normalized) printed true"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CLASS-PASS.md exists with >=6 top-level sections (Bot proxy, How to reproduce, BEFORE, Outliers/Findings, Rulings, AFTER), both Bot: lines transcribed verbatim, the pinned hash, 1b4daed, Samurai/Wizard findings, IDENT-01, and headed Rulings/AFTER placeholders; committed in one commit with both JSONs on an engine tree proven unchanged before and after"
    requirement: "PLAY-01"
    verification:
      - kind: other
        ref: "grep -c checks: 6 '## ' headers, PIN appears 4x, both meta.bot lines appear 1x each, '1b4daed' 2x, 'Samurai' 20x, 'Wizard' 20x, 'IDENT-01' 2x, exactly 1 each of Rulings/AFTER/Outliers headers; git show --stat HEAD lists all 3 files; git diff --quiet <PIN> -- engine content src mazeworld.html rc=0 post-commit; parity master untouched (0 commits touching it since 1b4daed)"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-14
status: complete
---

# Phase 22 Plan 04: Class-Pass BEFORE Snapshot Summary

**Captured the PLAY-01 BEFORE matrix (143 cells x 40 seeds natural-start + 143 cells x 10 seeds at depth 20, 7,150 total runs, 0 stuck) against the commit-pinned pre-identity-pass engine (5565b22) and committed it to the new `docs/CLASS-PASS.md` ledger with both aggregate JSONs — Phase 23 may now begin.**

## Performance

- **Duration:** 21 min
- **Completed:** 2026-09-14
- **Tasks:** 3/3 completed
- **Files modified:** 3 (all created)

## Accomplishments

- **Preflight proved the capture's provenance is sound**: clean working tree, `npm test` at 989/989 (`# fail 0`), the pin commit `5565b222564f8ee2a944e03c1e4a3c27cae09b40` (short `5565b22`) confirmed `git diff --quiet`-clean against `engine content src mazeworld.html`, and the diff between the pin and the v1.1-close baseline `1b4daedac1f3686f86b919208476641fa2547e2c` confirmed to touch exactly `engine/character.js` and `engine/state.js` (the dev-only `force` option from Plan 22-01, nothing else).
- **Natural-start matrix**: `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/before.json` — 143 cells x 40 seeds = 5,720 runs, completed in 687.2s (~11.5 min), **0 stuck runs**. Top cell: Thief/Ninja/Wilmsry (mean depth 5.38); bottom cell: Magic User/Illusionist/Dwarven (mean depth 1.63). BY CLASS ranking: Thief (3.42) > Fighter (3.05) > Magic User (2.44).
- **Depth-20 slice**: `node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/before-depth20.json` — 143 cells x 10 seeds = 1,430 runs, completed in 38.4s, **0 stuck runs**. Every cell reached >=5%/>=10% at 100% (deep-start characters always survive to be measured), mean floors gained ranged 0.00-1.00 above the depth-20 start.
- Verified both JSON snapshots carry the correct `meta` (seeds/startDepth/maxActions/workers/commit/cells=143), contain no `rows` key anywhere (aggregates only), and their `Bot:` lines are byte-identical apart from `seeds=`/`startDepth=` — confirming BEFORE and AFTER (Phase 26) will be directly grep-diffable.
- Wrote `docs/CLASS-PASS.md` (623 lines): a purpose paragraph explaining the 143-vs-144-combo footnote, a Bot proxy section transcribing `chooseSpell`'s full scoring table verbatim from Plan 22-02 plus every opener/talk-first/scroll-reading rule in prose, a parameter table, exact reproduce commands, the pinned BEFORE section with both full transcripts pasted verbatim, an Outliers/Findings section documenting the resolved Samurai/Wizard stuck-loop investigation and the IDENT-01 engine finding carried to Phase 23, and headed placeholders for Phase 24's Rulings and Phase 26's AFTER.
- Committed all three files (`docs/CLASS-PASS.md`, `docs/class-pass/before.json`, `docs/class-pass/before-depth20.json`) in one commit; re-verified `git diff --quiet 5565b22 -- engine content src mazeworld.html` still exits 0 after the commit, and the parity master (`test/parity/prototype-master.js.txt`) has zero commits touching it since `1b4daed`.
- Full `npm test`: 989/989 passing, unchanged (this plan touches only `docs/`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the engine, prove it clean, run the natural-start BEFORE matrix** — no commit (the JSON artifact is written by the tool, not staged until Task 3's single ledger commit, per the plan's explicit "do not commit yet" instruction)
2. **Task 2: Run the depth-20 BEFORE slice** — no commit (same deferral)
3. **Task 3: Write docs/CLASS-PASS.md and make the single BEFORE commit** — `d708d80` (docs)

_No TDD gating on this plan (`tdd` not set on any task); Tasks 1-2 produce artifacts without committing per the plan's explicit design (one atomic ledger commit covering all three files, per the threat register's T-22-15 partial-snapshot mitigation)._

## Files Created/Modified

- `docs/CLASS-PASS.md` - new class-pass ledger: purpose, Bot proxy (chooseSpell table + policy prose), reproduce commands, pinned BEFORE section (both transcripts verbatim), Outliers/Findings, headed Rulings/AFTER placeholders
- `docs/class-pass/before.json` - natural-start BEFORE matrix aggregates (143 cells x 40 seeds, commit-pinned to 5565b22)
- `docs/class-pass/before-depth20.json` - depth-20 BEFORE slice aggregates (143 cells x 10 seeds, commit-pinned to 5565b22)

## Decisions Made

See `key-decisions` in frontmatter — summarized: both BEFORE runs came back with 0 stuck cells (the Plan 22-02 fixes hold at full matrix scale, not just the six planning-time seeds); the IDENT-01 "Wizard cannot melee with charges but no attack spell" finding is documented as a Phase 23 target, deliberately not fixed here (out of this phase's engine-change scope); an unrelated out-of-band edit to `.planning/PROJECT.md` (a new Evolution table row, not made by this plan) was left unstaged and excluded from the commit to keep the ledger commit scoped to exactly the three files the plan specifies.

## Deviations from Plan

None — plan executed exactly as written. One observation, not a deviation: `git status --porcelain` after the final commit is not fully empty because of the unrelated `.planning/PROJECT.md` modification noted above; every acceptance-criteria check that specifically concerns this plan's own scope (engine tree cleanliness, the three committed files, parity master untouched) passed.

## Issues Encountered

None. Both background matrix runs completed cleanly on the first attempt (no aborts, no partial snapshots, no worker errors).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 23 (Casters Can Act) may now begin.** The BEFORE snapshot is committed and pinned — `docs/CLASS-PASS.md` plus `docs/class-pass/before.json`/`before-depth20.json` are the permanent, git-recoverable baseline against the pre-identity-pass engine (`5565b22`), exactly as required before any Phase 23 engine commit lands.
- **IDENT-01 is pre-documented**: `docs/CLASS-PASS.md`'s Outliers/Findings section already names the exact engine gap (`playerStrike` refuses melee while any charge remains, `combat.js:337`, regardless of whether a castable attack spell exists) that Phase 23's guaranteed-attack-spell work needs to close.
- **Phase 26's AFTER capture has an exact template**: the "AFTER — commit `<hash>` (Phase 26 — PLAY-02)" placeholder in the ledger already names the two reproduce commands with `--out docs/class-pass/after.json`/`after-depth20.json`, so Phase 26 only needs to run them, paste transcripts, and grep-diff the `Bot:` lines against this plan's BEFORE lines.
- No blockers. `npm test`: 989/989. The Engine Gate holds — this plan touched only `docs/`, no engine/content/src files; `git diff --quiet` against both the pin and the v1.1 baseline confirms it.

---
*Phase: 22-class-aware-harness-before-matrix*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: docs/CLASS-PASS.md
- FOUND: docs/class-pass/before.json
- FOUND: docs/class-pass/before-depth20.json
- FOUND: .planning/phases/22-class-aware-harness-before-matrix/22-04-SUMMARY.md
- FOUND commit: d708d80
