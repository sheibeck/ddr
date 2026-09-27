// src/browser/finalSheet.js
//
// Phase 78 (HUD-03), Plan 06 — the FINAL SHEET: a read-only look at the run
// that just ended. The user's 2026-09-24 ruling: "a FINAL SHEET button on
// the DEAD screen opens the Hero tab's character sheet in READ-ONLY mode:
// stats, level, gear, grimoire and the epitaph, with no action buttons".
//
// Read-only by construction:
//   - finalSheetViewModel(state) only COMPOSES the Hero and Gear tabs' own
//     view models (heroTab.js#characterSheetViewModel/#grimoireViewModel,
//     gearTab.js#gearWornModel/#gearBagCardsModel). It never restates a rule,
//     never mutates the state and never reaches an engine action.
//   - renderFinalSheet(host, vm) builds its DOM only through
//     host.ownerDocument with createElement/textContent/className. It
//     creates no control of any kind and binds no handler. The sheet's one
//     control is the shell's own CLOSE (and its scrim), which live in
//     mazeworld.html's #mw-final-sheet markup, not here.
//   - No window/document globals, no timers, no storage.
//
// Every string reaches the DOM verbatim through textContent: names and
// epitaphs keep their em dashes, U+2212 minus signs and U+2013 ranges, and
// nothing is shortened in JS (the CSS wraps long lines inside the sheet).

import { ROMAN } from "../../content/index.js";
import { characterSheetViewModel, grimoireViewModel } from "./heroTab.js";
import { gearWornModel, gearBagCardsModel } from "./gearTab.js";

/**
 * FINAL_SHEET_COPY — every word the sheet adds of its own. The rest comes
 * from the Hero and Gear tabs' view models (and so from their own copy
 * banks). HP, never WP.
 */
export const FINAL_SHEET_COPY = Object.freeze({
  title: "FINAL SHEET",
  who: "THE DECEASED",
  stats: "STATS",
  tricks: "WHAT THEY COULD DO",
  worn: "WORN",
  bag: "THE BAG",
  book: "THE BOOK",
  death: "HOW IT ENDED",
  level: "LEVEL {n}",
  hp: "HP 0/{max}",
  spellLevel: "Lvl {n}",
  epitaph: "EPITAPH",
  cause: "CAUSE",
  depth: "DEPTH",
  day: "DAY",
  squares: "SQUARES",
  tricksNone: "No special skills. They got by on optimism.",
  bookNone: "No book. Their spells were mostly hitting things.",
  bookEmpty: "An empty book. A wizard in name, and in name only.",
  bagEmpty: "An empty bag. Travelling light, all the way down.",
});

/** emptyModel() — the shape every section keeps when there is no hero to show. */
function emptyModel() {
  return {
    empty: true,
    who: { name: "", lineage: "", cls: "", level: "", hp: "" },
    stats: [],
    tricks: { rows: [], emptyLine: "" },
    worn: [],
    bag: { names: [], emptyLine: "" },
    book: { spells: [], emptyLine: "" },
    death: { epitaph: "", cause: "", facts: [] },
  };
}

const str = (v) => (v === undefined || v === null ? "" : String(v));

/**
 * finalSheetViewModel(state) — the run that just ended, as display strings.
 *
 * Returns { empty, who, stats, tricks, worn, bag, book, death }:
 *   - who: { name, lineage ("Race Sub-class"), cls, level ("LEVEL IV"), hp ("HP 0/max") }
 *   - stats: [{ key, label, value }] — characterSheetViewModel's rows, value as a string
 *   - tricks: { rows: [{ name, description }], emptyLine } — skills then abilities,
 *     name and description only (no ready or cooldown state)
 *   - worn: [{ key, label, filled, name, value, note }] — gearWornModel's rows, in GEAR_WORN_ORDER
 *   - bag: { names, emptyLine } — gearBagCardsModel's item names
 *   - book: { spells: [{ name, level ("Lvl 1") }], emptyLine } — grimoireViewModel's rows
 *   - death: { epitaph, cause, facts: [{ key, label, value }] } — depth, day, squares
 *
 * A null, missing or hero-less state gives the empty model and never throws.
 * A missing epitaph or death note is an empty string (the renderer leaves
 * that line out). Pure: no rng, no mutation, no engine action.
 */
