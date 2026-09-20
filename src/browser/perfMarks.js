// src/browser/perfMarks.js — Phase 49 (PERF-01): pure per-row timing rings
// for the dev-gated step marks. The shell (mazeworld.html's module script,
// stepWith) takes the clock readings and calls record(row, ms); this module
// never reads a clock or a global, so it is unit-tested in node with
// injected samples. Rows: step (the whole stepWith body), dispatch
// (dispatchWithNarration), paint (one paint() call — which itself ends by
// calling draw(), so paint >= draw), draw (the trailing draw() call).
// Nothing here runs in a normal run: the shell's `perf` handle is null
// unless state.dev is true (docs/PERF-BASELINE.md, Method).

/** PERF_ROWS — the four known rows, in report order. */
export const PERF_ROWS = Object.freeze(["step", "dispatch", "paint", "draw"]);

/** PERF_RING_SIZE — default ring capacity (samples kept per row). */
export const PERF_RING_SIZE = 100;

/** PERF_LOG_EVERY — the shell logs a "[mzperf]" console line every Nth recorded step. */
export const PERF_LOG_EVERY = 10;

/**
 * createPerfMarks(size = PERF_RING_SIZE) — a fresh, independent ring-buffer
 * instance over a private Map<row, { ring: number[], total: number }>.
 * Returns a frozen object exposing record/summary/reset/size — no shared
 * state between instances.
 */
export function createPerfMarks(size = PERF_RING_SIZE) {
  const rows = new Map();

  function record(row, ms) {
    if (typeof row !== "string" || !row) return;
    if (!Number.isFinite(ms) || ms < 0) return;
    let entry = rows.get(row);
    if (!entry) {
      entry = { ring: [], total: 0 };
      rows.set(row, entry);
    }
    entry.ring.push(ms);
    while (entry.ring.length > size) entry.ring.shift();
    entry.total += 1;
  }

  function summary() {
    const out = {};
    const known = PERF_ROWS.filter((row) => rows.has(row));
    const other = [...rows.keys()].filter((row) => !PERF_ROWS.includes(row));
    for (const row of [...known, ...other]) {
      const entry = rows.get(row);
      const n = entry.ring.length;
      if (n === 0) continue;
      const sorted = [...entry.ring].sort((a, b) => a - b);
      out[row] = {
        n,
        total: entry.total,
        median: sorted[Math.ceil(0.5 * n) - 1],
        p95: sorted[Math.ceil(0.95 * n) - 1],
        max: sorted[n - 1],
      };
    }
    return out;
  }

  function reset() {
    rows.clear();
  }

  return Object.freeze({ record, summary, reset, size });
}

/** perfMarks — the shell's one shared instance (a plain export, no bridge). */
export const perfMarks = createPerfMarks();

/**
 * formatReadout(summary) — renders a summary() object as one line:
 * "step 7.4 / 12.1 / 30.2 · dispatch 1.1 / 2.0 / 4.0 · paint 3.2 / 6.0 / 9.9
 * · draw 1.9 / 4.3 / 7.7 ms (med / p95 / max, n=57)". Numbers are rounded
 * with toFixed(1). n is the step row's n (or the first listed row's n when
 * step is absent). An empty summary returns "".
 */
export function formatReadout(summary) {
  const keys = Object.keys(summary);
  if (keys.length === 0) return "";
  const parts = keys.map((row) => {
    const s = summary[row];
    return `${row} ${s.median.toFixed(1)} / ${s.p95.toFixed(1)} / ${s.max.toFixed(1)}`;
  });
  const nSource = summary.step || summary[keys[0]];
  return `${parts.join(" · ")} ms (med / p95 / max, n=${nSource.n})`;
}
