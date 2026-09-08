// ENG-05 chargen parity: the extracted engine rolls a character byte-identical
// to the frozen prototype for the same seed. Both sides consume the SAME
// mulberry32 stream (the sandbox seeds Math.random with it; the engine reads it
// via makeRng), in the SAME order (rollCharacter → genFloor(1)), so the rolled
// adventurer must match field-for-field.
//
// Comparison is scoped to the character subtree (state.c), which is the domain
// this plan extracts. Maze/floor parity is proven separately by the 01-04 maze
// suite. Volatile wall-clock fields are stripped by diffState before comparison
// (a fresh character carries none, but the helper keeps this consistent with
// the rest of the parity harness).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.chargen.json"), "utf8"),
);
const SEEDS = FIXTURE.seeds;

// The gameplay-relevant character fields to compare. This is the full stored
// character shape both sides build from the same object literal; listing it
// explicitly documents the parity surface (and guards against a stray extra
// field on either side going unnoticed). Any field the prototype computes only
// in narration (never stored on S.c) is out of scope — there are none: the
// prototype's `if(log)` branch only reads already-stored fields.
const CHARACTER_FIELDS = [
  "cls", "sub", "race", "intel", "level", "sp", "maxWP", "wp", "skills", "vp",
  "weapon", "prof", "magicWpn", "armor", "ar", "armorMin", "armorWP", "armorMax",
  "patches", "temperament", "motive", "phobia", "phobiaType", "potions", "rations",
  "gold", "scrolls", "haste", "invis", "ether", "acute", "affliction", "joiner",
  "items", "grimoire", "spellsUsed", "kills", "might", "ward", "regen", "mirror",
  "foresight", "name",
];

test("engine chargen matches the frozen prototype for every fixture seed", () => {
  assert.ok(Array.isArray(SEEDS) && SEEDS.length > 0, "fixture must carry a non-empty seeds array");

  for (const seed of SEEDS) {
    // Prototype side: loading the sandbox already runs the prototype's boot
    // (`load() || newGame()`), and with no save present that calls newGame()
    // once, consuming the seeded stream from position 0 — exactly what the
    // engine's newRun(seed) does. So read the rolled S.c directly; calling
    // newGame() again would draw from the advanced stream and diverge.
    const ctx = loadPrototypeSandbox({ seed });
    const protoC = ctx.S.c;

    // Engine side: newRun consumes the identical stream in the identical order.
    const engineC = newRun(seed).c;

    // Compare the full stored character on both sides.
    assert.deepStrictEqual(
      Object.keys(engineC).sort(),
      CHARACTER_FIELDS.slice().sort(),
      `seed ${seed}: engine character shape drifted from the documented field set`,
    );

    const divergence = diffState(protoC, engineC);
    assert.equal(
      divergence,
      null,
      `seed ${seed} (${protoC.cls}/${protoC.sub}/${protoC.race}): character diverges at ${divergence}`,
    );
  }
});

test("the fixture seed set collectively exercises all classes, races and a grimoire", () => {
  const classes = new Set();
  const races = new Set();
  let sawGrimoire = false;
  for (const seed of SEEDS) {
    const c = newRun(seed).c;
    classes.add(c.cls);
    races.add(c.race);
    if (c.cls === "Magic User" && c.grimoire.length >= 4) sawGrimoire = true;
  }
  assert.deepStrictEqual([...classes].sort(), ["Fighter", "Magic User", "Thief"]);
  assert.deepStrictEqual(
    [...races].sort(),
    ["Dwarven", "Elven", "Fridgian", "Human", "Troll", "Wilmsry"],
  );
  assert.ok(sawGrimoire, "seed set must include a Magic User with a grimoire");
});
