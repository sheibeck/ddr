---
phase: 34-combat-screen-rebuild
plan: 03
subsystem: ui
tags: [vanilla-js, combat-screen, layout, major-overlay, css, source-assertion-tests]

# Dependency graph
requires:
  - phase: 34-01
    provides: "combatPanel.js's combatHeaderViewModel/foeListViewModel/yourLotViewModel/encounterOverlaySpec, combatMenu.js's combatMenuViewModel"
  - phase: 34-02
    provides: "fightLog.js's renderFightLog(host)/syncFightLogLive, window.__mzFightLog/__mzFightLogVM, the .cb-log* CSS"
provides:
  - "The Phase 34 combat-screen CSS block: .cb-head/.cb-mid/.cb-act bands, .cb-foe*/.cb-bar*, .cb-lot*, .cb-grid/.cb-btn*/.cb-submenu/.cb-sub-*/.cb-row* (markup lands in Plan 04), .cb-over*/.cb-sub (markup lands in Plan 05), .mw-major* (the MAJOR OVERLAY), #enc-panel[data-mode=\"dark\"] and the restyled legacy .enc-head/.enc-sub/.evt/.actions/ul.skills rules"
  - "renderMajorOverlay(host, spec) — the generic, parameterised MAJOR OVERLAY renderer (icon/title/line/roll/primary+optional-secondary, every button guarded) Phase 35 reuses for the stair-down and out-of-combat death"
  - "renderCombatHeader(host, vm) / renderFoeCards(host, vm, onPick) / renderYourLot(host, vm) — the three middle-band render helpers, each built via createElement/textContent (no innerHTML except the header's static two-span skeleton)"
  - "window.__mzCombatVM — the ONE bridge (header/foes/lot/overlay/menu) renderEncounter's combat branch reads instead of importing combatPanel.js/combatMenu.js a second time"
  - "renderEncounter's rewritten combat branch: panel.dataset.mode toggles \"legacy\"/\"dark\"; combat.pending renders ONLY the major overlay and returns before any combat-panel band is built; a fought combat renders header -> cb-mid[foes, YOUR LOT, log] -> cb-act in that DOM order"
  - "foe-card retargeting is now a guarded presentation mutation (guardTap(el, () => onPick(c.i)) -> S.combat.target = i; renderEncounter()) instead of a bare, unguarded onclick"
