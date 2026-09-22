---
phase: 56-sound-effects-audio-settings
plan: 03
subsystem: audio
tags: [web-audio, injectable-backend, voice-pool, node-test, bridge-registry]

# Dependency graph
requires:
  - phase: 56-sound-effects-audio-settings (plan 02)
    provides: "src/browser/sfx.js pure core (CLIP_IDS, CLIP_GROUPS, EVENT_CLIP_GROUP, FAMILY_CRY, DISPATCH_CLIP_CAP, groupsForDispatch(), createVariation(), clipsForDispatch()) that this plan's playForDispatch()/playUiTap() resolve clips through"
provides:
  - "src/browser/sfx.js audio backend: a five-method injectable backend interface (open/load/start/stop/close), DEFAULT_BACKEND over real Web Audio, resolveBackend() reading globalThis.__mzSfxBackendOverride at call time"
  - "VOICE_CAP (8), unlockSfx(), playForDispatch(), playUiTap(), stopAllSfx(), applySfxSettings() — the exported player surface"
  - "__mzSfxBackendOverride registered in src/browser/bridge.js's BRIDGE map and docs/SHELL-MODULES.md's generated table"
  - "test/unit/sfx.test.js — 16 tests pinning unlock/idempotency/retry, all four AUD-04 player-side edges, decode-in-flight + missing-asset degradation, playUiTap/stopAllSfx, the Sound toggle boundary, never-throws, and a cap teeth case"
affects: [56-04-sound-effects-audio-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Five-method injectable backend interface (open/load/start/stop/close) behind a globalThis.__mz*Override hook read at call time — mirrors haptics.js/nativeChrome.js's guarded-import posture but for a stateful device object instead of a bare module import."
    - "FIFO voice pool with hard cap + oldest-evicted: push on start, while length > cap shift-and-stop the oldest — bounded resource under burst load without refusing new requests."
    - "Fire-and-forget parallel decode at unlock, never awaited by the caller: 30 backend.load() calls kicked off and left to land asynchronously into a Map cache, so a clip fired before its own decode completes is dropped (never queued) by design."
    - "Per-test module-state reset via an explicit OFF->ON settings round-trip (not just calling applySfxSettings once) — needed because the applied side effect only fires on a state TRANSITION, and the reset must force that transition regardless of what state the previous test left behind."

key-files:
  created:
    - test/unit/sfx.test.js
  modified:
    - src/browser/sfx.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md

key-decisions:
  - "Wrote start()/stop()/close() as synchronous functions (not async) even though open()/load() are async, matching the real Web Audio API's synchronous AudioBufferSourceNode/GainNode/AudioContext lifecycle calls; callers never need to await them."
  - "Used two literal `new window.(webkit)AudioContext()` construction sites (standard + prefixed fallback) inside DEFAULT_BACKEND.open() rather than a single generic constructor variable, satisfying the plan's exact acceptance-criteria grep bound (at most 2 occurrences, both inside open()) while keeping the fallback real rather than gamed to zero."
  - "In test/unit/sfx.test.js, avoided hardcoding which multi-clip sample (e.g. hit1 vs hit2) a test expects first: sfx.js's defaultVariation counter is module-level shared state across every test in the file (all tests import the same module instance), so a hardcoded absolute index would be order-dependent on every other test that also resolves the same group. Tests instead assert RELATIVE rotation (two consecutive picks differ) or use single-clip groups (stable regardless of call history) wherever a literal clip id needed to be pinned exactly, e.g. the decode-in-flight test uses \"spell\" instead of \"hit1\"."

requirements-completed: [AUD-04]

coverage:
  - id: D1
    description: "src/browser/sfx.js exports VOICE_CAP(8)/unlockSfx()/applySfxSettings()/playForDispatch()/playUiTap()/stopAllSfx() over an injectable five-method Web Audio backend; all 30 clips decode once at unlock, in parallel, off the critical path"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: unlockSfx() with sound on calls open() once and issues exactly 30 load() calls"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: unlockSfx() is idempotent — three calls still yield exactly one open()"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: unlockSfx() throws nothing when open() resolves null, leaves plays silent, and a later call retries open()"
        status: pass
    human_judgment: false
  - id: D2
    description: "Simultaneous events overlap via a fresh source per play; the voice pool is bounded at 8 with oldest-evicted, never refusing a new voice or throwing"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE cap boundary — the 9th voice stops the oldest; 12 total leaves 4 stopped and 8 live"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: TEETH — the cap-boundary assertion actually distinguishes a capped pool from an uncapped one"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dispatch-path edges: empty/unmapped dispatches touch no state, mapped events start voices in array order (never alphabetised), and duplicate events within one dispatch collapse while the same event across dispatches rotates samples"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE empty — a dispatch carrying zero/unmapped/null events starts zero voices and touches no state"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE ordering — a multi-event dispatch starts voices in event-array order, never alphabetised"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE adjacency — two identical events in one dispatch start a single voice; the same event across dispatches rotates"
        status: pass
    human_judgment: false
  - id: D4
    description: "A clip still decoding or missing/undecodable degrades to silence for that one clip only, is dropped rather than queued or replayed, and never crashes the play path"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE decode-in-flight — a clip still decoding is dropped, not queued, and never played once it belatedly resolves"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: EDGE missing asset — a clip whose load() resolves null is silently skipped while the rest still start"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Sound setting gates at the module boundary: OFF stops all in-flight voices immediately and tears the device down; ON before any gesture stays silent-but-errorless until the next unlockSfx()"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/sfx.test.js#sfx: applySfxSettings OFF stops in-flight voices immediately and tears the device down; ON before a gesture stays silent"
        status: pass
    human_judgment: false
  - id: D6
    description: "__mzSfxBackendOverride is registered in the bridge registry (set-equality + doc-sync) as the one new __mz* name this phase adds"
    requirement: "AUD-04"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10 passing, including doc-sync)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On a real Pixel 7, a clip fires with no audible lag on the action that caused it, and simultaneous events overlap instead of cutting each other off"
    verification: []
    human_judgment: true
    rationale: "Device-audible latency/overlap cannot be proven by a Node unit test against a fake backend — deferred per the standing deferred-UAT protocol to the Phase 60 batched Pixel 7 checklist."

