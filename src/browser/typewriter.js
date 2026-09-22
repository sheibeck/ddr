// src/browser/typewriter.js
//
// Phase 58 (MOTION-04/05) — the typing schedule (12ms/char, 700ms cap per
// block, D-13) and a keyed, accessible, cancellable typewriter controller.
//
// Three rules this module exists to keep true everywhere it is wired
// (rail cards, the encounter overlay's line, fight-log rows as the combat
// beat reveals them — plans 58-05/58-06):
//
//  1. WHAT types is decided entirely by the caller. The Oracle history, HUD
//     numbers and buttons never type (D-14) — this module has no opinion on
//     that, it only knows how to type whatever text a caller hands it.
//  2. The element that is visibly typing is aria-hidden for EXACTLY the
//     typing window, and the caller keeps feeding the complete text to its
//     own announcer/description node throughout — this module never hides
//     that announcer (D-16).
//  3. The rest span (`TYPE_REST_CLASS`) reserves the block's final layout
//     from the very first frame, so a multi-line rail card never grows
//     line by line while it types — that growth is exactly the "jarring"
//     motion the user asked removed (see 58-01-PLAN.md's discovery note).
//
// Pure, clock-free, DOM-free like this phase's sibling modules: every
// clock/raf/cancelRaf/reduced predicate AND the `doc` (for createElement)
// arrive as arguments — this module never reads the `window`/`document`
// globals itself. Imports nothing.

/** Milliseconds per character while typing (D-13, "fast, not slow"). */
export const TYPE_MS_PER_CHAR = 12;
/** Cap (ms) on a single block's total typing duration — a long card speeds up rather than dragging (D-13). */
export const TYPE_MAX_MS = 700;
/** className the rest span carries — plan 58-05 styles this `visibility:hidden` so a block holds its final size from frame one. */
export const TYPE_REST_CLASS = "mw-type-rest";

/**
 * typeDurationMs(chars) — 0 for a non-finite or non-positive count;
 * otherwise Math.min(chars * TYPE_MS_PER_CHAR, TYPE_MAX_MS).
 * @param {number} chars
 * @returns {number}
 */
export function typeDurationMs(chars) {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.min(chars * TYPE_MS_PER_CHAR, TYPE_MAX_MS);
}

/**
 * typedCount(total, elapsedMs) — an integer in [0, total]. Returns `total`
 * once `elapsedMs >= typeDurationMs(total)`; otherwise
 * `Math.floor(total * elapsedMs / typeDurationMs(total))`, clamped.
 * @param {number} total
 * @param {number} elapsedMs
 * @returns {number}
 */
export function typedCount(total, elapsedMs) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  if (safeTotal === 0) return 0;
  const duration = typeDurationMs(safeTotal);
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  if (duration === 0 || elapsed >= duration) return safeTotal;
  const count = Math.floor((safeTotal * elapsed) / duration);
  if (count < 0) return 0;
  if (count > safeTotal) return safeTotal;
  return count;
}

/**
 * splitTyped(texts, count) — distributes `count` characters across `texts`
 * in order, returning `[{ typed, rest }]` per entry. A non-finite/negative
 * count behaves like 0 (all rest); a count at or past the combined total
 * behaves like the full total (all typed).
 * @param {string[]} texts
 * @param {number} count
 * @returns {{typed:string, rest:string}[]}
 */
export function splitTyped(texts, count) {
  let remaining = Number.isFinite(count) && count > 0 ? count : 0;
  return (Array.isArray(texts) ? texts : []).map((text) => {
    const t = text == null ? "" : String(text);
    if (remaining <= 0) return { typed: "", rest: t };
    if (remaining >= t.length) {
      remaining -= t.length;
      return { typed: t, rest: "" };
    }
    const typed = t.slice(0, remaining);
    const rest = t.slice(remaining);
    remaining = 0;
    return { typed, rest };
  });
}

function normaliseTexts(texts) {
  return (Array.isArray(texts) ? texts : []).map((t) => (t == null ? "" : String(t)));
}

function restoreAria(host, prevValue) {
  if (!host) return;
  try {
    if (prevValue === null || prevValue === undefined) {
      host.removeAttribute?.("aria-hidden");
    } else {
      host.setAttribute?.("aria-hidden", prevValue);
    }
  } catch {
    // a malformed host must never throw out of a render path.
  }
}

function hideAria(host) {
  if (!host) return null;
  let prev = null;
  try {
    prev = typeof host.getAttribute === "function" ? host.getAttribute("aria-hidden") : null;
    host.setAttribute?.("aria-hidden", "true");
  } catch {
    // a malformed host must never throw out of a render path.
  }
  return prev;
}

