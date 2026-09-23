---
phase: 58-motion-pacing
plan: 06
subsystem: ui
tags: [combat-beat, motion, reveal-sequencing, typewriter, mazeworld.html, node-test]

# Dependency graph
requires:
  - phase: 58-motion-pacing (plan 02)
    provides: "src/browser/combatBeat.js — planBeat, createBeat, createBeatRunner (the pure+timed combat-beat core); sfx.js#playClipIds"
  - phase: 58-motion-pacing (plan 03)
    provides: "test/unit/harness/fakeClock.js; loadShellSandbox({doc, reducedMotion=true, clock, stubRail})"
  - phase: 58-motion-pacing (plan 04)
    provides: "window.__mzMotion, the panel-close helper settleAllMotion() already drains"
  - phase: 58-motion-pacing (plan 05)
    provides: "window.__mzTypewriter — the shared keyed typewriter (rail/major keys already in use, \"fightlog\" reserved for this plan)"
provides:
  - "window.__mzBeat — { active, hurry, view } bridging ONE createBeatRunner instance; engineCombatAction hands every combat dispatch's already-resolved round to it (falling through to today's instant paint/render tail under reduced motion or when planBeat returns null)"
  - "The classic renderer (hasActiveEncounter, encArmed, renderEncounter, renderFightLog, renderFoeCards, renderActionArea, showTab) reads window.__mzBeat.view() to reveal a resolved round one exchange at a time, type each revealed fight-log row on, move a struck foe's HP/strike-pop with its own line, gate every combat button/key until the last line lands, and hurry losslessly on a panel tap (beatHurryTap, the one sanctioned tap-anywhere exception) or a tab switch"
  - "test/unit/combat-beat-shell.test.js (9 tests) and the beat section of reduced-motion.test.js (3 tests) prove the whole reveal/type/gate/hurry/killing-round/tab-flush contract against REAL engine-resolved rounds (engine/engine.js#applyAction) and a deterministic fake clock"
  - "test/unit/harness/recordingDom.js gains an additive-only innerHTML->element querySelector/querySelectorAll fallback — never mutates a real element's .children, so every pre-existing shell-tab-snapshots fixture stays byte-identical"
