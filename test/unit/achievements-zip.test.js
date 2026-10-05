// test/unit/achievements-zip.test.js
//
// Phase 98 plan 98-03 (ZIP-01, ZIP-02): the zip writer and reader, the CSV
// bytes, determinism, and the 25-rule validator. The validator has teeth:
// every rule id is broken on purpose below and asserted by rule id, and every
// limit is tested on both sides of its edge.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import {
  REPO_ROOT,
  ZIP_METADATA_NAME,
  ZIP_MAPPINGS_NAME,
  LIMITS,
  RULES,
  buildZip,
  readZip,
  pngSize,
  orderedCatalog,
  metadataCsv,
  mappingsCsv,
  loadCatalog,
  buildAchievementsZip,
  validateZip,
  iconFileName,
} from "../../tools/lib/achievements-zip.mjs";

const good = await buildAchievementsZip({ root: REPO_ROOT });
const catalog = good.catalog;
const goodFiles = good.files;
const firstIcon = goodFiles[2];

// ---- helpers --------------------------------------------------------------

const copyFiles = (files) => files.map((f) => ({ name: f.name, data: Buffer.from(f.data) }));
const byName = (files, name) => files.find((f) => f.name === name);

function editCsv(files, name, fn) {
  const out = copyFiles(files);
  const f = byName(out, name);
  const rows = f.data.toString("utf8").split("\n").map((l) => l.split(","));
  fn(rows);
  f.data = Buffer.from(rows.map((r) => r.join(",")).join("\n"), "utf8");
  return out;
}
const editMeta = (files, fn) => editCsv(files, ZIP_METADATA_NAME, fn);
const editMap = (files, fn) => editCsv(files, ZIP_MAPPINGS_NAME, fn);

function renameRow(files, i, newName) {
  return editMap(editMeta(files, (rows) => { rows[i][0] = newName; }), (rows) => { rows[i][0] = newName; });
}
function setFile(files, name, data) {
  const out = copyFiles(files);
  byName(out, name).data = Buffer.from(data);
  return out;
}
function dropFile(files, name) {
  return copyFiles(files).filter((f) => f.name !== name);
}
function addFile(files, name, data = Buffer.from("x")) {
  return [...copyFiles(files), { name, data: Buffer.from(data) }];
}
function pad(buf, size) {
  const out = Buffer.alloc(size);
  buf.copy(out);
  return out;
}
function setWidth(png, width) {
  const out = Buffer.from(png);
  out.writeUInt32BE(width, 16);
  return out;
}
function setTotalPoints(files, total) {
  return editMeta(files, (rows) => {
    let sum = rows.reduce((s, r) => s + Number(r[5]), 0);
    for (const r of rows) {
      if (sum === total) break;
      const p = Number(r[5]);
      const next = Math.min(200, Math.max(5, p + (total - sum)));
      r[5] = String(next);
      sum += next - p;
    }
    assert.equal(sum, total);
  });
}

const rulesOf = (buf, opts) => new Set(validateZip(buf, opts).violations.map((v) => v.rule));
const check = (files, opts) => validateZip(buildZip(files), opts);
const has = (files, rule, opts) => check(files, opts).violations.some((v) => v.rule === rule);

const standardRow = (rows) => rows.findIndex((r) => r[2] === "False");
const incrementalRow = (rows) => rows.findIndex((r) => r[2] === "True");

// ---- container ------------------------------------------------------------

test("buildZip then readZip round-trips names and bytes, stored with the fixed timestamp", () => {
  const files = [
    { name: "a.csv", data: Buffer.from("one") },
    { name: "b.png", data: Buffer.from([1, 2, 3, 4]) },
    { name: "empty.csv", data: Buffer.alloc(0) },
  ];
  const { entries, problems } = readZip(buildZip(files));
  assert.deepEqual(problems, []);
  assert.deepEqual(entries.map((e) => e.name), ["a.csv", "b.png", "empty.csv"]);
  files.forEach((f, i) => assert.ok(entries[i].data.equals(f.data)));
  for (const e of entries) {
    assert.equal(e.method, 0);
    assert.equal(e.time, 0);
    assert.equal(e.date, 0x0021);
    assert.equal(e.flags, 0);
  }
});

