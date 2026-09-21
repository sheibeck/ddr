// test/parity/divergence-records.test.js
//
// Phase 45 (HEDGE-03): a standing guard over EVERY declared divergence
// record across all six fixture files — "declared set == measured set,
// every field before != after". Complements chargen-parity.test.js's
// existing well-formedness guard (chargen-only, capped at 11 records) with a
// fixture-wide sweep that also pins the MOVED SET identity: the holders that
// declare `worn` in their `fields` must be EXACTLY the sites
// tools/worn-fixture-scan.mjs measured, no more, no less.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

const CHARGEN_FIXTURE = readFixture("action-script.chargen.json");
const MOVEMENT_FIXTURE = readFixture("action-script.movement.json");
const COMBAT_FIXTURE = readFixture("action-script.combat.json");
const MAGIC_FIXTURE = readFixture("action-script.magic.json");
const ECONOMY_FIXTURE = readFixture("action-script.economy.json");
const ENCOUNTERS_FIXTURE = readFixture("action-script.encounters.json");

const SCAN_OUTPUT_PATH = path.resolve(__dirname, "..", "..", "tools", "worn-fixture-scan-output.txt");
const INITIATIVE_SCAN_OUTPUT_PATH = path.resolve(__dirname, "..", "..", "tools", "initiative-fixture-scan-output.txt");

/**
 * collectRecords() — walks every fixture file and returns a flat array of
 * `{ id, holderId, kind, record }` entries, one per declared divergence
 * record found anywhere in the six fixture files:
 *   - `action-script.chargen.json#divergences` (keyed by seed string) —
 *     holder id `action-script.chargen.json#seed-<N>`.
 *   - a scenario-based fixture (combat/magic/encounters — carries a
 *     `.scenarios` array) — holder id `<file>#<scenario.name>`, one entry
 *     per `scenario.divergence` and `scenario.chargenDivergence` present.
 *   - a script-level fixture (movement/economy — no `.scenarios`, a single
 *     `seed`/`actions` pair at the top level) — holder id `<file>#script`,
 *     one entry per top-level `divergence`/`chargenDivergence` present.
 *
 * `id` is `<holderId>:<recordKey>` (`recordKey` one of `divergences`,
 * `divergence`, `chargenDivergence`) — a unique human-readable label for
 * assertion messages. `holderId` is the bare site identifier shared with
 * `tools/worn-fixture-scan-output.txt`'s MOVED SET vocabulary.
 */
function collectRecords() {
  const out = [];

  for (const [seedKey, record] of Object.entries(CHARGEN_FIXTURE.divergences || {})) {
    const holderId = `action-script.chargen.json#seed-${seedKey}`;
    out.push({ id: `${holderId}:divergences`, holderId, kind: "divergences", record });
  }

  const scenarioFixtures = [
    ["action-script.combat.json", COMBAT_FIXTURE],
    ["action-script.magic.json", MAGIC_FIXTURE],
    ["action-script.encounters.json", ENCOUNTERS_FIXTURE],
  ];
  for (const [fileName, fixture] of scenarioFixtures) {
    for (const scenario of fixture.scenarios || []) {
      const holderId = `${fileName}#${scenario.name}`;
      if (scenario.divergence) out.push({ id: `${holderId}:divergence`, holderId, kind: "divergence", record: scenario.divergence });
      if (scenario.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, holderId, kind: "chargenDivergence", record: scenario.chargenDivergence });
    }
  }

  const scriptFixtures = [
    ["action-script.movement.json", MOVEMENT_FIXTURE],
    ["action-script.economy.json", ECONOMY_FIXTURE],
  ];
  for (const [fileName, fixture] of scriptFixtures) {
    const holderId = `${fileName}#script`;
    if (fixture.divergence) out.push({ id: `${holderId}:divergence`, holderId, kind: "divergence", record: fixture.divergence });
    if (fixture.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, holderId, kind: "chargenDivergence", record: fixture.chargenDivergence });
  }

  return out;
}

const RECORDS = collectRecords();

