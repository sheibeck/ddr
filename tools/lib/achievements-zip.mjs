// tools/lib/achievements-zip.mjs
//
// Phase 98 (ZIP-01, ZIP-02, ZIP-03), plan 98-03. Builds the Play Console
// achievements import zip from content/achievements.js and the icons in
// achievements/play/, re-reads a zip from its own bytes, and holds it to
// Google's import rules and to the ACH-02 / ACH-03 limits.
//
// Google's import rules (checked 2026-10-05 at
// developer.android.com/games/pgs/integrate-achievements): no subdirectories,
// unique file names, only CSV and PNG/JPEG files, no header rows, each file
// under 1 MB, at most 403 files, the zip under 800 MB, 7 metadata values and
// 2 mapping values per row, True/False and Hidden/Revealed spelt exactly,
// steps only on incremental rows, name at most 100 and description at most
// 500 characters, icons 512 x 512. Play's own achievement limits: 5 to 200
// points in multiples of 5, steps 1 to 10000, 2000 points and 400
// achievements per game. Rules that go beyond Google's list are labelled
// "(house)" in RULES: unique ascending List Order, a non-empty description,
// printable ASCII text without a double quote, every PNG mapped exactly once,
// and the cross-check against the catalog.
//
// The zip is stored, not compressed. The PNGs are already compressed, and a
// stored zip is byte-identical on every Node or zlib build. Every entry has
// the fixed DOS timestamp 1980-01-01 00:00:00, no extra field and no comment,
// and the entry order is fixed (metadata CSV, mappings CSV, icons in list
// order), so a rebuild is byte-identical and leaks no local path or time.
//
// CSV bytes: printable ASCII, UTF-8 without a BOM, no header row, no quoting,
// rows joined by CSV_ROW_SEPARATOR, and a trailing newline only when
// CSV_TRAILING_NEWLINE is true. These two constants are the only byte choices
// to change if Play's importer objects (docs/ACHIEVEMENTS.md).
//
// Node built-ins only. validateZip and readZip are pure over a Buffer: they
// read no file, write no file and never extract an entry to disk.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import crypto from "node:crypto";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const ZIP_METADATA_NAME = "AchievementsMetadata.csv";
export const ZIP_MAPPINGS_NAME = "AchievementsIconsMappings.csv";
export const DEFAULT_ZIP_PATH = "build/achievements/ddr-achievements.zip";

// The two CSV byte choices (see the header).
export const CSV_ROW_SEPARATOR = "\n";
export const CSV_TRAILING_NEWLINE = false;

export const LIMITS = Object.freeze({
  maxFiles: 403,
  fileBytesExclusive: 1000000,
  zipBytesExclusive: 800000000,
  nameMax: 100,
  descriptionMax: 500,
  stepsMin: 1,
  stepsMax: 10000,
  pointsMin: 5,
  pointsMax: 200,
  pointsStep: 5,
  gamePoints: 2000,
  maxAchievements: 400,
  iconSize: 512,
});

export const RULES = Object.freeze([
  { id: "zip-readable", catches: "the end record, central directory, local headers, methods, CRCs, sizes or offsets are damaged or unsupported" },
  { id: "no-subdirectories", catches: "an entry name holds a slash or backslash, or is a directory entry" },
  { id: "unique-file-names", catches: "two entries share a name, ignoring case" },
  { id: "only-csv-png", catches: "an entry is not a .csv or .png file, a CSV is not one of the two import CSVs, or a name is not printable ASCII (house)" },
  { id: "file-size", catches: "a file is 1000000 bytes or more" },
  { id: "file-count", catches: "more than 403 files" },
  { id: "zip-size", catches: "the zip is 800000000 bytes or more" },
  { id: "required-files", catches: "a CSV is missing or repeated, or there is no PNG" },
  { id: "no-header-row", catches: "a CSV starts with its column titles" },
  { id: "csv-columns", catches: "a CSV is empty, has a blank line, or a row with the wrong number of values" },
  { id: "incremental-spelling", catches: "Incremental value is not exactly True or False" },
  { id: "initial-state-spelling", catches: "Initial State is not exactly Hidden or Revealed" },
  { id: "steps-rules", catches: "Steps Needed is filled on a standard row, or is not a whole number from 1 to 10000 on an incremental row" },
  { id: "points-rules", catches: "Points is not a whole number from 5 to 200 in multiples of 5" },
  { id: "list-order-rules", catches: "List Order is not a positive whole number, or is not unique and ascending (house)" },
  { id: "name-rules", catches: "a name is empty, over 100 characters, or not unique" },
  { id: "description-rules", catches: "a description is empty (house) or over 500 characters" },
  { id: "text-charset", catches: "a name or description is not printable ASCII, or holds a double quote (house)" },
  { id: "points-total", catches: "the points add up to more than 2000" },
  { id: "achievement-count", catches: "fewer than 1 or more than 400 achievements" },
  { id: "mapping-matches-metadata", catches: "a mapping name is not exactly one metadata name, or the reverse" },
  { id: "icon-exists", catches: "a mapped icon file is not in the zip" },
  { id: "icon-unique-and-used", catches: "an icon is mapped twice, or a PNG in the zip is not mapped (house)" },
  { id: "icon-png-512", catches: "a PNG lacks the PNG signature and an IHDR chunk, or is not exactly 512 x 512" },
  { id: "matches-catalog", catches: "a row differs from the catalog in count, order, name, description, type, steps, state, points, list order or icon (house)" },
]);