test("buildZip is byte-identical on a second build and writes no extra field or comment", () => {
  const files = [{ name: "a.csv", data: Buffer.from("one") }];
  const a = buildZip(files);
  const b = buildZip(files);
  assert.ok(a.equals(b));
  assert.equal(a.readUInt16LE(a.length - 2), 0, "no zip comment");
  assert.equal(a.readUInt16LE(28), 0, "no extra field in the local header");
});

test("the real catalog builds twice to identical bytes", async () => {
  const again = await buildAchievementsZip({ root: REPO_ROOT });
  assert.ok(again.buffer.equals(good.buffer));
});

test("readZip reports instead of throwing on damaged input", () => {
  const zip = buildZip([{ name: "a.csv", data: Buffer.from("hello world") }]);
  assert.ok(readZip(Buffer.alloc(0)).problems.length > 0, "empty buffer");
  assert.ok(readZip(zip.subarray(0, zip.length - 30)).problems.length > 0, "truncated");

  const flipped = Buffer.from(zip);
  flipped[30 + "a.csv".length + 2] ^= 0xff;
  assert.ok(readZip(flipped).problems.some((p) => /CRC/.test(p)), "CRC mismatch");

  const method = Buffer.from(zip);
  method.writeUInt16LE(99, method.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 10);
  assert.ok(readZip(method).problems.some((p) => /method/.test(p)), "unsupported method");

  const offset = Buffer.from(zip);
  offset.writeUInt32LE(0xffffff00, offset.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 42);
  assert.ok(readZip(offset).problems.some((p) => /local header/.test(p)), "offset out of range");

  const encrypted = Buffer.from(zip);
  encrypted.writeUInt16LE(1, encrypted.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 8);
  assert.ok(readZip(encrypted).problems.some((p) => /encrypted/.test(p)), "encrypted flag");
});

test("readZip bounds a hostile entry count and an inflation bomb", () => {
  const zip = buildZip([{ name: "a.csv", data: Buffer.from("hello") }]);
  const hostile = Buffer.from(zip);
  hostile.writeUInt16LE(65535, hostile.length - 12);
  hostile.writeUInt16LE(65535, hostile.length - 14);
  const r = readZip(hostile);
  assert.equal(r.entries.length, 0);
  assert.ok(r.problems.length > 0);
  assert.ok(!validateZip(hostile).ok);

  const bomb = buildZip([{ name: "ach_bomb.png", data: Buffer.alloc(5 * 1024 * 1024), deflate: true }]);
  const b = readZip(bomb);
  assert.equal(b.entries[0].data, null, "the oversize entry is not inflated");
  assert.ok(b.problems.some((p) => /inflated/.test(p)));
  assert.ok(rulesOf(bomb).has("zip-readable"));
});

test("readZip inflates a small deflated entry", () => {
  const data = Buffer.from("hello hello hello hello");
  const r = readZip(buildZip([{ name: "a.csv", data, deflate: true }]));
  assert.deepEqual(r.problems, []);
  assert.equal(r.entries[0].method, 8);
  assert.ok(r.entries[0].data.equals(data));
});

test("pngSize reads an IHDR and rejects everything else", () => {
  assert.deepEqual(pngSize(firstIcon.data), { width: 512, height: 512 });
  assert.equal(pngSize(Buffer.alloc(0)), null);
  assert.equal(pngSize(Buffer.from("not a png at all, just text padding")), null);
});

// ---- CSV bytes ------------------------------------------------------------