affects: [58-07-motion-pacing-audio-beat-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The beat's view() is read at EVERY render-relevant call site as a local `bv` (or `bv ? bv.state : S`), never cached across renders — renderEncounter's branch chain (stair/death/beats/loot/store) is prefixed `!bv && ` so a combat-ending round's own beat still renders the combat body from its frame before the settle render takes the normal ending branch."
    - "A presentation-only frame state (combatBeat.js's frameStateFor) flows through the SAME view-model functions (combatHeaderViewModel/foeListViewModel/yourLotViewModel/combatMenuViewModel) the real S already used — no second render path, no second copy of the header/foe/lot/menu logic."
    - "recordingDom.js's innerHTML setter stays a pure opaque record (per its own established contract — ids are recorded roots, never nested-by-parse); a SEPARATE, additive-only lazy parse-on-demand inside querySelector/querySelectorAll widens what a caller can FIND inside markup set via `.innerHTML = \"...\"`, without ever touching the real `.children` array the snapshot serializer reads — a scoped, backward-compatible fix for a gap no earlier Phase 58 (or any prior) test had actually exercised (driving the REAL combat header through this harness)."

key-files:
  created:
    - test/unit/combat-beat-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/harness/recordingDom.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/shell-combat-actions.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/shell-dead-foe-target.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/storeScreen.test.js

key-decisions:
  - "recordingDom.js's querySelector/querySelectorAll gained an additive-only innerHTML fallback (Rule 3, blocking): renderCombatHeader's `el.innerHTML = \"<span class=...>\"; el.querySelector(\".cb-head-label\").textContent = ...` pattern threw on this harness (querySelector always found nothing, since innerHTML never built real children) the first time any Phase 58 test drove the REAL combat body through a shell sandbox rather than asserting on source text alone. Fixed by a lazy, memoised, PER-ELEMENT parse of `content.value` that is consulted only when a real-children search finds nothing — the parse result is never attached to `.children`, so serializeElements' pinned Gear/Hero/Store fixture text is untouched. See Deviations."
  - "combat-beat-shell.test.js reproduces engineCombatAction's own handoff by hand (that function lives in the module script and cannot run in this classic-only sandbox): a real applyAction(\"attack\") round, `S` set to the after-state, the batch appended to window.__mzFightLog, then `sandbox.beatRunner.start(planBeat({...}))` — the SAME sequence, in the SAME order, engineCombatAction itself now runs."
  - "Two real, deterministic engine rounds (rngState 32 — a mid-fight round: Goblin Grunt struck+killed, Cave Rat strikes back critically, a third narration-only line; rngState 7 — a combat-ending round: Lone Wolf struck+killed, combat ends with no drops) are reused across combat-beat-shell.test.js and reduced-motion.test.js's beat section, per the plan's documented fallback (a real applyAction dispatch over hand-built events)."
  - "Test 4's teeth check (dropping encArmed()'s __mzBeat clause) needed a mid-GAP assertion — well past a plain ARM_DELAY_MS(250ms) window since the last render, but still well short of the next line's own 600ms offset — to actually distinguish the beat-aware gate from the plain Date.now()-vs-encRenderedAt comparison alone (which, without the beat clause, reads 'armed' shortly after ANY beat render, including a mid-beat one, since armEncounterButtons() stamps encRenderedAt on every renderEncounter() call regardless of whether a beat is active)."

patterns-established:
  - "A shell-sandbox test reproducing a module-only function's handoff by hand documents the EXACT call sequence in its own header comment (this file's own header: before/beforeLog capture -> dispatch -> set state -> append log -> planBeat -> beatRunner.start) so a later plan changing that sequence has one place to re-verify."

requirements-completed: [MOTION-03, MOTION-04, MOTION-05]

coverage:
  - id: D1
    description: "A combat round reveals one exchange at a time (~600ms apart after an immediate first line), each fight-log row typing on, never cutting off a still-typing line"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — tests 1, 2, 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "Numbers move with the line that caused them — a struck foe's HP/strike-pop and the hero's HP move on their own line, read from the beat's presentation-only frame state, never S; the HUD paint() is deferred to the end of the beat"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — test 6"
        status: pass
    human_judgment: false
  - id: D3
    description: "The killing round reads before the end card — the combat body renders from the beat's frame (hasActiveEncounter() true, the map stays parked) for the whole beat, even on a combat-ending round; the over-panel/loot/death branch takes over only once the beat has settled"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — test 7"
        status: pass
    human_judgment: false
  - id: D4
    description: "A tap anywhere on the encounter panel (beatHurryTap, capture phase, the one sanctioned tap-anywhere exception) or a tab switch hurries a live beat losslessly — every line lands in full, nothing is dispatched/dismissed/selected, the settle runs exactly once"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — tests 5, 8"
        status: pass
    human_judgment: false
  - id: D5
    description: "A player can never queue an action blind — encArmed()/hasActiveEncounter() read window.__mzBeat, so every guarded combat button/foe-card pick/combat key is swallowed until ARM_DELAY_MS after the beat's own settle render"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — test 4"
        status: pass
      - kind: other
        ref: "teeth check: encArmed()'s __mzBeat clause temporarily removed — combat-beat-shell test 4 FAILED as expected; reverted (git checkout -- mazeworld.html)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fight-log announcer (#enc-round-live) receives the complete round's text at once, in the very first beat render, while the visible rows reveal and type one by one; the typing row is aria-hidden for exactly its typing window"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat-shell.test.js — tests 1, 3; test/unit/shell-fight-log.test.js — the new unfiltered-log assertion"
        status: pass
      - kind: other
        ref: "teeth check: syncFightLogLive fed the FILTERED (visible-only) log — combat-beat-shell test 3 FAILED as expected; reverted (git checkout -- mazeworld.html)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Reduced motion (MOTION-05): engineCombatAction skips planBeat entirely under prefersReducedMotion(window); the default (reduced) sandbox lands a whole round at once with nothing typed and no row left aria-hidden; settleAllMotion() hurries any live beat"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js — the 3 \"beat\" section tests"
        status: pass
    human_judgment: false
  - id: D8
    description: "The rules engine is untouched — the beat reads before/after states, events and logs that already exist; no engine/content byte changes, no rng, no fixture moves; window.__mzBeat is the one new bridge name, with its BRIDGE row and doc regen landing in the same commit"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10)"
        status: pass
      - kind: other
        ref: "git diff --stat a01b38e08b98e36ed1939d9d1fe1538eee6237b1..HEAD -- engine/ content/ test/parity/ -> empty; git hash-object test/parity/prototype-master.js.txt -> a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false
  - id: D9
    description: "Phase gate: npm test fail 0 (3767/3767, +15 over the 3752/3752 baseline at dispatch), npm run build:www exit 0, package.json/lock untouched, no touched pre-existing test file lost a test( against BASE_58"
    verification:
      - kind: unit
        ref: "npm test (3767/3767)"
        status: pass
      - kind: other
        ref: "npm run build:www; git diff --stat a01b38e..HEAD -- package.json package-lock.json -> empty; per-file test( counts checked individually, all >= BASE_58"
        status: pass
    human_judgment: false
  - id: D10
    description: "On the Pixel 7, a round with several exchanges plays out one exchange at a time at a readable pace; each line types on; the foe's HP drops with the line that hit it; the action buttons come back only after the last line; a tap anywhere on the panel skips to the end instantly; the killing blow and a death read line by line before the end card. With Android's Remove animations on, a round lands all at once exactly as before this phase."
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — real-device pacing perception and the felt difference between the readable-beat and reduced paths cannot be proven from source or a headless sandbox. Deferred to the Phase 60 batched Pixel 7 session, per the plan's own two must_haves 'statement' bullets."