// The seven CONTEXT list-order blocks and their sizes.
export const COPY_BLOCKS = Object.freeze([
  Object.freeze({ title: "The descent", size: 6 }),
  Object.freeze({ title: "Dressing for it", size: 4 }),
  Object.freeze({ title: "Who you are", size: 10 }),
  Object.freeze({ title: "Staying alive", size: 14 }),
  Object.freeze({ title: "Company", size: 13 }),
  Object.freeze({ title: "Body counts", size: 24 }),
  Object.freeze({ title: "Dying", size: 6 }),
]);

export const crc32 = (buf) => zlib.crc32(buf);

export function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---------------------------------------------------------------------------
// Zip writer
// ---------------------------------------------------------------------------

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1980-01-01
const MAX_END_SCAN = 22 + 65535;
const MAX_PARSED_ENTRIES = 10000;

// files: [{ name, data: Buffer, deflate?: boolean }]. Entries are stored
// (method 0) unless a file asks for deflate, which only the tests use to
// make a compressed entry for the reader.
export function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const method = f.deflate ? 8 : 0;
    const stored = f.deflate ? zlib.deflateRawSync(raw) : raw;
    const crc = zlib.crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(SIG_LOCAL, 0);
    lh.writeUInt16LE(10, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(stored.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, stored);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(SIG_CENTRAL, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(10, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(stored.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);

    offset += 30 + name.length + stored.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
}

// ---------------------------------------------------------------------------
// Zip reader (bounded; never throws on bad input, never writes to disk)
// ---------------------------------------------------------------------------

// Returns { entries, problems }. Each entry: { name, flags, method, crc,
// compressedSize, size, time, date, isDirectory, data } where data is null
// when the bytes could not be read.
export function readZip(buffer, { maxFileBytes = LIMITS.fileBytesExclusive } = {}) {
  const entries = [];
  const problems = [];
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const n = buf.length;
  if (n < 22) {
    problems.push(n === 0 ? "the zip is empty" : "the zip is too short to hold an end of central directory record");
    return { entries, problems };
  }
  let eocd = -1;
  for (let i = n - 22; i >= Math.max(0, n - MAX_END_SCAN); i--) {
    if (buf.readUInt32LE(i) === SIG_END) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    problems.push("no end of central directory record found");
    return { entries, problems };
  }
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset + cdSize > eocd) {
    problems.push("the central directory runs past the end record");
    return { entries, problems };
  }
  if (total > MAX_PARSED_ENTRIES || total * 46 > cdSize) {
    problems.push(`the end record claims ${total} entries, which cannot fit in a ${cdSize}-byte central directory`);
    return { entries, problems };
  }

  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  for (let i = 0; i < total; i++) {
    if (pos + 46 > cdEnd || buf.readUInt32LE(pos) !== SIG_CENTRAL) {
      problems.push(`central directory record ${i + 1} is damaged`);
      break;
    }
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const time = buf.readUInt16LE(pos + 12);
    const date = buf.readUInt16LE(pos + 14);
    const crc = buf.readUInt32LE(pos + 16);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const size = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    if (pos + 46 + nameLen > cdEnd) {
      problems.push(`central directory record ${i + 1} runs past the central directory`);
      break;
    }
    const name = buf.toString("utf8", pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    const entry = {
      name, flags, method, crc, compressedSize, size, time, date,
      isDirectory: name.endsWith("/"), data: null,
    };
    entries.push(entry);

    if (flags & 1) {
      problems.push(`${name}: encrypted entries are not supported`);
      continue;
    }
    if (method !== 0 && method !== 8) {
      problems.push(`${name}: unsupported compression method ${method}`);
      continue;
    }
    if (localOffset + 30 > n || buf.readUInt32LE(localOffset) !== SIG_LOCAL) {
      problems.push(`${name}: the local header is missing or out of range`);
      continue;
    }
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const localName = buf.toString("utf8", localOffset + 30, localOffset + 30 + localNameLen);
    if (localName !== name) {
      problems.push(`${name}: the local header names a different file`);
      continue;
    }
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compressedSize > n) {
      problems.push(`${name}: the data runs past the end of the zip`);
      continue;
    }
    const stored = buf.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) {
      if (compressedSize !== size) {
        problems.push(`${name}: stored entry sizes disagree (${compressedSize} vs ${size})`);
        continue;
      }
      data = stored;
    } else {
      try {
        data = zlib.inflateRawSync(stored, { maxOutputLength: maxFileBytes + 1 });
      } catch (err) {
        problems.push(`${name}: could not be inflated within ${maxFileBytes + 1} bytes (${err.code || err.message})`);
        continue;
      }
    }
    entry.data = data;
    if (data.length !== size) {
      problems.push(`${name}: size mismatch (header ${size}, data ${data.length})`);
    } else if (zlib.crc32(data) !== crc) {
      problems.push(`${name}: CRC mismatch`);
    }
  }
  return { entries, problems };
}

