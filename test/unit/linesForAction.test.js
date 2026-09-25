// test/unit/linesForAction.test.js
//
// Direct unit coverage for src/browser/narrationLines.js's linesForAction pipeline
// (Phase 25, 25-03): every locked aggregate wording, boundary (1 vs 2+
// swings, 1-2 vs 3+ foes, level 2 vs 3), refusal-first rule, chain fold and
// direction contract in this plan's must_haves, named as its own passing
// test. Synthetic event lists only — no engine calls needed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { linesForAction, PRIORITY } from "../../src/browser/narrationLines.js";
import { decorateMisses } from "../../src/browser/missLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── Empty/garbage (probe FEED-01 empty) ────────────────────────────────────

test("linesForAction: an empty events array yields []", () => {
  assert.deepEqual(linesForAction("move", [], {}), []);
});

test("linesForAction: null/undefined events yield [] (never throws)", () => {
  assert.deepEqual(linesForAction("move", null, {}), []);
  assert.deepEqual(linesForAction("move", undefined, {}), []);
});

test("linesForAction: an unknown event type yields []", () => {
  assert.deepEqual(linesForAction("move", [{ type: "nonsenseType" }], {}), []);
});

test("linesForAction: an action of only ORACLE_ONLY events yields []", () => {
  const out = linesForAction("move", [{ type: "dayBegan" }, { type: "spGained", amount: 3 }, { type: "moved" }], {});
  assert.deepEqual(out, []);
});

test("probe FEED-01 empty: an event missing optional fields yields one line and never throws", () => {
  assert.doesNotThrow(() => linesForAction("move", [{ type: "goldGained" }], {}));
  const gold = linesForAction("move", [{ type: "goldGained" }], {});
  assert.equal(gold.length, 1);
  assert.ok(!gold[0].text.includes("undefined") && !gold[0].text.includes("NaN"));

  assert.doesNotThrow(() => linesForAction("move", [{ type: "foeFled", name: "Rat" }], {}));
  const fled = linesForAction("move", [{ type: "foeFled", name: "Rat" }], {});
  assert.equal(fled.length, 1);
  assert.ok(!fled[0].text.includes("undefined") && !fled[0].text.includes("NaN"));
});

// ─── Ordering + cap (probe FEED-01 ordering, probe FEED-02 ordering) ────────

test("probe FEED-01 ordering: a 9-event mix spanning all five priorities sorts ascending, uncapped", () => {
  const events = [
    { type: "wardFaded" }, // priority 4 (other)
    { type: "strikeRefused", reason: "wizard", spell: "Freeze" }, // priority 0 (block)
    { type: "struck", target: "Dante", dmg: 8 }, // priority 1 (you)
    { type: "struckByFoe", name: "Rat", dmg: 3 }, // priority 2 (them)
    { type: "backstab" }, // priority 3 (feature)
    { type: "frenzy" }, // priority 3 (feature)
    { type: "leveled", level: 2, wpGain: 6 }, // priority 3 (feature)
    { type: "mirrorFaded" }, // priority 4 (other)
    { type: "trapPoisoned" }, // priority 4 (other)
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out.length, 9, "no default cap — every folded line is returned (the capped toast host is retired)");
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1].priority <= out[i].priority, "priorities are non-decreasing");
  }
  assert.equal(out[0].priority, PRIORITY.block);
  assert.equal(out[1].priority, PRIORITY.you);
  assert.equal(out[2].priority, PRIORITY.them);
  assert.equal(out[3].priority, PRIORITY.feature);
  assert.equal(out[3].text, "Backstab — critical.", "within priority 3, earliest engine order wins first");
  assert.equal(out[8].priority, PRIORITY.other, "priority-4 (other) lines survive too — nothing is dropped");
});

test("probe FEED-02 ordering: one refusal plus 6 features keeps the refusal at index 0", () => {
  const events = [
    { type: "frenzy" },
    { type: "backstab" },
    { type: "deathTouch", target: "Viper" },
    { type: "stealthStrike" },
    { type: "ninjaFirstStrike" },
    { type: "strikeRefused", reason: "wizard", spell: "Freeze" },
    { type: "conArtistOpener" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].tone, "block");
  assert.equal(out[0].priority, PRIORITY.block);
  assert.ok(out[0].text.includes("Freeze"));
});

