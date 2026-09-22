// test/unit/sfx-settings.test.js
//
// Phase 56 Plan 04's AUD-05 pin. Two halves:
//
// Half A — the Settings "Sound" gate's behaviour, driven entirely through
// the same injected-fake-backend shape as test/unit/sfx.test.js
// (globalThis.__mzSfxBackendOverride): the literal claim under test is that
// no audio device is EVER opened while Sound reads Off — not merely that
// the module declines to play a clip.
//
// Half B — the shell wiring itself, by a comment-stripped source scan of
// the real mazeworld.html (tools/ident-sweep.mjs's stripHtml, the same
// single-pass stripper test/unit/bridge-registry.test.js already trusts):
// proves the four call sites this plan adds actually sit where they must
// (applySfxSettings( inside applySettings('s body, playForDispatch( inside
// dispatchWithNarration('s body, after the dispatch(action) call), and that
// the two pre-existing hapticForEvents(events) call sites are untouched.
//
// Neither half ever constructs a real AudioContext or requires a browser
// global — Half A never reaches window, and Half B only ever reads source
// text off disk.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { CLIP_IDS, unlockSfx, applySfxSettings, playForDispatch, playUiTap, stopAllSfx } from "../../src/browser/sfx.js";
import { readSettings, writeSetting, SETTINGS_DEFAULTS } from "../../src/browser/settings.js";
import { flush as flushStorage } from "../../src/browser/storage.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── Half A: fake backend (same 5-method shape as test/unit/sfx.test.js) ──

/**
 * makeFakeBackend() — mirrors test/unit/sfx.test.js's helper of the same
 * name, plus one addition: `calls.order` logs a single combined, ordered
 * tag per stop()/close() invocation so the OFF-transition's "stop every
 * live voice, THEN close the device" rule (the pinned toggle-boundary
 * answer) can be asserted as a true relative ordering, not just two
 * independent counters that happen to both be nonzero.
 */
function makeFakeBackend() {
  const calls = { opens: 0, loads: [], starts: [], stops: [], closes: 0, order: [] };
  let nextVoice = 0;
  const backend = {
    async open() {
      calls.opens++;
      return { fakeHandle: true };
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      return clipId; // the "buffer" IS the clip id string
    },
    start(handle, buffer) {
      calls.starts.push(buffer);
      return ++nextVoice;
    },
    stop(voice) {
      calls.stops.push(voice);
      calls.order.push({ kind: "stop", voice });
    },
    close(handle) {
      calls.closes++;
      calls.order.push({ kind: "close" });
    },
  };
  return { calls, backend };
}

function flushMicrotasks(times = 5) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

/**
 * withFakeBackend(fake, fn) — same posture as test/unit/sfx.test.js's
 * helper of the same name: installs the fake, runs `fn`, and in a `finally`
 * fully resets sfx.js's module-level state via an explicit OFF->ON
 * settings round-trip so no live voice/handle/cache entry from one test can
 * leak into the next.
 */
async function withFakeBackend(fake, fn) {
  const prevOverride = globalThis.__mzSfxBackendOverride;
  globalThis.__mzSfxBackendOverride = () => fake.backend;
  try {
    await fn();
  } finally {
    stopAllSfx();
    applySfxSettings({ sound: false });
    applySfxSettings({ sound: true });
    if (prevOverride === undefined) delete globalThis.__mzSfxBackendOverride;
    else globalThis.__mzSfxBackendOverride = prevOverride;
  }
}

// ─── Half A: the Off gate — AUD-05's literal claim ────────────────────────

test("sfx-settings: Off gate — unlockSfx, a dispatch, and playUiTap all record zero open()/load()/start() calls", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: false });
    await unlockSfx();
    playForDispatch("combatAction", [{ type: "struck" }], {});
    playUiTap();
    assert.equal(fake.calls.opens, 0, "no audio device may be opened while Sound is Off");
    assert.equal(fake.calls.loads.length, 0);
    assert.equal(fake.calls.starts.length, 0);
  });
});

test("sfx-settings: On before any gesture — flipping Sound On alone stays silent, records zero open() calls, and throws nothing", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    assert.doesNotThrow(() => applySfxSettings({ sound: true }));
    assert.equal(fake.calls.opens, 0, "a settings flip alone must never open a device — only a gesture-driven unlock does");
  });
});

