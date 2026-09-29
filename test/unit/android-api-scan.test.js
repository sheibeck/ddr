// test/unit/android-api-scan.test.js
//
// Phase 80 (DROID-01 / DROID-02 tooling) — unit tests for the pure parts of
// tools/android-api-scan.mjs: the dexdump line scanner, the R8 mapping.txt
// parser, owner grouping and the --fail-on decision.
//
// The dexdump fixtures below are REAL `dexdump -d` output (build-tools
// 36.0.0), copied verbatim from the existing Sep-24 debug APK in the main
// checkout (android/app/build/outputs/apk/debug/app-debug.apk). Reading an
// old artifact is not a build; nothing here runs Gradle.
//   - STATUSBAR_EXCERPT: classes2.dex, @capacitor/status-bar 8.0.3's
//     StatusBar#setStatusBarColorDeprecated (Window.setStatusBarColor) and
//     StatusBar#setSystemUiVisibilityDeprecated (View.setSystemUiVisibility),
//     plus unrelated invokes (getWindow) that must be ignored.
//   - CUTOUT_EXCERPT: classes.dex, androidx.activity.EdgeToEdgeApi28's write
//     to WindowManager.LayoutParams.layoutInDisplayCutoutMode, next to
//     unrelated invokes (Intrinsics.checkNotNullParameter, getAttributes).
// The mapping.txt lines follow R8's documented format; 80-04 confirms the
// parser against the single release build's real mapping.

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEPRECATED_APIS,
  parseMapping,
  scanDexdumpText,
  createDexScanner,
  descriptorToName,
  deobfuscateHits,
  expandApisWithMapping,
  aggregateRows,
  ownerOf,
  failDecision,
} from "../../tools/android-api-scan.mjs";

const STATUSBAR_EXCERPT = `Class #1            -
  Class descriptor  : 'Lcom/capacitorjs/plugins/statusbar/StatusBar;'
  Access flags      : 0x0001 (PUBLIC)
    #12              : (in Lcom/capacitorjs/plugins/statusbar/StatusBar;)
      name          : 'setStatusBarColorDeprecated'
      type          : '(I)V'
      access        : 0x0002 (PRIVATE)
      code          -
      registers     : 3
      ins           : 2
      outs          : 2
      insns size    : 10 16-bit code units
001d78:                                        |[001d78] com.capacitorjs.plugins.statusbar.StatusBar.setStatusBarColorDeprecated:(I)V
001d88: 5410 0500                              |0000: iget-object v0, v1, Lcom/capacitorjs/plugins/statusbar/StatusBar;.activity:Landroidx/appcompat/app/AppCompatActivity; // field@0005
001d8c: 6e10 1400 0000                         |0002: invoke-virtual {v0}, Landroidx/appcompat/app/AppCompatActivity;.getWindow:()Landroid/view/Window; // method@0014
001d92: 0c00                                   |0005: move-result-object v0
001d94: 6e20 0d00 2000                         |0006: invoke-virtual {v0, v2}, Landroid/view/Window;.setStatusBarColor:(I)V // method@000d
001d9a: 0e00                                   |0009: return-void
      catches       : (none)
      positions     :
        0x0000 line=202
        0x0009 line=203
      locals        :
        0x0000 - 0x000a reg=1 this Lcom/capacitorjs/plugins/statusbar/StatusBar;
        0x0000 - 0x000a reg=2 color I

    #13              : (in Lcom/capacitorjs/plugins/statusbar/StatusBar;)
      name          : 'setSystemUiVisibilityDeprecated'
      type          : '(Landroid/view/View;I)V'
      access        : 0x0002 (PRIVATE)
      code          -
      registers     : 3
      ins           : 3
      outs          : 2
      insns size    : 4 16-bit code units
001dfc:                                        |[001dfc] com.capacitorjs.plugins.statusbar.StatusBar.setSystemUiVisibilityDeprecated:(Landroid/view/View;I)V
001e0c: 6e20 0700 2100                         |0000: invoke-virtual {v1, v2}, Landroid/view/View;.setSystemUiVisibility:(I)V // method@0007
001e12: 0e00                                   |0003: return-void
      catches       : (none)
      positions     :
        0x0000 line=217
        0x0003 line=218`;