// { width, height } for a buffer that starts with the PNG signature and an
// IHDR chunk, else null.
export function pngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return null;
  if (buf.readUInt32BE(8) !== 13) return null;
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// CSV builders
// ---------------------------------------------------------------------------

export function orderedCatalog(catalog) {
  return [...catalog].sort((a, b) => a.listOrder - b.listOrder);
}

function joinRows(rows) {
  return rows.join(CSV_ROW_SEPARATOR) + (CSV_TRAILING_NEWLINE && rows.length ? CSV_ROW_SEPARATOR : "");
}

export function iconFileName(entry) {
  return path.posix.basename(entry.icon.play);
}

export function metadataCsv(catalog) {
  return joinRows(
    orderedCatalog(catalog).map((a) => {
      const incremental = a.type === "incremental";
      return [
        a.name,
        a.description,
        incremental ? "True" : "False",
        incremental ? String(a.steps) : "",
        a.initialState,
        String(a.points),
        String(a.listOrder),
      ].join(",");
    }),
  );
}

export function mappingsCsv(catalog) {
  return joinRows(orderedCatalog(catalog).map((a) => `${a.name},${iconFileName(a)}`));
}

// ---------------------------------------------------------------------------
// Catalog loading and the build
// ---------------------------------------------------------------------------

export async function loadCatalog(root = REPO_ROOT) {
  const file = path.join(root, "content", "achievements.js");
  const mod = await import(url.pathToFileURL(file).href);
  if (!Array.isArray(mod.ACHIEVEMENTS)) throw new Error(`${file} does not export an ACHIEVEMENTS array`);
  return mod.ACHIEVEMENTS;
}

