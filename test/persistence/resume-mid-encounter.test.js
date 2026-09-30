// test/persistence/resume-mid-encounter.test.js
//
// Phase 70 (POLISH-03, D-08), plan 70-04, REWRITTEN by Phase 76 plan 76-03
// (SAV-06/SAV-07, backlog 999.10 closed): what a mid-encounter Save & quit
// resumes.
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
//   - SAV-06 (Phase 76): a live combat survives. engine/saveState.js's
//     validateSave/rehydrate validate the stored fight and resume it
//     wholesale (same foes, HP, round and effects), so force-closing can no
//     longer escape a fight: a move after the relaunch is still refused.
//   - SAV-07 (Phase 76): an open store survives with the same stock, prices
//     and sold flags. A stored fight or store that fails validation is
//     dropped and the rest of the save loads as before (tolerant load;
//     pinned in test/unit/save-resume.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { boot, initRun, getState, dispatch } from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { serializeRun } from "../../engine/saveState.js";
import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { openStore, storeBuyRefusal } from "../../engine/economy.js";
import { meetJoiner } from "../../engine/encounters.js";
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

// ─── (a)(b) SAV-06/SAV-07 (Phase 76): combat and store survive a relaunch ─

test("(a) SAV-06 (Phase 76): relaunch mid-combat — the booted combat deep-equals the saved one, and a move after the relaunch is still refused", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4242);
    const s = getState();
    startCombat(s, false, null, makeRng(s.rngState));
    assert.ok(getState().combat, "a combat is up");
    dispatch({ type: "move", dir: "N" }); // refused mid-fight; it persists
    assert.ok(getState().combat, "the refused move leaves the combat up");
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.combat, "the save file carries the live combat");
    assert.deepStrictEqual(booted.combat, snapshot.combat, "SAV-06: the same fight, foes, HP and round");
    assert.deepStrictEqual(booted.floor, snapshot.floor, "the same floor and position");
    assert.equal(booted.c.name, snapshot.c.name, "the same hero");
    assert.equal(booted.dead, false);
    const { px, py } = booted.floor;
    dispatch({ type: "move", dir: "N" }); // force-closing no longer escapes the fight
    assert.ok(getState().combat, "the fight is still up after the relaunch");
    assert.equal(getState().floor.px, px, "the move is refused: x unchanged");
    assert.equal(getState().floor.py, py, "the move is refused: y unchanged");
  });
});

test("(b) SAV-07 (Phase 76): relaunch mid-store — the booted store deep-equals the saved one (same stock, prices and sold flags)", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4243);
    const s = getState();
    openStore(s, makeRng(s.rngState));
    assert.ok(getState().store, "a store is open");
    dispatch({ type: "move", dir: "N" }); // refused while shopping; it persists
    assert.ok(getState().store, "the refused move leaves the store open");
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.store, "the save file carries the open store");
    assert.deepStrictEqual(booted.store, snapshot.store, "SAV-07: the same stock, prices and sold flags");
    assert.deepStrictEqual(booted.floor, snapshot.floor, "the same floor and position");
    assert.equal(booted.c.name, snapshot.c.name, "the same hero");
  });
});

// ─── SAV-06/SAV-07 (Phase 76, plan 76-04): every round is saved, every ───
// ─── relaunch resumes it exactly, and the fight cannot be escaped ────────

// Seed 4254 (found by trying seeds 4240-4299): a depth-1 Fighter whose
// startCombat fight lasts seven attacks and whose last attack kills the last
// foe and drops a spoils pile, so one run covers the encounter step, several
// joined rounds and the killing blow.
const FIGHT_SEED = 4254;

/** JSON-plain copy, for comparing live values with saved ones. */
const jsonCopy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** The unbroken reference fight: the same seed and steps with no relaunch. */
function referenceFight(seed, maxAttacks) {
  let s = newRun(seed);
  startCombat(s, false, null, makeRng(s.rngState));
  const steps = [jsonCopy(s.combat)];
  s = applyAction(s, { type: "fight" }).state;
  steps.push(jsonCopy(s.combat));
  for (let n = 0; n < maxAttacks && s.combat; n++) {
    s = applyAction(s, { type: "attack" }).state;
    steps.push(jsonCopy(s.combat));
  }
  return { steps, final: s };
}

