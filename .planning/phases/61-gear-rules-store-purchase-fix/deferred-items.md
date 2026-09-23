# Phase 61 Plan 02 — Deferred (out-of-scope) items

Found while running the full suite / boot check at the end of 61-02. All are
pre-existing, unrelated to this plan's files (`engine/derived.js`,
`src/browser/upgradeWhy.js`, `src/browser/viewModels.js`, `mazeworld.html`'s
one find-card line, and the six listed test files) — logged, not fixed, per
the executor's SCOPE BOUNDARY rule.

## `npm test` — 16 pre-existing failures, unrelated files

All 16 are CRLF/EOL fixture-comparison or external-tool-report-parsing
failures in files this plan never touches:

- `test/parity/divergence-records.test.js` (HEDGE-03, INIT-01 — "MOVED SET
  line did not match the expected format", `actual: ~`) — a report-parsing
  issue, not a rule regression.
- `test/unit/class-pass-ledger.test.js` (4 failures — Outliers/AFTER/Handoff
  block byte-identity checks).
- `test/unit/flee-ledger.test.js` (3 failures — FLEE_RACE_MOD/FLEE_CLASS_MOD
  table byte-identity checks).
- `test/unit/shell-tab-snapshots.test.js` (7 failures — `thief.hero`,
  `thief.gear`, `thief.gear-confirms`, `thief-store.store`, `mu.hero`,
  `mu.gear`, `mu-store.store`; every failure is a `\r` vs no-`\r` mismatch on
  line 1, e.g. `got: "## #s-level"` vs `expected: "## #s-level\r"`).

Root cause: this checkout has no `.gitattributes` (confirmed absent) and
`core.autocrlf=true`, so the committed LF fixture `.txt` files check out as
CRLF on this Windows machine while the freshly-rendered DOM text stays LF —
a byte-for-byte mismatch on every line, not a content difference. This
matches the already-tracked v1.8 deferred follow-up "`.gitattributes eol=lf`
pin" (STATE.md Deferred Items, 2026-09-22 v1.8 closeout).

Confirmed unrelated to this plan: none of the four failing files are in
`61-02-PLAN.md`'s `files_modified`, and `git diff --stat -- engine/items.js
engine/economy.js src/browser/storeScreen.js test/parity/` is empty (no
parity-adjacent file was touched here).

Every test this plan's `<verify>` blocks name — `test/unit/upgrade-why.test.js`,
`test/unit/lootCompare.test.js`, `test/unit/gear-axes.test.js`,
`test/unit/hp-not-wp.test.js`, `test/unit/shell-clarity-43.test.js`,
`test/unit/shell-loot-screen.test.js`, `test/unit/bag-cap-gate.test.js` — is
green (114/114 + 3/3 = all pass; see SUMMARY for the exact counts).

`npm test` totals: 3907 pass / 16 fail / 3923 total (0 new failures
introduced by this plan; the 16 are all pre-existing).

## `npm run boot:check` — environment-blocked (documented, not a regression)

`FAIL painted`, `FAIL graves`, `FAIL title`; the captured DOM dump is 162
bytes. This is the SAME pre-existing environment block STATE.md already
records under "Blockers/Concerns (open)": *"npm run boot:check
(tools/shell-boot-check.mjs, raw `--headless=new --dump-dom`) is
environment-blocked on this machine — 0-byte dump, its own `--self-test`
fails, reproduces on pre-fix HTML; an interactive Chrome session appears to
swallow the invocation."* Not caused by this plan's one-line
`mazeworld.html` edit.
