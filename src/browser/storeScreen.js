// src/browser/storeScreen.js
//
// Phase 47 (SHELL-03), Plan 05 — the STORE screen: the whole S.store branch
// of the encounter overlay — header, stock shelf (repair-row math,
// usable-by suffixes), the "Your gear" sell list (via gearTab.js's shared
// renderCarriedList), Leave. Contract: renderStoreScreen(host, state, deps);
// host is #enc-body, already cleared by the shell's renderEncounter() frame.
// No window/document globals: host.ownerDocument + deps only.
//
// Moved verbatim from the classic script's renderEncounter() S.store branch,
// with window/document globals replaced by host.ownerDocument + deps, and the
// retired window.__mz* bridges (armorDisplay/bagUsage/usableBy/
// renderCarriedList) replaced by direct imports.
//
// Phase 61 (STORE-02/03): each stock row's disabled/reason/advice state
// comes from src/browser/viewModels.js#storeRowState — built on the
// engine's own storeBuyRefusal, so a row can never disagree with what
// tapping BUY would actually do. The reason shown on a row is ROW STATE,
// never a post-tap refusal message; the rail stays the one feedback
// surface for everything else.
//
// Phase 71 (POLISH-06, D-04): an item line's stats come from the ONE
// formatter, viewModels.js#itemStatLines — the same list the Gear tab's
// action sheet shows for that item — via storeItemStats below. Lines with
// no item (food, rations, the sealed scroll, repair) keep their engine
// `sub` byte-for-byte (R-07); the engine's stock `sub` strings themselves
// are never edited (the economy parity harness compares them).
//
// Phase 87 (STORE-04): the Rations row also carries its stock count ("N left",
// viewModels.js#storeCountText, read from the engine's own rationsLeft) in its
// italic sub, and the pack-cap refusal reason rides the same row via
// storeRowState; a spent row greys and reads "sold" like any sold row.

import { armorDisplay, usableBy, storeRowState, itemStatLines } from "./viewModels.js";
import { storeCountText } from "./viewModels.js";
import { bagUsage, renderCarriedList } from "./gearTab.js";
import { flavorOfItem, flavorOfScroll } from "./flavorText.js";
import { wrapRow } from "./rulesLayer.js";
import { GEAR_COPY } from "./gearTab.js";
import { scrollReadOdds } from "./rollOdds.js";

// Phase 33 (STORE-01, CONTEXT Area 3 "Feedback") — the store header's one-line
// nod to the depth roll; shown ONLY on a run whose S.storeRoll is true
// (engine/state.js — a run this build started), so an old save's header is
// byte-identical to today; no rail line, no Oracle line (the store is a screen,
// not an event). Player-facing: kept clear of content/safety-wordlist.js
// (scanned by test/unit/shell-map-store-polish.test.js).
export const STORE_ROLL_COPY = "Stock rolled fresh for this floor. Deeper down, pricier regrets.";

/**
 * storeItemStats(line, c, showUsable = true) — Phase 71 (POLISH-06, D-04):
 * the stat texts a stock row shows for the item it sells, read from the ONE
 * formatter (`itemStatLines`) the Gear sheet also reads, so the two lists
 * are identical for the same item. `showUsable` is storeRowState's own gate:
 * when false (an illegal item whose row already names who via its can't-use
 * reason) the usable-by entry is filtered out rather than repeated. Returns
 * `null` for a line that wraps no item (food, rations, scroll, repair) or
 * whose item the formatter has nothing to say about — the row then keeps
 * the engine's own `sub`. Pure.
 */
export function storeItemStats(line, c, showUsable = true) {
  const item = line && line.effectParams && line.effectParams.item;
  if (!item) return null;
  const stats = itemStatLines(item, c)
    .filter((l) => showUsable || l.key !== "usable")
    .map((l) => l.text);
  return stats.length ? stats : null;
}

