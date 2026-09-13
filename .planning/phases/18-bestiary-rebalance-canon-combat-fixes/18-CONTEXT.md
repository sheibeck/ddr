# Phase 18: Bestiary Rebalance & Canon Combat Fixes - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss — 4 grey areas proposed as batch tables, all accepted by the user.

<domain>
## Phase Boundary

Every creature in `content/bestiary.js` has its HP / damage / to-hit / AR / attack-count reviewed against its bestiary tier (1–5) and outliers are fixed, with a committed before/after stat table; four canon combat modifiers land through one new central foe-damage seam — foe natural armor (`sp.ar`, CANON-01), Sterling `halfDmg` (CANON-03), damage-source × creature-type multipliers (CANON-04), Philly `slow` (CANON-05) — all parity-safe: the four fixture-exposed creatures are untouched and every new mechanic is gated on a flag absent from the fixture roster (BEST-03 / FID-05). Requirements: BEST-01, BEST-02, BEST-03, CANON-01, CANON-03, CANON-04, CANON-05, FID-05. Out of this phase: CANON-02 (Spectre pursue / Drudge never-melee / Drake cooldown → Phase 19), abilities, difficulty.js changes (→ Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Rebalance Yardstick (BEST-01, BEST-02)
- D-01: A creature's "intended depth band" is its bestiary tier (1–5): foe level = clamp(min(hero level, floor depth), 1, 5), so a tier-N creature must be a fair fight for a level-N hero. Yardstick = the hero's expected HP and damage-per-round at level N (chargen/level-up math + `tools/tune-difficulty.mjs` bot), computing time-to-kill and rounds-to-die per creature.
- D-02: Conservative pass — fix ONLY outliers (>2× off the tier's median TTK or damage-per-round, or a stat contradicting the creature's own `note`); keep prototype numbers everywhere else so Phase 21 retunes from a stable baseline.
- D-03: Pre-ability discount for the five caster foes (Djinni, Krupke, Drudge, Vampire, Stalka Beast): −25% HP and one dice-step lower melee damage now, flagged "pre-ability discount — revisit Phase 21" in the stat table; Drudge (never melees) gets the HP cut only.
- D-04: The before/after stat table lives in-repo at `content/BESTIARY-REBALANCE.md` (referenced from the `content/bestiary.js` header) and is summarized in the phase SUMMARY.

### Foe Natural Armor (CANON-01)
- D-05: Mirror the canon player rule (rulebook p.44 "Using Armor"): on a landed physical hit against a foe with `sp.ar`, roll d20; ≤ `sp.ar` → the blow is soaked entirely (no durability tracking). The d20 fires ONLY when `foe.sp.ar` is set — zero-draw for every other creature (none of Bat/Rat, Shriek, Viper, Dante has `ar`).
- D-06: Applies to physical damage only — hero weapon strikes and party-member / summon-ally strikes. Spells bypass foe armor (rulebook "Spells v. Armor": armor protects only against thrown physical-damage spells; simplified to "all spells bypass").
- D-07: A critical hit (natural 1 on the strike die) ignores the soak.
- D-08: New event `foeArmorSoaked { name, amount }` with a sarcastic, family-friendly Oracle line (e.g. "Your blow rings off the Drat's hide. It looks bored."); `EVENT_NARRATION` entry required (coverage guard).

### Creature Specials (CANON-03, CANON-04, CANON-05)
- D-09: Introduce ONE central foe-damage seam — `damageFoe(state, foe, dmg, source, rng, events)` (name/signature at planner discretion) — through which every damage-to-foe path flows (hero strike, ally/member strike, spell damage, acid tick, ward reflect, volley/quake). It hosts the armor soak (D-05..D-07), Sterling halving (D-10) and the multiplier table (D-11), and is the seam Phase 19's ability resolver reuses. Kill accounting (`killFoe`) stays where it is; the seam only computes/applies damage.
- D-10: Sterling `halfDmg` halves ALL damage the foe takes, rounding UP (`Math.ceil(dmg/2)`).
- D-11: Multipliers live in a small pure table `content/damage-multipliers.js`, keyed by (damage source, creature type/name): Cleric-cast spells (`c.sub === "Cleric"`) 2× vs Demons; any spell damage 2× vs Walking Dead; Fighter melee 2× vs Trachea (canon, rulebook "Lair Beasts" Trachea entry). "Magic" = spell damage only — magic weapons do NOT count. Table locked by a content-table test.
- D-12: Philly `slow`: the hero's to-hit roll vs a `slow` foe is rolled twice and the LOWER result kept (low = hit, so player-favorable). The extra draw fires only when `t.sp.slow` (zero-draw otherwise; Philly is not fixture-exposed).
- D-13: Test contract: each special gets dedicated `fakeRng` unit tests (pattern: `test/unit/party-combat.test.js` helpers); the FID-02 `countingRng` test (`test/unit/foe-turn-draw-count.test.js`) gains cases proving zero extra draws vs creatures without `ar`/`slow`; multiplier table pinned by a content-table test.

### Parity Carve-Outs & Process (BEST-03, FID-05)
- D-14: The four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante — all L1, per `test/parity/FIXTURE-INVENTORY.md`) keep their numbers UNCHANGED in Phase 18 → zero `comparables.js` carve-outs. If the review flags one as an outlier, record it in the stat table as "deferred to Phase 21" instead of carving out.
- D-15: Parity proof: all new mechanics are gated on flags absent from the fixture roster, so the parity suite stays byte-identical with NO fixture regeneration; the FID-02 draw-count pins are unchanged; the pinned fixture-inventory test proves the roster didn't move. `test/parity/prototype-master.js.txt`, fixtures, and `comparables.js` are not edited.
- D-16: Run `tools/tune-difficulty.mjs` before and after the rebalance and record both readouts in the stat table as an informational sanity signal — NOT a gate (the bot is blind to abilities until Phase 21).
- D-17: No bestiary schema change: stats stay flat on existing entries (`wp`, `sp.dmg`, `sp.ar`, `sp.toHit`, `sp.atk`); only numbers move, so `test/unit/content-tables.test.js` pins are updated for changed entries only, each with a one-line rationale.

