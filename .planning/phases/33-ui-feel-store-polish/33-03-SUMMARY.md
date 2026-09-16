---
phase: 33-ui-feel-store-polish
plan: 03
subsystem: ui
tags: [shell, map-viewport, pinch-zoom, store, voice-safety]

# Dependency graph
requires:
  - phase: 33-ui-feel-store-polish
    plan: 01
    provides: "state.storeRoll — the run flag this plan reads (read-only) to gate the store header copy"
  - phase: 33-ui-feel-store-polish
    plan: 02
    provides: "the gear row / camp chip / handedness-removal shell state this plan's source-assertion pins must keep matching (shell-input-guards, shell-gear-toolbar)"
provides:
  - "UIF-03: `let zoom = 1.5;` the literal midpoint of ZOOM_MIN/ZOOM_MAX, session-only (never persisted)"
  - "UIF-02: window.mzCenterMap?.() at the three panel-closed choke points (renderEncounter dismissal transition, showTab's maze branch, closeSettingsSheet) plus pinch-release — never inside pointermove"
  - "STORE-01 shell half: the store header's gated STORE_ROLL_COPY line, shown only when S.storeRoll === true"
  - "test/unit/shell-map-store-polish.test.js: source-assertion pins for all of the above"
  - "The v1.3 milestone hand-off — dropped UIF-04, the still-open 32-03 hand-off items, the storeRoll flag facts, and the Key Decision row for PROJECT.md"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recenter-on-return: every 'map visible again' choke point calls the existing window.mzCenterMap?.() bridge (optional-chained, never a bare call) rather than duplicating pan/positionCanvas logic"
    - "Gesture-settle recenter: a `wasPinch` flag captured at the top of release() lets the recenter fire once, after the gesture has fully ended, mirroring the existing textSize-change recenter precedent — never inside a live pointermove tick"
    - "Flag-gated presentation-only copy: STORE_ROLL_COPY is a compile-time constant interpolated only behind `S.storeRoll === true`, with an empty-string else branch so an old save's header stays byte-identical"

key-files:
  created:
    - test/unit/shell-map-store-polish.test.js
  modified:
    - mazeworld.html

key-decisions:
  - "Recenter fires on the true->false encWasActive transition BEFORE the panel is hidden (positionCanvas reads the viewport rect, which does not depend on the overlay's visibility), matching the plan's read_first guidance rather than moving it after the early return"
  - "The pinch-release recenter is captured via a `wasPinch` boolean read at the top of release(), rather than re-checking `pinch` after it is nulled, so the single recenter fires exactly once per gesture end regardless of pointer-count timing"
  - "STORE_ROLL_COPY: \"Stock rolled fresh for this floor. Deeper down, pricier regrets.\" — one sarcastic, family-friendly sentence pair naming the roll; scanned clean against content/safety-wordlist.js BANNED"

patterns-established: []

requirements-completed: [UIF-02, UIF-03, STORE-01]

