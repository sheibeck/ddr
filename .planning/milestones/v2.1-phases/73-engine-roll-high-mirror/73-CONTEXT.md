# Phase 73: Engine Roll-High Mirror - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Switch the ENGINE (not a display adapter) to roll-high (ROLL-05).

- Every die CHECK reads the same rng draw `r` on an N-sided die as `roll = (N+1) − r`, and succeeds when `roll ≥` the lowest winning face.
- Modifiers are signed bonuses: + always helps the roller.
- Every seeded run resolves identically. The parity suite stays byte-identical (zero regenerated fixtures, zero new carve-outs), and that proves the switch changed representation, not outcome.
- A guard fails the build on any roll-under comparison left in `engine/`.
- Every roll-carrying event natively carries the high-is-good face, the lowest winning face and `dieN`.

**In scope:**
- Every CHECK site in `docs/ROLL-LEDGER.md` (48-row site inventory + the not-a-check appendix).
- `isBestFace`.
- Crits and best-face effects.
- The event shape.
- The direct display consumers of the changed event fields (see Area 3).
- Tools/tests that read roll fields.
- The guard.

**Not in scope:**
- The full display/sign pass: hero sheet, combat menu, foe details, rail cards, player-view modifier signs, need-breakdown signs, item/loot/store comparisons. That is Phase 74 (ROLL-02/03).
- Rewording roll-direction phrasing in `content/` text. That is Phase 79 (ROLL-04).
- Any rule or odds change.
</domain>

<decisions>
## Implementation Decisions

### How a roll reads after the switch (user accepted 2026-09-25)
- **Which rolls flip: high is good for whoever rolls, and a 1 is always the worst face.**
  - Only checks whose winning faces sit at the BOTTOM of the die today get mirrored.
  - Rolls already high stay as they are: flee, initiative, cooking `>= 4`, chest scroll `>= 3`, climb fall-avoid `> 2`, Humans parley payout `=== 6`.
  - Mishap gates that fire on a natural 1 stay on the 1: Apprentice/doubled backfire, lockpick wear, Sorcerer spell loss on level-up, and the foe's save vs the vapor kill (read as the foe's save; a 1 fails).
  - Pure SELECTION/AMOUNT draws (table picks, damage, durations) are not checks and are untouched.
  - The planner classifies every one of the 48 ledger sites plus the appendix against this rule. The per-site verdict (mirror / already high / mishap-on-1 / not a check) is recorded in the ledger.
- **Rolls with no obvious roller** (loot drops, bag-upgrade drop, wandering wake, the rare d20 travel event) are read from the HERO's side, so a high roll is good news for the hero.
  - Drops land on the top faces (mirror).
  - A wanderer wakes on a LOW roll: the bad news sits at the bottom, so there's no mirror because it's already oriented.
  - Classify each such gate by "is the outcome good or bad for the hero", then orient.
- **Modifiers move the range, never the die.**
  - The displayed roll is always the real (mirrored) face ("12 vs 16–20"). A +2 widens 18–20 to 16–20.
  - Every modifier folds into the threshold, including flee: today's `d20 + bonus >= 14` becomes `roll >= 14 − bonus`. Byte-identical, and the line reads "12 vs 11–20".
  - Thrown spells' `roll − bonus <= target` folds the school bonus into the threshold the same way.
- **Crits and best-face effects move to the top faces:**
  - the weapon crit (`weaponCrit` 1 → 20, 2 → 19–20)
  - Stealth/Ninja crits `<= 2` → 19–20 (top 2 faces of the strike die)
  - the Skeleton shatter via `isBestFace` (becomes `roll === dieN`)
  - the Soldier's crit-taken weakness (attacker's top face, or top 2 for a Soldier)
  - the foe's natural-best crit on members
  - the "only a perfect roll finds you" overrides (Smoke/Mirror Self/invisibility/blind): the foe needs its die's top face, and the insult adds one more face (19–20 on a d20; the Phase 72 ruling expressed high).
  - Philly `slow` "keep the lower of two" becomes "keep the higher of two mirrored faces", which is byte-identical.

### Numbers in content, saves and events (user accepted 2026-09-25)
- **Content numbers keep their values.**
  - Every roll-under threshold is a count of winning faces, and bigger is already better for the roller: class hit ranges 3/4/5, weapon `need` ±to-hit, AR/`sp.ar` soak, `sp.toHit` caps ("hittable only on a 4" = at most 4 faces), lock tiers, trap nimble, climb/leap tables, cure 10(+4), drop chances, parley's `min(9+bonus,17)` faces, resistance's `intel − 1` faces.
  - The check converts faces to the lowest winning face on its die: `lowest = N + 1 − faces`. 5 faces on a d20 = 16–20; on the level-5 d6 = 2–6.
  - Only names, JSDoc and comments that say "roll under"/"need N or less" are rewritten to the faces/roll-high reading. Engine-internal names can be renamed freely.
  - Rejected: storing target numbers. A lower target is better, so every upgrade would make its number go DOWN, which is the confusion ROLL-05 removes.
