// test/unit/harness/fakeClock.js
//
// Phase 58 (MOTION-01/05) — the deterministic clock every animated-path
// shell-sandbox test drives Phase 58's timed effects (the camera glide,
// later plans' panel motion/typewriter/combat beat) with. No test built on
// this clock ever sleeps: `advance(ms)` is the ONLY way time moves, and it
// moves it exactly `ms`, never more, never less, never by a real timer.
//
// createFakeClock({ start = 0, frameMs = 16 } = {}) returns
// { now, setTimeout, clearTimeout, requestAnimationFrame,
//   cancelAnimationFrame, advance, pending, Date }:
//
//   - now() reads the clock's current time (ms), starting at `start`.
//   - setTimeout(fn, ms) / clearTimeout(id) schedule/cancel a one-shot
//     timer, due at now()+ms at SCHEDULE time (never re-read later).
//   - requestAnimationFrame(fn) / cancelAnimationFrame(id) queue/cancel a
//     frame callback — fired once per `advance()` frame boundary (see
//     below), mirroring a real rAF's "one callback per painted frame".
//   - advance(ms): moves time forward in steps no larger than `frameMs`
//     (the last step may be shorter, when `ms` is not an exact multiple).
//     At each step: time advances first; then every timer whose due time
//     has now been reached fires, in SCHEDULED-TIME order (ties broken by
//     schedule order — the order setTimeout was called in); then, once per
//     step, every frame callback that was queued BEFORE this step fires —
//     a callback a fired frame callback itself queues (e.g.
//     cameraGlide.js#step() re-arming its own next frame) is queued for
//     the NEXT step, never the current one, exactly like a real rAF never
//     re-entering the frame it was called from.
//   - pending() returns the live timer count plus the live frame-callback
//     count — useful for asserting "nothing is scheduled" after a cancel/
//     finish/snap.
//   - Date: a `Date` subclass whose static `now()` reads the clock's own
//     `now()` — assign this onto a sandbox's `window.Date` (or `Date`) so
//     any shell code that stamps `Date.now()` (e.g. `lastDismissAt =
//     Date.now()`) reads the SAME clock advance() drives, never real wall
//     time. Only the static `now()` is overridden; `new Date()` still
//     builds a normal Date instance (nothing in the shell constructs a
//     `new Date()` today).
//
// Pure — no window/document read, no real timer, no real Date.now() call
// except inside the Date subclass's own now() override (which reads this
// closure's `time`, not the wall clock).

export function createFakeClock({ start = 0, frameMs = 16 } = {}) {
  let time = start;

  let nextTimerId = 1;
  let timerSeq = 0;
  const timers = new Map(); // id -> { due, seq, fn }

  let nextFrameId = 1;
  let frameSeq = 0;
  let frames = new Map(); // id -> { seq, fn }

  function now() {
    return time;
  }

  function scheduleTimeout(fn, ms) {
    const id = nextTimerId++;
    const due = time + Math.max(0, Number(ms) || 0);
    timers.set(id, { due, seq: timerSeq++, fn });
    return id;
  }

  function clearScheduledTimeout(id) {
    timers.delete(id);
  }

  function scheduleFrame(fn) {
    const id = nextFrameId++;
    frames.set(id, { seq: frameSeq++, fn });
    return id;
  }

  function cancelScheduledFrame(id) {
    frames.delete(id);
  }

  // runDueTimers(): fires every timer due at or before the CURRENT `time`,
  // in scheduled-time order (ties broken by call order). Re-scans after
  // each fire so a timer callback that itself schedules another timer due
  // at/before `time` is also honoured within the same step (matches a real
  // event loop draining its due-timer queue before yielding to the next
  // macrotask).
  function runDueTimers() {
    for (;;) {
      let winner = null;
      for (const [id, t] of timers) {
        if (t.due > time) continue;
        if (!winner || t.due < winner.t.due || (t.due === winner.t.due && t.seq < winner.t.seq)) {
          winner = { id, t };
        }
      }
      if (!winner) return;
      timers.delete(winner.id);
      winner.t.fn();
    }
  }

  // runQueuedFrames(): fires exactly the frame callbacks queued BEFORE this
  // call — snapshotted and cleared first, so a callback that requests a
  // fresh frame (e.g. cameraGlide.js#step() re-arming itself) is queued for
  // the NEXT step's snapshot, never this one.
  function runQueuedFrames() {
    const queued = [...frames.values()].sort((a, b) => a.seq - b.seq);
    frames = new Map();
    for (const { fn } of queued) fn();
  }

  function advance(ms) {
    let remaining = Math.max(0, Number(ms) || 0);
    while (remaining > 0) {
      const step = Math.min(frameMs, remaining);
      time += step;
      remaining -= step;
      runDueTimers();
      runQueuedFrames();
    }
  }

  function pending() {
    return timers.size + frames.size;
  }

  class FakeDate extends Date {
    static now() {
      return time;
    }
  }

  return {
    now,
    setTimeout: scheduleTimeout,
    clearTimeout: clearScheduledTimeout,
    requestAnimationFrame: scheduleFrame,
    cancelAnimationFrame: cancelScheduledFrame,
    advance,
    pending,
    Date: FakeDate,
  };
}
