// test/parity/harness/comparables.js
//
// Shared `comparable(state)` transforms and internal-(non-validated)-action
// dispatch helpers for the prototype-parity test suite. Factored out of the
// individual per-domain parity test files (movement-parity.test.js,
// combat-parity.test.js, magic-parity.test.js, economy-parity.test.js) so
// test/parity/full-suite.test.js (ENG-05's phase gate) can reuse the exact
// same closure-vs-data carve-out rules without re-defining them — and,
// critically, WITHOUT importing another `*.test.js` file as a module (which
// would re-execute that file's own top-level `test(...)` registrations a
// second time under node:test).
//
// Every stripping rule here has its rationale documented at length in the
// test file that originally introduced it; see combat-parity.test.js's
// header comment for the BESTIARY `sp.dmg`/`acid.dmg` closure carve-out, and
// economy-parity.test.js's header comment for the store-stock / affliction
// `loss` carve-outs.

import { makeRng } from "../../../engine/rng.js";
import { startCombat } from "../../../engine/combat.js";
import { openStore } from "../../../engine/economy.js";
import { springTrap, openChest, encounterDot } from "../../../engine/encounters.js";
import { descend } from "../../../engine/movement.js";
import { takeItem } from "../../../engine/items.js";
import { applyAction } from "../../../engine/engine.js";
import { diffState } from "./diffState.js";

/** reconcilePendingFind(rest, pendingFind) — ECON-03/04/05 (Phase 13) carve-out
 * for the ONE deliberate divergence this phase introduces. The find callers
 * (engine/encounters.js openChest/findGear/findMisc/meetFaerie) now DEFER the
 * rolled item into state.pendingFind + a `findOffered` event instead of auto-
 * taking it (the player-choice change). The frozen prototype (test/parity/
 * prototype-master.js.txt — DO NOT EDIT) auto-takes via takeItem. Two encounter
 * fixtures actually drive a find path — `chest` (seed 2, rolls a Cloak of Speed
 * into the bag) and `faerie` (seed 38, equips a "Warded leather") — so their
 * post-action c.items / equipped-armor state would otherwise diverge.
 *
 * Rather than editing the master or blanket-stripping c.items (both forbidden),
 * this reconciles the divergence PRECISELY: when a find is pending, it applies
 * the SAME legacy takeItem auto-take the prototype used onto a CLONE of `c`,
 * then compares that. The assertion stays strong and meaningful — it proves the
 * engine offers byte-identically the item the prototype auto-took (same roll,
 * same rng stream) — the ONLY divergence being the take→offer indirection, which
 * the new takeFind/leaveFind actions own (and which no fixture drives). A no-op
 * when pendingFind is null (every non-find scenario, and the economy fixture),
 * and never mutates the real comparison state (operates on a structuredClone). */
function reconcilePendingFind(rest, pendingFind) {
  if (!pendingFind || !rest.c) return rest;
  const proxy = { c: structuredClone(rest.c) };
  takeItem(proxy, structuredClone(pendingFind), []);
  return { ...rest, c: proxy.c };
}

/** stripDarkForField(c) — PHOBIA-01 (04.1-05) adds a brand-new persistent
 * darkness counter (`c.darkFor`, set by engine/encounters.js's fallDark,
 * decremented by engine/movement.js's per-step tick) with NO prototype-side
 * equivalent at all — the frozen prototype (test/parity/
 * prototype-master.js.txt — DO NOT EDIT) never sets this field on chargen or
 * anywhere else. This is a genuine, permanent, deliberate divergence (a new
 * engine-only field), not a fidelity regression, so it is excluded from
 * every state-vs-prototype comparison the same way stripRationsField/
 * stripAfflictionLoss below exclude their own engine-only/closure-vs-data
 * divergences. */
function stripDarkForField(c) {
  if (!c || !("darkFor" in c)) return c;
  const { darkFor, ...rest } = c;
  return rest;
}

/** stripFlightFields(c) — audit-batch1 (2026-09-09, A2) adds two brand-new
 * fields backing the Cloak of Flying's real charge/cooldown resource
 * (`c.flightLeft`/`c.flightCooldown`, set by engine/character.js's
 * rollCharacter and ticked by engine/movement.js's per-step tick) with NO
 * prototype-side equivalent at all — the frozen prototype (test/parity/
 * prototype-master.js.txt — DO NOT EDIT) never sets either field. This is a
 * genuine, permanent, deliberate divergence (a new engine-only field), not a
 * fidelity regression, so both fields are excluded from every state-vs-
 * prototype comparison, mirroring stripDarkForField immediately above (the
 * exact same 04.1-05 precedent this batch's PLAN explicitly asked to
 * follow). */
function stripFlightFields(c) {
  if (!c) return c;
  const { flightLeft, flightCooldown, ...rest } = c;
  return rest;
}