- **Old saves load as they are.** No stored number changes meaning.
  - Add a test that pins a pre-switch save (built at the Phase 72 close commit) loading and resolving identically.
  - Do NOT rename persisted content fields: weapon `need`, `sp.toHit`, `sp.ar` and the like live in state and in the prototype comparison, so a rename would move parity. If the planner finds a persisted field that MUST be renamed, it gets a one-time tolerant rename on load plus a comparables mapping, declared explicitly.
- **Events.**
  - Every roll-carrying event carries three things natively: `roll` (the mirrored, high-is-good face), the lowest winning face, and `dieN`. This covers `struck`, foe swings vs hero/member, pursuit, soak both ways, thrown spells (hero + ally), resistance, parley, flee, traps, locks, climbs/leaps, cures, wake, drops, gates, summons/ally strikes and crits.
  - The old roll-under `need` field is REMOVED from every event. There are no dual fields (greenfield).
  - `target` already names the victim in ~48 engine event pushes and ~96 UI reads, so the threshold gets a NEW, non-colliding field name. The planner picks it, e.g. `atLeast` or `min`, and uses it consistently. The roadmap's "`target`" wording refers to this field.
  - `needMods`' `{name, delta}` values already are signed bonuses to the roller (+1 face = +1 to hit) and keep their values. Renaming the field is the planner's call. The player-view sign pass is Phase 74.

### Proof, the guard, and the line with Phase 74 (user accepted 2026-09-25)
- **Proof it changed nothing:**
  - The full parity suite (chargen, combat, economy, movement, encounters, magic) passes with ZERO regenerated fixtures and ZERO new divergence records or comparable carve-outs.
  - The Phase 72 odds-based direction tests (`test/unit/rollDirection.test.js`, `rollDirection-checks.test.js`) run UNCHANGED and pass.
  - The 200-seed bot readout (`node tools/tune-difficulty.mjs --seeds=200`) must match the Phase 72 AFTER readout in `docs/DIFFICULTY-RETUNE.md` exactly. Record it as a third proof.
  - A moved fixture or changed readout means a site was flipped wrong: fix the site, never the fixture.
- **The guard (fails the build):**
  1. Every CHECK goes through ONE roll-high helper in `engine/dice.js`. It draws exactly one `rng.d(N)` (same draw count and order) and returns `{ roll, <threshold>, dieN, ok }`, or similar.
  2. Every other raw die draw in `engine/` carries a tag (amount / selection / mishap-on-1 / already-high) that the guard reads. An untagged raw draw fails.
  3. A scan fails on any roll-under comparison shape in `engine/` (`roll <=`, `<= need`, `> need`, `r <=`, and so on).
  4. A runtime invariant over every parity fixture replay: every roll-carrying event satisfies `1 ≤ roll ≤ dieN` and its success/failure outcome equals `roll ≥ threshold`.
- **Where Phase 73 stops on displays:**
  - Phase 73 updates ONLY the consumers that print a roll or need from an EVENT: Oracle/eventNarration lines, `narrationLines`, the fight log, and dice reveals (~30 `.need` + ~41 `.roll` reads in `src/browser/`). Nothing may ever show a flipped roll beside an old roll-under number.
  - Use Phase 74's final line shape (user-accepted 2026-09-25, see 74-CONTEXT): "**17** vs 18–20 (light blade +1). You miss it." The winning range is always written "lo–hi" (a single face reads "20"), and the old "(needs N: …)" repeat is dropped. Phase 74 then only re-signs the modifier list from the player's view and extends the format to the non-event surfaces.
  - Everything else is Phase 74: hero sheet, combat menu, foe details, rail cards computed from derived functions, player-view modifier signs, need-breakdown signs and item comparisons.
  - Derived functions (`toHit`, `foeToHitVs`, `memberToHit`, `fleeBreakdown`, `parley` need) keep returning FACES, so Phase 74's surfaces keep working unchanged until then.
- **Tools and tests that read rolls** are updated in the same phase: the tuning bot, dev tools, and unit tests asserting raw roll/need values. Expected values are mirrored (`N+1−old`), never loosened.

