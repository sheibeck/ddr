# Deferred items — Phase 61 Plan 01 (combat gear lock, GRULE-01)

Out-of-scope discoveries found while executing 61-01-PLAN.md. Not fixed
here (scope boundary: only auto-fix issues directly caused by this plan's
own changes) — logged for later.

## Pre-existing `npm test` failures (16), confirmed unrelated to this plan

`npm test` on this Windows checkout reports 3912/3928 pass, 16 fail, both
before and after this plan's engine/narration/test changes (verified by
running the identical suite against the pre-edit base commit
`6dbf5c4b71aa92aa6deba712c89366e16837c35d`, exported via `git archive` to
a scratch directory — same 16 test names, same failure reasons, modulo one
archive-only false positive: `MAP-09: package.json dependencies+devDependencies
are unchanged from HEAD`, which fails only because a bare `git archive`
extraction has no `.git` metadata for that test's `git diff` call — not a
real failure in the actual worktree).

The 16 confirmed pre-existing failures, unrelated to GRULE-01:

- `HEDGE-03: the holders declaring worn are exactly the scan's MOVED SET`
- `INIT-01: the holders declaring Phase 51 are exactly the initiative scan's MOVED SET`
  - Root cause (traced): `tools/worn-fixture-scan-output.txt` and
    `tools/initiative-fixture-scan-output.txt` are checked out with CRLF
    line endings on this machine (`core.autocrlf=true`, no `.gitattributes`
    pin), while `divergence-records.test.js`'s `MOVED SET (\d+): ...$`
    regex uses `.*$` — JS `.` never matches `\r`, so the trailing `\r` left
    by a CRLF-terminated line makes the whole match fail. Confirmed
    byte-identical content otherwise (`diff --strip-trailing-cr` is empty
    both before and after this plan). Already tracked in `.planning/STATE.md`'s
    deferred-items ledger as "`.gitattributes eol=lf pin`" (v1.8 milestone
    close) — the real fix is a `.gitattributes` `eol=lf` pin on the two
    `tools/*-scan-output.txt` files, not a test-code change.
- `Outliers (Phase 26) lists exactly the revisit rows`
- `AFTER, Outliers and Handoff blocks are byte-identical to a fresh render`
- `Handoff to Phase 27 carries the yardstick`
- `v1.5 AFTER section is byte-identical to a fresh render`
  - Pre-existing doc/generated-snapshot drift in archived milestone
    ledgers, unrelated to gear rules.
- `Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value; the Thief flee bonus is separate`
- `Before/after table: the Human Fighter no-armor row's New need is FLEE_NEED; the Thief Leather row's is FLEE_NEED - FLEE_THIEF_BONUS`
- `Before/after table: every row's Old %/New % equals Math.round((21 - need) / 20 * 100)`
  - Pre-existing flee-ledger doc/table drift, unrelated to gear rules.
- `SHELL-01/02: thief.hero — the Hero tab DOM for a fresh Thief`
- `SHELL-01: thief.gear — the Gear tab DOM for a fresh Thief with a full bag`
- `SHELL-01: thief.gear-confirms — the Drop confirm and the jewelry swap confirm, both armed`
- `SHELL-01: thief-store.store — a full-bag Thief's store screen`
- `SHELL-02: mu.hero — the Hero tab DOM for a Magic User with a joined party member`
- `SHELL-01: mu.gear — the Gear tab DOM for a Magic User with every worn slot empty`
- `SHELL-01: mu-store.store — a Magic User's store screen with nothing to sell`
  - Pre-existing DOM-snapshot drift in `src/browser/` module snapshot
    tests, unrelated to gear rules. Note: Plan 03/04 of this phase DO touch
    the Gear/Store surfaces the "gear"/"store" snapshots cover — if those
    plans need to regenerate a snapshot, confirm first whether the drift
    is pre-existing (as here) or newly caused by that plan's own edit.

## One regression found and fixed in-plan (not deferred)

`test/unit/armor-durability.test.js`'s "combat-destroyed armor (A1) still
vanishes on unequip" test called `unequipSlot` while `state.combat` was
still set from an earlier assertion in the same test — this is now
refused by the new combat gear lock (deliberately: GRULE-01 gates the
armor slot mid-fight with no destroyed-armor carve-out). Fixed by clearing
`state.combat = null` before the unequip call, since the test's actual
subject (the A1 destroyed-armor-vanishes rule) is orthogonal to being
mid-fight. See commit `ed82b82` and the plan's SUMMARY.

---

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
