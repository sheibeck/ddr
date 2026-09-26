// src/browser/gearSheet.js
//
// Phase 63 (GSCR-07..10, GRULE-02) — the GEAR tab's bottom action sheet.
// Follows the docs/SHELL-MODULES.md contract: no window or document
// globals, only host.ownerDocument plus deps. This plan (01) adds the pure
// copy and view model; Plan 02 adds the renderer to this same file. The
// combat lock's own reason text is never quoted here — it is read at call
// time from src/browser/narrationLines.js's own gearRefused line, referred
// to below only as "the Phase 61 gearRefused line".
//
// gearSheetModel(state, target) is the ONE pure view model behind every
// equip/swap/unequip/use/drop decision the sheet shows, for either a WORN
// slot or a BAG card target. It reads gearWornModel/gearBagCardsModel
// (./gearTab.js) for the WORN rows and BAG cards — never re-derives them —
// lootCompare/armorDisplay (./viewModels.js) for legality/upgrade text, and
// gearLockReason (../../engine/items.js) for the combat lock. Pure,
// null-safe, never mutates state.
//
// Phase 71 (POLISH-06, D-04): the sheet also shows the item's full stat
// list (`stats`), read from viewModels.js#itemStatLines — the ONE formatter
// the store rows read too — through wornItemFor for a worn slot. The note
// never repeats a stat the list already shows (R-06).
//
// RULES-13 (Phase 75): a wielded/bagged magic staff needs NO branch of its
// own here — gearWornModel's weapon row already reports a wielded staff as
// filled with its own use cell, and gearBagCardsModel already gives a
// Magic User's bagged staff family: "weapon" (never a USE cell). Both flow
// through this file's existing WORN "SWAP FOR" / BAG "EQUIP TO / SWAP INTO
// WEAPON" branches untouched — equipRun already omits `slot` for the
// weapon family, so a staff equip/swap dispatches exactly like an ordinary
// weapon's. lootCompare(c, it) for a staff card (viewModels.js) is the
// Magic User gate only, never a need/crit/weight comparison.

import { WORN_FAMILY_OF, WORN_KEYS_OF } from "../../engine/derived.js";
import { gearLockReason } from "../../engine/items.js";
import { GEAR_COPY, GEAR_WORN_ORDER, gearWornModel, gearBagCardsModel } from "./gearTab.js";
import { lootCompare, armorDisplay, itemStatLines, wornItemFor } from "./viewModels.js";
import { LINE_FOR } from "./narrationLines.js";

/**
 * GEAR_SHEET_COPY — every new player-facing string the sheet shows, frozen
 * (every nested group frozen too) so the voice scan and the hp-not-wp guard
 * can walk it as one leaf group, mirroring GEAR_COPY's own shape.
 */
export const GEAR_SHEET_COPY = Object.freeze({
  head: Object.freeze({
    worn: "WORN",
    empty: "EMPTY",
    bag: "BAG",
    fromBag: "USED FROM THE BAG",
    sep: " · ",
    nothingWorn: "NOTHING WORN",
  }),
  act: Object.freeze({
    use: "USE",
    unequip: "UNEQUIP",
    discard: "DISCARD",
    swapFor: "SWAP FOR {name}",
    equip: "EQUIP {name}",
    equipTo: "EQUIP TO {slot}",
    swapInto: "SWAP INTO {slot}",
    drop: "DROP",
    dropConfirm: "DROP IT? · tap again",
    nothing: "NOTHING TO EQUIP",
  }),
  sub: Object.freeze({
    unequip: "Moves to the bag and takes a slot.",
    bagFull: "Bag is full — free a slot first.",
    discard: "It is scrap now. Off it comes, and nothing goes in the bag.",
    fills: "Fills the slot and frees a bag slot.",
    comesOff: "{name} comes off and goes to the bag.",
    scrap: "{name} is scrap. It stays behind.",
    // RULES-08 (Phase 75, 75-CONTEXT's wording): the WORN-slot SWAP FOR
    // warning when the worn armor being replaced is destroyed — prefixes the
    // candidate's own comparison line (GSCR-07's sub) rather than replacing
    // it, so the player still sees what the swap is worth.
    discarded: "Your worn armor is destroyed — it will be discarded.",
    drop: "Gone for good. Frees a slot immediately.",
    nothing: "Nothing in the bag fits this slot. Find something, or live without.",
  }),
  use: Object.freeze({
    ready: "Ready when you are.",
    consumable: "One use. Then it is a memory.",
    effect: "Already running — {n} squares left.",
    effectOne: "Already running — 1 square left.",
    cooldown: "Cooling down — {n} more squares.",
    cooldownOne: "Cooling down — 1 more square.",
    charges: "Charges {state}.",
  }),
  cancel: "CANCEL",
});

