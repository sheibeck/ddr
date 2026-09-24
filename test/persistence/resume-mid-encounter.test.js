// test/persistence/resume-mid-encounter.test.js
//
// Phase 70 (POLISH-03, D-08), plan 70-04: what a mid-encounter Save & quit
// resumes, pinned as TODAY's behaviour (user ruling 2026-09-24, option 3 —
// DEFER the relaunch gap).
//
// - In session: exact. SAVE & QUIT (window.mzAbandonRun) only shows the
//   title over the untouched shell, and ENTER's resume branch only hides it
//   again. Neither dispatches nor writes state, so the combat overlay, store,
//   loot pile or stair prompt underneath is exactly as it was left. Pinned by
//   the shell source checks at the bottom of this file.
// - Across a relaunch: every dispatch persists (engineAdapter#persist) and
//   Save & quit writes nothing, so boot() rehydrates the last dispatch's
//   save. The stair prompt and a live beat are presentation-only (never on
//   GameState), so a relaunch rebuilds from the last dispatched GameState.
//   - A pending loot pile survives (Phase 29 LOOT-06 keeps pendingLoot).
//   - A dead save relaunches to the roller (hadSaveAtLaunch is false).
//   - KNOWN LIMITATION: a live combat or an open store does NOT survive. The
//     save file carries them, but engine/saveState.js#rehydrate resets
//     combat and store to null on load (transient by design since Phase 1,
//     as the prototype's own load did). The player comes back on the same
//     tile with the fight or shop gone. Backlog item 999.10, "Keep live
//     combat and open store through a relaunch". When 999.10 lands, flip
//     cases (a) and (b) below to assert the sub-state survives.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { boot, initRun, getState, dispatch } from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { serializeRun } from "../../engine/saveState.js";
import { startCombat } from "../../engine/combat.js";
import { openStore } from "../../engine/economy.js";
import { offerLoot } from "../../engine/items.js";
import { makeRng } from "../../engine/rng.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SAVE_KEY = "ddr.delve.v1";
const CODE = stripHtml(fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n"));

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

/** Flush, snapshot the saved JSON, relaunch through boot(), return both. */
async function relaunch(store) {
  await flushStorage();
  const raw = store.get(SAVE_KEY);
  assert.ok(raw, "the last dispatch persisted a save");
  const snapshot = JSON.parse(raw);
  const booted = await boot(1);
  return { snapshot, booted };
}

function plain(state) {
  return stripVolatileFields(JSON.parse(JSON.stringify(serializeRun(state))));
}

// ─── (c) the loot pile survives a relaunch (LOOT-06) ─────────────────────

test("(c) relaunch: a pending loot pile rehydrates intact, with the same floor, position and hero, and the whole state JSON-equals the save", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4244);
    const s = getState();
    offerLoot(s, { kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 });
    dispatch({ type: "attack" }); // a no-op with no fight up; it persists
    assert.ok(getState().pendingLoot?.length, "the no-op leaves the pile pending");
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.pendingLoot?.length, "the save carries the pile");
    assert.deepStrictEqual(booted.pendingLoot, snapshot.pendingLoot, "the pile is intact");
    assert.deepStrictEqual(booted.floor, snapshot.floor, "the same floor and position");
    assert.equal(booted.c.name, snapshot.c.name, "the same hero");
    assert.deepStrictEqual(plain(booted), stripVolatileFields(snapshot), "the whole rehydrated state JSON-equals the save");
  });
});

// ─── (a)(b) KNOWN LIMITATION: combat and store are cleared on relaunch ───

test("(a) KNOWN LIMITATION (backlog 999.10): relaunch mid-combat — the save carries state.combat, but saveState.js#rehydrate resets it to null; floor, position and hero survive", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4242);
    const s = getState();
    startCombat(s, false, null, makeRng(s.rngState));
    assert.ok(getState().combat, "a combat is up");
    dispatch({ type: "move", dir: "N" }); // refused mid-fight; it persists
    assert.ok(getState().combat, "the refused move leaves the combat up");
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.combat, "the save file carries the live combat");
    assert.equal(booted.combat, null, "999.10: rehydrate clears the combat today");
    assert.deepStrictEqual(booted.floor, snapshot.floor, "the same floor and position");
    assert.equal(booted.c.name, snapshot.c.name, "the same hero");
    assert.equal(booted.dead, false);
  });
});

test("(b) KNOWN LIMITATION (backlog 999.10): relaunch mid-store — the save carries state.store, but saveState.js#rehydrate resets it to null; floor, position and hero survive", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4243);
    const s = getState();
    openStore(s, makeRng(s.rngState));
    assert.ok(getState().store, "a store is open");
    dispatch({ type: "move", dir: "N" }); // refused while shopping; it persists
    assert.ok(getState().store, "the refused move leaves the store open");
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.store, "the save file carries the open store");
    assert.equal(booted.store, null, "999.10: rehydrate clears the store today");
    assert.deepStrictEqual(booted.floor, snapshot.floor, "the same floor and position");
    assert.equal(booted.c.name, snapshot.c.name, "the same hero");
  });
});

// ─── the dead save relaunches to the roller ──────────────────────────────

test("dead save: abandon writes dead === true, and the shell's launch contract (hadSaveAtLaunch) relaunches a dead save to the roller", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4245);
    dispatch({ type: "abandon" });
    await flushStorage();
    assert.equal(JSON.parse(store.get(SAVE_KEY)).dead, true);
  });
  assert.match(CODE, /hadSaveAtLaunch = !!\(parsed && !parsed\.dead\);/);
});

// ─── in session: Save & quit and ENTER's resume branch dispatch nothing ──

test("in session: window.mzAbandonRun's body only shows the title (no dispatch, no state write), and ENTER's resume branch is hideTitleScreen() then surfaceWornReconcile() and a return, so the untouched shell resumes exactly", () => {
  const start = CODE.indexOf("window.mzAbandonRun = function saveAndQuit() {");
  assert.ok(start !== -1, "mzAbandonRun found");
  const body = CODE.slice(start, CODE.indexOf("\n  };", start));
  assert.match(body, /showTitleScreen\(\{ allowResume: hasActiveDelveSave\(\) \}\);/);
  assert.doesNotMatch(body, /dispatch|__mzState\.set|mzStartRoll|setItem/, "Save & quit dispatches and writes nothing");

  const enterStart = CODE.indexOf("enterBtn.onclick = () => {");
  assert.ok(enterStart !== -1, "ENTER's onclick found");
  const enter = CODE.slice(enterStart, CODE.indexOf("\n    };", enterStart));
  assert.match(enter, /hideTitleScreen\(\);\s*if \(resumeIntent\) \{ surfaceWornReconcile\(\); return; \}/);
  const resumeBranch = enter.slice(enter.indexOf("if (resumeIntent)"), enter.indexOf("return; }"));
  assert.doesNotMatch(resumeBranch, /dispatch|__mzState\.set/, "the resume branch dispatches nothing");
});
