// test/unit/roller.test.js
//
// Phase 50 (ROLL-01) — src/browser/roller.js's own behaviour + source-pin
// suite. Pins the fix for the two structural weaknesses the Phase 50 scout
// found in the inline mazeworld.html roller block: (1) un-guarded re-entry
// (overlapping start() calls each pushed their own lock/reveal timers, and a
// first roll's awaited startNewRun could resolve after a second roll had
// already reset the screen) — fixed by a monotonic roll token plus a
// serialized startNewRun promise chain; (2) the reels locking on a `sheet`
// captured once while the CTA committed a separately-tracked pending state —
// fixed by having every lock step and the reveal read
// sheetFor(rollerPendingState) fresh, and commit() handing onCommit that
// same object. Mirrors test/unit/heroTab.test.js's source-pin conventions
// (stripJs, no-globals scan, id-containment, voice scan).

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED } from "../../content/safety-wordlist.js";
import { newRun } from "../../engine/state.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import * as roller from "../../src/browser/roller.js";
import { ROLLER_IDS, ROLLER_TIMELINE, ROLLER_COPY, ROLLER_CSS, reelWordLists, createRoller } from "../../src/browser/roller.js";
import { footerLines } from "../../src/browser/identityFooter.js";
import { flavorOfIdentity } from "../../src/browser/flavorText.js";
import { setAlwaysRules, clearRulesOpen } from "../../src/browser/rulesLayer.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ROLLER_PATH = path.join(REPO_ROOT, "src", "browser", "roller.js");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

const ROLLER_RAW = fs.readFileSync(ROLLER_PATH, "utf8").replace(/\r\n/g, "\n");
const ROLLER_STRIPPED = stripJs(ROLLER_RAW);
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── test-local helpers (no new harness file) ────────────────────────────

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise((r) => setImmediate(r));
}

/**
 * makeFakeTimers() — an injectable timers object over an internal Map of
 * { at, fn, every } keyed by a numeric id. advance(ms) fires due timers in
 * `at` order (re-arming intervals by `every`, deleting one-shots), awaiting
 * a microtask hop between fires so chained .then()s settle before the next
 * timer fires, then sets the clock to the target.
 */
function makeFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimeout_(fn, ms) {
    const id = nextId++;
    timers.set(id, { at: now + ms, fn, every: null });
    return id;
  }
  function clearTimeout_(id) {
    timers.delete(id);
  }
  function setInterval_(fn, ms) {
    const id = nextId++;
    timers.set(id, { at: now + ms, fn, every: ms });
    return id;
  }
  function clearInterval_(id) {
    timers.delete(id);
  }
  async function advance(ms) {
    const target = now + ms;
    for (;;) {
      let nextEntry = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (!nextEntry || t.at < nextEntry[1].at)) nextEntry = [id, t];
      }
      if (!nextEntry) break;
      const [id, t] = nextEntry;
      now = t.at;
      if (t.every != null) {
        t.at = now + t.every;
      } else {
        timers.delete(id);
      }
      t.fn();
      await Promise.resolve();
    }
    now = target;
  }
  function pendingCount() {
    return timers.size;
  }

  return {
    setTimeout: setTimeout_,
    clearTimeout: clearTimeout_,
    setInterval: setInterval_,
    clearInterval: clearInterval_,
    now: () => now,
    pending: pendingCount,
    advance,
  };
}

function makeRig() {
  const { document } = createRecordingDocument();
  const calls = [];
  const startNewRun = () => {
    const d = deferred();
    calls.push(d);
    return d.promise;
  };
  const committed = [];
  const onCommit = (s) => committed.push(s);
  const timers = makeFakeTimers();
  const random = () => 0;
  const rollerInstance = createRoller({ doc: document, startNewRun, sheetFor: characterSheetViewModel, onCommit, timers, random });
  const el = (id) => document.getElementById(id);
  const reelText = () => ({
    race: el(ROLLER_IDS.race).textContent,
    cls: el(ROLLER_IDS.cls).textContent,
    sub: el(ROLLER_IDS.sub).textContent,
    name: el(ROLLER_IDS.name).textContent,
    quirk: el(ROLLER_IDS.quirk).textContent,
  });
  return { document, calls, startNewRun, committed, onCommit, timers, random, roller: rollerInstance, el, reelText };
}

