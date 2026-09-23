---
phase: 56-sound-effects-audio-settings
verified: 2026-09-22T15:20:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD a9491dd); device checks deferred to the Phase 60 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "AUD-04 latency (Pixel 7): take a step, strike, and open a chest — each clip fires on the action that caused it with no perceptible lag"
  - "AUD-04 overlap (Pixel 7): land a killing blow that also levels you up — the hit, the foe-die and the level-up clips overlap rather than cutting each other off"
  - "AUD-06 airplane mode (Pixel 7): install fresh, enable airplane mode, launch for the first time — every clip still plays, nothing is fetched"
  - "AUD-05 persistence (Pixel 7): set Sound to Off, force-quit, relaunch — the app is still silent and the Settings row still reads Off"
  - "AUD-02 family cries (Pixel 7): start fights against a Beast, a Demon, a Human, a Lair Beast, a Magical and a Walking Dead foe — each opens with the ruled cry, and the two shares (Lair Beasts on human, Magical on demon) sound deliberate rather than wrong"
  - "MOTION-03 evidence for Phase 58 (Pixel 7): note whether any fight resolves too fast for its own audio to read — evidence for Phase 58's pacing decision, NOT licence to add timing in this phase"
gaps: []
---

# Phase 56 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

Goal-backward check of the phase goal: *every mapped action and fight opener makes a distinct, correctly-timed sound, repeats vary instead of looping one sample, and the player has one working On/Off switch over all of it.*

Four plans across three waves, executed sequentially on the main working tree (`worktree base-check` returned `shouldDegrade: true`, reason `fork-ref-unknown`, so the wave-1 parallelism the roadmap assumed did not apply). 56-01 added `copySfx()` and the asset manifest. 56-02 wrote the pure mapping core. 56-03 appended the Web Audio backend and the bridge registration. 56-04 wired four call sites in `mazeworld.html` and closed the AUD-05 gate. **Human verification is deferred** to the Phase 60 batched device session (list in frontmatter), per the standing deferred-UAT protocol.

## Evidence (orchestrator re-run at HEAD `a9491dd`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | A distinct, correct sound for every mapped action — walk (stone/water), strike, miss, take a hit, kill, cast, resist, heal, drink, chest, gold, trap, leap, stairs, level-up, death, UI tap | `EVENT_CLIP_GROUP` maps 26 engine event types across 18 `CLIP_GROUPS`; the step clip is synthesized from `action.type === "move"` plus a shell-computed `ctx.stepped`, because **there is no `moved`/`stepped` engine event** — `waded` is deliberately excluded from the event map so one step never makes two sounds, with `STEP_SUPPRESSING_EVENTS` covering leap/climb/fly/phase/teleport. Pinned by `test/unit/sfx-map.test.js` |
| 2 | A fight's opening beat plays the matching monster-family cry, all six BESTIARY families resolving onto four cries | **Orchestrator-verified directly against the built module**, not the report: `FAMILY_CRY` reads exactly `{Beasts: enemy-beast, Demons: enemy-demon, Humans: enemy-human, "Lair Beasts": enemy-human, Magical: enemy-demon, "Walking Dead": enemy-undead}` — the 2026-09-22 user ruling verbatim, with its two deliberate shares. The cry resolves off `result.state.combat.type` threaded in as `ctx.combatType` (falling back to pre-dispatch combat), fired on `combatJoined` — the Fight! press, not the uncommitted preview. Totality is pinned against `content/bestiary.js`'s live keys, so a seventh family or a stale key fails the test |
| 3 | Repeated actions rotate through their clips instead of replaying one sample | Shuffle-bag round-robin off a module counter. **`grep -c "Math.random" src/browser/sfx.js` = 0** (orchestrator re-run) — variation adds no rng of any kind, which is what keeps this phase clear of the determinism gate. Degenerate groups handled: size 1 attempts no no-repeat guarantee and does not throw; size 2 strictly alternates; size 3 never repeats back-to-back |
| 4 | A clip fires with no audible lag and simultaneous events overlap rather than cutting each other off | Structure verified: all 30 clips fetch and `decodeAudioData` once at unlock, in parallel, off the critical path; a fresh `AudioBufferSourceNode` per play gives real overlap; `VOICE_CAP` 8 stops the oldest rather than throwing; a clip requested while still decoding is **dropped, not queued** (both pinned by `test/unit/sfx.test.js` through the injected fake backend, with a teeth check — raising `VOICE_CAP` to 99 failed 3 tests). Real-device latency and overlap are inherently device-only → `human_verification` |
| 5 | Sound Off silences everything and opens no audio device; the choice survives a restart; first launch in airplane mode plays every clip with nothing fetched | **Orchestrator-verified structurally, because the plan's own proof was a proxy.** 56-03's test showed the module does not call *its own backend* when Sound is off — which is not the same claim. Re-run directly: `grep -n "AudioContext" mazeworld.html` returns **zero matches**; the only two construction sites in the entire codebase are `src/browser/sfx.js:299` and `:301`, both inside `DEFAULT_BACKEND.open()`; and `soundIsOff()` is the **first statement** of `unlockSfx()`, ahead of `resolveBackend()` and `backend.open()`. So no path through the shell's four entry points can reach an audio device with Sound off. `test/unit/sfx-settings.test.js` (14 tests) additionally pins stop-then-close ordering on a mid-playback flip to Off, the On-before-gesture silent state, and a clean re-open on the next gesture. Persistence across a real relaunch and airplane-mode first launch → `human_verification` |
| — | `npm test` fail 0; `build:www`; gates | **3532 / 0** (3479 at phase start: +5 plan 01, +18 plan 02, +16 plan 03, +14 plan 04 — orchestrator re-run). `npm run build:www` exit 0, `www/sfx/` holds 30 `.mp3`. `git diff --stat 6278968..HEAD -- engine/ content/ test/parity/` **empty**; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `package.json`/`package-lock.json` untouched (offline gate); `bridge-registry.test.js` 10/10 including doc-sync |

