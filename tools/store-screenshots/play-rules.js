"use strict";
// Google Play's screenshot rules as code, and a check over an export tree.
//
//   node play-rules.js <dir> [--partial]   check <dir>/{phone,tablet-7in,tablet-10in}
//   node play-rules.js --self-test         prove every rule on synthetic images
//
// Node built-ins and config.js only. The PNG reader walks the chunk headers; it
// never decodes pixels, so a malformed buffer returns a failure and never throws.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SIZES, SCENES } = require("./config.js");

// Re-read on 2026-10-05 from the Play Console help page. The page wins over
// these constants if it differs; the next verification updates the date.
const RULES = Object.freeze({
  verified: "2026-10-05",
  source: "https://support.google.com/googleplay/android-developer/answer/9866151",
  minSidePx: 320, // minimum dimension
  maxSidePx: 3840, // maximum dimension
  maxAspect: 2, // the longer side may not be more than twice the shorter
  tabletMinSidePx: 1080, // tablet screenshots are between 1,080 and 7,680 px
  tabletMinCount: 4, // at least four per tablet size (recommendation formats)
  phoneMaxCount: 8, // up to 8 per device type
  maxBytes: 8 * 1024 * 1024,
  note:
    "JPEG or 24-bit PNG with no alpha. The Play page names no per-file size limit for phone " +
    "or tablet shots; the 8 MB ceiling is the phase 102 CONTEXT's conservative cap.",
});

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Returns { ok: false, error } or { ok: true, width, height, bitDepth,
// colorType, chunks }. Every read is bounds-checked.
function readPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33) return { ok: false, error: "not a PNG (too short)" };
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return { ok: false, error: "not a PNG (bad signature)" };
  if (buf.readUInt32BE(8) !== 13 || buf.toString("latin1", 12, 16) !== "IHDR") {
    return { ok: false, error: "not a PNG (no IHDR first)" };
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const chunks = [];
  let pos = 8;
  let sawEnd = false;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("latin1", pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) return { ok: false, error: "truncated chunk " + name };
    chunks.push(name);
    pos += 12 + len;
    if (name === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) return { ok: false, error: "no IEND chunk" };
  return { ok: true, width, height, bitDepth, colorType, chunks };
}

// kind is "phone" or "tablet". Returns a list of violation strings.
function checkImage(buf, kind) {
  const bad = [];
  const png = readPng(buf);
  if (!png.ok) return [png.error];
  if (png.colorType !== 2 || png.bitDepth !== 8) {
    bad.push("colour type " + png.colorType + " at " + png.bitDepth + " bits (need 24-bit RGB: type 2, 8 bits, no alpha)");
  }
  if (png.chunks.includes("tRNS")) bad.push("has a tRNS transparency chunk");
  const lo = Math.min(png.width, png.height);
  const hi = Math.max(png.width, png.height);
  if (lo < RULES.minSidePx) bad.push("a side is under " + RULES.minSidePx + " px (" + png.width + " x " + png.height + ")");
  if (hi > RULES.maxSidePx) bad.push("a side is over " + RULES.maxSidePx + " px (" + png.width + " x " + png.height + ")");
  if (lo > 0 && hi / lo > RULES.maxAspect) bad.push("aspect over " + RULES.maxAspect + ":1 (" + png.width + " x " + png.height + ")");
  if (kind === "tablet" && lo < RULES.tabletMinSidePx) {
    bad.push("a tablet side is under " + RULES.tabletMinSidePx + " px (" + png.width + " x " + png.height + ")");
  }
  if (buf.length >= RULES.maxBytes) bad.push("file is " + buf.length + " bytes, at or over the " + RULES.maxBytes + " cap");
  return bad;
}

