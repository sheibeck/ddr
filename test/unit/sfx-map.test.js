// test/unit/sfx-map.test.js
//
// Phase 56 Plan 02's pure-core pin: every AUD-01 mapping, the AUD-02 family
// cry totality (proven against content/bestiary.js's own BESTIARY keys, not
// a hand-written list), and the AUD-03 counter-driven variation edges.
// Every test builds its own createVariation() instance so no global state
// leaks between tests (mirrors test/unit/haptics.test.js's per-test guard
// discipline).
//
// This file is the map-side companion to test/unit/sfx-assets.test.js
// (56-01, asset-side only — no dependency on src/browser/sfx.js). Together
// the two files prove the shipped 30-clip asset set and the event->clip map
// are exactly the same 30 clips, in both directions.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import { BESTIARY } from "../../content/bestiary.js";
import {
  CLIP_IDS,
  CLIP_GROUPS,
  EVENT_CLIP_GROUP,
  FAMILY_CRY,
  STEP_SUPPRESSING_EVENTS,
  DISPATCH_CLIP_CAP,
  groupsForDispatch,
  createVariation,
  clipsForDispatch,
} from "../../src/browser/sfx.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SFX_DIR = path.join(REPO_ROOT, "sfx");

// ─── Vocabulary integrity ────────────────────────────────────────────────

test("sfx-map: CLIP_IDS has 30 unique entries, each with a matching file in sfx/", () => {
  assert.equal(CLIP_IDS.length, 30);
  assert.equal(new Set(CLIP_IDS).size, 30);
  const filesOnDisk = new Set(
    readdirSync(SFX_DIR).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4))
  );
  for (const id of CLIP_IDS) {
    assert.ok(filesOnDisk.has(id), `CLIP_IDS entry "${id}" has no matching sfx/${id}.mp3`);
  }
});

test("sfx-map: every CLIP_GROUPS clip id and every FAMILY_CRY value is a member of CLIP_IDS", () => {
  const idSet = new Set(CLIP_IDS);
  for (const [groupId, clips] of Object.entries(CLIP_GROUPS)) {
    for (const clip of clips) {
      assert.ok(idSet.has(clip), `CLIP_GROUPS.${groupId} references unknown clip id "${clip}"`);
    }
  }
  for (const [family, clip] of Object.entries(FAMILY_CRY)) {
    assert.ok(idSet.has(clip), `FAMILY_CRY["${family}"] references unknown clip id "${clip}"`);
  }
});

test("sfx-map: every EVENT_CLIP_GROUP value is a key of CLIP_GROUPS", () => {
  const groupKeys = new Set(Object.keys(CLIP_GROUPS));
  for (const [eventType, groupId] of Object.entries(EVENT_CLIP_GROUP)) {
    assert.ok(groupKeys.has(groupId), `EVENT_CLIP_GROUP.${eventType} -> unknown group "${groupId}"`);
  }
});

// ─── Map/asset closure (30 of 30, both directions) ─────────────────────

test("sfx-map: the map's reachable clip set and CLIP_IDS are set-equal (30 of 30, both directions)", () => {
  const reachable = new Set();
  for (const clips of Object.values(CLIP_GROUPS)) {
    for (const clip of clips) reachable.add(clip);
  }
  for (const clip of Object.values(FAMILY_CRY)) reachable.add(clip);

  assert.equal(reachable.size, 30, "the map should reach exactly 30 distinct clip ids");

  const idSet = new Set(CLIP_IDS);
  const unreachable = CLIP_IDS.filter((id) => !reachable.has(id));
  const unshipped = [...reachable].filter((id) => !idSet.has(id));

  assert.deepEqual(
    unreachable, [],
    `CLIP_IDS \\ reachable is non-empty: these shipped clips are unreachable (dead asset): ${unreachable.join(", ")}`
  );
  assert.deepEqual(
    unshipped, [],
    `reachable \\ CLIP_IDS is non-empty: the map names a clip that does not ship (a play that would silently no-op): ${unshipped.join(", ")}`
  );
});

// ─── AUD-01 coverage ──────────────────────────────────────────────────────

test("sfx-map: AUD-01's 18 mapped actions each resolve to a CLIP_GROUPS key", () => {
  const v = createVariation();

  // stone-walk step
  assert.ok(groupsForDispatch("move", [], { stepped: true }).includes("walk"));
  // water step
  assert.ok(groupsForDispatch("move", [{ type: "waded" }], { stepped: true }).includes("water"));

  const eventCases = [
    "struck", "strikeMissed", "struckByFoe", "foeKilled",
    "spellThrown", "spellResisted", "healed", "potionDrunk",
    "chestOpened", "goldGained", "trapSprung", "leaptOver",
    "floorChanged", "leveled", "died",
  ];
  for (const type of eventCases) {
    const groups = groupsForDispatch("combatAction", [{ type }], {});
    assert.ok(groups.length > 0, `event "${type}" resolved to no group`);
    for (const g of groups) {
      assert.ok(Object.keys(CLIP_GROUPS).includes(g), `event "${type}" resolved to unknown group "${g}"`);
    }
  }

  // uiTap is a real CLIP_GROUPS key even though it is fired by the shell,
  // not by an engine event — this test only proves the group exists.
  assert.ok(Object.keys(CLIP_GROUPS).includes("uiTap"));
  assert.equal(v.next("uiTap"), "ui-tap");
});

