// test/unit/store-rows.test.js
//
// Phase 61 (STORE-02, STORE-03): storeRowState(c, line) is the ONE view
// model a store stock row reads to decide whether BUY is disabled, why
// (when the row itself carries the reason — a gold shortfall is already
// named by the price column), and the explained upgrade-or-not advice
// line on a weapon/armor/premium row. Built on the engine's own
// storeBuyRefusal (Plan 03, engine/economy.js) and lootCompare (Plan 02/
// this module) — never a restated rule, so the row can never disagree
// with what tapping BUY would actually do.
//
// Task 2's DOM assertions live in the "DOM render" section near the
// bottom: renderStoreScreen paints the Spiked Staff row enabled with its
// compare line, and an illegal Broadsword row disabled with its can't-use
// reason.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { openStore, storeBuyRefusal } from "../../engine/economy.js";
import { bagCap, slotItems } from "../../engine/items.js";
import { WEAPONS, ARMORS } from "../../content/index.js";
import { storeRowState, STORE_ROW_COPY, lootCompare, itemStatLines, armorDisplay } from "../../src/browser/viewModels.js";
import { renderStoreScreen } from "../../src/browser/storeScreen.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

// ─── Fixtures (mirrors test/unit/store-delivery.test.js's own shapes) ─────

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: null, race: "Human", level: 3, sp: 0,
    maxWP: 60, wp: 45, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 3, armorMin: 1, armorWP: 12, armorMax: 12, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    rations: 6, gold: 100000, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    bag: "large", // 8 slots — plenty of room unless a test caps it down
    ...overrides,
  };
}

const GEAR = (n) => ({ kind: "gear", n });

/** Stock-line / item builders mirroring engine/economy.js#openStore's own
 * shapes (weaponLine/armorLine, mk) — that module's own helpers are not
 * exported, so these are hand-built to the SAME contract. */
const mkStock = (n, cost, effectId, effectParams, sub = null, sold = false) => ({
  n, sub, cost, effectId, effectParams: effectParams ?? null, sold,
});

function weaponItem(base, opts = {}) {
  return { kind: "weapon", n: opts.n ?? base, base, bonus: opts.bonus ?? 0, txt: opts.txt ?? WEAPONS[base].lab };
}
function armorItem(name, opts = {}) {
  const a = ARMORS.find((x) => x.name === name);
  const ar = opts.ar ?? a.ar;
  const wp = opts.wp ?? a.wp;
  return { kind: "armor", n: opts.n ?? name, armor: name, ar, wp, min: opts.min ?? a.min, cls: opts.cls ?? a.cls, txt: opts.txt ?? `AR ${ar}` };
}
const weaponLine = (item, cost = 100, sold = false) => mkStock(item.n, cost, "buyWeapon", { item }, item.txt, sold);
const armorLine = (item, cost = 100, sold = false) => mkStock(item.n, cost, "buyArmor", { item }, `AR ${item.ar}, ${item.wp} hp`, sold);

// ─── The Spiked Staff row (STORE-03 acceptance, store-row half) ───────────

test("Spiked Staff row: enabled, no refusal, no reasonText, the explained compareLine ending 'not an upgrade'", () => {
  const base = newRun(7);
  const c = { ...base.c, level: 3, weapon: "Quarter Staff", prof: 0, magicWpn: 0, gold: 500 };
  const item = weaponItem("Spiked Staff", { txt: "d8" });
  const line = weaponLine(item, 100);

  const rs = storeRowState(c, line);
  assert.deepStrictEqual(rs, {
    disabled: false,
    refusal: null,
    reasonText: null,
    // Phase 74 (ROLL-02/03): the to-hit term now states which way it goes
    // and names the wielded weapon (Quarter Staff).
    compareLine: "d8 vs your d6 · −1 to hit, worse than your Quarter Staff · 4.1 vs 5.0 a swing · not an upgrade",
    showUsable: true,
  });
});

// ─── Illegal / bag-full / gold-short / sold / non-gear rows ───────────────

