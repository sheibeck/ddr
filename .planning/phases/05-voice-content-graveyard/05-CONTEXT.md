# Phase 5: Voice, Content & Graveyard - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** mvp — autonomous run. The voice SYSTEM + safety QA are fully buildable/testable now; "is it actually funny / on-brand" is a human UAT item (tone quality). Depends on Phase 1 engine events + Phase 2 persistence (both done).

<domain>
## Phase Boundary

Build the game's core comedic identity as a **data-driven voice system**: structured engine events (death cause, class/race, depth, item, encounter type) → sarcastic, dark-but-family-friendly copy (death epitaphs, Oracle/event-log lines, item flavor), replacing scattered hardcoded per-scenario strings. Plus a batch-generation **safety QA** pass (no profanity/gore/slurs across the procedural combinations) and a **graveyard/run-history screen** showing past adventurers, how they died, and their epitaphs, persisted across restarts. Requirements VOX-01, VOX-02, VOX-03.

IN SCOPE:
- A pure, data-driven **voice generator** keyed to structured events (consumes the engine's Event objects + character/run context) producing copy. Build ON the existing `content/epitaphs.js`, `content/flavor.js`, `content/names.js`; expand into a coherent event→copy system with a documented tone/style guide.
- Wire the generator into the browser presentation's Oracle/event log + item flavor + death epitaphs (replacing hardcoded strings) for the engine-routed domains; combat/economy narration fully lands when Phase 4 routes those domains — build the generator to cover ALL event types now regardless.
- **VOX-02 safety QA:** an automated batch generator that enumerates a large sample of event→copy combinations, plus a `node:test` safety scan (profanity/gore/slur/adult-content wordlist + rules) asserting the corpus stays family-friendly. Emit a reviewable sample artifact for the human tone check.
- **VOX-03 graveyard/run-history screen:** wire the existing prototype graveyard panel to the engine's persisted graveyard (via Phase 2 `window.mzStorage` → native Preferences), showing each fallen adventurer (name/class/race, cause of death, depth reached, epitaph). Persists across app restarts (already durable via Phase 2).

OUT OF SCOPE:
- Polished MOBILE UI for the graveyard/log (typography, touch, layout) — Phase 4. Here: functional wiring on the existing prototype panel.
- Routing all game domains through the engine in the live page + completing formatEvents narration integration into the mobile UI — Phase 4 (this phase supplies the voice DATA/generator Phase 4 wires in).
- Illustrated art / voiced audio — not in v1.
- New gameplay/content beyond flavor text — no balance/mechanics changes.
</domain>

<decisions>
## Implementation Decisions

### Voice generator (VOX-01)
- A PURE module (e.g. `content/voice.js` / `src/voice/…`) exposing something like `narrate(event, ctx) → string` and `epitaphFor(deathCtx) → string`, seeded/deterministic where randomness is used (reuse the engine RNG or an injected rng so log lines are reproducible in a seeded run — matches Phase 1 determinism ethos; the parity/round-trip suites must stay green).
- Keyed on structured fields: death `cause`, `class`, `subclass`, `race`, `depth`, item name/kind, encounter type, event type. Data tables map (key combinations) → weighted copy variants. Build on the existing `content/epitaphs.js` (~15 causes) + `content/flavor.js`; expand coverage to the engine's full event-type set (~26 types from `engine/events.js`).
- The engine stays UI-free and emits STRUCTURED events (unchanged); the voice system lives in the PRESENTATION/content layer and turns events → prose (it is the "one place structured Events become sarcastic narrative copy" from the architecture). No DOM inside the generator (pure string-returning); the browser adapter/`formatEvents` calls it.

### Tone & safety (VOX-02)
- **Tone:** heavy sarcasm, dark humor, deadpan, self-aware, pokes fun at fantasy-RPG tropes and the player's doomed characters — but **family-friendly**: NO profanity, NO gore/graphic violence, NO sexual/adult content, NO slurs. Darkness is in the wit, not shock. Document this as a tone/style guide in the phase (drives both authored variants and the safety scan).
- **Safety QA:** an automated batch generator enumerates a large representative sample of event→copy combinations; a `node:test` safety scan asserts NONE contain banned terms (a maintained profanity/gore/slur/adult wordlist + simple rules). This catches the "procedural combinatorics produce something inappropriate" risk PITFALLS.md flagged. Write the sample corpus to a reviewable artifact for the human tone/funny check (deferred UAT).

### Graveyard/run-history (VOX-03)
- Data source: the engine's death/graveyard system (`engine/death.js` bury/tombstone — now recording ALL death causes per the Phase 3 fix) persisted via Phase 2 `window.mzStorage` (`mazeworld.graveyard.v1`, native Preferences). No new persistence work — reuse it.
- Screen: wire the existing prototype graveyard panel to show past adventurers (name, class/race, cause, depth, epitaph from the voice system). It's openable and persists across restarts. Keep it functional; Phase 4 polishes the mobile presentation.

### Claude's Discretion
- Exact module layout/API of the voice generator, the weighting/variant scheme, the wordlist source, and how the graveyard panel is surfaced in the existing prototype UI.
</decisions>

<code_context>
## Existing Code Insights
- `content/epitaphs.js` — ~15 death-cause epitaph banks (~90 lines) already extracted (Phase 1). `content/flavor.js`, `content/names.js` — more flavor data. Foundation to build the generator on.
- `engine/events.js` — the ~26 structured Event types the generator narrates. `engine/death.js` — `die`/`bury`/`epitaphFor`/`epitaphCtx` (epitaph currently built here; the voice system can supply/expand the copy while death.js stays engine-pure — decide the seam so the engine emits a structured death event and the presentation voice-generates the prose).
- `src/browser/engineAdapter.js` + `mazeworld.html` — the Oracle log + item flavor + death card in the browser; currently narrate a subset of events (`formatEvents`). Phase 5 expands the voice coverage; Phase 4 completes the mobile-UI integration + full-domain routing.
- Graveyard persistence: `window.mzStorage` (Phase 2), key `mazeworld.graveyard.v1`, durable native Preferences. Already restart-safe.
- Determinism: seeded runs must stay reproducible — if the voice generator uses randomness for variant selection, inject the run's rng so parity/round-trip suites stay green (or keep log copy out of the parity-compared GameState).

## Reference
- `.planning/PROJECT.md` (Tone & voice section — the identity spec), `.planning/research/FEATURES.md` (voice system as differentiator + shareable run-summary as v2), `.planning/research/PITFALLS.md` (procedural-text combinatorics tone/rating risk).
</code_context>

<specifics>
## Specific Ideas
- The voice is a CORE differentiator (PROJECT.md), not decoration — invest in breadth of variants and consistent deadpan tone across death/log/item text.
- Keep the generator PURE and deterministic-friendly so it doesn't break Phase 1's parity/determinism guarantees. Log/flavor text is presentation; keep it out of the parity-compared engine state (or seed it) — do not regress the 372 green tests.
- The safety scan is a standing guardrail (like the round-trip test) — keep it green as content grows.
</specifics>

<deferred>
## Deferred Ideas
- Human tone/quality check ("is it actually funny and on-brand across a big sample?") — UAT, deferred to milestone end (the safety scan is automated; funny is human).
- Polished mobile presentation of the graveyard/log — Phase 4.
- Shareable run-summary card — v2 (META-02, anti-scope for v1).
- Full-domain engine routing + formatEvents mobile-UI integration — Phase 4.
</deferred>
