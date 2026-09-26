// test/unit/hero-size-rules.test.js
//
// Phase 75.2 (RULES-11, Plan 05) — the standing size-read guard. 75.2-01's
// own "size-rule audit" table (S1-S14, copied verbatim into
// docs/ROLL-LEDGER.md's `## Phase 75.2 hero size (RULES-11)` section by this
// same plan) says exactly ONE seam reads each size primitive — a race's own
// base step is read only through raceSizeStep (SIZE_STEP_OF), an item's own
// step only through itemSizeStep (`eff(sheet, "size")`), and the SIGNATURE
// MASK only through sizeAxisStep (content/races.js's `sizeAxes`). This file
// proves the CURRENT engine sources hold that seam, and that the guard
// itself would catch a future size read that broke out of it (the "teeth"
// test at the bottom feeds the SAME scanning primitive a doctored source
// string, never a live engine file, to prove a genuine violation is caught).
//
// If a future plan adds a new size-flavoured rule and this file's first six
// tests fail, the fix is almost always: read the hero's (or a Joiner's) size
// through engine/derived.js#sizeAxisStep (so the race-signature masks keep
// applying), not a fresh `eff(c, "size")`/`SIZE_STEP_OF`/`sizeAxes` read —
// and add the new rule's own row to docs/ROLL-LEDGER.md's S1-S14 audit
// table (extending it to S15+, never silently skipping the ledger).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_DIR = path.join(REPO_ROOT, "engine");
const ROLL_LEDGER_PATH = path.join(REPO_ROOT, "docs", "ROLL-LEDGER.md");

/** stripComments(source) — mirrors test/unit/roll-sign-consistency.test.js's
 * own helper: strip `//` line comments then `/* ... *\/` block comments, in
 * that order, so a comment mentioning a size identifier (this file's own
 * JSDoc blocks are full of them) is never mistaken for a real read. */
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

/** stripImports(source) — blanks every `import ... ;` statement (single- or
 * multi-line, several engine files wrap their import clause across several
 * lines) so a re-exported binding's NAME appearing in its own import clause
 * is never mistaken for a "read" of that binding. */
function stripImports(source) {
  return source.replace(/^import\b[\s\S]*?;/gm, "");
}

/** cleanSource(source) — the one normalization every scan below shares. */
function cleanSource(source) {
  return stripImports(stripComments(source));
}

/**
 * functionBodySpan(source, declRegex) -> [start, end) character offsets of
 * the FIRST function declaration matching `declRegex`, spanning from its OWN
 * opening brace through its matching closing brace (simple depth-counting —
 * safe here because none of the audited functions' bodies contain a string
 * or template literal carrying an unbalanced brace character, confirmed by
 * inspection). Returns null when no declaration matches in this source.
 */
function functionBodySpan(source, declRegex) {
  const m = declRegex.exec(source);
  if (!m) return null;
  const openIdx = source.indexOf("{", m.index);
  if (openIdx === -1) return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return [openIdx, i + 1];
    }
  }
  return null;
}

/** allMatches(source, re) -> every match START index of `re` in `source`
 * (re is cloned with a "g" flag so a caller's own regex is never mutated). */
function allMatches(source, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const out = [];
  let m;
  while ((m = g.exec(source))) out.push(m.index);
  return out;
}

/**
 * violationsFor(files, patternRe, allowedByFile) -> every match of
 * `patternRe` across `files` (an array of `{ name, src }`, `src` already
 * `cleanSource`d) that does NOT fall inside one of `allowedByFile[name]`'s
 * named function bodies (resolved via functionBodySpan in THAT file's own
 * source). A file with no entry in `allowedByFile` permits zero matches at
 * all. This is the ONE seam-guard primitive every scan below — and the
 * "has teeth" test at the bottom — shares; feeding it a doctored source
 * string is how that test proves the primitive genuinely catches a
 * violation, not merely that today's real files happen to pass.
 */
function violationsFor(files, patternRe, allowedByFile) {
  const out = [];
  for (const { name, src } of files) {
    const allowedNames = allowedByFile[name] || [];
    const spans = allowedNames.map((fnName) => functionBodySpan(src, new RegExp(`function\\s+${fnName}\\s*\\(`))).filter(Boolean);
    for (const idx of allMatches(src, patternRe)) {
      const contained = spans.some(([s, e]) => idx >= s && idx < e);
      if (!contained) out.push(`${name}@${idx}`);
    }
  }
  return out;
}