// ─── EDGE empty ───────────────────────────────────────────────────────────

test("sfx-map: EDGE empty — groupsForDispatch returns [] for empty/unmapped/garbage input, no counter advances", () => {
  const cases = [
    [],
    [{ type: "combatEnded" }, { type: "storeOpened" }, { type: "bagFull" }],
    null,
    undefined,
    [{}, { foo: "bar" }],
  ];
  for (const events of cases) {
    assert.deepEqual(groupsForDispatch("combatAction", events, {}), []);
  }

  const v = createVariation();
  for (const events of cases) {
    assert.deepEqual(clipsForDispatch("combatAction", events, {}, v), []);
  }
  // Prove the variation's walk counter was never touched by any of the
  // above: a fresh call sequence on the SAME instance still starts at
  // walk1, exactly as an unadvanced counter would.
  assert.equal(v.next("walk"), "walk1");
});

// ─── EDGE ordering ──────────────────────────────────────────────────────

test("sfx-map: EDGE ordering — a mapped dispatch resolves in array order, not alphabetical order", () => {
  // trap ("t") / chest ("c") / gold ("g") / heal ("h") alphabetize as
  // chest, gold, heal, trap — deliberately NOT the array order below.
  const events = [
    { type: "trapSprung" },
    { type: "chestOpened" },
    { type: "goldGained" },
    { type: "healed" },
  ];
  const forward = groupsForDispatch("combatAction", events, {});
  assert.deepEqual(forward, ["trap", "chest", "gold"], "should be capped at 3, in array order");

  const reversedEvents = [...events].reverse();
  const reversed = groupsForDispatch("combatAction", reversedEvents, {});
  assert.deepEqual(reversed, ["heal", "gold", "chest"], "reversing the input should reverse the output");
});

// ─── EDGE adjacency ───────────────────────────────────────────────────────

test("sfx-map: EDGE adjacency — identical events in one dispatch collapse; across two dispatches the sample rotates", () => {
  assert.deepEqual(
    groupsForDispatch("combatAction", [{ type: "struck" }, { type: "struck" }], {}),
    ["hit"],
    "two struck events in ONE dispatch should collapse to a single hit group entry"
  );

  const v = createVariation();
  const first = clipsForDispatch("combatAction", [{ type: "struck" }], {}, v);
  const second = clipsForDispatch("combatAction", [{ type: "struck" }], {}, v);
  assert.deepEqual(first, ["hit1"]);
  assert.deepEqual(second, ["hit2"]);
  assert.notDeepEqual(first, second, "the same event across two consecutive dispatches must not sound identical");
});

// ─── EDGE AUD-02 totality ─────────────────────────────────────────────────

test("sfx-map: EDGE AUD-02 totality — FAMILY_CRY is total over BESTIARY's keys and matches the ruled table exactly", () => {
  const bestiaryFamilies = Object.keys(BESTIARY);
  const familyCryKeys = Object.keys(FAMILY_CRY);

  assert.deepEqual(
    [...familyCryKeys].sort(),
    [...bestiaryFamilies].sort(),
    "FAMILY_CRY's keys must be exactly BESTIARY's keys — a 7th family or a stale key must fail here"
  );

  for (const family of bestiaryFamilies) {
    const cry = FAMILY_CRY[family];
    assert.ok(cry, `BESTIARY family "${family}" has no FAMILY_CRY entry`);
    assert.ok(CLIP_IDS.includes(cry), `FAMILY_CRY["${family}"] = "${cry}" is not a real clip id`);
  }

  // The exact ruled table, entry by entry.
  assert.equal(FAMILY_CRY["Beasts"], "enemy-beast");
  assert.equal(FAMILY_CRY["Demons"], "enemy-demon");
  assert.equal(FAMILY_CRY["Humans"], "enemy-human");
  assert.equal(FAMILY_CRY["Lair Beasts"], "enemy-human");
  assert.equal(FAMILY_CRY["Magical"], "enemy-demon");
  assert.equal(FAMILY_CRY["Walking Dead"], "enemy-undead");

  const distinctCries = new Set(Object.values(FAMILY_CRY));
  assert.equal(distinctCries.size, 4, "6 families should resolve onto exactly 4 distinct cries");
  assert.equal(FAMILY_CRY["Lair Beasts"], FAMILY_CRY["Humans"], "Lair Beasts shares Humans' cry");
  assert.equal(FAMILY_CRY["Magical"], FAMILY_CRY["Demons"], "Magical shares Demons' cry");
});

