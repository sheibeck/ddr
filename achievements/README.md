# Mazeworld achievement icons

The `play/` folder contains 49 opaque 512 × 512 icons for Play Console.
The `ingame/` folder contains 49 transparent 144 × 144 icons.
The `master/` folder contains 49 transparent 1254 × 1254 composites.
The 29 individual original illustrations are in `sources/` and the four
transparent tier overlays are in `frames/`.

`contact_sheet.png` previews every export. `manifest.json` maps each icon to
its achievement, name, tier and export paths. The optional achievement ideas
were excluded.

To rebuild the tiers or resize exports, install Pillow, NumPy and SciPy, then run:

```sh
python3 achievements/build_achievements.py
```

Tier thresholds do not appear in filenames or artwork. Tiers use the same
original illustration, with a bronze, silver, gold or violet-teal overlay and
pixel-drawn Roman numerals I–IV.
