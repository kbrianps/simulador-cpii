#!/usr/bin/env python3
"""Print words with bounding boxes (PDF points, origin top-left) for one page.

For text-layer PDFs it uses `pdftotext -bbox-layout`; with --ocr it runs
tesseract (por) on a 300 dpi render and converts pixel boxes to points, so
the coordinates are directly usable with crop.py in both cases.

usage: tools/words.py <pdf> <page> [--ocr] [--grep REGEX]
Output: one line per text line: y0 y1 x0 x1 | text
"""
import argparse, re, subprocess, sys, tempfile, os, html

ap = argparse.ArgumentParser()
ap.add_argument("pdf"); ap.add_argument("page", type=int)
ap.add_argument("--ocr", action="store_true"); ap.add_argument("--grep")
a = ap.parse_args()

rows = []
if not a.ocr:
    out = subprocess.run(["pdftotext", "-bbox-layout", "-f", str(a.page), "-l", str(a.page), a.pdf, "-"],
                         capture_output=True, text=True).stdout
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', out, re.S):
        words = re.findall(r'>([^<]*)</word>', m.group(5))
        rows.append((float(m.group(2)), float(m.group(4)), float(m.group(1)), float(m.group(3)), html.unescape(" ".join(words))))
else:
    with tempfile.TemporaryDirectory() as d:
        base = os.path.join(d, "p")
        subprocess.run(["pdftoppm", "-r", "300", "-f", str(a.page), "-l", str(a.page), "-png", "-singlefile", a.pdf, base], check=True)
        tsv = subprocess.run(["tesseract", base + ".png", "-", "-l", "por", "tsv"], capture_output=True, text=True).stdout
    k = 72 / 300
    lines = {}
    for ln in tsv.splitlines()[1:]:
        p = ln.split("\t")
        if len(p) < 12 or not p[11].strip():
            continue
        key = (p[2], p[3], p[4])
        x, y, w, h = map(int, p[6:10])
        l = lines.setdefault(key, [1e9, 0, 1e9, 0, []])
        l[0] = min(l[0], y); l[1] = max(l[1], y + h); l[2] = min(l[2], x); l[3] = max(l[3], x + w); l[4].append(p[11])
    for l in lines.values():
        rows.append((l[0] * k, l[1] * k, l[2] * k, l[3] * k, " ".join(l[4])))
rows.sort()
for r in rows:
    if a.grep and not re.search(a.grep, r[4], re.I):
        continue
    print(f"{r[0]:7.1f} {r[1]:7.1f} {r[2]:7.1f} {r[3]:7.1f} | {r[4]}")