test("every declared divergence record across all fixtures is narrow and well-formed", () => {
  assert.ok(RECORDS.length > 0, "expected at least one declared divergence record across the six fixtures");

  for (const { id, record } of RECORDS) {
    assert.ok(record.phase, `${id}: missing phase`);
    assert.ok(Array.isArray(record.requirements) && record.requirements.length > 0, `${id}: requirements must be a non-empty array`);
    assert.ok(Array.isArray(record.fields) && record.fields.length > 0, `${id}: fields must be a non-empty array`);
    assert.ok(record.before && typeof record.before === "object" && !Array.isArray(record.before), `${id}: missing/malformed before`);
    assert.ok(record.after && typeof record.after === "object" && !Array.isArray(record.after), `${id}: missing/malformed after`);
    assert.ok(typeof record.rationale === "string" && record.rationale.length > 0, `${id}: missing rationale`);

    for (const key of Object.keys(record.before)) {
      assert.ok(record.fields.includes(key), `${id}: before carries key "${key}" not declared in fields`);
    }
    for (const key of Object.keys(record.after)) {
      assert.ok(record.fields.includes(key), `${id}: after carries key "${key}" not declared in fields`);
    }

    if (record.kind === "action-path") {
      assert.ok(Number.isInteger(record.fromAction), `${id}: an action-path record must declare an integer fromAction`);
      // An action-path record's declared purpose is "the per-action byte
      // diff is skipped from fromAction onward because the RNG draw
      // sequence itself diverges" — its `fields` pin the machine-checked
      // END state, which can legitimately land on the SAME value both
      // sides (e.g. combat.json's pre-existing lose-apprentice/parley
      // records: the draw sequence differs but some end fields coincide).
      // The per-field "before != after" invariant below is therefore only
      // meaningful for a kind-less (field-strip) record; skip it here.
    } else {
      for (const field of record.fields) {
        assert.notDeepStrictEqual(
          record.before[field],
          record.after[field],
          `${id}: field "${field}" has no real before/after difference — this looks like a blanket regeneration, not a declared divergence`,
        );
      }
    }
  }
});

test("HEDGE-03: the holders declaring worn are exactly the scan's MOVED SET", () => {
  const scanOutput = fs.readFileSync(SCAN_OUTPUT_PATH, "utf8");
  const movedSetLine = scanOutput.split("\n").find((line) => /^MOVED SET \(\d+\): /.test(line));
  assert.ok(movedSetLine, "tools/worn-fixture-scan-output.txt must carry a MOVED SET line");

  const match = movedSetLine.match(/^MOVED SET \((\d+)\): (.*)$/);
  assert.ok(match, "MOVED SET line did not match the expected format");
  const [, countStr, idList] = match;
  const moved = new Set(
    idList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  assert.equal(moved.size, Number(countStr), "MOVED SET line's declared count does not match its own id list length");

  const declared = new Set(RECORDS.filter(({ record }) => Array.isArray(record.fields) && record.fields.includes("worn")).map(({ holderId }) => holderId));

  assert.ok(declared.size > 0, "expected at least one holder to declare worn");
  assert.deepStrictEqual([...declared].sort(), [...moved].sort());
});

test("INIT-01: the holders declaring Phase 51 are exactly the initiative scan's MOVED SET", () => {
  const scanOutput = fs.readFileSync(INITIATIVE_SCAN_OUTPUT_PATH, "utf8");
  const movedSetLine = scanOutput.split("\n").find((line) => /^MOVED SET \(\d+\): /.test(line));
  assert.ok(movedSetLine, "tools/initiative-fixture-scan-output.txt must carry a MOVED SET line");

  const match = movedSetLine.match(/^MOVED SET \((\d+)\): (.*)$/);
  assert.ok(match, "MOVED SET line did not match the expected format");
  const [, countStr, idList] = match;
  const moved = new Set(
    idList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  assert.equal(moved.size, Number(countStr), "MOVED SET line's declared count does not match its own id list length");

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("51")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.ok(declared.size > 0, "expected at least one holder to declare Phase 51");
  assert.deepStrictEqual([...declared].sort(), [...moved].sort());
});

test("DMG-02: the holders declaring Phase 52 are exactly the measured moved set", () => {
  // Unlike Phase 51's INIT-01 guard above, tools/initiative-fixture-scan.mjs
  // carries no crit-exposure predictor line — a foe crit is not an
  // initiative-round-advance event, so it cannot be read off the scan's own
  // Part A invariant. The measured set below comes from the Phase 52 plan's
  // own crit-exposure predictor (a scratch replay of every combat/magic site
  // counting struckByFoe/memberStruck events with critical/soldierCrit),
  // cross-checked against tools/initiative-fixture-scan.mjs's Part B diff at
  // this commit (only #lose's fields.after moved) and the full parity suite
  // (all green) — see test/parity/FIXTURE-INVENTORY.md's Phase 52 section for
  // the full accounting.
  const EXPECTED = ["action-script.combat.json#lose"];

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("52")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.ok(declared.size > 0, "expected at least one holder to declare Phase 52");
  assert.deepStrictEqual([...declared].sort(), [...EXPECTED].sort());
});
