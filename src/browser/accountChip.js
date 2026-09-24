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

/**
 * ACCOUNT_CLASSES — every class name the renderers emit. 67-05's CSS test
 * (test/unit/account-layout.test.js) pins this exact list and asserts each
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
