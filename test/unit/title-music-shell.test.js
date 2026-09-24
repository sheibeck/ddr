// test/unit/title-music-shell.test.js
//
// Quick task 260924-51h: the title theme's shell wiring in mazeworld.html,
// pinned by a comment-stripped source scan (tools/ident-sweep.mjs's
// stripHtml, the same stripper sfx-settings.test.js and shell-pgs.test.js
// trust). The behaviour itself is pinned elsewhere — the controller in
// test/unit/titleMusic.test.js, the player in test/unit/sfx-music.test.js,
// the lifecycle hooks in test/persistence/lifecycle.test.js; this file
// proves the shell actually connects them where it must, and that the
// title-screen function bodies other tests evaluate stayed untouched.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const html = stripHtml(fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8"));

/**
 * extractBody(source, signatureRe) — finds signatureRe (which must end with
 * the body's own opening `{`) and brace-counts to the matching `}`. The
 * bodies scanned here hold no string literal with an unbalanced brace.
 */
function extractBody(source, signatureRe) {
  const m = signatureRe.exec(source);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** extractCallArgs(source, marker) — marker ends with "("; returns "( ... )". */
function extractCallArgs(source, marker, from = 0) {
  const idx = source.indexOf(marker, from);
  if (idx === -1) return null;
  const open = idx + marker.length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function unlockChainOk(source) {
  const count = (source.match(/unlockSfx\(/g) || []).length;
  const body = extractBody(source, /function unlockAudioAndSync\(\)\s*\{/);
  return count === 1 && !!body && /unlockSfx\(\)\.then\(syncTitleMusic/.test(body);
}

test("title-music-shell (1): imports createTitleMusic from titleMusic.js; the sfx.js import names startMusic, stopMusic, stopAllSfx and isSfxUnlocked", () => {
  assert.ok(html.includes('import { createTitleMusic } from "./src/browser/titleMusic.js";'));
  const sfxLine = html.split("\n").find((l) => l.includes('from "./src/browser/sfx.js"'));
  assert.ok(sfxLine, "the sfx.js import line must exist");
  for (const name of ["startMusic", "stopMusic", "stopAllSfx", "isSfxUnlocked", "unlockSfx"]) {
    assert.match(sfxLine, new RegExp(`\\b${name}\\b`), `sfx.js import must name ${name}`);
  }
});

test("title-music-shell (2): createTitleMusic is built with the shared reduced predicate and the sfx.js player", () => {
  const args = extractCallArgs(html, "createTitleMusic(");
  assert.ok(args, "createTitleMusic( call not found");
  assert.match(args, /reduced:\s*\(\)\s*=>\s*prefersReducedMotion\(window\)/);
  assert.ok(args.includes("startMusic"));
  assert.ok(args.includes("stopMusic"));
});

test("title-music-shell (3): the controller is declared before the first-gesture listener and before the boot settings await", () => {
  const decl = html.indexOf("const titleMusic = createTitleMusic(");
  const pointer = html.search(/"pointerdown",\s*\(e\) => \{\s*unlockAudioAndSync\(\);/);
  const boot = html.indexOf("applySettings(await readSettings())");
  assert.ok(decl > -1 && pointer > -1 && boot > -1);
  assert.ok(decl < pointer, "declared before the first-gesture pointerdown listener");
  assert.ok(decl < boot, "declared before applySettings(await readSettings())");
});

test("title-music-shell (4): the title area covers the title, the roller and the title-mode panel; the sync reads the unlock and the Sound mirror", () => {
  const showing = extractBody(html, /function titleMusicShowing\(\)\s*\{/);
  assert.ok(showing, "titleMusicShowing() must exist");
  assert.ok(showing.includes("mw-title-screen"));
  assert.ok(showing.includes("mw-roller-screen"), "user ruling 2026-09-24: the roller is part of the title area");
  assert.ok(showing.includes('dataset.boardsEntry === "title"'));
  const sync = extractBody(html, /function syncTitleMusic\(\)\s*\{/);
  assert.ok(sync, "syncTitleMusic() must exist");
  assert.ok(sync.includes("titleMusicShowing()"));
  assert.ok(sync.includes("isSfxUnlocked()"));
  assert.ok(sync.includes("currentSettings?.sound !== false"));
});

test("title-music-shell (5): unlockSfx( occurs exactly once, inside unlockAudioAndSync, chained to syncTitleMusic", () => {
  assert.ok(unlockChainOk(html));
});

// Phase 71 (D-15, 71-07): the tap moved to the capture-phase click listener
// (test/unit/ui-tap-shell.test.js), so the first-gesture pointerdown
// listener now only unlocks.
test("title-music-shell (6): the first-gesture listener unlocks through unlockAudioAndSync and plays no tap (the tap moved to click, D-15)", () => {
  const idx = html.search(/"pointerdown",\s*\(e\) => \{/);
  assert.ok(idx > -1);
  const region = html.slice(idx, html.indexOf("{ capture: true }", idx));
  assert.ok(region.includes("unlockAudioAndSync();"));
  assert.ok(!region.includes("playUiTap"));
});

test("title-music-shell (7): the settings click handler re-syncs on the Sound row", () => {
  const idx = html.indexOf('getElementById("mw-settings-rows")?.addEventListener("click"');
  assert.ok(idx > -1);
  const body = extractBody(html.slice(idx), /async \(e\) => \{/);
  assert.ok(body && body.includes('if (key === "sound") unlockAudioAndSync();'));
});

test("title-music-shell (8): one MutationObserver(syncTitleMusic) watches the title, the roller and the panel marker", () => {
  assert.ok(html.includes("new MutationObserver(syncTitleMusic)"));
  const idx = html.indexOf("new MutationObserver(syncTitleMusic)");
  const region = html.slice(idx, idx + 700);
  assert.ok(region.includes('"mw-title-screen"'));
  assert.ok(region.includes('"mw-roller-screen"'));
  assert.ok(region.includes('attributeFilter: ["hidden"]'));
  assert.ok(region.includes('attributeFilter: ["data-boards-entry"]'));
});

test("title-music-shell (9): registerNativeChrome passes the lifecycle hooks and keeps the waitForPending line", () => {
  const start = html.indexOf("registerNativeChrome({");
  const end = html.indexOf("getGameContext:", start);
  assert.ok(start > -1 && end > start);
  const slice = html.slice(start, end);
  assert.ok(slice.includes("onBackground: () => setAppActive(false)"));
  assert.ok(slice.includes("onForeground: () => setAppActive(true)"));
  assert.ok(slice.includes("waitForPending: () => Promise.all([waitForPending(), pgsQueue?.waitForPending()]),"));
});

test("title-music-shell (10): a visibilitychange listener drives setAppActive, and the FIRST visibilitychange listener is still the pgsQueue one", () => {
  assert.ok(html.includes('document.addEventListener("visibilitychange", () => setAppActive(document.visibilityState !== "hidden"));'));
  const first = html.indexOf('addEventListener("visibilitychange"');
  assert.ok(html.slice(first, first + 200).includes("pgsQueue"), "shell-pgs.test.js requires the pgsQueue listener to stay first");
});

test("title-music-shell (11): native launch — after boot settings, the device is opened one frame after first paint, native only", () => {
  const boot = html.indexOf("applySettings(await readSettings())");
  const launch = html.indexOf("requestAnimationFrame(() => setTimeout(unlockAudioAndSync, 0));");
  assert.ok(launch > boot && boot > -1, "the launch-time unlock must come after the settings are applied");
  const guard = html.lastIndexOf("if (window.Capacitor?.isNativePlatform?.()) {", launch);
  assert.ok(guard > -1 && launch - guard < 120, "the launch-time unlock is native-only");
});

test("title-music-shell (12): showTitleScreen, hideTitleScreen and routeFromBoards bodies never mention the title music (they run under new Function pins)", () => {
  for (const sig of [
    /function showTitleScreen\(\{ allowResume \} = \{\}\)\s*\{/,
    /function hideTitleScreen\(\)\s*\{/,
    /function routeFromBoards\(action, \{ hasHero \} = \{\}\)\s*\{/,
  ]) {
    const body = extractBody(html, sig);
    assert.ok(body, `${sig} must exist`);
    assert.equal(
      /titleMusic|syncTitleMusic/.test(body),
      false,
      "shell-account.test.js E7 and shell-boards-panel.test.js E1–E5 evaluate these bodies with a fixed scope; a new identifier would throw there"
    );
  }
});

test("title-music-shell (13): TEETH — a synthetic source missing the unlockAudioAndSync chain fails the check the real file passes", () => {
  const good = "function unlockAudioAndSync() {\n  unlockSfx().then(syncTitleMusic, () => {});\n}\n";
  const bad = "function unlockAudioAndSync() {\n  syncTitleMusic();\n}\ndocument.addEventListener('x', () => unlockSfx());\n";
  assert.equal(unlockChainOk(good), true);
  assert.equal(unlockChainOk(bad), false);
});
