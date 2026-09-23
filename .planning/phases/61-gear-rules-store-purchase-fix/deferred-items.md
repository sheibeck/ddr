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
