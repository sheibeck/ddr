// test/unit/phase59-gates.test.js
//
// Phase 59 (party animation + dungeon set dressing) — the CLOSING gates,
// pinned durably so a later phase cannot quietly undo them:
//
//   1. Modularity — draw() only shrank (the party-marker paint removed by
//      Plan 03) and gained exactly one new statement (the dressing call,
//      Plan 05); no party-marker art read, no radial gradient, no text
//      drawing survives.
//   2. Purity — the two Phase 59 modules (partySprite.js, dressing.js)
//      import only their one declared dependency each, and touch no
//      window/document/Math.random/Date.now/matchMedia global.
//   3. Bridge registration — __mzPartySprite/__mzDressing are BRIDGE keys,
//      each assigned exactly once in the module script.
//   4. Presentation gate — nothing in engine/ or content/ imports from
//      src/browser/.
//
// test/unit/reduced-motion.test.js's own audit section already pins
// paint()/draw()'s exact comment-stripped SHA-256 — this file does not
// duplicate that digest; it pins the SEPARATE, coarser claims above (the
// party-marker-art/radial-gradient/text-draw absence, the PRE59 line-count
// ceiling, the import/purity/registration/dependency-direction gates) so a
// change that alters draw()'s digest for an UNRELATED reason still fails
// here too, with a more specific message.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs, stripHtml } from "../../tools/ident-sweep.mjs";
import { BRIDGE, bridgeNames } from "../../src/browser/bridge.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const STRIPPED_HTML = stripHtml(HTML);

function extractFunctionBody(source, signatureRe) {
  const m = signatureRe.exec(source);
  if (!m) return null;
  const braceStart = source.indexOf("{", m.index);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return null;
}

// ─── (1) modularity: draw() only shrank + gained one call ──────────────

// PRE59 = 25136c8bd76fefdf3ed05a62de5ea026e2525244 (the Phase 58 close
// commit, the one immediately before Phase 59's first code — the first of
// src/browser/partySprite.js/dressing.js — landed; also this run's
// test-count floor commit per run-convention 3). Computed via:
//   FIRST=$(git log --reverse --format=%H f220718..HEAD -- \
//     src/browser/partySprite.js src/browser/dressing.js | head -1)
//   git rev-parse "$FIRST^"
// PRE59_DRAW_NONBLANK_LINES is draw()'s own comment-stripped,
// CRLF-normalised body's non-blank line count AT PRE59, computed by a
// one-off node script reading `git show 25136c8:mazeworld.html` through
// tools/ident-sweep.mjs#stripHtml — pinned here as a literal so `npm test`
// never shells out to git.
const PRE59_DRAW_NONBLANK_LINES = 66;

test("(1) draw() only shrank and gained one call: exactly one __mzDressing reference, no party-marker-art read, no radial gradient, no text drawing, and fewer non-blank lines than PRE59 (25136c8)", () => {
  const drawBody = extractFunctionBody(STRIPPED_HTML, /function draw\(\)\s*\{/);
  assert.ok(drawBody, "function draw() { not found");

  const dressingRefs = drawBody.match(/__mzDressing/g) || [];
  assert.equal(dressingRefs.length, 1, "draw() must reference __mzDressing exactly once");

  assert.doesNotMatch(drawBody, /PLAYER_MARKER_ICON/, "draw() must never read the party marker's icon key again");
  assert.doesNotMatch(drawBody, /createRadialGradient/, "draw() must never paint a radial gradient (the old party glow)");
  assert.doesNotMatch(drawBody, /fillText/, "draw() must never draw text (the old \"P\" fallback)");

  const nonBlank = drawBody.split("\n").filter((l) => l.trim().length > 0).length;
  assert.ok(
    nonBlank < PRE59_DRAW_NONBLANK_LINES,
    `draw() must have fewer non-blank lines (${nonBlank}) than PRE59's (${PRE59_DRAW_NONBLANK_LINES})`,
  );
});

// ─── (2) purity: the two Phase 59 modules import only their one declared
//     dependency each, and touch no window/document/Math.random/Date.now/
//     matchMedia global ───────────────────────────────────────────────

test("(2) the two Phase 59 modules are pure: partySprite.js imports only ./cameraGlide.js, dressing.js imports only ../../engine/rng.js, and neither reads window/document/Math.random/Date.now/matchMedia", () => {
  const FORBIDDEN_RE = /\bwindow\.|\bdocument\.|Math\.random|Date\.now|matchMedia/;

  const partySpriteSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "partySprite.js"), "utf8");
  const partySpriteStripped = stripJs(partySpriteSrc);
  const partySpriteImports = [...partySpriteStripped.matchAll(/^import\s.*?from\s+["']([^"']+)["'];?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(partySpriteImports, ["./cameraGlide.js"]);
  assert.doesNotMatch(partySpriteStripped, FORBIDDEN_RE);

  const dressingSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "dressing.js"), "utf8");
  const dressingStripped = stripJs(dressingSrc);
  const dressingImports = [...dressingStripped.matchAll(/^import\s.*?from\s+["']([^"']+)["'];?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(dressingImports, ["../../engine/rng.js"]);
  assert.doesNotMatch(dressingStripped, FORBIDDEN_RE);
});

// ─── (3) bridge registration: __mzPartySprite/__mzDressing, assigned once each

test("(3) the two Phase 59 bridges are registered and assigned once: __mzPartySprite and __mzDressing are BRIDGE keys, each window.<name> = assignment occurring exactly once in the stripped module script", () => {
  const names = bridgeNames();
  assert.ok(names.includes("__mzPartySprite"), "__mzPartySprite must be a BRIDGE key");
  assert.ok(names.includes("__mzDressing"), "__mzDressing must be a BRIDGE key");
  assert.ok(BRIDGE.__mzPartySprite, "BRIDGE.__mzPartySprite must exist");
  assert.ok(BRIDGE.__mzDressing, "BRIDGE.__mzDressing must exist");

  const modStart = STRIPPED_HTML.indexOf('<script type="module">');
  assert.notEqual(modStart, -1);
  const modSlice = STRIPPED_HTML.slice(modStart);
  assert.equal((modSlice.match(/window\.__mzPartySprite\s*=/g) || []).length, 1);
  assert.equal((modSlice.match(/window\.__mzDressing\s*=/g) || []).length, 1);
});

// ─── (4) presentation gate: nothing in engine/ or content/ imports src/browser/

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("(4) nothing in engine/ or content/ imports from src/browser/ (the dependency direction the Presentation gate relies on)", () => {
  const offenders = [];
  for (const dir of ["engine", "content"]) {
    const abs = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of listJsFiles(abs)) {
      const stripped = stripJs(fs.readFileSync(file, "utf8"));
      const imports = [...stripped.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of imports) {
        if (spec.includes("src/browser")) offenders.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
