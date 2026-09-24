// src/browser/boardsPanel.js
//
// Phase 66 (BOARD-01..08, D-13/D-14) — the Leaderboards panel renderer and
// controller. Follows the gearTab.js/roller.js modular-shell pattern: pure
// DOM built only through host.ownerDocument, every word of copy comes from
// the injected view (content/boards.js through boardsView.js, wired in
// 66-04/66-06), no window/document globals, no network. The view object is
// produced by 66-04's boardsView — this module only draws it and manages
// the panel's own open/board/scope/entry state.
//
// Task 1: BOARDS_CLASSES, railScrollTarget and renderBoardsPanel — the pure
// DOM renderer, proven against createRecordingDocument()/hand-built views.
// Task 2 (this commit): BOARDS_LAST_KEY and createBoardsPanel — the
// stateful controller (entry modes, board memory, scope/row toggles, back
// routing, rail centring), following roller.js's frozen-factory shape.

import { BOARD_IDS } from "../../engine/records.js";

/**
 * BOARDS_CLASSES — every class name renderBoardsPanel emits, in no
 * particular order. 66-05's CSS test walks this array to assert each has a
 * rule.
 */
export const BOARDS_CLASSES = Object.freeze([
  "mw-bd",
  "mw-bd-head",
  "mw-bd-back",
  "mw-bd-headtext",
  "mw-bd-title",
  "mw-bd-scope",
  "mw-bd-interred",
  "mw-bd-interred-n",
  "mw-bd-interred-label",
  "mw-bd-strip",
  "mw-bd-av",
  "mw-bd-av-nobody",
  "mw-bd-strip-text",
  "mw-bd-strip-label",
  "mw-bd-strip-source",
  "mw-bd-scopes",
  "mw-bd-scope-chip",
  "mw-bd-rail",
  "mw-bd-chip",
  "mw-bd-boardhead",
  "mw-bd-mark",
  "mw-bd-boardtext",
  "mw-bd-boardtitle",
  "mw-bd-rule",
  "mw-bd-body",
  "mw-bd-empty",
  "mw-bd-note",
  "mw-bd-entry",
  "mw-bd-divider",
  "mw-bd-divider-dots",
  "mw-bd-divider-label",
  "mw-bd-row",
  "mw-bd-rank",
  "mw-bd-main",
  "mw-bd-idline",
  "mw-bd-handle",
  "mw-bd-tag",
  "mw-bd-name",
  "mw-bd-line",
  "mw-bd-bar",
  "mw-bd-bar-fill",
  "mw-bd-detail",
  "mw-bd-detail-text",
  "mw-bd-stats",
  "mw-bd-stat",
  "mw-bd-stat-k",
  "mw-bd-stat-v",
  "mw-bd-valcell",
  "mw-bd-val",
  "mw-bd-unit",
  "mw-bd-standing",
  "mw-bd-standing-text",
  "mw-bd-standing-label",
  "mw-bd-standing-note",
  "mw-bd-standing-place",
  "mw-bd-foot",
  "mw-bd-dock",
  "mw-bd-dock-btn",
  // Phase 68 (D-06, D-08): the SEASON label, the older-season picker and
  // the friends consent button.
  "mw-bd-season",
  "mw-bd-seasons",
  "mw-bd-season-chip",
  "mw-bd-consent",
]);

/** finite(n) — coerces to a finite number, else 0. */
function finite(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * railScrollTarget({offsetLeft, offsetWidth, clientWidth, scrollWidth}) —
 * the mock's own syncRail formula (design/Mazeworld Boards Panel.dc.html's
 * Component#syncRail), clamped to the scrollable range
 * [0, scrollWidth - clientWidth]. Every input is coerced to a finite number
 * (else 0) so a malformed/undefined dimension never throws or yields NaN.
 */
export function railScrollTarget({ offsetLeft, offsetWidth, clientWidth, scrollWidth } = {}) {
  const left = finite(offsetLeft);
  const width = finite(offsetWidth);
  const client = finite(clientWidth);
  const scroll = finite(scrollWidth);
  const want = left - (client - width) / 2;
  const max = scroll - client;
  return Math.max(0, Math.min(want, max));
}

// ─── small DOM builders (module-private; renderBoardsPanel and its helpers
// only use createElement/textContent/setAttribute/dataset/style/hidden/
// onclick/appendChild/replaceChildren — never an HTML-string assignment) ──

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (typeof text === "string") e.textContent = text;
  return e;
}

