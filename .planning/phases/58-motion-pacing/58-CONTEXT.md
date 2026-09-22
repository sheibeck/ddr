# Phase 58: Motion & Pacing - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 16 decisions across 4 areas, all accepted as recommended

<domain>
## Phase Boundary

Screens move instead of snapping. Four effects, all shell-side presentation on top of an engine that already resolves everything: the **map camera pans** instead of jumping (MOTION-01); **panels, sheets, the ☰ menu, the encounter overlay, the rail and tab switches** open and close with motion (MOTION-02); a **combat round plays out as a readable beat** — the shell reveals the already-resolved round one exchange at a time (MOTION-03); **rail, encounter and fight-log text types itself on**, fast (MOTION-04); and a **reduced-motion path** resolves every one of these instantly with nothing lost (MOTION-05).

Phase 57 made this possible and deliberately added none of it: the rail is a transform/visibility overlay inside `#mw-stage` (57-02, `data-shown`), rail holds are doubled + line-scaled (57-03, `holdForCard`), and plan 57-05 turns the chip strip into a ☰ dropdown built on a data-state model so it can be animated here. The source of the whole cluster is backlog 999.1 (the user, 2026-09-19): transitions "not jarring and immediate", fight responses slowed "so there are transitions between exchanges and the player can process each one", text "as if quickly typed out (fast, not slow)".

**Out of scope:** the party marker gliding between squares and its idle/step frames (Phase 59, ANIM-01..03 — including dialling back the ring); any engine change — the beat never changes what the engine resolves or when, only when the shell *shows* it; any new art or sound.

</domain>

<decisions>
## Implementation Decisions

### Map pan (MOTION-01)
- **Camera-only easing.** The keep-in-view nudge (`keepPartyInView` → `positionCanvas`) and the CENTRE action glide instead of jumping. The party marker's own movement between squares is Phase 59's step cycle, not this phase.
- **Drag and pinch stay 1:1** under the finger, never eased; a pointer-down cancels any in-flight eased pan immediately (the finger wins).
- **Stairs, teleport and a new run snap** — a new floor has no meaningful path to pan along. `mzCenterMap` on `floorChanged`/`teleported`/new run stays instant.
- **~200 ms ease-out**, retargetable mid-flight (a new nudge re-aims from wherever the map currently is — rapid tap-to-move never stutters or queues). Compositor-friendly (transform-based) so it stays cheap on the Pixel 7; the party pulse ring (`positionPartyPulse`) moves in lockstep with the canvas. The stationary-camera ruling (Phase 35 / 260918-vm3) is unchanged — this changes *how* the camera moves, never *when*.

