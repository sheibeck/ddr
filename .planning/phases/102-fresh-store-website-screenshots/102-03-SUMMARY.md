---
phase: 102-fresh-store-website-screenshots
plan: 03
subsystem: tooling
tags: [screenshots, play-store, listing, website, webp]
requires: [102-02]
provides:
  - "install.js: gated, staged, idempotent install of the 24 shots into store-listing/screenshots"
  - "LISTING.md Screenshots section for the new set"
  - "webp.js: website export (four shots) and --check-site / --self-test"
  - "darktier-studio: one local commit with four new webp shots and alt text"
affects: []
tech-stack:
  added: []
  patterns:
    - "install = gate, stage beside the tracked tree, re-check, swap by rename with rollback"
key-files:
  created:
    - tools/store-screenshots/install.js
    - tools/store-screenshots/webp.js
  modified:
    - tools/store-screenshots/README.md
    - store-listing/LISTING.md
    - store-listing/screenshots (24 PNGs replaced, 12 old files removed)
key-decisions:
  - "Website scope follows the user amendment: four shots (01-title, 02-combat, 03-deep, 04-achievements) in the existing four-slot grid, featured.webp and the hero img untouched"
  - "--check-site requires the shots names to be the first four scene names in order, and checks the hero only against the unchanged featured.webp"
metrics:
  tasks: 2
  completed: 2026-10-06
status: complete
requirements-completed: [SHOTS-02, SHOTS-03]
---

# Phase 102 Plan 03: Install the shots, LISTING.md and the website Summary

The 24 reviewed shots are installed into `store-listing/screenshots/` by a gated, staged, idempotent `install.js`, `LISTING.md` describes them, and darktierstudios.com has its four best shots as webp with new alt text in one local darktier-studio commit (not pushed, not deployed).

## Commits

mazeworld (master):

| Task | Commit | What |
| --- | --- | --- |
| 1 | bfcc82ef | install.js, 24 PNGs installed (old 04-death, 05-loot, 07-find, 08-dead removed in all three folders), LISTING.md Screenshots section, README install section |
| 2 | f39dc5d5 | webp.js (export, --check-site, --self-test), README web-export section |

darktier-studio (main): `193c394` feat(delve-die-repeat): fresh screenshots of the current game on the page.

## Task 1: install

- `node install.js --dry-run`, then `node install.js` twice: "installed 24 files" both times; `git status --short store-listing` showed the same 36 entries before and after the second run (idempotent). `node play-rules.js ../../store-listing/screenshots`: ok (24 files). `find store-listing/screenshots -type f | wc -l` = 24; `git ls-files store-listing/screenshots` = 24; none of the four stale names remain.
- Failure shown on scratch folders: `--from <copy of out/ missing tablet-7in/03-deep.png> --to <copy of the old store tree>` printed `install refused: 1 reason(s) / tablet-7in/03-deep.png: missing`, exit 1, and the scratch store folder's file list with sizes was byte-identical before and after (`cmp` clean, no staging folder left behind). The same flags with a complete copy printed `installed 24 files`, exit 0.
- LISTING.md: the diff touches only the `## Screenshots` section (the hunk starts below the heading line); the "Owed (deferred ..." paragraph is gone (count 0); the section says 08-board is the v3 leaderboard shot. Descriptions were written from the manifest `textHead` values and the phone and 10-inch contact sheets. Store-listing and compliance-docs tests pass (47 pass, 0 fail with the isolation and stale-terms tests).

## Task 2: website

Per the user's amendment in 102-CONTEXT.md (overrides the plan): the page shows the best four shots only, in its existing four-slot grid (no layout or CSS change); `featured.webp` was NOT replaced and the hero `<img>` is untouched (still 1794 x 876, the title key art). `webp.js` therefore exports four shots from the phone folder, not eight, and has no combat-hero export; `--check-site` expects exactly `01-title, 02-combat, 03-deep, 04-achievements` in scene order and validates the hero only against the unchanged featured.webp (valid webp, at most 450 KB, width and height attributes equal to its header). Plan wording about eight shots, 10-inch combat hero, hero alt rewrite, and "05-death to 08-board" webp files does not apply.

Webp sizes (540 x 960 lossy, quality 0.80 for all, limit 200 KB each):

| File | Bytes |
| --- | --- |
| shots/01-title.webp | 75,914 |
| shots/02-combat.webp | 35,510 |
| shots/03-deep.webp | 14,950 |
| shots/04-achievements.webp | 35,924 |
| featured.webp (unchanged, 1794 x 876, limit 450 KB) | 326,296 |

