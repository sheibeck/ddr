// src/browser/leaderboardPanel.js
//
// Phase 84 (BOARD-18..25), Plan 06 — the Leaderboards panel v3's DOM
// renderer: draws design/Mazeworld Boards Panel v3.dc.html. A pure function
// (no state, no copy of its own) that 84-07's controller calls on every
// change. Reaches the page only through host.ownerDocument and builds DOM
// only with createElement/textContent/dataset/style/hidden/onclick/
// appendChild/replaceChildren — never an HTML-string assignment — because
// board rows carry other players' handles, names, notes and epitaphs
// (untrusted text; see the plan's threat model, T-84-09). CSS shapes draw
// the ▼ picker caret and the ◆ selected-option mark (CONTEXT area 4,
// "not text glyphs and not new PNGs"); mazeworld.html's .mw-lb-* CSS block
// (84-06 Task 2) is what actually paints them. The ◀ back button ships as a
// literal glyph, exactly as boardsPanel.js's own back button does today.
//
// Follows src/browser/boardsPanel.js's module-private el() builder and
// skeleton-reuse approach (ensureSkeleton replaces only section CHILDREN,
// never the sections themselves), so a row tap or picker change never
// resets the body's own scroll position.

/**
 * LEADERBOARD_CLASSES — every class name renderLeaderboardPanel emits, in
 * no particular order. 84-06 Task 2's CSS test walks this array to assert
 * each has a rule in mazeworld.html.
 */
export const LEADERBOARD_CLASSES = Object.freeze([
  "mw-lb",
  "mw-lb-head",
  "mw-lb-back",
  "mw-lb-headtext",
  "mw-lb-title",
  "mw-lb-scope",
  "mw-lb-season",
  "mw-lb-box",
  "mw-lb-box-n",
  "mw-lb-box-label",
  "mw-lb-pickers",
  "mw-lb-picker",
  "mw-lb-picker-label",
  "mw-lb-picker-row",
  "mw-lb-picker-val",
  "mw-lb-caret",
  "mw-lb-body",
  "mw-lb-stale",
  "mw-lb-empty",
  "mw-lb-empty-title",
  "mw-lb-empty-note",
  "mw-lb-clear",
  "mw-lb-note",
  "mw-lb-note-btn",
  "mw-lb-entry",
  "mw-lb-divider",
  "mw-lb-divider-dots",
  "mw-lb-divider-label",
  "mw-lb-row",
  "mw-lb-rank",
  "mw-lb-av",
  "mw-lb-main",
  "mw-lb-idline",
  "mw-lb-handle",
  "mw-lb-tag",
  "mw-lb-line",
  "mw-lb-detail",
  "mw-lb-detail-text",
  "mw-lb-stats",
  "mw-lb-stat",
  "mw-lb-stat-k",
  "mw-lb-stat-v",
  "mw-lb-date",
  "mw-lb-valcell",
  "mw-lb-val",
  "mw-lb-unit",
  "mw-lb-standing",
  "mw-lb-standing-note",
  "mw-lb-standing-place",
  "mw-lb-dock",
  "mw-lb-dock-btn",
  "mw-lb-sheet",
  "mw-lb-scrim",
  "mw-lb-sheet-panel",
  "mw-lb-sheet-head",
  "mw-lb-sheet-title",
  "mw-lb-sheet-done",
  "mw-lb-sheet-opts",
  "mw-lb-opt",
  "mw-lb-opt-mark",
  "mw-lb-opt-text",
  "mw-lb-opt-label",
  "mw-lb-opt-sub",
  "mw-lb-opt-n",
]);

// ─── small DOM builders (module-private; every function here only uses
// createElement/textContent/setAttribute/dataset/style/hidden/onclick/
// appendChild/replaceChildren — never an HTML-string assignment) ──────────

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (typeof text === "string") e.textContent = text;
  return e;
}

const SECTION_CLASSES = ["mw-lb-head", "mw-lb-pickers", "mw-lb-body", "mw-lb-dock", "mw-lb-sheet"];

