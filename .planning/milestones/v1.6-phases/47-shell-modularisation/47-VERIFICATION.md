---
phase: 47-shell-modularisation
verified: 2026-09-19T23:59:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (re-run by the orchestrator after 47-05, HEAD 0737b62); criterion 2 passed against its re-baselined clause (user ruling 2026-09-19); the on-device checks are deferred to the end-of-run Pixel 7 batch per the deferred-UAT protocol
behavior_unverified: 0
overrides_applied: 1
human_verification: ["Pixel 7 (SHELL-01): Gear tab ON YOU (wielded weapon, worn armor, jewelry/cloak rows, empty-slot rows in voice) and BAG rows look exactly as before; Use/Equip/Unequip taps dispatch once, no dead buttons", "Pixel 7 (SHELL-01): the Drop two-tap confirm and the jewelry/cloak Swap confirm still arm, revert on the timer, and act on Yes", "Pixel 7 (SHELL-01): the victory loot card's Stow / Equip now / Leave rows and the store's sell list (both via the shared carried list) render and dispatch identically, incl. the bag-full Drop button", "Pixel 7 (SHELL-02): Hero sheet stats, trait line, RATIONS readout, special skills / abilities (READY / N ROUNDS / ONCE A FIGHT · USED in combat), dossier sections all read as before", "Pixel 7 (SHELL-02): Grimoire rows sort by level then name; Cast buttons enable/disable with the right hint; Company panel shows the joiner with DISMISS working (two-tap)", "Pixel 7 (SHELL-03): Store buy/sell/repair rows (price, sold/disabled state, repair sub-line, usable-by suffixes) and the roll copy header render as before; buying, selling and repairing still dispatch", "Pixel 7 (SHELL-01..03): switching Gear ↔ Hero ↔ Store (and into/out of the Store overlay) shows no flash, no missing panel, no stale content"]
gaps: []
---

# Phase 47 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-19)

Goal-backward check of the phase goal: *the Gear tab, the Hero tab and the Store screen each render from a named `src/browser/` module with its own source-pin test, and `mazeworld.html` is a mount point whose `window.__mz*` bridge is listed in one place — so later phases and the UX-06 tutorial edit small named files.*

Five sequential plans on the main working tree (no worktree): 47-01 DOM-snapshot harness + seven BEFORE fixtures; 47-02 bridge registry; 47-03 `gearTab.js`; 47-04 `heroTab.js`; 47-05 `storeScreen.js` + closing gates. Zero behaviour change is the phase's contract; the byte-equal DOM snapshots are the proof.