affects: [34-04-shell-combat-actions, 34-05-shell-combat-over, 35-map-screen-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "panel.dataset.mode = \"legacy\" | \"dark\" — one attribute on #enc-panel switches the mock palette on/off per branch; every non-combat branch (death/won/beats/loot/joiner/find/store) stays \"legacy\" until Plan 05 opts the endings in"
    - "renderMajorOverlay(host, spec) is content-agnostic (icon/iconTone/title/line/roll/primary/secondary) so the combat branch composes its own spec from encounterOverlaySpec(S) and maps primary.dispatch to window.mzFight without the overlay function knowing anything about combat"
    - "a fight-log scroll-into-view seq gate (module-scope let lastLogSeqShown, compared against window.__mzFightLog.seq) so a submenu open/close re-render of the same log never re-scrolls the middle band"

key-files:
  created:
    - test/unit/shell-combat-screen.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-input-guards.test.js

key-decisions:
  - "Decision 2 (RESEARCH Open Question 2): built renderMajorOverlay(host, spec) as a fully generic, parameterised function now, not deferred to Phase 35 — spec = {icon, iconTone, title, line, roll?, primary:{label,onTap}, secondary?:{label,onTap}}; it knows nothing about combat, so Phase 35 can call it for THE STAIR DOWN and out-of-combat death without touching this function"
  - "Decision 3 (CONTEXT 'retarget dispatch' inaccuracy, confirmed by RESEARCH Pitfall 6): there is no engine retarget action and none was added — targeting stays the presentation mutation S.combat.target = i; renderEncounter(), now wrapped in guardTap on the foe-card element (previously an unguarded el.onclick, a real CSCR-08 gap this plan closed)"
  - "The old 7-button action bar (a-strike..a-scroll, the combat use-list, the spell menu) was re-parented into the new .cb-act element with its Phase 31/32 guard wiring byte-for-byte unchanged, rather than restyled or rebuilt — Plan 04 replaces the whole block with the 2x2 grid, so restyling it now would be immediately thrown away"
  - "The keydown handler's dead a-fight fallback (const n = document.getElementById(\"a-fight\") || document.getElementById(\"a-next\")) was cleaned up to just a-next — the id no longer exists anywhere in the DOM and the plan's own acceptance criteria required zero non-comment \"a-fight\" occurrences file-wide, not just inside renderEncounter"

patterns-established:
  - "Pattern: a render helper's per-function test slice (fnRegion(sig) — signature to the next top-level \"\\nfunction \") stays valid as later plans insert more helpers between two existing ones, without re-pinning every existing test's region boundaries"

requirements-completed: [CSCR-01, CSCR-02, CSCR-03, CSCR-06, CSCR-09]

coverage:
  - id: D1
    description: "The Phase 34 CSS block (.cb-head/.cb-mid/.cb-act bands, .cb-foe*/.cb-bar*, .cb-lot*, .cb-grid/.cb-btn*/.cb-submenu/.cb-row*, .cb-over*, .mw-major*) and #enc-panel[data-mode=\"dark\"] exist with the mock's exact values, bound to the bundled Press Start 2P/Courier Prime faces, no Google Fonts link, no new @font-face, no aria-disabled selector"
    requirement: CSCR-01
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-01: .cb-head/.cb-mid/.cb-act and the dark panel mode carry the mock's exact values"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-01: no Google Fonts, three @font-face declarations, and every new label/data rule reuses the bundled faces"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fought combat renders header -> cb-mid[foes -> YOUR LOT -> log] -> cb-act in strict DOM order, with panel.dataset.mode=\"dark\" set before the pending gate check"
    requirement: CSCR-01
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-01: combat branch builds the pending gate, then header -> cb-mid -> foes -> lot -> log -> cb-act in strictly increasing order"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderFoeCards builds every foe-card field (glyph/name/meta/wp/tag/bar) via textContent/className, guards the live-card tap exactly once through guardTap(el, () => onPick(...)), and carries no innerHTML; the combat branch's onPick mutates S.combat.target directly (no engine retarget action exists or was added)"
    requirement: CSCR-02
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-02: renderFoeCards builds every card field via textContent/className, guards the live-card tap exactly once, and carries no innerHTML"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-02/08 (Decision 3): the combat branch mutates S.combat.target through a guarded onPick, chip source stays foeStatusBadges, and no retarget-flavoured literal remains anywhere"
        status: pass
    human_judgment: false
  - id: D4
    description: "renderYourLot builds the hero-first, then-party, then-ally scrollable strip via textContent/className/dataset with no innerHTML; the strip overflows horizontally, the active card is gold, the low-hp fill is red; the ally is folded into YOUR LOT (combatPanel.js's allyThird) instead of rendering as a foe card"
    requirement: CSCR-03
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-03: renderYourLot builds the scrollable strip via textContent/className/dataset with no innerHTML"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-03: .cb-lot-strip overflows horizontally, the active card is gold, and the low-hp fill is red"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-03: the old ally-as-foe-card markup is gone; the ally now folds into YOUR LOT via combatPanel.js's allyThird"
        status: pass
    human_judgment: false
  - id: D5
    description: "combat.pending renders ONLY renderMajorOverlay(body, ...) and returns before any combat-panel band is built (never renders a pending combat); Enter/Space (not digit 1) dispatch window.mzFight on the overlay; the old #a-fight button/id is fully retired (zero non-comment occurrences file-wide)"
    requirement: CSCR-06
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-06 (Decision 2): renderMajorOverlay exists before renderEncounter and builds the icon/title/line/roll/actions column with a guarded, optional secondary button, no innerHTML"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-06: the pending gate renders the overlay from encounterOverlaySpec, maps its dispatch to window.mzFight, and returns before any combat-panel band"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-06: keydown reads S.combat.pending, dispatches window.mzFight only on Enter/Space, and the arm check stays the S.combat branch's first statement"
        status: pass
      - kind: unit
        ref: "test/unit/shell-fight-gate.test.js#CMB-01: renderEncounter's Fight! gate reads combat.pending, not a presentation flag (re-pinned: renderMajorOverlay(body, zero \"a-fight\")"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every new tap target (foe cards, the overlay's primary/secondary buttons) is wired through guardTap; no tap-anywhere-to-dismiss listener exists on panel/body/card; the guard-helper region and the <style> block carry no transition/animation/aria-disabled token; the persistent aria-live announcer (from Plan 02) is untouched"
    requirement: CSCR-08
    verification:
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-08: the render-helpers + renderEncounter region carries no tap-anywhere-to-dismiss listener"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-08: the guard-helper region carries no transition/animation token"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js#CSCR-08: the <style> block carries no aria-disabled selector, and no transitionend/animationend listener exists anywhere"
        status: pass
      - kind: unit
        ref: "test/unit/shell-input-guards.test.js (30/30, re-pinned GUARDED_IDS: a-fight -> mw-major-primary)"
        status: pass
    human_judgment: true
    rationale: "CSCR-08's full requirement text also covers submenu rows and the over-panel button, which are Plan 04/05 territory (not yet built) — this plan's own new surfaces (foe cards, overlay buttons) are fully guarded and proven, but the requirement as a whole is not closed until Plan 05, matching 34-02-SUMMARY.md's identical precedent for the same requirement."
  - id: D7
    description: "Engine/content/parity untouched; the two existing suites (shell-fight-gate, shell-input-guards) are re-pinned rather than left stale; full suite and build stay green"
    requirement: CSCR-09
    verification:
      - kind: unit
        ref: "npm test — 2014/2014 (1999 baseline + 15 new shell-combat-screen tests)"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-16
status: complete
---

# Phase 34 Plan 03: Combat Screen Layout, MAJOR OVERLAY, Foes and YOUR LOT Summary

**Rebuilt `renderEncounter`'s live-combat branch into the mock's three-band layout (header -> cb-mid[foes, YOUR LOT, log] -> cb-act) from the Plan 01 view-models, moved the Fight! gate out of the combat markup into a new generic `renderMajorOverlay(host, spec)` (the map's MAJOR OVERLAY, reused by Phase 35), and closed a real CSCR-08 gap by wrapping foe-card retargeting in `guardTap` for the first time.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-16T23:10:00Z (approx.)
- **Completed:** 2026-09-16T23:50:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 4 (2 core mazeworld.html edits + 2 re-pinned test files + 1 new test file)

## Accomplishments
- Added the full Phase 34 combat-screen CSS block (`.cb-head`/`.cb-mid`/`.cb-act` bands, `.cb-foe*`/`.cb-bar*`, `.cb-lot*`, the 2x2 `.cb-grid`/`.cb-btn*` and `.cb-submenu`/`.cb-row*` rules Plan 04 will use, the `.cb-over*`/`.cb-sub` rules Plan 05 will use, `.mw-major*`, and `#enc-panel[data-mode="dark"]` including restyled legacy `.enc-head`/`.enc-sub`/`.evt`/`.actions`/`ul.skills` rules) — every rule bound to the bundled fonts, zero Google Fonts, zero new `@font-face`/keyframes.
- Built four new DOM-only render helpers (`renderMajorOverlay`, `renderCombatHeader`, `renderFoeCards`, `renderYourLot`), all via `createElement`/`textContent` (the header's own two-span skeleton is the one deliberate `innerHTML` use, immediately filled by `textContent`), bridged from `combatPanel.js`/`combatMenu.js` via one `window.__mzCombatVM` object.
- Rewrote `renderEncounter`'s live-combat branch: `combat.pending` now renders ONLY the MAJOR OVERLAY (built from `encounterOverlaySpec(S)`, its primary button mapped to `window.mzFight`) and returns before any combat-panel band exists — the combat screen genuinely never shows a pending fight. A fought combat renders the three mock bands in order, moving Plan 02's `renderFightLog` call into the `cb-mid` band alongside the foe roster and YOUR LOT strip, and adds a seq-gated scroll-into-view so a new log batch (not a re-render of the same log) scrolls the newest entry into view.
- Foe-card tap-to-target is now `guardTap(el, () => onPick(c.i))` instead of the pre-existing, unguarded `el.onclick = () => { C.target = i; renderEncounter(); }` — a genuine CSCR-08 fix RESEARCH Pitfall 6 flagged (no engine `retarget` action exists or was added; this stays the same presentation mutation, just guarded now).
- The old 7-button action bar, the combat use-list, and the spell menu were re-parented into the new `.cb-act` element with every existing `guardTap` wiring line untouched — Plan 04 replaces this block with the 2x2 grid next wave.
- Retired the old `#a-fight` button/branch, the ally-as-`.foe.ally`-card markup (the ally now folds into YOUR LOT as a card, per `combatPanel.js`'s `allyThird`), and the `mw-round-tick` topbar pulse (the topbar itself is hidden by `data-mode="dark"`). Cleaned up a dead `document.getElementById("a-fight")` fallback inside the keydown handler's beats-branch Enter/Space path — the id no longer exists anywhere.
- `keydown`'s pending-combat branch now dispatches `window.mzFight` on Enter/Space only (the digit-1 shortcut is gone — `1` will select the action grid in Plan 04).
- New `test/unit/shell-combat-screen.test.js` (15 tests) source-pins the layout order, the CSS values, every render helper's DOM shape and guard wiring, the pending-gate-first invariant, the keydown path, and the ally-folded-into-YOUR-LOT invariant. Re-pinned `shell-input-guards.test.js` (`GUARDED_IDS`: `a-fight` -> `mw-major-primary`; `renderEncounterRegion` widened to start at `renderFightLog` so the new helpers' `guardTap` wiring is in scope) and `shell-fight-gate.test.js` (asserts `renderMajorOverlay(body` + zero `"a-fight"`; asserts the digit-1 fight shortcut is gone).

## Task Commits

Each task was committed atomically:

1. **Task 1: The Phase 34 CSS block and the dark panel mode** - `aa9c1d5` (feat)
2. **Task 2: renderMajorOverlay + header/foes/lot helpers, the rewritten combat branch, the pending branch, keydown Enter/Space** - `4ac5803` (feat)
3. **Task 3: shell-combat-screen.test.js + re-pin shell-fight-gate and shell-input-guards** - `6c0ee92` (test)

## Files Created/Modified
- `mazeworld.html` - the Phase 34 CSS block; `window.__mzCombatVM` bridge + `combatPanel.js`/`combatMenu.js` imports; `renderMajorOverlay`/`renderCombatHeader`/`renderFoeCards`/`renderYourLot`; rewritten combat branch (`panel.dataset.mode`, pending-gate-first, three-band layout, `.cb-act` re-parenting); `lastLogSeqShown` scroll gate; keydown Enter/Space-only pending dispatch; dead `a-fight` fallback removed
- `test/unit/shell-combat-screen.test.js` - new, 15 tests
- `test/unit/shell-fight-gate.test.js` - re-pinned (renderMajorOverlay + zero a-fight; digit-1 shortcut gone)
- `test/unit/shell-input-guards.test.js` - re-pinned (GUARDED_IDS, renderEncounterRegion widened)

## Decisions Made
- See `key-decisions` in frontmatter: Decision 2 (generic `renderMajorOverlay` built now, not deferred), Decision 3 (no engine `retarget` action, targeting stays a guarded presentation mutation), re-parenting the old action bar unchanged rather than restyling it (Plan 04 replaces it wholesale), and cleaning up the dead `a-fight` keydown fallback to satisfy the plan's own file-wide zero-occurrence acceptance criterion.
- CSCR-08 is intentionally NOT marked fully complete by this plan (see `coverage` D6's `rationale`) — this plan's own new tap targets are fully guarded and proven, but the requirement's full text also covers submenu rows and the over-panel button, which land in Plan 04/05. This mirrors 34-02-SUMMARY.md's identical treatment of the same requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the dead `#a-fight` fallback from keydown's beats-branch Enter/Space handler**
- **Found during:** Task 2, running the plan's own acceptance-criteria greps before commit
- **Issue:** The plan's Task 2 acceptance criteria require zero non-comment occurrences of `"a-fight"` anywhere in `mazeworld.html`, but the beats-branch Enter/Space handler (`addEventListener("keydown")`, outside `if (S.combat)`) still read `document.getElementById("a-fight") || document.getElementById("a-next")` as a harmless historical fallback for the now-removed AMBUSH special case. Since `#a-fight` no longer exists anywhere in the DOM, this was dead code that also violated the plan's own literal acceptance grep.
- **Fix:** Simplified the line to `document.getElementById("a-next")` only, and reworded the stale doc comment above it to describe the current (Phase 31 + Phase 34) state instead of the retired AMBUSH case.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -v '^\s*//' mazeworld.html | grep -c '"a-fight"'` = 0; `node --test test/unit/shell-fight-gate.test.js test/unit/shell-input-guards.test.js test/unit/shell-combat-screen.test.js` all green.
- **Committed in:** `4ac5803` (Task 2 commit)

**2. [Rule 1 - Bug] Reworded a doc comment that accidentally matched the file-wide "retarget" ban**
- **Found during:** Task 2, running the plan's own acceptance-criteria greps before commit
- **Issue:** `renderFoeCards`'s own doc comment used the word "retargeting", which the plan's own `grep -c "mzRetarget\|retarget" mazeworld.html` = 0 acceptance check (guarding against an invented engine action) matched as a false positive — the comment was prose, not code, but the literal check doesn't distinguish.
- **Fix:** Reworded the comment to "picking a new aim point" — same meaning, no banned substring.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -c "mzRetarget\|retarget" mazeworld.html` = 0.
- **Committed in:** `4ac5803` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — dead/stale code and comment text caught by the plan's own literal acceptance checks, not runtime bugs)
**Impact on plan:** Both fixes tighten the plan's own explicit acceptance criteria to a clean pass. No scope creep — no behavior changed beyond what the plan specified.

## Issues Encountered
None beyond the two deviations above (both caught and fixed before committing, never left in an uncommitted or failing state).

## User Setup Required
None - no external service configuration required.

## Human verification (deferred to end of run)

Per this project's Deferred UAT protocol, no device check was run mid-plan. The following Pixel 7 checks are queued for the end-of-run batch:

1. Walk into an encounter — the screen goes near-black with a red ● icon, "SOMETHING IS HERE" (one foe) or "THEY ARE ALREADY HERE" (several), the foes named, the d8/d10 roll note, and ONE gold FIGHT IT OUT button; nothing happens before the tap; a tap within a quarter second of the overlay appearing is swallowed.
2. After FIGHT IT OUT, the combat screen shows the ENCOUNTER header with ROUND 1 and N STANDING, the foe cards (glyph, upper-case name, SIZE · INT · note, hp / max, red bar), the YOUR LOT strip (hero card gold/active), and the › log with "You move first." / "They move first." on top.
3. Tap a second foe card — its border turns gold and the tag reads TARGET; tap a dead card — nothing happens.
4. Accept a Joiner beforehand and confirm YOUR LOT shows the companion card beside the hero, the hint reads YOUR LOT · EACH ROLLS THEIR OWN, and the strip scrolls sideways if the cards exceed the width.
5. The map and D-pad are never visible beneath the combat screen at any point.
6. With the system reduced-motion setting on, the overlay and panel appear without fades and buttons still respond after the 250 ms arm window.

## Next Phase Readiness
- Plan 04 can now read `window.__mzCombatVM.menu` (`combatMenuViewModel`) and build the 2x2 `.cb-grid`/`.cb-btn`/`.cb-submenu`/`.cb-row` markup inside the existing `.cb-act` element, replacing the re-parented 7-button bar and its `guardTap` wiring wholesale (the CSS for the grid/submenu already exists from this plan's Task 1).
- Plan 05 can call `renderMajorOverlay` for the stair-down/out-of-combat-death variants and build the `.cb-over*` markup for the win/flee/death endings (CSS already exists from this plan's Task 1); it also owns setting `panel.dataset.mode = "dark"` on the joiner/find/beats/loot/death/won branches this plan left at `"legacy"`.
- No blockers. `npm test` 2014/2014, `npm run build:www` exit 0, engine/content/parity untouched, master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).

---
*Phase: 34-combat-screen-rebuild*
*Completed: 2026-09-16*

## Self-Check: PASSED

All created/modified files found on disk (`mazeworld.html`, `test/unit/shell-combat-screen.test.js`, `test/unit/shell-fight-gate.test.js`, `test/unit/shell-input-guards.test.js`, this SUMMARY.md). All three task commit hashes (`aa9c1d5`, `4ac5803`, `6c0ee92`) found in `git log`.