/**
 * ensureSkeleton(host) — finds an existing `.mw-lb` root (a second render on
 * the same host reuses it, along with its five section children — the
 * body's scroll position survives a re-render this way) or creates one with
 * the five section children in order.
 */
function ensureSkeleton(host) {
  const doc = host.ownerDocument;
  let root = host.querySelector(".mw-lb");
  if (!root) {
    root = el(doc, "div", "mw-lb");
    for (const cls of SECTION_CLASSES) root.appendChild(el(doc, "div", cls));
    host.appendChild(root);
  }
  return {
    root,
    head: root.querySelector(".mw-lb-head"),
    pickers: root.querySelector(".mw-lb-pickers"),
    body: root.querySelector(".mw-lb-body"),
    dock: root.querySelector(".mw-lb-dock"),
    sheet: root.querySelector(".mw-lb-sheet"),
  };
}

function buildHead(doc, view, handlers) {
  const children = [];
  if (view.header.back) {
    const back = el(doc, "button", "mw-lb-back", "◀");
    back.type = "button";
    back.setAttribute("aria-label", view.header.backLabel);
    back.onclick = () => handlers.onBack?.();
    children.push(back);
  }

  const headtext = el(doc, "div", "mw-lb-headtext");
  headtext.appendChild(el(doc, "span", "mw-lb-title", view.header.title));
  headtext.appendChild(el(doc, "span", "mw-lb-scope", view.header.scopeLine));
  const season = el(doc, "span", "mw-lb-season", view.header.seasonLine);
  season.hidden = view.header.seasonLine === "";
  headtext.appendChild(season);
  children.push(headtext);

  const box = view.header.box;
  const boxEl = el(doc, box.action ? "button" : "div", "mw-lb-box");
  if (box.action) {
    boxEl.type = "button";
    boxEl.dataset.action = box.action;
    boxEl.onclick = () => handlers.onBox?.(box.action);
  } else {
    boxEl.dataset.static = "1";
  }
  boxEl.appendChild(el(doc, "span", "mw-lb-box-n", box.n));
  boxEl.appendChild(el(doc, "span", "mw-lb-box-label", box.label));
  children.push(boxEl);

  return children;
}

function buildPickers(doc, view, handlers, pickersEl) {
  const chips = view.pickers.map((p) => {
    const btn = el(doc, "button", "mw-lb-picker");
    btn.type = "button";
    btn.dataset.picker = p.id;
    btn.dataset.active = p.active ? "1" : "0";
    btn.onclick = () => handlers.onPicker?.(p.id);
    btn.appendChild(el(doc, "span", "mw-lb-picker-label", p.label));

    const row = el(doc, "div", "mw-lb-picker-row");
    const val = el(doc, "span", "mw-lb-picker-val", p.value);
    if (p.col) val.style.color = p.col;
    row.appendChild(val);
    const caret = el(doc, "span", "mw-lb-caret");
    caret.setAttribute("aria-hidden", "true");
    row.appendChild(caret);
    btn.appendChild(row);

    return btn;
  });
  pickersEl.replaceChildren(...chips);
}