coverage:
  - id: D1
    description: "UIF-03: default map zoom is 1.5, the literal midpoint of ZOOM_MIN 0.6 / ZOOM_MAX 2.4, and is session-only (never written to storage, S, or a settings row)"
    requirement: "UIF-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-03: let zoom = 1.5 is the default, exactly once, no stray `let zoom = 1;`"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-03: 1.5 is the literal midpoint of ZOOM_MIN..ZOOM_MAX"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-03: zoom is never persisted — no writeSetting/S.zoom/state.zoom expression"
        status: pass
    human_judgment: false
  - id: D2
    description: "UIF-02: the map recenters on the party at all three panel-closed choke points (renderEncounter's dismissal transition, showTab's maze branch, closeSettingsSheet) plus on pinch-gesture release, and never inside pointermove"
    requirement: "UIF-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-02 site 1: the encWasActive && !active transition is a braced block with the stamp and the recenter"
        status: pass
      - kind: unit
        ref: 'test/unit/shell-map-store-polish.test.js#UIF-02 site 2: showTab recenters exactly once when name === "maze"'
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-02 site 3: closeSettingsSheet recenters exactly once; both callers still route through it"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-02 pinch: release() captures wasPinch and recenters once on pinch-end"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#UIF-02 pinch: the pointermove handler never recenters, and its zoom-scale math is intact"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#mzCenterMap total call-site count is 10 (6 pre-existing + the 4 new Phase 33 sites)"
        status: pass
    human_judgment: true
    rationale: "The source pins prove the wiring exists and is placed exactly where the plan specifies, but the felt behavior — does the viewport actually snap onto the party on a real device, does pinch scaling feel smooth mid-gesture — needs a device pass. See Human verification below."
  - id: D3
    description: "STORE-01 shell half: the store header shows STORE_ROLL_COPY under the purse line ONLY when S.storeRoll === true; an old save (flag off) renders today's header byte-identically; the copy clears content/safety-wordlist.js BANNED"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#STORE-01: STORE_ROLL_COPY constant exists exactly once, non-empty, no angle brackets"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#STORE-01: the store header line is gated on S.storeRoll === true with an empty-string else"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#STORE-01: storeRoll is read by the shell only inside the store header region"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-store-polish.test.js#STORE_ROLL_COPY is clear of content/safety-wordlist.js BANNED terms"
        status: pass
    human_judgment: true
    rationale: "The gating logic and voice-safety are pinned by source assertions, but whether the line actually reads well on a real screen at real text sizes is a device judgment call. See Human verification below."
  - id: D4
    description: "Full phase gate: npm test # fail 0 (>= 1935), npm run build:www exit 0, master/fixtures untouched, engine/content/parity diff for the whole phase limited to Plan 01's files"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "npm test — 1955 pass, 0 fail"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0"
        status: pass
      - kind: other
        ref: "git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt — empty"
        status: pass
      - kind: other
        ref: "git diff --stat 97a0e8a..HEAD -- engine content test/parity — exactly Plan 01's 9 files"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-16
status: complete
---

# Phase 33 Plan 03: Map zoom 1.5 + recenter, store header copy, full gate and milestone hand-off Summary

**Default map zoom moves to the literal ZOOM_MIN/ZOOM_MAX midpoint (1.5, session-only) and the map recenters on the party at every panel-closed choke point plus pinch release; the store header names the depth roll only when `S.storeRoll` is true; full phase gate green (1955/1955 tests, `build:www` exit 0, master/fixtures untouched, engine diff scoped to Plan 01).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-16T15:24:00-04:00 (approx, after HEAD 36a6041)
- **Completed:** 2026-09-16T15:50:00-04:00 (approx)
- **Tasks:** 3
- **Files modified:** 1 modified, 1 created (Tasks 1-2); 1 created (Task 3, this SUMMARY)

## Accomplishments
- `let zoom = 1.5;` — the literal midpoint of `ZOOM_MIN = 0.6, ZOOM_MAX = 2.4` — replaces the old `let zoom = 1;` default; the variable stays module-scope only, never written to `S`, `state`, or any settings storage, so every cold start returns to 1.5
- The map recenters on the party at all four "map visible again" moments RESEARCH identified: `renderEncounter()`'s `encWasActive && !active` dismissal transition (braced so the Phase 32 `lastDismissAt` pin still matches), `showTab("maze")` (returning from Hero/Gear/Oracle/Dead), `closeSettingsSheet()` (both the scrim and Close callers), and once on two-finger pinch release (captured via a `wasPinch` flag at the top of `release()`) — the live pinch `pointermove` handler is untouched and never recenters mid-gesture
- `const STORE_ROLL_COPY = "Stock rolled fresh for this floor. Deeper down, pricier regrets.";` renders as one extra `enc-sub` line under the store's purse line, gated strictly on `S.storeRoll === true`; an old save (flag off, from before this build) shows exactly today's header, byte-for-byte
- `test/unit/shell-map-store-polish.test.js` (new, 14 tests): pins the zoom default and its session-only persistence, all four recenter sites plus the pointermove absence, the `centerMap` bridge's untouched body, the total `mzCenterMap?.()` call count (10 = 6 pre-existing + 4 new), the gated header line's exact template, and the copy's voice safety against `content/safety-wordlist.js` BANNED
- Full phase gate: `npm test` → 1955 pass, 0 fail (well above the 1935 floor); `npm run build:www` → exit 0; `test/parity/fixtures` and `test/parity/prototype-master.js.txt` untouched; `git diff --stat 97a0e8a..HEAD -- engine content test/parity` is exactly Plan 01's nine files, and the diff from Plan 01's last commit to HEAD over those same paths is empty (Plans 02/03 touched no engine/content/parity file)