/** stripBagField(c) — ECON-01 (Phase 12, Economy A) adds a brand-new class-
 * derived carry-capacity field (`c.bag`, a plain string assigned at chargen by
 * engine/character.js's rollCharacter) with NO prototype-side equivalent at
 * all — the frozen prototype (test/parity/prototype-master.js.txt — DO NOT
 * EDIT) never sets this field. Like darkFor/flight above, the bag is set as a
 * PLAIN assignment (no rng draw), so the chargen rng-consumption order is
 * unchanged and every OTHER field stays byte-identical — only this new field
 * appears. It is a genuine, permanent, deliberate divergence (a new engine-only
 * field), not a fidelity regression, so it is excluded from every state-vs-
 * prototype comparison, mirroring stripDarkForField / stripFlightFields /
 * stripNameField. */
function stripBagField(c) {
  if (!c || !("bag" in c)) return c;
  const { bag, ...rest } = c;
  return rest;
}

/** stripFoeEffectField — the `c.foeEffect` carve-out. Phase 19 (FOE-03/D-09/D-14) adds `c.foeEffect`, a
 * brand-new engine-only debuff slot (`{ kind, rounds }`, written only by
 * engine/foeAbilities.js when a foe ability lands a debuff, cleared only
 * when set) with NO prototype-side equivalent at all — the frozen prototype
 * (test/parity/prototype-master.js.txt — DO NOT EDIT) never sets this
 * field, and no fixture drives a foe with an `abilities` kit, so no fixture
 * would ever actually carry it. It is carved out here, mirroring
 * stripDarkForField/stripFlightFields/stripBagField immediately above,
 * purely as a tripwire: so a FUTURE caster fixture (or a determinism test
 * reusing this comparable) never reaches the diff on this genuinely new,
 * permanent, deliberate divergence. */
function stripFoeEffectField(c) {
  if (!c || !("foeEffect" in c)) return c;
  const { foeEffect, ...rest } = c;
  return rest;
}

/** stripNameField(c) — DR-name-generator (2026-09-09) makes `c.name` a
 * GENERATIVE first × surname build (engine/character.js's nameFor over the new
 * content/names.js { first, sur } banks) instead of the frozen prototype's
 * flat-pool pick. Both sides make the SAME single rng draw (rng.d(combos) ===
 * one gen.next(), exactly like the old rng.pick), so the draw ORDER is
 * unchanged and every OTHER field stays byte-identical — only the resulting
 * name string differs. That is a deliberate COSMETIC divergence (fixing the
 * device-review "duplicate names" complaint), not a fidelity regression, so
 * `c.name` is excluded from every state-vs-prototype comparison, mirroring
 * stripDarkForField / stripFlightFields / stripRationsField above. The chargen
 * parity tests carve the same field out directly; this keeps the movement/
 * combat/magic/economy comparables (whose `rest.c` still carries name) green
 * too. */
function stripNameField(c) {
  if (!c || !("name" in c)) return c;
  const { name, ...rest } = c;
  return rest;
}

/** stripBagArmorFields — the nested-array c.items[] armor durability carve-
 * out. Phase 28 (ARMOR-03) makes a worn piece carry its remaining durability
 * (`left`) and patch count (`patches`) onto the bag item when it leaves the
 * body (engine/items.js#wornArmorItem); the frozen prototype (test/parity/
 * prototype-master.js.txt — DO NOT EDIT) rebuilds a stowed piece at full and
 * never sets either field. No fixture drives equipItem/unequipSlot (all five
 * inventory actions are pure and fixture-free — see engine/items.js's
 * header), so this is a STRUCTURAL tripwire like stripFoeAbilityState above
 * — a no-op on every current fixture — that keeps a future equip-driving
 * fixture from ever reaching the diff on this deliberate, permanent
 * divergence. Unlike every strip helper above, the new fields live INSIDE
 * c.items[] elements, so this helper maps the array instead of destructuring
 * a top-level key; never mutates the input. */
function stripBagArmorFields(c) {
  if (!c || !Array.isArray(c.items)) return c;
  const items = c.items.map((it) =>
    it && it.kind === "armor" ? (({ left, patches, ...rest }) => rest)(it) : it
  );
  return { ...c, items };
}

/** stripCloakArmorTxt(c) — Phase 28 (ARMOR-04): the Cloak of Armor's `txt`
 * field (content/treasure-tables.js) was rewritten from the frozen
 * prototype's original flavor line to state the soak-as-plate/never-wears/
 * any-class rule plainly. This is a purely COSMETIC content change — `txt`
 * is display-only flavor text, never read by any engine mechanic (confirmed
 * by direct code read) — that a chargen roll landing this cloak in the bag
 * (e.g. the combat-parity `flee` fixture's seed 17) surfaces as a bag-item
 * diff against the frozen prototype-master.js.txt (DO NOT EDIT). Strip it
 * the same way stripNameField strips the generative name string: every
 * OTHER field on the item, and every other item's `txt`, stays byte-
 * identical — only this one item's `txt` is excluded from comparison. */