function buildRow(doc, view, row, handlers) {
  const entry = el(doc, "div", "mw-lb-entry");

  if (row.divider) {
    const divider = el(doc, "div", "mw-lb-divider");
    divider.appendChild(el(doc, "span", "mw-lb-divider-dots", "···"));
    divider.appendChild(el(doc, "span", "mw-lb-divider-label", row.divider));
    entry.appendChild(divider);
  }

  const rowEl = el(doc, "div", "mw-lb-row");
  rowEl.dataset.key = row.key;
  rowEl.dataset.top = row.top ? "1" : "0";
  rowEl.dataset.podium = row.podium ? "1" : "0";
  rowEl.dataset.you = row.you ? "1" : "0";
  rowEl.dataset.open = row.open ? "1" : "0";
  rowEl.setAttribute("role", "button");
  rowEl.setAttribute("tabindex", "0");
  rowEl.setAttribute("aria-expanded", row.open ? "true" : "false");
  rowEl.onclick = () => handlers.onRow?.(row.key);
  // the mock's own top-row stripe — inline, since it's stat-colour-driven
  // and the row's dataset alone (data-top) is not enough for CSS to know
  // WHICH colour to paint.
  if (row.top) {
    rowEl.style.boxShadow = "inset 0 -1px 0 #241f16, inset 3px 0 0 " + view.col;
  }

  const rank = el(doc, "span", "mw-lb-rank", row.rank);
  if (row.top) rank.style.color = view.col;

  const av = el(doc, "div", "mw-lb-av", row.avatar.initials);
  av.dataset.on = row.avatar.on ? "1" : "0";
  av.style.background = row.avatar.bg;

  const main = el(doc, "div", "mw-lb-main");
  const idline = el(doc, "div", "mw-lb-idline");
  idline.appendChild(el(doc, "span", "mw-lb-handle", row.headline));
  if (row.tag) idline.appendChild(el(doc, "span", "mw-lb-tag", row.tag));
  main.appendChild(idline);
  main.appendChild(el(doc, "span", "mw-lb-line", row.line));

  if (row.open) {
    const detail = el(doc, "div", "mw-lb-detail");
    detail.appendChild(el(doc, "span", "mw-lb-detail-text", row.detail));
    const stats = el(doc, "div", "mw-lb-stats");
    for (const stat of row.stats) {
      const statEl = el(doc, "div", "mw-lb-stat");
      statEl.appendChild(el(doc, "span", "mw-lb-stat-k", stat.k));
      statEl.appendChild(el(doc, "span", "mw-lb-stat-v", stat.v));
      stats.appendChild(statEl);
    }
    detail.appendChild(stats);
    if (row.dateLine) detail.appendChild(el(doc, "span", "mw-lb-date", row.dateLine));
    main.appendChild(detail);
  }

  const valcell = el(doc, "div", "mw-lb-valcell");
  const val = el(doc, "span", "mw-lb-val", row.val);
  val.dataset.long = String(row.val).length > 5 ? "1" : "0";
  if (row.top) val.style.color = view.col;
  valcell.appendChild(val);
  valcell.appendChild(el(doc, "span", "mw-lb-unit", row.unit));

  rowEl.appendChild(rank);
  rowEl.appendChild(av);
  rowEl.appendChild(main);
  rowEl.appendChild(valcell);

  entry.appendChild(rowEl);
  return entry;
}

function buildStanding(doc, standing) {
  const wrap = el(doc, "div", "mw-lb-standing");
  wrap.appendChild(el(doc, "span", "mw-lb-standing-note", standing.note));
  wrap.appendChild(el(doc, "span", "mw-lb-standing-place", String(standing.place)));
  return wrap;
}

function buildBody(doc, view, handlers, bodyEl) {
  const children = [];
  if (view.staleLine) {
    children.push(el(doc, "p", "mw-lb-stale", view.staleLine));
  }
  if (view.body.kind === "empty") {
    const empty = el(doc, "div", "mw-lb-empty");
    empty.appendChild(el(doc, "span", "mw-lb-empty-title", view.body.title));
    empty.appendChild(el(doc, "span", "mw-lb-empty-note", view.body.note));
    if (view.body.clear) {
      const clear = el(doc, "button", "mw-lb-clear", view.body.clear.label);
      clear.type = "button";
      clear.onclick = () => handlers.onClear?.();
      empty.appendChild(clear);
    }
    children.push(empty);
  } else if (view.body.kind === "note") {
    children.push(el(doc, "p", "mw-lb-note", view.body.line));
    if (view.body.action) {
      const btn = el(doc, "button", "mw-lb-note-btn", view.body.action.label);
      btn.type = "button";
      btn.onclick = () => handlers.onSeeMine?.();
      children.push(btn);
    }
  } else {
    for (const row of view.body.rows) children.push(buildRow(doc, view, row, handlers));
  }
  if (view.standing) children.push(buildStanding(doc, view.standing));
  bodyEl.replaceChildren(...children);
}

