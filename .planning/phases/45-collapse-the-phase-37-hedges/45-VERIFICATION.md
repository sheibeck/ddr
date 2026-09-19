---
phase: 45-collapse-the-phase-37-hedges
verified: 2026-09-19T17:35:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (re-run by the orchestrator after 45-03); the two on-device checks are deferred to the end-of-run Pixel 7 batch per the deferred-UAT protocol
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (HEDGE-01): a freshly rolled Thief starts with the starting cloak in the Gear tab's WORN row (c.worn.cloak), not in the BAG", "Pixel 7 (HEDGE-02): resuming the current on-device save shows the worn-reconciliation rail card ONCE if the migration bagged an extra (plus the matching Oracle line), or NO card if the save was already migrated / nothing was bagged — never a card on every launch", "Pixel 7 (HEDGE-01): a Fighter's or Magic User's Gear tab shows empty worn slots (c.worn = {}) and an unchanged bag — no phantom item, no error"]
gaps: []
---

# Phase 45 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-19)

Goal-backward check of the phase goal: *one worn-model code path everywhere — every fresh run creates `c.worn` (the Thief's starting cloak worn), every load reconciles unconditionally, no `wornSlots` option or option-keyed branch exists in the engine, the shell, the bot or the tests — with exactly the fixtures that move declared and regenerated under the greenfield ruling.*

The one fixture-moving phase of v1.6, and bounded: the engine diff since the phase start (`7c746ee`) is exactly `engine/state.js`, `engine/saveState.js`, `engine/derived.js` (a JSDoc line); `content/` untouched; `mazeworld.html` unchanged at 6,356 lines.

## Automated evidence (re-run by the orchestrator after 45-03, HEAD `a886d7c`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` → 0 lines; `newRun(seed)` with no options yields a Thief whose cloak is `c.worn.cloak`, pinned by an option-free test | **0 lines**; pin in `test/unit/worn-migration.test.js` (rewritten in 45-02 around the no-option path) |
| 2 | A v1.4-era save (no `c.worn`, two rings stacked) loads through `validateSave`/`rehydrate` with no option and comes out legal, report returned once, pinned option-free | pins in `worn-migration.test.js` (three-ring ordering, idempotency — `rehydrate` twice moves nothing; `validateSave` over its own output → `[]`) |
| 3 | Moved fixtures = exactly the set a committed live scan measured; each with a before/after record; every other fixture byte-identical; `FIXTURE-INVENTORY.md` regenerated; master hash unchanged | `tools/worn-fixture-scan.mjs` + committed `tools/worn-fixture-scan-output.txt`: **MOVED SET (13)** = chargen seeds 2/3/4, combat win/lose-plain/flee/parley, movement script, economy script, encounters chest/tablefour/faerie/affliction — equal to `docs/GEAR-SLOTS.md` §2's prediction; the scan re-run AFTER the collapse is byte-identical to the BEFORE readout; only the 5 fixture JSONs holding a MOVED-SET site changed; `test/parity/divergence-records.test.js` (new) proves declared holders == MOVED SET; `FIXTURE-INVENTORY.md` §"Phase 45: worn-model collapse" regenerated; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged) |
| 4 | Bot plays the single path: `RUN_FLAGS` no longer names the option; fresh readout `meta.runFlags` omits it; 143-cell × 3-seed smoke 0 stuck, `Bot:` line byte-equal to the v1.5 AFTER pin | `RUN_FLAGS = Object.freeze({ storeRoll: true })`; smoke (429 runs, 66.5 s, scratch path, nothing committed under `docs/class-pass/`): cells 143, 0 stuck, `runFlags {"storeRoll":true}`, `class-pass-diff --gate` exit 0, `Bot:` line equal to `docs/class-pass/v15-after.json` `meta.bot` modulo `seeds=40→3` |
| 5 | `npm test` fail 0 and `npm run build:www` green at every commit | **3242/3242, fail 0** (3243 → 3242: one option-only pin retired, `divergence-records.test.js` added); `build:www` exit 0; both green at each of the phase's 9 commits |

## Notes the reader should have

- **Harness design call (planner discretion, accepted by the orchestrator):** `stripWornField` (the Phase 37 hedge carve-out) was replaced by `dropEmptyWorn`, which drops only an EMPTY `c.worn` map. `reconcileWorn` now creates `c.worn = {}` for every non-Thief, and `diffState` compares key sets, so a bare deletion would have moved every fixture at `{}`-vs-absent — the blanket regeneration the ruling forbids. A POPULATED map reaches the diff and is declared per site. This is the "carve the new field out of the comparables — that is the harness, not a hedge" clause of the engine gate, not a second code path.
- **One honest unmet scan criterion (45-01):** the scan prints `UNEXPLAINED: action-script.combat.json#lose` — a pre-existing, fully-declared action-path divergence (Phase 24/31, `fromAction: 0`; the prototype and engine kill different foes, and the prototype's stream rolls a jewel drop the engine's never does). Not a worn move (`moved: false`); the scan is barred from reading divergence records to suppress it, so it is documented in `45-01-SUMMARY.md` and in the inventory section rather than hidden.
- **Rule-1 fixes worth knowing:** a Thief's bag is now empty at chargen (`worn-model.test.js` tripwire split); legacy-save test helpers must `delete c.worn` to simulate a v1.4 save; `loot-pile.test.js`'s comparison state auto-wore a jewel once jewelry slots were free — fixed by setting the worn keys on the comparison side. The frozen `docs/class-pass/*.json` readouts and `chargen-rng-pin.test.js` are untouched.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| HEDGE-01 | Complete | criteria 1, 4 |
| HEDGE-02 | Complete | criterion 2 |
| HEDGE-03 | Complete | criterion 3 |

## Deferred to the milestone-close Pixel 7 batch

The `human_verification` list in the frontmatter (3 items). None blocks `phase.complete` under the deferred-UAT protocol.