duration: 15min
completed: 2026-09-22
status: complete
---

# Phase 56 Plan 03: Sound Effects & Audio Settings — Web Audio Backend Summary

**`src/browser/sfx.js`'s injectable Web Audio backend: all 30 clips decode once at unlock in parallel, an 8-voice FIFO pool overlaps simultaneous events with oldest-evicted eviction, and a still-decoding or missing clip degrades to silence without ever throwing — pinned by 16 new tests driven through a fake backend.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-22T09:59:00-04:00
- **Completed:** 2026-09-22T10:13:32-04:00
- **Tasks:** 3
- **Files modified:** 3 (1 new)

## Accomplishments
- `src/browser/sfx.js` gained its audio half: a five-method backend interface (`open`/`load`/`start`/`stop`/`close`) documented as the whole surface a fake needs; `DEFAULT_BACKEND` implementing it over real Web Audio (standard `AudioContext` constructor with a `webkitAudioContext` fallback, same-origin relative `./sfx/<clipId>.mp3` fetch + `decodeAudioData`, a fresh `AudioBufferSourceNode` per play through a shared master gain node, no lead-in/lookahead); and `resolveBackend()` reading `globalThis.__mzSfxBackendOverride` at call time.
- `VOICE_CAP` (8), `unlockSfx()`, `playForDispatch()`, `playUiTap()`, `stopAllSfx()`, and `applySfxSettings()` exported. `unlockSfx()` bails when Sound is off, is idempotent across repeat calls and safe to retry after a `null` `open()`, and kicks all 30 `load()` calls in parallel without awaiting them — decode stays off the critical path. `playClips()` (internal) drops a still-decoding or missing clip rather than queuing it, and evicts the oldest voice once the FIFO exceeds `VOICE_CAP`. `applySfxSettings()` stops every in-flight voice and tears the device down immediately on a Sound-off transition, and deliberately does NOT reopen anything on a Sound-on transition — the next gesture-driven `unlockSfx()` does that.
- `__mzSfxBackendOverride` registered in `src/browser/bridge.js`'s `BRIDGE` map (alphabetical position, owner `src/browser/sfx.js`) and the header's injection-hook paragraph updated from three names to four; `docs/SHELL-MODULES.md`'s bridge table regenerated via `node tools/bridge-doc.mjs --write` (46 rows, up from 45).
- `test/unit/sfx.test.js` created: 16 tests via a `makeFakeBackend()` helper (load() resolves the clip id itself as the "buffer" so `calls.starts` is a readable ordered clip-id list; `start()` returns an incrementing voice token so eviction order is checkable by identity) and a `withFakeBackend()` wrapper that fully resets sfx.js's module state (an explicit OFF->ON settings round-trip) in a `finally`. Covers unlock/idempotency/retry, all four AUD-04 edges (empty/ordering/adjacency/cap-boundary), decode-in-flight and missing-asset degradation, `playUiTap`/`stopAllSfx`, the Sound toggle boundary, never-throws under a fully-throwing backend and garbage arguments, and a teeth case.
- Verified end-to-end: `node --test test/unit/sfx.test.js` -> 16/16 pass; `node --test test/unit/bridge-registry.test.js` -> 10/10 pass (set-equality + doc-sync); `npm test` -> 3518/3518 pass (up from 3502); `npm run build:www` exits 0; `git diff --stat 6278968..HEAD -- engine/ content/ test/parity/` empty; `git hash-object test/parity/prototype-master.js.txt` still `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`; `grep -rn "Math.random" src/browser/sfx.js` returns nothing; the VOICE_CAP teeth check (temporarily raised to 99) fails 3 tests as expected, then restored clean with zero net diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the injectable backend and the bounded Web Audio player to src/browser/sfx.js** - `5fe3cd8` (feat)
2. **Task 2: Register __mzSfxBackendOverride in the bridge map and regenerate the module doc** - `031d72d` (feat)
3. **Task 3: Drive the player through a fake backend in test/unit/sfx.test.js** - `978d1f2` (test)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/browser/sfx.js` - extended with the Web Audio backend, injectable via `__mzSfxBackendOverride`, and the exported player surface (`VOICE_CAP`, `unlockSfx`, `playForDispatch`, `playUiTap`, `stopAllSfx`, `applySfxSettings`); the pure section from plan 02 is untouched
- `src/browser/bridge.js` - one new `BRIDGE` entry (`__mzSfxBackendOverride`) plus the header's injection-hook count updated to four
- `docs/SHELL-MODULES.md` - bridge table regenerated (46 rows)
- `test/unit/sfx.test.js` - new: 16 tests pinning the player's behaviour and every AUD-04 edge through an injected fake backend

## Decisions Made
- `start()`/`stop()`/`close()` are synchronous (matching the real synchronous Web Audio node lifecycle), while `open()`/`load()` stay async — `playClips()` calls `backend.start()` directly without awaiting.
- The two `new window.(webkit)AudioContext()` construction sites sit only inside `DEFAULT_BACKEND.open()`, satisfying the plan's exact grep bound while keeping both the standard path and the prefixed fallback real (not collapsed into a variable to dodge the grep).
- `test/unit/sfx.test.js` deliberately avoids hardcoding which sample of a multi-clip group (e.g. `hit1` vs `hit2`) comes first, since `sfx.js`'s `defaultVariation` counter is shared module state across every test in the file; tests assert relative rotation or use single-clip groups (stable regardless of call history) instead.

## Deviations from Plan

None - plan executed exactly as written. The one design choice not fully spelled out in the plan (exact grep-safe `AudioContext` construction shape, and the cross-test variation-state isolation strategy in the test file) are documented above as decisions, not deviations — they were left to "Claude's Discretion" per 56-CONTEXT.md ("Module shape... and how it registers on the bridge registry", "Whether the voice cap is a hard 8 or a tuned number").

## Issues Encountered

While drafting `test/unit/sfx.test.js`, the first pass hardcoded `hit1`/`hit2` as the expected first/second sample in the adjacency and decode-in-flight tests. Running the suite showed 2 failures: `sfx.js`'s `defaultVariation` round-robin counter (from plan 56-02) is module-level state shared across every `test()` in the file (all tests import the same module instance), so an earlier test that also resolved a "struck" event had already advanced the "hit" group's counter, shifting which sample the later test observed first. Fixed by (a) changing the null-retry test's probe event from `struck` to `trapSprung` so it never touches the "hit" counter, (b) rewriting the adjacency test to assert relative rotation (two consecutive picks differ) instead of hardcoding literal sample names, and (c) rewriting the decode-in-flight test to use the single-clip "spell" group instead of "hit1", which is stable regardless of any other test's call history. No changes to `src/browser/sfx.js` were needed — this was purely a test-authoring correction, verified by re-running the full file to 16/16 green before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/browser/sfx.js` now exports the complete mechanism plan 56-04 needs to wire: `unlockSfx()` (first-gesture listener), `applySfxSettings()` (Settings sheet apply), `playForDispatch()` (the `dispatchWithNarration()` seam), and `playUiTap()` (delegated UI tap handler). None of it is referenced by `mazeworld.html` yet, per this plan's explicit scope boundary — that wiring, plus `test/unit/sfx-settings.test.js` (already referenced as a consumer in the `__mzSfxBackendOverride` bridge entry), is 56-04's job.
- `test/unit/sfx-settings.test.js` does not exist yet; it is listed as a bridge consumer per the plan's explicit instruction, in anticipation of 56-04 creating it.
- Real-device confirmation (no audible lag, true overlap) is deferred per the standing protocol to the Phase 60 batched Pixel 7 UAT checklist — recorded as `human_verification` item D7 in this SUMMARY's `coverage` block.

---
*Phase: 56-sound-effects-audio-settings*
*Completed: 2026-09-22*
