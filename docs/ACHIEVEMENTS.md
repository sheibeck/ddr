# Achievements: the catalog, the import zip, and the Play Console steps

Phase 98 of v2.5. Read this once, top to bottom, before you import anything. Part of it is a
one-way door.

## What this is

- `content/achievements.js` is the catalog: 77 achievements, each with its Play name, its Play
  description, its in-game unlock line, its points, type, steps, initial state and reveals.
- `achievements/` holds the icons (`play/` is 512 x 512 for Play, `ingame/` is for the game).
- `tools/achievements-zip.mjs` turns the catalog and the `play/` icons into one zip that Play
  Console can import. It is Node built-ins only and never talks to Play.
- The zip is written to `build/achievements/ddr-achievements.zip`. It is git-ignored: rebuild it
  whenever you need it.

The catalog is the source of truth for the in-game text. Play holds a **frozen copy** of the name and
description from the moment you import. The in-game unlock line never goes to Play, so it can be
reworded at any time.

The numbers to expect: 77 achievements, 1200 points, 57 incremental, 8 hidden (20 standard, 69
revealed from the start). That leaves 800 points of Play's 2000-point cap for a later set.

## Rebuild the zip

```
node tools/achievements-zip.mjs --build
```

1. This builds the zip from the catalog, writes it to a temp file, re-reads it from disk,
   validates it, and only then moves it to `build/achievements/ddr-achievements.zip`. A failed
   build leaves nothing behind. It prints the path, size, sha256, entry count, achievement
   count and total points.
2. A rebuild is byte-identical (same sha256) for the same catalog and icons.
3. `node tools/achievements-zip.mjs --check [zip]` validates an existing zip (the default path
   above if you name none) against Google's import rules and against the catalog. It prints
   `PASS` or one `rule: message` line per problem, and exits 0 or 1.
4. After any change to a name, description, line, points or order, regenerate the copy table:
   `node tools/achievements-zip.mjs --copy-table --out docs/ACHIEVEMENTS-COPY.md`.
   A test fails when the committed table is stale.
5. `--out <path>` changes where `--build` writes; `--root <dir>` points the tool at another tree.

The zip holds `AchievementsMetadata.csv`, `AchievementsIconsMappings.csv` and the 77 icons, flat,
under their `ach_*.png` names. Neither CSV has a header row. Rows are in the in-game list order.

## Read the copy first

Open `docs/ACHIEVEMENTS-COPY.md`. It lists all 77 achievements in list order, in seven blocks, with
the Play description, the in-game line, points, type, steps, initial state and what each one
reveals, followed by the 8 reveal pairs.

- The **Description (Play)** column freezes when you import. Read it as final.
- The **Line (in game)** column can be reworded later.
- If anything needs to change, tell Claude. The catalog is edited, the copy table regenerated and
  the zip rebuilt. Do not import until you are happy with it.

## Import into Play Console as a draft

Play Console labels move around; these were checked at developer.android.com on 2026-10-05.

1. Open Play Console and pick the game.
2. Go to Grow users > Play Games Services > Setup and management > Achievements.
3. Choose Import achievements, then Upload, and pick `build/achievements/ddr-achievements.zip`.
4. Choose Save as draft. Do not publish yet.

**Import the zip exactly once.** Play Console's behaviour when the same zip is imported twice
(duplicate drafts, or a refusal because the names clash) is not something this tool can test. If
the copy needs to change after the import, edit the draft achievements by hand in Play Console, or
delete the drafts and re-import, and do either before you publish. Do not publish a partial import.

If the import is refused, see "If the import is refused" below.

## Check the draft

Before publishing, look at the draft list in Play Console:

- It shows 77 achievements, 1200 points, 57 incremental and 8 hidden. Count them. If the count is
  off, you have a partial or doubled import: fix the drafts, do not publish.
- Every icon shows.
- The list is in the order of `docs/ACHIEVEMENTS-COPY.md`.

## Test with tester accounts

1. Go to Grow users > Play Games Services > Setup and management > Testers, then Add testers.
2. Enter the Google Account emails, separated by commas or one per line, then Add.
3. Access can take a couple of hours to apply.
4. The Release tracks tab and Add tracks cover which build tracks may use the draft. A game that
   is still unpublished needs its testers on the allowlist, otherwise they meet OAuth and 404
   errors.