const SECTION_CLASSES = ["mw-bd-head", "mw-bd-strip", "mw-bd-rail", "mw-bd-boardhead", "mw-bd-body", "mw-bd-dock"];

/**
 * ensureSkeleton(host) — finds an existing `.mw-bd` root (a second render on
 * the same host reuses it, along with its six section children — the rail's
 * and the body's scroll positions survive a re-render this way) or creates
 * one with the six section children in order.
 */
function ensureSkeleton(host) {
  const doc = host.ownerDocument;
  let root = host.querySelector(".mw-bd");
  if (!root) {
    root = el(doc, "div", "mw-bd");
    for (const cls of SECTION_CLASSES) root.appendChild(el(doc, "div", cls));
    host.appendChild(root);
  }
  return {
    root,
    head: root.querySelector(".mw-bd-head"),
    strip: root.querySelector(".mw-bd-strip"),
    rail: root.querySelector(".mw-bd-rail"),
    boardhead: root.querySelector(".mw-bd-boardhead"),
    body: root.querySelector(".mw-bd-body"),
    dock: root.querySelector(".mw-bd-dock"),
  };
}

function buildHead(doc, view, handlers) {
  const children = [];
  if (view.header.back) {
    const back = el(doc, "button", "mw-bd-back", "◀");
    back.type = "button";
    back.setAttribute("aria-label", view.header.backLabel);
    back.onclick = () => handlers.onBack?.();
    children.push(back);
  }

  const headtext = el(doc, "div", "mw-bd-headtext");
  headtext.appendChild(el(doc, "span", "mw-bd-title", view.header.title));
  headtext.appendChild(el(doc, "span", "mw-bd-scope", view.header.scopeLine));
  const season = view.header.season;
  if (season && typeof season === "object") {
    // Phase 68 (D-08): the SEASON label, plus the older-season picker only
    // when the view offers one (two or more seasons, on a global view).
    headtext.appendChild(el(doc, "span", "mw-bd-season", String(season.label ?? "")));
    if (Array.isArray(season.picker)) {
      const seasons = el(doc, "div", "mw-bd-seasons");
      for (const s of season.picker) {
        const chip = el(doc, "button", "mw-bd-season-chip", String(s.label ?? ""));
        chip.type = "button";
        chip.dataset.season = String(s.n);
        chip.dataset.on = s.on ? "1" : "0";
        chip.setAttribute("aria-pressed", s.on ? "true" : "false");
        chip.onclick = () => handlers.onSeason?.(s.n);
        seasons.appendChild(chip);
      }
      headtext.appendChild(seasons);
    }
  }
  children.push(headtext);

  const interred = el(doc, "div", "mw-bd-interred");
  interred.appendChild(el(doc, "span", "mw-bd-interred-n", String(view.header.interred)));
  interred.appendChild(el(doc, "span", "mw-bd-interred-label", view.header.interredLabel));
  children.push(interred);

  return children;
}

/** AVATAR_ON_RING — the mock's AVATAR `on` box-shadow (a dark inset edge plus the gold ring). */
const AVATAR_ON_RING = "inset 0 0 0 1px rgba(0,0,0,.5), 0 0 0 1px #e8c97a";

