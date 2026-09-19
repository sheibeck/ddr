# Phase 46: Honest Names, Dead Exports & the Tutorial Decision - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Autonomous smart discuss — one short user round (2 areas, both accepted as recommended, 2026-09-19).

<domain>
## Phase Boundary

Every surviving module and export is named for what it does today, nothing unreachable stays exported, and `tutorial.js` has a recorded decision. Concretely: `src/browser/toasts.js` → `src/browser/narrationLines.js` with `TOAST_FOR → LINE_FOR`, `toastsForAction → linesForAction`, `dispatchWithToasts → dispatchWithNarration` (the shell-local function at `mazeworld.html` ~L5505) and the dead lifetime exports (`MAX_TOASTS`, `TOAST_BASE_MS`, `TOAST_PER_CHAR_MS`, `TOAST_CAP_MS`, `TOAST_STACK_BONUS_MS`, `toastLifetime()`) deleted, every import site/bridge/test pin following (35 importers: 5 `src/`, the shell, 28 tests, the voice scan); `winGame()`/`state.won` and their parity carve-out removed (RUN-04 made them unreachable) with `saveState.js` tolerant of a stale `won: true`; no surviving identifier in `src/`, `engine/`, `content/`, `tools/` or the shell named after a retired mechanism (toasts as UI, D-pad, `flightLeft`/`flightCooldown`, `c.ether`, `wornSlots`) — each rename its own commit with the zero-straggler grep; `tutorial.js` deleted with the decision recorded. Requirements NAME-01, NAME-02, DEAD-04, DEAD-05.

**Engine-gate fence for this phase:** the only `engine/` change is the `winGame`/`won` removal (`engine/movement.js:995-…` `winGame`, the four `state.won` guards at `movement.js:138/559/784` and `engine.js:119`, `saveState.js:644/749` serialize/validate); zero fixture moves; `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). `content/` untouched.

**Phase-start baseline (2026-09-19, HEAD `2afe0e5`):** 3,242 tests; shell 6,356 lines; `winGame|state.won|.won` ×61 lines across engine/src/shell/test/tools; `toast` ×57 non-comment identifier lines in src/engine/content/tools/shell; `dpad` ×3 (`settings.js:44,55` + a CSS comment); `flightLeft|flightCooldown` ×5 — all inside `saveState.js#foldLegacyCounters` (tolerant-load, allowed survivors); `c.ether` ×0; `wornSlots` ×0 case-sensitive (`window.__mzWornSlots` is the slot-list bridge, kept — see decisions).

</domain>

<decisions>
## Implementation Decisions

### The tutorial.js decision (DEAD-05) — user accepted 2026-09-19
- **Delete** `src/browser/tutorial.js` (98 lines: pure coach-mark sequencer + `mazeworld.tutorialSeen` flag; zero references), `test/unit/tutorial.test.js` (277 lines) and the `tutorial` comment in `src/browser/icons.js`. Rationale recorded: the module encodes the 04-era UI (fixed steps on a D-pad map; STATE already marks `04-10-PLAN.md` "re-plan, don't execute as-is"); UX-06 is rebuilt on the Phase 47 modular shell — the stated reason SHELL-01..03 exist.
- Record the decision in `PROJECT.md` Key Decisions and on the UX-06 row (REQUIREMENTS.md v2/backlog row + PROJECT.md Active row): "first-run tutorial rebuilt from scratch on the modular shell (Phase 46 deleted the 04-era sequencer)".
- **Nothing kept for the storage key:** `mazeworld.tutorialSeen` was never written by a shipped build (the overlay was never wired) — no migration, no legacy-key reservation, no tolerant read.

### Names (NAME-01 / NAME-02) — user accepted 2026-09-19
- Module name: **`src/browser/narrationLines.js`** (says what it holds — the per-event narration lines the rail and the fight log read; no collision with `eventNarration.js`, the event → Oracle-line table).
- Exports per NAME-01: `LINE_FOR`, `linesForAction`, `dispatchWithNarration` (the shell function; keep the `window.__mz*` bridge names it exposes honest too); delete `MAX_TOASTS`, `TOAST_BASE_MS`, `TOAST_PER_CHAR_MS`, `TOAST_CAP_MS`, `TOAST_STACK_BONUS_MS`, `toastLifetime()`. Other exports with "toast" in the name (`narrativeToastText`, `TONES`/`PRIORITY` comments, `CARD_EVENTS`, …) are renamed to their honest role (e.g. `narrativeLineText`) — NAME-02's grep is the gate, not the NAME-01 list alone. `eventNarration.js` re-exports (`TOAST_FOR`, `ORACLE_ONLY`, `FEATURE_EVENTS`, `toastsForAction`) follow.
- **`controlScheme` setting deleted** (`src/browser/settings.js:44` default `"dpad"`, `:55` allowed `["tap","dpad"]`; `test/unit/settings.test.js:49-107` pins): tap-to-move is the only movement surface (v1.4/v1.5); old persisted settings carrying the key load tolerantly and drop it; settings tests re-pinned. No UI change (no visible control for it exists).
- **`window.__mzWornSlots` kept** — it carries `WORN_SLOTS` (the slot taxonomy) to the Gear tab; it is the model's name, not the retired option's. Phase 47's SHELL-04 registry lists it.
- **Allowed survivors of the NAME-02 grep:** the tolerant-load reads of legacy save keys inside `engine/saveState.js#foldLegacyCounters` (`flightLeft`, `flightCooldown`, `ether`, `haste`, `invis`, `acute` — L517-524) and any equivalent legacy-key fold in `settings.js`/`storage.js`; the SUMMARY lists each survivor with its line and reason. Comments/docs are Phase 48's sweep, but a comment attached to a line this phase renames goes with it.