function buildSpans(doc, targetsArr, texts, count) {
  const parts = splitTyped(texts, count);
  return targetsArr.map((target, i) => {
    target.textContent = "";
    const typedSpan = doc.createElement("span");
    const restSpan = doc.createElement("span");
    restSpan.className = TYPE_REST_CLASS;
    target.appendChild(typedSpan);
    target.appendChild(restSpan);
    typedSpan.textContent = parts[i] ? parts[i].typed : "";
    restSpan.textContent = parts[i] ? parts[i].rest : "";
    return { typedSpan, restSpan };
  });
}

/**
 * createTypewriter({ now, raf, cancelRaf, reduced, doc })
 *
 * Returns `{ type, adopt, complete, cancel, active, completeAll }`, closing
 * over a Map from key to a run
 * `{ targets, texts, spans, ariaHost, prevAria, onDone, t0, total, frame }`.
 *
 * @param {{
 *   now: () => number,
 *   raf: (fn: () => void) => any,
 *   cancelRaf: (id: any) => void,
 *   reduced: () => boolean,
 *   doc: { createElement: (tag: string) => any },
 * }} deps
 */
export function createTypewriter({ now, raf, cancelRaf, reduced, doc }) {
  const runs = new Map();

  function finishRun(key, callDone) {
    const run = runs.get(key);
    if (!run) return;
    if (run.frame !== null && run.frame !== undefined) {
      try {
        cancelRaf(run.frame);
      } catch {
        // a malformed cancelRaf must never throw into the caller.
      }
    }
    runs.delete(key);
    run.targets.forEach((target, i) => {
      target.textContent = run.texts[i] !== undefined ? run.texts[i] : "";
    });
    restoreAria(run.ariaHost, run.prevAria);
    if (callDone && typeof run.onDone === "function") {
      try {
        run.onDone();
      } catch {
        // a throwing onDone must never strand the run or rethrow.
      }
    }
  }

  function step(key) {
    const run = runs.get(key);
    if (!run) return;
    const count = typedCount(run.total, now() - run.t0);
    if (reduced() || count >= run.total) {
      finishRun(key, true);
      return;
    }
    const parts = splitTyped(run.texts, count);
    run.spans.forEach((pair, i) => {
      if (!pair) return;
      pair.typedSpan.textContent = parts[i] ? parts[i].typed : "";
      pair.restSpan.textContent = parts[i] ? parts[i].rest : "";
    });
    run.frame = raf(() => step(key));
  }

  function cancel(key) {
    try {
      if (runs.has(key)) finishRun(key, false);
    } catch {
      // never throw into the caller.
    }
  }

  function type(key, opts) {
    try {
      cancel(key);

      const targetsArr = Array.isArray(opts?.targets) ? opts.targets : [];
      const texts = normaliseTexts(opts?.texts);
      const ariaHost = opts?.ariaHost ?? null;
      const onDone = typeof opts?.onDone === "function" ? opts.onDone : null;
      const total = texts.reduce((sum, t) => sum + t.length, 0);

      if (reduced() || total === 0) {
        targetsArr.forEach((target, i) => {
          target.textContent = texts[i] !== undefined ? texts[i] : "";
        });
        if (onDone) {
          try {
            onDone();
          } catch {
            // never throw into the caller.
          }
        }
        return;
      }

      const prevAria = hideAria(ariaHost);
      const spans = buildSpans(doc, targetsArr, texts, 0);
      const run = {
        targets: targetsArr,
        texts,
        spans,
        ariaHost,
        prevAria,
        onDone,
        t0: now(),
        total,
        frame: null,
      };
      runs.set(key, run);
      run.frame = raf(() => step(key));
    } catch {
      // never throw into a render path.
    }
  }

  function adopt(key, targets, ariaHost = null) {
    try {
      const run = runs.get(key);
      if (!run) return false;

      const targetsArr = Array.isArray(targets) ? targets : [];
      if (targetsArr.length !== run.texts.length) {
        finishRun(key, false);
        return false;
      }

      restoreAria(run.ariaHost, run.prevAria);
      const newPrevAria = hideAria(ariaHost);

      const count = typedCount(run.total, now() - run.t0);
      const spans = buildSpans(doc, targetsArr, run.texts, count);

      run.targets = targetsArr;
      run.spans = spans;
      run.ariaHost = ariaHost;
      run.prevAria = newPrevAria;
      return true;
    } catch {
      return false;
    }
  }

  function complete(key) {
    try {
      if (!runs.has(key)) return false;
      finishRun(key, true);
      return true;
    } catch {
      return false;
    }
  }

  function active(key) {
    return runs.has(key);
  }

  function completeAll() {
    try {
      for (const key of [...runs.keys()]) complete(key);
    } catch {
      // never throw into the caller.
    }
  }

  return { type, adopt, complete, cancel, active, completeAll };
}
