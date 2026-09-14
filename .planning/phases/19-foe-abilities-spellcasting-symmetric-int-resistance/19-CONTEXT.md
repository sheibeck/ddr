# Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss — 4 grey areas proposed as batch tables, all accepted by the user.

<domain>
## Phase Boundary

Foes gain a data-driven ability system: a pure `content/foe-abilities.js` registry referenced by id from a new `abilities` array on select `content/bestiary.js` entries, resolved each foe turn by a pure `engine/foeAbilities.js` resolver with five kinds — bolt, drain, debuff, heal, summon — bounded by per-encounter caps / every-N cooldowns, telegraphed in the Oracle the turn they fire, and resisted by the hero's Intelligence through ONE shared resistance helper (the same canon rule foes already use against the player). CANON-02 lands here (Drake every-4 breath, Drudge never-melee, Spectre pursuit). Every new serialized field is carved out of the three `*Comparable()` functions and old saves still load (FID-04). Requirements: FOE-01..FOE-09, CANON-02, FID-04. Out of scope: any new UI screen; incapacitation state machines (grapple/entangle/possess/enthrall/awe); attribute drain; pack AI; `daggerOnly`; difficulty.js changes (Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Ability Model & Canon Kits (FOE-01, FOE-05, FOE-06)
- **D-01:** Registry = `content/foe-abilities.js`, a flat PURE-DATA array of descriptors `{ id, kind, lvl, dmg?, effect?, every?, uses?, txt }` (no functions — `content-is-pure-data` guard). Bestiary entries reference abilities by id via a new `abilities: [ids]` array; the field is ABSENT on every non-caster creature and is the structural zero-draw gate. `sp.caster` stays inert (never read by code).
- **D-02:** Five ability kinds: **bolt** (dice damage delivered through `applyFoeDamageToPlayer` — ward/armor/Hardiness/halfNext apply), **drain** (WP drain: bypasses armor but not ward; heals the foe by the amount applied, capped at `maxWP`), **debuff** (timed `c.foeEffect`), **heal** (self, dice, capped at `maxWP`), **summon** (one reinforcement joining next round).
- **D-03:** Canon kits, rulebook-first, with every single ability's expected damage capped at ~50% of a level-N hero's expected HP at that tier (use `tools/bestiary-yardstick.mjs`'s hero HP figures): Krupke (lvl 1–2: Freeze bolt d6, Weaken debuff) · Drudge (lvl 1–4: Freeze / Fireball / Lightning bolts + Weaken; `never_melee`) · Djinni (lvl 1–4 bolts + a daze debuff, `uses: 4` per ability per encounter, **flees at <25% HP** — a `foeFled` exit that removes it from the fight, no XP) · Vampire (drain + Fireball/Lightning bolts + summon a Walking Dead tier-2) · Stalka Beast (lvl 1–5 bolts + heal, unlimited) · Drake (fire-breath bolt `every: 4`, CANON-02). Exact dice per ability at planner discretion within the cap; no Mangle-class one-shots.
- **D-04:** Cast policy: on its turn a foe WITH `abilities` and at least one ready ability rolls `rng.d(6)`: ≤ 4 → cast the FIRST ready ability in kit order (deterministic, no pick roll), else melee as today. `never_melee` foes always cast without the d6; if nothing is ready they emit `foeOutOfSpells` and skip (no draw). Foes without `abilities` take the exact pre-Phase-19 path (zero extra draws — FID-02 pins must stay identical).

### Bounds, Telegraph & Resistance (FOE-06, FOE-07, CANON-02)
- **D-05:** Cooldown/cap state lives on the foe, created lazily on first cast: `f.cd = { [id]: roundsLeft }` for `every: N` abilities (ticks down each foe turn) and `f.uses = { [id]: n }` for `uses: N` caps. "Per day" (Djinni 4×/day) is approximated as per ENCOUNTER.
- **D-06:** Telegraph = the turn an ability fires, push `foeCast { name, ability, kind }` BEFORE its effect events (Oracle: "The Drudge's fingers crackle… → Lightning: 11"). No one-round-ahead charging state. Fairness valve = the D-03 ~50%-HP cap.
- **D-07:** ONE shared resistance helper `resistRoll(rng, intel) → { resisted, roll }` exported from `engine/magic.js`; `castSpell`'s existing inline foe-resist block (`t.intel >= 12 → rng.d(20) < t.intel`) is refactored to call it with the SAME single d20 (draw-neutral; parity byte-identical). Foe abilities call it for the hero: `c.intel >= 12 → d20 < c.intel`, and the roll fires ONLY when a resistible ability actually fires. Resistible kinds: bolt, drain, debuff (a resisted bolt/drain does 0, a resisted debuff does nothing). heal/summon are self-targeted — no roll.
- **D-08 (CANON-02):** Drake — breath is a `bolt` with `every: 4` (fires rounds 4, 8, …). Drudge — `never_melee` → always casts (D-04). Spectre — `sp.pursues`: when the hero SUCCEEDS at fleeing from a fight containing a live `pursues` foe, that foe gets ONE free melee strike as the hero leaves (drawn only in that branch; `foePursued` event); no re-engagement state.

### Debuff, Drain, Heal & Summon Semantics (FOE-02, FOE-03, FOE-04, FOE-08)
- **D-09:** `c.foeEffect` is ONE slot `{ kind, rounds }` (default `null`): a new debuff replaces the old (same kind refreshes rounds); ticks down at the END of each foe turn; cleared in `endCombat` (combat-scoped — never leaks between fights); surfaced by `conditionsOf` as `{ key: "foeEffect", polarity: "bad", kind, remaining }` so the existing chip row renders it with zero new UI; `foeEffectFaded` event when it expires.
- **D-10:** Two debuff kinds: **weakened** — the hero's dealt damage is halved (`Math.ceil`, mirror of the foe-side `C.weakened`); **dazed** — the hero's to-hit need is lowered by 2 (min 1). Duration `d4` rounds (drawn only when the debuff lands).
- **D-11:** Drain = WP only (no attribute drain in v1.1). Dice damage through the ward but bypassing armor (no soak roll), can reduce the hero to 0 (it is damage → `die` path), heals the foe by the amount actually applied.
- **D-12:** Summon = descriptor `{ kind: "summon", type, tier }`; the resolver `rng.pick`s a bestiary entry of that type/tier (gated draw) and queues it on `C.pendingFoes`; at the START of the next `foeTurn` (before any foe acts) it is appended to `C.foes` — mirrors the `c.pendingAlly → C.ally` precedent — with `lvl = max(1, summonerLvl − 1)`, no `abilities` (no recursion), full normal accounting (kills, XP split, parley). Caps: at most 1 pending at a time; no summon when live foes ≥ 4.

### Party, Parity, Saves & Narration (FOE-09, FID-04, FOE-08)
- **D-13:** Targeting: bolt and drain pick their target through the existing `pickFoeTarget` (hero or a live party member). On a member they use the simplified member path (no ward/armor/resist roll — members have no `intel` check) and can down the member exactly like a melee hit. Debuffs (and the drain's heal side) always target the hero; heal/summon are untargeted. Each ability's plan states its member behavior explicitly.
- **D-14:** New serialized state — foe: `abilities` (copied from the bestiary entry at `startCombat` ONLY when the entry has it), lazy `cd` / `uses`; hero: `c.foeEffect` (null default); combat: `C.pendingFoes`. All carved out in `combatComparable` / `movementComparable` / `economyComparable` via named strippers (pattern: `stripDarkForField` in `test/parity/harness/comparables.js`); `saveState` loading tolerates their absence (old saves default them); a v1.0-shaped save JSON fixture round-trips in a test (FID-04). `test/parity/prototype-master.js.txt` and fixtures untouched.
- **D-15:** Determinism proof: new `test/determinism/foe-abilities.test.js` forcing Magical / Demons / Walking Dead / Humans-tier-2 / Beasts-tier-5 encounters at pinned seeds, asserting replay-identical events + state and pinning each caster's per-turn draw counts; the FID-02 `countingRng` test gains cases proving ability-less foes still draw exactly the baseline (0/1/2/2/3/6 and 12/101/111/66/32 unchanged).
- **D-16:** Narration — new event types each with a sarcastic, family-friendly `EVENT_NARRATION` line (coverage guard + voice safety scan): `foeCast` (generic + per-kind flavor using the ability's `txt`), `foeBolted` (only if not reusing `struckByFoe`), `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `foeEffectFaded`, `heroResisted`, `heroResistFailed`, `foeFled`, `foePursued`, `foeOutOfSpells`. A bolt that lands may reuse the existing `struckByFoe` event/toast with an `ability` field rather than a new type — planner's call, but every new type needs an entry.

### Claude's Discretion
- Exact dice per ability within the D-03 cap; exact registry ids; whether `engine/foeAbilities.js` resolves everything itself or delegates bolts to `applyFoeDamageToPlayer` and drains to a small shared helper; test file layout; the order of `C.pendingFoes` join vs. regen/acid ticks at the top of `foeTurn` (must be before any foe acts and must not change draw order for ability-less fights).
- Whether Djinni's flee check happens at the start of its own turn (recommended: yes, before casting) or after taking damage.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js`: `foeTurn` (~980+) with Phase 17's `pickFoeTarget(state, rng)` and `applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need }) → { died, onArmour }`; `startCombat` (98) builds foes from bestiary entries (copy `abilities` here); `flee` (~470) for the Spectre hook; `endCombat` (~641) for clearing `c.foeEffect`; `killFoe` (409); `liveFoes`; the `c.pendingAlly → C.ally` join precedent at 169–186; `C.weakened` (foe-side weaken) at the damage lines — mirror for the hero-side `weakened`.
- `engine/magic.js`: inline foe-resist block at ~86–97 (`RESIST_IMMUNE_KINDS`, `t.intel >= 12`, `rng.d(20) < t.intel`, `spellResisted` / `resistFailed` events) → refactor into `resistRoll`. Spell dice shapes in `content/spells.js` (Freeze d6, Fireball 2d10+4, Lightning d10+6, Ice d6) to borrow for bolt dice.
- `engine/foeDamage.js` (Phase 18): `damageFoe` — foes healing themselves must respect `maxWP`; drains that heal the foe should use a direct `wp = min(maxWP, wp + n)` (not the damage seam).
- `engine/derived.js`: `conditionsOf` (139) — add the `foeEffect` chip; `strikeDie`/`toHit` for the dazed penalty; `engine/death.js` `die`.
- `engine/saveState.js`: load/validation — tolerate missing new fields.
- `test/parity/harness/comparables.js`: `stripDarkForField` / `stripFlightFields` / `stripBagField` naming pattern for carve-outs; `stripFoeDamageClosures` for per-foe fields.
- `test/unit/foe-turn-draw-count.test.js` (`countingRng`), `test/unit/party-combat.test.js` (`fakeRng`, `fixedFighter`, `fixedFloor`), `test/unit/foe-damage.test.js`; `test/determinism/` suite for replay-identity tests.
- `src/browser/eventNarration.js` `EVENT_NARRATION` + `test/unit/formatEventsCoverage.test.js` + `test/voice/safety-scan.test.js`.
- `tools/bestiary-yardstick.mjs` — hero expected HP per tier for the D-03 cap.

### Established Patterns
- Zero-draw gates on fields absent from parity paths; `DELIBERATE RULES CHANGE (Phase N, REQ)` comments; every new event type narrated; pure content tables; named carve-outs; `node:test` + `assert/strict`; Windows: `npm test` or explicit file paths.

### Integration Points
- Phase 18's discounted caster stats are the base the kits sit on; Phase 21 retunes ability threat via `difficulty.js` and the bot.
- Phase 20's parley pass must account for `foeFled` (Djinni) not paying XP.

</code_context>

<specifics>
## Specific Ideas

- Oracle lines should name the ability in the game's deadpan voice ("The Djinni sighs theatrically and lobs a fireball. It's not personal.") and stay toast-length.
- Djinni fleeing is content, not a loss: the epitaph/Oracle should sell it ("The Djinni recalls an urgent appointment on another Plane.").

</specifics>

<deferred>
## Deferred Ideas

- Attribute drain (Strength/Intelligence, restored at `newDay`) → backlog.
- Incapacitation state machines (grapple / entangle / possess / enthrall / awe-as-stun) → FOE-V2-01.
- One-round-ahead "charging" telegraph → revisit in Phase 21 if the DR round finds bolts feel unfair.
- Spectre re-engagement (`pendingPursuer`) → backlog if the free strike feels too weak.
- Party members resisting spells / having `intel` → FOE-V2 / Phase 21.
- Formal threat budget → FOE-V2-04.

</deferred>