function buildDock(doc, view, handlers, dockEl) {
  dockEl.hidden = view.dock === null;
  if (!view.dock) {
    dockEl.replaceChildren();
    return;
  }
  const btns = view.dock.map((entry) => {
    const btn = el(doc, "button", "mw-lb-dock-btn", entry.label);
    btn.type = "button";
    btn.dataset.action = entry.id;
    btn.dataset.primary = entry.primary ? "1" : "0";
    btn.onclick = () => handlers.onDock?.(entry.id);
    return btn;
  });
  dockEl.replaceChildren(...btns);
}

function buildSheet(doc, view, handlers, sheetEl) {
  const sheet = view.sheet;
  sheetEl.hidden = sheet === null;
  if (!sheet) {
    sheetEl.replaceChildren();
    return;
  }

  const scrim = el(doc, "div", "mw-lb-scrim");
  scrim.onclick = () => handlers.onSheetClose?.();

  const panel = el(doc, "div", "mw-lb-sheet-panel");
  const head = el(doc, "div", "mw-lb-sheet-head");
  head.appendChild(el(doc, "span", "mw-lb-sheet-title", sheet.title));
  const done = el(doc, "button", "mw-lb-sheet-done", sheet.done);
  done.type = "button";
  done.onclick = () => handlers.onSheetClose?.();
  head.appendChild(done);
  panel.appendChild(head);

  const opts = el(doc, "div", "mw-lb-sheet-opts");
  for (const o of sheet.opts) {
    const btn = el(doc, "button", "mw-lb-opt");
    btn.type = "button";
    btn.dataset.on = o.on ? "1" : "0";
    btn.dataset.dim = o.dim ? "1" : "0";
    btn.onclick = () => handlers.onSheetPick?.(sheet.id, o.value);

    const mark = el(doc, "span", "mw-lb-opt-mark");
    mark.setAttribute("aria-hidden", "true");
    if (o.on && o.col) mark.style.color = o.col;
    btn.appendChild(mark);

    const text = el(doc, "div", "mw-lb-opt-text");
    text.appendChild(el(doc, "span", "mw-lb-opt-label", o.label));
    text.appendChild(el(doc, "span", "mw-lb-opt-sub", o.sub));
    btn.appendChild(text);

    btn.appendChild(el(doc, "span", "mw-lb-opt-n", o.n));

    opts.appendChild(btn);
  }
  panel.appendChild(opts);

  sheetEl.replaceChildren(scrim, panel);
}

/**
 * renderLeaderboardPanel(host, view, handlers = {}) — draws the whole v3
 * Leaderboards panel from a view object alone (see 84-05-PLAN.md's
 * `<interfaces>` block, produced by src/browser/leaderboardView.js, for the
 * exact view shape). Ensures the `.mw-lb` skeleton (head/pickers/body/dock/
 * sheet, in that order) exists under `host`, reusing it — and the body's
 * scroll position — on every subsequent call (only section CHILDREN are
 * replaced via replaceChildren).
 *
 * Reaches the page only through `host.ownerDocument` and its own arguments —
 * no window/document/globalThis reference anywhere in this module — and
 * builds DOM only with createElement/textContent/setAttribute/dataset/
 * style/hidden/onclick/appendChild/replaceChildren (never an HTML-string
 * assignment). Imports no copy of its own: every word rendered comes from
 * `view`, which is untrusted where it carries a board doc's handle, name,
 * note or epitaph — written only through textContent (T-84-09).
 */
export function renderLeaderboardPanel(host, view, handlers = {}) {
  const doc = host.ownerDocument;
  const { root, head, pickers, body, dock, sheet } = ensureSkeleton(host);

  root.dataset.mode = view.mode;
  root.dataset.entry = view.entry;

  head.replaceChildren(...buildHead(doc, view, handlers));
  buildPickers(doc, view, handlers, pickers);
  buildBody(doc, view, handlers, body);
  buildDock(doc, view, handlers, dock);
  buildSheet(doc, view, handlers, sheet);

  return root;
}
