---
quick_id: 260928-abl
status: complete
date: 2026-09-28
---

# Quick 260928-abl: Fighter and Thief ability audit (summary)

(The orchestrator wrote this from the executor's returned text. Commits: 5512090a (an off-by-default ablation switch and a paired readout tool) and 3b7b9e24 (the readouts). Merged in 06b8eb2f. No game rule, dial or content value was changed. The run was measured on 49829f70, which has the 79.2 dials, level² spells and once-per-fight strikes, but not the cloak fix or the hero resist change. About 105 minutes of bot time.)

## Verdict
**No Fighter or Thief active ability is overpowered enough to explain the class gap.**
- Starting HP explains most of the Fighter vs Magic User gap.
- Starting HP plus the Thief's canon +5 flee bonus explain most of the Thief vs Magic User gap.
- The whole active kit is worth about 0.3 floors to a Fighter and 0.5 to a Thief.

## Baselines (fair bot, class forced, 1,000 seeds, stuck runs excluded)
| Class | p50 | Mean depth | Reach 5 | Reach 8 | Start HP | Flee success | Die at level 1 |
|---|---|---|---|---|---|---|---|
| Fighter | 5 | 4.90 | 55.2% | 11.2% | 76 | 31% | 67% |
| Thief | 5 | 5.46 | 66.1% | 15.6% | 60 | 61.5% | 59% |
| Magic User | 3 | 3.62 | 30.0% | 2.7% | 49 | 28% | 83% |

The Fighter's reach 5 sits on the p50 4/5 line, so the audit reads mean depth and reach 5, not p50.

## Ablations (the change when one thing is removed, 95% paired-bootstrap range)
| Ablation | Seeds | Class mean depth | Class reach 5 | Owners' mean depth | Owners' reach 5 |
|---|---|---|---|---|---|
| Thief flee +5 | 200 | −0.63 [−0.86, −0.41] | **−11.9** [−18.1, −6.1] | all Thieves | |
| Thief whole kit | 200 | −0.49 | −7.8 (noise) | | |
| Fighter whole kit | 200 | −0.33 | −4.9 (noise) | | |
| Kata | 1,000 | −0.18 | −3.6 | −0.98 | −19.9 |
| Sweep | 1,000 | −0.18 | −3.3 | −0.61 | −10.8 |
| Hardiness | 1,000 | −0.11 | −2.4 | −1.07 | −22.5 |
| Samurai blade | 1,000 | −0.12 | −3.0 | −1.03 | −25.5 |
| Acrobat | 1,000 | −0.12 | −1.7 | −0.94 | −13.7 |
| Feint | 1,000 | −0.12 | −1.9 | −0.43 | −6.7 |
| Silent Step | 1,000 | −0.12 | −2.1 | −0.45 | −7.8 |

Everything else is within noise. Removing Dirty Trick, Smoke or Cutpurse slightly *helps*, probably because the bot's round-1 opener wastes a turn.

## Structure
- **Level² is not the cause.** 88–94% of combat turns happen at level 1, where level² = 1 for everyone.
- **HP is the main lever.** In a harness-only what-if:
  - a Magic User at Fighter HP goes from mean 3.57 → 4.34 and reach 5 from 32.6 → 46.7;
  - a Fighter at Magic User HP goes from reach 5 51.8 → 34.8.
  - That puts HP at about 65–75% of the Fighter vs Magic User gap.
- **The Thief's lead over the Fighter** (+0.56 mean) is almost exactly what the flee bonus is worth.
- **Plain swings rarely land at level 1.** The observed hit rate is about 17% for a Fighter, 34% for a Thief and 13% for a Magic User. That is why the "cannot miss" abilities (Kata, Feint, Silent Step, Sweep) do most of the killing, yet buy little survival. Damage taken is what ends runs.
- **Sweep hits a single foe 73% of the time**, which makes it a guaranteed half-damage strike.

## Nerf options (to the user; none implemented)
1. **Thief flee +5:** (a) +5 → +3, about −0.25 mean and −5 reach 5; or (b) the bonus applies only to the first flee of a fight. This is canon, so any change is a deliberate deviation.
2. **Sweep:** (a) refuse with fewer than 2 living foes, owners about −0.3; or (b) one normal to-hit roll, owners about −0.15.
3. **Kata (and Feint together):** (a) +3 winning faces instead of the auto-hit, owners about −0.4; or (b) keep the auto-hit at half damage, owners about −0.5.
4. **Acrobat:** (a) foes land on their top 4 faces instead of 3, owners about −0.5; or (b) make it relative, h −= 2.
5. **Leave alone:** Silent Step, Feint alone, Samurai blade, Hardiness, and everything within noise.
6. **Magic User** (fine for now, per the user): starting HP is the lever, not abilities.

## Tooling (off by default)
- `tools/lib/ablation.mjs` covers these kinds: ability, skill, sub-class, thiefBackstab, subOpener, cutthroatCrit, samuraiBlade and thiefFlee.
- `tools/lib/tuning-bot.mjs` gains a chooseAbility filter and two hooks. They do nothing unless `ablate` is set.
- `tools/ability-ablation.mjs` produces the paired bootstrap ranges, usage and share tables and the per-level table.
- `test/unit/ablation-switch.test.js` holds 9 tests.
- The readouts are `tools/readouts/260928-abl-*`.

**Gates (in the worktree):** npm test passed 7,632/7,632 and parity passed 66/66. After the merge, the tests the merge touched pass on master: 92/92 across ablation-switch, bot-tactics, cloak-crit-ward and ability-duration-rounds.
