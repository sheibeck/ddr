---
phase: 46-honest-names-dead-exports-the-tutorial-decision
verified: 2026-09-19T19:40:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (re-run by the orchestrator after 46-04); the on-device checks are deferred to the end-of-run Pixel 7 batch per the deferred-UAT protocol
behavior_unverified: 0
overrides_applied: 1
human_verification: ["Pixel 7 (NAME-01, pure rename): on a step, a fight round and a camp the RAIL card lines and the fight-log lines read exactly as before this build — no wording, tone, priority or ordering change", "Pixel 7 (DEAD-04, tolerant load): a save from the current Play build (which serialized won: false) still resumes and plays on — the dropped key is silently ignored", "Pixel 7 (DEAD-04): 'THEY ARE DOWN' still shows after a WON FIGHT — the fight-outcome copy key COMBAT_COPY.over.won is untouched; the graveyard renders every stone's note", "Pixel 7 (NAME-02, controlScheme): Settings shows exactly four rows — sound, haptics, text size, confirm-before-quit — each persisting across a relaunch", "Pixel 7 (NAME-02, tolerant load): an old persisted settings blob still carrying controlScheme/'dpad' loads without error and surfaces no control for the dropped field", "Pixel 7 (DEAD-05): nothing tutorial-related is visible on first run — the 04-era sequencer was never wired; UX-06 rebuilds on the modular shell after v1.6"]
gaps: []
---

# Phase 46 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-19)

Goal-backward check of the phase goal: *every surviving module and export is named for what it does today, nothing unreachable stays exported, and the one ambiguous module (`tutorial.js`) has a recorded decision instead of a parked question.*

Two user decisions (2026-09-19 discuss round): `tutorial.js` deleted (UX-06 rebuilds on the Phase 47 modular shell); `narrationLines.js` as the module name, the dead `controlScheme` setting removed, `window.__mzWornSlots` kept (it is the slot taxonomy, not the retired option).

## Automated evidence (re-run by the orchestrator after 46-04, HEAD `69322d4`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `toasts.js` absent; `narrationLines.js` exports `LINE_FOR`, `linesForAction`, `dispatchWithNarration`; none of `MAX_TOASTS`/`TOAST_*_MS`/`toastLifetime`; the old names grep to 0 | `src/browser/toasts.js` **absent** (`git mv`, 38 commits of history follow); `LINE_FOR` (250 keys) + `linesForAction` exported, `dispatchWithNarration` is the shell's function (1 definition, 9 call sites); dead lifetime exports **0**; old-name grep over src/engine/content/tools/shell/test **0**; before/after fold dump byte-identical |
| 2 | `winGame|state.won|.won` grep → 0; `saveState.js` no longer serializes/validates `won`; a stale `won: true` save loads tolerantly; abandon guard is `!next.dead` | grep **0** excluding two allowed survivors: `COMBAT_COPY.over.won` ×2 (the fight-outcome copy key, live) and `test/parity/prototype-master.js.txt` (frozen, never edited). Tolerant load pinned in `test/unit/save-validation.test.js`. **Premise correction:** no harness carve-out for `won` existed — the field was compared live on both sides; the removal ADDED a one-word prototype-side `won` strip in the six comparable sites (the Phase 39 `stripRetiredCounterFields` precedent). Zero fixture moves; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged |
| 3 | Recorded identifier grep over `src/`, `engine/`, `content/`, `tools/`, the shell for `toast`, `dpad|d-pad`, `flightLeft|flightCooldown`, `c\.ether`, `wornSlots` → 0 identifier hits bar tolerant-load reads | `tools/ident-sweep.mjs` (new; comment-stripped single-pass state machine, `--self-test` fail-first): `toast` 0, `dpad|d-pad` 0, `c\.ether` 0, `wornSlots` 0, `flightLeft|flightCooldown` **5** — all five inside `engine/saveState.js#foldLegacyCounters` (L517–524), the allowed legacy-save reads |
| 4 | `tutorial.js` in exactly one of two states | **Deleted** (`5e6be1b`) with `test/unit/tutorial.test.js` `git mv`'d to `icons.test.js` (its 15 live `icons.js` pins kept, 10 tutorial tests removed) and the `icons.js` comment; decision recorded in PROJECT.md Key Decisions + the onboarding row and the REQUIREMENTS.md UX-06 row |
| 5 | `npm test` fail 0 with no test deleted except `tutorial.test.js`; `engine/` diff limited to the `winGame`/`won` removal; zero fixture moves; master unchanged; `build:www` green | **3231/3231** (3,242 → 3,240 two lifetime pins → 3,240 → 3,241 → 3,231 ten tutorial tests; no test FILE deleted, six `git mv`'d); engine diff = `death.js`, `engine.js`, `events.js`, `movement.js`, `saveState.js`, `state.js` — all `won`-only (six files, not the three the CONTEXT enumerated: `state.js` initializer, `events.js` `WON`/`won()`, `death.js` note branch were required for a complete removal); `content/`+fixtures diff empty; `build:www` exit 0; `boot:check` 4/4 |

## Notes the reader should have

- **Gate override:** the decision-coverage gate at planning time returned `could-not-parse` (it read "D-04"/"D-05" inside the requirement IDs `DEAD-04`/`DEAD-05` as decision tokens). Both user decisions are covered by 46-01 and 46-03; recorded in STATE.md at the time.
- `linesForAction`'s `opts.limit` default changed from `MAX_TOASTS` (4) to `Infinity` — every production caller already passed `limit: Infinity`; three "default caps at 4" pins re-pinned.
- 46-04's positive control expected `grep -c toast narrationLines.js` > 50; actual 45 lines (49 occurrences) — the control's intent (plain grep sees dozens of comment mentions, the sweep sees 0) holds; recorded, not rounded.
- Comments/docs/test names that still mention toasts, the D-pad, `won: false` literals in tests (54-file inventory in `46-02-SUMMARY.md`) are Phase 48's sweep (DOCS-01..03), by design.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| NAME-01 | Complete | criterion 1 |
| NAME-02 | Complete | criterion 3 (+ `controlScheme` removal, 46-03) |
| DEAD-04 | Complete | criterion 2 |
| DEAD-05 | Complete | criterion 4 |

## Deferred to the milestone-close Pixel 7 batch

The `human_verification` list in the frontmatter (6 items). None blocks `phase.complete` under the deferred-UAT protocol.