/**
 * gearSheetModel(state, target) — the sheet's header and ordered actions for
 * a WORN slot (`{ from: "worn", slot }`) or a BAG card
 * (`{ from: "bag", i, n }`). Returns `null` for any malformed or
 * unresolvable target (an unknown worn slot, a bag index with no card or a
 * name mismatch, a bag-free item, a state with no `c`). Every action is
 * `{ key, label, sub, reason, enabled, run, confirm }` — `reason` is `""`
 * when enabled, and equal to `sub` when greyed; `confirm` is true only for
 * DROP. Phase 71 (D-04): an additive `stats` — the item's stat texts from
 * viewModels.js#itemStatLines (a worn slot through wornItemFor), `[]` when
 * the slot is empty. Pure, never mutates `state`.
 */
export function gearSheetModel(state, target) {
  if (!target || typeof target !== "object") return null;
  const c = state && state.c;
  if (!c || typeof c !== "object") return null;

  const lock = gearLockReason(state);
  const lockLine = (verb) => (lock ? LINE_FOR.gearRefused({ type: "gearRefused", verb, reason: lock }).text : "");
  const cards = gearBagCardsModel(state);
  const wornRows = gearWornModel(state).rows;
  const rowByKey = {};
  for (const row of wornRows) rowByKey[row.key] = row;
  const armorD = armorDisplay(c);

  // equipRun(i, key) — the exact engine equipItem action. The engine's
  // validator rejects a `slot` key on a weapon or armor equip, so `slot` is
  // only added for cloak/jewelry1/jewelry2.
  const equipRun = (i, key) => {
    const run = { type: "equipItem", i };
    if (key === "cloak" || key === "jewelry1" || key === "jewelry2") run.slot = key;
    return run;
  };

  // useAction(cell, run) — the sheet's USE row, its sub picked by
  // gearUseCell's own phase. Never greyed (Phase 31's never-disable-silently
  // ruling and GRULE-02 both agree USE stays live).
  const useAction = (cell, run) => {
    let sub;
    if (cell.phase === "ready") sub = GEAR_SHEET_COPY.use.ready;
    else if (cell.phase === "consumable") sub = GEAR_SHEET_COPY.use.consumable;
    else if (cell.phase === "effect") {
      sub = cell.remaining === 1 ? GEAR_SHEET_COPY.use.effectOne : GEAR_SHEET_COPY.use.effect.replace("{n}", cell.remaining);
    } else if (cell.phase === "cooldown") {
      sub = cell.remaining === 1 ? GEAR_SHEET_COPY.use.cooldownOne : GEAR_SHEET_COPY.use.cooldown.replace("{n}", cell.remaining);
    } else if (cell.phase === "charges") {
      sub = GEAR_SHEET_COPY.use.charges.replace("{state}", cell.sub);
    } else {
      sub = "";
    }
    return { key: "use", label: GEAR_SHEET_COPY.act.use, sub, reason: "", enabled: true, run, confirm: false };
  };

  // candidate(card, slotKey, kind) — one SWAP FOR (kind "swap") or EQUIP
  // (kind "equip") action for a WORN-slot sheet, built from a fitting bag
  // card. Legality (and the illegal reason) comes only from lootCompare for
  // a weapon/armor card — jewelry and cloaks carry no class/race/weight
  // restriction, so `cmp` is never consulted for them.
  const candidate = (card, slotKey, kind) => {
    const it = c.items[card.i];
    const isGear = card.family === "weapon" || card.family === "armor";
    const cmp = isGear ? lootCompare(c, it) : null;
    const reason = lockLine("equipItem") || (cmp && !cmp.legal ? cmp.line : "");
    const enabled = !reason;
    const sub = enabled ? (cmp ? cmp.line : card.desc) : reason;
    const template = kind === "swap" ? GEAR_SHEET_COPY.act.swapFor : GEAR_SHEET_COPY.act.equip;
    return {
      key: `${kind}:${card.i}`,
      label: template.replace("{name}", card.name),
      sub,
      reason,
      enabled,
      run: equipRun(card.i, slotKey),
      confirm: false,
    };
  };

  // ─── WORN target ─────────────────────────────────────────────────────
  if (target.from === "worn" && GEAR_WORN_ORDER.includes(target.slot)) {
    const slot = target.slot;
    const row = rowByKey[slot];
    if (!row) return null;

    const family = slot === "weapon" || slot === "armor" ? slot : WORN_FAMILY_OF[slot];
    const fits = cards.filter((card) => card.family === family);
    // The Cloak of Armor's magic plate reads as an empty ARMOR slot: `real`
    // (not `row.filled`) decides the header's WORN/EMPTY word and the
    // filled/empty action branch below.
    const real = slot === "armor" ? armorD.worn : row.filled;

    const label = `${GEAR_COPY.slot[slot]}${GEAR_SHEET_COPY.head.sep}${real ? GEAR_SHEET_COPY.head.worn : GEAR_SHEET_COPY.head.empty}`;
    const title = real || row.filled ? row.name : GEAR_SHEET_COPY.head.nothingWorn;
    // Phase 71 (D-04): the worn piece's stats, from the one formatter.
    const stats = itemStatLines(wornItemFor(c, slot), c).map((l) => l.text);
    // Phase 71 (R-06): the note never repeats a stat. The weapon note is a
    // voice line, not a stat, so it stays. Worn armour's note IS its
    // durability, and a worn cloak/jewel's note IS its effect text — both
    // now in `stats`, so the note empties; under the Cloak of Armor the note
    // names the plate that actually counts (armorDisplay's own `sub`)
    // instead. An empty slot (no stats) keeps its in-voice empty line.
    let note = row.note;
    if (stats.length && slot !== "weapon") note = slot === "armor" && armorD.magic ? armorD.sub : "";
    const why = "";

    const actions = [];
    if (real) {
      if (row.use) actions.push(useAction(row.use, { type: "useItem", slot }));

      if (slot === "armor" && armorD.destroyed) {
        const reason = lockLine("unequipSlot");
        const enabled = !reason;
        actions.push({
          key: "discard",
          label: GEAR_SHEET_COPY.act.discard,
          sub: enabled ? GEAR_SHEET_COPY.sub.discard : reason,
          reason,
          enabled,
          run: { type: "unequipSlot", slot },
          confirm: false,
        });
      } else {
        const reason = lockLine("unequipSlot") || (row.unequip && row.unequip.blocked ? GEAR_SHEET_COPY.sub.bagFull : "");
        const enabled = !reason;
        actions.push({
          key: "unequip",
          label: GEAR_SHEET_COPY.act.unequip,
          sub: enabled ? GEAR_SHEET_COPY.sub.unequip : reason,
          reason,
          enabled,
          run: { type: "unequipSlot", slot },
          confirm: false,
        });
      }

      for (const card of fits) {
        const cand = candidate(card, slot, "swap");
        // RULES-08 (Phase 75): a destroyed worn armor piece is about to be
        // discarded, not stowed — warn on every ENABLED SWAP FOR candidate
        // (a greyed one keeps its own refusal reason instead).
        if (slot === "armor" && armorD.destroyed && cand.enabled) {
          cand.sub = `${GEAR_SHEET_COPY.sub.discarded} ${cand.sub}`;
        }
        actions.push(cand);
      }
    } else {
      for (const card of fits) actions.push(candidate(card, slot, "equip"));
      if (!fits.length) {
        actions.push({
          key: "nothing",
          label: GEAR_SHEET_COPY.act.nothing,
          sub: GEAR_SHEET_COPY.sub.nothing,
          reason: GEAR_SHEET_COPY.sub.nothing,
          enabled: false,
          run: null,
          confirm: false,
        });
      }
    }

    return { target, label, title, note, why, actions, stats };
  }

  // ─── BAG target ──────────────────────────────────────────────────────
  if (target.from === "bag") {
    const card = cards.find((k) => k.i === target.i);
    if (!card || card.name !== target.n) return null;

    const it = c.items[card.i];
    const isGear = card.family === "weapon" || card.family === "armor";
    const cmp = isGear ? lootCompare(c, it) : null;

    const label = `${GEAR_SHEET_COPY.head.bag}${GEAR_SHEET_COPY.head.sep}${card.family ? GEAR_COPY.family[card.family] : GEAR_SHEET_COPY.head.fromBag}`;
    const title = card.name;
    // Phase 71 (D-04): the bag item's stats, from the one formatter.
    const stats = itemStatLines(it, c).map((l) => l.text);
    // Phase 71 (R-06): the card desc is the item's txt (bagArmorText for
    // armour) plus its usable-by — exactly what `stats` now carries — so the
    // note is dropped whenever the stats cover it, and kept only for an item
    // the formatter has nothing to say about. The Gear tab CARD is unchanged.
    const note = stats.length ? "" : card.desc;
    const why = cmp && cmp.legal ? cmp.line : "";

    const actions = [];
    if (card.use) actions.push(useAction(card.use, { type: "useItem", i: card.i }));

    if (card.family) {
      const keys = card.family === "weapon" || card.family === "armor" ? [card.family] : WORN_KEYS_OF[card.family] || [];
      for (const key of keys) {
        const occupied = key === "armor" ? armorD.worn : !!(rowByKey[key] && rowByKey[key].filled);
        const reason = lockLine("equipItem") || (cmp && !cmp.legal ? cmp.line : "");
        const enabled = !reason;
        const label2 = (occupied ? GEAR_SHEET_COPY.act.swapInto : GEAR_SHEET_COPY.act.equipTo).replace("{slot}", GEAR_COPY.slot[key]);
        let sub;
        if (!enabled) {
          sub = reason;
        } else if (occupied) {
          const name = rowByKey[key] ? rowByKey[key].name : "";
          sub = (key === "armor" && armorD.destroyed ? GEAR_SHEET_COPY.sub.scrap : GEAR_SHEET_COPY.sub.comesOff).replace("{name}", name);
        } else {
          sub = GEAR_SHEET_COPY.sub.fills;
        }
        actions.push({
          key: `slot:${key}`,
          label: label2,
          sub,
          reason,
          enabled,
          run: equipRun(card.i, key),
          confirm: false,
        });
      }
    }

    actions.push({
      key: "drop",
      label: GEAR_SHEET_COPY.act.drop,
      sub: GEAR_SHEET_COPY.sub.drop,
      reason: "",
      enabled: true,
      run: { type: "dropItem", i: card.i },
      confirm: true,
    });

    return { target, label, title, note, why, actions, stats };
  }

  return null;
}