function buildStrip(doc, view, handlers, stripEl) {
  const strip = view.strip;
  stripEl.hidden = strip === null;
  if (!strip) {
    stripEl.replaceChildren();
    return;
  }

  let av;
  if (strip.avatar && typeof strip.avatar === "object") {
    // Phase 67 (D-08): signed in — the mock's AVATAR(handle, 30, true): the
    // initials square in its palette colour with the gold on-ring.
    av = el(doc, "div", "mw-bd-av", String(strip.avatar.initials ?? ""));
    av.dataset.on = "1";
    av.style.background = strip.avatar.bg;
    av.style.boxShadow = AVATAR_ON_RING;
  } else {
    av = el(doc, "div", "mw-bd-av mw-bd-av-nobody", strip.glyph);
  }
  av.setAttribute("aria-hidden", "true");

  const text = el(doc, "div", "mw-bd-strip-text");
  text.appendChild(el(doc, "span", "mw-bd-strip-label", strip.label));
  text.appendChild(el(doc, "span", "mw-bd-strip-source", strip.source));

  const scopes = el(doc, "div", "mw-bd-scopes");
  for (const s of strip.scopes) {
    const chip = el(doc, "button", "mw-bd-scope-chip", s.label);
    chip.type = "button";
    chip.dataset.scope = s.id;
    chip.dataset.on = s.on ? "1" : "0";
    chip.dataset.dim = s.dim ? "1" : "0";
    chip.setAttribute("aria-pressed", s.on ? "true" : "false");
    chip.onclick = () => handlers.onScope?.(s.id);
    scopes.appendChild(chip);
  }

  stripEl.replaceChildren(av, text, scopes);
}

function buildRail(doc, view, handlers, railEl) {
  const chips = view.rail.map((entry) => {
    const chip = el(doc, "button", "mw-bd-chip", entry.tab);
    chip.type = "button";
    chip.dataset.board = entry.id;
    chip.dataset.on = entry.on ? "1" : "0";
    chip.setAttribute("aria-pressed", entry.on ? "true" : "false");
    // the mock's own chip() — the on chip alone paints the board colour.
    if (entry.on) {
      chip.style.background = entry.col;
      chip.style.color = "#14110c";
      chip.style.boxShadow = "inset 0 0 0 1px " + entry.col;
    }
    chip.onclick = () => handlers.onBoard?.(entry.id);
    return chip;
  });
  railEl.replaceChildren(...chips);
}

function buildBoardHead(doc, view, boardheadEl) {
  const mark = el(doc, "span", "mw-bd-mark", view.board.mark);
  mark.style.color = view.board.col;
  mark.setAttribute("aria-hidden", "true");

  const boardtext = el(doc, "div", "mw-bd-boardtext");
  boardtext.appendChild(el(doc, "span", "mw-bd-boardtitle", view.board.title));
  boardtext.appendChild(el(doc, "span", "mw-bd-rule", view.board.rule));

  boardheadEl.replaceChildren(mark, boardtext);
}

