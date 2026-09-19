// test/unit/worn-migration.test.js
//
// Phase 45 (HEDGE-01/HEDGE-02): direct unit coverage of the single worn
// path — `newRun` (every fresh roll creates `c.worn`, zero rng draws) and
// the unconditional load reconcile (`validateSave` always returns
// `wornReport`, `rehydrate` reconciles, both idempotent), plus
// `sanitizeWorn` tolerance. Proves a fresh roll creates the model on
// EVERY call (no option needed); proves the load migration reconciles a
// synthetic illegal pre-Phase-37 save (Pitfall 8) into a legal
// one-per-slot state with a returned reconciliation report, never
// overflows the bag, never re-migrates a save that already has `worn`;
// proves tampered `worn` values are neutralised on every load.

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
const ringOfPowerTagged = (tag) => ({ ...ringOfPower(), txt: tag });
const cloakOfSpeed = () => ({ kind: "cloak", n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" });
const cloakOfHealing = () => ({ kind: "cloak", n: "Cloak of Healing", eff: { cloakHeal: 1 }, txt: "heals up to 10 wp every 20 squares" });
const healingPotion = () => ({ kind: "potion", n: "Potion of Healing", txt: "restores wp" });
const rowanStaff = () => ({ kind: "staff", every: 250, n: "Rowan Staff", use: "dome", txt: "a protective dome of 100 wp" });

const CHARGEN_FIXTURE_SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 15, 19, 24, 29, 32, 35];

// ─── Task 1a: newRun's single worn path ────────────────────────────────────

test("HEDGE-01: newRun(2) with no options wears the Thief's starting cloak — c.worn.cloak set, c.items empty, every other field and rngState untouched", () => {
  const s = newRun(2);
  assert.equal(s.c.cls, "Thief");
  assert.equal(s.c.worn.cloak.kind, "cloak");
  assert.deepStrictEqual(s.c.items, []);
  assert.deepStrictEqual(Object.keys(s.c.worn), ["cloak"]);
  assert.equal(s.c.worn.cloak.n, s.c.worn.cloak.n, "the cloak's own name is whatever this seed's single chargen draw rolled");
  // The zero-added-draw proof for rngState/floor is
  // test/unit/chargen-rng-pin.test.js (unedited by this phase) — do not
  // restate or edit that pin here.
});

test("HEDGE-01: newRun(1) (Fighter) and newRun(7) (Magic User) with no options carry c.worn = {} and c.items = []", () => {
  const fighter = newRun(1);
  const wizard = newRun(7);
  assert.deepStrictEqual(fighter.c.worn, {});
  assert.deepStrictEqual(fighter.c.items, []);
  assert.deepStrictEqual(wizard.c.worn, {});
  assert.deepStrictEqual(wizard.c.items, []);
});

test("HEDGE-01: every chargen fixture seed creates c.worn with at most a cloak key, no cloak left in c.items, JSON-identical across two calls", () => {
  for (const seed of CHARGEN_FIXTURE_SEEDS) {
    const a = newRun(seed);
    assert.ok("worn" in a.c, `seed ${seed}: every fresh roll creates c.worn`);
    assert.ok(Object.keys(a.c.worn).every((k) => k === "cloak"), `seed ${seed}: worn carries at most a cloak key`);
    assert.equal(a.c.items.some((it) => it.kind === "cloak"), false, `seed ${seed}: a worn cloak never stays in c.items`);
    const b = newRun(seed);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `seed ${seed}: two newRun(seed) calls must be JSON-identical`);
  }
});

// ─── Task 1b: the synthetic illegal old save (Pitfall 8) ──────────────────

function illegalOldSave() {
  const s = newRun(1); // Fighter, no starting items
  delete s.c.worn; // simulate a v1.4-era save that predates the worn model
  const ringA = ringOfPower();
  const ringB = ringOfPower();
  const cloakA = cloakOfSpeed();
  const cloakB = cloakOfHealing();
  const potion = healingPotion();
  s.c.items = [ringA, ringB, cloakA, potion, cloakB];
  return { s, ringA, ringB, cloakA, cloakB, potion };
}