/**
 * GEAR_SHEET_IDS — the DOM roots of `#mw-gear-sheet`. Six are declared by
 * Plan 04's markup (label, title, note, why, actions, cancel). The seventh,
 * `stats` (Phase 71, D-04), is created by renderGearSheet itself on its
 * first render — inserted after the note and before the why line inside
 * `.mw-gsheet-head` — and reused afterwards (R-05: 71-02 makes no
 * mazeworld.html edit). renderGearSheet only ever reads/writes through these
 * ids (via `doc.getElementById`, never `host.querySelector`), mirroring
 * gearTab.js's own head()/el() id-driven style.
 */
export const GEAR_SHEET_IDS = Object.freeze({
  label: "mw-gear-sheet-label",
  title: "mw-gear-sheet-title",
  note: "mw-gear-sheet-note",
  stats: "mw-gear-sheet-stats",
  why: "mw-gear-sheet-why",
  actions: "mw-gear-sheet-actions",
  cancel: "mw-gear-sheet-cancel",
});

// ensureStatsEl(doc, whyEl) — Phase 71 (D-04, R-05): the stats container,
// created on the first render (a real document has no such id until then)
// and inserted before the why line through its parent, so it sits between
// the note and the why line. Reused on every later render — never a second
// container. Each stat row reuses the note's own typography class
// (`mw-gsheet-note`, already scaled by --mw-text-scale) and wraps like it,
// so the rows reflow at text size L inside the already-scrolling sheet.
function ensureStatsEl(doc, whyEl) {
  let el = doc.getElementById(GEAR_SHEET_IDS.stats);
  if (!el) {
    el = doc.createElement("div");
    el.id = GEAR_SHEET_IDS.stats;
  }
  if (!el.parentNode && whyEl && whyEl.parentNode) whyEl.parentNode.insertBefore(el, whyEl);
  el.className = "mw-gsheet-stats";
  return el;
}

