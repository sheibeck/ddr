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

## Capture, contact sheets, install, web export

Filled in by plans 102-02 and 102-03:

- **Capture** (plan 102-02): `scenes.js`, `capture.js`, `contact.js` and the
  captured, checked `out/` tree.
- **Install** (plan 102-03): copying the checked set into `store-listing/screenshots/`.
- **Web export** (plan 102-03): the webp set for the website.