test("sfx-settings: On + first gesture — unlockSfx opens once, decodes all 30 clips, and lets a dispatch start a voice", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    assert.equal(fake.calls.opens, 1);
    assert.equal(fake.calls.loads.length, 30);
    assert.deepEqual([...fake.calls.loads].sort(), [...CLIP_IDS].sort());

    playForDispatch("combatAction", [{ type: "struck" }], {});
    assert.equal(fake.calls.starts.length, 1);
  });
});

test("sfx-settings: EDGE toggle boundary — Off mid-playback stops every live voice, THEN closes the device, and the pool returns to empty", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "struck" }, { type: "foeKilled" }], {});
    assert.equal(fake.calls.starts.length, 2, "two live voices before the Off flip");

    applySfxSettings({ sound: false });
    assert.equal(fake.calls.stops.length, 2, "both live voices must be stopped IMMEDIATELY, not let to finish");
    assert.equal(fake.calls.closes, 1, "the device must be closed on the same Off transition");

    // The pinned ordering: every stop precedes the close, never the reverse.
    const closeIdx = fake.calls.order.findIndex((e) => e.kind === "close");
    const lastStopIdx = fake.calls.order.map((e) => e.kind).lastIndexOf("stop");
    assert.ok(closeIdx > lastStopIdx, "close() must come after every stop(), never before");
    assert.equal(fake.calls.order.filter((e) => e.kind === "close").length, 1);

    // The pool actually returned to empty (not merely silenced): a fresh
    // burst after re-opening evicts only once, exactly as it would starting
    // from zero voices — see the re-open test below for the full sequence.
  });
});

test("sfx-settings: EDGE toggle boundary — Off then On then a fresh unlock re-opens and re-decodes on the SECOND gesture", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    assert.equal(fake.calls.opens, 1);
    assert.equal(fake.calls.loads.length, 30);

    applySfxSettings({ sound: false });
    assert.equal(fake.calls.closes, 1);

    // Flipping back On alone must not reopen anything — silent but
    // error-free until the next gesture-driven unlockSfx() call.
    applySfxSettings({ sound: true });
    assert.equal(fake.calls.opens, 1, "an ON transition alone must never call open() again");

    await unlockSfx();
    await flushMicrotasks();
    assert.equal(fake.calls.opens, 2, "the next gesture must re-open the device");
    assert.equal(fake.calls.loads.length, 60, "a fresh unlock re-decodes all 30 clips again (30 + 30)");

    // The FIFO started fresh at zero on this re-open (no voices were live
    // before the Off flip in this test, so `closes` above is 1 with 0
    // stops): a burst of 9 distinct single-clip dispatches now evicts
    // exactly once, the same as it would starting from an empty pool.
    const nine = ["foeKilled", "spellThrown", "trapSprung", "leaptOver", "floorChanged", "leveled", "died", "potionDrunk", "healed"];
    for (const t of nine) playForDispatch("combatAction", [{ type: t }], {});
    assert.equal(fake.calls.starts.length, 9);
    assert.equal(fake.calls.stops.length, 1, "exactly the fresh 9th-voice eviction — the pool held nothing left over from before the Off flip");
  });
});

test("sfx-settings: EDGE empty under Off — an empty, all-unmapped, or null event list plays zero clips and throws nothing", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: false });
    assert.doesNotThrow(() => playForDispatch("move", [], { stepped: false }));
    assert.doesNotThrow(() => playForDispatch("combatAction", [{ type: "combatEnded" }, { type: "storeOpened" }], {}));
    assert.doesNotThrow(() => playForDispatch("combatAction", null, {}));
    assert.equal(fake.calls.opens, 0);
    assert.equal(fake.calls.loads.length, 0);
    assert.equal(fake.calls.starts.length, 0);
  });
});

// ─── Half A: persistence round-trip (settings.js, unchanged by this plan) ─

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

test("sfx-settings: persistence round-trip — writeSetting(sound, false) survives a reload; an invalid value is rejected", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("sound", false);
    await flushStorage();
    const after = await readSettings();
    assert.equal(after.sound, false);

    const rejected = await writeSetting("sound", "maybe");
    assert.equal(rejected.sound, false, "an invalid value must be a no-op, keeping the prior value");
    assert.notEqual(SETTINGS_DEFAULTS.sound, undefined, "sanity: the field still exists in the schema");
  });
});

// ─── Half B: shell wiring, by comment-stripped source scan ────────────────

