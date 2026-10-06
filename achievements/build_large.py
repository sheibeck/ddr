"""Write only the 320 x 320 large-view exports (achievements/large/).

Made from achievements/master/ with the same LANCZOS resize build_achievements.py
uses for the 144 px in-game size. Unlike build_achievements.main() this touches
nothing else: master/, play/, ingame/ and manifest.json stay byte-unchanged.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SIZE = 320


def main():
    out = ROOT / "large"
    out.mkdir(parents=True, exist_ok=True)
    count = 0
    for src in sorted((ROOT / "master").glob("ach_*.png")):
        art = Image.open(src).convert("RGBA")
        art.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(out / src.name, optimize=True)
        count += 1
    print(f"Wrote {count} large icons ({SIZE} x {SIZE}) to {out}")


if __name__ == "__main__":
    main()
