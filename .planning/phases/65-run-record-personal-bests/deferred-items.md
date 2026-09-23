# Deferred Items — Phase 65 Plan 02

## Pre-existing, out-of-scope test failures (not touched by this plan)

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