test("SAV-06 (Phase 76): every combat dispatch persists the live fight, a relaunch after every round resumes the identical fight (effects, timers, no beats), a move after it is refused, and the relaunched fight plays out exactly like the unbroken one", async () => {
  await withFakeLocalStorage(async (store) => {
    const ref = referenceFight(FIGHT_SEED, 20);
    assert.ok(ref.steps.length >= 5, "the reference fight lasts several rounds");
    assert.equal(ref.steps.at(-1), null, "the reference fight ends");

    initRun(FIGHT_SEED);
    const s = getState();
    startCombat(s, false, null, makeRng(s.rngState));
    const actions = [{ type: "fight" }, ...Array.from({ length: ref.steps.length - 2 }, () => ({ type: "attack" }))];

    // The encounter step itself: a refused move persists it, and a relaunch
    // resumes the encounter with pending true, round 1.
    dispatch({ type: "move", dir: "N" });
    {
      const { snapshot, booted } = await relaunch(store);
      assert.deepStrictEqual(snapshot.combat, ref.steps[0], "the save carries the encounter step");
      assert.equal(booted.combat.pending, true, "SAV-06 boundary: the encounter resumes pending");
      assert.equal(booted.combat.round, 1, "SAV-06 boundary: the encounter resumes at round 1");
    }

    let joinedPastRound2 = false;
    for (let i = 0; i < actions.length; i++) {
      const live = dispatch(actions[i]).state;
      assert.deepStrictEqual(jsonCopy(live.combat), ref.steps[i + 1], `step ${i + 1}: the relaunched fight follows the unbroken fight exactly`);
      await flushStorage();
      const saved = JSON.parse(store.get(SAVE_KEY));
      assert.deepStrictEqual(saved.combat ?? null, jsonCopy(live.combat) ?? null, `step ${i + 1}: the flushed save's combat JSON-equals the live combat`);

      const liveCombat = jsonCopy(live.combat) ?? null;
      const liveFoeEffect = jsonCopy(live.c.foeEffect) ?? null;
      const liveTimers = jsonCopy(live.c.timers) ?? null;
      const liveLoot = jsonCopy(live.pendingLoot) ?? null;
      const { booted } = await relaunch(store);
      assert.deepStrictEqual(jsonCopy(booted.combat) ?? null, liveCombat, `step ${i + 1}: the relaunch resumes the identical fight`);
      assert.equal(booted.beats ?? null, null, `step ${i + 1}: no animation state is restored`);

      if (liveCombat) {
        if (!liveCombat.pending && liveCombat.round > 2) joinedPastRound2 = true;
        assert.deepStrictEqual(jsonCopy(booted.c.foeEffect) ?? null, liveFoeEffect, `step ${i + 1}: the hero-side foe effect survives`);
        assert.deepStrictEqual(jsonCopy(booted.c.timers) ?? null, liveTimers, `step ${i + 1}: every c.timers record survives`);
        const { px, py } = booted.floor;
        dispatch({ type: "move", dir: "N" }); // force-closing cannot escape the fight
        assert.ok(getState().combat, `step ${i + 1}: the fight is still up after the relaunch`);
        assert.equal(getState().floor.px, px, `step ${i + 1}: the move is refused (x)`);
        assert.equal(getState().floor.py, py, `step ${i + 1}: the move is refused (y)`);
      } else {
        // SAV-06 boundary: the killing blow saves combat null, so the
        // relaunch shows the spoils and no fight.
        assert.equal(booted.combat, null, "the killing blow saved no fight");
        assert.deepStrictEqual(jsonCopy(booted.pendingLoot) ?? null, liveLoot, "the spoils pile survives the relaunch");
        assert.ok(liveLoot && liveLoot.length > 0, "this seed's killing blow drops a spoils pile");
      }
    }
    assert.ok(joinedPastRound2, "the fight was relaunched past round 2");
    assert.equal(getState().combat, null, "the fight ended");
    assert.deepStrictEqual(plain(getState()).c, plain(ref.final).c, "the hero ends the relaunched fight exactly as in the unbroken one");
  });
});

