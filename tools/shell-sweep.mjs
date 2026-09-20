#!/usr/bin/env node
// tools/shell-sweep.mjs
//
// Phase 44 (DEAD-01) deletion gate. Two subcommands over mazeworld.html
// (path overridable with --file):
//
//   refs NAME [NAME...]   Zero-reference gate. Prints `refs NAME: <n>` for
//                         each NAME and every matching line; exits 1 if any
//                         n > 0. Use to prove a deleted symbol has zero
//                         surviving references before AND after a deletion
//                         commit.
//   orphans               Advisory reachability listing: classic top-level
//                         declarations unreachable from the live roots
//                         (HTML on*= attributes, the module script, classic
//                         top-level statements). NOT a gate — a seed list
//                         for planning deletion layers; the `refs` gate is
//                         authoritative.
//
// node:fs only — no packages.

import fs from "node:fs";

function parseArgs(argv) {
  const args = { _: [], file: "mazeworld.html", ignoreWindow: false, list: null, debug: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i];
    else if (a === "--ignore-window") args.ignoreWindow = true;
    else if (a === "--list") args.list = argv[++i];
    else if (a === "--debug") args.debug = argv[++i];
    else args._.push(a);
  }
  return args;
}

// ---------------------------------------------------------------------
// Comment/string stripping tokenizer. Preserves line count and column
// alignment (replaces stripped characters with spaces, keeps embedded
// newlines) so line-number reporting against the original file stays
// accurate. Template-literal `${...}` interpolation bodies are kept
// verbatim (they can contain live identifier references); the surrounding
// template text is blanked like a string literal.
// ---------------------------------------------------------------------
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < n && src[j] !== "\n") {
        out += " ";
        j++;
      }
      i = j;
      continue;
    }
    if (c === "/" && c2 === "*") {
      let j = i + 2;
      out += "  ";
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) {
        out += src[j] === "\n" ? "\n" : " ";
        j++;
      }
      if (j < n) {
        out += "  ";
        j += 2;
      }
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      out += " ";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\") {
          out += src[j] === "\n" ? "\n" : " ";
          j++;
          if (j < n) {
            out += src[j] === "\n" ? "\n" : " ";
            j++;
          }
          continue;
        }
        out += src[j] === "\n" ? "\n" : " ";
        j++;
      }
      if (j < n) {
        out += " ";
        j++;
      }
      i = j;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      out += " ";
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") {
          out += src[j] === "\n" ? "\n" : " ";
          j++;
          if (j < n) {
            out += src[j] === "\n" ? "\n" : " ";
            j++;
          }
          continue;
        }
        if (src[j] === "$" && src[j + 1] === "{") {
          let depth = 1;
          out += "${";
          j += 2;
          while (j < n && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            if (depth > 0) out += src[j];
            j++;
          }
          out += "}";
          continue;
        }
        out += src[j] === "\n" ? "\n" : " ";
        j++;
      }
      if (j < n) {
        out += " ";
        j++;
      }
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------
// Region discovery
// ---------------------------------------------------------------------
function findRegions(lines) {
  const classicStart = lines.findIndex((l) => l === "<script>");
  if (classicStart < 0) throw new Error("classic <script> line not found");
  const classicEnd = lines.findIndex((l, i) => i > classicStart && l === "</script>");
  if (classicEnd < 0) throw new Error("classic </script> line not found");
  const moduleStart = lines.findIndex((l, i) => i > classicEnd && l.startsWith('<script type="module">'));
  if (moduleStart < 0) throw new Error('module <script type="module"> line not found');
  const moduleEnd = lines.findIndex((l, i) => i > moduleStart && l === "</script>");
  if (moduleEnd < 0) throw new Error("module </script> line not found");
  return { classicStart, classicEnd, moduleStart, moduleEnd };
}

function onAttrValues(line) {
  const out = [];
  const re = /\bon[a-zA-Z]+\s*=\s*"([^"]*)"|\bon[a-zA-Z]+\s*=\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(line))) {
    out.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return out;
}