function buildRow(doc, view, row, handlers) {
  const entry = el(doc, "div", "mw-bd-entry");

  if (row.divider) {
    const divider = el(doc, "div", "mw-bd-divider");
    divider.appendChild(el(doc, "span", "mw-bd-divider-dots", "···"));
    divider.appendChild(el(doc, "span", "mw-bd-divider-label", row.divider));
    entry.appendChild(divider);
  }

  const rowEl = el(doc, "div", "mw-bd-row");
  rowEl.dataset.key = row.key;
  rowEl.dataset.top = row.top ? "1" : "0";
  rowEl.dataset.podium = row.podium ? "1" : "0";
  rowEl.dataset.you = row.you ? "1" : "0";
  rowEl.dataset.open = row.open ? "1" : "0";
  rowEl.setAttribute("role", "button");
  rowEl.setAttribute("tabindex", "0");
  rowEl.setAttribute("aria-expanded", row.open ? "true" : "false");
  rowEl.onclick = () => handlers.onRow?.(row.key);
  // the mock's own top-row stripe — inline, since it's board-colour-driven
  // and the row's dataset alone (data-top) is not enough for CSS to know
  // WHICH colour to paint.
  if (row.top) {
    rowEl.style.boxShadow = "inset 0 -1px 0 #241f16, inset 3px 0 0 " + view.board.col;
  }

  const rank = el(doc, "span", "mw-bd-rank", row.rank);
  if (row.top) rank.style.color = view.board.col;

  const av = el(doc, "div", "mw-bd-av", row.avatar.initials);
  av.style.background = row.avatar.bg;

  const main = el(doc, "div", "mw-bd-main");
  const idline = el(doc, "div", "mw-bd-idline");
  idline.appendChild(el(doc, "span", "mw-bd-handle", row.headline));
  if (row.tag) idline.appendChild(el(doc, "span", "mw-bd-tag", row.tag));
  main.appendChild(idline);
  if (row.name) main.appendChild(el(doc, "span", "mw-bd-name", row.name));
  main.appendChild(el(doc, "span", "mw-bd-line", row.line));

  const bar = el(doc, "div", "mw-bd-bar");
  const fill = el(doc, "div", "mw-bd-bar-fill");
  fill.style.width = `${row.barPct}%`;
  if (row.top) fill.style.background = view.board.col;
  bar.appendChild(fill);
  main.appendChild(bar);

  if (row.open) {
    const detail = el(doc, "div", "mw-bd-detail");
    detail.appendChild(el(doc, "span", "mw-bd-detail-text", row.detail));
    const stats = el(doc, "div", "mw-bd-stats");
    for (const stat of row.stats) {
      const statEl = el(doc, "div", "mw-bd-stat");
      statEl.appendChild(el(doc, "span", "mw-bd-stat-k", stat.k));
      statEl.appendChild(el(doc, "span", "mw-bd-stat-v", stat.v));
      stats.appendChild(statEl);
    }
    detail.appendChild(stats);
    main.appendChild(detail);
  }

  const valcell = el(doc, "div", "mw-bd-valcell");
  const val = el(doc, "span", "mw-bd-val", row.val);
  val.dataset.long = String(row.val).length > 5 ? "1" : "0";
  if (row.top) val.style.color = view.board.col;
  valcell.appendChild(val);
  valcell.appendChild(el(doc, "span", "mw-bd-unit", row.unit));

  rowEl.appendChild(rank);
  rowEl.appendChild(av);
  rowEl.appendChild(main);
  rowEl.appendChild(valcell);

  entry.appendChild(rowEl);
  return entry;
}

function buildStanding(doc, standing) {
  const wrap = el(doc, "div", "mw-bd-standing");
  const text = el(doc, "div", "mw-bd-standing-text");
  text.appendChild(el(doc, "span", "mw-bd-standing-label", standing.label));
  text.appendChild(el(doc, "span", "mw-bd-standing-note", standing.note));
  wrap.appendChild(text);
  wrap.appendChild(el(doc, "span", "mw-bd-standing-place", String(standing.place)));
  return wrap;
}

function buildBody(doc, view, handlers, bodyEl) {
  const children = [];
  if (view.body.kind === "empty") {
    children.push(el(doc, "p", "mw-bd-empty", view.body.line));
  } else if (view.body.kind === "note") {
    children.push(el(doc, "p", "mw-bd-note", view.body.line));
  } else if (view.body.kind === "consent") {
    // Phase 68 (D-06): the friends consent note with its in-panel button —
    // never a modal or a rail card.
    children.push(el(doc, "p", "mw-bd-note", view.body.line));
    const action = view.body.action || {};
    const btn = el(doc, "button", "mw-bd-consent", String(action.label ?? ""));
    btn.type = "button";
    btn.dataset.action = String(action.id ?? "");
    btn.onclick = () => handlers.onConsent?.();
    children.push(btn);
  } else {
    for (const row of view.body.rows) children.push(buildRow(doc, view, row, handlers));
  }
  // Phase 68: a global view that is not ready has no standing card.
  if (view.standing) children.push(buildStanding(doc, view.standing));
  children.push(el(doc, "p", "mw-bd-foot", view.footnote));
  bodyEl.replaceChildren(...children);
}

