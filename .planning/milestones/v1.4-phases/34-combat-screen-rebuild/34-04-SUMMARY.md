---
phase: 34-combat-screen-rebuild
plan: 04
subsystem: ui
tags: [vanilla-js, combat-actions, action-grid, submenus, keyboard, input-guards, source-assertion-tests]

# Dependency graph
requires:
  - phase: 34-01
    provides: "src/browser/combatMenu.js's combatMenuViewModel(state) — the four-action grid (STRIKE/SPELLS-or-ABILITIES/ITEMS/SOCIAL) and submenu rows for every class archetype"
  - phase: 34-02
    provides: "window.__mzFightLogVM (append/dull), dispatchWithToasts routing every in-combat line (narrative and refusal) to window.__mzFightLog, window.__mzCombatMenu reset-on-every-dispatch site"
  - phase: 34-03
    provides: "the .cb-grid/.cb-btn*/.cb-submenu/.cb-sub-*/.cb-row* CSS block, the .cb-act host element, window.__mzCombatVM bridge (menu: combatMenuViewModel already wired)"
provides:
  - "COMBAT_COPY — the shell's own player-facing literals for this plan (back/fullHealth/noPotions)"
  - "COMBAT_DISPATCH — the one map from a submenu row's dispatch payload to the eight existing window.mz* bridges"
  - "fightLogRefuse(text) — a shell-owned refusal (engine-silent drinkPotion cases) lands as a dull fight-log entry, never a toast"
  - "pickCombatRow(row) / cbRow(row, n) / openCombatMenu(a) / renderActionArea(host) — the 2x2 grid + submenu renderer that replaces the old 7-button action bar"
  - "the rewritten keydown combat branch: 1-4 click the grid, digits click submenu rows in DOM order, Escape/Backspace click BACK"
