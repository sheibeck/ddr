// src/browser/achievementBus.js
//
// Phase 100 (AUI-01): a small fan-out over the adapter's one achievement
// listener. engineAdapter.js keeps a SINGLE listener slot (setAchievementListener
// replaces whatever was registered before), which is right for the adapter but
// would let the unlock banner (Phase 100) and the Play mirror (Phase 101) knock
// each other out. This bus sits in front of that slot: the shell registers
// `achievementEvents.publish` as the adapter's one listener, and every consumer
// subscribes here instead.
//
// Contract for Phase 101 (and any later consumer):
//   - subscribe to `achievementEvents`;
//   - never call `setAchievementListener` yourself: the shell owns that single
//     slot and hands it `achievementEvents.publish`;
//   - a subscriber receives the adapter's frozen { unlocks, reveals, progress }
//     payload untouched (the identical object for every subscriber), in
//     subscription order;
//   - a subscriber that throws, or returns a rejected promise, is swallowed: it
//     never stops the next subscriber and never reaches the adapter's dispatch.
//
// Pure: no imports, no window or document, no timers, no storage, no network.
// Every function is a closure, so `publish` can be handed over as a bare
// function reference.

/**
 * createAchievementBus() — a fresh, frozen { subscribe, publish, size }.
 */
export function createAchievementBus() {
  // Insertion-ordered; adding the same function twice is one registration.
  const subscribers = new Set();

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }

  function publish(payload) {
    // Snapshot: a subscriber added during this publish first hears the next one,
    // and one removed during it is still called by this one.
    for (const fn of Array.from(subscribers)) {
      try {
        const out = fn(payload);
        if (out && typeof out.then === "function") {
          Promise.resolve(out).catch(() => {});
        }
      } catch {
        // swallowed: one consumer's bug must never reach another or the adapter
      }
    }
    // Returns undefined on purpose, so the adapter's own thenable check finds nothing.
  }

  function size() {
    return subscribers.size;
  }

  return Object.freeze({ subscribe, publish, size });
}

/** achievementEvents — the one shared instance the shell and Phase 101 use. */
export const achievementEvents = createAchievementBus();
