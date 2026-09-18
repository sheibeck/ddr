# Phase 42: Flee Retune & Consolidated Balance Close - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — no research (roadmap: standard numeric retune; user's per-run research policy); one batched question with two areas, both answered with the recommended option.

<domain>
## Phase Boundary

Flee becomes transparently fair — a lower, honestly-shown base with the Thief edge kept and small class/race modifiers — and the milestone's ONE consolidated AFTER class-matrix run measures the combined effect of every power-adding phase (abilities, gear, spells, terrain) against the depth-20 target, closing the loop BAL-01 opened. The tuning bot must first learn to USE the new power (abilities, items, spells by niche) — BAL-01's second half, deferred to here by Phases 38–41.

Requirements: FLEE-01, FLEE-02, BAL-02.

Out of scope: any new player power; the TUNE-06/07 human DR round (still deferred to a later tuning milestone); tier-3/5 roster decisions; the Clarity Pass (Phase 43).

</domain>

<decisions>
## Implementation Decisions

### Standing rulings that bind this phase
- **Greenfield, no legacy paths:** the new flee formula is the only formula; the fixtures a change moves are DECLARED (measured before/after) and regenerated — only those; `test/parity/prototype-master.js.txt` never edited. The combat fixtures that flee (grep `"flee"` actions in `test/parity/fixtures/*.json`) are the candidates — measure, don't guess.
- **Depth-20 target (memory):** tune toward depth 20, not infinite; 20 is a unicorn run; past 20 leave the curve alone.
- **Deferred UAT**; **rail is the one feedback surface**; every new event → `EVENT_NARRATION` + `TOAST_FOR` + `RAIL_FAMILY`; voice scan; HP not WP.
- `docs/class-pass/v15-before.json` + `v15-before-depth20.json` are the BEFORE pins (engine at `e69ff07`); never regenerated. The AFTER run writes NEW files.

