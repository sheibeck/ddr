#!/usr/bin/env node
// tools/android-api-scan.mjs
//
// Phase 80 / DROID-02 + DROID-03 audit (tooling half of DROID-01's release
// checks) — scans a release AAB (or an APK) for call sites of the deprecated
// window and system-UI APIs Play Console's pre-launch report flags on
// Android 15+ (status/navigation-bar colours, setDecorFitsSystemWindows,
// system-UI visibility flags, display-cutout-mode writes), de-obfuscates the
// callers through R8's mapping.txt, groups them by owner (app, Capacitor
// core, a named Capacitor plugin, androidx, Google, other) and gates on
// --fail-on prefixes.
//
// Dependencies: Node 22 built-ins ONLY, plus two tools already on the build
// machine — the pinned JDK's `jar` (android/gradle.properties
// org.gradle.java.home, else JAVA_HOME) to unpack the dex files, and the
// Android SDK's `dexdump` (newest build-tools under ANDROID_HOME,
// ANDROID_SDK_ROOT, android/local.properties sdk.dir, else the Android
// Studio default %LOCALAPPDATA%/Android/Sdk). No npm dependency. Nothing
// here ships in the app, and it never builds anything: it reads an archive
// that already exists.
//
// Usage:
//   node tools/android-api-scan.mjs
//     [--aab <path>]        default android/app/build/outputs/bundle/release/app-release.aab
//     [--apk <path>]        scan an APK instead (classes*.dex at the root)
//     [--mapping <path|none>]  default android/app/build/outputs/mapping/release/mapping.txt;
//                           `none` for an unobfuscated archive (e.g. a debug APK)
//     [--fail-on <prefix,prefix,...>]  exit 1 if any caller's original class
//                           name starts with one of these package prefixes
//     [--json]              machine-readable output instead of markdown
//     [--jar <path>] [--dexdump <path>]  override tool resolution
//
// Output: a markdown table (API, deprecated in, owner, caller class#method,
// count), totals, and the count of callers still obfuscated after the
// mapping lookup (80-04 expects zero). dexdump's output is large (1.6M lines
// for a debug classes.dex): it is streamed line by line, never buffered.
//
// Exit codes: 0 clean (no --fail-on match), 1 a --fail-on match, 2 tooling
// failure (archive/mapping/jar/dexdump missing, extraction or dexdump
// failed or timed out). The temp directory is removed on every path.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

const JAR_TIMEOUT_MS = 120_000;
const DEXDUMP_TIMEOUT_MS = 300_000; // per dex file; a debug classes.dex takes ~25 s

// ─── the audit list ──────────────────────────────────────────────────────────
// `ref` is the substring dexdump prints for the referenced member. `kind`
// "invoke" matches invoke-* lines; "field-write" matches iput/sput lines.
// Library (non-framework) entries carry libClass/libMember so a renamed copy
// can be matched through the mapping (expandApisWithMapping).
export const DEPRECATED_APIS = [
  { label: "Window.setStatusBarColor", ref: "Landroid/view/Window;.setStatusBarColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.getStatusBarColor", ref: "Landroid/view/Window;.getStatusBarColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.setNavigationBarColor", ref: "Landroid/view/Window;.setNavigationBarColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.getNavigationBarColor", ref: "Landroid/view/Window;.getNavigationBarColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.setNavigationBarDividerColor", ref: "Landroid/view/Window;.setNavigationBarDividerColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.getNavigationBarDividerColor", ref: "Landroid/view/Window;.getNavigationBarDividerColor:", kind: "invoke", deprecatedIn: 35 },
  { label: "Window.setDecorFitsSystemWindows", ref: "Landroid/view/Window;.setDecorFitsSystemWindows:", kind: "invoke", deprecatedIn: 35 },
  {
    label: "WindowCompat.setDecorFitsSystemWindows",
    ref: "Landroidx/core/view/WindowCompat;.setDecorFitsSystemWindows:",
    kind: "invoke",
    deprecatedIn: 35,
    libClass: "androidx.core.view.WindowCompat",
    libMember: "setDecorFitsSystemWindows",
  },
  { label: "View.setSystemUiVisibility", ref: "Landroid/view/View;.setSystemUiVisibility:", kind: "invoke", deprecatedIn: 30 },
  { label: "View.getSystemUiVisibility", ref: "Landroid/view/View;.getSystemUiVisibility:", kind: "invoke", deprecatedIn: 30 },
  {
    label: "WindowManager.LayoutParams.layoutInDisplayCutoutMode (write)",
    ref: "Landroid/view/WindowManager$LayoutParams;.layoutInDisplayCutoutMode:",
    kind: "field-write",
    deprecatedIn: 35,
  },
];