// Builds the import zip in memory. Throws (naming the cause) on an empty
// catalog, a missing icon, an icon that is not a 512 x 512 PNG, or two
// entries sharing an icon. Never writes to disk.
export async function buildAchievementsZip({ root = REPO_ROOT, catalog } = {}) {
  const source = catalog || (await loadCatalog(root));
  if (!source.length) throw new Error("the catalog is empty: nothing to build");
  const ordered = orderedCatalog(source);
  const seen = new Map();
  const icons = [];
  for (const a of ordered) {
    const name = iconFileName(a);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`${a.id} and ${seen.get(key)} share the icon ${name}`);
    seen.set(key, a.id);
    const file = path.join(root, "achievements", a.icon.play);
    let data;
    try {
      data = fs.readFileSync(file);
    } catch {
      throw new Error(`${a.id}: the icon ${file} is missing`);
    }
    const size = pngSize(data);
    if (!size) throw new Error(`${a.id}: ${file} is not a PNG`);
    if (size.width !== LIMITS.iconSize || size.height !== LIMITS.iconSize) {
      throw new Error(`${a.id}: ${file} is ${size.width} x ${size.height}, not ${LIMITS.iconSize} x ${LIMITS.iconSize}`);
    }
    icons.push({ name, data });
  }
  const files = [
    { name: ZIP_METADATA_NAME, data: Buffer.from(metadataCsv(ordered), "utf8") },
    { name: ZIP_MAPPINGS_NAME, data: Buffer.from(mappingsCsv(ordered), "utf8") },
    ...icons,
  ];
  return { buffer: buildZip(files), files, catalog: ordered };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const DIGITS = /^\d+$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