const CUTOUT_EXCERPT = `  Class descriptor  : 'Landroidx/activity/EdgeToEdgeApi28;'
    #0              : (in Landroidx/activity/EdgeToEdgeApi28;)
      name          : 'adjustLayoutInDisplayCutoutMode'
      type          : '(Landroid/view/Window;)V'
      access        : 0x0001 (PUBLIC)
      code          -
      registers     : 4
      ins           : 2
      outs          : 2
      insns size    : 14 16-bit code units
124b20:                                        |[124b20] androidx.activity.EdgeToEdgeApi28.adjustLayoutInDisplayCutoutMode:(Landroid/view/Window;)V
124b30: 1a00 87e9                              |0000: const-string v0, "window" // string@e987
124b34: 7120 cbaa 0300                         |0002: invoke-static {v3, v0}, Lkotlin/jvm/internal/Intrinsics;.checkNotNullParameter:(Ljava/lang/Object;Ljava/lang/String;)V // method@aacb
124b3a: 6e10 ba0c 0300                         |0005: invoke-virtual {v3}, Landroid/view/Window;.getAttributes:()Landroid/view/WindowManager$LayoutParams; // method@0cba
124b40: 0c00                                   |0008: move-result-object v0
124b42: 0000                                   |0009: nop // spacer
124b44: 1211                                   |000a: const/4 v1, #int 1 // #1
124b46: 5901 2f01                              |000b: iput v1, v0, Landroid/view/WindowManager$LayoutParams;.layoutInDisplayCutoutMode:I // field@012f
124b4a: 0e00                                   |000d: return-void`;

// R8 mapping.txt format: `# ` header/metadata lines, class lines
// `original.Name -> obf.Name:`, indented member lines
// `[startLine:endLine:]type name(args)[:origStart[:origEnd]] -> obf`,
// fields `type name -> obf`, overloads sharing one obfuscated name.
const MAPPING = [
  "# compiler: R8",
  "# compiler_version: 8.13.0",
  "# min_api: 24",
  "# pg_map_id: 0123abc",
  "# common_typos_disable",
  "com.capacitorjs.plugins.statusbar.StatusBar -> c.a.b:",
  '# {"id":"sourceFile","fileName":"StatusBar.java"}',
  "    androidx.appcompat.app.AppCompatActivity activity -> a",
  "    1:5:void setStatusBarColorDeprecated(int):202:203 -> f",
  "    6:9:int getStatusBarColorDeprecated():197:197 -> f",
  "    void setSystemUiVisibilityDeprecated(android.view.View,int) -> g",
  "com.getcapacitor.plugin.SystemBars -> com.getcapacitor.plugin.SystemBars:",
  "    void load() -> load",
  "androidx.core.view.WindowCompat -> A.b:",
  "    1:3:void setDecorFitsSystemWindows(android.view.Window,boolean):55:57 -> a",
  "com.darktierstudios.delvedierepeat.MainActivity -> com.darktierstudios.delvedierepeat.MainActivity:",
  "    void onCreate(android.os.Bundle) -> onCreate",
].join("\n");

// ─── dexdump scanner ─────────────────────────────────────────────────────────

test("descriptorToName turns a dex class descriptor into a dotted name", () => {
  assert.equal(descriptorToName("Lcom/capacitorjs/plugins/statusbar/StatusBar;"), "com.capacitorjs.plugins.statusbar.StatusBar");
  assert.equal(descriptorToName("Landroid/view/WindowManager$LayoutParams;"), "android.view.WindowManager$LayoutParams");
});

test("DEPRECATED_APIS covers every window/system-UI API the audit names", () => {
  const labels = DEPRECATED_APIS.map((a) => a.label);
  for (const want of [
    "Window.setStatusBarColor",
    "Window.getStatusBarColor",
    "Window.setNavigationBarColor",
    "Window.getNavigationBarColor",
    "Window.setNavigationBarDividerColor",
    "Window.getNavigationBarDividerColor",
    "Window.setDecorFitsSystemWindows",
    "WindowCompat.setDecorFitsSystemWindows",
    "View.setSystemUiVisibility",
    "View.getSystemUiVisibility",
    "WindowManager.LayoutParams.layoutInDisplayCutoutMode (write)",
  ]) {
    assert.ok(labels.includes(want), `DEPRECATED_APIS lacks ${want}`);
  }
  for (const a of DEPRECATED_APIS) {
    assert.equal(typeof a.ref, "string");
    assert.ok(Number.isInteger(a.deprecatedIn), `${a.label} needs a deprecatedIn API level`);
  }
});

