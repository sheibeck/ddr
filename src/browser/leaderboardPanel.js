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
//
// Phase 84, Plan 07 adds createLeaderboardPanel — the stateful controller
// the shell (84-08) drives, keeping the exact seam names createBoardsPanel
// already has (openFromTab, openFromTitle, onDeadTab, back, isTitleOpen,
// refresh, state) so the DEAD tab, VIEW THE DEAD, the Android back mirror
// and routeFromBoards keep working unchanged. Compete decides the starting
// view (ON -> LEADERBOARD, OFF -> YOUR DEAD, CONTEXT area 1); only the
// RANK BY stat is remembered between opens, under the same BOARDS_LAST_KEY
// prefs key boardsPanel.js used, tolerant of a retired board id; RACE and
// SUB-CLASS filters reset on every open. The dead-hero dock (FINAL SHEET,
// BURY THEM) is kept for the in-game DEAD tab. With Compete OFF the board
// seam is never called at all — YOUR DEAD renders at once from the local
// history and never waits on the network.
//
// The controller validates a RACE/SUB-CLASS sheet pick against RACE_IDS/
// SUB_IDS re-exported from leaderboardView.js (not content/races.js or
// content/classes.js directly) so this file's own source-pin test (below,
// "no import from content/") keeps holding — board rows carry untrusted
// text, and that pin keeps the import surface auditable at a glance.
//
// Phase 87 (BOARD-29): the controller's openRowMenu(key) opens the FILTER LIKE
// THIS sheet (filter by a row's race, sub-class or both) for a rendered row;
// the shell's long press and the detail's FILTER LIKE THIS button both reach it.

import { BOARD_STATS } from "./runDoc.js";
import { RACE_IDS, SUB_IDS } from "./leaderboardView.js";

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
  "mw-lb-detail-who",
  "mw-lb-detail-text",
  "mw-lb-detail-filter",
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
    // Phase 87 (BOARD-29): the hero's race and sub-class in plain text, first.
    if (row.who) detail.appendChild(el(doc, "span", "mw-lb-detail-who", row.who));
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
    if (row.filterLabel) {
      // the non-gesture path to the long-press menu (keyboard and TalkBack);
      // it must never also toggle the row it sits inside.
      const filter = el(doc, "button", "mw-lb-detail-filter", row.filterLabel);
      filter.type = "button";
      filter.onclick = (e) => {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        handlers.onRowMenu?.(row.key);
      };
      detail.appendChild(filter);
    }
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

// ═══════════════════════ Plan 07: the controller ═══════════════════════════

/**
 * BOARDS_LAST_KEY — the same per-viewer prefs key boardsPanel.js used for
 * the last-viewed board (CONTEXT area 1: "Remembered between opens: the
 * RANK BY stat only" reuses this key). Not game data — read and written
 * only through the injected `prefs`, always inside try/catch (a throwing
 * prefs implementation must never break a tab switch or a stat pick).
 */
export const BOARDS_LAST_KEY = "ddr.boards.last.v1";

/** currentQuery({stat, race, sub}) — the board query shape the board seam and buildView both read. */
function currentQuery(stat, race, sub) {
  return { stat, race, sub };
}

/**
 * createLeaderboardPanel({host, buildView, history, board, competeOn, prefs,
 * now, tzOffset, season, reducedMotion, onRoute}) — the v3 Leaderboards
 * panel's stateful controller (BOARD-18, BOARD-19, BOARD-20, BOARD-22,
 * BOARD-23, BOARD-25). Mirrors createBoardsPanel's shape: a frozen object of
 * methods closing over module-private state, no window/document globals —
 * only `host`, `host.ownerDocument` and the injected seams.
 *
 * `history()` is the local per-run history array (engineAdapter's
 * getRunHistory, 84-03); `board` is the LEADERBOARD data source
 * ({load(query) -> Promise<BoardSnapshot>, cached(query) -> BoardSnapshot |
 * null}, boardFeed.js, 84-04) — asked only while `competeOn()` is true, and
 * every call sits inside try/catch so a throwing seam never breaks a render.
 * `competeOn()` decides the opening view (true -> LEADERBOARD/"board" mode,
 * false -> YOUR DEAD/"mine" mode) and gates every network read; `season` is
 * a plain integer (content/season.js's SEASON) passed straight through to
 * buildView, which falls back to the real current season on its own when
 * this value is missing or invalid.
 *
 * A load's answer is applied only when it is still the most recent request
 * for the currently-open panel (a load token) and the panel has not been
 * routed away since (`entry` back to null) — an older or late answer never
 * overwrites a newer view (CONTEXT area 1, "a stale answer from an older
 * query never overwrites a newer one").
 */
