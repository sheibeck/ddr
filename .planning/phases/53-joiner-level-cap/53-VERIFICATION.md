---
phase: 53-joiner-level-cap
verified: 2026-09-21T04:10:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 6a26c44); device checks deferred to the Phase 55 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "Joiner level ≤ floor (Pixel 7): meet a Joiner on floor 1 — the rail card's roll text reads 'skill level I' and, after accepting, the Hero tab's Company panel shows the same level; on floor 2 it never exceeds II"
  - "Old save tolerant (Pixel 7): a save carrying a level-V ally loads and the Company panel still shows level V — only NEW Joiners are capped"
  - "Copy unchanged (Pixel 7): the Oracle's joinerMet line and the Wilmsry refusal line read exactly as before; a capped Joiner's recruitment line reads identically to a native same-level Joiner's"
gaps: []
---

# Phase 53 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *a Joiner's level never exceeds the floor it is met on, so early floors stop handing the player a free deep-tier ally.*

Two plans, two sequential waves. 53-01 made the one-line cut in `engine/encounters.js#meetJoiner` (`const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth);` at L504, with a `DELIBERATE RULES CHANGE (Phase 53, JOIN-02, 2026-09-20)` comment), pinned SC1–SC3 in a new `test/unit/joiner-level-cap.test.js`, measured the fixture impact three ways and declared the measured zero, all in one green feat commit (`78572c5`). 53-02 ran the AFTER bot readouts under Phase 52's flags and wrote the ledger H3. **Human verification is deferred** to the Phase 55 batched device session (frontmatter list).

## Evidence (orchestrator re-run at HEAD `6a26c44`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `meetJoiner`'s rolled level is clamped `lvl = min(rolled, state.floor.depth)` with the same one-d10-then-two-d20 draw sequence, pinned by a test showing a level-5-rolled Joiner met on floor 2 arrives as level 2 with an unchanged draw count | `joiner-level-cap.test.js` "SC1: a d10 of 9 (Level Table 5) met on floor 2 arrives as level 2 — pendingJoiner.lvl/level, c.joiner.lvl and joinerMet.lvl all read 2"; "SC1: the capped meet draws exactly as many rng calls as the uncapped meet and leaves the delegate cursor at the same getState"; control test: floor 5 not capped, floor 9 stays at the table ceiling 5, a d10 of 1 on floor 5 stays level 1 (the cap never raises). `meetJoiner` still contains exactly 3 `rng.` calls (d10, then two d20) — zero draws added; no draw-count pin moved (`foe-turn-draw-count.test.js`, `combat.test.js` untouched) |
| 2 | `grantLevelAbilities` and the `20 * lvl + d20` wp formula both receive the capped level — a floor-2 capped Joiner's abilities and wp match a natively-rolled level-2 Joiner, pinned by test | "SC2: wp is 20 * 2 + the FIRST d20 after rollCharacter (maxWP mirrors it) for the floor-2 capped Joiner; the floor-5 uncapped twin reads 20 * 5 + the same d20"; "SC2: a floor-2 capped Joiner (rolled 5) is deepStrictEqual to a natively-rolled level-2 Joiner (d10 of 3) from the same stream — pendingJoiner, c.joiner and the joinerMet event" (a scripted-first-d10 rng shares the rest of the stream between the twins, so the equality covers character, wp and abilities) |
| 3 | `joinerMet`/`joinerRefused` narration and the rail card render unchanged — no copy/shape diff, pinned by a snapshot test | "SC3: joinerMet and joinerRefused render byte-identical through narrateEvent and LINE_FOR for a capped vs a natively-rolled Joiner of the same level, and match today's copy verbatim"; "SC3: c.joiner keeps its frozen 7-key shape; pendingJoiner's ONLY new key is lvl"; "SC1/SC3: … Wilmsry … refused with joinerRefused.lvl 2 … payload key sets are pinned"; "SC3: the rail card and the Company panel read the SAME capped lvl field — source pins on mazeworld.html and src/browser/heroTab.js". Shell/`saveState.js` diff-empty fences held. 9/9 tests pass (orchestrator re-run) |
| 4 | Only the fixtures that meet a Joiner on a floor shallower than its rolled level move; each is declared with before/after in `FIXTURE-INVENTORY.md` and regenerated; every other fixture and the master hash are untouched | Measured zero, three ways: `tools/initiative-fixture-scan.mjs` Part B on the edited engine diffs empty against the committed output (re-run by the orchestrator); full parity suite `node --test test/parity/*.test.js` 42/42 with zero fixture edits; an engine-only Joiner-exposure replay of all 31 fixture sites found 0 `joinerMet` events, no `encounterRolled` "Joiner", `pendingJoiner` never truthy. Declared as **MOVED SET (0)** in a `FIXTURE-INVENTORY.md` Phase 53 section (generated roster block byte-identical); guarded by a new JOIN-02 test in `divergence-records.test.js` (EXPECTED = [] plus zero `joinerMet` across the replay). `comparables.js`, fixtures, `forceParty` diff-empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged (re-run) |
| 5 | A `tune-classes` smoke before/after records the early-Joiner power shift in `docs/DIFFICULTY-RETUNE.md` | `### v1.7 · Phase 53 — Joiner level cap` (L2767) under the v1.7 H2, before `## v1.2 retune (Phase 27)` (L3251; ledger heading pins 33/33). BEFORE = Phase 52 AFTER `049ab50` (reused) → AFTER `78572c5`, identical flags: solo p50/p90 4/6 → **4/6 (byte-identical)**; class smoke pooled mean 3.96 → **3.96, `cellsIdentical true`, `metaParity true []`** (the bot declines in-run Joiners — solo play untouched); `--party` p50/p90 5/7 → **5/6**, action p50 703 → 580, stuck 75 → 59, member alive at end 76.5 % → 62.5 %; forced-ally level histogram L1..L5 55/45/26/33/41 → **192/0/0/0/0** (8/200 Wilmsry-vs-Magic-User refusals in both, level-independent). The `--party` column is the JOIN-03 shift, declared by design in the ledger (`forceParty` unmodified) |
| — | `npm test` fail 0; `build:www`; measurement gate | **3,382 / 0** (3,372 at phase start + 9 SC pins + 1 JOIN-02 guard; re-run by the orchestrator); `build:www` exit 0; `git diff --stat 78572c5..HEAD -- engine/ content/ tools/ test/` empty (53-02 was docs-only) |