// Checks root/{phone,tablet-7in,tablet-10in}. With partial, only the files that
// are present get image-checked, but a stray file still fails.
function checkTree(root, opts) {
  const partial = !!(opts && opts.partial);
  const violations = [];
  let files = 0;
  const wanted = SCENES.map((s) => s.file);
  for (const key of Object.keys(SIZES)) {
    const size = SIZES[key];
    const dir = path.join(root, size.folder);
    const tag = size.folder;
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (e) {
      violations.push(tag + ": folder is missing");
      continue;
    }
    for (const n of names) {
      if (!wanted.includes(n)) {
        const stale = /^(05-loot|07-find|08-dead)/.test(n) ? " (a stale 2.0-era name)" : "";
        violations.push(tag + "/" + n + ": stray file, not one of the eight scene names" + stale);
      }
    }
    if (!partial && names.filter((n) => wanted.includes(n)).length === 0) {
      violations.push(tag + ": folder is empty of scene files");
    }
    for (const file of wanted) {
      const fp = path.join(dir, file);
      if (!names.includes(file)) {
        if (!partial) violations.push(tag + "/" + file + ": missing");
        continue;
      }
      let buf;
      try {
        buf = fs.readFileSync(fp);
      } catch (e) {
        violations.push(tag + "/" + file + ": unreadable (" + e.message + ")");
        continue;
      }
      files += 1;
      const kind = key === "phone" ? "phone" : "tablet";
      for (const v of checkImage(buf, kind)) violations.push(tag + "/" + file + ": " + v);
      const png = readPng(buf);
      if (png.ok) {
        if (png.width !== size.px[0] || png.height !== size.px[1]) {
          violations.push(
            tag + "/" + file + ": size " + png.width + " x " + png.height + ", need " + size.px[0] + " x " + size.px[1]
          );
        }
        const portrait = png.height > png.width;
        if ((size.orientation === "portrait") !== portrait) {
          violations.push(tag + "/" + file + ": " + (portrait ? "portrait" : "landscape") + ", need " + size.orientation);
        }
      }
    }
    if (names.filter((n) => wanted.includes(n)).length > RULES.phoneMaxCount) {
      violations.push(tag + ": more than " + RULES.phoneMaxCount + " screenshots");
    }
  }
  return { ok: violations.length === 0, violations, files };
}

// ---------------------------------------------------------------- self-test