`04-death.webp` deleted. Final alt text (the `shots` array in index.astro):

- 01-title: "The title screen: key art of adventurers at a torch-lit gate, with ENTER and VIEW THE DEAD"
- 02-combat: "Combat against two Gremlins: a hit for 3, two misses against you, and two abilities listed"
- 03-deep: "A deep floor on the map, depth 9, with explored corridors, the party and the arrow pad"
- 04-achievements: "The achievements list: 16 of 77 earned, four secrets still hiding, and the Downward Mobility tiers"

Hero alt: unchanged, "Delve, Die, Repeat — four adventurers stand before a torch-lit maze gate. Random hero. Random dungeon. Random death." The shots `<img>` gained `height="960"`; nothing else in the page changed (`git diff --stat`: 5 insertions, 5 deletions in index.astro; UTF-8, no byte-order mark, no CRLF).

Checks: `node webp.js --self-test` 18 cases, 0 failed (missing file, zero-byte, wrong dimension, non-webp, over budget, repeated alt, over-long alt, short alt, empty alt, emoji alt, 125 multibyte code points passing, stray file, out-of-order names, byte-order mark, hero width mismatch, hero alt too long, missing featured, a good site). `node webp.js --check-site C:/projects/darktier-studio` exits 0. On a scratch copy of the site with `02-combat.webp` removed it printed `FAIL 02-combat.webp: missing`, exit 1. `npm run check` in darktier-studio: 0 errors, 0 warnings, 4 hints; the one hint naming `delve-die-repeat/index.astro` (line 47, astro(4000), the existing `<script slot="head" type="application/ld+json">` without `is:inline`) is not on a line this commit touches and was there before.

`git status -sb` in darktier-studio after the commit: `## main...origin/main [ahead 2]` (the new commit plus the earlier unpushed `7d4ad75` privacy commit), working tree clean. `git show --stat HEAD`: index.astro, shots/01-title, 02-combat, 03-deep, 04-achievements (added), 04-death (deleted): 6 files, nothing else. No push, no deploy, no firebase command.

## Repo growth

The 24 new PNGs total 10,352,006 bytes (about 9.9 MiB; the 24 they replace were about 13 MB in the working tree and stay in history). Estimated growth of the mazeworld repository is about 10 MB of new blobs (PNG is already compressed). The pack is 183.93 MiB now. darktier-studio grew by about 162 KB of webp added minus 28 KB removed.

## Deviations from Plan

**1. [Rule 4 resolved by the user's amendment] Website scope cut to four shots, featured.webp kept.** Instructed by the orchestrator from 102-CONTEXT.md; see Task 2.

**2. [Rule 1 - Bug] README install section first written with unescaped backticks in a shell string.** The shell ran them as commands and mangled the text. Rewritten from a file; no commit contained the broken text.

**3. [Rule 3] Contact sheets regenerated** (`node contact.js`) because out/contact did not exist after the recapture; gitignored, used only to describe the shots.

## Known Stubs

None.

## Threat Flags

None. webp.js writes only under `public/assets/delve-die-repeat/shots/`; the darktier-studio commit lists only allowed paths.

## Human verification (deferred to end of run)

None blocks the run; each is the user's step.

- **Pixel 7 eyeball of the 24 installed shots** (`store-listing/screenshots/{phone,tablet-7in,tablet-10in}/`): compare against what the game draws on the device: glyphs (menu bars, achievements star, middle dot, board marks) as glyphs and not boxes in the Android WebView font. Also judge the centred landscape title art, the 7-inch death panel without its epitaph, and the Dev Delver name on the board (the user kept these on 2026-10-06).
- **Play Console upload:** Main store listing, Graphics: upload each folder's eight files in file order under Phone, 7-inch tablet and 10-inch tablet screenshots; confirm the preview accepts all 24.
- **Website deploy:** from `C:/projects/darktier-studio`, review the local commit `193c394` (two commits are ahead of origin), then push and run `npm run deploy` yourself; afterwards check darktierstudios.com/delve-die-repeat shows the four new shots (title, combat, deep floor, achievements) with the unchanged hero.

## Self-Check: PASSED

- Files exist: tools/store-screenshots/install.js, webp.js; 24 PNGs under store-listing/screenshots; 4 webp in darktier-studio shots/.
- Commits exist: bfcc82ef, f39dc5d5 (mazeworld), 193c394 (darktier-studio).