## Notes the reader should have

- **What changed for the player:** a Joiner met on floor N is at most level N. Nothing else — draw order, payload shapes, narration copy and the Company panel are byte-identical; the rolled pre-cap level is not remembered anywhere. Existing saves with an over-level ally keep it (tolerant load, greenfield ruling).
- **Zero re-pins were needed** across the eight pre-existing Joiner test files (223 tests before and after, unchanged): every existing assertion compares `pendingJoiner.lvl` to `c.joiner.lvl`, pins shapes, or hand-replays the draw order without reading the level. The 53-01 SUMMARY carries the per-file ledger.
- **Why the `--party` numbers moved and the rest didn't:** `--party` force-recruits at depth 1, so every forced ally is now level 1 instead of 1–5 — the early-Joiner power shift the phase exists to make. The bot policy (D-20) declines in-run Joiners, so solo and class-smoke runs never exercise the cap; their identity is the evidence, not an omission. Teaching the bot to accept Joiners is a Phase 54 measurement candidate (deferred in CONTEXT).
- Executor measurement corrections (recorded, not deviations): the SC3 key-set assertion was written to measured reality (`lvl` is the only genuinely new key on `pendingJoiner`; `level/wp/maxWP` pre-exist on a `rollCharacter` sheet and are overridden); the predicted "200 × level 1" histogram is 192 + 8 refusals.
- `npm run boot:check` remains environment-blocked on this machine (Phase 50 note); not a gate.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| JOIN-02 | Complete (device confirmation rides the Phase 55 batch) | criteria 1, 2, 3, 4 |
| JOIN-03 | Complete | criteria 4, 5 |