export function stripCloakArmorTxt(c) {
  if (!c || !Array.isArray(c.items)) return c;
  const items = c.items.map((it) =>
    it && it.n === "Cloak of Armor" && "txt" in it ? (({ txt, ...rest }) => rest)(it) : it
  );
  return { ...c, items };
}

/** movementComparable(state) — strips engine-only bookkeeping and the
 * prototype's presentation-only `beats`. No domain-specific closures to
 * strip (movement never touches combat/store/affliction sub-state), but
 * PHOBIA-01's new `c.darkFor` field (see stripDarkForField above) does need
 * stripping since movement fixtures can exercise fallDark's caller. */
export function movementComparable(state) {
  // PARTY-02 (Phase 7): `state.party` is a brand-new top-level roster field
  // (engine/state.js's newRun) with NO prototype-side equivalent — the frozen
  // prototype-master.js.txt (DO NOT EDIT) never carries a top-level party. It
  // is the top-level analog of stripDarkForField's `c.*` carve-out: strip it at
  // the state destructure the SAME place `beats`/`seed`/`rngState`/`version`
  // (other engine-only top-level fields) are dropped, so an inert/empty party
  // stays byte-identical to the master and a populated one never reaches the
  // diff. Note this strips only the TOP-LEVEL `state.party`; the frozen
  // `c.joiner`/`C.ally` shapes are intentionally left untouched so they keep
  // matching the master.
  // PARTY-01 (Phase 9): `state.pendingJoiner` is a second brand-new top-level
  // field (set by encounters.js#meetJoiner, which IS exercised in encounter
  // fixtures) with NO prototype-side equivalent — strip it exactly like `party`
  // beside it so a stashed candidate never reaches the diff.
  // ECON-02 (Phase 12): strip the new top-level `state.pendingFind` too — a
  // third top-level analog of `party`/`pendingJoiner`, with no prototype-side
  // equivalent (set only by Phase 13's gated find handlers). Strip it beside
  // them so a stashed find never reaches the diff.
  // Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too — a
  // fourth analog of party/pendingJoiner/pendingFind; always false on a
  // fixture (every fixture calls newRun(seed)); the prototype master has no
  // such field.
  const { beats, seed, rngState, version, party, pendingJoiner, pendingFind, dev, ...state0 } = state;
  // ECON-03/04/05 (Phase 13): reconcile a deferred find to the prototype's
  // auto-take before comparing (no-op when none pending). See reconcilePendingFind.
  const rest = reconcilePendingFind(state0, pendingFind);
  // Phase 19 (FOE-01/D-14): a no-op for every movement fixture (movement
  // never carries a live combat), added so D-14's "all three comparables"
  // carve-out holds structurally, not just for combatComparable.
  if (rest.combat) rest.combat = stripFoeAbilityState(rest.combat);
  if (rest.c) rest.c = stripCloakArmorTxt(stripBagArmorFields(stripFoeEffectField(stripNameField(stripFlightFields(stripDarkForField(stripBagField(rest.c)))))));
  return rest;
}

/** stripFoeDamageClosures(combat) — BESTIARY's `sp.dmg`/`acid.dmg` are live
 * closures on the frozen prototype and plain dice-notation on the engine;
 * strip the un-comparable "recipe" field from both sides (the mechanical
 * result — resulting `wp` values — is still fully compared). */
export function stripFoeDamageClosures(combat) {
  if (!combat || !Array.isArray(combat.foes)) return combat;
  const foes = combat.foes.map((f) => {
    const next = { ...f };
    if (next.sp && "dmg" in next.sp) {
      const { dmg, ...spRest } = next.sp;
      next.sp = spRest;
    }
    if (next.acid && "dmg" in next.acid) {
      const { dmg, ...acidRest } = next.acid;
      next.acid = acidRest;
    }
    return next;
  });
  return { ...combat, foes };
}

/** stripFoeAbilityState — the per-foe kit/cooldown/summon-queue carve-out. Phase 19 (FOE-01/FOE-04/FOE-06/D-14) adds
 * per-foe kit/cooldown/uses state (`f.abilities`/`f.cd`/`f.uses`, copied
 * from the bestiary entry at `startCombat` and mutated by
 * engine/foeAbilities.js) and a combat-level summon queue
 * (`combat.pendingFoes`) — both engine-only, written only for the eight
 * caster rows (content/foe-abilities.js), none of which is fixture-exposed
 * (test/parity/FIXTURE-INVENTORY.md: only Bat/Rat, Shriek, Viper, Dante at
 * L1 are fixture-exposed, and none of them carries an `abilities` kit). A
 * no-op on a null/foes-less combat, or on a combat/foe that carries none of
 * these fields (every fixture today) — returned exactly as-is so the
 * `stripFoeDamageClosures` composition immediately below stays the sole
 * source of any actual foe-shape change for those fixtures. */
