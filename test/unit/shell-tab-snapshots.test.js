// test/unit/shell-tab-snapshots.test.js
//
// Phase 47 (SHELL-01/02/03), Plan 01, Task 3 — ROADMAP Phase 47 criterion 5's
// lock and the milestone's standing 3-screen DOM smoke: the Gear tab, the
// Hero tab and the Store, painted by mazeworld.html's REAL classic paint()/
// renderEncounter() (test/unit/harness/shellSandbox.js) into a recording
// document (test/unit/harness/recordingDom.js), serialized and compared
// byte-for-byte against committed BEFORE fixtures under
// test/unit/fixtures/shell-snapshots/.
//
// Phase 62 (GSCR-01..06), Plan 02: the Gear tab's fixtures (thief.gear/
// mu.gear/thief.gear-confirms) now capture the rebuilt tab's five sections —
// header (#gear-stats), WORN (#gear-worn-head/#gear-worn), BAG
// (#gear-bag-head/#gear-bag-meter/#gear-bag), CONSUMABLES (#gear-cons-head/
// #gear-cons) and ALSO ON YOU (#gear-kit-head/#gear-kit) — replacing the
// retired Phase 43 ON YOU/BAG panel ids. Deliberately regenerated and
// declared (this file's SUMMARY names the change); the Hero and Store
// fixtures are untouched.
//
// Fixtures are captured ONCE, before Plans 03-05 carve a single line out of
// the three render bodies — a diff after a carve means the carve moved the
// rendered DOM, never that the fixture needs updating. Regenerating a
// fixture requires a DECLARED, DELIBERATE DOM change with a written
// rationale (mirrors the engine-gate amendment's fixture-regeneration rule):
// re-run `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`
// only when a plan's own SUMMARY.md names the exact DOM change and why.
//
// MZ_SNAPSHOT_UPDATE=1: write (never compare) — the ONLY way any of these
// seven files are ever created or changed. A plain `node --test` run never
// writes a fixture (Task 3's own guard test below enforces this structurally
// — a missing/empty fixture is a hard failure, never a silent pass).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates, SNAPSHOT_IDS } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
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
  // rewrites a merged fixture with \r\n; the rendered text is always \n.
  const fixture = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  assert.equal(text, fixture, `${name}.txt mismatch — a diff here means the carve changed the rendered DOM (never the fixture): ${firstDiff(text, fixture)}`);
}

function paintFresh(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return { doc, sandbox };
}

const states = fixedStates();

// ─── 1/2: thief.hero, thief.gear ────────────────────────────────────────

test("SHELL-01/02: thief.hero — the Hero tab DOM for a fresh Thief", () => {
  const { doc } = paintFresh(states.thief);
  check("thief.hero", doc.serializeElements(SNAPSHOT_IDS.hero));
});

test("SHELL-01: thief.gear — the Gear tab DOM (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) for a fresh Thief with a full bag", () => {
  const { doc } = paintFresh(states.thief);
  check("thief.gear", doc.serializeElements(SNAPSHOT_IDS.gear));
});

// ─── 3: thief.gear-confirms — the Drop confirm + the jewelry swap confirm ──

test("SHELL-01: thief.gear-confirms — the Drop confirm and the jewelry swap confirm, both armed", () => {
  const { doc } = paintFresh(states.thief);
  const bag = doc.elementsById.get("gear-bag");
  assert.ok(bag, "expected #gear-bag to exist after paint()");

  const buttons = [];
  (function walk(el) {
    for (const child of el.children) {
      if (child.nodeType === 3) continue;
      if (child.tagName === "button") buttons.push(child);
      walk(child);
    }
  })(bag);

  const dropBtn = buttons.find((b) => b.textContent === "Drop");
  assert.ok(dropBtn, "expected at least one bag card's Drop button");
  dropBtn.onclick();

  const equipBtns = buttons.filter((b) => b.textContent === "Equip");
  assert.ok(equipBtns.length >= 1, "expected at least one bag card's Equip button");
  for (const b of equipBtns) b.onclick();

  const text = doc.serializeElements(["gear-bag"]);
  assert.ok(text.includes("Drop it?"), "expected the armed Drop confirm's 'Drop it?' label");
  assert.ok(text.includes("Swap for which?"), "expected the armed jewelry swap confirm's 'Swap for which?' label (both jewelry keys are worn)");
  check("thief.gear-confirms", text);
});