### Research-resolved follow-ups (orchestrator, 2026-09-13)
- D-18: Drake (tier 4, wp 135 ≈ 7.3× tier-4 median TTK) and Werebeast (tier 3, atk 2 × 1d10+5 ≈ 2.9× tier-3 median RTD) ARE outliers under D-02 and are in scope. Bring them to within ~2× of their tier median (not to the median) so their "boss" identity survives; Drake's fire-breath is a Phase 19 ability (CANON-02) — do not model it here.
- D-19: Sterling: implement `halfDmg` (D-10) and leave `wp: 35` unchanged; record the resulting ~2× TTK in the stat table as "canon-intended (two hearts) — revisit in Phase 21".
- D-20: The Fighter-melee-vs-Trachea multiplier applies to the HERO only. Do NOT add a `cls` field to `C.allies` party-member entries in this phase (new serialized field → parity carve-out); note it as deferred to Phase 19/21.

### Claude's Discretion
- Exact outlier list and new numbers (within D-02's rule), the exact helper name/signature for the damage seam, event field names, and test file layout.
- Whether the yardstick computation is a committed script (e.g. `tools/bestiary-yardstick.mjs`) or a documented one-off — a committed script is preferred if cheap, since Phase 21 will want it.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js`: `startCombat` (98) builds foes from `BESTIARY[type][lvl-1]` with `lvl` = clamp(min(c.level, depth) − maybe 1, 1, 5); `playerStrike` (281; to-hit uses `t.sp.toHit`/`fast`/`magicOnly`, damage `t.wp -= dmg` at ~395); `allyTurn`/`alliesTurn` (738/781 `t.wp -= d`); `killFoe` (409); `pickFoeTarget` / `applyFoeDamageToPlayer` (Phase 17 helpers) — the player-side armor soak in `applyFoeDamageToPlayer` is the model for the foe-side soak.
- `engine/magic.js`: spell damage sites `f.wp -= d` (169 quake), `t.wp -= d` (201 volley), 283, 341 — all must route through the new seam.
- `engine/derived.js`: `strikeDie(c)` (235), `armorSoak(c)`.
- `content/bestiary.js`: flat `sp.*` flags already present: `ar` (Drat 12, Krupke 12, Craig 15, Herman 15, Google 15), `halfDmg` (Sterling), `slow` (Philly), `caster` (Djinni, Krupke, Drudge, Vampire), `twice`, `toHit`, `atk`, `noArmor`, `magicOnly`.
- `test/parity/FIXTURE-INVENTORY.md` + `test/parity/fixture-inventory.test.js` (Phase 17): fixture roster = Shriek / Bat/Rat+Shriek / Viper+Shriek / Dante×2 / Shriek — all L1.
- `test/unit/foe-turn-draw-count.test.js`: `countingRng` wrapper — extend for zero-draw proofs.
- `tools/tune-difficulty.mjs`: headless auto-play bot (informational readouts).

### Established Patterns
- Zero-draw gates on flags absent from parity paths (`c.regen`, `f.acid`, `C.allies`, `c.halfNext`); `DELIBERATE RULES CHANGE (Phase N, REQ)` inline comments for canon deviations; content tables are plain ESM object literals pinned by `content-tables.test.js`; every new event type needs an `EVENT_NARRATION` entry (`src/browser/eventNarration.js`) that passes the voice safety scan.

### Integration Points
- Phase 19 reuses the foe-damage seam and expects the pre-ability discounted stats on the five casters.
- Phase 21 consumes `content/BESTIARY-REBALANCE.md` + the yardstick numbers for the consolidated retune.

</code_context>

<specifics>
## Specific Ideas

- Narration for `foeArmorSoaked` in the game's deadpan voice; keep it short (toast-friendly).
- The stat table should show, per creature: tier, type, before → after for wp / dmg / toHit / ar / atk, the yardstick TTK / rounds-to-die, and a one-line reason ("unchanged", "outlier: …", "pre-ability discount").

</specifics>

<deferred>
## Deferred Ideas

- CANON-02 (Spectre pursues, Drudge never melees, Drake `every` cooldown) → Phase 19 (shares the cooldown/ability pattern).
- Any change to the four fixture-exposed creatures → Phase 21 (with carve-outs if ever needed).
- A formal `tier`/threat-budget field on bestiary entries → v2 (FOE-V2-04) unless Phase 21 proves it necessary.
- Werebeast extortion/reinforcements, Trachea +4 first-hit, Hobgoblin guaranteed loot, Bones pack AI → backlog (FEATURES.md "defer" list).

</deferred>
