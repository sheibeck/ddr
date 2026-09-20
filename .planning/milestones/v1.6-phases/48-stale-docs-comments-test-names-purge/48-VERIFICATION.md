---
phase: 48-stale-docs-comments-test-names-purge
verified: 2026-09-20T02:50:00Z
status: passed
score: 4/4 success criteria verified on automated evidence (re-run by the orchestrator after 48-05, HEAD b955126); no on-device checks — the phase changes no behaviour
behavior_unverified: 0
overrides_applied: 1
human_verification: []
gaps: []
---

# Phase 48 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *every comment, doc page, CLAUDE.md row and test name describes the game as it is — nothing in the repo describes a pattern the game no longer employs — proven by a recorded grep list over the final code layout.*

Five sequential plans (no discuss round, per the ROADMAP): 48-01 the `tools/stale-terms.mjs` tripwire + `tools/comment-only-diff.mjs` proof + engine/content sweep; 48-02 shell + `src/browser`; 48-03 test group A (narration/engine-facing suites); 48-04 test group B (shell pins, harness) + the standalone fixture-hygiene commit; 48-05 CLAUDE.md, docs buckets, the tripwire's unit test, closing gates.

## Automated evidence (re-run by the orchestrator after 48-05, HEAD `b955126`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | The recorded grep list with its zeros over `mazeworld.html`, `src/`, `engine/`, `content/`, `test/` (comments included); only survivors are retirement assertions and the tolerant-load legacy-key reads, each listed | `node tools/stale-terms.mjs` exit **0**: every enforced row (`d-pad\|dpad`, `toast`, `dead classic\|classic engine`, `wornSlots`, `flightLeft\|flightCooldown\|c\.ether`, `recent(er\|re).*(every\|each) step`, plus the supplementary `round card`, 12 retired `__mz*` names, renamed/deleted file names) → 0 unlisted, allow-list rot 0. Every survivor is an explicit `ALLOWED` entry with file:line + reason, classed A (absence-assertion titles, 13 + the Phase 35 invariant suite), B (retirement statements, 6 in shell/src), C (`engine/saveState.js#foldLegacyCounters` + its pins), D (none left — the fixture literals were removed). `classic script` (79 → informational row, not enforced) — see override |
| 2 | `.claude/CLAUDE.md` has zero `iOS\|Xcode\|Apple\|macOS\|App Store` lines (rows deleted, not annotated; SCOPE OVERRIDE banner gone); stack notes describe tap-to-move + the rail; `docs/*.md` each current or deleted with reasons | grep → **0** (30 → 0; 14 GSD managed-marker lines byte-identical; one approved wording swap in Constraints: "No other platform is in scope."). `docs/`: 16 → **15** — `COMBAT-NARRATIVE-DESIGN.md` deleted (every surface it documented is retired; its one live rule is `inputGuards.js`'s header; recoverable from `5c904a6`); 9 docs swept / status-noted; 6 untouched incl. `UAT-v1.5.md`; bucket table with reasons in `48-05-SUMMARY.md` |
| 3 | No test file name, `test(...)` or `describe(...)` string references a retired mechanism, bar listed absence-assertions | `ls test/unit \| grep -iE "toast\|dpad"` → **empty**; `grep -rniE "^\s*(test\|describe\|it)\(.*(toast\|d-pad\|dpad)" test/` → **13**, all absence-assertions, each listed (class A). `round-card-worst-case.test.js` → `fight-log-worst-case.test.js` via `git mv` |
| 4 | `npm test` fail 0 with the pass count equal to the phase-start count (renames only); `engine/`, `content/`, fixtures and the master hash unchanged except comment lines, proven by a stripped-comments diff | **3,293 / 0** = 3,288 at phase start + the 5 tripwire tests in `test/unit/stale-terms.test.js` (no other delta; no test deleted; per-file `test(`/`assert.` counts pinned equal in every touched file across 48-03/04). `node tools/comment-only-diff.mjs 649de2b engine content test/parity/fixtures` → 8 changed, **0 code-changed**; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `src/` + shell diffs comment-only (13 files, 0 code-changed); `build:www` exit 0; `boot:check` 4/4; DOM snapshots 10/10 with no fixture change; `bridge-doc --check` exit 0; `ident-sweep --self-test` PASS |

## Notes the reader should have

- **Override (criterion 1, `classic script`):** the ROADMAP's grep list names `dead classic|classic script|classic engine` as retired forms. `classic script` is the live name of `mazeworld.html`'s non-module `<script>` block (`paint()`, the map/combat/rail renderers stay there by Phase 47's ruling; `bridge.js` records owners as `mazeworld.html (classic)`). Recorded in the CONTEXT as an orchestrator judgment call, tracked as an informational (unenforced) row; the user can flip it to enforced and rename the block.
- **Bounded test-body rule (planner departure, accepted):** ~70 test-body lines carried the retired vocabulary as local identifiers (`const toast = LINE_FOR…`) or assertion messages; those were renamed. Never an expected value, condition, fixture literal, event type, field name or assertion count — proven by per-file counts. One flagged, not fixed: `usable-features-audit.test.js:566` reads a dead `.toasts` field (a field name — outside the rule).
- **Fixture hygiene (`4272f35`, standalone):** inert `flightLeft: 0` / `flightCooldown: 0` / `won: false` keys removed from hand-built test states in 56 files (the 46-02 handoff); class-C inputs (`save-validation`, `item-activation`) excluded; zero reverts needed. `git revert 4272f35` restores it alone.
- **Tool fixes along the way:** `stale-terms.mjs --paths <file>` dropped directory-prefix ALLOWED entries (48-03, fixed); the executor of 48-05 used `git stash` once (against workflow rules) — the only effect was an LF→CRLF flip on the working copies of 8 docs, caught by `bridge-doc --check` and converted back before commit; the orchestrator confirmed every committed doc is `i/lf` and the stash list is empty.
- Phase 47's `wornSlots` survivors (comment mentions of the deleted `__mzWornSlots` bridge) are gone; the tripwire now enforces the 12 retired bridge names.
- The tripwire (`tools/stale-terms.mjs` + its 5-test pin) is the standing DOCS-01/03 gate: a new stale mention or a rotted allow entry fails `npm test`.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| DOCS-01 | Complete | criteria 1, 4 |
| DOCS-02 | Complete | criterion 2 |
| DOCS-03 | Complete | criterion 3 |

## Deferred to the milestone-close Pixel 7 batch

Nothing — no user-visible change. The batch stands at 26 items (10/44, 3/45, 6/46, 7/47).
