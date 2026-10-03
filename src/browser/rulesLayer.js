// src/browser/rulesLayer.js
//
// Phase 95 (FLAVOR-05; CONTEXT 'Where the exact numbers live'): the one RULES
// surface every description uses (and Phase 96 reuses). Flavour first, the
// exact rules one tap away.
//
// A reveal is an inspection, not a decision: the toggle is a plain onclick that
// flips the DOM in place and never renders, dispatches or touches game state.
// The open ids live in a module-level set, so a repaint keeps a revealed line
// open. "Always show the rules" (the Settings switch) renders every rules body
// open with no toggle.
//
// No window or document globals: callers pass `doc`. See docs/TEXT-LAYERS.md.

/**
 * RULES_COPY — the toggle's own words. `label` carries one {name} slot.
 */
export const RULES_COPY = Object.freeze({
  closed: "RULES ▸",
  open: "RULES ▾",
  label: "Rules for {name}",
});

let always = false;
const opened = new Set();

/** setAlwaysRules(on) — the Settings switch; only a literal true turns it on. */
export function setAlwaysRules(on) {
  always = on === true;
}

/** alwaysRules() — whether every rules body renders open with no toggle. */
export function alwaysRules() {
  return always;
}

/** rulesOpen(id) — whether the id's rules body is revealed. */
export function rulesOpen(id) {
  return opened.has(String(id));
}

/** toggleRulesOpen(id) — flips the id and returns the new state. */
export function toggleRulesOpen(id) {
  const k = String(id);
  if (opened.has(k)) {
    opened.delete(k);
    return false;
  }
  opened.add(k);
  return true;
}

/** clearRulesOpen() — empties the open set (tests, a new run). */
export function clearRulesOpen() {
  opened.clear();
}

/**
 * layerText({ flavor, rules }) — the layering rule. With flavour, the flavour
 * leads and the rules go behind the toggle; with none, today's rules text
 * leads and there is nothing to hide.
 */
export function layerText({ flavor, rules } = {}) {
  const f = typeof flavor === "string" ? flavor : "";
  const r = typeof rules === "string" ? rules : "";
  if (f) return { lead: f, rules: r };
  return { lead: r, rules: "" };
}

const entriesOf = (rules) => {
  const list = Array.isArray(rules) ? rules : [rules];
  return list.filter((s) => typeof s === "string" && s !== "");
};

const bodyIdOf = (id) => "mw-rules-" + String(id).replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * Builds the pair for one host. Returns null when there are no rules to hide.
 */
function build(doc, { id, name, rules, lineClass }) {
  const lines = entriesOf(rules);
  if (!lines.length) return null;
  const key = String(id);
  const bodyId = bodyIdOf(key);

  const body = doc.createElement("div");
  body.className = "mw-rules-body";
  body.id = bodyId;
  for (const text of lines) {
    const p = doc.createElement("p");
    p.className = lineClass ? "mw-rules-line " + lineClass : "mw-rules-line";
    p.textContent = text;
    body.appendChild(p);
  }

  if (always) {
    body.hidden = false;
    return { button: null, body };
  }

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "mw-rules-btn";
  button.setAttribute("type", "button");
  button.setAttribute("aria-controls", bodyId);
  button.setAttribute("aria-label", RULES_COPY.label.replace("{name}", String(name ?? "")));

  const sync = () => {
    const on = rulesOpen(key);
    body.hidden = !on;
    button.setAttribute("aria-expanded", on ? "true" : "false");
    button.textContent = on ? RULES_COPY.open : RULES_COPY.closed;
  };
  sync();

  // An inspection, never a decision: a plain onclick, no guardTap, no render.
  button.onclick = (e) => {
    e?.stopPropagation?.();
    toggleRulesOpen(key);
    sync();
  };
  return { button, body };
}

/**
 * mountRules(doc, host, { id, name, rules, lineClass }) — appends the RULES
 * toggle and its body to a content block. Returns { button, body } (button
 * null when always on) or null when there is no rules text.
 */
export function mountRules(doc, host, spec) {
  const pair = build(doc, spec || {});
  if (!pair) return null;
  if (pair.button) host.appendChild(pair.button);
  host.appendChild(pair.body);
  return pair;
}

/**
 * wrapRow(doc, rowEl, { id, name, rules, lineClass }) — the sibling pattern for
 * action-row hosts: the toggle sits beside the row's own button, never inside
 * it. Returns rowEl itself when there are no rules; otherwise a div.mw-rules-wrap
 * holding rowEl, the toggle (unless always on) and the body.
 */
export function wrapRow(doc, rowEl, spec) {
  const pair = build(doc, spec || {});
  if (!pair) return rowEl;
  const wrap = doc.createElement("div");
  wrap.className = "mw-rules-wrap";
  wrap.appendChild(rowEl);
  if (pair.button) wrap.appendChild(pair.button);
  wrap.appendChild(pair.body);
  return wrap;
}
