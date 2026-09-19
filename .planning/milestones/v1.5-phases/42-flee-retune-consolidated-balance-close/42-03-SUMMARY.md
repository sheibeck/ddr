---
phase: 42-flee-retune-consolidated-balance-close
plan: 03
subsystem: tools
tags: [tuning-bot, spells, niche, usage-tallies, pick-rates, class-matrix, smoke, ledger, deferred-uat]

# Dependency graph
requires:
  - phase: 42-flee-retune-consolidated-balance-close plan 02
    provides: "tools/lib/tuning-bot.mjs#chooseAbility/chooseCombatItem/chooseFieldItem/hardestFoeIndex/hardFight/itemLabel/BOT_TACTICS/RUN_FLAGS — the bot's ability/item tactics and the shipped run-rules flags this plan's spell rules and usage tallies build directly on"
  - phase: 40-spell-rework plan 01/02
    provides: "content/spells.js's niche/kind/dmg/onHit/aoe/lesser data-flag contract, dealsDamage(sp), the real Ice DOT/Lesser Summon mechanics chooseSpell's new rules score against"
provides:
  - "tools/lib/tuning-bot.mjs#bestBurstExpected(state) + chooseSpell's niche-keyed DOT-vs-toughness skip and burst-finish score (never a spell name)"
  - "tools/lib/tuning-bot.mjs#decideAction's Map the Floor field step (ctx.mappedDepth, BOT_TACTICS.mapBankRatio) + observe(ctx, events, stateAfter = null)'s new optional third argument"
  - "tools/lib/tuning-bot.mjs#makeTallies().usage + tallyUsage(tallies, action, events, before, after) — the per-run ability/spell/item pick tally, wired into playRun"
  - "tools/lib/class-matrix.mjs#rowFromRun.usage, summarizeRows(...).usage (aggregateUsage over completed rows), rollups' usage pass-through, buildReport meta.runFlags, formatUsageMarkdown(report) (the four-heading pick-rate Markdown renderer)"
  - "tools/class-pass-usage.mjs (new CLI): --after PATH [--deep PATH] -> Markdown pick-rate tables, byte-stable"
  - "docs/class-pass/v15-tactics-smoke.json (143 cells x 3 seeds, 0 stuck, 0 cannot-act); docs/CLASS-PASS.md's ### Phase 42 tactics (BAL-01 second half) addendum; the four deferred-to-Phase-42 ledger notes closed in docs/ABILITIES.md, docs/GEAR-BALANCE.md (x2), docs/GEAR-SLOTS.md (x2), docs/SPELLS.md"
affects: [42-04-consolidated-after-matrix]

tech-stack:
  added: []
  patterns:
    - "bestBurstExpected(state) is computed ONCE per chooseSpell call (after target/nFoes) and feeds two independent niche-keyed rules — a DOT-vs-toughness skip (target.wp <= burstBest + dotToughMargin) and a burst-finish score bump (350+expected when expected >= target.wp) — both reading sp.niche, never sp.n or a hardcoded spell list (research Pitfall 2 discipline, extended from kind to niche)"
    - "observe(ctx, events, stateAfter = null) is the SECOND optional-third-argument extension to this module's event-observer contract — every pre-Phase-42 two-argument call site (every test in the repo) keeps working unchanged; only playRun's own call site passes the real post-action state, read exactly once (on floorMapped) behind an explicit presence guard"
    - "tallyUsage detects a real spell cast via a spellsUsed-delta check (after.c.spellsUsed === before.c.spellsUsed + 1) rather than a dedicated event, because none exists; this correctly excludes scroll-cast spells (readScroll saves/restores spellsUsed around its own free castSpell call) and refused casts (noChargesLeft/spellResisted never bump spellsUsed) with zero extra engine surface"
    - "aggregateUsage(rows) treats a missing r.usage field as zero uses everywhere (not a crash) so every pre-existing synthetic-state test row in class-matrix.test.js, and every pre-Phase-42 JSON report (the v1.5 BEFORE pin), renders/aggregates cleanly without a migration"
    - "formatUsageMarkdown reads its per-class/per-sub eligible-run denominators off rollups.byClass/bySub's own pre-existing completed sums rather than re-deriving them from report.cells, so the renderer needs no new report field beyond usage/runFlags"