// Seed 4246: a depth-1 run with 50 gold whose store sells several lines it
// can afford (found by trying seeds 4246-4251).
test("SAV-07 (Phase 76): a store purchase then a relaunch keeps the line sold, the gold spent and every other line and price unchanged; a second relaunch gives the identical store", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4246);
    const s = getState();
    openStore(s, makeRng(s.rngState));
    const idx = s.store.stock.findIndex((line) => !line.sold && !storeBuyRefusal(s.c, line));
    assert.ok(idx >= 0, "an affordable line exists");
    const before = jsonCopy(s.store);
    const { events } = dispatch({ type: "buyItem", idx });
    assert.ok(events.some((e) => e.type === "bought"), "the purchase went through");
    const liveGold = getState().c.gold;
    const liveStore = jsonCopy(getState().store);

    const { booted } = await relaunch(store);
    assert.ok(booted.store, "the store is still open after the relaunch");
    assert.equal(booted.store.stock[idx].sold, true, "the bought line stays sold");
    assert.equal(booted.c.gold, liveGold, "the gold stays spent");
    assert.ok(liveGold < 50, "gold was actually spent");
    booted.store.stock.forEach((line, i) => {
      if (i === idx) return;
      assert.deepStrictEqual(jsonCopy(line), before.stock[i], `line ${i} is unchanged (name, price, sold flag)`);
    });
    assert.deepStrictEqual(jsonCopy(booted.store), liveStore, "the whole store deep-equals the live one");

    dispatch({ type: "move", dir: "N" }); // refused while shopping; it persists
    const again = await relaunch(store);
    assert.deepStrictEqual(jsonCopy(again.booted.store), liveStore, "a second relaunch gives the identical store");
  });
});

// Seed 4247: an Elven hero meets a Fighter Joiner, so no Wilmsry refusal
// (found by trying seeds 4246-4251).
test("SAV-06 (Phase 76, user ruling 2026-09-25): a pending Joiner offer survives a relaunch, and accepting or declining it afterwards behaves exactly as before", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4247);
    const s = getState();
    meetJoiner(s, makeRng(s.rngState));
    assert.ok(s.pendingJoiner, "the offer is up");
    dispatch({ type: "attack" }); // a no-op with no fight up; it persists
    const liveBefore = structuredClone(getState());
    const { snapshot, booted } = await relaunch(store);
    assert.ok(snapshot.pendingJoiner, "the save carries the offer");
    assert.deepStrictEqual(booted.pendingJoiner, snapshot.pendingJoiner, "the booted offer deep-equals the saved one");
    assert.deepStrictEqual(jsonCopy(booted.pendingJoiner), jsonCopy(liveBefore.pendingJoiner), "the booted offer deep-equals the live one");

    for (const accept of [true, false]) {
      const fromLive = applyAction(structuredClone(liveBefore), { type: "resolveJoiner", accept });
      const fromBoot = applyAction(structuredClone(booted), { type: "resolveJoiner", accept });
      assert.deepStrictEqual(plain(fromBoot.state), plain(fromLive.state), `resolveJoiner accept=${accept}: the same next state`);
      assert.deepStrictEqual(fromBoot.events, fromLive.events, `resolveJoiner accept=${accept}: the same events`);
    }

    const partyBefore = (booted.party || []).length;
    const saved = jsonCopy(booted.pendingJoiner);
    const { events } = dispatch({ type: "resolveJoiner", accept: true });
    assert.ok(events.some((e) => e.type === "joinerJoined"), "the Joiner joins");
    assert.equal(getState().party.length, partyBefore + 1, "the party gains exactly one member");
    // Phase 89 plan 05 (ITEM-07): a Joiner joins dressed (resolveJoiner runs
    // reconcileWorn), so the sheet gains its worn map, empty for this Fighter
    // (no cloak or jewel to put on). Before: exactly the offered sheet.
    assert.deepStrictEqual(jsonCopy(getState().party.at(-1)), { ...saved, worn: {} }, "the party gains exactly that Joiner, plus its empty worn map");
    assert.equal(getState().pendingJoiner, null, "the offer is resolved");
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