export function stripFoeAbilityState(combat) {
  if (!combat || !Array.isArray(combat.foes)) return combat;
  const { pendingFoes, ...combatRest } = combat;
  const foes = combatRest.foes.map((f) => {
    const { abilities, cd, uses, ...rest } = f;
    return rest;
  });
  return { ...combatRest, foes };
}

/** combatComparable(state) — combat/magic-parity's shared comparable(). */
export function combatComparable(state) {
  // PARTY-02 (Phase 7): strip the new top-level `state.party` — see
  // movementComparable's rationale above (top-level analog of stripDarkForField;
  // `c.joiner`/`C.ally` left untouched).
  // PARTY-01 (Phase 9): strip the new top-level `state.pendingJoiner` too — see
  // movementComparable's rationale (top-level analog of `party`).
  // ECON-02 (Phase 12): strip the new top-level `state.pendingFind` too — see
  // movementComparable's rationale (top-level analog of `party`/`pendingJoiner`).
  // Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too — a
  // fourth analog of party/pendingJoiner/pendingFind; always false on a
  // fixture (every fixture calls newRun(seed)); the prototype master has no
  // such field.
  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, dev, ...state0 } = state;
  // ECON-03/04/05 (Phase 13): reconcile a deferred find (no-op when none pending).
  const rest = reconcilePendingFind(state0, pendingFind);
  if (rest.combat) {
    const { initNote, round, ...combatRest } = rest.combat; // round: deliberate divergence (round-count fix 2026-09-09, one-per-cycle) — excluded from parity, its only mechanical use (round===1) is preserved+verified via effects
    rest.combat = stripFoeAbilityState(stripFoeDamageClosures(combatRest));
  }
  if (rest.c) rest.c = stripCloakArmorTxt(stripBagArmorFields(stripFoeEffectField(stripNameField(stripFlightFields(stripDarkForField(stripBagField(rest.c)))))));
  return rest;
}

/** applyStartCombat(state, wandering, forced) — the engine-side equivalent
 * of applyAction for the internal (non-validated) startCombat call: clone,
 * rebuild rng from the persisted cursor, run startCombat, persist the rng
 * cursor. Mirrors engine/engine.js's applyAction shape exactly. */
export function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

/** stripStoreClosures(store) — see this module's header + economy-parity's
 * rationale: a live `buy` closure on the prototype can never structurally
 * equal the engine's plain `{effectId, effectParams}` descriptor. */
export function stripStoreClosures(store) {
  if (!store) return store;
  // RATION-01 (04.1-03): "Rations" is a deliberate, engine-only new store
  // line item (see engine/economy.js's STORE_EFFECTS.buyRations) with no
  // prototype-side equivalent — the frozen prototype (test/parity/
  // prototype-master.js.txt) still only sells food, never rations
  // directly. Filter it out of the comparison the same way TERM-02's
  // normalizeHpUnit below handles the wp/hp rename: a permanent,
  // deliberate, documented divergence, not a fidelity regression. The
  // prototype-side stock entries have no `effectId` field at all (they
  // carry a live `buy` closure instead), so this filter is a no-op on
  // that side and only ever removes the engine's extra entry.
  const stock = store.stock
    .filter((s) => s.effectId !== "buyRations")
    .map((s) => ({ n: normalizeHpUnit(s.n), sub: normalizeHpUnit(s.sub ?? null), cost: s.cost, sold: !!s.sold }));
  return { ...store, stock };
}

/** normalizeHpUnit(text) — 04.1-01 (TERM-01/TERM-02) renamed every
 * player-facing hit-point unit from "wp" to "hp", INCLUDING the
 * engine-generated store-row label text this harness compares
 * (engine/economy.js's openStore, the exact site flagged in
 * 04.1-RESEARCH.md's "Provenance/risk split"). test/parity/prototype-
 * master.js.txt is the FROZEN GOLDEN MASTER — DO NOT EDIT — so it still
 * emits the pre-rename "(+12 wp)"/"AR 3, 12 wp" text and always will.
 * That leaves exactly one permanent, deliberate, cosmetic divergence
 * between the two sides' store-stock label strings. Normalizing the unit
 * token on both sides before comparing keeps this parity check meaningful
 * for everything it actually guards (item identity, cost, structure,
 * ordering) without failing forever on a rename the phase intentionally
 * made only on the live/engine side. */
function normalizeHpUnit(text) {
  return typeof text === "string" ? text.replace(/\bwp\b/g, "hp") : text;
}

/** stripAfflictionLoss(c) — an affliction's `loss` is a closure on the
 * prototype (AFFLICTIONS' `loss:()=>D(n)`) and plain dice-notation on the
 * engine; strip it the same way as the foe-damage carve-out above. */