// Phase 63 (GSCR-10) — the sheet's own DROP tap-again confirm. Mirrors
// gearTab.js's DROP_CONFIRM_MS/dropConfirmRevert/revertDropConfirm pattern
// exactly, under distinct names so gearTab.test.js's once-each pins on the
// gearTab names never see a second declaration. DOM-local presentation
// state, never on `state` (serializeRun spreads state, not this module's
// locals); exactly one button can be armed at a time. A fresh render
// always calls revertSheetDrop() first, so no prior armed DROP survives a
// re-render.
export const SHEET_DROP_CONFIRM_MS = 3000;
let sheetDropRevert = null;
function revertSheetDrop() {
  if (!sheetDropRevert) return;
  const r = sheetDropRevert;
  sheetDropRevert = null;
  r();
}

// makeConfirmHandler(btn, labelSpan, a, deps) — DROP's tap-again confirm.
// The first tap arms in place (relabels the button to
// GEAR_SHEET_COPY.act.dropConfirm, marks dataset.armed and starts the
// SHEET_DROP_CONFIRM_MS revert) and dispatches nothing. The second tap
// (while armed) reverts, closes the sheet, THEN dispatches — matching
// every other enabled action's close-before-dispatch order (GSCR-09).
function makeConfirmHandler(btn, labelSpan, a, deps) {
  return () => {
    if (btn.dataset.armed === "1") {
      revertSheetDrop();
      deps.closeGearSheet?.();
      dispatchRun(a.run, deps);
      return;
    }
    revertSheetDrop();
    const originalLabel = a.label;
    labelSpan.textContent = GEAR_SHEET_COPY.act.dropConfirm;
    btn.setAttribute("aria-label", GEAR_SHEET_COPY.act.dropConfirm);
    btn.dataset.armed = "1";
    const timer = setTimeout(revertSheetDrop, SHEET_DROP_CONFIRM_MS);
    sheetDropRevert = () => {
      clearTimeout(timer);
      labelSpan.textContent = originalLabel;
      btn.setAttribute("aria-label", originalLabel);
      delete btn.dataset.armed;
    };
  };
}

