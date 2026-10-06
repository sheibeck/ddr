# Mazeworld achievement icons

The `play/` folder contains 77 opaque 512 × 512 icons for Play Console.
The `ingame/` folder contains 77 transparent 144 × 144 icons.
The `large/` folder contains 77 transparent 320 × 320 icons, the sharp art for the list's large view of an earned icon.
The `master/` folder contains 77 transparent 1254 × 1254 composites.
The 37 individual original illustrations are in `sources/` (one of them, the
dropped Disposable Help, is used by no export) and the four
transparent tier overlays are in `frames/`.

`contact_sheet.png` previews every export. `manifest.json` maps each icon to
its achievement, name, tier and export paths. The optional achievement ideas
were excluded. `manifest.json` mirrors `content/achievements.js`, whose entries
each point at one manifest row.

To rebuild the tiers or resize exports, install Pillow, NumPy and SciPy, then run:

```sh
python3 achievements/build_achievements.py
```

To write only the `large/` exports (from `master/`, touching nothing else), run `python achievements/build_large.py`.

Tier thresholds do not appear in filenames or artwork. Tiers use the same
original illustration, with a bronze, silver, gold or violet-teal overlay and
pixel-drawn Roman numerals I–IV.