function stripAfflictionLoss(c) {
  if (!c || !c.affliction || !("loss" in c.affliction)) return c;
  const { loss, ...afRest } = c.affliction;
  return { ...c, affliction: afRest };
}

/** stripRationsField(c) — RATION-01 (04.1-03) deliberately decouples ration
 * acquisition from HP-restoring food on the engine side: neither the
 * store's eatRation effect (engine/economy.js) nor the dungeon-tile
 * findFood (engine/encounters.js) silently increments c.rations anymore.
 * The frozen prototype (test/parity/prototype-master.js.txt — DO NOT EDIT)
 * still does, on both paths, because it predates this rules change. This
 * is a genuine, permanent, DELIBERATE gameplay divergence (not a fidelity
 * bug) — so c.rations itself is excluded from this parity comparison,
 * mirroring stripAfflictionLoss's carve-out immediately above and
 * normalizeHpUnit's label carve-out above that. Ration purchases via the
 * new dedicated buyRations effect are exercised by
 * test/unit/economy.test.js instead, not by this prototype-fidelity check. */
function stripRationsField(c) {
  if (!c || !("rations" in c)) return c;
  const { rations, ...rest } = c;
  return rest;
}

/** stripParleyDivergence(state) — PARLEY-01..PARLEY-04 (Phase 20, CONTEXT
 * D-13/D-18) is a DELIBERATE, PERMANENT gameplay divergence, not a fidelity
 * bug swept under the rug: parley's SP payout becomes
 * `round(combat-equivalent × 0.5)` via the shared `killSpFor` helper, the
 * Humans wilmst check tightens to `d6 === 6` (down from `d6 >= 4`), the Con
 * Artist bonus drops from +6 to +4 with `need` clamped to a ceiling of 17,
 * and two new combat-scoped flags (`combat.parleyTried` /
 * `combat.parleyInsulted`) are lazily added. For the ONE parity-exposed
 * parley — `test/parity/fixtures/action-script.combat.json`'s scenario
 * `parley` (seed 303) — this legitimately makes `c.sp` and `c.gold` differ
 * from the frozen prototype (`test/parity/prototype-master.js.txt` — DO NOT
 * EDIT).
 *
 * This stripper is applied ONLY to that one scenario, at BOTH of its parity
 * replay sites — `test/parity/combat-parity.test.js`'s local `comparable()`
 * and `test/parity/full-suite.test.js`'s shared `combatComparable` loop —
 * via a scenario-scoped wrapper chosen when `scenario.name === "parley"`.
 * Every other combat scenario (win/lose/flee), the entire magic fixture,
 * and every other fixture stay byte-identical with NO carve-out; it is not
 * folded into `combatComparable`/`movementComparable`/`economyComparable`
 * themselves, so those keep exposing `c.sp`/`c.gold` for every other
 * comparison.
 *
 * The two flags are stripped defensively: a SUCCESSFUL parley nulls
 * `state.combat` before any post-action comparison happens (both on the
 * prototype and the engine), so for seed 303 specifically only `c.sp`/
 * `c.gold` actually diverge today — the flag strip protects a FUTURE
 * fixture that might capture state mid-fight or after a failed attempt. */
export function stripParleyDivergence(state) {
  const rest = { ...state };
  if (rest.c) {
    const { sp, gold, ...c } = rest.c;
    rest.c = c;
  }
  if (rest.combat) {
    const { parleyTried, parleyInsulted, ...combat } = rest.combat;
    rest.combat = combat;
  }
  return rest;
}

/**
 * stripScenarioDivergence(state, divergence) — FID-06 (Phase 23, "Freeze
 * pays out"): the scenario-scoped analog of `stripParleyDivergence` above,
 * for a fixture whose divergence is declared PER-SCENARIO (an object on the
 * scenario itself) rather than per-seed (a fixture-level map, see
 * `chargenDivergenceFor` below). `test/parity/fixtures/action-script.magic.json`'s
 * `cast-damage` scenario (seed 8) is the ONLY scenario in that fixture that
 * ever casts Freeze — Phase 23 routes a successful Freeze kill through
 * `killFoe` (see `engine/magic.js`'s thrown branch), which legitimately
 * changes `c.sp`/`c.gold`/`c.kills`/`c.rations` versus the frozen prototype.
 * That scenario's own `divergence` record (`fields`/`before`/`after`/
 * `rationale`) is the single source of truth for which fields differ and by
 * how much; this helper is a pure, generic strip — it does not know
 * anything about Freeze specifically, only about "which fields a scenario
 * declared as divergent."
 *
 * Applied at BOTH magic replay sites (`test/parity/magic-parity.test.js`'s
 * local `comparable()` and `test/parity/full-suite.test.js`'s magic
 * sub-test, via `combatComparable`) by selecting this stripper only when
 * `scenario.divergence` is truthy — every other magic scenario (heal,
 * potion, scroll) and every other fixture stays byte-identical with NO
 * strip. Returns `state` completely unchanged when `divergence` is falsy,
 * so a caller can unconditionally do `divergence ? stripScenarioDivergence(s, divergence) : s`.
 * Reuses `stripDeclaredFields` for the actual field removal — the same
 * primitive `chargenDivergenceFor`'s callers already use, just applied to
 * `state.c` after a shallow copy of `state` rather than mutating in place.
 */
