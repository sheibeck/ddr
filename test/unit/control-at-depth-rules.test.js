// test/unit/control-at-depth-rules.test.js
//
// Phase 75.3 (RULES-18, Plan 07) — the standing control-site guard. The
// control audit (75.3-04-PLAN.md, copied into docs/ROLL-LEDGER.md's
// `## Phase 75.3 control at depth (RULES-18)` section by this same plan)
// says every effect that takes a foe out of its turns, or out of the fight,
// without going through its hit points meets the depth rule: past the knee
// the foe first gets a roll-high resist (engine/combat.js#resistControl, the
// ONE door), and a Freeze/Stone/Stupidity lands as a timed hold
// (engine/combat.js#holdFoe) rather than a kill or a whole-fight lock.
//
// This file proves the CURRENT engine sources keep that door, and that the
// guard would catch a future control that skipped it (the "teeth" tests at
// the bottom feed the SAME scanning primitive a doctored source string).
//
// If a future plan adds a foe control and this file fails, the fix is: send
// the new control through resistControl (and holdFoe for anything that
// would otherwise last the whole fight), and add its row to the ledger's
// audit table (C20+). A control that is deliberately OUT of the rule gets an
// X row in the ledger AND an entry in EXEMPT below, with its reason.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_DIR = path.join(REPO_ROOT, "engine");
const ROLL_LEDGER_PATH = path.join(REPO_ROOT, "docs", "ROLL-LEDGER.md");

const RULE_MESSAGE =
  "RULES-18: every foe control must go through engine/combat.js#resistControl (and holdFoe for a hold) " +
  "and join the control audit in docs/ROLL-LEDGER.md's `## Phase 75.3 control at depth (RULES-18)` section " +
  "(C20+); a control deliberately outside the rule needs an X row there and an EXEMPT entry in this file";

/** stripComments(source) — the same helper as hero-size-rules.test.js:
 * strip `//` line comments, then `/* ... *\/` block comments, so a comment
 * naming a control field (the engine's JSDoc is full of them) is never
 * mistaken for an assignment. */
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * functionSpans(source) -> [{ name, start, end }] for every `function name(`
 * declaration in `source`, spanning its own opening brace through the
 * matching close (depth counting; the engine bodies carry no unbalanced
 * brace inside a string, which the "every assignment resolves" test below
 * re-checks on every run by requiring each hit to land in a named span).
 */
function functionSpans(source) {
  const spans = [];
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    // The body opens at the first `{` after the parameter list closes.
    let i = m.index + m[0].length;
    let paren = 1;
    while (i < source.length && paren > 0) {
      if (source[i] === "(") paren++;
      else if (source[i] === ")") paren--;
      i++;
    }
    const open = source.indexOf("{", i);
    if (open === -1) continue;
    let depth = 0;
    for (let j = open; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") {
        depth--;
        if (depth === 0) {
          spans.push({ name: m[1], start: open, end: j + 1 });
          break;
        }
      }
    }
  }
  return spans;
}

/** enclosingFunction(spans, idx) -> the innermost span containing idx, or null. */
function enclosingFunction(spans, idx) {
  let best = null;
  for (const s of spans) {
    if (idx >= s.start && idx < s.end && (!best || s.end - s.start < best.end - best.start)) best = s;
  }
  return best;
}

/**
 * A foe-control assignment: a sleep count, a hold, or one of the control
 * flags set true, on a foe or on the combat (C.weakened). Clears (`= 0`,
 * `= false`, `= null`) and comparisons are not assignments of control.
 */
const CONTROL_ASSIGNMENT =
  /\.(?:asleep|held)\s*=(?!=)(?!\s*(?:0|false|null|undefined)\b)|\.(?:stupid|frozen|blind|shrunk|stunned|weakened)\s*=\s*true\b/g;

/**
 * The audited exemptions, by file and function, each with its ledger row.
 * holdFoe is the hold itself (its caller has already run resistControl).
 */
const EXEMPT = {
  "combat.js": { holdFoe: "the hold itself: every caller runs resistControl first (C1-C6, C17)" },
  "abilities.js": {
    applyPommel: "X5: Pommel Strike, a one-turn ability effect",
    applyDirtyTrick: "X5: Dirty Trick, a two-round ability effect",
  },
  // Phase 89 plan 08 (ITEM-01, user Q1 2026-09-30): item and staff effects
  // resist through the ONE depth-rising resist (combat.js#foeResistsEffect), not
  // resistControl, and have no floor-12 hold or extra control resist.
  "items.js": {
    useItem: "X9: every item and staff effect rolls the one depth-rising resist (foeResistsEffect); no knee, no hold",
  },
};

