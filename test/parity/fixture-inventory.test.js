// test/parity/fixture-inventory.test.js
//
// FID-01 (Phase 17): pins WHICH `content/bestiary.js` creatures the frozen
// parity fixtures roll, so Phase 18's bestiary rebalance can never silently
// touch a fixture-exposed creature without a deliberate, named
// `comparables.js` carve-out. If this test fails after an INTENTIONAL
// fixture/seed/bestiary change, regenerate test/parity/FIXTURE-INVENTORY.md
// too — do not just update this file's pinned array (see
// .planning/research/PITFALLS.md Pitfall 14: never silently regenerate
// expected values without a paired, reviewable intent artifact).
//
// Every assertion here is checked against a REPLAY through the harness
// (enumerateFixtureRoster, which reuses applyStartCombat/applyAction/
// runEconomyAction — see test/parity/harness/fixtureRoster.js), never against
// hand-derived expectations.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { enumerateFixtureRoster, rosterToMarkdown, FIXTURE_ORDER } from "./harness/fixtureRoster.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
const DOC_PATH = path.resolve(__dirname, "FIXTURE-INVENTORY.md");

// Enumerate ONCE at module top and share the rows across every test below.
const rows = enumerateFixtureRoster();

test("FID-01: the five fixture fights roll exactly the pinned creatures, in order", () => {
  const fightRows = rows
    .filter((r) => r.foes.length)
    .map(({ fixture, scenario, seed, forced, foes }) => ({ fixture, scenario, seed, forced, foes }));

  assert.deepStrictEqual(fightRows, [
    {
      fixture: "action-script.combat.json",
      scenario: "win",
      seed: 3,
      forced: "Beasts",
      foes: [{ name: "Shriek", type: "Beasts", lvl: 1, wp: 3 }],
    },
    {
      fixture: "action-script.combat.json",
      scenario: "lose",
      seed: 14,
      forced: "Beasts",
      foes: [
        { name: "Bat/Rat", type: "Beasts", lvl: 1, wp: 1 },
        { name: "Shriek", type: "Beasts", lvl: 1, wp: 3 },
      ],
    },
    {
      fixture: "action-script.combat.json",
      scenario: "flee",
      seed: 17,
      forced: "Beasts",
      foes: [
        { name: "Viper", type: "Beasts", lvl: 1, wp: 3 },
        { name: "Shriek", type: "Beasts", lvl: 1, wp: 3 },
      ],
    },
    {
      fixture: "action-script.combat.json",
      scenario: "parley",
      seed: 303,
      forced: "Humans",
      foes: [
        { name: "Dante", type: "Humans", lvl: 1, wp: 20 },
        { name: "Dante", type: "Humans", lvl: 1, wp: 20 },
      ],
    },
    {
      fixture: "action-script.magic.json",
      scenario: "cast-damage",
      seed: 8,
      forced: "Beasts",
      foes: [{ name: "Shriek", type: "Beasts", lvl: 1, wp: 3 }],
    },
  ]);

  // trigger is asserted separately: every fight row starts via startCombat.
  const fightTriggers = rows.filter((r) => r.foes.length).map((r) => r.trigger);
  assert.deepStrictEqual(fightTriggers, Array(5).fill("startCombat"));
});

test("FID-01: the parity-exposed surface is exactly 2 types x 4 names, all level 1", () => {
  const names = [...new Set(rows.flatMap((r) => r.foes.map((f) => `${f.type}:${f.name}`)))].sort();
  assert.deepStrictEqual(names, ["Beasts:Bat/Rat", "Beasts:Shriek", "Beasts:Viper", "Humans:Dante"]);

  for (const row of rows) {
    for (const foe of row.foes) {
      assert.equal(foe.lvl, 1, `${row.fixture} ${row.scenario} rolled a non-level-1 foe: ${foe.name}`);
    }
  }

  const forcedValues = [...new Set(rows.filter((r) => r.foes.length).map((r) => r.forced))].sort();
  assert.deepStrictEqual(forcedValues, ["Beasts", "Humans"]);
});