export function stripScenarioDivergence(state, divergence) {
  if (!divergence) return state;
  const rest = { ...state };
  if (rest.c) rest.c = stripDeclaredFields(rest.c, divergence.fields);
  return rest;
}

/**
 * actionPathDivergenceOf(holder) — FID-07 (Phase 24, plan 24-02): looks up an
 * "action-path" divergence record on any holder object (a combat scenario, or
 * a script fixture's top level for economy). Unlike Phase 23's field-strip
 * records (`chargenDivergenceFor`/`stripScenarioDivergence` above), an
 * action-path record declares a divergence whose CONSEQUENCE is a changed
 * action path — a flipped combat outcome (Fridgian frenzy no longer whiffing
 * on a corpse), an unaffordable purchase (Pickpocket markup pricing a hero out
 * of a line item) — which cannot be expressed as "these end-of-scenario fields
 * differ" alone, because the per-action byte diff itself would fail partway
 * through the scenario, before the end is ever reached.
 *
 * Returns `holder.divergence` only when its `kind` is exactly `"action-path"`;
 * returns `null` for a missing/falsy `divergence`, and — critically — for a
 * Phase 23-shaped record that has no `kind` field at all (e.g. the magic
 * fixture's `cast-damage` scenario), so `stripScenarioDivergence`'s existing
 * per-action comparison keeps working unmodified for that record. The two
 * record kinds are mutually exclusive on any one holder: a holder either
 * declares "these fields differ at the end" (Phase 23) or "the action path
 * itself diverges from this index on, and these fields differ at the end"
 * (Phase 24), never a hybrid.
 */
export function actionPathDivergenceOf(holder) {
  return holder?.divergence?.kind === "action-path" ? holder.divergence : null;
}

/**
 * skipsByteDiffAt(divergence, actionIndex) — true when the per-action byte
 * diff for `actionIndex` should be SKIPPED because an action-path divergence
 * record (see `actionPathDivergenceOf` above) declares the action path itself
 * diverges from `divergence.fromAction` onward (inclusive). `false` for every
 * index before `fromAction`, and `false` whenever no record is present (or
 * `fromAction` is not a plain integer) — a caller can therefore always write
 * `if (!skipsByteDiffAt(pathDiv, i)) { assert the byte diff }` unconditionally,
 * with zero behavior change when `pathDiv` is null (the no-op case this plan
 * must prove for every fixture today).
 */
export function skipsByteDiffAt(divergence, actionIndex) {
  return !!divergence && Number.isInteger(divergence.fromAction) && actionIndex >= divergence.fromAction;
}

/**
 * pickFields(obj, keys) — internal helper for declaredEndDiffs: a shallow
 * `{ key: obj?.[key] }` snapshot for each name in `keys`. A no-op-shaped
 * `{}` when `keys` is empty/undefined.
 */
function pickFields(obj, keys) {
  const out = {};
  for (const key of keys ?? []) out[key] = obj?.[key];
  return out;
}

/**
 * declaredEndDiffs(protoState, engineState, divergence) — FID-07 (Phase 24,
 * plan 24-02): the end-of-scenario half of an action-path record's contract.
 * An action-path record skips the PER-ACTION byte diff from `fromAction`
 * onward (see `skipsByteDiffAt`), so it must instead prove — machine-checked,
 * not merely stripped — that both sides ended up exactly where the record
 * says they would: the prototype's declared `fields` (read from `state.c`,
 * optionally merged with `stateFields` read from the top-level state, e.g.
 * `dead`) must equal the record's `before`/`stateBefore`, and the engine's
 * must equal `after`/`stateAfter`.
 *
 * Returns `{ before, after }`, where each is the result of `diffState` (never
 * a bare `assert.deepStrictEqual` — see 23-02's cross-realm lesson: the
 * prototype's `c` fields can live in a `node:vm` sandbox realm) comparing the
 * MEASURED snapshot against the DECLARED one; a caller asserts both are
 * `null`. A record with an empty (or missing) `fields` array is malformed —
 * it declares nothing to check — and throws a clear `Error` rather than
 * silently passing.
 */
