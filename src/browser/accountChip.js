// src/browser/accountChip.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — the
// account chip/sheet/☰-block DOM renderers, and the account controller that
// drives our own board's Play Games account: the player's verified name, the
// Compete toggle, the sign-in state and the two-tap erase.
//
// The renderers reach the page only through the host element's own
// ownerDocument and build DOM only with createElement/className/textContent/
// setAttribute/dataset/style/disabled/onclick/appendChild/replaceChildren
// (never an HTML-string assignment); a name reaches the page as text content
// only. Every word they draw comes from the view (content/account.js through
// src/browser/account.js); this module imports no copy of its own. Each
// renderer hands the raw click event to its handler as the trailing argument,
// so the shell decides whether the ☰ closes (the shell keeps it open for
// COMPETE and SIGN IN and closes it only on the confirming erase tap).
//
// The controller (createAccountController) owns every account transition: the
// name read locally at boot (the injected identity seam's snapshot(), no
// network), Compete purging the board queue when it goes off and running the
// interactive Play Games sign-in when it comes back on (Phase 92.1), the SIGN
// IN WITH PLAY GAMES tap,
// the session answers the board sync reports (sign-in state, the name, one
// rail card per launch when runs are waiting on a sign-in), the two-tap erase
// (arm/expire/erase/notify) and the once-ever welcome card that tells the
// player their Play Games name is public. The identity and board seams are
// both injected, so this module names neither a plugin nor any game-service
// seam. There is no window/document global, no storage except through the
// injected settings functions, and no network.

import {
  normalizeAccountState,
  accountCard,
  accountChipView,
  accountSheetView,
  accountMenuView,
} from "./account.js";
import { sanitizeBoardName } from "./boardName.js";
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

/**
 * buildSignIn(doc, signIn, handlers) — the SIGN IN WITH PLAY GAMES row. It is
 * always built, so the row keeps its place; when the view says it is not
 * visible it carries the hidden attribute and an inline display of none (the
 * action class sets a display of its own, which would otherwise beat the
 * attribute). A hidden or disabled row never calls its handler.
 */
