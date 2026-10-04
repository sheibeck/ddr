// test/unit/shell-ability-states.test.js
//
// Phase 94 (ASTATE-05, CONTEXT "Themes"), Plan 05, Task 1 — the rendered
// ability rows of both surfaces, painted by mazeworld.html's REAL classic
// renderEncounter()/paint() (test/unit/harness/shellSandbox.js) into a
// recording document and captured into two NEW declared fixtures under
// test/unit/fixtures/shell-snapshots/:
//
//   - fighter.abilities-states: the combat ABILITIES submenu (#cb-sub-title,
//     #cb-sub-list), one row per state: Kata ready, Pommel Strike recharging,
//     Death Touch spent, Sweep unavailable (one foe), Last Stand unavailable
//     (full hp).
//   - fighter.hero-in-combat: the Hero tab's #s-abilities list in the same
//     fight, the same words and a data-state per row.
//
// Declared change: both fixtures are NEW (captured once with
// `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-ability-states.test.js`);
// the eight Phase 47 shell-snapshot fixtures stay byte-identical. Any later
// difference here is a DOM change to declare in its SUMMARY, never a fixture
// to regenerate silently.
//
// Phase 96 (FLAVOR-04), Plan 06: fighter.abilities-states is a declared regeneration: each ability row's description reads its
// flavour line and sits in a RULES wrapper (a sibling toggle and a hidden body holding the exact txt); the state words, ids and
// data-state are unchanged.
//
// A third test (no fixture) checks the Bard's SING row: data-state recharging
// and READY IN N between its two songs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { startCooldown } from "../../engine/effects.js";
import { ONCE_A_FIGHT } from "../../content/index.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "fixtures", "shell-snapshots");
const UPDATE = process.env.MZ_SNAPSHOT_UPDATE === "1";

/** firstDiff(a, b) — the first differing 1-indexed line number and both
 * lines, for a legible assertion failure message on a real mismatch. */
function firstDiff(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      return `line ${i + 1}:\n  got:      ${JSON.stringify(la[i] ?? "<missing>")}\n  expected: ${JSON.stringify(lb[i] ?? "<missing>")}`;
    }
  }
  return "(no line difference found — lengths differ only in trailing content)";
}

/** check(name, text) — MZ_SNAPSHOT_UPDATE=1 writes `<name>.txt`; otherwise a
 * missing fixture is a hard failure (never a silent pass) and a present one
 * is compared byte-for-byte, with a first-line-diff message on mismatch. */
function check(name, text) {
  const file = path.join(FIXTURE_DIR, `${name}.txt`);
  if (UPDATE) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(file, text, "utf8");
    return;
  }
  assert.ok(fs.existsSync(file), `missing fixture ${file} — run once with MZ_SNAPSHOT_UPDATE=1 to capture the BEFORE fixture`);
  // CRLF-tolerant: a Windows checkout (core.autocrlf=true, no .gitattributes)
  // rewrites a fixture with \r\n; the rendered text is always \n.
  const fixture = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  assert.equal(text, fixture, `${name}.txt mismatch — a diff here means the rendered DOM changed (never the fixture): ${firstDiff(text, fixture)}`);
}

// ─── fixed* helpers — copied from test/unit/combat-lock-shell.test.js ─────

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Sword", prof: 2, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

/** The mid-fight shape (combat-lock-shell's midFightRound), one live foe,
 * `pending: false`. */
function fightState(cOverrides = {}, combatOverrides = {}) {
  const state = fixedState({ c: cOverrides });
  state.combat = {
    foes: [fixedFoe({ name: "Cave Rat", wp: 40, maxWP: 40 })],
    type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you",
    pending: false,
    ...combatOverrides,
  };
  return state;
}

/** A Fighter with five abilities, one per reason: Kata ready, Pommel Strike
 * recharging (3 rounds), Death Touch spent (once a fight), Sweep and Last
 * Stand unavailable (one foe; full hp). */