export function declaredEndDiffs(protoState, engineState, divergence) {
  const fields = divergence?.fields;
  if (!fields || fields.length === 0) {
    throw new Error("declaredEndDiffs: an action-path divergence record must declare a non-empty `fields` array");
  }
  const stateFields = divergence.stateFields ?? [];

  const measuredBefore = { ...pickFields(protoState?.c, fields), ...pickFields(protoState, stateFields) };
  const measuredAfter = { ...pickFields(engineState?.c, fields), ...pickFields(engineState, stateFields) };
  const declaredBefore = { ...divergence.before, ...divergence.stateBefore };
  const declaredAfter = { ...divergence.after, ...divergence.stateAfter };

  return {
    before: diffState(measuredBefore, declaredBefore),
    after: diffState(measuredAfter, declaredAfter),
  };
}

/**
 * PRICEFOR_ROUTED_EFFECTS — FID-07 (Phase 24, plan 24-02): the `openStore`
 * (engine/economy.js) stock lines whose cost is computed via `priceFor(base,
 * race)` — the same race-price hook a sub-class markup (e.g. the Pickpocket
 * bad, 24-04) would also apply to. Food (`eatRation`), potions
 * (`givePotion`), lockpicks (`giveLockpicks`), and a Magic User's scroll
 * (`buyScroll`) are all flat-priced for every race (never passed through
 * `priceFor`), so they are deliberately excluded from this list — a sub-class
 * price markup must never apply to them.
 */
export const PRICEFOR_ROUTED_EFFECTS = ["buyWeapon", "buyArmor", "buyPremium", "buyRations", "repairArmor"];

/**
 * stockMarkupDiff(protoStore, engineStore, mul) — FID-07 (Phase 24, plan
 * 24-02): proves an engine store's stock is the prototype's IDENTICAL roll
 * (same names, same order, same subs) with EVERY `PRICEFOR_ROUTED_EFFECTS`
 * line's cost multiplied by `mul` and every other line's cost unchanged.
 * Reuses `stripStoreClosures` on both sides (same buyRations-drop / wp-hp
 * normalization / n-sub-cost-sold reduction economy-parity.test.js's own
 * comparable already relies on), so a markup fixture's store-roll identity is
 * checked with the exact same rigor as an unmarked-up one. The "is this line
 * routed?" flag is read from the RAW engine stock (filtered the same
 * buyRations-drop way `stripStoreClosures` applies) since only the engine
 * side carries an `effectId` at all.
 *
 * Returns `null` when the two stripped stocks have the same length and,
 * for every index `i`: `n`/`sub`/`sold` are equal, and `cost` satisfies —
 * a routed line: `engine.cost === Math.max(1, Math.round(proto.cost * mul))`;
 * any other line: `engine.cost === proto.cost`. Otherwise returns a
 * human-readable string naming the first mismatching index, e.g.
 * `"stock[8].cost: expected 656 (525 x 1.25), got 525"`.
 *
 * Assumes the prototype's cost is an integer at every routed index — true for
 * every non-Elven/Dwarven hero (the only race case a markup record may
 * declare; Elven/Dwarven's own `priceFor` halving already produces a
 * `Math.round`-ed integer on the prototype side too, so this holds generally,
 * but a markup declaration should stick to non-Elven/Dwarven seeds per the
 * plan's note).
 */
export function stockMarkupDiff(protoStore, engineStore, mul) {
  const protoStock = stripStoreClosures(protoStore)?.stock ?? [];
  const engineStock = stripStoreClosures(engineStore)?.stock ?? [];
  const engineRouted = (engineStore?.stock ?? [])
    .filter((s) => s.effectId !== "buyRations")
    .map((s) => PRICEFOR_ROUTED_EFFECTS.includes(s.effectId));

  if (protoStock.length !== engineStock.length) {
    return `stock.length: expected ${protoStock.length}, got ${engineStock.length}`;
  }

  for (let i = 0; i < protoStock.length; i++) {
    const p = protoStock[i];
    const e = engineStock[i];
    if (p.n !== e.n) return `stock[${i}].n: expected ${JSON.stringify(p.n)}, got ${JSON.stringify(e.n)}`;
    if (p.sub !== e.sub) return `stock[${i}].sub: expected ${JSON.stringify(p.sub)}, got ${JSON.stringify(e.sub)}`;
    if (p.sold !== e.sold) return `stock[${i}].sold: expected ${p.sold}, got ${e.sold}`;
    const routed = !!engineRouted[i];
    const expectedCost = routed ? Math.max(1, Math.round(p.cost * mul)) : p.cost;
    if (e.cost !== expectedCost) {
      return routed
        ? `stock[${i}].cost: expected ${expectedCost} (${p.cost} x ${mul}), got ${e.cost}`
        : `stock[${i}].cost: expected ${expectedCost}, got ${e.cost}`;
    }
  }
  return null;
}