test("the CSVs follow the import format byte for byte", () => {
  const meta = metadataCsv(catalog);
  const map = mappingsCsv(catalog);
  for (const text of [meta, map]) {
    assert.match(text, /^[\x20-\x7e\n]+$/, "printable ASCII and LF only");
    assert.ok(!text.includes("\r"));
    assert.ok(!text.startsWith("﻿"));
    assert.ok(!text.endsWith("\n"), "no trailing newline");
    assert.ok(!/^name,/i.test(text), "no header row");
  }
  const metaRows = meta.split("\n");
  const mapRows = map.split("\n");
  assert.equal(metaRows.length, 77);
  assert.equal(mapRows.length, 77);
  const sorted = orderedCatalog(catalog);
  sorted.forEach((a, i) => {
    const incremental = a.type === "incremental";
    assert.equal(
      metaRows[i],
      `${a.name},${a.description},${incremental ? "True" : "False"},${incremental ? a.steps : ""},${a.initialState},${a.points},${a.listOrder}`,
    );
    assert.equal(mapRows[i], `${a.name},${path.posix.basename(a.icon.play)}`);
    assert.equal(metaRows[i].split(",").length, 7);
  });
  assert.ok(metaRows.some((r) => /,False,,(Hidden|Revealed),/.test(r)), "a standard row writes an empty Steps field");
  assert.ok(metaRows.some((r) => /,True,\d+,(Hidden|Revealed),/.test(r)), "an incremental row writes its steps");
  const orders = metaRows.map((r) => Number(r.split(",")[6]));
  assert.deepEqual(orders, [...orders].sort((x, y) => x - y), "rows are in list order");
});

test("the real zip has 79 entries in the fixed order with the PNG bytes of the source files", () => {
  const { entries, problems } = readZip(good.buffer);
  assert.deepEqual(problems, []);
  assert.equal(entries.length, 79);
  const sorted = orderedCatalog(catalog);
  assert.deepEqual(entries.map((e) => e.name), [ZIP_METADATA_NAME, ZIP_MAPPINGS_NAME, ...sorted.map(iconFileName)]);
  sorted.forEach((a, i) => {
    const source = fs.readFileSync(path.join(REPO_ROOT, "achievements", a.icon.play));
    assert.ok(entries[i + 2].data.equals(source), `${a.id} icon bytes`);
  });
  assert.ok(entries[0].data.equals(Buffer.from(metadataCsv(catalog))));
});

test("the real zip validates with zero violations and the expected stats", () => {
  const v = validateZip(good.buffer, { catalog });
  assert.deepEqual(v.violations, []);
  assert.equal(v.ok, true);
  assert.deepEqual(v.stats, { entries: 79, achievements: 77, points: 1110, incremental: 57, hidden: 8 });
});

test("loadCatalog reads the same catalog the build used", async () => {
  const loaded = await loadCatalog(REPO_ROOT);
  assert.equal(loaded.length, 77);
});

// ---- builder failures -----------------------------------------------------

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ach-zip-test-"));
}

