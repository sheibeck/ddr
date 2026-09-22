---
phase: 53-joiner-level-cap
plan: 02
subsystem: tuning-docs
tags: [bot-readout, measurement-gate, joiner, ledger, class-pass]

# Dependency graph
requires:
  - phase: 53-joiner-level-cap
    plan: 01
    provides: "AFTER_SHA (78572c5115014b581fb2084b7588141122d56101) — the engine cut commit (meetJoiner's cap) this plan's readouts run against"
provides:
  - "docs/DIFFICULTY-RETUNE.md's '### v1.7 · Phase 53 — Joiner level cap' H3: Rule change, Parameters, BEFORE by reference (Phase 52 AFTER, 049ab50), AFTER (three verbatim transcripts on 78572c5), Reading table (+ forced-ally level histogram row), the --party shift by design (JOIN-03), and the solo-play-untouched class-smoke identity"
  - "docs/class-pass/v17-p53-after-smoke.json — the AFTER 143-cell class-pass smoke, meta-parity true against v17-p52-after-smoke.json modulo commit, cells byte-identical"
  - "The Phase 53 measurement gate is closed: Phase 54's four-band retune inherits a committed AFTER baseline taken under Phase 52's exact bot flags on the finished Phase 53 tree"
affects: [54-difficulty-four-band-retune]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forced-ally level histogram: a scratch-only node script (never committed as a tool) that imports newRun/makeRng/forceParty/SPELL_LEVEL_TABLE via file:// URL dynamic import, computes the pre-cap Level Table draw on a throwaway rng clone (state.rngState untouched) vs the actual post-cap forceParty result on a structuredClone — proves the --party shift is exactly a level clamp, not a distribution change of anything else"
    - "Ledger H3 spliced via a Node script reading the raw CRLF file, inserting a \\n-authored section (converted to \\r\\n) directly before the pinned '## v1.2 retune (Phase 27)' marker string — guarantees byte-for-byte verbatim transcript quoting with zero manual retyping and preserves the file's CRLF convention"

key-files:
  created:
    - docs/class-pass/v17-p53-after-smoke.json
  modified:
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "The plan's acceptance criteria predicted the AFTER --party histogram would read '200 × level 1' — measured reality is 192/200 at level 1 and 8/200 refused (the pre-existing, level-independent Wilmsry-hero-meets-Magic-User-Joiner refusal in meetJoiner, unchanged by this phase and identical in the BEFORE column too). Recorded the measured 192/8 split rather than the plan's predicted literal 200, with the refusal explained as orthogonal to the level cap (meetJoiner's refusal check reads c.race/joinerChar.cls, never lvl) — a measurement correction in the same spirit as 53-01's own measured-not-typed corrections, not a deviation from any instruction."
  - "Same reasoning validates against the ALREADY-COMMITTED Phase 52 ledger's own party transcript, which shows the identical 'member forced at run start in 192/200 runs' line (BEFORE this phase's cap) — proving the 8-refused count is unrelated to Phase 53's change and confirming the histogram script's correctness independently of hand-tracing."
  - "AFTER readout ran on the docs-only HEAD (a72db01) atop AFTER_SHA (78572c5) rather than checking out AFTER_SHA directly, since `git diff --stat AFTER_SHA -- engine/ content/ tools/` was verified empty first — the plan explicitly permits 'the docs-only HEAD the run was taken on' as an equivalent measurement point. The ledger's AFTER heading itself still cites the canonical 40-hex AFTER_SHA per the plan's literal heading format."

requirements-completed: [JOIN-03, JOIN-02]

