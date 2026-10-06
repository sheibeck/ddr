# Store screenshot capture

Headless capture of the Play and website screenshots from the shipped `www/`
build, in the locally installed Chrome. **Nothing here ships**: the folder is
never copied into `www/`, and the harness data (the injected achievements
record, the dev board seed, `seeds.json`) lives only in the capture browser.

Phase 102 replaced the old bot-driven scene hunt. Saves and overlay states are
now built offline from the game's own engine (`seed.mjs`), and real clicks are
kept only where the shell itself must write the fight log. `bot.js`, the old
`capture.js` and `serve.js` stay as they are until plan 102-02 replaces the
capture driver.

## Prerequisites

- Node 22 and Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`;
  set `CHROME_PATH` to point somewhere else).
- `npm install` inside this folder, once. It installs `playwright-core`
  (pinned exactly in `package.json`) and uses the installed Chrome, no browser
  download. This replaces the old `npm init -y && npm i playwright-core` step.
- `www/` built from the current master: `node tools/build-www.mjs`.

## Sizes and Play's rules

`config.js` is the only place that names the sizes and the scenes.

| Folder | CSS size | Scale | Export | Orientation | Layout class |
| --- | --- | --- | --- | --- | --- |
| `phone/` | 432 x 768 | 2.5 | 1080 x 1920 | portrait | compact |
| `tablet-7in/` | 960 x 540 | 2.5 | 2400 x 1350 | landscape | expanded |
| `tablet-10in/` | 1280 x 720 | 2.25 | 2880 x 1620 | landscape | expanded |

The tablets are landscape so the two-pane layout (map left, hero or Oracle
right) shows. Both are at least 840 x 480 CSS px, which is what the game's
layout classes need for the expanded layout.

Play's rules, re-read on 2026-10-05 from
<https://support.google.com/googleplay/android-developer/answer/9866151> and
kept as constants in `play-rules.js`:

- JPEG or 24-bit PNG, no alpha.
- Each side 320 to 3840 px; the longest side at most twice the shortest.
- Tablet screenshots 1080 px or more per side, 16:9 landscape or 9:16 portrait.
- Up to 8 per device type; at least 4 per tablet size to be eligible for the
  large-screen recommendation formats.
- The page names no file-size limit for these shots. The 8 MB ceiling is the
  phase's own conservative cap.

Every export size sits strictly inside those limits (none is on an edge), and
`seed.mjs` asserts it on every run.

## The eight scenes

One ordered list, the same eight files in each size folder.

| File | Scene | How it is reached |
| --- | --- | --- |
| `01-title.png` | Title | the record is seeded, the page boots to the title |
| `02-combat.png` | Combat: damage lines and ability states | resume a save one step before the fight, then real clicks: the move, FIGHT, one ability, one strike |
| `03-deep.png` | A deep floor on the map | resume a save |
| `04-achievements.png` | The Achievements list | resume a save, open the sheet with the page's own `mzOpenAchievements()` |
| `05-death.png` | Death: epitaph and the Earned strip | inject the dead state (an overlay), strip ids from the real tracker |
| `06-hero.png` | The Hero tab and its flavour text | resume a save, open the tab |
| `07-store.png` | A store | inject the store state (an overlay) |
| `08-board.png` | The leaderboard | resume a save, open the board on the shell's own browser-dev fake |

A resumed save nulls combat, store and find by design, and `__mzState.set()`
replaces only the shell's copy of the state. So scenes that need real clicks
are resumed from a save, and overlay scenes are injected and photographed.

## What is injected, and why none of it ships

- **The achievements record** is written to the capture browser's storage only.
  `seed.mjs` builds it from `emptyRecord()` and the game's own writer, so the
  stored text is what the game itself would write. The storage key is imported
  from the game and handed over inside `seeds.json`; no file under `tools/`
  spells it.
- **The board names** come from the game's own dev board seed, through the
  in-memory fake the shell already uses on a non-native platform. Nothing is
  sent to the live board, and no real player's name can appear.
- **`seeds.json`** (and `scenes.json`, `out/`, `node_modules/`) is gitignored.
- No shipped code changes: the diff over `engine/`, `content/`, `src/`,
  `mazeworld.html` and `android/` stays empty.

`seed.mjs` is the only file that imports repo code. The CommonJS files run it
as a child process and read `seeds.json` as data, which is what keeps
`test/unit/achievements-bot-isolation.test.js` happy (the one declared entry for
`seed.mjs` is a read-only record and tracker view; the engine adapter stays
forbidden).

## The seed table

`node seed.mjs` searches hero seeds 7 to 60, forced Fighter class, and keeps
the first one for which every check passes. The search is deterministic.

| Scene | Seed and hero | Why |
| --- | --- | --- |
| all | seed 29, Tamsin of Ash Alley, a Wilmsry Guard (found by the search; seeds 7 to 28 failed a check: no two-foe fight reachable, a single ability, or too small a walk) | one hero keeps the story straight |
| combat | level 1 on floor 1, two foes, 20 steps from the start, direction E | the nearest step that starts a fight with two or more foes; the replay shows the hero alive and the fight still running after the move, FIGHT, Pommel Strike and a strike |
| deep | the same hero levelled to floor 9, a walked region of about 75 open cells seen | a believable explored map |
| achievements, hero, board | the deep save | a living hero |
| store | the deep hero with the store opened (16 lines) and gold that buys some lines and not others | affordable and unaffordable rows |
| death | the same hero levelled to floor 10, taken through `die()` with a Drake | the strip ids (Downward Mobility II, Wilmsry Loves Company, Fighting Chance) come from the real tracker over that death |

## Guards

`frame-guard.js` decides mechanically what is in frame:

- Text counts only when its box intersects the viewport after every scrolling
  or clipping ancestor, and nothing above it hides it. Comparison is NFC
  normalised with whitespace collapsed; every expected string comes from
  `seeds.json`, computed from the game's own copy modules.
- No element whose id starts `mw-dev-` is visible, the live state is not a dev
  run, the dev-run log line is absent, and no unexpected sheet or rail card is up.
- Every visible image is decoded.
- Every request that leaves the origin is aborted and recorded, and fails the
  scene unless the scene lists it with a reason. Page errors and failed
  same-origin requests fail it too.

`node frame-guard.js --self-test` and `node play-rules.js --self-test` prove
the guards and the rules have teeth on small synthetic pages and images.

## Commands

```
cd tools/store-screenshots
npm install                              # one-time
node seed.mjs --check                    # every consistency check, PASS or FAIL per line
node seed.mjs                            # the same checks, then writes seeds.json
node play-rules.js --self-test           # the Play rules on synthetic images
node frame-guard.js --self-test          # the frame guards on small pages in Chrome
node play-rules.js out                   # check a finished tree (add --partial for a part-built one)
```

Run one run at a time: the capture serves `www/` on port 8765, and a second run
would collide with it.

## Capture and contact sheets

```
node capture.js                       # everything, from clean: build www/, seed, serve, render, check
node capture.js --sizes phone,tab7    # only these sizes (phone, tab7, tab10)
node capture.js --only combat,deep    # only these scenes
node capture.js --no-build            # skip the www/ rebuild (iteration only; the final run is a full one)
node contact.js                       # out/contact/phone.png, tab7.png, tab10.png (add --size phone|tab7|tab10)
node play-rules.js out                # the Play rules over the whole tree
```

A full run, in this order: `node tools/build-www.mjs`, then `seed.mjs` as a child
process (it rewrites `seeds.json`), then it serves `www/` itself on
`127.0.0.1:8765`, deletes the three size folders, `out/contact` and
`out/manifest.json`, renders the eight scenes at the three sizes into
`out/phone`, `out/tablet-7in` and `out/tablet-10in` as `NN-name.png`, writes
`out/manifest.json`, runs the tree check and exits non-zero on any failed shot,
missing file or rule violation. A partial run (`--sizes` or `--only`) touches
only the files it renders and merges into the manifest.

**One run at a time.** The capture owns port 8765 and the one `out/` tree. A
second run finds the port taken and exits with a message (exit 2) instead of
sharing or overwriting. Parallel capture is unsupported by design.

**Reading a failed run.** Every shot prints `ok` or `FAIL` and its reasons. The
same facts are in `out/manifest.json`: per shot `{ size, scene, file, ok,
failures, checks, layout, textHead }`, and at the top `generatedAt`,
`versionName`, `versionCode`, the `blocked` request list (it must be empty) and
the `rules` result. A scene whose recipe throws is a failed entry with the
message and is still photographed so you can look at it; nothing is skipped
silently. `node contact.js` draws a red border and the failure text around any
shot whose entry failed.

**Time.** Measured on this machine (cold boots included): about 40 to 45 seconds
per size, so a full run is about two and a half minutes. Each shot boots a fresh
browser context, which is the slow part; the page boot itself is allowed up to
five minutes.

**What the capture does not do.** It applies nothing to a PNG after Chrome writes
it: no overlay, no text, no edit. The shots are the shipped web build drawn by
its own renderer. Headless Chrome may draw a font or a glyph differently from
the Android WebView, which is why the user eyeballs all 24 shots on the Pixel 7.

## Install into the store listing

`node install.js` copies the checked set from `out/` into `store-listing/screenshots/`:

1. any leftover staging folder (`store-listing/.screenshots-staging`) is deleted;
2. the gate: `out/manifest.json` must hold 24 shots, all ok, with the rules result
   ok, and the full Play-rules tree check must pass on `out/`; every reason is
   printed and the exit is 1 on any failure, with nothing touched;
3. the eight scene files of each size are copied into the staging folder, which
   is checked again;
4. each live folder is moved aside, the staged one renamed into place, and the
   old folders deleted only when all three swaps worked (a failed swap puts them
   back);
5. the installed tree is checked once more and `installed 24 files` is printed.

Running it twice leaves exactly the same 24 files and nothing else. `--dry-run`
stops after step 3 and removes the staging folder. `--from <dir>` and `--to <dir>`
point it at scratch folders, to show the gate and the staging without touching
the tracked tree.

## Web export

Filled in with the web-export task.