test("an illegal weapon (wrongClass) row is disabled, reasonText mirrors lootCompare's can't-use line, no compareLine, showUsable false", () => {
  const c = fixedFighter({ cls: "Magic User", sub: null, weapon: "Quarter Staff" });
  const item = weaponItem("Broadsword");
  const line = weaponLine(item, 200);

  const rs = storeRowState(c, line);
  assert.equal(rs.disabled, true);
  assert.equal(rs.refusal.reason, "wrongClass");
  assert.equal(rs.reasonText, lootCompare(c, item).line);
  assert.ok(rs.reasonText.startsWith("can't use ("), `expected a can't-use reason, got "${rs.reasonText}"`);
  assert.equal(rs.compareLine, null);
  assert.equal(rs.showUsable, false);
});

test("a full bag + a not-better weapon: disabled, refusal bagFull, reasonText === STORE_ROW_COPY.bagFull", () => {
  const c = fixedFighter({ weapon: "Broadsword", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] }); // 4/4 slots
  const item = weaponItem("Dagger"); // not better than the wielded Broadsword
  const line = weaponLine(item, 50);

  const rs = storeRowState(c, line);
  assert.equal(rs.disabled, true);
  assert.equal(rs.refusal.reason, "bagFull");
  assert.equal(rs.reasonText, STORE_ROW_COPY.bagFull);
});

test("a full bag + lockpicks: disabled, refusal bagFull, reasonText === STORE_ROW_COPY.bagFull", () => {
  const c = fixedFighter({ bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] }); // 4/4 slots
  const line = mkStock("Set of lockpicks", 450, "giveLockpicks", { item: { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" } }, "opens boxes on 1–5");

  const rs = storeRowState(c, line);
  assert.equal(rs.disabled, true);
  assert.equal(rs.refusal.reason, "bagFull");
  assert.equal(rs.reasonText, STORE_ROW_COPY.bagFull);
});

test("a full bag + an UPGRADE weapon: enabled (the trade-in frees no new slot), compareLine ends ' · upgrade'", () => {
  const c = fixedFighter({ weapon: "Dagger", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] }); // 4/4 slots
  const item = weaponItem("Long Sword"); // an upgrade over the wielded Dagger
  const line = weaponLine(item, 200);

  const rs = storeRowState(c, line);
  assert.equal(rs.disabled, false);
  assert.equal(rs.refusal, null);
  assert.ok(rs.compareLine.endsWith(" · upgrade"), `expected compareLine to end " · upgrade", got "${rs.compareLine}"`);
});

test("gold short on a food line: disabled, refusal insufficientGold, reasonText null (the price column already says it)", () => {
  const c = fixedFighter({ gold: 0 });
  const line = mkStock("Meal (+15 hp)", 20, "eatRation", { wp: 15 });

  const rs = storeRowState(c, line);
  assert.equal(rs.disabled, true);
  assert.equal(rs.refusal.reason, "insufficientGold");
  assert.equal(rs.reasonText, null);
  assert.equal(rs.compareLine, null);
});

test("a sold line: disabled, refusal null, reasonText null, compareLine null, showUsable true", () => {
  const c = fixedFighter();
  const item = weaponItem("Long Sword");
  const line = weaponLine(item, 200, true); // already sold

  const rs = storeRowState(c, line);
  assert.deepStrictEqual(rs, { disabled: true, refusal: null, reasonText: null, compareLine: null, showUsable: true });
});

test("non-gear lines (food, potion, rations, repair, scroll, tool) always have compareLine null", () => {
  const c = fixedFighter();
  const lines = [
    mkStock("Meal (+15 hp)", 20, "eatRation", { wp: 15 }),
    mkStock("Healing potion", 20, "givePotion", { item: { kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 } }),
    mkStock("Rations (+1 ration)", 20, "buyRations", { amount: 1 }),
    mkStock("Repair your cloth", 20, "repairArmor", null),
    mkStock("Sealed scroll", 900, "buyScroll", null),
    mkStock("Torch", 20, "giveTool", { item: { kind: "tool", tool: "torch", n: "Torch", txt: "lights the dark" } }),
  ];
  for (const line of lines) {
    const rs = storeRowState(c, line);
    assert.equal(rs.compareLine, null, `${line.effectId}: expected compareLine null`);
  }
});

// ─── Purity ─────────────────────────────────────────────────────────────

test("purity: storeRowState mutates neither c nor line, and two calls deep-equal", () => {
  const c = fixedFighter({ cls: "Magic User", sub: null, weapon: "Quarter Staff" });
  const item = weaponItem("Spiked Staff", { txt: "d8" });
  const line = weaponLine(item, 100);
  const cBefore = structuredClone(c);
  const lineBefore = structuredClone(line);

  const rs1 = storeRowState(c, line);
  const rs2 = storeRowState(c, line);

  assert.deepStrictEqual(c, cBefore);
  assert.deepStrictEqual(line, lineBefore);
  assert.deepStrictEqual(rs1, rs2);
});

// ─── STORE_ROW_COPY: frozen, family-friendly, no wp/WP ────────────────────

test("STORE_ROW_COPY is frozen and every leaf is family-friendly and free of wp/WP", () => {
  assert.ok(Object.isFrozen(STORE_ROW_COPY));
  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const PLAYER_WP = /\bwp\b/i;
  for (const [key, value] of Object.entries(STORE_ROW_COPY)) {
    assert.equal(typeof value, "string", `${key} must be a string`);
    for (const term of BANNED) {
      const re = new RegExp("\\b" + escapeRegExp(term) + "\\b", "i");
      const m = value.match(re);
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `STORE_ROW_COPY.${key} contains banned term "${m && m[0]}"`);
    }
    assert.doesNotMatch(value, PLAYER_WP, `STORE_ROW_COPY.${key} must not say wp/WP`);
  }
});

