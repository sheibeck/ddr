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

import { armorDisplay, usableBy } from "./viewModels.js";
import { bagUsage, renderCarriedList } from "./gearTab.js";

// Phase 33 (STORE-01, CONTEXT Area 3 "Feedback") — the store header's one-line
// nod to the depth roll; shown ONLY on a run whose S.storeRoll is true
// (engine/state.js — a run this build started), so an old save's header is
// byte-identical to today; no rail line, no Oracle line (the store is a screen,
// not an event). Player-facing: kept clear of content/safety-wordlist.js
// (scanned by test/unit/shell-map-store-polish.test.js).
export const STORE_ROLL_COPY = "Stock rolled fresh for this floor. Deeper down, pricier regrets.";

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
      <p class="enc-sub">${c.gold.toLocaleString()} wilmst in your purse${st.markup > 1 ? " · triple for armour, double for arms" : ""}</p>
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
    row.disabled = !!item.sold || c.gold < item.cost;
    const sub = item.effectId === "repairArmor" ? `${ad.wornSub} · ${c.armorMax - c.armorWP} hp to mend at a tenth of its cost each` : item.sub;
    // Phase 43 (CLAR-02): usable is a static USABLE_COPY string (class
    // names only, never user/item text) — safe inside innerHTML.
    const usable = item.effectParams && item.effectParams.item ? usableBy(item.effectParams.item, c) : "";
    row.innerHTML = `<span class="g-n">${item.n}${sub || usable ? `<i>${sub || ""}${sub && usable ? " " : ""}${usable}</i>` : ""}</span>
        <span class="g-c">${item.sold ? "sold" : item.cost.toLocaleString() + " wm"}</span>`;
    row.onclick = () => deps.buyItem?.(i);
    shelf.appendChild(row);
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
