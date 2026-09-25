#!/usr/bin/env python3
"""Rebuild Mazeworld achievement masters, Play uploads, thumbnails and sheet.

Requires Pillow, NumPy and SciPy. Original generated cutouts live in sources/;
tier art is reused.
Run: python3 achievements/build_achievements.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
SIZE = 1254
TIERS = {"depth": 3, "frequent_flier": 4, "survivor": 4,
         "hoarder": 4, "party_animal": 4, "human_shields": 4,
         "disposable_help": 4}
NAMES = {
    "depth": "Depth", "unicorn": "Unicorn!", "fully_dressed": "Fully Dressed",
    "naked_ambition": "Naked Ambition", "teetotaler": "Teetotaler",
    "read_the_label": "Read the Label", "frequent_flier": "Frequent Flier",
    "special_snowflake": "Special Snowflake", "kills_beasts": "Body Count: Beasts",
    "kills_demons": "Body Count: Demons", "kills_humans": "Body Count: Humans",
    "kills_lair_beasts": "Body Count: Lair Beasts",
    "kills_magical": "Body Count: Magical", "kills_walking_dead": "Body Count: Walking Dead",
    "race_human": "Human", "race_elven": "Elven", "race_dwarven": "Dwarven",
    "race_wilmsry": "Wilmsry", "race_fridgian": "Fridgian", "race_troll": "Troll",
    "class_magic_user": "Magic User", "class_fighter": "Fighter",
    "class_thief": "Thief", "tourist": "Tourist", "survivor": "Survivor",
    "hoarder": "Hoarder", "party_animal": "Party Animal",
    "human_shields": "Human Shields", "disposable_help": "Disposable Help",
}
assert len(NAMES) == 29
PALETTES = {
    1: ((103, 53, 28), (201, 118, 56), (249, 174, 91)),
    2: ((65, 80, 91), (157, 184, 193), (241, 247, 239)),
    3: ((116, 72, 22), (223, 170, 57), (255, 239, 148)),
    4: ((61, 39, 111), (115, 214, 198), (232, 151, 251)),
}
NUMERALS = {
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "V": ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
}


def pixel_numeral(draw: ImageDraw.ImageDraw, tier: int, cx: int, y: int, color):
    symbols = "I" * tier if tier <= 3 else "IV"
    width = sum(len(NUMERALS[s][0]) * 3 + 2 for s in symbols) - 2
    x = cx - width // 2
    for sym in symbols:
        for row, bits in enumerate(NUMERALS[sym]):
            for col, bit in enumerate(bits):
                if bit == "1":
                    draw.rectangle((x + col*3, y + row*3, x + col*3+2, y + row*3+2), fill=color)
        x += len(NUMERALS[sym][0]) * 3 + 2


def frame(tier: int) -> Image.Image:
    # Construct at a coarse art grid and enlarge without interpolation.
    u = 209
    im = Image.new("RGBA", (u, u))
    d = ImageDraw.Draw(im)
    dark, mid, bright = PALETTES[tier]
    cx, cy, r = 104, 91, 67
    # A double-rimmed, partly faceted ring with pixel-stepped outlines.
    d.ellipse((cx-r-5, cy-r-5, cx+r+5, cy+r+5), outline=(22, 17, 23), width=7)
    d.ellipse((cx-r-1, cy-r-1, cx+r+1, cy+r+1), outline=(*dark, 255), width=6)
    d.arc((cx-r-1, cy-r-1, cx+r+1, cy+r+1), 190, 332, fill=(*bright, 255), width=4)
    d.arc((cx-r-1, cy-r-1, cx+r+1, cy+r+1), 25, 157, fill=(*mid, 255), width=3)
    for angle in (15, 45, 135, 165, 210, 330):
        a = math.radians(angle)
        x, y = round(cx + r*math.cos(a)), round(cy + r*math.sin(a))
        d.rectangle((x-3,y-3,x+3,y+3), fill=(*bright,255), outline=(20,17,21))
    # Gem and plaque are separate so the numerals have reliable contrast.
    d.polygon([(104,137),(114,146),(104,160),(94,146)], fill=(*dark,255))
    d.polygon([(104,139),(111,146),(104,156),(97,146)], fill=(*mid,255))
    d.polygon([(104,139),(108,144),(104,147),(99,144)], fill=(*bright,255))
    d.rounded_rectangle((78,160,130,187), radius=3, fill=(25,22,29), outline=(*bright,255), width=3)
    d.rectangle((82,164,126,183), fill=(*dark,255))
    pixel_numeral(d, tier, 104, 163, (255,246,219,255))
    return im.resize((SIZE,SIZE), Image.Resampling.NEAREST)


def fitted_art(path: Path, tiered: bool) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    # Some generations contain an opaque neutral studio backdrop despite the
    # transparency request. Remove only neutral pixels reachable from edges;
    # closed dark outlines protect the character's pale details.
    if src.getpixel((0,0))[3] > 200:
        arr = np.asarray(src).copy()
        rgb = arr[:,:,:3].astype(np.int16)
        neutral = ((rgb.max(axis=2)-rgb.min(axis=2) < 36) &
                   (rgb.mean(axis=2) > 157))
        seeds = np.zeros(neutral.shape,dtype=bool)
        seeds[0,:]=neutral[0,:];seeds[-1,:]=neutral[-1,:]
        seeds[:,0]=neutral[:,0];seeds[:,-1]=neutral[:,-1]
        backdrop = ndimage.binary_propagation(seeds,mask=neutral)
        arr[backdrop,3]=0
        src = Image.fromarray(arr,"RGBA")
    bounds = src.getchannel("A").point(lambda a: 255 if a > 32 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"Empty art: {path}")
    src = src.crop(bounds)
    w,h=src.size
    # All significant art remains within the centered 85%-diameter circle.
    allowed_rad = SIZE * (0.305 if tiered else 0.405)
    scale = min((SIZE * (0.63 if tiered else 0.77))/max(w,h), allowed_rad/math.hypot(w/2,h/2))
    new_size = (max(1,round(w*scale)),max(1,round(h*scale)))
    src = src.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE,SIZE))
    canvas.alpha_composite(src, ((SIZE-new_size[0])//2,(SIZE-new_size[1])//2))
    return canvas


def parchment(size: int) -> Image.Image:
    img = Image.new("RGB", (size,size), "#2a1f17")
    pix=img.load()
    for y in range(size):
        for x in range(size):
            v = min(1, math.hypot((x-(size-1)/2)/(size/2), (y-(size-1)/2)/(size/2))/1.41)
            delta=round(7*(1-v)-6*v*v)
            pix[x,y]=(42+delta,31+delta,23+delta)
    return img


def contact_sheet(rows):
    cols=7; tile=176; label_h=38; margin=18
    nrows=math.ceil(len(rows)/cols)
    sheet=Image.new("RGB",(cols*tile+2*margin,nrows*(tile+label_h)+2*margin),(37,30,25))
    d=ImageDraw.Draw(sheet)
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",12)
    for i,entry in enumerate(rows):
        x=margin+(i%cols)*tile; y=margin+(i//cols)*(tile+label_h)
        im=Image.open(ROOT/entry["file_ingame"]).convert("RGBA")
        tile_bg=Image.new("RGB",(144,144),"#2a1f17")
        tile_bg.paste(im,mask=im.getchannel("A"))
        sheet.paste(tile_bg,(x+16,y))
        label=entry["name"] + (f"  {['','I','II','III','IV'][entry['tier']]}" if entry["tier"] else "")
        d.text((x+4,y+147),label,fill=(235,222,200),font=font)
    sheet.save(ROOT/"contact_sheet.png")


def main():
    for sub in ("sources","master","play","ingame","frames"):
        (ROOT/sub).mkdir(parents=True,exist_ok=True)
    for tier in range(1,5):
        frame(tier).save(ROOT/"frames"/f"tier_{tier}.png")
    bg=parchment(512)
    rows=[]
    for id,name in NAMES.items():
        source=ROOT/"sources"/f"ach_{id}.png"
        if not source.exists():
            raise FileNotFoundError(source)
        for tier in range(1,TIERS[id]+1) if id in TIERS else (None,):
            stem=f"ach_{id}"+(f"_t{tier}" if tier else "")
            art=fitted_art(source,tier is not None)
            if tier:
                art.alpha_composite(Image.open(ROOT/"frames"/f"tier_{tier}.png"))
            art.save(ROOT/"master"/f"{stem}.png")
            smaller=art.resize((512,512),Image.Resampling.LANCZOS)
            flat=bg.copy();flat.paste(smaller,mask=smaller.getchannel("A"))
            flat.save(ROOT/"play"/f"{stem}.png")
            art.resize((144,144),Image.Resampling.LANCZOS).save(ROOT/"ingame"/f"{stem}.png")
            rows.append({"id":id,"name":name,"tier":tier,
                         "file_play":f"play/{stem}.png",
                         "file_ingame":f"ingame/{stem}.png"})
    assert len(rows)==49
    (ROOT/"manifest.json").write_text(json.dumps(rows,indent=2)+"\n")
    contact_sheet(rows)
    print(f"Built {len(rows)} icons from {len(NAMES)} source illustrations")


if __name__=="__main__":
    main()
