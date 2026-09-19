// test/unit/worn-migration.test.js
//
// Phase 37 Plan 03 (GEAR-03/GEAR-04) — direct unit coverage for the two
// pieces that make the worn model REACHABLE: `newRun(seed, exclude,
// { wornSlots: true })` (engine/state.js — the shell-only new-run option)
// and the option-gated load-time migration (engine/saveState.js's
// `validateSave`/`rehydrate`, `options.wornSlots`). Proves the option
// creates the model on a fresh shell run without shifting the seeded
// chargen cursor; proves the load migration reconciles a synthetic illegal
// pre-Phase-37 save (Pitfall 8) into a legal one-per-slot state with a
// returned reconciliation report, never overflows the bag, never
// re-migrates a save that already has `worn`, and never injects `worn` on
// a load/newRun call that doesn't pass the option; proves tampered `worn`
// values are neutralised on every load.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { BAGS } from "../../content/index.js";
import { slotItems } from "../../engine/derived.js";
import { canStow } from "../../engine/items.js";

// ─── fixtures: synthetic jewelry/cloak/potion literals (no `slot` key ever
// spread onto a constructed item — content/treasure-tables.js's own rule) ──

const ringOfPower = () => ({ kind: "jewel", n: "Ring of Power", eff: { dmg: 1 }, txt: "+1 damage to all attacks" });
const cloakOfSpeed = () => ({ kind: "cloak", n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" });
const cloakOfHealing = () => ({ kind: "cloak", n: "Cloak of Healing", eff: { cloakHeal: 1 }, txt: "heals up to 10 wp every 20 squares" });
const healingPotion = () => ({ kind: "potion", n: "Potion of Healing", txt: "restores wp" });
const rowanStaff = () => ({ kind: "staff", every: 250, n: "Rowan Staff", use: "dome", txt: "a protective dome of 100 wp" });

const CHARGEN_FIXTURE_SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 15, 19, 24, 29, 32, 35];

// ─── Task 1a: newRun's wornSlots option ────────────────────────────────────

test("newRun(2, [], { wornSlots: true }) creates c.worn wearing the Thief's starting cloak; c.items empties; every other field matches newRun(2)", () => {
  const a = newRun(2, [], { wornSlots: true });
  const b = newRun(2);
  assert.ok("worn" in a.c, "the option creates an own worn key");
  assert.equal(a.c.worn.cloak.n, b.c.items[0].n);
  assert.deepStrictEqual(a.c.items, []);
  assert.equal(a.rngState, b.rngState, "no rng draw added");
  assert.deepStrictEqual(a.floor, b.floor, "no rng draw added");
  const { worn: aWorn, items: aItems, ...aRest } = a.c;
  const { items: bItems, ...bRest } = b.c;
  assert.deepStrictEqual(aRest, bRest, "every OTHER c field is untouched");
});

test("newRun(1, [], { wornSlots: true }) (Fighter) and newRun(7, [], { wornSlots: true }) (Magic User) both get c.worn = {} (no starting slot item)", () => {
  const fighter = newRun(1, [], { wornSlots: true });
  const wizard = newRun(7, [], { wornSlots: true });
  assert.deepStrictEqual(fighter.c.worn, {});
  assert.deepStrictEqual(wizard.c.worn, {});
});

test("newRun(seed) (no option) never creates worn for every chargen fixture seed; two calls are JSON-identical", () => {
  for (const seed of CHARGEN_FIXTURE_SEEDS) {
    const a = newRun(seed);
    assert.ok(!("worn" in a.c), `seed ${seed}: no option must never create c.worn`);
    const b = newRun(seed);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `seed ${seed}: two newRun(seed) calls must be JSON-identical`);
  }
});

test("newRun(seed, [], { storeRoll: true }) alone (no wornSlots) does not create c.worn", () => {
  const s = newRun(2, [], { storeRoll: true });
  assert.ok(!("worn" in s.c));
});

// ─── Task 1b: the synthetic illegal old save (Pitfall 8) ──────────────────

function illegalOldSave() {
  const s = newRun(1); // Fighter, no starting items
  const ringA = ringOfPower();
  const ringB = ringOfPower();
  const cloakA = cloakOfSpeed();
  const cloakB = cloakOfHealing();
  const potion = healingPotion();
  s.c.items = [ringA, ringB, cloakA, potion, cloakB];
  return { s, ringA, ringB, cloakA, cloakB, potion };
}

