// src/browser/accountChip.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1) — the account chip/sheet/☰-block
// DOM renderers, and the account controller that drives our own board's
// handle-and-Compete account.
//
// The renderers reach the page only through the host element's own
// ownerDocument and build DOM only with createElement/className/textContent/
// setAttribute/dataset/style/disabled/onclick/appendChild/replaceChildren
// (never an HTML-string assignment). Every word they draw comes from the
// view (content/account.js through src/browser/account.js); this module
// imports no copy of its own. Each renderer hands the raw click event to its
// handler as the trailing argument, so the shell decides whether the ☰
// closes (85-CONTEXT: the shell keeps it open for COMPETE/re-roll and closes
// it only on the confirming erase tap).
//
// The controller (createAccountController) owns every account transition: a
// handle rolled at boot with no network (the injected identity seam's own
// ensureHandle()), Compete purging the board queue when it goes off and
// flushing it when it comes back on, re-rolling through the board seam,
// the two-tap erase (arm/expire/erase/notify) and the once-ever welcome
// card. The identity and board seams are both injected (85-02 builds the
// board side; 85-04 wires them), so this module names neither a plugin nor
// any game-service seam. There is no window/document global, no storage
// except through the injected settings functions, and no network.

import {
  normalizeAccountState,
  accountCard,
  accountChipView,
  accountSheetView,
  accountMenuView,
} from "./account.js";
import { isValidHandle } from "./handles.js";
import { ABANDON_ARM_MS } from "./hudMenu.js";

/**
 * ACCOUNT_CLASSES — every class name the renderers emit. test/unit/
 * account-layout.test.js's CSS test pins this exact list and asserts each
 * has a rule. The "active" modifier on .mw-acct-opt is a state, not part of
 * the contract.
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

/** ERASE_ARM_MS — how long an armed ERASE MY RUNS row waits for its second tap, matching the ☰ menu's own ABANDON THIS CHARACTER arm (hudMenu.js). */
export const ERASE_ARM_MS = ABANDON_ARM_MS;

// ─── small DOM builders (module-private) ─────────────────────────────────

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (typeof text === "string") e.textContent = text;
  return e;
}

/**
 * paintFace(doc, face, view) — draws a face ({ face, initials, bg, glyph })
 * into an existing .mw-acct-face element: the initials on an inline
 * background for "avatar", the dim glyph with no background otherwise
 * ("pending" or "nobody").
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
 * renderAccountChip(button, view) — the title chip's face. Reuses the
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
    btn.onclick = (event) => handlers.onCompete?.(opt.value, event);
    options.appendChild(btn);
  }
  row.appendChild(options);
  return row;
}

function buildReroll(doc, reroll, handlers) {
  const btn = el(doc, "button", "mw-acct-action", String(reroll.label ?? ""));
  btn.type = "button";
  btn.dataset.action = "reroll";
  btn.disabled = reroll.disabled === true;
  btn.onclick = (event) => {
    if (reroll.disabled === true) return;
    handlers.onReroll?.(event);
  };
  return btn;
}

function buildErase(doc, erase, handlers) {
  const btn = el(doc, "button", "mw-acct-action", String(erase.label ?? ""));
  btn.type = "button";
  btn.dataset.action = "erase";
  btn.dataset.armed = erase.armed === true ? "1" : "0";
  btn.disabled = erase.disabled === true;
  btn.onclick = (event) => {
    if (erase.disabled === true) return;
    handlers.onErase?.(event);
  };
  return btn;
}

/**
 * renderAccountSheet({ rows, title }, view, handlers = {}) — the bottom
 * sheet's rows: the identity block (face, name, status), the Compete
 * ON/OFF toggle, the help line, RE-ROLL HANDLE, ERASE MY RUNS and Settings,
 * replacing the previous rows on every call. Handlers (all optional):
 * onCompete(value, event), onReroll(event), onErase(event), onSettings
 * (event) — each receives the raw click event as its trailing argument. A
 * disabled reroll/erase button never calls its handler.
 */
