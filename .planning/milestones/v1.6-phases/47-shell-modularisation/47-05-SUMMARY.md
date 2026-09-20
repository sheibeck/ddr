---
phase: 47-shell-modularisation
plan: 05
subsystem: ui
tags: [dom-carve, store-screen, bridge-registry, source-pins, shell-modularisation, phase-close]

requires:
  - phase: 47-01
    provides: "test/unit/harness/shellSandbox.js + shell-tab-snapshots.test.js (the DOM-snapshot lock this carve had to stay byte-equal against, including the SHELL-03 idempotency case)"
  - phase: 47-02
    provides: "src/browser/bridge.js registry + bridge-registry.test.js (the gate this carve's __mzTabs.store addition had to satisfy)"
  - phase: 47-03
    provides: "gearTab.js's tabDeps()/renderCarriedList/bagUsage — the verbatim carve substitution table and the shared list/usage helpers storeScreen.js imports directly"
  - phase: 47-04
    provides: "heroTab.js's own carve precedent (the second proof that the substitution table generalizes) and the __mzTabs two-key shape this plan extends to three"
provides:
  - "src/browser/storeScreen.js — renderStoreScreen(host, state, deps), STORE_ROLL_COPY"
  - "test/unit/storeScreen.test.js — the module's own 8-test source-pin suite"
  - "window.__mzTabs (gear + hero + store) — the phase's final, locked shape"
  - "test/unit/shell-no-content-copies.test.js widened to every src/browser/ export (criterion 3, phase-final)"
  - "docs/SHELL-MODULES.md#Line budget — filled with the phase-start/per-plan/final line counts and a classified breakdown of the unmet shortfall"
  - ".planning/STATE.md — the [SHELL-04 line budget] blocker (criterion 2 unmet)"
affects: [48-stale-docs-comments-test-names-purge]

tech-stack:
  added: []
  patterns:
    - "the same verbatim carve substitution table Plans 03/04 established (document -> host.ownerDocument; window.mz<Action>?. -> deps.<action>?.; window.__mz<X> bridge read -> the direct import it bridged) applies unchanged to a third tab carve — proof the contract generalizes across all three named surfaces"
    - "a bridge whose per-property reader moved but the bridge OBJECT keeps a live reader elsewhere stays whole, unchanged — __mzArmorDisplay/__mzBagUsage/__mzUsableBy all lost their store-specific call site but each kept at least one other classic reader (rail find card / loot card / drop shelf), so none were touched; only __mzCarriedList's consumer text was updated (loot card only now) since its OWN classic call-site count tightened from >= 1 to exactly 1"
    - "when a source-pin's `sliceBetween` end-marker lives entirely inside the code a carve just moved out, the fix is a new SRC constant (STORE_SRC) mirroring the sibling GEAR_SRC/HERO_SRC pattern, not a patched end-marker — the carved module's own file IS the region, no slicing needed"

key-files:
  created:
    - src/browser/storeScreen.js
    - test/unit/storeScreen.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/gearTab.test.js
    - test/unit/heroTab.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-no-content-copies.test.js
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "test/unit/shell-combat-over.test.js needed NO edit — its own store-region pin (sliceBetween 'if (S.store) {' .. 'const C = S.combat;') already only asserts two negatives (no guardTap, no dataset.mode) that stay trivially true against the shrunk mount-call branch, and its neighbouring markers (LOOT_GUARD/STORE_GUARD) never depended on the store body's own contents. Listed in the plan's <files> as a precaution; verified green with zero changes rather than edited speculatively."
  - "window.__mzArmorDisplay/__mzBagUsage/__mzUsableBy bridge OBJECTS are left exactly as-is (not trimmed to drop the now-store-unused armorDisplay/bagUsage/usableBy properties) — each bridge still has at least one other live classic reader (rail find card, loot card, or the shared drop shelf), so the bridge itself is not dead; only the __mzCarriedList and __mzUsableBy consumer-list PROSE in bridge.js/the generated doc was updated to stop naming the store as a bridge consumer (it now reads these directly via its own imports)."
  - "the line-budget fallback (node tools/shell-sweep.mjs orphans) was run and its 27 orphans were individually classified — every one belongs to the Map/camera/tap-control, combat/rail/HUD, or graves/Oracle clusters this phase's ground rules explicitly forbid moving (never Map/Oracle/rail/combat code). None trace to a Gear/Hero/Store body. The fallback lever is therefore exhausted for this phase's own scope — criterion 2 is recorded NOT MET (5621 lines) rather than a silent pass or a scope-widened pass."
  - "three pre-existing test-file quirks were left UNCHANGED as documented discrepancies rather than 'fixed': (1) the ROADMAP's own illustrative `awk .../paint()/,/^}/ | grep -c \"__mzTabs\\.(hero|gear)\\(\"` command counts 3, not 2, because it also matches a Plan-03-era comment mentioning `window.__mzTabs.gear(...)` inside a code comment — the comment-stripped count is the correct 2, verified separately; (2) the plan's own illustrative `awk .../renderEncounter()/,/^}/ | grep -c '\"(shelf|sell-list|sell-head|a-leave)\"'` prints 1, not 0, because the UNRELATED loot branch's pre-existing `class=\"shelf\" id=\"loot-drop-shelf\"` card (never touched by this plan, explicitly out of scope) contains the literal substring `\"shelf\"`; my own storeScreen.test.js pin (test 4) uses a scoped `id=\"…\"`/`getElementById(\"…\")` check instead of a bare substring match to avoid this same false positive."