function buildSignIn(doc, signIn, handlers) {
  const btn = el(doc, "button", "mw-acct-action", String(signIn.label ?? ""));
  const visible = signIn.visible === true;
  btn.type = "button";
  btn.dataset.action = "signin";
  btn.disabled = signIn.disabled === true;
  if (!visible) {
    btn.hidden = true;
    btn.style.display = "none";
  }
  btn.onclick = (event) => {
    if (!visible || signIn.disabled === true) return;
    handlers.onSignIn?.(event);
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
 * ON/OFF toggle, the help line, SIGN IN WITH PLAY GAMES (hidden unless needed), ERASE MY RUNS and Settings,
 * replacing the previous rows on every call. Handlers (all optional):
 * onCompete(value, event), onSignIn(event), onErase(event), onSettings
 * (event) — each receives the raw click event as its trailing argument. A
 * hidden or disabled sign-in, or a disabled erase, button never calls its handler.
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
  children.push(buildSignIn(doc, view.signIn || {}, h));
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
 * SIGN IN WITH PLAY GAMES (hidden unless needed) and ERASE MY RUNS. Deliberately no title and no Settings
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
  children.push(buildSignIn(doc, view.signIn || {}, h));
  children.push(buildErase(doc, view.erase || {}, h));
  host.replaceChildren(...children);
}

// ═══════════════════════ the controller ═══════════════════════════════════

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
 *   identity  { snapshot() -> { name } | Promise<{ name }> } — the player's
 *             verified Play Games name as last stored on this phone; local
 *             only, no network.
 *   board     { session() / signIn() -> Promise<{ state, name }> (the board
 *               sync's session answer: signedIn, signedOut, unavailable,
 *               offline, error or off),
 *             erase() -> Promise<{ ok, deleted?, reason? }>,
 *             purge() -> Promise, flush({ force }) -> Promise } — every call
 *             is Compete-gated by the board seam itself, never by this
 *             module reaching past the seam.
 *   settings  { read, write }: the shell passes readSettings/writeSetting.
 *             Only the `compete` and `nameWelcomed` keys are ever written.
 *   notify    notify(card) receives an accountCard object; the shell hands
 *             it to the rail (never a modal).
 *   compete   the initial Compete value the shell already read (default
 *             true) — the state before boot() resolves.
 *   armMs     the erase row's arm window (default ERASE_ARM_MS).
 *
 * Returns a frozen { boot, setCompete, signInTap, sessionChanged, eraseTap,
 * disarmErase, boardAcked, state, chipView, sheetView, menuView, subscribe }.
 * No method ever throws or rejects. There is no way to change the name here:
 * it only ever arrives from the identity snapshot or a session answer.
 *
 * - boot() (memoized): reads the settings (compete unless the player already
 *   chose via setCompete; nameWelcomed === true) and the identity snapshot in
 *   the same tick, and puts the snapshot's name in the state. A throwing or
 *   rejecting seam leaves the name null. boot never calls the board.
 * - setCompete(value): only true (or the string "true") turns it on. false
 *   emits at once, disarms an armed erase row, persists compete false and
 *   calls board.purge() once; true emits, persists and runs the interactive
 *   Play Games sign-in once (board.signIn(), the same call the SIGN IN row
 *   makes: Phase 92.1, a Compete turned ON mid-session starts the Play Games
 *   SDK if this launch never did and asks the player to sign in right away,
 *   then the board's normal session/claim flow posts whatever was held). A
 *   repeated value is a no-op.
 * - sessionChanged(info): the board sync's session answer. signedIn -> signin
 *   "in" and the answer's name; signedOut -> signin "out" and, once per
 *   launch while Compete is ON, one "signinNeeded" rail card (the held runs
 *   notice); unavailable -> signin "unavailable"; offline, error and off
 *   leave the sign-in state alone. Ignored while Compete is OFF.
 * - signInTap(): with Compete ON and no sign-in already running, goes busy,
 *   calls board.signIn() once and feeds the answer through sessionChanged; a
 *   rejection, or an answer that leaves it busy, reads as signed out. Tapping
 *   the row also counts as the player knowing runs are waiting, so the
 *   notice card is not raised after it.
 * - eraseTap(): idle -> armed (one timer of armMs that disarms); armed -> a
 *   second tap goes busy and calls board.erase() once — ok raises one
 *   "erased" card naming the name held at that tap, a failure or rejection
 *   raises one "eraseFailed" card, then idle either way; busy ignores taps;
 *   with Compete off or no name, does nothing. disarmErase() returns an armed
 *   row to idle and clears the timer (a no-op otherwise).
 * - boardAcked(): the first call ever with a name (nameWelcomed false) persists
 *   nameWelcomed true and raises one "welcome" card naming the Play Games
 *   name and saying it is public; with no name yet, or once welcomed, it
 *   raises and persists nothing.
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
  let current = normalizeAccountState({ compete, name: null, signin: "unknown", erase: "idle", welcomed: false });
  let booted = null; // boot()'s memoized promise
  let welcomed = false; // mirrors the persisted nameWelcomed flag
  let userSet = false; // setCompete ran: the player's choice outranks a late settings read
  let signinNoted = false; // the held-runs notice was raised (or made moot) this launch
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
    // (never sequenced one after the other) — the stored name exists offline
    // and owes nothing to how long the settings read takes.
    const snapshotPromise = (async () => {
      try {
        return await identity.snapshot();
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
      welcomed = welcomed || field(stored, "nameWelcomed") === true;
      const patch = {};
      if (!userSet) patch.compete = field(stored, "compete") !== false;
      patch.name = field(await snapshotPromise, "name");
      emit(patch);
    })();
    return booted;
  }

  function sessionChanged(info) {
    if (!current.compete) return;
    const state = field(info, "state");
    if (state === "signedIn") {
      const name = sanitizeBoardName(field(info, "name"));
      emit({ signin: "in", name: name !== null ? name : current.name });
    } else if (state === "signedOut") {
      emit({ signin: "out" });
      if (!signinNoted) {
        signinNoted = true;
        raise(accountCard("signinNeeded"));
      }
    } else if (state === "unavailable") {
      emit({ signin: "unavailable" });
    }
    // offline, error and off say nothing new about who is signed in
  }

  /** askBoard(call) — runs a board session call and feeds its answer through sessionChanged; resolves when done, never rejects. */
  function askBoard(call) {
    let promise;
    try {
      promise = Promise.resolve(call());
    } catch {
      promise = Promise.reject(new Error("board call failed"));
    }
    return promise.then(
      (result) => {
        sessionChanged(result);
      },
      () => {
        // a failed session leaves the sign-in state as it was
      },
    );
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
      startSignIn();
    } else {
      try {
        Promise.resolve(board.purge()).catch(() => {});
      } catch {
        // a board failure never breaks the account flow
      }
    }
  }

  // startSignIn() — the interactive sign-in shared by the SIGN IN row and a
  // Compete turned ON. The player is being asked right now, so the held-runs
  // notice is moot (signinNoted); an answer that leaves it busy reads as
  // signed out.
  function startSignIn() {
    signinNoted = true;
    emit({ signin: "busy" });
    return askBoard(() => board.signIn()).then(() => {
      if (current.signin === "busy") emit({ signin: "out" });
    });
  }

  function signInTap() {
    if (!current.compete || current.signin === "busy") return;
    startSignIn();
  }

  function eraseTap() {
    if (!current.compete || current.name === null) return;
    if (current.erase === "busy") return;
    if (current.erase === "armed") {
      clearEraseTimer();
      const nameAtCall = current.name;
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
            if (field(result, "ok") === true) raise(accountCard("erased", nameAtCall));
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
    if (welcomed || current.name === null) return;
    welcomed = true;
    persist("nameWelcomed", true);
    raise(accountCard("welcome", current.name));
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
    signInTap,
    sessionChanged,
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