## Task Commits

Each task was committed atomically:

1. **Task 1: Default zoom 1.5; recenter at the three panel-closed choke points and on pinch release** - `c5e6b12` (feat)
2. **Task 2: Store header roll line gated on S.storeRoll; test/unit/shell-map-store-polish.test.js** - `72b80af` (feat)
3. **Task 3: Full phase gate and the milestone hand-off SUMMARY** - metadata commit (docs), hash recorded after this file is committed

## Files Created/Modified
- `mazeworld.html` - `zoom` default 1.5 + extended DR13 comment; `renderEncounter`'s dismissal-transition block braced to add `window.mzCenterMap?.()`; `showTab`'s maze branch recenters; `closeSettingsSheet` recenters; pinch `release()` captures `wasPinch` and recenters once on gesture end (pointermove untouched); `const STORE_ROLL_COPY` beside `ROUND_CARD_COPY`; the store header's gated `S.storeRoll === true` line between the purse line and the shelf div
- `test/unit/shell-map-store-polish.test.js` (new) - the full UIF-02/UIF-03/STORE-01 shell-half pin suite (14 tests)
- `.planning/phases/33-ui-feel-store-polish/33-03-SUMMARY.md` (new) - this file

## Decisions Made
See `key-decisions` in frontmatter — no decisions deviated from the plan's specified approach; these are implementation-detail rationales worth surfacing for future readers (recenter-before-hide ordering, the `wasPinch` capture pattern, and the final copy text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test's `centerMap` body-slice used naive brace matching, which stopped at the first `}` inside the object literal `{ x: 0, y: 0 }`**
- **Found during:** Task 2, first run of `test/unit/shell-map-store-polish.test.js`
- **Issue:** The "centerMap bridge itself is untouched" test computed the function body with `CODE.indexOf("}", start)`, which matched the closing brace of `pan = { x: 0, y: 0 }` rather than the function's own closing brace, so the body slice never reached `positionCanvas();` and the assertion failed on a correct implementation.
- **Fix:** Replaced the naive brace search with the same `sliceBetween(CODE, "function centerMap() {", 'document.getElementById("mw-chip-centre")')` helper used everywhere else in the file — matches the existing convention exactly.
- **Files modified:** test/unit/shell-map-store-polish.test.js
- **Verification:** `node --test test/unit/shell-map-store-polish.test.js` → 14/14 pass, 0 fail; re-ran the full gate afterward with no regressions.
- **Committed in:** `72b80af` (Task 2's own commit — caught and fixed before committing, no dependent commit existed yet)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a test-authoring bug caught and fixed within the same task, before committing; no production code (`mazeworld.html`) was affected).
**Impact on plan:** None on scope or behavior. The implementation code was correct on the first pass; only the new test's own slicing logic needed a fix.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
This is the last plan of the last phase of milestone v1.3. See `## Milestone hand-off` below for everything the v1.3 audit/complete step needs.

## Human verification (deferred to end of run)

UAT is deferred to the end of the autonomous run per this phase's execution context — never paused for a device check. The list below merges 33-01's and 33-02's Pixel 7 items ahead of this plan's six, so the whole phase gets one end-of-run pass.

**From 33-01 (STORE-01 engine half):**
1. New run, depth 1: start a NEW run (not a dev start), walk to the first store — expect Healing plus three cheap utility potions drawn from {Cure Poison, Strength, Cure Disease, Enlarge}, two weapons costing ≤ 250 for the rolled class, at most a Leather armor upgrade, and a +1 premium item.
2. Dev start-at-depth 9: Settings → long-press the version → start at depth 9 → open the first store — expect pricier weapons (400+ band for a Fighter/Thief), Plate offered to a Fighter currently in lighter mail (if legal), a +3 premium item, and Acuteness possible among the rolled potions.
3. Re-roll on re-entry: leave and re-enter a store on the same floor — the rolled stock (potions/weapons/premium) should change between visits; food/lockpicks/repair/scroll/Rations should not.
4. Old-save compatibility (only if a pre-this-build save exists on the device): resume it — its store should still show the old fixed four potions/two weapons (flag off, since the save predates `storeRoll`).

**From 33-02 (UIF-01 gear row + Drop confirm, UIF-05 Make Camp/Handedness):**
5. Gear tab with a potion, a spare weapon and a treasure in the bag — each row shows the name/detail line and beneath it Use (or Equip) immediately left of Drop, Drop flush to the right edge, all buttons visibly tappable (≥48dp).
6. Tap Drop — the button becomes "Drop it? [Yes] [No]" in place; wait ~3s — it reverts back to Drop; tap Drop then tap anywhere else on screen — it reverts; tap Drop then No — it reverts; tap Drop then Yes on the potion — the potion leaves the bag (existing toast/Oracle line as today).
7. Tap Drop on one row then Drop on another row — only the second row stays armed; the first reverts automatically.
8. The worn weapon/armor rows — still show Unequip, never Drop.
9. Open a store with a full bag — the Sell/Drop rows look exactly as before (no confirm, stacked as today).
10. Map tab — MAKE CAMP is the right-most chip of the Marks/Centre strip above the map; the D-pad is centered alone under the map; camp still visibly dims when short on food and still camps on tap; the transient top-center flash label never permanently covers the chips.
11. Settings — no Handedness row present; text size / sound / haptics / confirm-before-quit still round-trip correctly.

**This plan (UIF-02/03 map zoom + recenter, STORE-01 header copy):**
12. Cold start — the map opens at the new default zoom (visibly closer than before; pinch shows it sits mid-range between fully-in and fully-out); pinch in, kill the app, relaunch — back to the default.
13. Drag the map off the party, enter a store, Leave — the party is centered again; same after Move on from a feature card, after a loot card, after a Joiner card.
14. Drag the map away, open Hero/Gear/Oracle/Dead, return to Map — centered.
15. Drag away, open Settings, Close (and separately tap the scrim) — centered.
16. Two-finger pinch: the map scales smoothly under the fingers without snapping mid-gesture; on lifting, it recenters on the party once.
17. New run's store header shows the roll line under the purse line; a pre-Phase-33 save (if one exists) shows no such line; the line reads family-friendly on device.

## Milestone hand-off

Everything the v1.3 audit/complete step should know before archiving this milestone:

- **UIF-04 was DROPPED from v1.3 on 2026-09-16.** The tutorial UI (`src/browser/tutorial.js`) is unwired in the shell (zero references in `mazeworld.html`), so there was nothing to toggle. It moves to the UX-06 backlog. `REQUIREMENTS.md` (UIF-04 row: "Dropped", pointed at the UX-06 backlog) already reflects this. **PROJECT.md's "UI feel" checklist bullet (currently `[ ] **UI feel** — v1.3 (UIF-01): gear panel Use/Drop side by side with drop confirm, map recenter on panel return, default zoom midpoint, tutorial on/off setting, Make Camp into the Marks/Centre row, handedness option removed`) still lists "tutorial on/off setting" and must have that clause dropped when the complete-milestone step ticks it.**
- **The 32-03 hand-off items are still open and were deliberately NOT pulled into Phase 33**, per 33-CONTEXT's explicit scope boundary ("any combat-surface change... the unguarded button set and haptics from the 32-03 hand-off are NOT pulled in unless trivially adjacent"):
  - The deliberately-unguarded button set (outside the ratified §6.3 list): the GEAR tab's own action buttons (unchanged by 33-02's row layout — still unguarded by design), the store's goods rows, the store's sell-list Sell/Drop buttons, the store's Leave button, `renderDropShelf`'s Drop rows (find/loot drop-to-make-room shelves), the beats branch's feature-action `a-evt` button, the won card's `btn-again`, and the spell-menu cast buttons.
  - The haptics-on-hit/kill candidate: `src/browser/haptics.js` + the Settings "Haptics" toggle exist and fire on struck/struckByFoe/crit/trap/leveled independent of the Round Card; extending it to the new combat surface specifically remains a future feel-pass candidate.
  - Both items → a future feel pass, not v1.3.
