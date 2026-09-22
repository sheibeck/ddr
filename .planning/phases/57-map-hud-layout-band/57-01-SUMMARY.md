---
phase: 57-map-hud-layout-band
plan: 01
subsystem: ui
tags: [shell, hud, layout, bridge, vanilla-js]

requires:
  - phase: 56-sound-effects-audio-settings
    provides: bridge-registry pattern precedent (__mzSfxBackendOverride) this plan follows for __mzHudBands
provides:
  - "src/browser/hudBands.js — pure identityLine(c)/counterSlots(state) formatters, HUD_BAND_ANCHORS as the single band-order source of truth"
  - "Four stacked HUD bands in mazeworld.html: identity+vitals, counters, condition chips, map chip strip"
  - "The map chip strip (#mw-map-chips) moved out of #mw-maze-viewport into a static band-4 header"
  - "window.__mzHudBands bridge (identityLine, counterSlots), registered in src/browser/bridge.js + regenerated docs/SHELL-MODULES.md"
affects: [57-02-rail-overlay, 57-03-rail-dismiss-holds, 57-04-darkness-vignette]

tech-stack:
  added: []
  patterns:
    - "hudBands.js follows viewModels.js's pure/DOM-free/window-free module shape"
    - "Bridge additions land as export + BRIDGE row + tools/bridge-doc.mjs --write regen in one commit (Phase 56 __mzSfxBackendOverride precedent, followed here for __mzHudBands)"

key-files:
  created:
    - src/browser/hudBands.js
    - test/unit/hudBands.test.js
    - test/unit/hud-bands-layout.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/harness/shellSandbox.js
    - tools/stale-terms.mjs

key-decisions:
  - "identityLine/counterSlots exported as HUD_BAND_ANCHORS literal search-anchor strings (id=\"mw-hud-name\", class=\"mw-hud-counters\", id=\"mm-conditions\", id=\"mw-map-chips\") rather than bare ids, so the structural order test needs no per-element lookup logic and band 2 (which carries no id) is still anchorable."
  - "Reintroducing the identity line reuses the exact class/id name (.mw-hud-name / #mw-hud-name / #hud-name-shaped) Phase 35 retired — this collided with two pre-existing retirement guards (shell-map-invariants.test.js's whole-phase sweep and tools/stale-terms.mjs's allow-list); both were re-pinned to assert the element exists rather than that it is absent, per the 2026-09-21 ruling's explicit reversal."
  - "keepPartyInView()'s body is proven unchanged via a direct function-region diff against the base commit rather than the plan's bare `git diff | grep -c keepInViewAxis` one-liner, which false-positives on this commit's own explanatory comment (see Deviations)."

requirements-completed: [LAYOUT-04, LAYOUT-05]