function fighterFight() {
  const state = fightState({ abilities: ["kata", "pommelStrike", "deathTouch", "sweep", "lastStand"] });
  startCooldown(state.c, "ability:pommelStrike", { rounds: 3 });
  startCooldown(state.c, "ability:deathTouch", { rounds: ONCE_A_FIGHT });
  return state;
}

const STATES = ["ready", "recharging", "spent", "unavailable", "unavailable"];
const COSTS = ["READY", "READY IN 3", "SPENT THIS FIGHT", "NEEDS TWO OR MORE FOES", "NEEDS A QUARTER HP OR LESS"];

function walk(node, out = []) {
  for (const child of node.children || []) {
    if (child.nodeType === 3) continue;
    out.push(child);
    walk(child, out);
  }
  return out;
}

/** Phase 96 (FLAVOR-04): an ability row is now a .mw-rules-wrap whose first child is the unchanged row button; this reads the button. */
const rowButton = (el) => (String(el.className || "").split(" ").includes("mw-rules-wrap") ? el.children[0] : el);

/** The text of an element's descendants, depth-first (the recording DOM keeps
 * text as node.textContent on each element). */
const textOf = (el) => String(el.textContent ?? "");

// ─── (a) the combat ABILITIES submenu ────────────────────────────────────

test("ASTATE-05: fighter.abilities-states — the combat ABILITIES submenu shows four states by data-state and words", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(fighterFight());
  sandbox.context.window.__mzCombatMenu = { open: "abilities" };
  sandbox.context.renderEncounter();

  const list = doc.document.getElementById("cb-sub-list");
  // Phase 96 (FLAVOR-04): declared re-pin: each child is a RULES wrapper; the assertions read its row button, unchanged.
  const rows = Array.from(list.children).map(rowButton);
  assert.equal(rows.length, 5, "one row per ability");
  assert.deepEqual(rows.map((r) => r.dataset.state), STATES);
  for (const [i, row] of rows.entries()) {
    assert.ok(textOf(row).includes(COSTS[i]) || walk(row).some((d) => textOf(d) === COSTS[i]), `row ${i} reads ${COSTS[i]}`);
    assert.ok(!String(row.className || "").split(/\s+/).includes("cb-row-off"), `row ${i} is not the shared off class`);
    assert.ok(!row.disabled, `row ${i} is not disabled`);
  }
  check("fighter.abilities-states", doc.serializeElements(["cb-sub-title", "cb-sub-list"]));
});

// ─── (b) the Hero tab in a fight ─────────────────────────────────────────

test("ASTATE-05: fighter.hero-in-combat — the Hero tab's ability list carries the same words and a data-state per row", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(fighterFight());
  sandbox.paint();

  const list = doc.document.getElementById("s-abilities");
  const items = Array.from(list.children);
  assert.equal(items.length, 5, "one list item per ability");
  assert.deepEqual(items.map((li) => li.dataset.state), STATES);
  for (const [i, li] of items.entries()) {
    assert.ok(walk(li).some((d) => textOf(d) === COSTS[i]), `item ${i} has a span reading ${COSTS[i]}`);
  }
  check("fighter.hero-in-combat", doc.serializeElements(["s-abilities"]));
});

// ─── (c) the Bard's SING row ─────────────────────────────────────────────

test("ASTATE-01: the Bard's SING row carries data-state recharging and reads READY IN N between its two songs", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const state = fightState({ cls: "Fighter", sub: "Bard", abilities: [] }, { sang: true, sangAt: 2, round: 3 });
  sandbox.setState(state);
  sandbox.context.window.__mzCombatMenu = { open: "abilities" };
  sandbox.context.renderEncounter();

  // Phase 96 (FLAVOR-04): the SING row sits in a RULES wrapper; the assertions read its row button, unchanged.
  const rows = Array.from(doc.document.getElementById("cb-sub-list").children).map(rowButton);
  assert.ok(rows.length >= 1, "the Sing row is listed");
  assert.equal(rows[0].dataset.state, "recharging");
  assert.ok(walk(rows[0]).some((d) => textOf(d) === "READY IN 4"), "the first row reads READY IN 4");
});