test("buildAchievementsZip rejects an empty catalog, a missing icon, a non-512 PNG and a shared icon", async () => {
  await assert.rejects(buildAchievementsZip({ root: REPO_ROOT, catalog: [] }), /empty/);

  const root = tempRoot();
  try {
    const entry = { ...catalog[0], icon: { play: "play/ach_one.png", ingame: "ingame/ach_one.png" } };
    await assert.rejects(buildAchievementsZip({ root, catalog: [entry] }), /missing/);

    fs.mkdirSync(path.join(root, "achievements", "play"), { recursive: true });
    fs.writeFileSync(path.join(root, "achievements", "play", "ach_one.png"), setWidth(firstIcon.data, 256));
    await assert.rejects(buildAchievementsZip({ root, catalog: [entry] }), /256 x 512/);

    fs.writeFileSync(path.join(root, "achievements", "play", "ach_one.png"), Buffer.from("not a png"));
    await assert.rejects(buildAchievementsZip({ root, catalog: [entry] }), /not a PNG/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const twin = { ...catalog[1], icon: catalog[0].icon };
  await assert.rejects(buildAchievementsZip({ root: REPO_ROOT, catalog: [catalog[0], twin] }), /share the icon/);
});

// ---- the teeth: one broken input per rule ---------------------------------

const TEETH = [
  {
    rule: "zip-readable",
    label: "a flipped byte inside a PNG",
    mutate: () => {
      const b = Buffer.from(good.buffer);
      b[b.indexOf("IHDR") + 20] ^= 0xff;
      return b;
    },
  },
  { rule: "no-subdirectories", label: "an icon in a folder", mutate: () => buildZip(addFile(goodFiles, "icons/extra.png", firstIcon.data)) },
  { rule: "unique-file-names", label: "a name repeated in another case", mutate: () => buildZip(addFile(goodFiles, firstIcon.name.toUpperCase(), firstIcon.data)) },
  { rule: "only-csv-png", label: "a text file", mutate: () => buildZip(addFile(goodFiles, "readme.txt")) },
  { rule: "file-size", label: "a PNG of 1000000 bytes", mutate: () => buildZip(setFile(goodFiles, firstIcon.name, pad(firstIcon.data, 1000000))) },
  {
    rule: "file-count",
    label: "404 files",
    mutate: () => {
      let files = copyFiles(goodFiles);
      for (let i = 0; files.length < 404; i++) files = addFile(files, `extra_${i}.png`, firstIcon.data);
      return buildZip(files);
    },
  },
  { rule: "zip-size", label: "a zip at the size cap", mutate: () => good.buffer, opts: { limits: { zipBytesExclusive: good.buffer.length } } },
  { rule: "required-files", label: "no mappings CSV", mutate: () => buildZip(dropFile(goodFiles, ZIP_MAPPINGS_NAME)) },
  {
    rule: "no-header-row",
    label: "a header row on the metadata CSV",
    mutate: () => buildZip(editMeta(goodFiles, (rows) => rows.unshift("Name,Description,Incremental value,Steps Needed,Initial State,Points,List Order".split(",")))),
  },
  { rule: "csv-columns", label: "a metadata row of six values", mutate: () => buildZip(editMeta(goodFiles, (rows) => rows[3].pop())) },
  { rule: "incremental-spelling", label: "true in lower case", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[incrementalRow(rows)][2] = "true"; })) },
  { rule: "initial-state-spelling", label: "hidden in lower case", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[0][4] = "hidden"; })) },
  { rule: "steps-rules", label: "steps on a standard row", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[standardRow(rows)][3] = "5"; })) },
  { rule: "points-rules", label: "7 points", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[0][5] = "7"; })) },
  { rule: "list-order-rules", label: "a repeated List Order", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[1][6] = rows[0][6]; })) },
  { rule: "name-rules", label: "a 101 character name", mutate: () => buildZip(renameRow(goodFiles, 0, "N".repeat(101))) },
  { rule: "description-rules", label: "a 501 character description", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[0][1] = "D".repeat(501); })) },
  { rule: "text-charset", label: "a double quote in a description", mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[0][1] = 'say "hi"'; })) },
  { rule: "points-total", label: "2005 points", mutate: () => buildZip(setTotalPoints(goodFiles, 2005)) },
  { rule: "achievement-count", label: "a cap of 76", mutate: () => good.buffer, opts: { limits: { maxAchievements: 76 } } },
  { rule: "mapping-matches-metadata", label: "a mapping for a name nobody has", mutate: () => buildZip(editMap(goodFiles, (rows) => { rows[0][0] = "Nobody At All"; })) },
  { rule: "icon-exists", label: "a mapping to a missing file", mutate: () => buildZip(editMap(goodFiles, (rows) => { rows[0][1] = "ach_missing.png"; })) },
  { rule: "icon-unique-and-used", label: "an icon mapped twice", mutate: () => buildZip(editMap(goodFiles, (rows) => { rows[1][1] = rows[0][1]; })) },
  { rule: "icon-png-512", label: "a 256 wide PNG", mutate: () => buildZip(setFile(goodFiles, firstIcon.name, setWidth(firstIcon.data, 256))) },
  {
    rule: "matches-catalog",
    label: "a reworded description",
    mutate: () => buildZip(editMeta(goodFiles, (rows) => { rows[0][1] = "Reworded after the build."; })),
    opts: { catalog },
  },
];