export function finalSheetViewModel(state) {
  if (!state || typeof state !== "object" || !state.c || typeof state.c !== "object") return emptyModel();
  const c = state.c;
  const vm = emptyModel();
  vm.empty = false;

  const level = Number.isInteger(c.level) && c.level > 0 ? c.level : 1;
  vm.who = {
    name: str(c.name),
    lineage: [c.race, c.sub].filter(Boolean).join(" "),
    cls: str(c.cls),
    level: FINAL_SHEET_COPY.level.replace("{n}", ROMAN[level - 1] ?? String(level)),
    hp: FINAL_SHEET_COPY.hp.replace("{max}", str(c.maxWP ?? 0)),
  };

  let sheet = null;
  try {
    sheet = characterSheetViewModel(state);
  } catch {
    sheet = null;
  }
  if (sheet) {
    vm.stats = sheet.stats.map((r) => ({ key: r.key, label: str(r.label), value: str(r.value) }));
    vm.tricks.rows = [...(sheet.skills || []), ...(sheet.abilities || [])].map((r) => ({
      name: str(r.name),
      description: str(r.description),
    }));
  }
  vm.tricks.emptyLine = vm.tricks.rows.length ? "" : FINAL_SHEET_COPY.tricksNone;

  try {
    vm.worn = gearWornModel(state).rows.map((r) => ({
      key: r.key,
      label: str(r.label),
      filled: !!r.filled,
      name: str(r.name),
      value: str(r.value),
      note: str(r.note),
    }));
  } catch {
    vm.worn = [];
  }

  try {
    vm.bag.names = gearBagCardsModel(state).map((card) => str(card.name));
  } catch {
    vm.bag.names = [];
  }
  vm.bag.emptyLine = vm.bag.names.length ? "" : FINAL_SHEET_COPY.bagEmpty;

  let book = null;
  try {
    book = grimoireViewModel(state);
  } catch {
    book = null;
  }
  vm.book.spells = book ? book.rows.map((r) => ({ name: str(r.name), level: FINAL_SHEET_COPY.spellLevel.replace("{n}", str(r.lvl)) })) : [];
  vm.book.emptyLine = vm.book.spells.length ? "" : c.cls === "Magic User" ? FINAL_SHEET_COPY.bookEmpty : FINAL_SHEET_COPY.bookNone;

  const depth = state.floor && state.floor.depth;
  vm.death = {
    epitaph: str(state.epitaph),
    cause: str(state.deathNote),
    facts: [
      { key: "depth", label: FINAL_SHEET_COPY.depth, value: str(depth ?? "") },
      { key: "day", label: FINAL_SHEET_COPY.day, value: str(state.day ?? "") },
      { key: "squares", label: FINAL_SHEET_COPY.squares, value: str(state.steps ?? "") },
    ].filter((f) => f.value !== ""),
  };
  return vm;
}

/**
 * FINAL_SHEET_CLASSES — every class name renderFinalSheet emits, so the
 * shell's CSS test can walk it.
 */
export const FINAL_SHEET_CLASSES = Object.freeze([
  "mw-fs",
  "mw-fs-sec",
  "mw-fs-head",
  "mw-fs-name",
  "mw-fs-line",
  "mw-fs-row",
  "mw-fs-k",
  "mw-fs-v",
  "mw-fs-note",
  "mw-fs-empty",
  "mw-fs-epitaph",
]);