export function createLeaderboardPanel({
  host,
  buildView,
  history = () => [],
  board = {},
  competeOn = () => false,
  prefs = null,
  now = () => Date.now(),
  tzOffset = () => 0,
  season = null,
  reducedMotion = () => false,
  onRoute,
} = {}) {
  const doc = host.ownerDocument;

  let entry = null; // null | "tab" | "title"
  let mode = "mine"; // "board" | "mine" — the panel's own selected view; buildView still forces "mine" whenever Compete is off
  let stat = "deep";
  let race = null;
  let sub = null;
  let open = null; // an open row's key, or null
  let sheet = null; // "stat" | "race" | "sub" | "row" | null
  let menu = null; // the open row menu: { key, race, sub } (validated content ids), or null
  let lastView = null; // the last view render() drew, so openMenu can find a row by key
  let hasHero = false;
  let dead = false; // true only while the in-game DEAD tab is open with a dead hero (CONTEXT area 1, "dead-hero dock stays")
  let competePrev = null; // the last competeOn() refresh() saw, so an OFF->ON transition fetches the EVERYONE total exactly once

  let currentSnapshot = null; // the BoardSnapshot (or {status:"loading"}) LEADERBOARD renders
  let lastReadySnapshot = null; // the last ready BoardSnapshot — YOUR DEAD's EVERYONE box reads its total while Compete is on
  let loadToken = 0;

  /** safeCompeteOn() — competeOn(), defaulting to false on a throw or a non-true answer. */
  function safeCompeteOn() {
    try {
      return competeOn() === true;
    } catch {
      return false; // a throwing competeOn() must never break a render — default to no network.
    }
  }

  /** readStoredStat() — the remembered RANK BY stat; "deep" for anything missing, unknown or a throw. */
  function readStoredStat() {
    if (!prefs) return "deep";
    try {
      const v = prefs.getItem(BOARDS_LAST_KEY);
      return typeof v === "string" && BOARD_STATS.includes(v) ? v : "deep";
    } catch {
      return "deep"; // a throwing getItem must never break the open.
    }
  }

  /** storeStat(v) — remembers the RANK BY stat; a throwing setItem never breaks the pick. */
  function storeStat(v) {
    if (!prefs) return;
    try {
      prefs.setItem(BOARDS_LAST_KEY, v);
    } catch {
      // a throwing setItem must never break the stat pick.
    }
  }

  /** clearTitleMarker() — drops body[data-boards-entry]; a malformed body element must never throw. */
  function clearTitleMarker() {
    try {
      delete doc.body.dataset.boardsEntry;
    } catch {
      // a malformed body element must never throw.
    }
  }

  /**
   * render({reset}) — reads the history (falling back to [] on a throwing
   * history()), builds the view (the current snapshot on LEADERBOARD, the
   * last ready snapshot on YOUR DEAD) and draws it, inside one try/catch so
   * a throwing buildView or renderer leaves the PREVIOUS DOM in place rather
   * than breaking the tab switch. `reset` zeroes .mw-lb-body's scrollTop (an
   * open, a view switch or a filter/stat change); a row toggle passes false
   * so the list never jumps; a resolved load also passes false.
   */
  function render({ reset }) {
    let hist = [];
    try {
      const h = typeof history === "function" ? history() : [];
      hist = Array.isArray(h) ? h : [];
    } catch {
      hist = []; // a throwing history() must never break the tab switch.
    }

    const compete = safeCompeteOn();
    const boardField = mode === "board" ? currentSnapshot : lastReadySnapshot;

    let nowVal = null;
    try {
      nowVal = typeof now === "function" ? now() : null;
    } catch {
      nowVal = null;
    }
    let tz = 0;
    try {
      tz = typeof tzOffset === "function" ? tzOffset() : 0;
    } catch {
      tz = 0;
    }

    try {
      const view = buildView({
        compete,
        mode,
        entry,
        hasHero,
        dead,
        stat,
        race,
        sub,
        open,
        sheet,
        menu,
        history: hist,
        board: boardField,
        now: nowVal,
        tzOffsetMinutes: tz,
        season,
      });
      lastView = view;
      renderLeaderboardPanel(host, view, handlers);
      if (reset) {
        const bodyEl = host.querySelector(".mw-lb-body");
        if (bodyEl) bodyEl.scrollTop = 0;
      }
    } catch {
      // a throwing buildView or renderer must never break the tab switch —
      // the previous DOM (if any) is left exactly as it was.
    }
  }

  /**
   * requestBoard({reset}) — LEADERBOARD's data source (BOARD-19, BOARD-25):
   * a fresh cached snapshot (board.cached(query)) renders at once with no
   * network read; otherwise the loading note renders, board.load(query) is
   * called exactly once, and the render on resolve never resets the scroll.
   * A rejecting or misbehaving board.load resolves to an unreachable
   * snapshot. Never called while Compete is off.
   */
  function requestBoard({ reset }) {
    if (!safeCompeteOn()) return;
    const query = currentQuery(stat, race, sub);

    let cachedSnap = null;
    try {
      cachedSnap = board && typeof board.cached === "function" ? board.cached(query) : null;
    } catch {
      cachedSnap = null; // a throwing cached() must never break the request.
    }

    if (cachedSnap && typeof cachedSnap === "object") {
      currentSnapshot = cachedSnap;
      if (cachedSnap.status === "ready") lastReadySnapshot = cachedSnap;
      render({ reset });
      return;
    }

    currentSnapshot = { status: "loading" };
    render({ reset });

    loadToken += 1;
    const token = loadToken;

    let loadPromise;
    try {
      loadPromise = board && typeof board.load === "function" ? board.load(query) : Promise.resolve(null);
    } catch {
      loadPromise = Promise.resolve(null); // a throwing load() must never break the request.
    }

    Promise.resolve(loadPromise)
      .then((snap) => {
        // a stale answer (superseded by a newer query, or the panel routed
        // away since) never overwrites a newer view.
        if (token !== loadToken || entry === null) return;
        currentSnapshot = snap && typeof snap === "object" ? snap : { status: "unreachable", reason: "offline" };
        if (currentSnapshot.status === "ready") lastReadySnapshot = currentSnapshot;
        render({ reset: false });
      })
      .catch(() => {
        if (token !== loadToken || entry === null) return;
        currentSnapshot = { status: "unreachable", reason: "offline" };
        render({ reset: false });
      });
  }

  /** resetForOpen() — the state every open re-derives: the remembered stat, reset filters, the compete-decided view. */
  function resetForOpen() {
    stat = readStoredStat();
    race = null;
    sub = null;
    open = null;
    sheet = null;
    menu = null;
    mode = safeCompeteOn() ? "board" : "mine";
    competePrev = safeCompeteOn();
  }

  /** openBoardOrMine() — the shared tail of every open: fetch LEADERBOARD data on "board", else just render. */
  function openBoardOrMine() {
    if (mode === "board") requestBoard({ reset: true });
    else render({ reset: true });
  }

  /**
   * focusPicker(id) — moves focus to the RACE or SUB-CLASS picker after a
   * filter pick, so TalkBack reads the new filter value (Phase 87, BOARD-29).
   * A missing element or a focus() that throws never breaks the pick.
   */
  function focusPicker(id) {
    try {
      const btn = host.querySelectorAll(".mw-lb-picker").find((b) => b.dataset && b.dataset.picker === id);
      if (btn && typeof btn.focus === "function") btn.focus();
    } catch {
      // focus is a courtesy to assistive tech; it must never break a pick.
    }
  }

  /** applyFilterPick(focusId) — the shared tail of every race/sub filter pick: re-query or re-filter, then focus the changed picker. */
  function applyFilterPick(focusId) {
    if (mode === "board") requestBoard({ reset: true });
    else render({ reset: true });
    focusPicker(focusId);
  }

  /**
   * openMenu(key) — opens the row filter menu for a rendered row. Only a
   * known race id and a known sub-class id are kept (the row is a board doc,
   * untrusted); false, with nothing changed, when the panel is closed, the
   * key is not on screen, or neither value validates.
   */
  function openMenu(key) {
    if (entry === null || !lastView || !lastView.body || !Array.isArray(lastView.body.rows)) return false;
    const row = lastView.body.rows.find((r) => r.key === key);
    if (!row) return false;
    const menuRace = RACE_IDS.includes(row.race) ? row.race : null;
    const menuSub = SUB_IDS.includes(row.sub) ? row.sub : null;
    if (menuRace === null && menuSub === null) return false;
    menu = { key, race: menuRace, sub: menuSub };
    sheet = "row";
    render({ reset: false });
    return true;
  }

  const handlers = {
    onBack() {
      back();
    },
    onBox(action) {
      if (action === "mine") {
        mode = "mine";
        open = null;
        sheet = null;
        menu = null;
        render({ reset: true });
      } else if (action === "board") {
        mode = "board";
        open = null;
        sheet = null;
        menu = null;
        requestBoard({ reset: true });
      }
    },
    onSeeMine() {
      mode = "mine";
      open = null;
      sheet = null;
      menu = null;
      render({ reset: true });
    },
    onPicker(id) {
      if (id !== "stat" && id !== "race" && id !== "sub") return;
      sheet = id;
      render({ reset: false });
    },
    onSheetClose() {
      if (sheet === null) return;
      sheet = null;
      menu = null;
      render({ reset: false });
    },
    onRowMenu(key) {
      openMenu(key);
    },
    onSheetPick(sheetId, value) {
      if (sheetId === "stat") {
        if (!BOARD_STATS.includes(value)) return;
        stat = value;
        storeStat(stat);
        sheet = null;
        if (mode === "board") requestBoard({ reset: true });
        else render({ reset: true });
        return;
      }
      if (sheetId === "race") {
        if (value !== null && !RACE_IDS.includes(value)) return;
        race = value;
        sheet = null;
        applyFilterPick("race");
        return;
      }
      if (sheetId === "sub") {
        if (value !== null && !SUB_IDS.includes(value)) return;
        sub = value;
        sheet = null;
        applyFilterPick("sub");
        return;
      }
      if (sheetId === "row") {
        if (menu === null) return;
        const m = menu;
        if (value === "cancel") {
          sheet = null;
          menu = null;
          render({ reset: false });
          return;
        }
        let focusId = null;
        if (value === "race" && m.race !== null) {
          race = m.race;
          focusId = "race";
        } else if (value === "sub" && m.sub !== null) {
          sub = m.sub;
          focusId = "sub";
        } else if (value === "both" && m.race !== null && m.sub !== null) {
          race = m.race;
          sub = m.sub;
          focusId = "race";
        } else {
          return; // a value the menu does not carry is ignored, the menu stays open.
        }
        sheet = null;
        menu = null;
        applyFilterPick(focusId);
        return;
      }
      // an unknown sheetId is ignored.
    },
    onRow(key) {
      open = open === key ? null : key;
      render({ reset: false });
    },
    onClear() {
      race = null;
      sub = null;
      open = null;
      if (mode === "board") requestBoard({ reset: true });
      else render({ reset: true });
    },
    onDock(id) {
      if (id === "title" || id === "roll" || id === "dungeon") {
        route(id);
        return;
      }
      // the dead-hero dock: BURY THEM leaves the panel like any other route;
      // FINAL SHEET opens over the panel, so the panel keeps its entry (a
      // later refresh still renders it).
      if (dead && id === "bury") {
        route(id);
        return;
      }
      if (dead && id === "finalSheet") {
        onRoute?.(id, { hasHero });
      }
    },
  };

  /** route(action) — closes the panel and routes; a throwing onRoute is the shell's own concern, not guarded here (matches createBoardsPanel). */
  function route(action) {
    const routedHasHero = hasHero;
    entry = null;
    clearTitleMarker();
    onRoute?.(action, { hasHero: routedHasHero });
  }

  /**
   * back() — a sheet open closes it; YOUR DEAD with Compete on returns to
   * LEADERBOARD; a title open routes to the dungeon (a live hero) or the
   * title, clearing the marker; a tab open with nothing to close returns
   * false. Never called before any open (entry null) beyond returning false.
   */
  function back() {
    if (entry === null) return false;
    if (sheet !== null) {
      sheet = null;
      menu = null;
      render({ reset: false });
      return true;
    }
    if (mode === "mine" && safeCompeteOn()) {
      mode = "board";
      requestBoard({ reset: true });
      return true;
    }
    if (entry === "title") {
      route(hasHero ? "dungeon" : "title");
      return true;
    }
    return false;
  }

  function isTitleOpen() {
    return entry === "title";
  }

  function openFromTab({ dead: d } = {}) {
    entry = "tab";
    dead = d === true;
    resetForOpen();
    clearTitleMarker();
    openBoardOrMine();
  }

  function openFromTitle({ hasHero: h } = {}) {
    entry = "title";
    hasHero = h === true;
    dead = false;
    resetForOpen();
    doc.body.dataset.boardsEntry = "title";
    openBoardOrMine();
  }

  function onDeadTab(opts) {
    if (entry === "title") return; // a title-opened panel is left exactly as it is.
    openFromTab(opts && typeof opts === "object" ? opts : {});
  }

  /**
   * refresh() — does nothing while closed. While on LEADERBOARD, a Compete
   * OFF switches to YOUR DEAD (no board call). While on YOUR DEAD, an
   * OFF->ON Compete transition fetches the EVERYONE total exactly once
   * (cache-first, like any other requestBoard call); a plain re-render
   * follows otherwise.
   */
  function refresh() {
    if (entry === null) return;
    const compete = safeCompeteOn();
    if (mode === "board" && !compete) {
      mode = "mine";
      competePrev = compete;
      render({ reset: true });
      return;
    }
    if (mode === "mine" && compete && competePrev === false) {
      competePrev = compete;
      requestBoard({ reset: false });
      return;
    }
    competePrev = compete;
    render({ reset: false });
  }

  function state() {
    return Object.freeze({ entry, mode, stat, race, sub, open, sheet, menu, hasHero, dead });
  }

  return Object.freeze({ openFromTab, openFromTitle, onDeadTab, back, isTitleOpen, refresh, openRowMenu: openMenu, state });
}