// Builds a per-line "scannable" text array aligned to the original file's
// line numbers: classic/module script bodies get comment/string-stripped
// text; every other line gets only its on*="..." attribute values (HTML
// prose, markup text and CSS are never scanned).
function buildMaskedLines(lines, regions) {
  const { classicStart, classicEnd, moduleStart, moduleEnd } = regions;
  const masked = new Array(lines.length).fill("");

  const classicBody = lines.slice(classicStart + 1, classicEnd).join("\n");
  const classicStripped = stripCommentsAndStrings(classicBody).split("\n");
  for (let k = 0; k < classicStripped.length; k++) {
    masked[classicStart + 1 + k] = classicStripped[k];
  }

  const moduleBody = lines.slice(moduleStart + 1, moduleEnd).join("\n");
  const moduleStripped = stripCommentsAndStrings(moduleBody).split("\n");
  for (let k = 0; k < moduleStripped.length; k++) {
    masked[moduleStart + 1 + k] = moduleStripped[k];
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const inClassic = idx > classicStart && idx < classicEnd;
    const inModule = idx > moduleStart && idx < moduleEnd;
    if (inClassic || inModule) continue;
    const vals = onAttrValues(lines[idx]);
    if (vals.length) masked[idx] = vals.join(" ");
  }

  return masked;
}

// ---------------------------------------------------------------------
// Match classification helpers
// ---------------------------------------------------------------------