// ─── Agreement sweep: storeRowState never disagrees with the engine ───────

test("agreement sweep: across seeds/classes/gold-levels/bag-states, disabled === (line.sold || storeBuyRefusal(c, line) !== null), and buyItem emits 'bought' iff enabled", () => {
  const seeds = [1, 2, 3, 4, 5, 6]; // covers Fighter/Thief/Magic User across newRun's own class roll
  const goldModes = ["zero", "exact", "flush"];
  const bagModes = ["empty", "full"];
  let pairs = 0;

  for (const seed of seeds) {
    const base = newRun(seed);
    const stockState = structuredClone(base);
    openStore(stockState, makeRng(stockState.rngState), []);
    const stock = stockState.store.stock;

    for (const goldMode of goldModes) {
      for (const bagMode of bagModes) {
        for (let idx = 0; idx < stock.length; idx++) {
          const line = structuredClone(stock[idx]);
          const c = structuredClone(base.c);

          if (goldMode === "zero") c.gold = 0;
          else if (goldMode === "exact") c.gold = line.cost;
          else c.gold = 99999;

          if (bagMode === "full") {
            c.items = c.items || [];
            let guard = 0;
            while (slotItems(c).length < bagCap(c) && guard < 64) {
              c.items.push(GEAR(`pad ${c.items.length}`));
              guard++;
            }
          } else {
            c.items = [];
          }

          const rs = storeRowState(c, line);
          const expectedDisabled = !!line.sold || storeBuyRefusal(c, line) !== null;
          assert.equal(rs.disabled, expectedDisabled, `seed ${seed} ${goldMode}/${bagMode} idx ${idx} (${line.n})`);

          // On a clone, applyAction buyItem on that idx emits "bought" iff !disabled.
          const cloneState = structuredClone(stockState);
          cloneState.c = c;
          cloneState.store.stock[idx] = line;
          const { events } = applyAction(cloneState, { type: "buyItem", idx });
          const bought = events.some((e) => e.type === "bought");
          assert.equal(bought, !rs.disabled, `seed ${seed} ${goldMode}/${bagMode} idx ${idx} (${line.n}) bought-vs-enabled`);

          pairs++;
        }
      }
    }
  }
  assert.ok(pairs >= 100, `expected at least 100 (hero, line) pairs, got ${pairs}`);
});

// ─── DOM render (Task 2) ───────────────────────────────────────────────────

