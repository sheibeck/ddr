"use strict";
// The website export and its check.
//
//   node webp.js --export <site repo>       write the four web shots as webp
//   node webp.js --check-site <site repo>   check the site's page and files
//   node webp.js --self-test                prove the check on scratch sites
//
// The website shows the four best shots only (user amendment, 2026-10-05):
// title, combat, deep floor and the achievements list, in the page's existing
// four-slot grid. featured.webp is the title key art and is NOT replaced by
// this tool; the check only requires it to be a sound file that matches the
// hero image's width and height attributes.
//
// Chrome (already this tool's browser) encodes the webp from a canvas, so no
// image package is needed. Config, play-rules and Node built-ins otherwise.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SCENES, SIZES, STORE_DIR, launchOptions } = require("./config.js");
const { checkTree } = require("./play-rules.js");

// The shot names the site shows, a prefix of the scene list so the order is the
// shot-list order.
const WEB_COUNT = 4;
const WEB_SCENES = SCENES.slice(0, WEB_COUNT);
const SHOT_W = 540;
const SHOT_H = 960;
const SHOT_BUDGET = 200 * 1024;
const FEATURED_BUDGET = 450 * 1024;
const ALT_MIN = 20;
const ALT_MAX = 125;
const HERO_ALT_MAX = 160;

const PAGE_REL = path.join("src", "pages", "delve-die-repeat", "index.astro");
const ASSETS_REL = path.join("public", "assets", "delve-die-repeat");

// ------------------------------------------------------------------ webp

// Returns { ok: false, error } or { ok: true, width, height, kind }.
function readWebp(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return { ok: false, error: "empty file" };
  if (buf.length < 30) return { ok: false, error: "too short to be a webp" };
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") {
    return { ok: false, error: "not a RIFF/WEBP file" };
  }
  if (buf.readUInt32LE(4) + 8 !== buf.length) {
    return { ok: false, error: "RIFF size " + (buf.readUInt32LE(4) + 8) + " does not match the file length " + buf.length };
  }
  const kind = buf.toString("latin1", 12, 16);
  if (kind === "VP8 ") {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return { ok: false, error: "bad VP8 start code" };
    return { ok: true, kind, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === "VP8L") {
    if (buf[20] !== 0x2f) return { ok: false, error: "bad VP8L signature" };
    const b = buf.readUInt32LE(21);
    return { ok: true, kind, width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8X") {
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { ok: true, kind, width: w + 1, height: h + 1 };
  }
  return { ok: false, error: "unknown webp chunk " + JSON.stringify(kind) };
}

// A header-only synthetic VP8X webp of the given size, padded to `bytes`.
function synthWebp(width, height, bytes) {
  const head = Buffer.alloc(30);
  head.write("RIFF", 0, "latin1");
  head.write("WEBP", 8, "latin1");
  head.write("VP8X", 12, "latin1");
  head.writeUInt32LE(10, 16);
  head.writeUIntLE(width - 1, 24, 3);
  head.writeUIntLE(height - 1, 27, 3);
  let total = Math.max(bytes || 30, 30);
  if (total % 2) total += 1;
  const pad = total - 30;
  let body = head;
  if (pad >= 8) {
    const p = Buffer.alloc(pad);
    p.write("JUNK", 0, "latin1");
    p.writeUInt32LE(pad - 8, 4);
    body = Buffer.concat([head, p]);
  }
  body.writeUInt32LE(body.length - 8, 4);
  return body;
}

// ------------------------------------------------------------------ page

function cp(s) {
  return [...s].length;
}

// Reads the shots array and the hero image out of index.astro.
function parsePage(text) {
  const arr = text.match(/const shots = \[([\s\S]*?)\n\];/);
  const shots = [];
  if (arr) {
    const re = /src:\s*"([^"]*)",\s*alt:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(arr[1]))) shots.push({ src: m[1], alt: m[2].replace(/\\(.)/g, "$1") });
  }
  const hero = text.match(
    /<img class="ddr-hero-art" src="([^"]*)"\s+width="(\d+)"\s+height="(\d+)"\s+alt="([^"]*)"/
  );
  return {
    shots,
    hero: hero ? { src: hero[1], width: +hero[2], height: +hero[3], alt: hero[4] } : null,
    shotsHeight: (text.match(/<img src=\{`\/assets\/delve-die-repeat\/shots\/\$\{s\.src\}\.webp`\}[^>]*>/) || [""])[0],
  };
}