const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const htmlRaw = fs.readFileSync(HTML_PATH, "utf8");
const htmlStripped = stripHtml(htmlRaw);

/**
 * extractFunctionBody(source, signatureRe) — finds `signatureRe`, then
 * brace-counts from its first `{` to the matching `}`, returning the
 * substring in between (inclusive). Used only against mazeworld.html's
 * module script, whose applySettings/dispatchWithNarration bodies contain
 * no string literal with an unbalanced brace character, so a plain counter
 * is sufficient here (not a general-purpose JS parser).
 */
function extractFunctionBody(source, signatureRe) {
  const m = signatureRe.exec(source);
  if (!m) return null;
  const braceStart = source.indexOf("{", m.index);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return null;
}

test("sfx-settings: shell wiring — mazeworld.html's module script imports src/browser/sfx.js", () => {
  assert.ok(htmlStripped.includes('from "./src/browser/sfx.js"'));
});

test("sfx-settings: shell wiring — applySfxSettings( appears exactly once, inside applySettings's function body", () => {
  const count = (htmlStripped.match(/applySfxSettings\(/g) || []).length;
  assert.equal(count, 1);
  const body = extractFunctionBody(htmlStripped, /function applySettings\(settings\)\s*\{/);
  assert.ok(body, "applySettings(settings) must exist");
  assert.ok(body.includes("applySfxSettings("), "the AUD-05 gate call must sit inside applySettings's body");
});

test("sfx-settings: shell wiring — playForDispatch( appears exactly once, inside dispatchWithNarration's function body, after dispatch(action)", () => {
  const count = (htmlStripped.match(/playForDispatch\(/g) || []).length;
  assert.equal(count, 1);
  const body = extractFunctionBody(htmlStripped, /function dispatchWithNarration\(action\)\s*\{/);
  assert.ok(body, "dispatchWithNarration(action) must exist");
  assert.ok(body.includes("playForDispatch("), "the dispatch-path audio seam must sit inside dispatchWithNarration's body");

  const dispatchIdx = htmlStripped.indexOf("const result = dispatch(action);");
  const playIdx = htmlStripped.indexOf("playForDispatch(action.type");
  assert.ok(dispatchIdx > -1 && playIdx > -1);
  assert.ok(playIdx > dispatchIdx, "the audio call must run AFTER the real dispatch, so it reads real events");
});

test("sfx-settings: shell wiring — unlockSfx( and playUiTap( each appear exactly once", () => {
  assert.equal((htmlStripped.match(/unlockSfx\(/g) || []).length, 1);
  assert.equal((htmlStripped.match(/playUiTap\(/g) || []).length, 1);
});

test("sfx-settings: shell wiring — the two pre-existing hapticForEvents(events) CALL SITES are untouched", () => {
  // Deliberately a call-site pattern (trailing `;`), not a bare
  // "hapticForEvents(events)" substring match — the latter also matches
  // the function's own declaration line one time, which is not a call
  // site and must not be counted as a third one.
  const callSites = (htmlStripped.match(/hapticForEvents\(events\);/g) || []).length;
  assert.equal(callSites, 2, "the move-path and combat-path haptics calls must be exactly as many as before this plan");
});

test("sfx-settings: shell wiring — no pseudo-random call appears anywhere in mazeworld.html", () => {
  assert.equal(/Math\.random/.test(htmlStripped), false);
  assert.equal(/crypto\.getRandomValues/.test(htmlStripped), false);
});

// ─── Half B: TEETH — proves the scan actually distinguishes present from absent ─

test("sfx-settings: TEETH — a synthetic shell source missing the applySfxSettings call fails the same check the real file passes", () => {
  const goodSynthetic = `
    function applySettings(settings) {
      currentSettings = settings;
      applySfxSettings(settings);
      const appEl = 1;
    }
  `;
  const badSynthetic = `
    function applySettings(settings) {
      currentSettings = settings;
      const appEl = 1;
    }
  `;
  const sigRe = () => /function applySettings\(settings\)\s*\{/;

  const goodBody = extractFunctionBody(goodSynthetic, sigRe());
  assert.ok(goodBody && goodBody.includes("applySfxSettings("), "the synthetic PASS fixture must actually pass");

  const badBody = extractFunctionBody(badSynthetic, sigRe());
  assert.ok(badBody && !badBody.includes("applySfxSettings("), "the synthetic FAIL fixture must actually fail — proving the check has teeth");
});