### Panels, sheets & tabs (MOTION-02)
- **Surfaces:** the rail (slide up/down — 57-02's transform model), the sheets (MARKS legend, Settings, camp), the ☰ menu (57-05), the encounter overlay, and tab switches.
- **Style:** rail and sheets slide up from the bottom; the ☰ menu drops with the mock's small rise (`mwrise`-style, `design/Mazeworld Map.dc.html`); tab screens do a quick cross-fade — never a horizontal slide, so the map never looks like it is scrolling.
- **Timing:** open ~180 ms ease-out, close ~120 ms ease-in (closing faster reads as responsive).
- **Animated closes via one shared helper** — a `src/browser/motion.js` module that sets `hidden` only after the close transition ends, with a timeout fallback so nothing can be stranded invisible or stuck visible. The `hidden` attribute is still the accessibility truth (the 57-02 ruling: kept for assistive tech and the existing showTab/renderEncounter predicates).

### Combat beat (MOTION-03)
- **The engine resolves the round at once; the shell reveals it one exchange at a time.** The round's fight-log lines are staggered, and each foe card's HP bar / strike pop updates together with the line that caused it where the event carries the numbers. No engine change, no rng, no fixture moves — pure reveal sequencing over events already in hand.
- **Beat:** the first exchange lands immediately, then ~600 ms between exchanges.
- **Tap to hurry:** a tap during a beat flushes the rest of the round instantly. The action buttons arm only when the last line has landed (reuse the existing arm/settle guard family — `isArmed`, `armEncounterButtons`), so a player can never queue an action blind. Nothing is lost by hurrying.
- **Sound fires with its line.** Phase 56's single fire-and-forget `playForDispatch` call in `dispatchWithNarration` moves into the beat's reveal so each clip plays when its exchange appears; otherwise the audio gives away the outcome before the text does. The Phase 56 contract (Sound Off opens no audio device; clip variation; family cry on `combatJoined`) is preserved and its tests re-pinned, not loosened. Out-of-combat actions keep playing at dispatch time.

### Typed text & reduced motion (MOTION-04/05)
- **Speed:** ~12 ms per character with a ~700 ms cap per block (long cards speed up rather than drag); a tap on the text completes it instantly.
- **What types:** rail cards, the encounter-overlay text, and fight-log lines as the combat beat reveals them. The Oracle history, HUD numbers and buttons never type.
- **The rail hold clock starts after typing finishes** — 57-03's line-scaled `holdForCard` is reading time, not typing time.
- **Accessibility gate:** `#mw-rail-live` (and any encounter/fight-log announcer) receives the complete text at once, regardless of typing; the visibly-typing element is `aria-hidden` while it types.
- **Reduced motion = the OS preference only** (`prefers-reduced-motion: reduce`, read live via `matchMedia`, including changes mid-session). Every effect resolves instantly to its end state: no typing, no pan easing, no panel motion, no combat beat (the whole round lands at once, buttons arm immediately). The existing blanket CSS rule (`mazeworld.html` ~L847, transitions/animations off) covers CSS; every JS-timed effect (typing, beat, pan tween, close-after-transition) needs its own check through one shared predicate. No in-app toggle.

### Claude's Discretion
- Module boundaries (one `motion.js` vs separate `typewriter.js` / `combatBeat.js` / `cameraTween.js`), as long as each lands in `src/browser/` behind the one `window.__mz*` bridge registry (BRIDGE row + `tools/bridge-doc.mjs --write` in the same commit) and none of it grows `paint()`/`draw()` bodies.
- Exact easing curves within the stated durations, and whether the pan tween is CSS-transition- or rAF-driven, as long as it is retargetable and drag/pinch-cancellable.
- How the beat derives per-exchange HP from events (only where the event payload carries it; otherwise the bar settles when the round's last line lands).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mazeworld.html` `positionCanvas()` (~L1922) sets `cv.style.left/top` from `cam` and calls `positionPartyPulse(rect)`; `keepPartyInView()` (~L4008) is the one non-centring nudge; `centerMap()` (~L3984) / `window.mzCenterMap` the centring path. `src/browser/controls.js` has `keepInViewAxis` and `cameraPan()` — pure, no easing.
- `dispatchWithNarration(action)` (~L4978) is the per-action seam: engine `dispatch`, then `playForDispatch(action.type, result.events, audioCtx)` (Phase 56), then `fightLogLinesFor` → `appendFightLog` (in combat) or `railCardFor` → `railPush` → `renderRail()` (out of combat).
- `src/browser/fightLog.js` — `fightLogLinesFor`, `appendFightLog(log, lines, round)`, `fightLogRows`, `fightLogAnnouncement`; `renderFightLog(host)` (~L2881) renders rows; the combat body re-renders via `renderEncounter()` (~L3356).
- `src/browser/inputGuards.js` — `ARM_DELAY_MS`, `DISMISS_SETTLE_MS`, `isArmed`, `isSettled`; `armEncounterButtons()` (~L2789) stamps `encRenderedAt`.
- `src/browser/rail.js` — `RAIL_HOLD`, `holdForCard`, `railDismissKind` (57-03); `renderRail()` writes `hidden` + `data-shown` from one predicate (57-02); `syncRailLive` feeds `#mw-rail-live`.
- Existing keyframes: `mwrise` (~L1097), `mwStrikePop` (~L499), `mwRoundTick` (~L517), `mwpulse`; `.mw-rail.mw-rail-new` re-trigger class.

### Established Patterns
- Modular shell (v1.6): new surfaces are `src/browser/` modules with pure view-models + a thin shell call site; every `window.__mz*` goes through `src/browser/bridge.js` (set-equality + doc-sync tests).
- Presentation gate: `engine/`/`content/` byte-identical, zero fixture moves, no engine rng; any shell randomness from a derived stream (none needed here).
- Stationary camera: the camera moves only on drag / nudge / CENTRE / stairs / teleport / new run.
- `hidden` stays the assistive-tech truth; visual state is a data-attribute/transform model (57-02 precedent).
- Tests are source-assertion + sandbox (`test/unit/harness/shellSandbox.js`); re-pin, never delete; teeth checks reverted with `git checkout`.

### Integration Points
- Camera: `positionCanvas`, `positionPartyPulse`, the pointer pipeline (drag/pinch must cancel the tween).
- Panels: `showTab` (~L1767), the legend/settings/camp sheets (`hidden` toggles ~L3943-3978, ~L4626), `renderEncounter`'s `#enc-panel`, the rail (`renderRail`), the ☰ menu from 57-05.
- Beat: `dispatchWithNarration` (combat branch), `renderFightLog`, foe-card HP rendering in the combat body, `armEncounterButtons`, the Phase 56 audio call.
- Typing: `renderRail` card body, the encounter overlay text, fight-log rows; announcers `#mw-rail-live` + the fight-log announcement path.

</code_context>

<specifics>
## Specific Ideas

- The user's words (999.1, 2026-09-19): transitions should be "not jarring and immediate"; "Slow the fight responses down so there are transitions between exchanges and the player can process each one"; "Animate on-screen text as if quickly typed out (fast, not slow)."
- Phase 56 left a pointer here: "note whether any fight resolves too fast for its own audio to read — evidence for Phase 58's pacing decision" — resolved by firing each clip with its exchange's line.
- The ☰ menu's drop animation should match the mock's `mwrise .16s` feel (`design/Mazeworld Map.dc.html`).

</specifics>

<deferred>
## Deferred Ideas

- Party marker glide + idle/step frames + ring dial-back — Phase 59 (ANIM-01..03).
- An in-app "Reduce motion" setting — declined for now (OS preference only).
- Momentum/fling on drag release — declined (drag stays strictly 1:1).
- Haptics on beat exchanges — already on the Future Requirements list.

</deferred>