test("the teeth table covers every rule id exactly once", () => {
  assert.equal(RULES.length, 25);
  assert.deepEqual(TEETH.map((t) => t.rule).sort(), RULES.map((r) => r.id).sort());
});

test("the good zip trips no rule", () => {
  assert.deepEqual(validateZip(good.buffer, { catalog }).violations, []);
});

for (const t of TEETH) {
  test(`teeth: ${t.rule} fails on ${t.label}`, () => {
    const result = validateZip(t.mutate(), t.opts);
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => v.rule === t.rule),
      `expected ${t.rule}, got ${[...new Set(result.violations.map((v) => v.rule))].join(", ") || "none"}`,
    );
  });
}

// ---- boundaries -----------------------------------------------------------

test("boundary: 403 files pass and 404 fail", () => {
  const build = (n) => {
    let files = copyFiles(goodFiles);
    for (let i = 0; files.length < n; i++) files = addFile(files, `extra_${i}.png`, firstIcon.data);
    return files;
  };
  assert.equal(has(build(403), "file-count"), false);
  assert.equal(has(build(404), "file-count"), true);
});

test("boundary: 999999 bytes pass and 1000000 fail", () => {
  assert.equal(has(setFile(goodFiles, firstIcon.name, pad(firstIcon.data, 999999)), "file-size"), false);
  assert.equal(has(setFile(goodFiles, firstIcon.name, pad(firstIcon.data, 1000000)), "file-size"), true);
});

test("boundary: names of 100 pass and 101 fail", () => {
  assert.equal(has(renameRow(goodFiles, 0, "N".repeat(100)), "name-rules"), false);
  assert.equal(has(renameRow(goodFiles, 0, "N".repeat(101)), "name-rules"), true);
  assert.equal(has(renameRow(goodFiles, 0, ""), "name-rules"), true, "an empty name fails");
});

test("boundary: descriptions of 500 pass and 501 fail", () => {
  const withDescription = (n) => editMeta(goodFiles, (rows) => { rows[0][1] = "D".repeat(n); });
  assert.equal(has(withDescription(500), "description-rules"), false);
  assert.equal(has(withDescription(501), "description-rules"), true);
  assert.equal(has(withDescription(0), "description-rules"), true, "an empty description fails");
});

test("boundary: steps 10000 pass, 10001 and 0 fail", () => {
  const withSteps = (s) => editMeta(goodFiles, (rows) => { rows[incrementalRow(rows)][3] = s; });
  assert.equal(has(withSteps("10000"), "steps-rules"), false);
  assert.equal(has(withSteps("1"), "steps-rules"), false);
  assert.equal(has(withSteps("10001"), "steps-rules"), true);
  assert.equal(has(withSteps("0"), "steps-rules"), true);
  assert.equal(has(withSteps(""), "steps-rules"), true, "an incremental row needs steps");
});

test("boundary: points 200 pass, 205, 0 and 7 fail", () => {
  const withPoints = (p) => editMeta(goodFiles, (rows) => { rows[0][5] = p; });
  assert.equal(has(withPoints("200"), "points-rules"), false);
  assert.equal(has(withPoints("5"), "points-rules"), false);
  for (const bad of ["205", "0", "7"]) assert.equal(has(withPoints(bad), "points-rules"), true, bad);
});

test("boundary: the point total 2000 passes and 2005 fails", () => {
  assert.equal(has(setTotalPoints(goodFiles, 2000), "points-total"), false);
  assert.equal(has(setTotalPoints(goodFiles, 2005), "points-total"), true);
});

test("boundary: the zip size and achievement count caps through limits overrides", () => {
  const n = good.buffer.length;
  assert.equal(rulesOf(good.buffer, { limits: { zipBytesExclusive: n + 1 } }).has("zip-size"), false);
  assert.equal(rulesOf(good.buffer, { limits: { zipBytesExclusive: n } }).has("zip-size"), true);
  assert.equal(rulesOf(good.buffer, { limits: { maxAchievements: 77 } }).has("achievement-count"), false);
  assert.equal(rulesOf(good.buffer, { limits: { maxAchievements: 76 } }).has("achievement-count"), true);
});

