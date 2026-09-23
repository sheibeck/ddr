---
phase: 58-motion-pacing
plan: 05
subsystem: ui
tags: [motion, typewriter, accessibility, rail, encounter-overlay, mazeworld.html]

# Dependency graph
requires:
  - phase: 58-motion-pacing (plan 01)
    provides: "src/browser/typewriter.js — TYPE_MS_PER_CHAR(12)/TYPE_MAX_MS(700)/TYPE_REST_CLASS, typeDurationMs/typedCount/splitTyped, and createTypewriter (adopt/type/complete/cancel/active/completeAll) — this plan wires the one shared instance into the shell"
  - phase: 58-motion-pacing (plan 04)
    provides: "window.__mzMotion, the rail's [hidden] display:block!important fix, and renderRail()'s slide-out content-retention rule (wasShown/idle skip-repaint) — this plan's idle-path typewriter.cancel() call builds directly on that retained content"
  - phase: 57-map-hud-layout-band (plan 03)
    provides: "the rail's holdForCard(card)/railDismissKind, the guarded #mw-rail body-tap handler's four ordered checks, and railShownAt — this plan inserts the typing-complete branch between checks 2 and 3 and re-routes the hold's own scheduling through holdForCard"
provides:
  - "window.__mzTypewriter — { type, adopt, complete, cancel, active, durationFor } over one shared src/browser/typewriter.js instance; wired into settleAllMotion() via typewriter.completeAll()"
  - "renderRail(): a fresh card's .mw-rail-line/.mw-rail-roll block types as one run keyed \"rail\"; a same-card re-render adopts the in-flight block (never restarts); an idle re-render cancels it (departing content written out in full for its slide); the rail's hold timer (startHold) now starts from the typing block's own onDone, not at render time"
  - "the #mw-rail body-tap handler: a tap on typing text completes it and returns, inserted between the arm-window check and the locked-card check"
  - "renderMajorOverlay(): the .mw-major-line types once per content (title+line key, reset in renderEncounter's inactive branch and combat-body start); #mw-major-desc (hidden, always the complete line) plus aria-describedby=\"mw-major-desc\" on #mw-major; a tap on the line completes it"
  - ".mw-type-rest{visibility:hidden} — reserves a typing block's final layout so a card never grows while it types"
  - "test/unit/harness/shellSandbox.js's stubRail option (default true) — false wires the REAL renderRail()/__mzRailVM/__mzRail; the REAL __mzTypewriter is always wired regardless of stubRail"
  - "test/unit/typed-text.test.js — 8 BEHAVIOUR tests over the real renderRail()/renderMajorOverlay() through a deterministic fake clock"