### Claude's Discretion
- The helper's name/signature, the threshold field name, the tag syntax for non-check draws, and how the guard parses them.
- Engine-internal renames (e.g. `need` locals → `faces`/`atLeast`), as long as persisted fields are untouched.
- Plan split and wave order. Suggested: helper + guard skeleton → combat sites → non-combat sites → events + consumers → tools/tests → proofs.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/dice.js`:
  - `rollDice(rng, {n,sides,bonus})`.
  - `isBestFace(roll, dieN)` is `roll === 1` today, and Phase 72 left it as the one-line flip point → `roll === dieN`.
- `docs/ROLL-LEDGER.md`: the 48-site CHECK inventory with die, roller, success condition and "roll-high today?", plus the SELECTION/AMOUNT appendix and per-file draw counts. This is the per-site checklist and the place to record each site's mirror verdict.
- `test/unit/harness/rollOdds.js` and the two direction test files are odds-based (fraction of winning faces). They must pass unchanged, which is the point of their design.
- `content/misc-tables.js:13` `STRIKE_DICE = [20, 12, 10, 8, 6]`: the strike die shrinks by level, so class need = winning FACES, and the lowest winning face depends on the die (fighter 5 faces: d20 16–20 … d6 2–6).

### Established Patterns
- Today a hit is `roll <= need` and a foe misses on `roll > need`. Flee is `roll + bonus >= need(14)` (`fleeBreakdown`, derived.js ~L948). Initiative is `mine >= theirs`. Thrown spells are `roll − bonus <= target` (magic.js ~L506, ally ~L1950). `resistRoll` is `roll < intel`, gated `intel >= 12` (derived.js ~L1433).
- Key sites:
  - `engine/combat.js`: playerStrike ~L604–705 (strike die, Philly slow, crits `roll <= weaponCrit`, Stealth/Ninja `<= 2`); pursuit ~L983–1020; flee ~L1119; parley ~L1281; allyTurn ~L1512; alliesTurn legacy ~L1583; memberStrike; allyCast ~L1950; foeTurn member ~L2499, hero ~L2625, crits ~L1020/~L2678; `shatterIfBest` ~L934.
  - `engine/foeDamage.js:98`: the foe natural-armor soak.
  - `engine/encounters.js`: trap ~L71, locks ~L132/137.
  - `engine/movement.js`: climb ~L270, leap ~L286, cure ~L708, wake ~L785, d20===1 ~L950.
  - `engine/magic.js`: backfires ~L128/176, vapor ~L310/313.
  - `engine/items.js`: lockpick wear ~L250.
  - `engine/character.js`: Sorcerer loss ~L657.
- Events today: `struck {target:name, roll, need, needMods, critical}`, `fleeRolled {roll, mods, total, need}`, `parleyRolled {roll, need, fluency}`, `trapAvoided {roll, need}`, `trapSprung {roll}`, `resistFailed {target, roll}`, the foe swing events, and others. Every event type has an `EVENT_NARRATION` entry (coverage guard).
- Parity: action scripts replay through the frozen prototype and the engine, diffing STATE after every action (`test/parity/harness/diffState.js`, `comparables.js`). Events are NOT compared, so event-shape changes move no fixture. Persisted content fields ARE compared.

### Integration Points
- UI consumers of event roll fields: `src/browser/eventNarration.js`, `narrationLines.js`, `fightLog.js`, `rail.js`, `combatMenu.js`, `upgradeWhy.js`. Update only the event-roll printing in 73; the rest is Phase 74.
- `tools/tune-difficulty.mjs` and any tool reading `need`/`roll` from events.
- Phase 74 consumes the new event fields and the faces-returning derived functions. Phase 75.1's Pilfer fumble (d20, fumble on a 1) and the scroll-read roll (d20 vs intel; a fumble below half the target) are written natively roll-high on top of this phase's helper.
</code_context>

<specifics>
## Specific Ideas

- The user's framing, which the engine must produce: on a d20 a caster needs 18–20, a thief 17–20 and a fighter 16–20. "+2 is always better."
- "Even in the Oracle, we'll want our roll ranges flipped": every Oracle line that prints a roll shows the roll-high face and range from this phase on.
- A worked example (ROLL-LEDGER): a smoked-and-insulted hero is found on 19–20 on a d20.
- "1 is always the worst face" is also the convention Phase 75.1's Pilfer fumble relies on (a d20 roll of 1 fumbles).
</specifics>

<deferred>
## Deferred Ideas

- The full display/sign normalisation (hero sheet, combat menu, foe details, rail cards, modifier signs, need breakdown, item comparisons) → Phase 74.
- Roll-direction phrasing in content text ("natural 1", "1–N", "need N") → Phase 79.
- Renaming persisted content fields (weapon `need`, `sp.toHit`, `sp.ar`): not needed, because values keep their meaning. Revisit only if a later phase needs it (tolerant load + comparables mapping).
</deferred>