coverage:
  - id: D1
    description: "src/browser/hudBands.js exports HUD_BAND_ANCHORS/COUNTER_DIGIT_SLOT/COUNTER_OVERFLOW/identityLine/counterSlots, pure and DOM-free"
    requirement: LAYOUT-05
    verification:
      - kind: unit
        ref: "test/unit/hudBands.test.js (25 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The HUD renders as four stacked bands in the ruled order (identity+vitals, counters, conditions, chips), proven structurally against mazeworld.html source"
    requirement: LAYOUT-05
    verification:
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(1) the four bands' anchors appear in mazeworld.html in exactly the order HUD_BAND_ANCHORS declares"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(a)/(b)/(c) markup, layout and CSS pins"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tap on MARKS/CENTRE/MAKE CAMP/gear dispatches zero move actions — the chip band is no longer a descendant of #mw-maze-viewport, so the tap/hold/drag/pinch gesture tracker (bound to #mw-maze-viewport alone) can never receive a chip tap"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(2) a chip tap can never reach the canvas gesture tracker because the chips are not inside its host"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rect keepInViewAxis measures is honest (chip-free) — the gesture tracker's host (#mw-maze-viewport) is unchanged, so its getBoundingClientRect() no longer includes the chip band; keepPartyInView()'s own body is byte-identical to the base commit"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(3) the gesture tracker's host is still #mw-maze-viewport (rect honesty)"
        status: pass
      - kind: other
        ref: "node -e function-region diff of keepPartyInView() against `git show 4d43edf:mazeworld.html` — byte-identical"
        status: pass
    human_judgment: false
  - id: D5
    description: "paint() writes band 1/band 2 through the __mzHudBands bridge (not inline), proven with the real classic paint() via the vm sandbox at 999/1,000/100,000 Squares"
    requirement: LAYOUT-05
    verification:
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(4) BEHAVIOUR: paint() writes #m-steps and #mw-hud-name through __mzHudBands"
        status: pass
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(5) BEHAVIOUR: a freshly-booted fixed state with no conditions paints without throwing"
        status: pass
    human_judgment: false
  - id: D6
    description: "At every supported text size, a long identity line truncates and the HP bar still reads, on a real Pixel 7 screen width"
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule) — device-only visual check, batched for Phase 60's Pixel 7 session."
  - id: D7
    description: "With the party 1-2 cells below the chip band, tapping each chip moves the party zero squares; walking to the top edge fires the nudge with the band fully clear of the map"
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule) — device-only interaction check, batched for Phase 60's Pixel 7 session."
  - id: D8
    description: "At 1,000+ Squares nothing in the HUD overlaps on the device"
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule) — device-only visual check, batched for Phase 60's Pixel 7 session."

duration: ~55min
completed: 2026-09-22
status: complete
---

# Phase 57 Plan 01: Four-Band HUD + Chip Strip Leaves the Viewport Summary

