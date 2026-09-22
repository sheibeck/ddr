# Deferred items — Phase 58 Plan 01

Discovered while running `npm test` in the worktree at the end of Plan 01 (motion.js,
cameraGlide.js, typewriter.js). Out of scope per the executor's scope-boundary rule:
none of the affected files are in this plan's `files_modified` list.

## Pre-existing CRLF checkout artifact — 16 failing tests, unrelated to this plan

`npm test` reported `3660 pass / 16 fail` out of 3676 total (3633 baseline + this
plan's 43 new tests across motion.test.js/camera-glide.test.js/typewriter.test.js,
all 43 of which pass).

All 16 failures are in files this plan never touches:
- `test/parity/divergence-records.test.js` (2 failures: HEDGE-03, INIT-01)
- `test/unit/class-pass-ledger.test.js` (4 failures)
- `test/unit/flee-ledger.test.js` (3 failures)
- `test/unit/shell-tab-snapshots.test.js` (7 failures)

Root cause, confirmed by direct inspection: this worktree's fresh checkout has
`core.autocrlf=true` and no `.gitattributes` declaring these text fixtures as
LF-only. `git show HEAD:tools/worn-fixture-scan-output.txt` (the committed blob) is
LF-clean, but the CHECKED-OUT working-tree copy has CRLF line endings. The failing
tests anchor a regex with `(.*)$` against a line read via `fs.readFileSync(...,
"utf8").split("\n")` — the `\r` left dangling on each line (since `.` does not match
`\r` in JS regex, and `$` without the `m` flag expects end-of-string) breaks the
match. `test/unit/class-pass-ledger.test.js` and `test/unit/flee-ledger.test.js` hit
the identical pattern against a different anchored-heading regex on what is
presumably a markdown/ledger fixture; `shell-tab-snapshots.test.js`'s 7 failures were
not individually root-caused past the first two files, but the failure shape (byte-
identical / DOM-snapshot comparisons) is consistent with the same CRLF-vs-LF class of
issue.

This is an environment/repo-configuration gap (missing `.gitattributes` `text=auto` /
`eol=lf` pin for these specific fixture files), not a defect in Phase 58 Plan 01's
three new modules or their tests — all 43 of which pass, and the engine gate
(`git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/` is empty;
`test/parity/prototype-master.js.txt` hashes to the pinned
`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) is untouched.

**Not fixed here** — fixing it would mean adding/editing `.gitattributes` and/or
touching `test/parity/` and other files entirely outside this plan's file scope, and
risks interacting with the sibling 58-02 worktree running in parallel. Left for the
orchestrator/user to decide: either add a `.gitattributes` LF pin for these fixtures,
or confirm the main checkout (`C:\projects\mazeworld`) does not exhibit the same
CRLF drift before merging.