### Area 1 — FLEE-01 base rate: **35% (need 14)** (user-chosen)
- `flee()`: `roll = d20`; success when `roll + mods >= 14` where `mods = thiefBonus (+5, kept) + classMod + raceMod − armorBulk(c)`. Thief in light armor → 60%; Fighter in plate → 25%.
- **Class/race modifiers (planner-designed, bounded ±2, every value in the ledger):** e.g. Halfling +2, Elf +1, Human 0, Dwarf −1, Ogre/large −1, Fighter 0, Magic User −1; sub-class flavor where it already exists in code stays (Samurai refuses, Cloaker vanishes before round 2, Master of Arms denied on a tracked round 1, Smoke auto-succeeds) — untouched.
- **FLEE-02:** the `fleeRolled` event (roll, every modifier by name, need) is emitted and narrated in the fight log BEFORE `fled`/`fleeFailed` resolves — one line like "Flee: d20 8 +5 Thief +1 Elf −1 armor = 13, need 14." then the outcome; a failed flee still hands every foe its swing exactly as today (`foeTurn`), unchanged.
- Before/after table + declared divergence in `docs/FLEE.md` (or a section of `docs/CLASS-PASS.md` — planner's call; one ledger, cross-linked).

### Area 2 — BAL-02 out-of-band policy: **Accept with written reasons; tune only one-knob cases** (user-chosen)
- Every out-of-band sub-class row in the AFTER matrix gets a written verdict in `docs/CLASS-PASS.md` against the depth-20 target (bands as defined by the v1.2 class pass). The planner/executor may tune a row ONLY when a single content number (a cost, a die, a cooldown, a charge count) clearly explains it — one change, one re-run of the matrix, recorded before/after. Everything else is accepted with its reason and listed for the user's device round. No engine-rule changes in the AFTER pass beyond flee.

### BAL-01 second half — teach the bot (orchestrator decision; planner designs the policy)
- The bot (`tools/lib/tuning-bot.mjs`) must use, by the same class-driven policies the engine's Joiners already follow, before the AFTER run:
  - **Abilities (Phase 38):** `useAbility` — opener round 1 / damage-tagged above half HP / defensive-tagged below half (mirror `pickMemberAbility`); once-a-fight abilities on the hardest foe.
  - **Items (Phase 39):** pop Speed/Strength/Enlarge before a hard fight (a kit-bearing or tier ≥ 3 foe group), heal potions below the flee threshold, staves with charges in combat (freeze/weaken/fire on ≥ 2 foes), torch when `inDark`, rope/ladder via the existing `pendingHazard` answer; obey `itemReady`.
  - **Spells (Phase 40):** cast by niche — DOT (Ice/Acid) on a tough single foe, control (Stun/Doze/Weaken) on ≥ 2 foes, burst on a weak single foe, Lesser Summon/Summon at fight start, Map the Floor when a floor is unexplored; `chooseSpell` stays kind-generic.
  - **Terrain (Phase 41):** already paths over water; fear is passive.
- Pick-rates: the matrix report counts every ability/spell/item USE per sub-class (a `usage` tally like the D-07 ability tally) so BAL-02's "pick-rates for every new spell/ability" is honest.

### The ONE AFTER matrix
- Same harness as the BEFORE pin (`tools/tune-classes.mjs`, 143 cells, the same seed counts as `v15-before*.json`: natural + depth-20 mode), writing `docs/class-pass/v15-after.json` + `v15-after-depth20.json`; `class-pass-diff.mjs --gate` against the BEFORE pins; a "v1.5 AFTER" section in `docs/CLASS-PASS.md` with pooled rollups, per-sub bands, pick-rates, out-of-band verdicts.

### Claude's Discretion (planner)
- The exact class/race modifier table; the ledger file name; the bot policy thresholds; whether the matrix runs once with abilities+items+spells all on (yes — that is the "consolidated" run) plus an optional ablation column if cheap.
- Plan split; suggested waves: (1) flee retune + narration + declared divergences + ledger; (2) bot learns abilities/items/spells-by-niche + usage tallies (with a 3-seed smoke); (3) the AFTER matrix run + CLASS-PASS section + one-knob tuning if any + gate + aggregated Pixel 7 checklist. No `mazeworld.html` edits expected (FLEE-02's line is narration in `src/browser`); if one is needed, it goes in the last plan.

</decisions>

<code_context>
## Existing Code Insights (verified 2026-09-18)

- `engine/combat.js#flee` (:920): Samurai refusal, Cloaker vanish, tracked-round-1 pursuit, Smoke auto-flee, then `bonus = Thief ? 5 : 0`, `bulk = armorBulk(c)`, `fleeRolled { roll, bonus, bulk, need: 11 }`, success `roll + bonus − bulk >= 11` → `pursuitStrike` → `forfeitLoot` → `fled`; failure → `fleeFailed` → `foeTurn`.
- `tools/lib/tuning-bot.mjs`: `decideAction`, `chooseSpell` (kind-generic scoring), flee/parley thresholds (D-06: 0.3 / 0.5 vs kit-bearing foes), `useTool` answer to `pendingHazard`, D-07 ability tally (`abilityDmg` etc. — foe abilities), potions deliberately not used via `useItem` (found potions are drunk on pickup?) — the planner reads the exact current behaviour; `chooseStorePurchase` (Phase 39).
- `tools/tune-classes.mjs`, `tools/class-pass-diff.mjs --gate`, `docs/class-pass/v15-before.json` (400-seed? — read `meta.seeds`), `v15-before-depth20.json`, `v15-gear-smoke.json` (Phase 39, 143 × 3).
- `docs/CLASS-PASS.md` "v1.5 BEFORE" section (:~1620) — pooled rollups: meanDepth 3.77, reach5 30.6%, reach10 0.9%, reach20 0.1%, p90 6; depth-20 mode meanEncountersSurvived 3.17, meanFloorsGained 0.84.
- Engine surfaces the bot must call: `useAbility(state, key, rng, events)` (`engine/abilities.js`), `useItem(state, ref, rng, events)` + `itemReady` (`engine/items.js`), `castSpell(state, idx, rng, events)` (`engine/magic.js`), `useTool` (`engine/actions.js`), `abilityRoundsLeft`, `ACTIVATION_OF`, `ABILITY_BY_ID`, `SPELLS[i].niche`.
- Tests: 2915 green at `676afc5`; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

</code_context>

<specifics>
## Specific Ideas

- Flee line in voice: "Flee: rolled 8, +5 for being a Thief, −1 for the mail. 12 against 14. The door disagrees."
- CLASS-PASS AFTER section headline: the same table shape as BEFORE so the diff is one glance; a "what the bot now does" paragraph so the numbers are interpretable.

</specifics>

<deferred>
## Deferred Ideas

- TUNE-06/07 human DR round; tier-3/5 roster → later tuning milestone.
- Bot parley/flee threshold retune → only if the AFTER run shows it dominating a row (one-knob rule).

</deferred>

---

*Phase: 42-flee-retune-consolidated-balance-close*
*Context gathered: 2026-09-18 via autonomous smart discuss (one batched question, two areas)*
