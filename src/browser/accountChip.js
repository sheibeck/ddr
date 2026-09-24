// src/browser/accountChip.js
//
// Phase 67 (ACCT-01/02, PGS-02) — the account chip and its bottom sheet's DOM
// renderers, and the account controller that runs sign-in.
//
// The renderers reach the page only through the host element's own
// ownerDocument and build DOM only with createElement/className/textContent/
// setAttribute/dataset/style/disabled/onclick/appendChild/replaceChildren
// (never an HTML-string assignment). Every word they draw comes from the view
// (content/account.js through src/browser/account.js); this module imports no
// copy of its own. Every tap goes to an injected handler.
//
// The controller (createAccountController) owns every account transition:
// the silent launch attempt (D-01), Compete OFF meaning no provider call at
// all (D-02), Stop competing as Compete OFF with no sign-out (D-03), the
// once-per-install welcome card (D-04) and the single failed card with no
// automatic retry (D-11). The Play Games provider is injected (a provider
// from src/browser/playGames.js), so this module never names the plugin.
// There is no window/document global, no storage except through the injected
// settings functions, and no network.
//
// Phase 70 (POLISH-02, D-03/D-04): the ☰ menu button wears the account face
// (renderMenuFace, painting the shell's own .mw-hud-menu-face) and its
// dropdown carries the ACCOUNT block (renderAccountMenu: the sheet's rows
// without its title or Settings row, because the ☰ already has SETTINGS).
// The controller adds menuView(). The title keeps its chip and sheet.

import {
  ACCOUNT_STATUS,
  normalizeAccountState,
  accountCard,
  accountIdentity,
  accountChipView,
  accountSheetView,
  accountMenuView,
} from "./account.js";

/**
 * ACCOUNT_CLASSES — every class name the renderers emit. 67-05's CSS test
 * (test/unit/account-layout.test.js) pins this exact list and asserts each
 * has a rule. The "active" modifier on .mw-acct-opt is a state, not part of
 * the contract. Phase 70's menu renderers (renderMenuFace, renderAccountMenu)
 * emit only classes already listed here; the .mw-hud-menu-face they paint is
 * the shell's static markup, never created by a renderer.
 */
export const ACCOUNT_CLASSES = Object.freeze([
  "mw-acct-face",
  "mw-acct-initials",
  "mw-acct-glyph",
  "mw-acct-id",
  "mw-acct-id-text",
  "mw-acct-name",
  "mw-acct-status",
  "mw-acct-action",
  "mw-acct-help",
  "mw-acct-row",
  "mw-acct-label",
  "mw-acct-options",
  "mw-acct-opt",
  "mw-acct-settings",
]);

// ─── small DOM builders (module-private) ─────────────────────────────────

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (typeof text === "string") e.textContent = text;
  return e;
}

/**
 * paintFace(doc, face, view) — draws a face ({ face, initials, bg, glyph })
 * into an existing .mw-acct-face element (D-07): the initials on an inline
 * background for "avatar", the dim glyph with no background otherwise.
 */
function paintFace(doc, faceEl, view) {
  const avatar = view.face === "avatar";
  faceEl.dataset.state = String(view.face ?? "");
  faceEl.setAttribute("aria-hidden", "true");
  if (avatar) {
    faceEl.replaceChildren(el(doc, "span", "mw-acct-initials", String(view.initials ?? "")));
    faceEl.style.background = String(view.bg ?? "");
  } else {
    faceEl.replaceChildren(el(doc, "span", "mw-acct-glyph", String(view.glyph ?? "")));
    faceEl.style.background = "";
  }
  return faceEl;
}

/**
 * renderAccountChip(button, view) — the chip's face (D-07). Reuses the
 * button's existing .mw-acct-face child (the static markup's, or the one a
 * previous render made) so the element survives every re-render, creating
 * it only when missing. Sets the button's aria-label to view.label. A null
 * button is a no-op.
 */
export function renderAccountChip(button, view) {
  if (!button || !view) return;
  const doc = button.ownerDocument;
  let face = button.querySelector(".mw-acct-face");
  if (!face) {
    face = el(doc, "span", "mw-acct-face");
    button.appendChild(face);
  }
  paintFace(doc, face, view);
  button.setAttribute("aria-label", String(view.label ?? ""));
}

