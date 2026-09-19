---
phase: 43-clarity-pass
plan: 04
subsystem: shell
tags: [shell, gear-tab, hero-tab, loot-surfaces, phase-close, deferred-uat, milestone-close]

# Dependency graph
requires:
  - phase: 43-clarity-pass (Plan 01)
    provides: "the cause-first cost-line format and the 24 non-day-cycle Oracle/toast rewrites this plan's whole-phase gate re-verifies"
  - phase: 43-clarity-pass (Plan 02)
    provides: "eatsFor/nightlyEats as the ONE appetite read, rationsViewModel/eatsLineFor/RATIONS_COPY (src/browser/viewModels.js) this plan wires into the Hero RATIONS panel, the Joiner offer card and the Company panel"
  - phase: 43-clarity-pass (Plan 03)
    provides: "usableBy/USABLE_COPY/lootCompare.usable, dropShelfItems/emptySlotRows/GEAR_COPY (src/browser/viewModels.js) this plan bridges into mazeworld.html as pure read-only wiring, with zero new logic"
provides:
  - "mazeworld.html: a NEW viewModels import line + four read-only bridges (window.__mzUsableBy, window.__mzRations = { view, eatsLine }, window.__mzDropShelfItems, window.__mzGear); the pinned Phase 28/29/37/39 import line stays byte-identical"
  - "\"(usable by …)\" on the FIND card, every victory LOOT screen row, and every store buy row"
  - "\"eats N a rest\" on the Joiner offer card and the Company panel, both reading the SAME eatsLineFor the Hero RATIONS panel reads"
  - "the Hero tab's #rations-panel (#s-rations/#s-rations-n) reading window.__mzRations.view(S) — the same nightlyEats/eatsFor Make Camp charges, so it can never disagree with the refusal"
  - "the Gear tab as two panels: #onyou-panel (WIELDED / WORN with in-voice empty-slot rows / ALSO ON YOU) and #bag-panel — the bag-full drop prompt (find card + loot screen) now reads window.__mzDropShelfItems(c), bag items only"
  - "test/unit/shell-clarity-43.test.js (new, 22 tests); docs/CLARITY.md's Requirements map + Out of scope/next; .planning/REQUIREMENTS.md CLAR-01..05 complete — Phase 43, and v1.5, closed"
affects: ["milestone-close UAT batch"]

tech-stack:
  added: []
  patterns:
    - "a NEW, separate viewModels.js import line directly after the pinned Phase 28/29/37/39 line (never edited in place) — the Phase 28/29/37/39 shell-pin tests that assert the OLD line byte-identically never need to widen, mirroring the Phase 43 (CLAR-01) precedent of adding rather than editing pinned lines"
    - "read-only bridges assigned in the SAME module block, after window.__mzItemRowState, before window.__mzFightLogVM — the established Phase 28/29/37/39 ordering convention for 'assign every bridge before window.__mzClassicBoot() runs'"
    - "the ON YOU panel's empty-slot rows and head-label rows are built via createElement/textContent only, never innerHTML — the T-38-11 no-innerHTML-carries-an-item-name discipline extended to two brand-new row kinds"
    - "renderDropShelf(shelf, entries) destructures { it, i } — a MINIMAL signature change (rename items->entries, iterate pairs) rather than fixing the old raw-c.items index math in place, so the true c.items index is guaranteed correct by construction, not by a second index calculation in the shell"

