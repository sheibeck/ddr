// test/unit/item-effect-ended-lines.test.js
//
// Phase 88 plan 01 (ITEM-02): itemEffectEnded, the event engine/items.js#
// endSourceEffects pushes when an item effect ends early because its item left
// the source slot. One Oracle line and one rail line per ended effect, each
// naming the item and what stops (CONTEXT "Narration"). The Crystal Staff's
// party invisibility says the whole party is seen again, a Joiner's line names
// the Joiner, and a bare payload never prints "undefined" or "NaN".

import test from "node:test";
import assert from "node:assert/strict";

import { ACTIVATION_OF, SLOT_OF, STAFF_NAMES } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const plain = (html) => String(html).replace(/<[^>]+>/g, "");
const oracle = (e) => plain(EVENT_NARRATION.itemEffectEnded({ type: "itemEffectEnded", ...e }));
const rail = (e) => LINE_FOR.itemEffectEnded({ type: "itemEffectEnded", ...e }).text;

/** Per-kind what-stops phrases, one regex for each surface. */
const STOPS = Object.freeze({
  fly: { oracle: /the flying stops/, rail: /flying stops/ },
  ether: { oracle: /solid again/, rail: /solid again/ },
  critWard: { oracle: /critical hits can find you again/, rail: /crits can land again/ },
  invis: { oracle: /you are plainly visible again/, rail: /visible again/ },
  unseen: { oracle: /foes see you plainly again/, rail: /seen again/ },
  haste: { oracle: /the second swing goes with it/, rail: /second swing goes/ },
  plate: { oracle: /the weightless plate goes with it/, rail: /plate goes/ },
  power: { oracle: /the extra damage goes with it/, rail: /extra damage goes/ },
  giant: { oracle: /back to your own size/, rail: /back to normal size/ },
  glow: { oracle: /the light goes out/, rail: /light goes out/ },
  tongue: { oracle: /the fluency goes with it/, rail: /fluency goes/ },
  // Phase 88 plan 04 (ITEM-03): the Cloak of Regeneration's window is linked too.
  knit: { oracle: /the knitting stops/, rail: /the knitting stops/ },
});

/** Every linked item, derived from content: a worn row with a positive numeric
 * effect, plus every staff whose activation starts a timed effect. */
const LINKED = [
  ...Object.keys(ACTIVATION_OF).filter((k) => SLOT_OF[k] !== undefined && typeof ACTIVATION_OF[k].effect === "number" && ACTIVATION_OF[k].effect > 0),
  ...STAFF_NAMES.filter((k) => ACTIVATION_OF[k] && ACTIVATION_OF[k].effect !== undefined),
].map((item) => ({ item, kind: ACTIVATION_OF[item].kind }));

// Phase 88 plan 04 (ITEM-03): the Cloak of Regeneration's effect went 0 -> 30,
// so it joins the linked list. Before: 12 worn + the staff = 13; after: 14.
test("the linked list is the twelve worn items, the Cloak of Regeneration's window and the Crystal Staff", () => {
  assert.equal(LINKED.length, 14);
  assert.ok(LINKED.some((l) => l.item === "Cloak of Regeneration" && l.kind === "knit"));
  assert.ok(LINKED.some((l) => l.item === "Crystal Staff" && l.kind === "invis"));
});

test("every linked kind has a what-stops phrase on both surfaces, names the item, and never takes the unknown-kind fallback", () => {
  for (const { item, kind } of LINKED) {
    assert.ok(STOPS[kind], `${item}: a test phrase for kind ${kind}`);
    const slot = item === "Crystal Staff" ? "weapon" : "cloak";
    const e = { item, kind, slot, why: "off", left: 10, ready: 30 };
    const o = oracle(e);
    const r = rail(e);
    assert.ok(o.includes(item), `Oracle names ${item}: ${o}`);
    assert.ok(r.includes(item), `rail names ${item}: ${r}`);
    assert.match(o, STOPS[kind].oracle, `${item} Oracle: ${o}`);
    assert.match(r, STOPS[kind].rail, `${item} rail: ${r}`);
    assert.doesNotMatch(o, /its magic stops/, `${item} Oracle took the fallback`);
    assert.doesNotMatch(r, /its magic stops/, `${item} rail took the fallback`);
  }
});