## Publish

1. On the Achievements page, choose Review and publish.
2. On the Publishing page, review the list, fix any issues it reports, then Publish.
3. Publish the Play Games Services settings **before** publishing a game release.
4. Publishing is required for achievements to work for anyone outside the tester list.

## The one-way doors

Read these before you press Publish. None of them can be undone.

- **The copy is frozen.** The Play name and description are what you imported (or hand-edited in
  the draft). Reword the in-game line freely; the Play text is the Play text.
- **Type and initial state are fixed.** Once published, an achievement's type (standard or
  incremental) and its initial state (Hidden or Revealed) cannot be changed.
- **A published achievement cannot be deleted.** Only drafts can be deleted. Play also caps a game
  at 400 achievements for life, so every published one counts forever.
- **Names are the link.** Phase 101 matches catalog entries to Play IDs by name. Do not rename an
  achievement in Play Console, and do not change a catalog name after the IDs file has been
  fetched.

## Fetch the IDs file

1. On the Achievements page, choose Get resources.
2. Take the Android resources XML, save the file and hand it back.
3. Phase 101 reads it. The exact file format is confirmed in that phase's research, not here.

Phases 99 to 102 do not wait on the import. Only Phase 101's full-coverage proof needs the IDs file.

## If the import is refused

1. Run `node tools/achievements-zip.mjs --check` on the zip and read the rule ids it prints. Every
   rule is listed below.
2. The CSV bytes are the likeliest thing to differ from what the importer expects. They are two
   single constants in `tools/lib/achievements-zip.mjs`: `CSV_ROW_SEPARATOR` (LF today) and
   `CSV_TRAILING_NEWLINE` (false today). The zip itself is stored (not compressed) with a fixed
   1980-01-01 timestamp. Play accepting these exact bytes can only be proved by the import.
3. Fix the cause in the catalog or the tool, rebuild, check, and import again. If a partial draft
   was created, delete those drafts first.

## Limits at a glance

The validator (`validateZip` in `tools/lib/achievements-zip.mjs`) enforces all of these. Rules
marked house go beyond Google's list.

| Rule id | What it enforces |
|---|---|
| zip-readable | the zip parses: end record, central directory, local headers, CRCs, sizes, offsets |
| no-subdirectories | no folders, no slashes in names |
| unique-file-names | no two names equal, ignoring case |
| only-csv-png | only .csv and .png files; the only CSVs are the two import CSVs; names printable ASCII (house) |
| file-size | each file under 1 MB (read strictly as under 1000000 bytes) |
| file-count | at most 403 files |
| zip-size | the zip under 800 MB |
| required-files | both CSVs once, and at least one PNG |
| no-header-row | neither CSV starts with its column titles |
| csv-columns | 7 values per metadata row, 2 per mapping row, no blank lines, no empty file |
| incremental-spelling | `True` or `False` exactly |
| initial-state-spelling | `Hidden` or `Revealed` exactly |
| steps-rules | Steps Needed empty on a standard row; 1 to 10000 on an incremental row |
| points-rules | 5 to 200, in multiples of 5 |
| list-order-rules | positive, unique, ascending down the file (house) |
| name-rules | 1 to 100 characters, unique |
| description-rules | 1 to 500 characters (the 1 is house) |
| text-charset | printable ASCII, no double quote (house); commas are impossible because Play's CSV has no quoting |
| points-total | at most 2000 points in all |
| achievement-count | 1 to 400 achievements |
| mapping-matches-metadata | every mapping name is exactly one metadata name, and the reverse |
| icon-exists | every mapped icon file is in the zip |
| icon-unique-and-used | no icon mapped twice, no PNG left unmapped (house) |
| icon-png-512 | every PNG is exactly 512 x 512 |
| matches-catalog | the rows equal the catalog: count, order, copy, type, steps, state, points, list order, icon (house) |

Play generates the greyed locked version of each icon itself. `AchievementsLocalizations.csv` is
optional and not used: the game is English only.
