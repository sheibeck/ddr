# Class Pass (v1.2, Phases 22-27) — before/after ledger

This is the class-pass ledger for the v1.2 identity work: a BEFORE snapshot
(PLAY-01, this section, Phase 22-04) captured against the commit-pinned
pre-identity-pass engine, before Phase 23 changes a single rule; the sub-class
and race rulings from Phase 24 (PLAY-03, headed placeholder below); and an
AFTER matrix plus fun-band verdicts from Phase 26 (PLAY-02, headed
placeholder below). **THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a
substitute for a human playtest** — a heuristic bot's play skill is
arbitrary; the numbers below are a sanity signal, not a verdict, until a
human editorial pass (Phase 26) and a human DR round (Phase 27) both weigh
in. The matrix below is **143 cells, not 144**: ROADMAP.md's "144-combo"
phrasing is the naive class × sub × race product before the one
canon-impossible combo is dropped — Fighter/Samurai/Fridgian ("Fridges
don't wear any armor" — the prototype rerolls the sub rather than ever
letting this combo stand) is excluded, footnoted in every table below.

## Bot proxy (HARN-02)

The bot (`tools/lib/tuning-bot.mjs`, shared by `tune-difficulty.mjs`,
`tune-economy.mjs`, and `tune-classes.mjs`) replaced its old thrown-only
Magic User cast rule with a single sub-class-aware policy this phase:

