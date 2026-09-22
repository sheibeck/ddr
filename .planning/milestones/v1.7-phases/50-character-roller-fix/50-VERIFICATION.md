---
phase: 50-character-roller-fix
verified: 2026-09-20T23:30:00Z
status: passed
score: 4/4 success criteria verified on automated evidence (orchestrator re-run at HEAD b2f53f6); criterion 3's device half is deferred to the Phase 55 batch per the deferred-UAT protocol
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "Normal roll (Pixel 7): title ENTER → reels lock race → class → sub-class → name + quirk reveal → DESCEND → the Hero tab shows the SAME race / sub-class / class / name the reels displayed"
  - "Double-tap (Pixel 7): double-tap ENTER on the title → the reels restart and lock exactly once (no first-roll labels bleeding into the second) → DESCEND → the Hero tab matches the final (second) reels only"
  - "Play-again-from-death (Pixel 7): die → CONFIRM → ENTER → fresh reels → DESCEND → the Hero tab matches the new reels"
  - "Dead Hero tab 'New Character' (Pixel 7): from the dead Hero tab tap New Character → fresh reels → DESCEND → the Hero tab matches the reels (the other window.mzStartRoll call site)"
  - "Not-a-bug check (Pixel 7): the dev Settings row's Start-at-depth rolls a FRESH character by design (Phase 21, unchanged here) — if the reported mismatch was seen after a dev start, that is this path, not the roller; say so and it becomes a separate todo (keep the rolled character on a dev start)"
gaps: []
---

# Phase 50 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *the character the roller screen reveals (race / class / sub-class reels, name, quirk) is exactly the character that lands on the Hero tab — no second roll, no stale pending state, no label drift.*

Three plans, three sequential waves. 50-01: `src/browser/roller.js` (`createRoller` — monotonic roll token that drops a superseded resolution, serialized `startNewRun()` promise chain, every lock/reveal step reading `sheetFor(rollerPendingState)`, CTA inert until the reveal) + `test/unit/roller.test.js` (12 tests). 50-02: `tools/roller-repro.mjs`, a dependency-free headless-Chrome CDP driver, run against the UNFIXED inline roller for the BEFORE table. 50-03: the `mazeworld.html` mount swap, pin re-homes, `docs/SHELL-MODULES.md`, the AFTER table, gates. **Human verification is deferred** to the Phase 55 batched device session (list in frontmatter).