patterns-established:
  - "Phase 47's carve substitution table now has three independent proofs (Gear, Hero, Store) — a future tab/screen carve can reuse it unmodified with high confidence."

requirements-completed: [SHELL-03]

coverage:
  - id: D1
    description: "The Store screen (header, stock shelf with repair-row math and usable-by suffixes, the Your gear sell list, Leave) renders from src/browser/storeScreen.js#renderStoreScreen behind exactly one window.__mzTabs.store(...) mount call; renderEncounter() builds none of that DOM itself any more"
    requirement: "SHELL-03"
    verification:
      - kind: unit
        ref: "test/unit/storeScreen.test.js (8 tests: exports, no window/document, id-containment inside the module's own template, the mount pin + no-leftover-literal check, __mzTabs assignment ordering, gearTab.js/viewModels.js import pins, voice safety, the SHELL-03 idempotency cross-pin)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js (10 tests — 7 fixtures compared byte-equal, including thief-store.store and mu-store.store, and the SHELL-03 double-render idempotency test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "window.__mzTabs takes its final locked shape (gear + hero + store); the widened no-duplicate pin (criterion 3) names every src/browser/ module and is green; the registry + doc stay in sync"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "test/unit/gearTab.test.js / heroTab.test.js / storeScreen.test.js __mzTabs literal pins (all re-pointed to the 3-key shape); test/unit/bridge-registry.test.js (10/10 pass); node tools/bridge-doc.mjs --check (exit 0); test/unit/shell-no-content-copies.test.js's new criterion-3 test (6/6 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The line budget is measured honestly at the phase's final commit and recorded in three places (SUMMARY, docs/SHELL-MODULES.md, STATE.md) — met or NOT MET with a classified breakdown, never a silent or scope-widened pass"
    requirement: "SHELL-04"
    verification:
      - kind: other
        ref: "wc -l mazeworld.html -> 5621 (>= 5000, NOT MET); docs/SHELL-MODULES.md#Line budget (per-plan deltas + classified breakdown); .planning/STATE.md's [SHELL-04 line budget] blocker"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every pin that read the old inline store branch is re-homed to storeScreen.js's own source; zero test files deleted, zero assertions deleted"
    verification:
      - kind: unit
        ref: "npm test (3288/3288 pass, up from the 3278 baseline after Plan 04); git diff --diff-filter=D --name-only -- test/ (empty, both commits); per-file `^test(` counts unchanged or grew (never shrank)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Store's buy/sell/repair rows, usable-by suffixes, roll copy, and tab switching across Gear/Hero/Store show no visual/behavioural regression on a real device"
    verification: []
    human_judgment: true
    rationale: "Verification agents are off for this milestone; deferred to the milestone-close Pixel 7 batch per project convention. The byte-equal DOM snapshot (test/unit/shell-tab-snapshots.test.js, both store fixtures — thief-store.store and mu-store.store — plus the SHELL-03 idempotency double-render case) is the automated proxy; any visual/behavioural regression this carve introduced would first show up there as a fixture diff, and none did."

duration: ~2h
completed: 2026-09-19
status: complete
---

# Phase 47 Plan 05: Store Screen Carve + Phase Closing Gates Summary

**The Store screen now renders from `src/browser/storeScreen.js#renderStoreScreen` behind one `window.__mzTabs.store(...)` mount call — `__mzTabs` takes its final locked three-key shape (gear/hero/store), the no-duplicate pin widens to every `src/browser/` export (130+ names, criterion 3 holds), and the line budget is measured honestly: `mazeworld.html` lands at 5,621 lines — criterion 2 (< 5,000) is recorded NOT MET with a classified breakdown, not a silent pass.**