key-files:
  created:
    - tools/class-pass-usage.mjs
    - test/unit/class-pass-usage.test.js
    - docs/class-pass/v15-tactics-smoke.json
  modified:
    - tools/lib/tuning-bot.mjs
    - tools/lib/class-matrix.mjs
    - test/unit/bot-tactics.test.js
    - test/unit/tuning-bot.test.js
    - test/unit/class-matrix.test.js
    - docs/CLASS-PASS.md
    - docs/ABILITIES.md
    - docs/GEAR-BALANCE.md
    - docs/GEAR-SLOTS.md
    - docs/SPELLS.md

key-decisions:
  - "The Summoner Lesser-Summon-vs-Summon tiering the plan asks for needed NO tuning-bot.mjs code change at all — Lesser Summon's mere presence in the SPELLS table (Phase 40, kind:'summon', lvl:1) already makes the pre-existing bestCastableSummonIdx (unmodified since Phase 22) pick the highest-lvl castable summon spell, which is Lesser Summon at level 1 and Summon once the caster outlevels it. This plan's contribution here is TWO new pinned tests (tuning-bot.test.js) proving/documenting behavior that Phase 40's content change already produced — not a code fix."
  - "formatUsageMarkdown's exact table/column layout and the 'Top picks by sub-class' label(uses/runs) format are Claude's Discretion per the plan's own instruction (mdTable helper local to class-matrix.mjs, never imported from class-pass-diff.mjs) — the plan specified the four headings and the general shape but not literal column text; chosen to mirror class-pass-diff.mjs's own Markdown style as closely as possible for a familiar reading experience."
  - "The class-pass-usage.mjs CLI test file uses docs/class-pass/v15-before.json (not the generic before.json) per the plan's own literal instruction, since v15-before.json is the exact BEFORE pin that predates the usage field this plan adds — proving the renderer's zero-usage degradation path against a real, load-bearing project artifact rather than a synthetic fixture."
  - "The GEAR-BALANCE.md pendingHazard note (line ~691) is closed as 'this note's own scope' (WHEN-to-use-a-carried-tool timing) while explicitly flagging that a store-BUY policy for tools remains unaddressed — a narrower, more honest closure than a blanket 'landed', since chooseStorePurchase still only scans weapon/armor lines."

requirements-completed: []