// --- load and clean every real engine/*.js source, once --------------------

const ENGINE_FILES = fs
  .readdirSync(ENGINE_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((name) => ({ name, src: cleanSource(fs.readFileSync(path.join(ENGINE_DIR, name), "utf8")) }));

// --- the audited seam: three primitives, one caller each --------------------

test('hero-size-rules: the only eff(sheet, "size") call in engine/*.js is inside derived.js#itemSizeStep', () => {
  const violations = violationsFor(ENGINE_FILES, /eff\([^)]*"size"\)/g, { "derived.js": ["itemSizeStep"] });
  assert.deepEqual(
    violations,
    [],
    `a size eff() read exists outside itemSizeStep (${violations.join(", ")}) — RULES-11: a new size rule must read the hero's/Joiners' size through derived.js#sizeAxisStep (so the signature masks apply) and join docs/ROLL-LEDGER.md's S1-S14 audit`,
  );
});

test("hero-size-rules: the only SIZE_STEP_OF read in engine/*.js is inside derived.js#raceSizeStep", () => {
  const violations = violationsFor(ENGINE_FILES, /\bSIZE_STEP_OF\b/g, { "derived.js": ["raceSizeStep"] });
  assert.deepEqual(
    violations,
    [],
    `a SIZE_STEP_OF read exists outside raceSizeStep (${violations.join(", ")}) — RULES-11: a new size rule must read the hero's/Joiners' size through derived.js#sizeAxisStep (so the signature masks apply) and join docs/ROLL-LEDGER.md's S1-S14 audit`,
  );
});

test("hero-size-rules: the only sizeAxes read in engine/*.js is inside derived.js#sizeAxisStep", () => {
  const violations = violationsFor(ENGINE_FILES, /\bsizeAxes\b/g, { "derived.js": ["sizeAxisStep"] });
  assert.deepEqual(
    violations,
    [],
    `a sizeAxes read exists outside sizeAxisStep (${violations.join(", ")}) — RULES-11: a new size rule must read the hero's/Joiners' size through derived.js#sizeAxisStep (so the signature masks apply) and join docs/ROLL-LEDGER.md's S1-S14 audit`,
  );
});

