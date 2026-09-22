# Phase 52: Foe Cadence & Damage Curve - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — 3 areas / 11 questions, all recommended answers accepted

<domain>
## Phase Boundary

Every foe attacks an honest, countable number of times per round (pinned, not changed — the cadence rules are already right after Phase 51 removed the double turn), a firing ability provably replaces that turn's swings, the Bat/Rat and China Wolf floor-5 fights are re-measured in band, and no single foe hit can spike past a smooth depth-scaled curve: a crit doubles the damage dice instead of the whole `lvl² + flat + dice` sum, and Herman's flat 25 becomes the literal "strikes as a level five". Deliberate canon divergence under the greenfield ruling — measured, declared per moved fixture, master never edited; bot AFTER readout under the Phase 51 flags. Requirements CAD-01, CAD-02, CAD-03, DMG-01, DMG-02.

Source: ROADMAP Phase 52 and `.planning/todos/pending/2026-09-20-enemy-attack-cadence-initiative-visibility-damage-curve.md` (`resolves_phase: 52`; its initiative half landed in Phase 51).

</domain>

<decisions>
## Implementation Decisions

### Cadence (CAD-01/02/03)
- Swing count rule is UNCHANGED: `swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1)` (`engine/combat.js:2373`). Three pins are added: a plain foe makes exactly 1 ordinary attack per foe turn, an `sp.atk: 2` foe exactly 2, a frenzied `sp.atk: 2` foe exactly 4 — counted as `foeMissed` + `struck`/`memberStruck` events per foe turn.
- Ability-replaces-swings is UNCHANGED in the engine (the gate at `engine/combat.js:2360-2367` `continue`s after `resolveFoeAbility`, so an ability turn already has zero ordinary swings). Added: the Stalka Beast resolver test (an ability turn → exactly one ability event and zero swing events; a melee turn → ≤ 2 swing events and zero ability events; two hits + a bolt in ONE foe turn is impossible) and a one-line "an ability turn replaces every swing" note on each kit in `content/foe-abilities.js`. No new per-kit flag.
- CAD-03 measurement: new `tools/cadence-audit.mjs` (report tool, exit 0) forces Bat/Rat and China Wolf fights at depth 5 against a level-appropriate hero over N seeds through the real engine, counts foe attack events between consecutive player actions, and prints max/mean per fight; the invariant "attacks per player action ≤ `sp.atk`, ≤ 2× if frenzied" is also a unit-test pin. Output committed (`tools/cadence-audit-output.txt`) and quoted in `docs/DIFFICULTY-RETUNE.md`.

### Damage-curve audit (DMG-01)
- Analytic, not sampled: `tools/damage-curve-audit.mjs` walks every bestiary row × tier and computes the exact max single hit — `lvl² + dmgBonus(depth) + max(dice)`, ×2 on crit under the CURRENT rule for BEFORE and under the new rule for AFTER — plus each ability bolt's max. No rng; exhaustive and deterministic.
- Yardstick: two HP bars per depth band — the weakest class (Magic User, `25 + d10` base plus mean gains) and the sturdiest (Fighter, `50 + d8`) at hero level = the median hero level the bot reaches at that depth in the Phase 51 AFTER class smoke (`docs/class-pass/v17-p51-after-smoke.json`). A row is **flagged** when its max single hit ≥ 60 % of the Magic-User bar and **noted** when ≥ 60 % of the Fighter bar. Single-hit is the flag criterion; a "worst turn" column (all swings crit) is informational.
- Output: committed `tools/damage-curve-audit-output.txt` (BEFORE and AFTER sections) and the flagged rows quoted under `### v1.7 · Phase 52 — cadence & damage curve` in `docs/DIFFICULTY-RETUNE.md`.
- Every flagged row is fixed (DMG-02): the general crit rule plus Herman are expected to clear most; any row still flagged afterwards gets its own before/after line in `content/BESTIARY-REBALANCE.md`, or an explicit "left as a deliberate deep-tier threat" ruling if it is tier 5 (Endgame band) — recorded, never silently skipped.