/**
 * storeRowLayer(line, c, state, showUsable, oldSub) — Phase 95 (FLAVOR-01/02/05;
 * CONTEXT 'Where the exact numbers live'; orchestrator: usable-by, count,
 * compare and reason stay visible): the store row's flavour lead and its
 * rules. The rules are exactly the italic stat text the row printed before
 * (`oldSub`); the Sealed scroll had no text at all, so its rules are the
 * scroll's rules as the Gear SCROLLS row states them (Claude's discretion,
 * named in 95-07). The lead is the flavour, then the "(usable by …)" tag when
 * the row still shows one. Returns null for a line with no flavour (food,
 * rations, repairs, an unknown item), which then renders as before. Pure.
 */
export function storeRowLayer(line, c, state, showUsable, oldSub) {
  if (!line) return null;
  if (line.effectId === "buyScroll") {
    const lead = flavorOfScroll();
    if (!lead) return null;
    return { lead, rules: `${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}` };
  }
  const item = line.effectParams && line.effectParams.item;
  if (!item) return null;
  const flavor = flavorOfItem(item);
  if (!flavor) return null;
  const tag = showUsable ? usableBy(item, c) : "";
  return { lead: tag ? `${flavor} ${tag}` : flavor, rules: oldSub || "" };
}

/**
 * renderStoreScreen(host, state, deps) — Phase 47 (SHELL-03), Plan 05: the
 * ONE mount function for the Store screen (the encounter overlay's `S.store`
 * branch) — the header/purse line, the stock shelf (repair-row math,
 * usable-by suffixes), the "Your gear" sell list (via gearTab.js's shared
 * renderCarriedList), and the Leave button. Moved verbatim from the classic
 * script's renderEncounter() with `host.ownerDocument` replacing `document`,
 * `state`/`state.c` replacing the classic S/c, and direct imports replacing
 * the retired window.__mz* bridges (armorDisplay/bagUsage/usableBy/
 * renderCarriedList). No window/document globals — host, host.ownerDocument
 * and deps only.
 */
