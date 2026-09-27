// src/browser/hazardCard.js
//
// Phase 78 (CLIMB-01/02), plan 78-03: the pre-roll wall/crevice decision
// card on the rail. The user's ruling (milestone scoping, "option B",
// accepted 2026-09-25): a card with CLIMB IT / LEAP IT, USE LADDER / USE
// ROPE when the tool is carried, and TURN BACK; no die is drawn until the
// player commits, and TURN BACK costs nothing. The engine half (78-01) is
// `state.pendingHazard = { feat, dir, tool }`, the `resolveHazard { cross }`
// action and the pure `hazardOdds`.
//
// CLIMB-02: the card is derived from `state.pendingHazard` alone. The
// engine clears that record on every crossing (a success, or Phase 54's
// one-and-done failed crossing), so no card can ever offer a retry for a
// square already crossed, and a relaunch with the record saved shows the
// same card again.
//
// It is a decision card (the card-vs-rail-line ruling): the shell never
// auto-clears it, and a body tap never dismisses it (railLocked covers a
// pending hazard, so the rail's dismiss kind is "locked").
//
// Pure: no DOM, no rng, no clock, no mutation. The odds come only from
// src/browser/rollOdds.js#hazardOddsText, which reads the engine's own
// hazardOdds and formats through rollRange.js.

import { hasTool as engineHasTool } from "../../engine/derived.js";
import { hazardOddsText } from "./rollOdds.js";

/**
 * HAZARD_CARD_COPY — every player-facing string on the card, in one frozen
 * object so the voice and HP-not-WP scans can walk it.
 *   - `title`/`intro`/`cross` are keyed by the engine's feat ("climb" is a
 *     wall, "gorge" a crevice). `intro` is the card's opening line when the
 *     step's own Oracle narration is not to hand (a relaunch).
 *   - `odds` fills `{label}` (the cross button's label) and `{odds}`
 *     (hazardOddsText's line); `counted` is the odds line's second row,
 *     naming the live penalties already folded into the range.
 *   - `tool` is keyed by the engine's tool ("ladder" | "rope"): the button
 *     label and the line that says what the tool does.
 */
export const HAZARD_CARD_COPY = Object.freeze({
  title: Object.freeze({ climb: "A WALL", gorge: "A CREVICE" }),
  intro: Object.freeze({
    climb: "A wall. You could climb it. You could also not.",
    gorge: "A crevice. Leaping is traditional. Rope is smarter.",
  }),
  cross: Object.freeze({ climb: "CLIMB IT", gorge: "LEAP IT" }),
  odds: "{label}: {odds}.",
  counted: "{mods}, already counted",
  fall: "Miss a roll and you fall. Falling hurts.",
  oneAndDone: "Hurt or not, you end up on the far side. One try, no encores.",
  tool: Object.freeze({
    ladder: Object.freeze({ label: "USE LADDER", line: "USE LADDER: up and over, no roll. The ladder stays behind." }),
    rope: Object.freeze({ label: "USE ROPE", line: "USE ROPE: across, no roll. The rope stays behind." }),
  }),
  back: Object.freeze({ label: "TURN BACK", line: "TURN BACK: nothing rolled, nothing spent, nothing proved." }),
});

/** The engine's tool for each feat (engine/movement.js's pause sets the same). */
const TOOL_FOR = Object.freeze({ climb: "ladder", gorge: "rope" });

/** The map's own icon for each feat (icons.js: climb draws as the wall, gorge as the crevice). */
const ICON_FOR = Object.freeze({ climb: "wall", gorge: "crevice" });

/**
 * hazardCardViewModel(state, deps = {}) — the whole decision card for the
 * pending wall or crevice, or null when there is none to show (no record,
 * an unknown feat, a combat, an open store, a dead hero).
 *
 * Returns `{ key, feat, dir, tool, carried, icon, iconKey, title, intro,
 * lines, buttons }`:
 *   - `key`: stable for the same record and bag, so a repaint never
 *     re-arms the buttons; it changes when the tool comes or goes;
 *   - `lines`: `[{ text, roll }]` in order: the odds line (its `roll` names
 *     the live penalties, or null), the fall line, the one-and-done line,
 *     the tool line (only while the tool is carried), the TURN BACK line.
 *     The shell puts the step's own narration (or `intro`) above these;
 *   - `buttons`: `[{ id, label, act, tool? }]`, always in this order:
 *     the cross button (`act: "cross"`, CLIMB IT or LEAP IT), the tool
 *     button (`act: "tool"`, only while carried), TURN BACK (`act: "back"`,
 *     always last).
 *
 * `deps.hasTool(c, tool)` (optional) replaces engine/derived.js#hasTool;
 * the tool is read live from the bag, never from the pause event's
 * `carried`, so a tool that leaves the bag drops its button at once.
 */
export function hazardCardViewModel(state, deps = {}) {
  const p = state && state.pendingHazard;
  if (!p || state.combat || state.store || state.dead) return null;
  const feat = p.feat;
  if (feat !== "climb" && feat !== "gorge") return null;
  const odds = hazardOddsText(state, feat);
  if (!odds) return null;
  const has = typeof deps.hasTool === "function" ? deps.hasTool : engineHasTool;
  const tool = p.tool === TOOL_FOR[feat] ? p.tool : TOOL_FOR[feat];
  const carried = !!has(state.c, tool);
  const crossLabel = HAZARD_CARD_COPY.cross[feat];
  const toolCopy = HAZARD_CARD_COPY.tool[tool];

  const lines = [
    {
      text: HAZARD_CARD_COPY.odds.replace("{label}", crossLabel).replace("{odds}", odds.text),
      roll: odds.penaltyText ? HAZARD_CARD_COPY.counted.replace("{mods}", odds.penaltyText) : null,
    },
    { text: HAZARD_CARD_COPY.fall, roll: null },
    { text: HAZARD_CARD_COPY.oneAndDone, roll: null },
  ];
  if (carried) lines.push({ text: toolCopy.line, roll: null });
  lines.push({ text: HAZARD_CARD_COPY.back.line, roll: null });

  const buttons = [{ id: "a-hazard-cross", label: crossLabel, act: "cross" }];
  if (carried) buttons.push({ id: "a-hazard-tool", label: toolCopy.label, act: "tool", tool });
  buttons.push({ id: "a-hazard-back", label: HAZARD_CARD_COPY.back.label, act: "back" });

  return {
    key: `hazard:${feat}:${p.dir}:${carried ? tool : "-"}`,
    feat,
    dir: p.dir,
    tool,
    carried,
    icon: "⧗",
    iconKey: ICON_FOR[feat],
    title: HAZARD_CARD_COPY.title[feat],
    intro: HAZARD_CARD_COPY.intro[feat],
    lines,
    buttons,
  };
}