**The map chip strip (MARKS/CENTRE/MAKE CAMP/gear) moved out of `#mw-maze-viewport` into a static band-4 header, and the HUD split into four stacked bands (identity+vitals, counters, conditions, chips) driven by a new pure `src/browser/hudBands.js` module bridged as `window.__mzHudBands`.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-22T16:57:34Z
- **Tasks:** 3 of 3
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- `src/browser/hudBands.js`: pure, DOM-free module exporting `HUD_BAND_ANCHORS` (the single band-order source of truth), `COUNTER_DIGIT_SLOT`/`COUNTER_OVERFLOW` (5-digit clamp with a `99999+` overflow form), `identityLine(c)` (`Name — Race Class (Sub) · Lvl N`, with sub/name/level/missing-character fallbacks), and `counterSlots(state)` (Depth/Day/Squares/Rations, ids unchanged).
- `mazeworld.html`'s HUD header restructured into band 1 (`.mw-hud-identity`: identity line, x/y HP block, DEV chip) and band 2 (`.mw-hud-counters`: the four kept-id counter items, FLOOR label renamed to Depth). Band 3 (`.mw-cond-strip`) is untouched. Band 4 (`.mw-map-chips`) moved out of `.mw-maze-viewport` to sit directly above `.mazebox` inside `#screen-maze`, now a static layout band (no `position`, no `z-index`) reading like the condition strip.
- `paint()` routes the four counter writes and the identity-line write through `window.__mzHudBands`, fail-open on a missing bridge.
- `window.__mzHudBands` registered in `src/browser/bridge.js` (owner `mazeworld.html (module)`) with `docs/SHELL-MODULES.md` regenerated in the same commit; `bridge-registry.test.js` passes both halves (set-equality + doc-sync).
- `test/unit/hud-bands-layout.test.js` (new): 5 named tests proving the band order structurally, the LAYOUT-04(a) hit-test invariant (no chip markup inside the viewport slice), the LAYOUT-04(b) rect-honesty invariant (gesture tracker's host unchanged), and two BEHAVIOUR tests through the real classic `paint()` via the vm sandbox.
- `test/unit/hudBands.test.js` (new): 25 tests pinning `identityLine`/`counterSlots`' rules, overflow boundary, and frozen exports.

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/hudBands.js — the pure identity/counter formatters** - `d9f7d06` (feat)
2. **Task 2: Restructure the shell into four bands and lift the chip strip out of the viewport** - `3200e0b` (feat)
3. **Task 3: Re-pin the shell source tests and add the band-layout structural test** - `5383241` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/browser/hudBands.js` - New pure module: `HUD_BAND_ANCHORS`, `COUNTER_DIGIT_SLOT`, `COUNTER_OVERFLOW`, `identityLine(c)`, `counterSlots(state)`
- `test/unit/hudBands.test.js` - New: 25 unit tests for the module above
- `test/unit/hud-bands-layout.test.js` - New: the LAYOUT-04/LAYOUT-05 structural + BEHAVIOUR proof (5 named tests)
- `mazeworld.html` - HUD header restructured into two bands; `.mw-map-chips` moved out of `.mw-maze-viewport`; CSS rewritten for `.mw-hud-identity`/`.mw-hud-name`/`.mw-hud-counters`/`.mw-hud-item b`/`.mw-hud-wp*`/`.mw-map-chips`; `paint()` routes bands 1/2 through the bridge; Phase 35 ruling-5 comment records its own reversal
- `src/browser/bridge.js` - `__mzHudBands` BRIDGE row added
- `docs/SHELL-MODULES.md` - Regenerated (`node tools/bridge-doc.mjs --write`)
- `test/unit/shell-map-hud.test.js` - Tests (a)/(b)/(c)/(g)/(h) re-pinned to the new two-band header and band-4 chip location; test count unchanged (21)
- `test/unit/shell-gear-toolbar.test.js` - `chipsMarkup()`'s end marker and the `.mw-map-chips` CSS pin re-pinned to the new static band; test count unchanged (15)
- `test/unit/shell-map-invariants.test.js` - The whole-phase retirement sweep's `hudName` literal removed from the "must be absent" list (Phase 57 restores it by design) with an explanatory comment and a positive existence assertion
- `test/unit/harness/shellSandbox.js` - Wires the new `__mzHudBands` bridge so the vm sandbox's `paint()` matches the real shell, required for `hud-bands-layout.test.js`'s BEHAVIOUR tests
- `tools/stale-terms.mjs` - Removed a rotted ALLOWED entry that excused a "dpad" mention inside a comment this plan rewrote (the mention is now gone entirely)

## Decisions Made

- `HUD_BAND_ANCHORS` holds the four literal search-anchor strings (`id="mw-hud-name"`, `class="mw-hud-counters"`, `id="mm-conditions"`, `id="mw-map-chips"`) rather than bare element ids, so band 2 (which carries no `id` attribute, only a class) is anchorable the same way as the other three, and the structural test needs no per-element lookup branching.
- The band-1 identity element deliberately reuses the exact `.mw-hud-name`/`#mw-hud-name`-shaped class/id name that Phase 35 (MAP-01 ruling 5) retired — this is the explicit 2026-09-21 reversal, not a naming accident (git history confirms the pre-Phase-35 build used this identical name).
- `.mw-hud-item b`'s fixed-width numeral slot is `5ch` (== `COUNTER_DIGIT_SLOT`) exactly as the plan specifies, even though `COUNTER_OVERFLOW` (`99999+`) is 6 characters — the plan's own CSS instruction pins the slot to `COUNTER_DIGIT_SLOT` ch, not `+1`; any 1-glyph overflow spill at the 100,000+ boundary is a device-only visual concern already covered by the deferred D8 UAT item.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/shell-map-invariants.test.js`'s retirement sweep broke on the restored identity line**
- **Found during:** Task 2 (verifying the shell-restructure acceptance criteria)
- **Issue:** This whole-phase Phase-35 sweep (not named in the plan's `files_modified`) asserted zero occurrences of the literal `"hud-name"` anywhere in `mazeworld.html`. Restoring `.mw-hud-name`/`#mw-hud-name` as band 1's identity element (exactly as CONTEXT.md's "the identity line comes back" ruling requires) necessarily reintroduces that substring, failing this pre-existing guard.
- **Fix:** Removed `hudName` from the zero-occurrence sweep with a comment explaining the Phase 57 reversal; added a positive assertion that `class="mw-hud-name" id="mw-hud-name"` exists exactly once. The other eight retirement literals in the same sweep are untouched.
- **Files modified:** test/unit/shell-map-invariants.test.js
- **Verification:** `node --test test/unit/shell-map-invariants.test.js` — 84/84 pass
- **Committed in:** 3200e0b (Task 2 commit)

**2. [Rule 1 - Bug] `tools/stale-terms.mjs`'s allow-list rotted after a comment rewrite**
- **Found during:** Task 2 (full-suite verification)
- **Issue:** `shell-gear-toolbar.test.js`'s `chipsMarkup()` comment (rewritten to describe the chip band's new position) previously carried the only "dpad" mention in that file, excused by an ALLOWED entry in `tools/stale-terms.mjs`. Removing the mention left the ALLOWED entry pointing at nothing, failing `stale-terms.test.js`'s "no allow-list entry has rotted" guard.
- **Fix:** Removed the rotted ALLOWED entry with an explanatory comment (the term is genuinely gone now, which is the better outcome, not a regression).
- **Files modified:** tools/stale-terms.mjs
- **Verification:** `node --test test/unit/stale-terms.test.js` — 5/5 pass
- **Committed in:** 3200e0b (Task 2 commit)