## Notes the reader should have

- **The user ruling that shaped this phase.** Mid-planning the user fixed the family→cry map and then deleted `sfx/enemy-batrat.mp3` outright (2026-09-22). That removed the "30 mapped + 1 recorded-unused" apparatus the plans were originally written around: the map/asset check is now a clean set-equality in both directions (verified live — 30 ids, 30 reachable, zero unreachable, zero phantom), and there is deliberately **no per-creature override layer** in front of the family map, recorded in a comment above `FAMILY_CRY`. The deleted clip is recoverable from `961923b`.

- **A shared-counter smell worth watching.** `sfx.js`'s variation counter is module-level state shared across every consumer. 56-03's tests originally hardcoded `hit1`/`hit2` and broke when an earlier test advanced the shared counter; the executor fixed the *tests* (asserting relative rotation, and using single-clip groups where an exact id was needed) rather than the module, which is legitimate under CONTEXT's "Claude's Discretion" on module shape. But the underlying property — one mutable counter for the whole module — is the thing to look at first if variation ever misbehaves on device.

- **Grep-shaped acceptance criteria misfired three times in this phase.** Plans 01 and 02 each burned a self-correction commit because comment *prose* naming a forbidden identifier tripped a bare literal `grep` while the code was clean; plan 04 found that `grep -c "hapticForEvents(events)" mazeworld.html` returns 3 rather than the criterion's stated 2, because the function's own declaration line matches the same substring (pre-existing, confirmed against the pre-plan commit; a semicolon-anchored regex confirms exactly 2 real call sites, unchanged). **Carry into Phases 57–60:** acceptance criteria that count occurrences must be anchored (declaration vs. call site) or scoped to stripped source, not bare substring counts. The invariant each of these was trying to express held in every case; the checks were simply measuring English as well as code.

- **Plan-prose arithmetic slip, corrected in the test.** 56-04's plan narrative predicted a second unlock would show `load()` count 62; with 30 clips two full unlocks decode 60. No acceptance criterion pinned the literal, and the test asserts 60. Plan prose, not a code defect.

- **`mazeworld.html` wiring is four call sites and nothing else** — an ES-module import, `applySfxSettings(settings)` inside `applySettings`, one fire-and-forget `playForDispatch(...)` in `dispatchWithNarration`, and one capture-phase `document` `pointerdown` that both unlocks and plays `ui-tap` for button targets (the map `<canvas>` never matches, so a tap-to-move never double-sounds). `dispatchWithNarration`'s return value and its callers' render tails are unchanged; no new hunk inside `paint()`/`draw()`.

- **No evidence gathered either way on MOTION-03.** Whether combat resolves too fast for its own audio to read is Phase 58's question; this phase deliberately added no timing. Recorded as an open question for Phase 58's device pass rather than as evidence.

## Requirements

| Requirement | Plan | Status |
|---|---|---|
| AUD-01 | 56-02 | satisfied |
| AUD-02 | 56-02 | satisfied (under the 2026-09-22 ruling; requirement text corrected from its stale five-clip wording) |
| AUD-03 | 56-02 | satisfied |
| AUD-04 | 56-03 | satisfied on structure; device confirmation deferred to Phase 60 |
| AUD-05 | 56-04 | satisfied — orchestrator re-verified the "no audio device" claim structurally, not via the module's own backend proxy |
| AUD-06 | 56-01 | satisfied on build evidence; airplane-mode first launch deferred to Phase 60 |