// ─── dexdump parsing ─────────────────────────────────────────────────────────

/** `Lcom/a/B$C;` -> `com.a.B$C` */
export function descriptorToName(desc) {
  let d = desc.trim();
  if (d.startsWith("L") && d.endsWith(";")) d = d.slice(1, -1);
  return d.replace(/\//g, ".");
}

const RE_CLASS = /^\s*Class descriptor\s*:\s*'([^']+)'/;
const RE_MEMBER_IN = /^\s*#\d+\s*:\s*\(in ([^)]+)\)/;
const RE_NAME = /^\s*name\s*:\s*'([^']*)'/;
// `|[001d78] com.capacitorjs.plugins.statusbar.StatusBar.setStatusBarColorDeprecated:(I)V`
const RE_CODE_HEADER = /\|\[[0-9a-f]+\] (.+)\.([^.:]+):\(/;
const RE_INVOKE = /\|[0-9a-f]+: invoke-/;
const RE_FIELD_WRITE = /\|[0-9a-f]+: [is]put(?:-[a-z]+)? /;

/**
 * A streaming scanner over `dexdump -d` lines. feed() one line at a time;
 * hits accumulate as { api, ref, deprecatedIn, callerClass, callerMethod }.
 * The caller is taken from the method's code-header line when present,
 * else from the `#N : (in L...;)` + `name : '...'` pair.
 */
export function createDexScanner(apis = DEPRECATED_APIS) {
  const invokes = apis.filter((a) => a.kind !== "field-write");
  const writes = apis.filter((a) => a.kind === "field-write");
  const hits = [];
  let cls = null;
  let memberClass = null;
  let expectName = false;
  let callerClass = null;
  let callerMethod = null;

  function feed(line) {
    let m;
    if ((m = RE_CLASS.exec(line))) {
      cls = descriptorToName(m[1]);
      callerClass = cls;
      callerMethod = null;
      expectName = false;
      return;
    }
    if ((m = RE_MEMBER_IN.exec(line))) {
      memberClass = descriptorToName(m[1]);
      expectName = true;
      return;
    }
    if (expectName && (m = RE_NAME.exec(line))) {
      callerClass = memberClass || cls;
      callerMethod = m[1];
      expectName = false;
      return;
    }
    if ((m = RE_CODE_HEADER.exec(line))) {
      callerClass = m[1];
      callerMethod = m[2];
      return;
    }
    let pool = null;
    if (RE_INVOKE.test(line)) pool = invokes;
    else if (RE_FIELD_WRITE.test(line)) pool = writes;
    if (!pool) return;
    for (const a of pool) {
      if (line.includes(a.ref)) {
        hits.push({ api: a.label, ref: a.ref, deprecatedIn: a.deprecatedIn, callerClass, callerMethod });
        break;
      }
    }
  }

  return { feed, hits };
}

/** Convenience: scan a whole dexdump text (tests, small inputs). */
export function scanDexdumpText(text, apis = DEPRECATED_APIS) {
  const s = createDexScanner(apis);
  for (const line of text.split(/\r?\n/)) s.feed(line);
  return s.hits;
}

// ─── mapping.txt ─────────────────────────────────────────────────────────────

const RE_MAP_CLASS = /^(\S+) -> (\S+):$/;
// `    [1:5:]type name(args)[:202[:203]] -> obf`
const RE_MAP_METHOD = /^\s+(?:\d+:\d+:)?\S+ ([^\s(]+)\([^)]*\)(?::\d+(?::\d+)?)? -> (\S+)$/;

/**
 * Parse R8's mapping.txt.
 * Returns {
 *   classes: Map obfClass -> originalClass,
 *   forward: Map originalClass -> obfClass,
 *   methods: Map obfClass -> Map obfMethod -> Set(original method names),
 *   forwardMethods: Map originalClass -> Map originalMethod -> Set(obf names),
 * }
 * Fields and `#` comment/metadata lines are ignored.
 */
export function parseMapping(text) {
  const classes = new Map();
  const forward = new Map();
  const methods = new Map();
  const forwardMethods = new Map();
  let curObf = null;
  let curOrig = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line || line.trimStart().startsWith("#")) continue;
    let m;
    if (!/^\s/.test(line) && (m = RE_MAP_CLASS.exec(line))) {
      curOrig = m[1];
      curObf = m[2];
      classes.set(curObf, curOrig);
      forward.set(curOrig, curObf);
      if (!methods.has(curObf)) methods.set(curObf, new Map());
      if (!forwardMethods.has(curOrig)) forwardMethods.set(curOrig, new Map());
      continue;
    }
    if (curObf && (m = RE_MAP_METHOD.exec(line))) {
      // An inlined frame names its origin class (`a.b.C.foo`); keep the method name.
      const orig = m[1].includes(".") ? m[1].slice(m[1].lastIndexOf(".") + 1) : m[1];
      const obf = m[2];
      const byObf = methods.get(curObf);
      if (!byObf.has(obf)) byObf.set(obf, new Set());
      byObf.get(obf).add(orig);
      const byOrig = forwardMethods.get(curOrig);
      if (!byOrig.has(orig)) byOrig.set(orig, new Set());
      byOrig.get(orig).add(obf);
    }
  }
  return { classes, forward, methods, forwardMethods };
}