key-files:
  created:
    - test/unit/shell-clarity-43.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-company-panel.test.js
    - test/unit/shell-loot-screen.test.js
    - docs/CLARITY.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The Company panel's Eats row moved from a literal template string (`Eats ${RACES[m.race]?.eats || 1} a rest`) to a JS-computed `eatsText` interpolated via `${escText(eatsText)}` — this meant test/unit/shell-company-panel.test.js's own field-order needle (previously the literal substring \" a rest\", which no longer appears verbatim in the SOURCE once the text is JS-computed) had to be re-pinned to the interpolation site itself (`escText(eatsText)`), not merely widened. Documented as a Phase 43 (CLAR-05) re-pin, not a scope change."
  - "test/unit/shell-clarity-43.test.js strips HTML comments BEFORE JS line/block comments — the SAME fix test/unit/hp-not-wp.test.js's own header documents (43-01-SUMMARY.md): an HTML comment containing a bare `/*`-shaped substring (elsewhere in the file) makes a naive block-comment-first pass swallow everything up to the next literal `*/`, silently deleting the newly-added `#rations-panel`/`#onyou-panel` markup from the stripped-source view a new full-document shell-pin test constructs. Caught by a failing assertion during authoring, fixed before the first commit."
  - "A raw full-document regex scan for the standalone word wp/WP (mirroring hp-not-wp.test.js's own regex) produces false positives against legitimate JS identifiers like `const wp = m.wp ?? 0` when run over un-tag-stripped source (hp-not-wp.test.js itself only ever scans tag-stripped/COPY-object text, never raw code). Rather than re-deriving an identifier-aware regex a second time in a sibling test file, this plan's HP-not-WP hand-off test instead pins that the OLD literal template string reading `RACES[m.race]` is gone from the Company panel's source — the standing test/unit/hp-not-wp.test.js suite (unchanged, still green) is the actual guard."

requirements-completed: [CLAR-01, CLAR-02, CLAR-03, CLAR-04, CLAR-05]

coverage:
  - id: D1
    description: "The NEW viewModels import line + four read-only bridges (__mzUsableBy/__mzRations/__mzDropShelfItems/__mzGear) exist exactly once each, after window.__mzItemRowState; the pinned Phase 28/29/37/39 import line and window.__mzNightlyEats stay byte-identical"
    requirement: "CLAR-02, CLAR-03, CLAR-04, CLAR-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (bridge-block tests); test/unit/shell-armor-display.test.js/shell-gear-39.test.js/shell-loot-screen.test.js (the three pre-existing pins on the OLD import line, unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "\"(usable by …)\" shows on the FIND card, every victory LOOT row, and every store buy row, via window.__mzUsableBy(it, c)/lootCompare.usable — the ONE usableBy rule from Plan 03, never a restated class check in the shell"
    requirement: "CLAR-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (FIND/LOOT/store pins)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Joiner offer card and the Company panel both show \"eats N a rest\" from window.__mzRations.eatsLine — the SAME read the Hero RATIONS panel and the camp gate use; the Company panel's old inline RACES[m.race] read is gone"
    requirement: "CLAR-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (Joiner/Company-panel pins); test/unit/shell-company-panel.test.js (re-pinned field order + field-read regex); test/unit/shell-party-camp.test.js (unchanged, verified the appended clause does not break the innerHTML-free joiner region)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Hero tab's #rations-panel reads window.__mzRations.view(S) once and writes #s-rations/#s-rations-n via textContent (never innerHTML) — the same nightlyEats/eatsFor Make Camp charges, so it can never disagree with the refusal"
    requirement: "CLAR-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (RATIONS panel markup + paint()-wiring pins)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Gear tab is exactly two panels (#onyou-panel: WIELDED / WORN with in-voice empty-slot rows / ALSO ON YOU; #bag-panel: BAG) in the pinned source-index order; the kit's weapon/armor rows are no longer duplicated; every pre-existing Gear-tab shell pin (worn-slots/gear-toolbar/gear-39/loot-screen/armor-display) still passes unchanged"
    requirement: "CLAR-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (markup order, paint()-wiring, kit-dedup pins); test/unit/shell-worn-slots.test.js/shell-gear-toolbar.test.js/shell-gear-39.test.js/shell-loot-screen.test.js/shell-armor-display.test.js (all unchanged, all green)"
        status: pass
    human_judgment: false
  - id: D6
    description: "renderDropShelf(shelf, entries) destructures { it, i } from window.__mzDropShelfItems(c) at both call sites (find card, loot screen) — the drop prompt lists slot-consuming BAG items only, with the true c.items index, never a worn/wielded piece or a potion"
    requirement: "CLAR-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-clarity-43.test.js (renderDropShelf shape + both-call-sites pin)"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/CLARITY.md's Requirements map (CLAR-01..05 -> proof) and Out of scope/next section are filled; .planning/REQUIREMENTS.md marks CLAR-01..05 complete (checkboxes + traceability table) — Phase 43 and v1.5 are fully closed"
    requirement: "CLAR-01, CLAR-02, CLAR-03, CLAR-04, CLAR-05"
    verification:
      - kind: unit
        ref: "grep -c on docs/CLARITY.md's section headers; grep -cE on .planning/REQUIREMENTS.md's CLAR-0[1-5] checkboxes/traceability rows"
        status: pass
    human_judgment: false
  - id: D8
    description: "The whole-phase gate is green and every number recorded: npm test 3168/3168 (# fail 0); prototype-master.js.txt hash unchanged; npm run build:www exit 0; test/parity/fixtures porcelain empty; fonts.googleapis count 0; floor-gen-rng-pin/chargen-rng-pin green; package.json/lock and docs/class-pass/ unchanged since Phase 42 close (84c6722); the SC-5 guard set (toastsCoverage/formatEventsCoverage/hp-not-wp/voice safety-scan) run explicitly, 25/25 green"
    requirement: "CLAR-01, CLAR-02, CLAR-03, CLAR-04, CLAR-05"
    verification:
      - kind: unit
        ref: "npm test; git hash-object test/parity/prototype-master.js.txt; npm run build:www; git status --porcelain test/parity/fixtures; grep -c fonts.googleapis mazeworld.html; node --test test/unit/floor-gen-rng-pin.test.js test/unit/chargen-rng-pin.test.js; git diff --stat 84c6722 -- package.json package-lock.json docs/class-pass/; node --test test/unit/toastsCoverage.test.js test/unit/formatEventsCoverage.test.js test/unit/hp-not-wp.test.js test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false
  - id: D9
    description: "The aggregated, plan-grouped, continuously-numbered Pixel 7 checklist (30 items across all 4 plans) exists in this SUMMARY for the milestone-close UAT batch (never executed in this run)"
    verification: []
    human_judgment: true
    rationale: "Deferred per this run's standing 'defer uat to end' protocol — no device steps, no adb, no APK build taken in this run. On-device verification runs at the milestone-close UAT batch."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 43 Plan 04: Shell Wiring + Phase Close Summary

**The clarity view models (Plans 01-03) wired into the shell — "(usable by …)" on the FIND card, every victory LOOT row, and every store row; "eats N a rest" on the Joiner offer card and the Company panel; the Hero tab's RATIONS panel; the Gear tab split into ON YOU (WIELDED / WORN with in-voice empty-slot rows / ALSO ON YOU) and BAG with a bag-only drop shelf — then the CLARITY ledger closed, all five CLAR requirements complete, the whole-phase gate green, and the full Phase 43 Pixel 7 checklist aggregated for milestone-close UAT. This is the last plan of the last phase of v1.5.**

## Performance

- **Duration:** unrecorded (single continuous session, no start-time checkpoint captured)
- **Tasks:** 3 (plan tasks) — committed as 3 atomic commits
- **Files modified:** 5 (1 new, 4 modified)

## Accomplishments

- **Task 1 — bridges + loot surfaces + Joiner card + Company panel + Hero RATIONS panel:** a NEW `import { usableBy, rationsViewModel, eatsLineFor, dropShelfItems, emptySlotRows, GEAR_COPY } from "./src/browser/viewModels.js";` line lands directly after the pinned Phase 28/29/37/39 import line (which stays byte-identical — verified against all three of its own pin tests). Four read-only bridges (`window.__mzUsableBy`, `window.__mzRations = { view, eatsLine }`, `window.__mzDropShelfItems`, `window.__mzGear`) are assigned after `window.__mzItemRowState`. The FIND branch (`renderRail`'s `pendingFind` case) computes `usable` via `window.__mzUsableBy(it, c)` and appends it to the pushed line; its drop shelf now reads `window.__mzDropShelfItems(c)` instead of raw `c.items`. The victory LOOT screen's `subFor` appends `cmp.usable`; its drop shelf call is re-pointed the same way. Store rows compute `usable` (guarded on `item.effectParams.item`) and append it into the `<i>` sub — a static `USABLE_COPY` string, never user/item text, inside `innerHTML`. The Joiner offer card's roll line now ends `· ${window.__mzRations.eatsLine(j)}`. The Company panel's Eats row is capitalised locally from `eatsLineFor(m)` and rendered through `escText`; the old inline `RACES[m.race]?.eats || 1` read is gone. A new Hero-tab `#rations-panel` (`#s-rations`/`#s-rations-n`) sits between `#s-trait` and `#hero-party`; `paint()` writes it from `window.__mzRations.view(S)` immediately after the `s-cost` assignment.
- **Task 2 — the Gear tab as two panels:** `#screen-gear` now holds exactly two panels in source order — `#onyou-panel` (`<h2>On you</h2>`, the wilmst chip, `<ul id="s-onyou">`, then `<ul id="s-kit">`) and `#bag-panel` (`<h2>Bag <span id="s-carry-n"></span></h2>`, `<ul id="s-carry">`). `paint()`'s carry region declares `const onyou = document.getElementById("s-onyou");` right beside `carry`, clears both, and reads `window.__mzGear.emptySlotRows(c)` once into an `emptyFor(slot)` lookup; two new `textContent`-only helpers (`headRow`, `emptyRow`) render the WIELDED/WORN head labels and the in-voice empty-slot fallback rows. `wornRow` and `wornSlotRow` now append to `onyou` (their own pinned signatures/regions untouched — verified against every pre-existing shell-worn-slots/gear-toolbar/gear-39/loot-screen/armor-display pin). The `WORN_SLOTS` loop keeps its single `for` statement but now falls back to `emptyRow(r.text)` when a slot is empty. The kit's `rows` array no longer duplicates the weapon/armor rows (its first entry is now `["Potions", c.potions]`); a new `mw-kit-head` row (`gearCopy.alsoOnYou`) precedes the list. `renderDropShelf(shelf, entries)` now destructures `{ it: bi, i }` from `window.__mzDropShelfItems(c)` at both call sites — the function itself never reads `c.items`/`c.worn`/`c.weapon`/`c.armor`. Three new CSS rules (`.mw-onyou-head`, `.mw-worn-empty`, `.mw-kit-head`) carry no transition/animation token and no disabled-state ARIA selector.
- **Task 3 — phase close:** `docs/CLARITY.md` gained its `## Requirements map` (CLAR-01..05 each mapped to its proof — code, tests, docs) and a new `## Out of scope / next` section. `.planning/REQUIREMENTS.md` flips CLAR-01..05 to `[x]` and their traceability rows to `Complete`. The whole-phase gate ran and every number is recorded below, including the SC-5 guard set run explicitly.

## Task Commits

Each task was committed atomically:

1. **Task 1: usable-by on FIND/LOOT/store rows; Joiner card + Company panel eats line; Hero RATIONS panel; clarity bridges** - `8cb956c` (feat)
2. **Task 2: Gear tab = ON YOU (wielded / worn with empty slots / also on you) + BAG; bag-only drop shelf** - `f4aacc3` (feat)
3. **Task 3: CLARITY requirements map; REQUIREMENTS CLAR-01..05 complete; whole-phase gate** - `195d3c5` (docs)

**Plan metadata:** (this commit, immediately following; `commit_docs: true` in `.planning/config.json`, so the final metadata commit still fires for `.planning/` docs — the orchestrator owns STATE.md/ROADMAP.md per this run's instructions)

## Files Created/Modified

- `mazeworld.html` — the NEW viewModels import line + four bridges; FIND/LOOT/store `usable` wiring; the Joiner card + Company panel eats lines; `#rations-panel`; the Gear tab's `#onyou-panel`/`#bag-panel` split + `paint()`'s `onyou`/`headRow`/`emptyRow` wiring; `renderDropShelf(shelf, entries)`; three new CSS rules
- `test/unit/shell-clarity-43.test.js` (new, 22 tests) — source pins for every surface above (bridges, FIND/LOOT/store, Joiner/Company panel, RATIONS panel markup + wiring, voice, Gear-tab markup order, paint()-region wiring, kit dedup, renderDropShelf shape, CSS, build artefact)
- `test/unit/shell-company-panel.test.js` — re-pinned the field-order needle and the field-read regex to the new `eatsLineFor` bridge read (Phase 43 CLAR-05 reason)
- `test/unit/shell-loot-screen.test.js` — re-pinned the find card's drop-shelf source pin to `window.__mzDropShelfItems(c)` (Phase 43 CLAR-04 reason)
- `docs/CLARITY.md` — `## Requirements map` + `## Out of scope / next`
- `.planning/REQUIREMENTS.md` — CLAR-01..05 marked complete

## Decisions Made

See `key-decisions` in the frontmatter: (1) the Company panel Eats-row re-pin (a JS-computed interpolation site replaces a literal template needle); (2) the HTML-comments-first stripComments order in the new shell-pin test file (the same fix Plan 01's `hp-not-wp.test.js` already documented); (3) the HP-not-WP hand-off test pins the OLD literal's absence rather than re-deriving an identifier-aware regex a second time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A new CSS comment's own text ("no transition/animation/aria-disabled token") tripped the pre-existing `<style>`-block aria-disabled scan**

- **Found during:** Task 2, running the full `npm test` gate after adding the three new CSS rules
- **Issue:** Three pre-existing tests (`shell-fight-gate.test.js`, `shell-abilities.test.js`, `shell-worn-slots.test.js` — the ones asserting "no `aria-disabled` selector anywhere in the `<style>` block") scan the WHOLE style block's raw text, not just selectors — they do not distinguish a CSS comment from an actual selector. This plan's own new comment above `.mw-onyou-head` literally contained the substring "aria-disabled" (documenting the convention it was following), tripping three unrelated tests.
- **Fix:** Reworded the comment to "no disabled-state ARIA selector" — same meaning, no literal token collision.
- **Files modified:** `mazeworld.html`
- **Verification:** `npm test` — 3168/3168, `# fail 0` (all three previously-failing tests now pass).
- **Committed in:** `f4aacc3` (Task 2 commit)

**2. [Rule 1 - Bug] `test/unit/shell-clarity-43.test.js`'s own generic `sliceBetween` helper miscounted when an end marker was a literal substring of its own start marker**

- **Found during:** Task 1, authoring the Company-panel region test
- **Issue:** `partyRosterRegion()`'s end marker (`"function "`) is a literal substring of its own start marker (`"function renderPartyRoster() {"`), and the shared `sliceBetween` helper (copied from the shell-terrain-41.test.js precedent) searched for the end marker starting AT the start index rather than after it — returning a zero-length "region" and failing every assertion downstream.
- **Fix:** Changed `sliceBetween`'s end-marker search to start at `start + startMarker.length` instead of `start`. This is a test-authoring correction local to the new file; no other shell-*.test.js file's own `sliceBetween` needed this fix (none of their start/end marker pairs collide this way).
- **Files modified:** `test/unit/shell-clarity-43.test.js`
- **Verification:** `node --test test/unit/shell-clarity-43.test.js` — 15/15 (Task 1), later 22/22 (Task 2).
- **Committed in:** `8cb956c` (Task 1 commit)

**3. [Rule 1 - Bug] The new shell-pin test file's own full-document `stripComments` swallowed the newly-added `#rations-panel` markup**

- **Found during:** Task 1, authoring the RATIONS-panel markup-order test
- **Issue:** `mazeworld.html` carries an HTML comment elsewhere in the file containing a bare `/*`-shaped substring (documented by Plan 01's `43-01-SUMMARY.md` as the same root cause). A naive block-comment-first `stripComments` pass (the pattern most sibling shell-*.test.js files use, copied initially into this new file) reads that embedded `/*` as a real comment opener and silently swallows everything up to the next literal `*/` it can find — which happened to consume the region containing the new `#rations-panel` markup, producing a false "0 !== 1" failure.
- **Fix:** Adopted `test/unit/hp-not-wp.test.js`'s own fix: strip HTML comments (`<!-- -->`) BEFORE JS line/block comments. Documented in the new file's own header comment, same as the precedent.
- **Files modified:** `test/unit/shell-clarity-43.test.js`
- **Verification:** `node --test test/unit/shell-clarity-43.test.js` — all markup-order tests pass.
- **Committed in:** `8cb956c` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — one real shell bug-adjacent fix (the CSS comment wording) and two test-authoring corrections caught and fixed before any commit landed failing).
**Impact on plan:** No scope creep, no architectural change. All three fixes are exactly the kind of same-plan correction Rule 1 exists for.

## Issues Encountered

None beyond the three items above (found and reconciled inline during each task's own verification, part of the green suite before that task's commit).

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **3168/3168**, `# fail 0` (well above the required floor of Plan 03's 3146 + 22 = 3168 — exactly met, since this plan added exactly 22 new tests and modified zero others' counts)
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched by this plan)
- `grep -c fonts.googleapis mazeworld.html`: 0
- `node --test test/unit/floor-gen-rng-pin.test.js test/unit/chargen-rng-pin.test.js`: 6/6 green
- `git diff --stat 84c6722 -- package.json package-lock.json docs/class-pass/`: empty (no installs, no matrix re-run since Phase 42's close)
- **SC-5 hard gate, run explicitly and quoted:** `node --test test/unit/toastsCoverage.test.js test/unit/formatEventsCoverage.test.js test/unit/hp-not-wp.test.js test/voice/safety-scan.test.js` — **25/25 green**
- Cumulative diff vs Phase 41's close (`816eaee`): `git diff --stat 816eaee -- engine content src mazeworld.html docs tools test/parity/fixtures` — 15 files changed, 840 insertions(+), 111 deletions(-) across `content/potions.js`, `content/races.js`, `content/skills.js`, `content/treasure-tables.js`, `docs/CLARITY.md`, `docs/RATIONS.md`, `engine/encounters.js`, `engine/magic.js`, `engine/movement.js`, `mazeworld.html`, `src/browser/eventNarration.js`, `src/browser/rail.js`, `src/browser/toasts.js`, `src/browser/viewModels.js`, `test/parity/fixtures/action-script.economy.json` — zero new dependencies, zero files outside the declared set
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged)

## Success Criteria Map (ROADMAP SC-1..5, as amended by CONTEXT)

| SC | Text (as amended) | Landed in | Proof |
|----|------|-----------|-------|
| 1 | A costly Oracle/rail line names its cause in plain language sourced from the event payload | Plan 01 (non-day-cycle rows) + Plan 02 (day-cycle rows) | `test/unit/clarity-cause-lines.test.js`; `test/unit/rations-audit.test.js` |
| 2 | Every loot offer (encounter-dot find, victory screen, store row) shows "(usable by …)" when class-restricted | Plan 03 (`usableBy`/`lootCompare.usable`) + Plan 04 (the shell wiring) | `test/unit/usableBy.test.js`; `test/unit/lootCompare.test.js`; `test/unit/shell-clarity-43.test.js` |
| 3 | The Hero screen lists rations eaten per rest (hero + each Joiner + total), matching Make Camp's own arithmetic | Plan 02 (`eatsFor`/`rationsViewModel`, `total === nightlyEats(state)`) + Plan 04 (the `#rations-panel`) | `test/unit/rationsViewModel.test.js`; `test/unit/shell-clarity-43.test.js` |
| 4 | The Gear screen is two panels — ON YOU and BAG — and the bag-full drop prompt lists bag items only (as amended by CONTEXT §CLAR-04: ON YOU = WIELDED + WORN, staff is a worn slot, no shields exist; the roadmap's original "Carried: weapon, staff, shield" grouping is superseded) | Plan 03 (`dropShelfItems`/`emptySlotRows`/`GEAR_COPY`) + Plan 04 (the `#onyou-panel`/`#bag-panel` markup and wiring) | `test/unit/gear-panels.test.js`; `test/unit/shell-clarity-43.test.js` |
| 5 | `toastsCoverage.test.js` and `formatEventsCoverage.test.js` stay green — no cause string bypasses the coverage guard | All four plans (verified at every plan's own gate; run explicitly again at this phase-close gate alongside `hp-not-wp.test.js`/the voice scan) | `test/unit/toastsCoverage.test.js`; `test/unit/formatEventsCoverage.test.js`; `test/unit/hp-not-wp.test.js`; `test/voice/safety-scan.test.js` (25/25) |

## For PROJECT.md

Three Key Decisions this phase hands to the orchestrator for `PROJECT.md`'s Key Decisions ledger at phase close (this plan does NOT edit `PROJECT.md` — that is the orchestrator's job):

1. **The cause-first cost-line convention** (`<Cause>: <plain-language why>. −N <unit>.`) — payload-sourced, additive keys only (never a renamed existing key, since fixtures compare events), cause first and cost last, the number always stated when the engine knows it, the item named when there is no number. Combat strike lines (`struckByFoe`/`foeBolted`'s in-combat fold/`memberStruck`) deliberately keep the Phase 34 dice-first fight-log convention — the foe's name IS the cause there, and the fight log folds them differently. This is now a standing rule for every future cost-bearing event this codebase introduces, not a one-phase sweep.
2. **`eatsFor`/`nightlyEats` (`engine/movement.js`) is the ONE appetite definition** — read by the camp gate (`makeCamp`'s `campFailed` refusal), the fed-night charge (`newDay`'s `rationsEaten`), the unfed-night narration (`wentHungry`), the Hero RATIONS panel, the Joiner offer card, and the Company panel. Six call sites, one function — the Hero sheet can structurally never disagree with what Make Camp actually charges. The CLAR-05 audit verdict: the prototype's ration rules (hero appetite by race, the 100-square day, fed/unfed branches, starvation-to-death, starting rations, ration sources) are fully implemented with zero missing rules found; the rulebook-only sleep-hours partial-rest penalty and the wandering-monster-hour WP forfeit were deliberately NOT adopted (no prototype counterpart — per the greenfield ruling, the prototype is canon and the AFTER matrix is closed).
3. **The Gear tab's ON YOU / BAG grouping** — WIELDED (the weapon) + WORN (armor + the six Phase 37 `WORN_SLOTS`: ring/bracelet/amulet/helm/cloak/staff, each empty slot rendered as an in-voice row) + ALSO ON YOU (potions/scrolls/rations/wilmst/spell charges/running effects/kills — items needing no bag slot) together form ON YOU; BAG is exactly the slot-consuming `c.items` entries. The roadmap's original "Carried: weapon, staff, shield" grouping is superseded — staff is a worn slot per Phase 37, and there are no shields in the game. The bag-full drop prompt is bag-only by construction (`dropShelfItems`), never a worn/wielded piece or a slot-exempt potion.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device steps were taken this plan (or anywhere in Phase 43). This is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. Items that named a "wait for Plan 04" caveat in their originating plan's own SUMMARY are stated here without that caveat — Plan 04 has now landed. An item covered by more than one plan is listed once, under the earliest plan, with an "(also Plan NN)" note.

### Plan 01

1. **Spring a trap** — the rail card "A TRAP" reads `Trap: <name> finds you first. −N hp.`
2. **A Being-trapped hero enters a dead end** — the AFRAID/rail card reads `Being trapped: four walls and one door you already used. −N hp.` (the ROADMAP SC-1 literal)
3. **Fall off a wall / short of a crevice** — the lines read `Fall: the wall had other plans. −N hp.` / `Fall: short. The floor of the crevice makes its introduction. −N hp.`
4. **An Apprentice backfire / a Summoner backfire / an Earthquake with no ward / a Death cast** — each line names the spell (or "Death") and the fee, e.g. `Backfire: Fireball went wrong in your hands — the Apprentice tax, one time in eight. −N hp.`
5. **Buy anything** — the line reads `Bought: <item>. −N wilmst.`
6. **Flee with a loot pile pending** — the line reads `Fled: the loot stays with them — <items>.`
7. **A Cutthroat descent that loses a Joiner** — the line opens `Cutthroat: <name> …`
8. **The Gear tab's ON YOU/ALSO ON YOU rows for Cloak of Healing / Cloak of Regeneration / Rowan Staff / Poplar Staff and a Healing potion row all read "hp", never "wp"** (the two-panel Gear tab restructure from Plan 04 moved these rows — the weapon/armor/worn-slot rows are now under ON YOU, the potion/rations/etc rows under ALSO ON YOU inside ON YOU's kit list — the hp-not-wp wording itself is unaffected)
9. **A voice read of every rewritten line on-device** — deadpan, family-friendly, no tonal drift from the surrounding Oracle log

### Plan 02

10. **Make camp with rations, no heal needed (already at full hp)** — the rail card reads `Rations: you eat N…` (title may read DAY N or FED depending on what else fired that dispatch); with a Troll hero or Troll member in the party the line ends `Trolls eat for two.` before the ration count.
11. **Make camp with rations, a heal happens** — the rail card heads `CAMP MADE`, and the Oracle log shows the `Rations: …` line immediately before the rest line.
12. **Walk (or camp) with 0 rations** — the rail/Oracle line reads `Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −N hp.` (or "the party eats N a night" with a live Joiner); a Heft Thief additionally sees the `(Heft: half, as promised)` clause.
13. **Tap MAKE CAMP without enough rations** — the refusal still states need/have and the members exactly as before (unchanged) — no regression.
14. **A voice read of the new `Rations:`/`Hunger:`** lines — deadpan, family-friendly, no tonal drift from the surrounding Oracle log.

### Plan 03

15. **FIND card on a class-restricted weapon/armor drop** — offer a Fighter-only weapon (e.g. Bardiche) to a Thief; the card should read `(usable by Fighters — not you)` in the deadpan voice, no tonal drift.
16. **FIND card on a Thief with the Heft skill, offered Mail** — should read `(usable by Fighters — and a Thief with Heft)`.
17. **Victory LOOT screen rows** — every weapon/armor/staff row shows the same suffix as the FIND card would for that item.
18. **Store buy rows** — a Fighter-only weapon/armor for sale reads `(usable by Fighters)` (or `— not you` if the current hero can't use it); an unrestricted item (Axe, Cloth) shows no suffix at all.
19. **Gear tab ON YOU panel, empty slots** — an unequipped ring/bracelet/amulet/helm/cloak/staff each read their own in-voice empty line ("ring — nothing. Ten fingers, zero commitments." etc.); a non-Magic-User's empty staff slot reads "staff — nothing, and nothing you could hold. Magic Users only." while a Magic User's reads the plain "Wave your hands…" line.
20. **Bag-full drop prompt** — with a potion and two gear items in the bag, the drop shelf lists only the two gear items (never the potion, never the worn/wielded weapon or armor); tapping a listed item drops the correct one (index correctness).

### Plan 04

21. **FIND card on a class-restricted item** shows `(usable by …)` / `(… — not you)` after the item line.
22. **The LOOT screen rows** show it after the compare line.
23. **Store rows** show it in the sub line.
24. **The Joiner offer card's roll line** ends `· eats N a rest` (2 for a Troll).
25. **The Company panel's line** reads `Eats N a rest` from the same source.
26. **The Hero tab's RATIONS panel** reads the full line and `N carried`, and changes immediately after Make Camp / a ration purchase / a Joiner joining.
27. **The Gear tab** shows ON YOU (WIELDED / WORN with `ring — nothing…` style empty rows, `staff — nothing, and nothing you could hold. Magic Users only.` for a non-Magic-User, ALSO ON YOU) and BAG with `n / slots`; Use/Unequip/swap-confirm still work on the ON YOU rows; Equip/Use/Drop still work on BAG rows.
28. **With a full bag**, the find card's and loot screen's drop shelf lists ONLY bag items — never the worn ring/cloak/staff, never the weapon/armor, never a potion.
29. **TalkBack reads the RATIONS panel and the ON YOU head rows** (`WIELDED`/`WORN`/`ALSO ON YOU`).
30. **A voice read of every new string** (`usable by`, the empty-slot rows, the RATIONS line, the FED card) in real play — deadpan, family-friendly, no tonal drift.

## Corrections to CONTEXT

Aggregated from all four plans:

- **Death potion → Death SPELL** (Plan 01): `43-CONTEXT.md`'s sweep list names "Death potion" as a cost-bearing event; there is no Death potion in the game. The 25-hp self-cost is the Death SPELL (`engine/magic.js`, `sp.kind === "death"`, events `deathCast`/`deathSpellTooWeak`).
- **No in-combat foe DOT on the hero** (Plan 01): `43-CONTEXT.md`'s sweep list mentions "foe DOT ticks on the hero." No such mechanic exists — the hero's only DOT is the exploration `afflictionTick`; the foe-ability costs are `foeBolted`/`foeDrained` (both already covered).
- **The measured txt-carve-out seed list** (Plan 01): chargen seeds 2 and 4 roll a Cloak of Regeneration; movement seed 256 rolls a Cloak of Healing; encounters seed 160 rolls a Cloak of Regeneration; no fixture seed rolls a Rowan/Poplar Staff into a starting kit.
- **Heft's halving applies only to the unfed-night cost-of-living charge, never to the ration count itself** (Plan 02): confirmed exactly by the live audit — `eatsFor` reads `RACES[race].eats` alone, with no Heft term, matching both the prototype and the rulebook's own wording of the skill.
- **The prototype's fed-night branch never actually charges hp** (Plan 02): despite narrating "pay N wp of upkeep from your rations," a direct read of `test/parity/prototype-master.js.txt` (lines 1280-1287) shows the only real fed-night cost is the ration count — the engine's `rested` event carries the exact same property (narrates a heal, never a hp charge). Recorded in `docs/RATIONS.md` (R5, IMPLEMENTED) rather than treated as a missing rule.
- **The Joiner offer card carries no item at all** (Plan 03): `43-CONTEXT.md`'s CLAR-02 decision names "the Company/Joiner offer where an item is involved" as a site needing the usable-by suffix. Verified directly: the Joiner offer card offers a companion, never a piece of gear — this resolves to "none" for the usable-by suffix (it DOES, however, show the ration-eats suffix, per CLAR-05 — a different, unrelated requirement this same offer card also serves).
- **This plan's own Company panel Eats-row re-pin** (Plan 04): the field-order test needle in `test/unit/shell-company-panel.test.js` had to move from the literal string `" a rest"` (which no longer appears verbatim in the source once the Eats text is JS-computed via `eatsLineFor`) to the interpolation site `escText(eatsText)` — not anticipated by the plan's own read_first line numbers, but a mechanical consequence of the exact wiring the plan specified.

## Next Phase Readiness

- Phase 43 — and with it **v1.5** — is fully closed: all five CLAR requirements (CLAR-01..05) are complete, `npm test` is green at 3168/3168, and the parity master/fixtures are byte-identical to before the phase.
- Every engine surface (Plans 01-02) and every shell surface (Plans 03-04) needed for cost-line clarity, loot legibility, ration honesty, and the Gear tab split is complete and reusable as-is.
- `docs/CLARITY.md` is the living reference for the full CLAR-01..05 ledger, the cost-event inventory, the HP-not-WP sweep, the loot-legibility rule, the Gear-screen split, and the Requirements map this phase established. `docs/RATIONS.md` is the audited ration-rule ledger.
- The 30-item aggregated Pixel 7 checklist above is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- Three Key Decisions above are handed to the orchestrator for `PROJECT.md` at phase close.
- **v1.5 is complete.** All 36 v1.5 requirements (SPELL/ABIL/GEAR/TERR/FLEE/TGT/CUT/JOIN/CLAR/BAL) are mapped to phases and marked complete. The next milestone begins with `/gsd-complete-milestone` archiving v1.5 and `/gsd-new-milestone` routing to whatever comes next (per the standing ask-before-Play-internal-deploy rule, offer a versionCode-bumped signed AAB push to the Play internal-testing track once the milestone-close UAT batch itself is done).
- No blockers.

---
*Phase: 43-clarity-pass*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `mazeworld.html`, `test/unit/shell-clarity-43.test.js`, `test/unit/shell-company-panel.test.js`, `test/unit/shell-loot-screen.test.js`, `docs/CLARITY.md`, `.planning/REQUIREMENTS.md` all exist with the expected content.
Verified in git log: `8cb956c`, `f4aacc3`, `195d3c5` all present on `master`.
