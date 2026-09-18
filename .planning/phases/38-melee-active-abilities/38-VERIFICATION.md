---
phase: 38-melee-active-abilities
verified: 2026-09-18T05:05:00Z
status: passed
score: 5/5 success criteria verified on automated evidence; every player-facing check (submenu rows, cooldown refusal line, pool card, Joiner ability lines, Hero-tab lists, old-save resume) is deferred to the end-of-run Pixel 7 batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (ABIL-03, level-up): level a fresh Fighter or Thief once (dev start-at-depth, or a kill) — the SKILL LEVEL N rail card / fight log shows a second line reading 'New trick: {name} — {txt}'", "Pixel 7 (ABIL-05, Joiner opener): recruit a Fighter or Thief Joiner and, in a fight, watch the fight log for a '{name} calls {ability}.' line in round 1 (an opener ability, e.g. Pommel Strike/Dirty Trick/Battle Roar/Silent Step) followed by its effect line, with the companion's name correct", "Pixel 7 (ABIL-05, Joiner policy): past round 1 the Joiner uses a damage-tagged ability (e.g. Kata/Feint/Sweep) against a healthy foe, or a defensive-tagged one (e.g. Brace/Second Wind) once it has taken damage", "Pixel 7 (ABIL-05, Joiner cooldowns): a Joiner's ability is READY again at the start of the NEXT fight (cooldowns clear at endCombat), and a member Battle Roar's fight-log line reads as covering the whole party's side", "Pixel 7 (ABIL-01, submenu): open ABILITIES mid-fight as a fresh Fighter/Thief — at least one row reads READY with its effect line", "Pixel 7 (ABIL-01/02, use): use it — the fight log shows 'You call {name}.' then the effect line, the foes take their turn once, the row now reads 'N ROUNDS'", "Pixel 7 (ABIL-02, cooldown refusal): tap the same row on cooldown — the fight log shows '{Name}: N rounds. Your arm has opinions.' and nothing else happens", "Pixel 7 (ABIL-01, once-a-fight): a once-a-fight ability after use reads 'ONCE A FIGHT · USED' and is READY again next fight", "Pixel 7 (ABIL-01, Bard): Sing is still the first row, ability rows follow", "Pixel 7 (ABIL-04, Hero tab): Special skills list shows only kept passives; the Abilities list shows table actives tagged 'special skill · active' and pool tricks tagged 'trick', with 'cd N rounds' / 'once a fight' out of combat", "Pixel 7 (ABIL-03, first paint): a brand-new run's first paint shows the UP YOUR SLEEVE rail card 'New trick: {name} — {txt}' once, mirrored in the Oracle", "Pixel 7 (ABIL-03, victory report): level up in a fight — the fight log carries 'New trick: …' and the victory report lists it", "Pixel 7 (a11y): TalkBack reads each ability row's label/cost/desc", "Pixel 7 (tolerant load): a pre-Phase-38 save resumes with its old skills renamed/dropped and abilities present (Hero tab) with no card or crash", "Pixel 7 (voice): spot-check a few ability tones (Pommel Strike/Sweep/Riposte/Smoke) for the family-friendly deadpan voice in real play, not just the synthetic safety-scan corpus"]
gaps: []
---

# Phase 38 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-18)

Goal-backward check of the phase goal: *combat is more than pressing STRIKE for melee classes — Fighters and Thieves get activated combat abilities with cooldowns, a class-flavored ability pool is rolled (never chosen) at level 1 and every skill level, a chosen subset of existing passive Special Skills converts to actives, and everything is legible and usable from the combat ABILITIES submenu.*

This is the first phase executed under the 2026-09-17 greenfield amendment to the Engine Gate: no dual-path code, the new rules are the only rules, and the fixtures a deliberate change moves are declared and regenerated — never blanket-regenerated.

## Automated evidence (re-run by the orchestrator after 38-05)

