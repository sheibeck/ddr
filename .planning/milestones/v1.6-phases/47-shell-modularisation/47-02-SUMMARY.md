---
phase: 47-shell-modularisation
plan: 02
subsystem: testing
tags: [bridge-registry, dead-code-removal, comment-stripping, doc-generation, shell-modularisation]

requires:
  - phase: 47-01
    provides: "test/unit/shell-tab-snapshots.test.js (the DOM-snapshot smoke) used unchanged to prove neither task moved any rendered DOM"
provides:
  - "src/browser/bridge.js — BRIDGE (frozen registry of all 53 live window.__mz* names, each with owner/consumers/purpose) + bridgeNames()"
  - "test/unit/bridge-registry.test.js — 10-test set-equality/entry-shape/ordering/teeth/adjacency/doc-sync gate for the bridge surface"
  - "tools/ident-sweep.mjs — stripJs/stripHtml now exported and importable without running the CLI; CLI behaviour byte-identical"
  - "tools/bridge-doc.mjs — renderTable()/--write/--check for docs/SHELL-MODULES.md's generated bridge table"
  - "docs/SHELL-MODULES.md — the fixed module contract (renderGearTab/renderHeroTab/renderStoreScreen(host,state,deps), window.__mzTabs rule), the shared-viewModels list, the generated bridge table, the snapshot rule, a Line-budget placeholder"
affects: [47-03, 47-04, 47-05]

tech-stack:
  added: []
  patterns:
    - "one frozen registry (owner/consumers/purpose) as the enforced source of truth for a cross-script window.__mz* bridge surface, proven fail-first with synthetic inputs (empty registry, an unlisted name, a comment-only mention) rather than only against the real files"
    - "a markdown table generated from a JS map and pinned into a doc between HTML comment markers, with a --check mode a test also re-derives independently (doc-sync)"

key-files:
  created:
    - src/browser/bridge.js
    - test/unit/bridge-registry.test.js
    - tools/bridge-doc.mjs
    - docs/SHELL-MODULES.md
  modified:
    - tools/ident-sweep.mjs
    - mazeworld.html
    - test/unit/shell-abilities.test.js

key-decisions:
  - "Deleted window.__mzHaptics (zero readers — maybeHaptic is called directly via its own module import at the settings dispatch site, never through the bridge) in addition to the plan's named __mzBags — found during Task 1's own read_first pass, held to the same must_haves truth (\"a name with zero readers is deleted, not registered with an empty consumer list\")"
  - "Live bridge count is 53, not the plan's expected 54 (55 minus __mzBags) — the second deletion accounts for the -1"
  - "Owner attribution for the five presentation-only globals written by BOTH scripts (__mzCombatMenu, __mzFightEnd, __mzFightLog, __mzRail, __mzStair): assigned owner = module script, matching its own source comments that describe the shared \"never a field on state\" discipline for this family; the classic script's writes are documented as \"(also writes)\" in consumers"
  - "__mzLootReport and __mzPendingNarration — named in the plan's illustrative dual-write list — are, per the actual measured scan, assigned ONLY by the module script (classic only reads them); registered as single-owner (module) rather than forcing a dual-write shape that doesn't match the real code"
  - "Re-pointed test/unit/shell-abilities.test.js's content/index.js import pin (it named the removed BAGS import) — required by the __mzBags deletion, not itself a registry change"

requirements-completed: []

coverage:
  - id: D1
    description: "src/browser/bridge.js's BRIDGE lists every live window.__mz* name (53) with a non-empty owner, consumers array and purpose, frozen and alphabetically sorted"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js#SHELL-04: BRIDGE's keys are exactly the live __mz* names (no unlisted, no stale) / SHELL-04: every BRIDGE entry has a valid owner... / SHELL-04: Object.keys(BRIDGE) is alphabetically sorted"
        status: pass
    human_judgment: false
  - id: D2
    description: "The registry test proves its own teeth fail-first against synthetic inputs: an empty registry reports every live name unlisted, a synthetic unlisted name is caught, a comment-only mention is never live, the retired per-tab bridge pattern never reappears, and the three test-injection hooks' consumers are real files on disk"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js#SHELL-04 teeth: ... / SHELL-04 adjacency: ... / SHELL-04: the three test-injection hooks' consumers are test paths that exist on disk"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/SHELL-MODULES.md's generated ## Module bridge table (53 rows) is pinned equal to BRIDGE by both tools/bridge-doc.mjs --check and a standing test"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js#SHELL-04 doc-sync: docs/SHELL-MODULES.md's Module bridge table names match bridgeNames() exactly / SHELL-04: tools/bridge-doc.mjs#renderTable() emits exactly one row per BRIDGE key"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two zero-reader dead bridges (window.__mzBags, window.__mzHaptics) deleted from mazeworld.html's module script, with their now-unused imports (BAGS) cleaned up"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "node tools/ident-sweep.mjs \"__mzBags\\b\" / \"__mzHaptics\\b\" — 0 hits, exit 0"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-19