/**
 * For library APIs R8 may rename (androidx), add alias entries whose `ref`
 * is the renamed class/member, so an obfuscated call still matches.
 */
export function expandApisWithMapping(apis, mapping) {
  if (!mapping) return apis;
  const out = [...apis];
  for (const a of apis) {
    if (!a.libClass) continue;
    const obfClass = mapping.forward.get(a.libClass);
    if (!obfClass) continue;
    const obfNames = mapping.forwardMethods.get(a.libClass)?.get(a.libMember) || new Set([a.libMember]);
    for (const n of obfNames) {
      const ref = `L${obfClass.replace(/\./g, "/")};.${n}:`;
      if (ref !== a.ref) out.push({ ...a, ref });
    }
  }
  return out;
}

/**
 * Map each hit's caller back to original names. With no mapping (an
 * unobfuscated archive) names pass through as resolved. With a mapping, a
 * caller class absent from it stays as-is and is flagged unresolved.
 */
export function deobfuscateHits(hits, mapping) {
  return hits.map((h) => {
    if (!mapping) return { ...h, unresolved: false };
    const orig = mapping.classes.get(h.callerClass);
    if (!orig) return { ...h, unresolved: true };
    const cands = mapping.methods.get(h.callerClass)?.get(h.callerMethod);
    const method = cands && cands.size ? [...cands].sort().join("|") : h.callerMethod;
    return { ...h, callerClass: orig, callerMethod: method, unresolved: false };
  });
}

// ─── owners, aggregation, decision ───────────────────────────────────────────

const inPkg = (name, prefix) => name === prefix || name.startsWith(prefix + ".");

export function ownerOf(name) {
  if (inPkg(name, "com.darktierstudios.delvedierepeat")) return "app";
  if (inPkg(name, "com.getcapacitor")) return "Capacitor core";
  if (inPkg(name, "com.capacitorjs.plugins")) {
    const plugin = name.slice("com.capacitorjs.plugins.".length).split(".")[0];
    return `Capacitor plugin: ${plugin}`;
  }
  if (inPkg(name, "androidx")) return "androidx";
  if (inPkg(name, "com.google")) return "Google";
  return "other";
}

/** Group de-obfuscated hits into rows { api, deprecatedIn, owner, callerClass, callerMethod, unresolved, count }. */
export function aggregateRows(hits) {
  const byKey = new Map();
  for (const h of hits) {
    const key = `${h.api}\u0000${h.callerClass}\u0000${h.callerMethod}`;
    const row = byKey.get(key);
    if (row) row.count++;
    else
      byKey.set(key, {
        api: h.api,
        deprecatedIn: h.deprecatedIn,
        owner: ownerOf(h.callerClass || ""),
        callerClass: h.callerClass,
        callerMethod: h.callerMethod,
        unresolved: Boolean(h.unresolved),
        count: 1,
      });
  }
  return [...byKey.values()].sort(
    (a, b) => a.owner.localeCompare(b.owner) || a.api.localeCompare(b.api) || String(a.callerClass).localeCompare(String(b.callerClass)),
  );
}

