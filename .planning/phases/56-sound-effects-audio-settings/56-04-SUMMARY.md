---
phase: 56-sound-effects-audio-settings
plan: 04
subsystem: audio
tags: [web-audio, shell-wiring, settings-gate, node-test, source-scan, ident-sweep]

# Dependency graph
requires:
  - phase: 56-sound-effects-audio-settings (plan 02)
    provides: "src/browser/sfx.js pure core (CLIP_IDS, groupsForDispatch, clipsForDispatch)"
  - phase: 56-sound-effects-audio-settings (plan 03)
    provides: "src/browser/sfx.js player surface (unlockSfx, applySfxSettings, playForDispatch, playUiTap, stopAllSfx) over an injectable Web Audio backend"
provides:
  - "mazeworld.html wired to src/browser/sfx.js at exactly four call sites: the import block, applySettings (the AUD-05 gate), dispatchWithNarration (the dispatch-path seam), and one capture-phase document pointerdown listener (first-gesture unlock + delegated UI tap)"
  - "test/unit/sfx-settings.test.js — 14 tests: Half A pins the Sound Off/On toggle boundary through the injected fake backend (zero AudioContext construction while Off, proven by a zero-open()-calls assertion, not merely zero clips played); Half B pins the four shell call sites by a comment-stripped source scan of the real mazeworld.html, with a teeth case"
  - "AUD-05 marked complete in REQUIREMENTS.md; the whole v1.8 Phase 56 milestone gate (presentation/offline/modularity/scope) asserted green"