/**
 * controlViolations(files, exempt) -> every control assignment in `files`
 * ({ name, src } with src comment-stripped) whose enclosing function does
 * not also call `resistControl(` and is not listed in `exempt`. Also
 * returns every hit (for the non-vacuity checks). This is the ONE scanning
 * primitive the live-engine tests and the teeth tests share.
 */
function scanControls(files, exempt) {
  const hits = [];
  const violations = [];
  for (const { name, src } of files) {
    const spans = functionSpans(src);
    const re = new RegExp(CONTROL_ASSIGNMENT.source, "g");
    let m;
    while ((m = re.exec(src))) {
      const fn = enclosingFunction(spans, m.index);
      const fnName = fn ? fn.name : null;
      const body = fn ? src.slice(fn.start, fn.end) : "";
      const hit = { file: name, fn: fnName, text: m[0].trim() };
      hits.push(hit);
      const exempted = fnName && exempt[name] && Object.prototype.hasOwnProperty.call(exempt[name], fnName);
      if (!exempted && !/\bresistControl\s*\(/.test(body)) violations.push(`${name}#${fnName ?? "<top level>"}: ${hit.text}`);
    }
  }
  return { hits, violations };
}

/** callSitesOutside(files, callRe, allowed) -> every match of callRe not inside allowed[file]'s named function. */
function callSitesOutside(files, callRe, allowed) {
  const out = [];
  for (const { name, src } of files) {
    const spans = functionSpans(src);
    const re = new RegExp(callRe.source, "g");
    let m;
    while ((m = re.exec(src))) {
      const fn = enclosingFunction(spans, m.index);
      const ok = fn && (allowed[name] || []).includes(fn.name);
      if (!ok) out.push(`${name}#${fn ? fn.name : "<top level>"}`);
    }
  }
  return out;
}

/** Blank every `import ... ;` clause so an imported name is not read as a call. */
function stripImports(source) {
  return source.replace(/^import\b[\s\S]*?;/gm, "");
}

const ENGINE_FILES = fs
  .readdirSync(ENGINE_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((name) => ({ name, src: stripImports(stripComments(fs.readFileSync(path.join(ENGINE_DIR, name), "utf8"))) }));

// --- the live engine ---------------------------------------------------------

test("RULES-18 guard: every foe-control assignment in engine/*.js sits in a function that calls resistControl (or an audited exemption)", () => {
  const { violations } = scanControls(ENGINE_FILES, EXEMPT);
  assert.deepEqual(violations, [], `unguarded foe control(s): ${violations.join("; ")} — ${RULE_MESSAGE}`);
});

test("RULES-18 guard: the scan is not vacuous — every hit resolves to a named function, and the audited sites are all seen", () => {
  const { hits } = scanControls(ENGINE_FILES, EXEMPT);
  const unresolved = hits.filter((h) => !h.fn);
  assert.deepEqual(unresolved, [], `control assignment(s) outside any named function (the body splitter lost its place?): ${JSON.stringify(unresolved)}`);
  const seen = new Set(hits.map((h) => `${h.file}#${h.fn}`));
  // One entry per audited function that assigns a control today: castSpell
  // (C1, C5, C7, C8, C10, C11, C14, C17-C19), useItem (C4, C6, C12, C16),
  // allyCast (C2, C9, C15), sing (C13), foeTurn (C3), holdFoe, and the
  // exemptions (X5). X8 left the list in Plan 76-06 (user ruling
  // 2026-09-26): a fumbled Weaken now weakens the READER (c.foeEffect), so
  // scrollFumble.js assigns no foe control at all and needs no exemption.
  for (const site of [
    "magic.js#castSpell",
    "items.js#useItem",
    "combat.js#allyCast",
    "combat.js#sing",
    "combat.js#foeTurn",
    "combat.js#holdFoe",
    "abilities.js#applyPommel",
    "abilities.js#applyDirtyTrick",
  ]) {
    assert.ok(seen.has(site), `expected the scan to see a control assignment in ${site}; seen: ${[...seen].join(", ")}`);
  }
  // Every exemption is still live: an EXEMPT entry whose control was removed
  // must be dropped from this file and the ledger, not left dangling.
  for (const [file, fns] of Object.entries(EXEMPT)) {
    for (const fn of Object.keys(fns)) assert.ok(seen.has(`${file}#${fn}`), `EXEMPT lists ${file}#${fn}, but it no longer assigns a control`);
  }
});

test("RULES-18 guard: controlResistCheck( is called only by combat.js#resistControl, and controlResistRoll( only by derived.js#controlResistCheck", () => {
  // (?<!function\s+) skips each helper's own declaration line.
  const checkSites = callSitesOutside(ENGINE_FILES, /(?<!function\s+)\bcontrolResistCheck\s*\(/, {
    "combat.js": ["resistControl"],
  });
  assert.deepEqual(checkSites, [], `controlResistCheck called outside resistControl: ${checkSites.join(", ")} — ${RULE_MESSAGE}`);
  const rollSites = callSitesOutside(ENGINE_FILES, /(?<!function\s+)\bcontrolResistRoll\s*\(/, {
    "derived.js": ["controlResistCheck"],
  });
  assert.deepEqual(rollSites, [], `controlResistRoll called outside controlResistCheck: ${rollSites.join(", ")} — ${RULE_MESSAGE}`);
  // And resistControl is really the caller (not vacuous).
  const combat = ENGINE_FILES.find((f) => f.name === "combat.js").src;
  const span = functionSpans(combat).find((s) => s.name === "resistControl");
  assert.ok(span, "combat.js#resistControl must exist");
  assert.match(combat.slice(span.start, span.end), /\bcontrolResistCheck\s*\(/, "resistControl must call controlResistCheck");
});

test('RULES-18 guard: the only "controlResist" derived-stream purpose is in derived.js#controlResistCheck', () => {
  const sites = callSitesOutside(ENGINE_FILES, /["'`]controlResist["'`]/, { "derived.js": ["controlResistCheck"] });
  assert.deepEqual(sites, [], `a second "controlResist" stream exists: ${sites.join(", ")} — ${RULE_MESSAGE}`);
  const derived = ENGINE_FILES.find((f) => f.name === "derived.js").src;
  assert.match(derived, /derivedRng\([^)]*["']controlResist["']/, "derived.js#controlResistCheck must build the controlResist derived stream");
});

test("RULES-18 guard: docs/ROLL-LEDGER.md's Phase 75.3 section lists every audit id (C1-C19, X1-X8)", () => {
  const ledger = fs.readFileSync(ROLL_LEDGER_PATH, "utf8").replace(/\r\n/g, "\n");
  const start = ledger.indexOf("\n## Phase 75.3 control at depth (RULES-18)");
  assert.ok(start !== -1, "docs/ROLL-LEDGER.md is missing `## Phase 75.3 control at depth (RULES-18)`");
  const next = ledger.indexOf("\n## ", start + 1);
  const section = ledger.slice(start, next === -1 ? undefined : next);
  const ids = [...Array.from({ length: 19 }, (_, i) => `C${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `X${i + 1}`)];
  for (const id of ids) assert.match(section, new RegExp(`^\\| ${id} \\|`, "m"), `the ledger's control audit is missing row ${id}`);
  assert.match(section, /\[resist:depth\]/, "the ledger section must name the [resist:depth] row");
  assert.match(section, /control-at-depth-rules\.test\.js/, "the ledger section must name this guard");
});

// --- teeth: the same primitive, fed doctored sources ------------------------

test("RULES-18 guard has teeth: a doctored foe control that skips resistControl is reported", () => {
  const doctored = [
    {
      name: "doctored.js",
      src: stripComments(`
        export function castNap(state, t, rng, events) {
          const f = t;
          f.asleep = 5;
          events.push({ type: "napped" });
        }
        export function castGlue(state, C) {
          C.weakened = true;
        }
      `),
    },
  ];
  const { violations } = scanControls(doctored, {});
  assert.deepEqual(violations, ["doctored.js#castNap: .asleep =", "doctored.js#castGlue: .weakened = true"]);
});

test("RULES-18 guard has teeth: the same control through resistControl passes, and clears are not controls", () => {
  const doctored = [
    {
      name: "doctored.js",
      src: stripComments(`
        export function castNap(state, f, rng, events) {
          if (!resistControl(state, f, "sleep", "Nap", 0, rng, events)) f.asleep = 5;
        }
        export function wake(f) {
          f.asleep = 0;
          f.frozen = false;
          f.held = null;
        }
      `),
    },
  ];
  const { hits, violations } = scanControls(doctored, {});
  assert.deepEqual(violations, []);
  assert.deepEqual(
    hits.map((h) => `${h.fn}: ${h.text}`),
    ["castNap: .asleep ="],
  );
});
