#!/usr/bin/env python3
"""How to pictures: turn tools/howto-shots.cjs output (844x390 at DPR 2) into images/howto-*.webp (1170x540, the size
the How to dialog and tests/e2e/howto112.cjs expect). The intro picture puts Expert upright and sideways side by side.
usage: python3 tools/howto-webp.py <shots dir> <images dir>"""
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
W, H = 1170, 540
names = ["howto-01-progressions", "howto-02-sustain", "howto-03-style", "howto-04-grid", "howto-05-make-chord", "howto-06-fullrange",
         "howto-07-keyboard", "howto-08-band", "howto-09-upload", "howto-09b-upload-form", "howto-09c-lyrics", "howto-10-kids"]
def save(im, name):
    p = os.path.join(dst, name + ".webp"); im.save(p, "WEBP", quality=80, method=6); print(name, im.size, os.path.getsize(p))
for n in names:
    save(Image.open(os.path.join(src, n + ".png")).convert("RGB").resize((W, H), Image.LANCZOS), n)
# intro: upright (scaled to the full height) + sideways (the rest of the width), on the Day background
port = Image.open(os.path.join(src, "howto-00-intro-390x844.png")).convert("RGB")
land = Image.open(os.path.join(src, "howto-00-intro-844x390.png")).convert("RGB")
g = 16
ph = H - 2 * g; pw = round(port.width * ph / port.height)
lw = W - pw - 3 * g; lh = round(land.height * lw / land.width)
c = Image.new("RGB", (W, H), (0xE8, 0xDC, 0xC8))
c.paste(port.resize((pw, ph), Image.LANCZOS), (g, g))
c.paste(land.resize((lw, lh), Image.LANCZOS), (pw + 2 * g, (H - lh) // 2))
save(c, "howto-00-intro")