// Object-literal KEY position: NAME is the first non-whitespace token on
// the line (or immediately follows `{` / `,`) and is immediately followed
// (modulo whitespace) by `:` (not `::`). This codebase's object literals
// are written one `key: value,` per line (see COMBAT_DISPATCH etc.), so
// this heuristic is reliable for this file.
function isObjectKeyMatch(lineText, matchIndex, matchLength) {
  const before = lineText.slice(0, matchIndex);
  const trimmedBefore = before.replace(/\s+$/, "");
  const isKeyPosition = trimmedBefore === "" || /[{,]$/.test(trimmedBefore);
  if (!isKeyPosition) return false;
  const after = lineText.slice(matchIndex + matchLength);
  const afterTrimmed = after.replace(/^\s+/, "");
  return afterTrimmed.startsWith(":") && !afterTrimmed.startsWith("::");
}

function isWindowPrefixed(lineText, matchIndex) {
  const before = lineText.slice(0, matchIndex);
  return /(^|[^\w.])(window\.|globalThis\.)$/.test(before);
}

// `window.NAME = ...` / `globalThis.NAME = ...` (single `=`, not `==`/`===`)
// is the module OVERRIDING a classic global with its own implementation —
// an assignment TARGET, not a read of the classic top-level declaration —
// so it never counts as a reference to NAME (44-CONTEXT.md: "window.move /
// window.newGame are module overrides, so the classic bodies are dead").
function isWindowAssignmentTarget(lineText, matchIndex, matchLength) {
  if (!isWindowPrefixed(lineText, matchIndex)) return false;
  const after = lineText.slice(matchIndex + matchLength).replace(/^\s+/, "");
  return /^=(?!=)/.test(after);
}

// `move(`, `newGame(`, `makeCamp(` bare calls are cut points — they resolve
// to the module's window.move/window.newGame overrides (or a deleted
// `else makeCamp()` fallback), not the classic declaration of the same
// name, per 44-CONTEXT.md's sweep rulings.
const CUT_POINT_NAMES = new Set(["move", "newGame", "makeCamp"]);
function isCutPointCall(lineText, matchIndex, matchLength, name) {
  if (!CUT_POINT_NAMES.has(name)) return false;
  const after = lineText.slice(matchIndex + matchLength).replace(/^\s+/, "");
  return after.startsWith("(");
}

// Phase 44-02 (DEAD-01): `obj.NAME` — NAME sitting in MEMBER-ACCESS position
// on some object that is NOT `window`/`globalThis` — is reading an unrelated
// same-named property (e.g. `COMBAT_COPY.over.dead.bury`, a button-label
// text key) never the top-level classic declaration NAME. `window.NAME` /
// `globalThis.NAME` stay counted here (those alias the classic global
// directly; isWindowAssignmentTarget/isCutPointCall already carve out the
// non-reference shapes of THOSE two prefixes specifically).
function isForeignMemberAccess(lineText, matchIndex) {
  if (isWindowPrefixed(lineText, matchIndex)) return false;
  const before = lineText.slice(0, matchIndex);
  return /\.\s*$/.test(before);
}

function findMatches(lineText, name) {
  const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "g");
  const out = [];
  let m;
  while ((m = re.exec(lineText))) {
    out.push({ index: m.index, length: m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

// ---------------------------------------------------------------------
// refs
// ---------------------------------------------------------------------
function cmdRefs(args) {
  // Rule 1 (bug fix): a CRLF-terminated checkout leaves a trailing "\r" on
  // every split line, so an exact `l === "<script>"` region marker match in
  // findRegions() never fires — normalize line endings before splitting
  // (behaviour on an LF checkout is unchanged, .replace is a no-op there).
  const raw = fs.readFileSync(args.file, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const regions = findRegions(lines);
  const masked = buildMaskedLines(lines, regions);

  let names = args._.slice(1);
  if (args.list) {
    const listed = fs
      .readFileSync(args.list, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    names = names.concat(listed);
  }
  if (!names.length) {
    console.error("ERROR: refs requires at least one NAME (or --list <file>)");
    process.exit(2);
  }

  // A match sitting inside a classic declaration's body counts only if
  // that declaration is itself reachable from the live roots — a still-
  // undeleted, already-dead caller (e.g. classic newGame() calling
  // rollCharacter()) referencing NAME is not a reason to keep NAME (see
  // computeReachability's doc comment / 44-CONTEXT.md A-1).
  const debugSet = args.debug ? new Set(args.debug.split(",")) : null;
  const { decls, reachable } = computeReachability(lines, regions, masked, debugSet);
  const owner = new Array(lines.length).fill(null);
  for (const d of decls) {
    for (let idx = d.line; idx <= d.endLine; idx++) owner[idx] = d.name;
  }

  let anyNonZero = false;
  for (const name of names) {
    const hits = [];
    for (let idx = 0; idx < masked.length; idx++) {
      const text = masked[idx];
      if (!text) continue;
      const ownerName = owner[idx];
      if (ownerName && ownerName !== name && !reachable.has(ownerName)) continue;
      for (const m of findMatches(text, name)) {
        if (isObjectKeyMatch(text, m.index, m.length)) continue;
        if (isCutPointCall(text, m.index, m.length, name)) continue;
        if (isForeignMemberAccess(text, m.index)) continue;
        if (args.ignoreWindow && isWindowPrefixed(text, m.index)) continue;
        hits.push({ line: idx + 1, text: lines[idx] });
      }
    }
    console.log(`refs ${name}: ${hits.length}`);
    for (const h of hits) {
      console.log(`  L${h.line}: ${h.text}`);
    }
    if (hits.length > 0) anyNonZero = true;
  }
  process.exit(anyNonZero ? 1 : 0);
}

// ---------------------------------------------------------------------
// orphans
// ---------------------------------------------------------------------
const DECL_RE = /^(?:async\s+function\s+(\w+)\s*\(|function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\b)/;
const IS_FUNCTION_RE = /^(?:async\s+function|function)\b/;

// Finds a declaration's true end line via bracket-depth tracking over the
// masked (comment/string-stripped) text, rather than "until the next
// declaration starts" — the naive gap heuristic mis-attributes an
// intervening top-level IIFE's entire body to whatever single-line
// const/let happens to precede it. `function`/`async function` decls end at
// the matching `}` of their FIRST `{` (the body brace; parameter-list
// brackets fully close before it so the running depth is 0 there, making
// the first `{` unambiguous). `const`/`let`/`var` decls end at the first
// top-level (depth 0) `;` after the declaration starts.
function computeDeclExtent(maskedLines, startLine, hardCapLine, isFunction) {
  let sawOpenBrace = false;
  let depth = 0;
  for (let li = startLine; li <= hardCapLine; li++) {
    const text = maskedLines[li] || "";
    for (let ci = 0; ci < text.length; ci++) {
      const ch = text[ci];
      if (isFunction) {
        if (!sawOpenBrace) {
          if (ch === "{") {
            sawOpenBrace = true;
            depth = 1;
          }
          continue;
        }
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) return li;
        }
      } else {
        if (ch === "{" || ch === "[" || ch === "(") depth++;
        else if (ch === "}" || ch === "]" || ch === ")") depth--;
        else if (ch === ";" && depth <= 0) return li;
      }
    }
  }
  return hardCapLine; // fallback: never found a clean end, cap at the boundary
}

function collectDeclarations(lines, regions, maskedLines) {
  const { classicStart, moduleStart } = regions;
  const raw = [];
  for (let idx = classicStart + 1; idx < moduleStart; idx++) {
    const line = lines[idx];
    const m = DECL_RE.exec(line);
    if (!m) continue;
    const name = m[1] || m[2] || m[3];
    if (!name) continue;
    raw.push({ name, line: idx, isFunction: IS_FUNCTION_RE.test(line) });
  }
  const decls = [];
  for (let i = 0; i < raw.length; i++) {
    const hardCap = i + 1 < raw.length ? raw[i + 1].line - 1 : moduleStart - 1;
    const endLine = computeDeclExtent(maskedLines, raw[i].line, hardCap, raw[i].isFunction);
    decls.push({ name: raw[i].name, line: raw[i].line, endLine });
  }
  return decls;
}

function collectModuleOwnNames(lines, regions, masked) {
  const { moduleStart, moduleEnd } = regions;
  const names = new Set();
  for (let idx = moduleStart + 1; idx < moduleEnd; idx++) {
    const text = masked[idx];
    if (!text) continue;
    // import { A, B as C, D } from "...";
    const importMatch = /^\s*import\s*\{([^}]*)\}\s*from/.exec(text);
    if (importMatch) {
      for (const part of importMatch[1].split(",")) {
        const piece = part.trim();
        if (!piece) continue;
        const asMatch = /\bas\s+(\w+)$/.exec(piece);
        const bound = asMatch ? asMatch[1] : piece.split(/\s+/)[0];
        if (bound) names.add(bound);
      }
      continue;
    }
    const declMatch = /^\s*(?:const|let|var)\s+(\w+)\b/.exec(text);
    if (declMatch) names.add(declMatch[1]);
  }
  return names;
}

// Everything in the classic region that does NOT fall inside a recognized
// top-level function/const/let/var declaration's extent is a "classic
// top-level statement" for root purposes — this deliberately includes the
// full nested body of top-level IIFEs (`(function initTabs(){ ... })();`),
// since an IIFE executes immediately at load time and its nested function
// declarations (e.g. `showTab`) are themselves live roots the same way a
// direct top-level call would be; restricting to column-0 lines would miss
// every reference inside such an IIFE's indented body.
function collectClassicTopLevelStatementLines(lines, regions, decls) {
  const { classicStart, moduleStart } = regions;
  const covered = new Array(lines.length).fill(false);
  for (const d of decls) {
    for (let idx = d.line; idx <= d.endLine; idx++) covered[idx] = true;
  }
  const out = [];
  for (let idx = classicStart + 1; idx < moduleStart; idx++) {
    if (covered[idx]) continue;
    out.push(idx);
  }
  return out;
}

function textReferencesName(text, name) {
  for (const m of findMatches(text, name)) {
    if (isObjectKeyMatch(text, m.index, m.length)) continue;
    if (isCutPointCall(text, m.index, m.length, name)) continue;
    if (isWindowAssignmentTarget(text, m.index, m.length)) continue;
    if (isForeignMemberAccess(text, m.index)) continue;
    return true;
  }
  return false;
}

// Propagation edges FROM a reachable declaration's body TO another declared
// name require an actual CALL (`name(`) — a bare data-table index read like
// `SUB_NOTE[c.sub]` inside an otherwise-live function does not keep the
// table itself alive for orphan-detection purposes (a live renderer reading
// a soon-to-be-bridged classic table is exactly what DEAD-02 replaces; it
// must still surface as an orphan candidate here). Cut points (move/
// newGame/makeCamp) are excluded the same as any other call.
function bodyCallsName(text, name) {
  for (const m of findMatches(text, name)) {
    if (isObjectKeyMatch(text, m.index, m.length)) continue;
    if (isForeignMemberAccess(text, m.index)) continue;
    const after = text.slice(m.index + m.length).replace(/^\s+/, "");
    if (!after.startsWith("(")) continue;
    if (isCutPointCall(text, m.index, m.length, name)) continue;
    return true;
  }
  return false;
}

// Shared by `orphans` and `refs`: which classic top-level declarations are
// reachable from the live roots (module script, HTML on*= attributes,
// classic top-level non-declaration statements), propagating through CALL
// edges only (see bodyCallsName's doc comment). `refs` uses this so a
// textual match sitting inside an ALREADY-dead declaration's body (e.g. a
// still-undeleted layer-2 caller like classic newGame() calling
// rollCharacter()) does not block deleting the CALLED name — 44-CONTEXT.md's
// A-1 flagged assumption is explicit that the sweep gate concerns
// references "from LIVE code", not from other equally-dead code that just
// hasn't been swept yet in an earlier layer.
function computeReachability(lines, regions, masked, debugSet) {
  const decls = collectDeclarations(lines, regions, masked);
  const declByName = new Map();
  for (const d of decls) declByName.set(d.name, d);

  const moduleOwnNames = collectModuleOwnNames(lines, regions, masked);
  const topLevelStmtLines = collectClassicTopLevelStatementLines(lines, regions, decls);

  // Root text sources: module script (minus names it shadows itself),
  // HTML on*= attribute values (outside both script regions), and classic
  // top-level non-declaration statement lines.
  function rootsReference(name) {
    if (!moduleOwnNames.has(name)) {
      const { moduleStart, moduleEnd } = regions;
      for (let idx = moduleStart + 1; idx < moduleEnd; idx++) {
        const text = masked[idx];
        if (text && textReferencesName(text, name)) return true;
      }
    }
    const { classicStart, classicEnd, moduleStart, moduleEnd } = regions;
    for (let idx = 0; idx < lines.length; idx++) {
      const inClassic = idx > classicStart && idx < classicEnd;
      const inModule = idx > moduleStart && idx < moduleEnd;
      if (inClassic || inModule) continue;
      const text = masked[idx];
      if (text && textReferencesName(text, name)) return true;
    }
    for (const idx of topLevelStmtLines) {
      if (textReferencesName(masked[idx], name)) return true;
    }
    return false;
  }

  function declBodyText(decl) {
    return masked.slice(decl.line, decl.endLine + 1).join("\n");
  }

  const reachable = new Set();
  const queue = [];
  for (const d of decls) {
    if (rootsReference(d.name)) {
      if (debugSet && debugSet.has(d.name)) console.error(`DEBUG: ${d.name} is a DIRECT ROOT`);
      reachable.add(d.name);
      queue.push(d);
    }
  }
  while (queue.length) {
    const d = queue.shift();
    const body = declBodyText(d);
    for (const other of decls) {
      if (reachable.has(other.name)) continue;
      if (other.name === d.name) continue;
      if (bodyCallsName(body, other.name)) {
        if (debugSet && debugSet.has(other.name)) {
          console.error(`DEBUG: ${other.name} reached via ${d.name} (L${d.line + 1}-${d.endLine + 1})`);
        }
        reachable.add(other.name);
        queue.push(other);
      }
    }
  }

  return { decls, reachable };
}

function cmdOrphans(args) {
  // See cmdRefs' matching comment — same CRLF normalization.
  const raw = fs.readFileSync(args.file, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const regions = findRegions(lines);
  const masked = buildMaskedLines(lines, regions);

  const debugSet = args.debug ? new Set(args.debug.split(",")) : null;
  const { decls, reachable } = computeReachability(lines, regions, masked, debugSet);
  const orphaned = decls.filter((d) => !reachable.has(d.name));

  console.log(
    "ADVISORY — reachability estimate only. Not a gate. Verify every name via `refs` before deleting."
  );
  console.log(`${orphaned.length} orphaned of ${decls.length} classic top-level declarations:`);
  for (const d of orphaned) {
    console.log(`${d.name} L${d.line + 1}-${d.endLine + 1}`);
  }
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd === "refs") cmdRefs(args);
  else if (cmd === "orphans") cmdOrphans(args);
  else {
    console.error("Usage: shell-sweep.mjs refs NAME [NAME...] | orphans [--file <path>]");
    process.exit(2);
  }
}

main();
