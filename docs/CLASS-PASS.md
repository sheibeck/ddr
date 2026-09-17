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

Every sub-class and race good/bad ruling landed in Phase 24 ("Every
Sub-class and Race: One Good, One Bad"), commits `d28c3ed`..`28de35c`
(Plans 24-01 through 24-06). Every rule change below carries a
`// DELIBERATE RULES CHANGE (Phase 24, ...)` comment in the engine naming
the prototype's old behavior and this phase's rationale — this section
records the design decision and its one-line rationale, never re-derives
the mechanic.

### Sub-class rulings

- **Knight — bad: never-first vs a live big foe.** Against any encounter
  containing a live foe with `maxWP >= 20`, a Knight never wins initiative
  (unless foreseen); rationale: "everything over 20 comes straight at
  you" — the flavor's own line, now a real `rollInitiative` override
  (IDENT-05).
- **Ninja — bad: cannot parley, ever.** `canParley` refuses a Ninja for any
  encounter type at any fluency, mirrored in `mazeworld.html`'s classic
  `canParley()`; rationale: "you never speak" is now literal, not a joke
  (IDENT-05).
- **Bard — bad: camp wake on 1-2; party clause.** Camping's eight hourly
  wake rolls hit a Bard on a d20 of 1 OR 2 (same eight draws, wider hit),
  and in party play an intel<=3 foe targets the Bard hero outright;
  rationale: "creatures too stupid to know better come for you first" —
  any biased zero-draw re-pick of the existing target draw would have to
  exclude some other party member to make room for the Bard, so outright
  targeting (not a re-roll) is the only symmetric zero-draw design
  (IDENT-05).
- **Master of Arms — bad: cannot parley + no clean round-1 exit.** Same
  `canParley` gate as Ninja, and the Tracking round-1 clean withdrawal is
  denied — falls to the ordinary Fighter flee roll; rationale: "you attack
  creatures without question," including the ones you'd rather flee from
  (IDENT-05).
- **Court Mage — bad: foes act first in round one; good: 1-in-6 boredom +
  always parleys Humans.** `rollInitiative` never lets a Court Mage win
  round-1 initiative (unless foreseen); boredom kill widened from
  `rng.d(12) === 1` to `rng.d(12) <= 2` (1-in-6, same single draw); `canParley`
  always allows a Court Mage to parley Humans (courtly manners); rationale:
  "you talk first" cuts both ways — foes act first, but courtesy earns a
  free pass with Humans and a better chance the fight never needed to
  happen (IDENT-05/06).
- **Pickpocket — bad: buy x1.25 / sell x0.75.** Every `priceFor`-routed
  store line (weapons, armour, premium, rations, repair) costs 25% more to
  buy and pays 25% less to sell back, floor 1; flat-priced lines (food,
  potions, lockpicks, scrolls) stay untouched; rationale: "never been
  thanked" — shopkeepers remember a Pickpocket's face (IDENT-05).
- **Cutthroat — bad: Joiners refuse, rolled first.** A Joiner is still
  rolled with the exact same draws, then refused (`joinerRefused`, reason
  `cutthroat`) with `pendingJoiner` left null; rationale: "one member of
  every party dies by your hand" is replaced with the real, testable
  mechanic — nobody signs up to find out (IDENT-05).
- **Guard — good: -1 to be hit.** `foeToHitVs` subtracts 1 for a Guard,
  stacking with Agility, floor 1; rationale: "the profession is standing
  there" — a Guard's whole training is not getting hit (IDENT-06).
- **Woodsman — enforced: no armour over ar 10.** `canEquipArmor` (via the
  new `armorRefusalReason` helper) refuses Mail/Plate — anything heavier
  than Studded — across take, equip, AND the store's own stock filter (a
  Woodsman is never even offered the line); rationale: a forester in tin
  is a target, not a hunter (IDENT-07).
- **Pilfer — enforced: heal-kind items only.** `useItem` refuses any item
  whose `kind` is not `"heal"` or `"full"` before any side effect fires
  (`useRefused`, reason `pilfer`); drinkPotion and the existing scroll
  block (`canRead`) are untouched; rationale: "does not heal, so as far as
  a Pilfer is concerned it does not work" (IDENT-07).
- **Cloaker — bad made real: vanish only before the first landed blow.**
  The free vanish now gates on `!C.opened2`; once the Cloaker has struck
  this fight, `flee` falls through to the ordinary d20+5-vs-11 Thief roll
  (`vanishDenied` narrated); rationale: "you can always vanish — as long
  as nobody has seen your face yet" (IDENT-07).

### Race rulings

- **Human** — neutral control, no change (user decision, 2026-09-14).
- **Elven** — no mechanic change; the 0.6x wp / strikes-a-die-better
  blurb was checked true against `content/races.js` and left as-is.
- **Dwarven — good: armour wears at half rate.** Armour durability loses
  `Math.ceil(dmg / 2)` instead of the full `dmg` on a soaked blow; keeps
  the existing +2 damage, upkeep 1, half prices, and foes-strike-a-die-
  better bad; rationale: "built to be hit" deserved a mechanic, not just a
  blurb (IDENT-09).
- **Wilmsry — bad made real: Magic User Joiners refuse.** Same
  `joinerRefused` mechanism as the Cutthroat (reason `wilmsry`), checked
  after the joiner is fully rolled; heal 2x, parley +4, haggle, and half sp
  are unchanged; rationale: "Magic Users despise you" is now literal
  (IDENT-09). The Wilmsry numeric trim (parley +4, heal 2x) is explicitly
  deferred to after Phase 26's AFTER matrix, per `24-CONTEXT.md`.
- **Fridgian — two changes.** (a) The frenzy's second swing is never
  wasted on a corpse — the `corpse && rng.d(10) <= 5` whiff branch is
  deleted, removing one draw whenever a Fridgian frenzies with a corpse
  present (the one rng-cursor change of the phase); (b) a Fridgian's hide
  soaks 2 flat from every blow, floor 1, stacking with Hardiness's -3;
  rationale: the frenzy fix closes a canon annoyance (wasting a swing on
  something already dead) and the hide gives the "no armor, always last"
  bad a real, offsetting good (IDENT-09).
- **Troll** — no mechanic change; the 75wp/+9dmg/double-rations/triple-
  cost blurb was checked true and left as-is.

### Ruling: level-1 Thief dagger (IDENT-10) — KEEP

The level-1 Thief's starting dagger stays exactly as-is — no engine
change. Rationale, per `24-CONTEXT.md`'s recorded decision: Thieves already
lead the BEFORE matrix (this ledger's own BY SUBCLASS roll-up above shows
Ninja at mean depth 4.22, Con Artist at 4.08, and Acrobat at 3.71 — the top
three subs in the entire 143-cell matrix); the opener backstab doubles the
dagger's 2-4 damage on the first landed blow of a fight; and a better
weapon is one find away on any floor. The dagger is the price of the
class's escape/stealth kit, not an accident of the port. Revisit only if
Phase 26's AFTER matrix shows Thieves sliding below the class median.

### Ruling: Freeze pays out (landed Phase 23)

**Ruling: Freeze pays out (landed Phase 23, commit `0056625`).** The
prototype's Freeze spell marked its target dead and frozen without ever
calling `killFoe` — a Freeze kill awarded zero experience, coin, treasure
roll, kill count, or party split, even though every other lethal action in
the game (a melee strike, any other thrown spell, Insanity's roll-1 kill,
the death spell) pays through the same routine. This was ruled a bug in
the port, not an intentional rule, because Freeze is the level-1 thrown
spell most casters' guaranteed day-one attack spell (Plan 22-02, IDENT-02)
resolves to — without this fix, a caster's "guaranteed way to win a fight"
would have been a guaranteed way to win a fight for free XP. The fix:
Freeze still narrates with `frozenSolid` (and the target still ends up
`alive: false, frozen: true, wp: 0`), but the kill now routes through
`killFoe` exactly like a melee kill — same sp formula (`killSpFor`), same
coin roll, same treasure check, same kill count increment, same party-XP
split. One canon consequence: a kill-twice (`lives: 2`) creature (e.g.,
Philly, Skeleton) now correctly shrugs off a single Freeze and stands back
up at full wp, per the rulebook's "you have to kill it twice" — the
prototype let Freeze bypass the lives rule entirely, one-shotting even a
kill-twice creature.

Petrify/Turn/Gate v1.3 candidate note: `petrify`, `turn` (Walking Dead
only), and `gate` (Walking Dead/Demons only) all bypass `killFoe` in the
same shape Freeze used to; the user asked for Freeze only, so these three
are deliberately left as-is and flagged as a v1.3 spell-audit candidate.

### Good / bad table (source: test/unit/identity-contract.test.js)

| Sub / Race | GOOD | BAD |
| --- | --- | --- |
| Wizard | Full offense-school bonus (3), learns every school | Refuses to melee while a castable attack spell sits unused |
| Warlock | A nightly potion duplicates itself | Props up every Walking Dead foe in the room |
| Sorcerer | Grimoire guaranteed to carry Freeze and Fireball | Own arm caps at 9 damage |
| Summoner | Summons at level one instead of level two | Gated out of offense at level one even when a spell is known |
| Cleric | Heals 3 more than anyone else, rolls 4 to hit | No offensive bonus at all (soft bad) |
| Illusionist | Phantom Host summonable at level one instead of level three | Strikes on a d20 until level three |
| Court Mage | Boredom kills 1-in-6 (d12<=2); always parleys Humans | Talks first — foes act first in round one only |
| Apprentice | Double skill points off a kill at level one | One spell in eight backfires |
| Knight | Beneath the notice of small things — a foe under 5 maxWP flees | Everything over 20 comes straight at you — never wins initiative vs a live maxWP >= 20 foe |
| Guard | The profession is standing there — every foe needs one better to land a blow | Own blow is weaker and never crits |
| Woodsman | The professional forester — parleys Beasts/Lair Beasts | No mail, no plate — refused anything heavier than Studded |
| Soldier | Camp heals twice as fast | A foe's roll of 2 crits, doubling the blow |
| Barbarian | Two attacks every strike | Half skill points off a kill |
| Master of Arms | Plus two with every weapon ever forged | Cannot parley, ever; no clean round-1 tracked withdrawal |
| Samurai | Born in plate, wielding a magic katana | Never wins initiative, never runs |
| Bard | Courtly enough to talk to anyone — parleys Humans at fluency 0 | Camp wakes wandering monsters twice as often; dumb foes come for the Bard |
| Pickpocket | An extra take off every kill/chest | Shopkeepers know your face — buys x1.25, sells x0.75 |
| Pilfer | Disarms every trap, opens every chest for free | Cannot use a single item that does not heal |
| Cat Burglar | The first strike of any fight always lands | Every trap that catches them deals double damage |
| Cutthroat | The first landed blow always crits, even in armor a backstab would refuse | No Joiner will ever travel with you |
| Cloaker | A free vanish while nobody has seen your face | Once seen, the vanish is denied |
| Ninja | The opener always lands for max weapon damage; a later roll of 2 crits | You never speak — canParley is false unconditionally |
| Con Artist | Can talk anyone down except Magical/Walking Dead; a weak foe leaves before the fight starts | The opening blow is a warning, not an injury |
| Acrobat | Harder to land a blow on, easier to land one | A dagger, and only a dagger |
| Elven | Strikes a die better and hits at 5 whatever the class | 0.6x wp and easier to hit |
| Dwarven | +2 damage; armour built to be hit wears at half the rate | Foes strike at a better die |
| Wilmsry | Camp heals twice as fast; parleys Beasts at fluency 0 | Half skill points; Magic User Joiners refuse to travel with them |
| Fridgian | Frenzy never wastes its second swing; thick hide soaks 2 from every blow | Never wears armor, always strikes last |
| Troll | 75 wp regardless of class; +9 damage | Prices triple, eats two rations a night |
| Human | *(neutral — no race modifier anywhere)* | *(neutral)* |

### Fidelity posture (FID-07)