test("DOM: renderStoreScreen renders the Spiked Staff row enabled with its compare line, and an illegal Broadsword row disabled with its can't-use reason", () => {
  const base = newRun(7);
  const c = { ...base.c, level: 3, weapon: "Quarter Staff", prof: 0, magicWpn: 0, gold: 500, items: [] };
  const spikedStaff = weaponItem("Spiked Staff", { txt: "d8" });
  const broadsword = weaponItem("Broadsword"); // illegal for the seed-7 Magic User
  const state = {
    ...base,
    c,
    store: { stock: [weaponLine(spikedStaff, 100), weaponLine(broadsword, 200)], haggle: 1, race: c.race },
  };

  const rec = createRecordingDocument();
  const host = rec.document.createElement("div");
  renderStoreScreen(host, state, {});

  const shelf = rec.elementsById.get("shelf");
  assert.ok(shelf, "expected the #shelf element to exist after render");
  const staffRow = shelf.children.find((row) => row.innerHTML.includes("Spiked Staff"));
  const swordRow = shelf.children.find((row) => row.innerHTML.includes("Broadsword"));
  assert.ok(staffRow, "expected the Spiked Staff row to render");
  assert.ok(swordRow, "expected the Broadsword row to render");

  assert.equal(staffRow.disabled, false, "the Spiked Staff row must not be disabled");
  assert.ok(
    // Phase 74 (ROLL-02/03): the to-hit term now states which way it goes
    // and names the wielded weapon (Quarter Staff).
    staffRow.innerHTML.includes("d8 vs your d6 · −1 to hit, worse than your Quarter Staff · 4.1 vs 5.0 a swing · not an upgrade"),
    `expected the Spiked Staff row to show the explained compare line, got: ${staffRow.innerHTML}`,
  );

  assert.equal(swordRow.disabled, true, "the illegal Broadsword row must be disabled");
  assert.ok(swordRow.innerHTML.includes("can't use ("), `expected the Broadsword row to show its can't-use reason, got: ${swordRow.innerHTML}`);
});

// ─── Phase 71 (POLISH-06, D-04): item rows read the ONE stat formatter ────

function renderRows(c, stock) {
  const base = newRun(7);
  const state = { ...base, c, store: { stock, haggle: 1, race: c.race } };
  const rec = createRecordingDocument();
  const host = rec.document.createElement("div");
  renderStoreScreen(host, state, {});
  return rec.elementsById.get("shelf").children;
}

test("DOM (Phase 71): an item line's italic segment is itemStatLines' texts joined by ' · ', then the compare line", () => {
  const c = fixedFighter({ weapon: "Dagger" });
  const sword = weaponItem("Long Sword");
  const plate = armorItem("Plate");
  const [swordRow, plateRow] = renderRows(c, [weaponLine(sword, 200), armorLine(plate, 300)]);
  for (const [row, item, line] of [[swordRow, sword, weaponLine(sword, 200)], [plateRow, plate, armorLine(plate, 300)]]) {
    const seg = itemStatLines(item, c).map((l) => l.text).join(" · ");
    const rs = storeRowState(c, line);
    const expected = [seg, rs.compareLine, rs.reasonText].filter(Boolean).join(" · ");
    assert.ok(row.innerHTML.includes(`<i>${expected}</i>`), `expected <i>${expected}</i>, got ${row.innerHTML}`);
  }
  // Durability reads the formatter's "left/max hp", never the engine's "AR n, wp hp" sub.
  assert.ok(plateRow.innerHTML.includes(`AR ${plate.ar} · ${plate.wp}/${plate.wp} hp`));
});

test("DOM (Phase 71, R-07): food, rations, the sealed scroll and the repair row render byte-identically to the pre-Phase-71 composition", () => {
  const c = fixedFighter({ armor: "Mail", ar: 12, armorWP: 18, armorMax: 30 });
  const stock = [
    mkStock("Meal (+15 hp)", 20, "eatRation", { wp: 15 }),
    mkStock("Rations (+1 ration)", 20, "buyRations", { amount: 1 }),
    mkStock("Sealed scroll", 900, "buyScroll", null),
    mkStock("Repair your mail", 20, "repairArmor", null, "12 points at a tenth of its cost each"),
  ];
  const rows = renderRows(c, stock);
  const ad = armorDisplay(c);
  stock.forEach((item, i) => {
    // The legacy (Phase 61) composition, restated here as the byte pin.
    const rs = storeRowState(c, item);
    const sub = item.effectId === "repairArmor" ? `${ad.wornSub} · ${c.armorMax - c.armorWP} hp to mend at a tenth of its cost each` : item.sub;
    const subText = [sub, rs.compareLine, rs.reasonText].filter(Boolean).join(" · ");
    const expected = `<span class="g-n">${item.n}${subText ? `<i>${subText}</i>` : ""}</span>
        <span class="g-c">${item.sold ? "sold" : item.cost.toLocaleString() + " wm"}</span>`;
    assert.equal(rows[i].innerHTML, expected, item.n);
  });
});
