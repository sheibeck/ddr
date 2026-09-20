---
phase: 48-stale-docs-comments-test-names-purge
plan: 04
subsystem: testing
tags: [docs-sweep, test-names, stale-terms, shell-suites, fixture-hygiene]

requires:
  - phase: 48-stale-docs-comments-test-names-purge
    plan: 01
    provides: tools/stale-terms.mjs (criterion-1 tripwire), tools/comment-only-diff.mjs, the seeded class-C/D ALLOWED entries
  - phase: 48-stale-docs-comments-test-names-purge
    plan: 03
    provides: the narration-line vocabulary already applied to the narration-pipeline/engine-facing suites, the stale-terms.mjs --paths scoping fix, the exact split of files left for this plan
provides:
  - "21 shell-*/harness/inputGuards/bridge-registry/terrain test files: no title, comment, or local identifier presents a retired bridge, the toast host, the D-pad or a renamed test file as live"
  - "test/parity/harness/comparables.js + the four parity test files verified as class-C survivors — zero edits needed"
  - "56 test/unit/*.test.js files with the inert flightLeft: 0, flightCooldown: 0 / won: false keys removed from hand-built test-state literals (one standalone, revertable commit)"
  - "tools/stale-terms.mjs: ALLOWED finalised for test/ — every class-A/B/C survivor recorded, the rotted class-D flightLeft/flightCooldown prefix entry deleted; node tools/stale-terms.mjs --paths test reports unlisted 0, allow-list rot 0"
affects: [48-05-PLAN.md]

tech-stack:
  added: []
  patterns:
    - "retired-bridges / test/unit/ assert. and wornSlots / test/unit/ assert. prefix ALLOWED entries: an assertion that names a retired __mz* bridge can only be proving its absence, so every such assertion across the whole test/unit/ tree is covered by one entry each instead of per-file duplicates"

key-files:
  created: []
  modified:
    - test/unit/shell-narration-wiring.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-combat-actions.test.js
    - test/unit/shell-oracle-panel.test.js
    - test/unit/shell-party-camp.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-abilities.test.js
    - test/unit/bridge-registry.test.js
    - test/unit/harness/shellSandbox.js
    - test/unit/inputGuards.test.js
    - test/unit/shell-terrain-41.test.js
    - tools/stale-terms.mjs
    - "55 test/unit/*.test.js fixture-hygiene files (see table below)"

key-decisions:
  - "shell-map-invariants.test.js, shell-map-viewport.test.js: recorded as whole-file class-A survivors (match \".\") per the plan's own literal instruction — the Phase 35 invariant suite's entire purpose is proving the D-pad/toast host's absence"
  - "shell-narration-wiring.test.js's head paragraph rewritten so the Round Card is named only as something Phase 34 replaced, not as a currently-routed surface; the equipRejected title's local `toasts` identifiers renamed to `lines` (the historical name \"the DR18 toast\" stays as the retired feature's own name, since the file's whole point is proving its retirement)"
  - "shell-armor-display.test.js:11's quoted historical bug-report title (\"toast says wear, panel shows no damage\") kept verbatim and recorded class-B rather than rewritten — it is a direct quote of the DR bug this test's fix pins, not a live-surface claim"
  - "bridge-registry.test.js's '53 -> 49 -> 44' bridge-count archaeology paragraph deleted outright (not shortened) — the >= 40 assertion and its own message already carry the fact that matters"
  - "inputGuards.test.js's docs/COMBAT-NARRATIVE-DESIGN.md §6.3 citation dropped — the doc is a Phase 30/32 design record for the retired Round Card; the substantive reason (prefers-reduced-motion zeroes CSS transitions) is kept without the citation"
  - "shell-terrain-41.test.js's vacuous-by-design title/banner/comment rewritten to state the classic move()/reveal() functions are deleted (Phase 44), replacing language that called the check 'dead code, untouched by this plan'"
  - "Task 3's transform used a single leading-space/trailing-comma substring pattern per key pair (` flightLeft: 0, flightCooldown: 0,` and ` won: false,`) plus a no-trailing-comma variant (`, won: false`) for the last-key-in-object shape — this covers every observed line shape (whole-line, darkFor/dead-prefixed, and suffixed with halfNext/songAt/deathNote) without needing the plan's literal two-pattern-per-key list, verified against all 55 files with zero unhandled-shape stops"
  - "class-matrix.test.js's `won: false` fields (inside mock `run`/`row` objects passed to rowFromRun/summarizeRows, not `c` character literals) were included in the fixture-hygiene pass — confirmed via tools/lib/class-matrix.mjs that `rowFromRun` never reads `run.won` (the 46-02 plan deleted that field from the real return shape) and confirmed via the 46-02-SUMMARY.md file list that class-matrix.test.js was explicitly named in the 54-file handoff"
  - "The rotted class-D `legacy-counters` / `test/unit/` prefix ALLOWED entry (flightLeft: 0, flightCooldown: 0) was deleted outright rather than narrowed, since zero files remain that need it (no reverts occurred)"