## Performance

- **Duration:** ~2h (two task commits, `df78e66` and `b21342e`)
- **Tasks:** 2 completed
- **Files modified:** 17 (2 created: `src/browser/storeScreen.js`, `test/unit/storeScreen.test.js`; 15 modified)

## Accomplishments

- **Task 1 (the render carve):** the whole `S.store` branch of `renderEncounter()` (header/purse line, the storeRoll-gated `STORE_ROLL_COPY` line, the stock shelf with repair-row math and usable-by suffixes, the "Your gear" sell list via `gearTab.js`'s shared `renderCarriedList`, the Leave button) moved verbatim into `src/browser/storeScreen.js#renderStoreScreen(host, state, deps)` — `host.ownerDocument` replaces every `document` read, `state`/`state.c` replaces the classic `S`/`S.c`, and direct imports (`armorDisplay`/`usableBy` from `viewModels.js`, `bagUsage`/`renderCarriedList` from `gearTab.js`) replace the classic `window.__mz*` bridge reads. `STORE_ROLL_COPY` moved with its comment, exported instead of a bare classic const.
- `mazeworld.html`'s store branch is now exactly: `if (S.store) { window.__mzTabs.store(body, S, tabDeps()); return; }`. The module script gained one new `storeScreen.js` import line and `window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen });` — the CONTEXT's exact final shape.
- `window.__mzCarriedList`'s classic call-site count tightened from 2 (loot card + store sell list) to 1 (loot card only) — the store's sell list now reaches `renderCarriedList` directly through `storeScreen.js`'s own `gearTab.js` import. `src/browser/bridge.js`'s `__mzCarriedList`/`__mzTabs`/`__mzUsableBy` consumer prose updated to match; `docs/SHELL-MODULES.md` regenerated (`--write` then `--check` clean).
- `test/unit/harness/shellSandbox.js`'s `wireBridges` twinned to the new surface: `renderStoreScreen` imported and wired into `__mzTabs`.
- Six pre-existing `shell-*.test.js` files' `storeRegion()` helpers re-pointed from a now-collapsed `sliceBetween(CODE, "if (S.store) {", 'document.getElementById("a-leave").onclick')` (whose end-marker no longer exists in the shrunk shell) to a new `STORE_SRC` constant (`storeScreen.js`'s own source, mirroring `GEAR_SRC`/`HERO_SRC`): `shell-map-store-polish`, `shell-armor-display`, `shell-loot-screen`, `shell-clarity-43`, `shell-gear-toolbar`, `shell-input-guards`.
- `gearTab.test.js`/`heroTab.test.js`'s `__mzTabs` exact-literal pins re-pointed to the final three-key shape; `hp-not-wp.test.js` gained a new module-scan test for `storeScreen.js`.
- `test/unit/storeScreen.test.js` — the module's own 8-test source-pin suite (exports, no-window/document, id-containment against the module's own template, the mount pin + no-leftover-Store-literal check, `__mzTabs` assignment-before-boot ordering, the `gearTab.js`/`viewModels.js` import pins, voice safety, and a cross-pin asserting `shell-tab-snapshots.test.js` still carries its SHELL-03 idempotency test title).
- **Task 2 (closing gates):** `test/unit/shell-no-content-copies.test.js` widened with a new test 6 — derives every `src/browser/*.js` export name at test time (130+ names across 24 modules) and asserts neither the classic nor the module script re-declares any of them; tests 1-5 untouched.
- Line budget measured (`wc -l mazeworld.html` = 5,621) and the CONTEXT's own fallback (`node tools/shell-sweep.mjs orphans`) applied: all 27 reported orphans classified as belonging to the Map/camera/tap-control, combat/rail/HUD, or graves/Oracle clusters this phase's ground rules explicitly forbid moving — none trace to a Gear/Hero/Store body, so the fallback has nothing in scope. `docs/SHELL-MODULES.md#Line budget` filled with the phase-start/per-plan/final counts and a classified breakdown (comment-only lines, markup+CSS, largest remaining function groups); `.planning/STATE.md` gained a `[SHELL-04 line budget]` blocker.
- ROADMAP criteria 1, 3, 4, 5 verified verbatim (commands + outputs below) and hold; criterion 2 does not.
- `SHELL-03` marked complete in `REQUIREMENTS.md`; `SHELL-04` stays Pending (its "under 5,000 lines" clause is unmet — the compound requirement is not silently marked complete).

## Task Commits