coverage:
  - id: D1
    description: "The AFTER bot readout (solo, --party, class smoke) is taken on Plan 01's feat commit under Phase 52's identical flags and quoted verbatim into the ledger; BEFORE is Phase 52's AFTER reused by reference, never re-run"
    requirement: "JOIN-03"
    verification:
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=200 (solo, byte-identical to Phase 52 AFTER); node tools/tune-difficulty.mjs --seeds=200 --party; node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p53-after-smoke.json — all three transcripts quoted verbatim in docs/DIFFICULTY-RETUNE.md's '#### AFTER — commit 78572c5115014b581fb2084b7588141122d56101' section"
        status: pass
    human_judgment: false
  - id: D2
    description: "The --party BEFORE -> AFTER shift (early-Joiner power change) is declared by design in the ledger, naming forceParty as unmodified, with the forced-ally level histogram (BEFORE spread 1-5, AFTER capped to level 1) as direct evidence"
    requirement: "JOIN-03"
    verification:
      - kind: other
        ref: "docs/DIFFICULTY-RETUNE.md's '#### The --party shift (JOIN-03) — by design' section; histogram BEFORE {1:55,2:45,3:26,4:33,5:41} vs AFTER {1:192,2:0,3:0,4:0,5:0,refused:8} quoted in the Reading table"
        status: pass
    human_judgment: false
  - id: D3
    description: "Solo play and the class-smoke are proven untouched by the cap: the AFTER smoke's cells array is byte-identical to Phase 52's AFTER, with meta-parity true on every key except commit"
    requirement: "JOIN-02"
    verification:
      - kind: other
        ref: "node -e cellsIdentical check: 'cellsIdentical true'; node -e metaParity check: 'metaParity true []'; both quoted verbatim in docs/DIFFICULTY-RETUNE.md's '#### Solo play untouched — class-smoke identity' section"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ledger H3 lands between the Phase 52 H3 and the pinned '## v1.2 retune (Phase 27)' H2; ledger heading-pin tests stay green; engine/content/tools/test untouched; master hash unchanged"
    requirement: "JOIN-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/difficulty-retune-ledger.test.js test/unit/class-pass-ledger.test.js (33/33 pass, v1.2 H2 still last); npm test (3382/3382 pass, fail 0); npm run build:www (exit 0)"
        status: pass
      - kind: other
        ref: "git diff --stat 78572c5115014b581fb2084b7588141122d56101 -- engine/ content/ tools/ test/ (empty); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-20
status: complete
---

# Phase 53 Plan 02: Joiner Level Cap — AFTER Bot Readout + Ledger Close Summary

**Closed Phase 53's measurement gate: captured the AFTER bot readout (solo, `--party`, class smoke) on Plan 01's engine cut commit under Phase 52's exact bot flags, then wrote the `### v1.7 · Phase 53 — Joiner level cap` ledger H3 declaring the `--party` early-Joiner power shift as by-design (JOIN-03) and the class-smoke cell identity as proof solo play is untouched (JOIN-02) — giving Phase 54's four-band retune a committed Phase 53 baseline.**

## Performance

- **Duration:** ~45 min (dominated by the ~21 min `--party` bot run, backgrounded while the solo readout, class smoke, and forced-ally histogram ran and the ledger prose was drafted)
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments

- **Task 1 (AFTER readout + identity + histogram):** Confirmed `git rev-parse HEAD` (`a72db01`) is a docs-only commit atop `AFTER_SHA` (`78572c5115014b581fb2084b7588141122d56101`) with `git diff --stat AFTER_SHA -- engine/ content/ tools/` empty. Ran `node tools/tune-difficulty.mjs --seeds=200` (solo) — **byte-identical to Phase 52's AFTER** on every metric (death-depth 1/4/6/9, action p50 432, identical top-3 death causes) since the bot never recruits mid-run. Ran `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p53-after-smoke.json` (143 cells, ~88s) — `cellsIdentical true` against `v17-p52-after-smoke.json`, `metaParity true []`. Launched `node tools/tune-difficulty.mjs --seeds=200 --party` in the background (~21 min wall-clock) while building the forced-ally level histogram: a scratch-only node script computing the pre-cap Level Table draw (throwaway rng clone) vs the post-cap `forceParty` result (`structuredClone`) over the identical 200-seed list — BEFORE `{1:55, 2:45, 3:26, 4:33, 5:41}`, AFTER `{1:192, 2:0, 3:0, 4:0, 5:0}` with 8/200 refused (Wilmsry hero + Magic User Joiner, level-independent, identical BEFORE and AFTER). The party run completed: death-depth 1/5/6/12 (BEFORE 1/5/7/12), action p50 580 (BEFORE 703), stuck 59/200 (BEFORE 75/200), member forced 192/200 (BEFORE 192/200), member alive at end 125/200 = 62.5% (BEFORE 153/200 = 76.5%).
- **Task 2 (ledger H3, `3e27d0a`):** Spliced the `### v1.7 · Phase 53 — Joiner level cap` H3 into `docs/DIFFICULTY-RETUNE.md` immediately after the Phase 52 H3 and before the pinned `## v1.2 retune (Phase 27)` H2 (verified by line-number grep: 1996 / 2767 / 3251), via a Node script that reads the raw CRLF file and inserts a `\n`-authored section (converted to `\r\n`) at the exact marker string — guaranteeing verbatim transcript quoting. Contains: Rule change, Parameters, `#### BEFORE — by reference: Phase 52 AFTER, commit 049ab5011212a8c6a4bea0f7ee4757dd1923c1b7`, `#### AFTER — commit 78572c5115014b581fb2084b7588141122d56101 (Joiner level capped by floor depth)` with all three transcripts verbatim, `#### Reading (BEFORE → AFTER)` (12 rows + the forced-ally histogram row), `#### The --party shift (JOIN-03) — by design`, `#### Solo play untouched — class-smoke identity`. `node --test test/unit/difficulty-retune-ledger.test.js test/unit/class-pass-ledger.test.js` — 33/33 pass, v1.2 H2 still last.
- **Task 3 (gates + this SUMMARY):** all gates re-verified at HEAD (see below).

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2 (AFTER readout, histogram, ledger H3)** — `3e27d0a` (docs)
2. **Task 3 (SUMMARY + gates)** — (this commit) (docs)