export function renderStoreScreen(host, state, deps = {}) {
  const doc = host.ownerDocument;
  const st = state.store;
  const c = state.c;
  // Phase 29 (LOOT-04): the store's drop-to-make-room option; a refused
  // lockpick buy costs nothing (engine gate, Plan 01) and its bagFull
  // rail line names have/slots.
  const usage = bagUsage(c);
  // Phase 33 (STORE-01) — the roll line is gated on the run flag, never on
  // stock contents, so an old save (flag off, fixed stock) shows exactly
  // the pre-Phase-33 header.
  host.innerHTML += `<p class="enc-head" style="color:var(--moss)">A store</p>
      <p class="enc-sub">${c.gold.toLocaleString()} wilmst in your purse</p>
      ${state.storeRoll === true ? `<p class="enc-sub mw-store-roll">${STORE_ROLL_COPY}</p>` : ""}
      <div class="shelf" id="shelf"></div>
      ${usage.full ? `<p class="enc-sub" style="color:var(--rust)">Bag full (${usage.have}/${usage.slots}) — sell or drop something to make room. Potions and scrolls still ride free.</p>` : ""}
      <p class="enc-sub" id="sell-head" style="margin-top:12px">Your gear</p>
      <ul class="skills" id="sell-list"></ul>
      <div class="actions"><button class="primary" id="a-leave">Leave</button></div>`;
  const shelf = doc.getElementById("shelf");
  // Phase 28 (ARMOR-02): the repair line is relabelled in the SHELL only —
  // engine/economy.js's stock `sub` string is compared by the economy
  // parity harness and stays untouched. Repairs key off the worn piece
  // even under a cloak (wornSub, not sub).
  const ad = armorDisplay(c);
  st.stock.forEach((item, i) => {
    const row = doc.createElement("button");
    row.className = "goods" + (item.sold ? " sold" : "");
    // Phase 61 (STORE-02/03): the row's own buyability/reason/advice come
    // from the ONE view model, storeRowState — built on the engine's own
    // storeBuyRefusal (the same predicate buyFrom settles with), so this
    // row can never disagree with what tapping BUY would actually do. The
    // reason is row state, shown on the row itself, never a post-tap
    // message (the rail stays the one feedback surface for everything
    // else).
    const rs = storeRowState(c, item);
    row.disabled = rs.disabled;
    // Phase 71 (D-04): an item line's stats come from the ONE formatter
    // (usable-by included, as one of its entries, gated on rs.showUsable).
    // Every stat string is display text built from engine/content item data
    // — the same trust as the item.n/item.sub this template already
    // interpolates — so nothing new is escaped here (T-71-03).
    const stats = item.effectId === "repairArmor" ? null : storeItemStats(item, c, rs.showUsable);
    // Phase 89 plan 08 (ITEM-06, Q4): a Joiner's repair line (`member` param)
    // reads THAT Joiner's armour and points, never the hero's.
    const repairSheet = item.effectId === "repairArmor" && item.effectParams && Number.isInteger(item.effectParams.member) ? (state.party || [])[item.effectParams.member] : null;
    const itemSub = item.effectId === "repairArmor"
      ? repairSheet
        ? `${repairSheet.armor} · ${Math.max(0, Number(repairSheet.armorMax) - Number(repairSheet.armorWP))} hp to mend at a tenth of its cost each`
        : `${ad.wornSub} · ${c.armorMax - c.armorWP} hp to mend at a tenth of its cost each`
      : stats ? stats.join(" · ") : item.sub;
    // Phase 95 (FLAVOR-01/02/05): a flavoured row leads with its flavour; the exact old italic text rides behind a RULES toggle.
    const layer = storeRowLayer(item, c, state, rs.showUsable, itemSub);
    const sub = layer ? layer.lead : itemSub;
    // Phase 43 (CLAR-02): usable is a static USABLE_COPY string (class
    // names only, never user/item text) — safe inside innerHTML. Phase 61
    // (STORE-02/03): also gated on rs.showUsable — an illegal item's row
    // already names who via rs.reasonText, so the "(usable by … — not
    // you)" suffix would only repeat it. Phase 71 (D-04): only a fallback
    // now — a formatter-rendered row already carries usable-by in `stats`.
    const usable = !stats && rs.showUsable && item.effectParams && item.effectParams.item ? usableBy(item.effectParams.item, c) : "";
    // Phase 61 (STORE-02/03): the italic sub composes, in order, the
    // item's own stats (Phase 71: from the formatter), the advice compare
    // line (never disables BUY), then the row's disable reason (can't-use /
    // bag-full — a gold shortfall is already named by the price column, so
    // it adds nothing here).
    const subText = [sub, storeCountText(item), rs.compareLine, rs.reasonText].filter(Boolean).join(" · ");
    row.innerHTML = `<span class="g-n">${item.n}${subText || usable ? `<i>${subText || ""}${subText && usable ? " " : ""}${usable}</i>` : ""}</span>
        <span class="g-c">${item.sold ? "sold" : item.cost.toLocaleString() + " wm"}</span>`;
    row.onclick = () => deps.buyItem?.(i);
    // Phase 95: the RULES toggle is a sibling of the BUY button, never inside it (orchestrator); a row with no flavour is appended exactly as before.
    shelf.appendChild(layer && layer.rules ? wrapRow(doc, row, { id: "store:" + i + ":" + item.n, name: item.n, rules: layer.rules }) : row);
  });
  // Phase 14 (ECON-06): the "Your gear" SELL section — every carried item with
  // a Sell button (deps.sellItem, forwarding to window.mzSellItem), rendered
  // by the SAME shared component the GEAR tab and the combat use-list use.
  // Selling frees a slot and credits gold; the bridge re-renders the store
  // after. Phase 29 (LOOT-04): when the bag is full, each row also gets a
  // Drop button so the player can make room without selling.
  const sellHead = doc.getElementById("sell-head");
  if ((c.items || []).length) {
    renderCarriedList(doc.getElementById("sell-list"), state, c.items, { actions: usage.full ? ["sell", "drop"] : ["sell"] }, deps);
  } else {
    // Nothing to sell — drop the heading so the empty <ul> isn't a bare label.
    if (sellHead) sellHead.style.display = "none";
  }
  doc.getElementById("a-leave").onclick = () => deps.leaveStore?.();
}