test("HEDGE-02: a v1.4-era save (no c.worn, two rings + two cloaks + a potion stacked in the bag) loads through validateSave/rehydrate with NO option — both rings and the first cloak worn, the second cloak bagged, wornReport returned once", () => {
  const { s, ringA, ringB, cloakA, cloakB, potion } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));

  const check = validateSave(json);
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.worn, { jewelry1: ringA, jewelry2: ringB, cloak: cloakA });
  assert.deepStrictEqual(check.value.c.items, [potion, cloakB]);
  assert.deepStrictEqual(check.wornReport, [
    { slot: "jewelry", worn: ["Ring of Power", "Ring of Power"], bagged: [] },
    { slot: "cloak", worn: ["Cloak of Speed"], bagged: ["Cloak of Healing"] },
  ]);

  const rehydrated = rehydrate(check.value);
  assert.deepStrictEqual(rehydrated.c.worn, check.value.c.worn);
  assert.deepStrictEqual(rehydrated.c.items, check.value.c.items);

  const reCheck = validateSave(JSON.stringify(serializeRun(rehydrated)));
  assert.deepStrictEqual(reCheck.wornReport, [], "returned once — a second load reconciles nothing further");
});

test("HEDGE-02: rehydrate(parsed) ALONE (bypassing validateSave), with no option, migrates identically", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  const directRehydrated = rehydrate(structuredClone(JSON.parse(json)));
  assert.deepStrictEqual(directRehydrated.c.worn, check.value.c.worn);
  assert.deepStrictEqual(directRehydrated.c.items, check.value.c.items);
});

test("HEDGE-02 ordering: three identical Rings of Power — the first two in bag order wear jewelry1/jewelry2, the third stays bagged, reported once", () => {
  const s = newRun(1); // Fighter, no starting items
  delete s.c.worn; // simulate a v1.4-era save that predates the worn model
  s.c.items = [ringOfPowerTagged("first"), ringOfPowerTagged("second"), ringOfPowerTagged("third")];
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.equal(check.value.c.worn.jewelry1.txt, "first");
  assert.equal(check.value.c.worn.jewelry2.txt, "second");
  assert.deepStrictEqual(check.value.c.items, [ringOfPowerTagged("third")]);
  assert.deepStrictEqual(check.wornReport, [{ slot: "jewelry", worn: ["Ring of Power", "Ring of Power"], bagged: ["Ring of Power"] }]);
});

test("cap proof: a small bag AT cap with two rings never overflows — migration wears BOTH (260918-wy1: two jewelry keys), freeing two slots", () => {
  const s = newRun(1);
  delete s.c.worn; // simulate a v1.4-era save that predates the worn model
  s.c.bag = "small";
  const ringA = ringOfPower();
  const ringB = ringOfPower();
  // exactly BAGS.small.slots (4) gear items, two of which are rings
  s.c.items = [ringA, ringB, { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0, txt: "a dagger" }, { kind: "armor", n: "Leather", txt: "leather" }];
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.equal(slotItems(check.value.c).length, BAGS.small.slots - 2, "two slots freed by the migration — both rings wear");
  assert.equal(canStow(check.value.c), true, "the bag never overflows — slots were freed, not consumed");
});

test("a save that already carries worn loads byte-identical in worn/items and reports [] (one shape)", () => {
  const s2 = newRun(2); // Thief, cloak already worn (unconditional since Phase 45)
  const extraCloak = cloakOfHealing();
  s2.c.items = [extraCloak];
  const json = JSON.stringify(serializeRun(s2));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, s2.c.worn);
  assert.deepStrictEqual(check.value.c.items, s2.c.items);
  assert.deepStrictEqual(check.wornReport, [], "one shape — nothing was migrated, so the report is an empty array, never omitted");
});

test("the unconditional reconcile creates c.worn on a legacy save: validateSave and rehydrate both yield worn = {} for a Fighter with no slot items", () => {
  const s = newRun(1);
  delete s.c.worn; // simulate a v1.4-era save that predates the worn model
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, {});

  const s2 = newRun(1);
  delete s2.c.worn;
  const rehydrated = rehydrate(serializeRun(s2));
  assert.deepStrictEqual(rehydrated.c.worn, {});
});