### DEAD-04 — `winGame` / `state.won`
- Remove `engine/movement.js#winGame` and the `state.won` reads/guards (`movement.js:138/559/784`, `engine.js:119`), the `won` field from `serializeRun`/`validateSave`/`rehydrate` (`saveState.js:644/749`), the classic-side `S.won` reads in the shell (`hasActiveDelveSave`, `renderRail`'s `S.won` term, the title/resume checks, `hadSaveAtLaunch`'s `!parsed.won`), the harness carve-out that strips `won`, and the shell/engine tests that pin it. A stale save carrying `won: true` still loads (tolerant — the key is dropped, not rejected); the `abandon` action's guard becomes `!next.dead`.
- The "gate"/"won" narration text and the `winGame` event type in `EVENT_NARRATION`/`LINE_FOR`: delete the entries (the event can no longer be emitted; the coverage guard must still pass — adjust the guard's expected set, never leave an unreachable entry).

### Commit discipline
- One rename per commit, each carrying its own `grep -rnE "<old name>" src/ engine/ content/ tools/ mazeworld.html test/` → 0 in the commit message/SUMMARY (NAME-02's "each rename is its own commit with the grep that proves zero stragglers"). Suite green at every commit; `git mv` for the module rename so history follows.

### Claude's Discretion
- Commit/plan slicing; whether the `eventNarration.js` re-exports are kept (renamed) or the 28 test importers switch to importing from `narrationLines.js` directly; the exact honest names for the secondary "toast" exports; how the settings tolerant-load is expressed.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/toasts.js` (≈1,000 lines): exports at L59 `TONES`, L66 `PRIORITY`, L69 `MAX_TOASTS`, L84 `CARD_EVENTS`, L94 `NARRATIVE_ACTIONS`, L106-109 `TOAST_*_MS`, L118 `toastLifetime`, L158 `narrativeToastText`, L177 `oracleDetailText`, L193 `ORACLE_ONLY`, L224 `FEATURE_EVENTS`, L383 `slotWord`, L931 `toastsForAction`, L969 `TOAST_FOR`. `src/browser/eventNarration.js` re-exports `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`toastsForAction` (one-directional, Phase 25-05). Coverage guards: `test/unit/toastsCoverage.test.js`, `formatEventsCoverage.test.js` (TOAST_FOR = 189-entry set-complement of ORACLE_ONLY within EVENT_NARRATION's universe — the partition must hold after the rename minus the `winGame` entry).
- Shell: `dispatchWithToasts(action)` at `mazeworld.html` ~L5505 (module script); rail folding via `rail.js`; the Phase 44 gates `npm run boot:check` and `tools/shell-sweep.mjs refs <name>` work for shell-side stragglers.
- `engine/saveState.js#foldLegacyCounters` (L510-525) — the tolerant-load idiom for retired keys; reuse its shape for `won` and for the `controlScheme` setting key.
- `src/browser/settings.js` (`SETTINGS_DEFAULTS` L44, allowed values L55, `readSettings`/`writeSetting`), `test/unit/settings.test.js`.
- Test-name/describe-string hygiene for "toast" is Phase 48 (DOCS-03); this phase only renames identifiers, but a test FILE named `*toast*.test.js` that pins a renamed export may be renamed now if the planner prefers one move (record it either way).

### Established Patterns
- Renames land with `git mv` + import-site sweep + a zero-straggler grep in the same commit (Phase 44's per-layer commits are the precedent).
- `EVENT_NARRATION` coverage guard: every emitted event type has an entry and no entry is unreachable — removing `winGame` means removing its narration entry AND its `LINE_FOR` row.
- Tolerant load: drop unknown/retired keys silently, never reject (`foldLegacyCounters`, `stripFoeAbilityState`).

### Integration Points
- `mazeworld.html` import lines for `toasts.js` (module script top), `dispatchWithToasts` definition and its callers, `S.won`/`state.won` reads (`hasActiveDelveSave`, title-screen `hadSaveAtLaunch`, `renderRail`, `renderEncounter`'s won branch — the "won" overlay text is dead too).
- `engine/movement.js`, `engine/engine.js`, `engine/saveState.js`; `test/parity/harness/comparables.js` (the `won` strip), `test/unit/*` pins (≈7 files for `won`, 28 for toasts), `test/voice/*` scan (imports toasts.js), `tools/` (any `toasts.js` import).
- `.planning/PROJECT.md` Key Decisions + UX-06 row; `.planning/REQUIREMENTS.md` UX-06 backlog row; `ROADMAP.md` Phase 46 success criteria 1–5.

</code_context>

<specifics>
## Specific Ideas

- Closing gates verbatim from ROADMAP criteria 1–5: `src/browser/toasts.js` absent + `narrationLines.js` exports; the `winGame|state.won|.won` grep → 0 over engine/src/shell/test/tools/harness; the recorded NAME-02 grep list with only the allowed survivors; `tutorial.js`/`tutorial.test.js` absent with the PROJECT.md note; `npm test` fail 0 with no test deleted except `tutorial.test.js`; engine diff = the `won` removal only; zero fixture moves; master hash unchanged; `build:www` + `boot:check` green.
- Human verification (deferred to the milestone-close Pixel 7 batch): a resumed save from before this build still loads (the dropped `won` key); the rail and fight-log lines read exactly as before (pure rename); nothing else is user-visible.

</specifics>

<deferred>
## Deferred Ideas

- Comment/doc/test-name references to toasts, D-pad, `wornSlots` etc. — Phase 48 (DOCS-01..03).
- The UX-06 tutorial itself — the v1.0 launch tail, after v1.6 (rebuilt on Phase 47's modules).
- Renaming `window.__mzWornSlots` — not needed (kept by user decision).
</deferred>