/** Pure --fail-on decision: exit 1 iff any row's caller class sits under a prefix. */
export function failDecision(rows, prefixes) {
  const ps = (prefixes || []).map((p) => p.trim()).filter(Boolean);
  const matches = rows.filter((r) => ps.some((p) => inPkg(r.callerClass || "", p)));
  const unresolved = rows.filter((r) => r.unresolved);
  return { exitCode: matches.length ? 1 : 0, matches, unresolved };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

class ToolError extends Error {}

function parseArgs(argv) {
  const args = { aab: null, apk: null, mapping: null, failOn: [], json: false, jar: null, dexdump: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new ToolError(`${a} needs a value`);
      return v;
    };
    if (a === "--aab") args.aab = next();
    else if (a === "--apk") args.apk = next();
    else if (a === "--mapping") args.mapping = next();
    else if (a === "--fail-on") args.failOn = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--json") args.json = true;
    else if (a === "--jar") args.jar = next();
    else if (a === "--dexdump") args.dexdump = next();
    else throw new ToolError(`unknown argument ${a}`);
  }
  return args;
}

function readProp(file, key) {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = new RegExp(`^\\s*${key.replace(/\./g, "\\.")}\\s*=\\s*(.+?)\\s*$`).exec(line);
    if (m) return m[1].replace(/\\:/g, ":").replace(/\\\\/g, "\\");
  }
  return null;
}

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);

function resolveJar(override) {
  if (override) return override;
  const homes = [readProp(path.join(REPO_ROOT, "android", "gradle.properties"), "org.gradle.java.home"), process.env.JAVA_HOME];
  for (const h of homes) {
    if (!h) continue;
    const p = path.join(h, "bin", exe("jar"));
    if (existsSync(p)) return p;
  }
  throw new ToolError("jar not found (set org.gradle.java.home in android/gradle.properties or JAVA_HOME, or pass --jar)");
}

function resolveDexdump(override) {
  if (override) return override;
  const sdks = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    readProp(path.join(REPO_ROOT, "android", "local.properties"), "sdk.dir"),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
  ];
  for (const sdk of sdks) {
    if (!sdk) continue;
    const bt = path.join(sdk, "build-tools");
    if (!existsSync(bt)) continue;
    const versions = readdirSync(bt).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) {
      const p = path.join(bt, v, exe("dexdump"));
      if (existsSync(p)) return p;
    }
  }
  throw new ToolError("dexdump not found (set ANDROID_HOME / ANDROID_SDK_ROOT or android/local.properties sdk.dir, or pass --dexdump)");
}