test("hero-size-rules: sizeAxisStep( is called ONLY from derived.js (heroSize, sizeDamage, foeToHitVs, foeToHitBreakdown) and combat.js's foeTurn (the member branch)", () => {
  const violations = violationsFor(ENGINE_FILES, /(?<!function )\bsizeAxisStep\(/g, {
    "derived.js": ["heroSize", "sizeDamage", "foeToHitVs", "foeToHitBreakdown"],
    "combat.js": ["foeTurn"],
  });
  assert.deepEqual(
    violations,
    [],
    `sizeAxisStep is called outside the audited set (${violations.join(", ")}) — RULES-11: a new size rule must read the hero's/Joiners' size through derived.js#sizeAxisStep (so the signature masks apply) and join docs/ROLL-LEDGER.md's S1-S14 audit`,
  );
});

test("hero-size-rules: sizeAxisStep's own body never names a race to decide its mask — the signature mask is content data (sizeAxes), never a name check", () => {
  const derivedSrc = ENGINE_FILES.find((f) => f.name === "derived.js").src;
  const span = functionBodySpan(derivedSrc, /function\s+sizeAxisStep\s*\(/);
  assert.ok(span, "expected to find sizeAxisStep's function body in engine/derived.js");
  const body = derivedSrc.slice(span[0], span[1]);
  for (const race of ["Human", "Wilmsry", "Fridgian", "Elven", "Dwarven", "Troll"]) {
    assert.ok(!body.includes(`"${race}"`) && !body.includes(`'${race}'`), `sizeAxisStep must not name the race "${race}" to decide a mask`);
  }
});

// --- foe-size stays foe-only: only the two record builders read `.sz` ------

test('hero-size-rules: the only ".sz" reads in engine/*.js are the two "size: picked.sz" foe-record builders (engine/combat.js, engine/foeAbilities.js)', () => {
  const nonPickedSites = [];
  let pickedCount = 0;
  for (const { name, src } of ENGINE_FILES) {
    for (const idx of allMatches(src, /\.sz\b/g)) {
      // The "." at `idx` is preceded by whatever identifier owns this field
      // read — a legitimate site's identifier is exactly "picked" (the foe
      // record builder), never a foe-like binding read directly.
      const before = src.slice(Math.max(0, idx - 20), idx);
      if (/\bpicked$/.test(before)) pickedCount++;
      else nonPickedSites.push(`${name}@${idx} (context: ...${before})`);
    }
  }
  assert.deepEqual(nonPickedSites, [], `every ".sz" read must be "picked.sz" (the foe-record builder), found a non-"picked" site: ${nonPickedSites.join(", ")}`);
  assert.equal(pickedCount, 2, `expected exactly 2 "picked.sz" record builders (engine/combat.js, engine/foeAbilities.js), found ${pickedCount}`);
});

test('hero-size-rules: no engine file reads ".size" off a foe-like binding (f/foe/t/target/pursuer — "picked" excluded, it is the record builder itself)', () => {
  const violations = [];
  for (const { name, src } of ENGINE_FILES) {
    for (const idx of allMatches(src, /\b(f|foe|t|target|pursuer)\.size\b/g)) violations.push(`${name}@${idx}`);
  }
  assert.deepEqual(violations, [], `a foe-like binding reads ".size" directly (${violations.join(", ")}) — a foe's size lives on its own .sz field (picked.sz), never .size`);
});

// --- the ledger carries the full audit --------------------------------------

test("hero-size-rules: docs/ROLL-LEDGER.md's Phase 75.2 section lists the full S1-S14 audit", () => {
  const ledger = fs.readFileSync(ROLL_LEDGER_PATH, "utf8");
  assert.equal((ledger.match(/## Phase 75\.2 hero size \(RULES-11\)/g) || []).length, 1, "expected exactly one '## Phase 75.2 hero size (RULES-11)' heading");
  for (let i = 1; i <= 14; i++) {
    assert.ok(ledger.includes(`| S${i} |`), `docs/ROLL-LEDGER.md is missing size-rule audit row S${i}`);
  }
});

// --- teeth: the SAME scanning primitive catches a doctored source ----------

test("hero-size-rules exposure guard has teeth: a doctored source string carrying a second, unaudited size read is caught by the same scan", () => {
  const doctoredEffSize = `
    export function itemSizeStep(sheet) {
      return eff(sheet, "size");
    }
    export function rogueSizeRead(f) {
      // a doctored second size read, OUTSIDE the audited itemSizeStep seam
      return f.size > 0 ? eff(f, "size") : 0;
    }
  `;
  const effViolations = violationsFor([{ name: "derived.js", src: cleanSource(doctoredEffSize) }], /eff\([^)]*"size"\)/g, { "derived.js": ["itemSizeStep"] });
  assert.equal(effViolations.length, 1, `expected the doctored rogueSizeRead's eff(f, "size") call to be reported, got: ${JSON.stringify(effViolations)}`);

  const foeSizeReads = allMatches(cleanSource(doctoredEffSize), /\b(f|foe|t|target|pursuer)\.size\b/g);
  assert.equal(foeSizeReads.length, 1, "expected the doctored source's foe-like f.size comparison to be caught by the foe-size-read scan");

  const doctoredSizeAxes = `
    export function sizeAxisStep(sheet, axis) {
      const R = RACES[sheet.race];
      return R && R.sizeAxes && R.sizeAxes[axis] === false ? 0 : 1;
    }
    export function rogueAxisRead(sheet) {
      const R = RACES[sheet.race];
      return R.sizeAxes ? 1 : 0; // a second, unaudited sizeAxes read
    }
  `;
  const axesViolations = violationsFor([{ name: "derived.js", src: cleanSource(doctoredSizeAxes) }], /\bsizeAxes\b/g, { "derived.js": ["sizeAxisStep"] });
  assert.equal(axesViolations.length, 1, `expected the doctored rogueAxisRead's sizeAxes read to be reported, got: ${JSON.stringify(axesViolations)}`);

  // Zero-violation controls: the SAME primitive must NOT flag legitimate,
  // in-seam reads — proving the guard has a working "pass" side too.
  const cleanDerived = cleanSource(`
    export function itemSizeStep(sheet) {
      return eff(sheet, "size");
    }
  `);
  assert.deepEqual(violationsFor([{ name: "derived.js", src: cleanDerived }], /eff\([^)]*"size"\)/g, { "derived.js": ["itemSizeStep"] }), []);
});