test("FID-01: every non-fight scenario is present as an explicit none row and nothing rolls a wandering monster", () => {
  const findRow = (fixture, scenario) => rows.find((r) => r.fixture === fixture && r.scenario === scenario);

  const expectedNoneRows = [
    ["action-script.magic.json", "heal"],
    ["action-script.magic.json", "potion"],
    ["action-script.magic.json", "scroll"],
    ["action-script.encounters.json", "trap"],
    ["action-script.encounters.json", "chest"],
    ["action-script.encounters.json", "tablefour"],
    ["action-script.encounters.json", "faerie"],
    ["action-script.encounters.json", "affliction"],
    ["action-script.economy.json", "(script)"],
    ["action-script.movement.json", "(script)"],
  ];

  for (const [fixture, scenario] of expectedNoneRows) {
    const row = findRow(fixture, scenario);
    assert.ok(row, `expected a row for ${fixture} / ${scenario}`);
    assert.equal(row.trigger, "none", `${fixture} / ${scenario} should be trigger "none"`);
    assert.deepStrictEqual(row.foes, [], `${fixture} / ${scenario} should have no foes`);
  }

  const chargenRow = rows.find((r) => r.fixture === "action-script.chargen.json");
  assert.ok(chargenRow, "expected a chargen row");
  assert.equal(chargenRow.trigger, "none");
  assert.deepStrictEqual(chargenRow.foes, []);

  assert.ok(
    rows.every((r) => r.trigger !== "wandering"),
    "no row should ever report a wandering-monster combat start",
  );

  // Rows appear in FIXTURE_ORDER order (fixture index is non-decreasing).
  const indexOf = (fixtureFile) => FIXTURE_ORDER.findIndex((n) => fixtureFile === `action-script.${n}.json`);
  const indices = rows.map((r) => indexOf(r.fixture));
  for (let i = 1; i < indices.length; i++) {
    assert.ok(indices[i] >= indices[i - 1], `row ${i} (${rows[i].fixture}) is out of FIXTURE_ORDER order`);
  }
});

test("FID-01 precision: every row's seed is the fixture's integer seed, verbatim", () => {
  const chargenFixture = readFixture("action-script.chargen.json");
  const movementFixture = readFixture("action-script.movement.json");
  const combatFixture = readFixture("action-script.combat.json");
  const magicFixture = readFixture("action-script.magic.json");
  const economyFixture = readFixture("action-script.economy.json");
  const encountersFixture = readFixture("action-script.encounters.json");

  for (const row of rows) {
    assert.ok(Number.isInteger(row.seed), `${row.fixture} / ${row.scenario} seed must be an integer`);

    let expectedSeed;
    if (row.fixture === "action-script.chargen.json") expectedSeed = chargenFixture.seed;
    else if (row.fixture === "action-script.movement.json") expectedSeed = movementFixture.seed;
    else if (row.fixture === "action-script.economy.json") expectedSeed = economyFixture.seed;
    else if (row.fixture === "action-script.combat.json") {
      expectedSeed = combatFixture.scenarios.find((s) => s.name === row.scenario).seed;
    } else if (row.fixture === "action-script.magic.json") {
      expectedSeed = magicFixture.scenarios.find((s) => s.name === row.scenario).seed;
    } else if (row.fixture === "action-script.encounters.json") {
      expectedSeed = encountersFixture.scenarios.find((s) => s.name === row.scenario).seed;
    } else {
      assert.fail(`unrecognized fixture: ${row.fixture}`);
    }

    assert.equal(row.seed, expectedSeed, `${row.fixture} / ${row.scenario} seed mismatch`);
  }
});

test("FID-01: FIXTURE-INVENTORY.md's generated block matches the live replay", () => {
  const doc = fs.readFileSync(DOC_PATH, "utf8");
  const beginMarker = "<!-- fixture-inventory:generated:begin -->";
  const endMarker = "<!-- fixture-inventory:generated:end -->";
  const beginIdx = doc.indexOf(beginMarker);
  const endIdx = doc.indexOf(endMarker);
  assert.ok(beginIdx !== -1 && endIdx !== -1, "FIXTURE-INVENTORY.md must contain both generated-block markers");

  const generatedBlock = doc
    .slice(beginIdx + beginMarker.length, endIdx)
    .replace(/\r\n/g, "\n")
    .trim();

  assert.equal(generatedBlock, rosterToMarkdown(rows));

  for (const name of ["Bat/Rat", "Shriek", "Viper", "Dante"]) {
    assert.ok(doc.includes(name), `FIXTURE-INVENTORY.md should mention ${name}`);
  }
  assert.ok(doc.includes("## What this means for Phase 18"));
});
