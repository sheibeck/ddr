---
phase: 62-gear-tab-layout-rebuild
plan: 02
subsystem: ui
tags: [gear-tab, dom-rebuild, css, presentation-only]

# Dependency graph
requires:
  - phase: 62-gear-tab-layout-rebuild (Plan 01)
    provides: "GEAR_COPY extension, GEAR_WORN_ORDER, and the eight pure Gear-tab view models (gearHeaderModel/gearUseCell/gearWornModel/gearBagMeterModel/gearBagCardsModel/gearConsumablesModel/gearKitRows) this plan wires into DOM"
provides:
  - "#screen-gear rebuilt to a ten-id skeleton (gear-stats, gear-worn-head/gear-worn, gear-bag-head/gear-bag-meter/gear-bag, gear-cons-head/gear-cons, gear-kit-head/gear-kit), replacing the retired Phase 43 ON YOU/BAG panels"
  - "the Phase 62 Gear CSS block (.mw-gear-*/#gear-* rules) mapped onto the existing tokens, text-scale-aware, reduced-motion safe"
  - "renderGearTab rewritten to turn the Plan 01 models into DOM via createElement/textContent only, reusing renderCarriedList's own Equip/swap-confirm/Drop actions per bag card"
  - "tabDeps() drinkPotion/readScroll closures over the existing window.mzDrinkPotion/mzReadScroll bridges"
  - "gearBagCardsModel's swap field (a Plan 01 gap this plan closed) — the SWAP-tag boolean exposed on its own, not just baked into the tag string"
  - "regenerated, declared gear snapshot fixtures (thief.gear.txt, mu.gear.txt, thief.gear-confirms.txt)"
  - "every gear source pin written against the two-panel renderer migrated to the new structure across 9 test files"