affects: [58-06, 58-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A same-content re-render adopts an in-flight typed block (typedTargets/typedTexts collected during the lines loop, handed to typewriter.adopt() when !isNew); a genuinely new card cancels the old block implicitly via typewriter.type()'s own cancel(key) and starts a fresh one; an idle re-render explicitly cancels (typewriter.cancel(\"rail\")) so departing content is written out in full for its CSS slide-out, never left mid-typed."
    - "The hold timer is deferred behind the typing block's own onDone (a startHold closure capturing holdCard, called either as the typewriter's onDone or directly when there is nothing to type/no bridge — fail-open, matching pre-Phase-58 timing) — reading time starts only once typing has actually finished, never at render time."
    - "A tap-to-complete branch sits between two pre-existing guarded checks (the arm-window check and the locked-card pulse) in the #mw-rail body-tap handler and in renderMajorOverlay's line onclick — completing text is a third, narrower outcome than dismiss/pulse/pass-through, never conflated with any of them."

key-files:
  created:
    - test/unit/typed-text.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/rail-dismiss.test.js
    - test/unit/perfMarks.test.js

key-decisions:
  - "BASE_58 = a01b38e08b98e36ed1939d9d1fe1538eee6237b1 (the commit that added 58-CONTEXT.md), per the plan's own discovery step — used for every engine-gate diff and re-pin-count check below."
  - "The typewriter instance's clock construction (`now: () => performance.now(),`) is byte-identical to 58-03's camera-glide clock line — both are non-dev-gated 'live runtime clock' exceptions to PERF-01's dev-instrumentation census (test/unit/perfMarks.test.js), so the pre-existing pinned test was re-pinned (Rule 1, out-of-scope fix directly caused by this plan's own Task 1 change) to treat both identical lines as the one shared exception rather than inventing a second, differently-worded clock construction just to dodge the collision."
  - "renderMajorOverlay's typing key is `spec.title + \"\\u0001\" + spec.line` (an unprintable separator) rather than a printable join, so a title/line pair that could theoretically concatenate to the same string under a plain '+' join can never collide."
  - "The rail's holdCard is captured once, at the moment the isNew block runs (`!idle && !buttons.length && rail.card`), and closed over by startHold — not re-read from `rail.card` inside the setTimeout callback — so the closure stays correct across the async gap between the card's own render and its typing block's eventual onDone, even though `rail` (the local render-scope binding) is long gone by the time the timer fires."

patterns-established:
  - "typedTargets/typedTexts collected in document order during the SAME loop that builds a rail card's .mw-rail-line/.mw-rail-roll DOM (no second pass) — the one array pair every type()/adopt() call in renderRail reads."

requirements-completed: [MOTION-04, MOTION-05]

coverage:
  - id: D1
    description: "window.__mzTypewriter bridges src/browser/typewriter.js's one shared instance; renderRail() types a fresh card's lines/rolls as one block, the announcer (#mw-rail-live) still gets the complete text in the same render, and the typing host is aria-hidden for exactly the typing window"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (1)"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail's hold starts only once typing finishes (startHold called from the typing block's own onDone), not at render time — the card is still showing at holdForCard(card) ms after the render, and clears once typing time plus holdForCard(card) ms has actually elapsed"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A same-card re-render mid-typing (paint()'s own repeated renderRail()/renderEncounter() calls) adopts the in-flight block instead of restarting it — the typed prefix never drops and the block still ends at its original end time"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (3), (8)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A body tap mid-typing, after the arm window, completes the typing (never dismisses) and schedules the hold; the very next armed tap then dismisses — the typing-complete branch sits strictly between the arm-window check and the locked-card pulse"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (4)"
        status: pass
      - kind: unit
        ref: "test/unit/rail-dismiss.test.js Section B (ordered anchor)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A card replaced mid-typing schedules no hold for the old card (only the new card's own hold ever fires); a card cleared mid-typing writes its departing lines out in full for the slide-out and schedules no hold"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (5), (6)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A decision card's (joiner/find) buttons exist immediately, arm on the normal ARM_DELAY_MS via the shared encRenderedAt/encArmed() gate, and never wait for the card's own typing block to finish"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (7)"
        status: pass
    human_judgment: false
  - id: D7
    description: "renderMajorOverlay's line types once per content (title+line key); #mw-major carries aria-describedby=\"mw-major-desc\" pointing at a hidden node holding the complete line from the first frame, independent of typing; a tap on the line completes it; lastMajorTypedKey resets on the overlay's own dismissal and at the combat-body's own start so the next overlay types again"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typed-text.test.js (8)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js (CSCR-06, unchanged — no exact-child-list pin existed to re-pin)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Reduced motion (MOTION-05): the default (reduced) sandbox writes a rail card's plain full text in the same render, never touches #mw-rail-lines' aria-hidden, and schedules the rail's hold synchronously in that same render (typewriter.type()'s onDone fires inline under reduced()); the overlay's line and #mw-major-desc carry the same already-complete text; settleAllMotion() drains the typewriter via typewriter.completeAll()"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js — typing section (3/3)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Phase gate: npm test fail 0 (3752/3752, +12 over the 3740/3740 baseline at dispatch), npm run build:www exit 0, engine/content/test-parity diff against BASE_58 empty, package.json/lock untouched, bridge-registry green"
    verification:
      - kind: unit
        ref: "npm test (3752/3752)"
        status: pass
      - kind: other
        ref: "npm run build:www"
        status: pass
      - kind: other
        ref: "git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/ -> empty; git diff --stat a01b38e..HEAD -- package.json package-lock.json -> empty"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10)"
        status: pass
    human_judgment: false
  - id: D10
    description: "On the Pixel 7, a rail card's text types on quickly ('fast, not slow'), a long card finishes in under a second; tapping the card while it types finishes it without dismissing; the stair and encounter cards type their line the same way. With TalkBack on, a new rail card is announced in full the moment it appears, and the encounter card is read in full when focused, even while its line is still typing."
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — real-device timing perception and TalkBack announcement behaviour cannot be proven from source or a headless sandbox. Deferred to the Phase 60 batched Pixel 7 session. The automated half (durations, the announcer's complete text, the aria-hidden window, hold-after-typing, tap-to-complete, re-render continuity, the reduced path) is D1-D8 above."

# Metrics
duration: ~25min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 05: Typed Text (MOTION-04) Summary

**Rail cards and the encounter overlay's line now type themselves on at 12ms/char (700ms cap) via one shared `window.__mzTypewriter` bridge — the rail's reading hold starts only once typing finishes, a tap completes typing instead of dismissing, a same-content re-render adopts the in-flight block instead of restarting it, and `#mw-rail-live`/`#mw-major-desc` always carry the complete text regardless of typing.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-22T21:13:44Z
- **Completed:** 2026-09-22T21:38:04Z
- **Tasks:** 3
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- `window.__mzTypewriter` (`{ type, adopt, complete, cancel, active, durationFor }`) bridges `src/browser/typewriter.js`'s one shared `createTypewriter` instance (real `performance.now`/rAF, `document`, `reduced: () => prefersReducedMotion(window)`); `typewriter.completeAll()` joins `settleAllMotion()`'s existing camera-glide/panel-motion calls (MOTION-05).
- `renderRail()`: `typedTargets`/`typedTexts` collected in document order while building `.mw-rail-line`/`.mw-rail-roll`; a same-card re-render (`!isNew`) hands the in-flight block to the fresh elements via `adopt("rail", ...)`; the idle skip-repaint path (58-04's retention rule) now also cancels the run so a departing card's content is written out in full for its slide, with no stray hold; a new card's hold is deferred into a `startHold` closure (capturing `holdCard`) called from the typewriter's own `onDone` — reading time starts only once typing has actually finished, falling open to calling `startHold()` directly when there's nothing to type or the bridge is missing (today's exact pre-Phase-58 timing).
- The `#mw-rail` body-tap handler gains one new check — `window.__mzTypewriter?.active?.("rail")` — between 57-03's arm-window check and its locked-card check: a tap on typing text completes it and returns, never reaching the dismiss/pulse branches.
- `renderMajorOverlay()`: a new hidden `#mw-major-desc` paragraph (the complete `spec.line` from the first frame) plus `aria-describedby="mw-major-desc"` on `#mw-major`; the `.mw-major-line` types once per content (`spec.title + "\u0001" + spec.line` as the key, tracked in a new `lastMajorTypedKey`, reset in `renderEncounter`'s inactive branch and at the combat-body's own start); a same-content re-render adopts; a tap on the line completes it.
- `.mw-type-rest{visibility:hidden}` reserves a typing block's final layout so a card never grows mid-type.
- `src/browser/bridge.js`'s `__mzTypewriter` BRIDGE row (alphabetically between `__mzToolIndex` and `__mzUsableBy`) plus `docs/SHELL-MODULES.md` regen, in the same commit as the bridge itself.
- `test/unit/harness/shellSandbox.js` gains a `stubRail` option (default `true`, unchanged pre-Phase-58 behaviour) — `false` wires the REAL `renderRail()`/`__mzRailVM`/`__mzRail` (mirroring `rail-dismiss.test.js#loadRailDismissSandbox`'s own wiring) so `typed-text.test.js` can exercise the real card machinery through the one shared harness; the REAL `__mzTypewriter` is now wired unconditionally (both `renderRail()` and `renderMajorOverlay()` can be exercised regardless of `stubRail`).
- `test/unit/typed-text.test.js` (new, 8 named BEHAVIOUR tests, all against a deterministic fake clock — no real sleeps): a new card types with the announcer's complete text and the aria-hidden window (1); the hold starts only after typing (2); a same-card re-render continues rather than restarts (3); a tap mid-typing completes (never dismisses) and the next armed tap dismisses (4); a replaced card schedules no stray hold for the old card (5); a cleared card writes its departing lines in full with no hold (6); a decision card's buttons arm on `ARM_DELAY_MS` independent of typing (7); the encounter overlay's line types, adopts on a same-content re-render, and a tap completes it (8).
- `test/unit/reduced-motion.test.js` gains a "typing" section (3 tests): the default (reduced) sandbox writes plain full text in the same render with no `aria-hidden` and schedules the rail's hold synchronously (proven via a `setTimeout` call counter on the sandbox's own scheduler); the overlay's line and `#mw-major-desc` agree; `settleAllMotion()`'s source body drains the typewriter.
- `test/unit/rail-dismiss.test.js`: wires the same real `__mzTypewriter` into `loadRailDismissSandbox` (reduced by default, matching that sandbox's own `matchMedia` stub); adds one new Section B ordered-anchor test proving the typing-complete branch sits strictly after the arm-window check and strictly before the locked-card pulse in the handler's own stripped source (10 → 11 tests, never shrunk).
- `test/unit/shell-map-rail.test.js` (f) re-pinned to `vm.holdForCard ? vm.holdForCard(holdCard) : 8400` (the `startHold`/`onDone` shape) — the one-`setTimeout(` count is unchanged (19/19 tests, count unchanged).
- **Both plan-mandated teeth checks performed and reverted (`git checkout -- mazeworld.html`, pre-checked `git diff --quiet` clean immediately before each mutation):** (1) bypassed `onDone` entirely, scheduling the hold directly in the `isNew` block — `typed-text (2)` **FAILED** as expected. (2) removed the `adopt("rail", ...)` call — `typed-text (3)` **FAILED** as expected (a `TypeError` reading the orphaned run's stale elements, itself proof the block was never handed to the fresh ones).

## Task Commits

Each task was committed atomically:

1. **Task 1: The `__mzTypewriter` bridge, rail typing with the hold on done, and the tap-completes branch** - `58d8ec7` (feat)
2. **Task 2: The encounter overlay's line types once per content, with a complete-text description for assistive tech** - `8fc3eed` (feat)
3. **Task 3: The `stubRail` sandbox option, `typed-text.test.js`, the typing section of `reduced-motion.test.js`, and re-pins** - `581fb2f` (test)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `mazeworld.html` — `.mw-type-rest` CSS; the `__mzTypewriter` module-script instance/bridge; `settleAllMotion()`'s `typewriter.completeAll()`; `renderRail()`'s typing/adopt/cancel/startHold wiring; the body-tap handler's typing-complete branch; `renderMajorOverlay()`'s `#mw-major-desc`/`aria-describedby`/typing/onclick; `lastMajorTypedKey` + its two reset sites in `renderEncounter`
- `src/browser/bridge.js` — the `__mzTypewriter` BRIDGE row
- `docs/SHELL-MODULES.md` — regenerated (`node tools/bridge-doc.mjs --write`)
- `test/unit/harness/shellSandbox.js` — the `stubRail` option; the real `__mzTypewriter` wired in `wireBridges`
- `test/unit/typed-text.test.js` — new, 8 tests
- `test/unit/reduced-motion.test.js` — new "typing" section, 3 tests
- `test/unit/rail-dismiss.test.js` — real `__mzTypewriter` wired into `loadRailDismissSandbox`; 1 new ordered-anchor test (10 → 11)
- `test/unit/shell-map-rail.test.js` — (f) re-pinned to the `startHold`/`holdCard` shape
- `test/unit/perfMarks.test.js` — the PERF-01 `performance.now(` census re-pinned to treat the typewriter's and the camera-glide's identical live-clock lines as one shared exception (Rule 1, out-of-scope fix caused directly by this plan's own Task 1 change)

## Decisions Made

See `key-decisions` in the frontmatter above (the shared-literal PERF-01 re-pin; the `\u0001`-separated typing key; `holdCard` captured once and closed over by `startHold`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug caused directly by this plan's own Task 1 change] `test/unit/perfMarks.test.js`'s PERF-01 `performance.now(` census broke**
- **Found during:** Task 1's first full `npm test` run
- **Issue:** The typewriter instance's clock (`now: () => performance.now(),`) is constructed with the EXACT same literal text as 58-03's camera-glide clock line, which `perfMarks.test.js` already carved out as "the sole, explicit exception" to PERF-01's dev-gated `performance.now(` count (7 dev-gated lines + that one exception = 8 total). Adding a second, textually-identical exception line pushed the file-wide count to 9 without updating the test's own exception bookkeeping (both lines get excluded from `devGatedLines` by the same string match, so the 7-dev-gated-line assertion still held — only the total-count assertions broke).
- **Fix:** Re-pinned the test to `strippedLines.length === 9` / `rawLines.length === 9`, with an updated comment naming both the camera-glide and typewriter clock reads as the two (textually-identical) live-clock exceptions.
- **Files modified:** `test/unit/perfMarks.test.js`
- **Verification:** `node --test test/unit/perfMarks.test.js` green (22/22); full `npm test` green.
- **Committed in:** `581fb2f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, a pre-existing pinned test broken directly by this plan's own Task 1 change, outside Task 1's declared `files_modified`).
**Impact on plan:** Necessary consequence of the plan's own prescribed `now: () => performance.now(),` literal (Task 1's action text) colliding textually with 58-03's identical camera-glide line. No scope creep; no test loosened.

## Issues Encountered

- `armEncounterButtons()`'s aria-disabled sweep reads `document.querySelectorAll(...)`, which `test/unit/harness/recordingDom.js`'s `document` stub always returns `[]` for (its own doc comment explains why: the harness's original callers never fired a real timer against it). Typed-text (7)'s first draft asserted the aria-disabled attribute was removed after `ARM_DELAY_MS` — always false under this stub regardless of correctness. Caught before committing by re-reading `recordingDom.js`'s own header comment; rewrote the assertion against `encArmed()` (the REAL gate `guardTap`'s `onclick` wrapper actually checks — `sandbox.context.encArmed()`, a classic top-level function reachable directly off the vm context, same pattern `reduced-motion.test.js` already uses for `keepPartyInView`/`centerMap`), which is clock-driven and needs no `querySelectorAll`.

## User Setup Required

None - no external service configuration required.

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built.

1. On the Pixel 7, a rail card's text types on quickly, reads as "fast, not slow", and a long card finishes in under a second; tapping the card while it types finishes it without dismissing; the stair and encounter cards type their line the same way.
2. With TalkBack on, a new rail card is announced in full the moment it appears, and the encounter card is read in full when focused, even while its line is still typing.

## Next Phase Readiness

- `window.__mzTypewriter` (keys `"rail"`/`"major"` in use; `"fightlog"` reserved) is live and reusable — Plan 58-06 (the combat beat) wires the fight-log row typing and `durationFor` into its own reveal pacing.
- `test/unit/reduced-motion.test.js`'s MOTION-05 ledger now carries pan + panels + typing sections; 58-06 appends its own beat section, and 58-07's final audit checks every section named in MOTION-05's requirement text is present.
- No blockers. Engine/content/test-parity gate empty against BASE_58; `package.json`/`package-lock.json` untouched; `npm test` 3752/3752; `npm run build:www` exit 0; `bridge-registry.test.js` 10/10.

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/typed-text.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/rail-dismiss.test.js
- FOUND: test/unit/shell-map-rail.test.js
- FOUND: test/unit/perfMarks.test.js
- FOUND: commit 58d8ec7
- FOUND: commit 8fc3eed
- FOUND: commit 581fb2f

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*