test("Pitfall 8: validateSave(json, { wornSlots: true }) reconciles two rings + two cloaks into worn/bagged with a matching report", () => {
  const { s, ringA, ringB, cloakA, cloakB, potion } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));

  const check = validateSave(json, { wornSlots: true });
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.worn, { ring: ringA, cloak: cloakA });
  assert.deepStrictEqual(check.value.c.items, [ringB, potion, cloakB]);
  assert.deepStrictEqual(check.wornReport, [
    { slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power"] },
    { slot: "cloak", worn: "Cloak of Speed", bagged: ["Cloak of Healing"] },
  ]);
});

test("Pitfall 8: rehydrate(check.value, { wornSlots: true }) after validateSave never re-migrates (same worn/items)", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json, { wornSlots: true });
  const rehydrated = rehydrate(check.value, { wornSlots: true });
  assert.deepStrictEqual(rehydrated.c.worn, check.value.c.worn);
  assert.deepStrictEqual(rehydrated.c.items, check.value.c.items);
});

test("Pitfall 8: rehydrate(parsed, { wornSlots: true }) ALONE (bypassing validateSave) migrates identically", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json, { wornSlots: true });
  const directRehydrated = rehydrate(structuredClone(JSON.parse(json)), { wornSlots: true });
  assert.deepStrictEqual(directRehydrated.c.worn, check.value.c.worn);
  assert.deepStrictEqual(directRehydrated.c.items, check.value.c.items);
});

test("cap proof: a small bag AT cap with two rings never overflows — migration only frees a slot", () => {
  const s = newRun(1);
  s.c.bag = "small";
  const ringA = ringOfPower();
  const ringB = ringOfPower();
  // exactly BAGS.small.slots (4) gear items, two of which are rings
  s.c.items = [ringA, ringB, { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0, txt: "a dagger" }, { kind: "armor", n: "Leather", txt: "leather" }];
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json, { wornSlots: true });
  assert.equal(slotItems(check.value.c).length, BAGS.small.slots - 1, "one slot freed by the migration");
  assert.equal(canStow(check.value.c), true, "the bag never overflows — a slot was freed, not consumed");
});

test("a save WITH worn already is never re-migrated — a bagged extra cloak stays bagged, no wornReport key", () => {
  const s2 = newRun(2, [], { wornSlots: true }); // Thief, cloak already worn
  const extraCloak = cloakOfHealing();
  s2.c.items = [extraCloak];
  const json = JSON.stringify(serializeRun(s2));
  const check = validateSave(json, { wornSlots: true });
  assert.deepStrictEqual(check.value.c.worn, s2.c.worn);
  assert.deepStrictEqual(check.value.c.items, s2.c.items);
  assert.ok(!("wornReport" in check), "wornReport must not be an own key when nothing was migrated");
});

test("never injected without the option: validateSave/rehydrate on a legacy save never create c.worn", () => {
  const s = newRun(1);
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.ok(!("worn" in check.value.c));
  const rehydrated = rehydrate(serializeRun(newRun(1)));
  assert.ok(!("worn" in rehydrated.c));
});

test("a save with no slot items migrates to worn: {} and wornReport: []", () => {
  const s = newRun(1); // Fighter, no items
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json, { wornSlots: true });
  assert.deepStrictEqual(check.value.c.worn, {});
  assert.deepStrictEqual(check.wornReport, []);
});

// ─── Task 1c: tolerance (sanitizeWorn) ─────────────────────────────────────

test("tolerance: a tampered c.worn (\"999\"/[]/null/7) neutralises to {} on both load paths without the option", () => {
  for (const tampered of ["999", [], null, 7]) {
    const s = newRun(1);
    s.c.worn = tampered;
    const json = JSON.stringify(serializeRun(s));

    const check = validateSave(json);
    assert.deepStrictEqual(check.value.c.worn, {}, `validateSave: tampered value ${JSON.stringify(tampered)} must neutralise to {}`);

    const rehydrated = rehydrate(serializeRun(s));
    assert.deepStrictEqual(rehydrated.c.worn, {}, `rehydrate: tampered value ${JSON.stringify(tampered)} must neutralise to {}`);
  }
});

test("tolerance: a c.worn entry that is a non-object is dropped; a genuine entry survives", () => {
  const s = newRun(1);
  s.c.worn = { ring: "not an object", cloak: cloakOfSpeed() };
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { cloak: cloakOfSpeed() });
});