function csvLines(text) {
  const lines = text.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// validateZip(buffer, { catalog, limits }) -> { ok, violations, stats }.
// Violations are in RULES order, then entry or row order.
export function validateZip(buffer, { catalog, limits } = {}) {
  const L = { ...LIMITS, ...(limits || {}) };
  const found = [];
  const add = (rule, message) => found.push({ rule, message });
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);

  const { entries, problems } = readZip(buf, { maxFileBytes: L.fileBytesExclusive });
  const stats = { entries: entries.length, achievements: 0, points: 0, incremental: 0, hidden: 0 };

  // 1 zip-readable
  for (const p of problems) add("zip-readable", p);

  // 2 no-subdirectories
  for (const e of entries) {
    if (e.name.includes("/") || e.name.includes("\\") || e.isDirectory) {
      add("no-subdirectories", `${JSON.stringify(e.name)} is a subdirectory or sits in one`);
    }
  }

  // 3 unique-file-names
  const seenNames = new Set();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (seenNames.has(key)) add("unique-file-names", `${JSON.stringify(e.name)} repeats an earlier file name`);
    seenNames.add(key);
  }

  // 4 only-csv-png
  for (const e of entries) {
    const lower = e.name.toLowerCase();
    if (!PRINTABLE_ASCII.test(e.name)) {
      add("only-csv-png", `${JSON.stringify(e.name)} is not a printable ASCII file name`);
    } else if (lower.endsWith(".csv")) {
      if (e.name !== ZIP_METADATA_NAME && e.name !== ZIP_MAPPINGS_NAME) {
        add("only-csv-png", `${e.name} is not one of the two import CSVs`);
      }
    } else if (!lower.endsWith(".png")) {
      add("only-csv-png", `${e.name} is neither a CSV nor a PNG`);
    }
  }

  // 5 file-size
  for (const e of entries) {
    const bytes = Math.max(e.size, e.data ? e.data.length : 0);
    if (bytes >= L.fileBytesExclusive) add("file-size", `${e.name} is ${bytes} bytes, not under ${L.fileBytesExclusive}`);
  }

  // 6 file-count
  if (entries.length > L.maxFiles) add("file-count", `${entries.length} files, at most ${L.maxFiles} are allowed`);

  // 7 zip-size
  if (buf.length >= L.zipBytesExclusive) add("zip-size", `the zip is ${buf.length} bytes, not under ${L.zipBytesExclusive}`);

  // 8 required-files
  const metaEntries = entries.filter((e) => e.name === ZIP_METADATA_NAME);
  const mapEntries = entries.filter((e) => e.name === ZIP_MAPPINGS_NAME);
  const pngEntries = entries.filter((e) => e.name.toLowerCase().endsWith(".png"));
  if (metaEntries.length !== 1) add("required-files", `${ZIP_METADATA_NAME} appears ${metaEntries.length} times, expected once`);
  if (mapEntries.length !== 1) add("required-files", `${ZIP_MAPPINGS_NAME} appears ${mapEntries.length} times, expected once`);
  if (pngEntries.length < 1) add("required-files", "the zip holds no PNG icon");

  // CSV parsing (rules 9 to 21 need readable CSV bytes)
  const metaFile = metaEntries.length === 1 ? metaEntries[0] : null;
  const mapFile = mapEntries.length === 1 ? mapEntries[0] : null;
  const metaText = metaFile && metaFile.data ? metaFile.data.toString("utf8") : null;
  const mapText = mapFile && mapFile.data ? mapFile.data.toString("utf8") : null;

  // 9 no-header-row
  for (const [file, text] of [[metaFile, metaText], [mapFile, mapText]]) {
    if (text !== null && text.toLowerCase().startsWith("name,")) {
      add("no-header-row", `${file.name} starts with a header row`);
    }
  }

  // 10 csv-columns
  const parseCsv = (file, text, columns) => {
    const rows = [];
    if (text === null) return rows;
    if (text.length === 0) {
      add("csv-columns", `${file.name} is empty`);
      return rows;
    }
    csvLines(text).forEach((line, i) => {
      const lineNo = i + 1;
      if (line === "") {
        add("csv-columns", `${file.name} line ${lineNo} is blank`);
        return;
      }
      const values = line.split(",");
      if (values.length !== columns) {
        add("csv-columns", `${file.name} line ${lineNo} has ${values.length} values, expected ${columns}`);
        rows.push({ lineNo, values: null });
        return;
      }
      rows.push({ lineNo, values });
    });
    return rows;
  };
  const metaRows = parseCsv(metaFile, metaText, 7);
  const mapRows = parseCsv(mapFile, mapText, 2);
  const goodMeta = metaRows.filter((r) => r.values);
  const goodMap = mapRows.filter((r) => r.values);
  const at = (r) => `${ZIP_METADATA_NAME} line ${r.lineNo}`;

  // 11 incremental-spelling
  for (const r of goodMeta) {
    if (r.values[2] !== "True" && r.values[2] !== "False") add("incremental-spelling", `${at(r)}: Incremental value ${JSON.stringify(r.values[2])} is not True or False`);
  }

  // 12 initial-state-spelling
  for (const r of goodMeta) {
    if (r.values[4] !== "Hidden" && r.values[4] !== "Revealed") add("initial-state-spelling", `${at(r)}: Initial State ${JSON.stringify(r.values[4])} is not Hidden or Revealed`);
  }

  // 13 steps-rules
  for (const r of goodMeta) {
    const inc = r.values[2];
    const steps = r.values[3];
    if (inc === "False" && steps !== "") {
      add("steps-rules", `${at(r)}: a standard row must leave Steps Needed empty`);
    } else if (inc === "True") {
      if (!DIGITS.test(steps) || Number(steps) < L.stepsMin || Number(steps) > L.stepsMax) {
        add("steps-rules", `${at(r)}: Steps Needed ${JSON.stringify(steps)} is not a whole number from ${L.stepsMin} to ${L.stepsMax}`);
      }
    }
  }

  // 14 points-rules
  for (const r of goodMeta) {
    const p = r.values[5];
    if (!DIGITS.test(p) || Number(p) < L.pointsMin || Number(p) > L.pointsMax || Number(p) % L.pointsStep !== 0) {
      add("points-rules", `${at(r)}: Points ${JSON.stringify(p)} is not ${L.pointsMin} to ${L.pointsMax} in multiples of ${L.pointsStep}`);
    }
  }

  // 15 list-order-rules
  {
    const seen = new Set();
    let previous = 0;
    for (const r of goodMeta) {
      const v = r.values[6];
      if (!DIGITS.test(v) || Number(v) < 1) {
        add("list-order-rules", `${at(r)}: List Order ${JSON.stringify(v)} is not a positive whole number`);
        continue;
      }
      const num = Number(v);
      if (seen.has(num)) add("list-order-rules", `${at(r)}: List Order ${num} repeats`);
      else if (num < previous) add("list-order-rules", `${at(r)}: List Order ${num} does not ascend`);
      seen.add(num);
      previous = Math.max(previous, num);
    }
  }

  // 16 name-rules
  {
    const exact = new Set();
    const folded = new Set();
    for (const r of goodMeta) {
      const name = r.values[0];
      if (name.length < 1 || name.length > L.nameMax) add("name-rules", `${at(r)}: the name is ${name.length} characters, expected 1 to ${L.nameMax}`);
      if (exact.has(name) || folded.has(name.toLowerCase())) add("name-rules", `${at(r)}: the name ${JSON.stringify(name)} is not unique`);
      exact.add(name);
      folded.add(name.toLowerCase());
    }
  }

  // 17 description-rules
  for (const r of goodMeta) {
    const d = r.values[1];
    if (d.length < 1 || d.length > L.descriptionMax) add("description-rules", `${at(r)}: the description is ${d.length} characters, expected 1 to ${L.descriptionMax}`);
  }

  // 18 text-charset
  for (const r of goodMeta) {
    for (const [label, text] of [["name", r.values[0]], ["description", r.values[1]]]) {
      if (!PRINTABLE_ASCII.test(text) || text.includes('"')) add("text-charset", `${at(r)}: the ${label} has a character outside printable ASCII or a double quote`);
    }
  }

  // 19 points-total
  {
    const total = goodMeta.reduce((sum, r) => (DIGITS.test(r.values[5]) ? sum + Number(r.values[5]) : sum), 0);
    if (total > L.gamePoints) add("points-total", `the points add up to ${total}, Play allows ${L.gamePoints} per game`);
  }

  // 20 achievement-count
  if (metaText !== null && (metaRows.length < 1 || metaRows.length > L.maxAchievements)) {
    add("achievement-count", `${metaRows.length} achievements, expected 1 to ${L.maxAchievements}`);
  }

  // 21 mapping-matches-metadata
  if (metaText !== null && mapText !== null) {
    const metaCount = new Map();
    for (const r of goodMeta) metaCount.set(r.values[0], (metaCount.get(r.values[0]) || 0) + 1);
    const mapCount = new Map();
    for (const r of goodMap) mapCount.set(r.values[0], (mapCount.get(r.values[0]) || 0) + 1);
    for (const r of goodMap) {
      if (metaCount.get(r.values[0]) !== 1) add("mapping-matches-metadata", `${ZIP_MAPPINGS_NAME} line ${r.lineNo}: ${JSON.stringify(r.values[0])} is not exactly one metadata name`);
    }
    for (const r of goodMeta) {
      if (mapCount.get(r.values[0]) !== 1) add("mapping-matches-metadata", `${at(r)}: ${JSON.stringify(r.values[0])} has ${mapCount.get(r.values[0]) || 0} mapping rows, expected 1`);
    }
  }

  // 22 icon-exists
  const entryByName = new Map(entries.map((e) => [e.name, e]));
  for (const r of goodMap) {
    if (!entryByName.has(r.values[1])) add("icon-exists", `${ZIP_MAPPINGS_NAME} line ${r.lineNo}: ${JSON.stringify(r.values[1])} is not in the zip`);
  }

  // 23 icon-unique-and-used
  if (mapText !== null) {
    const mapped = new Set();
    for (const r of goodMap) {
      if (mapped.has(r.values[1])) add("icon-unique-and-used", `${ZIP_MAPPINGS_NAME} line ${r.lineNo}: ${r.values[1]} is mapped twice`);
      mapped.add(r.values[1]);
    }
    for (const e of pngEntries) {
      if (!mapped.has(e.name)) add("icon-unique-and-used", `${e.name} is in the zip but not mapped`);
    }
  }

  // 24 icon-png-512
  for (const e of pngEntries) {
    if (!e.data) continue;
    const size = pngSize(e.data);
    if (!size) add("icon-png-512", `${e.name} is not a PNG with an IHDR chunk`);
    else if (size.width !== L.iconSize || size.height !== L.iconSize) add("icon-png-512", `${e.name} is ${size.width} x ${size.height}, expected ${L.iconSize} x ${L.iconSize}`);
  }

  // 25 matches-catalog
  if (catalog) {
    const expected = orderedCatalog(catalog);
    if (metaText !== null && mapText !== null) {
      if (goodMeta.length !== expected.length || metaRows.length !== expected.length) {
        add("matches-catalog", `${metaRows.length} metadata rows, the catalog has ${expected.length}`);
      }
      const fields = ["name", "description", "type", "steps", "initial state", "points", "list order"];
      expected.forEach((a, i) => {
        const r = goodMeta[i];
        if (!r) return;
        const incremental = a.type === "incremental";
        const want = [a.name, a.description, incremental ? "True" : "False", incremental ? String(a.steps) : "", a.initialState, String(a.points), String(a.listOrder)];
        want.forEach((w, f) => {
          if (r.values[f] !== w) add("matches-catalog", `${at(r)}: ${fields[f]} is ${JSON.stringify(r.values[f])}, the catalog says ${JSON.stringify(w)}`);
        });
        const m = goodMap[i];
        if (!m) add("matches-catalog", `${ZIP_MAPPINGS_NAME} has no row ${i + 1}`);
        else if (m.values[0] !== a.name || m.values[1] !== iconFileName(a)) {
          add("matches-catalog", `${ZIP_MAPPINGS_NAME} line ${m.lineNo}: ${m.values.join(",")} differs from ${a.name},${iconFileName(a)}`);
        }
      });
    } else {
      add("matches-catalog", "the CSVs could not be read to compare with the catalog");
    }
  }

  stats.achievements = metaRows.length;
  for (const r of goodMeta) {
    if (DIGITS.test(r.values[5])) stats.points += Number(r.values[5]);
    if (r.values[2] === "True") stats.incremental += 1;
    if (r.values[4] === "Hidden") stats.hidden += 1;
  }

  const order = new Map(RULES.map((r, i) => [r.id, i]));
  const violations = found
    .map((v, i) => ({ v, i }))
    .sort((a, b) => order.get(a.v.rule) - order.get(b.v.rule) || a.i - b.i)
    .map((x) => x.v);
  return { ok: violations.length === 0, violations, stats };
}

