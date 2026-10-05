// Phase 97 (SCREEN-03/04): the screen size classes, boundaries pinned one step
// either side, plus agreement between the pure function and the media strings.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  LAYOUT_BREAKPOINTS,
  LAYOUT_MEDIA,
  LAYOUT_SIDE_WIDTH,
  LAYOUT_READABLE_MAX_PX,
  layoutClassFor,
  currentLayoutClass,
  railBesideMap,
  mapStaysUp,
} from "../../src/browser/layoutClass.js";

test("layoutClassFor: named devices", () => {
  const cases = [
    [412, 915, "compact"],
    [915, 412, "short"],
    [800, 360, "short"],
    [600, 960, "medium"],
    [960, 600, "expanded"],
    [800, 1280, "medium"],
    [1280, 800, "expanded"],
    [411, 797, "compact"],
    [841, 701, "expanded"],
    [701, 841, "medium"],
    [1366, 768, "expanded"],
  ];
  for (const [w, h, want] of cases) assert.equal(layoutClassFor(w, h), want, `${w}x${h}`);
});

test("layoutClassFor: every boundary, one step either side", () => {
  const cases = [
    [915, 479, "short"],
    [915, 480, "expanded"],
    [900, 479.98, "short"],
    [900, 479.99, "expanded"],
    [599, 900, "compact"],
    [600, 900, "medium"],
    [599.98, 900, "compact"],
    [599.99, 900, "medium"],
    [839, 900, "medium"],
    [840, 900, "expanded"],
    [840, 479, "short"],
  ];
  for (const [w, h, want] of cases) assert.equal(layoutClassFor(w, h), want, `${w}x${h}`);
});

test("layoutClassFor: a bad size reads compact", () => {
  assert.equal(layoutClassFor(NaN, 900), "compact");
  assert.equal(layoutClassFor(undefined, undefined), "compact");
  assert.equal(layoutClassFor(0, 0), "compact");
  assert.equal(layoutClassFor(-1, 500), "compact");
  assert.equal(layoutClassFor(900, NaN), "compact");
  assert.equal(layoutClassFor("900", "900"), "compact");
});

test("currentLayoutClass: short before expanded before medium, else compact", () => {
  assert.equal(currentLayoutClass((q) => ({ matches: q === LAYOUT_MEDIA.short })), "short");
  assert.equal(
    currentLayoutClass((q) => ({ matches: q === LAYOUT_MEDIA.short || q === LAYOUT_MEDIA.expanded })),
    "short",
  );
  assert.equal(currentLayoutClass((q) => ({ matches: q === LAYOUT_MEDIA.expanded })), "expanded");
  assert.equal(currentLayoutClass((q) => ({ matches: q === LAYOUT_MEDIA.medium })), "medium");
  assert.equal(currentLayoutClass(() => ({ matches: false })), "compact");
  assert.equal(currentLayoutClass(undefined), "compact");
  assert.equal(
    currentLayoutClass(() => {
      throw new Error("no matchMedia here");
    }),
    "compact",
  );
});

// A tiny evaluator for the media strings: ", " is OR, " and " is AND, each
// clause "(min|max)-(width|height): Npx".
function matchesMedia(query, w, h) {
  return query.split(", ").some((alt) =>
    alt.split(" and ").every((clause) => {
      const m = /^\((min|max)-(width|height): ([0-9.]+)px\)$/.exec(clause);
      assert.ok(m, `unparseable clause ${clause}`);
      const v = m[2] === "width" ? w : h;
      const n = Number(m[3]);
      return m[1] === "min" ? v >= n : v <= n;
    }),
  );
}

test("layoutClassFor agrees with the LAYOUT_MEDIA strings on a grid and at the boundaries", () => {
  const matcher = (w, h) => (q) => ({ matches: matchesMedia(q, w, h) });
  // The 0.02 px slivers under each whole-number threshold are the one place a
  // "min-*: N" query cannot match; no real screen reports them (see the header).
  const inSliver = (w, h) =>
    (h > 479.98 && h < 480) || (w > 599.98 && w < 600) || (w > 839.98 && w < 840);
  const sizes = [];
  for (let w = 320; w <= 1400; w += 7) for (let h = 300; h <= 1300; h += 7) sizes.push([w, h]);
  for (const w of [599, 599.98, 600, 839, 839.98, 840, 915, 900]) {
    for (const h of [479, 479.98, 480, 900]) sizes.push([w, h]);
  }
  for (const w of [599, 600, 839, 840]) for (const h of [479, 479.98, 480, 700]) sizes.push([w, h]);
  let checked = 0;
  for (const [w, h] of sizes) {
    if (inSliver(w, h)) continue;
    assert.equal(currentLayoutClass(matcher(w, h)), layoutClassFor(w, h), `${w}x${h}`);
    checked += 1;
  }
  assert.ok(checked > 10000);
});

test("LAYOUT_MEDIA.side is exactly short OR expanded", () => {
  for (const [w, h] of [[412, 915], [915, 412], [700, 900], [960, 600], [1280, 800], [800, 360]]) {
    const cls = layoutClassFor(w, h);
    assert.equal(matchesMedia(LAYOUT_MEDIA.side, w, h), cls === "short" || cls === "expanded", `${w}x${h}`);
  }
});

test("railBesideMap and mapStaysUp", () => {
  assert.equal(railBesideMap("short"), true);
  assert.equal(railBesideMap("expanded"), true);
  assert.equal(railBesideMap("compact"), false);
  assert.equal(railBesideMap("medium"), false);
  assert.equal(railBesideMap(undefined), false);
  assert.equal(mapStaysUp("expanded"), true);
  for (const c of ["short", "compact", "medium", undefined, "bogus"]) assert.equal(mapStaysUp(c), false);
});

test("constants are frozen and exact", () => {
  assert.ok(Object.isFrozen(LAYOUT_BREAKPOINTS));
  assert.ok(Object.isFrozen(LAYOUT_MEDIA));
  assert.ok(Object.isFrozen(LAYOUT_SIDE_WIDTH));
  assert.equal(LAYOUT_MEDIA.short, "(max-height: 479.98px)");
  assert.equal(LAYOUT_MEDIA.compact, "(max-width: 599.98px) and (min-height: 480px)");
  assert.equal(LAYOUT_MEDIA.medium, "(min-width: 600px) and (max-width: 839.98px) and (min-height: 480px)");
  assert.equal(LAYOUT_MEDIA.expanded, "(min-width: 840px) and (min-height: 480px)");
  assert.equal(LAYOUT_MEDIA.side, "(max-height: 479.98px), (min-width: 840px) and (min-height: 480px)");
  assert.equal(LAYOUT_SIDE_WIDTH.short, "45%");
  assert.equal(LAYOUT_SIDE_WIDTH.expanded, "clamp(360px, 40%, 560px)");
  assert.equal(LAYOUT_READABLE_MAX_PX, 640);
});

test("layoutClass.js has no import and no document/window/storage reference", () => {
  const src = fs.readFileSync(new URL("../../src/browser/layoutClass.js", import.meta.url), "utf8");
  assert.equal(/^\s*import\b/m.test(src), false);
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/\bwindow\b/.test(src), false);
  assert.equal(/localStorage|sessionStorage/.test(src), false);
});