status: complete
---

# Phase 47 Plan 02: Bridge Registry, Doc-Sync Test & Dead Bridge Cleanup Summary

**One frozen `src/browser/bridge.js` registry now lists all 53 live `window.__mz*` names with owner/consumers/purpose, enforced by a 10-test fail-first suite and a generated `docs/SHELL-MODULES.md` bridge table — with `__mzBags` and the also-dead `__mzHaptics` deleted.**

## Performance

- **Duration:** ~30 min (task commits span 19:56:20–19:59:22 local; the per-name owner/consumer research pass before the first commit is not separately timed)
- **Tasks:** 2 completed
- **Files modified:** 8 (4 created: `src/browser/bridge.js`, `test/unit/bridge-registry.test.js`, `tools/bridge-doc.mjs`, `docs/SHELL-MODULES.md`; 4 modified: `tools/ident-sweep.mjs`, `mazeworld.html`, `test/unit/shell-abilities.test.js`, plus this SUMMARY/STATE/ROADMAP)

## Accomplishments

- `src/browser/bridge.js` — a frozen, alphabetically-sorted `BRIDGE` map covering all 53 live `window.__mz*`/`globalThis.__mz*` names measured by a comment-stripped scan (mazeworld.html + every `src/browser/*.js` except `bridge.js` itself), each entry carrying an `owner` (classic script, module script, or a `src/browser/<file>.js`), a non-empty `consumers` array, and a one-sentence `purpose`. `bridgeNames()` returns the sorted key list.
- `test/unit/bridge-registry.test.js` — 10 tests: set-equality (unlisted/stale), entry-shape, key ordering, three fail-first teeth tests against synthetic sources (empty registry, an unlisted synthetic name, a comment-only mention in both JS and HTML), an adjacency test that the retired `__mz(Gear|Hero|Store)(Tab|Screen)` pattern never reappears, the three test-injection hooks' consumers resolving to real files on disk, and two doc-sync tests added in Task 2.
- `tools/ident-sweep.mjs` — `stripJs`/`stripHtml` now `export`ed and the CLI is gated behind a direct-invocation check (`path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`), so `bridge-registry.test.js` can `import` the exact same stripping state machine instead of a second, divergent implementation. `--self-test` and every CLI behaviour unchanged.
- `tools/bridge-doc.mjs` — `renderTable()` (exported for the doc-sync test) plus a CLI: no args prints the table, `--write` replaces the markers in `docs/SHELL-MODULES.md`, `--check` exits 1 on drift.
- `docs/SHELL-MODULES.md` — `# Shell modules`, `## Contract` (the `renderGearTab/renderHeroTab/renderStoreScreen(host, state, deps)` signature, the `deps` key list, the module-reaches-page-only-through-host/deps rule, the `window.__mzTabs` bridge rule), `## What stays shared` (the seven `viewModels.js` exports that stay shared, `renderDropShelf` stays in the shell), `## Module bridge` (the generated 53-row table), `## DOM snapshots` (the harness + regeneration rule from Plan 01), `## Line budget` (placeholder for Plan 05).
- Two dead bridges deleted from `mazeworld.html`'s module script: `window.__mzBags = BAGS;` (the plan's named target) and `window.__mzHaptics = { maybeHaptic };` (found during Task 1's own read-first pass — `maybeHaptic` is called directly via its module import at the settings-apply call site, never through the bridge). `BAGS` dropped from the now-unused `content/index.js` import line.

## Task Commits

1. **Task 1: ident-sweep exports + src/browser/bridge.js + the registry test (with __mzBags/__mzHaptics deleted)** - `fb0c2d1` (feat)
2. **Task 2: tools/bridge-doc.mjs + docs/SHELL-MODULES.md (generated ## Module bridge) + doc-sync pin + gates** - `bbb6503` (feat)

No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP update is the final commit for this plan.

## Files Created/Modified

- `src/browser/bridge.js` - the frozen `BRIDGE` registry + `bridgeNames()`
- `test/unit/bridge-registry.test.js` - the 10-test registry gate (set-equality, shape, ordering, teeth, adjacency, doc-sync)
- `tools/bridge-doc.mjs` - generates/writes/checks the doc's bridge table
- `docs/SHELL-MODULES.md` - the module contract + generated bridge table + snapshot rule + line-budget placeholder
- `tools/ident-sweep.mjs` - `stripJs`/`stripHtml` exported, CLI gated behind a direct-invocation check
- `mazeworld.html` - `window.__mzBags`/`window.__mzHaptics` deleted; `BAGS` dropped from its now-unused import
- `test/unit/shell-abilities.test.js` - re-pointed its `content/index.js` import pin after the `BAGS` removal (Rule 1/3 fix, not a registry change)

## Decisions Made

- **Deleted `__mzHaptics` alongside `__mzBags`.** Both are zero-reader bridges (nothing anywhere reads `window.__mzHaptics`; `maybeHaptic` is imported and called directly). The plan's own `must_haves` truth ("a name with zero readers is deleted, not registered with an empty consumer list") applies to any zero-reader name found during execution, not only the one the plan happened to measure at planning time. Live count is therefore 53, not the plan's expected 54.
- **Owner attribution for the five dual-write presentation globals** (`__mzCombatMenu`, `__mzFightEnd`, `__mzFightLog`, `__mzRail`, `__mzStair`) — all assigned `owner: "mazeworld.html (module)"`, matching the module script's own source comments describing this family's "never a field on state" discipline; the classic script's writes (menu open/close, resets on dismiss) are listed in `consumers` as "(also writes)". This is a documentation judgment call — the registry test does not validate *which* script is called "owner", only that the value matches one of the three allowed forms.
- **`__mzLootReport` and `__mzPendingNarration`** were named in the plan's illustrative dual-write list, but the actual scan shows both are assigned only by the module script (classic only reads them). Registered as single-owner (module) to match the measured code, not the plan's example list.
- **Re-pointed `test/unit/shell-abilities.test.js`'s import pin** for the `BAGS` removal — required by the deletion itself, tracked as a deviation below rather than folded silently into the accomplishment list.
- **Did not mark SHELL-04 complete in REQUIREMENTS.md** — per the plan's own instruction, SHELL-04's full statement (`< 5,000 lines` + the registry) closes in Plan 05; `requirements-completed` is left empty in this SUMMARY's frontmatter and `requirements mark-complete` was not run for SHELL-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical / plan's own truth] Deleted the also-dead `window.__mzHaptics` bridge**
- **Found during:** Task 1 (read_first pass over the module script's bridge-assignment block)
- **Issue:** `window.__mzHaptics = { maybeHaptic };` has zero readers anywhere in `mazeworld.html` or `src/browser/` — `maybeHaptic` is imported and called directly at the settings-apply dispatch site (`mazeworld.html` line ~5445), never through the bridge. The plan named only `__mzBags` as the zero-reader deletion target, but the plan's own `must_haves` truth ("A window.__mz* name with zero readers anywhere... is deleted, not registered with an empty consumer list") is a general rule, not scoped to one name.
- **Fix:** Deleted the `window.__mzHaptics = { maybeHaptic };` line. `maybeHaptic`'s direct import and its one call site are untouched.
- **Files modified:** `mazeworld.html`
- **Verification:** `node tools/ident-sweep.mjs "__mzHaptics\b"` → 0 hits, exit 0; `node --test test/unit/shell-tab-snapshots.test.js` → 10/10 pass, zero fixture diff (haptics never touched rendered DOM).
- **Committed in:** `fb0c2d1` (Task 1 commit)

**2. [Rule 1/3 - Blocking] Re-pointed `test/unit/shell-abilities.test.js`'s `content/index.js` import pin**
- **Found during:** Task 1 (verification pass after removing `BAGS` from the module script's `content/index.js` import)
- **Issue:** `test/unit/shell-abilities.test.js` pinned the exact string `import { RACES, CLASSES, BAGS, ABILITY_BY_ID } from "./content/index.js";`, which the `__mzBags` deletion's import cleanup changed (BAGS dropped — no longer used by the module script once `__mzBags` was deleted).
- **Fix:** Updated the pin to `import { RACES, CLASSES, ABILITY_BY_ID } from "./content/index.js";`.
- **Files modified:** `test/unit/shell-abilities.test.js`
- **Verification:** `node --test test/unit/shell-abilities.test.js` → 9/9 pass.
- **Committed in:** `fb0c2d1` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical/plan's-own-truth, 1 blocking).
**Impact on plan:** Both fixes are direct, required consequences of the plan's own named `__mzBags` deletion and its own stated zero-reader truth — neither widens scope beyond `mazeworld.html` + one test pin, neither touches `engine/`, `content/`, or `test/parity/`.

## Issues Encountered

None beyond the two auto-fixed items above, both caught by this task's own verification steps before committing.

## User Setup Required

None - no external service configuration required.

## Gate Results

- `node tools/ident-sweep.mjs --self-test` → `self-test: PASS`
- `node -e "import('./tools/ident-sweep.mjs')..."` → `function function` (exit 0, no CLI run on import)
- `node tools/ident-sweep.mjs "__mzBags\b"` → 0 hits, exit 0; `node tools/ident-sweep.mjs "__mzHaptics\b"` → 0 hits, exit 0
- `node -e "import('./src/browser/bridge.js')..."` → `53 true true` (53 keys, sorted, frozen)
- `node --test test/unit/bridge-registry.test.js` → `# pass 10`, `# fail 0`
- `node tools/bridge-doc.mjs --check` → exit 0
- `awk` row count between the bridge-table markers → 53, matching `bridgeNames().length` → 53
- `npm run build:www` → exit 0
- `npm test` → `# pass 3253`, `# fail 0` (baseline after Plan 01 was 3,243; +10 = the new `bridge-registry.test.js` suite)
- `npm run boot:check` → `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0`; `git diff --stat HEAD~2 -- test/unit/fixtures/` → empty (no fixture touched)
- Engine fence: `git status --porcelain engine/ content/ test/parity/` → empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- Post-commit deletion check on both task commits: `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty for both `fb0c2d1` and `bbb6503` (no unexpected file deletions)

## Human verification (deferred to end of run)

None — this plan is a registry/test/doc plan plus the removal of one already-dead bridge assignment (`__mzHaptics`, found alongside the plan's named `__mzBags`); neither deletion had any live reader, so there is no rendered-behaviour change to check on a device. The `test/unit/shell-tab-snapshots.test.js` 10/10 pass with zero fixture diff is the proof: if either deletion had touched anything a screen renders, that standing smoke would have failed first.

## Next Phase Readiness

- Plans 03–05 (`gearTab.js`/`heroTab.js`/`storeScreen.js` carves) now have a live gate: any `window.__mz*` name a carve adds or retires (starting with `__mzTabs` in Plan 03) must be added to or removed from `src/browser/bridge.js` in the SAME commit, or `bridge-registry.test.js` goes red on the next `npm test` run.
- `docs/SHELL-MODULES.md`'s `## Contract` section fixes the exact `renderGearTab/renderHeroTab/renderStoreScreen(host, state, deps)` signature and the `deps` key list Plans 03–05 must implement against — written and pinned before a single line of those modules exists.
- `## Line budget` is a placeholder; Plan 05 fills in the final `wc -l mazeworld.html` and the per-carve deltas.
- SHELL-04 is NOT yet marked complete in `REQUIREMENTS.md` — its full statement (`< 5,000 lines` + registry) closes only when Plan 05 lands the line-budget half.
- No blockers.

---
*Phase: 47-shell-modularisation*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 8 files created/modified in this plan found on disk; both task commits (`fb0c2d1`, `bbb6503`) found in git log.
