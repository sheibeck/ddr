// src/browser/teleportCard.js
//
// Phase 91 (IDENT-14), plan 91-04: the Illusionist's teleport pick, the half
// the player sees. Report #3, verbatim: "I have a deserved illusionist. It says
// I choose where teleports takes me, but when I stepped on a teleport I didn't
// get to choose." The engine half (91-03) is `state.pendingTeleport = { x, y,
// depth }`, `teleportTargets(state)` (the reachable floor squares the hero has
// already explored) and the `teleportPick` action (`{ x, y }` for a square,
// `{ auto: true }` for LET IT CHOOSE).
//
// CONTEXT decision ("The Illusionist chooses where a teleport lands"): "A
// decision card (it is a choice) that holds input until the player picks ...
// save/quit mid-pick restores the pending pick", the map highlights the
// squares, and a button, LET IT CHOOSE, takes today's automatic best
// direction. This module is the card: derived from `state.pendingTeleport`
// alone, so a relaunch with the record saved shows the same card again.
//
// It is a decision card (the card-vs-rail-line ruling): the shell never
// auto-clears it, and a body tap never dismisses it (railLocked covers a
// pending pick, so the rail's dismiss kind is "locked"). The glowing squares
// are the map's half (mazeworld.html draw()); the tap on one is tapStep's.
//
// Pure: no DOM, no rng, no clock, no mutation.

import { TELEPORT_REACH, teleportTargets as engineTeleportTargets } from "../../engine/movement.js";

/**
 * TELEPORT_CARD_COPY — every player-facing string on the card, in one frozen
 * object so the voice and HP-not-WP scans can walk it.
 *   - `intro` is the card's opening line when the step's own Oracle narration
 *     is not to hand (a relaunch); `{count}` is how many squares glow.
 *   - `reach` and `auto.line` fill `{reach}` from the engine's TELEPORT_REACH,
 *     so the card can never promise a different reach than the engine allows.
 */
export const TELEPORT_CARD_COPY = Object.freeze({
  title: "THE TELEPORT WAITS",
  intro: Object.freeze({
    many: "{count} squares glow on the map. Tap one and the party goes there. Tap anywhere else and the party goes nowhere, on principle.",
    one: "One square glows on the map. Tap it. It is a short menu, but it is yours.",
    none: "Nothing you have explored is in reach, so nothing glows. Your only vote is LET IT CHOOSE.",
  }),
  reach: "Reach: up to {reach} squares, straight or diagonal, explored floor only.",
  auto: Object.freeze({
    label: "LET IT CHOOSE",
    line: "LET IT CHOOSE: the teleporter takes the longest clear run, up to {reach} squares, and you take what you get.",
  }),
});

/**
 * teleportCardViewModel(state, deps = {}) — the whole decision card for the
 * pending teleport pick, or null when there is none to show (no record, a
 * combat, an open store, a dead hero, a null state).
 *
 * Returns `{ kind: "teleport", key, icon, iconKey, title, intro, lines,
 * buttons, count }`:
 *   - `count`: how many squares glow, the same number teleportTargets lists;
 *   - `intro`: the line naming that count and how to pick (singular for one,
 *     its own line for none). The shell puts the step's own narration above
 *     the lines, or this intro when there is none (a relaunch);
 *   - `lines`: `[{ text, roll }]`: the reach in plain words, then the
 *     LET IT CHOOSE explanation;
 *   - `buttons`: exactly one, LET IT CHOOSE, whose `dispatch` is the engine
 *     action `{ type: "teleportPick", auto: true }`. The squares themselves
 *     are picked on the map, never by a button.
 *
 * `deps.teleportTargets(state)` (optional) replaces engine/movement.js's, for
 * the shell bridge and tests.
 */
export function teleportCardViewModel(state, deps = {}) {
  const p = state && state.pendingTeleport;
  if (!p || state.combat || state.store || state.dead) return null;
  const targets = typeof deps.teleportTargets === "function" ? deps.teleportTargets : engineTeleportTargets;
  const count = targets(state).length;
  const intro =
    count === 0 ? TELEPORT_CARD_COPY.intro.none : count === 1 ? TELEPORT_CARD_COPY.intro.one : TELEPORT_CARD_COPY.intro.many.replace("{count}", String(count));
  const reach = String(TELEPORT_REACH);
  return {
    kind: "teleport",
    key: `teleport:${p.x},${p.y}:${p.depth}:${count}`,
    icon: "◆",
    iconKey: "teleport",
    title: TELEPORT_CARD_COPY.title,
    intro,
    lines: [
      { text: TELEPORT_CARD_COPY.reach.replace("{reach}", reach), roll: null },
      { text: TELEPORT_CARD_COPY.auto.line.replace("{reach}", reach), roll: null },
    ],
    buttons: [{ id: "a-teleport-auto", label: TELEPORT_CARD_COPY.auto.label, dispatch: { type: "teleportPick", auto: true } }],
    count,
  };
}

/**
 * teleportPickAction(state, pick) — the engine action for an answer to the
 * pending pick, or null when nothing should be dispatched: no live
 * `state.pendingTeleport` (a second tap after the landing, a stale tap), a
 * combat or open store covering the map, or a pick that is neither
 * `{ auto: true }` nor a pair of integers. Pure.
 *   { auto: true }  -> { type: "teleportPick", auto: true }
 *   { x, y }        -> { type: "teleportPick", x, y }
 */
export function teleportPickAction(state, pick) {
  if (!state || !state.pendingTeleport || state.combat || state.store || state.dead) return null;
  if (!pick || typeof pick !== "object") return null;
  if (pick.auto === true) return { type: "teleportPick", auto: true };
  if (Number.isInteger(pick.x) && Number.isInteger(pick.y)) return { type: "teleportPick", x: pick.x, y: pick.y };
  return null;
}