// ─── 4: thief-store.store ───────────────────────────────────────────────

test("SHELL-01: thief-store.store — a full-bag Thief's store screen", () => {
  const { doc, sandbox } = paintFresh(states.thiefStore);
  sandbox.renderEncounter();
  const text = doc.serializeElements(SNAPSHOT_IDS.store);
  assert.ok(text.includes("Bag full ("), "expected the bag-full store line");
  assert.ok(text.includes("sold") || text.includes(" wm"), "expected at least one priced or sold shelf row");
  check("thief-store.store", text);
});

// ─── 5/6: mu.hero, mu.gear ───────────────────────────────────────────────

test("SHELL-02: mu.hero — the Hero tab DOM for a Magic User with a joined party member", () => {
  const { doc } = paintFresh(states.mu);
  const text = doc.serializeElements(SNAPSHOT_IDS.hero);
  assert.ok(text.includes("Spells are the trick."), "expected the Magic User abilities-list copy");
  assert.ok(text.includes("mw-party-member"), "expected the joined party member's Company panel card");
  check("mu.hero", text);
});

test("SHELL-01: mu.gear — the Gear tab DOM (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) for a Magic User with every worn slot empty", () => {
  const { doc } = paintFresh(states.mu);
  check("mu.gear", doc.serializeElements(SNAPSHOT_IDS.gear));
});

// ─── 7: mu-store.store ───────────────────────────────────────────────────

test("SHELL-01: mu-store.store — a Magic User's store screen with nothing to sell", () => {
  const { doc, sandbox } = paintFresh(states.muStore);
  sandbox.renderEncounter();
  check("mu-store.store", doc.serializeElements(SNAPSHOT_IDS.store));
});

// ─── 8: SHELL-03 idempotency — a second renderEncounter() never duplicates ─

test("SHELL-03: rendering the store twice from the same state serializes byte-equal (no duplicate rows)", () => {
  const { doc, sandbox } = paintFresh(states.thiefStore);
  sandbox.renderEncounter();
  const first = doc.serializeElements(SNAPSHOT_IDS.store);
  const firstGoodsCount = (first.match(/class="goods/g) || []).length;
  assert.ok(firstGoodsCount >= 1, "expected at least one store 'goods' row to compare against");

  sandbox.renderEncounter();
  const second = doc.serializeElements(SNAPSHOT_IDS.store);
  const secondGoodsCount = (second.match(/class="goods/g) || []).length;

  assert.equal(second, first, "a second renderEncounter() on the same state must serialize byte-identically to the first — never a duplicate row");
  assert.equal(secondGoodsCount, firstGoodsCount, "the store's 'goods' row count must not change on a repeat render");
});

// ─── 9: serializer / paint() determinism ────────────────────────────────

test("determinism: two independent sandboxes painting the same fixed state serialize identically", () => {
  const a = paintFresh(states.thief);
  const b = paintFresh(states.thief);
  const idsAB = SNAPSHOT_IDS.hero.concat(SNAPSHOT_IDS.gear);
  assert.equal(a.doc.serializeElements(idsAB), b.doc.serializeElements(idsAB));
});

// ─── 10: guard — a plain run must never pass on a missing/empty fixture ────

test("guard: all seven fixtures exist and are non-empty (a plain run never writes one)", { skip: UPDATE && "capture mode — the guard only applies to a compare run" }, () => {
  const names = ["thief.hero", "thief.gear", "thief.gear-confirms", "thief-store.store", "mu.hero", "mu.gear", "mu-store.store"];
  for (const name of names) {
    const file = path.join(FIXTURE_DIR, `${name}.txt`);
    assert.ok(fs.existsSync(file), `missing fixture ${file}`);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 0, `fixture ${file} is empty`);
  }
});