- `npm test`: **2563/2563, 0 failures** (2388 at phase start → 2413 after 38-01 → 2442 after 38-02 → 2499 after 38-03 → 2542 after 38-04 → 2563 after 38-05). `npm run build:www` exit 0 (`www/` 4.9 MB, version stamp unchanged — the bump belongs to the milestone close).
- Engine gate: `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). Fixture edits are confined to one commit (`f1b2f70`, 38-01 Task 3): 20 measured `chargenDivergence`/`divergences` records across `action-script.encounters/magic/movement.json`, `action-script.schema.md` and two more fixture files — each a before/after pair for a hero whose chargen-time `c.skills` the table reshape moves. No other plan touched `test/parity/fixtures`; `chargen-rng-pin.test.js` byte-unchanged since `56d51e3` (floor generation and chargen rng consumption did not move — the pool roll uses a derived stream, zero main-rng draws).
- Cumulative `git diff --stat 7109c9d -- engine content src mazeworld.html docs test/parity/fixtures tools` = 30 files, 2514+/189−; `tools/` untouched, so the v1.5 BEFORE tuning pin stays like-for-like (the bot now plays the new rules through the same `newRun`/`checkLevel` paths, per the ruling).
- New serialized fields: `c.abilities` (hero) and member `timers`/`abilities` — carved out (`stripAbilitiesField`) in all three `*Comparable()` fns plus the three per-domain local duplicates; `ensureAbilities`/`migrateLegacySkills` give old saves a tolerant load (renamed/dropped skills reconciled, abilities filled) with no card.
- Every new event type (23 in 38-03, the member events in 38-04, `abilityLearned` in 38-01) has `EVENT_NARRATION` + `TOAST_FOR` + rail entries — `toastsCoverage.test.js` / `formatEventsCoverage.test.js` green; voice scan green on the full ability copy.
- Five plans, five SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `c570690` apart from the two untracked user directories outside the phase.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | A Fighter or Thief opens the ABILITIES submenu mid-combat and sees at least one usable ability with a clear "ready" / "N rounds" state | `abilityRows(c)` in `src/browser/combatMenu.js` renders READY / `N ROUNDS` / `ONCE A FIGHT · USED` from `abilityRoundsLeft` + `ONCE_A_FIGHT`; every level-1 Fighter/Thief has ≥1 rolled ability (`ABILITY_POOL` roll in `newRun`) so the branch is never empty; Bard keeps Sing first. `test/unit/shell-abilities.test.js` (21) + `abilities-catalog.test.js`. |
| 2 | Trying to use an ability on cooldown produces a named refusal in the fight log, never a silent no-op | `useAbility` refusal ladder notFought → unknown → notInCombat → cooldown → noTarget → notLowEnough emits `abilityRefused { reason }`; the submenu row stays tappable on cooldown so the engine's own line ("{Name}: N rounds. Your arm has opinions.") explains; the 38-03 Task 1 tests pin every reason and `toastsCoverage` pins its narration. |
| 3 | A fresh level-1 Fighter/Thief already has a rolled ability; each skill-level gain can add another, narrated when it happens | Level-1 roll in `newRun` from `derivedRng(hashString(seed, "abilities", …))`; per-level roll in `checkLevel` → `abilityLearned` event → "New trick: {name} — {txt}" on the SKILL LEVEL card, fight log and victory report; first-paint `abilityPoolCard` (UP YOUR SLEEVE) via `surfaceAbilityPool` on both `commitRolledState` and the dev start-at-depth path. 38-01 pool tests, `rail.test.js` +, `characterSheetViewModel.test.js` +. |
| 4 | Every sub-class that had one code-verified good and one bad (Phase 24) still has both after any passive → active conversion — identity-contract suite updated in this phase | `test/unit/identity-contract.test.js` rewritten in 38-02 for the reshaped tables (11 actives + 10 kept passives; Tracking/Language/Climbing/Leaping dropped, Agility/Death-touch/Kata/Silence converted) with an SC-4 guard asserting one good + one bad per sub-class; `identity-combat.test.js` reconciled; `docs/CLASS-PASS.md` table cross-referenced from `docs/ABILITIES.md`. |
| 5 | A melee-class Joiner in the party uses its own abilities in combat by the same class-driven policy Joiners already fight with | `pickMemberAbility`/`resolveMemberAbility` (38-04) — opener round 1, damage-tagged above half HP, defensive-tagged below — through the same strike/foe-flag primitives as the hero; member `timers` ticked in `foeTurn` and cleared at `endCombat`; Battle Roar is party-wide via `partyEffectActive`. 38-04 Tasks 1–2 tests (43). |

## Requirements

ABIL-01 ✓ · ABIL-02 ✓ · ABIL-03 ✓ · ABIL-04 ✓ · ABIL-05 ✓ — automated halves verified; on-device halves in the frontmatter `human_verification` list (15 items, from the aggregated checklist in 38-05-SUMMARY.md; Plans 02/03 added nothing device-testable of their own).

## Accepted planner/executor deviations (recorded in plan/SUMMARY frontmatter)

- 38-01: FREE_SKILL repointed at the *same table position* (Cat Burglar→Dirty Trick, Acrobat→Smoke, Ninja→Silent Step) rather than any valid key, so the kit roll's rng consumption is unchanged.
- 38-02: fluency ceiling drops to 1 (Language retired) — `canParley`'s Magical fluency-2 branch and `parley()`'s `wilmsryVsMagical` refusal stay as unreachable-but-documented code (deletion is a cleanup-milestone candidate); Climbing/Leaping fall-halving is gone for everyone. `parley-button-mirror.test.js` and `tuning-bot.test.js` (D-06 now flees, not parleys) re-pinned as direct fallout.
- 38-05: `abilities[]` tests live in the pre-existing `characterSheetViewModel.test.js` (the plan's `viewModels.test.js` never existed); `shell-worn-slots.test.js` rail-import pin re-pinned after `abilityPoolCard` joined the shared import.

## Follow-ups noted (not gaps)

- Unreachable `canParley` Magical fluency-2 branch + `wilmsryVsMagical` refusal → cleanup milestone (dead-code purge).
- Phase 42's tuning bot must learn to call `useAbility` before the ONE AFTER depth-20 matrix, or the AFTER run under-reports melee classes.
- Tone read of the 20 ability blurbs happens on device (item 15), alongside the rest of the milestone's voice batch.