1. **Task 1: storeScreen.js owns the S.store branch; renderEncounter() mounts through window.__mzTabs.store; __mzTabs takes its final shape; pins re-homed; storeScreen.test.js** - `df78e66` (refactor)
2. **Task 2: closing gates — widen the no-duplicate pin to every src/browser export, measure the line budget (with the CONTEXT fallback), verify ROADMAP criteria 1-5 verbatim, write the phase closing SUMMARY** - `b21342e` (docs)

No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP/REQUIREMENTS update is the final commit for this plan.

## Files Created/Modified

- `src/browser/storeScreen.js` - the STORE screen module: `renderStoreScreen(host, state, deps)`, `STORE_ROLL_COPY`
- `test/unit/storeScreen.test.js` - new, the module's source-pin suite
- `mazeworld.html` - the store branch collapsed to one mount call; `STORE_ROLL_COPY` and its comment deleted; the module script's `storeScreen.js` import line and the final `__mzTabs` literal added
- `src/browser/bridge.js` + `docs/SHELL-MODULES.md` - `__mzTabs`/`__mzCarriedList`/`__mzUsableBy` consumer prose updated to the phase's final shape; `## Line budget` filled
- `test/unit/harness/shellSandbox.js` - `wireBridges` twinned to the new surface (`store: renderStoreScreen`)
- `test/unit/gearTab.test.js`, `test/unit/heroTab.test.js` - `__mzTabs` literal pins re-pointed to the 3-key shape
- `test/unit/hp-not-wp.test.js` - new module-scan test for `storeScreen.js`
- `test/unit/shell-map-store-polish.test.js`, `test/unit/shell-armor-display.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-clarity-43.test.js`, `test/unit/shell-gear-toolbar.test.js`, `test/unit/shell-input-guards.test.js` - `storeRegion()` re-pointed to a new `STORE_SRC` constant
- `test/unit/shell-no-content-copies.test.js` - widened with the new criterion-3 test (every `src/browser/` export)
- `.planning/STATE.md` - the `[SHELL-04 line budget]` blocker
- `.planning/REQUIREMENTS.md` - `SHELL-03` marked complete

## Success criteria (ROADMAP Phase 47, verbatim)

**1. Modules + suites exist; `paint()`/`renderEncounter()` mount-only; existing pins re-pointed and green — HOLDS.**
```
$ [ -f src/browser/gearTab.js ] && [ -f src/browser/heroTab.js ] && [ -f src/browser/storeScreen.js ]; echo $?
0
$ [ -f test/unit/gearTab.test.js ] && [ -f test/unit/heroTab.test.js ] && [ -f test/unit/storeScreen.test.js ]; echo $?
0
$ awk '/^function paint\(\)/,/^}/' mazeworld.html | grep -cE "__mzTabs\.(hero|gear)\("
3   # 2 real mount calls (hero, gear) + 1 stale Plan-03-era comment mentioning
    # "window.__mzTabs.gear(...)" — comment-stripped count is 2 (verified
    # separately below). See "Deviations" for the discrepancy note.
$ awk '/^function renderEncounter\(\)/,/^}/' mazeworld.html | grep -c "__mzTabs.store("
1
$ node --test test/unit/shell-company-panel.test.js test/unit/shell-worn-slots.test.js test/unit/shell-gear-39.test.js test/unit/shell-map-store-polish.test.js 2>&1 | grep -E "^# (pass|fail)"
# pass 48
# fail 0
```

**2. `wc -l mazeworld.html` < 5,000 — NOT MET, 5,621 lines.**
```
$ wc -l < mazeworld.html
5621
```
See "## Line budget" below for the full ledger and classified breakdown.

**3. No duplicate of any `src/browser/` export or `content/` table — HOLDS.**
```
$ grep -cE "^const (WEAPONS|ARMOR|SPELLS|JEWELRY|CLOAKS|STAVES|SUB_NOTE|RACES|SUBS)\b" mazeworld.html
0
$ node --test test/unit/shell-no-content-copies.test.js 2>&1 | grep -E "^# (pass|fail)"
# pass 6
# fail 0
```

**4. Every `window.__mz*` bridge name is in one registry with owner + consumer; a test fails on drift — HOLDS.**
```
$ node --test test/unit/bridge-registry.test.js 2>&1 | grep -E "^# (pass|fail)"
# pass 10
# fail 0
$ node -e "import('./src/browser/bridge.js').then(m => console.log(m.bridgeNames().length))"
44
$ node tools/bridge-doc.mjs --check; echo $?
0
```