// Returns a list of failure lines; empty means the site is sound.
function checkSite(site) {
  const bad = [];
  const pagePath = path.join(site, PAGE_REL);
  const assets = path.join(site, ASSETS_REL);
  let raw;
  try {
    raw = fs.readFileSync(pagePath);
  } catch (e) {
    return ["cannot read " + pagePath + ": " + e.message];
  }
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) bad.push("index.astro begins with a byte-order mark");
  const page = parsePage(raw.toString("utf8"));

  // names and order
  const want = WEB_SCENES.map((s) => s.file.replace(/\.png$/, ""));
  const got = page.shots.map((s) => s.src);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    bad.push("shots names are [" + got.join(", ") + "], need [" + want.join(", ") + "] in scene order");
  }

  // alts
  const seen = new Set();
  for (const s of page.shots) {
    const n = cp(s.alt);
    if (!s.alt.trim()) bad.push(s.src + ": alt is empty");
    else {
      if (n < ALT_MIN) bad.push(s.src + ": alt is " + n + " code points, under " + ALT_MIN);
      if (n > ALT_MAX) bad.push(s.src + ": alt is " + n + " code points, over " + ALT_MAX);
    }
    if (/\p{Extended_Pictographic}/u.test(s.alt)) bad.push(s.src + ": alt contains an emoji");
    if (seen.has(s.alt)) bad.push(s.src + ": alt repeats another shot's alt");
    seen.add(s.alt);
  }
  if (!/height="960"/.test(page.shotsHeight)) bad.push("the shots img has no height=\"960\"");

  // the shot files
  const shotsDir = path.join(assets, "shots");
  for (const s of page.shots) {
    const fp = path.join(shotsDir, s.src + ".webp");
    const r = readFile(fp, s.src + ".webp");
    if (r.fail) {
      bad.push(r.fail);
      continue;
    }
    if (r.webp.width !== SHOT_W || r.webp.height !== SHOT_H) {
      bad.push(s.src + ".webp: " + r.webp.width + " x " + r.webp.height + ", need " + SHOT_W + " x " + SHOT_H);
    }
    if (r.size > SHOT_BUDGET) bad.push(s.src + ".webp: " + r.size + " bytes, over " + SHOT_BUDGET);
  }
  let listed = [];
  try {
    listed = fs.readdirSync(shotsDir);
  } catch (e) {
    bad.push("cannot list " + shotsDir);
  }
  for (const f of listed) {
    if (!page.shots.some((s) => s.src + ".webp" === f)) bad.push("shots/" + f + ": not referenced by the page");
  }

  // the hero
  if (!page.hero) bad.push("the hero img was not found in index.astro");
  else {
    const h = page.hero;
    if (!h.alt.trim()) bad.push("hero alt is empty");
    if (cp(h.alt) > HERO_ALT_MAX) bad.push("hero alt is " + cp(h.alt) + " code points, over " + HERO_ALT_MAX);
    if (/\p{Extended_Pictographic}/u.test(h.alt)) bad.push("hero alt contains an emoji");
    const rel = h.src.replace(/^\/assets\/delve-die-repeat\//, "");
    const r = readFile(path.join(assets, rel), rel);
    if (r.fail) bad.push(r.fail);
    else {
      if (r.size > FEATURED_BUDGET) bad.push(rel + ": " + r.size + " bytes, over " + FEATURED_BUDGET);
      if (r.webp.width !== h.width || r.webp.height !== h.height) {
        bad.push("hero attributes " + h.width + " x " + h.height + " differ from " + rel + " (" + r.webp.width + " x " + r.webp.height + ")");
      }
    }
  }
  return bad;
}

function readFile(fp, label) {
  let buf;
  try {
    buf = fs.readFileSync(fp);
  } catch (e) {
    return { fail: label + ": missing" };
  }
  if (buf.length === 0) return { fail: label + ": zero bytes" };
  const webp = readWebp(buf);
  if (!webp.ok) return { fail: label + ": " + webp.error };
  return { webp, size: buf.length };
}