// Fixture states — real engine rolls (deterministic per seed), and the real
// Hero-tab sheet function.
const A = newRun(1);
const B = newRun(2);
const C = newRun(3);
const sheet = characterSheetViewModel;

// Precondition guard: A and B must differ in race/class/sub/name, so the
// race-supersede tests below can never pass by seed coincidence.
test("precondition: seed 1 (A) and seed 2 (B) differ in every reel + name", () => {
  const sa = sheet(A);
  const sb = sheet(B);
  assert.notEqual(sa.raceLabel, sb.raceLabel);
  assert.notEqual(sa.classLabel, sb.classLabel);
  assert.notEqual(sa.subLabel, sb.subLabel);
  assert.notEqual(sa.name, sb.name);
});

// ─── (1) SC1 identity ─────────────────────────────────────────────────────

test("SC1 identity: the reels lock on, and the CTA commits, the ONE pending state", async () => {
  const rig = makeRig();
  const p = rig.roller.start();
  await flush();
  assert.equal(rig.calls.length, 1);
  rig.calls[0].resolve(A);
  await flush();
  assert.equal(await p, true);
  assert.equal(rig.roller.pending(), A);

  const ctaEl = rig.el(ROLLER_IDS.cta);
  assert.equal(ctaEl.disabled, true);
  assert.equal(ctaEl.textContent, ROLLER_COPY.falling);

  // CTA is inert before the reveal.
  assert.equal(rig.roller.commit(), false);
  assert.equal(rig.committed.length, 0);

  await rig.timers.advance(900);
  assert.equal(rig.el(ROLLER_IDS.race).textContent, sheet(A).raceLabel);
  assert.equal(rig.el(ROLLER_IDS.race).classList.contains(ROLLER_CSS.locked), true);
  assert.equal(rig.el(ROLLER_IDS.cls).classList.contains(ROLLER_CSS.locked), false);
  assert.equal(rig.el(ROLLER_IDS.sub).classList.contains(ROLLER_CSS.locked), false);

  await rig.timers.advance(750); // t = 1650
  assert.equal(rig.el(ROLLER_IDS.cls).textContent, sheet(A).classLabel);
  assert.equal(rig.el(ROLLER_IDS.cls).classList.contains(ROLLER_CSS.locked), true);

  await rig.timers.advance(750); // t = 2400
  assert.equal(rig.el(ROLLER_IDS.sub).textContent, sheet(A).subLabel);
  assert.equal(rig.el(ROLLER_IDS.sub).classList.contains(ROLLER_CSS.locked), true);

  await rig.timers.advance(650); // t = 3050
  assert.equal(rig.el(ROLLER_IDS.name).textContent, sheet(A).name);
  assert.equal(rig.el(ROLLER_IDS.quirk).textContent, sheet(A).quirk.text);
  assert.equal(rig.el(ROLLER_IDS.reveal).classList.contains(ROLLER_CSS.revealed), true);
  assert.equal(ctaEl.disabled, false);
  assert.equal(ctaEl.textContent, ROLLER_COPY.ready);
  assert.equal(ctaEl.classList.contains(ROLLER_CSS.ready), true);
  assert.equal(rig.timers.pending(), 0);

  assert.equal(rig.roller.commit(), true);
  assert.equal(rig.committed.length, 1);
  assert.equal(rig.committed[0], A);
  const committedSheet = sheet(rig.committed[0]);
  const reels = rig.reelText();
  assert.equal(committedSheet.raceLabel, reels.race);
  assert.equal(committedSheet.classLabel, reels.cls);
  assert.equal(committedSheet.subLabel, reels.sub);
  assert.equal(committedSheet.name, reels.name);
  assert.equal(committedSheet.quirk.text, reels.quirk);
  assert.equal(rig.el(ROLLER_IDS.screen).hidden, true);
  assert.equal(rig.roller.pending(), null);

  assert.equal(rig.roller.commit(), false);
  assert.equal(rig.committed.length, 1);
});