affects: [57-map-hud-layout-band, 58-motion-and-pacing, 60-performance-and-footprint-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct ES-module import for a sibling function called from the SAME module script (dispatchWithNarration, applySettings, and the new pointerdown listener all live in mazeworld.html's module <script>) — no window.__mz* bridge needed, unlike a classic-script consumer."
    - "One capture-phase document-level pointerdown listener as the sole first-gesture unlock site: unconditional call into a self-guarding function (unlockSfx bails on its own when Sound is Off or already open) rather than gating the call site itself — keeps the gate logic in exactly one place (src/browser/sfx.js)."
    - "Comment-stripped function-body extraction (brace-counting from a signature regex's first `{` to its matching `}`) as a source-scan technique for 'this call sits INSIDE that function', reusing tools/ident-sweep.mjs's stripHtml rather than a second stripper."
    - "A call-site-specific regex (`hapticForEvents\\(events\\);` with the trailing semicolon) to distinguish a function's own declaration line from its actual call sites when a bare grep of the function name would double-count the declaration — the documented workaround for the 'literal grep trips on a mention of the forbidden identifier' trap flagged in this plan's orchestrator context."

key-files:
  created:
    - test/unit/sfx-settings.test.js
  modified:
    - mazeworld.html
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Wrote every new mazeworld.html doc comment WITHOUT the literal parenthesized identifiers it was documenting (e.g. 'the unlock call below' instead of 'unlockSfx()') after a first-pass grep -c check showed the plan's own acceptance criteria (exactly 1 occurrence of playForDispatch(/unlockSfx(/etc.) would otherwise be tripped by comment prose — the same trap plans 01/02 each burned a self-correction commit on, avoided here by writing it correctly the first time and then catching + fixing the two spots that slipped through before the first commit."
  - "audioCtx (the dispatch-seam's per-call context object) is a deliberately separate local from dispatchWithNarration's existing ctx (narration context) — named audioCtx, never shadowing or reusing ctx, per the plan's explicit instruction."
  - "test/unit/sfx-settings.test.js's toggle-boundary tests use INDEPENDENT fresh fake backends per test (rather than one long cumulative test walking through the plan's numbered narrative in a single shared state) — this makes each assertion's expected call count self-evident from that test's own setup, and sidesteps an arithmetic slip in the plan's own narrative text (see Deviations)."

requirements-completed: [AUD-05]

coverage:
  - id: D1
    description: "mazeworld.html imports src/browser/sfx.js directly in its module script and calls applySfxSettings/playForDispatch/unlockSfx/playUiTap at exactly the four sites the plan specifies — no fifth call site, no change to hapticForEvents or its two call sites, no new body inside paint()/draw()"
    requirement: "AUD-05"
    verification:
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: shell wiring — applySfxSettings( appears exactly once, inside applySettings's function body"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: shell wiring — playForDispatch( appears exactly once, inside dispatchWithNarration's function body, after dispatch(action)"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: shell wiring — unlockSfx( and playUiTap( each appear exactly once"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: shell wiring — the two pre-existing hapticForEvents(events) CALL SITES are untouched"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10 passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With Sound set to Off, no audio device is ever opened — the gate holds across unlockSfx, a dispatch, and a UI tap, and mazeworld.html itself contains zero AudioContext construction sites (the only two live inside src/browser/sfx.js's DEFAULT_BACKEND.open(), which unlockSfx's own soundIsOff() guard bails out of before ever being reached)"
    requirement: "AUD-05"
    verification:
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: Off gate — unlockSfx, a dispatch, and playUiTap all record zero open()/load()/start() calls"
        status: pass
      - kind: other
        ref: "grep -nE \"AudioContext\" mazeworld.html — zero matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "The toggle boundary is pinned at every edge: On before any gesture stays silent with zero open() calls and throws nothing; a mid-playback flip to Off stops every live voice THEN closes the device (relative ordering asserted, not just two nonzero counters); Off then On then a fresh unlock re-opens and re-decodes on the SECOND gesture with the voice pool provably starting empty; an empty/unmapped/null event list under Off plays nothing and throws nothing; the persisted Sound value round-trips through settings.js unchanged by this plan"
    requirement: "AUD-05"
    verification:
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: On before any gesture — flipping Sound On alone stays silent, records zero open() calls, and throws nothing"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: EDGE toggle boundary — Off mid-playback stops every live voice, THEN closes the device, and the pool returns to empty"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: EDGE toggle boundary — Off then On then a fresh unlock re-opens and re-decodes on the SECOND gesture"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: EDGE empty under Off — an empty, all-unmapped, or null event list plays zero clips and throws nothing"
        status: pass
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: persistence round-trip — writeSetting(sound, false) survives a reload; an invalid value is rejected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every action that flows through dispatchWithNarration can sound — the dispatch-path seam fires ONE fire-and-forget playForDispatch(action.type, result.events, audioCtx) call regardless of action type (move, camp, store, Joiner, inventory, combat/magic), where audioCtx.stepped is computed from pre/post party floor position and audioCtx.combatType falls back to the pre-dispatch combat type; dispatchWithNarration's return value and every caller's render tail stay byte-identical"
    requirement: "AUD-05"
    verification:
      - kind: unit
        ref: "test/unit/sfx-settings.test.js#sfx-settings: shell wiring — playForDispatch( appears exactly once, inside dispatchWithNarration's function body, after dispatch(action)"
        status: pass
      - kind: other
        ref: "git diff v1.7..HEAD -- mazeworld.html | grep -c \"^-\" -> 0 (no existing line deleted or rewritten); git diff --stat -- engine/ content/ -> empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole v1.8 Phase 56 milestone gate holds: presentation (npm test fail 0, engine/content/test-parity byte-identical, parity master hash unchanged, no pseudo-random call), offline (build:www green, 30 mp3s in www/sfx/, no absolute URL in sfx.js, package.json/lock untouched), modularity (bridge-registry 10/10, no new hunk inside paint()/draw(), no orphan attributable to this phase), scope (no new timing/await in a render tail, hapticForEvents' two call sites unchanged)"
    requirement: "AUD-05"
    verification:
      - kind: unit
        ref: "npm test -> 3532/3532 pass, fail 0"
        status: pass
      - kind: other
        ref: "npm run build:www exits 0; find www/sfx -name '*.mp3' | wc -l -> 30; git hash-object test/parity/prototype-master.js.txt -> a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false
  - id: D6
    description: "On a real Pixel 7: a clip fires on the action that caused it with no audible lag and simultaneous events overlap (AUD-04); first launch after install in airplane mode plays every clip with nothing fetched (AUD-06); Sound=Off silences everything and survives force-quit + relaunch (AUD-05); the monster-family cry on Fight! matches the foe's family per the 2026-09-22 ruling (AUD-02)"
    verification: []
    human_judgment: true
    rationale: "Device-audible latency/overlap/persistence-across-process-death cannot be proven by a Node unit test against a fake backend or a fake localStorage — deferred per the standing deferred-UAT protocol to the Phase 60 batched Pixel 7 checklist. No device pause occurred during this phase."

duration: 30min
completed: 2026-09-22
status: complete
---

# Phase 56 Plan 04: Sound Effects & Audio Settings — Shell Wiring & Phase Gate Summary

**mazeworld.html wired to src/browser/sfx.js at exactly four call sites (import, the AUD-05 settings gate, the dispatch-path seam, and a capture-phase first-gesture-unlock/UI-tap listener), with a 14-test pin proving no `AudioContext` is ever constructed while Sound reads Off — closing Phase 56 with every v1.8 milestone gate green.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-22T10:15:54-04:00
- **Completed:** 2026-09-22T10:45:00-04:00
- **Tasks:** 3
- **Files modified:** 3 (2 new)

## Accomplishments
- `mazeworld.html`'s module script gained exactly four additions and zero deletions: an import of `unlockSfx`/`applySfxSettings`/`playForDispatch`/`playUiTap` from `src/browser/sfx.js` (direct ES-module import — `dispatchWithNarration` and `applySettings` live in the same module script, so no `window.__mz*` bridge entry was needed or added); `applySettings(settings)` now calls `applySfxSettings(settings)` right after `currentSettings`/`window.__mzSettings` are set — the ONE gate that makes AUD-05 real, reached at boot and at every Settings-sheet write since the existing `#mw-settings-rows` handler already routes through `applySettings`; `dispatchWithNarration(action)` now fires one fire-and-forget `playForDispatch(action.type, result.events, audioCtx)` call, with `audioCtx` a deliberately separate local from the function's existing narration `ctx` (`audioCtx.stepped` compares `before.floor.px/py` against `result.state.floor.px/py`, `audioCtx.combatType` falls back from `result.state?.combat?.type` to `before?.combat?.type`); and one capture-phase `document.addEventListener("pointerdown", ...)` calls `unlockSfx()` unconditionally (self-guarded internally) and `playUiTap()` when the tap target is a `button`/`[role="button"]` — the map `<canvas>` never matches, so a move sounds exactly once via the dispatch seam.
- `test/unit/sfx-settings.test.js` created: 14 tests. Half A (7 tests) drives the Sound toggle entirely through an injected fake backend mirroring `test/unit/sfx.test.js`'s shape (plus a combined `calls.order` log to prove stop-then-close ORDERING, not just two nonzero counters): the Off gate records zero `open()`/`load()`/`start()` calls across unlock, a dispatch, and a UI tap; On-before-any-gesture also stays at zero `open()` calls and throws nothing; the first gesture after On opens once and decodes all 30 clips; a mid-playback flip to Off stops every live voice THEN closes the device (asserted as a true relative ordering); Off→On→a fresh unlock re-opens and re-decodes on the SECOND gesture, with the voice pool proven to start empty (a 9-dispatch burst evicts exactly once, not more); an empty/unmapped/null event list under Off plays nothing and throws nothing; and a `writeSetting`/`readSettings` round-trip confirms persistence (unchanged by this plan) still holds. Half B (7 tests) scans the REAL `mazeworld.html` via `tools/ident-sweep.mjs`'s `stripHtml` (the same single-pass stripper `test/unit/bridge-registry.test.js` already trusts): the `sfx.js` import exists; `applySfxSettings(` appears exactly once and sits inside `applySettings`'s brace-counted function body; `playForDispatch(` appears exactly once, sits inside `dispatchWithNarration`'s function body, and its string index is AFTER `const result = dispatch(action);`'s index; `unlockSfx(`/`playUiTap(` each appear exactly once; the two `hapticForEvents(events);` CALL SITES (a semicolon-anchored regex, deliberately distinct from the function's own declaration line, which has no trailing semicolon) are unchanged at 2; no `Math.random`/`crypto.getRandomValues` appears anywhere in the file; and a TEETH test proves the function-body-scan technique actually fails on a synthetic source missing the gate call. A live teeth check against the real file (temporarily deleting the `applySfxSettings(settings);` line, re-running the suite to a confirmed non-zero exit with 1 failing test, then restoring the file to a byte-identical `git diff` and a clean re-pass) was also run and is not itself a committed artifact.
- The whole-phase gate was run and recorded (see `## Phase Gate Results` below): `npm test` 3532/3532 pass; `npm run build:www` exits 0 with 30 `.mp3` files in `www/sfx/`; `engine/`, `content/`, and `test/parity/` are byte-identical against `v1.7`; the parity master hash is unchanged; `package.json`/`package-lock.json` are untouched; `bridge-registry.test.js` is 10/10; `tools/shell-sweep.mjs orphans` surfaces 27 advisory-only classic-script orphans, none attributable to this phase (none reference any sfx/audio identifier); and the whole-phase diff introduces no new hunk inside `paint()`/`draw()` and no new `setTimeout`/`setInterval`/`await` in a render tail.
- AUD-05 marked complete in `.planning/REQUIREMENTS.md` (checkbox + traceability table), closing the sound half of the v1.8 milestone (AUD-01 through AUD-06 all now checked; AUD-04's and AUD-06's device-only halves and AUD-05's persist-across-relaunch half remain queued for the Phase 60 Pixel 7 batch per the standing deferred-UAT protocol).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire src/browser/sfx.js into mazeworld.html at four call sites** - `e911ff8` (feat)
2. **Task 2: Pin the settings gate and the shell wiring in test/unit/sfx-settings.test.js** - `9042db6` (test)

**Task 3 (phase gate + this SUMMARY):** (this commit, made after this SUMMARY — no source files changed, only `.planning/` docs)

## Files Created/Modified
- `mazeworld.html` - four additions in the module script: the `sfx.js` import, the `applySfxSettings` call inside `applySettings`, the `playForDispatch` call inside `dispatchWithNarration`, and the capture-phase pointerdown listener (unlock + delegated UI tap); zero existing lines deleted or rewritten
- `test/unit/sfx-settings.test.js` - new: 14 tests pinning the AUD-05 toggle boundary (behavioural, via a fake backend) and the four shell call sites (a comment-stripped source scan, with a teeth case)
- `.planning/REQUIREMENTS.md` - AUD-05 checkbox and traceability row marked complete

## Decisions Made
- Wrote `mazeworld.html`'s new doc comments WITHOUT the literal parenthesized function-call substrings they describe (e.g. "the unlock call below" rather than "unlockSfx()"), correcting two spots that slipped through on the first pass before the Task 1 commit — this is the exact trap the orchestrator context named ("plans 01 and 02 each burned a self-correction commit on it"); caught here by running the plan's own `grep -c` acceptance criteria before committing rather than after.
- `audioCtx` (the dispatch-seam's per-call context object) is a deliberately separate local from `dispatchWithNarration`'s existing `ctx` (the narration context) — never shadowed or reused, per the plan's explicit instruction.
- `test/unit/sfx-settings.test.js`'s toggle-boundary tests use an independent fresh fake backend per test rather than one long cumulative test — see Deviations below for why.

## Deviations from Plan

### Auto-fixed / documentation-only corrections (not Rule 1-4 code changes)

**1. The plan's narrative arithmetic for the Off→On→re-unlock `load()` count was off by 2.** `56-04-PLAN.md`'s Task 2 action text says "Flipping Off then On then unlocking re-opens and re-decodes: open() count is 2, load() count is 62." With `CLIP_IDS` at exactly 30 entries (pinned separately in 56-02/56-03 and confirmed again here), two full unlocks decode 30 + 30 = 60 clips, not 62 — the plan's `<acceptance_criteria>` list for this task does not itself assert the literal "62" figure (no acceptance bullet names it), so this is a documentation-only correction to the plan's narrative prose, not a code defect. `test/unit/sfx-settings.test.js`'s re-open test asserts the mathematically correct `loads.length === 60` with an inline rationale comment. No source file was affected.

**2. `grep -c "hapticForEvents(events)" mazeworld.html` returns 3, not the "2" both this plan's Task 1/Task 3 acceptance criteria state, because the function's own declaration line (`function hapticForEvents(events) {`) matches the same literal substring as its two real call sites — this was already true before this plan touched the file (`git show 90a8760:mazeworld.html | grep -c "hapticForEvents(events)"` also returns 3) and is unrelated to anything this plan changed.** The property the criterion actually intends — "the haptics paths are untouched" — does hold: a semicolon-anchored regex (`hapticForEvents\(events\);`, which the two real call sites have and the declaration line does not) confirms exactly 2 call sites, unchanged, both in the phase-gate run above and in `test/unit/sfx-settings.test.js`'s own named test. Recorded here as a plan-authoring inaccuracy for future plans to word more precisely (call-site-anchored, not bare-function-name), per the orchestrator's own warning about this exact trap.

---

**Total deviations:** 0 code changes; 2 documentation-only corrections to inaccurate plan narrative/acceptance text (both harmless to intent, both recorded above with the actual verified invariant).
**Impact on plan:** None on scope or correctness — every acceptance criterion that is itself testable (not the two miscounted narrative numbers above) passes as written.

## Issues Encountered
- First-pass `mazeworld.html` doc comments used the literal parenthesized call syntax (e.g. `unlockSfx()`, `playForDispatch()`) inside prose, which a bare `grep -c "playForDispatch("` (Task 1's own acceptance criterion) then over-counted. Caught by running the acceptance-criteria greps before the Task 1 commit rather than trusting the diff by eye; fixed by rewording four comment spots to describe the calls without repeating their exact call syntax. No behavior change — pure comment wording.
- The re-open test in `test/unit/sfx-settings.test.js` initially asserted a stale inherited eviction count (copy-paste reasoning from a sibling test that DID pre-seed two live voices; this test does not). Caught by the test's own first run (1 failing assertion, `1 !== 3`), fixed by correcting the assertion and its comment to the test's actual setup, re-run to green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 56 (Sound Effects & Audio Settings) is complete: AUD-01 through AUD-06 are all checked in REQUIREMENTS.md. The audio layer is fully wired and gated; the only remaining work against it is device confirmation, batched for Phase 60 per the standing deferred-UAT protocol (see `## Human Verification — Deferred to Phase 60` below). Phase 57 (Map & HUD Layout Band) and Phase 58 (Motion & Pacing) can proceed independently — neither has a dependency on this plan's shell-wiring shape beyond `dispatchWithNarration`'s seam contract, which this plan explicitly preserved byte-for-byte (return value unchanged, every existing caller's render tail unchanged).

## Phase Gate Results

All commands run and recorded from the repo root at HEAD (`9042db6` + this docs commit), against the `v1.7` tag as the phase-base reference:

**Presentation gate:**
- `npm test` → **3532/3532 pass, fail 0** (up from 3518 at the start of this plan; +14 from `test/unit/sfx-settings.test.js`).
- `git diff --stat v1.7..HEAD -- engine/ content/` → empty.
- `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
- `git diff --stat v1.7..HEAD -- test/parity/` → empty.
- `grep -vE "^\s*(//|\*|/\*)" src/browser/sfx.js | grep -cE "https?://|Math\.random|crypto\.getRandomValues|setTimeout|setInterval"` → `0`.
- `git diff v1.7..HEAD -- mazeworld.html | grep -cE "^\+.*(setTimeout|setInterval|await )"` → `0`.

**Offline gate:**
- `npm run build:www` → exits 0.
- `find www/sfx -name '*.mp3' | wc -l` → `30`.
- `grep -nE "https?://" src/browser/sfx.js` (outside comments) → none.
- `git diff v1.7..HEAD -- package.json package-lock.json` → empty.

**Modularity gate:**
- `node --test test/unit/bridge-registry.test.js` → 10/10 pass (set-equality + doc-sync; this plan adds zero new `__mz*` names since `sfx.js`'s player surface is called via direct ES-module import, not the bridge).
- `node tools/shell-sweep.mjs orphans` → 27 advisory-only classic-script orphans; none reference any audio/sfx identifier — none attributable to this phase.
- `git diff v1.7..HEAD -- mazeworld.html` hunk line ranges (4298–4933) fall entirely within the module script's setup section; `paint()` (line 1939→) and `draw()` (line 2406→) are both far earlier in the file and untouched — confirmed by hunk-header inspection, not just grep.

**Scope gate:**
- `git diff v1.7..HEAD -- mazeworld.html | grep -c "^-"` → `0` (pure insertion; no existing line deleted or rewritten).
- `hapticForEvents\(events\);` call-site count → `2` (unchanged; see Deviations #2 for the bare-substring caveat).

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred during this phase and no APK was built. The following are queued for the Phase 60 batched Pixel 7 checklist:

- **Pixel 7 — AUD-04 latency:** a clip fires on the action that caused it with no audible lag.
- **Pixel 7 — AUD-04 overlap:** simultaneous events overlap rather than cutting each other off.
- **Pixel 7 — AUD-06 airplane mode:** first launch after install in airplane mode plays every clip with nothing fetched.
- **Pixel 7 — AUD-05 persistence:** Sound set to Off silences everything and survives force-quit and relaunch.
- **Pixel 7 — AUD-02 family cry:** the monster-family cry on the Fight! press matches the foe's family, with `Lair Beasts` sounding as `enemy-human` and `Magical` as `enemy-demon` per the 2026-09-22 ruling.

**Note for Phase 58 (MOTION-03):** this plan did not observe or measure combat pacing (out of scope, and no device play occurred). Whether any fight resolves too fast for its own audio to read remains an open question for Phase 58's on-device pass, not something this plan can report evidence on either way.

---
*Phase: 56-sound-effects-audio-settings*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: test/unit/sfx-settings.test.js
- FOUND: .planning/phases/56-sound-effects-audio-settings/56-04-SUMMARY.md
- FOUND: commit e911ff8
- FOUND: commit 9042db6