**5. Pixel-identical: Gear/Hero/Store render the same DOM before/after; engine fence untouched — HOLDS.**
```
$ node --test test/unit/shell-tab-snapshots.test.js 2>&1 | grep -E "^# (pass|fail)"
# pass 10
# fail 0
$ git log --oneline -- test/unit/fixtures/shell-snapshots | wc -l
1
$ git diff --stat 0129ca3 -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt
(empty)
$ git hash-object test/parity/prototype-master.js.txt
a1f4d0dc29782218d8e5aab65bc5989c33f917f0
```

Plus:
```
$ npm run build:www
[build-www] done  (exit 0)
$ npm test 2>&1 | grep -E "^# (pass|fail)"
# pass 3288
# fail 0
$ npm run boot:check
PASS no-uncaught
PASS painted
PASS graves
PASS title
```

## Test ledger

| Milestone | `npm test` pass count | Delta |
| --- | --- | --- |
| Phase start (CONTEXT.md baseline) | 3231 | — |
| Post Plan 02 (bridge registry) | 3253 | +22 |
| Post Plan 03 (Gear tab carve) | 3265 | +12 |
| Post Plan 04 (Hero tab carve) | 3278 | +13 |
| **Post Plan 05 (this plan, final)** | **3288** | **+10** |

This plan's own +10: `storeScreen.test.js` (+8, new file), `hp-not-wp.test.js` (+1, new `storeScreen.js` module-scan test), `shell-no-content-copies.test.js` (+1, the widened criterion-3 test).

## Bridge ledger

| Milestone | Live bridge count | Delta |
| --- | --- | --- |
| Post Plan 03 (Gear tab carve) | 49 | -4 (net) |
| Post Plan 04 (Hero tab carve) | 44 | -5 |
| **Post Plan 05 (this plan, final)** | **44** | **0** |

This plan added no new bridge NAME (`__mzTabs` already existed; it gained a `store` key, not a new registry entry) and deleted none — `armorDisplay`/`bagUsage`/`usableBy` each lost their store-specific call site but kept at least one other live classic reader (rail find card, loot card, or the shared drop shelf), so `__mzArmorDisplay`/`__mzBagUsage`/`__mzUsableBy` all stay. Only `__mzCarriedList`'s consumer prose changed (loot card only now, tightened from >= 1 to exactly 1 call site) and `__mzUsableBy`'s consumer prose dropped its stale "store" mention.

## Deletions ledger

- `const STORE_ROLL_COPY = "...";` and its comment block — deleted from `mazeworld.html`, moved verbatim (as an export) into `src/browser/storeScreen.js`. `node tools/shell-sweep.mjs refs STORE_ROLL_COPY` → 0.
- The whole `S.store` branch body (~48 lines: header template, shelf-row builder, sell-list wiring, Leave wiring) — deleted from `renderEncounter()`, replaced by the one-line `window.__mzTabs.store(body, S, tabDeps());` mount call.
- No `window.__mz*` bridge deleted this plan (see Bridge ledger above).
- No test file or test assertion deleted (see Pin re-point ledger below and `git diff --diff-filter=D --name-only -- test/` — empty for both commits).

## Pin re-point ledger (consolidated 03-05)

Plans 03 and 04's own full ledgers are in `47-03-SUMMARY.md`/`47-04-SUMMARY.md` — not restated here. This plan's own re-points:

| File | What moved | Assertions re-targeted |
|---|---|---|
| `test/unit/shell-map-store-polish.test.js` | `STORE_ROLL_COPY`'s extraction + the `storeRoll`-gating pin + the voice-safety pin — CODE → a new `STORE_SRC` constant (`storeScreen.js`'s own source) | 4 tests |
| `test/unit/shell-armor-display.test.js` | the store repair-row pin (`ad.wornSub` line) — CODE region → `STORE_SRC` | 1 test |
| `test/unit/shell-loot-screen.test.js` | the store's `window.__mzBagUsage`/Drop-when-full pin — CODE region → `STORE_SRC`, `window.__mzBagUsage(S.c)` → `bagUsage(c)` | 1 test |
| `test/unit/shell-clarity-43.test.js` | the store rows' usable-by pin — CODE region → `STORE_SRC`, `window.__mzUsableBy(item.effectParams.item, S.c)` → `usableBy(item.effectParams.item, c)` | 1 test |
| `test/unit/shell-gear-toolbar.test.js` | the `gearRow:true`-absent-from-store pin — CODE region → `STORE_SRC` | 1 test |
| `test/unit/shell-input-guards.test.js` | the `no guardTap in store`-pin — CODE region → `STORE_SRC` | 1 test |
| `test/unit/gearTab.test.js` | the `__mzTabs` exact-text pin (2-key → 3-key); the `__mzCarriedList(` classic-count pin (>= 1 → exactly 1) | 2 tests |
| `test/unit/heroTab.test.js` | the `__mzTabs` exact-text pin (2-key → 3-key) | 1 test |
| `test/unit/hp-not-wp.test.js` (new pin, not a re-point) | new `storeScreen.js` module-scan test appended | 1 new test |
| `test/unit/shell-no-content-copies.test.js` (new pin, not a re-point) | new criterion-3 test (every `src/browser/` export) appended | 1 new test |

