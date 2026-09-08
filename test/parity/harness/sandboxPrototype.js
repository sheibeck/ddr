// test/parity/harness/sandboxPrototype.js
//
// node:vm loader that runs the frozen prototype (test/parity/prototype-master.js)
// headless, with a minimal hand-written DOM/localStorage/canvas stub surface and
// a seeded Math.random (makeSeededMathRandom) so the prototype draws the exact
// same roll sequence the extracted engine will.
//
// Per 01-RESEARCH.md Assumption A4: start with the minimal stub surface and add
// methods only where the sandbox throws on a missing one. Each addition below is
// commented with the prototype.html line(s) that required it.

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeSeededMathRandom } from "./seedableMathRandom.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_MASTER_PATH = path.join(__dirname, "..", "prototype-master.js");

/**
 * makeFakeElement(tag) — a generic DOM-element stand-in covering the surface
 * the prototype actually touches: getElementById/createElement results
 * (mazeworld.html lines 1037-1039 cv/ctx, 1432 logEl, 1503-1608 paint()'s many
 * getElementById calls, 2964-2973 renderGraves, 3008 armAgain's btn-again).
 * A plain object would satisfy arbitrary property get/set (style.width = "..",
 * el.textContent = "..", el.className = "..") without declaring every field;
 * the methods below are the ones the prototype actually calls on elements.
 */
function makeFakeElement(tag) {
  const el = {
    tagName: tag || "div",
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    children: [],
    firstChild: null,
    lastChild: null,
    parentElement: null,
    className: "",
    value: "",
    disabled: false,
    onclick: null,
    addEventListener() {},
    removeEventListener() {},
    click() {},
    // mazeworld.html line 2574 (renderEncounter's
    // `body.insertAdjacentHTML("beforeend", vitalsStrip())`) — gameplay-irrelevant
    // (only affects the encounter panel's rendered markup), stubbed as a no-op.
    insertAdjacentHTML() {},
    // mazeworld.html line 3216-3218 (`e.target.closest("button[data-dir]")`) —
    // never exercised by newGame()/move() headless (no real click events are
    // synthesized), but stubbed so any code path that calls it doesn't throw.
    closest() {
      return null;
    },
    appendChild(child) {
      el.children.push(child);
      el.lastChild = child;
      if (!el.firstChild) el.firstChild = child;
      return child;
    },
    // mazeworld.html line 1437 (logLine's `logEl.insertBefore(p, logEl.firstChild)`)
    insertBefore(child) {
      el.children.unshift(child);
      el.firstChild = child;
      if (el.children.length === 1) el.lastChild = child;
      return child;
    },
    // mazeworld.html line 1438 (`logEl.removeChild(logEl.lastChild)` once the
    // log exceeds 160 entries)
    removeChild(child) {
      const idx = el.children.indexOf(child);
      if (idx >= 0) el.children.splice(idx, 1);
      el.lastChild = el.children[el.children.length - 1] || null;
      el.firstChild = el.children[0] || null;
      return child;
    },
  };
  // mazeworld.html sets `.innerHTML = "..."` to clear a container before
  // re-appending fresh children (paint() lines 1535/1560/1577/1599, renderGraves
  // line 2971 `wrap.innerHTML = ""`). A real DOM assignment wipes existing
  // children; mirror that so repeated paint() calls in a longer replay don't
  // accumulate stale fake children forever.
  let innerHTMLValue = "";
  Object.defineProperty(el, "innerHTML", {
    get() {
      return innerHTMLValue;
    },
    set(value) {
      innerHTMLValue = value;
      el.children = [];
      el.firstChild = null;
      el.lastChild = null;
    },
  });
  let textContentValue = "";
  Object.defineProperty(el, "textContent", {
    get() {
      return textContentValue;
    },
    set(value) {
      textContentValue = value;
    },
  });
  return el;
}

/**
 * A no-op 2D canvas context — covers every method the prototype's draw()
 * calls (mazeworld.html lines 1277, 1296-1383: setTransform, fillRect,
 * fillText, clearRect, save, restore, translate, scale, rotate, beginPath,
 * arc, fill, stroke, moveTo, lineTo, closePath). Style properties like
 * `ctx.fillStyle = "..."` are plain assignments a bare object already allows.
 */