- **Combat casting** goes through `chooseSpell(state, ctx)`, ONE scoring
  table evaluated only when charges remain and the spell passes `canCast`
  (verbatim from `tools/lib/tuning-bot.mjs`'s own JSDoc — Plan 22-02):

  ```
  KILL    (400+): "Freeze" -> 410 (frozenSolid on hit)
                  kind==="death" -> 405, only when c.wp - 25 > fleeAt * c.maxWP
                  kind==="turn"  -> 402, only vs Walking Dead
                  kind==="gate"  -> 402, only vs Demons/Walking Dead
  DAMAGE  (300 + expected damage, ties -> higher sp.lvl):
                  expected(sp) = sp.dmg.n * (sp.dmg.sides + 1) / 2 + sp.dmg.bonus
                  kind==="thrown"/"volley"/"acid": Lightning's expected x liveFoes(state).length;
                  volley (Fireballs) x4.5 (mean d8 balls); acid (Acid) x2 (two rounds of ticks,
                  skipped when the target already carries `acid`)
  DISABLE (200+, only when liveFoes(state).length >= 2):
                  stun 230, weaken 220 (skipped when C.weakened), shrink 215, status (Doze) 210,
                  stupid 205
  HEAL    (100 + expected heal, only when c.wp / c.maxWP < ctx.opts.potionThreshold):
                  heal (Heal/Major Heal)
  WARD-OPENER (50, only when C.round === 1 and !c.ward):
                  ward (Shield/Bubble)
  Never auto-cast: quake, vapor, insane, blind, petrify, might, regen, reveal, foresee, senses,
                   summon, mirror (handled by decideAction's opener rules, not this table)
  Tie-break: higher sp.lvl, then lower SPELLS index (first found wins).
  ```

  (Documented known discrepancy, not a bug: an earlier illustrative example
  in Plan 22-02's objective read Acid's unmultiplied expected value; the
  implemented x2 "two rounds of ticks" constant above is what actually
  ships — no test pins the literal score, only relative ordering, and it
  never changes which cell of the table wins in this snapshot.)

- **Openers, round 1 only**: a Mirror Self ward-opener fires before the
  scoring table when castable with charges remaining (must precede KILL
  since an Illusionist can also learn Freeze); **Bard `sing`** fires
  whenever `songReady`, except at level 1 where the song only does anything
  against Beasts/Lair Beasts (level 2+ always sings round 1 when ready —
  Inspire is +1 to hit for the fight); **Summon** casts in combat at round 1
  when no ally is present and charges remain (Phantom Host follows the same
  rule for Illusionists), and out of combat whenever no ally is pending and
  charges exceed half of `maxCharges`.
- **Talk-first parley**: `isTalkFirst(state)` names the five identity
  talkers — Con Artist (any talkable foe), Woodsman vs. Beasts/Lair Beasts,
  Bard vs. Humans, Wilmsry vs. non-Magical foes, Elven vs. Humans — who
  attempt parley once at round 1 before anything else; everyone else keeps
  the low-HP flee/parley fallback.
- **Samurai never flees**; a Samurai below the flee threshold fights
  instead. A **Wizard whose strike is refused** (no attack spell, no
  charges) casts the lowest-level castable non-quake/non-death spell
  instead, or flees if that's also blocked — this and the Samurai rule both
  fix v1.1-baseline refusal loops (`ctx.fleeBlocked`/`ctx.strikeBlocked`,
  mirroring the pre-existing `ctx.parleyBlocked` pattern: set on a
  `*Refused` event, cleared on `encounterStarted`).
- **Scrolls** are read out of combat whenever `canRead(state)` is true and
  the character carries one; **`useItem` is deliberately never called** —
  found potions are drunk via the dedicated `drinkPotion` action path
  instead, keeping the bot's item-use surface to exactly the actions a
  natural player would reach for.
- **Flee/parley thresholds, potion/camp thresholds, exploration budget, and
  the exit-once-cleared behavior are unchanged from the v1.1 bot** (D-05/D-06
  of `docs/DIFFICULTY-RETUNE.md`).

Bot parameters (BEFORE and AFTER **must** use identical values — the `Bot:`
line inside every transcript below records them verbatim so a reader can
grep-diff the two ledgers):

| Parameter | Value | Decision |
|---|---|---|
| Seeds per cell | 40 natural-start / 10 at depth 20 (`i * 7919 + 1`) | 22-CONTEXT.md HARN-03/HARN-04 |
| Workers | 4 (`worker_threads`, by-cell queue) | 22-CONTEXT.md HARN-03 |
| Per-run action cap | 5,000 (matrix runs; lower than tune-difficulty's 20,000 so stuck runs don't dominate wall time) | 22-CONTEXT.md HARN-03 |
| Exploration budget per floor | 50 actions | D-05 (v1.1), unchanged |
| Flee/parley threshold | 0.3 plain / 0.5 vs. any kit-bearing live foe | D-06 (v1.1), unchanged |
| Potion / camp thresholds | wp/maxWP < 0.5 | D-05 (v1.1), unchanged |
| Start depth | 1 (natural-start matrix) / 20 (depth-20 slice) | HARN-04 |
| Party | off (`--party` not set) | 22-CONTEXT.md — matrix work is solo-only this phase |

## How to reproduce

Both runs below were produced from these exact command lines against the
pinned commit (see BEFORE section for the full hash):

```
node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/before.json
node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/before-depth20.json
```

Preflight before either run: `git status --porcelain` prints nothing (clean
tree), `npm test` ends with `# fail 0`, and
`git diff --quiet <pinned-hash> -- engine content src mazeworld.html` exits
0. Both runs were launched with the Bash tool's `run_in_background: true`,
writing stdout+stderr to their own scratchpad file with an `EXIT=<code>`
sentinel appended on completion, and polled in bounded checks (never a
foreground wait) until each sentinel appeared.

## BEFORE — commit 5565b222564f8ee2a944e03c1e4a3c27cae09b40 (pre-identity-pass engine)

Captured 2026-09-14. `git diff --quiet 5565b222564f8ee2a944e03c1e4a3c27cae09b40
-- engine content src mazeworld.html` exited 0 immediately before both runs
below were launched, and again after this ledger's own commit — the engine,
content, `src/`, and `mazeworld.html` are byte-identical to
`5565b222564f8ee2a944e03c1e4a3c27cae09b40` (short `5565b22`) for this
entire capture. The **only** engine/content/src difference between the
v1.1-close baseline `1b4daedac1f3686f86b919208476641fa2547e2c` (short
`1b4daed`) and `5565b22` is the dev-only `force` option added in
`engine/character.js` and `engine/state.js` (Plan 22-01) — no rule, number,
or narration changed; the default path (no `force` argument) stays byte-
identical to every parity fixture, so this is a parity carve-out-free,
behavior-identical pin. Wall times: the natural-start matrix took 687.2s
(~11.5 minutes); the depth-20 slice took 38.4s.

### tune-classes --seeds 40 --workers 4 --max-actions 5000

```
tune-classes: 143 cells x 40 seeds (5720 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Wilmsry  40  0  5.38  5.0  10.0  62.5  10.0  10.07  3.08  560.15  undone by a trap(6),cut down by a Drarl(5),cut down by a Blumble(4)
2  Thief  Acrobat  Wilmsry  40  0  5.03  5.0  8.0  52.5  5.0  7.55  2.75  539.83  undone by a trap(5),cut down by a China Wolf(4),cut down by a Drarl(4)
3  Thief  Con Artist  Wilmsry  40  0  5.00  5.0  7.0  67.5  0.0  1.50  2.75  516.67  cut down by a Werebeast(7),cut down by a Google(4),undone by a trap(4)
4  Fighter  Barbarian  Wilmsry  40  0  4.90  5.0  7.0  62.5  2.5  7.38  2.85  522.70  fell off a wall(4),cut down by a Blumble(2),cut down by a Dante(2)
5  Fighter  Master of Arms  Wilmsry  40  0  4.88  5.0  7.0  55.0  2.5  7.50  2.83  505.20  cut down by a Dante(5),cut down by a Drarl(5),cut down by a Werebeast(5)
6  Thief  Ninja  Human  40  0  4.80  4.0  8.0  47.5  2.5  15.80  3.35  498.20  undone by a trap(6),cut down by a Dante(3),cut down by a Drarl(3)
7  Fighter  Knight  Wilmsry  40  0  4.72  5.0  7.0  67.5  0.0  4.68  2.85  498.98  cut down by a Rinkle(4),cut down by a Werebeast(4),cut down by a China Wolf(3)
8  Thief  Ninja  Troll  40  0  4.63  4.0  7.0  45.0  2.5  13.93  3.15  460.13  starved in the dark(11),undone by a trap(6),fell off a wall(4)
9  Thief  Acrobat  Troll  40  0  4.60  4.0  7.0  45.0  2.5  11.98  3.08  477.13  starved in the dark(15),cut down by a Herman(5),undone by a trap(4)
10  Fighter  Woodsman  Wilmsry  40  0  4.43  5.0  7.0  50.0  0.0  4.72  2.70  451.18  cut down by a Werebeast(4),undone by a trap(4),cut down by a China Wolf(3)
11  Thief  Con Artist  Human  40  0  4.30  4.0  7.0  40.0  0.0  1.78  2.53  452.28  undone by a trap(10),came up short on a leap(3),cut down by a Werebeast(3)
12  Thief  Cutthroat  Wilmsry  40  0  4.15  4.0  6.0  42.5  0.0  5.50  2.58  437.33  cut down by a Werebeast(5),cut down by a Dante(4),cut down by a Frank(3)
13  Fighter  Barbarian  Elven  40  0  4.10  4.0  6.0  47.5  0.0  11.73  2.55  429.95  cut down by a Werebeast(10),undone by a trap(6),cut down by a Poltergeist(4)
14  Thief  Pickpocket  Wilmsry  40  0  4.08  4.0  6.0  40.0  0.0  5.03  2.38  437.20  cut down by a Dante(4),cut down by a Rinkle(3),fell off a wall(3)
15  Fighter  Bard  Wilmsry  40  0  4.05  4.0  6.0  27.5  0.0  4.65  2.33  406.78  cut down by a Google(3),cut down by a Gremlin(3),cut down by a Poltergeist(3)
16  Thief  Cloaker  Wilmsry  40  0  4.00  4.0  7.0  35.0  0.0  4.47  2.42  445.88  undone by a trap(6),cut down by a Dante(3),came up short on a leap(2)
17  Thief  Pilfer  Wilmsry  40  0  3.98  4.0  7.0  37.5  0.0  4.78  2.30  447.08  cut down by a Dante(8),came up short on a leap(3),cut down by a Google(3)
18  Thief  Con Artist  Dwarven  40  0  3.98  4.0  6.0  30.0  0.0  1.73  2.38  416.45  cut down by a Blumble(5),undone by a trap(5),cut down by a Poltergeist(4)
19  Fighter  Soldier  Wilmsry  40  0  3.98  4.0  6.0  30.0  0.0  4.65  2.38  398.33  cut down by a Poltergeist(4),cut down by a Ghoul(3),cut down by a Hair(3)
20  Thief  Cat Burglar  Troll  40  0  3.98  4.0  6.0  27.5  0.0  11.95  2.88  392.60  starved in the dark(11),undone by a trap(6),cut down by a Werebeast(4)
21  Fighter  Guard  Wilmsry  40  0  3.88  4.0  6.0  25.0  0.0  4.43  2.23  401.15  cut down by a Poltergeist(9),fell off a wall(4),cut down by a Cave Bear(3)
22  Thief  Con Artist  Fridgian  40  0  3.80  4.0  5.0  20.0  0.0  0.83  2.10  393.25  cut down by a Skeleton(5),undone by a trap(4),cut down by a Poltergeist(3)
23  Thief  Con Artist  Troll  40  0  3.78  4.0  6.0  25.0  0.0  1.95  2.13  387.95  starved in the dark(11),undone by a trap(5),cut down by a Poltergeist(4)
24  Thief  Cat Burglar  Wilmsry  40  0  3.75  4.0  7.0  37.5  0.0  6.00  2.30  381.03  undone by a trap(10),cut down by a Dante(4),cut down by a Rinkle(3)
25  Thief  Ninja  Elven  40  0  3.75  4.0  6.0  27.5  0.0  11.90  2.80  372.43  cut down by a Cave Bear(8),cut down by a Dante(4),cut down by a Rinkle(4)
26  Thief  Ninja  Dwarven  40  0  3.70  4.0  6.0  32.5  2.5  11.43  2.50  373.05  cut down by a Dante(7),cut down by a Blumble(3),cut down by a Herman(3)
27  Thief  Con Artist  Elven  40  0  3.63  3.0  5.0  32.5  0.0  1.75  2.25  366.45  cut down by a Werebeast(7),undone by a trap(7),fell off a wall(4)
28  Thief  Pilfer  Troll  40  0  3.53  4.0  5.0  32.5  0.0  7.93  2.23  384.65  starved in the dark(9),spent by the dungeon itself(7),fell off a wall(4)
29  Thief  Cutthroat  Troll  40  0  3.48  4.0  5.0  22.5  0.0  8.28  2.30  370.45  starved in the dark(12),fell off a wall(5),cut down by a Blumble(2)
30  Fighter  Samurai  Wilmsry  40  0  3.45  3.0  5.0  30.0  0.0  5.50  2.25  342.90  cut down by a Dante(6),cut down by a Werebeast(6),cut down by a Philly(3)
31  Thief  Acrobat  Human  40  0  3.43  4.0  5.0  22.5  0.0  9.23  2.35  364.23  cut down by a Dante(8),fell off a wall(6),cut down by a Poltergeist(4)
32  Fighter  Knight  Elven  40  0  3.43  3.0  5.0  22.5  0.0  6.10  2.35  335.80  cut down by a Poltergeist(5),cut down by a Werebeast(4),cut down by a Dante(3)
33  Magic User  Court Mage  Wilmsry  40  0  3.40  4.0  5.0  20.0  0.0  2.80  2.03  349.25  cut down by a Dante(6),starved in the dark(4),cut down by a Gremlin(3)
34  Thief  Cat Burglar  Human  40  0  3.35  3.0  6.0  22.5  2.5  8.13  2.28  329.40  undone by a trap(9),cut down by a Dante(5),starved in the dark(4)
35  Thief  Cloaker  Troll  40  0  3.35  3.0  5.0  17.5  0.0  8.13  2.25  371.05  starved in the dark(19),undone by a trap(6),came up short on a leap(2)
36  Thief  Pickpocket  Troll  40  0  3.33  3.0  7.0  17.5  0.0  6.58  2.08  338.25  starved in the dark(13),undone by a trap(5),fell off a wall(4)
37  Thief  Acrobat  Elven  40  0  3.30  3.0  6.0  22.5  0.0  8.60  2.48  331.73  cut down by a Dante(4),cut down by a Poltergeist(4),undone by a trap(4)
38  Fighter  Barbarian  Troll  40  0  3.30  3.0  5.0  20.0  0.0  8.15  1.95  318.15  starved in the dark(11),cut down by a Dante(4),cut down by a China Wolf(3)
39  Magic User  Sorcerer  Wilmsry  40  0  3.28  3.0  6.0  22.5  0.0  1.08  1.85  336.13  fell off a wall(7),cut down by a Dante(5),undone by a trap(4)
40  Fighter  Barbarian  Human  40  0  3.28  3.0  4.0  7.5  0.0  9.13  1.98  355.70  cut down by a Dante(5),cut down by a China Wolf(3),cut down by a Poltergeist(3)
41  Fighter  Knight  Human  40  0  3.25  3.0  5.0  15.0  0.0  5.95  2.20  340.30  cut down by a Poltergeist(8),cut down by a Dante(5),starved in the dark(5)
42  Fighter  Master of Arms  Elven  40  0  3.25  3.0  5.0  15.0  0.0  8.75  2.35  317.13  cut down by a Dante(5),cut down by a Poltergeist(5),cut down by a Blumble(4)
43  Magic User  Cleric  Wilmsry  40  0  3.20  3.0  5.0  20.0  0.0  2.58  1.95  330.20  cut down by a Dante(6),spent by the dungeon itself(5),cut down by a Cave Bear(3)
44  Magic User  Court Mage  Troll  40  0  3.20  3.0  5.0  17.5  0.0  4.70  1.98  332.70  starved in the dark(8),fell off a wall(6),cut down by a Poltergeist(3)
45  Fighter  Master of Arms  Human  40  0  3.18  3.0  5.0  10.0  0.0  8.38  2.30  338.55  cut down by a Dante(6),undone by a trap(5),cut down by a Werebeast(3)
46  Magic User  Warlock  Wilmsry  40  0  3.15  3.0  6.0  25.0  0.0  2.13  1.95  335.05  cut down by a Dante(7),undone by a trap(4),cut down by a Rinkle(3)
47  Thief  Acrobat  Dwarven  40  0  3.13  3.0  5.0  15.0  0.0  7.40  2.08  314.25  cut down by a Dante(5),cut down by a Gremlin(3),cut down by a Sterling(3)
48  Fighter  Knight  Troll  40  0  3.10  3.0  5.0  22.5  0.0  4.65  1.93  293.20  starved in the dark(7),cut down by a Dante(5),cut down by a Poltergeist(4)
49  Thief  Pilfer  Human  40  0  3.10  3.0  6.0  20.0  0.0  5.65  2.03  346.08  cut down by a Dante(8),cut down by a Philly(4),cut down by a Poltergeist(4)
50  Fighter  Bard  Elven  40  0  3.10  3.0  5.0  17.5  0.0  5.75  2.23  304.70  cut down by a Poltergeist(6),cut down by a Dante(3),cut down by a Gremlin(3)
51  Fighter  Bard  Troll  40  0  3.10  3.0  4.0  7.5  0.0  5.30  2.05  312.68  starved in the dark(11),cut down by a Poltergeist(4),undone by a trap(4)
52  Magic User  Apprentice  Wilmsry  40  0  3.08  3.0  5.0  20.0  0.0  1.40  2.05  301.15  cut down by a Dante(4),fell off a wall(4),cut down by a Krupke(3)
53  Magic User  Apprentice  Troll  40  0  3.08  3.0  5.0  10.0  0.0  4.13  1.98  317.80  starved in the dark(12),undone by a trap(5),cut down by a Gremlin(4)
54  Fighter  Woodsman  Elven  40  0  3.05  3.0  5.0  17.5  0.0  4.90  2.15  294.65  starved in the dark(5),cut down by a Dante(4),cut down by a Gremlin(4)
55  Magic User  Cleric  Troll  40  0  3.05  3.0  5.0  15.0  0.0  4.47  1.90  308.48  fell off a wall(7),cut down by a Dante(6),starved in the dark(6)
56  Fighter  Guard  Elven  40  0  3.05  3.0  5.0  10.0  0.0  6.63  2.10  287.15  cut down by a Google(4),cut down by a Poltergeist(4),cut down by a Dante(3)
57  Thief  Ninja  Fridgian  40  0  3.05  3.0  4.0  7.5  0.0  8.40  2.17  304.45  cut down by a Dante(8),fell off a wall(5),cut down by a Poltergeist(4)
58  Thief  Cutthroat  Elven  40  0  3.03  3.0  5.0  15.0  0.0  8.40  2.23  296.98  cut down by a Dante(6),spent by the dungeon itself(5),undone by a trap(5)
59  Thief  Pilfer  Elven  40  0  3.03  3.0  5.0  15.0  2.5  7.40  2.10  309.68  cut down by a Dante(7),cut down by a Skeleton(3),spent by the dungeon itself(3)
60  Magic User  Wizard  Troll  40  0  3.03  3.0  5.0  10.0  0.0  4.47  1.85  313.52  starved in the dark(13),came up short on a leap(4),cut down by a Dante(4)
61  Magic User  Wizard  Wilmsry  40  0  3.03  2.0  5.0  22.5  2.5  1.93  1.83  291.10  cut down by a Dante(8),fell off a wall(5),cut down by a Gremlin(3)
62  Thief  Cat Burglar  Dwarven  40  0  3.00  2.0  7.0  22.5  0.0  7.53  2.10  283.83  cut down by a Dante(9),undone by a trap(7),cut down by a Poltergeist(4)
63  Fighter  Master of Arms  Troll  40  0  2.98  3.0  5.0  10.0  0.0  7.45  2.05  296.95  starved in the dark(11),cut down by a Dante(5),cut down by a China Wolf(3)
64  Thief  Cat Burglar  Elven  40  0  2.95  3.0  5.0  20.0  0.0  7.20  2.08  281.13  undone by a trap(12),cut down by a Dante(5),cut down by a Dread Lock(2)
65  Magic User  Warlock  Troll  40  0  2.95  3.0  5.0  12.5  0.0  3.63  1.75  288.18  starved in the dark(12),came up short on a leap(4),cut down by a Dante(3)
66  Fighter  Woodsman  Troll  40  0  2.95  3.0  5.0  10.0  0.0  4.58  1.80  285.40  undone by a trap(7),starved in the dark(6),cut down by a Gremlin(4)
67  Fighter  Soldier  Troll  40  0  2.93  3.0  5.0  10.0  0.0  6.53  2.00  283.00  starved in the dark(12),cut down by a Dante(5),cut down by a Poltergeist(5)
68  Thief  Cloaker  Elven  40  0  2.90  3.0  5.0  17.5  0.0  7.43  2.13  297.13  cut down by a Dante(8),cut down by a Gremlin(4),spent by the dungeon itself(4)
69  Thief  Pilfer  Fridgian  40  0  2.90  3.0  5.0  12.5  0.0  5.78  1.90  290.85  cut down by a Dante(14),cut down by a Philly(4),cut down by a Poltergeist(3)
70  Fighter  Woodsman  Human  40  0  2.90  3.0  5.0  12.5  0.0  5.10  2.08  292.70  cut down by a Dante(7),undone by a trap(7),cut down by a Trachea(3)
71  Magic User  Illusionist  Wilmsry  40  0  2.90  2.0  5.0  22.5  0.0  1.53  1.75  288.80  cut down by a Dante(7),undone by a trap(6),cut down by a Philly(4)
72  Thief  Pickpocket  Elven  40  0  2.88  3.0  5.0  20.0  0.0  5.53  1.90  276.60  cut down by a Dante(5),undone by a trap(5),fell off a wall(4)
73  Magic User  Sorcerer  Human  40  0  2.88  3.0  5.0  10.0  0.0  1.15  1.48  277.27  cut down by a Dante(5),undone by a trap(5),cut down by a Shadow(4)
74  Fighter  Soldier  Elven  40  0  2.85  3.0  5.0  15.0  0.0  6.23  2.03  273.98  cut down by a Dante(7),cut down by a Poltergeist(7),cut down by a Google(3)
75  Magic User  Illusionist  Troll  40  0  2.85  3.0  4.0  5.0  0.0  4.38  1.75  286.90  starved in the dark(8),fell off a wall(5),cut down by a Dante(4)
76  Fighter  Bard  Human  40  0  2.83  3.0  5.0  10.0  0.0  4.93  1.83  272.20  cut down by a Dante(5),fell off a wall(5),cut down by a China Wolf(4)
77  Thief  Cloaker  Fridgian  40  0  2.80  3.0  5.0  12.5  0.0  4.20  1.80  269.20  cut down by a Dante(9),starved in the dark(4),undone by a trap(4)
78  Thief  Acrobat  Fridgian  40  0  2.80  3.0  5.0  10.0  0.0  5.78  1.83  273.58  cut down by a Gremlin(4),starved in the dark(4),undone by a trap(4)
79  Magic User  Sorcerer  Troll  40  0  2.80  3.0  5.0  10.0  0.0  2.25  1.60  283.90  starved in the dark(11),cut down by a Dante(4),fell off a wall(4)
80  Fighter  Guard  Human  40  0  2.80  3.0  4.0  7.5  0.0  4.93  1.78  272.85  cut down by a Dante(5),cut down by a Gremlin(5),starved in the dark(5)
81  Fighter  Master of Arms  Fridgian  40  0  2.80  2.0  5.0  15.0  0.0  6.63  1.88  269.25  cut down by a Dante(6),cut down by a Shadow(4),cut down by a Cave Bear(3)
82  Fighter  Soldier  Human  40  0  2.78  3.0  4.0  7.5  0.0  5.48  1.90  284.95  cut down by a Dante(9),cut down by a China Wolf(4),undone by a trap(4)
83  Fighter  Samurai  Elven  40  0  2.73  3.0  4.0  7.5  0.0  7.80  2.13  260.40  cut down by a Dante(5),cut down by a Poltergeist(5),undone by a trap(5)
84  Thief  Pilfer  Dwarven  40  0  2.70  3.0  5.0  15.0  0.0  5.30  1.83  279.02  cut down by a Dante(10),cut down by a Gremlin(6),cut down by a Drekk(3)
85  Magic User  Summoner  Troll  40  0  2.70  3.0  4.0  7.5  0.0  5.35  1.75  276.20  starved in the dark(9),cut down by a Dante(8),undone by a trap(4)
86  Thief  Cutthroat  Human  40  0  2.70  3.0  4.0  5.0  0.0  5.05  1.78  293.18  cut down by a Dante(9),cut down by a Gremlin(3),starved in the dark(3)
87  Fighter  Guard  Troll  40  0  2.70  3.0  4.0  5.0  0.0  6.05  1.88  271.83  starved in the dark(9),cut down by a Poltergeist(4),undone by a trap(4)
88  Fighter  Soldier  Fridgian  40  0  2.70  3.0  4.0  5.0  0.0  5.08  1.85  263.33  cut down by a Dante(10),cut down by a China Wolf(3),cut down by a Philly(3)
89  Thief  Cloaker  Dwarven  40  0  2.70  2.0  5.0  12.5  0.0  4.43  1.75  276.23  cut down by a Dante(12),undone by a trap(6),spent by the dungeon itself(4)
90  Fighter  Samurai  Troll  40  0  2.65  3.0  4.0  0.0  0.0  7.40  1.98  251.58  starved in the dark(7),cut down by a Dante(4),cut down by a Poltergeist(4)
91  Fighter  Bard  Dwarven  40  0  2.65  2.0  4.0  7.5  0.0  4.35  1.70  262.23  cut down by a Gremlin(7),cut down by a Dante(6),cut down by a Poltergeist(4)
92  Magic User  Summoner  Wilmsry  40  0  2.60  2.0  5.0  10.0  0.0  3.18  1.70  266.48  cut down by a Gremlin(6),fell off a wall(6),cut down by a Dante(5)
93  Fighter  Barbarian  Fridgian  40  0  2.58  2.0  4.0  7.5  0.0  5.28  1.60  244.83  cut down by a Dante(12),cut down by a Gremlin(3),cut down by a Krupke(3)
94  Thief  Pickpocket  Human  40  0  2.55  2.0  5.0  10.0  0.0  4.75  1.70  263.93  cut down by a Dante(5),cut down by a Poltergeist(5),starved in the dark(4)
95  Magic User  Warlock  Human  40  0  2.55  2.0  5.0  10.0  0.0  2.33  1.68  247.53  cut down by a Dante(10),cut down by a Philly(5),cut down by a Gremlin(4)
96  Magic User  Sorcerer  Dwarven  40  0  2.55  2.0  4.0  5.0  0.0  0.83  1.33  222.38  cut down by a Dante(9),fell off a wall(6),undone by a trap(4)
97  Fighter  Bard  Fridgian  40  0  2.53  2.0  4.0  2.5  0.0  3.58  1.58  239.63  cut down by a Gremlin(9),cut down by a Google(4),cut down by a Poltergeist(4)
98  Thief  Cloaker  Human  40  0  2.50  2.0  5.0  10.0  0.0  4.97  1.68  278.85  cut down by a Dante(6),cut down by a Gremlin(5),cut down by a Poltergeist(5)
99  Fighter  Barbarian  Dwarven  40  0  2.50  2.0  4.0  5.0  0.0  7.15  1.58  238.45  cut down by a Dante(17),cut down by a Gremlin(5),cut down by a Google(2)
100  Fighter  Woodsman  Dwarven  40  0  2.48  2.0  5.0  10.0  0.0  3.03  1.65  244.83  cut down by a Dante(11),cut down by a Gremlin(5),fell off a wall(4)
101  Fighter  Master of Arms  Dwarven  40  0  2.45  3.0  4.0  5.0  0.0  5.30  1.73  235.90  cut down by a Dante(7),fell off a wall(5),cut down by a Gremlin(4)
102  Fighter  Soldier  Dwarven  40  0  2.45  2.0  5.0  12.5  0.0  4.75  1.68  235.63  cut down by a Dante(13),cut down by a Gremlin(6),cut down by a Poltergeist(3)
103  Magic User  Cleric  Human  40  0  2.45  2.0  4.0  7.5  0.0  3.30  1.65  270.60  cut down by a Dante(10),cut down by a China Wolf(4),undone by a trap(4)
104  Magic User  Warlock  Elven  40  0  2.45  2.0  4.0  5.0  0.0  2.98  1.63  225.30  cut down by a Dante(4),cut down by a Gremlin(4),undone by a trap(4)
105  Magic User  Sorcerer  Elven  40  0  2.42  2.0  4.0  7.5  0.0  1.20  1.45  221.78  undone by a trap(8),cut down by a Dante(4),fell off a wall(4)
106  Magic User  Court Mage  Human  40  0  2.40  2.0  4.0  5.0  0.0  2.93  1.65  241.65  cut down by a Dante(12),fell off a wall(4),undone by a trap(4)
107  Fighter  Knight  Fridgian  40  0  2.40  2.0  4.0  5.0  0.0  2.85  1.48  228.03  cut down by a Dante(13),cut down by a Gremlin(4),cut down by a Poltergeist(3)
108  Fighter  Samurai  Human  40  0  2.40  2.0  4.0  0.0  0.0  6.55  1.78  225.60  cut down by a Dante(11),cut down by a Google(4),cut down by a Poltergeist(4)
109  Magic User  Sorcerer  Fridgian  40  0  2.38  2.0  4.0  2.5  0.0  0.95  1.30  244.15  cut down by a Dante(7),cut down by a Gremlin(7),cut down by a Philly(3)
110  Thief  Cat Burglar  Fridgian  40  0  2.35  2.0  5.0  12.5  0.0  5.18  1.73  215.23  cut down by a Dante(11),undone by a trap(6),cut down by a Philly(4)
111  Magic User  Wizard  Elven  40  0  2.35  2.0  4.0  7.5  0.0  2.38  1.45  214.90  cut down by a Dante(7),fell off a wall(6),cut down by a Gremlin(5)
112  Thief  Cutthroat  Fridgian  40  0  2.33  2.0  4.0  5.0  0.0  3.85  1.50  217.48  cut down by a Dante(10),undone by a trap(5),cut down by a Poltergeist(4)
113  Thief  Pickpocket  Fridgian  40  0  2.30  2.0  4.0  7.5  0.0  3.55  1.45  222.13  cut down by a Dante(9),cut down by a Philly(5),spent by the dungeon itself(5)
114  Fighter  Woodsman  Fridgian  40  0  2.30  2.0  4.0  2.5  0.0  2.95  1.55  218.73  cut down by a Dante(10),cut down by a Gremlin(4),fell off a wall(3)
115  Magic User  Warlock  Dwarven  40  0  2.28  2.0  4.0  2.5  0.0  1.58  1.33  200.63  cut down by a Dante(12),cut down by a Gremlin(5),cut down by a Drekk(3)
116  Fighter  Guard  Fridgian  40  0  2.23  2.0  5.0  10.0  0.0  3.35  1.53  226.85  cut down by a Dante(10),cut down by a Gremlin(7),cut down by a Philly(5)
117  Fighter  Knight  Dwarven  40  0  2.23  2.0  3.0  7.5  0.0  3.03  1.43  202.20  cut down by a Dante(11),cut down by a Gremlin(8),cut down by a Philly(3)
118  Magic User  Wizard  Human  40  0  2.23  2.0  4.0  7.5  0.0  1.73  1.43  209.20  cut down by a Dante(9),fell off a wall(8),cut down by a Gremlin(4)
119  Thief  Cutthroat  Dwarven  40  0  2.20  2.0  4.0  7.5  0.0  3.50  1.53  209.93  cut down by a Dante(10),cut down by a Gremlin(7),undone by a trap(4)
120  Fighter  Samurai  Dwarven  40  0  2.20  2.0  4.0  5.0  0.0  5.43  1.55  182.10  cut down by a Dante(12),cut down by a Philly(4),cut down by a Gremlin(3)
121  Magic User  Apprentice  Human  40  0  2.20  2.0  3.0  2.5  0.0  2.15  1.48  222.08  cut down by a Dante(6),came up short on a leap(5),cut down by a Gremlin(5)
122  Magic User  Illusionist  Human  40  0  2.20  2.0  3.0  0.0  0.0  1.83  1.35  219.25  cut down by a Dante(8),cut down by a Gremlin(6),cut down by a Philly(4)
123  Fighter  Guard  Dwarven  40  0  2.17  2.0  4.0  5.0  0.0  3.75  1.50  205.93  cut down by a Dante(13),cut down by a Gremlin(5),cut down by a Blumble(3)
124  Thief  Pickpocket  Dwarven  40  0  2.17  2.0  4.0  5.0  0.0  4.13  1.60  219.58  cut down by a Dante(11),undone by a trap(4),starved in the dark(3)
125  Magic User  Wizard  Fridgian  40  0  2.17  2.0  4.0  2.5  0.0  1.88  1.45  213.90  cut down by a Dante(8),cut down by a Drekk(4),cut down by a Gremlin(4)
126  Magic User  Cleric  Fridgian  40  0  2.13  2.0  4.0  7.5  0.0  2.88  1.43  209.63  cut down by a Dante(12),undone by a trap(6),cut down by a Philly(4)
127  Magic User  Warlock  Fridgian  40  0  2.13  2.0  3.0  7.5  0.0  1.63  1.40  190.15  cut down by a Dante(9),undone by a trap(7),cut down by a Gremlin(6)
128  Magic User  Court Mage  Fridgian  40  0  2.10  2.0  4.0  5.0  0.0  2.23  1.43  227.33  cut down by a Dante(9),cut down by a Gremlin(3),cut down by a Philly(3)
129  Magic User  Court Mage  Dwarven  40  0  2.10  2.0  4.0  0.0  0.0  1.78  1.35  180.53  cut down by a Dante(14),cut down by a Gremlin(7),fell off a wall(3)
130  Magic User  Summoner  Elven  40  0  2.05  2.0  4.0  5.0  0.0  4.22  1.55  188.55  undone by a trap(8),cut down by a Dante(6),cut down by a Gremlin(4)
131  Magic User  Wizard  Dwarven  40  0  2.05  2.0  4.0  2.5  0.0  1.55  1.27  201.68  cut down by a Dante(10),cut down by a Gremlin(6),undone by a trap(4)
132  Magic User  Apprentice  Elven  40  0  2.03  2.0  4.0  5.0  0.0  1.75  1.48  163.07  cut down by a Dante(9),undone by a trap(7),cut down by a Philly(5)
133  Magic User  Apprentice  Fridgian  40  0  2.03  2.0  4.0  2.5  0.0  1.58  1.48  175.83  cut down by a Dante(8),cut down by a Philly(6),fell off a wall(4)
134  Magic User  Cleric  Elven  40  0  2.03  2.0  4.0  2.5  0.0  3.00  1.48  185.30  cut down by a Dante(5),spent by the dungeon itself(5),cut down by a Gremlin(4)
135  Magic User  Apprentice  Dwarven  40  0  1.98  2.0  3.0  0.0  0.0  1.18  1.25  158.35  cut down by a Dante(8),cut down by a Gremlin(5),cut down by a Drekk(4)
136  Magic User  Summoner  Human  40  0  1.98  2.0  4.0  0.0  0.0  3.15  1.53  188.13  cut down by a Dante(10),came up short on a leap(3),cut down by a Gremlin(3)
137  Magic User  Summoner  Fridgian  40  0  1.90  2.0  3.0  0.0  0.0  2.58  1.38  181.73  cut down by a Dante(8),cut down by a Gremlin(6),cut down by a Drekk(5)
138  Magic User  Court Mage  Elven  40  0  1.90  1.0  4.0  5.0  0.0  2.65  1.35  167.45  cut down by a Dante(6),cut down by a Gremlin(5),cut down by a Philly(4)
139  Magic User  Summoner  Dwarven  40  0  1.88  2.0  4.0  2.5  0.0  2.42  1.30  168.58  cut down by a Dante(13),cut down by a Drekk(3),cut down by a Gremlin(3)
140  Magic User  Illusionist  Elven  40  0  1.83  2.0  3.0  0.0  0.0  1.80  1.20  156.95  cut down by a Gremlin(8),cut down by a Philly(6),undone by a trap(4)
141  Magic User  Illusionist  Fridgian  40  0  1.80  1.0  4.0  0.0  0.0  1.48  1.20  174.30  cut down by a Dante(10),cut down by a Gremlin(7),fell off a wall(5)
142  Magic User  Cleric  Dwarven  40  0  1.70  1.0  3.0  0.0  0.0  1.58  1.15  172.65  cut down by a Dante(15),cut down by a Gremlin(9),undone by a trap(4)
143  Magic User  Illusionist  Dwarven  40  0  1.63  1.0  3.0  0.0  0.0  0.88  1.08  140.57  cut down by a Gremlin(13),cut down by a Dante(6),cut down by a Philly(6)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  1920  0  3.42  3.0  6.0  24.6  0.6  6.50  2.22  351.33  cut down by a Dante(248),undone by a trap(200),starved in the dark(177)
Fighter  1880  0  3.05  3.0  5.0  16.2  0.1  5.71  2.00  302.65  cut down by a Dante(292),cut down by a Poltergeist(154),starved in the dark(127)
Magic User  1920  0  2.44  2.0  4.0  7.7  0.1  2.41  1.55  236.82  cut down by a Dante(352),cut down by a Gremlin(178),fell off a wall(162)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  240  0  4.22  4.0  7.0  37.1  2.9  11.92  2.84  428.07  cut down by a Dante(24),undone by a trap(24),starved in the dark(19)
Con Artist  240  0  4.08  4.0  6.0  35.8  0.0  1.59  2.35  422.18  undone by a trap(35),cut down by a Werebeast(23),starved in the dark(20)
Acrobat  240  0  3.71  4.0  6.0  27.9  1.3  8.42  2.42  383.45  starved in the dark(25),undone by a trap(23),cut down by a Dante(19)
Barbarian  240  0  3.44  3.0  6.0  25.0  0.4  8.13  2.08  351.63  cut down by a Dante(41),starved in the dark(18),cut down by a Werebeast(15)
Master of Arms  240  0  3.25  3.0  5.0  18.3  0.4  7.33  2.19  327.16  cut down by a Dante(34),starved in the dark(19),cut down by a Poltergeist(16)
Cat Burglar  240  0  3.23  3.0  6.0  23.8  0.4  7.66  2.23  313.87  undone by a trap(50),cut down by a Dante(35),starved in the dark(20)
Pilfer  240  0  3.20  3.0  5.0  22.1  0.4  6.14  2.06  342.89  cut down by a Dante(49),starved in the dark(18),fell off a wall(14)
Knight  240  0  3.19  3.0  5.0  23.3  0.0  4.54  2.04  316.42  cut down by a Dante(39),cut down by a Poltergeist(25),cut down by a Gremlin(18)
Cloaker  240  0  3.04  3.0  5.0  17.5  0.0  5.60  2.00  323.05  cut down by a Dante(39),starved in the dark(31),undone by a trap(28)
Bard  240  0  3.04  3.0  5.0  12.1  0.0  4.76  1.95  299.70  cut down by a Gremlin(24),cut down by a Poltergeist(24),cut down by a Dante(21)
Woodsman  240  0  3.02  3.0  5.0  17.1  0.0  4.21  1.99  297.91  cut down by a Dante(36),undone by a trap(24),cut down by a Gremlin(18)
Cutthroat  240  0  2.98  3.0  5.0  16.3  0.0  5.76  1.98  304.22  cut down by a Dante(41),starved in the dark(20),undone by a trap(19)
Soldier  240  0  2.95  3.0  5.0  13.3  0.0  5.45  1.97  289.87  cut down by a Dante(46),cut down by a Poltergeist(25),starved in the dark(18)
Pickpocket  240  0  2.88  3.0  5.0  16.7  0.0  4.93  1.85  292.95  cut down by a Dante(35),starved in the dark(24),undone by a trap(21)
Guard  240  0  2.80  3.0  5.0  10.4  0.0  4.85  1.83  277.63  cut down by a Dante(37),cut down by a Poltergeist(23),cut down by a Gremlin(22)
Sorcerer  240  0  2.72  3.0  4.0  9.6  0.0  1.24  1.50  264.27  cut down by a Dante(34),fell off a wall(27),undone by a trap(27)
Samurai  200  0  2.69  3.0  4.0  8.5  0.0  6.54  1.94  252.52  cut down by a Dante(38),cut down by a Poltergeist(17),cut down by a Google(14)
Warlock  240  0  2.58  2.0  5.0  10.4  0.0  2.38  1.62  247.80  cut down by a Dante(45),starved in the dark(22),undone by a trap(21)
Court Mage  240  0  2.52  2.0  4.0  8.8  0.0  2.85  1.63  249.82  cut down by a Dante(48),cut down by a Gremlin(21),fell off a wall(21)
Wizard  240  0  2.48  2.0  4.0  8.8  0.4  2.32  1.55  240.72  cut down by a Dante(46),fell off a wall(27),cut down by a Gremlin(22)
Cleric  240  0  2.42  2.0  4.0  8.8  0.0  2.97  1.59  246.14  cut down by a Dante(54),fell off a wall(21),undone by a trap(21)
Apprentice  240  0  2.40  2.0  4.0  6.7  0.0  2.03  1.62  223.05  cut down by a Dante(37),undone by a trap(21),cut down by a Philly(20)
Illusionist  240  0  2.20  2.0  4.0  4.6  0.0  1.98  1.39  211.13  cut down by a Dante(38),cut down by a Gremlin(38),cut down by a Philly(25)
Summoner  240  0  2.18  2.0  4.0  4.2  0.0  3.48  1.53  211.61  cut down by a Dante(50),cut down by a Gremlin(22),undone by a trap(20)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  960  0  3.93  4.0  6.0  36.9  0.9  4.38  2.34  407.94  cut down by a Dante(97),undone by a trap(74),cut down by a Werebeast(68)
Troll  960  0  3.25  3.0  5.0  16.9  0.2  6.42  2.09  329.28  starved in the dark(254),undone by a trap(78),fell off a wall(72)
Human  960  0  2.88  3.0  5.0  12.1  0.2  5.18  1.91  295.19  cut down by a Dante(167),undone by a trap(88),cut down by a Poltergeist(61)
Elven  960  0  2.84  3.0  5.0  15.0  0.1  5.67  1.98  273.30  cut down by a Dante(115),undone by a trap(101),cut down by a Gremlin(64)
Fridgian  920  0  2.46  2.0  4.0  7.1  0.0  3.58  1.61  238.86  cut down by a Dante(200),cut down by a Gremlin(80),undone by a trap(64)
Dwarven  960  0  2.45  2.0  4.0  8.8  0.1  3.92  1.61  234.37  cut down by a Dante(243),cut down by a Gremlin(120),undone by a trap(65)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 5720 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1
elapsed: 687.2s  workers=4  runs=5720
EXIT=0
```

### tune-classes --seeds 10 --workers 4 --max-actions 5000 --start-depth 20

```
tune-classes: 143 cells x 10 seeds (1430 runs) — start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1  Thief  Cat Burglar  Wilmsry  10  0  21.00  21.0  23.0  100.0  100.0  3.20  5.00  138.30  1.00  1.0  4.90  cut down by a Vampire(2),cut down by a Djinni(1),cut down by a Drake(1)
2  Thief  Ninja  Wilmsry  10  0  20.90  20.0  24.0  100.0  100.0  4.10  5.00  127.00  0.90  0.0  4.60  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Djinni(1)
3  Thief  Con Artist  Troll  10  0  20.80  21.0  22.0  100.0  100.0  1.20  5.00  142.50  0.80  1.0  4.60  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
4  Thief  Acrobat  Wilmsry  10  0  20.80  20.0  23.0  100.0  100.0  1.80  5.00  113.30  0.80  0.0  3.10  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Djinni(1)
5  Thief  Con Artist  Wilmsry  10  0  20.80  20.0  23.0  100.0  100.0  2.60  5.00  192.20  0.80  0.0  5.90  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Vampire(2)
6  Fighter  Woodsman  Wilmsry  10  0  20.60  20.0  23.0  100.0  100.0  1.40  5.00  131.50  0.60  0.0  4.00  cut down by a Djinni(3),cut down by a Herman(2),cut down by a Craig(1)
7  Thief  Ninja  Troll  10  0  20.50  20.0  23.0  100.0  100.0  3.50  5.00  76.50  0.50  0.0  2.80  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Stalka Beast(2)
8  Magic User  Wizard  Wilmsry  10  0  20.50  20.0  23.0  100.0  100.0  0.60  5.00  88.90  0.50  0.0  1.80  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Bones(1)
9  Fighter  Bard  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  0.50  5.00  98.70  0.40  0.0  2.50  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
10  Thief  Cutthroat  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  1.60  5.00  76.10  0.40  0.0  1.50  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
11  Thief  Cutthroat  Human  10  0  20.40  20.0  22.0  100.0  100.0  1.60  5.00  76.10  0.40  0.0  1.50  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
12  Fighter  Guard  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  1.00  5.00  92.00  0.40  0.0  1.90  cut down by a Djinni(4),cut down by a Drarl(2),cut down by a Drudge(1)
13  Fighter  Knight  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  1.00  5.00  92.00  0.40  0.0  1.90  cut down by a Djinni(4),cut down by a Drarl(2),cut down by a Drudge(1)
14  Fighter  Master of Arms  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  1.00  5.00  92.00  0.40  0.0  1.90  cut down by a Djinni(4),cut down by a Drarl(2),cut down by a Drudge(1)
15  Fighter  Soldier  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  1.00  5.00  92.00  0.40  0.0  1.90  cut down by a Djinni(4),cut down by a Drarl(2),cut down by a Drudge(1)
16  Magic User  Sorcerer  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  0.70  5.00  81.40  0.40  0.0  1.60  cut down by a Herman(3),cut down by a Ghost(2),cut down by a Drarl(1)
17  Magic User  Sorcerer  Human  10  0  20.40  20.0  22.0  100.0  100.0  0.70  5.00  81.40  0.40  0.0  1.60  cut down by a Herman(3),cut down by a Ghost(2),cut down by a Drarl(1)
18  Thief  Acrobat  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  0.70  5.00  38.20  0.30  0.0  1.00  cut down by a Drarl(5),cut down by a Herman(2),cut down by a Djinni(1)
19  Thief  Acrobat  Human  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  39.50  0.30  0.0  0.80  cut down by a Drarl(6),cut down by a Djinni(1),cut down by a Dread Lock(1)
20  Fighter  Barbarian  Wilmsry  10  0  20.30  20.0  23.0  100.0  100.0  1.40  5.00  100.30  0.30  0.0  2.70  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Stalka Beast(2)
21  Thief  Cat Burglar  Elven  10  0  20.30  20.0  21.0  100.0  100.0  1.20  5.00  42.00  0.30  0.0  1.10  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Herman(2)
22  Thief  Cloaker  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  2.30  5.00  85.00  0.30  0.0  2.50  cut down by a Drarl(5),cut down by a Vampire(2),cut down by a Djinni(1)
23  Thief  Cloaker  Human  10  0  20.30  20.0  22.0  100.0  100.0  2.40  5.00  85.00  0.30  0.0  2.30  cut down by a Drarl(4),cut down by a Vampire(2),cut down by a Djinni(1)
24  Thief  Con Artist  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  104.70  0.30  0.0  3.30  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
25  Thief  Con Artist  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  104.10  0.30  0.0  3.00  cut down by a Herman(2),cut down by a Vampire(2),cut down by a Craig(1)
26  Thief  Pickpocket  Wilmsry  10  0  20.30  20.0  22.0  100.0  100.0  0.80  5.00  67.40  0.30  0.0  1.70  cut down by a Herman(3),cut down by a Stalka Beast(3),cut down by a Drarl(2)
27  Thief  Pilfer  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.50  5.00  63.10  0.30  0.0  1.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(1)
28  Thief  Pilfer  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.50  5.00  63.10  0.30  0.0  1.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(1)
29  Thief  Pilfer  Wilmsry  10  0  20.30  20.0  22.0  100.0  100.0  1.70  5.00  97.60  0.30  0.0  3.10  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Drudge(2)
30  Magic User  Summoner  Wilmsry  10  0  20.30  20.0  22.0  100.0  100.0  0.90  5.00  80.80  0.30  0.0  2.10  cut down by a Vampire(3),cut down by a Herman(2),cut down by a Drarl(1)
31  Magic User  Wizard  Elven  10  0  20.30  20.0  22.0  100.0  100.0  0.50  5.00  66.70  0.30  0.0  0.50  cut down by a Dread Lock(3),cut down by a Stalka Beast(2),cut down by a Djinni(1)
32  Thief  Acrobat  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  0.70  5.00  32.80  0.20  0.0  0.60  cut down by a Drarl(5),cut down by a Djinni(1),cut down by a Dread Lock(1)
33  Thief  Acrobat  Elven  10  0  20.20  20.0  21.0  100.0  100.0  0.80  5.00  34.20  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Herman(1)
34  Magic User  Apprentice  Wilmsry  10  0  20.20  20.0  22.0  100.0  100.0  0.80  5.00  64.10  0.20  0.0  1.50  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Craig(1)
35  Thief  Cat Burglar  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  43.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Dread Lock(1)
36  Thief  Cat Burglar  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  0.00  5.00  23.10  0.20  0.0  0.80  cut down by a Drarl(6),cut down by a Herman(2),cut down by a Djinni(1)
37  Thief  Cat Burglar  Human  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  43.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Dread Lock(1)
38  Thief  Cloaker  Fridgian  10  0  20.20  20.0  22.0  100.0  100.0  1.30  5.00  63.50  0.20  0.0  2.10  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
39  Thief  Con Artist  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.00  5.00  66.50  0.20  0.0  2.40  cut down by a Drudge(3),cut down by a Djinni(2),cut down by a Craig(1)
40  Thief  Cutthroat  Elven  10  0  20.20  20.0  22.0  100.0  100.0  1.70  5.00  49.70  0.20  0.0  1.30  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(2)
41  Thief  Cutthroat  Wilmsry  10  0  20.20  20.0  21.0  100.0  100.0  1.10  5.00  83.10  0.20  0.0  2.80  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
42  Thief  Ninja  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  1.20  5.00  47.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Dread Lock(2),cut down by a Drudge(1)
43  Thief  Ninja  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.30  5.00  33.70  0.20  0.0  1.00  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Djinni(1)
44  Thief  Ninja  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  0.60  5.00  25.60  0.20  0.0  0.70  cut down by a Drarl(5),cut down by a Herman(2),cut down by a Djinni(1)
45  Thief  Ninja  Human  10  0  20.20  20.0  21.0  100.0  100.0  1.20  5.00  47.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Dread Lock(2),cut down by a Drudge(1)
46  Thief  Pickpocket  Troll  10  0  20.20  20.0  22.0  100.0  100.0  2.10  5.00  51.50  0.20  0.0  1.40  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Craig(1)
47  Magic User  Sorcerer  Wilmsry  10  0  20.20  20.0  22.0  100.0  100.0  0.20  5.00  58.80  0.20  0.0  1.80  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Stalka Beast(2)
48  Magic User  Wizard  Troll  10  0  20.20  20.0  22.0  100.0  100.0  0.10  5.00  60.90  0.20  0.0  0.90  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Dread Lock(2)
49  Thief  Acrobat  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  41.30  0.10  0.0  1.30  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
50  Magic User  Apprentice  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  45.20  0.10  0.0  1.00  cut down by a Drudge(4),cut down by a Spectre(2),cut down by a Stalka Beast(2)
51  Magic User  Apprentice  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.20  5.00  74.90  0.10  0.0  1.60  cut down by a Djinni(4),cut down by a Drarl(2),cut down by a Herman(1)
52  Fighter  Barbarian  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.90  5.00  42.30  0.10  0.0  1.40  cut down by a Drarl(4),cut down by a Stalka Beast(2),cut down by a Djinni(1)
53  Fighter  Barbarian  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.90  5.00  42.30  0.10  0.0  1.40  cut down by a Drarl(4),cut down by a Stalka Beast(2),cut down by a Djinni(1)
54  Fighter  Barbarian  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  50.00  0.10  0.0  0.90  cut down by a Herman(3),came up short on a leap(1),cut down by a Djinni(1)
55  Fighter  Bard  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.30  5.00  64.80  0.10  0.0  2.10  cut down by a Herman(2),cut down by a Vampire(2),came up short on a leap(1)
56  Thief  Cat Burglar  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  29.70  0.10  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Herman(2)
57  Thief  Cloaker  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  60.10  0.10  0.0  1.90  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
58  Magic User  Court Mage  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  69.60  0.10  0.0  0.90  cut down by a Stalka Beast(3),cut down by a Drarl(2),cut down by a Herman(2)
59  Thief  Cutthroat  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  1.00  5.00  51.30  0.10  0.0  1.40  cut down by a Dread Lock(4),cut down by a Drarl(2),cut down by a Drudge(1)
60  Fighter  Guard  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
61  Fighter  Guard  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
62  Fighter  Guard  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.40  5.00  49.60  0.10  0.0  1.20  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Vampire(2)
63  Magic User  Illusionist  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  49.20  0.10  0.0  1.10  cut down by a Drarl(4),cut down by a Herman(3),cut down by a Drudge(1)
64  Magic User  Illusionist  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.00  5.00  58.40  0.10  0.0  0.90  cut down by a Herman(3),cut down by a Djinni(1),cut down by a Drarl(1)
65  Magic User  Illusionist  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  56.30  0.10  0.0  1.90  cut down by a Herman(4),cut down by a Stalka Beast(2),cut down by a Bones(1)
66  Fighter  Knight  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
67  Fighter  Knight  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
68  Fighter  Knight  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.40  5.00  49.60  0.10  0.0  1.20  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Vampire(2)
69  Fighter  Master of Arms  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
70  Fighter  Master of Arms  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
71  Fighter  Master of Arms  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  43.30  0.10  0.0  0.70  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Herman(2)
72  Thief  Pickpocket  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.30  5.00  46.50  0.10  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Vampire(2)
73  Thief  Pickpocket  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  33.50  0.10  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(3),cut down by a Dread Lock(1)
74  Thief  Pilfer  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.30  5.00  34.90  0.10  0.0  1.10  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Dread Lock(1)
75  Thief  Pilfer  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.80  5.00  58.10  0.10  0.0  2.00  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Spectre(2)
76  Fighter  Soldier  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
77  Fighter  Soldier  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  38.50  0.10  0.0  0.40  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
78  Fighter  Soldier  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.40  5.00  49.60  0.10  0.0  1.20  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Vampire(2)
79  Magic User  Sorcerer  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  47.60  0.10  0.0  1.20  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Vampire(2)
80  Magic User  Warlock  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  56.70  0.10  0.0  0.90  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Drake(1)
81  Magic User  Warlock  Human  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  56.70  0.10  0.0  0.90  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Drake(1)
82  Magic User  Warlock  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  50.90  0.10  0.0  1.20  cut down by a Herman(3),cut down by a Drake(2),cut down by a Djinni(1)
83  Magic User  Wizard  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  52.80  0.10  0.0  0.70  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(2)
84  Magic User  Wizard  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.60  5.00  58.30  0.10  0.0  1.40  cut down by a Stalka Beast(3),cut down by a Dread Lock(2),cut down by a Herman(2)
85  Magic User  Wizard  Human  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  52.80  0.10  0.0  0.70  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(2)
86  Fighter  Woodsman  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  37.30  0.10  0.0  1.20  cut down by a Drarl(5),cut down by a Djinni(3),cut down by a Drudge(1)
87  Fighter  Woodsman  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  59.60  0.10  0.0  1.60  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Dread Lock(2)
88  Magic User  Apprentice  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  52.40  0.00  0.0  1.30  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Herman(2)
89  Magic User  Apprentice  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  40.20  0.00  0.0  1.20  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Dread Lock(2)
90  Magic User  Apprentice  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  52.40  0.00  0.0  1.30  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Herman(2)
91  Fighter  Barbarian  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.20  5.00  33.90  0.00  0.0  0.50  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Herman(2)
92  Fighter  Barbarian  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(1),cut down by a Dread Lock(1)
93  Fighter  Bard  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.30  5.00  41.70  0.00  0.0  0.80  cut down by a Drarl(6),cut down by a Dread Lock(2),cut down by a Herman(2)
94  Fighter  Bard  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  36.40  0.00  0.0  0.50  cut down by a Drarl(5),cut down by a Herman(3),cut down by a Djinni(1)
95  Fighter  Bard  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  38.60  0.00  0.0  1.00  cut down by a Drarl(5),cut down by a Drudge(2),cut down by a Djinni(1)
96  Fighter  Bard  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.30  5.00  41.70  0.00  0.0  0.80  cut down by a Drarl(6),cut down by a Dread Lock(2),cut down by a Herman(2)
97  Magic User  Cleric  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  54.40  0.00  0.0  0.50  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drake(1)
98  Magic User  Cleric  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  37.80  0.00  0.0  0.30  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Herman(2)
99  Magic User  Cleric  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  38.20  0.00  0.0  0.50  cut down by a Djinni(2),cut down by a Stalka Beast(2),cut down by a Vampire(2)
100  Magic User  Cleric  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  54.40  0.00  0.0  0.50  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drake(1)
101  Magic User  Cleric  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  53.70  0.00  0.0  0.90  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Djinni(1)
102  Magic User  Cleric  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  71.70  0.00  0.0  1.40  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Drudge(2)
103  Thief  Cloaker  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  28.60  0.00  0.0  0.70  cut down by a Djinni(3),cut down by a Dread Lock(2),cut down by a Drarl(1)
104  Thief  Cloaker  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.70  5.00  49.70  0.00  0.0  1.50  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Vampire(2)
105  Thief  Con Artist  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.40  5.00  46.90  0.00  0.0  2.00  cut down by a Drarl(4),cut down by a Craig(1),cut down by a Djinni(1)
106  Magic User  Court Mage  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  35.40  0.00  0.0  0.70  cut down by a Spectre(2),cut down by a Craig(1),cut down by a Djinni(1)
107  Magic User  Court Mage  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  36.10  0.00  0.0  0.80  cut down by a Herman(2),cut down by a Drake(1),cut down by a Drarl(1)
108  Magic User  Court Mage  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  33.30  0.00  0.0  1.20  cut down by a Drake(2),cut down by a Herman(2),cut down by a Craig(1)
109  Magic User  Court Mage  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  35.40  0.00  0.0  0.70  cut down by a Spectre(2),cut down by a Craig(1),cut down by a Djinni(1)
110  Magic User  Court Mage  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  59.40  0.00  0.0  1.70  cut down by a Djinni(2),cut down by a Craig(1),cut down by a Drake(1)
111  Thief  Cutthroat  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.60  5.00  46.20  0.00  0.0  0.80  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
112  Fighter  Guard  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  34.70  0.00  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Drudge(2)
113  Fighter  Guard  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(1)
114  Magic User  Illusionist  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.40  5.00  47.60  0.00  0.0  1.20  cut down by a Herman(4),cut down by a Drudge(2),cut down by a Craig(1)
115  Magic User  Illusionist  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  29.80  0.00  0.0  0.90  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Craig(1)
116  Magic User  Illusionist  Human  10  0  20.00  20.0  20.0  100.0  100.0  1.40  5.00  47.60  0.00  0.0  1.20  cut down by a Herman(4),cut down by a Drudge(2),cut down by a Craig(1)
117  Fighter  Knight  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  34.70  0.00  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Drudge(2)
118  Fighter  Knight  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(1)
119  Fighter  Master of Arms  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  37.10  0.00  0.0  0.80  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Bones(1)
120  Fighter  Master of Arms  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(1)
121  Thief  Pickpocket  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  43.30  0.00  0.0  0.90  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
122  Thief  Pickpocket  Human  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  42.00  0.00  0.0  0.80  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
123  Thief  Pilfer  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  1.00  5.00  44.50  0.00  0.0  1.50  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Herman(2)
124  Fighter  Samurai  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  38.70  0.00  0.0  0.90  cut down by a Drarl(6),cut down by a Drudge(2),cut down by a Djinni(1)
125  Fighter  Samurai  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  27.60  0.00  0.0  0.60  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Drudge(2)
126  Fighter  Samurai  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  38.70  0.00  0.0  0.90  cut down by a Drarl(6),cut down by a Drudge(2),cut down by a Djinni(1)
127  Fighter  Samurai  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  37.60  0.00  0.0  0.30  cut down by a Djinni(2),cut down by a Drudge(2),cut down by a Herman(2)
128  Fighter  Samurai  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.90  5.00  35.40  0.00  0.0  1.00  cut down by a Drarl(5),cut down by a Drudge(3),cut down by a Djinni(1)
129  Fighter  Soldier  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  34.70  0.00  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Drudge(2)
130  Fighter  Soldier  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(1)
131  Magic User  Sorcerer  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  27.90  0.00  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Djinni(1)
132  Magic User  Sorcerer  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  38.40  0.00  0.0  0.50  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
133  Magic User  Summoner  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  30.70  0.00  0.0  0.60  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
134  Magic User  Summoner  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  22.30  0.00  0.0  0.40  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Vampire(2)
135  Magic User  Summoner  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  22.90  0.00  0.0  0.70  cut down by a Drarl(3),cut down by a Herman(2),eaten by their own summoning(2)
136  Magic User  Summoner  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  30.70  0.00  0.0  0.60  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
137  Magic User  Summoner  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  48.80  0.00  0.0  1.10  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Bones(1)
138  Magic User  Warlock  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  45.50  0.00  0.0  0.40  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drake(1)
139  Magic User  Warlock  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  54.10  0.00  0.0  1.50  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Drarl(2)
140  Magic User  Warlock  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  82.90  0.00  0.0  1.50  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Herman(2)
141  Fighter  Woodsman  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  45.30  0.00  0.0  1.30  cut down by a Drarl(4),cut down by a Djinni(1),cut down by a Drudge(1)
142  Fighter  Woodsman  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.30  0.00  0.0  0.80  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Drudge(2)
143  Fighter  Woodsman  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  45.30  0.00  0.0  1.30  cut down by a Drarl(4),cut down by a Djinni(1),cut down by a Drudge(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Thief  480  0  20.26  20.0  21.0  100.0  100.0  1.41  5.00  63.20  0.26  0.0  1.81  cut down by a Drarl(139),cut down by a Herman(82),cut down by a Dread Lock(47)
Fighter  470  0  20.10  20.0  20.0  100.0  100.0  0.76  5.00  48.80  0.10  0.0  1.08  cut down by a Drarl(163),cut down by a Djinni(93),cut down by a Herman(57)
Magic User  480  0  20.08  20.0  20.0  100.0  100.0  0.47  5.00  52.01  0.08  0.0  1.06  cut down by a Herman(116),cut down by a Drarl(66),cut down by a Djinni(48)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Con Artist  60  0  20.40  20.0  22.0  100.0  100.0  1.33  5.00  109.48  0.40  0.0  3.53  cut down by a Herman(11),cut down by a Drarl(10),cut down by a Drudge(8)
Ninja  60  0  20.37  20.0  21.0  100.0  100.0  1.98  5.00  59.60  0.37  0.0  1.82  cut down by a Drarl(22),cut down by a Herman(10),cut down by a Vampire(8)
Cat Burglar  60  0  20.33  20.0  21.0  100.0  100.0  1.18  5.00  53.32  0.33  0.0  1.58  cut down by a Drarl(23),cut down by a Herman(11),cut down by a Djinni(7)
Acrobat  60  0  20.32  20.0  21.0  100.0  100.0  1.02  5.00  49.88  0.32  0.0  1.28  cut down by a Drarl(27),cut down by a Djinni(9),cut down by a Herman(8)
Cutthroat  60  0  20.22  20.0  21.0  100.0  100.0  1.43  5.00  63.75  0.22  0.0  1.55  cut down by a Dread Lock(14),cut down by a Drarl(12),cut down by a Herman(10)
Wizard  60  0  20.22  20.0  21.0  100.0  100.0  0.47  5.00  63.40  0.22  0.0  1.00  cut down by a Dread Lock(12),cut down by a Herman(10),cut down by a Stalka Beast(10)
Pilfer  60  0  20.18  20.0  21.0  100.0  100.0  1.47  5.00  60.22  0.18  0.0  1.75  cut down by a Drarl(14),cut down by a Djinni(8),cut down by a Herman(8)
Sorcerer  60  0  20.18  20.0  21.0  100.0  100.0  0.42  5.00  55.92  0.18  0.0  1.32  cut down by a Herman(17),cut down by a Drarl(7),cut down by a Vampire(6)
Cloaker  60  0  20.15  20.0  21.0  100.0  100.0  1.60  5.00  61.98  0.15  0.0  1.83  cut down by a Drarl(16),cut down by a Djinni(8),cut down by a Vampire(8)
Woodsman  60  0  20.13  20.0  21.0  100.0  100.0  0.60  5.00  58.55  0.13  0.0  1.70  cut down by a Drarl(17),cut down by a Djinni(11),cut down by a Herman(10)
Guard  60  0  20.12  20.0  20.0  100.0  100.0  0.82  5.00  47.70  0.12  0.0  0.90  cut down by a Drarl(19),cut down by a Djinni(15),cut down by a Drudge(7)
Knight  60  0  20.12  20.0  20.0  100.0  100.0  0.82  5.00  47.70  0.12  0.0  0.90  cut down by a Drarl(19),cut down by a Djinni(15),cut down by a Drudge(7)
Master of Arms  60  0  20.12  20.0  20.0  100.0  100.0  0.87  5.00  47.05  0.12  0.0  0.85  cut down by a Drarl(20),cut down by a Djinni(16),cut down by a Drudge(6)
Pickpocket  60  0  20.12  20.0  20.0  100.0  100.0  1.25  5.00  47.37  0.12  0.0  1.15  cut down by a Herman(17),cut down by a Drarl(15),cut down by a Stalka Beast(9)
Soldier  60  0  20.12  20.0  20.0  100.0  100.0  0.82  5.00  47.70  0.12  0.0  0.90  cut down by a Drarl(19),cut down by a Djinni(15),cut down by a Drudge(7)
Barbarian  60  0  20.10  20.0  20.0  100.0  100.0  1.18  5.00  50.28  0.10  0.0  1.30  cut down by a Drarl(21),cut down by a Djinni(9),cut down by a Herman(9)
Bard  60  0  20.08  20.0  20.0  100.0  100.0  0.27  5.00  53.65  0.08  0.0  1.28  cut down by a Drarl(26),cut down by a Herman(12),cut down by a Dread Lock(6)
Apprentice  60  0  20.07  20.0  20.0  100.0  100.0  0.68  5.00  54.87  0.07  0.0  1.32  cut down by a Djinni(14),cut down by a Herman(12),cut down by a Dread Lock(6)
Illusionist  60  0  20.05  20.0  20.0  100.0  100.0  0.88  5.00  48.15  0.05  0.0  1.20  cut down by a Herman(22),cut down by a Drarl(10),cut down by a Drudge(7)
Summoner  60  0  20.05  20.0  20.0  100.0  100.0  0.67  5.00  39.37  0.05  0.0  0.92  cut down by a Drarl(14),cut down by a Herman(12),cut down by a Vampire(9)
Warlock  60  0  20.05  20.0  20.0  100.0  100.0  0.22  5.00  57.80  0.05  0.0  1.07  cut down by a Herman(18),cut down by a Drarl(9),cut down by a Drake(6)
Court Mage  60  0  20.02  20.0  20.0  100.0  100.0  0.37  5.00  44.87  0.02  0.0  1.00  cut down by a Herman(9),cut down by a Stalka Beast(8),cut down by a Drake(6)
Cleric  60  0  20.00  20.0  20.0  100.0  100.0  0.08  5.00  51.70  0.00  0.0  0.68  cut down by a Herman(16),cut down by a Vampire(9),cut down by a Drarl(8)
Samurai  50  0  20.00  20.0  20.0  100.0  100.0  0.66  5.00  35.60  0.00  0.0  0.74  cut down by a Drarl(22),cut down by a Drudge(11),cut down by a Djinni(7)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Wilmsry  240  0  20.36  20.0  22.0  100.0  100.0  1.18  5.00  90.66  0.36  0.0  2.48  cut down by a Drarl(44),cut down by a Herman(42),cut down by a Djinni(39)
Dwarven  240  0  20.13  20.0  21.0  100.0  100.0  0.96  5.00  51.22  0.13  0.0  1.06  cut down by a Drarl(74),cut down by a Herman(34),cut down by a Djinni(28)
Human  240  0  20.13  20.0  21.0  100.0  100.0  0.99  5.00  51.42  0.13  0.0  1.05  cut down by a Drarl(73),cut down by a Herman(35),cut down by a Djinni(27)
Troll  240  0  20.13  20.0  21.0  100.0  100.0  0.93  5.00  56.47  0.13  0.0  1.35  cut down by a Herman(59),cut down by a Drarl(34),cut down by a Djinni(30)
Elven  240  0  20.08  20.0  20.0  100.0  100.0  0.85  5.00  39.91  0.08  0.0  0.85  cut down by a Drarl(66),cut down by a Herman(46),cut down by a Djinni(37)
Fridgian  230  0  20.06  20.0  20.0  100.0  100.0  0.35  5.00  37.90  0.06  0.0  1.12  cut down by a Drarl(77),cut down by a Herman(39),cut down by a Djinni(26)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 1430 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20
elapsed: 38.4s  workers=4  runs=1430
EXIT=0
```

The two machine-diffable aggregates for Phase 26 are `docs/class-pass/before.json`
(natural start, 143 cells x 40 seeds) and `docs/class-pass/before-depth20.json`
(depth-20 slice, 143 cells x 10 seeds) — aggregates only, no per-run rows.

## Outliers / Findings (Phase 22)

**Stuck investigation (resolved this phase).** The v1.1 pre-milestone 400-seed
baseline (`.planning/research/CLASS-AUDIT-2026-09-14.md`) recorded 19/400
runs (4.75%) hitting the 20,000-action cap — the thrown-only bot looping on
a refused action with no foe turn advancing the fight. Investigation (Plan
22-02) traced these to two refusal-loop shapes, both bot-side, not engine
bugs: 12 **Samurai** runs re-picked a refused flee forever (a Samurai never
flees, but the old bot kept trying below the flee threshold anyway), and 7
**Wizard** runs re-picked a refused melee strike forever (a caster with
charges but no castable attack spell has `playerStrike` refuse, but the old
bot kept attacking anyway). Both are fixed in `tools/lib/tuning-bot.mjs` via
`ctx.fleeBlocked`/`ctx.strikeBlocked` (Rule 1, mirroring the existing
`ctx.parleyBlocked` pattern: set on the `*Refused` event, cleared on the
next `encounterStarted`) — a Samurai now fights instead of re-fleeing, and a
strike-refused Wizard casts something else or flees. The six planning-time
stuck seeds (229652, 783982, 894848, 926524, 1195770, 1274960 — three
Samurai, three Wizard) all finish comfortably under the matrix's 5,000-action
cap after the fix. **Result: 0 stuck runs across both BEFORE captures**
(0 of 5,720 natural-start, 0 of 1,430 depth-20) — the stuck bucket exists in
the harness and is reported honestly, but this snapshot has nothing in it.

**Engine finding carried forward to Phase 23 (IDENT-01), not fixed here.**
A Wizard (and any Magic User whose grimoire rolled no attack spell) with
charges remaining but nothing castable that deals damage cannot melee —
`playerStrike` refuses while any charge remains (`combat.js:337`), regardless
of whether a spell is available to spend that charge on. The bot's own
fallback (cast the lowest-level castable non-quake/non-death spell instead,
or flee) works around this at the harness level, but the underlying "cannot
act" state is an engine identity gap, not a bot bug — the Phase 22 scope
explicitly excludes engine rule changes beyond the dev-only `force` option,
so **this finding is deliberately not fixed in this phase**. It is exactly
the class of bug IDENT-01 (Phase 23, "Casters Can Act") exists to close. The
BY SUBCLASS roll-up above already shows the shape of the cost: Wizard
(mean 2.48, natural start) sits well below the Thief/Fighter median while
Summoner (2.18) and Illusionist (2.20) — the other two subs flagged in
`.planning/research/CLASS-AUDIT-2026-09-14.md` as having no L1 damage
source — anchor the bottom of the BY SUBCLASS table.

**No unreachable-exit or other engine dead-end appeared** in either the
5,720-run natural-start scan or the 1,430-run depth-20 scan — every death
cause in both transcripts above is an ordinary combat/trap/starvation/fall
cause, and 0 cells in either JSON have `stuck > 0`.

**No cell in either `docs/class-pass/before.json` or
`docs/class-pass/before-depth20.json` has a stuck run** (`Stuck: 0 of 5720`
and `Stuck: 0 of 1430` respectively) — every cell's `n` equals its seed
count and every cell's `completed` equals `n`.

**Superseded baseline.** The 400-seed pre-milestone numbers in
`.planning/research/CLASS-AUDIT-2026-09-14.md` were captured with the old
thrown-only bot (no summon/sing/parley-by-subclass, casters cast only
thrown attack spells) and are **superseded by this BEFORE** — treat that
document's numbers as a floor for caster sub-classes, not a true reading;
this ledger's natural-start and depth-20 tables above are the corrected
yardstick going forward.

**Phase 23 note (2026-09-14, smoke readout — NOT the AFTER matrix).** The
IDENT-01..04 fixes this finding pointed at have landed, at commit `0056625`:
a Wizard now fights with the staff once no attack spell is castable (and the
refusal names the spell it should have cast instead), every non-Summoner
Magic User's day-one grimoire is guaranteed at least one usable-now attack
spell (Doze/Freeze/Stun/Weaken), Summon is castable at level 1 for a
Summoner (doubled, per canon), Phantom Host is castable at level 1 for an
Illusionist (undoubled), and — a user-added rule riding along — a Freeze
kill now pays experience/coin/treasure/kill-count/party-split via `killFoe`
exactly like any other kill, instead of awarding nothing.

A 120-run smoke (6 races x 20 seeds, default flags) was run for each of the
three worst subs this finding names:

```
node tools/tune-classes.mjs --sub Wizard --seeds 20
node tools/tune-classes.mjs --sub Summoner --seeds 20
node tools/tune-classes.mjs --sub Illusionist --seeds 20
```

| Sub | BEFORE mean depth (143x40 matrix) | Phase 23 smoke (6 races x 20 seeds) | Stuck |
|---|---|---|---|
| Wizard | 2.48 | 2.44 | 0 of 120 |
| Summoner | 2.18 | 2.78 | 0 of 120 |
| Illusionist | 2.20 | 2.42 | 0 of 120 |

**Caveat, explicit:** this is a 120-run smoke at the tool's default flags
(`seeds=20`, `exploreBudget=50`, `maxActions=5000`), not the pinned 40-seed/
143-cell `Bot:` line the BEFORE matrix above used — different sample size,
different `seeds=` value, no `--workers`/`--max-actions` parity with the
matrix run. Read it as a directional signal only (Summoner and Illusionist
both moved up; Wizard is flat within noise, plausibly because a Wizard who
already had an attack spell was never the failure case IDENT-01 targeted —
the failure case was "charges left, nothing castable," which this smoke's
aggregate mean does not isolate). The paired, rigorous AFTER matrix
(same 143 cells, same seed count, same flags as BEFORE) is Phase 26
(PLAY-02); the per-sub Rulings entries (including "Freeze pays out") are
Phase 24 (PLAY-03) — a draft of that entry is in this plan's SUMMARY
(`.planning/phases/23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell/23-04-SUMMARY.md`)
for Phase 24 to paste.

## Rulings (Phase 24 — PLAY-03)

Every sub-class and race good/bad ruling — what stays as-is, what gets an
engine-verified GOOD or BAD it currently lacks (per the FLAVOR-ONLY and
NO-BAD/NO-GOOD findings in `.planning/research/CLASS-AUDIT-2026-09-14.md`),
and the rationale for each — lands here once Phase 24 ("Every Sub-class and
Race: One Good, One Bad") closes. Nothing recorded yet.

## AFTER — commit `<hash>` (Phase 26 — PLAY-02)

The AFTER matrix (post-identity-pass engine, after Phases 23-25 land) is
captured here once Phase 26 ("Mass Playtest & Class-Pass Ledger") runs:

```
node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/after.json
node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/after-depth20.json
```

Grep-diff each AFTER transcript's `Bot:` line against the two `Bot:` lines
in the BEFORE section above (they must be byte-identical apart from the
`seeds=`/`startDepth=` fields) to prove the two snapshots used identical bot
parameters. Machine-diff `docs/class-pass/after.json` /
`after-depth20.json` against their BEFORE counterparts for the per-cell
deltas. **Fun-band verdicts per row are written here, not in the tool** —
`tools/tune-classes.mjs` and `tools/lib/class-matrix.mjs` deliberately never
emit editorial language (no "fun"/"strong"/"weak"/"over"/"under" wording
anywhere in their output); that judgment is Phase 26's own editorial work.
Nothing recorded yet.
