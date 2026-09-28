# Patch notes (NOTES-01, NOTES-02)

Phase 79.3 (D-18..D-22): one Markdown file per Play release,
`docs/patch-notes/<versionName>.md`. `tools/patch-notes.mjs` validates it,
bundles it into the app (`tools/build-www.mjs#bundlePatchNotes`, which fails
the build when the current version has no file — D-19), and prints the
GitHub Release body and Play's "What's new" cut from the same file (D-22).
The in-game **PATCH NOTES** row (☰ menu) renders the current version's file
through a minimal, dependency-free Markdown subset and opens once by itself
after an update (D-20, D-21).

## File naming and category order (D-18)

The file name is the exact `versionName` from `android/version.properties`:
`docs/patch-notes/2.1.0.md` for version `2.1.0`. The first line is exactly
`# Delve, Die, Repeat <versionName>`.

After the title, categories appear as `## ` headings, in this fixed order.
An empty category is dropped entirely rather than written with no entries:

1. Headline (required — see below)
2. Classes
3. Races
4. Abilities & spells
5. Items & gear
6. Monsters & difficulty
7. Interface
8. Bug fixes

Per-class (and per-sub-class) notes go under `## Classes` as a `### ` line
per class, with its sub-classes following as their own `### ` lines:

```
## Classes
### Fighter
- Old thing → new thing.
### Knight (Fighter)
- Old thing → new thing.
```

`### ` headings are refused everywhere except inside `## Classes` — every
other category is a flat bullet list (or a short paragraph, for Headline).

## Wording: old → new

Every entry reads old → new, in plain words — what changed, stated as a
before/after, not as an implementation note:

- `- Foe attack cadence: two swings a round → one swing, unless the foe's own ability says otherwise.`
- `- The Cloak of Ether: walked through 20 squares of stone → walks through 10.`

## The Headline section is Play's "What's new"

`## Headline` is required and must be the first category. It is one short
paragraph plus the release's top bullets — the same text Play Console's
release-notes field shows players before they update. `node
tools/patch-notes.mjs --play` and `--check` print (and enforce) its plain-text
length: **500 characters or fewer**, bold markers and link syntax stripped.
Pick the bullets that matter most; the rest of the categories carry the full
detail.

## Links and HTML

A link is `[text](https://...)` — **https only**. A non-https URL (a bare
`http://`, a `javascript:` scheme, a relative path) is refused by the
renderer, which shows the label as plain text instead. Raw HTML (any `<`
character) is refused by the validator outright — keep it to headings,
bullets, paragraphs, `**bold**` and https links.

## Content rules

- **Family-friendly deadpan.** No profanity, gore or adult content — the
  darkness is in the wit, not the shock (`content/safety-wordlist.js`).
- **Roll-high phrasing.** Describe a check as succeeding on a high roll, not
  a low one (Phase 79's ROLL-04 retired every roll-under phrasing).
- **HP, never WP.** No line says "wp" or "WP".
- **U+2212 for a minus, U+2013 for a range.** "−4 hp", "18–20", never "-4" or
  "18-20".
- **British spelling.** "armour", "organised", "colour" and the rest of the
  house `-our`/`-ise` family (docs/narrative-pass/README.md's standing
  rulings).
- **No retired terms.** Because the generated module
  (`src/browser/patchNotesData.js`) lives in `src/`, `tools/stale-terms.mjs`
  scans it — avoid the retired D-pad, "toast", "classic engine" and the other
  terms in that tool's `TERMS` table.

## The release steps

1. Write `docs/patch-notes/<versionName>.md` with the user before the
   release build. Use `node tools/bump-version.mjs --name <versionName>`
   first when the human-readable version changes.
2. `node tools/patch-notes.mjs --write-module` to regenerate
   `src/browser/patchNotesData.js`, then `node tools/patch-notes.mjs --check`
   to confirm the file, the Play cut and the generated module all agree.
3. `node tools/patch-notes.mjs --play` for Play Console's release-notes
   field (at most 500 characters).
4. After the `v<versionName>` tag is pushed:
   `node tools/patch-notes.mjs --release-body | gh release create v<versionName> --repo sheibeck/ddr --title "Delve, Die, Repeat <versionName>" --notes-file -`
5. `node tools/patch-notes.mjs --site ../darktier-studio` writes this
   version's notes to the website repo
   (`C:/projects/darktier-studio`, an Astro site on Firebase Hosting,
   project `darktierstudios-b846f`), then commit it there. At release time,
   `npm run deploy` in darktier-studio publishes
   `https://darktierstudios.com/delve-die-repeat/patch-notes` — the page the
   in-game "Past versions" link opens.

See `docs/RELEASING.md` for this as a numbered step inside the full release
recipe.

## The build fails without the file (D-19)

`tools/build-www.mjs#bundlePatchNotes` reads the current versionName's notes
file and writes it into `www/src/browser/patchNotesData.js`. A missing or
malformed file throws, which fails `npm run build:www` — and therefore
`npm run play:release` — outright. There is no way to ship a Play build
without a valid notes file for that version.

## The in-game sheet (D-20, D-21)

The ☰ menu's **PATCH NOTES** row opens a sheet showing the current version's
notes, rendered from `src/browser/patchNotesData.js` through
`src/browser/patchNotes.js#renderPatchNotes` (no library — a minimal, pure
Markdown-subset parser). The sheet also carries a "Past versions" link to
the public patch-notes page on the website
(`https://darktierstudios.com/delve-die-repeat/patch-notes`,
`PATCH_NOTES_RELEASES_URL`). On the first launch after an update where the
stamped version differs from the last version the player saw, the sheet
opens once by itself; a genuinely fresh install marks the current version
seen without ever popping the sheet.
