"""Generate the PRIVATUM Open Graph card (1200x630) from brand assets.

Usage:  python scripts/make_og.py    (requires Pillow)
Output: public/assets/og-image.jpg, referenced by src/lib/site.ts
"""
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAD = 76
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/")
F = ROOT + "/public/fonts/s_intertight_v9_NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mj"
FONT_600 = F + "0QiaWy5X.ttf"
FONT_500 = F + "PQ-aWy5X.ttf"
FONT_400 = F + "Dw-aWy5X.ttf"

# --- background: cover-crop the brand gradient to 1200x630 -------------------
bg = Image.open(ROOT + "/public/assets/privatum-gradient-clean.png").convert("RGB")
scale = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS)
left = (bg.width - W) // 2
top = (bg.height - H) // 2
card = bg.crop((left, top, left + W, top + H))

# --- scrim: darken left/bottom so white type stays legible -------------------
scrim = Image.new("L", (W, H), 0)
sd = ImageDraw.Draw(scrim)
for x in range(W):
    # strongest at the left edge, fading out by ~72% across
    a = max(0, int(150 * (1 - x / (W * 0.72))))
    sd.line([(x, 0), (x, H)], fill=a)
card = Image.composite(Image.new("RGB", (W, H), (8, 10, 15)), card, scrim)

bottom = Image.new("L", (W, H), 0)
bd = ImageDraw.Draw(bottom)
for y in range(H):
    a = max(0, int(90 * ((y - H * 0.55) / (H * 0.45)))) if y > H * 0.55 else 0
    bd.line([(0, y), (W, y)], fill=a)
card = Image.composite(Image.new("RGB", (W, H), (8, 10, 15)), card, bottom)

d = ImageDraw.Draw(card)

# --- logo mark + wordmark ----------------------------------------------------
mark = Image.open(ROOT + "/public/assets/privatum-mark-white.png").convert("RGBA")
mh = 54
mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
card.paste(mark, (PAD, PAD), mark)

f_word = ImageFont.truetype(FONT_600, 31)
wx = PAD + mark.width + 18
wy = PAD + (mh - 31) // 2 - 2
for i, ch in enumerate("PRIVATUM"):          # manual tracking
    d.text((wx, wy), ch, font=f_word, fill=(255, 255, 255))
    wx += d.textlength(ch, font=f_word) + 2.4

# --- "Coming soon" eyebrow pill ---------------------------------------------
f_pill = ImageFont.truetype(FONT_500, 22)
label = "Coming soon"
tw = d.textlength(label, font=f_pill)
px, py = PAD, 236
pw, ph = tw + 44, 44
# translucent fill needs an RGBA layer — drawing alpha straight onto an RGB
# canvas silently renders it opaque
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
od.rounded_rectangle([px, py, px + pw, py + ph], radius=ph // 2,
                     fill=(255, 255, 255, 40), outline=(255, 255, 255, 235), width=2)
card = Image.alpha_composite(card.convert("RGBA"), overlay).convert("RGB")
d = ImageDraw.Draw(card)
d.text((px + 22, py + ph / 2), label, font=f_pill, fill=(255, 255, 255), anchor="lm")

# --- headline ----------------------------------------------------------------
f_head = ImageFont.truetype(FONT_600, 82)
y = py + ph + 34
for line in ("Private payments.", "Non-custodial."):
    d.text((PAD, y), line, font=f_head, fill=(255, 255, 255))
    y += 92

# --- footer line -------------------------------------------------------------
f_sub = ImageFont.truetype(FONT_400, 29)
d.text((PAD, H - PAD - 30), "On Robinhood Chain", font=f_sub, fill=(255, 255, 255))

# JPEG: the grainy gradient makes PNG ~735 KB vs ~115 KB here, and several
# crawlers skip images over a few hundred KB.
out = ROOT + "/public/assets/og-image.jpg"
card.save(out, "JPEG", quality=92, optimize=True, progressive=True)
print("wrote", out, card.size)