function buildDock(doc, view, handlers, dockEl) {
  dockEl.hidden = view.dock === null;
  if (!view.dock) {
    dockEl.replaceChildren();
    return;
  }
  const btns = view.dock.map((entry) => {
    const btn = el(doc, "button", "mw-bd-dock-btn", entry.label);
    btn.type = "button";
    btn.dataset.action = entry.id;
    btn.dataset.primary = entry.primary ? "1" : "0";
    btn.onclick = () => handlers.onDock?.(entry.id);
    return btn;
  });
  dockEl.replaceChildren(...btns);
}

/**
 * renderBoardsPanel(host, view, handlers = {}) — draws the whole Leaderboards
 * panel from a view object alone (see 66-03-PLAN.md's `<interfaces>` for the
 * exact view shape). Ensures the `.mw-bd` skeleton (head/strip/rail/
 * boardhead/body/dock, in that order) exists under `host`, reusing it — and
 * the rail/body elements inside it — on every subsequent call, so a row tap
 * or board switch never resets the rail's or the body's own scroll position
 * (only their CHILDREN are replaced via replaceChildren).
 *
 * Reaches the page only through `host.ownerDocument` and its own arguments —
 * no window/document/globalThis reference anywhere in this module — and
 * builds DOM only with createElement/textContent/setAttribute/dataset/
 * style/hidden/onclick/appendChild/replaceChildren (never an HTML-string
 * assignment). Imports no copy: every word rendered comes from `view`.
 */
export function renderBoardsPanel(host, view, handlers = {}) {
  const doc = host.ownerDocument;
  const { root, head, strip, rail, boardhead, body, dock } = ensureSkeleton(host);

  root.dataset.board = view.board.id;
  root.dataset.entry = view.header.back ? "title" : "tab";

  head.replaceChildren(...buildHead(doc, view, handlers));
  buildStrip(doc, view, handlers, strip);
  buildRail(doc, view, handlers, rail);
  buildBoardHead(doc, view, boardhead);
  buildBody(doc, view, handlers, body);
  buildDock(doc, view, handlers, dock);

  return root;
}

// ═══════════════════════ Task 2: the controller ═══════════════════════════

/**
 * BOARDS_LAST_KEY — D-04: a per-viewer convenience key naming the board the
 * DEAD tab last showed. Not game data — read and written only through the
 * injected `prefs`, and always inside try/catch (a throwing prefs
 * implementation must never break the tab switch).
 */
export const BOARDS_LAST_KEY = "ddr.boards.last.v1";

/** SIGNED_OUT — the frozen signed-out identity createBoardsPanel falls back to. */
const SIGNED_OUT = Object.freeze({ signedIn: false, player: null });

/** signedOutIdentity() — createBoardsPanel's default identity seam (always signed out). */
function signedOutIdentity() {
  return SIGNED_OUT;
}

/** defaultSeasons() — createBoardsPanel's default seasons seam (season 1 only). */
function defaultSeasons() {
  return { current: 1, all: [1] };
}

/**
 * createBoardsPanel({ host, buildView, readData, prefs, reducedMotion,
 * onRoute }) — the Leaderboards panel's stateful controller (D-01, D-02,
 * D-03, D-04, D-06, D-13). Mirrors roller.js's createRoller shape: a frozen
 * object of methods closing over module-private state, no window/document
 * globals — only `host`, `host.ownerDocument` and the injected seams.
 *
 * Phase 67 (D-08) supplies the account identity through the injected
 * identity() seam ({ signedIn, player: { id, displayName } | null }; the
 * default is signed out). Every render re-reads it, so refresh() picks up a
 * sign-in or sign-out while the panel is open; a missing, throwing or
 * malformed identity renders signed out.
 *
 * Phase 68 (D-05..D-08) adds three optional seams: `global({ board, scope,
 * season })` answers the global snapshot (68-07 passes the global-boards
 * controller's view), asked only while signed in on ALL / FRIENDS off
 * GRAVEYARD — signed out or Compete OFF it is never called; `seasons()`
 * answers { current, all } for the SEASON label and the older-season picker;
 * `onFriendsConsent()` runs from the in-panel SHOW MY FRIENDS button. The
 * panel still reaches Play Games only through these injected functions, and
 * a missing or throwing seam never breaks a render.
 */