Zero new serialized fields were introduced by this phase — every mechanic
above reads `c.sub`, `c.race`, or an existing combat flag (`C.opened2`),
so no `*Comparable()` carve-out is needed and a v1.0/v1.1 save loads
unchanged; `git diff --stat 4ba2edd..HEAD -- test/parity/harness/comparables.js`
shows only Plan 24-02's declared-divergence helpers landing (`1 file
changed, 157 insertions(+)`), and `test/parity/prototype-master.js.txt` is
untouched over the same range. Every new event type is narrated:
`withdrawalDenied`, `vanishDenied`, `joinerRefused`, `useRefused`; one
event type was removed (the Fridgian corpse-whiff `frenzyWasted` entry,
since its underlying draw no longer exists). Two declared action-path
fixture divergences exist (`combat/lose`, seed 14; `economy`, seed 3) plus
one restored death-path scenario (`lose-apprentice`, seed 127) — full
detail in `test/parity/FIXTURE-INVENTORY.md`'s "Phase 24" section.

### Phase 24 note (2026-09-14, smoke readout — NOT the AFTER matrix)

Six smoke runs (`tools/tune-classes.mjs`, 20 seeds each — 120 runs per
`--sub`, 460/480 runs per `--race` since a race run covers every sub in
that race) were taken for the six mechanics changed in this phase with the
largest measured shift in either direction (Knight/Court Mage/Guard/
Pickpocket subs; Fridgian/Dwarven races):

```
node tools/tune-classes.mjs --sub Knight --seeds 20
node tools/tune-classes.mjs --sub "Court Mage" --seeds 20
node tools/tune-classes.mjs --sub Guard --seeds 20
node tools/tune-classes.mjs --sub Pickpocket --seeds 20
node tools/tune-classes.mjs --race Fridgian --seeds 20
node tools/tune-classes.mjs --race Dwarven --seeds 20
```

| Sub / Race | BEFORE mean depth (roll-up) | Phase 24 smoke (20 seeds) | Stuck |
| --- | --- | --- | --- |
| Knight | 3.19 | 3.48 | 0 of 120 |
| Court Mage | 2.52 | 2.49 | 0 of 120 |
| Guard | 2.80 | 3.22 | 0 of 120 |
| Pickpocket | 2.88 | 3.01 | 0 of 120 |
| Fridgian | 2.46 | 2.97 | 0 of 460 |
| Dwarven | 2.45 | 2.73 | 0 of 480 |

**Caveat, explicit:** this is a smoke readout at the tool's default flags
(`exploreBudget=50`, `maxActions=5000`), not the pinned 40-seed/143-cell
`Bot:` line the BEFORE matrix above used — different sample size, no
`--workers`/`--max-actions` parity with the matrix run. Read it as a
directional signal only: every sub/race here moved up or held flat, none
regressed, and 0 of 1560 total smoke runs got stuck. No dial or bot policy
was changed based on this readout. The paired, rigorous AFTER matrix (same
143 cells, same seed count, same flags as BEFORE) is Phase 26 (PLAY-02).

## AFTER — commit d1e32357474a0f232515a19660ea3ed12c3f8b07 (Phase 26 — PLAY-02)

**Zero cannot-act cells.** 0 of 143 AFTER natural-start cells have meanKills < 0.5 or stuck > 0 (0 of 5720 natural-start runs stuck; depth-20 slice: 0 of 1430 runs stuck).
**Parameter parity (BEFORE vs AFTER, modulo commit):** natural pair identical; deep pair identical.
**mu (mean death depth over all completed AFTER natural-start runs) = 3.08** (BEFORE mu 2.97, delta +0.10). Bands relative to AFTER mu: too weak < 2.31 (0.75mu) · fine 2.31–4.15 (closed) · too strong > 4.15 (1.35mu) · cannot act = meanKills < 0.5 or stuck > 0. mu is run-weighted: sum(meanDepth x completed) / sum(completed) over the 143 cells.

### By class — BEFORE → AFTER
| # | Class | BEFORE mean | AFTER mean | Δ | BEFORE p50 | AFTER p50 | BEFORE ≥5 | AFTER ≥5 | AFTER ≥10 | AFTER kills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thief | 3.42 | 3.51 | +0.09 | 3.0 | 3.0 | 24.6 | 26.3 | 0.6 | 7.09 |
| 2 | Fighter | 3.05 | 3.16 | +0.11 | 3.0 | 3.0 | 16.2 | 16.9 | 0.2 | 6.33 |
| 3 | Magic User | 2.44 | 2.55 | +0.11 | 2.0 | 2.0 | 7.7 | 8.5 | 0.1 | 4.99 |

### Sub-classes — bottom five and top five (AFTER)
**Bottom five**

| # | Sub | Class | BEFORE | AFTER | Δ | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | Warlock | Magic User | 2.58 | 2.56 | -0.02 | fine |  |  |
| 21 | Wizard | Magic User | 2.48 | 2.46 | -0.02 | fine |  |  |
| 22 | Court Mage | Magic User | 2.52 | 2.45 | -0.07 | fine |  |  |
| 23 | Illusionist | Magic User | 2.20 | 2.41 | +0.21 | fine |  |  |
| 24 | Apprentice | Magic User | 2.40 | 2.35 | -0.05 | fine |  |  |

**Top five**

| # | Sub | Class | BEFORE | AFTER | Δ | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | Thief | 4.22 | 4.33 | +0.11 | too strong | accept | Too strong at AFTER 4.33 (BEFORE 4.22): the opener is the whole fantasy -- ordinary deaths (Werebeasts, traps, starvation) still end most runs, and canParley-false still forces every fight. |
| 2 | Con Artist | Thief | 4.08 | 4.07 | -0.01 | fine |  |  |
| 3 | Acrobat | Thief | 3.71 | 3.89 | +0.18 | fine |  |  |
| 4 | Barbarian | Fighter | 3.44 | 3.66 | +0.22 | fine |  |  |
| 5 | Cat Burglar | Thief | 3.23 | 3.40 | +0.17 | fine |  |  |

### Races — BEFORE → AFTER (Human is the control)
| # | Race | BEFORE | AFTER | Δ | ≥5 BEFORE | ≥5 AFTER | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 3.93 | 3.92 | -0.01 | 36.9 | 36.4 | fine | accept | in band at AFTER 3.92 (BEFORE 3.93) -- the Joiner refusal closed the gap; deferred numeric trim closed |
| 2 | Troll | 3.25 | 3.26 | +0.01 | 16.9 | 17.0 | fine |  |  |
| 3 | Fridgian | 2.46 | 2.90 | +0.44 | 7.1 | 12.2 | fine |  |  |
| 4 | Human | 2.88 | 2.89 | +0.01 | 12.1 | 11.6 | fine |  |  |
| 5 | Elven | 2.84 | 2.86 | +0.02 | 15.0 | 15.1 | fine |  |  |
| 6 | Dwarven | 2.45 | 2.61 | +0.16 | 8.8 | 11.0 | fine |  |  |

### Sub-classes — all 24 rows (AFTER rank order)
| # | Sub | Class | BEFORE | AFTER | Δ | ≥5 BEFORE | ≥5 AFTER | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | Thief | 4.22 | 4.33 | +0.11 | 37.1 | 42.5 | too strong | accept | Too strong at AFTER 4.33 (BEFORE 4.22): the opener is the whole fantasy -- ordinary deaths (Werebeasts, traps, starvation) still end most runs, and canParley-false still forces every fight. |
| 2 | Con Artist | Thief | 4.08 | 4.07 | -0.01 | 35.8 | 37.1 | fine |  |  |
| 3 | Acrobat | Thief | 3.71 | 3.89 | +0.18 | 27.9 | 31.7 | fine |  |  |
| 4 | Barbarian | Fighter | 3.44 | 3.66 | +0.22 | 25.0 | 29.6 | fine |  |  |
| 5 | Cat Burglar | Thief | 3.23 | 3.40 | +0.17 | 23.8 | 25.4 | fine |  |  |
| 6 | Pilfer | Thief | 3.20 | 3.35 | +0.15 | 22.1 | 24.2 | fine |  |  |
| 7 | Knight | Fighter | 3.19 | 3.30 | +0.11 | 23.3 | 20.0 | fine |  |  |
| 8 | Master of Arms | Fighter | 3.25 | 3.22 | -0.03 | 18.3 | 14.2 | fine |  |  |
| 9 | Woodsman | Fighter | 3.02 | 3.13 | +0.11 | 17.1 | 17.5 | fine |  |  |
| 10 | Guard | Fighter | 2.80 | 3.13 | +0.33 | 10.4 | 14.6 | fine |  |  |
| 11 | Cutthroat | Thief | 2.98 | 3.11 | +0.13 | 16.3 | 17.9 | fine |  |  |
| 12 | Bard | Fighter | 3.04 | 3.03 | -0.01 | 12.1 | 13.3 | fine |  |  |
| 13 | Cloaker | Thief | 3.04 | 2.99 | -0.05 | 17.5 | 13.8 | fine |  |  |
| 14 | Soldier | Fighter | 2.95 | 2.98 | +0.03 | 13.3 | 15.4 | fine |  |  |
| 15 | Pickpocket | Thief | 2.88 | 2.94 | +0.06 | 16.7 | 17.9 | fine |  |  |
| 16 | Sorcerer | Magic User | 2.72 | 2.88 | +0.16 | 9.6 | 12.5 | fine |  |  |
| 17 | Samurai | Fighter | 2.69 | 2.76 | +0.07 | 8.5 | 9.0 | fine |  |  |
| 18 | Summoner | Magic User | 2.18 | 2.71 | +0.53 | 4.2 | 9.6 | fine |  |  |
| 19 | Cleric | Magic User | 2.42 | 2.62 | +0.20 | 8.8 | 9.2 | fine |  |  |
| 20 | Warlock | Magic User | 2.58 | 2.56 | -0.02 | 10.4 | 9.2 | fine |  |  |
| 21 | Wizard | Magic User | 2.48 | 2.46 | -0.02 | 8.8 | 7.1 | fine |  |  |
| 22 | Court Mage | Magic User | 2.52 | 2.45 | -0.07 | 8.8 | 6.7 | fine |  |  |
| 23 | Illusionist | Magic User | 2.20 | 2.41 | +0.21 | 4.6 | 8.8 | fine |  |  |
| 24 | Apprentice | Magic User | 2.40 | 2.35 | -0.05 | 6.7 | 5.4 | fine |  |  |

### Reach table (AFTER natural, pooled over completed runs)
| Floor | BEFORE | AFTER |
| --- | --- | --- |
| ≥5 | 16.2 | 17.2 |
| ≥10 | 0.3 | 0.3 |
| ≥20 | n/a | n/a |

≥20 is not carried per cell by the Phase 22 harness JSON (reach5/reach10 only); the highest per-cell p90 in the AFTER matrix is 8.0, so no cell reaches 20 in 10% or more of its runs; the depth-20 slice below is the ≥20 yardstick.

### Depth-20 slice — Phase 27's yardstick (no verdicts)
**By class**

| # | Class | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thief | 0.26 | 0.25 | -0.01 | 1.81 | 1.72 | -0.09 |
| 2 | Fighter | 0.10 | 0.10 | +0.00 | 1.08 | 1.17 | +0.09 |
| 3 | Magic User | 0.08 | 0.07 | -0.01 | 1.06 | 1.07 | +0.01 |

**By sub-class**

| # | Sub | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Con Artist | 0.40 | 0.40 | +0.00 | 3.53 | 3.52 | -0.01 |
| 2 | Cat Burglar | 0.33 | 0.33 | +0.00 | 1.58 | 1.57 | -0.01 |
| 3 | Acrobat | 0.32 | 0.30 | -0.02 | 1.28 | 1.25 | -0.03 |
| 4 | Ninja | 0.37 | 0.27 | -0.10 | 1.82 | 1.28 | -0.54 |
| 5 | Guard | 0.12 | 0.23 | +0.11 | 0.90 | 1.43 | +0.53 |
| 6 | Cutthroat | 0.22 | 0.22 | +0.00 | 1.55 | 1.62 | +0.07 |
| 7 | Wizard | 0.22 | 0.22 | +0.00 | 1.00 | 0.95 | -0.05 |
| 8 | Pilfer | 0.18 | 0.18 | +0.00 | 1.75 | 1.77 | +0.02 |
| 9 | Sorcerer | 0.18 | 0.18 | +0.00 | 1.32 | 1.33 | +0.01 |
| 10 | Cloaker | 0.15 | 0.15 | +0.00 | 1.83 | 1.58 | -0.25 |
| 11 | Woodsman | 0.13 | 0.13 | +0.00 | 1.70 | 1.73 | +0.03 |
| 12 | Pickpocket | 0.12 | 0.12 | +0.00 | 1.15 | 1.18 | +0.03 |
| 13 | Barbarian | 0.10 | 0.10 | +0.00 | 1.30 | 1.38 | +0.08 |
| 14 | Bard | 0.08 | 0.10 | +0.02 | 1.28 | 1.38 | +0.10 |
| 15 | Knight | 0.12 | 0.07 | -0.05 | 0.90 | 0.93 | +0.03 |
| 16 | Soldier | 0.12 | 0.07 | -0.05 | 0.90 | 0.93 | +0.03 |
| 17 | Apprentice | 0.07 | 0.05 | -0.02 | 1.32 | 1.23 | -0.09 |
| 18 | Illusionist | 0.05 | 0.05 | +0.00 | 1.20 | 1.23 | +0.03 |
| 19 | Master of Arms | 0.12 | 0.05 | -0.07 | 0.85 | 0.82 | -0.03 |
| 20 | Court Mage | 0.02 | 0.03 | +0.01 | 1.00 | 1.17 | +0.17 |
| 21 | Warlock | 0.05 | 0.03 | -0.02 | 1.07 | 0.90 | -0.17 |
| 22 | Samurai | 0.00 | 0.02 | +0.02 | 0.74 | 0.68 | -0.06 |
| 23 | Cleric | 0.00 | 0.00 | +0.00 | 0.68 | 0.68 | +0.00 |
| 24 | Summoner | 0.05 | 0.00 | -0.05 | 0.92 | 1.03 | +0.11 |

**By race**

| # | Race | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 0.36 | 0.30 | -0.06 | 2.48 | 2.22 | -0.26 |
| 2 | Human | 0.13 | 0.13 | +0.00 | 1.05 | 1.07 | +0.02 |
| 3 | Troll | 0.13 | 0.13 | +0.00 | 1.35 | 1.35 | +0.00 |
| 4 | Dwarven | 0.13 | 0.12 | -0.01 | 1.06 | 1.18 | +0.12 |
| 5 | Elven | 0.08 | 0.09 | +0.01 | 0.85 | 0.93 | +0.08 |
| 6 | Fridgian | 0.06 | 0.07 | +0.01 | 1.12 | 1.18 | +0.06 |

### Out-of-band cells (appendix)
In band: 113 of 143 cells (fine).

| Band | # | Class | Sub | Race | BEFORE | AFTER | Δ | AFTER kills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| too weak | 125 | Magic User | Cleric | Elven | 2.03 | 2.30 | +0.27 | 4.65 |
| too weak | 126 | Magic User | Illusionist | Elven | 1.83 | 2.28 | +0.45 | 4.47 |
| too weak | 127 | Thief | Cloaker | Dwarven | 2.70 | 2.25 | -0.45 | 4.47 |
| too weak | 128 | Magic User | Apprentice | Human | 2.20 | 2.25 | +0.05 | 3.78 |
| too weak | 129 | Magic User | Wizard | Elven | 2.35 | 2.17 | -0.18 | 3.50 |
| too weak | 130 | Magic User | Apprentice | Fridgian | 2.03 | 2.17 | +0.14 | 3.38 |
| too weak | 131 | Magic User | Warlock | Dwarven | 2.28 | 2.15 | -0.13 | 3.23 |
| too weak | 132 | Thief | Pickpocket | Dwarven | 2.17 | 2.13 | -0.04 | 3.95 |
| too weak | 133 | Magic User | Wizard | Human | 2.23 | 2.13 | -0.10 | 3.38 |
| too weak | 134 | Magic User | Cleric | Dwarven | 1.70 | 2.13 | +0.43 | 5.13 |
| too weak | 135 | Magic User | Summoner | Dwarven | 1.88 | 2.13 | +0.25 | 4.53 |
| too weak | 136 | Magic User | Illusionist | Dwarven | 1.63 | 2.10 | +0.47 | 3.18 |
| too weak | 137 | Magic User | Illusionist | Fridgian | 1.80 | 2.08 | +0.28 | 3.75 |
| too weak | 138 | Magic User | Illusionist | Human | 2.20 | 2.08 | -0.12 | 4.15 |
| too weak | 139 | Magic User | Wizard | Dwarven | 2.05 | 2.05 | +0.00 | 2.70 |
| too weak | 140 | Magic User | Court Mage | Dwarven | 2.10 | 1.98 | -0.12 | 3.95 |
| too weak | 141 | Magic User | Apprentice | Elven | 2.03 | 1.88 | -0.15 | 2.30 |
| too weak | 142 | Magic User | Apprentice | Dwarven | 1.98 | 1.85 | -0.13 | 2.23 |
| too weak | 143 | Magic User | Court Mage | Elven | 1.90 | 1.83 | -0.07 | 4.20 |
| too strong | 1 | Thief | Acrobat | Wilmsry | 5.03 | 5.10 | +0.07 | 7.65 |
| too strong | 2 | Thief | Ninja | Wilmsry | 5.38 | 5.00 | -0.38 | 16.88 |
| too strong | 3 | Thief | Con Artist | Wilmsry | 5.00 | 4.97 | -0.03 | 1.58 |
| too strong | 4 | Fighter | Barbarian | Wilmsry | 4.90 | 4.90 | +0.00 | 7.38 |
| too strong | 5 | Thief | Ninja | Human | 4.80 | 4.80 | +0.00 | 15.88 |
| too strong | 6 | Thief | Acrobat | Troll | 4.60 | 4.60 | +0.00 | 11.98 |
| too strong | 7 | Fighter | Guard | Wilmsry | 3.88 | 4.60 | +0.72 | 5.90 |
| too strong | 8 | Thief | Ninja | Troll | 4.63 | 4.60 | -0.03 | 13.68 |
| too strong | 9 | Fighter | Woodsman | Wilmsry | 4.43 | 4.45 | +0.02 | 4.72 |
| too strong | 10 | Fighter | Knight | Wilmsry | 4.72 | 4.43 | -0.29 | 4.43 |
| too strong | 11 | Thief | Con Artist | Human | 4.30 | 4.30 | +0.00 | 1.78 |

### Pin and provenance (Phase 26 capture)

Captured 2026-09-15. Full hash `d1e32357474a0f232515a19660ea3ed12c3f8b07`
(short `d1e3235`). `git diff --quiet d1e32357474a0f232515a19660ea3ed12c3f8b07
-- engine content src mazeworld.html tools` exited 0 immediately before both
runs below and again after this ledger's own commit — the engine, content,
`src/`, `mazeworld.html`, and `tools/` are byte-identical to the pin for
this entire capture. `git diff --quiet 5565b22 -- tools/tune-classes.mjs
tools/lib` also exited 0 — the harness (bot policy, cell enumeration,
ranking, JSON shape) is byte-identical to the BEFORE pin, so
`seeds=40/10, workers=4, maxActions=5000, exploreBudget=50, startDepth=1/20`
and the seed list `i*7919+1` are the same runs re-played on the new engine.
The engine/content/shell commits between `5565b22` and this pin are Phases
23 (casters can act), 24 (one good, one bad per sub-class and race), 25
(feature feedback), 25.1 (device feedback batch), and this phase's own
gap-closure fix (`d1e3235` — startCombat now checks for a cleared encounter
before the opening foe turn resolves, closing a hang where a ward-reflect
or acid kill on the last foe left combat open with nothing alive) — 32
commits total touching `engine`, `content`, `src`, or `mazeworld.html`,
diffstat `18 files changed, 2844 insertions(+), 298 deletions(-)` versus
`5565b22`. Both `Bot:` lines below are byte-identical to the BEFORE
section's two `Bot:` lines apart from `seeds=`/`startDepth=` (verified via
a `node -e` equality check against `before.json`/`before-depth20.json`,
which printed `true` for both). Wall times: the natural-start matrix took
1108.5s (~18.5 minutes); the depth-20 slice took 59.4s. The cannot-act hard
gate — `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json`
— printed `cannot-act cells: 0 of 143` (exit 0); the depth-20 slice's stuck
total is 0 of 1430 runs.

This pin's AFTER matrix supersedes an earlier, blocked capture attempt at
pin `620e1df` (this same plan's first run), which found
`cannot-act cells: 1 of 143` — Fighter/Samurai/Dwarven, `stuck=1` — a
regression from `5565b22`'s 0-stuck baseline. That regression was root-
caused to `startCombat`'s foe-first opener having no cleared-encounter
check (a foe killed by a Bubble ward reflection could leave combat open
with nothing alive) and fixed in `d1e3235`; the blocked attempt's evidence
JSON remains in git history for reference, but this section is the only
AFTER matrix wired into the ledger.

The machine-derived comparison tables, the fun-band verdicts, and the Phase
27 handoff are rendered by `node tools/class-pass-diff.mjs --verdicts
docs/class-pass/verdicts.json --out-verdicts docs/class-pass/verdicts.json
--section after` (and `--section outliers`, `--section handoff`) and pasted
verbatim above this sub-heading by Plan 26-03 — numbers are never retyped,
the accept/revisit sentences in `verdicts.json` are the one hand-written
column.

### AFTER transcript — tune-classes --seeds 40 --workers 4 --max-actions 5000

```
tune-classes: 143 cells x 40 seeds (5720 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Acrobat  Wilmsry  40  0  5.10  5.0  8.0  55.0  5.0  7.65  2.80  550.17  undone by a trap(5),cut down by a China Wolf(4),cut down by a Drarl(4)
2  Thief  Ninja  Wilmsry  40  0  5.00  5.0  7.0  67.5  0.0  16.88  3.23  537.05  cut down by a Werebeast(9),undone by a trap(3),cut down by a Drarl(2)
3  Thief  Con Artist  Wilmsry  40  0  4.97  5.0  7.0  65.0  0.0  1.58  2.75  514.50  cut down by a Werebeast(7),undone by a trap(5),cut down by a Google(4)
4  Fighter  Barbarian  Wilmsry  40  0  4.90  5.0  7.0  62.5  2.5  7.38  2.85  522.53  fell off a wall(4),cut down by a Blumble(2),cut down by a Dante(2)
5  Thief  Ninja  Human  40  0  4.80  4.0  8.0  45.0  2.5  15.88  3.33  502.38  undone by a trap(7),cut down by a China Wolf(3),cut down by a Dante(3)
6  Thief  Acrobat  Troll  40  0  4.60  4.0  7.0  45.0  2.5  11.98  3.08  477.13  starved in the dark(15),cut down by a Herman(5),undone by a trap(4)
7  Fighter  Guard  Wilmsry  40  0  4.60  4.0  8.0  45.0  2.5  5.90  2.63  487.28  starved in the dark(6),cut down by a Google(5),cut down by a Werebeast(4)
8  Thief  Ninja  Troll  40  0  4.60  4.0  7.0  45.0  2.5  13.68  3.10  454.30  starved in the dark(12),undone by a trap(5),fell off a wall(4)
9  Fighter  Woodsman  Wilmsry  40  0  4.45  5.0  7.0  50.0  0.0  4.72  2.73  452.83  cut down by a Werebeast(4),undone by a trap(4),cut down by a China Wolf(3)
10  Fighter  Knight  Wilmsry  40  0  4.43  5.0  6.0  55.0  0.0  4.43  2.58  467.60  spent by the dungeon itself(7),cut down by a Werebeast(6),cut down by a China Wolf(5)
11  Thief  Con Artist  Human  40  0  4.30  4.0  7.0  40.0  0.0  1.78  2.53  452.28  undone by a trap(10),came up short on a leap(3),cut down by a Werebeast(3)
12  Thief  Cutthroat  Wilmsry  40  0  4.15  4.0  6.0  42.5  0.0  5.50  2.58  437.08  cut down by a Werebeast(5),cut down by a Dante(4),cut down by a Frank(3)
13  Fighter  Barbarian  Elven  40  0  4.10  4.0  6.0  47.5  0.0  11.73  2.55  429.95  cut down by a Werebeast(10),undone by a trap(6),cut down by a Poltergeist(4)
14  Thief  Pickpocket  Wilmsry  40  0  4.08  4.0  6.0  40.0  0.0  5.03  2.38  437.05  cut down by a Dante(4),cut down by a Rinkle(3),fell off a wall(3)
15  Thief  Cloaker  Wilmsry  40  0  4.08  4.0  7.0  27.5  2.5  4.93  2.35  447.75  undone by a trap(6),cut down by a Dante(4),cut down by a Poltergeist(4)
16  Fighter  Master of Arms  Wilmsry  40  0  4.05  4.0  7.0  35.0  0.0  11.85  2.53  454.40  cut down by a Dante(6),undone by a trap(6),cut down by a Drarl(4)
17  Thief  Cat Burglar  Troll  40  0  3.98  4.0  6.0  27.5  0.0  11.95  2.88  392.60  starved in the dark(11),undone by a trap(6),cut down by a Werebeast(4)
18  Thief  Pilfer  Wilmsry  40  0  3.95  4.0  7.0  37.5  0.0  4.80  2.30  445.05  cut down by a Dante(8),came up short on a leap(3),cut down by a Cave Bear(2)
19  Thief  Ninja  Fridgian  40  0  3.95  4.0  6.0  35.0  0.0  11.38  2.83  383.15  cut down by a Drarl(5),cut down by a Werebeast(4),undone by a trap(4)
20  Thief  Ninja  Dwarven  40  0  3.93  4.0  6.0  35.0  2.5  11.93  2.58  384.40  cut down by a Dante(4),starved in the dark(4),cut down by a Zit(3)
21  Thief  Con Artist  Dwarven  40  0  3.93  4.0  5.0  32.5  0.0  1.73  2.42  405.00  undone by a trap(6),cut down by a Frank(4),cut down by a Blumble(2)
22  Fighter  Bard  Wilmsry  40  0  3.90  4.0  6.0  32.5  0.0  4.60  2.28  403.23  undone by a trap(6),cut down by a Gremlin(5),cut down by a Google(4)
23  Fighter  Soldier  Wilmsry  40  0  3.90  4.0  6.0  30.0  0.0  4.47  2.35  390.83  cut down by a Poltergeist(4),starved in the dark(4),cut down by a Hair(3)
24  Thief  Con Artist  Fridgian  40  0  3.83  4.0  5.0  27.5  0.0  1.73  2.17  395.63  cut down by a Poltergeist(6),undone by a trap(6),cut down by a China Wolf(4)
25  Thief  Con Artist  Troll  40  0  3.78  4.0  6.0  25.0  0.0  1.95  2.13  387.95  starved in the dark(11),undone by a trap(5),cut down by a Poltergeist(4)
26  Thief  Cat Burglar  Wilmsry  40  0  3.75  4.0  7.0  37.5  0.0  6.00  2.30  380.85  undone by a trap(10),cut down by a Dante(4),cut down by a Rinkle(3)
27  Thief  Ninja  Elven  40  0  3.68  4.0  6.0  27.5  2.5  12.45  2.70  356.18  cut down by a Cave Bear(5),cut down by a Dante(5),cut down by a Herman(4)
28  Thief  Acrobat  Dwarven  40  0  3.65  4.0  6.0  22.5  0.0  9.07  2.53  371.38  undone by a trap(5),cut down by a Dante(4),cut down by a Poltergeist(4)
29  Thief  Con Artist  Elven  40  0  3.63  3.0  5.0  32.5  0.0  1.75  2.25  366.45  cut down by a Werebeast(7),undone by a trap(7),fell off a wall(4)
30  Magic User  Summoner  Wilmsry  40  0  3.60  3.0  6.0  25.0  2.5  5.15  2.13  383.25  fell off a wall(6),cut down by a Gremlin(5),cut down by a Google(4)
31  Thief  Cloaker  Troll  40  0  3.58  3.0  6.0  20.0  2.5  8.75  2.35  390.45  starved in the dark(21),undone by a trap(4),came up short on a leap(2)
32  Thief  Pilfer  Troll  40  0  3.53  4.0  5.0  32.5  0.0  7.93  2.23  384.65  starved in the dark(9),spent by the dungeon itself(7),fell off a wall(4)
33  Magic User  Cleric  Wilmsry  40  0  3.53  3.0  6.0  25.0  0.0  4.90  2.17  379.48  cut down by a Dante(5),starved in the dark(5),undone by a trap(3)
34  Thief  Cutthroat  Troll  40  0  3.48  4.0  5.0  22.5  0.0  8.38  2.30  364.28  starved in the dark(12),fell off a wall(5),cut down by a Werebeast(3)
35  Fighter  Samurai  Wilmsry  40  0  3.48  3.0  5.0  32.5  0.0  5.60  2.25  346.60  cut down by a Dante(6),cut down by a Werebeast(5),cut down by a Philly(3)
36  Thief  Acrobat  Human  40  0  3.43  4.0  5.0  22.5  0.0  9.23  2.35  364.23  cut down by a Dante(8),fell off a wall(6),cut down by a Poltergeist(4)
37  Magic User  Sorcerer  Wilmsry  40  0  3.43  3.0  5.0  27.5  0.0  4.53  2.08  341.65  undone by a trap(7),fell off a wall(5),cut down by a Dante(3)
38  Fighter  Barbarian  Fridgian  40  0  3.38  3.0  7.0  20.0  0.0  9.35  2.15  343.08  cut down by a Dante(8),cut down by a Drarl(3),cut down by a China Wolf(2)
39  Thief  Cat Burglar  Human  40  0  3.35  3.0  6.0  22.5  2.5  8.13  2.28  329.40  undone by a trap(9),cut down by a Dante(5),starved in the dark(4)
40  Thief  Pickpocket  Troll  40  0  3.33  3.0  7.0  17.5  0.0  6.58  2.08  338.25  starved in the dark(13),undone by a trap(5),fell off a wall(4)
41  Thief  Acrobat  Elven  40  0  3.30  3.0  6.0  22.5  0.0  8.60  2.48  331.73  cut down by a Dante(4),cut down by a Poltergeist(4),undone by a trap(4)
42  Fighter  Barbarian  Troll  40  0  3.30  3.0  5.0  20.0  0.0  8.15  1.95  318.15  starved in the dark(11),cut down by a Dante(4),cut down by a China Wolf(3)
43  Fighter  Knight  Elven  40  0  3.30  3.0  5.0  20.0  0.0  5.68  2.15  322.70  cut down by a Poltergeist(5),cut down by a Gremlin(4),cut down by a Cave Bear(3)
44  Fighter  Knight  Fridgian  40  0  3.30  3.0  5.0  15.0  0.0  4.88  2.08  321.52  cut down by a Dante(5),undone by a trap(5),cut down by a Cave Bear(3)
45  Thief  Pilfer  Fridgian  40  0  3.30  3.0  6.0  15.0  0.0  7.35  2.25  353.30  cut down by a Dante(5),cut down by a Poltergeist(4),spent by the dungeon itself(4)
46  Fighter  Master of Arms  Human  40  0  3.28  3.0  5.0  15.0  0.0  8.15  2.28  349.93  cut down by a Dante(4),cut down by a Poltergeist(4),cut down by a Primp(3)
47  Fighter  Barbarian  Human  40  0  3.28  3.0  4.0  7.5  0.0  9.13  1.98  355.70  cut down by a Dante(5),cut down by a China Wolf(3),cut down by a Poltergeist(3)
48  Thief  Cat Burglar  Dwarven  40  0  3.25  3.0  7.0  27.5  0.0  8.13  2.25  319.50  cut down by a Dante(8),undone by a trap(8),cut down by a Drarl(3)
49  Thief  Acrobat  Fridgian  40  0  3.25  3.0  5.0  22.5  0.0  8.50  2.23  321.63  undone by a trap(5),cut down by a China Wolf(4),cut down by a Gremlin(4)
50  Fighter  Guard  Elven  40  0  3.23  3.0  5.0  10.0  2.5  7.38  2.10  324.85  cut down by a Poltergeist(7),undone by a trap(5),cut down by a Gremlin(4)
51  Thief  Pilfer  Dwarven  40  0  3.18  3.0  6.0  25.0  0.0  6.03  2.08  322.93  cut down by a Dante(10),cut down by a Drarl(3),starved in the dark(3)
52  Fighter  Master of Arms  Elven  40  0  3.18  3.0  5.0  12.5  0.0  9.13  2.35  317.43  cut down by a Werebeast(6),cut down by a Blumble(4),cut down by a Poltergeist(4)
53  Fighter  Bard  Troll  40  0  3.18  3.0  5.0  10.0  0.0  5.70  2.08  313.43  starved in the dark(10),cut down by a Cave Bear(4),cut down by a Dante(4)
54  Thief  Cat Burglar  Fridgian  40  0  3.15  3.0  6.0  17.5  2.5  7.50  2.10  296.30  undone by a trap(8),cut down by a Dante(6),cut down by a Frank(3)
55  Magic User  Sorcerer  Troll  40  0  3.15  3.0  5.0  12.5  0.0  8.20  2.03  324.65  starved in the dark(9),undone by a trap(5),fell off a wall(4)
56  Fighter  Master of Arms  Fridgian  40  0  3.15  3.0  5.0  10.0  0.0  8.28  2.17  322.43  cut down by a Dante(8),cut down by a Poltergeist(6),cut down by a China Wolf(3)
57  Magic User  Illusionist  Wilmsry  40  0  3.10  3.0  5.0  20.0  0.0  3.65  2.00  340.08  cut down by a Dante(5),cut down by a Zombie(5),came up short on a leap(4)
58  Thief  Pilfer  Human  40  0  3.10  3.0  6.0  20.0  0.0  5.65  2.03  346.08  cut down by a Dante(8),cut down by a Philly(4),cut down by a Poltergeist(4)
59  Magic User  Court Mage  Wilmsry  40  0  3.05  3.0  5.0  17.5  0.0  4.75  1.93  321.48  cut down by a Poltergeist(6),cut down by a Dante(4),fell off a wall(4)
60  Fighter  Knight  Troll  40  0  3.05  3.0  5.0  17.5  0.0  4.68  1.88  285.35  starved in the dark(10),cut down by a Dante(5),cut down by a Poltergeist(4)
61  Fighter  Bard  Elven  40  0  3.05  3.0  5.0  12.5  0.0  6.13  2.30  299.98  cut down by a Poltergeist(6),cut down by a Dante(3),cut down by a Zit(3)
62  Thief  Pilfer  Elven  40  0  3.03  3.0  5.0  15.0  2.5  7.40  2.10  309.68  cut down by a Dante(7),cut down by a Skeleton(3),spent by the dungeon itself(3)
63  Fighter  Woodsman  Elven  40  0  3.03  3.0  5.0  15.0  0.0  4.85  2.15  292.95  cut down by a Dante(4),cut down by a Gremlin(4),cut down by a Poltergeist(4)
64  Thief  Cutthroat  Fridgian  40  0  3.03  3.0  5.0  12.5  0.0  6.63  1.95  300.73  cut down by a Dante(6),spent by the dungeon itself(4),undone by a trap(4)
65  Magic User  Wizard  Troll  40  0  3.03  3.0  5.0  12.5  0.0  6.35  1.98  311.08  starved in the dark(9),cut down by a Dante(5),fell off a wall(5)
66  Fighter  Guard  Troll  40  0  3.03  3.0  4.0  7.5  0.0  6.78  2.08  297.58  starved in the dark(14),cut down by a Dante(7),undone by a trap(4)
67  Fighter  Barbarian  Dwarven  40  0  3.00  3.0  5.0  20.0  0.0  8.60  1.88  300.90  cut down by a Dante(10),cut down by a Gremlin(3),fell off a wall(3)
68  Magic User  Apprentice  Wilmsry  40  0  3.00  3.0  5.0  15.0  0.0  2.65  2.05  281.88  cut down by a Poltergeist(7),undone by a trap(5),fell off a wall(4)
69  Fighter  Woodsman  Fridgian  40  0  3.00  3.0  5.0  10.0  0.0  4.35  1.93  284.68  cut down by a China Wolf(4),cut down by a Google(4),cut down by a Poltergeist(4)
70  Magic User  Cleric  Troll  40  0  2.98  3.0  5.0  12.5  0.0  5.95  1.93  305.20  fell off a wall(6),starved in the dark(6),cut down by a Dante(4)
71  Magic User  Apprentice  Troll  40  0  2.98  3.0  5.0  10.0  0.0  5.55  2.17  301.70  starved in the dark(12),undone by a trap(3),cut down by a Dante(2)
72  Thief  Cat Burglar  Elven  40  0  2.95  3.0  5.0  20.0  0.0  7.20  2.08  281.13  undone by a trap(12),cut down by a Dante(5),cut down by a Dread Lock(2)
73  Fighter  Soldier  Troll  40  0  2.95  3.0  5.0  12.5  0.0  6.60  2.03  281.88  starved in the dark(10),cut down by a Dante(5),cut down by a Poltergeist(4)
74  Fighter  Woodsman  Troll  40  0  2.95  3.0  5.0  10.0  0.0  4.53  1.78  286.43  undone by a trap(7),starved in the dark(6),cut down by a Gremlin(4)
75  Fighter  Knight  Human  40  0  2.95  3.0  4.0  5.0  0.0  4.68  1.88  298.40  cut down by a Dante(7),cut down by a Poltergeist(5),cut down by a Gremlin(4)
76  Thief  Cutthroat  Elven  40  0  2.93  3.0  5.0  15.0  0.0  7.93  2.20  285.25  cut down by a Dante(6),spent by the dungeon itself(5),undone by a trap(5)
77  Fighter  Bard  Human  40  0  2.93  3.0  5.0  12.5  0.0  6.40  2.03  290.83  cut down by a Dante(8),cut down by a Google(5),cut down by a Poltergeist(4)
78  Fighter  Master of Arms  Troll  40  0  2.93  3.0  4.0  7.5  0.0  7.28  2.00  293.10  starved in the dark(10),cut down by a Blumble(3),cut down by a Poltergeist(3)
79  Fighter  Guard  Human  40  0  2.90  3.0  5.0  10.0  0.0  6.50  2.00  312.65  cut down by a Poltergeist(7),undone by a trap(6),cut down by a Dante(3)
80  Thief  Pickpocket  Elven  40  0  2.88  3.0  5.0  20.0  0.0  5.53  1.90  276.60  cut down by a Dante(5),undone by a trap(5),fell off a wall(4)
81  Magic User  Warlock  Troll  40  0  2.88  3.0  5.0  15.0  0.0  6.40  1.95  295.68  starved in the dark(11),came up short on a leap(4),cut down by a Poltergeist(4)
82  Magic User  Summoner  Troll  40  0  2.88  3.0  5.0  10.0  0.0  8.63  2.10  316.38  starved in the dark(6),eaten by their own summoning(5),undone by a trap(4)
83  Magic User  Sorcerer  Elven  40  0  2.88  2.0  5.0  17.5  0.0  7.20  1.95  285.90  cut down by a Dante(5),undone by a trap(5),cut down by a Gremlin(4)
84  Magic User  Illusionist  Troll  40  0  2.85  3.0  5.0  10.0  0.0  5.78  1.83  302.75  starved in the dark(11),undone by a trap(5),cut down by a Dante(4)
85  Magic User  Warlock  Wilmsry  40  0  2.85  2.0  5.0  17.5  0.0  3.93  1.85  296.65  cut down by a Dante(7),cut down by a Gremlin(3),fell off a wall(3)
86  Fighter  Soldier  Elven  40  0  2.83  3.0  5.0  15.0  0.0  6.13  2.00  269.33  cut down by a Dante(7),cut down by a Poltergeist(7),cut down by a Google(3)
87  Fighter  Soldier  Fridgian  40  0  2.83  3.0  5.0  15.0  0.0  6.28  1.93  282.15  cut down by a Dante(9),cut down by a Gremlin(4),cut down by a Blumble(3)
88  Magic User  Wizard  Wilmsry  40  0  2.83  3.0  5.0  10.0  0.0  3.08  1.80  269.13  cut down by a Dante(5),fell off a wall(5),cut down by a Gremlin(4)
89  Thief  Cloaker  Fridgian  40  0  2.80  3.0  5.0  10.0  0.0  5.73  1.88  297.38  cut down by a Dante(6),cut down by a Google(3),cut down by a Gremlin(3)
90  Fighter  Knight  Dwarven  40  0  2.80  3.0  4.0  7.5  0.0  3.53  1.73  271.73  cut down by a Dante(11),cut down by a Poltergeist(5),cut down by a China Wolf(3)
91  Fighter  Soldier  Human  40  0  2.78  3.0  4.0  7.5  0.0  5.43  1.90  282.85  cut down by a Dante(9),cut down by a China Wolf(5),cut down by a Poltergeist(4)
92  Magic User  Sorcerer  Human  40  0  2.78  3.0  4.0  7.5  0.0  7.40  1.93  267.68  cut down by a Dante(7),cut down by a Gremlin(6),cut down by a Blumble(4)
93  Fighter  Woodsman  Human  40  0  2.75  3.0  5.0  10.0  0.0  4.88  2.00  282.13  cut down by a Dante(7),undone by a trap(7),cut down by a Trachea(3)
94  Fighter  Samurai  Elven  40  0  2.73  3.0  4.0  7.5  0.0  7.80  2.13  260.40  cut down by a Dante(5),cut down by a Poltergeist(5),undone by a trap(5)
95  Fighter  Master of Arms  Dwarven  40  0  2.73  3.0  4.0  5.0  0.0  6.93  1.88  270.23  cut down by a Gremlin(8),cut down by a Dante(4),undone by a trap(4)
96  Magic User  Summoner  Fridgian  40  0  2.70  3.0  4.0  5.0  0.0  7.40  1.98  281.55  cut down by a Dante(6),cut down by a Werebeast(5),fell off a wall(4)
97  Thief  Pickpocket  Fridgian  40  0  2.70  2.0  5.0  15.0  0.0  5.25  1.88  275.52  cut down by a Dante(6),starved in the dark(4),undone by a trap(4)
98  Fighter  Guard  Fridgian  40  0  2.68  3.0  4.0  7.5  0.0  5.20  1.83  276.02  cut down by a Dante(5),cut down by a Poltergeist(4),undone by a trap(4)
99  Thief  Cutthroat  Human  40  0  2.68  3.0  4.0  5.0  0.0  4.90  1.78  290.50  cut down by a Dante(9),cut down by a Gremlin(3),starved in the dark(3)
100  Thief  Cloaker  Elven  40  0  2.65  3.0  5.0  12.5  0.0  6.88  2.00  267.73  cut down by a Dante(7),spent by the dungeon itself(5),undone by a trap(5)
101  Fighter  Bard  Fridgian  40  0  2.65  3.0  4.0  5.0  0.0  4.63  1.70  252.15  cut down by a Dante(7),cut down by a Gremlin(4),starved in the dark(4)
102  Fighter  Samurai  Troll  40  0  2.65  3.0  4.0  0.0  0.0  7.40  1.98  251.58  starved in the dark(7),cut down by a Dante(4),cut down by a Poltergeist(4)
103  Magic User  Court Mage  Troll  40  0  2.63  3.0  4.0  5.0  0.0  5.53  1.80  271.90  starved in the dark(9),cut down by a Dante(5),came up short on a leap(4)
104  Magic User  Warlock  Fridgian  40  0  2.63  2.0  4.0  7.5  0.0  5.75  1.85  245.23  cut down by a Dante(5),cut down by a Gremlin(5),fell off a wall(4)
105  Magic User  Court Mage  Fridgian  40  0  2.63  2.0  4.0  5.0  0.0  7.18  1.83  260.73  cut down by a Dante(6),cut down by a Poltergeist(6),undone by a trap(5)
106  Magic User  Sorcerer  Fridgian  40  0  2.60  3.0  4.0  5.0  0.0  6.08  1.83  230.08  cut down by a Dante(7),cut down by a Gremlin(4),undone by a trap(4)
107  Fighter  Woodsman  Dwarven  40  0  2.60  2.0  5.0  10.0  0.0  3.30  1.75  248.20  cut down by a Dante(10),fell off a wall(5),cut down by a Gremlin(4)
108  Thief  Cloaker  Human  40  0  2.58  3.0  4.0  7.5  0.0  5.00  1.78  288.18  cut down by a Dante(6),came up short on a leap(4),cut down by a Gremlin(4)
109  Magic User  Wizard  Fridgian  40  0  2.58  3.0  4.0  5.0  0.0  4.90  1.70  262.85  cut down by a Dante(5),cut down by a Poltergeist(5),undone by a trap(4)
110  Fighter  Soldier  Dwarven  40  0  2.58  2.0  5.0  12.5  0.0  5.15  1.75  248.93  cut down by a Dante(11),cut down by a Gremlin(7),cut down by a China Wolf(2)
111  Magic User  Court Mage  Human  40  0  2.58  2.0  4.0  7.5  0.0  6.08  1.73  254.80  cut down by a Dante(7),cut down by a Gremlin(4),cut down by a Blumble(3)
112  Thief  Pickpocket  Human  40  0  2.55  2.0  5.0  10.0  0.0  4.75  1.70  263.93  cut down by a Dante(5),cut down by a Poltergeist(5),starved in the dark(4)
113  Fighter  Samurai  Dwarven  40  0  2.53  2.0  4.0  5.0  0.0  6.88  1.80  224.13  cut down by a Dante(9),cut down by a Philly(6),cut down by a Shadow(3)
114  Magic User  Summoner  Human  40  0  2.50  2.0  4.0  7.5  0.0  7.53  1.80  263.40  cut down by a Dante(9),cut down by a Drekk(4),cut down by a Poltergeist(4)
115  Magic User  Cleric  Human  40  0  2.48  3.0  4.0  0.0  0.0  5.93  1.70  263.75  cut down by a Dante(7),fell off a wall(4),undone by a trap(4)
116  Fighter  Bard  Dwarven  40  0  2.48  2.0  4.0  7.5  0.0  5.20  1.73  236.78  cut down by a Dante(7),cut down by a Gremlin(7),starved in the dark(4)
117  Magic User  Summoner  Elven  40  0  2.45  2.0  5.0  10.0  0.0  5.75  1.78  242.60  cut down by a Dante(5),cut down by a Gremlin(5),eaten by their own summoning(5)
118  Magic User  Warlock  Human  40  0  2.45  2.0  4.0  5.0  0.0  4.78  1.73  229.68  cut down by a Dante(10),cut down by a Gremlin(4),cut down by a Philly(3)
119  Thief  Cutthroat  Dwarven  40  0  2.42  2.0  5.0  10.0  0.0  4.22  1.65  235.35  cut down by a Dante(10),cut down by a Gremlin(4),spent by the dungeon itself(4)
120  Magic User  Sorcerer  Dwarven  40  0  2.42  2.0  4.0  5.0  0.0  6.00  1.78  220.35  cut down by a Dante(10),cut down by a Poltergeist(5),fell off a wall(5)
121  Magic User  Warlock  Elven  40  0  2.40  2.0  4.0  5.0  0.0  4.58  1.73  212.98  cut down by a Gremlin(5),came up short on a leap(4),cut down by a Dante(4)
122  Fighter  Samurai  Human  40  0  2.40  2.0  4.0  0.0  0.0  6.55  1.78  225.60  cut down by a Dante(11),cut down by a Google(4),cut down by a Poltergeist(4)
123  Magic User  Cleric  Fridgian  40  0  2.33  2.0  4.0  7.5  0.0  5.30  1.55  224.43  cut down by a Dante(10),cut down by a Poltergeist(4),cut down by a Philly(3)
124  Fighter  Guard  Dwarven  40  0  2.33  2.0  4.0  7.5  0.0  4.50  1.58  219.80  cut down by a Dante(8),cut down by a Gremlin(5),undone by a trap(5)
125  Magic User  Cleric  Elven  40  0  2.30  2.0  4.0  7.5  0.0  4.65  1.68  213.63  cut down by a Gremlin(5),undone by a trap(5),cut down by a Dante(4)
126  Magic User  Illusionist  Elven  40  0  2.28  2.0  5.0  10.0  0.0  4.47  1.68  214.18  cut down by a Dante(10),cut down by a Gremlin(4),cut down by a Drekk(3)
127  Thief  Cloaker  Dwarven  40  0  2.25  2.0  4.0  5.0  0.0  4.47  1.63  230.13  cut down by a Dante(10),cut down by a Gremlin(4),cut down by a Philly(4)
128  Magic User  Apprentice  Human  40  0  2.25  2.0  4.0  2.5  0.0  3.78  1.75  220.95  cut down by a Gremlin(7),fell off a wall(7),cut down by a Dante(6)
129  Magic User  Wizard  Elven  40  0  2.17  2.0  4.0  7.5  0.0  3.50  1.43  200.30  cut down by a Gremlin(8),cut down by a Dante(7),fell off a wall(5)
130  Magic User  Apprentice  Fridgian  40  0  2.17  2.0  4.0  5.0  0.0  3.38  1.75  194.53  cut down by a Dante(9),undone by a trap(5),cut down by a Drekk(4)
131  Magic User  Warlock  Dwarven  40  0  2.15  2.0  4.0  5.0  0.0  3.23  1.43  199.20  cut down by a Dante(14),cut down by a Gremlin(5),undone by a trap(5)
132  Thief  Pickpocket  Dwarven  40  0  2.13  2.0  4.0  5.0  0.0  3.95  1.53  216.50  cut down by a Dante(10),cut down by a Cave Bear(4),cut down by a Gremlin(4)
133  Magic User  Wizard  Human  40  0  2.13  2.0  4.0  5.0  0.0  3.38  1.53  199.50  cut down by a Dante(9),fell off a wall(6),cut down by a Gremlin(4)
134  Magic User  Cleric  Dwarven  40  0  2.13  2.0  4.0  2.5  0.0  5.13  1.65  207.58  cut down by a Dante(10),undone by a trap(4),cut down by a Poltergeist(3)
135  Magic User  Summoner  Dwarven  40  0  2.13  2.0  4.0  0.0  0.0  4.53  1.43  194.00  cut down by a Dante(10),cut down by a Gremlin(5),undone by a trap(3)
136  Magic User  Illusionist  Dwarven  40  0  2.10  2.0  4.0  7.5  0.0  3.18  1.40  196.58  cut down by a Dante(11),cut down by a Drekk(5),cut down by a Gremlin(5)
137  Magic User  Illusionist  Fridgian  40  0  2.08  2.0  4.0  2.5  0.0  3.75  1.38  200.13  cut down by a Dante(9),cut down by a Gremlin(7),undone by a trap(4)
138  Magic User  Illusionist  Human  40  0  2.08  2.0  3.0  2.5  0.0  4.15  1.45  210.93  cut down by a Dante(11),cut down by a Gremlin(6),cut down by a Shadow(3)
139  Magic User  Wizard  Dwarven  40  0  2.05  2.0  4.0  2.5  0.0  2.70  1.45  187.93  cut down by a Dante(7),cut down by a Gremlin(6),cut down by a Werebeast(3)
140  Magic User  Court Mage  Dwarven  40  0  1.98  2.0  4.0  5.0  0.0  3.95  1.43  185.28  cut down by a Dante(12),cut down by a Drekk(4),cut down by a Gremlin(3)
141  Magic User  Apprentice  Elven  40  0  1.88  2.0  4.0  0.0  0.0  2.30  1.58  152.40  cut down by a Dante(9),undone by a trap(7),cut down by a Philly(3)
142  Magic User  Apprentice  Dwarven  40  0  1.85  2.0  3.0  0.0  0.0  2.23  1.48  149.20  cut down by a Dante(10),cut down by a Philly(5),cut down by a Gremlin(4)
143  Magic User  Court Mage  Elven  40  0  1.83  2.0  3.0  0.0  0.0  4.20  1.45  160.35  cut down by a Poltergeist(5),spent by the dungeon itself(5),cut down by a Dante(4)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  1920  0  3.51  3.0  6.0  26.3  0.6  7.09  2.30  361.66  cut down by a Dante(209),undone by a trap(201),starved in the dark(187)
Fighter  1880  0  3.16  3.0  5.0  16.9  0.2  6.33  2.07  316.41  cut down by a Dante(253),cut down by a Poltergeist(157),starved in the dark(140)
Magic User  1920  0  2.55  2.0  4.0  8.5  0.1  4.99  1.76  251.57  cut down by a Dante(313),cut down by a Gremlin(161),undone by a trap(153)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  240  0  4.33  4.0  7.0  42.5  1.7  13.70  2.96  436.24  undone by a trap(25),starved in the dark(24),cut down by a Werebeast(20)
Con Artist  240  0  4.07  4.0  6.0  37.1  0.0  1.75  2.38  420.30  undone by a trap(39),cut down by a Werebeast(24),starved in the dark(20)
Acrobat  240  0  3.89  4.0  6.0  31.7  1.3  9.17  2.58  402.71  undone by a trap(26),starved in the dark(21),cut down by a Dante(18)
Barbarian  240  0  3.66  3.0  6.0  29.6  0.4  9.05  2.23  378.38  cut down by a Dante(30),starved in the dark(19),fell off a wall(16)
Cat Burglar  240  0  3.40  3.0  6.0  25.4  0.8  8.15  2.31  333.30  undone by a trap(53),cut down by a Dante(29),starved in the dark(20)
Pilfer  240  0  3.35  3.0  6.0  24.2  0.4  6.53  2.16  360.28  cut down by a Dante(40),starved in the dark(22),spent by the dungeon itself(16)
Knight  240  0  3.30  3.0  5.0  20.0  0.0  4.64  2.05  327.88  cut down by a Dante(34),cut down by a Poltergeist(23),starved in the dark(21)
Master of Arms  240  0  3.22  3.0  5.0  14.2  0.0  8.60  2.20  334.58  cut down by a Dante(26),cut down by a Poltergeist(21),undone by a trap(20)
Woodsman  240  0  3.13  3.0  5.0  17.5  0.0  4.44  2.05  307.87  cut down by a Dante(28),undone by a trap(24),cut down by a Poltergeist(18)
Guard  240  0  3.13  3.0  5.0  14.6  0.8  6.04  2.03  319.70  starved in the dark(27),undone by a trap(26),cut down by a Dante(25)
Cutthroat  240  0  3.11  3.0  5.0  17.9  0.0  6.26  2.08  318.86  cut down by a Dante(37),starved in the dark(21),spent by the dungeon itself(17)
Bard  240  0  3.03  3.0  5.0  13.3  0.0  5.44  2.02  299.40  cut down by a Dante(32),starved in the dark(23),cut down by a Poltergeist(20)
Cloaker  240  0  2.99  3.0  5.0  13.8  0.8  5.96  2.00  320.27  cut down by a Dante(34),starved in the dark(33),undone by a trap(23)
Soldier  240  0  2.98  3.0  5.0  15.4  0.0  5.68  1.99  292.66  cut down by a Dante(43),cut down by a Poltergeist(24),cut down by a Gremlin(18)
Pickpocket  240  0  2.94  3.0  5.0  17.9  0.0  5.18  1.91  301.31  cut down by a Dante(31),starved in the dark(26),undone by a trap(20)
Sorcerer  240  0  2.88  3.0  5.0  12.5  0.0  6.57  1.93  278.38  cut down by a Dante(35),undone by a trap(26),cut down by a Gremlin(19)
Samurai  200  0  2.76  3.0  4.0  9.0  0.0  6.85  1.99  261.66  cut down by a Dante(35),cut down by a Poltergeist(16),cut down by a Google(13)
Summoner  240  0  2.71  3.0  4.0  9.6  0.4  6.50  1.87  280.20  cut down by a Dante(32),cut down by a Gremlin(20),undone by a trap(19)
Cleric  240  0  2.62  2.0  4.0  9.2  0.0  5.31  1.78  265.68  cut down by a Dante(40),undone by a trap(22),fell off a wall(17)
Warlock  240  0  2.56  2.0  4.0  9.2  0.0  4.78  1.75  246.57  cut down by a Dante(41),cut down by a Gremlin(23),undone by a trap(20)
Wizard  240  0  2.46  2.0  4.0  7.1  0.0  3.98  1.65  238.46  cut down by a Dante(38),cut down by a Gremlin(26),fell off a wall(26)
Court Mage  240  0  2.45  2.0  4.0  6.7  0.0  5.28  1.69  242.42  cut down by a Dante(38),cut down by a Poltergeist(23),starved in the dark(15)
Illusionist  240  0  2.41  2.0  4.0  8.8  0.0  4.16  1.62  244.10  cut down by a Dante(50),cut down by a Gremlin(25),starved in the dark(17)
Apprentice  240  0  2.35  2.0  4.0  5.4  0.0  3.31  1.80  216.78  cut down by a Dante(39),undone by a trap(21),cut down by a Gremlin(20)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  960  0  3.92  4.0  6.0  36.4  0.6  5.58  2.37  412.01  cut down by a Dante(85),undone by a trap(85),cut down by a Werebeast(69)
Troll  960  0  3.26  3.0  5.0  17.0  0.3  7.28  2.15  331.10  starved in the dark(255),undone by a trap(78),fell off a wall(67)
Fridgian  920  0  2.90  3.0  5.0  12.2  0.1  6.12  1.95  287.18  cut down by a Dante(137),undone by a trap(83),cut down by a Poltergeist(66)
Human  960  0  2.89  3.0  5.0  11.6  0.2  6.25  1.97  297.74  cut down by a Dante(164),cut down by a Poltergeist(73),undone by a trap(72)
Elven  960  0  2.86  3.0  5.0  15.1  0.3  6.38  2.03  278.11  cut down by a Dante(114),undone by a trap(101),cut down by a Poltergeist(72)
Dwarven  960  0  2.61  2.0  5.0  11.0  0.1  5.19  1.78  251.91  cut down by a Dante(211),cut down by a Gremlin(90),undone by a trap(66)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 5720 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1
elapsed: 1108.5s  workers=4  runs=5720
EXIT=0
```

### AFTER transcript — tune-classes --seeds 10 --workers 4 --max-actions 5000 --start-depth 20

```
tune-classes: 143 cells x 10 seeds (1430 runs) — start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1  Thief  Cat Burglar  Wilmsry  10  0  21.00  21.0  23.0  100.0  100.0  3.20  5.00  138.20  1.00  1.0  4.90  cut down by a Vampire(2),cut down by a Djinni(1),cut down by a Drake(1)
2  Fighter  Guard  Wilmsry  10  0  20.90  20.0  23.0  100.0  100.0  1.00  5.00  137.10  0.90  0.0  2.90  cut down by a Djinni(4),cut down by a Herman(2),cut down by a Vampire(2)
3  Thief  Con Artist  Troll  10  0  20.80  21.0  22.0  100.0  100.0  1.20  5.00  142.50  0.80  1.0  4.60  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
4  Thief  Acrobat  Wilmsry  10  0  20.80  20.0  23.0  100.0  100.0  1.80  5.00  113.30  0.80  0.0  3.10  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Djinni(1)
5  Thief  Con Artist  Wilmsry  10  0  20.80  20.0  23.0  100.0  100.0  2.60  5.00  192.00  0.80  0.0  5.90  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Vampire(2)
6  Fighter  Woodsman  Wilmsry  10  0  20.60  20.0  23.0  100.0  100.0  1.30  5.00  129.70  0.60  0.0  4.10  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Craig(1)
7  Thief  Ninja  Troll  10  0  20.50  20.0  23.0  100.0  100.0  3.50  5.00  76.50  0.50  0.0  2.80  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Stalka Beast(2)
8  Magic User  Wizard  Wilmsry  10  0  20.50  20.0  23.0  100.0  100.0  0.70  5.00  88.90  0.50  0.0  1.80  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Bones(1)
9  Fighter  Bard  Wilmsry  10  0  20.40  20.0  23.0  100.0  100.0  0.50  5.00  98.60  0.40  0.0  2.50  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
10  Thief  Cloaker  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  2.10  5.00  87.60  0.40  0.0  2.70  cut down by a Drarl(3),cut down by a Craig(1),cut down by a Djinni(1)
11  Thief  Cutthroat  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  1.60  5.00  76.00  0.40  0.0  1.50  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
12  Thief  Cutthroat  Human  10  0  20.40  20.0  22.0  100.0  100.0  1.60  5.00  76.00  0.40  0.0  1.50  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
13  Thief  Acrobat  Human  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  39.50  0.30  0.0  0.80  cut down by a Drarl(6),cut down by a Djinni(1),cut down by a Dread Lock(1)
14  Fighter  Barbarian  Wilmsry  10  0  20.30  20.0  23.0  100.0  100.0  1.40  5.00  100.30  0.30  0.0  2.70  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Stalka Beast(2)
15  Thief  Cat Burglar  Elven  10  0  20.30  20.0  21.0  100.0  100.0  1.20  5.00  42.00  0.30  0.0  1.10  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Herman(2)
16  Thief  Cloaker  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.90  5.00  77.20  0.30  0.0  1.90  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Craig(1)
17  Thief  Con Artist  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  104.80  0.30  0.0  3.30  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
18  Thief  Con Artist  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  104.10  0.30  0.0  3.00  cut down by a Herman(2),cut down by a Vampire(2),cut down by a Craig(1)
19  Fighter  Guard  Troll  10  0  20.30  20.0  22.0  100.0  100.0  0.50  5.00  67.50  0.30  0.0  1.90  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Craig(1)
20  Thief  Ninja  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.70  5.00  57.60  0.30  0.0  1.30  cut down by a Drarl(4),cut down by a Dread Lock(2),cut down by a Herman(2)
21  Thief  Ninja  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  47.90  0.30  0.0  1.10  cut down by a Drarl(4),cut down by a Herman(3),cut down by a Djinni(2)
22  Thief  Pickpocket  Wilmsry  10  0  20.30  20.0  22.0  100.0  100.0  0.80  5.00  67.30  0.30  0.0  1.70  cut down by a Herman(3),cut down by a Stalka Beast(3),cut down by a Drarl(2)
23  Thief  Pilfer  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.50  5.00  63.10  0.30  0.0  1.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(1)
24  Thief  Pilfer  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.50  5.00  63.10  0.30  0.0  1.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(1)
25  Thief  Pilfer  Wilmsry  10  0  20.30  20.0  22.0  100.0  100.0  1.70  5.00  97.60  0.30  0.0  3.10  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Drudge(2)
26  Magic User  Sorcerer  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  2.50  5.00  70.40  0.30  0.0  1.50  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Vampire(2)
27  Magic User  Sorcerer  Elven  10  0  20.30  20.0  23.0  100.0  100.0  2.20  5.00  47.30  0.30  0.0  1.20  cut down by a Dread Lock(3),cut down by a Drudge(2),cut down by a Djinni(1)
28  Magic User  Sorcerer  Human  10  0  20.30  20.0  22.0  100.0  100.0  2.50  5.00  70.40  0.30  0.0  1.50  cut down by a Vampire(3),cut down by a Dread Lock(2),cut down by a Herman(2)
29  Magic User  Wizard  Elven  10  0  20.30  20.0  22.0  100.0  100.0  0.60  5.00  66.40  0.30  0.0  0.50  cut down by a Dread Lock(2),cut down by a Stalka Beast(2),cut down by a Djinni(1)
30  Thief  Acrobat  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  0.70  5.00  32.90  0.20  0.0  0.60  cut down by a Drarl(5),cut down by a Djinni(1),cut down by a Dread Lock(1)
31  Thief  Acrobat  Elven  10  0  20.20  20.0  21.0  100.0  100.0  0.80  5.00  34.20  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Herman(1)
32  Thief  Acrobat  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  0.50  5.00  26.50  0.20  0.0  0.80  cut down by a Drarl(4),cut down by a Herman(3),cut down by a Djinni(1)
33  Magic User  Apprentice  Troll  10  0  20.20  20.0  21.0  100.0  100.0  2.30  5.00  79.40  0.20  0.0  1.70  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Dread Lock(1)
34  Thief  Cat Burglar  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  41.10  0.20  0.0  0.80  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Herman(2)
35  Thief  Cat Burglar  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  0.00  5.00  31.00  0.20  0.0  0.80  cut down by a Drarl(6),cut down by a Herman(2),cut down by a Djinni(1)
36  Thief  Cat Burglar  Human  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  43.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Dread Lock(1)
37  Thief  Con Artist  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.00  5.00  66.50  0.20  0.0  2.40  cut down by a Drudge(3),cut down by a Djinni(2),cut down by a Craig(1)
38  Thief  Cutthroat  Elven  10  0  20.20  20.0  22.0  100.0  100.0  1.70  5.00  49.60  0.20  0.0  1.30  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(2)
39  Thief  Cutthroat  Wilmsry  10  0  20.20  20.0  21.0  100.0  100.0  1.10  5.00  82.90  0.20  0.0  2.80  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
40  Fighter  Knight  Wilmsry  10  0  20.20  20.0  21.0  100.0  100.0  0.80  5.00  47.70  0.20  0.0  1.20  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Drudge(1)
41  Thief  Ninja  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.20  5.00  33.40  0.20  0.0  1.00  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Djinni(1)
42  Thief  Ninja  Human  10  0  20.20  20.0  21.0  100.0  100.0  1.20  5.00  47.40  0.20  0.0  0.90  cut down by a Drarl(4),cut down by a Dread Lock(2),cut down by a Drudge(1)
43  Thief  Pickpocket  Troll  10  0  20.20  20.0  22.0  100.0  100.0  2.10  5.00  51.50  0.20  0.0  1.40  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Craig(1)
44  Fighter  Soldier  Wilmsry  10  0  20.20  20.0  21.0  100.0  100.0  0.80  5.00  47.70  0.20  0.0  1.20  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Drudge(1)
45  Magic User  Sorcerer  Wilmsry  10  0  20.20  20.0  22.0  100.0  100.0  0.50  5.00  65.30  0.20  0.0  2.10  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
46  Magic User  Wizard  Troll  10  0  20.20  20.0  22.0  100.0  100.0  0.50  5.00  60.80  0.20  0.0  0.90  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Dread Lock(2)
47  Thief  Acrobat  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  41.30  0.10  0.0  1.30  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
48  Magic User  Apprentice  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  43.90  0.10  0.0  1.20  cut down by a Stalka Beast(3),cut down by a Drudge(2),cut down by a Herman(2)
49  Fighter  Barbarian  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  40.20  0.10  0.0  1.30  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Djinni(1)
50  Fighter  Barbarian  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.90  5.00  42.30  0.10  0.0  1.40  cut down by a Drarl(4),cut down by a Stalka Beast(2),cut down by a Djinni(1)
51  Fighter  Barbarian  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  50.00  0.10  0.0  0.90  cut down by a Herman(3),came up short on a leap(1),cut down by a Djinni(1)
52  Fighter  Bard  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  42.10  0.10  0.0  0.80  cut down by a Drarl(5),cut down by a Herman(3),cut down by a Djinni(1)
53  Fighter  Bard  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.40  5.00  60.80  0.10  0.0  1.90  cut down by a Dread Lock(2),cut down by a Vampire(2),cut down by a Craig(1)
54  Thief  Cat Burglar  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  29.70  0.10  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Herman(2)
55  Thief  Cloaker  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.90  5.00  47.30  0.10  0.0  1.10  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Djinni(1)
56  Thief  Cloaker  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  60.10  0.10  0.0  1.90  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
57  Magic User  Court Mage  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  43.40  0.10  0.0  1.10  cut down by a Drake(2),cut down by a Herman(2),cut down by a Craig(1)
58  Magic User  Court Mage  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  47.10  0.10  0.0  1.20  cut down by a Djinni(2),cut down by a Drake(2),cut down by a Bones(1)
59  Thief  Cutthroat  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  1.50  5.00  49.60  0.10  0.0  1.80  cut down by a Drarl(3),cut down by a Dread Lock(3),cut down by a Herman(2)
60  Fighter  Guard  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.30  5.00  52.50  0.10  0.0  1.30  cut down by a Drarl(3),cut down by a Stalka Beast(3),cut down by a Vampire(2)
61  Fighter  Guard  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  41.10  0.10  0.0  0.60  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Stink Bug(2)
62  Magic User  Illusionist  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  1.50  5.00  52.40  0.10  0.0  1.30  cut down by a Herman(4),cut down by a Drudge(2),cut down by a Craig(1)
63  Magic User  Illusionist  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.50  5.00  52.40  0.10  0.0  1.30  cut down by a Herman(4),cut down by a Drudge(2),cut down by a Craig(1)
64  Magic User  Illusionist  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  56.20  0.10  0.0  1.90  cut down by a Herman(4),cut down by a Stalka Beast(2),cut down by a Bones(1)
65  Fighter  Knight  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  37.20  0.10  0.0  1.20  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
66  Fighter  Knight  Human  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  38.00  0.10  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Dread Lock(1)
67  Fighter  Master of Arms  Human  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  40.50  0.10  0.0  0.70  cut down by a Drarl(5),cut down by a Djinni(1),cut down by a Drudge(1)
68  Fighter  Master of Arms  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.30  5.00  38.60  0.10  0.0  0.70  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Vampire(2)
69  Fighter  Master of Arms  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  39.90  0.10  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Drudge(1)
70  Thief  Ninja  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  35.00  0.10  0.0  0.60  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Herman(2)
71  Thief  Pickpocket  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.30  5.00  46.50  0.10  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Vampire(2)
72  Thief  Pickpocket  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  36.20  0.10  0.0  0.90  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Dread Lock(2)
73  Thief  Pilfer  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.30  5.00  34.90  0.10  0.0  1.10  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Dread Lock(1)
74  Thief  Pilfer  Troll  10  0  20.10  20.0  21.0  100.0  100.0  1.80  5.00  58.10  0.10  0.0  2.00  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Spectre(2)
75  Fighter  Samurai  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  37.90  0.10  0.0  0.60  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(2)
76  Fighter  Soldier  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  37.20  0.10  0.0  1.20  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
77  Fighter  Soldier  Human  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  38.00  0.10  0.0  0.60  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Dread Lock(1)
78  Magic User  Warlock  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.90  5.00  50.10  0.10  0.0  1.00  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Drake(2)
79  Magic User  Warlock  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  0.30  5.00  90.00  0.10  0.0  1.70  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Vampire(2)
80  Magic User  Wizard  Dwarven  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  52.00  0.10  0.0  0.40  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
81  Magic User  Wizard  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.60  5.00  56.60  0.10  0.0  1.40  cut down by a Djinni(3),cut down by a Dread Lock(2),cut down by a Herman(2)
82  Magic User  Wizard  Human  10  0  20.10  20.0  21.0  100.0  100.0  0.50  5.00  52.80  0.10  0.0  0.70  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Stalka Beast(2)
83  Fighter  Woodsman  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  0.40  5.00  47.00  0.10  0.0  1.60  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
84  Fighter  Woodsman  Troll  10  0  20.10  20.0  21.0  100.0  100.0  0.20  5.00  59.60  0.10  0.0  1.60  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Dread Lock(2)
85  Magic User  Apprentice  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  47.60  0.00  0.0  1.30  cut down by a Dread Lock(3),cut down by a Djinni(2),cut down by a Herman(2)
86  Magic User  Apprentice  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  40.10  0.00  0.0  1.10  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Vampire(2)
87  Magic User  Apprentice  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  47.60  0.00  0.0  1.30  cut down by a Dread Lock(3),cut down by a Djinni(2),cut down by a Herman(2)
88  Magic User  Apprentice  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  31.10  0.00  0.0  0.80  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Dread Lock(1)
89  Fighter  Barbarian  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.80  5.00  39.50  0.00  0.0  1.50  cut down by a Stalka Beast(4),cut down by a Drarl(3),cut down by a Dread Lock(1)
90  Fighter  Barbarian  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.20  5.00  33.90  0.00  0.0  0.50  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Herman(2)
91  Fighter  Bard  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  39.60  0.00  0.0  0.80  cut down by a Drarl(7),cut down by a Dread Lock(1),cut down by a Herman(1)
92  Fighter  Bard  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  41.10  0.00  0.0  1.50  cut down by a Drarl(6),cut down by a Djinni(2),cut down by a Dread Lock(1)
93  Fighter  Bard  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.30  5.00  41.70  0.00  0.0  0.80  cut down by a Drarl(6),cut down by a Dread Lock(2),cut down by a Herman(2)
94  Magic User  Cleric  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  53.90  0.00  0.0  0.50  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Djinni(1)
95  Magic User  Cleric  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  37.80  0.00  0.0  0.30  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Herman(2)
96  Magic User  Cleric  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  38.20  0.00  0.0  0.50  cut down by a Djinni(2),cut down by a Stalka Beast(2),cut down by a Vampire(2)
97  Magic User  Cleric  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.30  5.00  54.70  0.00  0.0  0.50  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Djinni(1)
98  Magic User  Cleric  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  53.70  0.00  0.0  0.90  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Djinni(1)
99  Magic User  Cleric  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  70.50  0.00  0.0  1.40  cut down by a Herman(4),cut down by a Drudge(2),cut down by a Vampire(2)
100  Thief  Cloaker  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  28.60  0.00  0.0  0.70  cut down by a Djinni(3),cut down by a Dread Lock(2),cut down by a Drarl(1)
101  Thief  Cloaker  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  1.60  5.00  40.60  0.00  0.0  1.20  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Herman(2)
102  Thief  Con Artist  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  44.60  0.00  0.0  1.90  cut down by a Drarl(3),cut down by a Stalka Beast(2),cut down by a Craig(1)
103  Magic User  Court Mage  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  40.30  0.00  0.0  1.10  cut down by a Djinni(2),cut down by a Stalka Beast(2),cut down by a Craig(1)
104  Magic User  Court Mage  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.40  5.00  31.60  0.00  0.0  1.10  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Djinni(1)
105  Magic User  Court Mage  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  33.30  0.00  0.0  1.00  cut down by a Djinni(2),cut down by a Stalka Beast(2),cut down by a Craig(1)
106  Magic User  Court Mage  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.50  5.00  57.00  0.00  0.0  1.50  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Stalka Beast(2)
107  Thief  Cutthroat  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.60  5.00  46.10  0.00  0.0  0.80  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
108  Fighter  Guard  Elven  10  0  20.00  20.0  20.0  100.0  100.0  2.00  5.00  43.00  0.00  0.0  1.00  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
109  Fighter  Guard  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  34.90  0.00  0.0  0.90  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Bones(1)
110  Magic User  Illusionist  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  42.40  0.00  0.0  0.90  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Drudge(1)
111  Magic User  Illusionist  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  32.00  0.00  0.0  1.10  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Craig(1)
112  Magic User  Illusionist  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.00  5.00  47.00  0.00  0.0  0.90  cut down by a Herman(4),cut down by a Dread Lock(2),cut down by a Drarl(1)
113  Fighter  Knight  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  34.30  0.00  0.0  1.00  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Dread Lock(2)
114  Fighter  Knight  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  36.30  0.00  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
115  Fighter  Knight  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  36.50  0.00  0.0  0.70  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Craig(1)
116  Fighter  Master of Arms  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.50  5.00  36.90  0.00  0.0  0.90  cut down by a Drarl(5),cut down by a Djinni(1),cut down by a Dread Lock(1)
117  Fighter  Master of Arms  Elven  10  0  20.00  20.0  20.0  100.0  100.0  1.20  5.00  37.40  0.00  0.0  1.00  cut down by a Drarl(5),cut down by a Herman(2),cut down by a Djinni(1)
118  Fighter  Master of Arms  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.40  5.00  35.40  0.00  0.0  1.00  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Dread Lock(1)
119  Thief  Pickpocket  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  45.90  0.00  0.0  1.10  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
120  Thief  Pickpocket  Human  10  0  20.00  20.0  20.0  100.0  100.0  1.30  5.00  42.00  0.00  0.0  0.80  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
121  Thief  Pilfer  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  1.40  5.00  49.10  0.00  0.0  1.60  cut down by a Drarl(3),cut down by a Dread Lock(2),cut down by a Herman(2)
122  Fighter  Samurai  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  27.60  0.00  0.0  0.60  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Drudge(2)
123  Fighter  Samurai  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  38.70  0.00  0.0  0.90  cut down by a Drarl(6),cut down by a Drudge(2),cut down by a Djinni(1)
124  Fighter  Samurai  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  37.60  0.00  0.0  0.30  cut down by a Djinni(2),cut down by a Drudge(2),cut down by a Herman(2)
125  Fighter  Samurai  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  0.90  5.00  35.40  0.00  0.0  1.00  cut down by a Drarl(5),cut down by a Drudge(3),cut down by a Djinni(1)
126  Fighter  Soldier  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  34.30  0.00  0.0  1.00  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Dread Lock(2)
127  Fighter  Soldier  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  36.30  0.00  0.0  0.90  cut down by a Drarl(4),cut down by a Djinni(3),cut down by a Drudge(1)
128  Fighter  Soldier  Troll  10  0  20.00  20.0  20.0  100.0  100.0  0.00  5.00  36.50  0.00  0.0  0.70  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Craig(1)
129  Magic User  Sorcerer  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  28.70  0.00  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Djinni(1)
130  Magic User  Sorcerer  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.00  5.00  36.70  0.00  0.0  0.50  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Drake(1)
131  Magic User  Summoner  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  36.70  0.00  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Stalka Beast(2)
132  Magic User  Summoner  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  22.30  0.00  0.0  0.40  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Vampire(2)
133  Magic User  Summoner  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.40  5.00  24.80  0.00  0.0  0.60  cut down by a Drarl(3),cut down by a Herman(2),eaten by their own summoning(2)
134  Magic User  Summoner  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  36.70  0.00  0.0  0.90  cut down by a Drarl(4),cut down by a Herman(2),cut down by a Stalka Beast(2)
135  Magic User  Summoner  Troll  10  0  20.00  20.0  20.0  100.0  100.0  1.50  5.00  44.60  0.00  0.0  1.30  cut down by a Herman(4),cut down by a Vampire(2),cut down by a Djinni(1)
136  Magic User  Summoner  Wilmsry  10  0  20.00  20.0  20.0  100.0  100.0  1.10  5.00  58.80  0.00  0.0  2.10  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
137  Magic User  Warlock  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  44.80  0.00  0.0  0.50  cut down by a Herman(3),cut down by a Drake(2),cut down by a Djinni(1)
138  Magic User  Warlock  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.50  5.00  45.30  0.00  0.0  0.40  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drake(1)
139  Magic User  Warlock  Fridgian  10  0  20.00  20.0  20.0  100.0  100.0  0.10  5.00  53.40  0.00  0.0  1.30  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Djinni(1)
140  Magic User  Warlock  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.80  5.00  44.80  0.00  0.0  0.50  cut down by a Herman(3),cut down by a Drake(2),cut down by a Djinni(1)
141  Fighter  Woodsman  Dwarven  10  0  20.00  20.0  20.0  100.0  100.0  0.60  5.00  41.40  0.00  0.0  1.10  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Dread Lock(1)
142  Fighter  Woodsman  Elven  10  0  20.00  20.0  20.0  100.0  100.0  0.20  5.00  32.30  0.00  0.0  0.80  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Drudge(2)
143  Fighter  Woodsman  Human  10  0  20.00  20.0  20.0  100.0  100.0  0.70  5.00  44.60  0.00  0.0  1.20  cut down by a Drarl(4),cut down by a Djinni(1),cut down by a Dread Lock(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Thief  480  0  20.25  20.0  21.0  100.0  100.0  1.36  5.00  61.30  0.25  0.0  1.72  cut down by a Drarl(135),cut down by a Herman(91),cut down by a Dread Lock(51)
Fighter  470  0  20.10  20.0  20.0  100.0  100.0  0.77  5.00  47.38  0.10  0.0  1.17  cut down by a Drarl(162),cut down by a Djinni(83),cut down by a Herman(57)
Magic User  480  0  20.07  20.0  20.0  100.0  100.0  0.79  5.00  49.63  0.07  0.0  1.07  cut down by a Herman(115),cut down by a Drarl(69),cut down by a Djinni(53)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Con Artist  60  0  20.40  20.0  22.0  100.0  100.0  1.28  5.00  109.08  0.40  0.0  3.52  cut down by a Herman(11),cut down by a Drarl(9),cut down by a Drudge(8)
Cat Burglar  60  0  20.33  20.0  21.0  100.0  100.0  1.18  5.00  54.23  0.33  0.0  1.57  cut down by a Drarl(23),cut down by a Herman(11),cut down by a Djinni(9)
Acrobat  60  0  20.30  20.0  21.0  100.0  100.0  0.98  5.00  47.95  0.30  0.0  1.25  cut down by a Drarl(26),cut down by a Djinni(9),cut down by a Herman(9)
Ninja  60  0  20.27  20.0  21.0  100.0  100.0  1.62  5.00  49.63  0.27  0.0  1.28  cut down by a Drarl(21),cut down by a Herman(13),cut down by a Djinni(6)
Guard  60  0  20.23  20.0  21.0  100.0  100.0  1.07  5.00  62.68  0.23  0.0  1.43  cut down by a Drarl(13),cut down by a Djinni(11),cut down by a Herman(8)
Cutthroat  60  0  20.22  20.0  21.0  100.0  100.0  1.52  5.00  63.37  0.22  0.0  1.62  cut down by a Drarl(13),cut down by a Dread Lock(13),cut down by a Herman(11)
Wizard  60  0  20.22  20.0  21.0  100.0  100.0  0.57  5.00  62.92  0.22  0.0  0.95  cut down by a Djinni(10),cut down by a Dread Lock(10),cut down by a Herman(10)
Pilfer  60  0  20.18  20.0  21.0  100.0  100.0  1.53  5.00  60.98  0.18  0.0  1.77  cut down by a Drarl(15),cut down by a Djinni(8),cut down by a Herman(8)
Sorcerer  60  0  20.18  20.0  21.0  100.0  100.0  1.53  5.00  53.13  0.18  0.0  1.33  cut down by a Herman(13),cut down by a Drarl(9),cut down by a Vampire(9)
Cloaker  60  0  20.15  20.0  21.0  100.0  100.0  1.57  5.00  56.90  0.15  0.0  1.58  cut down by a Drarl(14),cut down by a Herman(10),cut down by a Djinni(8)
Woodsman  60  0  20.13  20.0  21.0  100.0  100.0  0.57  5.00  59.10  0.13  0.0  1.73  cut down by a Drarl(15),cut down by a Djinni(11),cut down by a Herman(11)
Pickpocket  60  0  20.12  20.0  20.0  100.0  100.0  1.22  5.00  48.23  0.12  0.0  1.18  cut down by a Herman(18),cut down by a Drarl(14),cut down by a Stalka Beast(9)
Barbarian  60  0  20.10  20.0  20.0  100.0  100.0  1.22  5.00  51.03  0.10  0.0  1.38  cut down by a Drarl(19),cut down by a Herman(10),cut down by a Djinni(8)
Bard  60  0  20.10  20.0  20.0  100.0  100.0  0.35  5.00  53.98  0.10  0.0  1.38  cut down by a Drarl(28),cut down by a Herman(10),cut down by a Djinni(6)
Knight  60  0  20.07  20.0  20.0  100.0  100.0  0.68  5.00  38.33  0.07  0.0  0.93  cut down by a Drarl(21),cut down by a Djinni(15),cut down by a Dread Lock(6)
Soldier  60  0  20.07  20.0  20.0  100.0  100.0  0.68  5.00  38.33  0.07  0.0  0.93  cut down by a Drarl(21),cut down by a Djinni(15),cut down by a Dread Lock(6)
Apprentice  60  0  20.05  20.0  20.0  100.0  100.0  0.93  5.00  48.28  0.05  0.0  1.23  cut down by a Herman(14),cut down by a Djinni(13),cut down by a Dread Lock(9)
Illusionist  60  0  20.05  20.0  20.0  100.0  100.0  0.93  5.00  47.07  0.05  0.0  1.23  cut down by a Herman(23),cut down by a Drarl(9),cut down by a Drudge(7)
Master of Arms  60  0  20.05  20.0  20.0  100.0  100.0  0.93  5.00  38.12  0.05  0.0  0.82  cut down by a Drarl(24),cut down by a Djinni(9),cut down by a Herman(6)
Court Mage  60  0  20.03  20.0  20.0  100.0  100.0  0.72  5.00  42.12  0.03  0.0  1.17  cut down by a Djinni(9),cut down by a Stalka Beast(9),cut down by a Herman(8)
Warlock  60  0  20.03  20.0  20.0  100.0  100.0  0.57  5.00  54.73  0.03  0.0  0.90  cut down by a Herman(19),cut down by a Drarl(9),cut down by a Drake(8)
Samurai  50  0  20.02  20.0  20.0  100.0  100.0  0.64  5.00  35.44  0.02  0.0  0.68  cut down by a Drarl(21),cut down by a Drudge(10),cut down by a Djinni(8)
Cleric  60  0  20.00  20.0  20.0  100.0  100.0  0.27  5.00  51.47  0.00  0.0  0.68  cut down by a Herman(14),cut down by a Drarl(10),cut down by a Vampire(9)
Summoner  60  0  20.00  20.0  20.0  100.0  100.0  0.83  5.00  37.32  0.00  0.0  1.03  cut down by a Drarl(17),cut down by a Herman(14),cut down by a Stalka Beast(8)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Wilmsry  240  0  20.30  20.0  21.0  100.0  100.0  1.05  5.00  80.45  0.30  0.0  2.22  cut down by a Drarl(53),cut down by a Herman(47),cut down by a Djinni(32)
Human  240  0  20.13  20.0  21.0  100.0  100.0  1.10  5.00  50.43  0.13  0.0  1.07  cut down by a Drarl(73),cut down by a Herman(33),cut down by a Djinni(26)
Troll  240  0  20.13  20.0  20.0  100.0  100.0  1.04  5.00  54.56  0.13  0.0  1.35  cut down by a Herman(57),cut down by a Drarl(36),cut down by a Djinni(28)
Dwarven  240  0  20.12  20.0  20.0  100.0  100.0  1.15  5.00  50.98  0.12  0.0  1.18  cut down by a Drarl(71),cut down by a Herman(32),cut down by a Djinni(30)
Elven  240  0  20.09  20.0  20.0  100.0  100.0  0.96  5.00  40.07  0.09  0.0  0.93  cut down by a Drarl(63),cut down by a Herman(45),cut down by a Djinni(39)
Fridgian  230  0  20.07  20.0  20.0  100.0  100.0  0.53  5.00  39.81  0.07  0.0  1.18  cut down by a Drarl(70),cut down by a Herman(49),cut down by a Djinni(30)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 1430 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20
elapsed: 59.4s  workers=4  runs=1430
EXIT=0
```

The two machine-diffable aggregates for Phase 26 are `docs/class-pass/after.json`
(natural start, 143 cells x 40 seeds) and `docs/class-pass/after-depth20.json`
(depth-20 slice, 143 cells x 10 seeds) — aggregates only, no per-run rows.

## Outliers (Phase 26 — revisit list)

No revisit rows — every out-of-band row was accepted.

## Handoff to Phase 27

### Yardstick summary
mu (AFTER, run-weighted) = 3.08 — bands: too weak < 2.31, fine 2.31–4.15, too strong > 4.15.
Reach (AFTER, pooled): ≥5 17.2, ≥10 0.3, ≥20 n/a (see depth-20 slice below).
Cannot-act cells: 0 of 143.
Commits: before 5565b22, after d1e3235, before-deep 5565b22, after-deep d1e3235.

### AFTER natural roll-ups — by class
| # | Class | mean | p50 | p90 | ≥5 | ≥10 | kills | lvl | actions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thief | 3.51 | 3.0 | 6.0 | 26.3 | 0.6 | 7.09 | 2.30 | 361.66 |
| 2 | Fighter | 3.16 | 3.0 | 5.0 | 16.9 | 0.2 | 6.33 | 2.07 | 316.41 |
| 3 | Magic User | 2.55 | 2.0 | 4.0 | 8.5 | 0.1 | 4.99 | 1.76 | 251.57 |

### AFTER natural roll-ups — by sub-class
| # | Sub | mean | p50 | p90 | ≥5 | ≥10 | kills | lvl | actions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | 4.33 | 4.0 | 7.0 | 42.5 | 1.7 | 13.70 | 2.96 | 436.24 |
| 2 | Con Artist | 4.07 | 4.0 | 6.0 | 37.1 | 0.0 | 1.75 | 2.38 | 420.30 |
| 3 | Acrobat | 3.89 | 4.0 | 6.0 | 31.7 | 1.3 | 9.17 | 2.58 | 402.71 |
| 4 | Barbarian | 3.66 | 3.0 | 6.0 | 29.6 | 0.4 | 9.05 | 2.23 | 378.38 |
| 5 | Cat Burglar | 3.40 | 3.0 | 6.0 | 25.4 | 0.8 | 8.15 | 2.31 | 333.30 |
| 6 | Pilfer | 3.35 | 3.0 | 6.0 | 24.2 | 0.4 | 6.53 | 2.16 | 360.28 |
| 7 | Knight | 3.30 | 3.0 | 5.0 | 20.0 | 0.0 | 4.64 | 2.05 | 327.88 |
| 8 | Master of Arms | 3.22 | 3.0 | 5.0 | 14.2 | 0.0 | 8.60 | 2.20 | 334.58 |
| 9 | Woodsman | 3.13 | 3.0 | 5.0 | 17.5 | 0.0 | 4.44 | 2.05 | 307.87 |
| 10 | Guard | 3.13 | 3.0 | 5.0 | 14.6 | 0.8 | 6.04 | 2.03 | 319.70 |
| 11 | Cutthroat | 3.11 | 3.0 | 5.0 | 17.9 | 0.0 | 6.26 | 2.08 | 318.86 |
| 12 | Bard | 3.03 | 3.0 | 5.0 | 13.3 | 0.0 | 5.44 | 2.02 | 299.40 |
| 13 | Cloaker | 2.99 | 3.0 | 5.0 | 13.8 | 0.8 | 5.96 | 2.00 | 320.27 |
| 14 | Soldier | 2.98 | 3.0 | 5.0 | 15.4 | 0.0 | 5.68 | 1.99 | 292.66 |
| 15 | Pickpocket | 2.94 | 3.0 | 5.0 | 17.9 | 0.0 | 5.18 | 1.91 | 301.31 |
| 16 | Sorcerer | 2.88 | 3.0 | 5.0 | 12.5 | 0.0 | 6.57 | 1.93 | 278.38 |
| 17 | Samurai | 2.76 | 3.0 | 4.0 | 9.0 | 0.0 | 6.85 | 1.99 | 261.66 |
| 18 | Summoner | 2.71 | 3.0 | 4.0 | 9.6 | 0.4 | 6.50 | 1.87 | 280.20 |
| 19 | Cleric | 2.62 | 2.0 | 4.0 | 9.2 | 0.0 | 5.31 | 1.78 | 265.68 |
| 20 | Warlock | 2.56 | 2.0 | 4.0 | 9.2 | 0.0 | 4.78 | 1.75 | 246.57 |
| 21 | Wizard | 2.46 | 2.0 | 4.0 | 7.1 | 0.0 | 3.98 | 1.65 | 238.46 |
| 22 | Court Mage | 2.45 | 2.0 | 4.0 | 6.7 | 0.0 | 5.28 | 1.69 | 242.42 |
| 23 | Illusionist | 2.41 | 2.0 | 4.0 | 8.8 | 0.0 | 4.16 | 1.62 | 244.10 |
| 24 | Apprentice | 2.35 | 2.0 | 4.0 | 5.4 | 0.0 | 3.31 | 1.80 | 216.78 |

### AFTER natural roll-ups — by race
| # | Race | mean | p50 | p90 | ≥5 | ≥10 | kills | lvl | actions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 3.92 | 4.0 | 6.0 | 36.4 | 0.6 | 5.58 | 2.37 | 412.01 |
| 2 | Troll | 3.26 | 3.0 | 5.0 | 17.0 | 0.3 | 7.28 | 2.15 | 331.10 |
| 3 | Fridgian | 2.90 | 3.0 | 5.0 | 12.2 | 0.1 | 6.12 | 1.95 | 287.18 |
| 4 | Human | 2.89 | 3.0 | 5.0 | 11.6 | 0.2 | 6.25 | 1.97 | 297.74 |
| 5 | Elven | 2.86 | 3.0 | 5.0 | 15.1 | 0.3 | 6.38 | 2.03 | 278.11 |
| 6 | Dwarven | 2.61 | 2.0 | 5.0 | 11.0 | 0.1 | 5.19 | 1.78 | 251.91 |

### Depth-20 roll-ups — by class
| # | Class | floors gained (mean) | floors gained (p50) | encounters survived | kills |
| --- | --- | --- | --- | --- | --- |
| 1 | Thief | 0.25 | 0.0 | 1.72 | 1.36 |
| 2 | Fighter | 0.10 | 0.0 | 1.17 | 0.77 |
| 3 | Magic User | 0.07 | 0.0 | 1.07 | 0.79 |

### Depth-20 roll-ups — by sub-class
| # | Sub | floors gained (mean) | floors gained (p50) | encounters survived | kills |
| --- | --- | --- | --- | --- | --- |
| 1 | Con Artist | 0.40 | 0.0 | 3.52 | 1.28 |
| 2 | Cat Burglar | 0.33 | 0.0 | 1.57 | 1.18 |
| 3 | Acrobat | 0.30 | 0.0 | 1.25 | 0.98 |
| 4 | Ninja | 0.27 | 0.0 | 1.28 | 1.62 |
| 5 | Guard | 0.23 | 0.0 | 1.43 | 1.07 |
| 6 | Cutthroat | 0.22 | 0.0 | 1.62 | 1.52 |
| 7 | Wizard | 0.22 | 0.0 | 0.95 | 0.57 |
| 8 | Pilfer | 0.18 | 0.0 | 1.77 | 1.53 |
| 9 | Sorcerer | 0.18 | 0.0 | 1.33 | 1.53 |
| 10 | Cloaker | 0.15 | 0.0 | 1.58 | 1.57 |
| 11 | Woodsman | 0.13 | 0.0 | 1.73 | 0.57 |
| 12 | Pickpocket | 0.12 | 0.0 | 1.18 | 1.22 |
| 13 | Barbarian | 0.10 | 0.0 | 1.38 | 1.22 |
| 14 | Bard | 0.10 | 0.0 | 1.38 | 0.35 |
| 15 | Knight | 0.07 | 0.0 | 0.93 | 0.68 |
| 16 | Soldier | 0.07 | 0.0 | 0.93 | 0.68 |
| 17 | Apprentice | 0.05 | 0.0 | 1.23 | 0.93 |
| 18 | Illusionist | 0.05 | 0.0 | 1.23 | 0.93 |
| 19 | Master of Arms | 0.05 | 0.0 | 0.82 | 0.93 |
| 20 | Court Mage | 0.03 | 0.0 | 1.17 | 0.72 |
| 21 | Warlock | 0.03 | 0.0 | 0.90 | 0.57 |
| 22 | Samurai | 0.02 | 0.0 | 0.68 | 0.64 |
| 23 | Cleric | 0.00 | 0.0 | 0.68 | 0.27 |
| 24 | Summoner | 0.00 | 0.0 | 1.03 | 0.83 |

### Depth-20 roll-ups — by race
| # | Race | floors gained (mean) | floors gained (p50) | encounters survived | kills |
| --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 0.30 | 0.0 | 2.22 | 1.05 |
| 2 | Human | 0.13 | 0.0 | 1.07 | 1.10 |
| 3 | Troll | 0.13 | 0.0 | 1.35 | 1.04 |
| 4 | Dwarven | 0.12 | 0.0 | 1.18 | 1.15 |
| 5 | Elven | 0.09 | 0.0 | 0.93 | 0.96 |
| 6 | Fridgian | 0.07 | 0.0 | 1.18 | 0.53 |

### Accepted-but-strong rows
- Ninja (sub): AFTER 4.33 — Too strong at AFTER 4.33 (BEFORE 4.22): the opener is the whole fantasy -- ordinary deaths (Werebeasts, traps, starvation) still end most runs, and canParley-false still forces every fight.

### Revisit rows
None.

### Caveats
- This is a tuning proxy, not a gate, and not a substitute for the Phase 27 human DR round.
- Pairing is by seed, not by path — engine changes shift downstream dice.
- The natural matrix's ≥20 rate and its overall median are not carried per cell by the harness JSON, so Phase 27's own readout supplies them.
- Bands are relative to the AFTER mu and the AFTER mu only.

## v1.5 BEFORE — commit e69ff0769c3ad06a5e3ab4da8c670e85aecd972f (Phase 36 — BAL-01)

**Zero cannot-act cells.** `node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-before.json` printed `cannot-act cells: 0 of 143` and exited 0.

### Pin and provenance (Phase 36 capture)

Captured 2026-09-17. Full hash `e69ff0769c3ad06a5e3ab4da8c670e85aecd972f` (short
`e69ff07`). `git diff --quiet v1.4.0 -- engine content src mazeworld.html`
exited 0 immediately before both runs below were launched, and again after
this ledger's own commit — the engine, content, `src/`, and `mazeworld.html`
are byte-identical to tag `v1.4.0` (the 1.4.0 / versionCode 5 Play build) for
this entire capture. This pin is the v1.5 milestone's BEFORE and is taken
before any Phase 36 engine change lands — Plans 02-06 of this phase change
engine/content/src/shell bytes only after this pin. The two files are
`docs/class-pass/v15-before.json` (natural start, 143 cells x 40 seeds) and
`docs/class-pass/v15-before-depth20.json` (depth-20 slice, 143 cells x 10
seeds); v1.2's `before.json`/`after.json`/`retune-after*.json` stay
untouched. Harness provenance: `git diff --quiet 39bfecf -- tools/tune-classes.mjs
tools/lib tools/class-pass-diff.mjs` shows only `tools/lib/tuning-bot.mjs | 2
++` (1 file changed, 2 insertions(+)) — commit `8f3f9d8`, Phase 31's Fight!
split — so the harness (bot policy, cell enumeration, ranking, JSON shape) is
unchanged in any way that would affect comparability against the v1.2
retune-AFTER pin `39bfecf`. Both `Bot:` lines below are byte-identical to
`before.json`/`before-depth20.json`'s own `Bot:` lines apart from
`seeds=`/`startDepth=` (verified via a `node -e` equality check, which
printed `true` for both files). Wall times: the natural-start matrix took
852.8s (~14.2 minutes); the depth-20 slice took 116.6s (~1.9 minutes). The
v1.5 AFTER matrix and its verdicts are appended below this section by Phase
42 (BAL-02), after the tuning bot is taught the new abilities/spells/items
this milestone adds.

### Pooled rollups (v1.5 BEFORE)

| Measure | JSON path | v1.2 retune AFTER (39bfecf) | v1.5 BEFORE (e69ff07) |
| --- | --- | --- | --- |
| p50Depth (natural) | rollups.pooled.p50Depth | 4 | 4 |
| reach5 % (natural) | rollups.pooled.reach5 | 30.6 | 30.6 |
| reach10 % (natural) | rollups.pooled.reach10 | 0.9 | 0.7 |
| reach20 % (natural) | rollups.pooled.reach20 | 0.1 | 0.1 |
| meanDepth (natural) | rollups.pooled.meanDepth | 3.77 | 3.75 |
| p90Depth (natural) | rollups.pooled.p90Depth | 6 | 6 |
| meanEncountersSurvived (depth-20) | rollups.pooled.meanEncountersSurvived | 3.17 | 2.77 |
| p50FloorsGained (depth-20) | rollups.pooled.p50FloorsGained | 0 | 0 |
| meanFloorsGained (depth-20) | rollups.pooled.meanFloorsGained | 0.84 | 0.79 |
| stuck total (natural) | sum of cells[].stuck | 0 of 5720 | 0 of 5720 |
| stuck total (depth-20) | sum of cells[].stuck | 0 of 1430 | 0 of 1430 |
| cannot-act cells | class-pass-diff.mjs --gate | 0 of 143 | 0 of 143 |

These are the like-for-like yardstick Phase 42 (BAL-02) diffs its v1.5 AFTER
matrix against — a TUNING PROXY, not a gate.

### v1.5 BEFORE transcript — tune-classes --seeds 40 --workers 4 --max-actions 5000

```
tune-classes: 143 cells x 40 seeds (5720 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Wilmsry  40  0  6.28  6.0  8.0  85.0  5.0  20.73  3.65  683.90  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Poltergeist(3)
2  Thief  Acrobat  Wilmsry  40  0  5.73  6.0  8.0  82.5  0.0  9.15  3.28  599.23  cut down by a Werebeast(10),starved in the dark(3),undone by a trap(3)
3  Thief  Ninja  Human  40  0  5.65  5.0  8.0  70.0  7.5  16.88  3.63  586.25  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Blumble(2)
4  Fighter  Barbarian  Wilmsry  40  0  5.50  6.0  8.0  75.0  0.0  8.78  3.18  588.53  cut down by a Werebeast(5),undone by a trap(4),cut down by a Blumble(2)
5  Thief  Pilfer  Wilmsry  40  0  5.43  5.0  8.0  60.0  2.5  7.33  3.13  597.75  cut down by a Drarl(6),spent by the dungeon itself(5),cut down by a Poltergeist(3)
6  Thief  Pickpocket  Wilmsry  40  0  5.35  5.0  8.0  65.0  2.5  6.78  2.93  576.25  cut down by a Drarl(4),fell off a wall(4),cut down by a Blumble(3)
7  Thief  Con Artist  Wilmsry  40  0  5.35  5.0  8.0  62.5  2.5  2.00  2.98  590.23  cut down by a Poltergeist(4),cut down by a Google(3),cut down by a Werebeast(3)
8  Fighter  Knight  Wilmsry  40  0  5.23  5.0  7.0  67.5  0.0  3.50  3.00  553.17  cut down by a Werebeast(5),starved in the dark(5),cut down by a Google(4)
9  Fighter  Woodsman  Wilmsry  40  0  5.15  5.0  7.0  65.0  0.0  6.48  2.93  558.10  cut down by a Werebeast(7),starved in the dark(5),cut down by a Blumble(4)
10  Thief  Ninja  Troll  40  0  5.10  5.0  8.0  62.5  5.0  14.58  3.45  528.10  starved in the dark(8),cut down by a Drarl(5),cut down by a Werebeast(4)
11  Fighter  Guard  Wilmsry  40  0  5.08  4.0  8.0  47.5  2.5  6.53  2.98  535.80  starved in the dark(5),cut down by a Drarl(4),cut down by a Werebeast(4)
12  Thief  Cloaker  Wilmsry  40  0  5.03  5.0  8.0  60.0  2.5  6.30  2.88  577.13  cut down by a Werebeast(5),cut down by a Skeleton(4),spent by the dungeon itself(4)
13  Thief  Acrobat  Troll  40  0  5.00  5.0  7.0  65.0  0.0  13.98  3.33  528.78  starved in the dark(8),undone by a trap(5),cut down by a Werebeast(4)
14  Thief  Cat Burglar  Troll  40  0  5.00  5.0  7.0  62.5  2.5  14.88  3.40  511.75  starved in the dark(12),undone by a trap(7),spent by the dungeon itself(3)
15  Thief  Ninja  Dwarven  40  0  4.97  5.0  8.0  52.5  5.0  14.33  3.28  510.78  cut down by a Werebeast(7),cut down by a Djinni(3),cut down by a Herman(3)
16  Thief  Cutthroat  Wilmsry  40  0  4.88  5.0  8.0  50.0  2.5  6.18  2.78  550.55  cut down by a Poltergeist(5),fell off a wall(5),cut down by a Skeleton(4)
17  Fighter  Bard  Wilmsry  40  0  4.85  5.0  7.0  55.0  2.5  6.50  3.00  527.08  cut down by a Blumble(5),cut down by a Google(5),cut down by a Poltergeist(5)
18  Magic User  Sorcerer  Wilmsry  40  0  4.70  5.0  7.0  67.5  0.0  8.28  2.83  497.55  fell off a wall(4),came up short on a leap(3),cut down by a Herman(3)
19  Thief  Cat Burglar  Wilmsry  40  0  4.70  5.0  8.0  50.0  5.0  7.15  2.68  500.83  undone by a trap(10),cut down by a Google(5),cut down by a Werebeast(4)
20  Magic User  Sorcerer  Human  40  0  4.68  4.0  8.0  47.5  5.0  15.70  3.40  494.75  cut down by a Blumble(4),cut down by a Stalka Beast(4),cut down by a Drarl(3)
21  Thief  Con Artist  Troll  40  0  4.65  5.0  6.0  50.0  2.5  2.80  2.70  487.83  starved in the dark(10),came up short on a leap(4),cut down by a Blumble(4)
22  Fighter  Knight  Human  40  0  4.55  5.0  6.0  55.0  0.0  6.38  2.78  465.08  cut down by a Dante(6),cut down by a Blumble(3),cut down by a Werebeast(3)
23  Thief  Con Artist  Fridgian  40  0  4.53  4.0  6.0  45.0  0.0  2.15  2.60  495.95  cut down by a Dante(4),undone by a trap(4),came up short on a leap(3)
24  Fighter  Knight  Fridgian  40  0  4.50  5.0  6.0  55.0  0.0  5.80  2.80  440.05  cut down by a Werebeast(7),cut down by a Cave Bear(3),cut down by a Ghoul(3)
25  Fighter  Master of Arms  Wilmsry  40  0  4.50  5.0  6.0  52.5  2.5  12.90  2.83  475.18  cut down by a Poltergeist(5),cut down by a Werebeast(4),cut down by a Skeleton(3)
26  Fighter  Barbarian  Human  40  0  4.45  5.0  6.0  50.0  0.0  13.55  2.65  472.43  cut down by a Werebeast(10),cut down by a Trachea(4),cut down by a Poltergeist(3)
27  Thief  Ninja  Elven  40  0  4.45  4.0  7.0  47.5  2.5  13.95  3.20  452.93  cut down by a Poltergeist(6),undone by a trap(6),cut down by a Drarl(4)
28  Thief  Acrobat  Human  40  0  4.40  4.0  8.0  40.0  2.5  12.20  3.05  453.03  cut down by a Poltergeist(7),cut down by a Werebeast(4),cut down by a Herman(3)
29  Thief  Con Artist  Dwarven  40  0  4.35  4.0  6.0  42.5  0.0  1.83  2.50  478.10  spent by the dungeon itself(8),cut down by a Werebeast(5),came up short on a leap(3)
30  Magic User  Sorcerer  Troll  40  0  4.33  4.0  7.0  45.0  0.0  14.23  3.05  484.70  starved in the dark(10),fell off a wall(4),cut down by a Frank(3)
31  Magic User  Sorcerer  Dwarven  40  0  4.30  4.0  7.0  45.0  2.5  13.45  3.20  445.65  cut down by a Werebeast(4),cut down by a Blumble(3),cut down by a Herman(3)
32  Thief  Con Artist  Human  40  0  4.30  4.0  6.0  42.5  2.5  2.17  2.42  451.98  cut down by a Poltergeist(5),undone by a trap(5),cut down by a Cave Bear(4)
33  Thief  Ninja  Fridgian  40  0  4.30  4.0  6.0  35.0  0.0  13.03  3.15  430.93  cut down by a Werebeast(6),undone by a trap(4),cut down by a Poltergeist(3)
34  Thief  Acrobat  Fridgian  40  0  4.28  5.0  6.0  50.0  2.5  11.53  2.78  450.40  cut down by a Gremlin(5),cut down by a Werebeast(4),starved in the dark(3)
35  Fighter  Soldier  Wilmsry  40  0  4.28  4.0  7.0  42.5  0.0  5.65  2.50  451.73  cut down by a Poltergeist(4),cut down by a Blumble(3),cut down by a Dante(3)
36  Thief  Acrobat  Dwarven  40  0  4.25  4.0  7.0  40.0  2.5  11.53  2.85  456.30  undone by a trap(7),cut down by a Poltergeist(5),cut down by a Craig(2)
37  Thief  Cat Burglar  Human  40  0  4.25  4.0  8.0  37.5  7.5  11.63  2.88  437.60  undone by a trap(9),cut down by a Poltergeist(4),cut down by a Google(3)
38  Fighter  Knight  Dwarven  40  0  4.22  4.0  6.0  45.0  0.0  5.15  2.63  435.28  cut down by a Poltergeist(5),spent by the dungeon itself(5),cut down by a Werebeast(4)
39  Magic User  Summoner  Wilmsry  40  0  4.22  4.0  7.0  45.0  0.0  6.13  2.55  460.05  undone by a trap(4),cut down by a Gremlin(3),cut down by a Poltergeist(3)
40  Fighter  Knight  Elven  40  0  4.20  4.0  6.0  47.5  0.0  4.45  2.60  425.00  cut down by a Poltergeist(5),cut down by a Werebeast(4),cut down by a Google(3)
41  Thief  Cat Burglar  Dwarven  40  0  4.10  4.0  7.0  45.0  0.0  11.48  2.83  418.88  cut down by a Werebeast(9),undone by a trap(8),cut down by a Herman(4)
42  Magic User  Warlock  Troll  40  0  4.10  4.0  7.0  32.5  0.0  11.08  2.88  442.65  starved in the dark(11),spent by the dungeon itself(4),fell off a wall(3)
43  Fighter  Barbarian  Fridgian  40  0  4.05  4.0  7.0  32.5  0.0  11.15  2.45  432.58  cut down by a Poltergeist(5),cut down by a Werebeast(4),undone by a trap(4)
44  Thief  Cloaker  Troll  40  0  4.05  3.0  7.0  30.0  2.5  9.88  2.65  453.20  starved in the dark(12),spent by the dungeon itself(4),cut down by a Drarl(3)
45  Magic User  Court Mage  Wilmsry  40  0  4.03  4.0  6.0  30.0  0.0  6.18  2.28  427.50  cut down by a Dante(4),cut down by a Ned(3),cut down by a Poltergeist(3)
46  Magic User  Wizard  Troll  40  0  4.03  4.0  6.0  27.5  0.0  10.60  2.73  417.75  starved in the dark(11),cut down by a Werebeast(4),cut down by a China Wolf(2)
47  Magic User  Cleric  Wilmsry  40  0  4.00  4.0  6.0  32.5  0.0  5.68  2.38  413.65  cut down by a Poltergeist(6),cut down by a Trachea(3),fell off a wall(3)
48  Magic User  Cleric  Troll  40  0  3.95  4.0  6.0  35.0  0.0  9.65  2.60  420.73  starved in the dark(11),fell off a wall(4),cut down by a Dante(3)
49  Thief  Pilfer  Fridgian  40  0  3.95  4.0  6.0  35.0  0.0  10.20  2.75  444.53  cut down by a Werebeast(10),cut down by a Poltergeist(3),starved in the dark(3)
50  Fighter  Knight  Troll  40  0  3.93  4.0  5.0  42.5  0.0  4.08  2.42  404.80  starved in the dark(14),cut down by a Poltergeist(4),cut down by a Werebeast(3)
51  Magic User  Illusionist  Wilmsry  40  0  3.93  4.0  7.0  37.5  2.5  5.43  2.53  450.85  cut down by a Dante(4),cut down by a Frank(3),starved in the dark(3)
52  Fighter  Barbarian  Elven  40  0  3.93  4.0  6.0  32.5  0.0  11.03  2.58  409.18  cut down by a Gremlin(4),cut down by a Dante(3),cut down by a Frank(3)
53  Fighter  Master of Arms  Human  40  0  3.90  4.0  6.0  30.0  0.0  10.90  2.78  412.00  starved in the dark(6),cut down by a Poltergeist(5),cut down by a Dante(3)
54  Thief  Cat Burglar  Fridgian  40  0  3.88  4.0  6.0  32.5  0.0  10.30  2.80  411.73  undone by a trap(6),cut down by a Dante(4),cut down by a Werebeast(4)
55  Fighter  Barbarian  Troll  40  0  3.88  4.0  5.0  30.0  0.0  10.95  2.30  389.98  starved in the dark(9),undone by a trap(5),cut down by a Poltergeist(4)
56  Thief  Acrobat  Elven  40  0  3.85  4.0  6.0  35.0  0.0  10.13  2.73  407.68  undone by a trap(6),cut down by a Poltergeist(4),cut down by a Werebeast(4)
57  Magic User  Sorcerer  Fridgian  40  0  3.85  4.0  6.0  32.5  0.0  11.85  2.73  387.98  cut down by a Werebeast(6),cut down by a Frank(3),fell off a wall(3)
58  Fighter  Samurai  Wilmsry  40  0  3.85  4.0  6.0  30.0  0.0  6.50  2.33  404.08  cut down by a Google(6),cut down by a Werebeast(4),cut down by a Cave Bear(3)
59  Magic User  Court Mage  Troll  40  0  3.83  4.0  6.0  25.0  0.0  10.25  2.70  422.65  starved in the dark(6),cut down by a Poltergeist(5),cut down by a Werebeast(5)
60  Thief  Pilfer  Troll  40  0  3.80  4.0  6.0  32.5  0.0  9.40  2.63  419.80  starved in the dark(10),cut down by a Werebeast(4),spent by the dungeon itself(4)
61  Thief  Cloaker  Fridgian  40  0  3.73  4.0  5.0  32.5  0.0  8.98  2.48  388.73  cut down by a Poltergeist(5),starved in the dark(4),spent by the dungeon itself(3)
62  Magic User  Wizard  Wilmsry  40  0  3.73  4.0  7.0  32.5  0.0  4.00  2.25  396.15  cut down by a Drekk(4),came up short on a leap(3),cut down by a Primp(3)
63  Fighter  Guard  Human  40  0  3.73  4.0  6.0  25.0  0.0  10.00  2.60  387.18  cut down by a Dante(4),cut down by a Frank(3),cut down by a Poltergeist(3)
64  Thief  Pickpocket  Human  40  0  3.70  4.0  7.0  42.5  0.0  8.07  2.38  405.25  starved in the dark(6),fell off a wall(5),cut down by a Poltergeist(4)
65  Fighter  Soldier  Fridgian  40  0  3.70  4.0  5.0  32.5  0.0  8.82  2.48  376.68  cut down by a Werebeast(5),cut down by a Gremlin(4),cut down by a Blumble(3)
66  Fighter  Soldier  Human  40  0  3.70  4.0  6.0  30.0  0.0  8.65  2.53  380.03  cut down by a Werebeast(5),cut down by a Shadow(3),cut down by a Sterling(3)
67  Fighter  Master of Arms  Fridgian  40  0  3.70  3.0  5.0  27.5  0.0  9.68  2.63  393.58  cut down by a Werebeast(7),cut down by a Dante(5),cut down by a Poltergeist(4)
68  Fighter  Woodsman  Fridgian  40  0  3.68  4.0  5.0  32.5  0.0  7.15  2.48  374.18  cut down by a Werebeast(5),cut down by a Google(4),cut down by a Gremlin(3)
69  Fighter  Bard  Human  40  0  3.68  4.0  6.0  25.0  0.0  7.63  2.45  382.55  cut down by a Poltergeist(6),cut down by a Gremlin(3),cut down by a Werebeast(3)
70  Magic User  Apprentice  Wilmsry  40  0  3.65  3.0  7.0  25.0  0.0  4.05  2.35  373.93  cut down by a Gremlin(5),came up short on a leap(4),cut down by a Google(3)
71  Thief  Cutthroat  Fridgian  40  0  3.65  3.0  5.0  20.0  2.5  9.60  2.33  400.38  cut down by a Dante(3),cut down by a Poltergeist(3),cut down by a Trachea(3)
72  Thief  Con Artist  Elven  40  0  3.63  4.0  6.0  30.0  0.0  1.50  2.13  383.08  cut down by a Shadow(4),fell off a wall(4),spent by the dungeon itself(4)
73  Magic User  Warlock  Fridgian  40  0  3.63  4.0  6.0  30.0  0.0  9.48  2.45  377.25  cut down by a Werebeast(5),came up short on a leap(3),cut down by a Gremlin(3)
74  Magic User  Summoner  Troll  40  0  3.63  3.0  6.0  25.0  0.0  10.50  2.63  400.98  starved in the dark(15),cut down by a Frank(2),cut down by a Poltergeist(2)
75  Thief  Pickpocket  Troll  40  0  3.60  4.0  6.0  22.5  0.0  8.23  2.42  373.15  starved in the dark(12),cut down by a Werebeast(3),spent by the dungeon itself(3)
76  Fighter  Guard  Troll  40  0  3.60  3.0  6.0  20.0  0.0  8.88  2.53  367.30  starved in the dark(11),cut down by a Poltergeist(3),spent by the dungeon itself(3)
77  Magic User  Court Mage  Fridgian  40  0  3.58  3.0  6.0  27.5  0.0  9.43  2.50  364.18  cut down by a Poltergeist(5),cut down by a Frank(3),cut down by a Trachea(3)
78  Thief  Cutthroat  Troll  40  0  3.58  3.0  5.0  25.0  0.0  9.18  2.35  406.43  starved in the dark(10),came up short on a leap(3),spent by the dungeon itself(3)
79  Fighter  Woodsman  Human  40  0  3.55  4.0  5.0  25.0  0.0  7.43  2.50  379.25  cut down by a Werebeast(6),cut down by a Google(3),cut down by a Shadow(3)
80  Fighter  Bard  Fridgian  40  0  3.55  4.0  5.0  20.0  0.0  7.20  2.35  355.40  cut down by a Poltergeist(8),cut down by a Rinkle(5),spent by the dungeon itself(3)
81  Magic User  Illusionist  Troll  40  0  3.55  3.0  6.0  27.5  0.0  8.95  2.40  379.95  starved in the dark(9),fell off a wall(4),undone by a trap(3)
82  Thief  Cutthroat  Elven  40  0  3.53  3.0  6.0  25.0  0.0  8.35  2.35  355.13  spent by the dungeon itself(6),cut down by a Blumble(4),cut down by a Gremlin(3)
83  Fighter  Master of Arms  Dwarven  40  0  3.53  3.0  6.0  25.0  0.0  9.07  2.42  363.88  cut down by a Poltergeist(5),undone by a trap(5),cut down by a Dante(3)
84  Magic User  Warlock  Human  40  0  3.50  4.0  5.0  27.5  0.0  8.73  2.45  354.30  cut down by a Gremlin(3),cut down by a Poltergeist(3),cut down by a Werebeast(3)
85  Thief  Pilfer  Elven  40  0  3.50  3.0  5.0  27.5  0.0  7.68  2.30  379.48  cut down by a Poltergeist(6),spent by the dungeon itself(4),cut down by a Blumble(3)
86  Thief  Pilfer  Dwarven  40  0  3.50  3.0  7.0  25.0  0.0  7.68  2.42  378.35  cut down by a Google(4),cut down by a Dante(3),cut down by a Gremlin(3)
87  Thief  Cloaker  Human  40  0  3.50  3.0  6.0  22.5  0.0  7.25  2.23  371.15  starved in the dark(6),cut down by a Blumble(3),cut down by a Dante(3)
88  Thief  Cutthroat  Human  40  0  3.48  3.0  5.0  25.0  0.0  8.98  2.35  386.05  cut down by a Poltergeist(4),starved in the dark(4),cut down by a Herman(3)
89  Fighter  Guard  Fridgian  40  0  3.48  3.0  5.0  22.5  0.0  9.25  2.50  359.68  cut down by a Werebeast(5),fell off a wall(5),spent by the dungeon itself(3)
90  Magic User  Warlock  Wilmsry  40  0  3.45  3.0  5.0  32.5  2.5  4.68  2.05  351.73  cut down by a Drekk(4),cut down by a Philly(4),cut down by a Poltergeist(4)
91  Fighter  Barbarian  Dwarven  40  0  3.45  3.0  5.0  22.5  0.0  10.25  2.17  365.08  cut down by a China Wolf(3),cut down by a Gremlin(3),cut down by a Poltergeist(3)
92  Fighter  Woodsman  Troll  40  0  3.45  3.0  5.0  22.5  0.0  5.78  2.25  359.33  starved in the dark(13),cut down by a Poltergeist(5),undone by a trap(4)
93  Thief  Cloaker  Dwarven  40  0  3.45  3.0  6.0  20.0  2.5  5.75  2.05  361.80  cut down by a Gremlin(6),came up short on a leap(4),spent by the dungeon itself(3)
94  Thief  Cutthroat  Dwarven  40  0  3.43  3.0  6.0  22.5  2.5  7.05  2.17  371.95  cut down by a Gremlin(4),cut down by a Herman(4),cut down by a Werebeast(3)
95  Magic User  Summoner  Human  40  0  3.40  3.0  5.0  30.0  2.5  9.63  2.42  378.80  cut down by a Werebeast(4),undone by a trap(4),cut down by a Philly(3)
96  Magic User  Cleric  Human  40  0  3.40  3.0  6.0  20.0  0.0  9.00  2.33  347.95  cut down by a Poltergeist(8),cut down by a Blumble(4),fell off a wall(3)
97  Thief  Pilfer  Human  40  0  3.33  3.0  5.0  30.0  0.0  8.15  2.33  393.00  cut down by a Pogo(4),spent by the dungeon itself(4),cut down by a Werebeast(3)
98  Fighter  Woodsman  Elven  40  0  3.33  3.0  5.0  25.0  0.0  5.03  2.28  322.30  cut down by a Shadow(6),cut down by a Werebeast(5),starved in the dark(5)
99  Fighter  Master of Arms  Troll  40  0  3.30  3.0  5.0  17.5  0.0  7.73  2.20  330.95  starved in the dark(9),spent by the dungeon itself(4),undone by a trap(4)
100  Fighter  Bard  Troll  40  0  3.30  3.0  5.0  10.0  0.0  6.55  2.23  357.43  starved in the dark(13),cut down by a Poltergeist(3),cut down by a Blumble(2)
101  Magic User  Warlock  Dwarven  40  0  3.28  3.0  6.0  15.0  0.0  7.05  2.17  338.75  cut down by a Werebeast(5),cut down by a Gremlin(4),undone by a trap(4)
102  Fighter  Samurai  Human  40  0  3.28  3.0  5.0  12.5  0.0  10.63  2.40  336.05  cut down by a Google(3),cut down by a Philly(3),cut down by a Poltergeist(3)
103  Fighter  Woodsman  Dwarven  40  0  3.25  3.0  5.0  15.0  2.5  5.75  2.15  329.38  cut down by a Gremlin(5),fell off a wall(5),undone by a trap(5)
104  Fighter  Soldier  Troll  40  0  3.25  3.0  4.0  7.5  0.0  8.00  2.28  330.00  starved in the dark(12),cut down by a Gremlin(5),cut down by a Blumble(2)
105  Fighter  Bard  Dwarven  40  0  3.23  3.0  5.0  22.5  0.0  5.78  2.15  321.90  starved in the dark(4),cut down by a Gremlin(3),cut down by a Poltergeist(3)
106  Thief  Pickpocket  Fridgian  40  0  3.23  3.0  5.0  20.0  0.0  7.60  2.13  334.50  cut down by a Gremlin(6),starved in the dark(6),undone by a trap(4)
107  Magic User  Apprentice  Troll  40  0  3.23  3.0  5.0  12.5  0.0  6.70  2.42  335.25  starved in the dark(14),spent by the dungeon itself(4),undone by a trap(3)
108  Fighter  Bard  Elven  40  0  3.23  3.0  5.0  12.5  0.0  6.80  2.17  297.85  cut down by a Poltergeist(7),cut down by a Dante(3),cut down by a Google(3)
109  Magic User  Summoner  Fridgian  40  0  3.18  3.0  5.0  12.5  0.0  8.25  2.13  332.48  eaten by their own summoning(5),undone by a trap(5),cut down by a Werebeast(4)
110  Fighter  Guard  Dwarven  40  0  3.15  3.0  5.0  20.0  0.0  6.93  2.20  320.00  cut down by a Gremlin(6),fell off a wall(4),cut down by a Poltergeist(3)
111  Magic User  Sorcerer  Elven  40  0  3.15  3.0  5.0  12.5  0.0  8.00  2.33  310.98  cut down by a Frank(4),cut down by a Poltergeist(3),cut down by a Rinkle(3)
112  Fighter  Soldier  Dwarven  40  0  3.13  3.0  5.0  20.0  0.0  6.60  2.10  305.95  cut down by a Gremlin(9),cut down by a China Wolf(3),came up short on a leap(2)
113  Thief  Pickpocket  Dwarven  40  0  3.10  3.0  5.0  20.0  0.0  6.45  2.03  327.25  cut down by a Gremlin(3),cut down by a Philly(3),cut down by a Poltergeist(3)
114  Fighter  Samurai  Troll  40  0  3.10  3.0  4.0  7.5  0.0  8.38  2.08  308.10  cut down by a Werebeast(5),cut down by a Poltergeist(4),starved in the dark(4)
115  Fighter  Master of Arms  Elven  40  0  3.08  3.0  5.0  10.0  0.0  10.18  2.38  312.70  cut down by a Gremlin(4),cut down by a Poltergeist(4),cut down by a Rinkle(4)
116  Magic User  Cleric  Fridgian  40  0  3.00  3.0  5.0  12.5  0.0  7.88  2.10  315.60  cut down by a Gremlin(4),undone by a trap(4),cut down by a Dante(3)
117  Thief  Cat Burglar  Elven  40  0  2.98  3.0  5.0  20.0  0.0  7.08  2.17  273.20  undone by a trap(13),cut down by a Blumble(4),cut down by a Frank(2)
118  Magic User  Warlock  Elven  40  0  2.98  3.0  5.0  12.5  0.0  5.95  2.15  293.88  cut down by a Gremlin(4),came up short on a leap(3),cut down by a China Wolf(3)
119  Magic User  Summoner  Dwarven  40  0  2.98  3.0  4.0  7.5  2.5  8.15  2.15  307.52  came up short on a leap(4),cut down by a Philly(4),cut down by a Cave Bear(3)
120  Thief  Cloaker  Elven  40  0  2.95  3.0  5.0  17.5  0.0  6.35  1.90  303.93  undone by a trap(5),cut down by a Gremlin(4),spent by the dungeon itself(4)
121  Fighter  Soldier  Elven  40  0  2.95  3.0  5.0  10.0  0.0  6.65  2.17  293.65  cut down by a Dante(3),cut down by a Gremlin(3),cut down by a Poltergeist(3)
122  Magic User  Cleric  Dwarven  40  0  2.93  3.0  5.0  22.5  0.0  7.05  2.08  287.40  cut down by a Werebeast(4),fell off a wall(4),cut down by a Gremlin(3)
123  Magic User  Court Mage  Dwarven  40  0  2.93  3.0  5.0  20.0  0.0  7.40  2.08  296.93  cut down by a Dog Face(3),cut down by a Gremlin(3),cut down by a Philly(3)
124  Magic User  Wizard  Human  40  0  2.93  3.0  5.0  17.5  0.0  5.98  1.98  305.02  cut down by a Drekk(4),cut down by a Gremlin(4),cut down by a Primp(3)
125  Fighter  Guard  Elven  40  0  2.90  3.0  5.0  12.5  0.0  7.30  2.15  305.68  cut down by a Poltergeist(6),cut down by a Gremlin(4),cut down by a Werebeast(4)
126  Fighter  Samurai  Elven  40  0  2.90  3.0  4.0  7.5  0.0  8.80  2.15  295.88  cut down by a Dante(4),cut down by a Poltergeist(4),cut down by a Gremlin(3)
127  Magic User  Wizard  Fridgian  40  0  2.90  3.0  4.0  7.5  0.0  6.75  2.08  301.02  cut down by a Werebeast(5),cut down by a Gremlin(4),cut down by a Poltergeist(4)
128  Magic User  Illusionist  Human  40  0  2.90  3.0  4.0  2.5  2.5  7.25  2.03  319.08  spent by the dungeon itself(4),cut down by a Gremlin(3),cut down by a Ned(3)
129  Magic User  Illusionist  Fridgian  40  0  2.85  3.0  5.0  17.5  0.0  7.00  1.98  298.50  cut down by a Gremlin(7),cut down by a Blumble(4),cut down by a Philly(4)
130  Magic User  Apprentice  Human  40  0  2.85  3.0  5.0  15.0  0.0  5.65  2.10  298.88  cut down by a Drekk(4),fell off a wall(4),undone by a trap(4)
131  Thief  Pickpocket  Elven  40  0  2.85  3.0  5.0  15.0  0.0  6.58  2.03  285.27  cut down by a Poltergeist(5),cut down by a Dante(3),cut down by a Gremlin(3)
132  Magic User  Apprentice  Fridgian  40  0  2.83  3.0  5.0  10.0  0.0  6.10  2.17  281.68  cut down by a Gremlin(3),cut down by a Werebeast(3),starved in the dark(3)
133  Fighter  Samurai  Dwarven  40  0  2.83  3.0  4.0  7.5  0.0  8.65  2.05  280.00  cut down by a Drekk(5),cut down by a Shadow(5),cut down by a Dante(3)
134  Magic User  Summoner  Elven  40  0  2.80  3.0  4.0  7.5  0.0  6.50  1.95  286.95  cut down by a Poltergeist(5),starved in the dark(5),cut down by a Gremlin(4)
135  Magic User  Court Mage  Human  40  0  2.60  2.0  4.0  7.5  0.0  7.38  1.85  279.70  cut down by a Philly(4),cut down by a Blumble(3),cut down by a Ned(3)
136  Magic User  Apprentice  Elven  40  0  2.58  2.0  5.0  12.5  0.0  4.22  1.95  242.65  cut down by a Gremlin(4),cut down by a Philly(4),fell off a wall(4)
137  Magic User  Apprentice  Dwarven  40  0  2.50  2.0  4.0  2.5  0.0  4.25  1.88  226.98  cut down by a Gremlin(5),cut down by a Ned(5),cut down by a Drekk(4)
138  Magic User  Court Mage  Elven  40  0  2.42  2.0  5.0  10.0  0.0  5.33  1.75  229.98  undone by a trap(5),cut down by a Drarl(3),cut down by a Gremlin(3)
139  Magic User  Wizard  Elven  40  0  2.35  2.0  4.0  5.0  0.0  4.72  1.70  230.55  cut down by a Gremlin(7),cut down by a Poltergeist(4),undone by a trap(4)
140  Magic User  Illusionist  Dwarven  40  0  2.35  2.0  4.0  2.5  0.0  4.93  1.75  248.18  cut down by a Ned(7),cut down by a Drekk(5),cut down by a Philly(5)
141  Magic User  Cleric  Elven  40  0  2.33  2.0  4.0  2.5  0.0  5.33  1.80  223.78  cut down by a Gremlin(4),undone by a trap(4),cut down by a Google(3)
142  Magic User  Wizard  Dwarven  40  0  2.30  2.0  4.0  5.0  0.0  4.35  1.58  230.28  cut down by a Gremlin(5),cut down by a Philly(5),fell off a wall(5)
143  Magic User  Illusionist  Elven  40  0  2.25  2.0  4.0  7.5  0.0  4.38  1.65  218.95  cut down by a Drekk(4),cut down by a Gremlin(4),cut down by a Philly(4)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  1920  0  4.18  4.0  7.0  40.2  1.6  8.85  2.67  445.22  starved in the dark(166),undone by a trap(161),cut down by a Werebeast(152)
Fighter  1880  0  3.77  4.0  6.0  29.8  0.2  7.87  2.46  388.76  starved in the dark(159),cut down by a Poltergeist(156),cut down by a Werebeast(145)
Magic User  1920  0  3.31  3.0  5.0  21.7  0.4  7.57  2.28  344.43  starved in the dark(144),cut down by a Poltergeist(122),fell off a wall(119)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  240  0  5.13  5.0  7.0  58.8  4.2  15.58  3.39  532.15  cut down by a Werebeast(25),undone by a trap(20),cut down by a Drarl(18)
Acrobat  240  0  4.58  5.0  7.0  52.1  1.3  11.42  3.00  482.57  cut down by a Werebeast(26),undone by a trap(24),cut down by a Poltergeist(19)
Con Artist  240  0  4.47  4.0  6.0  45.4  1.3  2.08  2.55  481.19  spent by the dungeon itself(20),cut down by a Werebeast(18),starved in the dark(18)
Knight  240  0  4.44  5.0  6.0  52.1  0.0  4.89  2.70  453.90  cut down by a Werebeast(26),starved in the dark(25),cut down by a Poltergeist(21)
Barbarian  240  0  4.21  4.0  6.0  40.4  0.0  10.95  2.55  442.96  cut down by a Werebeast(22),cut down by a Poltergeist(18),starved in the dark(17)
Sorcerer  240  0  4.17  4.0  6.0  41.7  1.3  11.92  2.92  436.93  cut down by a Werebeast(19),fell off a wall(16),starved in the dark(15)
Cat Burglar  240  0  4.15  4.0  7.0  41.3  2.5  10.42  2.79  425.66  undone by a trap(53),cut down by a Werebeast(24),starved in the dark(19)
Pilfer  240  0  3.92  4.0  6.0  35.0  0.4  8.40  2.59  435.48  cut down by a Werebeast(23),spent by the dungeon itself(22),starved in the dark(20)
Cloaker  240  0  3.78  3.0  6.0  30.4  1.3  7.42  2.36  409.32  starved in the dark(28),spent by the dungeon itself(21),undone by a trap(19)
Cutthroat  240  0  3.75  3.0  6.0  27.9  1.3  8.22  2.39  411.75  starved in the dark(20),cut down by a Poltergeist(17),spent by the dungeon itself(15)
Woodsman  240  0  3.73  4.0  5.0  30.8  0.4  6.27  2.43  387.09  starved in the dark(26),cut down by a Werebeast(25),undone by a trap(19)
Master of Arms  240  0  3.67  4.0  5.0  27.1  0.4  10.07  2.54  381.38  cut down by a Poltergeist(26),starved in the dark(22),cut down by a Werebeast(17)
Guard  240  0  3.65  3.0  6.0  24.6  0.4  8.15  2.49  379.27  starved in the dark(20),cut down by a Werebeast(19),cut down by a Poltergeist(18)
Pickpocket  240  0  3.64  3.0  6.0  30.8  0.4  7.28  2.32  383.61  starved in the dark(30),cut down by a Poltergeist(18),undone by a trap(16)
Bard  240  0  3.64  3.0  5.0  24.2  0.4  6.74  2.39  373.70  cut down by a Poltergeist(32),starved in the dark(25),cut down by a Google(13)
Soldier  240  0  3.50  3.0  5.0  23.8  0.0  7.40  2.34  356.34  cut down by a Gremlin(24),starved in the dark(17),cut down by a Werebeast(14)
Warlock  240  0  3.49  3.0  6.0  25.0  0.4  7.83  2.36  359.76  cut down by a Werebeast(20),cut down by a Gremlin(17),fell off a wall(17)
Summoner  240  0  3.37  3.0  5.0  21.3  0.8  8.19  2.30  361.13  starved in the dark(24),undone by a trap(19),cut down by a Poltergeist(17)
Cleric  240  0  3.27  3.0  5.0  20.8  0.0  7.43  2.21  334.85  cut down by a Poltergeist(22),starved in the dark(21),fell off a wall(19)
Court Mage  240  0  3.23  3.0  5.0  20.0  0.0  7.66  2.19  336.82  cut down by a Poltergeist(19),starved in the dark(15),cut down by a Ned(14)
Samurai  200  0  3.19  3.0  5.0  13.0  0.0  8.59  2.20  324.82  cut down by a Google(14),cut down by a Poltergeist(14),cut down by a Werebeast(14)
Wizard  240  0  3.04  3.0  5.0  15.8  0.0  6.07  2.05  313.46  cut down by a Gremlin(22),fell off a wall(19),starved in the dark(17)
Illusionist  240  0  2.97  3.0  5.0  15.8  0.8  6.32  2.05  319.25  cut down by a Gremlin(17),cut down by a Ned(17),cut down by a Philly(17)
Apprentice  240  0  2.94  3.0  5.0  12.9  0.0  5.16  2.15  293.23  cut down by a Gremlin(20),starved in the dark(18),fell off a wall(17)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  960  0  4.70  5.0  7.0  52.2  1.5  6.95  2.76  505.87  cut down by a Werebeast(76),cut down by a Poltergeist(67),undone by a trap(59)
Troll  960  0  3.88  4.0  6.0  30.7  0.5  9.38  2.61  410.90  starved in the dark(254),undone by a trap(56),spent by the dungeon itself(53)
Human  960  0  3.74  4.0  6.0  30.4  1.3  9.16  2.52  394.89  cut down by a Poltergeist(77),cut down by a Werebeast(65),undone by a trap(52)
Fridgian  920  0  3.65  4.0  5.0  27.9  0.2  8.66  2.47  380.34  cut down by a Werebeast(93),cut down by a Poltergeist(65),undone by a trap(62)
Dwarven  960  0  3.39  3.0  6.0  23.5  0.8  7.54  2.29  350.27  cut down by a Gremlin(78),undone by a trap(62),cut down by a Werebeast(61)
Elven  960  0  3.13  3.0  5.0  18.5  0.1  6.93  2.19  314.19  cut down by a Poltergeist(86),undone by a trap(79),cut down by a Gremlin(75)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
5720  0  3.75  4.0  6.0  30.6  0.7  0.1  8.10  2.47  392.83  starved in the dark(469),cut down by a Poltergeist(404),cut down by a Werebeast(396)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 5720 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1
elapsed: 852.8s  workers=4  runs=5720
EXIT=0
```

### v1.5 BEFORE transcript — tune-classes --seeds 10 --workers 4 --max-actions 5000 --start-depth 20

```
tune-classes: 143 cells x 10 seeds (1430 runs) — start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1  Thief  Ninja  Troll  10  0  23.50  22.0  30.0  100.0  100.0  9.00  5.00  490.80  3.50  2.0  11.40  cut down by a Djinni(2),cut down by a Drake(1),cut down by a Dread Lock(1)
2  Thief  Cat Burglar  Wilmsry  10  0  22.20  22.0  25.0  100.0  100.0  3.70  5.00  361.60  2.20  2.0  7.00  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Djinni(2)
3  Thief  Acrobat  Wilmsry  10  0  22.10  22.0  25.0  100.0  100.0  3.90  5.00  303.90  2.10  2.0  7.80  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
4  Fighter  Woodsman  Wilmsry  10  0  22.10  22.0  27.0  100.0  100.0  2.60  5.00  257.80  2.10  2.0  6.20  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Djinni(1)
5  Thief  Acrobat  Troll  10  0  21.90  22.0  23.0  100.0  100.0  5.40  5.00  281.70  1.90  2.0  6.30  cut down by a Drarl(3),starved in the dark(2),cut down by a Dread Lock(1)
6  Thief  Con Artist  Wilmsry  10  0  21.90  22.0  24.0  100.0  100.0  1.10  5.00  274.20  1.90  2.0  5.40  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Stalka Beast(1)
7  Fighter  Barbarian  Wilmsry  10  0  21.80  22.0  24.0  100.0  100.0  2.50  5.00  243.20  1.80  2.0  5.60  cut down by a Herman(4),cut down by a Vampire(4),cut down by a Djinni(1)
8  Thief  Pickpocket  Wilmsry  10  0  21.70  22.0  24.0  100.0  100.0  1.90  5.00  246.50  1.70  2.0  4.60  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Vampire(2)
9  Thief  Cat Burglar  Troll  10  0  21.70  21.0  23.0  100.0  100.0  4.40  5.00  275.40  1.70  1.0  5.00  cut down by a Herman(2),starved in the dark(2),came up short on a leap(1)
10  Thief  Cloaker  Wilmsry  10  0  21.70  21.0  28.0  100.0  100.0  1.10  5.00  257.20  1.70  1.0  4.90  cut down by a Djinni(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
11  Thief  Acrobat  Human  10  0  21.50  22.0  24.0  100.0  100.0  4.00  5.00  207.30  1.50  2.0  4.00  cut down by a Herman(5),cut down by a Drarl(2),cut down by a Stalka Beast(1)
12  Magic User  Illusionist  Wilmsry  10  0  21.50  21.0  25.0  100.0  100.0  2.60  5.00  248.10  1.50  1.0  4.40  cut down by a Drarl(2),cut down by a Stalka Beast(2),cut down by a Djinni(1)
13  Fighter  Guard  Wilmsry  10  0  21.40  22.0  23.0  100.0  100.0  2.50  5.00  221.60  1.40  2.0  5.20  cut down by a Herman(5),cut down by a Vampire(2),cut down by a Djinni(1)
14  Thief  Cutthroat  Wilmsry  10  0  21.40  21.0  24.0  100.0  100.0  0.90  5.00  204.30  1.40  1.0  3.60  cut down by a Herman(4),cut down by a Djinni(3),cut down by a Drarl(1)
15  Magic User  Sorcerer  Human  10  0  21.40  21.0  26.0  100.0  100.0  5.00  5.00  206.30  1.40  1.0  4.40  cut down by a Herman(2),cut down by a Stalka Beast(2),came up short on a leap(1)
16  Thief  Acrobat  Dwarven  10  0  21.30  21.0  23.0  100.0  100.0  3.50  5.00  195.90  1.30  1.0  4.20  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Stalka Beast(2)
17  Thief  Pilfer  Wilmsry  10  0  21.30  21.0  24.0  100.0  100.0  1.60  5.00  186.90  1.30  1.0  4.20  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Stalka Beast(2)
18  Fighter  Woodsman  Fridgian  10  0  21.30  21.0  23.0  100.0  100.0  2.40  5.00  173.20  1.30  1.0  4.30  cut down by a Drarl(2),cut down by a Spectre(2),cut down by a Stalka Beast(2)
19  Thief  Cutthroat  Human  10  0  21.20  22.0  23.0  100.0  100.0  2.70  5.00  155.20  1.20  2.0  3.10  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Drarl(2)
20  Fighter  Barbarian  Troll  10  0  21.20  21.0  24.0  100.0  100.0  4.20  5.00  184.90  1.20  1.0  3.80  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Vampire(2)
21  Magic User  Cleric  Troll  10  0  21.20  21.0  25.0  100.0  100.0  2.80  5.00  225.80  1.20  1.0  4.50  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Djinni(2)
22  Thief  Cloaker  Troll  10  0  21.20  21.0  24.0  100.0  100.0  2.80  5.00  206.70  1.20  1.0  4.10  cut down by a Drarl(2),starved in the dark(2),cut down by a Craig(1)
23  Fighter  Master of Arms  Troll  10  0  21.20  21.0  23.0  100.0  100.0  4.60  5.00  188.20  1.20  1.0  4.60  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Dread Lock(1)
24  Thief  Ninja  Dwarven  10  0  21.20  21.0  24.0  100.0  100.0  5.00  5.00  187.80  1.20  1.0  4.20  cut down by a Drarl(3),cut down by a Spectre(2),cut down by a Djinni(1)
25  Fighter  Samurai  Wilmsry  10  0  21.20  21.0  23.0  100.0  100.0  2.40  5.00  199.60  1.20  1.0  3.70  cut down by a Vampire(4),cut down by a Drake(2),cut down by a Drarl(1)
26  Magic User  Sorcerer  Dwarven  10  0  21.20  21.0  26.0  100.0  100.0  4.80  5.00  184.20  1.20  1.0  4.10  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Djinni(1)
27  Thief  Cutthroat  Dwarven  10  0  21.10  21.0  24.0  100.0  100.0  2.70  5.00  151.60  1.10  1.0  3.20  cut down by a Herman(4),cut down by a Stalka Beast(2),cut down by a Djinni(1)
28  Fighter  Knight  Wilmsry  10  0  21.10  21.0  23.0  100.0  100.0  1.80  5.00  197.20  1.10  1.0  4.30  cut down by a Herman(4),cut down by a Djinni(3),cut down by a Vampire(2)
29  Fighter  Master of Arms  Wilmsry  10  0  21.10  21.0  23.0  100.0  100.0  3.30  5.00  171.30  1.10  1.0  3.10  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
30  Thief  Ninja  Human  10  0  21.10  21.0  24.0  100.0  100.0  4.10  5.00  177.00  1.10  1.0  3.70  cut down by a Drarl(3),cut down by a Spectre(2),cut down by a Stalka Beast(2)
31  Thief  Ninja  Wilmsry  10  0  21.10  21.0  24.0  100.0  100.0  3.90  5.00  176.60  1.10  1.0  3.30  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Spectre(2)
32  Thief  Pilfer  Dwarven  10  0  21.10  21.0  25.0  100.0  100.0  2.40  5.00  194.90  1.10  1.0  3.70  cut down by a Herman(4),cut down by a Vampire(2),cut down by a Djinni(1)
33  Fighter  Soldier  Wilmsry  10  0  21.10  21.0  23.0  100.0  100.0  1.80  5.00  197.20  1.10  1.0  4.30  cut down by a Herman(4),cut down by a Djinni(3),cut down by a Vampire(2)
34  Magic User  Summoner  Dwarven  10  0  21.10  21.0  24.0  100.0  100.0  5.20  5.00  193.80  1.10  1.0  3.60  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Vampire(2)
35  Magic User  Summoner  Wilmsry  10  0  21.10  21.0  23.0  100.0  100.0  2.50  5.00  173.30  1.10  1.0  3.60  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Herman(2)
36  Magic User  Warlock  Human  10  0  21.10  21.0  24.0  100.0  100.0  3.10  5.00  183.20  1.10  1.0  2.70  cut down by a Drarl(5),cut down by a Djinni(2),cut down by a Dread Lock(1)
37  Magic User  Sorcerer  Troll  10  0  21.00  22.0  22.0  100.0  100.0  4.60  5.00  175.40  1.00  2.0  3.10  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Vampire(2)
38  Magic User  Apprentice  Troll  10  0  21.00  21.0  23.0  100.0  100.0  3.40  5.00  183.50  1.00  1.0  4.00  cut down by a Drarl(3),cut down by a Dread Lock(3),cut down by a Herman(2)
39  Thief  Cat Burglar  Dwarven  10  0  21.00  21.0  24.0  100.0  100.0  2.70  5.00  155.10  1.00  1.0  2.80  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Vampire(2)
40  Thief  Cat Burglar  Elven  10  0  21.00  21.0  23.0  100.0  100.0  2.10  5.00  190.50  1.00  1.0  2.70  cut down by a Stalka Beast(3),cut down by a Djinni(2),cut down by a Drarl(1)
41  Thief  Cat Burglar  Fridgian  10  0  21.00  21.0  25.0  100.0  100.0  1.70  5.00  146.30  1.00  1.0  2.80  cut down by a Herman(3),cut down by a Craig(1),cut down by a Djinni(1)
42  Thief  Cat Burglar  Human  10  0  21.00  21.0  24.0  100.0  100.0  2.70  5.00  155.00  1.00  1.0  2.80  cut down by a Herman(5),cut down by a Drarl(2),cut down by a Vampire(2)
43  Thief  Con Artist  Dwarven  10  0  21.00  21.0  23.0  100.0  100.0  0.20  5.00  139.70  1.00  1.0  2.10  cut down by a Herman(4),undone by a trap(2),cut down by a Djinni(1)
44  Thief  Con Artist  Human  10  0  21.00  21.0  23.0  100.0  100.0  0.20  5.00  139.70  1.00  1.0  2.10  cut down by a Herman(4),undone by a trap(2),cut down by a Djinni(1)
45  Thief  Con Artist  Troll  10  0  21.00  21.0  22.0  100.0  100.0  0.50  5.00  159.40  1.00  1.0  2.80  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Drarl(1)
46  Magic User  Summoner  Human  10  0  21.00  21.0  23.0  100.0  100.0  5.00  5.00  181.90  1.00  1.0  3.50  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Vampire(2)
47  Magic User  Warlock  Dwarven  10  0  21.00  21.0  24.0  100.0  100.0  2.80  5.00  172.60  1.00  1.0  2.30  cut down by a Drarl(6),cut down by a Djinni(1),cut down by a Dread Lock(1)
48  Thief  Cutthroat  Elven  10  0  21.00  20.0  24.0  100.0  100.0  2.40  5.00  183.40  1.00  0.0  4.20  cut down by a Djinni(3),cut down by a Vampire(3),cut down by a Drarl(1)
49  Thief  Pilfer  Fridgian  10  0  21.00  20.0  24.0  100.0  100.0  2.90  5.00  153.20  1.00  0.0  3.20  cut down by a Herman(3),cut down by a Vampire(3),came up short on a leap(1)
50  Thief  Pilfer  Human  10  0  21.00  20.0  25.0  100.0  100.0  1.80  5.00  172.50  1.00  0.0  3.20  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Herman(2)
51  Fighter  Bard  Wilmsry  10  0  20.90  21.0  23.0  100.0  100.0  1.90  5.00  136.00  0.90  1.0  2.90  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Vampire(2)
52  Thief  Cloaker  Human  10  0  20.90  21.0  23.0  100.0  100.0  1.70  5.00  127.10  0.90  1.0  2.20  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Dread Lock(2)
53  Thief  Con Artist  Fridgian  10  0  20.90  21.0  22.0  100.0  100.0  0.50  5.00  156.60  0.90  1.0  2.30  cut down by a Drarl(4),cut down by a Herman(3),came up short on a leap(1)
54  Thief  Ninja  Elven  10  0  20.90  21.0  23.0  100.0  100.0  3.40  5.00  147.90  0.90  1.0  2.40  cut down by a Stalka Beast(3),cut down by a Herman(2),cut down by a Craig(1)
55  Thief  Cloaker  Dwarven  10  0  20.80  21.0  23.0  100.0  100.0  2.30  5.00  136.70  0.80  1.0  2.70  cut down by a Herman(4),cut down by a Djinni(2),cut down by a Craig(1)
56  Magic User  Court Mage  Troll  10  0  20.80  21.0  23.0  100.0  100.0  2.40  5.00  140.00  0.80  1.0  2.60  cut down by a Bones(2),cut down by a Djinni(2),cut down by a Herman(2)
57  Thief  Cutthroat  Troll  10  0  20.80  21.0  23.0  100.0  100.0  2.60  5.00  158.80  0.80  1.0  3.60  cut down by a Craig(2),cut down by a Djinni(2),cut down by a Drarl(1)
58  Fighter  Master of Arms  Dwarven  10  0  20.80  21.0  22.0  100.0  100.0  2.70  5.00  126.40  0.80  1.0  2.50  cut down by a Herman(3),cut down by a Stalka Beast(3),cut down by a Djinni(1)
59  Magic User  Warlock  Troll  10  0  20.80  21.0  23.0  100.0  100.0  2.70  5.00  169.40  0.80  1.0  3.90  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
60  Magic User  Wizard  Wilmsry  10  0  20.80  21.0  22.0  100.0  100.0  1.30  5.00  140.00  0.80  1.0  2.30  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Dread Lock(2)
61  Fighter  Woodsman  Human  10  0  20.80  21.0  22.0  100.0  100.0  1.70  5.00  127.30  0.80  1.0  2.70  cut down by a Herman(5),cut down by a Djinni(2),cut down by a Drudge(1)
62  Fighter  Woodsman  Elven  10  0  20.80  20.0  23.0  100.0  100.0  0.90  5.00  115.60  0.80  0.0  2.10  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Dread Lock(1)
63  Fighter  Woodsman  Troll  10  0  20.80  20.0  24.0  100.0  100.0  2.90  5.00  169.10  0.80  0.0  4.60  cut down by a Herman(4),starved in the dark(2),cut down by a Djinni(1)
64  Fighter  Bard  Dwarven  10  0  20.70  21.0  22.0  100.0  100.0  1.80  5.00  100.60  0.70  1.0  2.00  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Ghost(2)
65  Thief  Con Artist  Elven  10  0  20.70  21.0  22.0  100.0  100.0  0.30  5.00  133.00  0.70  1.0  1.90  cut down by a Herman(2),cut down by a Vampire(2),cut down by a Djinni(1)
66  Thief  Cutthroat  Fridgian  10  0  20.70  21.0  23.0  100.0  100.0  1.80  5.00  115.30  0.70  1.0  2.30  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Djinni(1)
67  Fighter  Guard  Fridgian  10  0  20.70  21.0  22.0  100.0  100.0  1.80  5.00  135.30  0.70  1.0  2.80  cut down by a Drarl(2),cut down by a Craig(1),cut down by a Djinni(1)
68  Thief  Pickpocket  Troll  10  0  20.70  21.0  22.0  100.0  100.0  2.30  5.00  133.90  0.70  1.0  2.80  cut down by a Stalka Beast(3),cut down by a Herman(2),starved in the dark(2)
69  Fighter  Woodsman  Dwarven  10  0  20.70  21.0  22.0  100.0  100.0  1.90  5.00  126.30  0.70  1.0  2.90  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Djinni(1)
70  Thief  Acrobat  Fridgian  10  0  20.70  20.0  24.0  100.0  100.0  1.80  5.00  126.20  0.70  0.0  3.00  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Drarl(1)
71  Magic User  Apprentice  Wilmsry  10  0  20.70  20.0  23.0  100.0  100.0  1.60  5.00  126.50  0.70  0.0  2.30  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Vampire(2)
72  Magic User  Cleric  Wilmsry  10  0  20.70  20.0  22.0  100.0  100.0  1.80  5.00  151.50  0.70  0.0  4.30  cut down by a Drarl(3),cut down by a Herman(3),came up short on a leap(1)
73  Thief  Cloaker  Elven  10  0  20.70  20.0  22.0  100.0  100.0  1.90  5.00  143.30  0.70  0.0  3.00  cut down by a Djinni(4),cut down by a Stalka Beast(2),cut down by a Drarl(1)
74  Fighter  Guard  Dwarven  10  0  20.70  20.0  22.0  100.0  100.0  2.50  5.00  135.00  0.70  0.0  2.80  cut down by a Stalka Beast(3),cut down by a Herman(2),cut down by a Vampire(2)
75  Magic User  Wizard  Dwarven  10  0  20.70  20.0  24.0  100.0  100.0  3.10  5.00  149.80  0.70  0.0  3.00  cut down by a Stalka Beast(5),cut down by a Herman(2),cut down by a Craig(1)
76  Magic User  Wizard  Human  10  0  20.70  20.0  24.0  100.0  100.0  3.10  5.00  149.80  0.70  0.0  3.00  cut down by a Stalka Beast(5),cut down by a Herman(2),cut down by a Craig(1)
77  Fighter  Barbarian  Fridgian  10  0  20.60  21.0  22.0  100.0  100.0  1.70  5.00  99.90  0.60  1.0  2.10  cut down by a Drarl(3),cut down by a Ghost(2),cut down by a Vampire(2)
78  Fighter  Guard  Troll  10  0  20.60  21.0  22.0  100.0  100.0  3.10  5.00  132.90  0.60  1.0  3.20  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Craig(1)
79  Magic User  Illusionist  Dwarven  10  0  20.60  21.0  22.0  100.0  100.0  3.50  5.00  178.80  0.60  1.0  3.50  cut down by a Drarl(2),cut down by a Craig(1),cut down by a Djinni(1)
80  Magic User  Illusionist  Human  10  0  20.60  21.0  22.0  100.0  100.0  3.40  5.00  172.10  0.60  1.0  3.30  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Craig(1)
81  Fighter  Knight  Fridgian  10  0  20.60  21.0  22.0  100.0  100.0  1.60  5.00  116.50  0.60  1.0  2.30  cut down by a Drarl(3),cut down by a Djinni(1),cut down by a Dread Lock(1)
82  Fighter  Samurai  Dwarven  10  0  20.60  21.0  22.0  100.0  100.0  2.20  5.00  113.90  0.60  1.0  1.40  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Herman(2)
83  Fighter  Soldier  Fridgian  10  0  20.60  21.0  22.0  100.0  100.0  1.60  5.00  116.50  0.60  1.0  2.30  cut down by a Drarl(3),cut down by a Djinni(1),cut down by a Dread Lock(1)
84  Magic User  Sorcerer  Wilmsry  10  0  20.60  21.0  22.0  100.0  100.0  1.50  5.00  126.90  0.60  1.0  2.30  cut down by a Herman(2),cut down by a Vampire(2),cut down by a Drake(1)
85  Thief  Acrobat  Elven  10  0  20.60  20.0  22.0  100.0  100.0  1.90  5.00  131.20  0.60  0.0  2.20  cut down by a Vampire(4),cut down by a Djinni(2),cut down by a Bones(1)
86  Fighter  Barbarian  Dwarven  10  0  20.60  20.0  22.0  100.0  100.0  2.00  5.00  90.20  0.60  0.0  1.50  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Vampire(2)
87  Magic User  Cleric  Dwarven  10  0  20.60  20.0  22.0  100.0  100.0  2.00  5.00  124.90  0.60  0.0  2.30  cut down by a Vampire(4),cut down by a Herman(2),cut down by a Djinni(1)
88  Thief  Cloaker  Fridgian  10  0  20.60  20.0  23.0  100.0  100.0  1.80  5.00  132.60  0.60  0.0  2.40  cut down by a Drarl(4),cut down by a Herman(3),cut down by a Dread Lock(2)
89  Fighter  Guard  Human  10  0  20.60  20.0  23.0  100.0  100.0  2.70  5.00  140.40  0.60  0.0  3.40  cut down by a Herman(5),cut down by a Stalka Beast(2),cut down by a Djinni(1)
90  Thief  Ninja  Fridgian  10  0  20.60  20.0  22.0  100.0  100.0  2.40  5.00  121.40  0.60  0.0  2.50  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Vampire(2)
91  Thief  Pilfer  Elven  10  0  20.60  20.0  22.0  100.0  100.0  1.80  5.00  114.80  0.60  0.0  2.10  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Drarl(2)
92  Magic User  Warlock  Fridgian  10  0  20.60  20.0  24.0  100.0  100.0  2.20  5.00  142.60  0.60  0.0  2.40  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Drake(1)
93  Fighter  Master of Arms  Fridgian  10  0  20.50  21.0  21.0  100.0  100.0  1.70  5.00  101.70  0.50  1.0  2.10  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Craig(1)
94  Magic User  Warlock  Wilmsry  10  0  20.50  21.0  21.0  100.0  100.0  1.60  5.00  126.80  0.50  1.0  1.70  cut down by a Drarl(4),cut down by a Undead(2),cut down by a Djinni(1)
95  Fighter  Barbarian  Elven  10  0  20.50  20.0  22.0  100.0  100.0  1.60  5.00  89.40  0.50  0.0  1.70  cut down by a Drarl(2),cut down by a Vampire(2),cut down by a Djinni(1)
96  Fighter  Barbarian  Human  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  89.10  0.50  0.0  1.20  cut down by a Vampire(4),cut down by a Herman(3),cut down by a Drake(1)
97  Magic User  Cleric  Human  10  0  20.50  20.0  22.0  100.0  100.0  2.00  5.00  121.00  0.50  0.0  2.50  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(2)
98  Fighter  Guard  Elven  10  0  20.50  20.0  22.0  100.0  100.0  1.80  5.00  102.50  0.50  0.0  1.90  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Dread Lock(2)
99  Magic User  Illusionist  Troll  10  0  20.50  20.0  22.0  100.0  100.0  1.70  5.00  156.70  0.50  0.0  2.00  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Drake(1)
100  Fighter  Knight  Troll  10  0  20.50  20.0  22.0  100.0  100.0  3.20  5.00  116.80  0.50  0.0  2.40  cut down by a Djinni(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
101  Fighter  Master of Arms  Human  10  0  20.50  20.0  22.0  100.0  100.0  1.80  5.00  89.50  0.50  0.0  1.80  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(2)
102  Thief  Pickpocket  Fridgian  10  0  20.50  20.0  23.0  100.0  100.0  1.30  5.00  100.40  0.50  0.0  1.40  cut down by a Herman(6),cut down by a Vampire(2),cut down by a Craig(1)
103  Fighter  Soldier  Troll  10  0  20.50  20.0  22.0  100.0  100.0  3.20  5.00  116.80  0.50  0.0  2.40  cut down by a Djinni(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
104  Magic User  Summoner  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  104.40  0.50  0.0  1.10  cut down by a Djinni(3),cut down by a Ghost(2),cut down by a Herman(2)
105  Magic User  Summoner  Troll  10  0  20.50  20.0  22.0  100.0  100.0  2.20  5.00  120.80  0.50  0.0  2.10  cut down by a Herman(6),cut down by a Dread Lock(1),cut down by a Spectre(1)
106  Magic User  Wizard  Troll  10  0  20.50  20.0  22.0  100.0  100.0  3.00  5.00  137.10  0.50  0.0  2.10  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Stalka Beast(2)
107  Magic User  Apprentice  Fridgian  10  0  20.40  20.0  22.0  100.0  100.0  0.80  5.00  58.80  0.40  0.0  0.90  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Drarl(2)
108  Fighter  Bard  Human  10  0  20.40  20.0  21.0  100.0  100.0  1.70  5.00  87.20  0.40  0.0  1.90  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
109  Fighter  Bard  Troll  10  0  20.40  20.0  21.0  100.0  100.0  1.70  5.00  89.70  0.40  0.0  1.90  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Djinni(1)
110  Thief  Pilfer  Troll  10  0  20.40  20.0  22.0  100.0  100.0  1.80  5.00  107.60  0.40  0.0  2.10  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Craig(1)
111  Magic User  Sorcerer  Elven  10  0  20.40  20.0  23.0  100.0  100.0  2.70  5.00  94.10  0.40  0.0  1.80  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Stalka Beast(2)
112  Magic User  Warlock  Elven  10  0  20.40  20.0  21.0  100.0  100.0  1.50  5.00  94.20  0.40  0.0  1.30  cut down by a Drake(2),cut down by a Drarl(2),cut down by a Herman(2)
113  Fighter  Bard  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  0.80  5.00  54.60  0.30  0.0  1.90  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Vampire(2)
114  Magic User  Court Mage  Elven  10  0  20.30  20.0  23.0  100.0  100.0  1.60  5.00  92.40  0.30  0.0  1.70  cut down by a Drarl(3),cut down by a Vampire(2),cut down by a Bones(1)
115  Magic User  Court Mage  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  2.00  5.00  98.90  0.30  0.0  2.30  cut down by a Drarl(2),cut down by a Vampire(2),cut down by a Bones(1)
116  Magic User  Illusionist  Elven  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  86.70  0.30  0.0  1.00  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Drarl(1)
117  Magic User  Illusionist  Fridgian  10  0  20.30  20.0  22.0  100.0  100.0  1.20  5.00  92.60  0.30  0.0  0.90  cut down by a Djinni(3),cut down by a Drarl(3),cut down by a Vampire(2)
118  Fighter  Knight  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  0.80  5.00  86.40  0.30  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
119  Fighter  Knight  Elven  10  0  20.30  20.0  22.0  100.0  100.0  0.70  5.00  67.10  0.30  0.0  1.20  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Vampire(2)
120  Fighter  Knight  Human  10  0  20.30  20.0  22.0  100.0  100.0  0.50  5.00  83.80  0.30  0.0  1.00  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
121  Fighter  Master of Arms  Elven  10  0  20.30  20.0  22.0  100.0  100.0  1.00  5.00  56.50  0.30  0.0  0.70  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Stalka Beast(2)
122  Thief  Pickpocket  Dwarven  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  83.60  0.30  0.0  1.40  cut down by a Herman(6),cut down by a Vampire(2),cut down by a Drarl(1)
123  Thief  Pickpocket  Human  10  0  20.30  20.0  21.0  100.0  100.0  1.30  5.00  86.10  0.30  0.0  1.50  cut down by a Herman(4),cut down by a Drake(1),cut down by a Drarl(1)
124  Fighter  Samurai  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.30  5.00  73.80  0.30  0.0  1.00  cut down by a Dread Lock(2),cut down by a Drudge(2),cut down by a Stalka Beast(2)
125  Fighter  Soldier  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  0.80  5.00  86.40  0.30  0.0  1.20  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Stalka Beast(2)
126  Fighter  Soldier  Elven  10  0  20.30  20.0  22.0  100.0  100.0  0.70  5.00  67.10  0.30  0.0  1.20  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Vampire(2)
127  Fighter  Soldier  Human  10  0  20.30  20.0  22.0  100.0  100.0  0.50  5.00  83.80  0.30  0.0  1.00  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
128  Magic User  Summoner  Elven  10  0  20.30  20.0  21.0  100.0  100.0  1.60  5.00  80.30  0.30  0.0  0.90  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Dread Lock(1)
129  Magic User  Apprentice  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  1.60  5.00  68.40  0.20  0.0  1.20  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Dread Lock(2)
130  Magic User  Apprentice  Human  10  0  20.20  20.0  21.0  100.0  100.0  1.60  5.00  68.40  0.20  0.0  1.20  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Dread Lock(2)
131  Magic User  Cleric  Fridgian  10  0  20.20  20.0  22.0  100.0  100.0  0.60  5.00  65.50  0.20  0.0  0.90  cut down by a Drarl(3),cut down by a Djinni(1),cut down by a Drake(1)
132  Magic User  Court Mage  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  2.10  5.00  97.90  0.20  0.0  2.10  cut down by a Vampire(3),cut down by a Djinni(2),came up short on a leap(1)
133  Magic User  Court Mage  Human  10  0  20.20  20.0  21.0  100.0  100.0  2.10  5.00  96.00  0.20  0.0  2.00  cut down by a Vampire(3),came up short on a leap(1),cut down by a Bones(1)
134  Thief  Pickpocket  Elven  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  91.90  0.20  0.0  1.40  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Craig(1)
135  Fighter  Samurai  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.10  5.00  67.10  0.20  0.0  0.70  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Stalka Beast(2)
136  Fighter  Samurai  Troll  10  0  20.20  20.0  21.0  100.0  100.0  1.80  5.00  79.90  0.20  0.0  1.10  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Stalka Beast(2)
137  Magic User  Sorcerer  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  2.10  5.00  82.10  0.20  0.0  1.90  cut down by a Drarl(2),cut down by a Stink Bug(2),cut down by a Craig(1)
138  Magic User  Wizard  Fridgian  10  0  20.20  20.0  21.0  100.0  100.0  1.60  5.00  99.90  0.20  0.0  1.80  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Drarl(2)
139  Magic User  Apprentice  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.70  5.00  43.80  0.10  0.0  0.80  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Djinni(1)
140  Fighter  Bard  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.00  5.00  59.80  0.10  0.0  1.10  cut down by a Drarl(2),cut down by a Drudge(2),cut down by a Stalka Beast(2)
141  Magic User  Cleric  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  72.20  0.10  0.0  1.30  cut down by a Dread Lock(2),cut down by a Vampire(2),cut down by a Djinni(1)
142  Magic User  Court Mage  Wilmsry  10  0  20.10  20.0  21.0  100.0  100.0  1.10  5.00  72.40  0.10  0.0  1.60  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Vampire(2)
143  Magic User  Wizard  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.60  5.00  56.80  0.10  0.0  0.50  cut down by a Djinni(3),cut down by a Herman(2),cut down by a Stalka Beast(2)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Thief  480  0  21.09  21.0  23.0  100.0  100.0  2.38  5.00  176.64  1.09  1.0  3.45  cut down by a Herman(121),cut down by a Drarl(74),cut down by a Vampire(61)
Fighter  470  0  20.68  20.0  22.0  100.0  100.0  1.92  5.00  122.66  0.68  0.0  2.49  cut down by a Herman(98),cut down by a Vampire(81),cut down by a Drarl(76)
Magic User  480  0  20.59  20.0  22.0  100.0  100.0  2.29  5.00  128.93  0.59  0.0  2.35  cut down by a Drarl(99),cut down by a Herman(85),cut down by a Vampire(62)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Ninja  60  0  21.40  21.0  24.0  100.0  100.0  4.63  5.00  216.92  1.40  1.0  4.58  cut down by a Drarl(12),cut down by a Herman(9),cut down by a Stalka Beast(9)
Acrobat  60  0  21.35  21.0  23.0  100.0  100.0  3.42  5.00  207.70  1.35  1.0  4.58  cut down by a Herman(14),cut down by a Drarl(11),cut down by a Stalka Beast(9)
Cat Burglar  60  0  21.32  21.0  23.0  100.0  100.0  2.88  5.00  213.98  1.32  1.0  3.85  cut down by a Herman(16),cut down by a Vampire(10),cut down by a Drarl(9)
Con Artist  60  0  21.08  21.0  23.0  100.0  100.0  0.47  5.00  167.10  1.08  1.0  2.77  cut down by a Herman(17),cut down by a Djinni(9),cut down by a Drarl(9)
Woodsman  60  0  21.08  21.0  23.0  100.0  100.0  2.07  5.00  161.55  1.08  1.0  3.80  cut down by a Herman(18),cut down by a Djinni(8),cut down by a Drarl(8)
Cutthroat  60  0  21.03  21.0  23.0  100.0  100.0  2.18  5.00  161.43  1.03  1.0  3.33  cut down by a Herman(16),cut down by a Djinni(12),cut down by a Drarl(9)
Cloaker  60  0  20.98  21.0  23.0  100.0  100.0  1.93  5.00  167.27  0.98  1.0  3.22  cut down by a Herman(14),cut down by a Djinni(13),cut down by a Drarl(8)
Pilfer  60  0  20.90  20.0  23.0  100.0  100.0  2.05  5.00  154.98  0.90  0.0  3.08  cut down by a Vampire(13),cut down by a Herman(12),cut down by a Djinni(11)
Barbarian  60  0  20.87  20.0  23.0  100.0  100.0  2.22  5.00  132.78  0.87  0.0  2.65  cut down by a Vampire(16),cut down by a Herman(13),cut down by a Drarl(10)
Sorcerer  60  0  20.80  20.0  22.0  100.0  100.0  3.45  5.00  144.83  0.80  0.0  2.93  cut down by a Drarl(11),cut down by a Herman(11),cut down by a Stalka Beast(8)
Summoner  60  0  20.75  21.0  22.0  100.0  100.0  2.97  5.00  142.42  0.75  1.0  2.47  cut down by a Herman(18),cut down by a Drarl(10),cut down by a Djinni(9)
Guard  60  0  20.75  20.0  22.0  100.0  100.0  2.40  5.00  144.62  0.75  0.0  3.22  cut down by a Herman(16),cut down by a Vampire(8),cut down by a Djinni(7)
Master of Arms  60  0  20.73  20.0  22.0  100.0  100.0  2.52  5.00  122.27  0.73  0.0  2.47  cut down by a Herman(14),cut down by a Vampire(10),cut down by a Stalka Beast(8)
Warlock  60  0  20.73  20.0  22.0  100.0  100.0  2.32  5.00  148.13  0.73  0.0  2.38  cut down by a Drarl(21),cut down by a Herman(9),cut down by a Djinni(6)
Illusionist  60  0  20.63  20.0  22.0  100.0  100.0  2.28  5.00  155.83  0.63  0.0  2.52  cut down by a Drarl(12),cut down by a Djinni(8),cut down by a Dread Lock(7)
Pickpocket  60  0  20.62  20.0  22.0  100.0  100.0  1.50  5.00  123.73  0.62  0.0  2.18  cut down by a Herman(23),cut down by a Vampire(9),cut down by a Drarl(6)
Cleric  60  0  20.55  20.0  22.0  100.0  100.0  1.72  5.00  126.82  0.55  0.0  2.63  cut down by a Herman(13),cut down by a Drarl(12),cut down by a Vampire(10)
Knight  60  0  20.52  20.0  22.0  100.0  100.0  1.43  5.00  111.30  0.52  0.0  2.07  cut down by a Herman(12),cut down by a Djinni(10),cut down by a Drarl(10)
Soldier  60  0  20.52  20.0  22.0  100.0  100.0  1.43  5.00  111.30  0.52  0.0  2.07  cut down by a Herman(12),cut down by a Djinni(10),cut down by a Drarl(10)
Samurai  50  0  20.50  20.0  22.0  100.0  100.0  1.76  5.00  106.86  0.50  0.0  1.58  cut down by a Vampire(10),cut down by a Drarl(9),cut down by a Stalka Beast(9)
Wizard  60  0  20.50  20.0  22.0  100.0  100.0  2.12  5.00  122.23  0.50  0.0  2.12  cut down by a Stalka Beast(16),cut down by a Herman(15),cut down by a Djinni(8)
Bard  60  0  20.47  20.0  21.0  100.0  100.0  1.48  5.00  87.98  0.47  0.0  1.95  cut down by a Drarl(15),cut down by a Vampire(9),cut down by a Djinni(8)
Apprentice  60  0  20.43  20.0  22.0  100.0  100.0  1.62  5.00  91.57  0.43  0.0  1.73  cut down by a Drarl(15),cut down by a Vampire(14),cut down by a Herman(10)
Court Mage  60  0  20.32  20.0  21.0  100.0  100.0  1.88  5.00  99.60  0.32  0.0  2.05  cut down by a Vampire(13),cut down by a Drarl(11),cut down by a Bones(6)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Wilmsry  240  0  21.25  21.0  23.0  100.0  100.0  2.12  5.00  200.03  1.25  1.0  4.11  cut down by a Herman(58),cut down by a Drarl(42),cut down by a Vampire(37)
Troll  240  0  20.95  21.0  23.0  100.0  100.0  3.18  5.00  175.05  0.95  1.0  3.60  cut down by a Herman(52),cut down by a Djinni(33),cut down by a Drarl(31)
Dwarven  240  0  20.75  20.0  22.0  100.0  100.0  2.50  5.00  136.70  0.75  0.0  2.58  cut down by a Herman(60),cut down by a Drarl(43),cut down by a Vampire(41)
Human  240  0  20.73  20.0  22.0  100.0  100.0  2.30  5.00  132.23  0.73  0.0  2.47  cut down by a Herman(65),cut down by a Vampire(39),cut down by a Drarl(36)
Fridgian  230  0  20.58  20.0  22.0  100.0  100.0  1.63  5.00  112.80  0.58  0.0  2.17  cut down by a Drarl(52),cut down by a Herman(48),cut down by a Vampire(28)
Elven  240  0  20.45  20.0  22.0  100.0  100.0  1.44  5.00  99.23  0.45  0.0  1.66  cut down by a Drarl(45),cut down by a Djinni(41),cut down by a Vampire(35)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1430  0  20.79  20.0  22.0  100.0  100.0  100.0  2.20  5.00  142.88  0.79  0.0  2.77  cut down by a Herman(304),cut down by a Drarl(249),cut down by a Vampire(204)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 1430 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20
elapsed: 116.6s  workers=4  runs=1430
EXIT=0
```

The two machine-diffable aggregates for Phase 36 are `docs/class-pass/v15-before.json`
(natural start, 143 cells x 40 seeds) and `docs/class-pass/v15-before-depth20.json`
(depth-20 slice, 143 cells x 10 seeds) — aggregates only, no per-run rows.