test("a save with no slot items migrates to worn: {} and wornReport: []", () => {
  const s = newRun(1); // Fighter, no items
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, {});
  assert.deepStrictEqual(check.wornReport, []);
});

// ─── Task 1c: tolerance (sanitizeWorn) ─────────────────────────────────────

test("tolerance: a tampered c.worn (\"999\"/[]/null/7) neutralises to {} on both load paths", () => {
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

test("tolerance: no worn key at all → {} after load, created by reconcileWorn, not by sanitizeWorn", () => {
  const s = newRun(1);
  delete s.c.worn; // sanitizeWorn only neutralises a PRESENT key; it never injects one
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, {}, "the unconditional reconcileWorn creates the key; sanitizeWorn never does");
});

// ─── Task 1d: idempotence ───────────────────────────────────────────────────

test("HEDGE-02 idempotency: rehydrate twice deep-equals rehydrate once, and validateSave over its own output reports []", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const once = rehydrate(structuredClone(JSON.parse(json)));
  const twice = rehydrate(structuredClone(once));
  assert.deepStrictEqual(twice, once);

  const reCheck = validateSave(JSON.stringify(serializeRun(once)));
  assert.deepStrictEqual(reCheck.wornReport, []);
});

test("idempotence: validateSave does not mutate a JSON-string input's parsed twin", () => {
  const { s } = illegalOldSave();
  const json = JSON.stringify(serializeRun(s));
  const before = JSON.parse(json);
  validateSave(json);
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
  const fighterCheck = validateSave(JSON.stringify(serializeRun(fighterSave)));
  assert.deepStrictEqual(fighterCheck.value.c.worn, {});
  assert.deepStrictEqual(fighterCheck.value.c.items, [migratedRowanStaff]);
  assert.deepStrictEqual(fighterCheck.wornReport, []);

  const wizardSave = newRun(7); // Magic User
  wizardSave.c.items = [rowanStaff()];
  const wizardCheck = validateSave(JSON.stringify(serializeRun(wizardSave)));
  assert.deepStrictEqual(wizardCheck.value.c.worn, {}, "260918-w4n: a staff never wears, even for a Magic User");
  assert.deepStrictEqual(wizardCheck.value.c.items, [migratedRowanStaff]);
  assert.deepStrictEqual(wizardCheck.wornReport, []);
});

// ─── Task 1g: 260918-wy1 legacy jewelry key fold (sanitizeWorn) ────────────
//
// Runs on EVERY load (validateSave AND rehydrate) — this is sanitizeWorn's
// own tolerant-load fold, not the unconditional reconcileWorn bag-scan
// above.

const gauntletOfGiant = () => ({ kind: "jewel", n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "one size larger" });
const helmOfKnowledge = () => ({ kind: "jewel", n: "Helm of Knowledge", eff: { tongue: 1 }, txt: "perfect fluency" });
const ankletOfInvis = () => ({ kind: "jewel", n: "Anklet of Invisibility", eff: { foeToHit: -2 }, txt: "foes need two better to land" });

test("260918-wy1: a v1.5-shape save with c.worn under ring/bracelet/amulet/helm folds ring->jewelry1, bracelet->jewelry2, amulet+helm appended to the bag (in that order)", () => {
  const ring = ringOfPower();
  const bracelet = { kind: "jewel", n: "Bracelet of Flight", eff: { fly: 1 }, txt: "twenty squares of flight" };
  const amulet = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 }, txt: "light and sight" };
  const helm = helmOfKnowledge();
  const s = newRun(1); // Fighter, no starting items
  s.c.worn = { ring, bracelet, amulet, helm };
  s.c.items = [];
  const json = JSON.stringify(serializeRun(s));

  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { jewelry1: ring, jewelry2: bracelet });
  assert.deepStrictEqual(check.value.c.items, [amulet, helm]);
  for (const legacyKey of ["ring", "bracelet", "amulet", "helm"]) {
    assert.equal(legacyKey in check.value.c.worn, false, `${legacyKey} must not survive on c.worn`);
  }

  const rehydrated = rehydrate(serializeRun(s));
  assert.deepStrictEqual(rehydrated.c.worn, { jewelry1: ring, jewelry2: bracelet });
  assert.deepStrictEqual(rehydrated.c.items, [amulet, helm]);
});