export function renderAccountSheet({ rows, title } = {}, view, handlers = {}) {
  if (!view) return;
  const h = handlers || {};
  if (title) title.textContent = String(view.title ?? "");
  if (!rows) return;
  const doc = rows.ownerDocument;

  const children = [buildIdentity(doc, view.identity || {})];
  children.push(buildCompete(doc, view.compete || {}, h));
  if (typeof view.help === "string" && view.help) children.push(el(doc, "p", "mw-acct-help", view.help));
  children.push(buildReroll(doc, view.reroll || {}, h));
  children.push(buildErase(doc, view.erase || {}, h));

  const settings = el(doc, "button", "mw-acct-settings", String(view.settings?.label ?? ""));
  settings.type = "button";
  settings.onclick = (event) => h.onSettings?.(event);
  children.push(settings);

  rows.replaceChildren(...children);
}

/**
 * renderMenuFace(button, view) — paints the ☰ button's face from an
 * accountMenuView. Repaints only the button's existing .mw-hud-menu-face
 * (the shell's static markup) and the button's aria-label; a null button, a
 * null view or a button without that face is a no-op that creates nothing.
 * "avatar" gets one .mw-acct-initials child on an inline background;
 * "menu" gets the ☰ glyph as plain text with no background.
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
 * the ☰ dropdown, from an accountSheetView. Replaces the host's children on
 * every call with the identity block, the Compete toggle, the help line,
 * RE-ROLL HANDLE and ERASE MY RUNS. Deliberately no title and no Settings
 * row: the ☰ already has SETTINGS. Handlers: the same signatures as
 * renderAccountSheet's. A null host or view is a no-op.
 */