### The fixes (DMG-02) & the engine gate
- General crit rule: a foe crit doubles the DICE, not the whole sum — `crit → lvl² + dmgBonus + 2 × dice` (today `2 × (lvl² + dmgBonus + dice)`), on both the hero branch (`engine/combat.js:2541-2552`, including the Soldier's roll ≤ 2 crit range) and the party-member branch (`:2460-2472`). The `weakened`/`shrunk`/`hamstrung` halvings and Brace/Hardiness/ward/armour pipeline are untouched in order. Removes the level-base cliff for every foe (tier-5 d6 crit 52–62 → 27–37; a level-1 Bat/Rat barely moves).
- Herman: `sp.strikesAs: 5` replaces `dmg: { bonus: 25 }` in `content/bestiary.js` (both Herman rows, tiers 4 and 5): the `lvl²` term reads `sp.strikesAs` when present, the dice stay `d6` (the default when `sp.dmg` is absent). Tier 4: 41 → 26–31 (crit 27–37); tier 5: 50 → 26–31. The rulebook note "strikes as a level five" is now exactly what the code does; the tier-5 double-dip is gone. Before/after rows in `content/BESTIARY-REBALANCE.md` (a Phase 52 addendum).
- Fixtures & pins: measure with `tools/initiative-fixture-scan.mjs` Part B run against the edited engine (it reports the first divergent action per replay site vs the frozen prototype) — any site where a foe rolled a natural 1 moves; declare each with a `+52` action-path record (`after`/`stateAfter` measured, never hand-typed), extend the `divergence-records.test.js` MOVED SET guard (a Phase 52 set), add a FIXTURE-INVENTORY.md Phase 52 section; crit pins in `combat.test.js`, `day-one-damage.test.js`, `combat-scaling.test.js` re-pinned to the new formula; `test/parity/prototype-master.js.txt` never edited; no comparables carve-out.
- Measurement gate: BEFORE = Phase 51's AFTER readout (commit `608a0e5`, identical flags — reused, not re-run); AFTER under identical flags (`tune-difficulty --seeds=200` solo + `--party`, `tune-classes --seeds 5 --workers 4 --out docs/class-pass/v17-p52-after-smoke.json`) after the cadence/damage edits, recorded under the Phase 52 H3 in `docs/DIFFICULTY-RETUNE.md` with a BEFORE → AFTER reading table.

### Still-flagged rows after the two cliff fixes — USER RULING (2026-09-20, at plan approval): hand to Phase 54
- The planner's measured model shows the crit rule + Herman clear ~9 of ~37 flagged row×band cells; the remainder are the curve's HEIGHT (tier-4 default d6 crit 28 vs a level-4 Magic-User bar of 27.6; every tier-5 row 33–37 vs a level-5 bar of 32.1; ~10 tier-2/3/4 rows over the bar on their own dice), not cliffs.
- Ruling: Phase 52 fixes exactly the two cliffs (whole-sum crit doubling → dice-only; Herman `sp.strikesAs: 5`). NO dice trims in this phase. Every still-flagged row gets an explicit per-row ruling in the AFTER audit table and the ledger: tier 5 → "deliberate deep-tier threat (Endgame band)"; tier 2–4 → "curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff". Nothing is silently skipped.
- Plan 02 Task 3's `checkpoint:decision` is therefore PRE-ANSWERED as `hand-to-54`; the executor records the ruling and continues without pausing. Plan 03 applies it (rulings, no trims).

### Claude's Discretion
- Exact hero setup for the cadence audit (class/level/HP) as long as it is stated in the tool header and the output; N seeds (tens, not hundreds).
- Whether `strikesAs` is read in a tiny helper (`foeLevelBase(f)`) shared by both damage branches (preferred) or inline twice.
- Whether the audit tool reads the median level from the smoke JSON or takes a `--levels` override for reproducibility (both is fine; the committed output must say which).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js#foeTurn` (L2241-2590): per-foe order — summons join → regen → acid/dot ticks → alive/asleep/stupid/stunned skips → `fleesBelow` → the ability gate (`tickAbilityCooldowns`, `firstReadyAbility`, `rng.d(6) <= 4` unless `never_melee`; `resolveFoeAbility(...)` then `continue`) → `swings` loop (member branch L2383-2497, hero branch L2499-2555) → blindFor → ward/mirror/foeEffect/timer ticks.
- Damage formula (hero branch L2541-2552): `dmg = f.lvl * f.lvl + (f.dmgBonus || 0) + (f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6))`; halvings for `C.weakened`, `f.shrunk`, `f.hamstrung`; `if (roll === 1 || (roll <= 2 && c.sub === "Soldier")) dmg *= 2`; then `applyFoeDamageToPlayer(state, f, rng, events, { dmg, roll, need, needMods })`. Member branch (L2460-2472) is the twin with `mRoll === 1`.
- Foe tier: `maxLvl = clamp(Math.min(c.level, state.floor.depth) + curve.foeLvlBias, 1, 5)` (L240), per-foe `lvl = clamp(maxLvl - (rng.d(4) === 1 ? 1 : 0), 1, 5)` (L256); `dmgBonus = foeDmgBonusFor(lvl, curve)` = `round((foePower - 1) × lvl²)`, 0 while `foePower === 1` (depth ≤ 5) (`engine/difficulty.js:470`).
- Bestiary rows (`content/bestiary.js`): Bat/Rat T1 `sp: { atk: 2, dmg: 0d0+1 }`; Stalka Beast T5 `sp: { atk: 2, dmg: 1d4 }`, `abilities: ["stalkaHeal","stalkaLightning","stalkaFireball","stalkaFreeze"]`; China Wolf `sp: { atk: 2, dmg: 1d6 }`; Herman (tiers 4 and 5, L109/L111) `sp: { invis: true, ar: 15, dmg: { n: 0, sides: 0, bonus: 25 }, note: "turns invisible; strikes as a level five" }`.
- Foe kits (`content/foe-abilities.js`): `stalkaFreeze` is a `kind: "bolt"` 1d6 ("flicks a lazy frost… −5 hp" = bolt hit + the INT resist line); `every:` cadence fields; `never_melee` casters (Drudge/Vampire/Stalka?/Krupke — check the header comment L33).
- Hero HP: Magic User `baseWP { base: 25, dice: 1d10 }`, Fighter `{ 50, 1d8 }`, Thief `{ 40, 0 }` (`content/classes.js`), race `wpMul`/`flatWP`; per-level `gain[level-1]` dice via `checkLevel` (`engine/character.js:606-618`).
- Phase 51 tooling to reuse: `tools/initiative-fixture-scan.mjs` (Part B = first divergent action per site vs the prototype, for the current engine), `tools/tune-difficulty.mjs`, `tools/tune-classes.mjs`; the Phase 51 AFTER smoke `docs/class-pass/v17-p51-after-smoke.json` (median hero level by depth is derivable from its cells); ledger heading rules pinned by `test/unit/difficulty-retune-ledger.test.js` (new H3s go under `## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts`).
- Existing crit/damage pins: `test/unit/combat.test.js` (11 crit-related asserts), `test/unit/day-one-damage.test.js`, `test/unit/combat-scaling.test.js`, `test/unit/foe-damage.test.js` (that one is damage TO foes — `engine/foeDamage.js`, unrelated to this phase).
- Ledgers: `content/BESTIARY-REBALANCE.md` (Herman rows L196-197, review verdict L234 "UNCHANGED — flat 25 base damage is explicit rulebook text"; `## Change ledger` L403, `### Phase 27 addendum` L453 — add a Phase 52 addendum in that style), `docs/DIFFICULTY-RETUNE.md`.

### Established Patterns
- Engine gate + greenfield amendment (STATE.md Ground Truth): deliberate divergences declared per moved fixture with measured before/after, only those regenerated, master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` never changes; no dual-path gating; the bot plays the new rules.
- `DELIBERATE RULES CHANGE (Phase 52, DMG-02, 2026-09-20)` comment paragraphs on each changed site, in the style already on `foeTurn`/`rollInitiative`.
- Report tools in `tools/` are exit-0, assertion-free, with committed `-output.txt`; invariants live in `test/unit/*.test.js`.

### Integration Points
- `engine/combat.js` (both damage branches; a `strikesAs` read), `content/bestiary.js` (Herman ×2), `content/foe-abilities.js` (kit notes), new `tools/cadence-audit.mjs` + output, new `tools/damage-curve-audit.mjs` + output, `test/unit/` (cadence pins, Stalka resolver test, crit re-pins), `test/parity/fixtures/*.json` + `divergence-records.test.js` + `FIXTURE-INVENTORY.md`, `content/BESTIARY-REBALANCE.md`, `docs/DIFFICULTY-RETUNE.md`, `docs/class-pass/v17-p52-after-smoke.json`.
- `mazeworld.html` / `src/browser/` are not expected to change (event payloads unchanged; the `struck` narration already shows the number).

</code_context>

<specifics>
## Specific Ideas

- The user's pasted log (`5 vs 5. Stalka Beast hits you for 28 hp.` / `4 vs 5. … 29 hp.` / `Stalka Beast: it lands. −5 hp.` / resist line / `flicks a lazy frost`) is the shape the Stalka resolver test must make impossible within ONE foe turn: 28/29 are tier-5 swings (25 + 1d4), −5 is `stalkaFreeze`.
- Herman "80 on floor 5" = tier-4 Herman crit: 2 × (16 + 25) = 82. After the fixes a tier-4 Herman crit is 25 + 2 × d6 ≤ 37.
- SC1 wording: "A plain foe swings once per round, an `sp.atk: 2` foe swings twice, and a frenzied foe doubles its own swing count — each pinned by a dedicated unit test."
- SC3: attacks-per-player-action for Bat/Rat and China Wolf floor-5 fights ≤ `sp.atk` (≤ 2× if frenzied), committed in `docs/DIFFICULTY-RETUNE.md`.
- SC4: the audit flags any hit ≥ 60 % of a level-appropriate character's max HP; every flagged row (Herman's floor-5 crit among them) fixed and re-measured clean.

</specifics>

<deferred>
## Deferred Ideas

- Joiner level cap (Phase 53) and the four-band curve reshape / tier-3/5 roster decision (Phase 54 — the Herman roster question is TUNE-08; this phase only fixes his damage cliff).
- Player-side crit symmetry (`weaponCrit` at `combat.js:633-639`) — not raised by the user; untouched.
- Ability cadence ×2 past floor 5 (Phase 21 knob) — a Phase 54 dial, not a cadence rule.

</deferred>
