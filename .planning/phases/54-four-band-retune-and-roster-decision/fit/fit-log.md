# Phase 54-07 — the fit log (cycle 3, USER RULING G)

Rendered from `fit/fit-log.jsonl` (= `fit/fit-log-block3.jsonl`, the cycle-3
continuous walk — block 1, budget 10, then block 2, budget 20, resumed from
the SAME log; the replay-resume fix (USER RULING G "Adjustment 3(c)")
makes this one continuous walk across both `node tools/fit-difficulty.mjs`
invocations, not two independent searches).

**Command (block 1):** `node tools/fit-difficulty.mjs --search --start=fit/start-block3.json --budget=10 --seeds=200 --workers=4 --log=fit/fit-log-block3.jsonl --out=fit/best-block3.json`
**Command (block 2, resumed):** the same command with `--budget=20` (reuses evaluations 1-10 verbatim from the log; runs 11-13 fresh)

**Start:** `fit/start-block3.json` — the cycle-2 best (candidate #6 of `fit/fit-log-block1.jsonl`, score 10.83 under the PRE-fix engine); this walk's own evaluation #1 (score 9.8073) re-evaluates that SAME dial set against the POST-fix engine (USER RULING G "Adjustment 2" — the Table-4 HP-dot compounding fix; the score moves 10.83 -> 9.8073 purely from the engine correction, zero dial change).

**Stop reason:** `pass` — evaluation #13 reached a full PASS (every floor 1-12 inside its Ruling C tolerance band) with the class-pool constraints ok. The tool exits at the FIRST PASS+ok candidate — the walk never spent the remaining budget (10 of 20 unused in block 2; block 1's own budget of 10 was exhausted without a PASS, motivating block 2).

## Evaluation table

| # | score | verdict | S1 | S4 | S5 | S8 | S10 | S12 | tail S15 | tail S20 | reach20 | F/T/M p50 | F/T/M reach5 | ok/reason | vs start (changed coordinates) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 9.8073 | MISS | 99.5 | 85.3 | 76.9 | 45.7 | 23.4 | 16.2 | 3.8 | 1.2 | 0.5 | 8/9/7 | 87.1/86.4/74.0 | ok | (= start) |
| 2 | 7.1327 | MISS | 99.5 | 85.3 | 76.9 | 42.7 | 21.5 | 12.1 | 3.2 | 0.8 | 1.0 | 8/8/7 | 87.3/86.9/74.5 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29} |
| 3 | 13.8735 | MISS | 99.5 | 80.8 | 76.1 | 37.3 | 17.5 | 7.2 | 2.9 | 1.0 | 0.5 | 7/8/6 | 81.0/84.5/67.9 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.3} |
| 4 | 11.7791 | MISS | 99.5 | 80.8 | 76.1 | 37.3 | 17.5 | 8.5 | 4.3 | 1.7 | 1.5 | 7/8/6 | 81.0/84.7/67.9 | ok | FOE_LEVEL={"base":1,"perDepth":0.29} |
| 5 | 9.8073 | MISS | 99.5 | 85.3 | 76.9 | 45.7 | 23.4 | 16.2 | 4.6 | 2.3 | 2.0 | 8/9/7 | 87.1/86.7/74.0 | ok | FOE_LEVEL={"base":0.75,"perDepth":0.29} |
| 6 | 8.5242 | MISS | 99.5 | 85.8 | 80.6 | 42.8 | 22.6 | 13.3 | 2.9 | 1.9 | 0.5 | 8/8/6.5 | 87.3/86.0/75.0 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; HERO_SP_SCALE=0.33 |
| 7 | 16.3402 | MISS | 99.5 | 84.8 | 75.9 | 36.1 | 13.3 | 8.9 | 1.4 | 0.0 | 0.0 | 7/7/6 | 87.9/87.1/70.8 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; HERO_SP_SCALE=0.23 |
| 8 | 22.9586 | MISS | 99.0 | 82.8 | 72.4 | 33.6 | 16.3 | 6.6 | 1.4 | 0.0 | 0.0 | 7/8/6 | 84.6/88.5/69.6 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.68,"perDepth":0.02} |
| 9 | 7.9637 | MISS | 99.5 | 87.9 | 81.7 | 46.7 | 22.3 | 15.9 | 3.7 | 1.8 | 2.0 | 8/9/6 | 90.3/91.7/75.5 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.52,"perDepth":0.02} |
| 10 | 17.3641 | MISS | 99.5 | 80.7 | 72.4 | 38.0 | 14.7 | 8.0 | 2.9 | 0.0 | 1.0 | 8/8/6 | 83.1/85.0/67.9 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.6,"perDepth":0.03} |
| 11 | 5.0468 | MISS | 99.5 | 84.9 | 79.6 | 44.7 | 23.2 | 17.0 | 6.0 | 1.3 | 1.0 | 7/9/7 | 82.3/92.1/73.6 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.6,"perDepth":0.01} |
| 12 | 11.9797 | MISS | 99.5 | 87.9 | 83.3 | 46.4 | 26.2 | 15.2 | 5.7 | 0.0 | 0.5 | 8/9/6 | 89.1/91.7/76.5 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.6,"perDepth":0} |
| 13 | **2.7113** | **PASS** | 99.5 | 82.9 | 75.0 | 41.3 | 21.2 | 14.3 | 7.3 | 3.5 | 1.5 | 7/8/7 | 82.3/88.7/68.0 | ok | FOE_LEVEL={"base":0.9,"perDepth":0.29}; FOE_HIT_SCALE={"base":0.6,"perDepth":0.01}; FOE_HP_SCALE={"base":0.9,"perDepth":0.015} |

