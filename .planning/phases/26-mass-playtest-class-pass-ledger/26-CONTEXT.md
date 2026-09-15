# Phase 26: Mass Playtest & Class-Pass Ledger - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas, all recommendations accepted by the user

<domain>
## Phase Boundary

Capture the AFTER matrix on the post-identity-pass, post-feedback engine with the Phase 22 harness at the SAME volume, seed list, and bot parameters as BEFORE; rank every sub-class and race with a written fun-band verdict; assert zero "cannot act" cells; complete `docs/CLASS-PASS.md` (AFTER section, comparison tables, outliers with suggested levers, a handoff block for Phase 27). **This phase measures and judges. It changes no engine, content, or tool code.** The harness (`tools/`) is byte-identical to the BEFORE pin (`git diff 5565b22 -- tools` is empty), so parameters can be identical.

Requirements: PLAY-02, PLAY-03.

BEFORE facts: engine pin `5565b22`; natural matrix 143 cells × 40 seeds (`i*7919+1`), depth-20 slice 143 × 10; `Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1` (and `seeds=10 … startDepth=20`); JSON at `docs/class-pass/before.json` / `before-depth20.json` with `meta`, `cells[]` (`cls, sub, race, n, completed, stuck, meanDepth, p50Depth, p90Depth, reach5, reach10, meanKills, meanLevel, meanActions, meanFloorsGained, p50FloorsGained, meanEncountersSurvived, topCauses, rank`) and `rollups.{byClass,bySub,byRace}`. BEFORE headline: Thief 3.42 / Fighter 3.05 / Magic User 2.44 mean depth; bottom five subs all casters; Wilmsry 3.93 far ahead of races.

</domain>

<decisions>
## Implementation Decisions

### The fun band (PLAY-02)
- **Rule-based bands relative to the AFTER natural matrix's overall mean death depth μ** (mean over all 143 cells' `meanDepth`, or over all 5,720 runs — state which; prefer runs): **too weak** < 0.75μ; **fine** 0.75μ–1.35μ; **too strong** > 1.35μ. **Cannot act** = a cell with `meanKills < 0.5` OR `stuck > 0`.
- **"Too strong" is not "bad."** Every out-of-band row (sub-class or race) additionally gets an **accept / revisit** call with a one-sentence reason. The user's rule: unequal is fine, unfun is not — a strong-but-fun identity is accepted with the sentence; only rows judged unfun or degenerate (e.g. one mechanic dominates every fight, or the bad never bites) go to the revisit list.
- **Granularity:** verdicts per sub-class (24 rows) and per race (6 rows, Human included as the control), each row showing BEFORE mean, AFTER mean, delta, reach-5 BEFORE/AFTER, band, accept/revisit + reason. The 143 cells go in an **appendix listing only cells outside the band** (with their band), plus a count of in-band cells.
- **Pairing:** same seed list, same parameters, same commit-pin discipline. Deltas are reported per row with the standing caveat that engine changes shift downstream dice, so pairing is by seed, not by path.

### The capture and the ledger (PLAY-02, PLAY-03)
- **Capture both slices at BEFORE volume:** natural 143 × 40 and depth-20 143 × 10, `--workers 4 --max-actions 5000`, engine pinned to the current HEAD (post-Phase-25); prove `git diff --quiet <pin> -- engine content src mazeworld.html tools` is clean before launching and after the final commit. JSON to `docs/class-pass/after.json` and `docs/class-pass/after-depth20.json`. Long runs in the background with an `EXIT=` sentinel and bounded polling (Phase 22 precedent, ~12 min + ~3 min on 4 workers).
- **AFTER section = verbatim transcripts + machine-derived comparison tables.** A small dev script `tools/class-pass-diff.mjs` (dev-only, zero deps, never shipped) reads `before.json` + `after.json` (and the depth-20 pair), computes μ, bands, per-sub/per-race rows with deltas, the out-of-band cell appendix, and prints Markdown; the ledger pastes its output. Numbers are never retyped. The accept/revisit sentences are the one hand-written column.
- **Depth-20 slice:** reported in the AFTER section as **Phase 27's yardstick** under the user's depth-20 decision (reaching 20 is a unicorn run; past 20 no dial-back, no forced death): `meanFloorsGained` / `meanEncountersSurvived` at a forced depth-20 start, by sub-class and race, BEFORE vs AFTER. **No fun-band verdicts on the deep slice.**
- **Ledger structural test** `test/unit/class-pass-ledger.test.js`: BEFORE / Rulings / AFTER / Outliers / Handoff sections present; the good/bad table has 30 rows; every `### Ruling:` heading for IDENT-05/06/07/10 exists; the AFTER section's commit hash equals `after.json`'s `meta.commit`; `after.json` and `before.json` share `seeds`, `seedList`, `maxActions`, `startDepth`, `exploreBudget`, and the `bot` line modulo the commit; **zero cells with cannot-act** in `after.json` (hard assertion — see below).