// ─── (2) SC2 superseded resolution ────────────────────────────────────────

test("SC2 superseded resolution: a first roll resolving after a second roll was requested is dropped", async () => {
  const rig = makeRig();
  const p1 = rig.roller.start();
  const p2 = rig.roller.start();
  await flush();
  assert.equal(rig.calls.length, 1); // serialized — the second call has not been made yet

  rig.calls[0].resolve(A);
  await flush();
  assert.equal(await p1, false);
  assert.equal(rig.roller.pending(), null);
  assert.equal(rig.timers.pending(), 0);
  assert.equal(rig.el(ROLLER_IDS.race).classList.contains(ROLLER_CSS.locked), false);
  assert.equal(rig.el(ROLLER_IDS.cls).classList.contains(ROLLER_CSS.locked), false);
  assert.equal(rig.el(ROLLER_IDS.sub).classList.contains(ROLLER_CSS.locked), false);

  assert.equal(rig.calls.length, 2); // released only after the first resolved

  rig.calls[1].resolve(B);
  await flush();
  assert.equal(await p2, true);
  assert.equal(rig.roller.pending(), B);

  await rig.timers.advance(3050);
  assert.equal(rig.el(ROLLER_IDS.race).textContent, sheet(B).raceLabel);
  assert.equal(rig.el(ROLLER_IDS.cls).textContent, sheet(B).classLabel);
  assert.equal(rig.el(ROLLER_IDS.sub).textContent, sheet(B).subLabel);
  assert.equal(rig.el(ROLLER_IDS.name).textContent, sheet(B).name);

  assert.equal(rig.roller.commit(), true);
  assert.deepEqual(rig.committed, [B]);
  assert.equal(rig.committed[0], B);
  assert.notEqual(rig.el(ROLLER_IDS.name).textContent, sheet(A).name);
});

// ─── (3) SC2 mid-reveal supersede ─────────────────────────────────────────

test("SC2 double-tap mid-reveal supersedes: the reels restart and lock on the second roll", async () => {
  const rig = makeRig();
  rig.roller.start();
  await flush();
  rig.calls[0].resolve(A);
  await flush();
  await rig.timers.advance(1000); // race reel locked on A
  assert.equal(rig.el(ROLLER_IDS.race).textContent, sheet(A).raceLabel);

  const p2 = rig.roller.start();
  // Synchronously: the first roll's timers and pending state are gone.
  assert.equal(rig.roller.pending(), null);
  assert.equal(rig.timers.pending(), 0);
  assert.equal(rig.el(ROLLER_IDS.race).classList.contains(ROLLER_CSS.locked), false);
  assert.equal(rig.el(ROLLER_IDS.cta).disabled, true);

  await flush();
  assert.equal(rig.calls.length, 2);
  rig.calls[1].resolve(B);
  await flush();

  await rig.timers.advance(3050);
  assert.equal(rig.el(ROLLER_IDS.race).textContent, sheet(B).raceLabel);
  assert.equal(rig.el(ROLLER_IDS.cls).textContent, sheet(B).classLabel);
  assert.equal(rig.el(ROLLER_IDS.sub).textContent, sheet(B).subLabel);
  assert.equal(rig.el(ROLLER_IDS.name).textContent, sheet(B).name);

  rig.roller.commit();
  assert.equal(rig.committed[0], B);

  await p2;
  // No stale timer from the first roll fires later.
  await rig.timers.advance(5000);
  assert.equal(rig.el(ROLLER_IDS.name).textContent, sheet(B).name);
});

// ─── (4) serialization ─────────────────────────────────────────────────────

