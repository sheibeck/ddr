---
phase: 35-map-screen-rebuild
plan: 02
subsystem: ui
tags: [vanilla-js, rail, toast-retirement, decisions, movement-lock, move-on-retirement, aria-live, source-assertion-tests]

# Dependency graph
requires:
  - phase: 35-01
    provides: "src/browser/rail.js (railCardFor/railPush/railClear/railLineCard/emptyRail/railAnnouncement/RAIL_COPY/RAIL_FAMILY/RAIL_TONES/RAIL_HOLD) — the pure fold-then-bridge view-model this plan wires into the shell"
  - phase: 34-combat-screen-rebuild
    provides: "renderMajorOverlay, renderCombatOver(host, kind, opts), the dispatchWithToasts wasCombat||inCombat routing seam, guardTap/armEncounterButtons/encounterSettled"
provides:
  - "#mw-rail — the persistent bottom RAIL: markup, CSS (five tones, actions row, mwpulse keyframe), classic renderRail()/railButtons()/syncRailLive()/railPulse(), key-gated rise/announce/auto-clear"
  - "dispatchWithToasts's out-of-combat branch folds through rail.js into window.__mzRail (uncapped, withIdx) instead of a toast queue; the toast host/builder/CSS/lifetime bridge are fully retired"
  - "railLocked() — the GLOBAL movement lock (orchestrator decision 2): a pending joiner/find decision or a failed climb/leap refuses every direction, pulsing the pending card"
  - "renderRail's joiner/find/climb decision cards with guarded action rows (a-join-yes/no, a-find-take/leave, mw-rail-climb), replacing renderEncounter's own over-map branches"
  - "window.move split into the guarded entry point + stepNow(dir); stepNow stashes a failed climb/leap onto window.__mzRail.pending"
  - "out-of-combat death folds its pre-death 'what got you' lines into renderCombatOver's own lines (decision 5); the Phase 25.1 Move-on card (a-next, FEATURE_EVENT_TITLE/beatsTitleFor, CARD_EVENTS gates, stepping()) is fully retired"
  - "the static tab bar (flex:none, no position:fixed) sitting below the rail; #screen-maze is flush (padding:0)"
  - "test/unit/shell-map-rail.test.js (16 tests) + nine re-pinned suites"