affects: [62-03-agreement-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-only render layer: renderGearTab reads ONLY the Plan 01 pure models and turns them into elements via createElement/textContent/dataset — zero business logic, zero HTML-string writes anywhere in its region (comment-stripped source pin enforced by test)"
    - "Per-card action harvesting: renderCarriedList (byte-identical, never edited) is called once per bag card with { gearRow: true, filter } and its .mw-gear-actions row is moved (appendChild re-parents/detaches) into the card — one confirm implementation, never forked"

key-files:
  created:
    - test/unit/gear-tab-dom.test.js
  modified:
    - mazeworld.html
    - src/browser/gearTab.js
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/mu.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt
    - test/unit/gearTab.test.js
    - test/unit/gear-panels.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/shell-loot-screen.test.js
    - tools/stale-terms.mjs

key-decisions:
  - "gearBagCardsModel didn't expose a `swap` boolean field (only baked '· SWAP' into the `tag` string) even though the plan's render instructions assumed `card.swap` existed — added `swap` as its own field on the model's return object (additive, no existing field changed, no Plan 01 test broken) rather than deriving it in the renderer from a string suffix check"
  - "the Phase 62 Gear CSS comment originally said 'no aria-disabled selector' — that literal phrase is itself a false-positive hit for three unrelated sibling suites (shell-combat-screen/shell-map-hud/shell-map-rail) that scan the WHOLE style region for the token 'aria-disabled' — reworded to 'disabled-state ARIA selector' to keep the comment's meaning without tripping those guards"
  - "removed a rotted tools/stale-terms.mjs ALLOWED entry (matched a shell-clarity-43.test.js migration comment this plan's own test rewrite legitimately deleted) rather than leave a stale survivor"
  - "shell-clarity-43.test.js/shell-gear-39.test.js/shell-worn-slots.test.js/shell-loot-screen.test.js/shell-spells-40.test.js/shell-armor-display.test.js migrations favor BEHAVIORAL assertions against the Plan 01 models (gearWornModel/gearKitRows/gearBagMeterModel/gearUseCell) over restated source-text regexes, per the plan's own explicit instructions for each file"

requirements-completed: [GSCR-01, GSCR-02, GSCR-03, GSCR-04, GSCR-05, GSCR-06]

coverage:
  - id: D1
    description: "#screen-gear ten-id skeleton + Phase 62 Gear CSS block (text-scale aware, reduced-motion safe, retires the Phase 43 panel rules)"
    requirement: "GSCR-01"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 5 CSS/deps pins (Task 1) + markup id pins"
        status: pass
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js — Markup/CSS/build-artefact pins (migrated)"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderGearTab rewritten on the Plan 01 models: header, WORN (5 fixed rows, empty-slot in-voice notes, ordering), USE cell wiring, Unequip wiring"
    requirement: "GSCR-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — header/WORN/Edge GSCR-03 ordering/USE cell/Unequip tests (9 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js — gearWornModel/USE-cell/Unequip behavioral tests (migrated)"
        status: pass
    human_judgment: false
  - id: D3
    description: "USE/ACTIVE/COOLING cell wiring, driven only by itemRowState via gearUseCell, on both WORN and bag-card rows"
    requirement: "GSCR-03"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — WORN USE cell + BAG cards USE cell tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "BAG capacity meter: used/cap readout, pips, BAG FULL line, one-under-cap and bag-less states"
    requirement: "GSCR-04"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 3 BAG meter tests (full/under-cap/bag-less)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js — gearBagMeterModel region pins (migrated)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Bag cards: name/desc/slot-tag(+SWAP)/USE cell, harvested Equip/swap-confirm/Drop actions, empty-bag state"
    requirement: "GSCR-05"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 5 BAG cards tests including Edge GSCR-05/encoding"
        status: pass
    human_judgment: false
  - id: D6
    description: "CONSUMABLES section: HEALING POTION (never wastes a potion), buff-potion groups, SCROLLS with engine refusal reason; ALSO ON YOU compact block"
    requirement: "GSCR-06"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 4 CONSUMABLES/ALSO ON YOU tests"
        status: pass
      - kind: unit
        ref: "test/unit/shell-spells-40.test.js — gearKitRows behavioral pins (migrated)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full suite green (minus documented pre-existing environment noise), build:www and boot:check pass, engine/content/test-parity untouched"
    verification:
      - kind: unit
        ref: "npm test — 4076/4083 (7 known pre-existing failures reproduced identically on the untouched wave base commit)"
        status: pass
      - kind: other
        ref: "npm run build:www — exits 0"
        status: pass
      - kind: other
        ref: "npm run boot:check — all 4 checks (no-uncaught/painted/graves/title) pass on a clean run"
        status: pass
    human_judgment: false

# Metrics
duration: ~3h
completed: 2026-09-23
status: complete
---

# Phase 62 Plan 02: Gear-Tab DOM + CSS Rebuild Summary

**#screen-gear rebuilt to a ten-id, five-section skeleton (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) wired to the Plan 01 view models via createElement/textContent only, with the three gear snapshot fixtures regenerated and every retired two-panel source pin migrated across 9 test files — full suite 4076/4083 (7 documented pre-existing environment-noise failures), build:www and boot:check both green.**

## Performance

- **Tasks:** 3 completed
- **Files modified:** 16 (1 created)

## Accomplishments
- Replaced `#screen-gear`'s two-panel markup (ON YOU / BAG) with the ten-id skeleton the mock specifies: `#gear-stats`, `#gear-worn-head`/`#gear-worn`, `#gear-bag-head`/`#gear-bag-meter`/`#gear-bag`, `#gear-cons-head`/`#gear-cons`, `#gear-kit-head`/`#gear-kit`.
- Added the Phase 62 Gear CSS block (24 new `.mw-gear-*`/`#gear-*` rules) on the mock's look, every font-size `calc(<rem> * var(--mw-text-scale))`, no transition/animation, no disabled-state ARIA selector; retired the Phase 43 `.mw-onyou-head`/`.mw-worn-empty`/`.mw-kit-head` and `.mw-wilmst`/`.mw-wilmst b` rules.
- `tabDeps()` gained `drinkPotion`/`readScroll` closures over the existing `window.mzDrinkPotion`/`window.mzReadScroll` bridges — no new engine action, no new bridge.
- Rewrote `renderGearTab(host, state, deps)` from scratch: it now only turns the Plan 01 models into DOM (`gearHeaderModel`/`gearWornModel`/`gearBagMeterModel`/`gearBagCardsModel`/`gearConsumablesModel`/`gearKitRows`) via small local `el()`/`head()`/`useCellEl()`/`chevron()` closures — zero `innerHTML` writes anywhere in its region. Bag cards reuse `renderCarriedList`'s own Equip/swap-confirm/Drop actions through one per-card `gearRow`-flagged call; `renderCarriedList` itself is byte-identical (verified past its own closing brace, independent of the JSDoc that precedes the next function).
- Regenerated the three declared gear snapshot fixtures (`thief.gear.txt`, `mu.gear.txt`, `thief.gear-confirms.txt`); confirmed via `git diff --stat` that no other fixture (hero/store) moved.
- Authored `test/unit/gear-tab-dom.test.js` (33 tests across both tasks): CSS/deps source pins, then a full render section covering header, WORN (order/empty/ordering/USE-cell/unequip), BAG meter (full/under-cap/bag-less), BAG cards (tags/USE/confirms/empty state), CONSUMABLES (heal/buff/scroll+Pilfer), ALSO ON YOU, the three named Edge GSCR-02/03/05 truths, idempotency and no-WP.
- Migrated every gear source pin written against the retired two-panel renderer across 8 test files (plus `gearTab.test.js`'s tabDeps key-count pin) — 25+ individual test rewrites, favoring behavioral assertions on the Plan 01 models over restated source-text regexes per the plan's own file-by-file instructions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase 62 Gear CSS block + tabDeps drinkPotion/readScroll + CSS/deps source pins** - `68e532d` (feat)
2. **Task 2: #screen-gear skeleton + renderGearTab rewrite on the models, harness ids, declared gear snapshot regeneration** - `1d52836` (feat)
3. **Task 3: Migrate the old two-panel source pins, then the full suite, build and boot checks** - `af7e1c4` (test)

## Files Created/Modified
- `mazeworld.html` - `#screen-gear` markup replaced with the ten-id skeleton; Phase 62 Gear CSS block added, Phase 43 gear rules + `.mw-wilmst` retired; `tabDeps()` gained `drinkPotion`/`readScroll`
- `src/browser/gearTab.js` - `renderGearTab` rewritten on the Plan 01 models; `GEAR_COPY.onYou`/`.wielded` removed; `gearBagCardsModel` gained an own `swap` field (Rule 1 fix, see Deviations)
- `test/unit/gear-tab-dom.test.js` (new) - CSS/deps pins (Task 1, 5 tests) + full render section (Task 2, 28 tests) = 33 tests
- `test/unit/harness/shellSandbox.js` - `SNAPSHOT_IDS.gear` repointed to the ten new ids
- `test/unit/shell-tab-snapshots.test.js` - gear-confirms test repointed from `#s-carry` to `#gear-bag`; test titles/header comment updated
- `test/unit/fixtures/shell-snapshots/{thief.gear,mu.gear,thief.gear-confirms}.txt` - regenerated (declared)
- `test/unit/gearTab.test.js` - tabDeps pin: 12 -> 14 deps keys
- `test/unit/gear-panels.test.js` - GEAR_COPY deep-equal pin drops `onYou`/`wielded`
- `test/unit/shell-clarity-43.test.js` - 7 tests migrated (markup, head copy, WORN-region, innerHTML-free, kit, CSS, build-artefact)
- `test/unit/shell-armor-display.test.js` - the `wornRow`/`noSlotNeeded` pin becomes a behavioral test on `gearWornModel`
- `test/unit/shell-gear-39.test.js` - the `wornSlotRow` half repointed to `gearUseCell`'s own region
- `test/unit/shell-worn-slots.test.js` - tests 4/5 rewritten on `gearWornModel`/render wiring; tests 1-3 untouched
- `test/unit/shell-spells-40.test.js` - the two Hero-tab-kit pins become behavioral tests on `gearKitRows`
- `test/unit/shell-loot-screen.test.js` - `paintCarryRegion` repointed to `gearBagMeterModel`'s own region
- `tools/stale-terms.mjs` - removed a rotted ALLOWED survivor entry (Rule 1 fix, see Deviations)

## Decisions Made
- `gearBagCardsModel`'s `swap` field: added as its own boolean on the model's return object rather than deriving it in the renderer via `card.tag.endsWith(GEAR_COPY.swap)` — keeps the "is this a swap" question answerable directly from the model, matching every other boolean the model already exposes (`filled`, `full`, etc.), and matches the plan's own render instructions verbatim (`card.swap`).
- Test migrations favor behavioral assertions against the Plan 01 pure models (`gearWornModel`, `gearBagMeterModel`, `gearUseCell`, `gearKitRows`) over restated source-text regexes wherever the plan's own per-file instructions said "becomes a behavioral test" — this is more resilient to future presentation-only refactors (Phase 63's action sheet) since the pins now travel with the model's contract, not the DOM-builder's exact literal text.
- `renderCarriedList`'s byte-identical guarantee was verified against its own function body only (start marker to its own closing `}`), not the naive "up to the literal string `export function renderGearTab(`" span the plan's acceptance criteria describes — that naive span also swallows the JSDoc comment immediately preceding `renderGearTab`, which legitimately changed as part of this plan's own render rewrite. The tighter, correct boundary (verified via a temporary worktree at the wave's base commit) confirms `renderCarriedList`'s actual function body is untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `gearBagCardsModel` didn't expose the `swap` field the render instructions assumed**
- **Found during:** Task 2 (render section test authoring)
- **Issue:** The plan's render action instructs `top.appendChild(el("span", "mw-gear-tag" + (card.swap ? " mw-gear-tag-swap" : ""), card.tag))`, but Plan 01's `gearBagCardsModel` only baked the "· SWAP" suffix into the `tag` STRING, never exposing a separate `swap` boolean on the returned card object — every bag card's tag rendered without the `mw-gear-tag-swap` CSS class.
- **Fix:** Added `swap: family ? swap : false` to `gearBagCardsModel`'s return object (additive; no existing field's value changed).
- **Files modified:** `src/browser/gearTab.js`
- **Verification:** `test/unit/gear-tab-dom.test.js`'s "BAG cards: a jewel with both keys worn gets 'JEWELRY · SWAP'" test passes; `test/unit/gear-view-models.test.js` (Plan 01's suite) still 94/94 green (the new field breaks no existing assertion).
- **Committed in:** `1d52836` (Task 2 commit)