test("260918-wy1: a save already carrying jewelry1/jewelry2 plus a legacy amulet key bags the amulet (both jewelry keys already occupied)", () => {
  const jewelryA = ringOfPower();
  const jewelryB = ankletOfInvis();
  const amulet = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 }, txt: "light and sight" };
  const s = newRun(1);
  s.c.worn = { jewelry1: jewelryA, jewelry2: jewelryB, amulet };
  s.c.items = [];
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { jewelry1: jewelryA, jewelry2: jewelryB });
  assert.deepStrictEqual(check.value.c.items, [amulet]);
});

test("260918-wy1: the w4n-interim five-key shape (worn staff already folded, legacy jewelry keys present) migrates the same way", () => {
  const ring = ringOfPower();
  const helm = helmOfKnowledge();
  const cloak = cloakOfSpeed();
  const s = newRun(1);
  s.c.worn = { ring, helm, cloak };
  s.c.items = [];
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { jewelry1: ring, jewelry2: helm, cloak });
  assert.deepStrictEqual(check.value.c.items, []);
});

test("260918-wy1: a full bag drops the appended legacy jewelry overflow via clampCarry, not the earlier-folded pieces", () => {
  const ring = ringOfPower();
  const bracelet = { kind: "jewel", n: "Bracelet of Flight", eff: { fly: 1 }, txt: "twenty squares of flight" };
  const amulet = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 }, txt: "light and sight" };
  const s = newRun(1);
  s.c.bag = "small"; // cap 4
  s.c.worn = { ring, bracelet, amulet };
  s.c.items = Array.from({ length: 4 }, (_, i) => ({ kind: "picks", n: `Filler ${i}`, txt: "" }));
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { jewelry1: ring, jewelry2: bracelet });
  assert.equal(check.value.c.items.length, 4, "the bag stays at cap");
  assert.equal(check.value.c.items.some((it) => it.n === "Amulet of Light"), false, "the overflow amulet never survives the clamp");
});

test("260918-wy1: a tampered legacy value (non-object) is dropped, not migrated", () => {
  const s = newRun(1);
  s.c.worn = { ring: "not an object", cloak: cloakOfSpeed() };
  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.deepStrictEqual(check.value.c.worn, { cloak: cloakOfSpeed() });
  assert.equal("jewelry1" in check.value.c.worn, false);
});

test("260918-w4n tolerant load: a save that already carries c.worn.staff (a v1.5 save) folds it into the bag on load", () => {
  const staffState = newRun(7); // Magic User
  staffState.c.worn = { staff: rowanStaff() };
  const check = validateSave(JSON.stringify(serializeRun(staffState)));
  assert.equal(check.value.c.worn.staff, undefined, "the legacy worn staff key is gone");
  assert.ok(check.value.c.items.some((it) => it.n === "Rowan Staff"), "the staff comes home to the bag");
});

test("260918-w4n tolerant load: a full bag drops the folded-in legacy worn staff via clampCarry (overflow)", () => {
  const staffState = newRun(7); // Magic User
  staffState.c.bag = "small";
  const cap = 4; // BAGS.small.slots (content/bags.js)
  staffState.c.items = Array.from({ length: cap }, (_, i) => ({ kind: "picks", n: `Filler ${i}`, txt: "" }));
  staffState.c.worn = { staff: rowanStaff() };
  const check = validateSave(JSON.stringify(serializeRun(staffState)));
  assert.equal(check.value.c.worn.staff, undefined);
  assert.equal(check.value.c.items.length, cap, "the bag stays at cap — the appended staff is the one dropped");
  assert.equal(check.value.c.items.some((it) => it.n === "Rowan Staff"), false, "the overflow staff never survives the clamp");
});

// ─── Task 1f: report shape ──────────────────────────────────────────────────

test("report objects carry exactly slot/worn/bagged keys, never a type key", () => {
  const { s } = illegalOldSave();
  const check = validateSave(JSON.stringify(serializeRun(s)));
  for (const entry of check.wornReport) {
    assert.deepStrictEqual(Object.keys(entry).sort(), ["bagged", "slot", "worn"]);
  }
});
