// test/unit/harness/recordingCanvas.js
//
// Phase 59 (DRESS-01..05), Plan 02 — a recording 2D canvas context, so the
// real mazeworld.html draw() (and the dressing layer it composes with) can
// run under node:vm / plain node --test and be asserted call by call: which
// methods were invoked, in what order, with what args, and at what
// globalAlpha. test/unit/harness/recordingDom.js's own `makeFakeCanvasContext`
// is deliberately a no-op sink (it has no drawImage/strokeRect/
// createRadialGradient at all — see its own doc comment) and stays exactly
// that for every existing DOM-snapshot test; this is a SEPARATE, additive
// harness for tests that need to inspect what got drawn, not just prove
// nothing threw.
//
// node --test sweeps every .js file under a directory named `test` as a test
// file — this module declares zero `test(...)` calls so it imports cleanly
// under a bare `node --test` run.

const STATE_KEYS = ["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline", "globalAlpha"];

/**
 * createRecordingContext() — a fake CanvasRenderingContext2D that records
 * every call (as `{ op, args, alpha }`, `alpha` being `globalAlpha` at the
 * moment of the call) instead of drawing anything. `save`/`restore` push/pop
 * a shallow snapshot of the style properties (a real ctx's state stack).
 * `imageDraws()` is a convenience view over just the `drawImage` calls, as
 * `{ img, x, y, w, h, alpha }`.
 */
export function createRecordingContext() {
  const calls = [];
  const state = {
    fillStyle: undefined,
    strokeStyle: undefined,
    lineWidth: undefined,
    font: undefined,
    textAlign: undefined,
    textBaseline: undefined,
    globalAlpha: 1,
  };
  const stack = [];

  function record(op, args) {
    calls.push({ op, args, alpha: state.globalAlpha });
  }

  function noArgMethod(op) {
    return (...args) => record(op, args);
  }

  const ctx = {
    calls,
    setTransform: noArgMethod("setTransform"),
    fillRect: noArgMethod("fillRect"),
    strokeRect: noArgMethod("strokeRect"),
    clearRect: noArgMethod("clearRect"),
    fillText: noArgMethod("fillText"),
    translate: noArgMethod("translate"),
    rotate: noArgMethod("rotate"),
    scale: noArgMethod("scale"),
    beginPath: noArgMethod("beginPath"),
    closePath: noArgMethod("closePath"),
    arc: noArgMethod("arc"),
    fill: noArgMethod("fill"),
    stroke: noArgMethod("stroke"),
    moveTo: noArgMethod("moveTo"),
    lineTo: noArgMethod("lineTo"),
    save() {
      stack.push({ ...state });
      record("save", []);
    },
    restore() {
      const prev = stack.pop();
      if (prev) Object.assign(state, prev);
      record("restore", []);
    },
    drawImage(img, x, y, w, h) {
      record("drawImage", [img, x, y, w, h]);
    },
    createRadialGradient(...args) {
      record("createRadialGradient", args);
      const stops = [];
      return {
        stops,
        addColorStop(offset, color) {
          stops.push([offset, color]);
        },
      };
    },
    imageDraws() {
      return calls
        .filter((c) => c.op === "drawImage")
        .map((c) => ({ img: c.args[0], x: c.args[1], y: c.args[2], w: c.args[3], h: c.args[4], alpha: c.alpha }));
    },
  };

  for (const key of STATE_KEYS) {
    Object.defineProperty(ctx, key, {
      get() {
        return state[key];
      },
      set(v) {
        state[key] = v;
      },
      enumerable: true,
    });
  }

  return ctx;
}