affects: [34-05-shell-combat-over, 35-map-screen-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "keys never dispatch an engine bridge directly inside a fight — they click the same guardTap-wired DOM buttons the grid/submenu render, so one arm window covers taps and keys identically"
    - "a shell-owned refusal the engine cannot narrate (drinkPotion silent at 0/full) is caught in pickCombatRow BEFORE dispatch and rendered via the same fightLogRefuse path a real dispatch's dull entry would use"

key-files:
  created:
    - test/unit/shell-combat-actions.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-toast-wiring.test.js

key-decisions:
  - "Dropped the vestigial `spellOpen` field from the classic (pre-Phase-31, already-dead) startCombat()/castSpell() functions in mazeworld.html — both are documented dead code (their own doc comments say so), the field was unread, and its literal presence violated this plan's own zero-occurrence acceptance grep for the retired presentation flag. Mirrors 34-03-SUMMARY.md's identical precedent of cleaning up a dead-code literal to satisfy the plan's own acceptance check. The real, live `spellOpen` field stays engine-owned in engine/combat.js, untouched."
  - "ITEMS submenu rows are built by the same cbRow() builder as SPELLS/SOCIAL rather than a fifth renderCarriedList host, per the plan's own discretion note — potions/scrolls are counters on S.c, not carried items, so mixing two row shapes wasn't worth it; renderCarriedList keeps exactly its loot-card call site with guard:true."
  - "A disabled grid button with no `opens` (the Fighter ABILITIES fallback) is a guarded no-op, not a dispatch — there is no engine action to refuse and the sub-line already says NOTHING UP YOUR SLEEVE."

patterns-established:
  - "Pattern: a shell-side refusal the engine is silent about routes through the SAME dull-entry helper (fightLogRefuse) a real engine refusal's dispatchWithToasts routing would produce, so the fight log never has two visual classes of 'nothing happened' entry."

requirements-completed: [CSCR-05, CSCR-09]
# CSCR-08 intentionally NOT marked complete here — its full text also covers
# the over-panel button, which is Plan 05 territory (not yet built). This
# plan's own new surfaces (grid buttons, submenu rows, BACK chip) are fully
# guarded and proven (see coverage D5/D6 below), mirroring 34-02-SUMMARY.md
# and 34-03-SUMMARY.md's identical precedent for the same requirement.

coverage:
  - id: D1
    description: "The action band renders the mock's 2x2 grid (STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL) from combatMenuViewModel under the PICK YOUR MISTAKE prompt; STRIKE dispatches at once, the other three open a guarded submenu (title/BACK chip/rows, max-height 206px scroll)"
    requirement: CSCR-05
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05: the action area renders the 2x2 grid (STRIKE dispatches at once; the other three read vm.actions)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05: the submenu renders title/BACK/list from combatMenuViewModel and resets window.__mzCombatMenu on BACK"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05: cbRow builds every field via textContent/className, guards a dispatchable row exactly once, disables a placeholder row, and carries no innerHTML"
        status: pass
    human_judgment: false
  - id: D2
    description: "COMBAT_DISPATCH maps all eight submenu row dispatch types to the existing window.mz* bridges; pickCombatRow routes through it after catching the two shell-owned potion refusals"
    requirement: CSCR-05
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05: COMBAT_DISPATCH carries exactly the eight row-dispatch types, each mapped to its window.mz* bridge"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05: pickCombatRow catches the two potion refusals shell-side before dispatch"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two potion refusals the engine never narrates (0 potions, full health) land as dull fight-log entries via fightLogRefuse; no window.mzToast call exists on any in-combat path — exactly one window.mzToast call survives file-wide, inside dispatchWithToasts's out-of-combat queue"
    requirement: [CSCR-04, CSCR-05]
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-04/05: fightLogRefuse appends a dull fight-log entry, resets the submenu and re-renders, never toasts"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#Phase 34: exactly one window.mzToast call survives anywhere in mazeworld.html, and it sits inside dispatchWithToasts's out-of-combat queue"
        status: pass
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js#Phase 34: no shell-side in-combat toast survives — the full-health and no-potion refusals are dull fight-log entries"
        status: pass
    human_judgment: false
  - id: D4
    description: "Submenu state is presentation-only (window.__mzCombatMenu = null | {open}), reset on every dispatch (Plan 02) and by BACK; no state.combat field is used for it; zero spellOpen occurrences remain in mazeworld.html"
    requirement: CSCR-05
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#Phase 34: the submenu is presentation-only — zero spellOpen, zero S.combat.menu/state.combat.menu"
        status: pass
    human_judgment: false
  - id: D5
    description: "Keys: 1-4 pick the grid buttons; inside a submenu digits pick rows in DOM order and Escape/Backspace = BACK; Enter/Space on the overlay still dispatches fight; every key path shares the buttons' arm window (if (!encArmed()) return; stays the first statement) and never dispatches an engine bridge directly except mzFight"
    requirement: [CSCR-05, CSCR-08]
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#CSCR-05/08: the keydown handler clicks the guarded grid/submenu buttons, never dispatches an engine bridge directly except mzFight"
        status: pass
      - kind: unit
        ref: "test/unit/shell-input-guards.test.js#keydown region: the arm check is the first statement inside if (S.combat) {"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every grid button, submenu row and BACK chip is wired through guardTap; renderCarriedList's guard:true count drops to exactly 1 (the loot card) because the combat use-list folded into the ITEMS submenu rows"
    requirement: CSCR-08
    verification:
      - kind: unit
        ref: "test/unit/shell-input-guards.test.js#guard: true appears exactly once — the loot card (Phase 34 folded the combat use-list into the ITEMS submenu)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-input-guards.test.js#Phase 34: submenu rows are wired through guardTap inside cbRow"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#Phase 34: guard:true occurs exactly once (Phase 34 folded the combat use-list into the ITEMS submenu)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The old 7-button bar (a-strike/a-potion/a-flee/a-spell/a-talk/a-sing/a-scroll), the combat use-list and the spell menu (markup + .foes/.foe*/.spellmenu CSS) are fully retired"
    requirement: CSCR-09
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#Phase 34: the old 7-button bar, the combat use-list and the spell menu are fully gone"
        status: pass
      - kind: unit
        ref: "test/unit/shell-fight-gate.test.js#Phase 34: the ITEMS/ABILITIES rows never hide on readiness — combatMenu.js lists the Sing row and carried usables with enabled flags, never filters them"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every new player-facing string (COMBAT_COPY) is voice-scanned clean against content/safety-wordlist.js BANNED; engine/content/parity untouched; full suite and build stay green"
    requirement: CSCR-09
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-actions.test.js#Phase 34: every COMBAT_COPY string leaf is non-empty and clear of content/safety-wordlist.js BANNED"
        status: pass
      - kind: unit
        ref: "npm test — 2028/2028 (2014 baseline + 15 new shell-combat-actions tests - 1 net removed from shell-toast-wiring's two-tests-become-one re-pin)"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-16
status: complete
---

# Phase 34 Plan 04: Combat Actions — the STRIKE/SPELLS-ABILITIES/ITEMS/SOCIAL Grid and Submenus Summary

**Replaced the old 7-button combat action bar with the mock's 2x2 STRIKE/SPELLS-or-ABILITIES/ITEMS/SOCIAL grid and its guarded submenus (driven by `combatMenuViewModel`), reworked the keyboard map so every key click-throughs the same guarded buttons a tap would, and moved the last two shell-side in-combat toasts (potion at full health / no potions) into dull fight-log entries — no toast can fire during a fight any more.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-16T23:55:00Z (approx.)
- **Completed:** 2026-09-17T00:50:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 6 (1 core `mazeworld.html` edit across 2 tasks + 4 re-pinned test files + 1 new test file)

## Accomplishments
- `COMBAT_COPY` (back/fullHealth/noPotions) added directly after `CONDITION_COPY`, the shell's own single-object-literal home for this plan's player-facing strings (Plan 05 extends it for the over-panel).
- `COMBAT_DISPATCH` — the one map from a submenu row's `dispatch.type` to the eight existing `window.mz*` bridges (attack/castSpell/sing/drinkPotion/readScroll/useItem/flee/parley). No new bridge, no new engine action.
- `fightLogRefuse(text)` appends a dull `›` fight-log entry (via `window.__mzFightLogVM.append/dull`), resets `window.__mzCombatMenu` and re-renders — the ONE path a shell-owned refusal takes, identical in shape to an engine-refused dispatch's own dull entry.
- `pickCombatRow(row)` catches the two potion cases the engine's `drinkPotion` is silent about (0 potions, already full health) before dispatch; every other row (including every other disabled/unavailable row) dispatches through `COMBAT_DISPATCH` and lets the engine's own refusal explain via Plan 02's `dispatchWithToasts` routing.
- `cbRow(row, n)` builds one submenu row via `createElement`/`textContent` (label/cost/desc), guarded via `guardTap(el, () => pickCombatRow(row))` for every dispatchable row; the `id:"none"` placeholder rows are `disabled = true` instead.
- `openCombatMenu(a)` / `renderActionArea(host)` render either the 2x2 grid (`cb-grid`/`cb-strike`/`cb-spells`/`cb-items`/`cb-social`, each guarded — STRIKE dispatches at once, the other three call `openCombatMenu`) or, while `window.__mzCombatMenu.open` names a valid submenu, the submenu itself (`cb-submenu`/`cb-sub-title`/`cb-back`/`cb-sub-list`).
- `renderEncounter`'s combat branch now calls `renderActionArea(act);` in place of the entire old 7-button bar, the `combat-use-list` block (potions/scrolls/staffs/every carried usable now fold into the ITEMS submenu rows built by `cbRow`), and the spell menu (`.spellmenu`) block.
- Retired the `.foes`/`.foe*` and `.spellmenu`/`.spellmenu[hidden]` legacy CSS (the `.fchip*` chip rules survive — still used by the map rail's `mw-party-status` badge — only the combat-card-specific `.foe*` rules were removed; `.cb-foe*` from Plan 03 already covers foe cards).
- Rewrote the keydown combat branch: 1-4 click the grid buttons, a submenu's digits click `#cb-sub-list [data-cb-row]` rows in DOM order, Escape/Backspace click `#cb-back` — every key path clicks the same `guardTap`-wired DOM element a tap would, sharing one arm window. Enter/Space on the MAJOR OVERLAY still dispatches `window.mzFight`; no key dispatches any other engine bridge directly any more.
- Cleaned up two pre-existing dead-code `spellOpen` writes in the classic (pre-Phase-31, self-documented-dead) `startCombat()`/`castSpell()` functions so the retired presentation flag's name has zero non-comment occurrences left in `mazeworld.html` — the real field stays engine-owned in `engine/combat.js`.
- New `test/unit/shell-combat-actions.test.js` (15 tests) source-pins the grid/submenu DOM shape, the dispatch table, the dull-refusal path, the presentation-only submenu state, the keyboard map, the retired old bar/use-list/spellmenu, the folded guard count, and a voice scan of `COMBAT_COPY`. Re-pinned `shell-input-guards.test.js` (GUARDED_IDS, `guard: true` → exactly once, a new cbRow guard test), `shell-fight-gate.test.js` (CMB-02's dead-bar pins replaced by a `combatMenu.js` source check), `shell-gear-toolbar.test.js` (`guard:true` → exactly once) and `shell-toast-wiring.test.js` (the two full-health toast pins collapse into one dull-fight-log-entry pin).

## Task Commits

Each task was committed atomically:

1. **Task 1: COMBAT_COPY, COMBAT_DISPATCH, fightLogRefuse, cbRow/pickCombatRow, renderActionArea; retire the old bar** - `c44c18c` (feat)
2. **Task 2: Keyboard map — 1-4 grid, digits in a submenu, Escape/Backspace BACK** - `f71a976` (feat)
3. **Task 3: shell-combat-actions.test.js + re-pin input-guards, fight-gate, gear-toolbar, toast-wiring** - `ef2adb1` (test)

## Files Created/Modified
- `mazeworld.html` - COMBAT_COPY, COMBAT_DISPATCH, fightLogRefuse/pickCombatRow/cbRow/openCombatMenu/renderActionArea; rewritten keydown combat branch; old 7-button bar/use-list/spellmenu markup and CSS removed; two dead-code spellOpen writes dropped
- `test/unit/shell-combat-actions.test.js` - new, 15 tests
- `test/unit/shell-input-guards.test.js` - re-pinned (GUARDED_IDS, guard:true count, new cbRow guard test)
- `test/unit/shell-fight-gate.test.js` - re-pinned (CMB-02 dead-bar pins → combatMenu.js source check)
- `test/unit/shell-gear-toolbar.test.js` - re-pinned (guard:true count)
- `test/unit/shell-toast-wiring.test.js` - re-pinned (two full-health toast pins → one dull-entry pin)

## Decisions Made
- See `key-decisions` in frontmatter: the dead-code `spellOpen` cleanup (mirrors 34-03's precedent), the ITEMS-submenu-via-cbRow discretion call, and the disabled-grid-button-is-a-no-op rule for Fighter ABILITIES.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dropped the dead classic `startCombat()`/`castSpell()`'s vestigial `spellOpen` writes**
- **Found during:** Task 1, running the plan's own acceptance-criteria greps before commit
- **Issue:** The plan's Task 1 acceptance criteria (and Task 3's zero-`spellOpen` source pin) require zero non-comment occurrences of `spellOpen` in `mazeworld.html`, but two pre-existing, self-documented-dead classic functions (`startCombat()` at the top of the file, `castSpell()`) still wrote `spellOpen: false` / `S.combat.spellOpen = false` as unread vestiges from before Phase 31 moved combat dispatch to the engine bridges. Their own doc comments already call this cluster dead code.
- **Fix:** Removed the `spellOpen: false` field from the dead `startCombat()`'s object literal and deleted the dead `castSpell()`'s `S.combat && (S.combat.spellOpen = false);` line, replacing both with a short doc comment pointing at the real, engine-owned field in `engine/combat.js`. No behavior change (both statements were unread dead code).
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -n "spellOpen" mazeworld.html` shows only the live keydown-branch usage removed in Task 2 and, after Task 2, zero occurrences; `node --check` on the extracted classic script confirms no syntax break.
- **Committed in:** `c44c18c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — dead-code literal caught by the plan's own literal acceptance grep, not a runtime bug)
**Impact on plan:** No scope creep — no behavior changed beyond what the plan specified; the fix only removed unread writes inside functions two prior phases already documented as dead.

## Issues Encountered
- The plan's own informal acceptance-criteria bullet `grep -v '^\s*//' mazeworld.html | grep -c "mzToast"` = 2 does not hold literally: a pre-existing `/* ... */` block-comment (DR13's toast doc comment, unrelated to this plan) mentions "mzToast" in prose, and `grep -v '^\s*//'` only strips `//` line comments, not block comments, so the naive grep counts 6. The REAL, properly-scoped check — the same `stripComments()` (line-then-block) function every source-assertion test in this codebase uses — confirms exactly 2 functional `window.mzToast` occurrences (the one definition, the one out-of-combat queue call); `test/unit/shell-combat-actions.test.js`'s and `shell-toast-wiring.test.js`'s actual assertions use that same precise stripping and pass. No code change needed — this is a false alarm in the plan's own informal grep bullet, not a real defect.

## User Setup Required
None - no external service configuration required.

## Human verification (deferred to end of run)

Per this project's Deferred UAT protocol, no device check was run mid-plan. The following Pixel 7 checks are queued for the end-of-run batch:

1. In a fight the action band shows **PICK YOUR MISTAKE** over four buttons: **1 · STRIKE** (sub shows the die, to-hit range and damage band), **2 · SPELLS** or **2 · ABILITIES** (SOCIAL is red-accented), **3 · ITEMS**, **4 · SOCIAL** — each with its sub-line.
2. STRIKE resolves at once — a `›` line appears in the log immediately, no submenu opens.
3. **Magic User:** tap SPELLS — the submenu lists every known spell with `LVL N` and its blurb, title reads `NAME · SPELLS · N CHARGES`; tap a spell above your level (greyed) — the submenu closes and a dull `›` refusal appears; BACK returns to the grid.
4. **Bard:** tap ABILITIES — SING shows READY or `N SQ`; **Fighter** with no abilities: the button is greyed with NOTHING UP YOUR SLEEVE and a tap does nothing.
5. ITEMS lists POTION (`N LEFT`), SCROLL when carried, and every usable carried item with its cooldown; tapping POTION at full health produces the dull "Already at full health…" `›` line — no toast anywhere.
6. SOCIAL lists FLEE (`d20, 11+` or WITHDRAW/CLEAN on round 1 when unnoticed) and PARLEY.
7. With a Bluetooth/USB keyboard connected: 1-4 pick the grid, digits pick submenu rows, Esc/Backspace = BACK; a key pressed within 250 ms of a re-render is swallowed (same arm window as a tap).
8. No toast of any kind appears at any point during the fight.

## Next Phase Readiness
- Plan 05 can now call `renderMajorOverlay` for the win/flee/death over-panel variants and build the `.cb-over*` markup (CSS already exists from Plan 03); it also extends `COMBAT_COPY` with the over-panel's own keys and owns setting `panel.dataset.mode = "dark"` on the joiner/find/beats/loot/death/won branches this plan left untouched.
- No blockers. `npm test` 2028/2028, `npm run build:www` exit 0, engine/content/parity untouched, master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).

---
*Phase: 34-combat-screen-rebuild*
*Completed: 2026-09-16*

## Self-Check: PASSED

All created/modified files found on disk (`mazeworld.html`, `test/unit/shell-combat-actions.test.js`, `test/unit/shell-input-guards.test.js`, `test/unit/shell-fight-gate.test.js`, `test/unit/shell-gear-toolbar.test.js`, `test/unit/shell-toast-wiring.test.js`, this SUMMARY.md). All three task commit hashes (`c44c18c`, `f71a976`, `ef2adb1`) found in `git log`.