function el(doc, tag, cls, text) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** section(doc, heading) — a <section> with its heading, returned for filling. */
function section(doc, heading, key) {
  const sec = el(doc, "section", "mw-fs-sec");
  sec.dataset.sec = key;
  sec.appendChild(el(doc, "h3", "mw-fs-head", heading));
  return sec;
}

/** row(doc, k, v) — a label/value row; an empty value leaves its span out. */
function row(doc, k, v) {
  const r = el(doc, "div", "mw-fs-row");
  if (k) r.appendChild(el(doc, "span", "mw-fs-k", k));
  if (v) r.appendChild(el(doc, "span", "mw-fs-v", v));
  return r;
}

/**
 * renderFinalSheet(host, vm) — draws the view model into `host` (its old
 * children are replaced). Text only: no control, no handler, no HTML string.
 * Empty strings are never rendered as lines.
 */
export function renderFinalSheet(host, vm) {
  const doc = host.ownerDocument;
  const m = vm && typeof vm === "object" ? vm : emptyModel();
  const root = el(doc, "div", "mw-fs");

  const who = section(doc, FINAL_SHEET_COPY.who, "who");
  if (m.who && m.who.name) who.appendChild(el(doc, "p", "mw-fs-name", m.who.name));
  for (const line of [m.who && m.who.lineage, m.who && m.who.cls, m.who && m.who.level, m.who && m.who.hp]) {
    if (line) who.appendChild(el(doc, "p", "mw-fs-line", line));
  }
  root.appendChild(who);

  const death = section(doc, FINAL_SHEET_COPY.death, "death");
  const d = m.death || {};
  if (d.epitaph) {
    death.appendChild(el(doc, "span", "mw-fs-k", FINAL_SHEET_COPY.epitaph));
    death.appendChild(el(doc, "p", "mw-fs-epitaph", d.epitaph));
  }
  if (d.cause) death.appendChild(row(doc, FINAL_SHEET_COPY.cause, d.cause));
  for (const f of d.facts || []) death.appendChild(row(doc, f.label, f.value));
  root.appendChild(death);

  const stats = section(doc, FINAL_SHEET_COPY.stats, "stats");
  for (const s of m.stats || []) stats.appendChild(row(doc, s.label, s.value));
  root.appendChild(stats);

  const tricks = section(doc, FINAL_SHEET_COPY.tricks, "tricks");
  const t = m.tricks || {};
  for (const r of t.rows || []) {
    tricks.appendChild(row(doc, r.name, ""));
    if (r.description) tricks.appendChild(el(doc, "p", "mw-fs-note", r.description));
  }
  if (t.emptyLine) tricks.appendChild(el(doc, "p", "mw-fs-empty", t.emptyLine));
  root.appendChild(tricks);

  const worn = section(doc, FINAL_SHEET_COPY.worn, "worn");
  for (const w of m.worn || []) {
    const r = row(doc, w.label, w.name);
    if (w.value) r.appendChild(el(doc, "span", "mw-fs-v", w.value));
    worn.appendChild(r);
    if (w.note) worn.appendChild(el(doc, "p", w.filled ? "mw-fs-note" : "mw-fs-empty", w.note));
  }
  root.appendChild(worn);

  const bag = section(doc, FINAL_SHEET_COPY.bag, "bag");
  const b = m.bag || {};
  for (const name of b.names || []) if (name) bag.appendChild(el(doc, "p", "mw-fs-line", name));
  if (b.emptyLine) bag.appendChild(el(doc, "p", "mw-fs-empty", b.emptyLine));
  root.appendChild(bag);

  const book = section(doc, FINAL_SHEET_COPY.book, "book");
  const bk = m.book || {};
  for (const sp of bk.spells || []) book.appendChild(row(doc, sp.name, sp.level));
  if (bk.emptyLine) book.appendChild(el(doc, "p", "mw-fs-empty", bk.emptyLine));
  root.appendChild(book);

  host.replaceChildren(root);
  return root;
}
