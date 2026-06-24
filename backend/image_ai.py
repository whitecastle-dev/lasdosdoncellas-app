"""Mejora estética de imagen — pipeline original Las Dos Doncellas.

Resize + realce sutil + vignette dorado + marco fino dorado.
100% Pillow, <1s, sin deps pesadas.

(Versión anterior al pipeline de 'barrica con duelas' que el usuario pidió
revertir.)
"""
import io
import logging
import math
import asyncio

from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageOps, ImageChops

logger = logging.getLogger(__name__)

TARGET_LONG_SIDE = 1400
JPEG_QUALITY = 90


def _exif_fix(img):
    try:
        return ImageOps.exif_transpose(img)
    except Exception:
        return img


def _resize_max(img, side):
    w, h = img.size
    if max(w, h) <= side:
        return img
    if w >= h:
        new_w, new_h = side, int(h * side / w)
    else:
        new_h, new_w = side, int(w * side / h)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _apply_warm_vignette(img):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    max_r = int(max(w, h) * 0.75)
    cx, cy = w // 2, h // 2
    for r in range(max_r, 0, -10):
        a = int(255 * (1 - r / max_r) * 0.55)
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max_r // 4))
    inv = ImageChops.invert(mask)
    warm_dark = Image.new("RGB", (w, h), (38, 26, 18))
    return Image.composite(warm_dark, img, inv.point(lambda v: min(v, 70)))


def _add_thin_border(img, color=(197, 160, 89), thickness=2):
    w, h = img.size
    out = img.copy()
    d = ImageDraw.Draw(out)
    for t in range(thickness):
        d.rectangle([t, t, w - 1 - t, h - 1 - t], outline=color)
    return out


def _enhance_sync(image_bytes):
    try:
        img = _exif_fix(Image.open(io.BytesIO(image_bytes))).convert("RGB")
    except Exception as e:
        logger.exception("PIL abrir: %s", e)
        return image_bytes

    img = _resize_max(img, TARGET_LONG_SIDE)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.10)
    img = ImageEnhance.Sharpness(img).enhance(1.20)
    img = ImageEnhance.Brightness(img).enhance(1.02)
    img = _apply_warm_vignette(img)
    img = _add_thin_border(img, color=(197, 160, 89), thickness=2)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


async def enhance_product_image(image_bytes):
    try:
        return await asyncio.to_thread(_enhance_sync, image_bytes)
    except Exception as e:
        logger.exception("enhance: %s", e)
        return image_bytes
