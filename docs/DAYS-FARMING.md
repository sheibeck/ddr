# DAYS farming check (Phase 82 ledger, FARM-01 / FARM-02)

**Phase:** 82-days-farming-check
**Date:** 2026-09-28
**Requirements:** FARM-01, FARM-02

## The question

User note (2026-09-28): "We need a way to prevent someone from wandering around floor 1 endless to wrack up DAYS on the leaderboard. I'd expect that they would eventually starve to death ... so, maybe it's fine, but let's note it as something to check."

## Method

**The two farmer variants.** Both wrap the shipped fair bot's `decideAction` (`tools/lib/tuning-bot.mjs`) — never fork it — via a `playRun` policy hook (`tools/lib/days-farm.mjs#makeFarmerPolicy`):

- **noStairs** — plays exactly like the fair bot (explore, fight, loot, store) but every move on the farm floor is replaced with `farmDir`: nearest unseen cell, then nearest seen dot/chest, then a random legal wander, in every case skipping any stairs (`exit`/legacy `gate`) tile. It keeps walking after the floor is fully cleared instead of taking the stairs.
- **hoarder** — the same, plus it buys the store's `Rations` stock line first with all its gold at every store visit it reaches (`hoarderStorePick`, no `GOLD_RESERVE`, one ration per visit because the engine sells each store line once), and it camps only when hurt (the fair bot's own `campThreshold`), never "to pass time."

**The camp guard and the breaker.** The fair bot's own camp decision (`decideAction`) checks only the hero's personal appetite; `makeCamp` (`engine/movement.js`) refuses on the whole party's real appetite (`nightlyEats`) — a Joiner's extra mouth can make the bot try to camp when the party cannot actually eat, which the planner's own probe (seed 55434) showed stalls the bot repeating a refused camp. The camp guard intercepts `action.type === "camp"` when `c.rations < nightlyEats(state)` and substitutes a farmer move instead. Totals from this run: **campGuard fired 6,447 times (floor-1 noStairs) / 5,947 (floor-1 hoarder) / 4,783 (floor-2 noStairs) / 5,483 (floor-2 hoarder)** — routine and expected, since a farmer that never descends keeps accumulating Joiners and low-ration stretches over hundreds of in-game days. The breaker (50 consecutive out-of-combat, no-open-decision, non-move actions force a farmer move) exists as a belt-and-suspenders guard against any other no-op decision loop; it never fired in this run (**breaker = 0** in all four variant/floor rows).

**Farm floor 2** descends the honest way (identical to the honest baseline) until the hero first reaches floor 2, then the farmer policy engages exactly as on floor 1. A hero who dies (or gets stuck) on floor 1 before ever reaching floor 2 is reported `notReached`, never silently folded into the farm-floor-2 numbers.

**The honest baseline** is `playRun` with unmodified `BOT_DEFAULTS`, over the same `i*7919+1` seeds in the same tool invocation — the identical seed-rolled heroes `tools/tune-difficulty.mjs` samples (no class forcing; the seed rotation over all 200 seeds is Fighter 69 / Magic User 59 / Thief 72).

**Caps and outcome classes.** Every farmer run is hard-capped at 20,000 actions or 500 days (`FARM_CAPS`); a farmer still alive at either cap is `unbounded` (aka `farmingUnbounded` — a red flag, and per 82-CONTEXT.md counts as a farming win on its own). The four outcome classes are `dead`, `unbounded`, `leftFloor` (the farmer was boxed in — every legal step was the stairs — and had to take them), and `notReached` (farm-floor-2 only: died before reaching the farm floor at all). Only `dead` and `unbounded` rows ("counted") feed the DAYS percentiles; `leftFloor` and `notReached` are reported separately, never folded in silently.

**DAYS = `state.day`** — the same value the leaderboard records via `engine/death.js#buildRunSummary`'s `day` field.

**Engine read:** `resolveFeature` (`engine/movement.js`) is the only caller of `descend()`, and only for an `"exit"` tile (current `genFloor` output) or the legacy `"gate"` tile (old-save compatibility) — so "never take the stairs" is a complete, verifiable definition of "never leaves the floor."

**The opt-in `playRun` hook.** `tools/lib/tuning-bot.mjs#playRun` gained two opt-in hooks in plan 82-01 (`opts.policy`, `opts.stopWhen`), both `undefined` by default. Quoted from `82-01-SUMMARY.md`: "Proof of 'byte-identical everywhere': `node tools/tune-difficulty.mjs --seeds=20 --json` before/after the `playRun` edit is byte-for-byte identical (`cmp` exit 0), and `test/unit/roll-high-state-pins.test.js` (the Phase 73 bot-sweep state-hash pins) passes unchanged with zero file diff."