export function createBoardsPanel({
  host,
  buildView,
  readData,
  prefs = null,
  reducedMotion = () => false,
  onRoute,
  identity = signedOutIdentity,
  global = null,
  seasons = defaultSeasons,
  onFriendsConsent = null,
}) {
  const doc = host.ownerDocument;

  /** readSeasons() — { current, all } from the seasons() seam; a throw or malformed answer means season 1 of [1]. */
  function readSeasons() {
    let answer;
    try {
      answer = typeof seasons === "function" ? seasons() : null;
    } catch {
      answer = null; // a throwing seasons() must never break the tab switch.
    }
    const isSeason = (n) => Number.isInteger(n) && n > 0;
    const current = answer && typeof answer === "object" && isSeason(answer.current) ? answer.current : 1;
    const listed = answer && typeof answer === "object" && Array.isArray(answer.all) ? answer.all.filter(isSeason) : [];
    const all = listed.length ? [...new Set(listed)].sort((a, b) => a - b) : [current];
    return { current, all };
  }

  /** readGlobal(signedIn) — the global snapshot, asked only when signed in on a global scope off GRAVEYARD; null otherwise or on a throw. */
  function readGlobal(signedIn) {
    if (!signedIn || scope === "local" || board === "yard" || typeof global !== "function") return null;
    try {
      const answer = global({ board, scope, season });
      return answer === undefined ? null : answer;
    } catch {
      return null; // a throwing global() reads as no snapshot (the view says unreachable).
    }
  }

  /** readIdentity() — the account identity as { signedIn, player }; never throws. */
  function readIdentity() {
    let id;
    try {
      id = typeof identity === "function" ? identity() : null;
    } catch {
      id = null; // a throwing identity() must never break the tab switch.
    }
    if (!id || typeof id !== "object" || id.signedIn !== true) return SIGNED_OUT;
    const player = id.player && typeof id.player === "object" ? id.player : null;
    return { signedIn: true, player };
  }

  let entry = null; // null | "tab" | "title"
  let board = "deep";
  let scope = "local"; // "local" | "all" | "friends"
  let open = null; // a row key, or null
  let hasHero = false;
  let season = 1; // Phase 68 (D-08): the viewed season; reset to the current one on every open.

  function readStoredBoard() {
    if (!prefs) return null;
    try {
      const v = prefs.getItem(BOARDS_LAST_KEY);
      return typeof v === "string" && BOARD_IDS.includes(v) ? v : null;
    } catch {
      return null; // a throwing getItem must never break the tab switch.
    }
  }

  function storeBoard(id) {
    if (!prefs) return;
    try {
      prefs.setItem(BOARDS_LAST_KEY, id);
    } catch {
      // a throwing setItem must never break the board switch.
    }
  }

  function clearTitleMarker() {
    try {
      delete doc.body.dataset.boardsEntry;
    } catch {
      // a malformed body element must never throw.
    }
  }

  /**
   * centreRail() — D-13's auto-centre: finds the on chip inside .mw-bd-rail
   * (a plain-object walk — recordingDom, and real DOM alike, support no
   * attribute selector here) and scrolls the rail toward
   * railScrollTarget(...) only when it is off by more than 2px, respecting
   * prefers-reduced-motion (instant "auto" vs "smooth").
   */
  function centreRail() {
    const railEl = host.querySelector(".mw-bd-rail");
    if (!railEl) return;
    const chip = (railEl.children || []).find((c) => c && c.dataset && c.dataset.on === "1");
    if (!chip) return;
    const target = railScrollTarget({
      offsetLeft: chip.offsetLeft,
      offsetWidth: chip.offsetWidth,
      clientWidth: railEl.clientWidth,
      scrollWidth: railEl.scrollWidth,
    });
    const currentRaw = Number(railEl.scrollLeft);
    const current = Number.isFinite(currentRaw) ? currentRaw : 0;
    if (Math.abs(current - target) <= 2) return;
    if (typeof railEl.scrollTo === "function") {
      railEl.scrollTo({ left: target, behavior: reducedMotion() ? "auto" : "smooth" });
    } else {
      railEl.scrollLeft = target;
    }
  }

  /**
   * render({ reset }) — reads data (falling back to an empty shape on a
   * throwing readData), builds the view and draws it, then re-centres the
   * rail. The whole body is wrapped in one try/catch so a failing buildView
   * leaves the PREVIOUS DOM in place rather than breaking the tab switch.
   * `reset` zeroes the body's scroll position (a board or scope change);
   * a row toggle passes false so the list never jumps.
   */
  function render({ reset }) {
    let data;
    try {
      data = readData();
    } catch {
      data = { bests: null, graves: [], total: 0 };
    }
    try {
      const { signedIn, player } = readIdentity();
      const { all } = readSeasons();
      const snapshot = readGlobal(signedIn);
      const view = buildView({
        ...data,
        board,
        scope,
        open,
        entry,
        hasHero,
        signedIn,
        player,
        global: snapshot,
        season,
        seasons: all,
      });
      renderBoardsPanel(host, view, handlers);
      centreRail();
      if (reset) {
        const bodyEl = host.querySelector(".mw-bd-body");
        if (bodyEl) bodyEl.scrollTop = 0;
      }
    } catch {
      // a failing buildView/render must never break the tab switch — the
      // previous DOM (if any) is left exactly as it was.
    }
  }

  const handlers = {
    onBoard(id) {
      if (!BOARD_IDS.includes(id)) return;
      board = id;
      open = null;
      storeBoard(id);
      render({ reset: true });
    },
    onScope(id) {
      scope = scope === id ? "local" : id;
      open = null;
      render({ reset: true });
    },
    onRow(key) {
      open = open === key ? null : key;
      render({ reset: false });
    },
    onBack() {
      back();
    },
    onDock(id) {
      if (id === "title" || id === "roll" || id === "dungeon") route(id);
    },
    onSeason(n) {
      // Phase 68 (D-08): older seasons are read-only views; only a known season switches.
      if (!readSeasons().all.includes(n)) return;
      season = n;
      open = null;
      render({ reset: true });
    },
    onConsent() {
      // Phase 68 (D-06): the in-panel SHOW MY FRIENDS button.
      try {
        if (typeof onFriendsConsent === "function") onFriendsConsent();
      } catch {
        // a throwing consent handler must never break the panel.
      }
    },
  };

  function route(action) {
    const routedHasHero = hasHero;
    entry = null;
    clearTitleMarker();
    onRoute?.(action, { hasHero: routedHasHero });
  }

  function back() {
    if (entry !== "title") return false;
    route(hasHero ? "dungeon" : "title");
    return true;
  }

  function isTitleOpen() {
    return entry === "title";
  }

  function openFromTab() {
    entry = "tab";
    board = readStoredBoard() || "deep";
    scope = "local";
    open = null;
    season = readSeasons().current;
    clearTitleMarker();
    render({ reset: true });
  }

  function openFromTitle({ hasHero: h } = {}) {
    entry = "title";
    hasHero = !!h;
    board = "yard"; // D-04: the title's button reads "View the Dead".
    scope = "local";
    open = null;
    season = readSeasons().current;
    doc.body.dataset.boardsEntry = "title";
    render({ reset: true });
  }

  function onDeadTab() {
    if (entry === "title") {
      centreRail();
      return;
    }
    openFromTab();
  }

  function refresh() {
    if (entry !== null) render({ reset: false });
  }

  function state() {
    return Object.freeze({ entry, board, scope, open, hasHero, season });
  }

  return Object.freeze({ openFromTab, openFromTitle, onDeadTab, back, isTitleOpen, centreRail, refresh, state });
}