function makeFakeCanvasContext() {
  return {
    setTransform() {},
    fillRect() {},
    clearRect() {},
    fillText() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
  };
}

/**
 * loadPrototypeSandbox({ seed }) — reads the frozen prototype source and runs
 * it in a fresh vm.createContext, returning the resulting context (the
 * prototype's top-level `function`s/`let`s become properties of this object:
 * newGame, move, S, etc.), with Math.random replaced by a seeded mulberry32
 * so the prototype consumes a deterministic, engine-matching roll stream.
 */
export function loadPrototypeSandbox({ seed } = {}) {
  const prototypeSource = fs.readFileSync(PROTOTYPE_MASTER_PATH, "utf8");

  const fakeStorage = new Map();

  // mazeworld.html lines 1037-1039: the maze canvas + its 2D context.
  const canvasEl = makeFakeElement("canvas");
  const fakeCanvasCtx = makeFakeCanvasContext();
  canvasEl.getContext = () => fakeCanvasCtx;
  // mazeworld.html line 1270 (`cv.parentElement.clientWidth - 26`, in fit())
  canvasEl.parentElement = makeFakeElement("div");
  canvasEl.parentElement.clientWidth = 400;

  const elementsById = new Map([["maze", canvasEl]]);
  function getElementById(id) {
    if (!elementsById.has(id)) elementsById.set(id, makeFakeElement("div"));
    return elementsById.get(id);
  }

  const sandbox = {
    document: {
      getElementById,
      createElement: (tag) => makeFakeElement(tag),
      // mazeworld.html line 1293 (`getComputedStyle(document.documentElement)`)
      documentElement: makeFakeElement("html"),
      addEventListener() {},
    },
    localStorage: {
      getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
      setItem: (k, v) => fakeStorage.set(k, String(v)),
      removeItem: (k) => fakeStorage.delete(k),
    },
    // mazeworld.html line 1293: `getComputedStyle(document.documentElement)`,
    // used only to read CSS custom-property color values for canvas drawing —
    // gameplay-irrelevant, so an empty string for every property is sufficient.
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    // mazeworld.html line 3220/3241: top-level `addEventListener("keydown"/"resize", ...)`
    addEventListener() {},
    // mazeworld.html line 3014 (armAgain's `setTimeout(...)`) — not exercised
    // by newGame()/move(), stubbed defensively so any future fixture that
    // reaches death doesn't throw on a missing global.
    setTimeout() {},
    console,
    Math,
  };
  // mazeworld.html line 1271/1274 (`window.innerHeight`, `window.devicePixelRatio`)
  // and line 1403 (`window.matchMedia(...)`) — `window` is the sandbox itself
  // (top-level identifiers like `document`/`localStorage`/`addEventListener`
  // are reachable unprefixed AND via `window.`), per 01-RESEARCH.md's sketch.
  sandbox.window = sandbox;
  sandbox.innerHeight = 800;
  sandbox.innerWidth = 400;
  sandbox.devicePixelRatio = 1;
  sandbox.matchMedia = () => ({ matches: false });

  // Seed the sandbox's Math.random with the same mulberry32 the engine uses
  // (engine/rng.js), so D()/pick()/shuffle() (mazeworld.html lines 489-490,
  // 1265) and genFloor's inline Math.random() calls (~1190-1191) all draw the
  // identical stream a faithful engine port will produce for the same seed.
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = makeSeededMathRandom(seed ?? 1);

  const context = vm.createContext(sandbox);
  vm.runInContext(prototypeSource, context, { filename: "prototype-master.js" });

  // mazeworld.html line 1036: `let S = null;` is a top-level `let`, so it is
  // NOT reflected as a property on the vm context's global object the way
  // `var`/`function` declarations are (Node vm semantics) — `context.S` would
  // read `undefined` even after newGame() reassigns S. A second runInContext
  // call in the SAME context shares that context's top-level lexical
  // environment (verified: `let` bindings from an earlier runInContext call
  // are visible to a later one), so define a live getter for S on the global
  // object here. The getter closes over the actual `S` binding, so it always
  // reflects the prototype's current state, including after later move()/
  // newGame() calls reassign it.
  vm.runInContext(
    "Object.defineProperty(globalThis, 'S', { get: () => S, configurable: true });",
    context,
  );

  return context;
}