function buildIdentity(doc, identity) {
  const id = el(doc, "div", "mw-acct-id");
  id.appendChild(paintFace(doc, el(doc, "span", "mw-acct-face"), identity));
  const text = el(doc, "div", "mw-acct-id-text");
  text.appendChild(el(doc, "span", "mw-acct-name", String(identity.name ?? "")));
  text.appendChild(el(doc, "span", "mw-acct-status", String(identity.status ?? "")));
  id.appendChild(text);
  return id;
}

function buildAction(doc, action, handlers) {
  const btn = el(doc, "button", "mw-acct-action", String(action.label ?? ""));
  btn.type = "button";
  btn.dataset.action = String(action.id ?? "");
  btn.disabled = action.disabled === true;
  btn.onclick = () => {
    if (action.disabled === true) return;
    if (action.id === "signIn") handlers.onSignIn?.();
    else if (action.id === "stopCompeting") handlers.onStopCompeting?.();
  };
  return btn;
}

function buildCompete(doc, compete, handlers) {
  const row = el(doc, "div", "mw-acct-row");
  row.appendChild(el(doc, "span", "mw-acct-label", String(compete.label ?? "")));
  const options = el(doc, "div", "mw-acct-options");
  for (const opt of compete.options || []) {
    const active = opt.value === compete.on;
    const btn = el(doc, "button", active ? "mw-acct-opt active" : "mw-acct-opt", String(opt.label ?? ""));
    btn.type = "button";
    btn.dataset.value = String(opt.value);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.onclick = () => handlers.onCompete?.(opt.value);
    options.appendChild(btn);
  }
  row.appendChild(options);
  return row;
}

/**
 * renderAccountSheet({ rows, title }, view, handlers = {}) — the bottom
 * sheet's rows (D-09/D-10), replacing the previous rows on every call: the
 * identity block (face, name, status), then the one action the view allows
 * (Sign in / Stop competing / a disabled SIGNING IN…), the helper line when
 * the view has one, the Compete ON/OFF toggle and the Settings row. Handlers
 * (all optional): onSignIn, onStopCompeting, onCompete(value), onSettings.
 */
export function renderAccountSheet({ rows, title } = {}, view, handlers = {}) {
  if (!view) return;
  const h = handlers || {};
  if (title) title.textContent = String(view.title ?? "");
  if (!rows) return;
  const doc = rows.ownerDocument;

  const children = [buildIdentity(doc, view.identity || {})];
  if (view.action) children.push(buildAction(doc, view.action, h));
  if (typeof view.help === "string" && view.help) children.push(el(doc, "p", "mw-acct-help", view.help));
  children.push(buildCompete(doc, view.compete || {}, h));

  const settings = el(doc, "button", "mw-acct-settings", String(view.settings?.label ?? ""));
  settings.type = "button";
  settings.onclick = () => h.onSettings?.();
  children.push(settings);

  rows.replaceChildren(...children);
}

/**
 * renderMenuFace(button, view) — paints the ☰ button's face from an
 * accountMenuView (Phase 70 D-03). Repaints only the button's existing
 * .mw-hud-menu-face (the shell's static markup) and the button's aria-label;
 * a null button, a null view or a button without that face is a no-op that
 * creates nothing. "avatar" gets one .mw-acct-initials child on an inline
 * background; "menu" gets the ☰ glyph as plain text with no background.
 */
export function renderMenuFace(button, view) {
  if (!button || !view) return;
  const face = button.querySelector(".mw-hud-menu-face");
  if (!face) return;
  const doc = button.ownerDocument;
  face.dataset.state = String(view.face ?? "");
  face.setAttribute("aria-hidden", "true");
  if (view.face === "avatar") {
    face.replaceChildren(el(doc, "span", "mw-acct-initials", String(view.initials ?? "")));
    face.style.background = String(view.bg ?? "");
  } else {
    face.replaceChildren();
    face.textContent = String(view.glyph ?? "");
    face.style.background = "";
  }
  button.setAttribute("aria-label", String(view.label ?? ""));
}