Every row's `ok` is `true` — zero class-fairness rejections across the entire
cycle-3 walk (vs cycle 1's 22-of-27 and cycle 2's 9-of-9-in-block-1
rejection rate before Adjustment 1). This is direct evidence the loosened
`classConstraints` tolerances (USER RULING G "Adjustment 2": p50 1.0 -> 2.0
floors, reach-5 12 -> 20 points) fixed the actual problem cycle 2's
Adjustment 1 (the spellPower coordinate) tried and failed to fix.

## Notch record

**None** — every evaluated candidate in cycle 3 satisfied `constraints.ok`
without any `CLASS_MITIGATION` adjustment; the best pooled candidate (#13,
score 2.7113) is ALSO the best constrained candidate. `CLASS_MITIGATION`
ships at identity (`Fighter: {hpMul:1, armorMul:1, killSpeed:1}`, `Thief:
{evasion:0, fleeBonus:5, trapAvoid:0, killSpeed:1}`, `"Magic User":
{spellPower:1}`).

## BEST

```
BEST #13 score=2.7113 dials={"FOE_LEVEL":{"base":0.9,"perDepth":0.29},"TIER_SPREAD":1,"FOE_HIT_SCALE":{"base":0.6,"perDepth":0.01},"FOE_HP_SCALE":{"base":0.9,"perDepth":0.015},"FOE_COUNT_SKEW":1,"ROUND_DAMAGE_CEILING":0.5,"ABILITY_THREAT":{"base":1,"perDepth":0},"HERO_HP_SCALE":1.25,"HERO_REGEN_PER_FLOOR":0.25,"HERO_SP_SCALE":0.28,"CAMP_HEAL_FRACTION":0.2,"FOOD_CLOCK":1.5,"ENCOUNTER_DOTS":{"base":7,"perDepth":0.3},"HAZARD_SCALE":{"base":0.6,"perDepth":0.02},"DARK_BLOBS":{"base":-0.4,"perDepth":0.7},"DARK_BLOB_CAP":3,"DARK_RADIUS":{"base":3,"perDepth":1},"DARK_RADIUS_CAP":7,"STORE_TIER":{"base":0,"perDepth":0.3},"LOOT_SCALE":0.8,"FOE_ACCURACY":0,"DOT_MIX":{"fight":1,"harm":1,"loot":1,"help":1},"WANDER_RATE":1,"FLEE_NEED_MOD":0,"PARLEY_NEED_MOD":0,"STARTING_GOLD":50,"STARTING_POTION_BONUS":0,"CLASS_MITIGATION":{"Fighter":{"hpMul":1,"armorMul":1,"killSpeed":1},"Thief":{"evasion":0,"fleeBonus":5,"trapAvoid":0,"killSpeed":1},"Magic User":{"spellPower":1}}}
elapsed: 995.6s workers=4 evaluations=13 stopped=pass
```

**What the fit moved (vs `fit/start-block3.json`, three of the core-10 coordinates):**
- `FOE_LEVEL.perDepth` 0.26 -> 0.29 (harder: foe level climbs faster with depth)
- `FOE_HIT_SCALE.perDepth` 0.02 -> 0.01 (easier: the whole-hit scale grows more slowly with depth)
- `FOE_HP_SCALE.base` 0.8 -> 0.9 (harder: foes start with more relative HP, slightly longer fights)

The other seven core-10 coordinates (`FOE_LEVEL.base`, `HERO_SP_SCALE`,
`FOE_HIT_SCALE.base`, `HERO_HP_SCALE`, `HERO_REGEN_PER_FLOOR`,
`HAZARD_SCALE.base`, `ENCOUNTER_DOTS.base`) land at exactly their
`fit/start-block3.json` value (= the cycle-2 best #6) — the walk never
needed to move them further once the engine bug was fixed and the
guardrails were loosened.
