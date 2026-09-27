#!/usr/bin/env python3
"""Crop a region of a PDF page into an optimized image for the app.

Coordinates are PDF points with origin at the top-left (same as words.py).
The crop is rendered at --dpi (default 200), white margins are trimmed, and
the result is saved as PNG (palette-quantized when it has few colors, good
for line art) or JPEG/WebP when --photo is given.

usage: tools/crop.py <pdf> <page> <x0> <y0> <x1> <y1> <out.png|out.jpg> [--dpi 200] [--photo] [--no-trim] [--pad 6]
Tip: view the result with the Read tool and adjust the box until it is exact.
"""
import argparse, subprocess, tempfile, os
from PIL import Image, ImageChops

ap = argparse.ArgumentParser()
ap.add_argument("pdf"); ap.add_argument("page", type=int)
for c in ("x0", "y0", "x1", "y1"):
    ap.add_argument(c, type=float)
ap.add_argument("out"); ap.add_argument("--dpi", type=int, default=200)
ap.add_argument("--photo", action="store_true"); ap.add_argument("--no-trim", action="store_true")
ap.add_argument("--pad", type=int, default=6)
a = ap.parse_args()

with tempfile.TemporaryDirectory() as d:
    base = os.path.join(d, "p")
    subprocess.run(["pdftoppm", "-r", str(a.dpi), "-f", str(a.page), "-l", str(a.page), "-png", "-singlefile", a.pdf, base], check=True)
    img = Image.open(base + ".png").convert("RGB")
k = a.dpi / 72
box = (int(a.x0 * k), int(a.y0 * k), int(a.x1 * k), int(a.y1 * k))
img = img.crop(box)
if not a.no_trim:
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 24 else 0)
    bb = diff.getbbox()
    if bb:
        p = a.pad
        img = img.crop((max(bb[0] - p, 0), max(bb[1] - p, 0), min(bb[2] + p, img.width), min(bb[3] + p, img.height)))
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
if a.photo or a.out.lower().endswith((".jpg", ".jpeg")):
    out = os.path.splitext(a.out)[0] + ".jpg"
    img.save(out, "JPEG", quality=82, optimize=True, progressive=True)
else:
    out = a.out
    colors = img.getcolors(maxcolors=256)
    q = img.quantize(colors=64 if colors is None else max(len(colors), 2), method=Image.Quantize.MEDIANCUT)
    q.save(out, "PNG", optimize=True)
print(out, img.size, os.path.getsize(out), "bytes")