/**
 * renderAccountMenu(host, view, handlers = {}) — the ACCOUNT block inside
 * the ☰ dropdown (Phase 70 D-04), from an accountSheetView. Replaces the
 * host's children on every call with the identity block, the one action the
 * view allows, the helper line when present and the Compete ON/OFF toggle.
 * Deliberately no title and no Settings row: the ☰ already has SETTINGS.
 * Handlers (all optional): onSignIn, onStopCompeting, onCompete(value). A
 * null host or view is a no-op.
 */
export function renderAccountMenu(host, view, handlers = {}) {
  if (!host || !view) return;
  const h = handlers || {};
  const doc = host.ownerDocument;
  const children = [buildIdentity(doc, view.identity || {})];
  if (view.action) children.push(buildAction(doc, view.action, h));
  if (typeof view.help === "string" && view.help) children.push(el(doc, "p", "mw-acct-help", view.help));
  children.push(buildCompete(doc, view.compete || {}, h));
  host.replaceChildren(...children);
}

// ═══════════════════════ Task 2: the controller ═══════════════════════════

/** Read one field of an arbitrary value; a hostile getter reads as undefined. */
function field(obj, key) {
  if (obj === null || typeof obj !== "object") return undefined;
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

/**
 * createAccountController({ provider, settings, notify, timeoutMs, setTimer,
 * clearTimer }) — the one place every account behaviour is decided.
 *
 *   provider  a Play Games provider (src/browser/playGames.js); only its
 *             init() (silent) and signIn() (interactive) are ever called.
 *   settings  { read, write }: the shell passes readSettings/writeSetting.
 *             Only the `compete` and `pgsWelcomed` keys are ever written; the
 *             player's id and display name live in memory for the session.
 *   notify    notify(card) receives an accountCard object; the shell hands it
 *             to the rail (never a modal).
 *   timeoutMs the silent attempt's timeout (default 20000). The interactive
 *             attempt has none: the player is looking at Google's prompt.
 *
 * Returns a frozen { boot, signIn, setCompete, stopCompeting, state,
 * identity, chipView, sheetView, menuView, subscribe }. No method ever
 * throws or rejects. menuView() (Phase 70 D-03) is the ☰ face's view.
 *
 * - boot() (D-01/D-02), memoized: reads the settings; with Compete OFF it
 *   shows "off" and touches no provider method at all; with Compete ON it
 *   starts the silent attempt WITHOUT awaiting it, so the shell never waits
 *   on sign-in.
 * - A success signs in; the first ever success also persists pgsWelcomed and
 *   raises the welcome card (D-04). A failure, decline, throw, rejection or
 *   the silent timeout signs out and raises one failed card; nothing is
 *   scheduled after it (D-11): the next automatic attempt is the next launch
 *   and a manual retry comes only from signIn().
 * - One attempt at a time: signIn() runs only from "signedOut" with Compete
 *   ON. Every attempt carries a token; a result arriving after a newer
 *   attempt began, after Compete went OFF or after its own timeout fired is
 *   dropped. Compete OFF always wins.
 * - setCompete(value) is idempotent; false is Stop competing (D-03): it
 *   persists Compete OFF, invalidates any in-flight attempt and shows the
 *   nobody chip. No sign-out is called (the provider has none). Only true
 *   (or the string "true") turns Compete on.
 * - subscribe(fn) hears every state change (the shell re-renders the chips,
 *   the sheet and the Leaderboards panel; Phase 68 purges its queue on
 *   Compete OFF). A throwing listener never breaks the others.
 */
export function createAccountController({
  provider,
  settings,
  notify,
  timeoutMs = 20000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let current = normalizeAccountState({ compete: true, status: ACCOUNT_STATUS.PENDING });
  let seq = 0; // attempt token: bumping it invalidates any in-flight attempt
  let booted = null; // boot()'s memoized promise
  let welcomed = false; // mirrors the persisted pgsWelcomed flag
  let userSet = false; // setCompete ran: the player's choice outranks a late settings read
  let cancelTimeout = () => {}; // clears the in-flight silent attempt's timer
  const listeners = new Set();

  function emit(patch) {
    current = normalizeAccountState({
      compete: current.compete,
      status: current.status,
      player: current.player,
      ...patch,
      welcomed,
    });
    for (const fn of [...listeners]) {
      try {
        fn(current);
      } catch {
        // a broken listener never breaks the others or the controller
      }
    }
  }

  function persist(key, value) {
    try {
      Promise.resolve(settings.write(key, value)).catch(() => {});
    } catch {
      // storage trouble never breaks the account flow
    }
  }

  function raise(kind) {
    try {
      notify?.(accountCard(kind));
    } catch {
      // a rail failure never breaks the account flow
    }
  }

  function apply(result) {
    if (field(result, "signedIn") === true) {
      const firstTime = !welcomed;
      welcomed = true;
      emit({ status: ACCOUNT_STATUS.SIGNED_IN, player: field(result, "player") ?? null });
      if (firstTime) {
        persist("pgsWelcomed", true);
        raise("welcome");
      }
      return;
    }
    emit({ status: ACCOUNT_STATUS.SIGNED_OUT, player: null });
    raise("failed");
  }

  /**
   * run(kind) — calls the provider once ("silent" → init(), "interactive" →
   * signIn()) and settles the attempt. The state must already read pending.
   * Resolves when the attempt settles (applied or dropped); never rejects.
   */
  function run(kind) {
    const token = ++seq;
    cancelTimeout();
    let settled = false;
    let timer = null;
    let done;
    const finished = new Promise((resolve) => {
      done = resolve;
    });

    const clear = () => {
      if (timer === null) return;
      const t = timer;
      timer = null;
      try {
        clearTimer(t);
      } catch {
        // a broken timer never breaks the account flow
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clear();
      if (token === seq && current.compete) apply(result);
      done();
    };

    if (kind === "silent") {
      try {
        timer = setTimer(() => {
          timer = null;
          finish(null);
        }, timeoutMs);
      } catch {
        timer = null;
      }
      cancelTimeout = clear;
    } else {
      cancelTimeout = () => {};
    }

    let call;
    try {
      call = kind === "silent" ? provider.init() : provider.signIn();
    } catch {
      call = null;
    }
    Promise.resolve(call).then(finish, () => finish(null));
    return finished;
  }

  function attempt(kind) {
    emit({ status: ACCOUNT_STATUS.PENDING, player: null });
    return run(kind);
  }

  function boot() {
    if (booted) return booted;
    booted = (async () => {
      let stored = null;
      try {
        stored = await settings.read();
      } catch {
        stored = null;
      }
      welcomed = welcomed || field(stored, "pgsWelcomed") === true;
      if (userSet) return; // the player already chose while the settings were loading
      if (field(stored, "compete") === false) {
        emit({ compete: false, status: ACCOUNT_STATUS.OFF, player: null });
        return;
      }
      attempt("silent"); // deliberately not awaited (D-01: never blocks boot)
    })();
    return booted;
  }

  function signIn() {
    if (!current.compete || current.status !== ACCOUNT_STATUS.SIGNED_OUT) return Promise.resolve();
    return attempt("interactive");
  }

  function setCompete(on) {
    const value = on === true || on === "true";
    userSet = true;
    if (value === current.compete) return;
    if (!value) {
      seq += 1; // invalidates any in-flight attempt: Compete OFF always wins
      cancelTimeout();
      cancelTimeout = () => {};
      emit({ compete: false, status: ACCOUNT_STATUS.OFF, player: null });
      persist("compete", false);
      return;
    }
    emit({ compete: true, status: ACCOUNT_STATUS.PENDING, player: null });
    persist("compete", true);
    run("silent");
  }

  function stopCompeting() {
    setCompete(false);
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }

  return Object.freeze({
    boot,
    signIn,
    setCompete,
    stopCompeting,
    state: () => current,
    identity: () => accountIdentity(current),
    chipView: () => accountChipView(current),
    sheetView: () => accountSheetView(current),
    menuView: () => accountMenuView(current),
    subscribe,
  });
}