**Plan metadata:** (this commit or the next) — SUMMARY + STATE + ROADMAP + REQUIREMENTS

## Files Created/Modified

- `docs/class-pass/v17-p53-after-smoke.json` (new) — the AFTER 143-cell class-pass smoke, `meta.commit` `a72db01`, cells byte-identical to Phase 52's.
- `docs/DIFFICULTY-RETUNE.md` — new `### v1.7 · Phase 53 — Joiner level cap` H3 (Rule change, Parameters, BEFORE by reference, AFTER transcripts, Reading table + histogram row, the `--party` shift by design, the class-smoke identity).

## Decisions Made

- Recorded the measured 192/8 forced-ally split (not the plan's predicted literal "200 × level 1") — see key-decisions above for the full accounting: the 8-refused count is the pre-existing, level-independent Wilmsry-vs-Magic-User Joiner refusal, identical in both BEFORE and AFTER, and independently confirmed by Phase 52's own already-committed party transcript showing the same 192/200 figure before this phase's cap even existed.
- Ran the AFTER readout on the docs-only HEAD (`a72db01`) atop `AFTER_SHA`, per the plan's explicit "or the docs-only HEAD the run was taken on" allowance, after confirming the engine/content/tools diff against `AFTER_SHA` was empty.
- Sequenced solo → class smoke → `--party` (backgrounded) rather than running `--party` first, since the machine has 4 cores and the smoke's 4 workers would otherwise contend with the party run's single-threaded loop; this let the smoke and histogram both finish (~90s and instant respectively) well before the ~21-minute party run needed polling.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, no missing critical functionality, no blocking issues encountered. The "Decisions Made" items above are measurement corrections to the plan's own predicted literal (histogram AFTER = 200 vs measured 192+8 refused), consistent with this phase's "measured, never hand-typed" discipline (mirroring 53-01's own three measurement corrections) — not deviations from any instruction, rule, or prohibition.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — plan executed exactly as written; the histogram's refused-count finding is a measurement correction to a predicted literal, fully disclosed above and consistent with the class-smoke identity and solo-readout evidence that the cap never fires outside `--party`.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 54's four-band retune has a fully committed Phase 53 AFTER baseline (`docs/DIFFICULTY-RETUNE.md`'s Phase 53 H3, `docs/class-pass/v17-p53-after-smoke.json`) measured under Phase 52's exact bot flags on the finished Phase 53 tree — Phase 54 measures against THIS AFTER, not Phase 52's.
- The deferred idea (teaching the bot to accept in-run Joiners, making the class smoke Joiner-sensitive) remains a Phase 54 measurement candidate, noted in the ledger's closing paragraph.
- No blockers. `npm test` 3382/3382, `npm run build:www` green, master hash and every gated file (`engine/`, `content/`, `tools/`, `test/`) untouched this plan.

## Success criteria → proof

| # | Success criterion (ROADMAP.md Phase 53 / 53-01-PLAN.md's own success_criteria) | Proof |
|---|---|---|
| SC1 | A level-5-rolled Joiner met on floor 2 arrives as level 2 with an unchanged draw count. | `test/unit/joiner-level-cap.test.js`: `SC1: a d10 of 9 (Level Table 5) met on floor 2 arrives as level 2 …` (53-01-SUMMARY.md). |
| SC2 | Abilities and wp of the capped Joiner equal a natively-rolled level-2 Joiner's. | `test/unit/joiner-level-cap.test.js`: `SC2: a floor-2 capped Joiner (rolled 5) is deepStrictEqual to a natively-rolled level-2 Joiner …` (53-01-SUMMARY.md). |
| SC3 | `joinerMet`/`joinerRefused` narration and the rail card render unchanged. | `test/unit/joiner-level-cap.test.js`: `SC3: joinerMet and joinerRefused render byte-identical …`, `SC3: the rail card and the Company panel read the SAME capped lvl field …` (53-01-SUMMARY.md). |
| SC4 | The moved parity set is measured (zero) and declared; master hash and every fixture untouched. | Scan Part B diff empty; 42/42 parity pass; 31-site exposure replay 0 joinerMet everywhere; `test/parity/FIXTURE-INVENTORY.md`'s `## Phase 53` section; `test/parity/divergence-records.test.js`'s `JOIN-02` guard (53-01-SUMMARY.md). |
| SC5 | A `tune-classes` smoke before/after (plus solo and `--party` readouts) records the early-Joiner power shift in `docs/DIFFICULTY-RETUNE.md` — the shift in the `--party` column (by design, `forceParty` unmodified), the class smoke the solo-play-untouched identity. | `docs/DIFFICULTY-RETUNE.md`'s `### v1.7 · Phase 53 — Joiner level cap` H3: `#### The --party shift (JOIN-03) — by design` (party death-depth p90 7→6, action p50 703→580, stuck 75→59, member-alive-at-end 76.5%→62.5%, histogram BEFORE `{1:55,2:45,3:26,4:33,5:41}` → AFTER `{1:192,…}`); `#### Solo play untouched — class-smoke identity` (`cellsIdentical true`, `metaParity true []`); `docs/class-pass/v17-p53-after-smoke.json`. |
| — | The measurement gate is closed: Phase 54 has a Phase 53 AFTER baseline under Phase 52's exact flags. | Commit `3e27d0a`; `docs/DIFFICULTY-RETUNE.md`'s `#### AFTER — commit 78572c5115014b581fb2084b7588141122d56101`. |

## Gates (re-verified at HEAD, Task 3)

```
npm test 2>&1 | tail -12
  1..3377
  # tests 3382
  # suites 0
  # pass 3382
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 37417.1761
```

```
npm run build:www
  [build-www] stamped version 1.5.0 (6) into www/index.html
  [build-www] wrote www/index.html (mazeworld.html + injected import map)
  [build-www] done
  exit 0
```

```
git hash-object test/parity/prototype-master.js.txt
  a1f4d0dc29782218d8e5aab65bc5989c33f917f0
```

```
git diff --stat 78572c5115014b581fb2084b7588141122d56101 -- engine/ content/ tools/ test/
  (empty)
```

```
node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt
  (empty)
```

```
git log --oneline 6bf6d0a..HEAD
  3e27d0a docs(53-02): Phase 53 AFTER bot readout + ledger H3 (BEFORE by reference to 049ab50; --party shift declared by design; class smoke identity) (JOIN-03)
  a72db01 docs(53-01): complete joiner-level-cap plan 01 — gates + summary
  78572c5 feat(53-01): Joiner level capped by floor depth — meetJoiner min(rolled, depth), SC1-SC3 pins, measured zero fixture moves declared + JOIN-02 guard (JOIN-02, JOIN-03)
```

## Class-smoke identity

```
node -e "const j=require('./docs/class-pass/v17-p53-after-smoke.json');console.log(j.cells.length, j.meta.seeds, j.meta.commit)"
  143 5 a72db01

node -e "... metaParity ..."
  metaParity true []

node -e "... cellsIdentical ..."
  cellsIdentical true
```

`npm run boot:check` is environment-blocked on this machine (pre-existing finding, `.planning/STATE.md`'s open Blockers/Concerns) and was NOT run as a gate.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. Meet a Joiner on floor 1 — the rail card's roll text reads `skill level I`, and after accepting, the Hero tab's Company panel shows the same level; on floor 2 it never exceeds `II`.
2. An old save carrying a level-V ally loads and the Company panel still shows level V (tolerant load, no reconcile — only NEW Joiners are capped).
3. The Oracle's `joinerMet` line and the Wilmsry refusal line read exactly as before (no new copy) — a capped-level Joiner's recruitment line reads identically to a native same-level Joiner's.

## Self-Check: PASSED

- FOUND: docs/class-pass/v17-p53-after-smoke.json
- FOUND: docs/DIFFICULTY-RETUNE.md (Phase 53 H3 present between Phase 52 H3 and v1.2 H2)
- FOUND: .planning/phases/53-joiner-level-cap/53-02-SUMMARY.md
- FOUND commit: 3e27d0a (Tasks 1+2)
