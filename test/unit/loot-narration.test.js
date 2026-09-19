// test/unit/loot-narration.test.js
//
// Phase 29 (LOOT-01/02/06): presentation pins for the pending loot pile's
// four new event types (lootDropped/lootTaken/lootLeft/lootForfeited) —
// TOAST_FOR + EVENT_NARRATION entries, and confirmation none of them is
// ORACLE_ONLY (mirrors test/unit/lootCompare.test.js's bagFull/bagUpgraded
// presentation section).

import test from "node:test";
import assert from "node:assert/strict";

import { TOAST_FOR, ORACLE_ONLY } from "../../src/browser/toasts.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

const LOOT_EVENT_TYPES = ["lootDropped", "lootTaken", "lootLeft", "lootForfeited"];

test("none of the four new loot event types is ORACLE_ONLY", () => {
  for (const t of LOOT_EVENT_TYPES) {
    assert.equal(ORACLE_ONLY.has(t), false, `${t} must not be ORACLE_ONLY — it needs a toast`);
  }
});

test("TOAST_FOR.lootDropped: names the item and kind, family-friendly", () => {
  const t = TOAST_FOR.lootDropped({ type: "lootDropped", name: "Warded leather", kind: "armor" });
  assert.equal(t.text, "Dropped: Warded leather. It will keep.");
  assert.equal(t.tone, "beat");
  const bare = TOAST_FOR.lootDropped({ type: "lootDropped" });
  assert.ok(bare.text.length > 0);
});

test("TOAST_FOR.lootTaken: names the item", () => {
  const t = TOAST_FOR.lootTaken({ type: "lootTaken", item: { n: "X" } });
  assert.equal(t.text, "Taken: X.");
  assert.equal(t.tone, "hit");
  const bare = TOAST_FOR.lootTaken({ type: "lootTaken" });
  assert.ok(bare.text.length > 0);
});

test("TOAST_FOR.lootLeft: names the item", () => {
  const t = TOAST_FOR.lootLeft({ type: "lootLeft", item: { n: "X" } });
  assert.equal(t.text, "Left behind: X.");
  assert.equal(t.tone, "miss");
  const bare = TOAST_FOR.lootLeft({ type: "lootLeft" });
  assert.ok(bare.text.length > 0);
});

// Phase 43 (CLAR-01): cause-first rewrite — "Fled: ..." / "Dead: ..." lead
// with the cause, matching docs/CLARITY.md's cost-event inventory row.
test("TOAST_FOR.lootForfeited: lists every item name, distinct wording for fled vs died", () => {
  const fled = TOAST_FOR.lootForfeited({ type: "lootForfeited", items: [{ n: "A" }, { n: "B" }], reason: "fled" });
  assert.equal(fled.text, "Fled: A, B stay behind.");
  assert.equal(fled.tone, "miss");

  const died = TOAST_FOR.lootForfeited({ type: "lootForfeited", items: [{ n: "A" }, { n: "B" }], reason: "died" });
  assert.equal(died.text, "Dead: A, B stay where they fell.");

  const bare = TOAST_FOR.lootForfeited({ type: "lootForfeited" });
  assert.ok(bare.text.length > 0);
});

test("EVENT_NARRATION.lootDropped: non-empty from a bare call, names the item when present", () => {
  assert.ok(EVENT_NARRATION.lootDropped({ type: "lootDropped" }).length > 0);
  const html = EVENT_NARRATION.lootDropped({ type: "lootDropped", name: "Warded leather" });
  assert.match(html, /Warded leather/);
  assert.match(html, /<span class="beat">/);
});

test("EVENT_NARRATION.lootTaken/lootLeft: non-empty from a bare call, name the item when present", () => {
  assert.ok(EVENT_NARRATION.lootTaken({ type: "lootTaken" }).length > 0);
  assert.match(EVENT_NARRATION.lootTaken({ type: "lootTaken", item: { n: "X" } }), /X/);
  assert.ok(EVENT_NARRATION.lootLeft({ type: "lootLeft" }).length > 0);
  assert.match(EVENT_NARRATION.lootLeft({ type: "lootLeft", item: { n: "X" } }), /X/);
});

// Phase 43 (CLAR-01): cause-first rewrite — the fled line now leads with
// "Fled: ..." (see docs/CLARITY.md); the died clause is unchanged.
test("EVENT_NARRATION.lootForfeited: lists every item name; distinct clauses for fled vs died", () => {
  const fled = EVENT_NARRATION.lootForfeited({ type: "lootForfeited", items: [{ n: "A" }, { n: "B" }], reason: "fled" });
  assert.match(fled, /A, B/);
  assert.match(fled, /^<span class="miss">Fled: /);

  const died = EVENT_NARRATION.lootForfeited({ type: "lootForfeited", items: [{ n: "A" }, { n: "B" }], reason: "died" });
  assert.match(died, /A, B/);
  assert.match(died, /stay where they fell/);

  // safety-scan style bare call — defends e.items with ?? []
  assert.doesNotThrow(() => EVENT_NARRATION.lootForfeited({ type: "lootForfeited" }));
});