test("serialization: three rapid starts call startNewRun one at a time, and the last roll is the one that lands", async () => {
  const rig = makeRig();
  rig.roller.start();
  rig.roller.start();
  const p3 = rig.roller.start();

  await flush();
  assert.equal(rig.calls.length, 1);
  rig.calls[0].resolve(A);
  await flush();
  assert.equal(rig.calls.length, 2);
  rig.calls[1].resolve(B);
  await flush();
  assert.equal(rig.calls.length, 3);
  rig.calls[2].resolve(C);
  await flush();

  await p3;
  assert.equal(rig.roller.pending(), C);
  await rig.timers.advance(3050);
  rig.roller.commit();
  assert.equal(rig.committed[0], C);
});

// ─── (5) dispose ────────────────────────────────────────────────────────

test("dispose(): an in-flight resolution after dispose is dropped", async () => {
  const rig = makeRig();
  rig.roller.start();
  await flush();
  rig.roller.dispose();
  rig.calls[0].resolve(A);
  await flush();
  assert.equal(rig.roller.pending(), null);
  assert.equal(rig.timers.pending(), 0);
});

// ─── (6) reel flicker uses only the injected random ──────────────────────

test("reel flicker uses only the injected random over reelWordLists()", async () => {
  const { document } = createRecordingDocument();
  const calls = [];
  const startNewRun = () => {
    const d = deferred();
    calls.push(d);
    return d.promise;
  };
  const committed = [];
  const timers = makeFakeTimers();
  let spyCalls = 0;
  const words = reelWordLists();
  const random = () => {
    spyCalls++;
    return 0;
  };
  const rollerInstance = createRoller({ doc: document, startNewRun, sheetFor: characterSheetViewModel, onCommit: (s) => committed.push(s), timers, random, words });

  rollerInstance.start();
  await flush();
  calls[0].resolve(A);
  await flush();

  const before = spyCalls;
  await timers.advance(70 * 3);
  assert.ok(spyCalls > before);

  const el = (id) => document.getElementById(id);
  assert.ok(words.race.includes(el(ROLLER_IDS.race).textContent) || el(ROLLER_IDS.race).classList.contains(ROLLER_CSS.locked));
  assert.ok(words.cls.includes(el(ROLLER_IDS.cls).textContent) || el(ROLLER_IDS.cls).classList.contains(ROLLER_CSS.locked));
  assert.ok(words.sub.includes(el(ROLLER_IDS.sub).textContent) || el(ROLLER_IDS.sub).classList.contains(ROLLER_CSS.locked));
});

// ─── (7) module source pins: exports ──────────────────────────────────────

test("roller.js exports createRoller/reelWordLists as functions and the four frozen tables", () => {
  assert.equal(typeof roller.createRoller, "function");
  assert.equal(typeof roller.reelWordLists, "function");
  for (const name of ["ROLLER_IDS", "ROLLER_TIMELINE", "ROLLER_COPY", "ROLLER_CSS"]) {
    assert.ok(Object.isFrozen(roller[name]), `expected roller.js to export a frozen ${name}`);
  }
  assert.deepEqual(ROLLER_TIMELINE, { lock: { race: 900, cls: 1650, sub: 2400 }, reveal: 3050, spin: 70 });
  assert.deepEqual(ROLLER_COPY, { falling: "THE DICE ARE STILL FALLING", ready: "DESCEND" });
});

// ─── (8) module source pins: no globals ───────────────────────────────────