**3. [Rule 1 - Bug, plan CHECK itself] The plan's `git diff | grep -c keepInViewAxis` acceptance check false-positives on prose**
- **Found during:** Task 2 (running the plan's own acceptance criteria)
- **Issue:** The plan's stated check (`git diff -U0 mazeworld.html | grep -c 'keepInViewAxis'` must equal 0, proving `keepPartyInView()`'s body is untouched) is a bare substring grep. This commit's own explanatory CSS comment above `.mw-map-chips` mentions "the viewport's keepInViewAxis rect" in prose, tripping the same literal grep the critical_context's carried-forward Phase 56 lesson warned about (comment prose vs. code).
- **Fix:** Verified the real invariant directly instead — sliced `function keepPartyInView() {` to the next `\nfunction ` boundary from both `HEAD` and `git show 4d43edf:mazeworld.html`, and confirmed the two regions are byte-identical (`true`). Did not weaken the comment or contort the code to dodge the bare grep.
- **Files modified:** none (verification-only)
- **Verification:** `node -e` function-region diff, printed `identical: true`
- **Committed in:** N/A (documented here per the CHECK-fix protocol)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 collateral test fixes, 1 Rule 1 CHECK correction)
**Impact on plan:** All three are direct, necessary consequences of the sanctioned 2026-09-21 reversal (identity line back) and the chip-strip relocation. No scope creep — no file outside the plan's stated blast radius was touched for any other reason.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `#mw-map-chips` is fully outside `.mw-maze-viewport`; Plan 02 (the rail overlay) can build `#mw-stage` without any chip/rail collision to solve, per CONTEXT.md's "no chip/rail collision to solve" note.
- `window.__mzHudBands` is live and bridged — Plan 04 (darkness vignette, `__mzDarkness`) can follow the exact same bridge-registration shape.
- All four milestone gates hold at this commit: presentation (`engine/`/`content/`/`test/parity/` byte-identical, master blob hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged), offline (`package.json`/`package-lock.json` untouched, no new dependency), modularity (`bridge-registry.test.js` 10/10), accessibility (no TalkBack-relevant change in this plan — `paint()`'s text writes are unchanged in kind, only routed through a bridge).
- Deferred device checks (D6/D7/D8 above) are recorded for the Phase 60 batched Pixel 7 session per the standing deferred-UAT protocol — no device pause was taken in this run.

---
*Phase: 57-map-hud-layout-band*
*Completed: 2026-09-22*

## Self-Check: PASSED

All created files and referenced commits verified present on disk / in git log.