// ------------------------------------------------------------------ export

async function encode(page, pngBuf, w, h, q) {
  const url = "data:image/png;base64," + pngBuf.toString("base64");
  const b64 = await page.evaluate(
    async ({ url, w, h, q }) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/webp", q).split(",")[1];
    },
    { url, w, h, q }
  );
  return Buffer.from(b64, "base64");
}

async function exportSite(site) {
  const tree = checkTree(STORE_DIR);
  if (!tree.ok) {
    for (const v of tree.violations) console.log(v);
    throw new Error("the installed store-listing tree fails the Play rules");
  }
  const outDir = path.join(site, ASSETS_REL, "shots");
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    const keep = new Set();
    for (const scene of WEB_SCENES) {
      const png = fs.readFileSync(path.join(STORE_DIR, SIZES.phone.folder, scene.file));
      const name = scene.file.replace(/\.png$/, "") + ".webp";
      let q = 0.8;
      let buf = await encode(page, png, SHOT_W, SHOT_H, q);
      while (buf.length > SHOT_BUDGET && q > 0.6) {
        q = Math.round((q - 0.05) * 100) / 100;
        buf = await encode(page, png, SHOT_W, SHOT_H, q);
      }
      fs.writeFileSync(path.join(outDir, name), buf);
      keep.add(name);
      console.log("shots/" + name + "  " + buf.length + " bytes  q " + q);
    }
    for (const f of fs.readdirSync(outDir)) {
      if (!keep.has(f)) {
        fs.rmSync(path.join(outDir, f));
        console.log("removed shots/" + f);
      }
    }
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------------ self-test

const GOOD_ALTS = [
  "Title screen with the key art, the ENTER button and VIEW THE DEAD",
  "Combat against two Gremlins with the log lines and two abilities",
  "A deep floor on the map with the party and the arrow pad",
  "The achievements list with the count earned and the secrets left",
];

function pageText(alts, opts) {
  const o = opts || {};
  const names = o.names || WEB_SCENES.map((s) => s.file.replace(/\.png$/, ""));
  const lines = names.map((n, i) => '  { src: "' + n + '", alt: "' + alts[i] + '" },').join("\n");
  return (
    (o.bom ? "﻿" : "") +
    "---\nconst shots = [\n" +
    lines +
    '\n];\n---\n<header>\n<img class="ddr-hero-art" src="/assets/delve-die-repeat/featured.webp" width="' +
    (o.heroW || 1794) +
    '" height="876"\n  alt="' +
    (o.heroAlt || "Key art of adventurers at a gate") +
    '" />\n</header>\n{shots.map((s) => (\n  <img src={`/assets/delve-die-repeat/shots/${s.src}.webp`} alt={s.alt} loading="lazy" width="540" height="960" />\n))}\n'
  );
}

function buildScratch(dir, alts, opts) {
  const o = opts || {};
  fs.mkdirSync(path.join(dir, path.dirname(PAGE_REL)), { recursive: true });
  const shots = path.join(dir, ASSETS_REL, "shots");
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync(path.join(dir, PAGE_REL), pageText(alts, o), "utf8");
  fs.writeFileSync(path.join(dir, ASSETS_REL, "featured.webp"), synthWebp(1794, 876, 4000));
  for (const s of WEB_SCENES) {
    fs.writeFileSync(path.join(shots, s.file.replace(/\.png$/, ".webp")), synthWebp(SHOT_W, SHOT_H, 3000));
  }
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "webp-selftest-"));
  const cases = [];
  let n = 0;
  function run(name, build, expect) {
    const dir = path.join(root, "c" + n++);
    build(dir);
    const bad = checkSite(dir);
    const hit = expect === null ? bad.length === 0 : bad.some((l) => l.includes(expect));
    cases.push({ name, ok: hit, bad });
  }
  const shotPath = (d, i) => path.join(d, ASSETS_REL, "shots", WEB_SCENES[i].file.replace(/\.png$/, ".webp"));
  run("a good site passes", (d) => buildScratch(d, GOOD_ALTS), null);
  run("a missing file fails", (d) => (buildScratch(d, GOOD_ALTS), fs.rmSync(shotPath(d, 1))), ": missing");
  run("a zero-byte file fails", (d) => (buildScratch(d, GOOD_ALTS), fs.writeFileSync(shotPath(d, 2), "")), "zero bytes");
  run("a wrong dimension fails", (d) => (buildScratch(d, GOOD_ALTS), fs.writeFileSync(shotPath(d, 0), synthWebp(540, 961, 3000))), "need 540 x 960");
  run("a file that is not a webp fails", (d) => (buildScratch(d, GOOD_ALTS), fs.writeFileSync(shotPath(d, 3), Buffer.alloc(64, 7))), "not a RIFF/WEBP");
  run("an over-budget shot fails", (d) => (buildScratch(d, GOOD_ALTS), fs.writeFileSync(shotPath(d, 0), synthWebp(540, 960, SHOT_BUDGET + 2000))), "over " + SHOT_BUDGET);
  run("a repeated alt fails", (d) => buildScratch(d, [GOOD_ALTS[0], GOOD_ALTS[0], GOOD_ALTS[2], GOOD_ALTS[3]]), "repeats");
  run("an over-long alt fails", (d) => buildScratch(d, [GOOD_ALTS[0], "x".repeat(126), GOOD_ALTS[2], GOOD_ALTS[3]]), "over " + ALT_MAX);
  run("a short alt fails", (d) => buildScratch(d, [GOOD_ALTS[0], "Combat", GOOD_ALTS[2], GOOD_ALTS[3]]), "under " + ALT_MIN);
  run("an empty alt fails", (d) => buildScratch(d, [GOOD_ALTS[0], GOOD_ALTS[1], "", GOOD_ALTS[3]]), "alt is empty");
  run("an emoji alt fails", (d) => buildScratch(d, [GOOD_ALTS[0], GOOD_ALTS[1], "A deep floor on the map \u{1F5FA} with the party", GOOD_ALTS[3]]), "emoji");
  run("an alt of 125 emoji-free multibyte code points passes (code points, not bytes)", (d) => buildScratch(d, [GOOD_ALTS[0], "é".repeat(125), GOOD_ALTS[2], GOOD_ALTS[3]]), null);
  run("a stray extra file fails", (d) => (buildScratch(d, GOOD_ALTS), fs.writeFileSync(path.join(d, ASSETS_REL, "shots", "04-death.webp"), synthWebp(540, 960, 3000))), "not referenced");
  run("shots out of scene order fail", (d) => buildScratch(d, GOOD_ALTS, { names: ["02-combat", "01-title", "03-deep", "04-achievements"] }), "scene order");
  run("a byte-order mark fails", (d) => buildScratch(d, GOOD_ALTS, { bom: true }), "byte-order mark");
  run("a hero width that differs from the file fails", (d) => buildScratch(d, GOOD_ALTS, { heroW: 1920 }), "hero attributes");
  run("a hero alt over 160 code points fails", (d) => buildScratch(d, GOOD_ALTS, { heroAlt: "y".repeat(161) }), "hero alt is 161");
  run("a missing featured file fails", (d) => (buildScratch(d, GOOD_ALTS), fs.rmSync(path.join(d, ASSETS_REL, "featured.webp"))), "featured.webp: missing");
  let failed = 0;
  for (const c of cases) {
    console.log((c.ok ? "PASS " : "FAIL ") + c.name + (c.ok ? "" : "   got: " + JSON.stringify(c.bad)));
    if (!c.ok) failed++;
  }
  fs.rmSync(root, { recursive: true, force: true });
  console.log(cases.length + " cases, " + failed + " failed");
  return failed === 0;
}

// ------------------------------------------------------------------ main

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : null;
  };
  const check = take("--check-site");
  const exp = take("--export");
  if (check) {
    const bad = checkSite(check);
    if (bad.length) {
      for (const l of bad) console.log("FAIL " + l);
      process.exit(1);
    }
    console.log("site ok: " + WEB_COUNT + " shots, hero, alts and budgets pass");
    return;
  }
  if (exp) {
    await exportSite(exp);
    return;
  }
  console.error("usage: node webp.js --export <site repo> | --check-site <site repo> | --self-test");
  process.exit(2);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { readWebp, synthWebp, checkSite, parsePage };