/**
 * chargenDivergenceFor(fixture, seed) — FID-06 (Phase 23, CONTEXT "Fixture
 * handling"): looks up the seed-scoped divergence record (if any) from a
 * chargen fixture's top-level `divergences` map (see
 * test/parity/fixtures/action-script.schema.md). Mirrors
 * `stripParleyDivergence`'s precedent — this phase's chargen fixture
 * (`action-script.chargen.json`) carries exactly two such records (seeds 15
 * and 24), each declaring a MEASURED, deliberate grimoire content change
 * (IDENT-02's guaranteed-attack top-up; IDENT-03's Summoner-at-level-1
 * override), never a blanket carve-out. Every seed without a record — every
 * Fighter/Thief seed, and every Magic User whose book already had an attack
 * spell — is compared byte-identically with NO strip. Applied at BOTH
 * chargen replay sites (test/parity/chargen-parity.test.js's main loop and
 * test/parity/full-suite.test.js's chargen sub-test) so neither site can
 * silently drift from the other's divergence handling. Returns `null` when
 * the fixture has no `divergences` map or no record for this seed.
 */
export function chargenDivergenceFor(fixture, seed) {
  return fixture?.divergences?.[String(seed)] ?? null;
}

/**
 * stripDeclaredFields(c, fields) — the seed-scoped/field-scoped strip that
 * pairs with chargenDivergenceFor above: returns a shallow copy of `c`
 * without the keys named in `fields` (a record's own `fields` array). A
 * no-op (returns `c` unchanged) when `fields` is empty/undefined/null, or
 * when `c` itself is falsy. Applied to BOTH sides (prototype and engine)
 * immediately AFTER the record's own before/after assertions have already
 * proven the divergence is exactly what was declared — so this never masks
 * an UNDECLARED difference, it only removes a field whose declared,
 * measured divergence has already been asserted.
 */
export function stripDeclaredFields(c, fields) {
  if (!c || !fields || fields.length === 0) return c;
  const rest = { ...c };
  for (const f of fields) delete rest[f];
  return rest;
}

/** economyComparable(state) — economy/encounters-parity's shared comparable(). */
export function economyComparable(state) {
  // PARTY-02 (Phase 7): strip the new top-level `state.party` — see
  // movementComparable's rationale above (top-level analog of stripDarkForField;
  // `c.joiner`/`C.ally` left untouched).
  // PARTY-01 (Phase 9): strip the new top-level `state.pendingJoiner` too — see
  // movementComparable's rationale (top-level analog of `party`).
  // ECON-02 (Phase 12): strip the new top-level `state.pendingFind` too — see
  // movementComparable's rationale (top-level analog of `party`/`pendingJoiner`).
  // Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too — a
  // fourth analog of party/pendingJoiner/pendingFind; always false on a
  // fixture (every fixture calls newRun(seed)); the prototype master has no
  // such field.
  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, dev, ...state0 } = state;
  // ECON-03/04/05 (Phase 13): reconcile a deferred find to the prototype's
  // auto-take before comparing — the `chest` (seed 2) and `faerie` (seed 38)
  // encounters fixtures drive a find path; no-op elsewhere. See reconcilePendingFind.
  const rest = reconcilePendingFind(state0, pendingFind);
  if (rest.store) rest.store = stripStoreClosures(rest.store);
  // Phase 19 (FOE-01/D-14): a no-op for every economy/encounters fixture
  // (neither family carries a live combat), added so D-14's "all three
  // comparables" carve-out holds structurally, not just for combatComparable.
  if (rest.combat) rest.combat = stripFoeAbilityState(rest.combat);
  if (rest.c) rest.c = stripCloakArmorTxt(stripBagArmorFields(stripFoeEffectField(stripNameField(stripFlightFields(stripDarkForField(stripBagField(stripRationsField(stripAfflictionLoss(rest.c)))))))));
  return rest;
}

/** applyInternal(state, fn) — the shared clone/rng-rehydrate/persist shape
 * for every internal (non-validated) function a fixture drives directly. */
function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

const INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

/**
 * runEconomyAction(ctx, engineState, action) — dispatches one economy/
 * encounters fixture action against BOTH the prototype sandbox (`ctx`) and
 * the engine, returning the engine's `{state, events}`. Handles the
 * internal-call action types (openStore/springTrap/openChest/encounterDot/
 * descend) plus the validated buyItem/leaveStore actions.
 */
export function runEconomyAction(ctx, engineState, action) {
  if (action.type in INTERNAL_FNS) {
    ctx[action.type]();
    return applyInternal(engineState, INTERNAL_FNS[action.type]);
  }
  if (action.type === "buyItem" || action.type === "leaveStore") {
    ctx[action.type === "buyItem" ? "buyFrom" : "leaveStore"](action.idx);
    return applyAction(engineState, action);
  }
  throw new Error(`unhandled economy/encounters fixture action type: ${action.type}`);
}
