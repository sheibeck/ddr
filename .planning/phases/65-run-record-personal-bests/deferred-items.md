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