## Evidence (orchestrator re-run at HEAD `b2f53f6`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | A source-pin/unit test proves the committed state's `characterSheetViewModel` labels equal the reel labels shown at reveal — the reel lock and the CTA commit read the same object (`rollerPendingState`), not a captured `sheet` | `test/unit/roller.test.js` SC1 identity test: the state handed to `onCommit` is `===` the object every lock step derived its label from; labels compared field-by-field. Module source pin: every `sheetFor(` call sits inside a timer callback (no await-time capture). Mount pins m1–m7: exactly one `createRoller(` in the shell (`grep -c` = 1, re-run), `rollerPendingState` no longer appears in `mazeworld.html` (0 hits) — it lives only in the module |
| 2 | Re-entry is guarded: a resolved `startNewRun()` from a superseded roll is ignored, pinned by a test that fires two rolls and asserts only the second's state reaches the Hero tab | `roller.test.js`: (a) first roll resolves AFTER the second → first's resolution dropped, reels + pending + committed state are all the second's; (b) mid-reveal supersede → the first's lock/reveal timers never touch the reels again; (c) three overlapping `start()` calls → `startNewRun` invoked strictly one-at-a-time (serialized chain), last roll wins in both the adapter and the reels. Live-browser confirmation: AFTER table row `play-again-mid-reveal` = match |
| 3 | A manual repro pass (roll → reels → DESCEND → Hero tab; repeated with a double-tap and with Play-again from a death) shows zero mismatches, recorded in the phase summary | Browser half done by `tools/roller-repro.mjs --scenario all` (real headless Chrome over CDP, fresh profile per scenario, drives title ENTER → reveal → DESCEND → HERO): **BEFORE 4/4 matched** (unfixed shell — the race did not reproduce in this timing; recorded as "not reproduced in browser; structurally guarded; device check in the Phase 55 batch" per the CONTEXT fallback), **AFTER 4/4 matched** (`50-02-repro-before.txt`, `50-03-repro-after.txt`). Device half → `human_verification` (deferred-UAT protocol, no mid-run device pause) |
| 4 | `engine/`, `content/`, parity fixtures and the master hash are untouched — shell-only | `git diff --stat 6b174fb..HEAD -- engine/ content/ test/parity/` **empty** (re-run); `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). Files touched: `mazeworld.html` (5,682 → 5,596 lines), `src/browser/roller.js` (new), `src/browser/bridge.js` (two consumer strings), `test/unit/roller.test.js` (new), `test/unit/shell-abilities.test.js` (RACES/CLASSES pin re-pointed), `docs/SHELL-MODULES.md`, `tools/roller-repro.mjs` (new) |
| — | `npm test` fail 0; `build:www`; `boot:check` | **3,334 / 0** (3,315 at phase start + 12 roller tests + 7 mount pins; re-run by the orchestrator); `build:www` exit 0; **`boot:check` environment-blocked** — see notes |

## Notes the reader should have

- **Root cause was not pinned to one trigger.** Code reading found two real weaknesses and both are closed: (1) `mzStartRoll` re-entry — overlapping calls each pushed their own lock/reveal timers, so both sets fired and the reels / `rollerPendingState` / adapter `currentState` each landed on whichever roll resolved last; (2) the reels locked on a `sheet` captured at await time while the CTA committed `rollerPendingState` — the same object only by construction. The BEFORE table's `play-again-mid-reveal` row shows "reels changed after reveal: yes" on the old code — the superseded roll's timers did fire over the new one; it merely settled on the right state in that timing.
- **A plausible real-world trigger that is NOT this bug:** the dev Settings row's Start-at-depth (`mzDevStartAtDepth` → `startNewRun(undefined, { startDepth })`) rolls a fresh character by design (Phase 21, `83526ae`); the Phase 49 device round already noted "the roller's Court Mage becoming a Thief on the dev run" on 2026-09-20 — the same day this todo was captured. Phase 50 leaves that path alone; it is the fifth `human_verification` item so the device round can tell the two apart.
- **`npm run boot:check` fails on this machine independently of the app** — 0-byte `--dump-dom` output; the tool's own `--self-test` (a scratch page, zero app code) fails the same way; the executor reproduced the identical failure against the pre-fix `mazeworld.html`. Best evidence: the interactive Chrome session on this box (9 `chrome.exe` at check time) swallows the raw `--headless=new --dump-dom` invocation. `tools/roller-repro.mjs`'s CDP approach works on the same machine and drives the rebuilt `www/index.html` end to end, which is the stronger live-browser proof for this change. Tracked in `deferred-items.md`: re-run `boot:check` in a clean session, or migrate `shell-boot-check.mjs` to the CDP approach.
- `startNewRun()` still persists the rolled save before DESCEND (an app kill mid-reveal resumes into the rolled character — correct character, skipped reveal), `recordBest` may repeat harmlessly on a superseded roll, and the hardware back button has no roller awareness — all recorded as out of scope in `50-CONTEXT.md` Deferred Ideas.
- Executor deviations: 50-01 reworded doc comments so its own literal-grep acceptance counts stayed exact (no behaviour change); 50-02 fixed its tool's Chrome teardown (kill by `--user-data-dir` substring, forward-slash profile paths) after leaking process families during the BEFORE run and cleaned up its own orphans — zero `mz-roller-` Chrome processes remained at wave close.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| ROLL-01 | Complete (device confirmation rides the Phase 55 batch) | criteria 1–4 |
