---
phase: 51-initiative-once-per-combat
verified: 2026-09-21T00:20:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 518e3bb); device checks deferred to the Phase 55 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "No back-to-back foe turns (Pixel 7): across a 3+ round fight the exchange reads strictly you/them or them/you — never two foe attacks between two of your actions"
  - "Foe-first opener (Pixel 7): a Samurai or Fridgian fight opens with the foe's turn once, then alternates; the combat panel's YOU/THEY MOVE FIRST reading stays the same for the whole fight"
  - "One initiative line per fight (Pixel 7): 'Initiative — you N, {foe|them} M. …' appears exactly once in the Oracle and once in the fight log; no repeat on later rounds"
  - "Dice revealable (Pixel 7): tapping the fight-log initiative entry reveals both d20s"
  - "Override verdict wording (Pixel 7): a Samurai fight reads 'Samurai honour — they go first.'; a foreseen/Acute Hearing fight reads 'Foresight — you go first.' / 'Acute Hearing — you go first.'"
gaps: []
---

# Phase 51 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *initiative is fixed for the whole fight and visible to the player — the foe can never take two turns back to back.*

Three plans, three sequential waves. 51-01 measured first (BEFORE bot readout on the untouched tree; `tools/initiative-fixture-scan.mjs` naming the MOVED SET). 51-02 made the cut in one commit — `resolveInitiative` as the single roll site from `fight()`, `afterPlayerAction` reduced to `round++`, every draw pin re-measured, exactly the measured fixtures declared and regenerated — then the AFTER readout. 51-03 rendered the once-per-fight line. **Human verification is deferred** to the Phase 55 batched device session (frontmatter list).

## Evidence (orchestrator re-run at HEAD `518e3bb`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `rollInitiative` fires exactly once per combat (from the `fight` action); the per-round re-roll at `engine/combat.js:1341` is gone, pinned by a zero-draw assertion in `foe-turn-draw-count.test.js` | `afterPlayerAction` body contains no `rollInitiative(`/`resolveInitiative(` call and exactly one `foeTurn(` (re-grepped); `resolveInitiative` is called from `fight()` only (`rollInitiative` kept as a thin wrapper for direct-call tests). SC1 zero-draw pin on the round advance in `foe-turn-draw-count.test.js`; full-fight totals re-pinned to the new sequences (−2 d20 per round from round 2), never loosened |
| 2 | A scenario where the foe would have won a fresh second-round roll now alternates player/foe turns for the whole fight — no back-to-back foe turns — proven by a determinism/unit test | SC2 Samurai-alternation pin in `combat.test.js` (a foe-first fight: one opening foe turn, then strictly alternating); the three regenerated parity fixtures show the consequence directly — `lose-apprentice` and `lose-plain` now end **alive** (`dead: true → false`, measured, declared in `FIXTURE-INVENTORY.md`) because the second consecutive foe turn no longer exists |
| 3 | One narrated line ("Initiative — you N, them M. You go first.") appears exactly once per fight in the Oracle and the fight log, pinned by a test that fails on a second appearance | `test/unit/initiative-line.test.js` test 4 (SC3): a real `fight()` + three `playerStrike()` replay narrates the line exactly once in both surfaces (re-run: 5/5 pass). Oracle html carries both d20s in `.roll` spans; the fight log's roll-free text reveals them through the existing `oracleDetailText` fold (test 3). Shared `initiativeVerdictText(e)` keeps the two modules from disagreeing |
| 4 | Samurai / slow / foresight / Acute Hearing overrides still apply to the single roll, proven by their existing tests re-targeted at the new call site | `combat.test.js` initiative tests re-targeted at `fight()`, all seven `why` branches covered (samurai, slow, knight, courtMage, foreseen, acuteHearing, senses); each verdict rendered in voice and BANNED-scanned (`initiative-line.test.js` test 1). Knight-vs-big-foe deliberately narrows to the opener (recorded in the divergence rationale) |
| 5 | The p.24 divergence is declared in `test/parity/FIXTURE-INVENTORY.md` with before/after; only the measured fixtures are regenerated; the prototype master hash is unchanged | Scan MOVED SET (3): `combat.json` `lose` (`24+31` → `24+31+51`), `lose-apprentice` (`31` → `31+51`), `lose-plain` (new `51` record, `fromAction: 2`) — all values measured, never hand-typed; `divergence-records.test.js` INIT-01 MOVED SET guard; FIXTURE-INVENTORY.md Phase 51 section; `comparables.js` untouched (`git diff --stat 2ce8b03..HEAD -- test/parity/harness/comparables.js` empty); master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged (re-run) |
| — | `npm test` fail 0; `build:www`; measurement gate | **3,351 / 0** (3,334 at phase start + 12 Plan 02 pins + 5 Plan 03; re-run by the orchestrator); `build:www` exit 0. BEFORE/AFTER under identical flags in `docs/DIFFICULTY-RETUNE.md` (`## v1.7 tuning pass (Phases 51–54)` → `### v1.7 · Phase 51 — initiative once`): solo death depth p50 4 → 4, p90 5 → 6; party p50 4 → 5, p90 6 → 7; class smoke pooled mean 3.44 → 3.80; no constants changed — the baseline Phases 52–54 inherit |

## Notes the reader should have

- **The mechanic in one sentence:** initiative now decides only whether the foe gets the opening turn; every round after that is one player action followed by one foe turn. The deleted pre-emptive branch was the double turn the user saw on device.
- **Two fixture outcomes flipped** (`lose-apprentice`, `lose-plain` end alive). That is the rule change doing exactly what it says, not drift — both are measured `after` values in declared action-path records. `combat-parity.test.js`'s dead "lose-plain must stay byte-identical" guard was rewritten honestly.
- **Scan tool caveat:** `tools/initiative-fixture-scan.mjs` Part A (round-advance predictor, the load-bearing MOVED SET) is byte-identical before and after the cut; Part B (informational first-divergent-action columns) legitimately changed for the three moved rows only — documented in the SUMMARY and FIXTURE-INVENTORY.md rather than forced to diff empty.
- `npm run boot:check` remains environment-blocked on this machine (Phase 50 note); not a gate this phase.
- `docs/DIFFICULTY-RETUNE.md`'s heading pin (`difficulty-retune-ledger.test.js`) forced the new H2 to sit immediately before `## v1.2 retune (Phase 27)`; Phases 52–54 append their H3s under it.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| INIT-01 | Complete (device confirmation rides the Phase 55 batch) | criteria 1, 2, 4, 5 |
| INIT-02 | Complete (device confirmation rides the Phase 55 batch) | criterion 3 |
