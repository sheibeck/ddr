# Proposed Milestone: "Shell Debt & Dead Code"

**Captured:** 2026-09-17 (from user, mid-v1.5 autonomous run — "Do we need a cleanup milestone?")
**Status:** PROPOSED — stand up via `/gsd-new-milestone` AFTER v1.5 closes and its Pixel 7 UAT batch is done, and BEFORE the v1.0 launch tail (UX-06 tutorial + STR production launch). No research pass needed; every item below was verified by direct code read on 2026-09-17.

## Vision

Delete the code the game no longer runs, give the surviving modules honest names, and split the 8k-line shell so later phases (and the tutorial) edit small files instead of one giant one. No gameplay change; the engine and parity suite stay green throughout. Measure before touching performance — the game is turn-based and nothing is known to be slow.

## Why it matters / key facts (all verified 2026-09-17)

- **A whole dead engine lives in `mazeworld.html`** (7,971 lines). The shell still *defines* the pre-extraction prototype functions — `castSpell`, `parley`, `startCombat`, `meetJoiner`, `genFloor`, `rollCharacter`, `descend`, `makeCamp`, `takeItem`, `useItem`, `playerStrike`, `foeTurn`, `killFoe`, `openStore`, `readScroll`, `drinkPotion` (16 confirmed) — beside the real `engine/` that runs. They were kept as hash-pinned mirrors during the Phase 1 extraction; the decision log calls them "the dead classic X()". A few tests still `new Function`-extract classic helpers (`canParley`/`fluency`, the classic `eff(key)`) from the shell as drift tripwires.
- **A duplicated content table drifts:** the classic-script `SUB_NOTE` (the Hero-tab dossier text) has 13 rows out of sync with `content/flavor.js` (Knight, Guard, Woodsman, Master of Arms, Bard, Pickpocket, Pilfer, Cloaker, Ninja, Wizard, Court Mage, Illusionist, Summoner) — found by Phase 36-06 while syncing the Cutthroat row.
- **Misleading names / dead exports:** `src/browser/toasts.js` is the narrative-line table the rail and fight log read (`TOAST_FOR`, `toastsForAction`); toasts as UI were retired in Phase 35 (zero literals, pinned by `shell-map-invariants.test.js`). The module still exports dead lifetime constants (`MAX_TOASTS`, `TOAST_*_MS`, `toastLifetime()`), and `dispatchWithToasts` keeps the old name. `winGame()` / `state.won` are retained-but-unreachable (RUN-04). `src/browser/tutorial.js` has zero references (parked for UX-06 — a decision, not a deletion).
- **Two dual-path hedges to unify under the greenfield ruling (2026-09-17):** Phase 37's shell-only `newRun({ wornSlots })` option and two-path `eff()` (worn-only vs legacy bag-sum) plus the option-gated load migration; the user has since ruled "no dual-path code — fixtures follow", so these should collapse to the single worn-model path with the affected fixtures declared and regenerated.
- **Performance:** no evidence of a problem — `npm test` ≈ 24 s, `www/` 4.8 MB (icons 352 KB). Don't schedule a refactor on faith.

## Candidate scope (phases, in order)

1. **Retire the classic engine from the shell** — delete the 16 dead mirrors and every helper only they call; replace `SUB_NOTE` with an import from `content/flavor.js`; move the drift-tripwire tests (`parley-button-mirror`, classic `eff`, etc.) onto `engine/`/`content/` reads; keep `shell-map-invariants` green. Highest value, zero engine/parity risk (nothing in `engine/` changes). Expect −2–3k lines.
2. **Names & dead exports** — `toasts.js` → `narrationLines.js` (`TOAST_FOR` → `LINE_FOR`, `toastsForAction` → `linesForAction`, `dispatchWithToasts` → `dispatchWithNarration`), drop the lifetime constants; remove `winGame`/`state.won` (+ carve-out); decide `tutorial.js` (keep parked for UX-06 or delete and rebuild). Many import sites and test pins — one plan per rename, each its own commit.
3. **Collapse the Phase 37 hedges** — single-path `eff()` (worn only), no `wornSlots` option (every `newRun` creates `c.worn`, Thief cloak worn), migration unconditional; declare + regenerate the chargen/economy fixtures that move (`docs/GEAR-SLOTS.md` already lists them); flip the tuning bot onto the same path.
4. **Shell modularisation** — carve `paint()`'s Gear and Hero tabs (and the store) out of `mazeworld.html` into `src/browser/` modules the way `combatPanel.js` / `rail.js` already are, with source-pin tests per module. Optional; the payoff is that executors stop editing one 8k-line file mid-wave (the standing hazard in the deferred-UAT protocol) and the tutorial gets small, named surfaces to hook.
5. **Measure-first perf pass** — profile `paint()` re-render and `draw()` per step on the Pixel 7; fix only what's measured; otherwise close the phase with the numbers and no code.

## Sequencing / interactions

- After v1.5 (three of its remaining phases still edit `mazeworld.html`; a dead-code purge now would collide) and after its device UAT (so the purge is verified against a known-good build).
- Before UX-06 (tutorial hooks into shell code — smaller, named modules make it cheaper) and before the production launch (smaller bundle, fewer review surprises).
- Engine gate as amended applies: nothing here should change a rule; where item 3 moves fixtures, declare and regenerate exactly those.

## Out of scope

Any gameplay or balance change; the store restyle; haptics; dice-mode setting (those stay on their own backlog rows).