export function renderAccountMenu(host, view, handlers = {}) {
  if (!host || !view) return;
  const h = handlers || {};
  const doc = host.ownerDocument;
  const children = [buildIdentity(doc, view.identity || {})];
  children.push(buildCompete(doc, view.compete || {}, h));
  if (typeof view.help === "string" && view.help) children.push(el(doc, "p", "mw-acct-help", view.help));
  children.push(buildReroll(doc, view.reroll || {}, h));
  children.push(buildErase(doc, view.erase || {}, h));
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
 * createAccountController({ identity, board, settings, notify, compete,
 * armMs, setTimer, clearTimer }) — the one place every account behaviour is
 * decided.
 *
 *   identity  { ensureHandle() -> Promise<string> } — local-only, no network.
 *   board     { reroll() -> Promise<{handle, previous}>, erase() ->
 *               Promise<{ok, deleted?, reason?}>, purge() -> Promise,
 *               flush({force}) -> Promise } — every call is Compete-gated
 *               by the board seam itself, never by this module reaching
 *               past the seam.
 *   settings  { read, write }: the shell passes readSettings/writeSetting.
 *              Only the `compete` and `boardWelcomed` keys are ever written.
 *   notify    notify(card) receives an accountCard object; the shell hands
 *             it to the rail (never a modal).
 *   compete   the initial Compete value the shell already read (default
 *             true) — the state before boot() resolves.
 *   armMs     the erase row's arm window (default ERASE_ARM_MS).
 *
 * Returns a frozen { boot, setCompete, reroll, eraseTap, disarmErase,
 * boardAcked, state, chipView, sheetView, menuView, subscribe }. No method
 * ever throws or rejects.
 *
 * - boot() (memoized): reads the settings (compete unless the player
 *   already chose via setCompete; welcomed from boardWelcomed === true) and
 *   sets the handle from identity.ensureHandle(). A throwing/rejecting seam
 *   leaves the handle null. boot never calls the board.
 * - setCompete(value): only true (or the string "true") turns it on. false
 *   emits at once, disarms an armed erase row, persists compete false and
 *   calls board.purge() once; true emits, persists and calls
 *   board.flush({force: true}) once. A repeated value is a no-op.
 * - reroll(): with a handle, calls board.reroll() once; a second call while
 *   one is in flight is ignored; a valid returned handle replaces the
 *   state's handle, an invalid or rejected result leaves it unchanged. With
 *   no handle, does nothing.
 * - eraseTap(): idle -> armed (one timer of armMs that disarms); armed -> a
 *   second tap goes busy and calls board.erase() once — ok raises one
 *   "erased" card naming the handle, a failure or rejection raises one
 *   "eraseFailed" card, then idle either way; busy ignores taps; with
 *   Compete off or no handle, does nothing. disarmErase() returns an armed
 *   row to idle and clears the timer (a no-op otherwise).
 * - boardAcked(): the first call ever (welcomed false, including a boot
 *   that already read boardWelcomed true) persists boardWelcomed true and
 *   raises one "welcome" card naming the handle; every later call raises
 *   nothing.
 * - subscribe(fn) hears every state change. A throwing listener never
 *   breaks the others.
 */
export function createAccountController({
  identity,
  board,
  settings,
  notify,
  compete = true,
  armMs = ERASE_ARM_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let current = normalizeAccountState({ compete, handle: null, erase: "idle", welcomed: false });
  let booted = null; // boot()'s memoized promise
  let welcomed = false; // mirrors the persisted boardWelcomed flag
  let userSet = false; // setCompete ran: the player's choice outranks a late settings read
  let rerolling = false; // one reroll() in flight at a time
  let eraseTimer = null; // the armed erase row's expiry timer
  const listeners = new Set();

  function emit(patch) {
    current = normalizeAccountState({ ...current, ...patch, welcomed });
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

  function raise(card) {
    if (card === null) return;
    try {
      notify?.(card);
    } catch {
      // a rail failure never breaks the account flow
    }
  }

  function clearEraseTimer() {
    if (eraseTimer === null) return;
    const t = eraseTimer;
    eraseTimer = null;
    try {
      clearTimer(t);
    } catch {
      // a broken timer never breaks the account flow
    }
  }

  function boot() {
    if (booted) return booted;
    // Both seams are called synchronously, in the same tick as boot() itself
    // (never sequenced one after the other) — the handle exists offline and
    // owes nothing to how long the settings read takes.
    const handlePromise = (async () => {
      try {
        return await identity.ensureHandle();
      } catch {
        return null;
      }
    })();
    const settingsPromise = (async () => {
      try {
        return await settings.read();
      } catch {
        return null;
      }
    })();
    booted = (async () => {
      const stored = await settingsPromise;
      welcomed = welcomed || field(stored, "boardWelcomed") === true;
      const patch = {};
      if (!userSet) patch.compete = field(stored, "compete") !== false;
      patch.handle = await handlePromise;
      emit(patch);
    })();
    return booted;
  }

  function setCompete(on) {
    const value = on === true || on === "true";
    userSet = true;
    if (value === current.compete) return;
    clearEraseTimer();
    const patch = { compete: value };
    if (current.erase === "armed") patch.erase = "idle";
    emit(patch);
    persist("compete", value);
    if (value) {
      try {
        Promise.resolve(board.flush({ force: true })).catch(() => {});
      } catch {
        // a board failure never breaks the account flow
      }
    } else {
      try {
        Promise.resolve(board.purge()).catch(() => {});
      } catch {
        // a board failure never breaks the account flow
      }
    }
  }

  function reroll() {
    if (current.handle === null || rerolling) return;
    rerolling = true;
    let call;
    try {
      call = board.reroll();
    } catch {
      call = Promise.resolve(null);
    }
    Promise.resolve(call)
      .then(
        (result) => {
          const h = field(result, "handle");
          if (isValidHandle(h)) emit({ handle: h });
        },
        () => {
          // a rejected reroll leaves the handle unchanged
        },
      )
      .then(() => {
        rerolling = false;
      });
  }

  function eraseTap() {
    if (!current.compete || current.handle === null) return;
    if (current.erase === "busy") return;
    if (current.erase === "armed") {
      clearEraseTimer();
      const handleAtCall = current.handle;
      emit({ erase: "busy" });
      let call;
      try {
        call = board.erase();
      } catch {
        call = Promise.resolve(null);
      }
      Promise.resolve(call)
        .then(
          (result) => {
            if (field(result, "ok") === true) raise(accountCard("erased", handleAtCall));
            else raise(accountCard("eraseFailed"));
          },
          () => raise(accountCard("eraseFailed")),
        )
        .then(() => {
          emit({ erase: "idle" });
        });
      return;
    }
    emit({ erase: "armed" });
    try {
      eraseTimer = setTimer(() => {
        eraseTimer = null;
        disarmErase();
      }, armMs);
    } catch {
      eraseTimer = null;
    }
  }

  function disarmErase() {
    if (current.erase !== "armed") return;
    clearEraseTimer();
    emit({ erase: "idle" });
  }

  function boardAcked() {
    if (welcomed) return;
    welcomed = true;
    persist("boardWelcomed", true);
    raise(accountCard("welcome", current.handle));
    emit({});
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
    setCompete,
    reroll,
    eraseTap,
    disarmErase,
    boardAcked,
    state: () => current,
    chipView: () => accountChipView(current),
    sheetView: () => accountSheetView(current),
    menuView: () => accountMenuView(current),
    subscribe,
  });
}