**2. [Rule 1 - Bug] The Phase 62 CSS comment's own text tripped three unrelated sibling suites' "no aria-disabled selector" scans**
- **Found during:** Task 3 (full-suite run)
- **Issue:** The new CSS block's header comment said "no aria-disabled selector" — that literal phrase itself contains the substring three sibling test files (`shell-combat-screen.test.js`, `shell-map-hud.test.js`, `shell-map-rail.test.js`) scan the WHOLE style-tag region for, causing three unrelated tests to false-fail (`aria-disabled` found — inside a comment, not a real selector).
- **Fix:** Reworded the comment to "no disabled-state ARIA selector" (same meaning, no longer a false-positive trigger).
- **Files modified:** `mazeworld.html`
- **Verification:** `node --test test/unit/shell-combat-screen.test.js test/unit/shell-map-hud.test.js test/unit/shell-map-rail.test.js` — all 56 tests pass.
- **Committed in:** `af7e1c4` (Task 3 commit)

**3. [Rule 1 - Bug] A `tools/stale-terms.mjs` ALLOWED survivor entry rotted**
- **Found during:** Task 3 (full-suite run)
- **Issue:** `shell-clarity-43.test.js`'s "the WORN_SLOTS loop and wornSlotRow's own body stay innerHTML-free" test migration (this plan's own Task 3 rewrite) removed the migration comment an ALLOWED entry in `tools/stale-terms.mjs` was pointing at, so the survivor entry no longer matched any live line — `DOCS-01: no allow-list entry has rotted` failed.
- **Fix:** Removed the rotted `wornSlots`/`shell-clarity-43.test.js` ALLOWED entry, and narrowed the adjacent `retired-bridges` entry's alternation to drop the same dead alternative (its OTHER alternative still matches a live line, so that entry stays alive).
- **Files modified:** `tools/stale-terms.mjs`
- **Verification:** `node --test test/unit/stale-terms.test.js` — 5/5 pass.
- **Committed in:** `af7e1c4` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs surfaced by test authoring / the full-suite run, all necessary for the plan's own acceptance criteria to hold).
**Impact on plan:** No scope creep — every fix is a direct, minimal correction to either this plan's own new code (`swap` field, CSS comment) or a stale test-infrastructure entry this plan's own rewrite obsoleted.

