// test/persistence/harness/sandboxClassicPersistence.js
//
// Extracts mazeworld.html's OWN classic-script save()/load()/saveGraves()/
// loadGraves() source VERBATIM (via sentinel-comment markers, not a
// reimplementation) and evaluates it in a minimal node:vm context, so
// test/persistence/dual-write-convergence.test.js can prove the ACTUAL
// living function bodies route through `window.mzStorage` — not a copy that
// could silently drift from the real file. Mirrors the extraction technique
// test/parity/harness/sandboxPrototype.js already uses for the frozen
// prototype fixture, but reads the LIVE mazeworld.html (this file must stay
// in sync with the real, still-changing classic script) and only extracts
// the two small persistence-function blocks rather than running the whole
// script (which would require a much larger DOM/canvas stub surface — see
// sandboxPrototype.js's fakeElement()).
//
// mazeworld.html marks the two blocks with sentinel comments this file's
// extractBlock() looks for:
//   /* @gsd:dual-write-convergence-extract:graves:start */ ... :graves:end
//   /* @gsd:dual-write-convergence-extract:save:start */   ... :save:end
// If either marker pair is missing (e.g. before 02-03 Task 2 lands, or if a
// future edit accidentally removes them), extraction throws — a loud,
// specific failure rather than a silently-stale/empty test.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAZEWORLD_HTML_PATH = path.join(__dirname, "..", "..", "..", "mazeworld.html");

function extractBlock(source, startMarker, endMarker) {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `sandboxClassicPersistence: extraction markers not found in mazeworld.html ` +
        `(looked for "${startMarker}" .. "${endMarker}"). The classic script's ` +
        `save/load/saveGraves/loadGraves persistence functions must be wrapped in ` +
        `these sentinel comments for this test harness to extract them verbatim.`,
    );
  }
  return source.slice(startIdx + startMarker.length, endIdx);
}

/**
 * loadClassicPersistenceSandbox({ mzStorage }) — runs the extracted graveyard
 * + run-save blocks in a fresh vm context. `SAVE_KEY` is provided directly as
 * a sandbox global rather than extracted (it's declared far away, near the
 * top of the classic script's rules-tables section — mazeworld.html line
 * ~488 — duplicated here as a literal, matching the SAME documented
 * duplicated-literal convention src/browser/engineAdapter.js already uses for
 * this exact key). `GRAVE_KEY` IS extracted verbatim (it's declared
 * immediately above loadGraves/saveGraves in the source, inside the
 * `:graves:` block).
 *
 * Returns the vm context: `save`/`load`/`saveGraves`/`loadGraves` (top-level
 * `function` declarations) are reflected as context properties automatically
 * (node:vm semantics — unlike `let`/`const`), so callers can `await
 * context.save()` etc. directly. `context.S` is a plain mutable sandbox
 * property (not a `let` inside the extracted block), so tests can assign
 * `context.S = {...}` before calling save()/load(). `context.graves` is
 * exposed via a live getter/setter (mirrors sandboxPrototype.js's identical
 * trick for `S`), since `let graves = []` inside the extracted block IS a
 * vm-scoped lexical binding not reflected on the global object.
 */
export function loadClassicPersistenceSandbox({ mzStorage }) {
  const html = fs.readFileSync(MAZEWORLD_HTML_PATH, "utf8");

  const graveBlock = extractBlock(
    html,
    "/* @gsd:dual-write-convergence-extract:graves:start */",
    "/* @gsd:dual-write-convergence-extract:graves:end */",
  );
  const saveBlock = extractBlock(
    html,
    "/* @gsd:dual-write-convergence-extract:save:start */",
    "/* @gsd:dual-write-convergence-extract:save:end */",
  );

  const sandbox = { console, S: null, SAVE_KEY: "mazeworld.delve.v1" };
  sandbox.window = sandbox;
  sandbox.window.mzStorage = mzStorage;

  const context = vm.createContext(sandbox);
  vm.runInContext(graveBlock + "\n" + saveBlock, context, {
    filename: "mazeworld.html (classic persistence extract)",
  });
  vm.runInContext(
    "Object.defineProperty(globalThis, 'graves', { get: () => graves, set: (v) => { graves = v; }, configurable: true });",
    context,
  );

  return context;
}
