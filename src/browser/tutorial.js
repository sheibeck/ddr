// src/browser/tutorial.js
//
// First-run coach-mark sequencer + tutorialSeen persistence (UX-06;
// 04-CONTEXT.md tutorial decision). A fixed, hand-authored ~4-step sequence
// overlaid on the real first floor (move here / that mark is a trap /
// descend there / you're starving) — no onboarding library, per
// 04-RESEARCH.md "Don't Hand-Roll" (coach-mark row). Dismissible, shown
// once, persisted as `mazeworld.tutorialSeen` via storage.js's shared
// window.mzStorage abstraction — never any raw browser-native key/value
// store directly (T-04-07, 04-RESEARCH.md's "future coach-mark bug" threat
// entry).
//
// This module is pure step-state logic (the sequencer) plus thin async I/O
// (the seen flag) — no DOM. The actual `position:fixed` overlay + clip-path
// spotlight rendering is 04-10's job; this module only owns WHICH step is
// current and WHETHER the tutorial has already been seen.

import { getItem, setItem } from "./storage.js";

/** The one storage key this module ever reads/writes, always via storage.js. */
export const TUTORIAL_SEEN_KEY = "mazeworld.tutorialSeen";

/** "No wall of text" cap (UX-06) — enforced by test/unit/tutorial.test.js. */
export const COACH_MARK_COPY_MAX_CHARS = 90;

/**
 * COACH_MARK_STEPS — the fixed ~4-step sequence (04-CONTEXT.md). `target` is
 * a logical id the 04-10 renderer maps to a real DOM element/canvas region;
 * this module never touches the DOM itself. `copy` stays within
 * COACH_MARK_COPY_MAX_CHARS and at most 2 short lines.
 */
export const COACH_MARK_STEPS = [
  { id: "move", target: "maze-canvas", copy: "Tap the square next door. That is how legs work down here." },
  { id: "trap", target: "trap-mark", copy: "That mark is a trap. Touch it and regret follows immediately." },
  { id: "descend", target: "descent-mark", copy: "That is the way down. It only gets worse from here." },
  { id: "starving", target: "rations-hud", copy: "Rations hit zero and you start starving. Eat something." },
];

/**
 * makeTutorialSequencer(steps) — a pure, stateful (module-local closure)
 * step walker over a fixed step array. current() returns the active step or
 * null once complete; next() advances (returns null and marks complete once
 * past the last step, or immediately for an empty step list); dismiss()
 * completes the sequence immediately from any step.
 */
export function makeTutorialSequencer(steps = COACH_MARK_STEPS) {
  let index = 0;
  let complete = steps.length === 0;

  return {
    current() {
      return complete ? null : steps[index];
    },
    next() {
      if (complete) return null;
      index += 1;
      if (index >= steps.length) {
        complete = true;
        return null;
      }
      return steps[index];
    },
    dismiss() {
      complete = true;
    },
    isComplete() {
      return complete;
    },
  };
}

/**
 * getTutorialSeen() — reads the persisted tutorialSeen flag, fail-open to
 * `false` (an unset, corrupt, or unreadable store means the tutorial shows,
 * matching this module's "shown once" contract against never being able to
 * show it at all).
 */
export async function getTutorialSeen() {
  try {
    const raw = await getItem(TUTORIAL_SEEN_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

/**
 * setTutorialSeen(seen = true) — persists the flag through storage.js only.
 * Fail-open: a write failure just means the tutorial may show again next
 * launch, never a thrown error.
 */
export async function setTutorialSeen(seen = true) {
  try {
    await setItem(TUTORIAL_SEEN_KEY, seen ? "true" : "false");
  } catch {
    // fail-open — see doc comment above.
  }
}