// VOX-04 (Phase 79, Plan 03): the reveal's footer adds the one pure footer
// module as a second import (src/browser/identityFooter.js — no DOM, no rng).
// Phase 96 (FLAVOR-03): declared re-pin — two more pure imports, the flavour
// lookup and the shared RULES component, so four in all.
test("roller.js reads no window/document global, no rng-cursor read, no bridge name, exactly four imports (content, the identity footer, the flavour lookup, the RULES component)", () => {
  assert.doesNotMatch(ROLLER_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(ROLLER_STRIPPED, /\bdocument\./);
  assert.doesNotMatch(ROLLER_STRIPPED, /rngState/);
  assert.doesNotMatch(ROLLER_STRIPPED, /__mz/);
  const importLines = ROLLER_STRIPPED.split("\n").filter((l) => l.startsWith("import "));
  assert.equal(importLines.length, 4);
  assert.match(importLines[0], /from "\.\.\/\.\.\/content\/index\.js"/);
  assert.match(importLines[1], /^import \{ footerLines \} from "\.\/identityFooter\.js";$/);
  assert.match(importLines[2], /^import \{ flavorOfIdentity \} from "\.\/flavorText\.js";$/);
  assert.match(importLines[3], /^import \{ mountRules \} from "\.\/rulesLayer\.js";$/);
});

// ─── (9) module source pins: id containment ───────────────────────────────

test("every ROLLER_IDS value appears as id=\"<value>\" inside the mazeworld.html roller-screen markup", () => {
  const start = HTML_RAW.indexOf('<div id="mw-roller-screen"');
  assert.ok(start !== -1, "mw-roller-screen markup not found");
  const end = HTML_RAW.indexOf("<!-- ============ MARKS LEGEND BOTTOM SHEET", start);
  assert.ok(end !== -1 && end > start, "MARKS LEGEND BOTTOM SHEET marker not found after mw-roller-screen");
  const slice = HTML_RAW.slice(start, end);
  for (const value of Object.values(ROLLER_IDS)) {
    assert.ok(slice.includes(`id="${value}"`), `expected the roller-screen markup to declare id="${value}"`);
  }
});

// ─── (10) module source pins: the one-roll/one-object shape ──────────────

test("the one-roll/one-object shape: one startNewRun() call, sheetFor(rollerPendingState) reads, one rollerPendingState assignment after the token check, one onCommit(state) call", () => {
  const startNewRunCalls = (ROLLER_STRIPPED.match(/startNewRun\(\)/g) || []).length;
  assert.equal(startNewRunCalls, 1);

  const sheetForReads = (ROLLER_STRIPPED.match(/sheetFor\(rollerPendingState\)/g) || []).length;
  assert.ok(sheetForReads >= 4, `expected sheetFor(rollerPendingState) at least 4 times, found ${sheetForReads}`);

  const assignMatches = [...ROLLER_STRIPPED.matchAll(/rollerPendingState = rolledState;/g)];
  assert.equal(assignMatches.length, 1);
  const firstTokenCheckIndex = ROLLER_STRIPPED.indexOf("if (token !== rollSeq) return");
  assert.ok(firstTokenCheckIndex !== -1);
  assert.ok(assignMatches[0].index > firstTokenCheckIndex, "the pending-state assignment must come after the token-validated await's drop check");

  const onCommitCalls = (ROLLER_STRIPPED.match(/onCommit\(state\)/g) || []).length;
  assert.equal(onCommitCalls, 1);
});

// ─── (11) voice safety ──────────────────────────────────────────────────

test("Voice: ROLLER_COPY clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const phrase of Object.values(ROLLER_COPY)) {
    for (const re of bannedRe) {
      assert.doesNotMatch(phrase, re, `"${phrase}" must not match banned term ${re}`);
    }
  }
});

// ─── mount pins (Phase 50, Plan 03) ───────────────────────────────────────
//
// Plan 03 swaps the inline roller block this file's tests above pin against
// for the src/browser/roller.js mount. These pins assert the mount shape
// directly on mazeworld.html's classic/module script regions — copied from
// test/unit/heroTab.test.js's own stripComments/extractScriptRegions/
// sliceBetween helpers (sibling-test precedent, not exported by that file).

function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  const modStart = raw.indexOf('\n<script type="module">\n', classicEnd);
  assert.ok(modStart !== -1, 'column-0 <script type="module"> tag not found');
  const modEnd = raw.indexOf("\n</script>\n", modStart + 1);
  assert.ok(modEnd !== -1, "module </script> tag not found");
  return {
    classic: raw.slice(classicStart + 1, classicEnd),
    mod: raw.slice(modStart + 1, modEnd),
  };
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