function extractDex(jar, archive, dir) {
  const list = spawnSync(jar, ["tf", archive], { encoding: "utf8", timeout: JAR_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (list.error || list.status !== 0) throw new ToolError(`jar tf failed: ${list.error?.message || list.stderr}`);
  const entries = list.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((e) => /^(?:base\/dex\/)?classes\d*\.dex$/.test(e));
  if (!entries.length) throw new ToolError(`no classes*.dex (or base/dex/classes*.dex) in ${archive}`);
  const x = spawnSync(jar, ["xf", archive, ...entries], { cwd: dir, encoding: "utf8", timeout: JAR_TIMEOUT_MS });
  if (x.error || x.status !== 0) throw new ToolError(`jar xf failed: ${x.error?.message || x.stderr}`);
  return entries.map((e) => path.join(dir, e));
}

function dexdumpInto(dexdump, dexFile, scanner) {
  return new Promise((resolve, reject) => {
    const child = spawn(dexdump, ["-d", dexFile], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => {
      if (stderr.length < 4096) stderr += d;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new ToolError(`dexdump timed out after ${DEXDUMP_TIMEOUT_MS / 1000}s on ${path.basename(dexFile)}`));
    }, DEXDUMP_TIMEOUT_MS);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => scanner.feed(line));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ToolError(`dexdump failed to start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new ToolError(`dexdump exited ${code} on ${path.basename(dexFile)}: ${stderr.trim()}`));
    });
  });
}

function printMarkdown(report) {
  const { archive, mapping, dexFiles, rows, decision, failOn } = report;
  console.log(`# Deprecated window / system-UI API scan`);
  console.log("");
  console.log(`- Archive: ${archive}`);
  console.log(`- Mapping: ${mapping || "none (names taken as-is)"}`);
  console.log(`- Dex files: ${dexFiles.length}`);
  console.log("");
  if (!rows.length) {
    console.log("No call sites of the audited APIs.");
  } else {
    console.log("| API | deprecated in | owner | caller | count |");
    console.log("|---|---|---|---|---|");
    for (const r of rows) {
      const caller = `${r.callerClass}#${r.callerMethod ?? "?"}${r.unresolved ? " (unresolved)" : ""}`;
      console.log(`| ${r.api} | API ${r.deprecatedIn} | ${r.owner} | ${caller} | ${r.count} |`);
    }
  }
  console.log("");
  const sites = rows.reduce((n, r) => n + r.count, 0);
  const callers = new Set(rows.map((r) => `${r.callerClass}#${r.callerMethod}`)).size;
  console.log(`Totals: ${sites} call site(s) in ${callers} caller method(s); unresolved (still obfuscated): ${decision.unresolved.length}`);
  if (failOn.length) {
    console.log(`--fail-on ${failOn.join(",")}: ${decision.matches.length ? `FAIL (${decision.matches.length} matching row(s))` : "clean"}`);
    for (const r of decision.matches) console.log(`  - ${r.callerClass}#${r.callerMethod} -> ${r.api}`);
  }
}

async function main() {
  let tmp = null;
  try {
    const args = parseArgs(process.argv.slice(2));
    const archive = path.resolve(
      args.apk || args.aab || path.join(REPO_ROOT, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab"),
    );
    if (!existsSync(archive)) throw new ToolError(`archive not found: ${archive}`);

    let mappingPath = null;
    let mapping = null;
    if (args.mapping !== "none") {
      mappingPath = path.resolve(args.mapping || path.join(REPO_ROOT, "android", "app", "build", "outputs", "mapping", "release", "mapping.txt"));
      if (!existsSync(mappingPath)) throw new ToolError(`mapping not found: ${mappingPath} (pass --mapping none for an unobfuscated archive)`);
      mapping = parseMapping(readFileSync(mappingPath, "utf8"));
    }

    const jar = resolveJar(args.jar);
    const dexdump = resolveDexdump(args.dexdump);
    tmp = mkdtempSync(path.join(os.tmpdir(), "mw-api-scan-"));
    const dexFiles = extractDex(jar, archive, tmp);

    const scanner = createDexScanner(expandApisWithMapping(DEPRECATED_APIS, mapping));
    for (const dex of dexFiles) await dexdumpInto(dexdump, dex, scanner);

    const rows = aggregateRows(deobfuscateHits(scanner.hits, mapping));
    const decision = failDecision(rows, args.failOn);
    const report = {
      archive,
      mapping: mappingPath,
      dexFiles: dexFiles.map((f) => path.relative(tmp, f).replace(/\\/g, "/")),
      rows,
      failOn: args.failOn,
      decision,
    };
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            archive,
            mapping: mappingPath,
            dexFiles: report.dexFiles,
            rows,
            totals: { callSites: rows.reduce((n, r) => n + r.count, 0), rows: rows.length, unresolved: decision.unresolved.length },
            failOn: args.failOn,
            matches: decision.matches,
            exitCode: decision.exitCode,
          },
          null,
          2,
        ),
      );
    } else {
      printMarkdown(report);
    }
    return decision.exitCode;
  } catch (e) {
    console.error(`android-api-scan: ${e instanceof ToolError ? e.message : e.stack || e}`);
    return 2;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

const isEntry = (() => {
  if (!process.argv[1]) return false;
  const a = path.resolve(process.argv[1]);
  return process.platform === "win32" ? a.toLowerCase() === __filename.toLowerCase() : a === __filename;
})();

if (isEntry) {
  main().then((code) => {
    process.exitCode = code;
  });
}
