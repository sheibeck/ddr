// test/unit/android-large-screen.test.js
//
// Phase 80 (DROID-03) — source pins for the large-screen decision:
//   1. The manifest declares the app a game (android:appCategory="game")
//      so Android 16 keeps honouring the portrait lock on large screens,
//      the MainActivity portrait lock itself is untouched, and no
//      resizeableActivity / restricted-resizability opt-out property has
//      been added alongside it.
//   2. src/browser/nativeChrome.js still locks orientation "portrait".
//   3. mazeworld.html carries exactly one <style id="mw-letterbox"> block,
//      positioned after every other <style> element in <head>, holding
//      BEGIN/END markers and a min-width:481px media query whose
//      html>body rule sets max-width:480px, margin:0 auto and a
//      containing-block declaration, and whose :root rule sets the
//      #080705 gutter background — and no OTHER style block in the file
//      sets a max-width on body.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const readRepoFile = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

// ─── Brace-matching helper (media queries and rule bodies can nest) ────────

/** Given `src` and the index of an opening `{`, returns the index of its matching `}`. */
function matchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("no matching closing brace found");
}

// ─── AndroidManifest.xml ────────────────────────────────────────────────────

test("DROID-03: the manifest declares the app a game, keeps the portrait lock, and adds no large-screen opt-out", () => {
  const manifest = readRepoFile("android/app/src/main/AndroidManifest.xml");

  const appTagMatch = manifest.match(/<application\b[^>]*>/);
  assert.ok(appTagMatch, "the manifest has an <application> start tag");
  assert.match(
    appTagMatch[0],
    /android:appCategory\s*=\s*"game"/,
    "the <application> element declares android:appCategory=\"game\""
  );

  const activityTagMatch = manifest.match(/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s);
  assert.ok(activityTagMatch, "the manifest has the .MainActivity <activity> tag");
  assert.match(
    activityTagMatch[0],
    /android:screenOrientation\s*=\s*"portrait"/,
    "the .MainActivity activity keeps android:screenOrientation=\"portrait\""
  );

  assert.doesNotMatch(
    manifest,
    /android:resizeableActivity\s*=/,
    "the manifest adds no android:resizeableActivity attribute"
  );
  assert.doesNotMatch(
    manifest,
    /PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY/,
    "the manifest adds no restricted-resizability compat property"
  );
});

// ─── src/browser/nativeChrome.js ────────────────────────────────────────────

test("DROID-03: nativeChrome.js still locks orientation to portrait", () => {
  const src = stripJs(readRepoFile("src/browser/nativeChrome.js"));
  assert.match(
    src,
    /ScreenOrientation\??\.lock\??\.?\(\{\s*orientation:\s*"portrait"\s*\}\)/,
    "registerNativeChrome still calls ScreenOrientation.lock({ orientation: \"portrait\" })"
  );
});

// ─── mazeworld.html: the delimited mw-letterbox style block ────────────────

test("DROID-03: mazeworld.html has exactly one mw-letterbox <style> block, last in <head>", () => {
  const html = readRepoFile("mazeworld.html");
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(headMatch, "mazeworld.html has a <head> section");
  const head = headMatch[1];

  const styleOpenTags = [...head.matchAll(/<style\b[^>]*>/g)];
  assert.ok(styleOpenTags.length >= 2, "the head has more than one <style> element");

  const letterboxOpenTags = styleOpenTags.filter((m) => /id\s*=\s*"mw-letterbox"/.test(m[0]));
  assert.equal(letterboxOpenTags.length, 1, "exactly one <style id=\"mw-letterbox\"> element exists");

  const lastOpenTag = styleOpenTags[styleOpenTags.length - 1];
  assert.match(
    lastOpenTag[0],
    /id\s*=\s*"mw-letterbox"/,
    "the mw-letterbox style element is the LAST <style> element in <head>"
  );
});

test("DROID-03: the mw-letterbox block holds BEGIN/END markers and the column rules", () => {
  const html = readRepoFile("mazeworld.html");
  const openTagMatch = html.match(/<style\s+id\s*=\s*"mw-letterbox"\s*>/);
  assert.ok(openTagMatch, "mazeworld.html has the <style id=\"mw-letterbox\"> opening tag");

  const blockStart = openTagMatch.index + openTagMatch[0].length;
  const closeIdx = html.indexOf("</style>", blockStart);
  assert.ok(closeIdx > blockStart, "the mw-letterbox style element has a closing </style>");
  const block = html.slice(blockStart, closeIdx);

  assert.match(block, /BEGIN\s+mw-letterbox/, "the block opens with a BEGIN mw-letterbox marker comment");
  assert.match(block, /END\s+mw-letterbox/, "the block closes with an END mw-letterbox marker comment");

  const mediaMatch = block.match(/@media\s*\(\s*min-width\s*:\s*481px\s*\)\s*\{/);
  assert.ok(mediaMatch, "the block has an @media (min-width:481px) query");
  const mediaOpenBraceIdx = mediaMatch.index + mediaMatch[0].length - 1;
  const mediaCloseBraceIdx = matchingBrace(block, mediaOpenBraceIdx);
  const mediaBody = block.slice(mediaOpenBraceIdx + 1, mediaCloseBraceIdx);

  const htmlBodyRuleMatch = mediaBody.match(/html\s*>\s*body\s*\{([^}]*)\}/);
  assert.ok(htmlBodyRuleMatch, "the media query has an html>body rule");
  const htmlBodyRule = htmlBodyRuleMatch[1];
  assert.match(htmlBodyRule, /max-width\s*:\s*480px/, "html>body sets max-width:480px");
  assert.match(htmlBodyRule, /margin\s*:\s*0\s+auto/, "html>body sets margin:0 auto");
  assert.match(
    htmlBodyRule,
    /contain\s*:\s*layout|transform\s*:\s*translateZ\(0\)/,
    "html>body declares a containing-block property (contain:layout, or the transform fallback)"
  );

  const rootRuleMatch = mediaBody.match(/:root\s*\{([^}]*)\}/);
  assert.ok(rootRuleMatch, "the media query has a :root rule");
  assert.match(rootRuleMatch[1], /background\s*:\s*#080705/, ":root sets background:#080705");
});

test("DROID-03: no OTHER <style> block in mazeworld.html sets a max-width on body", () => {
  const html = readRepoFile("mazeworld.html");
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
  const head = headMatch[1];

  const letterboxOpenMatch = head.match(/<style\s+id\s*=\s*"mw-letterbox"\s*>/);
  assert.ok(letterboxOpenMatch, "the mw-letterbox style element exists in <head>");
  const headWithoutLetterbox = head.slice(0, letterboxOpenMatch.index);

  assert.doesNotMatch(
    headWithoutLetterbox,
    /(?<![\w-])body(?![\w-])[^{]*\{[^}]*max-width/i,
    "no style block before mw-letterbox sets a max-width on body"
  );
});