duration: ~2h
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 06: Combat Beat Shell Wiring (MOTION-03) Summary

**Every combat dispatch now hands its already-resolved round to one `window.__mzBeat` runner that reveals the round's fight-log lines one exchange at a time (typing each on), moves a struck foe's HP/strike-pop and the hero's HP with the line that caused them, keeps every combat button disarmed until the last line lands, hurries losslessly on a panel tap or a tab switch, and lets a killing round read on the combat body before the over-panel takes over — collapsing to today's instant landing under reduced motion.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3
- **Files modified:** 1 created (combat-beat-shell.test.js), 17 modified

## Accomplishments

- `window.__mzBeat` (`{ active, hurry, view }`) bridges ONE `createBeatRunner` instance (`src/browser/combatBeat.js`, Plan 58-02) built with a real setTimeout/clearTimeout-driven `createBeat`, `typeDurationMs` as `durationFor`, `onRender: () => window.renderEncounter()`, `onSettle: () => { window.paint(); window.renderEncounter(); }` (today's exact pre-Phase-58 tail, moved to the end of the beat), and `playClipIds` for `playClips` (cues stay empty until Plan 58-07 — sound still fires at dispatch time in this plan).
- `engineCombatAction` captures `before`/`beforeLog` immediately before its existing `dispatchWithNarration` call, keeps every statement between dispatch and the Oracle `logLine` loop byte-identical, and replaces its former unconditional `window.paint(); window.renderEncounter();` tail with: under non-reduced motion, build a `planBeat({...})` and, if it returns a plan and `beatRunner.start(plan)` succeeds, `return` immediately (the beat's own `onRender`/`onSettle` own every render from here); otherwise fall through to the unchanged instant tail.
- The classic renderer reads `window.__mzBeat.view()` (`bv`) throughout: `hasActiveEncounter()`/`encArmed()` gate on `bv.active()`; `renderEncounter()`'s stair/death/beats/loot/store branches are prefixed `!bv &&` so a combat-ending round's beat still renders the combat body (from `bv.state`) before the settle render takes the real ending branch; the combat section reads header/foes/lot from `bv.state` and passes `bv.hitFoe` into `renderFoeCards` for the new `.cb-foe-hit` strike-pop class (reusing the existing `mwStrikePop` keyframes); `renderActionArea` reads its menu view-model from the beat's frame state.
- `renderFightLog` reveals only rows up to `bv.maxId`, types the row at `bv.typeId` through the shared `window.__mzTypewriter` (key `"fightlog"`, adopting a same-line re-render, cancelling on a hurried/settled render), and always calls `syncFightLogLive(log)` with the WHOLE (unfiltered) log so the announcer reads the full round in the very first beat render (D-16), independent of what's visibly typing.
- `beatHurryTap` — a capture-phase click listener on `#enc-panel`, the one sanctioned tap-anywhere exception — stops propagation/prevents default and calls `window.__mzBeat.hurry()` only while a beat is live; `showTab()` hurries a live beat as its first statement, so a tab switch loses nothing.
- `test/unit/combat-beat-shell.test.js` (new, 9 tests) drives all of the above through TWO real, engine-resolved combat rounds (`engine/engine.js#applyAction`, never hand-built events): the first exchange landing immediately, each later exchange landing at its own offset, the announcer getting the whole batch at once, the arm gate holding through the whole beat (with a mid-gap check that gives the gate real teeth against a plain ARM_DELAY_MS comparison), tap-to-hurry losing nothing and settling exactly once, a struck foe's HP/strike-pop moving with its own line, a killing round reading on the combat body before the over-panel, a tab switch landing the round, and a stripped-source handoff anchor on `engineCombatAction` itself.
- `test/unit/reduced-motion.test.js` gains a "beat" section (3 tests): a stripped-source anchor confirming `planBeat` is computed only inside the `!prefersReducedMotion(window)` branch, the default (reduced) sandbox landing a whole real round at once with no typing and no stray `aria-hidden`, and `settleAllMotion()`'s own `beatRunner.hurry()` source anchor.
- `test/unit/harness/shellSandbox.js` wires the REAL `__mzFightLogVM`/`__mzCombatVM` (previously named as deliberately absent) and a REAL `createBeatRunner` over the sandbox's own clock, exposed on the returned object as `beatRunner` so a test can reproduce `engineCombatAction`'s own handoff.
- CSCR-08 re-pinned in `shell-combat-screen.test.js` and `shell-input-guards.test.js` to name `beatHurryTap` exactly as the one sanctioned tap-anywhere listener, asserting its exact capture-phase wiring and that its stripped body dispatches, dismisses and renders nothing.
- Every pre-existing test whose exact-string source anchor moved under the new `!bv && ` gate / `const V = bv ? bv.state : S;` marker / `C.pending && !bv` condition / `renderFoeCards`'s new `hitFoe` parameter was re-pinned to the landed strings (see Deviations) — `npm test` is green at 3767/3767 (+15 over the 3752/3752 baseline).
- Both plan-mandated teeth checks performed and reverted (`git checkout -- mazeworld.html`, pre-checked `git diff --quiet` clean immediately before each mutation): (1) dropped `encArmed()`'s `__mzBeat` clause — `combat-beat-shell` test 4 **FAILED** as expected. (2) fed `syncFightLogLive` the filtered (visible-only) log — `combat-beat-shell` test 3 **FAILED** as expected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Module script — the beat runner, the `__mzBeat` bridge and `engineCombatAction`'s beat handoff** - `e87cd49` (feat)
2. **Task 2: Classic side — render from the beat's frame, reveal/type rows, gate the buttons, hurry on tap and tab switch** - `b2c1104` (feat)
3. **Task 3: `combat-beat-shell.test.js`, the beat section of `reduced-motion.test.js`, and the CSCR-08 exception re-pins** - `854b83f` (test)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `mazeworld.html` — the `beatRunner`/`window.__mzBeat` construction and `settleAllMotion()`'s `beatRunner.hurry()`; `engineCombatAction`'s beat handoff; `hasActiveEncounter`/`encArmed`/`beatHurryTap`/`showTab`; `renderEncounter`'s `bv`-gated branch chain and combat section; `renderFoeCards`'s `hitFoe` param + `.cb-foe-hit` CSS; `renderFightLog`'s reveal/type/cancel logic; `renderActionArea`'s frame-state read
- `src/browser/bridge.js` — the `__mzBeat` BRIDGE row
- `docs/SHELL-MODULES.md` — regenerated (`node tools/bridge-doc.mjs --write`)
- `test/unit/harness/shellSandbox.js` — real `__mzFightLogVM`/`__mzCombatVM`/`__mzBeat` wiring; `beatRunner` exposed on the returned sandbox object
- `test/unit/harness/recordingDom.js` — the additive-only innerHTML->element querySelector/querySelectorAll fallback
- `test/unit/combat-beat-shell.test.js` — new, 9 tests
- `test/unit/reduced-motion.test.js` — new "beat" section, 3 tests
- `test/unit/shell-combat-screen.test.js` — CSCR-08 re-pin naming `beatHurryTap`; `renderFoeCards`/`const V`/`C.pending && !bv` marker re-pins
- `test/unit/shell-input-guards.test.js` — CSCR-08 re-pin naming `beatHurryTap`; loot/store guard-marker re-pins
- `test/unit/shell-fight-log.test.js` — the unfiltered-log-to-syncFightLogLive assertion
- `test/unit/shell-clarity-43.test.js`, `shell-combat-actions.test.js`, `shell-combat-over.test.js`, `shell-dead-foe-target.test.js`, `shell-fight-gate.test.js`, `shell-loot-screen.test.js`, `shell-map-rail.test.js`, `shell-map-viewport.test.js`, `storeScreen.test.js` — re-pinned to the `!bv && `-gated branch markers and `renderFoeCards`'s new signature (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (the recordingDom.js innerHTML-fallback fix; the hand-reproduced `engineCombatAction` handoff; the two reused real engine rounds; test 4's mid-gap teeth-check redesign).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test/unit/harness/recordingDom.js` had no way to support `renderCombatHeader`'s `innerHTML` + `querySelector` pattern**
- **Found during:** Task 3, `combat-beat-shell.test.js` test 1's first run
- **Issue:** `renderCombatHeader` (pre-existing, untouched by this plan) sets `el.innerHTML = "<span class=\"cb-head-label\"></span>..."` then immediately reads `el.querySelector(".cb-head-label").textContent = vm.label`. recordingDom.js's `innerHTML` setter is documented as deliberately never parsing markup into real `.children` (ids are recorded roots, not nested-by-parse) — `querySelector` therefore always found nothing here and the classic call threw `TypeError: Cannot set properties of null`. No prior test (Phase 34's own shell-combat-screen.test.js included) had ever driven the REAL combat body through this harness — every existing combat test is source-only (fs.readFileSync) — so this gap was previously unreachable, not previously broken.
- **Fix:** Added a scoped, ADDITIVE-ONLY lazy innerHTML parser (`parseHtmlFragment`/`getParsedHtmlChildren`) consulted by `querySelector`/`querySelectorAll` only when a real-children search finds nothing on an element whose content was set via `.innerHTML = "..."`. The parse result is memoised per element (keyed on the exact `content.value` string) and is NEVER attached to the element's own `.children` array — `serializeElements`/`serializeNode` (the shell-tab-snapshots.test.js pinned Gear/Hero/Store fixtures) read only `.children`, so every existing fixture stays byte-identical.
- **Files modified:** `test/unit/harness/recordingDom.js`
- **Verification:** `node --test test/unit/shell-tab-snapshots.test.js` — 10/10, byte-identical to before this change; `node --test test/unit/combat-beat-shell.test.js` — 9/9 with the fix, confirmed throwing without it.
- **Committed in:** `854b83f` (Task 3 commit)

**2. [Rule 1 - Bug caused directly by this plan's own Task 2 change] Nine pre-existing test files broke on the new `!bv && ` gate / `const V` marker / `renderFoeCards` signature**
- **Found during:** Task 3's first full `npm test` run after Task 2 landed
- **Issue:** Task 2's plan-mandated changes (prefixing the stair/death/beats/loot/store branch conditions with `!bv && `, replacing `const C = S.combat;` with `const V = bv ? bv.state : S; const C = V.combat;`, adding `&& !bv` to the pending gate, and adding a 4th `hitFoe` parameter to `renderFoeCards`) moved several exact-string source anchors that 11 pre-existing test files pin — only 2 of which (`shell-combat-screen.test.js`, `shell-input-guards.test.js`) are in this plan's declared `files_modified`. The other 9 (`shell-clarity-43`, `shell-combat-actions`, `shell-combat-over`, `shell-dead-foe-target`, `shell-fight-gate`, `shell-loot-screen`, `shell-map-rail`, `shell-map-viewport`, `storeScreen`) broke identically — 19 failing tests total.
- **Fix:** Re-pinned every broken marker to its landed string (`if (!bv && S.dead) {`, `if (!bv && S.store) {`, `if (!bv && S.pendingLoot && ...) {`, `if (!bv && !S.combat && S.beats...) {`, `if (!bv && window.__mzStair...) {`, `const V = bv ? bv.state : S;`, `if (C.pending && !bv)`, `function renderFoeCards(host, vm, onPick, hitFoe = -1)`), never loosening an assertion — each fix is a same-semantics anchor update, per the plan's own "Fix any other assertion the full suite shows was pinned to a line this plan changed, the same way" instruction (Task 3's action text explicitly authorizes fixing files outside the declared list).
- **Files modified:** `test/unit/shell-clarity-43.test.js`, `test/unit/shell-combat-actions.test.js`, `test/unit/shell-combat-over.test.js`, `test/unit/shell-dead-foe-target.test.js`, `test/unit/shell-fight-gate.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-map-rail.test.js`, `test/unit/shell-map-viewport.test.js`, `test/unit/storeScreen.test.js`
- **Verification:** `npm test` — 3767/3767, fail 0; per-file `grep -c '^test('` count checked individually against BASE_58, none shrunk.
- **Committed in:** `854b83f` (Task 3 commit)

---

**Total deviations:** 2 — 1 blocking harness gap fixed additively (never touching pinned fixture behavior), 1 direct ripple from this plan's own Task 2 change fixed across 9 out-of-declared-scope files per the plan's own re-pin authorization.
**Impact on plan:** No scope creep, no test loosened or deleted. The harness fix is a genuine new capability (querying into innerHTML-set markup) that only ADDS what querySelector can find; the ripple fixes are mechanical string re-pins with identical semantics.

## Issues Encountered

- Test 4's original design (checking `encArmed()` immediately after `beatRunner.start(plan)`, then again after `beatEndMs + margin`) had no teeth against the `__mzBeat` clause specifically: `armEncounterButtons()` stamps `encRenderedAt` on EVERY `renderEncounter()` call (including every beat line's own render), so a plain `Date.now()`-vs-`encRenderedAt` comparison alone would ALSO read "not yet armed" immediately after any render, coincidentally passing even with the beat clause removed. Caught by running the plan's own required teeth check before finalizing: redesigned the test to also check mid-GAP (well past a plain `ARM_DELAY_MS` window since the last render, but before the next line's own offset) — the moment that genuinely distinguishes the two gates. Confirmed the redesigned test still passes on real code and fails under the mutation.

## User Setup Required

None - no external service configuration required.

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred during this plan and no APK was built.

1. On the Pixel 7, a round with several exchanges plays out one exchange at a time at a pace that can be read; each line types on; the foe's HP drops with the line that hit it; the action buttons come back only after the last line; a tap anywhere on the panel skips to the end instantly; the killing blow and a death read line by line before the end card.
2. With Android's Remove animations on, a round lands all at once exactly as before this phase.

## Next Phase Readiness

- `window.__mzBeat` (`view()`'s `{ state, log, maxId, typeId, hitFoe, hurried, line, count, ending }` contract) is live and consumed by the classic renderer end-to-end. Plan 58-07 moves each dispatch's audio cue from `dispatchWithNarration`'s dispatch-time `playForDispatch` call onto its own beat line via `planBeat`'s `cues`/`cueLines` (58-02) and `beatRunner`'s already-wired `playClips: (clips) => playClipIds(clips)` — the plumbing for that move is already in place, cues are simply empty until then.
- `test/unit/reduced-motion.test.js`'s MOTION-05 ledger now carries pan + panels + typing + beat sections (14 tests); 58-07's own final audit checks every section named in MOTION-05's requirement text is present, and will append its own audio-specific assertions.
- No blockers. Engine/content/test-parity gate empty against BASE_58 (`a01b38e08b98e36ed1939d9d1fe1538eee6237b1`); `package.json`/`package-lock.json` untouched; `npm test` 3767/3767; `npm run build:www` exit 0; `bridge-registry.test.js` 10/10.

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: test/unit/combat-beat-shell.test.js
- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/harness/recordingDom.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/shell-combat-screen.test.js
- FOUND: test/unit/shell-input-guards.test.js
- FOUND: test/unit/shell-fight-log.test.js
- FOUND: commit e87cd49
- FOUND: commit b2c1104
- FOUND: commit 854b83f
