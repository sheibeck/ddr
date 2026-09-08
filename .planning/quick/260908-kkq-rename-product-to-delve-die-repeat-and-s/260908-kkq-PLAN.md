---
quick_id: 260908-kkq
slug: rename-product-to-delve-die-repeat-and-s
status: partial
date: 2026-09-08
---

# Quick Task 260908-kkq: Rename Mazeworld → "Delve, Die, Repeat"

Rename the product and scrub player-visible "Maze" copy ahead of first
Google Play publish. A "Maze World" puzzle game already exists on the store;
the 1994 copyright covers *content*, not the *name*. **Greenfield — nothing
is live/shipped**, so no migration/save-orphan risk on any rename.

Final names (user-decided):
- Title / launcher / appName: **Delve, Die, Repeat**
- appId (permanent after publish): **com.darktierstudios.delvedierepeat**
- Splash sub-title: **Random hero. Random dungeon. Random death.** (lowercase)
- Play short description: **A Dungeon Crawler with a Body Count (Yours).**
- In-fiction lore retained: Wilmsry, wilmst, the Gate.

## DONE (committed f81942f)

App identity + visible UI chrome:
- capacitor.config.json (appId, appName); android build.gradle (namespace,
  applicationId); strings.xml (4 strings); MainActivity.java moved to
  com/darktierstudios/delvedierepeat/; package.json (name, description).
- mazeworld.html chrome: <title>, <h1>, meta/og tags, "Maze Master's notes"
  → "Dungeon Master's notes", tutorial "No Maze Master" → "No Dungeon
  Master", canvas aria-label "Maze map" → "Dungeon map".
- `npm run build:www` verified: built www/index.html shows "Delve, Die,
  Repeat" in title/h1/meta; no visible "Mazeworld" in chrome.

## REMAINING (unblocked by greenfield; gated on a GREEN test suite)

Pre-req: **test suite is currently RED** (`npm run test:quick` fails with a
pre-existing MODULE_NOT_FOUND, unrelated to this rename). Fix that first so
the renames below can be verified — several are asserted by tests.

1. **Flavor/epitaph data strings** — "the maze" → "the dungeon", "Maze
   Master" → "Dungeon Master" in string *values* (NOT the `maze:`
   cause-of-death key, NOT code identifiers). Canonical location per the
   "prototype is not the app" principle: **content/*.js** (epitaphs.js,
   flavor.js, races.js) + engine/death.js. The mazeworld.html inline
   duplicate tables are prototype-legacy — scrub only if the prototype is
   still the shipped build at that time.
2. **Persistence keys** mazeworld.{delve,best,graveyard}.v1 → ddr.*.v1
   across src/browser/{storage.js,engineAdapter.js} + update the ~8
   test/persistence/*.js + test/unit/engineAdapter.test.js assertions.
   Greenfield ⇒ drop/simplify the legacy-key migration (no legacy in the
   wild). Do NOT edit the frozen test/parity/prototype-master.js.txt.
3. **Visible source-credit line** (mazeworld.html): "Built from the
   Mazeworld rulebook — …/mazeworld.pdf" — USER DECISION pending (it's
   attribution to the real 1994 work + a live URL, not app identity).
4. **App icon + splash** — new art in assets/ (ddr_icon.png,
   ddr_splah.png [sic — typo, missing 's']). Generate into
   android/app/src/main/res/mipmap-*/ic_launcher* and drawable-*/splash*
   (needs @capacitor/assets — not installed — or Android Studio). Then
   delete the OLD source art in assets/ (mazeworld-google-play-icon-512.png,
   mazeworld-splash-android.zip, mobile_splash.png). Do NOT delete the
   android res files (required; replace, don't remove). icons/ = in-game
   tile art, untouched.

## Not to be renamed (internal, invisible)
- Code identifiers: maze.js module, id="maze", .col-maze/.mazebox CSS, the
  `maze:` epitaph cause key, `maze` variables. Pure churn/risk, no benefit.

## Follow-on (roadmap, not this task)
- Per user: stop shipping the prototype; build the real UI from the modular
  engine/content/src architecture. Doing that first makes renames 1–2 land
  once, in the real sources, instead of twice across the hybrid.
- git remote: user created https://github.com/sheibeck/ddr — add remote +
  first push (needs explicit go-ahead).