// dispatchRun(run, deps) — the ONE place a model action's `run` becomes an
// existing tabDeps() bridge call. Mirrors gearSheetModel's own equipRun
// shape exactly: a weapon/armor equipItem run carries only `i`; a cloak/
// jewelry equipItem run also carries `slot`. Never passes an explicit
// `undefined` second argument.
function dispatchRun(run, deps) {
  if (!run) return;
  if (run.type === "equipItem") {
    if (run.slot) deps.equipItem?.(run.i, run.slot);
    else deps.equipItem?.(run.i);
  } else if (run.type === "unequipSlot") {
    deps.unequip?.(run.slot);
  } else if (run.type === "useItem") {
    deps.useItem?.(run.slot ? { slot: run.slot } : run.i);
  } else if (run.type === "dropItem") {
    deps.dropItem?.(run.i);
  }
}

// buildActionButton(doc, a, index, deps) — one `<button class="mw-gsheet-act">`
// per gearSheetModel action, built via createElement/textContent/setAttribute/
// dataset only (T-63-03: no HTML-string sink anywhere in this file). A
// greyed action (`!a.enabled`) carries `data-off`/`aria-disabled` and NO
// click handler at all — tapping it does nothing, never a hidden live
// button (GSCR-09). An enabled action is wired through `deps.guardTap`
// (Phase 32's ghost-tap guard), falling back to a plain onclick only when
// no guardTap dep is supplied. A confirm action (`a.confirm`, DROP only)
// routes through makeConfirmHandler instead of the plain close-then-
// dispatch handler.
function buildActionButton(doc, a, index, deps) {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "mw-gsheet-act";
  btn.dataset.key = a.key;
  btn.setAttribute("aria-label", a.label);

  const main = doc.createElement("span");
  main.className = "mw-gsheet-act-main";
  const labelSpan = doc.createElement("span");
  labelSpan.className = "mw-gsheet-act-label";
  labelSpan.textContent = a.label;
  const subSpan = doc.createElement("span");
  subSpan.className = "mw-gsheet-act-sub";
  subSpan.id = "mw-gear-sheet-sub-" + index;
  subSpan.textContent = a.sub;
  main.appendChild(labelSpan);
  main.appendChild(subSpan);
  btn.appendChild(main);

  const chev = doc.createElement("span");
  chev.className = "mw-gsheet-chev";
  chev.textContent = GEAR_COPY.chevron;
  chev.setAttribute("aria-hidden", "true");
  btn.appendChild(chev);

  btn.setAttribute("aria-describedby", subSpan.id);

  if (!a.enabled) {
    btn.dataset.off = "1";
    btn.setAttribute("aria-disabled", "true");
    return btn;
  }

  const handler = a.confirm
    ? makeConfirmHandler(btn, labelSpan, a, deps)
    : () => {
        deps.closeGearSheet?.();
        dispatchRun(a.run, deps);
      };
  if (deps.guardTap) deps.guardTap(btn, handler);
  else btn.onclick = handler;

  return btn;
}