// ─── Refusal adjacency (probe FEED-02 adjacency) ────────────────────────────

const REFUSAL_TYPES = [
  "strikeRefused", "fleeRefused", "parleyRefused", "itemRejected", "equipRejected",
  "useRefused", "scrollRefused", "noChargesLeft", "spellAboveLevel", "campFailed",
  "joinerRefused", "buyFailed",
];

test("probe FEED-02 adjacency: each refusal type, alone, yields exactly one block line", () => {
  for (const t of REFUSAL_TYPES) {
    const out = linesForAction("attack", [{ type: t }], {});
    assert.equal(out.length, 1, `${t} should yield exactly one line`);
    assert.equal(out[0].tone, "block", `${t} should be tone block`);
  }
});

test("probe FEED-02 adjacency: strikeRefused names the spell and produces no struck/strikeMissed line", () => {
  const out = linesForAction("attack", [{ type: "strikeRefused", reason: "wizard", spell: "Freeze" }], {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("Freeze"));
  assert.ok(!out.some((t) => /^You (hit|miss)/.test(t.text)));
});

test("probe FEED-02 adjacency: withdrawalDenied + fleeRolled + fleeFailed order block line before the outcome", () => {
  // Phase 42 (FLEE-01): need is now 14 (was 11). Phase 73 (ROLL-05): the
  // payload carries `atLeast`/`dieN`/`mods`, not the old `total`/`need`.
  const events = [
    { type: "withdrawalDenied", reason: "masterOfArms" },
    { type: "fleeRolled", roll: 3, atLeast: 14, dieN: 20, mods: [] },
    { type: "fleeFailed" },
  ];
  const out = linesForAction("flee", events, {});
  assert.equal(out.length, 2);
  assert.equal(out[0].tone, "block");
  assert.equal(out[1].tone, "miss");
});

// ─── Feature adjacency (probe FEED-01 adjacency) ────────────────────────────

test("probe FEED-01 adjacency: backstab + a critical struck + foeKilled both show, you before feature after sort", () => {
  const events = [
    { type: "backstab" },
    { type: "struck", target: "Dante", dmg: 10, critical: true, critBy: "backstab" },
    { type: "foeKilled", name: "Dante", spGained: 8 },
  ];
  const out = linesForAction("attack", events, {});
  const backstabLine = out.find((t) => t.text.includes("Backstab"));
  const strikeLine = out.find((t) => t.text.startsWith("You hit"));
  assert.ok(backstabLine, "the backstab feature line is present");
  assert.ok(strikeLine, "the your-round line is present");
  assert.ok(out.indexOf(strikeLine) < out.indexOf(backstabLine), "your outcome sorts before the feature line");
  assert.ok(strikeLine.text.includes("· felled"));
});

test("probe FEED-01 adjacency: frenzy + two struck + one struckByFoe(soaked) all show distinctly", () => {
  const events = [
    { type: "frenzy" },
    { type: "struck", target: "Dante", dmg: 5 },
    { type: "struck", target: "Dante", dmg: 4 },
    { type: "struckByFoe", name: "Dante", dmg: 4, soaked: { hide: 2 } },
  ];
  const out = linesForAction("attack", events, {});
  assert.ok(out.some((t) => t.text === "Frenzy — two wild swings."));
  assert.ok(out.some((t) => t.text === "You hit Dante 2 of 2 (9)"));
  assert.ok(out.some((t) => t.text === "Dante hits you (4) · hide 2 soaked"));
});

test("probe FEED-01 adjacency: two backstab events dedupe into one line", () => {
  const out = linesForAction("attack", [{ type: "backstab" }, { type: "backstab" }], {});
  const backstabLines = out.filter((t) => t.text.includes("Backstab"));
  assert.equal(backstabLines.length, 1, "duplicate event type of the same text collapses to one line");
});

// ─── Enemy boundaries (probe FEED-04 boundary, probe FEED-04 precision) ─────

test("probe FEED-04 boundary: a single hit has no 'of' in its text", () => {
  const out = linesForAction("attack", [{ type: "struckByFoe", name: "Dante", dmg: 6 }], {});
  assert.equal(out[0].text, "Dante hits you (6)");
  assert.ok(!out[0].text.includes(" of "));
});

test("probe FEED-04 boundary: a single miss has no 'of' in its text", () => {
  const out = linesForAction("attack", [{ type: "foeMissed", name: "Dante" }], {});
  assert.equal(out[0].text, "Dante misses you");
});

test("probe FEED-04 boundary: 2 swings 1 hit reads 'K of M'", () => {
  const events = [
    { type: "struckByFoe", name: "Dante", dmg: 6 },
    { type: "foeMissed", name: "Dante" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "Dante hits you 1 of 2 (6)");
});

test("probe FEED-04 boundary: 4 swings 2 hits sums integer damage exactly", () => {
  const events = [
    { type: "struckByFoe", name: "Dante", dmg: 5 },
    { type: "foeMissed", name: "Dante" },
    { type: "struckByFoe", name: "Dante", dmg: 6 },
    { type: "foeMissed", name: "Dante" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Dante hits you 2 of 4 (11)");
});

test("probe FEED-04 boundary: 3 swings 0 hits reads 'M times'", () => {
  const events = [
    { type: "foeMissed", name: "Dante" },
    { type: "foeMissed", name: "Dante" },
    { type: "foeMissed", name: "Dante" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "Dante misses you 3 times");
  assert.equal(out[0].tone, "dodge");
});

test("probe FEED-04 boundary: critical and soldierCrit both append CRIT", () => {
  assert.ok(linesForAction("attack", [{ type: "struckByFoe", name: "Dante", dmg: 6, critical: true }], {})[0].text.includes("· CRIT"));
  assert.ok(linesForAction("attack", [{ type: "struckByFoe", name: "Dante", dmg: 6, soldierCrit: true }], {})[0].text.includes("· CRIT"));
});

test("probe FEED-04 boundary: two distinct foes produce two lines in first-seen order", () => {
  const events = [
    { type: "struckByFoe", name: "Rat", dmg: 3 },
    { type: "struckByFoe", name: "Bat", dmg: 2 },
  ];
  const out = linesForAction("attack", events, {});
  const hits = out.filter((t) => t.tone === "hurt" || t.tone === "dodge");
  assert.equal(hits.length, 2);
  assert.ok(hits[0].text.startsWith("Rat"));
  assert.ok(hits[1].text.startsWith("Bat"));
});

test("probe FEED-04 boundary: three distinct foes collapse into one line", () => {
  const events = ["A", "B", "C"].flatMap((n) => [
    { type: "struckByFoe", name: n, dmg: 4 },
    { type: "foeMissed", name: n },
  ]);
  const out = linesForAction("attack", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "3 foes swing, 3 land (12)");
  assert.equal(out[0].tone, "hurt");
});

test("probe FEED-04 boundary: three foes, none landing, reads 'none land' and tone dodge", () => {
  const events = ["A", "B", "C"].map((n) => ({ type: "foeMissed", name: n }));
  const out = linesForAction("attack", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "3 foes swing, none land");
  assert.equal(out[0].tone, "dodge");
});

test("probe FEED-04 boundary: same-named foes merge into one group instead of a false 3+ collapse", () => {
  const events = [
    { type: "struckByFoe", name: "Goblin", dmg: 3 },
    { type: "struckByFoe", name: "Goblin", dmg: 2 },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Goblin hits you 2 of 2 (5)");
});

test("probe FEED-04 boundary: member events aggregate at feature priority, 1 hit and 2 of 2", () => {
  const single = linesForAction("attack", [{ type: "memberStruck", name: "Dante", member: "Bram", dmg: 5 }], {});
  assert.equal(single[0].text, "Dante hits Bram (5)");
  assert.equal(single[0].priority, PRIORITY.feature);

  const events = [
    { type: "memberStruck", name: "Dante", member: "Bram", dmg: 5 },
    { type: "memberStruck", name: "Dante", member: "Bram", dmg: 4 },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "Dante hits Bram 2 of 2 (9)");
});

test("probe FEED-04 precision: K/M come from event counts, not any sp.atk-shaped field", () => {
  const events = [
    { type: "struckByFoe", name: "Dante", dmg: 2, sp: { atk: 99 } },
    { type: "struckByFoe", name: "Dante", dmg: 2 },
    { type: "struckByFoe", name: "Dante", dmg: 2 },
    { type: "foeMissed", name: "Dante" },
    { type: "foeMissed", name: "Dante" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "Dante hits you 3 of 5 (6)");
});

// ─── Your round ──────────────────────────────────────────────────────────────

test("your round: a single hit reads 'You hit X (dmg)'", () => {
  const out = linesForAction("attack", [{ type: "struck", target: "Dante", dmg: 8 }], {});
  assert.equal(out[0].text, "You hit Dante (8)");
});

test("probe FEED-04 boundary: 2 of 2 with one critical reads the locked 'K of M (sum) · CRIT' wording", () => {
  const events = [
    { type: "struck", target: "Dante", dmg: 8, critical: true },
    { type: "struck", target: "Dante", dmg: 6 },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "You hit Dante 2 of 2 (14) · CRIT");
});

test("your round: 0 of 2 reads 'You miss X 2 times'", () => {
  const events = [
    { type: "strikeMissed", target: "Dante" },
    { type: "strikeMissed", target: "Dante" },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "You miss Dante 2 times");
});

test("your round: quips on both misses carry the FIRST quip", () => {
  const events = [
    { type: "strikeMissed", target: "Dante", quip: "A swing. Technically." },
    { type: "strikeMissed", target: "Dante", quip: "Wide. Impressively wide." },
  ];
  const out = linesForAction("attack", events, {});
  assert.equal(out[0].text, "You miss Dante 2 times — A swing. Technically.");
});

test("your round: a single quipped miss reads 'You miss X — quip'", () => {
  const out = linesForAction("attack", [{ type: "strikeMissed", target: "Dante", quip: "Wide. Impressively wide." }], {});
  assert.equal(out[0].text, "You miss Dante — Wide. Impressively wide.");
});

test("probe FEED-04 boundary: the fledgling-miss level gate holds end-to-end through decorateMisses at level 2", () => {
  const events = [{ type: "strikeMissed", target: "Dante", roll: 9, need: 5 }];
  const { events: decorated } = decorateMisses(events, 2, 0);
  const out = linesForAction("attack", decorated, {});
  assert.ok(out[0].text.startsWith("You miss Dante — "), `expected a quip at level 2, got "${out[0].text}"`);
});

test("the fledgling-miss level gate stops decorating at level 3 (same input, no quip)", () => {
  const events = [{ type: "strikeMissed", target: "Dante", roll: 9, need: 5 }];
  const { events: decorated } = decorateMisses(events, 3, 0);
  const out = linesForAction("attack", decorated, {});
  assert.equal(out[0].text, "You miss Dante");
});

test("your round: an untouchable miss stays its own line, ungrouped", () => {
  const events = [
    { type: "strikeMissed", target: "Ward", untouchable: true },
    { type: "struck", target: "Dante", dmg: 5 },
  ];
  const out = linesForAction("attack", events, {});
  assert.ok(out.some((t) => t.text === "You cannot touch Ward."));
  assert.ok(out.some((t) => t.text === "You hit Dante (5)"));
});

// ─── FEED-03 flagged assumption ──────────────────────────────────────────────

const THEM_MATRIX_TYPES = ["struckByFoe", "foeMissed", "memberStruck", "foeBolted", "foeDrained", "foeDebuffed", "foeHealed", "heroResistFailed"];
const YOU_MATRIX_TYPES = ["struck", "strikeMissed", "heroResisted"];

test("FEED-03: every THEM-family output tone is hurt/dodge and text starts with the foe name (or an F-foes collapse)", () => {
  for (const t of THEM_MATRIX_TYPES) {
    const payload = { type: t, name: "Dante", member: "Bram", target: "Dante", dmg: 6, roll: 3, need: 5, stolen: 3, amount: 5, kind: "weakened", rounds: 3 };
    const out = linesForAction("attack", [payload], {});
    assert.equal(out.length, 1, `${t} should yield exactly one line`);
    assert.ok(["hurt", "dodge"].includes(out[0].tone), `${t} expected tone hurt/dodge, got "${out[0].tone}"`);
    assert.ok(/^(Dante|\d+ foes)/.test(out[0].text), `${t} expected text starting with the foe name, got "${out[0].text}"`);
  }
});

test("FEED-03: every YOU-family output tone is hit/miss and text starts with 'You'", () => {
  for (const t of YOU_MATRIX_TYPES) {
    const payload = { type: t, target: "Dante", name: "Dante", dmg: 8, roll: 3, need: 5 };
    const out = linesForAction("attack", [payload], {});
    assert.equal(out.length, 1, `${t} should yield exactly one line`);
    assert.ok(["hit", "miss"].includes(out[0].tone), `${t} expected tone hit/miss, got "${out[0].tone}"`);
    assert.ok(out[0].text.startsWith("You"), `${t} expected text starting with "You", got "${out[0].text}"`);
  }
});

// ─── Spell chain (probe FEED-06 adjacency, probe FEED-06 ordering) ──────────

test("probe FEED-06 adjacency: Freeze hit + frozenSolid + foeKilled fold into one combined line", () => {
  const events = [
    { type: "spellThrown", spell: "Freeze", target: "Dante", roll: 3, need: 6 },
    { type: "spellHit", target: "Dante", dmg: 9, mult: 1 },
    { type: "frozenSolid", target: "Dante" },
    { type: "foeKilled", name: "Dante", spGained: 10 },
  ];
  const out = linesForAction("castSpell", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Freeze — Dante frozen solid");
});

test("probe FEED-06 adjacency: Fireball spellHit + foeKilled fold into a felled suffix", () => {
  const events = [
    { type: "spellThrown", spell: "Fireball", target: "Dante", roll: 2, need: 4 },
    { type: "spellHit", target: "Dante", dmg: 12, mult: 1 },
    { type: "foeKilled", name: "Dante", spGained: 10 },
  ];
  const out = linesForAction("castSpell", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Fireball hits Dante (12) · felled");
});

test("probe FEED-06 adjacency: a resisted spell shows only the resist line, no magic-hit line", () => {
  const out = linesForAction("castSpell", [{ type: "spellResisted", target: "Dante", spell: "Doze", roll: 3, intel: 4 }], {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Dante resists Doze");
  assert.equal(out[0].tone, "miss");
  assert.ok(!out.some((t) => t.tone === "magic"));
});

test("probe FEED-06 adjacency: resistFailed + dozed shows only the dozed line", () => {
  const events = [
    { type: "resistFailed", target: "Dante", roll: 9 },
    { type: "dozed", target: "Dante", rounds: 4 },
  ];
  const out = linesForAction("castSpell", events, {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("dozes off"));
});

test("probe FEED-06 ordering: 3+ targets (Lightning) collapse into one line", () => {
  const events = [
    { type: "spellThrown", spell: "Lightning", target: "A", roll: 2, need: 4 },
    { type: "spellHit", target: "A", dmg: 10, mult: 1 },
    { type: "spellThrown", spell: "Lightning", target: "B", roll: 2, need: 4 },
    { type: "spellHit", target: "B", dmg: 8, mult: 1 },
    { type: "spellThrown", spell: "Lightning", target: "C", roll: 9, need: 4 },
    { type: "spellMissed", target: "C" },
  ];
  const out = linesForAction("castSpell", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Lightning: 3 targets, 2 hit (18)");
});

test("probe FEED-06 ordering: your cast sorts before the foe's turn in the same action", () => {
  const events = [
    { type: "spellThrown", spell: "Fireball", target: "Dante", roll: 2, need: 4 },
    { type: "spellHit", target: "Dante", dmg: 10, mult: 1 },
    { type: "foeBolted", name: "Dante", dmg: 6 },
  ];
  const out = linesForAction("castSpell", events, {});
  const yours = out.findIndex((t) => t.tone === "magic");
  const theirs = out.findIndex((t) => t.tone === "hurt");
  assert.ok(yours !== -1 && theirs !== -1);
  assert.ok(yours < theirs, "your outcome sorts before the foe's outcome");
});

// ─── Encounter start ─────────────────────────────────────────────────────────

test("encounter start: encounterStarted + trackable + allyJoined + warlockBoost fold into one line", () => {
  const events = [
    { type: "encounterStarted", wandering: false, foes: [{ name: "Rat" }] },
    { type: "trackable" },
    { type: "allyJoined", name: "Bram" },
    { type: "warlockBoost", amount: 3 },
  ];
  const out = linesForAction("move", events, {});
  const enc = out.find((t) => t.priority === PRIORITY.feature && t.text.includes("Rat"));
  assert.ok(enc, "the encounter-start line is present");
  assert.ok(enc.text.includes("unnoticed"));
  assert.ok(enc.text.includes("Bram"));
  assert.ok(enc.text.includes("stiffen"));
});

test("encounter start: encounterStarted + two knight foeFled fold into one line, no standalone flee lines", () => {
  const events = [
    { type: "encounterStarted", wandering: false, foes: [{ name: "Goblin" }, { name: "Goblin" }] },
    { type: "foeFled", name: "Goblin", reason: "knight" },
    { type: "foeFled", name: "Goblin", reason: "knight" },
    { type: "encounterCleared" },
  ];
  const out = linesForAction("move", events, {});
  const goblinLines = out.filter((t) => /Goblin/.test(t.text));
  assert.equal(goblinLines.length, 1);
  assert.ok(goblinLines[0].text.includes("flees a Knight"));
  assert.ok(!out.some((t) => t.text.startsWith("Goblin flees")));
});

test("encounter start: a mid-fight lowHp foeFled with NO encounterStarted keeps its own line", () => {
  const out = linesForAction("move", [{ type: "foeFled", name: "Djinni", reason: "lowHp" }], {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.startsWith("Djinni runs"));
});

test("encounter start: knightBigFoe renders as its own clause", () => {
  const out = linesForAction("move", [{ type: "encounterStarted", wandering: false, foes: [{ name: "Troll" }], knightBigFoe: true }], {});
  assert.ok(out[0].text.includes("Knight"));
});

// ─── Chains ──────────────────────────────────────────────────────────────────

test("chains: fleeRolled + fled folds the roll into one hit line, roll first (Phase 42, FLEE-02)", () => {
  const events = [
    { type: "fleeRolled", roll: 9, atLeast: 9, dieN: 20, mods: [{ name: "Thief", delta: 5 }] },
    { type: "fled", reason: "escaped" },
  ];
  const out = linesForAction("flee", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Flee: 9 vs 9–20 (Thief +5). You get clear.");
  assert.equal(out[0].tone, "hit");
});

test("chains: fleeRolled + fleeFailed folds the roll into one miss line, roll first (Phase 42, FLEE-02)", () => {
  const events = [
    { type: "fleeRolled", roll: 3, atLeast: 14, dieN: 20, mods: [] },
    { type: "fleeFailed" },
  ];
  const out = linesForAction("flee", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Flee: 3 vs 14–20. You do not make it.");
  assert.equal(out[0].tone, "miss");
});

test("chains: parleyRolled + parleyFailed folds the roll into one line", () => {
  const events = [
    { type: "parleyRolled", roll: 15, atLeast: 12, dieN: 20, fluency: 0 },
    { type: "parleyFailed" },
  ];
  const out = linesForAction("parley", events, {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("(15 vs 12–20)"));
});

test("chains: chestLockRolled + chestOpened folds the roll into one line", () => {
  const events = [
    { type: "chestLockRolled", roll: 4, atLeast: 8, dieN: 10, picks: false, opened: true },
    { type: "chestOpened" },
  ];
  const out = linesForAction("openChest", events, {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("(4 vs 8–10)"));
});

test("chains: a Pilfer's roll-free chestOpened keeps its own line", () => {
  const out = linesForAction("openChest", [{ type: "chestOpened", reason: "pilfer" }], {});
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("Pilfer"));
});

// ─── Purity/determinism ──────────────────────────────────────────────────────

test("linesForAction is deterministic: the same input twice gives deepEqual output", () => {
  const events = [{ type: "struckByFoe", name: "Dante", dmg: 6 }, { type: "struck", target: "Dante", dmg: 8 }];
  assert.deepEqual(linesForAction("attack", events, {}), linesForAction("attack", events, {}));
});

test("linesForAction never mutates its input events array or its objects", () => {
  const events = [{ type: "struckByFoe", name: "Dante", dmg: 6 }, { type: "struck", target: "Dante", dmg: 8, critical: true }];
  const before = JSON.parse(JSON.stringify(events));
  linesForAction("attack", events, {});
  assert.deepEqual(events, before);
});

test("narrationLines.js source contains no Math.random / Date.now / document. / window. in the linesForAction pipeline", () => {
  const file = path.join(REPO_ROOT, "src", "browser", "narrationLines.js");
  const source = fs.readFileSync(file, "utf8");
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const lines = noBlockComments.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
  const offenses = [];
  lines.forEach((line, i) => {
    if (/Math\.random|Date\.now|document\.|window\./.test(line)) offenses.push(`${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(offenses, [], `Found disallowed reference in narrationLines.js:\n${offenses.join("\n")}`);
});