`test/unit/shell-combat-over.test.js` required **no edit** — verified green with zero changes (see "Deviations" below).

Zero test files deleted, zero assertions deleted — confirmed per-file `^test(` counts unchanged or grew for every touched file (see table in "Self-Check" / verified during Task 1).

## Snapshot lock

- 7 fixtures under `test/unit/fixtures/shell-snapshots/` compared byte-equal at both task commits, on the first attempt — `MZ_SNAPSHOT_UPDATE` never set.
- `git log --oneline -- test/unit/fixtures/shell-snapshots` → 1 commit (the Plan 01 capture) — unchanged since phase start.
- SHELL-03 idempotency (`thief-store.store` rendered twice, byte-equal, "goods" row count unchanged) — green, both before and after this plan's own carve.

## Line budget

Full ledger and classified breakdown now live in `docs/SHELL-MODULES.md#Line budget` (regenerated this plan). Summary:

| Milestone | Commit | `wc -l mazeworld.html` |
| --- | --- | --- |
| Phase start | `0129ca3` | 6339 |
| Post Plan 02 | `bbb6503` | 6330 |
| Post Plan 03 (Gear) | `4cd35ea` | 5980 |
| Post Plan 04 (Hero) | `6d1a999` | 5669 |
| **Post Plan 05 (Store, final)** | `df78e66` | **5621** |

**Criterion 2: NOT MET — 5,621 lines** (target < 5,000, shortfall of 621 lines). The CONTEXT's own fallback (`node tools/shell-sweep.mjs orphans`) was run and every one of its 27 reported orphans was individually classified: all belong to the Map/camera/tap-control cluster (`cv`, `ctx`, `GW`, `ZOOM_MIN`, `CANVAS_PAD`), the combat/rail/HUD renderers (`CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN`, `lastCondKeyShown`, `encRenderedAt`/`armTimer`/`lastDismissAt`/`encWasActive`, `lastLogSeqShown`/`fightLogAnnouncedSeq`, `COMBAT_DISPATCH`, `lastRailKeyShown`/`railTimer`, `FEATURE_ICON_PATH`), or the graves/Oracle log (`CAPTURE`, `logEl`, `GRAVE_KEY`/`GRAVE_TOTAL_KEY`/`gravesLoadError`/`saveGraves`) — none trace to a Gear/Hero/Store body, and the phase ground rules explicitly forbid moving Map/Oracle/rail/combat code. The fallback lever is exhausted for this phase's own scope. Comment-only lines (1,642 across both scripts) are the single largest remaining lever and are explicitly Phase 48's job (DOCS-01..03), not this plan's. `.planning/STATE.md` carries the `[SHELL-04 line budget]` blocker for a user ruling on the candidate levers (comment purge, module-owned screen markup, a future named Map/Combat/Rail/Oracle module — all out of SHELL-01..04's stated scope).

## Gate outputs per commit

**`df78e66` (Task 1):**
- `npm test` → `# pass 3287`, `# fail 0`
- `npm run build:www` → exit 0
- `npm run boot:check` → 4/4 PASS
- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0`; `git diff --stat -- test/unit/fixtures/` → empty
- `node --test test/unit/bridge-registry.test.js` → `# pass 10`, `# fail 0`; `node tools/bridge-doc.mjs --check` → exit 0
- `node --test test/unit/storeScreen.test.js` → `# pass 8`, `# fail 0`
- `node tools/ident-sweep.mjs "__mzUsableBy\b"` / `"__mzBagUsage\b"` / `"__mzArmorDisplay\b"` → each still has a live classic reader (rail find card / loot card / drop shelf) — all three bridges stay, unchanged
- `node tools/shell-sweep.mjs refs STORE_ROLL_COPY` → `refs STORE_ROLL_COPY: 0`, exit 0
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no unexpected file deletions)

