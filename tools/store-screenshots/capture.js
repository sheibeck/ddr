"use strict";
// The one command: rebuild www/, regenerate the seeds, serve www/, render the eight
// scenes at the three sizes, check every frame and the whole tree, exit non-zero on
// any miss.
//
//   node capture.js                          everything, from clean
//   node capture.js --sizes phone,tab7       only these sizes (phone, tab7, tab10)
//   node capture.js --only combat,deep       only these scenes (title, combat, deep,
//                                            achievements, death, hero, store, board)
//   node capture.js --no-build               skip the www/ rebuild (iteration only; the
//                                            final run is always a full one)
//
// One capture runs at a time: it owns the port and the out/ tree. A second run finds the
// port taken and exits with a message. Nothing is applied to a PNG after Chrome writes it.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright-core");

const config = require("./config.js");
const { SIZES, SCENES: SCENE_LIST, PORT, ORIGIN, OUT_DIR, KEYS, launchOptions } = config;
const { checkTree, readPng } = require("./play-rules.js");
const { attachGuards, frameReport } = require("./frame-guard.js");
const serve = require("./serve.js");
const { SCENES } = require("./scenes.js");

const ROOT = path.resolve(__dirname, "..", "..");
const BOOT_MS = 300000; // a cold page boot on a slow machine
const SCENE_MS = 120000;

function parseArgs(argv) {
  const out = { sizes: Object.keys(SIZES), only: SCENE_LIST.map((s) => s.id), build: true, full: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sizes") {
      out.sizes = String(argv[++i] || "").split(",").filter(Boolean);
      out.full = false;
    } else if (a === "--only") {
      out.only = String(argv[++i] || "").split(",").filter(Boolean);
      out.full = false;
    } else if (a === "--no-build") out.build = false;
    else {
      console.error("unknown argument: " + a);
      process.exit(2);
    }
  }
  for (const s of out.sizes) if (!SIZES[s]) (console.error("unknown size: " + s), process.exit(2));
  for (const s of out.only) if (!SCENES[s]) (console.error("unknown scene: " + s), process.exit(2));
  return out;
}

function child(label, file, args) {
  const r = spawnSync(process.execPath, [file].concat(args || []), { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(label + " failed (exit " + r.status + ")");
    console.error((r.stdout || "").split("\n").slice(-20).join("\n"));
    console.error(r.stderr || "");
    process.exit(1);
  }
}

function versionInfo() {
  const text = fs.readFileSync(path.join(ROOT, "android", "version.properties"), "utf8");
  const pick = (k) => ((text.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1] || "").trim();
  return { versionName: pick("versionName"), versionCode: Number(pick("versionCode")) };
}

// Two frames, fonts, every visible image decoded, then a pause for any last paint.
async function settle(page) {
  await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const imgs = [...document.images].filter((i) => i.getClientRects().length > 0);
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? i.decode ? i.decode().catch(() => {}) : null
          : new Promise((r) => {
              i.onload = i.onerror = r;
            })
      )
    );
  });
  await page.waitForTimeout(600);
}

