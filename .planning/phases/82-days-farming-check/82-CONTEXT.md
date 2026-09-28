# Phase 82: DAYS Farming Check - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Measure whether a hero who never leaves floor 1 (and, as a follow-up, floor 2) can bank more DAYS than honest descending runs, record the numbers and the verdict in a ledger, and settle the DAYS ranking rule that Phase 83 (server, SRV-03) and Phase 84 (panel/YOUR DEAD) apply. Tooling and a doc only: `engine/`, `content/` and `test/parity/` are untouched, zero fixtures move. This is a one-off exploit measurement, not a balance/fit run (the engine does not change this milestone).

</domain>

<decisions>
## Implementation Decisions

### The farmer and the comparison
- Two farmer variants; the verdict uses the STRONGER one (humans play better than the bot):
  - (a) **no-stairs fair bot** — the shipped fair bot (`tools/lib/tuning-bot.mjs#decideAction`) with the descent forbidden: it explores/clears the floor as usual, but never steps onto the stairs (route the exit branch elsewhere — nearest unseen, then a wander that avoids the stairs cell), and keeps walking after the floor is cleared.
  - (b) **hoarder** — same, plus: at every store it buys as many rations as its gold allows (after nothing else), and it camps only when hurt (the fair bot's campThreshold), never to "pass time".
  - Any action that would change floors (stairs, a teleport/feature that changes depth, if one exists) is avoided or, if unavoidable, the run is tagged `leftFloor` and reported separately — never silently counted.
- 200 seeds over the sub-class rotation (same seed set / rotation as `tools/tune-difficulty.mjs`), hard cap 20,000 actions or 500 days; a farmer alive at the cap is reported as `farmingUnbounded` (a red flag, counts as "farming wins").
- Honest baseline = the fair bot's normal runs over the same seeds in the same invocation: DAYS at death p50/p90/p99/max, with floor-1 deaths also shown separately.
- Tool: `tools/days-farm.mjs` (dev-only Node ESM, not shipped, not a node:test file), reusing `tools/lib/tuning-bot.mjs` (import, do not fork the policy; add a small policy wrapper/option in the tool or a narrowly-scoped opt-in hook in the lib that leaves every existing readout byte-identical). Flags: `--seeds=N`, `--farm-floor=1|2` (floor 2 = descend normally to floor 2, then farm there), `--json`.
- Ledger: `docs/DAYS-FARMING.md` — method, commands, the tables (honest vs each farmer variant, floor 1 and floor 2), the verdict and the DAYS rule in one sentence Phase 83 can consume.

### The verdict and the fix
- Farming "wins" when the stronger farmer's p90 DAYS ≥ the honest runs' p99 DAYS, or any farmer run hits the cap.
- If floor-1 farming wins: **DAYS ranks only runs that got past floor 1 (floor ≥ 2)**; DEPTH, KILLS and WILMST still list floor-1 deaths. The DAYS picker/rule line says so in voice (draft: "Days on the first floor don't count. That's loitering."). The same rule applies to the server query (SRV-03) and to YOUR DEAD (BOARD-26).
- Also measure floor-2 farming (`--farm-floor=2`). If floor-2 farming wins too, the rule switches to a per-floor cap: DAYS rank key = min(days, 10 × floor) (at most 10 days counted per floor reached) — the displayed value stays the true days; record the exact key.
- If farming does not win: record the numbers and verdict; DAYS ranks as the mock says (days desc, then floor desc); nothing else changes.
- The verdict is applied mechanically from the pre-agreed thresholds above (no mid-phase user pause); the SUMMARY states the numbers and which branch fired so the user can overrule later.

### Claude's Discretion
- Exact wander policy after the floor is cleared (random legal step vs. a patrol), as long as it never takes the stairs and keeps the day clock moving.
- Report layout and JSON shape.
- Worker-thread parallelism (follow `tune-classes`/`tune-difficulty` patterns) to keep the run under ~15 minutes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/lib/tuning-bot.mjs`: `decideAction` (fair bot), `playRun(seed, opts, onStep)`, `makeBotContext`, `dirTowardExit` / `nearestUnseenDir` / `pickFallbackDir` / `bfsFirstStep`, `chooseStorePurchase` (store buys), `distribution` / `percentile`, `BOT_DEFAULTS` (exploreBudget 50, maxActions 20000, campThreshold, potionThreshold), `RUN_FLAGS { storeRoll: true }`.
- `tools/tune-difficulty.mjs`: seed rotation, CLI flag parsing, readout printing, worker pattern.

### Established Patterns
- A day ticks every 100 squares walked (`engine/movement.js` `crossings(100) > 0 → newDay`) or on a camp (`makeCamp` → `newDay(camped)`); each night eats rations (`nightlyEats`, race `eats`, Troll eats 2); unfed nights burn wp into `die("starve")` (`engine/movement.js` ~L1016-1032).
- Starting rations: Fighter 6, Thief 5, Magic User 4 (`engine/character.js` ~L585, `startingRationsFor`). Rations are sold at stores (`engine/economy.js` `buyRations`, 30 gold base, race-adjusted). Stores only appear as a map-dot encounter result ("Store", `engine/encounters.js` ~L208) — finite per floor.
- Wandering monsters roll in `newDay` (renewable fights → gold/loot) — the farmer's only renewable income once the floor's dots are spent.
- Bots never touch the engine: everything goes through `engine/engine.js` act/dispatch as the shipped harness does.

### Integration Points
- Phase 83 SRV-03 consumes the rule (DAYS query filter or key); Phase 84 BOARD-20/26 applies it to YOUR DEAD and the DAYS picker copy.

</code_context>

<specifics>
## Specific Ideas

User note (2026-09-28): "We need a way to prevent someone from wandering around floor 1 endless to wrack up DAYS on the leaderboard. I'd expect that they would eventually starve to death ... so, maybe it's fine, but let's note it as something to check."

</specifics>

<deferred>
## Deferred Ideas

- Server-side flagging of long days-to-depth ratios (replay/plausibility job) — REQUIREMENTS Future (replay verification).

</deferred>