## Commands

Measurement (the phase's one full run):

```
node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json
```

Re-render the stored report (verbatim, plays nothing):

```
node tools/days-farm.mjs --from=docs/days-farming/days-farm.json
```

Smoke test (small caps, quick sanity check):

```
node tools/days-farm.mjs --seeds=4
```

Run date: 2026-09-28. Commit (`meta.commit`): `e3539326`.

## Results

<!-- days-farm:report:start -->
*seeds=200 (i*7919+1)  farmFloors=[1,2]  caps: maxActions=20000 maxDays=500  bot: exploreBudget=50 campThreshold=0.5*

### Honest baseline

| runs | completed | stuck | days p50 | days p90 | days p99 | days max |
|---|---|---|---|---|---|---|
| 200 | 188 | 12 | 7 | 13 | 17 | 18 |

| floor-1 deaths n | days p50 | days p90 | days p99 | days max |
|---|---|---|---|---|
| 4 | 2 | 10 | 10 | 10 |

### Farm floor 1

| variant | runs | counted | dead | unbounded (frozen clock) | leftFloor | notReached | days p50 | days p90 | days p99 | days max | starve % | rations bought | cooked | mean hungry nights | camp guard | breaker | boxed in |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| noStairs | 200 | 199 | 183 | 16 (0) | 1 | 0 | 25 | 73 | 205 | 206 | 80.9% | 0 | 521 | 30.9 | 6447 | 0 | 1 |
| hoarder | 200 | 199 | 183 | 16 (0) | 1 | 0 | 25 | 73 | 206 | 206 | 80.3% | 26 | 541 | 31.2 | 5947 | 0 | 1 |

#### By race (stronger variant: hoarder)

| race | n | days p50 | days max | unbounded |
|---|---|---|---|---|
| Dwarven | 19 | 50 | 206 | 2 |
| Elven | 32 | 16 | 196 | 1 |
| Fridgian | 23 | 28 | 73 | 0 |
| Human | 72 | 28 | 205 | 8 |
| Troll | 26 | 15 | 192 | 3 |
| Wilmsry | 27 | 30 | 206 | 2 |

#### By class (stronger variant: hoarder)

| class | n | days p50 | days max | unbounded |
|---|---|---|---|---|
| Fighter | 69 | 30 | 205 | 5 |
| Magic User | 58 | 21 | 206 | 4 |
| Thief | 72 | 24 | 206 | 7 |

### Farm floor 2

| variant | runs | counted | dead | unbounded (frozen clock) | leftFloor | notReached | days p50 | days p90 | days p99 | days max | starve % | rations bought | cooked | mean hungry nights | camp guard | breaker | boxed in |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| noStairs | 200 | 196 | 190 | 6 (0) | 0 | 4 | 12 | 28 | 207 | 214 | 45.8% | 0 | 293 | 13.2 | 4783 | 0 | 0 |
| hoarder | 200 | 196 | 190 | 6 (0) | 0 | 4 | 12 | 28 | 200 | 207 | 46.3% | 21 | 295 | 13.2 | 5483 | 0 | 0 |

#### By race (stronger variant: noStairs)

| race | n | days p50 | days max | unbounded |
|---|---|---|---|---|
| Dwarven | 19 | 15 | 214 | 1 |
| Elven | 30 | 5 | 92 | 0 |
| Fridgian | 23 | 15 | 32 | 0 |
| Human | 71 | 12 | 198 | 2 |
| Troll | 26 | 10 | 197 | 2 |
| Wilmsry | 27 | 19 | 207 | 1 |

#### By class (stronger variant: noStairs)

| class | n | days p50 | days max | unbounded |
|---|---|---|---|---|
| Fighter | 69 | 12 | 214 | 2 |
| Magic User | 57 | 9 | 111 | 0 |
| Thief | 70 | 14 | 207 | 4 |

### Verdict

| floor | stronger | stronger p90 | honest p99 | cap hits | wins | reason |
|---|---|---|---|---|---|---|
| 1 | hoarder | 73 | 17 | 32 | true | both |
| 2 | noStairs | 28 | 17 | 12 | true | both |

Branch: perFloorCap
Rule: DAYS ranks every run by daysKey = min(day, 10 * floor) (desc), ties by floor (desc); the board still displays the true day.
<!-- days-farm:report:end -->

**Reading the numbers:**

- **Starvation reliably ends floor-1 farming, but not fast.** Of the 183 `dead` floor-1 farmer runs (per variant), starvation is the dominant cause — 148/183 (80.9%) for noStairs, 147/183 (80.3%) for hoarder — at a median day of 23-24 among starved deaths (max 111). The remaining floor-1 deaths are combat (34-35) and one trap. Starving is real, but slow: a hero can bank a median of 23-25 DAYS before starving, and the worst dead case reaches 111 days — well past the honest run's p99 of 17. On floor 2, combat (not starvation) is the dominant cause of death (99-100/190), with starvation accounting for 87-88/190 (45.8-46.3%) at a higher median day (16) — floor 2's tougher wandering monsters kill the farmer before hunger usually does.
- **Which classes and races farm longest:** on floor 1, Human (p50 28, max 205-206, most unbounded at 8) and Dwarven (p50 50, the single highest median) farm longest by race; Fighter (p50 30) and Thief (p50 24, most unbounded at 7) lead by class. On floor 2, the picture flips toward Dwarven (p50 15, max 214) and Wilmsry (p50 19) by race, and Thief (p50 14, most unbounded at 4) by class — Magic User trails on both floors (p50 21 / p50 9) and never went unbounded on floor 2.
- **Food economics:** noStairs never buys rations (0 bought on both floors) and survives purely on cooked meat from kills (521 floor-1, 293 floor-2) and starts; hoarder buys 26 rations on floor 1 and 21 on floor 2 (one ration per store visit it reaches, capped by the bag's ration limit) and cooks slightly more (541 floor-1, 295 floor-2) because its marginally longer survival window yields more kills. Mean hungry nights per counted run: 30.9-31.2 on floor 1 (a farmer spends most of its (very long) life hungry), 13.2 on floor 2 (shorter counted runs, fewer hungry nights banked).
- **Every unbounded (`farmingUnbounded`) run, by seed / hero / day / clockMoving** — all 16 floor-1 seeds and all 6 floor-2 seeds kept the 100-square day clock moving (`clockMoving: true` in every case; zero `unboundedFrozenClock` anywhere in this run):

  Floor 1 (16 seeds, noStairs day / hoarder day when they differ):
  | seed | class | sub-class | race | day (noStairs / hoarder) |
  |---|---|---|---|---|
  | 31677 | Thief | Cutthroat | Elven | 196 |
  | 110867 | Thief | Cloaker | Troll | 192 |
  | 197976 | Thief | Ninja | Human | 202 |
  | 221733 | Fighter | Guard | Dwarven | 197 |
  | 308842 | Thief | Cloaker | Human | 197 |
  | 530574 | Magic User | Summoner | Human | 199 |
  | 578088 | Thief | Cutthroat | Wilmsry | 206 |
  | 625602 | Fighter | Knight | Wilmsry | 201 |
  | 657278 | Fighter | Woodsman | Troll | 191 |
  | 696873 | Fighter | Woodsman | Human | 205 |
  | 847334 | Thief | Cloaker | Troll | 192 |
  | 879010 | Magic User | Warlock | Human | 197 |
  | 1092823 | Thief | Pickpocket | Human | 193 |
  | 1449178 | Magic User | Warlock | Human | 198 |
  | 1504611 | Magic User | Warlock | Dwarven | 205 / 206 |
  | 1512530 | Fighter | Knight | Human | 197 |

  Floor 2 (6 seeds, noStairs day / hoarder day when they differ):
  | seed | class | sub-class | race | day (noStairs / hoarder) |
  |---|---|---|---|---|
  | 110867 | Thief | Cloaker | Troll | 197 |
  | 578088 | Thief | Cutthroat | Wilmsry | 207 |
  | 665197 | Fighter | Woodsman | Dwarven | 214 / 200 |
  | 847334 | Thief | Cloaker | Troll | 192 |
  | 1092823 | Thief | Pickpocket | Human | 198 |
  | 1488773 | Fighter | Samurai | Human | 198 |

  All unbounded rows hit `maxActions` (20,000), never `maxDays` (500) — `capBy: "actions"` in every case.

- **leftFloor and notReached:** floor 1 has exactly one `leftFloor` row (both variants, same seed 277166, boxed in at day 9 / 979 actions — `farmDir` found every legal step led to the stairs, so the farmer took them once, the only way this can happen). This is the expected "boxed in" corner case, not a harness defect (`boxedIn: 1`, not `0`). Floor 2 has 0 `leftFloor` rows and 4 `notReached` rows per variant (seeds 490979, 704792, 1203689, 1385826) — all four heroes died honestly on floor 1 (combat x3, starve x1) before ever reaching the floor-2 farm zone, so floor-2 farming never engaged for them; they are excluded from the floor-2 percentiles entirely, exactly as designed.

## Verdict

The pre-agreed rule (82-CONTEXT.md, locked): farming wins when the stronger farmer's p90 DAYS is at least the honest runs' p99 DAYS, or when any farmer run hits the cap. If floor-1 farming wins, DAYS ranks only runs that got past floor 1 (floor >= 2); DEPTH, KILLS and WILMST still list floor-1 deaths. If floor-2 farming wins too, the rule switches to a per-floor cap: DAYS rank key = min(days, 10 x floor), and the displayed value stays the true days. If farming does not win, DAYS ranks as the mock says (days desc, then floor desc), and nothing else changes.

**Floor 1:** stronger variant = **hoarder**, p90 = **73** days, vs honest p99 = **17** days (73 >= 17: wins on p90 alone). Cap hits = **32** (16 noStairs + 16 hoarder unbounded runs). Reason: **both** (p90 win and cap hits). Floor-1 farming wins decisively.

**Floor 2:** stronger variant = **noStairs**, p90 = **28** days, vs honest p99 = **17** days (28 >= 17: wins on p90 alone). Cap hits = **12** (6 noStairs + 6 hoarder unbounded runs). Reason: **both**. Floor-2 farming *also* wins.

Because floor 2 wins too, `farmVerdict` fires the **`perFloorCap`** branch mechanically — this is the corner case 82-01's planner flagged ("a floor-2 win while floor 1 does not win maps to `perFloorCap` — the only one of the three rules that actually stops floor-2 farming") does not even apply here, since both floors won outright; `perFloorCap` is simply the correct branch when floor 2 wins, full stop. This was applied mechanically by `farmVerdict` (`tools/lib/days-farm.mjs`, fixed and tested in plan 82-01, before this measurement ran) with no mid-phase pause.

**The user can overrule this verdict.** FARM-02's record is this ledger plus the phase SUMMARY (`.planning/phases/82-days-farming-check/82-02-SUMMARY.md`).

## The DAYS rule

DAYS ranks every run by daysKey = min(day, 10 * floor) (desc), ties by floor (desc); the board still displays the true day.

- Rank key: `daysKey`, formula `min(day, 10 * floor)`
- Filter: none
- Order: `daysKey desc`, then `floor desc`
- Displayed value: the true day
- Applies to: SRV-03 (server DAYS query, count and rank), BOARD-20 (DAYS picker/rule copy), BOARD-26 (YOUR DEAD)
- Picker/rule line draft (Phase 84 owns final copy): "Only ten days a floor count. The rest is loitering."

## For Phase 83 and Phase 84

How to apply the fired branch (`perFloorCap`) concretely: the client stores `daysKey = min(day, 10 * floor)` on each run document at submit time (part of the run's own shape — SRV-02's write rules check it equals the formula). Every DAYS top-ten/count/rank query orders by `daysKey desc` then `floor desc`. The board displays the true `day`, never `daysKey` — `daysKey` exists only to rank, not to show.

The non-fired branches, for reference:

- **mock** (not chosen): order DAYS by `day desc`, then `floor desc` — the naive rule, correct only if farming had not won on either floor.
- **floor2plus** (not chosen): every DAYS query would add the filter `floor >= 2` (excluding floor-1 deaths from DAYS only; DEPTH/KILLS/WILMST unfiltered) — this was the rule for a floor-1-only win, but floor 2 won too, so `perFloorCap` (the stricter rule) fired instead.

## Engine gate

```
git diff --name-only 1284b0bd -- engine content test/parity
```

Output: empty (zero engine/content/parity bytes touched since phase start).

The one code change plan 82-01 made outside `docs/`/`test/unit/`/`tools/` is `tools/lib/tuning-bot.mjs`'s two opt-in `playRun` hooks (`opts.policy`, `opts.stopWhen`), both `undefined` by default. Proof (quoted from `82-01-SUMMARY.md`): `node tools/tune-difficulty.mjs --seeds=20 --json` before/after the edit is byte-for-byte identical (`cmp` exit 0), and `test/unit/roll-high-state-pins.test.js` (the Phase 73 bot-sweep state-hash pins) passes unchanged with zero file diff. `tools/lib/tuning-bot.mjs` is not `engine/`, `content/`, or `test/parity/` — it is dev-only tooling never shipped in `www/`.