test("sfx-map: EDGE AUD-02 — combatJoined with an unknown or missing ctx.combatType yields [] rather than throwing", () => {
  assert.doesNotThrow(() => groupsForDispatch("fight", [{ type: "combatJoined" }], {}));
  assert.deepEqual(groupsForDispatch("fight", [{ type: "combatJoined" }], {}), []);
  assert.deepEqual(groupsForDispatch("fight", [{ type: "combatJoined" }], { combatType: "Not A Real Family" }), []);
  assert.deepEqual(groupsForDispatch("fight", [{ type: "combatJoined" }], undefined), []);
});

// ─── EDGE AUD-03 degenerate groups ────────────────────────────────────────

const SINGLE_CLIP_GROUPS = [
  "foeDie", "spell", "trap", "stairs", "levelup", "death",
  "chest", "gold", "heal", "drink", "jump", "resist", "uiTap",
];

test("sfx-map: EDGE AUD-03 — every size-1 group returns its one clip five times without a no-repeat attempt, and throws nothing", () => {
  for (const groupId of SINGLE_CLIP_GROUPS) {
    assert.equal(CLIP_GROUPS[groupId].length, 1, `"${groupId}" is expected to be a size-1 group`);
    const v = createVariation();
    const expected = CLIP_GROUPS[groupId][0];
    for (let i = 0; i < 5; i++) {
      let result;
      assert.doesNotThrow(() => { result = v.next(groupId); });
      assert.equal(result, expected, `call ${i + 1} for "${groupId}" should still return "${expected}"`);
    }
  }
});

test("sfx-map: EDGE AUD-03 — size-2 groups strictly alternate over 4 calls", () => {
  for (const groupId of ["hit", "miss"]) {
    const v = createVariation();
    const seq = [v.next(groupId), v.next(groupId), v.next(groupId), v.next(groupId)];
    assert.deepEqual(seq, [...CLIP_GROUPS[groupId], ...CLIP_GROUPS[groupId]]);
  }
});

test("sfx-map: EDGE AUD-03 — size-3 groups cycle over 6 calls with no back-to-back repeat", () => {
  for (const groupId of ["walk", "water", "hurt"]) {
    const v = createVariation();
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(v.next(groupId));
    assert.deepEqual(seq, [...CLIP_GROUPS[groupId], ...CLIP_GROUPS[groupId]]);
    for (let i = 1; i < seq.length; i++) {
      assert.notEqual(seq[i], seq[i - 1], `back-to-back repeat at index ${i} in group "${groupId}"`);
    }
  }
});

test("sfx-map: EDGE AUD-03 — next(\"notAGroup\") returns null and throws nothing", () => {
  const v = createVariation();
  assert.doesNotThrow(() => v.next("notAGroup"));
  assert.equal(v.next("notAGroup"), null);
});

// ─── DISPATCH_CLIP_CAP ─────────────────────────────────────────────────

test("sfx-map: DISPATCH_CLIP_CAP is 3 and a 4+-event dispatch is capped", () => {
  assert.equal(DISPATCH_CLIP_CAP, 3);
  const events = [
    { type: "struck" }, { type: "foeKilled" }, { type: "leveled" }, { type: "goldGained" },
  ];
  assert.deepEqual(groupsForDispatch("combatAction", events, {}), ["hit", "foeDie", "levelup"]);
});

// ─── STEP_SUPPRESSING_EVENTS ──────────────────────────────────────────────

test("sfx-map: a step-suppressing event stops the synthesized walk/water clip from firing alongside it", () => {
  for (const type of STEP_SUPPRESSING_EVENTS) {
    const groups = groupsForDispatch("move", [{ type }], { stepped: true });
    assert.ok(!groups.includes("walk") && !groups.includes("water"), `"${type}" should suppress the step clip`);
  }
});

// ─── Determinism ──────────────────────────────────────────────────────────

test("sfx-map: two independently constructed variations fed the same call sequence produce identical output", () => {
  const callSequence = ["walk", "hit", "walk", "hurt", "hit", "walk"];
  const v1 = createVariation();
  const v2 = createVariation();
  const out1 = callSequence.map((g) => v1.next(g));
  const out2 = callSequence.map((g) => v2.next(g));
  assert.deepEqual(out1, out2);
});

// ─── Teeth ──────────────────────────────────────────────────────────────

test("sfx-map: TEETH — deleting a FAMILY_CRY entry makes the totality check fail", () => {
  const tampered = { ...FAMILY_CRY };
  delete tampered["Magical"];
  const bestiaryFamilies = Object.keys(BESTIARY);
  assert.notDeepEqual(
    [...Object.keys(tampered)].sort(),
    [...bestiaryFamilies].sort(),
    "the set-equality check must actually reject a family-deleted map, proving the totality test has teeth"
  );
});