test("the scanner reports the real status-bar plugin's deprecated invokes with caller class and method", () => {
  const hits = scanDexdumpText(STATUSBAR_EXCERPT);
  assert.deepEqual(
    hits.map((h) => [h.api, h.callerClass, h.callerMethod]),
    [
      ["Window.setStatusBarColor", "com.capacitorjs.plugins.statusbar.StatusBar", "setStatusBarColorDeprecated"],
      ["View.setSystemUiVisibility", "com.capacitorjs.plugins.statusbar.StatusBar", "setSystemUiVisibilityDeprecated"],
    ],
  );
});

test("the scanner ignores unrelated invokes and field reads", () => {
  const hits = scanDexdumpText(STATUSBAR_EXCERPT);
  assert.ok(!hits.some((h) => /getWindow|activity/.test(h.api)));
  assert.equal(hits.length, 2);
});

test("the scanner reports the real cutout-mode field write (androidx EdgeToEdgeApi28)", () => {
  const hits = scanDexdumpText(CUTOUT_EXCERPT);
  assert.deepEqual(
    hits.map((h) => [h.api, h.callerClass, h.callerMethod]),
    [["WindowManager.LayoutParams.layoutInDisplayCutoutMode (write)", "androidx.activity.EdgeToEdgeApi28", "adjustLayoutInDisplayCutoutMode"]],
  );
});

test("a field READ of layoutInDisplayCutoutMode is not a hit", () => {
  const read = CUTOUT_EXCERPT.replace("|000b: iput v1, v0,", "|000b: iget v1, v0,");
  assert.equal(scanDexdumpText(read).length, 0);
});

test("the streaming scanner (line by line) matches the whole-text scan", () => {
  const s = createDexScanner();
  for (const line of (STATUSBAR_EXCERPT + "\n" + CUTOUT_EXCERPT).split("\n")) s.feed(line);
  assert.equal(s.hits.length, 3);
});

test("without a code-header line the scanner falls back to the (in ...) + name lines", () => {
  const stripped = STATUSBAR_EXCERPT.split("\n").filter((l) => !/\|\[[0-9a-f]+\] /.test(l)).join("\n");
  const hits = scanDexdumpText(stripped);
  assert.deepEqual(
    hits.map((h) => [h.callerClass, h.callerMethod]),
    [
      ["com.capacitorjs.plugins.statusbar.StatusBar", "setStatusBarColorDeprecated"],
      ["com.capacitorjs.plugins.statusbar.StatusBar", "setSystemUiVisibilityDeprecated"],
    ],
  );
});

// ─── mapping.txt ─────────────────────────────────────────────────────────────

test("parseMapping maps obfuscated class names back to the originals", () => {
  const m = parseMapping(MAPPING);
  assert.equal(m.classes.get("c.a.b"), "com.capacitorjs.plugins.statusbar.StatusBar");
  assert.equal(m.classes.get("com.getcapacitor.plugin.SystemBars"), "com.getcapacitor.plugin.SystemBars");
  assert.equal(m.classes.get("A.b"), "androidx.core.view.WindowCompat");
  assert.equal(m.forward.get("androidx.core.view.WindowCompat"), "A.b");
});

test("parseMapping keeps every original candidate for an overloaded obfuscated method, and ignores fields and comments", () => {
  const m = parseMapping(MAPPING);
  const methods = m.methods.get("c.a.b");
  assert.deepEqual([...methods.get("f")].sort(), ["getStatusBarColorDeprecated", "setStatusBarColorDeprecated"]);
  assert.deepEqual([...methods.get("g")], ["setSystemUiVisibilityDeprecated"]);
  assert.ok(!methods.has("a"), "the field line `activity -> a` must not become a method");
  assert.ok(![...m.classes.keys()].some((k) => k.startsWith("#")));
});