// ---- empty and odd inputs return violations, never exceptions -------------

test("empty inputs fail with a named rule instead of throwing", () => {
  assert.ok(rulesOf(Buffer.alloc(0)).has("zip-readable"));
  assert.ok(rulesOf(buildZip([])).has("required-files"), "a zip with zero entries");
  assert.ok(rulesOf(buildZip(setFile(goodFiles, ZIP_METADATA_NAME, Buffer.alloc(0)))).has("csv-columns"), "a zero-byte CSV");
  assert.ok(rulesOf(buildZip(setFile(goodFiles, firstIcon.name, Buffer.alloc(0)))).has("icon-png-512"), "a zero-byte PNG");
  assert.ok(rulesOf(buildZip(setFile(goodFiles, ZIP_METADATA_NAME, "\n"))).has("achievement-count"), "a metadata file with no rows");
  assert.ok(rulesOf(buildZip(goodFiles.filter((f) => !f.name.endsWith(".png")))).has("required-files"), "a zip with no icons");
});

test("a BOM, CR line ends and a trailing newline are read as the tooling expects", () => {
  const meta = byName(goodFiles, ZIP_METADATA_NAME).data.toString("utf8");
  assert.ok(rulesOf(buildZip(setFile(goodFiles, ZIP_METADATA_NAME, "﻿" + meta))).has("text-charset"), "BOM");
  assert.equal(has(setFile(goodFiles, ZIP_METADATA_NAME, meta + "\n"), "csv-columns"), false, "one trailing newline is tolerated");
  assert.equal(has(setFile(goodFiles, ZIP_METADATA_NAME, meta.replace(/\n/g, "\r\n")), "csv-columns"), false, "CR before LF is tolerated on read");
  assert.equal(has(setFile(goodFiles, ZIP_METADATA_NAME, meta + "\n\n"), "csv-columns"), true, "a blank line is not");
});

test("violations come out in a deterministic order", () => {
  const broken = buildZip(
    editMeta(addFile(goodFiles, "readme.txt"), (rows) => {
      rows[0][5] = "7";
      rows[1][6] = rows[0][6];
      rows[2][4] = "hidden";
    }),
  );
  const a = validateZip(broken, { catalog });
  const b = validateZip(broken, { catalog });
  assert.deepEqual(a, b);
  const order = new Map(RULES.map((r, i) => [r.id, i]));
  const ranks = a.violations.map((v) => order.get(v.rule));
  assert.deepEqual(ranks, [...ranks].sort((x, y) => x - y), "RULES order");
  assert.ok(a.violations.length >= 4);
});

test("List Order must ascend down the file", () => {
  const swapped = editMeta(goodFiles, (rows) => {
    [rows[0][6], rows[1][6]] = [rows[1][6], rows[0][6]];
  });
  assert.equal(has(swapped, "list-order-rules"), true);
  assert.equal(has(editMeta(goodFiles, (rows) => { rows[0][6] = "0"; }), "list-order-rules"), true, "zero is not positive");
});

test("zip entry names are ASCII and a non-ASCII name is refused", () => {
  assert.ok(goodFiles.every((f) => /^[\x20-\x7e]+$/.test(f.name)));
  assert.ok(rulesOf(buildZip(addFile(goodFiles, "ach_é.png", firstIcon.data))).has("only-csv-png"));
});

// ---- project rule: Node built-ins only ------------------------------------

test("the tool files import only node: built-ins and relative modules", () => {
  const files = ["tools/lib/achievements-zip.mjs", "tools/achievements-zip.mjs"];
  for (const rel of files) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, "utf8");
    const specifiers = [...src.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    specifiers.push(...[...src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map((m) => m[1]));
    assert.ok(specifiers.length > 0, `${rel} has imports`);
    for (const s of specifiers) {
      assert.ok(s.startsWith("node:") || s.startsWith("."), `${rel} imports ${s}`);
    }
  }
  assert.equal(typeof zlib.crc32, "function");
});