- **The store flag:** `state.storeRoll` — a plain run-level boolean, set `true` only by `src/browser/engineAdapter.js#startNewRun` (the `dev`-boolean precedent: unconditional on fresh `newRun` state, tolerant-boolean-coerced on `validateSave`/`rehydrate`, stripped from all six parity comparables). The tier ladder is `STORE_TIER_FLOORS`, derived from `content/bags.js#BAG_FLOORS` (2/5/9) rather than a new table, yielding tiers 0–3. The content file is `content/store-stock.js` (potion allow-list, weapon cost bands, armor cap ladder, premium enchantment bonus — all pure data). `tools/` bots and every unit/parity fixture still run flag-off (`storeRoll: false`); a future tuning pass could pass `storeRoll: true` to a bot run if the ledgers should observe rolled stock.
- **Final Phase 33 test count:** `npm test` → 1955 pass, 0 fail (baseline 1902 at 32-03 + 23 from 33-01 + 16 from 33-02 + 14 from 33-03). Master (`test/parity/prototype-master.js.txt`) and every parity fixture are byte-identical for the whole milestone (`git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` empty at every plan boundary).
- **The GEAR Drop confirm is unguarded by design** (Phase 32 scope — `guardTap` covers only the ratified §6.3 encounter-surface list; the Gear panel is not an encounter surface).
- **Zoom is session-only by decision** — no settings row, never persisted; every cold start returns to 1.5.
- **The Handedness setting is gone** end to end (markup, `data-handedness` CSS, `applySettings`, `src/browser/settings.js`'s field); a stale stored key is ignored silently, no migration.

## Key Decision row (for PROJECT.md)

The exact table row to paste into PROJECT.md's Key Decisions table:

| Store stock rolled by depth behind a run flag (`state.storeRoll`, v1.3 Phase 33) | Parity must stay byte-identical for fixtures/old saves while new runs get floor-appropriate stock; a newRun option only the shell sets (the `dev` precedent) keeps every fixture, bot and pre-Phase-33 save on the frozen roll, with the new draws placed after every existing draw | ✓ Good — zero fixture edits, six one-line comparable strips, tiers reuse the BAG_FLOORS 2/5/9 ladder; on-device check of shallow vs. deep stock deferred to the end-of-run UAT batch |

## Self-Check

**Files exist:**
- FOUND: test/unit/shell-map-store-polish.test.js
- FOUND: mazeworld.html (modified, verified via `git diff --stat`)
- FOUND: .planning/phases/33-ui-feel-store-polish/33-03-SUMMARY.md (this file)

**Commits exist:**
- FOUND: c5e6b12 (feat(33-03): default zoom 1.5; recenter on the party at every panel-closed choke point and on pinch release)
- FOUND: 72b80af (feat(33-03): store header names the depth roll on a flagged run; pin zoom default, the four recenter sites and the header copy voice)

**Test counts:**
- `npm test` → `# tests 1955`, `# pass 1955`, `# fail 0` (baseline 1941 + 14 new from shell-map-store-polish.test.js)
- `npm run build:www` → exit 0
- `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` → empty
- `git diff --stat 97a0e8a..HEAD -- engine content test/parity` → exactly Plan 01's 9 files (content/index.js, content/store-stock.js, engine/economy.js, engine/saveState.js, engine/state.js, test/parity/{combat,magic,movement}-parity.test.js, test/parity/harness/comparables.js)
- `git diff --stat 2671245..HEAD -- engine content test/parity` (from Plan 01's last commit to HEAD) → empty — Plans 02/03 touched no engine/content/parity file
- `grep -ci handedness mazeworld.html src/browser/settings.js` → 0, 0

## Self-Check: PASSED

---
*Phase: 33-ui-feel-store-polish*
*Completed: 2026-09-16*