test("a Crystal Staff payload says the whole party is seen again, names the staff leaving the hands, and prints no ready clause", () => {
  const e = { item: "Crystal Staff", kind: "invis", slot: "weapon", why: "off", left: 15, ready: 0, party: true };
  const o = oracle(e);
  const r = rail(e);
  assert.match(o, /Crystal Staff leaves your hands/);
  assert.match(o, /the whole party is plainly visible again/);
  assert.doesNotMatch(o, /Ready again/);
  assert.match(r, /Crystal Staff unwielded: party seen again\./);
  assert.doesNotMatch(r, /ready in/);
});

test("the ready clause carries the number, singular for one square", () => {
  const e = { item: "Cloak of Flying", kind: "fly", slot: "cloak", why: "off", left: 15, ready: 65 };
  assert.match(oracle(e), /Ready again in 65 squares, exactly when it would have been had it stayed on\./);
  assert.match(rail(e), /\(ready in 65 squares\)\./);
  assert.match(oracle({ ...e, ready: 1 }), /Ready again in 1 square,/);
  assert.match(rail({ ...e, ready: 1 }), /\(ready in 1 square\)/);
});

test("a Joiner's payload names the Joiner, and never says 'you'", () => {
  const e = { item: "Cloak of Strength", kind: "critWard", slot: "cloak", why: "off", left: 30, ready: 80, member: "Brom" };
  const o = oracle(e);
  assert.match(o, /Brom's Cloak of Strength comes off/);
  assert.match(o, /critical hits can find Brom again/);
  assert.doesNotMatch(o, /\byou(r)?\b/i);
  assert.match(rail(e), /^Brom's Cloak of Strength off: crits can land again/);
});

test("each why picks its own lead", () => {
  const base = { item: "Ring of Power", kind: "power", slot: "jewelry1", left: 10, ready: 60 };
  const leads = {};
  for (const why of ["off", "swap", "destroyed", "gone"]) leads[why] = oracle({ ...base, why });
  assert.match(leads.off, /Your Ring of Power comes off/);
  assert.match(leads.swap, /Your Ring of Power is swapped out/);
  assert.match(leads.destroyed, /Your Ring of Power is dust/);
  assert.match(leads.gone, /Your Ring of Power is gone/);
  assert.equal(new Set(Object.values(leads)).size, 4);
  const hows = new Set(["off", "swap", "destroyed", "gone"].map((why) => rail({ ...base, why })));
  assert.equal(hows.size, 3, "the rail tells off, swapped out and gone (destroyed and gone read alike)");
});

test("a bare payload renders non-empty text with no 'undefined' and no 'NaN' on both surfaces", () => {
  for (const bare of [{ type: "itemEffectEnded" }, { type: "itemEffectEnded", item: null, kind: "nope", ready: NaN, left: NaN }]) {
    const o = plain(EVENT_NARRATION.itemEffectEnded(bare));
    const r = LINE_FOR.itemEffectEnded(bare).text;
    for (const t of [o, r]) {
      assert.ok(t.length > 0);
      assert.doesNotMatch(t, /undefined|NaN|\[object/);
    }
  }
  assert.doesNotThrow(() => EVENT_NARRATION.itemEffectEnded({}));
  assert.doesNotThrow(() => LINE_FOR.itemEffectEnded({}));
});

test("an item object in the payload reads by its name", () => {
  assert.match(oracle({ item: { n: "Cloak of Speed" }, kind: "haste", why: "off" }), /Cloak of Speed comes off/);
  assert.match(rail({ item: { n: "Cloak of Speed" }, kind: "haste", why: "off" }), /^Cloak of Speed off:/);
});