**`b21342e` (Task 2):**
- `npm test` → `# pass 3288`, `# fail 0`
- `npm run build:www` → exit 0
- `npm run boot:check` → 4/4 PASS
- `node --test test/unit/shell-no-content-copies.test.js` → `# pass 6`, `# fail 0`
- `node --test test/unit/bridge-registry.test.js` → `# pass 10`, `# fail 0`; `node tools/bridge-doc.mjs --check` → exit 0
- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0`
- Engine fence: `git status --porcelain engine/ content/ test/parity/` → empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no unexpected file deletions)

## Decisions Made

- `test/unit/shell-combat-over.test.js` needed no edit — verified green with zero changes rather than edited speculatively (see key-decisions in frontmatter).
- `window.__mzArmorDisplay`/`__mzBagUsage`/`__mzUsableBy` bridge OBJECTS are left exactly as-is; only their consumer PROSE was updated where the store was the only consumer named (`__mzCarriedList`, `__mzUsableBy`).
- The line-budget fallback was run and exhausted with nothing in scope — the shortfall is recorded honestly, not chased by widening scope into Map/Combat/Rail/Oracle code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Six `storeRegion()` helpers' collapsed end-marker fixed via a new STORE_SRC constant**
- **Found during:** Task 1's own verification pass (`npm test` after the carve)
- **Issue:** Six pre-existing `shell-*.test.js` files' `storeRegion()` helpers used `sliceBetween(CODE, "if (S.store) {", 'document.getElementById("a-leave").onclick')` — the end marker no longer exists anywhere in `mazeworld.html` after the carve (it moved into `storeScreen.js`), so every call threw an assertion failure before the test's own body ever ran.
- **Fix:** Added a `STORE_SRC` constant (`storeScreen.js`'s own comment-stripped source, mirroring the existing `GEAR_SRC`/`HERO_SRC` pattern) to each file and re-pointed `storeRegion()` to return it directly — no slicing needed, the carved module's own file IS the region.
- **Files modified:** `test/unit/shell-map-store-polish.test.js`, `test/unit/shell-armor-display.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-clarity-43.test.js`, `test/unit/shell-gear-toolbar.test.js`, `test/unit/shell-input-guards.test.js`
- **Verification:** `npm test` — fail 0 after all six fixes.
- **Committed in:** `df78e66` (Task 1 commit)

**2. [Rule 1 - Bug] shell-map-store-polish.test.js's `storeRoll`/`STORE_ROLL_COPY` pins rewritten for the new ownership**
- **Found during:** Task 1's own verification pass
- **Issue:** Three tests asserted `S.storeRoll` / `const STORE_ROLL_COPY = "...";` against `mazeworld.html`'s CODE — both are now gone from the shell entirely (moved verbatim into `storeScreen.js` as `state.storeRoll` / `export const STORE_ROLL_COPY`), so the old assertions failed outright rather than merely needing a region re-point.
- **Fix:** Rewrote the three tests to read `STORE_SRC`, assert `state.storeRoll === true` (not `S.storeRoll`), assert `export const STORE_ROLL_COPY = "...";`, and assert the shell (`CODE`) now carries ZERO occurrences of `storeRoll`/`STORE_ROLL_COPY` (a positive proof of the move, not just an absence of the old string).
- **Files modified:** `test/unit/shell-map-store-polish.test.js`
- **Verification:** `npm test` — fail 0.
- **Committed in:** `df78e66` (Task 1 commit)

**3. [Rule 1 - Bug] My own storeScreen.test.js pin (test 4) avoided a substring false-positive from an unrelated `class="shelf"` literal**
- **Found during:** authoring `test/unit/storeScreen.test.js`'s own mount-pin test
- **Issue:** A first draft used `region.match(/"(shelf|sell-list|a-leave)"/g)` to prove no leftover Store id literal survives in `renderEncounter()`. This also matched the UNRELATED, pre-existing loot branch's `class="shelf" id="loot-drop-shelf"` card (the shared drop-shelf renderer, explicitly staying in the shell per this phase's own CONTEXT), producing a false failure.
- **Fix:** Scoped the check to `id="<id>"` / `getElementById("<id>")` patterns per specific id, which never match the unrelated `class="shelf"` literal.
- **Files modified:** `test/unit/storeScreen.test.js` (authored fresh, not a re-point)
- **Verification:** `node --test test/unit/storeScreen.test.js` — 8/8 pass.
- **Committed in:** `df78e66` (Task 1 commit)

**4. [Rule 1 - Bug] `docs/SHELL-MODULES.md`'s bridge-table CRLF/LF mismatch after a manual Line-budget edit**
- **Found during:** Task 2's own `node tools/bridge-doc.mjs --check` verification
- **Issue:** After hand-editing the `## Line budget` section (outside the bridge-table markers), `--check` failed — the file's editor-normalized line endings around the bridge-table region diverged from `renderTable()`'s freshly-generated `\n`-joined output, a pure whitespace mismatch with zero semantic content difference.
- **Fix:** Re-ran `node tools/bridge-doc.mjs --write`, which re-synced the table region consistently.
- **Files modified:** `docs/SHELL-MODULES.md`
- **Verification:** `node tools/bridge-doc.mjs --check` — exit 0.
- **Committed in:** `b21342e` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 — direct, required consequences of this plan's own named moves plus one editor-whitespace artifact; none touching `engine/`, `content/`, or `test/parity/`).
**Impact on plan:** No scope creep. All four fixes were required to keep `npm test`/`bridge-doc --check` green after this plan's own stated actions; none widen the carve beyond the Store screen or the closing gates.

