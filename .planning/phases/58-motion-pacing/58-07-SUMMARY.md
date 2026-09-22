---
phase: 58-motion-pacing
plan: 07
subsystem: ui
tags: [combat-beat, audio, sfx, motion, reduced-motion, mazeworld.html, node-test]

# Dependency graph
requires:
  - phase: 58-motion-pacing (plan 02)
    provides: "src/browser/sfx.js#cuesForDispatch/playClipIds — the source-indexed clip projection and the already-resolved-list player; src/browser/combatBeat.js#planBeat's cues/cueLines wiring"
  - phase: 58-motion-pacing (plan 06)
    provides: "window.__mzBeat, the classic renderer's beat-frame wiring, engineCombatAction's beat handoff, and the shared MOTION-05 ledger (pan/panels/typing/beat sections) in test/unit/reduced-motion.test.js"
provides:
  - "dispatchWithNarration(action, opts = {}) — defers a combat round's clips into opts.cues (via cuesForDispatch) instead of playing them at dispatch time, when the caller passes an array; every other dispatch keeps calling opts-less and plays at dispatch time via playForDispatch, unchanged"
  - "engineCombatAction's cues seam — collects cues, forwards them to planBeat({ cues }) for the beat to fire per line; the no-beat/reduced-motion path plays them all at once via playClipIds, identical to the pre-Phase-58 playForDispatch"
  - "test/unit/beat-audio.test.js (5 tests) — per-line playback parity, hurry losing nothing, variation rotation across beats, Sound Off silence through a full beat+hurry, and the family cry staying dispatch-time"
  - "test/unit/sfx-settings.test.js's Half B re-pinned to dispatchWithNarration's exact new signature (playForDispatch(/cuesForDispatch( each once, in one Array.isArray(opts.cues) if/else)"
  - "test/unit/reduced-motion.test.js's 'audit' section (6 tests) — the phase-wide MOTION-05 ledger: one predicate, four controllers, settle-all, a mid-session flip of all four together, a same-tick smoke test, and a SHA-256-pinned modularity proof that paint()/draw() carry no Phase 58 code"
