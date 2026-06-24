"""Mejora estética de imagen — pipeline 'Barrica' Las Dos Doncellas.

Prompt-guía del cliente:
> "Fondo barrica o madera, maximizar la calidad de la imagen todo lo que se
>  pueda (brillo, saturacion, nitidez, etc) acorde con la web"

100% local. <1s. Pillow puro. Sin API, sin cuota, sin OOM en Render free.
"""
import io
import logging
import math
import random
import asyncio
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageOps, ImageChops

logger = logging.getLogger(__name__)

TARGET_LONG_SIDE = 1400
JPEG_QUALITY = 92
FRAME_RATIO = 0.06
GOLD = (197, 160, 89)


def _exif_fix(img):
    try: return ImageOps.exif_transpose(img)
    except Exception: return img


def _resize_max(img, side):
    w, h = img.size
    if max(w, h) <= side: return img
    if w >= h:
        new_w = side; new_h = int(h * side / w)
    else:
        new_h = side; new_w = int(w * side / h)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _build_barrel_wood(W, H):
    """Madera de barrica oscura con duelas verticales + vetas + vignette."""
    base = Image.new("RGB", (W, H), (32, 22, 14))
    px = base.load()
    rng = random.Random(0xBA12E1)
    plank_w = max(110, W // 12)
    for x in range(W):
        plank_idx = x // plank_w
        in_x = x - plank_idx * plank_w
        edge = 1 if in_x < 2 or in_x > plank_w - 3 else 0
        tone = (plank_idx * 37) % 7 - 3
        wave = int(5 * math.sin(x * 0.018) + 3 * math.sin(x * 0.07 + 1.3))
        for y in range(H):
            r, g, b = px[x, y]
            n = rng.randint(-2, 2)
            knot = 1 if rng.random() < 0.00012 else 0
            r2 = max(0, min(255, r + 18 + tone + wave + n - edge * 12 - knot * 12))
            g2 = max(0, min(255, g + 12 + tone + wave // 2 + n - edge * 10 - knot * 10))
            b2 = max(0, min(255, b + 6 + tone + wave // 3 + n - edge * 8 - knot * 8))
            px[x, y] = (r2, g2, b2)
    base = base.filter(ImageFilter.GaussianBlur(radius=0.5))
    # vignette
    vg = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vg)
    max_r = int(max(W, H) * 0.95)
    cx, cy = W // 2, H // 2
    for r in range(max_r, 0, -6):
        a = int(255 * (1 - r / max_r) * 0.55)
        vd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
    vg = vg.filter(ImageFilter.GaussianBlur(radius=max_r // 6))
    inv = ImageChops.invert(vg)
    dark = Image.new("RGB", (W, H), (12, 8, 4))
    return Image.composite(dark, base, inv.point(lambda v: min(v, 110)))


def _shadow(w, h, blur=18, off=14, alpha=140):
    s = Image.new("RGBA", (w + blur * 4, h + blur * 4 + off), (0, 0, 0, 0))
    ImageDraw.Draw(s).rectangle([blur * 2, blur * 2 + off, blur * 2 + w, blur * 2 + off + h], fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(radius=blur))


def _enhance(img):
    img = ImageEnhance.Brightness(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.22)
    img = ImageEnhance.Color(img).enhance(1.30)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.4, percent=160, threshold=2))
    return img


def _enhance_sync(image_bytes):
    try:
        img = _exif_fix(Image.open(io.BytesIO(image_bytes))).convert("RGB")
    except Exception as e:
        logger.exception("PIL abrir: %s", e); return image_bytes
    img = _resize_max(img, TARGET_LONG_SIDE)
    img = _enhance(img)
    pw, ph = img.size
    side = max(pw, ph)
    cs = max(1100, int(side * (1 + 2 * FRAME_RATIO)))
    canvas = _build_barrel_wood(cs, cs).convert("RGBA")
    px = (cs - pw) // 2
    py = (cs - ph) // 2
    canvas.alpha_composite(_shadow(pw, ph), (px - 36, py - 36))
    canvas.paste(img, (px, py))
    d = ImageDraw.Draw(canvas)
    for t in range(2):
        d.rectangle([px - 1 - t, py - 1 - t, px + pw + t, py + ph + t], outline=GOLD)
    d.rectangle([6, 6, cs - 7, cs - 7], outline=GOLD, width=3)
    out = io.BytesIO()
    canvas.convert("RGB").save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


async def enhance_product_image(image_bytes):
    try:
        return await asyncio.to_thread(_enhance_sync, image_bytes)
    except Exception as e:
        logger.exception("enhance: %s", e); return image_bytes