test("tolerance: no worn key at all stays no worn key (sanitizeWorn never injects)", () => {
  const s = newRun(1);
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.ok(!("worn" in check.value.c));
});

// ─── Task 1d: idempotence ───────────────────────────────────────────────────

test("idempotence: rehydrate(rehydrate(x, opt), opt) deepStrictEqual rehydrate(x, opt)", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const once = rehydrate(structuredClone(JSON.parse(json)), { wornSlots: true });
  const twice = rehydrate(structuredClone(once), { wornSlots: true });
  assert.deepStrictEqual(twice, once);
});

test("idempotence: validateSave does not mutate a JSON-string input's parsed twin", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const before = JSON.parse(json);
  validateSave(json, { wornSlots: true });
  const after = JSON.parse(json);
  assert.deepStrictEqual(after, before, "validateSave must not mutate a separately-parsed twin of its own JSON-string input");
});

// ─── Task 1e: staff class gate ─────────────────────────────────────────────

test("staff gate (260918-w4n): a staff ALWAYS stays bagged with no report entry — for a Fighter AND a Magic User (it has no slot)", () => {
  // Phase 39 (GEAR-02): validateSave's foldLegacyCounters strips the legacy
  // `every`/`usedAt` staff fields and gives a missing `charges` a full pool
  // (Rowan Staff's real pool is 2) — the migrated item is no longer
  // byte-identical to the input literal.
  const migratedRowanStaff = { kind: "staff", n: "Rowan Staff", use: "dome", txt: "a protective dome of 100 wp", charges: 2 };

  const fighterSave = newRun(1); // Fighter
  fighterSave.c.items = [rowanStaff()];
  const fighterCheck = validateSave(JSON.stringify(serializeRun(fighterSave)), { wornSlots: true });
  assert.deepStrictEqual(fighterCheck.value.c.worn, {});
  assert.deepStrictEqual(fighterCheck.value.c.items, [migratedRowanStaff]);
  assert.deepStrictEqual(fighterCheck.wornReport, []);

  const wizardSave = newRun(7); // Magic User
  wizardSave.c.items = [rowanStaff()];
  const wizardCheck = validateSave(JSON.stringify(serializeRun(wizardSave)), { wornSlots: true });
  assert.deepStrictEqual(wizardCheck.value.c.worn, {}, "260918-w4n: a staff never wears, even for a Magic User");
  assert.deepStrictEqual(wizardCheck.value.c.items, [migratedRowanStaff]);
  assert.deepStrictEqual(wizardCheck.wornReport, []);
});

test("260918-w4n tolerant load: a save that already carries c.worn.staff (a v1.5 save) folds it into the bag on load", () => {
  const staffState = newRun(7); // Magic User
  staffState.c.worn = { staff: rowanStaff() };
  const check = validateSave(JSON.stringify(serializeRun(staffState)), { wornSlots: true });
  assert.equal(check.value.c.worn.staff, undefined, "the legacy worn staff key is gone");
  assert.ok(check.value.c.items.some((it) => it.n === "Rowan Staff"), "the staff comes home to the bag");
});

test("260918-w4n tolerant load: a full bag drops the folded-in legacy worn staff via clampCarry (overflow)", () => {
  const staffState = newRun(7); // Magic User
  staffState.c.bag = "small";
  const cap = 4; // BAGS.small.slots (content/bags.js)
  staffState.c.items = Array.from({ length: cap }, (_, i) => ({ kind: "picks", n: `Filler ${i}`, txt: "" }));
  staffState.c.worn = { staff: rowanStaff() };
  const check = validateSave(JSON.stringify(serializeRun(staffState)), { wornSlots: true });
  assert.equal(check.value.c.worn.staff, undefined);
  assert.equal(check.value.c.items.length, cap, "the bag stays at cap — the appended staff is the one dropped");
  assert.equal(check.value.c.items.some((it) => it.n === "Rowan Staff"), false, "the overflow staff never survives the clamp");
});

// ─── Task 1f: report shape ──────────────────────────────────────────────────

test("report objects carry exactly slot/worn/bagged keys, never a type key", () => {
  const { s } = illegalOldSave();
  const check = validateSave(JSON.stringify(serializeRun(s)), { wornSlots: true });
  for (const entry of check.wornReport) {
    assert.deepStrictEqual(Object.keys(entry).sort(), ["bagged", "slot", "worn"]);
  }
});