async function shoot(browser, key, id, seeds, guardsOut) {
  const def = SIZES[key];
  const scene = SCENES[id];
  const meta = SCENE_LIST.find((s) => s.id === id);
  const seed = seeds.scenes[id] || {};
  const ctx = { size: key, def, tablet: key !== "phone", seed, seeds };
  const file = path.join(OUT_DIR, def.folder, meta.file);
  const entry = { size: key, scene: id, file: path.relative(OUT_DIR, file).split(path.sep).join("/"), ok: false, failures: [], checks: [], layout: null, textHead: "" };

  const context = await browser.newContext({
    viewport: { width: def.css[0], height: def.css[1] },
    screen: { width: def.css[0], height: def.css[1] },
    deviceScaleFactor: def.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const guards = await attachGuards(context, ORIGIN);
  const init = {
    keys: KEYS,
    settings: JSON.stringify(seeds.settings),
    notes: seeds.notesVersion,
    achKey: seeds.achievementsKey,
    record: seed.record || null,
    // death and store inject a state over the resumed deep run
    save: scene.resume ? (scene.saveFrom ? (seeds.scenes[scene.saveFrom] || {}).save : seed.save) || null : null,
  };
  await context.addInitScript((i) => {
    try {
      localStorage.clear();
      localStorage.setItem(i.keys.settings, i.settings);
      localStorage.setItem(i.keys.notesSeen, i.notes);
      if (i.record) localStorage.setItem(i.achKey, i.record);
      if (i.save) localStorage.setItem(i.keys.save, i.save);
    } catch (e) {
      /* a blocked storage shows up as a failed frame */
    }
  }, init);

  const page = await context.newPage();
  page.setDefaultTimeout(SCENE_MS);
  let failure = null;
  try {
    await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: BOOT_MS });
    await page.waitForFunction(() => {
      const b = document.getElementById("mw-title-enter");
      return b && !b.disabled;
    }, null, { timeout: BOOT_MS });
    await scene.run(page, ctx);
    await settle(page);
  } catch (e) {
    failure = "recipe: " + (e && e.message ? e.message.split("\n")[0] : String(e));
  }

  try {
    const spec = scene.spec(ctx);
    const report = await frameReport(page, guards, spec);
    entry.checks = report.checks.slice();
    entry.failures = report.failures.slice();
    entry.textHead = report.text.slice(0, 160);
    if (!failure && scene.extra) {
      for (const c of await scene.extra(page, ctx, report)) {
        entry.checks.push({ name: c.name, ok: !!c.ok, detail: c.detail || "" });
        if (!c.ok) entry.failures.push(c.name + (c.detail ? " (" + c.detail + ")" : ""));
      }
    }
    entry.layout = await page.evaluate(() => document.documentElement.dataset.mwLayout || null);
  } catch (e) {
    entry.failures.push("frame check: " + (e && e.message ? e.message.split("\n")[0] : String(e)));
  }
  if (failure) entry.failures.unshift(failure);

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    const png = readPng(fs.readFileSync(file));
    if (!png.ok) entry.failures.push("screenshot is not a PNG: " + png.error);
    else if (png.width !== def.px[0] || png.height !== def.px[1]) {
      entry.failures.push("screenshot is " + png.width + " x " + png.height + ", need " + def.px[0] + " x " + def.px[1]);
    }
  } catch (e) {
    entry.failures.push("screenshot: " + (e && e.message ? e.message.split("\n")[0] : String(e)));
  }

  for (const u of guards.blocked) guardsOut.push({ size: key, scene: id, url: u });
  entry.ok = entry.failures.length === 0;
  await context.close();
  return entry;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.build) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "build-www.mjs")], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
      console.error("build-www failed (exit " + r.status + ")\n" + (r.stdout || "").split("\n").slice(-15).join("\n") + (r.stderr || ""));
      process.exit(1);
    }
  } else {
    console.log("--no-build: www/ is as the last build left it (iteration only)");
  }
  child("seed.mjs", path.join(__dirname, "seed.mjs"), []);
  const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, "seeds.json"), "utf8"));

  let server;
  try {
    server = await serve.start(PORT);
  } catch (e) {
    console.error(
      "port " + PORT + " is not free (" + e.message + "). One capture runs at a time: stop the other run (or whatever holds the port) and try again."
    );
    process.exit(2);
  }

  if (args.full) {
    for (const key of Object.keys(SIZES)) fs.rmSync(path.join(OUT_DIR, SIZES[key].folder), { recursive: true, force: true });
    fs.rmSync(path.join(OUT_DIR, "contact"), { recursive: true, force: true });
    fs.rmSync(path.join(OUT_DIR, "manifest.json"), { force: true });
  }
  for (const key of Object.keys(SIZES)) fs.mkdirSync(path.join(OUT_DIR, SIZES[key].folder), { recursive: true });

  const browser = await chromium.launch(launchOptions());
  const shots = [];
  const blocked = [];
  const times = {};
  try {
    for (const key of args.sizes) {
      const t0 = Date.now();
      for (const meta of SCENE_LIST) {
        if (!args.only.includes(meta.id)) continue;
        const entry = await shoot(browser, key, meta.id, seeds, blocked);
        shots.push(entry);
        console.log((entry.ok ? "ok    " : "FAIL  ") + entry.file + (entry.ok ? "" : "  " + entry.failures.join("; ")));
      }
      times[key] = Math.round((Date.now() - t0) / 1000);
      console.log(key + ": " + times[key] + " s");
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  const rules = checkTree(OUT_DIR, { partial: !args.full });
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  // A partial run keeps the entries it did not touch.
  let merged = shots;
  if (!args.full && fs.existsSync(manifestPath)) {
    try {
      const old = JSON.parse(fs.readFileSync(manifestPath, "utf8")).shots || [];
      const keep = old.filter((o) => !shots.some((s) => s.size === o.size && s.scene === o.scene));
      merged = keep.concat(shots);
    } catch (e) {
      merged = shots;
    }
  }
  const order = (s) => Object.keys(SIZES).indexOf(s.size) * 100 + SCENE_LIST.findIndex((m) => m.id === s.scene);
  merged.sort((a, b) => order(a) - order(b));
  const manifest = Object.assign(
    { generatedAt: new Date().toISOString(), partial: !args.full, seconds: times, shots: merged, blocked, rules },
    versionInfo()
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const bad = shots.filter((s) => !s.ok);
  let missing = 0;
  if (args.full) {
    for (const key of Object.keys(SIZES)) {
      for (const meta of SCENE_LIST) if (!fs.existsSync(path.join(OUT_DIR, SIZES[key].folder, meta.file))) missing++;
    }
  }
  console.log(
    shots.length - bad.length + " of " + shots.length + " shots ok; rules " + (rules.ok ? "ok" : rules.violations.length + " violation(s)") +
      "; blocked requests " + blocked.length + (missing ? "; " + missing + " file(s) missing" : "")
  );
  if (!rules.ok) for (const v of rules.violations) console.log("  rule: " + v);
  process.exit(bad.length || !rules.ok || blocked.length || missing ? 1 : 0);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