const { classic: MOUNT_CLASSIC_RAW, mod: MOUNT_MOD_RAW } = extractScriptRegions(HTML_RAW);
const MOUNT_CLASSIC = stripComments(MOUNT_CLASSIC_RAW);
const MOUNT_MOD = stripComments(MOUNT_MOD_RAW);

test("m1: the module script imports createRoller from roller.js exactly once, and imports RACES/CLASSES from content/index.js zero times", () => {
  assert.equal((MOUNT_MOD.match(/import \{ createRoller \} from "\.\/src\/browser\/roller\.js";/g) || []).length, 1);
  assert.equal((MOUNT_MOD.match(/import \{ RACES, CLASSES \} from "\.\/content\/index\.js";/g) || []).length, 0);
});

test("m2: exactly one createRoller( call; the mount object wires doc/startNewRun/sheetFor and the onCommit callback commits + shows the maze tab", () => {
  assert.equal((MOUNT_MOD.match(/createRoller\(/g) || []).length, 1);
  const region = sliceBetween(MOUNT_MOD, "const roller = createRoller({", "});");
  assert.match(region, /doc: document,/);
  assert.match(region, /startNewRun,/);
  assert.match(region, /sheetFor: characterSheetViewModel,/);
  assert.match(region, /commitRolledState\(state\);/);
  assert.match(region, /window\.__mzShowTab\?\.\("maze"\);/);
});

test("m3: window.mzStartRoll = roller.start exactly once; the inline startRoll function is gone", () => {
  assert.equal((MOUNT_MOD.match(/window\.mzStartRoll = roller\.start;/g) || []).length, 1);
  assert.equal((MOUNT_MOD.match(/function startRoll\(/g) || []).length, 0);
});

test("m4: exactly one startNewRun( call expression in the module script, and it sits inside window.mzDevStartAtDepth — not on the roller path", () => {
  const callMatches = [...MOUNT_MOD.matchAll(/\bstartNewRun\(/g)];
  assert.equal(callMatches.length, 1);
  const devStart = MOUNT_MOD.indexOf("window.mzDevStartAtDepth = async function devStartAtDepth(depth) {");
  assert.ok(devStart !== -1, "window.mzDevStartAtDepth not found");
  const devEnd = MOUNT_MOD.indexOf("\n  };", devStart);
  assert.ok(devEnd !== -1 && devEnd > devStart, "window.mzDevStartAtDepth's closing `};` not found");
  assert.ok(
    callMatches[0].index > devStart && callMatches[0].index < devEnd,
    "the one startNewRun( call expression must sit inside window.mzDevStartAtDepth",
  );
});

test("m5: window.mzStartRoll() is called exactly three times across the classic and module scripts (title ENTER, the dead Hero tab's New Character, and Phase 66's routeFromBoards ROLL A NEW HERO dock button)", () => {
  const classicCalls = (MOUNT_CLASSIC.match(/window\.mzStartRoll\(\)/g) || []).length;
  const modCalls = (MOUNT_MOD.match(/window\.mzStartRoll\(\)/g) || []).length;
  assert.equal(classicCalls + modCalls, 3);
});

test("m6: every inline-roller identifier is gone from both the classic and module scripts", () => {
  const retired = [
    "ROLLER_LOCK_DELAYS",
    "ROLLER_REVEAL_DELAY",
    "ROLLER_SPIN_MS",
    "ROLLER_RACE_NAMES",
    "rollerPendingState",
    "clearRollerTimers",
    "initRollerScreen",
    "pickDisplay(",
    "setReel(",
  ];
  for (const ident of retired) {
    const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    assert.equal((MOUNT_CLASSIC.match(re) || []).length, 0, `expected zero ${ident} in the classic script`);
    assert.equal((MOUNT_MOD.match(re) || []).length, 0, `expected zero ${ident} in the module script`);
  }
});

test("m7: function commitRolledState(state) { occurs exactly once in the module script", () => {
  assert.equal((MOUNT_MOD.match(/function commitRolledState\(state\) \{/g) || []).length, 1);
});

// ─── VOX-04 (Phase 79, Plan 03): the reveal's identity footer ─────────────
//
// The user met the Summoner's weakness only after DESCEND; the reveal now
// shows the rolled sub-class's footer (and a non-Human race's) before it.

const SUMMONER_HUMAN = newRun(1, [], { force: { sub: "Summoner", race: "Human" } });
const WARLOCK_ELVEN = newRun(2, [], { force: { sub: "Warlock", race: "Elven" } });

// Phase 96 (FLAVOR-03): declared re-pin — a group now reads [who, flavour
// line, RULES button, rules body]; the body's paragraphs are the old footer.
beforeEach(() => {
  clearRulesOpen();
  setAlwaysRules(false);
});

/** groupParts(group) — the four parts of one reveal group. */
function groupParts(group) {
  const [who, flavor, button, body] = group.children;
  return { who, flavor, button, body, lines: body ? body.children.map((p) => p.textContent) : [] };
}

/** rulesText(el) — [{ who, flavor, lines }, ...], one entry per group. */
function rulesText(el) {
  return el.children.map((group) => {
    const g = groupParts(group);
    return { who: g.who.textContent, flavor: g.flavor.textContent, lines: g.lines };
  });
}

async function rollTo(rig, state, callIdx) {
  const p = rig.roller.start();
  await flush();
  rig.calls[callIdx].resolve(state);
  await flush();
  await p;
}

test("VOX-04: ROLLER_IDS lists the footer element and the roller-screen markup declares it after the quirk", () => {
  assert.equal(ROLLER_IDS.rules, "mw-roller-rules");
  const start = HTML_RAW.indexOf('<div id="mw-roller-screen"');
  const slice = HTML_RAW.slice(start, HTML_RAW.indexOf("<!-- ============ MARKS LEGEND BOTTOM SHEET", start));
  assert.ok(slice.indexOf('id="mw-roller-quirk"') < slice.indexOf('id="mw-roller-rules"'), "the footer sits after the quirk");
});

test("VOX-04: nothing shows before the reveal; the reveal shows the sub-class footer, and a Human race adds none", async () => {
  const rig = makeRig();
  await rollTo(rig, SUMMONER_HUMAN, 0);
  const rules = rig.el(ROLLER_IDS.rules);
  assert.equal(rules.children.length, 0, "empty while the dice are falling");
  await rig.timers.advance(ROLLER_TIMELINE.reveal - 1);
  assert.equal(rules.children.length, 0, "still empty one tick before the reveal");
  await rig.timers.advance(1);
  // Phase 96 (FLAVOR-03): declared re-pin — flavour first, the footer behind RULES.
  assert.deepEqual(rulesText(rules), [
    { who: "Summoner", flavor: flavorOfIdentity("sub", "Summoner"), lines: footerLines("sub", "Summoner") },
  ]);
  assert.ok(rulesText(rules)[0].lines.some((l) => /healing spells you cast heal at half strength/.test(l)), "the half-strength healing line is in the RULES body");
  const g = groupParts(rules.children[0]);
  assert.equal(g.button.className, "mw-rules-btn");
  assert.equal(g.button.getAttribute("aria-expanded"), "false");
  assert.equal(g.body.hidden, true, "the footer is collapsed until RULES is tapped");
});

test("VOX-04: a non-Human race adds its own footer; a re-roll clears and refills with the new roll's lines", async () => {
  const rig = makeRig();
  await rollTo(rig, WARLOCK_ELVEN, 0);
  await rig.timers.advance(ROLLER_TIMELINE.reveal);
  const rules = rig.el(ROLLER_IDS.rules);
  assert.deepEqual(rulesText(rules), [
    { who: "Warlock", flavor: flavorOfIdentity("sub", "Warlock"), lines: footerLines("sub", "Warlock") },
    { who: "Elven", flavor: flavorOfIdentity("race", "Elven"), lines: footerLines("race", "Elven") },
  ]);

  const p = rig.roller.start();
  await flush();
  assert.equal(rules.children.length, 0, "a re-roll clears the old footer at once");
  rig.calls[1].resolve(SUMMONER_HUMAN);
  await flush();
  await p;
  await rig.timers.advance(ROLLER_TIMELINE.reveal);
  assert.deepEqual(rulesText(rules), [
    { who: "Summoner", flavor: flavorOfIdentity("sub", "Summoner"), lines: footerLines("sub", "Summoner") },
  ]);
});

test("VOX-04: the footer reads footerLines and reaches the DOM through textContent, never innerHTML", () => {
  assert.ok((ROLLER_STRIPPED.match(/footerLines\(/g) || []).length >= 1);
  assert.doesNotMatch(ROLLER_STRIPPED, /innerHTML/);
});

// ─── Phase 96 (FLAVOR-03): the RULES toggle on the reveal ─────────────────

test("Phase 96: a RULES tap opens that group's body and never rolls, commits or touches the CTA", async () => {
  const rig = makeRig();
  await rollTo(rig, WARLOCK_ELVEN, 0);
  await rig.timers.advance(ROLLER_TIMELINE.reveal);
  const rules = rig.el(ROLLER_IDS.rules);
  const cta = rig.el(ROLLER_IDS.cta);
  const ctaBefore = { disabled: cta.disabled, text: cta.textContent };
  const callsBefore = rig.calls.length;
  const g = groupParts(rules.children[0]);
  let stopped = false;
  g.button.onclick({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(g.body.hidden, false, "the tapped group's footer opens");
  assert.equal(g.button.getAttribute("aria-expanded"), "true");
  assert.equal(groupParts(rules.children[1]).body.hidden, true, "the other group stays closed");
  assert.equal(rig.calls.length, callsBefore, "a RULES tap never starts a roll");
  assert.equal(rig.committed.length, 0, "a RULES tap never commits the roll");
  assert.equal(cta.disabled, ctaBefore.disabled);
  assert.equal(cta.textContent, ctaBefore.text);
  g.button.onclick({});
  assert.equal(g.body.hidden, true, "a second tap closes it again");
});

test("Phase 96: with Always show the rules on, the footer shows open with no toggle", async () => {
  setAlwaysRules(true);
  const rig = makeRig();
  await rollTo(rig, WARLOCK_ELVEN, 0);
  await rig.timers.advance(ROLLER_TIMELINE.reveal);
  const rules = rig.el(ROLLER_IDS.rules);
  assert.equal(rules.children.length, 2);
  for (const [i, [kind, key]] of [["sub", "Warlock"], ["race", "Elven"]].entries()) {
    const group = rules.children[i];
    assert.equal(group.children.length, 3, "who, flavour line, body: no button");
    const body = group.children[2];
    assert.equal(body.hidden, false);
    assert.deepEqual(body.children.map((p) => p.textContent), footerLines(kind, key));
  }
});

test("Phase 96: an unknown sub-class or race (a tampered save) leaves no toggle and does not throw", async () => {
  const rig = makeRig();
  const stub = { ...sheet(SUMMONER_HUMAN), subLabel: "Mystery Sub", raceLabel: "Mystery Race" };
  const { document } = createRecordingDocument();
  const r = createRoller({
    doc: document,
    startNewRun: () => Promise.resolve(SUMMONER_HUMAN),
    sheetFor: () => stub,
    onCommit: () => {},
    timers: rig.timers,
    random: () => 0,
  });
  await r.start();
  await rig.timers.advance(ROLLER_TIMELINE.reveal);
  const rules = document.getElementById(ROLLER_IDS.rules);
  assert.ok(rules.children.every((g) => g.children.every((c) => c.className !== "mw-rules-btn")));
});