coverage:
  - id: D1
    description: "chooseSpell scores by niche, kind-generic and name-free: a niche='dot' spell (Acid/Ice) is skipped when the target's wp is within bestBurstExpected(state) + BOT_TACTICS.dotToughMargin of surviving a burst outright; a niche='burst' spell with a dmg field whose expected damage already meets/exceeds the target's wp scores 350+expected instead of 300+expected; Lesser Summon opens a fight at level 1 (Summon once castable); Map the Floor casts once per floor when charges exceed BOT_TACTICS.mapBankRatio of maxCharges, gated by the new observe(ctx, events, stateAfter) third argument"
    requirement: "BAL-01"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js (DOT-vs-toughness boundary test, burst-finish scoring test via chooseSpell's own .score field, Summoner Lesser-Summon-vs-Summon tiering test — 4 new tests)"
        status: pass
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (Map the Floor decideAction cases x4, observe's new stateAfter signature — 5 new tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every ability/spell/item USE is tallied per run (tallies.usage), carried per row (rowFromRun), aggregated per cell/rollup as { uses, runs } over completed rows only (summarizeRows/rollups), and rendered as a byte-stable four-heading Markdown pick-rate report by tools/class-pass-usage.mjs — never NaN, degrading to an honest all-zero render on a report with no usage field at all"
    requirement: "BAL-02"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (tallyUsage matrix — abilityUsed/itemUsed/toolUsed/scrollCast/castSpell-delta, 8 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/class-matrix.test.js (rowFromRun.usage, summarizeRows.usage, rollups usage pass-through, meta.runFlags, formatUsageMarkdown x3 — 8 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-usage.test.js (CLI headings/determinism/--deep/error-handling/purity — 6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 143-cell x 3-seed smoke (docs/class-pass/v15-tactics-smoke.json) proves zero stuck runs and zero cannot-act cells with the full tactics set on, and shows non-zero ability (3464 uses), spell (2254 uses), and item (383 uses) usage; docs/CLASS-PASS.md gains a ### Phase 42 tactics addendum transcribing every new rule/number verbatim; the four deferred-to-Phase-42 ledger notes are closed with cross-links"
    verification:
      - kind: other
        ref: "node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000 --out docs/class-pass/v15-tactics-smoke.json (67.8s, 0 of 429 stuck); node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-tactics-smoke.json (cannot-act cells: 0 of 143)"
        status: pass
      - kind: other
        ref: "grep -c '^### Phase 42 tactics' docs/CLASS-PASS.md == 1; grep -c '^## ' docs/CLASS-PASS.md == 9; grep -c 'Phase 42 tactics' across docs/ABILITIES.md/GEAR-BALANCE.md/GEAR-SLOTS.md/SPELLS.md all >= 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The plan gate holds: npm test 2996/2996 (# fail 0); master hash unchanged (a1f4d0dc29782218d8e5aab65bc5989c33f917f0); test/parity/fixtures untouched; docs/class-pass/ carries no regenerated pin (only the new v15-tactics-smoke.json); the BEFORE pin's own cannot-act gate still reads 0 of 143"
    verification:
      - kind: unit
        ref: "npm test (2996/2996, # fail 0); git hash-object test/parity/prototype-master.js.txt; git status --porcelain test/parity/fixtures (empty); git status --porcelain docs/class-pass (only the new smoke JSON, untracked); node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-before.json (cannot-act cells: 0 of 143)"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-09-18
status: complete
---

# Phase 42 Plan 03: Bot Casts by Niche, Usage Tallies, and the Tactics Smoke Summary

**`chooseSpell` now scores DOT-vs-burst by target toughness and finish potential (niche-keyed, never a spell name), Map the Floor casts once per floor, every ability/spell/item use is tallied per run and rendered as a byte-stable Markdown pick-rate report by the new `tools/class-pass-usage.mjs`, and a 143×3 smoke with the full tactics set on proves zero stuck runs and zero cannot-act cells — better than the v1.5 BEFORE pin's own 40-seed reading.**

## Performance

- **Duration:** ~100 min
- **Tasks:** 3
- **Files modified:** 13 (3 new, 10 modified)

## Accomplishments

### Spells by niche

- `bestBurstExpected(state)`: the highest `expectedDamage(sp)` over every castable `niche === "burst"` spell carrying a `dmg` field (Death excluded — no `dmg`) — 0 when none qualify. Computed once per `chooseSpell` call.
- **DOT-vs-toughness**: a castable `niche === "dot"` spell (Acid, Ice) is skipped when `target.wp <= bestBurstExpected(state) + BOT_TACTICS.dotToughMargin` (1) — a DOT is worth its multi-round tail only against a foe tough enough to outlast a burst outright. Measured live: with Fireball (expected 15) and Acid (expected 9, scored ×2 = 18) known, at `target.wp = 16` (the closed boundary) Acid is skipped and Fireball wins by elimination (315); at `wp = 17` Acid is kept and outscores Fireball's plain 315 with its own 318.
- **Burst-finish**: a castable `niche === "burst"` spell with `dmg` whose plain expected damage already meets/exceeds the target's current `wp` scores `350 + expected` instead of `300 + expected` — a likely one-shot finish outranks every other DAMAGE-tier pick, but never a KILL-tier spell (400+).
- **Lesser Summon opener / Summon at higher level**: no code change needed — Lesser Summon's presence in the Phase-40 SPELLS table already makes the pre-existing `bestCastableSummonIdx` pick it at level 1 and Summon once castable; two new tests document/pin this.
- **Map the Floor, once per floor**: out of combat, after the scroll step and before the exit/explore fallback, a Magic User on an unmapped floor (`state.floor.depth !== ctx.mappedDepth`) with charges to spare (`> maxCharges(c) * BOT_TACTICS.mapBankRatio`) casts the castable `kind === "reveal"` spell. `makeBotContext` gains `mappedDepth: null`; `observe(ctx, events, stateAfter = null)` gains an optional third argument, read only on `floorMapped`, to set `ctx.mappedDepth = stateAfter.floor.depth` — every pre-existing two-argument `observe()` call site (every other test in the repo) keeps working unchanged.

### Usage tallies and the pick-rate renderer

- `makeTallies().usage` = `{ abilities: {}, spells: {}, items: {} }`; `tallyUsage(tallies, action, events, before, after)` increments `usage.abilities[key]` on `abilityUsed`, `usage.items[itemLabel(item)]` on `itemUsed`, `usage.items["tool:" + tool]` on `toolUsed`, `usage.items.scroll` on `scrollCast` (a scroll is an item use, never a spell use — `readScroll` saves/restores `c.spellsUsed` around its own free cast), and `usage.spells[SPELLS[idx].n]` on a `castSpell` action whose `after.c.spellsUsed === before.c.spellsUsed + 1` (the one signal a cast actually happened; a refused cast never bumps `spellsUsed` and tallies nothing). Wired into `playRun` right after `tallyEvents`.
- `tools/lib/class-matrix.mjs`: `rowFromRun.usage` carries the run's tally straight through; `summarizeRows(rows).usage` = `aggregateUsage(completed)` — each category's labels summed to `{ uses, runs }` in sorted key order, `{}` (never null) with zero completed rows, and null-safe against rows carrying no `usage` field at all (every pre-existing synthetic test row, and every pre-Phase-42 JSON report). `rollups`' byClass/bySub/byRace/pooled tables get `usage` for free. `buildReport` gains `meta.runFlags = RUN_FLAGS` — additive, outside `class-pass-diff.mjs`'s `PARITY_FIELDS` list, so the frozen `Bot:` parameter-parity gate is unaffected.
- `formatUsageMarkdown(report)`: four Markdown sections in order — `### Pick-rates — abilities` (one row per `ABILITIES` catalog entry), `### Pick-rates — spells` (one row per `SPELLS` table entry), `### Pick-rates — items` (every label seen, sorted uses desc then label asc), `### Top picks by sub-class` (one row per `rollups.bySub`, its top three picks across all three categories). Every rate fixed to 2 decimals, `0.00` rather than `NaN` when nothing was used; a report with no `usage` field at all (the v1.5 BEFORE pin) renders every table at zero without throwing.
- `tools/class-pass-usage.mjs` (new CLI): `--after PATH [--deep PATH]` prints `formatUsageMarkdown` (and, with `--deep`, a second `## Pick-rates — depth-20 slice` block); byte-identical across two runs on the same input; a missing/unreadable `--after` exits 2 with a usage message.

### The 143×3 tactics smoke and the ledger

- `node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000 --out docs/class-pass/v15-tactics-smoke.json` — 429 runs, **0 stuck**, 67.8s wall time, engine commit `baf6db7`. `class-pass-diff.mjs --gate` reads **cannot-act cells: 0 of 143** (better than the Phase 39 gear smoke's 1-of-143 reading). Pooled usage: 3464 ability uses (18 distinct abilities), 2254 spell uses (13 distinct spells including Lesser Summon at 257 uses/47 runs), 383 item uses (16 distinct labels including all three tool kinds) — every category proven reachable in real play.
- `docs/CLASS-PASS.md` gains `### Phase 42 tactics (BAL-01 second half)` at the end of `## Bot proxy (HARN-02)` (H2 count stays 9): run flags, the abilities policy, the items policy + `BOT_TACTICS` table, the two new spell rules with the measured boundary example, the refusal-block safety net, the usage-tally mechanism, and the full smoke readout (pooled table vs the v1.5 BEFORE pin, the cannot-act line, and the pasted three-category `class-pass-usage` render).
- The four "deferred to Phase 42" ledger notes are closed with a cross-link to the new addendum: `docs/ABILITIES.md` (bot ability policy), `docs/GEAR-BALANCE.md` (item-USE tactics section + the `pendingHazard` note, honestly scoped — the timing rule is landed, a store-BUY policy for tools is not), `docs/GEAR-SLOTS.md` (the worn-slot run flag + the wear-never-swap policy, ×2 mentions), `docs/SPELLS.md` (niche-by-niche casting tactics).

## Task Commits

1. **Task 1: chooseSpell by niche, Map the Floor once per floor, Lesser Summon proof** - `d0d173d` (feat)
2. **Task 2: Usage tallies per run/cell/rollup, meta.runFlags, formatUsageMarkdown, class-pass-usage CLI** - `baf6db7` (feat)
3. **Task 3: 143×3 tactics smoke, CLASS-PASS addendum, close the four deferred ledger notes** - `d53c1c0` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in this project's config, but per this run's instructions the orchestrator owns STATE.md/ROADMAP.md writes)

## Files Created/Modified

- `tools/lib/tuning-bot.mjs` — `bestBurstExpected`, `chooseSpell`'s DOT-skip/burst-finish, the Map-the-Floor field step, `makeBotContext.mappedDepth`, `observe`'s new third argument, `makeTallies().usage`, `tallyUsage`, `playRun`'s wiring
- `tools/lib/class-matrix.mjs` — `rowFromRun.usage`, `aggregateUsage`, `summarizeRows(...).usage`, `buildReport meta.runFlags`, `formatUsageMarkdown`
- `tools/class-pass-usage.mjs` (new) — the pick-rate CLI
- `test/unit/tuning-bot.test.js`, `test/unit/bot-tactics.test.js`, `test/unit/class-matrix.test.js` — extended pins (17 new tests total across the three files)
- `test/unit/class-pass-usage.test.js` (new) — 6 CLI tests
- `docs/class-pass/v15-tactics-smoke.json` (new) — the 143×3 smoke
- `docs/CLASS-PASS.md`, `docs/ABILITIES.md`, `docs/GEAR-BALANCE.md`, `docs/GEAR-SLOTS.md`, `docs/SPELLS.md` — the addendum + four closed ledger notes

## Decisions Made

See frontmatter `key-decisions` — the Lesser Summon tiering needing zero code change (Phase 40's content change already produced it), `formatUsageMarkdown`'s discretionary table/column layout, using `v15-before.json` specifically for the CLI's zero-usage test, and the narrower/more-honest closure of the `pendingHazard` GEAR-BALANCE.md note are all recorded there with rationale.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep/`node -e` check in both tasks' `<acceptance_criteria>` blocks passed on the first or second attempt (one test assertion in `class-matrix.test.js` needed a line-counting fix — a self-authored test bug, not a production-code issue — corrected before the file was committed).

## Issues Encountered

None beyond the self-authored test-assertion fix noted above (fixed before commit, part of the green suite at every commit boundary).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. This plan is bot/tooling-only (`tools/`, `test/`, `docs/` — no `mazeworld.html`/`src/browser` edits, no `npm run build:www` needed): **nothing device-testable** — the tuning bot and its Markdown renderer never run on a Pixel 7, and this plan changes no player-facing behavior. Recorded here for the milestone-close aggregated Pixel 7 checklist as an explicit "none" entry:

1. None — dev harness and ledger docs only; the Pixel 7 checklist gains nothing from this plan.

## Corrections to CONTEXT

None — the plan's own `<domain>`/`<decisions>` sections held throughout; no assumption in 42-CONTEXT.md or 42-03-PLAN.md needed correction.

## Next Phase Readiness

Plan 04 (the consolidated AFTER matrix) can run directly against this plan's output:

- **AFTER commands** (per 42-CONTEXT.md's "ONE AFTER matrix" decision, same harness/seed counts as the BEFORE pins):
  - `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/v15-after.json`
  - `node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/v15-after-depth20.json`
- **Expected wall time**: this smoke's 67.8s at seeds=3 extrapolates to roughly 67.8 × (40/3) ≈ **905s (~15 minutes)** for the natural 40-seed run alone (plus the depth-20 slice, likely a few more minutes at 10 seeds) — comfortably past a 10-minute foreground tool timeout. **Run the natural AFTER matrix in the background with a log file**, not as a foreground command.
- `node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-after.json` should read `cannot-act cells: 0 of 143` (this smoke already proved 0 of 143 at 3 seeds with the same tactics set).
- `node tools/class-pass-usage.mjs --after docs/class-pass/v15-after.json` is the real 40-seed pick-rate reading BAL-02 needs — this plan's own 3-seed render (pasted into the CLASS-PASS.md addendum) is explicitly a reachability proof, not the final number.
- `meta.runFlags` is present on both AFTER JSONs automatically (via `buildReport`) — Plan 04 does not need to do anything extra to surface it in the ledger.
- No blockers. `npm test`: 2996/2996, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). `test/parity/fixtures` untouched. `docs/class-pass/` carries no regenerated pin — only the new `v15-tactics-smoke.json`.

---
*Phase: 42-flee-retune-consolidated-balance-close*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `tools/lib/tuning-bot.mjs`, `tools/lib/class-matrix.mjs`, `tools/class-pass-usage.mjs`, `test/unit/tuning-bot.test.js`, `test/unit/bot-tactics.test.js`, `test/unit/class-matrix.test.js`, `test/unit/class-pass-usage.test.js`, `docs/class-pass/v15-tactics-smoke.json`, `docs/CLASS-PASS.md` (`### Phase 42 tactics` present), `docs/ABILITIES.md`, `docs/GEAR-BALANCE.md`, `docs/GEAR-SLOTS.md`, `docs/SPELLS.md` all exist with the expected content.
Verified in git log: `d0d173d`, `baf6db7`, `d53c1c0` all present on `master`.
