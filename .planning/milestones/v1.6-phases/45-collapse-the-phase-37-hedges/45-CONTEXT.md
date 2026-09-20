# Phase 45: Collapse the Phase 37 Hedges - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Autonomous smart discuss — infrastructure phase (single-path collapse; ROADMAP: "Discuss: not worth a round — the ruling is already recorded; the only judgment is which fixtures move, and that is measured, not decided"). No user questions asked; the rulings below are the standing greenfield ruling applied.

<domain>
## Phase Boundary

One worn-model code path everywhere: `newRun(seed)` with no options creates `c.worn` (a Thief's starting cloak worn, zero rng draws); `validateSave`/`rehydrate` reconcile worn state unconditionally (the report returned once from `validateSave`); no `wornSlots` option or option-keyed branch survives in `engine/`, `src/`, `mazeworld.html`, `tools/` or `test/`; the tuning bot plays that single path; the fixtures the collapse moves are measured by a committed live scan, declared with before/after records, and regenerated — every other fixture byte-identical, `FIXTURE-INVENTORY.md` regenerated, `prototype-master.js.txt` hash unchanged. Requirements HEDGE-01, HEDGE-02, HEDGE-03.

**This is the ONLY fixture-moving phase of v1.6.** Phases 44 and 46–49 keep the engine-gate fence empty; this phase deliberately edits `engine/state.js`, `engine/saveState.js` and the parity harness/fixtures — and nothing else in `engine/` (no rule changes: `eff()` is already single-path since quick task 260918-w4n; `reconcileWorn` is unchanged).

**Phase-start baseline (2026-09-19, HEAD `b22a681`):** `wornSlots` ×67 lines across the repo incl. comments (non-comment sites: `engine/state.js:151,170`; `engine/saveState.js:560,683,791`; `src/browser/engineAdapter.js:348,381,384`; `tools/lib/tuning-bot.mjs:574` `RUN_FLAGS`; `test/unit/worn-migration.test.js` ×24; `bot-tactics.test.js:787-810`; `class-pass-ledger.test.js:437-438`; `engineAdapter.test.js:161`; `item-activation.test.js:373-377`; a comment in `engine/derived.js:342`). 3,243 tests green; shell 6,356 lines.

</domain>

<decisions>
## Implementation Decisions

### Collapse rulings (the 2026-09-17 greenfield ruling — "no dual-path code; fixtures follow" — applied; not new user decisions)
- **`newRun(seed, exclude, { startDepth, force, storeRoll })`** — the `wornSlots` parameter is removed and `reconcileWorn(c)` runs unconditionally after chargen (still zero rng draws, so the seeded cursor is untouched). `storeRoll` stays as-is (a separate, earlier hedge — NOT in scope; NAME-02 does not name it).
- **`validateSave(raw, { freshSeed })`** always reconciles and always returns `{ ok: true, value, wornReport }` (`wornReport` = `[]` when nothing moved — one shape, no conditional key). **`rehydrate(value)`** always reconciles (idempotent — re-running on an already-migrated save moves nothing). `engineAdapter.js#boot()`/`startNewRun()` drop the option arguments; `takeBootWornReport()` semantics unchanged.
- **Tuning bot:** `RUN_FLAGS = Object.freeze({ storeRoll: true })`; `meta.runFlags` in a fresh readout omits `wornSlots`. The frozen historical readouts under `docs/class-pass/*.json` are NOT edited — `class-pass-ledger.test.js:437-438` pins the stored v1.5 AFTER files' `runFlags` literally; that assertion stays true for the stored files and must not be "fixed" to the new shape (record this in the SUMMARY so nobody regenerates the ledger).
- **Tests:** every `{ wornSlots: true }` argument is deleted (the calls become the default path); `worn-migration.test.js`'s "`newRun(seed, [], { storeRoll: true }) alone (no wornSlots) does not create c.worn`" (L67) inverts — replace with the success-criterion pin "`newRun(2)` with NO options yields a Thief whose starting cloak is `c.worn.cloak` and not in `c.items`"; add the HEDGE-02 pin "a v1.4-era save (no `c.worn`, two rings stacked in the bag) loads through `validateSave`/`rehydrate` with NO option and comes out legal — first copy worn, extras bagged, report returned once".
- **Comments:** delete every comment that describes the option/"flag-off = legacy" behaviour at the sites edited (state.js, saveState.js, engineAdapter.js, derived.js:342, comparables.js) — Phase 48 sweeps the rest of the repo, but a comment attached to a line this phase rewrites goes with it.

### HEDGE-03 — fixtures: measure, declare, regenerate (exactly the moved set)
- **Measure first, commit the scan:** before editing the engine, add a scratch-free, repeatable scan (a small `tools/` or `test/parity/harness/` script, committed) that replays every parity fixture/scenario against the engine and lists which comparables differ once `c.worn` is always created — run it AFTER the engine edit and commit its output (the SUMMARY quotes it). `docs/GEAR-SLOTS.md` §2 predicts chargen seeds 2/3/4 (Thief starting cloaks in `c.items`), combat/flee seed 17 (Cloak of Armor in the bag) and `action-script.economy.json`'s Cloak of Ether — the prediction is a checklist for the scan, not the answer.
- **Two kinds of "regenerate":** chargen/combat/economy/magic fixtures compare LIVE prototype-sandbox output against the engine (no stored literal) — their divergence is declared as a harness record (`chargenDivergenceFor`/`stripDeclaredFields` for chargen, `stripScenarioDivergence` for scenarios — the Phase 23/24 precedents) with before/after values asserted, never a blanket strip. Stored-literal fixtures (`test/parity/fixtures/*.json`, e.g. `action-script.economy.json`'s `after.items`) are regenerated file-by-file with a `divergences` block naming the field and before/after. **`stripWornField` (comparables.js:206-221) is deleted** — it was the Phase 37 hedge's carve-out; after this phase `c.worn` is part of the comparable on the engine side and the prototype (which never had `worn`) is compared through the declared divergence instead. If deleting it moves more fixtures than the scan predicts, that IS the measurement — declare them, do not keep the strip.
- **Byte-identical everywhere else:** `git status --porcelain test/parity/fixtures` shows only the regenerated files; `git hash-object test/parity/prototype-master.js.txt` unchanged; `node tools/fixture-inventory.mjs` regenerates `test/parity/FIXTURE-INVENTORY.md` with a Phase 45 section listing the moved set and the scan output.
- **Bot smoke (criterion 4):** `node tools/tune-classes.mjs --seeds 3 --workers 4 …` (the command form `docs/CLASS-PASS.md:257` records) → 143 cells, 0 stuck, `Bot:` parameter line byte-equal to the v1.5 AFTER pin (`docs/class-pass/v15-after.json` `meta.bot`). Output to a scratch path, not `docs/class-pass/` (no new ledger entry — this is a smoke, not a readout).

### Claude's Discretion
- Scan script location/name, commit slicing (recommended: 1 = scan tool + BEFORE run committed; 2 = engine + adapter + bot collapse with the moved fixtures declared/regenerated in the same commit so the suite never sits red; 3 = tests/pins/comments + inventory + smoke), and whether the two new success-criterion pins live in `worn-migration.test.js` or a new file.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/saveState.js#reconcileWorn` — the one migration routine (unchanged by this phase); `validateSave` L558-684, `rehydrate` L788-793.
- `test/parity/harness/comparables.js` — `chargenDivergenceFor`/`stripDeclaredFields` (Phase 23 declared chargen divergence `{15, 24}`), `stripScenarioDivergence` (Phase 23-04), `stripReauthoredEveryField` (Phase 39, a harness carve-out documented in FIXTURE-INVENTORY.md) — the declared-divergence idioms; `stripWornField` L206-221 is the hedge to delete; `chargen-parity.test.js:126-203` and `magic-parity.test.js:299` enforce "a declared field must show a real before/after difference — no blanket regeneration".
- `tools/fixture-inventory.mjs` (`node tools/fixture-inventory.mjs [--json]`) regenerates `test/parity/FIXTURE-INVENTORY.md`; `test/parity/fixture-inventory.test.js` pins it.
- `tools/tune-classes.mjs` (bot smoke; `tools/lib/tuning-bot.mjs:574` `RUN_FLAGS`), `test/unit/class-pass-ledger.test.js` (143-cell pins, `Bot:` line pins L123-176).
- `tools/shell-sweep.mjs refs <name>` (Phase 44) — usable as the zero-reference gate for `wornSlots` in `mazeworld.html`; for the rest use `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` → 0 lines (success criterion 1).

### Established Patterns
- Declared divergences are asserted (before value ≠ after value) at the compare site and documented in `FIXTURE-INVENTORY.md`; the master file is never edited; regeneration is per-fixture with rationale (Phases 23, 24, 36–39, quick 260918-w4n's four declared moves).
- Movement/combat/magic parity tests carry their own local comparable duplicates (`combat-parity.test.js:160`, `magic-parity.test.js:120`, `movement-parity.test.js:98` mirror `stripWornField`) — every site that mirrors the strip must change together or parity drops (Phase 21-03 lesson).
- Engine edits carry a draw-count/rng-cursor proof when they touch chargen: `reconcileWorn` draws nothing, so a pinned-cursor test (`test/unit/worn-migration.test.js:38-66` style) is the proof to keep.

### Integration Points
- `engine/state.js:151-172` (`newRun` signature + the `if (wornSlots)` line), `engine/saveState.js:560,683,791`, `src/browser/engineAdapter.js:337-390` (`startNewRun`, `boot`), `tools/lib/tuning-bot.mjs:574`, `test/parity/harness/comparables.js:206-221` (+ the three local mirrors), `test/parity/fixtures/action-script.economy.json`, `test/parity/FIXTURE-INVENTORY.md`, `docs/GEAR-SLOTS.md` §2/§5 (update the prose that says "every fixture/bot/tools/test caller never creates c.worn" — Phase 48 would catch it, but this phase makes it false, so fix it here).
- `.planning/ROADMAP.md` Phase 45 success criteria 1–5 (the acceptance checks) and `REQUIREMENTS.md` HEDGE-01..03.

</code_context>

<specifics>
## Specific Ideas

- Success criteria verbatim as the closing gates: `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` → 0; the two no-option pins pass; the scan output committed and equal to the declared/regenerated set; `git hash-object test/parity/prototype-master.js.txt` unchanged; `RUN_FLAGS` = `{ storeRoll: true }`; 143-cell × 3-seed smoke 0 stuck with the `Bot:` line byte-equal; `npm test` fail 0 and `npm run build:www` green at every commit.
- Human verification (deferred to the milestone-close Pixel 7 batch): a fresh Thief starts with the cloak in the WORN row of the Gear tab; resuming the current on-device save shows the reconciliation card once (or no card if already migrated); nothing else is user-visible.

</specifics>

<deferred>
## Deferred Ideas

- `storeRoll` option (the earlier, separate hedge) — not named by any v1.6 requirement; leave it.
- Repo-wide comment sweep for `wornSlots`/"flag-off" prose outside the edited lines — Phase 48 (DOCS-01); NAME-02's zero-straggler grep for `wornSlots` identifiers — Phase 46 verifies it against this phase's result.
</deferred>
