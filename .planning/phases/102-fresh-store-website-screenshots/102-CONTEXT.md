# Phase 102: Fresh Store & Website Screenshots - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The Play listing and darktierstudios.com get new screenshots of the current game: the final flavour text, the ability states, the achievements list and real tablet landscape shots. These requirements are covered:
- **SHOTS-01:** an agreed shot list captured for the phone and both tablet sizes;
- **SHOTS-02:** `store-listing/screenshots/` holds Play-size exports, and `LISTING.md` describes them;
- **SHOTS-03:** the website gets the shots as webp, alt text, and a new `featured.webp`.

**The user's steps:** the Play Console upload and the website deploy. They are non-blocking.

**Out of scope:** no game code changes. The capture harness is a tool and nothing in it ships.

</domain>

<decisions>
## Implementation Decisions

### The shot list, in this order (user-agreed)
1. Title
2. Combat, showing damage lines and ability states
3. A deep floor on the map
4. The ☰ ACHIEVEMENTS list
5. The death screen: the epitaph and the "EARNED, POSTHUMOUSLY" strip
6. The Hero tab, showing the flavour text
7. A store
8. The leaderboard, showing Play Games names

Dropped from the 2.0-era set: loot, find, and the dead/graveyard shot.

### How shots are made
- **Tool:** extend the existing headless capture tool `tools/store-screenshots/` (`capture.js`, `bot.js`, `serve.js`, playwright-core against the installed Chrome) with the new scenes: achievements list, death strip, store, board, ability states.
  - It plays real runs and renders every scene at Play's exact sizes.
  - No dev chip and no debug UI may appear in frame.
- **The achievements list shot:** the capture harness injects a plausible mid-game achievements record (some unlocked with dates, some in progress, a few secrets left).
  - It is injected only in the harness, for example through storage (`ddr.achievements.v1`) or the bridge.
  - It never ships in the app.
- **The leaderboard shot:** use the debug-only dev board seed (`src/browser/devBoardSeed.js`) for believable names and depths. Nothing is sent to the live board.
- **Orientation:** phone shots are portrait (1080×1920). Both tablet sizes are **landscape**, to show the v2.4 two-pane layout (map left, hero or Oracle right).
  - The tool's sizes today are 7" 1350×2400 and 10" 1620×2880 portrait. Landscape becomes 2400×1350 and 2880×1620.
  - These must stay within Play's screenshot rules: min and max side, aspect ratio at most 2:1, and PNG or JPEG under 8 MB. Re-verify the rules when planning.
- **After capture,** the user eyeballs each shot on the Pixel 7 to catch anything the headless browser draws differently. This is a deferred device row.

### Outputs
- `store-listing/screenshots/phone/`, `tablet-7in/`, `tablet-10in/`: replace the old set with the 8 new shots per size, named `01-title.png` … `08-board.png`.
  - The old files that no longer match the list are removed.
  - `store-listing/LISTING.md` describes the shots.
- **Website:** `C:/projects/darktier-studio/public/assets/delve-die-repeat/shots/*.webp` is replaced with the new set.
  - Update alt text in the `ddr-shots` section of `src/pages/delve-die-repeat/index.astro`.
  - `featured.webp` becomes the **combat** shot.
  - Commit in the darktier-studio repo with the attribution trailers. Do not push and do not deploy; those are the user's steps.
- **Play Console upload:** the user's step. It is listed as a non-blocking human item.

### Claude's Discretion
- How the harness reaches each new scene (state injection versus played runs). Follow the README's existing approach.
- The webp quality and size settings for the website.
- The plan split. Expect 2 plans: (1) extend the capture tool and capture the shots; (2) the store-listing files plus LISTING.md, then the website webp files, alt text and the darktier-studio commit.

### Website amendment (user, 2026-10-05, after planning; overrides plan 102-03)
- The website shows the **best 4** shots, keeping the page's layout: title, combat, the achievements list, the map (deep floor). The other new shots are not added to the site.
- **`featured.webp` stays the current title key art** with the baked-in logo. It is NOT replaced. The earlier "featured = combat" decision is reversed.

</decisions>

<code_context>
## Existing Code Insights
- `tools/store-screenshots/README.md` covers usage: `npm i playwright-core` once inside that folder, `node serve.js` to serve `www/` on :8765, and `node capture.js` / `--replay`.
  - Overlay scenes are injected through `window.__mzState.set()`.
  - The combat scene resumes one step before the encounter and plays two real rounds.
- `www/` comes from `node tools/build-www.mjs`. It must be rebuilt from the current master first, so it includes the achievement icons.
- The current shots (2.0 era) are in `store-listing/screenshots/{phone,tablet-10in}` and on the website `shots/`.
- Achievements surfaces:
  - the sheet is `#mw-achievements-sheet`, opened with `window.mzOpenAchievements()`;
  - the death strip is `.cb-over-earned`;
  - the record key is `ddr.achievements.v1`.
- The board panel lives in `src/browser/leaderboardPanel.js`. The dev seed is `src/browser/devBoardSeed.js`, debug only.

</code_context>

<specifics>
## Specific Ideas
- The combat shot doubles as the website's featured image.

</specifics>

<deferred>
## Deferred Ideas
- None.

</deferred>