## Issues Encountered
- `npm run build:www` initially failed with "`@capacitor/core` is not installed" — this fresh worktree had no `node_modules/`. Ran `npm install --prefer-offline` (confirmed `package.json`/`package-lock.json` unchanged afterward) per the plan's own standing ruling, then `build:www` succeeded.
- `npm run boot:check`'s "graves" check is intermittently flaky in this environment — 3 consecutive runs showed PASS/FAIL/PASS. Investigated by comparing against the untouched wave base commit (`bc3a743`) in a temporary detached worktree: the base commit's single run happened to pass, but re-running this plan's own build multiple times shows the same intermittent PASS/FAIL pattern on the SAME code — confirmed via direct inspection of the captured DOM dump that the "mw-error" string the check's regex flags on a FAIL run is present only inside the classic `<script>` tag's own source text (the `gravesLoadError` template literal), not as an actually-rendered error element; the timing race is between `loadGraves()`'s async `mzStorage.getItem` resolution and Chrome's `--dump-dom` capture. A clean final run shows all 4 checks (no-uncaught/painted/graves/title) PASS. Not caused by this plan's diff.
- Full-suite `npm test` reproduces 7 pre-existing failures in `test/unit/class-pass-ledger.test.js` (4) and `test/unit/flee-ledger.test.js` (3) — verified identical on the untouched wave base commit via a temporary detached worktree (`git worktree add --detach`), confirming pre-existing CRLF-checkout environment noise per the project's standing ruling, not caused by this plan.

## Next Phase Readiness
- Plan 03's agreement sweep can proceed: every GSCR-01..06 truth has a named, passing test; the store, loot, combat and hero surfaces are confirmed untouched (fixture diff scoped to exactly the three declared gear snapshots; `renderCarriedList`'s own function body verified byte-identical to the wave base commit).
- GSCR-11 is left `Pending` in REQUIREMENTS.md per the plan's own instruction — its rendering half is proven here (the tab reads the same shared view models as the ITEMS submenu/loot screen/store), but Plan 03's own agreement sweep is its stated proof point.
- No blockers. `engine/`, `content/` and `test/parity/` are byte-identical to the wave base commit (`git diff --stat` empty).

---
*Phase: 62-gear-tab-layout-rebuild*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/gearTab.js
- FOUND: test/unit/gear-tab-dom.test.js
- FOUND: .planning/phases/62-gear-tab-layout-rebuild/62-02-SUMMARY.md
- FOUND: commit 68e532d (Task 1)
- FOUND: commit 1d52836 (Task 2)
- FOUND: commit af7e1c4 (Task 3)