### Outliers and the handoff (PLAY-03 → Phase 27 / v1.3)
- **No engine changes in this phase.** Each **revisit** row gets a one-line **suggested lever** (which good or bad to touch, and in which direction) in the Outliers section as a candidate for v1.3. Measuring and judging only.
- **Wilmsry is judged by its AFTER number like every other row.** Still far ahead after the Joiner refusal → revisit list with the deferred numeric levers (parley +4 → lower; heal 2× → 1.5×). Gap closed → accepted.
- **"Cannot act" is a hard gate:** if any AFTER cell has `meanKills < 0.5` or `stuck > 0`, the plan STOPS and reports the cell(s) with their top death causes instead of judging around it — that failure is exactly what this milestone exists to remove. (Expected: zero; Phase 22's bot fixes and Phase 23's caster fixes were built for this.)
- **Handoff block for Phase 27** at the end of the ledger: AFTER natural roll-ups by class/sub/race, the overall μ and the reach table (≥5/≥10/≥20), the depth-20 slice roll-ups, and the list of accepted-but-strong rows — so the retune knows the player power it is tuning against.

### Claude's Discretion
- Whether μ is computed over runs or over cells (state it in the script header and the ledger).
- Exact Markdown layout of the comparison tables; column order.
- Whether `tools/class-pass-diff.mjs` also emits a JSON verdict file (`docs/class-pass/verdicts.json`) for the ledger test to read — recommended, so the test checks data, not prose.
- Wording of accept/revisit sentences (sarcastic-friendly but factual; this is a design ledger, not player copy — no voice-scan requirement, but keep it family-friendly anyway).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/tune-classes.mjs` (Phase 22): `--seeds --workers --max-actions --start-depth --json --out`; JSON shape above; ranked text report; grep-stable `Bot:` line.
- `tools/lib/class-matrix.mjs`: enumeration, aggregation, ranking (documented tie-break), roll-ups — reuse its helpers in the diff script rather than re-deriving.
- `docs/CLASS-PASS.md`: sections `## Bot proxy`, `## How to reproduce`, `## BEFORE — commit 5565b22…`, `## Outliers / Findings (Phase 22)` (+ Phase 23/24 notes), `## Rulings (Phase 24 — PLAY-03)` (filled: 11 sub rulings, 3 race rulings, dagger KEEP, Freeze payout, 30-row good/bad table, FID-07 posture, Phase 24 smoke), `## AFTER — commit \`<hash>\` (Phase 26 — PLAY-02)` (placeholder to fill).
- `docs/class-pass/before.json`, `before-depth20.json`.
- `docs/DIFFICULTY-RETUNE.md`: ledger discipline (commit pin, identical Bot line, background runs with sentinel).
- `test/unit/class-matrix.test.js`: test patterns for the harness.
- Phase 22's `22-04-SUMMARY.md`: how the BEFORE capture was run (timings, sentinel files, polling).

### Established Patterns
- Dev tools are plain Node ESM under `tools/`, zero deps, never shipped, never a CI gate (the ledger test asserts STRUCTURE and the cannot-act invariant, not balance numbers).
- Ledgers transcribe bot output verbatim with a commit pin.
- Verdict prose is the human/editorial layer; numbers are machine-derived.

### Integration Points
- New `tools/class-pass-diff.mjs`; new `docs/class-pass/after.json`, `after-depth20.json`, optionally `verdicts.json`; `docs/CLASS-PASS.md` AFTER + Outliers + Handoff sections; new `test/unit/class-pass-ledger.test.js`.

</code_context>

<specifics>
## Specific Ideas

- The headline the user wants answered: which classes over/under-perform now, and did the caster problem go away? Lead the AFTER section with the by-class roll-up BEFORE→AFTER and the bottom-five / top-five sub-classes, then the race table.
- Zero cannot-act is the milestone's promise; make it the first line of the AFTER section.
- Keep the verdict column honest: "too strong, accepted — the Ninja's opener is the whole fantasy" is a valid row.

</specifics>

<deferred>
## Deferred Ideas

- Any engine tuning suggested by the revisit list — v1.3 (or Phase 27 only where it is a global difficulty dial, never a class-specific change).
- Wilmsry numeric trims — v1.3 if still an outlier.
- A per-cell fun band (143 verdicts) — not needed; the appendix lists out-of-band cells.

</deferred>