test("deobfuscateHits resolves obfuscated callers and flags classes missing from the mapping as unresolved", () => {
  const m = parseMapping(MAPPING);
  const hits = [
    { api: "Window.setStatusBarColor", ref: "x", callerClass: "c.a.b", callerMethod: "f" },
    { api: "View.setSystemUiVisibility", ref: "x", callerClass: "c.a.b", callerMethod: "g" },
    { api: "Window.setStatusBarColor", ref: "x", callerClass: "z.q", callerMethod: "a" },
  ];
  const out = deobfuscateHits(hits, m);
  assert.equal(out[0].callerClass, "com.capacitorjs.plugins.statusbar.StatusBar");
  assert.equal(out[0].callerMethod, "getStatusBarColorDeprecated|setStatusBarColorDeprecated");
  assert.equal(out[0].unresolved, false);
  assert.equal(out[1].callerMethod, "setSystemUiVisibilityDeprecated");
  assert.equal(out[2].callerClass, "z.q");
  assert.equal(out[2].unresolved, true);
});

test("deobfuscateHits with no mapping (--mapping none) passes names through as resolved", () => {
  const out = deobfuscateHits(scanDexdumpText(STATUSBAR_EXCERPT), null);
  assert.equal(out[0].callerClass, "com.capacitorjs.plugins.statusbar.StatusBar");
  assert.ok(out.every((h) => h.unresolved === false));
});

test("expandApisWithMapping adds the renamed alias of a library API (androidx WindowCompat) so an obfuscated call still matches", () => {
  const apis = expandApisWithMapping(DEPRECATED_APIS, parseMapping(MAPPING));
  const line = "0010: 7120 414e 0400 |0015: invoke-static {v4, v0}, LA/b;.a:(Landroid/view/Window;Z)V // method@4e41";
  const s = createDexScanner(apis);
  s.feed("  Class descriptor  : 'Lc/a/b;'");
  s.feed("    #0              : (in Lc/a/b;)");
  s.feed("      name          : 'f'");
  s.feed(line);
  assert.equal(s.hits.length, 1);
  assert.equal(s.hits[0].api, "WindowCompat.setDecorFitsSystemWindows");
});

// ─── owners, aggregation, fail-on ────────────────────────────────────────────

test("ownerOf groups original names by package prefix", () => {
  assert.equal(ownerOf("com.darktierstudios.delvedierepeat.MainActivity"), "app");
  assert.equal(ownerOf("com.getcapacitor.plugin.SystemBars"), "Capacitor core");
  assert.equal(ownerOf("com.capacitorjs.plugins.statusbar.StatusBar"), "Capacitor plugin: statusbar");
  assert.equal(ownerOf("com.capacitorjs.plugins.splashscreen.SplashScreen"), "Capacitor plugin: splashscreen");
  assert.equal(ownerOf("androidx.activity.EdgeToEdgeApi28"), "androidx");
  assert.equal(ownerOf("com.google.android.material.internal.EdgeToEdgeUtils"), "Google");
  assert.equal(ownerOf("kotlin.jvm.internal.Intrinsics"), "other");
  assert.equal(ownerOf("com.getcapacitorx.Foo"), "other", "prefixes match on a package boundary");
});

test("aggregateRows counts repeated call sites per API and caller", () => {
  const hits = deobfuscateHits(scanDexdumpText(STATUSBAR_EXCERPT + "\n" + STATUSBAR_EXCERPT), null);
  const rows = aggregateRows(hits);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.count === 2));
  assert.equal(rows[0].owner, "Capacitor plugin: statusbar");
});

test("failDecision exits 1 when any caller matches a --fail-on prefix, else 0, and lists unresolved callers", () => {
  const rows = aggregateRows(deobfuscateHits(scanDexdumpText(STATUSBAR_EXCERPT + "\n" + CUTOUT_EXCERPT), null));
  const hit = failDecision(rows, ["com.capacitorjs.plugins.statusbar", "com.darktierstudios.delvedierepeat"]);
  assert.equal(hit.exitCode, 1);
  assert.ok(hit.matches.length >= 1);
  assert.ok(hit.matches.every((r) => r.callerClass === "com.capacitorjs.plugins.statusbar.StatusBar"));

  const clean = failDecision(rows, ["com.darktierstudios.delvedierepeat"]);
  assert.equal(clean.exitCode, 0);
  assert.equal(clean.matches.length, 0);

  assert.equal(failDecision(rows, []).exitCode, 0);

  const unresolved = failDecision([{ ...rows[0], callerClass: "z.q", unresolved: true }], ["com.darktierstudios"]);
  assert.equal(unresolved.exitCode, 0);
  assert.equal(unresolved.unresolved.length, 1);
});