## Issues Encountered

- The ROADMAP's own illustrative verbatim commands for criteria 1 and the Task-1 acceptance criteria (`awk .../paint()/,/^}/ | grep -c "__mzTabs\.(hero|gear)\("` and `awk .../renderEncounter()/,/^}/ | grep -cE '"(shelf|sell-list|sell-head|a-leave)"'`) both count one extra hit apiece — a stale Plan-03-era comment (`"window.__mzTabs.gear(...)"`) and the unrelated, pre-existing loot branch's `class="shelf" id="loot-drop-shelf"` card, respectively. Both are pre-existing, out-of-scope artifacts this plan does not touch (never Map/Combat code, never comment text). Comment-stripped and id-scoped re-checks (shown above and in `test/unit/storeScreen.test.js`) confirm the REAL counts are exactly what the criteria intend (2 mount calls, 0 leftover Store id literals). Not a functional gap — a wording imprecision in the illustrative commands themselves.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Deferred to the milestone-close Pixel 7 batch (verification agents are off for this milestone; per-plan on-device checks are not run). When that batch runs, check on a real device:

- **Store buy/sell/repair rows:** the shelf's buy rows (price, sold/disabled state, the repair row's "N hp to mend at a tenth of its cost each" sub-line) render identically to before this carve; usable-by suffixes on scroll/potion rows are correct; the "Your gear" sell list (Sell buttons with the right prices, plus Drop when the bag is full) works exactly as before.
- **The store roll copy:** on a run that started this build (`storeRoll: true`), the header shows "Stock rolled fresh for this floor. Deeper down, pricier regrets." — an old save shows the pre-Phase-33 header with no roll line.
- **Tab switching (Gear/Hero/Store):** switching between all three tabs (and into/out of the Store overlay) shows no flash, no missing panel, no stale content from a previous tab.

No code-level regression risk expected here — the DOM-snapshot lock (`test/unit/shell-tab-snapshots.test.js`) already proves byte-identical rendered output for the Store (both `thief-store.store` — a full-bag Thief — and `mu-store.store` — nothing to sell) across both task commits, on the first attempt, plus the SHELL-03 idempotency case (rendering twice never duplicates a row). This device round is a UX-feel confirmation, not a functional-regression hunt.

## Next Phase Readiness

- Phase 47 (Shell Modularisation) is functionally complete: SHELL-01, SHELL-02 and SHELL-03 are all marked complete in `REQUIREMENTS.md`. SHELL-04 stays Pending — its "under 5,000 lines" clause is unmet (5,621 lines, `[SHELL-04 line budget]` blocker in `.planning/STATE.md`) even though its registry/no-duplicate-pin clauses all hold.
- Phase 48 (Stale Docs, Comments & Test Names Purge, DOCS-01..03) inherits the line-budget shortfall as its most direct lever: 1,642 comment-only lines across the classic+module scripts is the single largest remaining category, per `docs/SHELL-MODULES.md#Line budget`'s classified breakdown.
- A future user ruling (flagged in the STATE.md blocker) may also consider: moving `renderDropShelf` into a shared module (currently deliberately shell-owned per this phase's own CONTEXT), moving `paint()`'s tab-mount skeleton into the module script (also deliberately shell-owned per CONTEXT), or naming the Map/Combat/Rail/Oracle surfaces as additional modules in a later phase (out of SHELL-01..04's stated scope).
- No blockers to Phase 48 starting — the shell is stable, all gates green, fixtures untouched since Plan 01.

---
*Phase: 47-shell-modularisation*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 3 key files found on disk (`src/browser/storeScreen.js`, `test/unit/storeScreen.test.js`, this SUMMARY); both task commits (`df78e66`, `b21342e`) found in git log.