/**
 * renderGearSheet(host, state, target, deps) — Plan 02 (GSCR-07..10,
 * GRULE-02): turns `gearSheetModel(state, target)` into the sheet body.
 * Fills GEAR_SHEET_IDS's roots from the model alone (Phase 71: seven,
 * the stats container created here on first render); the renderer
 * holds no rule of its own. Returns `false` and touches nothing when the
 * model resolves to null (a vanished target — the shell then closes the
 * sheet). No window/document global; reaches the page only through
 * `host.ownerDocument`.
 */
export function renderGearSheet(host, state, target, deps = {}) {
  const doc = host.ownerDocument;
  revertSheetDrop();

  const m = gearSheetModel(state, target);
  if (!m) return false;

  doc.getElementById(GEAR_SHEET_IDS.label).textContent = m.label;
  doc.getElementById(GEAR_SHEET_IDS.title).textContent = m.title;
  const noteEl = doc.getElementById(GEAR_SHEET_IDS.note);
  noteEl.textContent = m.note;
  // Phase 71 (R-06): an emptied note (its content now in the stats) hides.
  noteEl.hidden = !m.note;
  const whyEl = doc.getElementById(GEAR_SHEET_IDS.why);
  whyEl.textContent = m.why;
  whyEl.hidden = !m.why;

  // Phase 71 (D-04): one row per stat, textContent only; a re-render
  // replaces the rows, and an empty list hides the container.
  const statsEl = ensureStatsEl(doc, whyEl);
  statsEl.replaceChildren(
    ...m.stats.map((text) => {
      const row = doc.createElement("p");
      row.className = "mw-gsheet-note mw-gsheet-stat";
      row.textContent = text;
      return row;
    })
  );
  statsEl.hidden = !m.stats.length;

  doc.getElementById(GEAR_SHEET_IDS.actions).replaceChildren(
    ...m.actions.map((a, index) => buildActionButton(doc, a, index, deps))
  );

  const cancelBtn = doc.getElementById(GEAR_SHEET_IDS.cancel);
  cancelBtn.textContent = GEAR_SHEET_COPY.cancel;
  const cancelHandler = () => deps.closeGearSheet?.();
  if (deps.guardTap) deps.guardTap(cancelBtn, cancelHandler);
  else cancelBtn.onclick = cancelHandler;

  return true;
}