// ---------------------------------------------------------------------------
// The readable copy table
// ---------------------------------------------------------------------------

const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function copyTable(catalog) {
  const list = orderedCatalog(catalog);
  const blockTotal = COPY_BLOCKS.reduce((sum, b) => sum + b.size, 0);
  if (blockTotal !== list.length) {
    throw new Error(`COPY_BLOCKS add up to ${blockTotal} but the catalog has ${list.length} entries`);
  }
  const byId = new Map(list.map((a) => [a.id, a]));
  const points = list.reduce((sum, a) => sum + a.points, 0);
  const incremental = list.filter((a) => a.type === "incremental").length;
  const hidden = list.filter((a) => a.initialState === "Hidden").length;

  const out = [];
  out.push("# Achievement copy table", "");
  out.push("Generated by `node tools/achievements-zip.mjs --copy-table --out docs/ACHIEVEMENTS-COPY.md`. Do not edit by hand.", "");
  out.push(
    `${list.length} achievements, ${points} points (${LIMITS.gamePoints - points} left under Play's ${LIMITS.gamePoints}-point cap), ` +
      `${incremental} incremental, ${list.length - incremental} standard, ${hidden} Hidden.`,
    "",
  );
  out.push(
    "The Description column is Play's copy and freezes when the zip is imported. The Line column is the in-game unlock line and can be reworded later.",
    "",
  );
  let index = 0;
  COPY_BLOCKS.forEach((block, b) => {
    out.push(`## ${b + 1}. ${block.title} (${block.size})`, "");
    out.push("| # | Name | Description (Play) | Line (in game) | Pts | Type | Steps | Starts | Reveals |");
    out.push("|---|------|--------------------|----------------|-----|------|-------|--------|---------|");
    for (let i = 0; i < block.size; i++, index++) {
      const a = list[index];
      const reveals = a.reveals.length
        ? a.reveals.map((id) => {
            const target = byId.get(id);
            if (!target) throw new Error(`${a.id} reveals unknown id ${id}`);
            return target.name;
          }).join("; ")
        : "-";
      out.push(
        `| ${index + 1} | ${cell(a.name)} | ${cell(a.description)} | ${cell(a.line)} | ${a.points} | ${a.type} | ${a.steps === null ? "-" : a.steps} | ${a.initialState} | ${cell(reveals)} |`,
      );
    }
    out.push("");
  });
  out.push("## Reveal pairs", "");
  out.push("| Revealer | Its line (the hint) | Reveals |");
  out.push("|----------|---------------------|---------|");
  for (const a of list) {
    for (const id of a.reveals) {
      out.push(`| ${cell(a.name)} | ${cell(a.line)} | ${cell(byId.get(id).name)} |`);
    }
  }
  out.push("");
  return out.join("\n");
}