affects: [35-03-shell-map-hud, 35-04-shell-map-viewport, 35-05-executor-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderRail mirrors renderFightLog/renderCombatOver's persist-node-rewrite-textContent-only discipline: #mw-rail is never torn down by innerHTML, only its children's textContent/dataset are rewritten, so #mw-rail-live stays the same node to assistive tech across every repaint"
    - "railButtons(host, buttons) is the ONE generic per-button guardTap wiring loop every rail decision (and railButtons callers going forward) shares — the same shape shell-input-guards' countGuardedWiring already recognised from renderCombatOver"
    - "window.__mzRail (seq/card/pending) is presentation-only, never a field on S/state, mirroring window.__mzFightEnd/__mzCombatMenu — serializeRun spreads S wholesale"

key-files:
  created:
    - test/unit/shell-map-rail.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-toast-wiring.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-combat-actions.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-party-camp.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-oracle-panel.test.js
    - test/unit/shell-armor-display.test.js

key-decisions:
  - "Orchestrator decision 2 (movement lock: GLOBAL) implemented exactly as planned: railLocked() = a pending joiner OR a pending find OR window.__mzRail.pending (a failed climb), checked in window.move right after the settle clause and before stepNow(dir) dispatches — every direction, every entry path this plan wires (D-pad; tap-to-step/keys land in Plan 04)."
  - "Decision 4 (no PICK THE LOCK) and decision 5 (death folds into renderCombatOver, not a Move-on card) landed exactly as specified — the only chest decision is S.pendingFind Take/Leave; chestOpened/chestLocked stay auto-clearing rail cards from Plan 01's family table."
  - "Decision 6 (toast retirement is total) landed exactly as specified: the toast host element, its CSS block, the global toast builder + doc comment, the lifetime bridge, and the module's CARD_EVENTS/toastLifetime/MAX_TOASTS imports are all gone — zero occurrences anywhere in mazeworld.html, comments included (verified by test (c) in shell-map-rail.test.js, built by string concatenation so the test file itself never spells the retired names)."
  - "MAP-05 and MAP-08 are NOT marked complete in REQUIREMENTS.md by this plan, even though they are in this plan's own frontmatter requirements list — MAP-05's full text (stair-down GO DOWN/NOT YET) is Plan 04's work; MAP-08's full text (sheets' scrim exception) needs Plan 03/04's sheets to exist before it can be truthfully claimed. This mirrors 34-02-SUMMARY's identical precedent for CSCR-08. MAP-03/MAP-04 were already marked complete by 35-01 (idempotent no-op here)."

patterns-established:
  - "A rail decision card never starts the auto-clear timer (buttons.length > 0 gates it) — only an action-less card (an outcome, not a question) auto-clears."

requirements-completed: [MAP-03, MAP-04]

coverage:
  - id: D1
    description: "Every out-of-combat dispatch (move, camp, resolveJoiner, takeFind/leaveFind, equip/use/drop, out-of-combat spells/potions) folds through toastsForAction+railCardFor into the persistent bottom RAIL as one tone/icon/title card with its lines and dice line; no toast host survives anywhere"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(d) routing / (c) toast retirement"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(n) BEHAVIOUR: the real fold produces the exact cards this plan describes"
        status: pass
    human_judgment: false
  - id: D2
    description: "A card without actions clears on its own after its hold; idle the rail reads FLOOR N / NOTHING IS HAPPENING with the peek hint; a new card restarts the rise animation and is announced once through the persistent #mw-rail-live node"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(f) renderRail / (a) markup / (b) CSS"
        status: pass
    human_judgment: false
  - id: D3
    description: "The joiner offer, the find offer (incl. full-bag drop shelf), and a failed climb/leap are RAIL cards with an action row, persisting until answered; every action button goes through guardTap"
    requirement: "MAP-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(g) joiner / (h) find / (i) climb / (f) renderRail"
        status: pass
    human_judgment: false
  - id: D4
    description: "While a rail decision or a failed climb is pending, EVERY movement path refuses via window.move's railLocked() clause and pulses the pending card; CLIMB IT re-dispatches the same direction; success/death clears the lock"
    requirement: "MAP-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(j.1) lock / (j.2) lock"
        status: pass
    human_judgment: false
  - id: D5
    description: "Move-on cards are retired: floor/level-up are auto-clearing rail cards; the beats branch renders only over-panel endings; out-of-combat death shows THAT IS THAT at once with pre-death lines folded in"
    requirement: "MAP-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(k.1) Move-on retirement / (k.2) Move-on retirement"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-over.test.js#the death branch renders THAT IS THAT..."
        status: pass
    human_judgment: false
  - id: D6
    description: "The rail is a direct child of #app between the screens and the static tab bar; hidden only while S.combat/S.dead/S.won own the column; the tab bar stays below it"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(l) layout / (a) markup"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full regression: npm test, npm run build:www, engine/content/parity diff, and every re-pinned suite (nine files) stay green"
    verification:
      - kind: unit
        ref: "npm test — 2090/2090, 0 fail"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0, www/src/browser/rail.js present"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-09-17
status: complete
---

# Phase 35 Plan 02: The RAIL, Decisions, Movement Lock, Move-On Retirement Summary

**The map screen's persistent bottom RAIL now carries every out-of-combat event and every decision (joiner/find/climb) with a global movement lock, and the Phase 25.1 toast host and Move-on card are fully retired — zero toast anywhere in the app.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-17T01:22:00Z (approx., immediately after 35-01)
- **Completed:** 2026-09-17T01:53:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 11 (1 core + 9 re-pinned test files + 1 new test file)

## Accomplishments

- `#mw-rail` — the persistent bottom card (markup between `</main>` and the static tab bar; five tone rules; actions row; `mwpulse` keyframe) — renders idle/event/decision states via classic `renderRail()`, with `railButtons()`'s generic guardTap wiring, `syncRailLive()`'s seq-gated announcer, and `railPulse()`'s lock feedback.
- `dispatchWithToasts`'s out-of-combat branch now folds through `railCardFor(action.type, result.events, folded, ctx)` into `window.__mzRail` instead of a capped toast queue (`{ limit: Infinity, withIdx: true }`) — the DR13/25.1 toast host element, its CSS block, `window.mzToast`, and the `__mzToastLifetime`/`MAX_TOASTS`/`toastLifetime` bridge are all gone, zero occurrences anywhere in `mazeworld.html`, comments included.
- `railLocked()` (orchestrator decision 2): a pending joiner/find OR `window.__mzRail.pending` (a failed climb) locks EVERY movement entry path globally — `window.move` checks it right after the settle clause, before `stepNow(dir)` dispatches; `window.mzRailPulse?.()` pulses the pending card instead.
- The joiner/find/climb decisions moved out of `renderEncounter`'s own over-map branches into `renderRail`'s precedence chain (joiner → find → climb → card → idle), each a full decision card with the DFB-04 who-walks rule, the find drop shelf, and the CLIMB IT retry (`window.move(pend.dir)` after clearing `pending: null`).
- `window.move` split into the guarded entry point + `stepNow(dir)`; `stepNow` stashes a failed climb/leap onto `window.__mzRail.pending` and drops the retired `CARD_EVENTS` beat-synthesis branch entirely (every feature landing is a rail card now via `dispatchWithToasts`); `mzMakeCamp` drops its own matching `CARD_EVENTS` gate.
- Out-of-combat death folds its pre-death "what got you" lines directly into `renderCombatOver(body, "dead", { lines: ... })` — no separate Move-on card to dismiss first.
- The tab bar is now a static flex child (`flex:none`, no `position:fixed`) sitting below the rail; `#screen-maze` is flush (`padding:0`).
- `test/unit/shell-map-rail.test.js` (16 new tests) plus nine re-pinned suites (`shell-toast-wiring`, `shell-combat-over`, `shell-loot-screen`, `shell-combat-actions`, `shell-input-guards`, `shell-party-camp`, `shell-fight-log`, `shell-oracle-panel`, `shell-armor-display`) — `npm test` 2090/2090, 0 fail.

## Task Commits

Each task was committed atomically:

1. **Task 1: The RAIL surface + rail routing + toast retirement** - `acdeb57` (feat)
2. **Task 2: Decisions in the rail, the global movement lock, Move-on retirement, folded death** - `5460176` (feat)
3. **Task 3: shell-map-rail.test.js + re-pin the nine affected suites** - `ab084e2` (test)

**Plan metadata:** (this commit) `docs: complete 35-02 plan`

## Files Created/Modified

- `mazeworld.html` - `#mw-rail` markup/CSS, `renderRail()`/`railButtons()`/`syncRailLive()`/`railPulse()`, `railLocked()`, `stepNow(dir)` split, retired toast host/builder/CSS/bridge, retired Move-on card (`FEATURE_EVENT_TITLE`/`beatsTitleFor`/`CARD_EVENTS` gates/`stepping()`), folded death branch, static tab bar
- `test/unit/shell-map-rail.test.js` - new, 16 tests: markup/CSS/toast-retirement/routing/bridges/renderRail precedence/joiner/find/climb/lock/Move-on-retirement/layout/aria-disabled-sweep/BEHAVIOUR
- `test/unit/shell-toast-wiring.test.js` - dropped every toast-host/CSS/lifetime/cap test; kept the single dispatch seam + DR18 replacement pins; re-pinned the CARD_EVENTS-gate count to 0 and the import to NARRATIVE_ACTIONS only
- `test/unit/shell-combat-over.test.js` - death/beats/joiner/find/keydown regions follow the rail's new branch shapes
- `test/unit/shell-loot-screen.test.js` - find-card region/shelf-render checks follow the branch into renderRail; ordering pins compare against the store guard
- `test/unit/shell-armor-display.test.js` - (collateral fix, not in the plan's file list — see Deviations) same region/shelf-render fix as shell-loot-screen.test.js
- `test/unit/shell-combat-actions.test.js` - zero-toast-calls pin; loot guard-bounds pin re-targeted to the store guard
- `test/unit/shell-input-guards.test.js` - GUARDED_IDS drops the retired dismiss id, adds mw-rail-climb; new pin proves railLocked() sits right after the settle clause
- `test/unit/shell-party-camp.test.js` - who-walks rule re-pinned to renderRail's headLine const (never a DOM head element)
- `test/unit/shell-fight-log.test.js` - toast-call count re-pinned to 0
- `test/unit/shell-oracle-panel.test.js` - toast-host rule asserted gone; tab bar asserted flex:none/non-fixed

## Decisions Made

See `key-decisions` in frontmatter. Orchestrator decisions 2, 4, 5, 6 landed exactly as the plan specified, with no deviation. MAP-05/MAP-08 deliberately left unmarked in REQUIREMENTS.md (see key-decisions) — their full text spans Plan 03/04 work not yet built.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/shell-armor-display.test.js` broke as a side effect of the joiner/find branch relocation**
- **Found during:** Task 3's `npm test` full-suite run (not in the plan's own `<files>` list for Task 3)
- **Issue:** This Phase 28 suite's own local `pendingFindRegion()` helper used the same `"if (S.pendingFind...)"` → `"if (S.store) {"` marker pair the plan's own listed files used before their re-pin. Because the find branch moved from renderEncounter (before the store branch) into renderRail (physically AFTER renderEncounter's entire body, hence after the store branch too), `CODE.indexOf("if (S.store) {")` now resolves to an EARLIER occurrence than the find guard, making `end < start` and failing the region's own bounds assertion.
- **Fix:** Re-pointed the end marker to the climb-guard literal (mirroring the identical fix already applied to `shell-loot-screen.test.js`/`shell-party-camp.test.js` per the plan's own Task 3 instructions), and re-pinned the one dependent test's `renderDropShelf` assertion to look inside `renderRail`'s shared post-branch shelf-render step (the call site itself moved there in Task 2, same as the loot-screen fix).
- **Files modified:** `test/unit/shell-armor-display.test.js`
- **Commit:** `ab084e2` (bundled with Task 3's other re-pins — the whole file's fix is one small, obviously-correct hunk mirroring an already-planned fix elsewhere)

### Documented, not fixed

**2. [Cosmetic] The plan's literal acceptance-criteria grep `grep -c "if (S.dead) {" mazeworld.html` = 1 does not hold — actual count is 2**
- **Found during:** Task 2 self-check against the plan's acceptance criteria
- **Issue:** A second, unrelated, pre-existing dead-code occurrence of the exact literal `if (S.dead) { paint(); return; }` lives inside the OLD classic (pre-engine-routing, Phase-1-era) `move()` function (mazeworld.html ~L3321) — this function has been fully superseded/unreachable since `window.move` was first overwritten by the module script (confirmed by the file's own long-standing comment: "the classic (pre-engine-routing, now-superseded) move() above"). Before this plan, the NEW death branch's guard was the longer, distinct literal `if (S.dead && !preDeathBeat) {`, so the plain-count criterion held (=1, matching only the dead-code line). This plan's own change (folding preDeathBeat into `renderCombatOver`'s `lines` option per decision 5) collapses the guard to the shorter `if (S.dead) {`, which now also matches that unrelated dead-code line, bringing the whole-file count to 2.
- **Why not fixed:** The dead classic `move()` function is explicitly out of this plan's scope (never touched by any Phase 35 task) and touching it to dodge a literal grep count would be an unjustified, unrelated edit purely to satisfy a coincidental substring collision — not a real regression. The intent of the criterion (the renderEncounter death branch's own guard, scoped correctly via `deathBranch()`'s `sliceBetween`) is fully satisfied and is the actual behavior proven by both `shell-map-rail.test.js` and `shell-combat-over.test.js`.
- **Verification:** `deathBranch()` (scoped `sliceBetween(CODE, "if (S.dead) {", "if (S.won) {")`) correctly isolates and proves the real renderEncounter death branch in both re-pinned test files; the plan's actual `<verify><automated>` gate for Task 2 (the four-command test string) does not include this specific grep and passes cleanly.

## Issues Encountered

None beyond the two items above (both resolved/documented in the same task, no separate fix commit needed for either).

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

No device check was run for this plan (per the project's Deferred UAT protocol — autonomous runs batch device checks at milestone close). The following Pixel 7 checks are queued for the end-of-run batch:

1. Walk onto a trap / teleport / one-way door — a toned card appears in the bottom rail with its title, the sentence and (for the trap) the dice line, then clears by itself after its hold; no toast anywhere on screen.
2. Equip a rejected item on the GEAR tab — the rail (visible below the Gear list, since the rail is a direct child of #app) explains the refusal.
3. Meet a Joiner — the rail shows COMPANY with the narration, who would walk if the roster is full, and TAKE THEM ALONG / LEAVE THEM; stepping in any direction (D-pad — tap-to-step lands in Plan 04) or pressing an arrow key only pulses the card; answering it releases movement.
4. Find a chest item — SOMETHING WORTH TAKING with TAKE IT / LEAVE IT; with a full bag, the drop shelf plus TAKE IT NOW appears instead.
5. Fall at a wall/crevice — FELL (red/bad tone) with the hp line and a CLIMB IT button; every other direction is refused (card pulses) until CLIMB IT eventually succeeds.
6. Reach a new floor / level up — FLOOR N (purple/odd tone) / SKILL LEVEL N (green/good tone, lingers longer) appears with no tap needed and clears itself.
7. Die on a move (trap/toll) outside combat — THAT IS THAT appears at once with the cause lines shown above the epitaph (no separate "Move on" card first).
8. With TalkBack on, a new rail card is announced once; a pulse (refused move) or a same-card repaint does not repeat the announcement.
9. The tab bar sits below the rail on every tab (Hero/Gear/Oracle/Dead too, not just Map); the Oracle still opens at the newest line.

## Next Phase Readiness

- Plan 03 (HUD/chips/canvas) can build directly against the now-static tab bar and the rail's fixed position in the DOM without any further layout renegotiation.
- Plan 04 (tap-to-step + stair gate) inherits `railLocked()` as the one movement-lock predicate to extend, and `window.mzRailLine` as the one-shot rail entry point for chip explanations / tap-inspect lines / the back-button quit warning (already wired for the back button here).
- No blockers. `npm test` 2090/2090; `npm run build:www` exit 0; `git diff --stat -- engine content test/parity` empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; D-pad/`.mazefoot`/`.mw-viewport-chips`/`#mw-flash`/the HUD character line are all still present, byte-identical, for Plans 03/04 to own.

---
*Phase: 35-map-screen-rebuild*
*Completed: 2026-09-17*

## Self-Check: PASSED

`mazeworld.html`, `test/unit/shell-map-rail.test.js`, and this SUMMARY.md confirmed present on disk. All four commits (`acdeb57`, `5460176`, `ab084e2`, `64439f5`) confirmed present in `git log`.