requirements-completed: []

coverage: []

duration: ~55min
completed: 2026-09-20
status: complete
---

# Phase 48 Plan 04: Shell-* Suites (Groups B) + Fixture Hygiene Summary

**Finished the test-layer half of the Phase 48 sweep Plan 03 didn't take: renamed/rewrote titles and comments across the 15 shell-*/harness/inputGuards/bridge-registry/terrain files that still presented the toast host, the D-pad, or a retired `__mz*` bridge as live, verified the parity comparables need zero edits, then in one standalone commit stripped the inert `flightLeft: 0, flightCooldown: 0` / `won: false` keys from 55 hand-built test-state literals — three commits, `npm test` 3288/0 throughout, `node tools/stale-terms.mjs --paths test` now reports unlisted 0 and allow-list rot 0 on every enforced row.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 71 unique files across the three commits (15 in Task 1+2 combined + tools/stale-terms.mjs, 55 test files + tools/stale-terms.mjs again in Task 3)

## Accomplishments

- **Task 1 (shell-* suites, part 1 — 13 files):** renamed every citation of the deleted `shell-toast-wiring.test.js` to `shell-narration-wiring.test.js` across `shell-map-rail`, `shell-combat-actions`, `shell-fight-gate`, `shell-oracle-panel` (x2), `shell-party-camp` (x3), `shell-armor-display`; rewrote `shell-narration-wiring.test.js`'s head paragraph so the Round Card is named only as replaced, renamed the equipRejected test's title/local `toasts`→`lines` identifiers, and dropped its dead `parley-button-mirror.test.js` citation; reworded `shell-party-camp.test.js`'s "refusal toast must still be able to fire" to "refusal rail line …"; dropped `shell-oracle-panel.test.js`'s "the fixed toast host / tab bar" (the toast host no longer exists) to "the fixed tab bar"; recorded the Phase 35 invariant suite (`shell-map-invariants.test.js`, whole file) and every other absence pin in these 13 files as class-A/B `ALLOWED` survivors.
- **Task 2 (shell-* suites, part 2 — 8 files + parity verification):** rewrote `shell-worn-slots.test.js`/`shell-gear-39.test.js`/`shell-abilities.test.js`'s header items and inline comments that presented retired `__mz*` bridges (`__mzEff`/`__mzSlotFor`/`__mzWornSlots`/`__mzToHit`/`__mzStrikeDie`/`__mzItemRowState`/`__mzAbilities`) as live, stating the retirement plainly or naming what replaced them; rewrote `test/unit/harness/shellSandbox.js`'s `wireBridges` doc comment to describe what it wires TODAY and cite `src/browser/bridge.js` as the source of truth, dropping every "X/Y/Z are retired" clause; deleted `bridge-registry.test.js`'s "53 -> 49 -> 44" bridge-count archaeology paragraph, keeping the `>= 40` assertion; fixed `inputGuards.test.js`'s "the Round Card's decision" → "a decision button's", `toastsCoverage.test.js` → `narrationLinesCoverage.test.js`, and its two `shell-toast-wiring.test.js` citations, plus dropped the stale `docs/COMBAT-NARRATIVE-DESIGN.md` §6.3 citation; renamed `shell-terrain-41.test.js`'s vacuous-by-design title/banner/comment to state the classic `move()`/`reveal()` functions are deleted (Phase 44) rather than "dead code, untouched by this plan"; verified `test/parity/harness/comparables.js` + all four `*-parity.test.js` files' legacy-counter comments already correctly describe the tolerant-load strip — zero edits needed (confirmed via `node tools/comment-only-diff.mjs 649de2b test/parity` → `0 changed`).
- **Task 3 (fixture hygiene, standalone commit):** wrote a scratchpad transform script and ran it over the 55-file target list (the union of `flightLeft: 0, flightCooldown: 0` and `won: false` hits, minus the two class-C tolerant-load files); removed 10 whole lines and 95 mid-line substrings; zero files needed the revert-not-fix escape hatch (the script's own safety check — any `flightLeft: 0`/`won: false` remaining after transform — never tripped); `test/unit/item-activation.test.js` and `test/unit/save-validation.test.js` are byte-identical to their pre-commit state; `tools/stale-terms.mjs`'s now-rotted class-D `flightLeft: 0, flightCooldown: 0` / `test/unit/` prefix entry deleted.

## Task Commits

1. **Task 1: shell-* suites (part 1)** — `2cffdc4` (docs)
2. **Task 2: shell-* suites (part 2) + parity verification** — `7b4e20b` (docs)
3. **Task 3: fixture hygiene** — `4272f35` (test)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update is the final commit for this plan._

## `stale-terms.mjs --paths test` — after Task 2

```
| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad|dpad` | 14 | 14 | 0 | yes |
| toast | `toast` | 56 | 56 | 0 | yes |
| classic-engine | `dead classic|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 36 | 0 | 36 | no |
| wornSlots | `wornSlots` | 4 | 4 | 0 | yes |
| legacy-counters | `flightLeft|flightCooldown|c\.ether` | 55 | 55 | 0 | yes |
| recentre | `recent(er|re).*(every|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card|roundcard` | 10 | 10 | 0 | yes |
| retired-bridges | `__mz(ToHit|StrikeDie|ItemRowState|Abilities|Eff|SlotFor|WornSlots|Gear|WornKeysOf|SellPrice|RenderGrimoire|Bags)\b` | 27 | 27 | 0 | yes |
| retired-files | `toasts\.js|toastsCoverage|toastTable\.test|narrativeToasts\.test|shell-toast-wiring|toastsForAction|tutorial\.js|parley-button-mirror|round-card-worst-case` | 0 | 0 | 0 | yes |
| legacy-won | `won: false|state\.won|winGame` | 74 | 0 | 74 | no |

exit=0
```

`legacy-counters` at 55 hits (all listed) includes the class-D fixture literals Task 3 had not yet removed. `legacy-won` is unenforced throughout (the plan never asks Task 1/2 to flip it); its 74 unlisted hits at this checkpoint are exactly the 54-file `won: false` fixture-literal inventory named in the 46-02-SUMMARY handoff.

## `stale-terms.mjs --paths test` — after Task 3 (final)

```
| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad|dpad` | 14 | 14 | 0 | yes |
| toast | `toast` | 56 | 56 | 0 | yes |
| classic-engine | `dead classic|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 36 | 0 | 36 | no |
| wornSlots | `wornSlots` | 4 | 4 | 0 | yes |
| legacy-counters | `flightLeft|flightCooldown|c\.ether` | 22 | 22 | 0 | yes |
| recentre | `recent(er|re).*(every|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card|roundcard` | 10 | 10 | 0 | yes |
| retired-bridges | `__mz(ToHit|StrikeDie|ItemRowState|Abilities|Eff|SlotFor|WornSlots|Gear|WornKeysOf|SellPrice|RenderGrimoire|Bags)\b` | 27 | 27 | 0 | yes |
| retired-files | `toasts\.js|toastsCoverage|toastTable\.test|narrativeToasts\.test|shell-toast-wiring|toastsForAction|tutorial\.js|parley-button-mirror|round-card-worst-case` | 0 | 0 | 0 | yes |
| legacy-won | `won: false|state\.won|winGame` | 2 | 0 | 2 | no |

## Unlisted
(none)

## Allow-list rot
(none)

exit=0
```

`legacy-counters` dropped from 55 → 22 (the 33 class-D `flightLeft: 0, flightCooldown: 0` fixture hits are gone; the remaining 22 are the class-C parity/saveState tolerant-load reads). `legacy-won`'s 2 remaining hits (still unenforced) are `test/unit/save-validation.test.js`'s two OLD-SAVE `won: true`-tolerant-load inputs — the class-C survivors this plan was told to leave untouched.

## Survivors (file:line, class, reason) — every class-A/B/C entry in `test/`

| File:Line | Class | Reason |
| --- | --- | --- |
| `test/parity/combat-parity.test.js:149-150,178` | C | local comparable's prototype-side strip of `flightLeft`/`flightCooldown` and its comment |
| `test/parity/magic-parity.test.js:110-111,134` | C | same, magic-parity's local comparable |
| `test/parity/movement-parity.test.js:87-88,111` | C | same, movement-parity's local comparable |
| `test/parity/full-suite.test.js:77` | C | states the counters are removed entirely from the engine side |
| `test/parity/harness/comparables.js:121,132,137,149` | C | the prototype-side strip of the legacy counters (the frozen master still sets them) |
| `test/unit/conditions.test.js:17` | B | cleanChar's doc comment explains the omitted fields and what replaced them (Plan 03) |
| `test/unit/item-activation.test.js` (title + 3 lines) | C | `foldLegacyCounters` pin — input MUST carry the legacy keys, assertions prove deletion |
| `test/unit/item-wiring.test.js:271` | B | explains why the Cloak of Ether test no longer sets `c.ether` (Plan 03) |
| `test/unit/linesForAction.test.js:68` | B | the no-default-cap assertion states why (Plan 03) |
| `test/unit/movement.test.js:658` | B | explains why the step-tick test reads `c.timers` instead (Plan 03) |
| `test/unit/shell-abilities.test.js:13,93,106,108,111-112` | A | header/banner/title/comment/assertion all state `window.__mzAbilities` is retired/pinned absent |
| `test/unit/shell-clarity-43.test.js:173,185-186,367` | A/B | title states the trio is retired; assertions prove absence; migration comment names old→new |
| `test/unit/shell-gear-39.test.js:9,85,87,89,91-92` | A | header/comments name the three Phase 39 bridges Phase 47 retired, each pinned absent below |
| `test/unit/shell-worn-slots.test.js:134,168,181,187,195,202-207` | A/B | title states the trio retired; migration comments name old→new; assertions prove absence |
| `test/unit/shell-armor-display.test.js:11` | B | direct quote of the historical DR bug-report title ("toast says wear…") |
| `test/unit/shell-combat-actions.test.js:11,172,178,187,190-192` | A | CSCR-04/05 + MAP-03 absence pins |
| `test/unit/shell-combat-over.test.js:308,310,312` | A | zero-call pin |
| `test/unit/shell-company-panel.test.js:25,204,208,210-212,228` | A | absence pin + assertion message naming the old LINE_FOR fallback name |
| `test/unit/shell-fight-log.test.js:11,17,114,124-126,147,149,152,164-165,167-169` | A | Phase 34 Round Card retirement pin + zero-call pin inside dispatchWithNarration |
| `test/unit/shell-gear-toolbar.test.js:82` | B | states the .mazefoot/D-pad markup is retired |
| `test/unit/shell-map-invariants.test.js` (whole file) | A | the Phase 35 invariant suite — every mention is a concatenated retired literal or zero-grep pin |
| `test/unit/shell-map-rail.test.js:8,169,171,173-177` | A | the (c) toast-retirement zero-grep test and its header sentence |
| `test/unit/shell-map-viewport.test.js:8,99,101-102` | A | (a) D-pad/control-bar retirement test and header |
| `test/unit/shell-narration-wiring.test.js:11,15,18-19,22-23,27,111,118,120,125,127,134` | A/B | the three retirement tests, header sentences stating the retirement, Round Card replacement note |
| `test/unit/shell-oracle-panel.test.js:75,78` | A | MAP-03/04 host-rule pin |
| `test/unit/usable-features-audit.test.js:533` | C | doc-sync pin — the doc's §6 table still names pre-Phase-39 fields (Plan 05 annotates); test asserts the doc names them |
| `test/unit/usable-features-audit.test.js:566` | flagged | dead `.toasts` fallback — field name untouched per the bounded rule (Plan 03 finding, unchanged) |

## Renamed titles / rewritten citations (old → new)

- `shell-narration-wiring.test.js`: head paragraph — Round Card named only as replaced; `parley-button-mirror.test.js` citation dropped; equipRejected test title kept "toast" as the historical name but local identifiers `toasts`→`lines`
- `shell-map-rail.test.js`, `shell-combat-actions.test.js`, `shell-fight-gate.test.js`, `shell-oracle-panel.test.js` (x2), `shell-party-camp.test.js` (x3), `shell-armor-display.test.js`, `inputGuards.test.js` (x2): `shell-toast-wiring.test.js` → `shell-narration-wiring.test.js`
- `shell-party-camp.test.js:15`: "refusal toast must still be able to fire" → "refusal rail line must still be able to fire"
- `shell-oracle-panel.test.js`: "the fixed toast host / tab bar are untouched" → "the fixed tab bar is untouched"
- `shell-worn-slots.test.js` header items 5-6: rewritten to state the classic `eff(key)` duplicate and the `__mz*` trio are retired, not live
- `shell-gear-39.test.js` header item 1: "the five new read-only bridges (…)" → "the two surviving read-only bridges (…); the three Phase 39 bridges Phase 47 retired (…) are pinned absent"; item 4 rewords the row-builder description to the current direct-call shape
- `shell-abilities.test.js` header item 4: "window.__mzAbilities (byId/roundsLeft/isReady/sheet) + its imports" → "window.__mzAbilities is retired (heroTab.js-local view models)"
- `test/unit/harness/shellSandbox.js`: `wireBridges`'s doc comment rewritten to describe today's wiring + cite `src/browser/bridge.js`, dropping every "X/Y/Z are retired" clause
- `bridge-registry.test.js`: deleted the "53 -> 49 -> 44" archaeology paragraph
- `inputGuards.test.js`: "the Round Card's decision buttons" → "a decision button's tap-safety"; `toastsCoverage.test.js` → `narrationLinesCoverage.test.js`; dropped the `docs/COMBAT-NARRATIVE-DESIGN.md` §6.3 citation
- `shell-terrain-41.test.js`: title "legacy classic move()/reveal() function bodies carry neither mapViewRadius nor moveCost (dead code, untouched by this plan)" → "no classic move()/reveal() body survives to carry mapViewRadius or moveCost (Phase 44 deleted both; the check skips when a marker is absent)"; banner and inline comment reworded to match

## Fixture-hygiene numbers (Task 3)

- **Target file count:** 55 (`grep -rlE "flightLeft: 0, flightCooldown: 0" test/unit` = 33 ∪ `grep -rlE "won: false" test/unit` = 54, union 56, minus `test/unit/save-validation.test.js` — `test/unit/item-activation.test.js` was never in the union since its literal is `flightLeft: 7`, not matched by the grep)
- **Whole lines deleted:** 10 (files where `flightLeft: 0, flightCooldown: 0,` or `won: false,` was the entire trimmed line content: `armorDisplay`, `armor-durability`, `bot-buy-policy`, `bot-tactics`, `carry-model` x2, `combat`, `foe-effect-chip`, `grimoireViewModel`, `tuning-bot`)
- **Mid-line substrings removed:** 95 (the `darkFor`/`dead`-prefixed and `halfNext`/`songAt`/`deathNote`-suffixed shapes, plus `class-matrix.test.js`'s 17 mock `run`/`row` object literals)
- **Files reverted under the revert-not-fix rule:** 0 — the script's own safety check (any `flightLeft: 0`/`won: false` remaining after transform) never tripped for any of the 55 files
- **After-grep, `flightLeft: 0, flightCooldown: 0`:** `grep -rlE "flightLeft: 0, flightCooldown: 0" test/unit | wc -l` → `0`
- **After-grep, `won: false`:** `grep -rlE "won: false" test/unit` → `test/unit/save-validation.test.js` only
- **class-C untouched check:** `git diff --stat 4272f35~1 -- test/unit/save-validation.test.js test/unit/item-activation.test.js` → empty (both byte-identical across the commit)
- **Added-vs-deleted-line check:** `git diff 4272f35~1 --numstat -- test/unit | awk '{ins+=$1; del+=$2} END {print (ins<=del)?"shrank-or-equal":"grew"}'` → `shrank-or-equal` (95 insertions, 105 deletions in test files; the commit also touched tools/stale-terms.mjs, 5 more deletions there)
- **Re-joined-line filter:** `git diff -U0 4272f35~1 -- test/unit | grep -E "^\+[^+]" | grep -vE "flightLeft|won" | grep -vE "^\+\s*(darkFor: 0,|name:|dead: false,|halfNext: false,)" | wc -l` → `18`, all 18 are `class-matrix.test.js`'s re-joined mock `run`/`row`/array-element lines (leading keys `seed,`/`const run = {`/`const stuckRow = {`/`const rowsN = [{`/`{ seed: N,`) plus `loot-pile.test.js`'s `pendingLoot: [], dead: false, deathNote: ""…` line — every one is a re-joined literal with no new logic, manually verified line-by-line above

## Per-file `test(`/`assert.` count checks

All 55 fixture-hygiene files plus the 21 Task 1/2 files were checked; every pair matched 649de2b exactly except `test/unit/fight-log-worst-case.test.js`, which did not exist at 649de2b under that name (it was `round-card-worst-case.test.js`, renamed in Plan 03) — checked against its pre-rename name instead: `test 2->2 assert 11->11`, unchanged.

Spot-check table (10 of the 55 fixture-hygiene files):

| File | `test(` before→after | `assert.` before→after |
| --- | --- | --- |
| abilities.test.js | 54 → 54 | 130 → 130 |
| class-matrix.test.js | 20 → 20 | 105 → 105 |
| combat.test.js | 91 → 91 | 323 → 323 |
| ether-wallwalk.test.js | 15 → 15 | 59 → 59 |
| grimoireViewModel.test.js | 13 → 13 | 37 → 37 |
| loot-pile.test.js | 40 → 40 | 137 → 137 |
| store-sell.test.js | 13 → 13 | 30 → 30 |
| tuning-bot.test.js | 34 → 34 | 153 → 153 |
| usable-features-audit.test.js | 9 → 9 | 23 → 23 |
| worn-slots.test.js | 59 → 59 | 187 → 187 |

## Gate results (exact counts)

- `node tools/stale-terms.mjs --paths test; echo "exit=$?"` → `exit=0` after Task 2 and after Task 3; `## Unlisted` empty both times; `## Allow-list rot` empty both times
- `grep -rn "shell-toast-wiring" test/ | wc -l` → `0` (Task 1 gate); after Task 2, `grep -rn "toastsCoverage\|shell-toast-wiring" test/ | wc -l` → `0`
- `grep -c "COMBAT-NARRATIVE" test/unit/inputGuards.test.js` → `0`
- `grep -c "53 -> 49" test/unit/bridge-registry.test.js` → `0`
- `grep -cE "^test\(\"no classic move\(\)/reveal\(\) body survives" test/unit/shell-terrain-41.test.js` → `1`
- `node tools/comment-only-diff.mjs 649de2b test/parity` → `comment-only-diff 649de2b: 0 changed`; `git diff --stat 649de2b -- test/parity/fixtures test/parity/prototype-master.js.txt` → empty
- `node --test <all 13 Task-1 files>` → `# pass 209`, `# fail 0`
- `node --test test/parity/*.test.js test/unit/bridge-registry.test.js test/unit/shell-tab-snapshots.test.js` → `# pass 59`, `# fail 0`; `git diff --stat -- test/unit/fixtures/` empty
- `node --test <all 55 fixture-hygiene files>` → `# pass 1516`, `# fail 0`
- `node --test test/parity/*.test.js test/roundtrip/*.test.js` → `# fail 0`
- `npm test` at every one of the three commits → `# pass 3288`, `# fail 0`
- `git show --stat HEAD | grep -cE "^\s*(engine|content|src|mazeworld\.html|test/parity)"` → `0` (Task 3's commit touches test/unit + tools/stale-terms.mjs only)
- `grep -rlE "flightLeft: 0, flightCooldown: 0" test/unit | wc -l` → `0`; `grep -rlE "won: false" test/unit` → `test/unit/save-validation.test.js` only

## Deviations from Plan

None beyond the recorded key-decisions above — every rewrite, rename, and the fixture-hygiene transform followed the plan's action text exactly (or, where the plan's literal wording underspecified a line shape, the simplest correct generalization was used and verified against every occurrence, as recorded in "Task 3's transform used a single leading-space/trailing-comma substring pattern…" above).

## Issues Encountered

None blocking.

## Human verification (deferred to end of run)

None — no user-visible change. This plan touches only `describe`/`test` title strings, comments, local identifier names, assertion MESSAGE strings, and (Task 3 only) removes inert unused object-literal keys from test fixtures. Zero expected values, conditions, event types, or field names changed in any test body; zero engine/content/src/mazeworld.html bytes touched. `npm test` (3288/0, unchanged pass count throughout all three commits) and the parity + roundtrip + shell-tab-snapshots suites (all green, zero fixture diff) confirm no behavioural change anywhere in the codebase.

## Next Phase Readiness

- `node tools/stale-terms.mjs --paths test` is fully clean (unlisted 0, rot 0) — Plan 05 can now run the same tripwire over `docs/` and `.claude/CLAUDE.md` and, once those are swept, close DOCS-01/DOCS-03 for good.
- DOCS-01/DOCS-03 remain open per this plan's instruction — Plan 05 marks them complete once `test/`, `docs/`, and `.claude/CLAUDE.md` are all swept and the final combined tripwire run is recorded.
- `test/unit/usable-features-audit.test.js:566`'s dead `.toasts` fallback (flagged in Plan 03) is still an open, non-urgent follow-up for whoever next touches that file.

---
*Phase: 48-stale-docs-comments-test-names-purge*
*Plan: 04*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: test/unit/harness/shellSandbox.js
- FOUND: .planning/phases/48-stale-docs-comments-test-names-purge/48-04-SUMMARY.md
- FOUND: commit 2cffdc4
- FOUND: commit 7b4e20b
- FOUND: commit 4272f35
