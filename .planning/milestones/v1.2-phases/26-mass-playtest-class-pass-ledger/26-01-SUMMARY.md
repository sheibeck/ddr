---
phase: 26-mass-playtest-class-pass-ledger
plan: 01
subsystem: tools
tags: [class-pass, dev-tool, diff, fun-band, ledger, zero-deps, play-02]

# Dependency graph
requires:
  - phase: 22-hardening-tuning-harness
    plan: 04
    provides: "tools/lib/class-matrix.mjs (rankCells, summarizeRows, enumerateCells), docs/class-pass/before.json + before-depth20.json"
provides:
  - "tools/class-pass-diff.mjs: BAND_LOW/BAND_HIGH/CANNOT_ACT_KILLS/BAND_ORDER, cellKey, muOverRuns, bandFor, isCannotAct, rowBand, metaParity, rankRollupRows, pooledReach, cannotActCells, buildVerdicts, mergeEditorial, renderMarkdown, --gate CLI"
  - "test/unit/class-pass-diff.test.js: 12 tests pinning every band/cannot-act edge, ordering, self-diff, editorial merge, rendering, CLI determinism, --gate"
affects: ["26-02", "26-03", "26-04"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verdicts.json carries supplementary rollups/classes fields beyond the schema's headline sections (subs/races/cells/deep) so renderMarkdown(verdicts, section) can render the By-class and Handoff roll-up tables from the verdicts object alone, without renderMarkdown ever touching raw before/after reports directly"
    - "editorial fields (verdict/reason/lever) are always emitted null by buildVerdicts and only ever set by mergeEditorial, copying by key from a --verdicts prior file — the script never invents editorial text"
    - "every ordering funnels through class-matrix.mjs's rankCells; rollup rows (byClass/bySub/byRace, natural and depth-20) are ranked by mapping key -> sub and race -> \"\" before calling rankCells, so no second comparator is ever written"

key-files:
  created:
    - tools/class-pass-diff.mjs
    - test/unit/class-pass-diff.test.js
  modified: []

key-decisions:
  - "mu is run-weighted (sum(meanDepth x completed) / sum(completed) over cells with completed > 0), stated in both the script header and meta.mu.basis === 'runs' — the script header also explains it coincides with the unweighted mean over cells when every cell has the same seed count and zero stuck runs, matching 26-CONTEXT.md's 'prefer runs' recommendation"
  - "verdicts.json's documented shape (schema/meta/cannotAct/subs/races/cells/deep) is extended with classes (3 by-class BEFORE/AFTER rows, no band/verdict — class is the top grouping) and rollups (raw AFTER-only ranked natural + depth-20 roll-ups) so renderMarkdown needs only the verdicts object, never the raw before/after reports, to render every table including By-class and the Handoff section"
  - "the CANNOT-ACT GATE FAILED headline table (only reachable when cannotAct is non-empty — never exercised against real data, since BEFORE has zero cannot-act cells) derives Class/Sub/Race by splitting cannotActCells' key on '/' since class/sub/race names never contain a slash; no test in this plan exercises that branch's exact table shape, only its presence"

requirements-completed: [PLAY-02]

coverage:
  - id: D1
    description: "Band edges are exact and documented: a row whose mean depth equals 0.75*mu or 1.35*mu is fine (closed interval); a cell with meanKills exactly 0.5 is NOT cannot-act (0.49 is)"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'bandFor: closed interval...'; #'isCannotAct/rowBand: meanKills exactly 0.5...'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cell with completed 0 is cannot-act with null (never NaN) depth stats; a missing BEFORE cell reports delta as n/a without throwing; BEFORE/AFTER share 143 cell keys"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'isCannotAct/rowBand...' (NaN walk); #'missing BEFORE cell: delta null, Markdown shows n/a, no throw'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rankings use the harness's tie-break (rankCells, reused not re-derived); BEFORE and AFTER rank the same way; output is byte-stable across runs"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'ordering: ...'; #'CLI determinism: two runs on the same inputs are byte-identical...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "mu is computed over runs (run-weighted); the script header and meta.mu.basis both say so"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'muOverRuns: run-weighted over cells with completed > 0...'; verified in --json output: meta.mu.basis === \"runs\""
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/class-pass/verdicts.json has verdict/reason/lever present and null on every sub/race row unless copied from a --verdicts input; the script never invents editorial text"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'self-diff: ...' (all null); #'mergeEditorial: copies verdict/reason/lever by key, rejects unknown verdict values, idempotent'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The AFTER Markdown begins with the cannot-act headline, then by-class roll-up, bottom/top five sub-classes, race table; the depth-20 tables carry floors-gained/encounters-survived only, never a band or verdict"
    requirement: "PLAY-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-diff.test.js#'renderMarkdown: ...' (exact 7 H3 headings, in order); #'self-diff: ...' (no band/verdict key on any deep row)"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm test stays green (1409 = 1397 baseline + 12); parity stays 33/33; this plan touches nothing under engine/, content/, src/, or mazeworld.html; the harness (tools/tune-classes.mjs, tools/lib) stays byte-identical to pin 5565b22"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "npm test (1409/1409); node --test \"test/parity/**/*.test.js\" (33/33); git diff --stat HEAD~2 -- engine content src mazeworld.html (empty); git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib (rc=0)"
        status: pass
    human_judgment: false

# Metrics
duration: ~40min
completed: 2026-09-15
status: complete
---

# Phase 26 Plan 01: class-pass-diff.mjs Summary

**A dev-only, zero-dependency Node ESM script (`tools/class-pass-diff.mjs`) that diffs BEFORE/AFTER class-matrix JSON pairs — run-weighted mu, closed-interval fun bands, the cannot-act hard gate, per-sub/per-race verdict rows, an out-of-band cell appendix, depth-20 roll-ups (no verdicts), and the exact Markdown the Phase 26 ledger will paste verbatim — plus `docs/class-pass/verdicts.json` and a `--gate` mode Plan 26-02 can wire as a one-command cannot-act check.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files modified:** 0 modified, 2 new

## Accomplishments

- `tools/class-pass-diff.mjs` (996 lines): exports `BAND_LOW` (0.75), `BAND_HIGH` (1.35), `CANNOT_ACT_KILLS` (0.5), `BAND_ORDER`, `cellKey`, `muOverRuns` (run-weighted, full precision), `bandFor` (closed interval — exactly 0.75mu/1.35mu is "fine"), `isCannotAct` (stuck > 0, OR completed === 0, OR meanKills < 0.5 — exactly 0.5 is not), `rowBand`, `metaParity`, `rankRollupRows` (reuses `rankCells` by mapping `key -> sub`, `race -> ""`), `pooledReach`, `cannotActCells`, `buildVerdicts`, `mergeEditorial`, `renderMarkdown`. CLI: `--before/--after/--before-deep/--after-deep` (defaulted to `docs/class-pass/*.json`), `--verdicts` (merge a prior editorial file), `--out-verdicts` (atomic tmp-then-rename write), `--section after|outliers|handoff|all`, `--json`, `--gate` (loads only `--after`, prints cannot-act cells, exits 3 if any else 0). Imports only `node:fs`, `node:path`, `node:url`, and `{ rankCells }` from `./lib/class-matrix.mjs` — no engine/content import, no process spawning, no `Math.random`/`Date.now`/timestamps anywhere.
- `renderMarkdown(v, "after")` emits exactly these seven H3 headings, in order: `### By class — BEFORE → AFTER`, `### Sub-classes — bottom five and top five (AFTER)`, `### Races — BEFORE → AFTER (Human is the control)`, `### Sub-classes — all 24 rows (AFTER rank order)`, `### Reach table (AFTER natural, pooled over completed runs)`, `### Depth-20 slice — Phase 27's yardstick (no verdicts)`, `### Out-of-band cells (appendix)`. Line 1 is the cannot-act headline (`**Zero cannot-act cells.** ...` on the synthetic self-diff).
- `docs/class-pass/verdicts.json`'s shape as emitted (`schema: "class-pass-verdicts/1"`): `{ schema, meta: { before, after, beforeDeep, afterDeep, parity: { natural, deep }, mu: { basis: "runs", before, after }, bands: { tooWeakBelow, tooStrongAbove, cannotActKillsBelow, edges: { low, high } }, runs: { natural, deep }, pooledReach: { before, after } }, cannotAct: [...], classes: [ 3 rows: key, rank, before, after, delta — no band/verdict ], subs: [ 24 rows: key, cls, rank, before, after, delta, band, verdict, reason, lever ], races: [ 6 rows, same shape minus cls ], cells: { inBand, outOfBand: [...] }, deep: { byClass, bySub, byRace: [ key, rank, before, after, delta: { floorsGained, encountersSurvived } — never a band or verdict ] }, rollups: { natural: { byClass, bySub, byRace }, deep: { byClass, bySub, byRace } } }`. The `classes` and `rollups` fields are additions beyond the plan's headline bullet list — added so `renderMarkdown` never needs the raw before/after reports (see key-decisions).
- `test/unit/class-pass-diff.test.js` (368 lines, 12 tests): band closed-interval edges, cannot-act 0.5/0.49 boundary plus a null-not-NaN walk over a synthetic all-stuck AFTER cell, `muOverRuns` recomputed independently, `metaParity` natural-vs-deep mismatches, `rankCells`/`rankRollupRows` ordering reproduced from `before.json` plus a synthetic key-asc tiebreak, a missing-BEFORE-cell tolerance test (both at the sub-rollup and cell-appendix level), self-diff invariants (delta 0/null, verdict/reason/lever null on every row, no band/verdict key on any deep row, `inBand + outOfBand.length === 143`), `mergeEditorial` copy-by-key + invalid-verdict throw + idempotence, exact Markdown section content/heading checks, CLI byte-stability across two runs (stdout and `--out-verdicts` file), `--json` equals the written file, `--gate` exit 0/3 behavior, and module purity.
- Full suite: `npm test` 1409/1409 (1397 baseline + 12 new); `node --test "test/parity/**/*.test.js"` 33/33; `git diff --stat HEAD~2 -- engine content src mazeworld.html` empty; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` rc=0 (harness byte-identical to the BEFORE pin).

## Task Commits

Each task was committed atomically:

1. **Task 1: tools/class-pass-diff.mjs — pure helpers, verdicts builder, Markdown renderer, CLI with --gate** - `8b52ef0` (feat)
2. **Task 2: test/unit/class-pass-diff.test.js — edges, null-safety, ordering, self-diff, editorial merge, sections, determinism, --gate, purity** - `032f3f5` (test)

## Files Created/Modified

- `tools/class-pass-diff.mjs` - new, 996 lines; the full diff/verdicts/Markdown/CLI script
- `test/unit/class-pass-diff.test.js` - new, 368 lines; 12 tests

## Decisions Made

See `key-decisions` in the frontmatter above (mu run-weighted basis; verdicts.json's `classes`/`rollups` supplementary fields so `renderMarkdown` is self-sufficient from the verdicts object; the unexercised CANNOT-ACT GATE FAILED branch derives cls/sub/race by splitting the cell key).

## Deviations from Plan

**None (Rule 1–3 auto-fixes) — no bugs or missing critical functionality were found; the harness (`tools/tune-classes.mjs`, `tools/lib`) was never touched.**

One scope note, not a deviation: the plan's `buildVerdicts` shape bullet lists `meta/cannotAct/subs/races/cells/deep` explicitly; this implementation adds `classes` (the 3-row by-class BEFORE/AFTER table) and `rollups` (raw AFTER-only ranked roll-ups, natural + depth-20) so that `renderMarkdown(verdicts, section)` — whose signature the plan fixes to take only the verdicts object — can render the "By class" and "Handoff" roll-up tables without a second entry point that also takes raw before/after reports. Every field the plan's must_haves and acceptance criteria test explicitly (schema string, `subs.length === 24`, `races.length === 6`, `cells.inBand + cells.outOfBand.length === 143`, `subs.every(verdict/reason/lever === null)`, `deep.bySub.length === 24`, `meta.mu.basis === "runs"`) is present exactly as specified; nothing required was renamed or removed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This tool is dev-only and never shipped (not referenced by `tools/build-www.mjs`'s copy list).

## Next Phase Readiness

- Plan 26-02 can run `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` as its cannot-act gate once the AFTER capture lands.
- Plan 26-03 can paste `--section after|outliers|handoff` output into `docs/CLASS-PASS.md` verbatim, with the accept/revisit column flowing from a `--verdicts` prior file via `mergeEditorial`.
- Plan 26-04's ledger test can re-render through this script (`--json`/`--section`) to assert the ledger matches machine output exactly.
- No blockers for 26-02, 26-03, or 26-04.

---
*Phase: 26-mass-playtest-class-pass-ledger*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: tools/class-pass-diff.mjs
- FOUND: test/unit/class-pass-diff.test.js
- FOUND commit: 8b52ef0 (Task 1)
- FOUND commit: 032f3f5 (Task 2)
