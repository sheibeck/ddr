"use strict";
// Contact sheets: one labelled grid of the eight shots per size, so the whole set is
// reviewed in three images. A shot whose manifest entry failed gets a red border.
//
//   node contact.js                       all three sizes
//   node contact.js --size phone|tab7|tab10|all
//
// Writes out/contact/<size>.png. The sheet is a review aid only; it is never installed.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { SIZES, SCENES, OUT_DIR, launchOptions } = require("./config.js");

const SHEET_W = 1920; // CSS px, so the PNG is at most 2000 px wide
const GAP = 14;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function gridFor(key, manifest) {
  const def = SIZES[key];
  const portrait = def.orientation === "portrait";
  const cols = portrait ? 4 : 2;
  const cell = Math.floor((SHEET_W - GAP * (cols + 1)) / cols);
  const cards = SCENES.map((meta) => {
    const entry = (manifest.shots || []).find((s) => s.size === key && s.scene === meta.id);
    const exists = fs.existsSync(path.join(OUT_DIR, def.folder, meta.file));
    const failed = !entry || !entry.ok || !exists;
    const label = String(meta.n).padStart(2, "0") + "  " + meta.id + (failed ? "   FAILED" : "");
    const why = failed && entry && entry.failures.length ? entry.failures.join("; ").slice(0, 200) : failed ? "no manifest entry or no file" : "";
    const img = exists ? '<img src="../' + def.folder + "/" + meta.file + '" style="width:' + cell + 'px;display:block">' : '<div style="width:' + cell + 'px;height:' + Math.round(cell * def.px[1] / def.px[0]) + 'px;background:#400"></div>';
    return (
      '<figure style="margin:0;border:5px solid ' + (failed ? "#e02020" : "#2a2a2a") + ';width:' + cell + 'px">' +
      img +
      '<figcaption style="font:600 18px monospace;color:' + (failed ? "#ff8080" : "#d8d0b8") + ';padding:4px 6px">' + esc(label) + (why ? '<br><span style="font-weight:400;font-size:13px">' + esc(why) + "</span>" : "") + "</figcaption></figure>"
    );
  });
  const title = def.label + "  " + def.px[0] + " x " + def.px[1] + "  layout " + def.layoutClass;
  return (
    '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#101010;width:' + SHEET_W + 'px">' +
    '<div style="font:700 22px monospace;color:#d8d0b8;padding:10px ' + GAP + 'px">' + esc(title) + "</div>" +
    '<div style="display:flex;flex-wrap:wrap;gap:' + GAP + 'px;padding:0 ' + GAP + 'px ' + GAP + 'px">' + cards.join("") + "</div></body>"
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--size");
  const want = at >= 0 ? argv[at + 1] : "all";
  const keys = want === "all" ? Object.keys(SIZES) : [want];
  for (const k of keys) {
    if (!SIZES[k]) {
      console.error("unknown size: " + k);
      process.exit(2);
    }
  }
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("no out/manifest.json: run node capture.js first");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const dir = path.join(OUT_DIR, "contact");
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch(launchOptions());
  try {
    for (const k of keys) {
      const htmlPath = path.join(dir, k + ".html");
      fs.writeFileSync(htmlPath, gridFor(k, manifest));
      const page = await browser.newPage({ viewport: { width: SHEET_W, height: 800 } });
      await page.goto("file:///" + htmlPath.split(path.sep).join("/"), { waitUntil: "load" });
      await page.waitForFunction(() => [...document.images].every((i) => i.complete));
      await page.screenshot({ path: path.join(dir, k + ".png"), fullPage: true });
      await page.close();
      fs.rmSync(htmlPath, { force: true });
      console.log("wrote out/contact/" + k + ".png");
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