affects: [60-device-verification-batch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A deferred-effects seam (opts.cues array, mutated by push) rather than a return value — lets dispatchWithNarration keep its existing single return value/signature contract for its other 8 callers while giving its one special caller (engineCombatAction) a side channel to collect resolved-but-unplayed clips, without adding a second code path through cuesForDispatch/clipsForDispatch (both stay projections of the same groupEntriesForDispatch resolution)."
    - "extractFunctionBody's brace-start fix (m.index + m[0].length - 1 instead of source.indexOf('{', m.index)) — a signature regex that itself ends with the function's own opening brace is the only way to safely locate a function body when the signature can contain an embedded {} (a default-parameter object literal); the old indexOf approach silently matched the WRONG brace the moment such a parameter was added."
    - "A cross-effect audit as its own test section, built from the SAME real module factories (createCameraGlide/createPanelMotion/createTypewriter/createBeat+createBeatRunner) driven directly against one shared reduced flag and one fake clock — proves the mid-session flip holds across all four effects TOGETHER, a claim no single per-effect section could make on its own."

key-files:
  created:
    - test/unit/beat-audio.test.js
  modified:
    - mazeworld.html
    - test/unit/sfx-settings.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-narration-wiring.test.js

key-decisions:
  - "Task 1's deferred-cues seam pushes onto opts.cues (a caller-owned array) rather than returning cues from dispatchWithNarration — preserves dispatchWithNarration's existing return contract (state/events/html) byte-for-byte for its other 8 call sites, and lets engineCombatAction declare `const cues = []` before the dispatch with no destructuring change."
  - "extractFunctionBody (test/unit/sfx-settings.test.js) fixed to locate the body brace from the END of the signature match rather than re-searching source.indexOf('{', ...) from the match START — required the moment dispatchWithNarration's opts = {} default parameter put an embedded brace pair ahead of the real body brace; verified equivalent for every pre-existing signature (none had an embedded brace before its own body)."
  - "beat-audio.test.js reuses combat-beat-shell.test.js's exact midFightRound() fixture (rngState 32) rather than a fresh synthetic round — its four mapped events (struck/foeKilled/goldGained/struckByFoe) legitimately hit Phase 56's pre-existing 3-clip dispatch cap, so testing against this REAL round proves the beat's per-line playback is correct even when a line's clip is capped away, not just for the easy all-lines-have-clips case."
  - "reduced-motion.test.js's buildScenario() gained an optional stubRail (default true, backward-compatible) parameter so the audit's same-tick smoke test (5) could drive the real renderRail() alongside the pan/panel/tab/beat effects in one sandbox, reusing the established scenario builder rather than a parallel one."
  - "The modularity proof (audit test 6) pins paint()/draw()'s comment-stripped-body SHA-256 against PRE58 (ab3fca9, the Phase 57 closing commit) rather than BASE_58 (a01b38e) — BASE_58 postdates Phase 57's own legitimate HUD work on those two functions, so comparing against it would hide a real Phase 58 regression inside noise BASE_58 already carries."

requirements-completed: [MOTION-03, MOTION-05]

coverage:
  - id: D1
    description: "A combat round's clips fire with the line that caused them, not all at dispatch time — dispatchWithNarration(action, opts={}) defers into opts.cues via cuesForDispatch when asked; engineCombatAction forwards them to planBeat({cues}); the no-beat/reduced-motion path plays them all at once via playClipIds, identical to the pre-Phase-58 playForDispatch"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/beat-audio.test.js — tests 1, 2 (per-line playback against a real applyAction-resolved round; hurry losing nothing)"
        status: pass
      - kind: other
        ref: "npm run build:www exit 0; exactly one dispatchWithNarration( call site passes a second argument (engineCombatAction, { cues })"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nothing is lost and nothing is added — the SET of clips a beat plays equals clipsForDispatch's list for the identical round, both at the end of a normal beat and after a hurry; variation rotates across beats exactly as across dispatches"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/beat-audio.test.js — tests 1, 2, 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Phase 56 audio contract is preserved: Sound Off opens no audio device through a full beat and a hurry; the family cry stays on dispatchWithNarration's one-argument (dispatch-time) move/fight path, never deferred into a beat; Phase 56's shell-wiring test is re-pinned to the exact new signature, never loosened"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/beat-audio.test.js — tests 4, 5; test/unit/sfx-settings.test.js (14/14, re-pinned)"
        status: pass
      - kind: other
        ref: "grep -c \"Math.random\" src/browser/sfx.js -> 0; git diff BASE_58..HEAD -- test/unit/sfx-settings.test.js touches only the re-pinned test + the extractFunctionBody brace fix"
        status: pass
    human_judgment: false
  - id: D4
    description: "MOTION-05 holds phase-wide in one ledger: one reduced-motion predicate, all four JS-timed controllers (camera glide/panel close/typewriter/combat beat) built with reduced: () => prefersReducedMotion(window), settleAllMotion() draining all four, a mid-session flip landing all four together, and a same-tick smoke test across all five effects (pan/panel/tab/rail-card/beat) with nothing lost"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js — the 6-test \"audit\" section (20/20 total in the file)"
        status: pass
      - kind: other
        ref: "teeth check: typewriter.completeAll() removed from settleAllMotion — audit test 3 AND the pre-existing typing-section source anchor both FAILED as expected; reverted (git checkout -- mazeworld.html)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Modularity gate holds: paint()/draw() bodies are byte-identical (comment-stripped) to PRE58's (the Phase 57 closing commit, predating Phase 58's first code); bridge-registry.test.js is green"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js audit test 6 (SHA-256 pin); test/unit/bridge-registry.test.js (10/10)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase gate: npm test fail 0; npm run build:www exit 0; engine/content/test-parity byte-identical to BASE_58; the prototype master hash unchanged; package.json/package-lock.json untouched"
    verification:
      - kind: unit
        ref: "npm test (3778/3778)"
        status: pass
      - kind: other
        ref: "npm run build:www exit 0; git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/ -> empty; git hash-object test/parity/prototype-master.js.txt -> a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff a01b38e..HEAD -- package.json package-lock.json -> empty"
        status: pass
    human_judgment: false
  - id: D7
    description: "On the Pixel 7, in a fight each strike/miss/hurt/kill sound plays as its line appears (not all at the start of the round); hurrying plays the rest at once; Sound Off stays silent; a new fight still opens with the monster family's cry. With Remove animations on, a whole session shows no motion and loses no text, sound or card."
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — real-device audio timing/overlap perception and the felt difference of a whole Remove-animations session cannot be proven from source or a headless sandbox. Deferred to the Phase 60 batched Pixel 7 session (see the checklist below, which also carries every device item from plans 58-03..58-06)."

duration: ~30min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 07: Combat Beat Audio Wiring + Phase-Wide MOTION-05 Audit Summary

**Each combat clip now fires with the fight-log line that caused it (dispatchWithNarration defers into a beat via `opts.cues`/`cuesForDispatch`, `engineCombatAction` hands them to `planBeat`, the beat plays each line's clips through `playClipIds`) — every other dispatch, the 3-clip cap, variation rotation and the family cry are byte-for-byte Phase 56's contract; a new phase-wide "audit" section in `reduced-motion.test.js` closes MOTION-05 with one predicate, all four controllers landing together on a mid-session flip, and a SHA-256-pinned proof that `paint()`/`draw()` carry no Phase 58 code — phase gate green at 3778/3778.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 1 created, 6 modified

## Accomplishments

- `dispatchWithNarration(action, opts = {})` (D-12): when the caller passes `opts.cues` (an array), every entry of `cuesForDispatch(action.type, result.events, audioCtx)` — resolved exactly as before (same order, de-dupe, 3-voice cap, counter-driven variation, family cry) — is pushed onto it instead of being played immediately; every other call keeps calling `dispatchWithNarration(action)` with no second argument, so its clips still play at dispatch time via the unchanged `playForDispatch` call. Only `engineCombatAction` passes `{ cues }`.
- `engineCombatAction` declares `const cues = []` before its dispatch, forwards them into `planBeat({ ...cues })`, and — on the path where no beat starts (reduced motion, no plan, or `start()` returning false) — plays every deferred clip at once via `playClipIds(cues.map((c) => c.clip))` immediately before the existing `window.paint()` tail, identical to the pre-Phase-58 `playForDispatch` call it replaced.
- `test/unit/beat-audio.test.js` (new, 5 tests), driven against a REAL `applyAction`-resolved combat round (`rngState 32`, reused verbatim from `combat-beat-shell.test.js`'s `midFightRound()`) and a real fake-Web-Audio backend: only line 0's clips start synchronously; each later line's clips start exactly at that line's own offset (including a line whose clip was legitimately capped away by Phase 56's pre-existing 3-clip cap — nothing new starts on that line); `runner.hurry()` starts every remaining line's clips at once, in order, matching the no-beat total; two consecutive beats of single-hit rounds rotate `hit1` then `hit2`, the same rotation two consecutive dispatches would produce; Sound Off records zero `open()`/`start()` calls through a full beat plus a hurry; the family cry (`cuesForDispatch("move", [{type:"combatJoined"}], {combatType:"Beasts"})` → `enemy-beast`) stays on the move path's one-argument, dispatch-time `dispatchWithNarration(action)` call.
- `test/unit/sfx-settings.test.js` Half B re-pinned to the exact new signature: `playForDispatch(`/`cuesForDispatch(` each appear exactly once, both after `dispatch(action)`, sitting in one `Array.isArray(opts.cues)` if/else. The shared `extractFunctionBody` helper's brace-start calculation was fixed (see Deviations) — the old `source.indexOf("{", m.index)` broke the moment the new `opts = {}` default parameter put an embedded `{}` pair ahead of the real body brace.
- Teeth check (recorded, reverted): temporarily made `combatBeat.js`'s `onLine` skip `playClips` when `info.hurried` — `beat-audio` test 2 (the hurry test) FAILED as expected; reverted via `git checkout -- src/browser/combatBeat.js`, confirmed byte-identical after.
- `test/unit/reduced-motion.test.js` gained an "audit" section (6 tests) closing the phase-wide MOTION-05 ledger:
  1. **One predicate** — `"prefers-reduced-motion"` appears in JS only as `src/browser/motion.js`'s `REDUCED_MOTION_QUERY`; the blanket CSS rule occurs exactly once.
  2. **Four controllers, one predicate** — `createCameraGlide(`/`createTypewriter(`/`createBeat(`/`createPanelMotion(`'s call-argument slices each contain `reduced: () => prefersReducedMotion(window)`; `prefersReducedMotion` is imported exactly once, from `./src/browser/motion.js`.
  3. **Settle-all** — `settleAllMotion()`'s body calls the camera glide's `finish`, `panelMotion.finishAll()`, `typewriter.completeAll()` and `beatRunner.hurry()`; `onReducedMotionChange(window,` is wired exactly once, and its callback calls `settleAllMotion()` only when the new value is `true`.
  4. **Mid-session flip, all four together** — real `createCameraGlide`/`createPanelMotion`/`createTypewriter`/`createBeat`+`createBeatRunner` instances, sharing ONE switchable `reduced` flag on one fake clock, all started in flight; flipping the flag and running the same four calls `settleAllMotion` makes lands the glide on its exact target, hides the panel element (`onHidden` fired once), completes the typing (full text, `onDone` fired once) and hurries the beat (settled once, the last render `hurried: true`) — all in the same tick; a further `clock.advance()` changes nothing.
  5. **Nothing lost under reduced (smoke)** — in one default (reduced) sandbox (`stubRail: false`), a pan nudge, a sheet close, a tab switch, a new rail card and a beat start all land synchronously: cam on target, the sheet hidden, the outgoing screen hidden, the card's full text with no typed/rest spans, and every beat line visible with none `aria-hidden`.
  6. **Modularity** — `paint()`/`draw()`'s comment-stripped bodies are SHA-256-pinned against PRE58 (`ab3fca9`, the Phase 57 closing commit — chosen over BASE_58 because BASE_58 postdates Phase 57's own legitimate HUD work on these two functions) and proven byte-identical to the working tree's current bodies.
- Teeth check (recorded, reverted): temporarily removed `typewriter.completeAll();` from `settleAllMotion` — audit test 3 AND the pre-existing "typing" source-anchor test both FAILED as expected; reverted via `git checkout -- mazeworld.html`, confirmed clean after.
- Phase gate: `npm test` 3778/3778 (fail 0, up from 3767/3767 at dispatch — +11: +5 `beat-audio.test.js`, +6 `reduced-motion.test.js` audit section); `npm run build:www` exit 0; `git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/` empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `package.json`/`package-lock.json` untouched; `bridge-registry.test.js` 10/10; `node tools/shell-sweep.mjs orphans` lists none of `glideCenterMap`/`showPanel`/`hidePanel`/`beatHurryTap` (see Deviations for `applyCam`, a pre-existing advisory false positive).

## Task Commits

Each task was committed atomically:

1. **Task 1: Defer a combat round's clips from dispatchWithNarration into the beat** - `8490742` (feat)
2. **Task 2: beat-audio.test.js and the exact re-pin of Phase 56's shell-wiring tests** - `7155e21` (test)
3. **Task 3: The cross-effect MOTION-05 audit, the modularity proof, and the phase gate** - `402f49f` (test)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `mazeworld.html` — `dispatchWithNarration(action, opts = {})`'s deferred-cues if/else; `engineCombatAction`'s `cues` collection, `planBeat({ cues })` forward, and the no-beat `playClipIds` tail; the `cuesForDispatch` import
- `test/unit/beat-audio.test.js` — new, 5 tests
- `test/unit/sfx-settings.test.js` — Half B's shell-wiring test re-pinned to the exact new signature; `extractFunctionBody`'s brace-start fix
- `test/unit/reduced-motion.test.js` — new "audit" section, 6 tests; `buildScenario()` gained an optional `stubRail` param
- `test/unit/shell-fight-log.test.js`, `test/unit/shell-map-rail.test.js`, `test/unit/shell-narration-wiring.test.js` — re-pinned to `dispatchWithNarration(action, opts = {})`'s exact new signature (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (the `opts.cues` push-array seam over a return-value change; the `extractFunctionBody` brace-start fix; reusing `combat-beat-shell.test.js`'s real capped-clip fixture; `buildScenario()`'s new `stubRail` param; PRE58 over BASE_58 for the modularity hash).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug caused directly by this plan's own Task 1 change] Three pre-existing tests pinned dispatchWithNarration(action)'s exact string with no second parameter**
- **Found during:** Task 2's first full `npm test` run after Task 1 landed
- **Issue:** `test/unit/shell-fight-log.test.js` and `test/unit/shell-map-rail.test.js` each sliced the module script from the literal string `"function dispatchWithNarration(action)"`; `test/unit/shell-narration-wiring.test.js` matched `/function dispatchWithNarration\(action\)/g` expecting exactly one definition. Task 1's `opts = {}` addition moved all three anchors — 3 failing tests, none in this plan's declared `files_modified`.
- **Fix:** Re-pinned each to the exact new signature (`"function dispatchWithNarration(action, opts = {})"` / `/function dispatchWithNarration\(action, opts = \{\}\)/g`), same semantics, no assertion loosened.
- **Files modified:** `test/unit/shell-fight-log.test.js`, `test/unit/shell-map-rail.test.js`, `test/unit/shell-narration-wiring.test.js`
- **Verification:** `npm test` — 3772/3772 after this fix (Task 2's own commit point); per-file `grep -c '^test('` counts checked individually against BASE_58, none shrunk (14→15, 19→19, 12→12).
- **Committed in:** `7155e21` (Task 2 commit)

**2. [Rule 1 - Bug in the plan's own re-pin target, caught before running the teeth check] extractFunctionBody's brace-start calculation broke on the new embedded-brace signature**
- **Found during:** Task 2, first run of the re-pinned `sfx-settings.test.js` shell-wiring test
- **Issue:** `sfx-settings.test.js`'s shared `extractFunctionBody(source, signatureRe)` helper located the body's opening brace via `source.indexOf("{", m.index)` — searching from the START of the signature match. `dispatchWithNarration(action, opts = {})`'s own default-parameter `{}` sits BEFORE the real body's `{`, so this returned an empty `{}` slice (the default-parameter's own braces), not the function body — every assertion against `body` failed.
- **Fix:** Changed the brace-start to `m.index + m[0].length - 1` — the END of the signature match, which (since every signature regex used here already ends with `\s*\{`) IS the real body's opening brace, regardless of any embedded braces earlier in the signature. Verified equivalent for every pre-existing signature (none had an embedded brace before its own body).
- **Files modified:** `test/unit/sfx-settings.test.js`
- **Verification:** `node --test test/unit/sfx-settings.test.js` — 14/14 passing after the fix; confirmed the old code returned an empty body by manual inspection before fixing.
- **Committed in:** `7155e21` (Task 2 commit — the corrected helper was the only version ever committed)

---

**Total deviations:** 2 — 1 direct ripple from this plan's own Task 1 change (re-pinned across 3 out-of-declared-scope files, same semantics), 1 self-correction to the plan's own re-pin target caught before finalizing (never landed in a broken state).
**Impact on plan:** No scope creep, no test loosened or deleted. Both fixes are mechanical — exact-string/regex re-pins and a brace-matching correction — with identical intended semantics to what the plan specified.

## Issues Encountered

- `tools/shell-sweep.mjs orphans` (advisory, not a gate) lists `applyCam` among 30 orphaned classic top-level declarations. Investigated: `applyCam` IS referenced — twice, as a bare function value passed to `window.__mzCameraGlide.to(cam, partyCentre(), applyCam)` and `G.to(cam, target, applyCam)` — never via literal `applyCam(` call syntax, which is what the heuristic detects. Confirmed via `git stash` that this flag predates Task 3's own changes (present in the tree immediately after Task 2's commit too), so it is not a regression this plan introduced — a pre-existing tool-heuristic limitation (reference-passed callbacks aren't counted as "reachable"), not dead code. `glideCenterMap`/`showPanel`/`hidePanel`/`beatHurryTap` are all absent from the orphan list, as the plan's acceptance criterion requires.

## User Setup Required

None - no external service configuration required.

## Human Verification — Phase 60 batched Pixel 7 checklist

Per the standing deferred-UAT protocol, no device pause occurred during this plan and no APK was built. This is the FULL merged checklist for Phase 60 — every deferred device item from plans 58-03 through 58-07, verbatim, plus this plan's own two device items (MOTION-03's audio-per-line check, and MOTION-05's own Remove-animations item):

**Map pan (58-03, MOTION-01):**
1. On the Pixel 7, walking toward a map edge scrolls the map smoothly instead of in jumps; tapping quickly several times never stutters; a drag started mid-glide takes over instantly; the gold ring stays glued to the party throughout; the resting map is as crisp as before.
2. With Android's Remove animations turned on, the map moves in single jumps exactly as before this phase.

**Panels, sheets & tabs (58-04, MOTION-02):**
3. On the Pixel 7, the MARKS, camp and Settings sheets slide up and back down; the ☰ menu drops in and fades away; the encounter overlay fades in and out; switching tabs cross-fades without the map appearing to scroll; the rail slides up with its card and slides back down with that same card; nothing feels sluggish (opens about 180ms, closes about 120ms).
4. With Android's Remove animations turned on, every surface above appears and disappears instantly and nothing is left half-visible.

**Typed text (58-05, MOTION-04):**
5. On the Pixel 7, a rail card's text types on quickly, reads as "fast, not slow", and a long card finishes in under a second; tapping the card while it types finishes it without dismissing; the stair and encounter cards type their line the same way.
6. With TalkBack on, a new rail card is announced in full the moment it appears, and the encounter card is read in full when focused, even while its line is still typing.

**Combat beat (58-06, MOTION-03):**
7. On the Pixel 7, a round with several exchanges plays out one exchange at a time at a pace that can be read; each line types on; the foe's HP drops with the line that hit it; the action buttons come back only after the last line; a tap anywhere on the panel skips to the end instantly; the killing blow and a death read line by line before the end card.
8. With Android's Remove animations on, a round lands all at once exactly as before this phase.

**Combat beat audio (58-07, MOTION-03):**
9. On the Pixel 7, in a fight each strike, miss, hurt and kill sound plays as its line appears (not all at the start of the round); hurrying plays the rest at once; Sound Off stays silent; a new fight still opens with the monster family's cry.

**Whole-session reduced motion (58-07, MOTION-05):**
10. With Android's Remove animations on, a whole session (walking to an edge, opening each sheet and the ☰ menu, switching tabs, reading rail cards, a full fight) shows no motion and loses no text, sound or card.

## Next Phase Readiness

- Phase 58's four motion/pacing effects (map pan, panels/sheets/tabs, the combat beat, typed text) and their audio-beat wiring are all landed; MOTION-01 through MOTION-05 are fully implemented and unit-proven.
- The Phase 60 batched Pixel 7 checklist above (10 items) is ready for the orchestrator to lift into VERIFICATION.md's `human_verification` at phase close.
- No blockers. Engine/content/test-parity gate empty against BASE_58 (`a01b38e08b98e36ed1939d9d1fe1538eee6237b1`); `package.json`/`package-lock.json` untouched; `npm test` 3778/3778; `npm run build:www` exit 0; `bridge-registry.test.js` 10/10.
- `.planning/phases/58-motion-pacing/deferred-items.md` (from 58-01/58-02) still tracks a RESOLVED note on a worktree-only CRLF artifact — not relevant to the main-tree execution this plan ran on (`npm test` clean at 3778/3778 here).

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: test/unit/beat-audio.test.js
- FOUND: .planning/phases/58-motion-pacing/58-07-SUMMARY.md
- FOUND: commit 8490742
- FOUND: commit 7155e21
- FOUND: commit 402f49f
