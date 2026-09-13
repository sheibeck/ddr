# Deferred Items — Phase 03 (endless-descent-difficulty-balance)

Out-of-scope discoveries logged per the executor's scope-boundary rule (only
auto-fix issues directly caused by the current task's changes).

## `npm run test:quick` fails on Windows — pre-existing, unrelated to 03-01

**Found during:** 03-01 Task 1 verification (running the plan's suggested
sanity commands beyond the plan's own `<verification>` block).

**Issue:** `npm run test:quick` runs `node --test test/unit test/determinism
test/roundtrip`. On this machine's Node v22.23.2 / Windows platform, passing
directory paths as positional CLI args to `node --test` throws
`Error: Cannot find module 'C:\...\test\determinism'` (a CJS-loader
`MODULE_NOT_FOUND`, not a test failure) for all three directories — it never
reaches the actual test files.

**Confirmed unrelated to this plan's changes:** bare `node --test` (no
positional args — Node's default recursive test-file discovery) runs the
full suite cleanly, including the two files this plan added
(`test/difficulty/difficulty.test.js`), with 293/293 passing, 0 failures.
The plan's own `<verification>` block uses `node --test
test/difficulty/difficulty.test.js` and bare `node --test`, not `npm run
test:quick` — both pass. This bug predates 03-01 and touches none of this
plan's files (`package.json`'s `test:quick` script is untouched).

**Action:** Not fixed here (out of scope per the scope-boundary rule — this
plan only adds files, it does not modify `package.json` or the test-runner
invocation). Flagging for a future phase/plan to investigate — likely a
Node-version/Windows-path quirk in how `node --test` resolves directory
positional args versus glob-discovered files.