## Automated evidence (re-run by the orchestrator after 47-05, HEAD `0737b62`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `src/browser/gearTab.js`, `heroTab.js`, `storeScreen.js` exist, each exporting `render*(host, state, deps)` with its own suite; `paint()` / `renderEncounter()` hold exactly one mount call per surface | All three present (565 / 687 / ~200 lines), zero runtime `window`/`document` reads inside any module (grep shows comment mentions only); `window.__mzTabs = Object.freeze({ gear, hero, store })` assigned once in the module script (L4432); mounts at L2444 (hero), L2449 (gear), L3468 (store) — one each; `test/unit/gearTab.test.js`, `heroTab.test.js` (11), `storeScreen.test.js` (8) green |
| 2 | `wc -l mazeworld.html` < 5,000 — **re-baselined** | **5,621** (6,339 → 6,330 → 5,980 → 5,669 → 5,621; −718). NOT MET against the original figure; the CONTEXT fallback (move the tabs' private helpers) was applied and `shell-sweep orphans` found 27 orphans, all Map/Combat/Rail/Graves/Oracle — none in scope. **User ruling 2026-09-19: re-baseline and close at 5,621** (options offered: carry to Phase 48, a 47-06 combat carve, a full comment purge — all declined). Ledger: `docs/SHELL-MODULES.md#Line budget`; REQUIREMENTS SHELL-04 + ROADMAP criterion amended with the ruling |
| 3 | The widened no-duplicate pin names every tab module | `test/unit/shell-no-content-copies.test.js` 6/6 — derives 130+ export names from all 24 `src/browser/*.js` modules at test time and asserts each absent from both shell scripts |
| 4 | The `window.__mz*` registry test: set-equality between `src/browser/bridge.js` keys and a comment-stripped grep of the shell + modules; stale or unlisted names fail | `test/unit/bridge-registry.test.js` 10/10 incl. fail-first teeth (empty map, synthetic unlisted name, comment-only mention); 44 live names (53 at 47-02 → 49 after Gear → 44 after Hero; 47-05 added none); `tools/bridge-doc.mjs --check` exit 0; `docs/SHELL-MODULES.md` table generated from the map |
| 5 | 3-screen DOM snapshot byte-equal before/after | `test/unit/shell-tab-snapshots.test.js` 10/10 at every task commit of 47-02..47-05; `git diff 18a425f..HEAD -- test/unit/fixtures/shell-snapshots` empty (fixtures captured once in 47-01, never regenerated); the SHELL-03 double-render idempotency check included |
| — | `npm test` fail 0; `build:www`; `boot:check`; engine fence | **3,288/3,288** (3,231 → 3,243 → 3,253 → 3,265 → 3,278 → 3,288; no test file or assertion deleted — each plan's re-point ledger in its SUMMARY); `build:www` exit 0; `boot:check` 4/4; `git diff --stat 2c5b6e1..HEAD -- engine content test/parity icons sfx` empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged |

## Notes the reader should have

- **Override (criterion 2):** recorded above. The planner had projected the miss (~5,550) before execution; 47-05 followed the honest-shortfall protocol (SUMMARY + doc ledger + STATE blocker) rather than chasing the number. The blocker is resolved by the ruling.
- **Dead bridges found beyond the plan:** 47-02 deleted `__mzHaptics` alongside the planned `__mzBags` (orchestrator-confirmed zero readers: the shell imports `maybeHaptic` directly). 47-03 deleted six (`__mzGear`, `__mzItemRowState`, `__mzWornSlots`, `__mzWornKeysOf`, `__mzSlotFor`, `__mzSellPrice`); 47-04 five (`__mzAbilities`, `__mzEff`, `__mzStrikeDie`, `__mzToHit`, `__mzRenderGrimoire`) plus seven classic wrappers, and trimmed `__mzTables` to `{ ROMAN }`. Phase 46's ruling to keep `__mzWornSlots` is superseded: its only reader was the Gear body that moved into `gearTab.js` (direct import now).
- **Harness bugs caught by the plan's own checks (47-01):** node re-parenting duplicated gear-row buttons; `innerHTML` assignment did not invalidate stale ids (the exact SHELL-03 idempotency case). Both fixed before the fixtures were captured.
- **Tooling:** `tools/shell-sweep.mjs` now tolerates CRLF checkouts (47-04, Rule 1); `tools/ident-sweep.mjs` is importable with its CLI byte-identical (47-02).
- `renderCarriedList` has three hosts (Gear tab, loot card, store sell list) — exported from `gearTab.js` and bridged as `__mzCarriedList` (planner discretion). `renderDropShelf` and `paint()`'s skeleton stay in the shell per the CONTEXT.
- Two ROADMAP illustrative grep commands over-count by one each (a comment mention and an unrelated `class="shelf"` literal on the loot card); the comment-stripped counts are exactly the intended 2 / 0 — recorded in `47-05-SUMMARY.md`.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| SHELL-01 | Complete | criteria 1, 5 (47-03) |
| SHELL-02 | Complete | criteria 1, 5 (47-04) |
| SHELL-03 | Complete | criteria 1, 5 (47-05) |
| SHELL-04 | Complete (amended) | criteria 2 (re-baselined), 3, 4 |

## Deferred to the milestone-close Pixel 7 batch

The `human_verification` list in the frontmatter (7 items). None blocks `phase.complete` under the deferred-UAT protocol.