function crc32(bytes) {
  let c;
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(name, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

// A synthetic PNG: header, optional tRNS, one padded IDAT, IEND. The pixels are
// junk because the check never decodes them. padTo sets the exact byte length.
function synthPng(o) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(o.w, 0);
  ihdr.writeUInt32BE(o.h, 4);
  ihdr[8] = o.depth === undefined ? 8 : o.depth;
  ihdr[9] = o.ctype === undefined ? 2 : o.ctype;
  const parts = [PNG_SIG, chunk("IHDR", ihdr)];
  if (o.trns) parts.push(chunk("tRNS", Buffer.from([0, 0, 0, 0, 0, 0])));
  const fixed = Buffer.concat(parts).length + 12; // IEND is 12 bytes
  const idatLen = o.padTo ? o.padTo - fixed - 12 : 16;
  parts.push(chunk("IDAT", Buffer.alloc(idatLen, 7)));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function selfTest() {
  let n = 0;
  const fail = (msg) => {
    console.error("SELF-TEST FAIL: " + msg);
    process.exit(1);
  };
  const expectPass = (label, buf, kind) => {
    n += 1;
    const v = checkImage(buf, kind);
    if (v.length) fail(label + " should pass, got: " + v.join("; "));
  };
  const expectFail = (label, buf, kind, needle) => {
    n += 1;
    const v = checkImage(buf, kind);
    if (!v.length) fail(label + " should fail and passed");
    if (needle && !v.join(" | ").includes(needle)) fail(label + " failed for the wrong reason: " + v.join("; "));
  };

  expectPass("good 1080 x 1920 RGB", synthPng({ w: 1080, h: 1920 }), "phone");
  expectFail("RGBA", synthPng({ w: 1080, h: 1920, ctype: 6 }), "phone", "colour type 6");
  expectFail("palette", synthPng({ w: 1080, h: 1920, ctype: 3 }), "phone", "colour type 3");
  expectFail("16-bit", synthPng({ w: 1080, h: 1920, depth: 16 }), "phone", "16 bits");
  expectFail("tRNS chunk", synthPng({ w: 1080, h: 1920, trns: true }), "phone", "tRNS");
  expectFail("aspect 1080 x 2400", synthPng({ w: 1080, h: 2400 }), "phone", "aspect");
  expectFail("undersized 300 x 500", synthPng({ w: 300, h: 500 }), "phone", "under 320");
  expectFail("oversized 4000 x 2000", synthPng({ w: 4000, h: 2000 }), "phone", "over 3840");
  expectFail("tablet 1000 x 562", synthPng({ w: 1000, h: 562 }), "tablet", "tablet side");
  expectPass("phone-sized file is fine for a phone", synthPng({ w: 1000, h: 562 }), "phone");
  expectFail("at the 8 MB cap", synthPng({ w: 1080, h: 1920, padTo: RULES.maxBytes }), "phone", "cap");
  expectPass("one byte under the cap", synthPng({ w: 1080, h: 1920, padTo: RULES.maxBytes - 1 }), "phone");
  n += 1;
  try {
    const v = checkImage(Buffer.from("not a png at all, just text that is long enough to read"), "phone");
    if (!v.length) fail("a non-PNG buffer should fail");
    if (checkImage(Buffer.alloc(0), "phone").length === 0) fail("an empty buffer should fail");
    if (checkImage(synthPng({ w: 1080, h: 1920 }).subarray(0, 50), "phone").length === 0) fail("a truncated PNG should fail");
  } catch (e) {
    fail("a malformed buffer threw: " + e.message);
  }

  // Every size is exact: round(css * dpr) == px, with the right orientation.
  for (const key of Object.keys(SIZES)) {
    n += 1;
    const s = SIZES[key];
    const w = Math.round(s.css[0] * s.dpr);
    const h = Math.round(s.css[1] * s.dpr);
    if (w !== s.px[0] || h !== s.px[1]) fail(key + ": round(css * dpr) is " + w + " x " + h + ", config says " + s.px.join(" x "));
    if (s.css[0] * s.dpr !== w || s.css[1] * s.dpr !== h) fail(key + ": css * dpr is not a whole number of pixels");
    if ((s.px[1] > s.px[0]) !== (s.orientation === "portrait")) fail(key + ": orientation disagrees with the pixel size");
    const v = checkImage(synthPng({ w: s.px[0], h: s.px[1] }), key === "phone" ? "phone" : "tablet");
    if (v.length) fail(key + ": the configured size breaks Play's rules: " + v.join("; "));
  }

  // The tree check on a temporary tree.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "play-rules-"));
  try {
    const build = () => {
      for (const key of Object.keys(SIZES)) {
        const s = SIZES[key];
        fs.mkdirSync(path.join(root, s.folder), { recursive: true });
        for (const sc of SCENES) fs.writeFileSync(path.join(root, s.folder, sc.file), synthPng({ w: s.px[0], h: s.px[1] }));
      }
    };
    const tree = (label, wantOk, needle, opts) => {
      n += 1;
      const r = checkTree(root, opts);
      if (r.ok !== wantOk) fail("tree: " + label + " expected ok=" + wantOk + ": " + r.violations.join("; "));
      if (needle && !r.violations.join(" | ").includes(needle)) fail("tree: " + label + " wrong reason: " + r.violations.join("; "));
    };
    build();
    tree("complete tree", true);
    fs.writeFileSync(path.join(root, "phone", "05-loot.png"), synthPng({ w: 1080, h: 1920 }));
    tree("stale 2.0-era name", false, "stale 2.0-era");
    fs.unlinkSync(path.join(root, "phone", "05-loot.png"));
    fs.writeFileSync(path.join(root, "tablet-7in", "notes.txt"), "x");
    tree("stray file", false, "stray file");
    fs.unlinkSync(path.join(root, "tablet-7in", "notes.txt"));
    fs.unlinkSync(path.join(root, "tablet-10in", "08-board.png"));
    tree("missing file", false, "08-board.png: missing");
    tree("missing file passes with --partial", true, null, { partial: true });
    fs.writeFileSync(path.join(root, "phone", "02-combat.png"), synthPng({ w: 1920, h: 1080 }));
    tree("landscape file in the phone folder", false, "landscape, need portrait", { partial: true });
    fs.writeFileSync(path.join(root, "phone", "02-combat.png"), synthPng({ w: 1080, h: 1920 }));
    fs.writeFileSync(path.join(root, "tablet-7in", "03-deep.png"), synthPng({ w: 1350, h: 2400 }));
    tree("portrait file in a tablet folder", false, "portrait, need landscape", { partial: true });
    fs.writeFileSync(path.join(root, "tablet-7in", "03-deep.png"), synthPng({ w: 2400, h: 1350 }));
    fs.writeFileSync(path.join(root, "tablet-10in", "01-title.png"), synthPng({ w: 2400, h: 1350 }));
    tree("wrong pixel size", false, "need 2880 x 1620", { partial: true });
    fs.writeFileSync(path.join(root, "tablet-10in", "01-title.png"), synthPng({ w: 2880, h: 1620 }));
    fs.writeFileSync(path.join(root, "tablet-10in", "08-board.png"), synthPng({ w: 2880, h: 1620 }));
    tree("repaired tree", true);
    for (const sc of SCENES) fs.unlinkSync(path.join(root, "phone", sc.file));
    tree("empty folder", false, "empty of scene files");
    fs.rmSync(path.join(root, "phone"), { recursive: true });
    tree("missing folder", false, "phone: folder is missing");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log("play-rules self-test: " + n + " cases passed");
}

// ---------------------------------------------------------------------- CLI

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    selfTest();
  } else {
    const dir = args.find((a) => !a.startsWith("--"));
    if (!dir) {
      console.error("usage: node play-rules.js <dir> [--partial] | --self-test");
      process.exit(2);
    }
    const r = checkTree(path.resolve(dir), { partial: args.includes("--partial") });
    if (r.ok) {
      console.log("ok (" + r.files + " files)");
    } else {
      for (const v of r.violations) console.log(v);
      console.log(r.violations.length + " violation(s)");
      process.exit(1);
    }
  }
}

module.exports = { RULES, readPng, checkImage, checkTree };
