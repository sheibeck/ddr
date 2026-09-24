# Deferred Items — Phase 65

## From Plan 65-03

**Pre-existing `npm test` failures, out of scope (Scope Boundary rule).** 7 of 4210
tests fail on a fresh worktree checkout, in files this plan does not touch
(`test/unit/flee-ledger.test.js`, `test/unit/class-pass-ledger.test.js`). Root
cause: `docs/FLEE.md` and `docs/CLASS-PASS.md` are checked out with CRLF line
endings on this Windows machine, and both test files parse the doc by
`text.split("\n")` then regex-match `$` against each line — a line ending in
a stray `\r` fails a `/…$/` match even though the visible text is correct
(confirmed via `cat -A docs/FLEE.md` showing `## Before / after$` — the `$`
here is `cat -A`'s own EOL marker, and the underlying line does carry a
trailing `\r` before it). This is the exact class of issue STATE.md's
Deferred Items already track under "`.gitattributes eol=lf pin`" (recorded at
the v1.8 and v1.9 closeouts) — not a regression from this plan's changes
(`content/boards.js`, `src/browser/newBest.js`, `test/unit/newBest.test.js`,
`test/voice/safety-scan.test.js`), which touch none of the affected doc or
test files. Parity (`node --test test/parity/*.test.js`) is 46/46 green, and
every test this plan's <verification> block names is green.

Not fixed here: fixing the checkout's line endings or the two ledger tests'
CRLF-tolerance is outside this plan's `files_modified` list and outside
RUN-04's scope.

## From Plan 65-02


### Pre-existing, out-of-scope test failures (not touched by this plan)

`npm test` on this worktree's base commit shows 7 failures, none in files this
plan modifies (only `engine/records.js` and `test/unit/records.test.js` were
touched). Root cause: `docs/CLASS-PASS.md` is checked out with CRLF line
endings on this Windows worktree, and `test/unit/class-pass-ledger.test.js`'s
`section()` helper splits on `"\n"` then anchors a heading regex with `$`,
which fails to match a line still carrying a trailing `\r`. Confirmed by
direct `node -e` inspection: `docs/CLASS-PASS.md` around "Outliers (Phase 26"
reads as `"...revisit list)\r\n"`.

This is the exact class of issue already tracked as a pending follow-up in
`.planning/STATE.md`'s Deferred Items table: ".gitattributes eol=lf pin".
Out of scope for this plan (Rule scope boundary: "Only auto-fix issues
DIRECTLY caused by the current task's changes") — logged here rather than
fixed.

Failing tests (all in `test/unit/class-pass-ledger.test.js` and
`test/unit/parley-flee-retune.test.js`, none of which this plan touches):

- `Outliers (Phase 26) lists exactly the revisit rows`
- `AFTER, Outliers and Handoff blocks are byte-identical to a fresh render`
- `Handoff to Phase 27 carries the yardstick`
- `v1.5 AFTER section is byte-identical to a fresh render`
- `Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value; the Thief flee bonus is separate`
- `Before/after table: the Human Fighter no-armor row's New need is FLEE_NEED; the Thief Leather row's is FLEE_NEED - FLEE_THIEF_BONUS`
- `Before/after table: every row's Old %/New % equals Math.round((21 - need) / 20 * 100)`

`test/unit/records.test.js` (45/45) and the full `test/parity/` suite are
green in the same run — this plan's Engine Gate holds.

## From Plan 65-01


Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule
(only auto-fix issues directly caused by the current task's changes).

### Pre-existing `npm test` failures, unrelated to this plan

`npm test` on this worktree (base commit `adc941e`) reports **7 failures**
that this plan did not cause and did not fix:

| # | Test | File |
|---|------|------|
| 1 | Outliers (Phase 26) lists exactly the revisit rows | test/unit/class-pass-ledger.test.js |
| 2 | AFTER, Outliers and Handoff blocks are byte-identical to a fresh render | test/unit/class-pass-ledger.test.js |
| 3 | Handoff to Phase 27 carries the yardstick | test/unit/class-pass-ledger.test.js |
| 4 | v1.5 AFTER section is byte-identical to a fresh render | test/unit/class-pass-ledger.test.js |
| 5 | Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value | test/unit/flee-ledger.test.js |
| 6 | Before/after table: the Human Fighter no-armor row's New need... | test/unit/flee-ledger.test.js |
| 7 | Before/after table: every row's Old %/New % equals Math.round(...) | test/unit/flee-ledger.test.js |

**Evidence this plan is not the cause:**
- `git diff --stat adc941e -- test/unit/class-pass-ledger.test.js test/unit/flee-ledger.test.js docs/FLEE.md docs/CLASS-PASS.md content/flee.js content/index.js tools/class-pass-diff.mjs docs/class-pass/` is EMPTY — this plan touched none of these files.
- Both test files' imports (`tools/class-pass-diff.mjs`, `content/flee.js`/`content/index.js`) never reach `engine/state.js`, `engine/engine.js` or `engine/saveState.js` (the three files this plan edited) — no possible causal path.
- The failure text ("...is not a byte-identical substring of the ledger") matches the project's own documented pre-existing Windows CRLF artifact: `docs/CLASS-PASS.md` is checked out with CRLF line terminators on this machine (`core.autocrlf`) while the doc-guard tests compare against a freshly LF-rendered string. `.planning/STATE.md` already tracks this class of issue as the standing ".gitattributes eol=lf pin" deferred item, and `test/parity/FIXTURE-INVENTORY.md`'s own Phase 61 Plan 01 section independently documents the same CRLF mismatch tripping two other pre-existing, unrelated tests on this machine.

**Disposition:** left untouched, per the executor's scope boundary. `npm test`
for this plan's own verification is judged against the 4198/4205 pass count
(4197 baseline + 8 new acts-counter tests, minus these 7 pre-existing
failures which were never part of the 4197 baseline's green set on this
machine) — see 65-01-SUMMARY.md.
