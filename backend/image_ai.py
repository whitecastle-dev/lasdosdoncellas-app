"""Estilo "estudio Las Dos Doncellas" para imágenes de producto.

Pipeline 100 % gratuito (Pillow, sin servicios externos):
  1. Recorte del producto:
     - Si la imagen llega con canal alfa (el CMS quita el fondo en el navegador
       con @imgly/background-removal), se usa tal cual.
     - Si no, se intenta un recorte heurístico: fondo casi uniforme (blanco/gris
       de fotos de catálogo) → flood-fill desde los bordes con tolerancia.
     - Si el fondo no es uniforme, se aplica solo el acabado (viñeta cálida).
  2. Composición en lienzo 4:5 oscuro con foco cálido detrás del producto,
     sombra proyectada y sombra de apoyo (mismo look que las tarjetas de
     categoría de la home).
"""
import io
import logging
import asyncio

from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageOps, ImageChops

logger = logging.getLogger(__name__)

CANVAS_W, CANVAS_H = 1200, 1500          # 4:5, igual que las tarjetas
BASE_BG = (15, 14, 13)
GLOW = (138, 98, 54)
PRODUCT_FILL = 0.80                      # el producto ocupa ≤80 % del lienzo
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
        return img.resize((side, int(h * side / w)), Image.LANCZOS)
    return img.resize((int(w * side / h), side), Image.LANCZOS)


# ---------- 1. Recorte ----------

def _has_real_alpha(img):
    if img.mode not in ("RGBA", "LA") and not (img.mode == "P" and "transparency" in img.info):
        return False
    a = img.convert("RGBA").getchannel("A")
    lo, hi = a.getextrema()
    return lo < 10 and hi > 200


def _heuristic_cutout(rgb):
    """Flood-fill desde los 4 bordes si el fondo es casi uniforme. Devuelve
    RGBA o None si el fondo no parece uniforme."""
    small = _resize_max(rgb, 900)
    w, h = small.size
    px = small.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    mean = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    spread = max(max(abs(c[i] - mean[i]) for i in range(3)) for c in corners)
    if spread > 40:
        return None

    mask = Image.new("L", (w, h), 255)          # 255 = producto, 0 = fondo
    work = small.copy()
    tol = 38
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    marker = (255, 0, 255)
    for s in seeds:
        c = px[s]
        if max(abs(c[i] - mean[i]) for i in range(3)) <= tol:
            ImageDraw.floodfill(work, s, marker, thresh=tol)
    wp = work.load()
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] == marker:
                mp[x, y] = 0
    covered = sum(1 for v in mask.getdata() if v == 0) / float(w * h)
    if covered < 0.12 or covered > 0.97:
        return None
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    mask = mask.resize(rgb.size, Image.LANCZOS)
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def _trim_alpha(rgba):
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return rgba.crop(bbox) if bbox else rgba


# ---------- 2. Composición ----------

def _studio_background():
    bg = Image.new("RGB", (CANVAS_W, CANVAS_H), BASE_BG)
    glow = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    d = ImageDraw.Draw(glow)
    cx, cy = CANVAS_W // 2, int(CANVAS_H * 0.46)
    rx, ry = int(CANVAS_W * 0.62), int(CANVAS_H * 0.42)
    steps = 40
    for i in range(steps, 0, -1):
        f = i / steps
        a = int(255 * (1 - f) ** 1.6)
        d.ellipse([cx - rx * f, cy - ry * f, cx + rx * f, cy + ry * f], fill=a)
    glow = glow.filter(ImageFilter.GaussianBlur(90)).point(lambda v: min(255, int(v * 1.05)))
    warm = Image.new("RGB", (CANVAS_W, CANVAS_H), GLOW)
    bg = Image.composite(warm, bg, glow)
    # Suelo: franja inferior ligeramente más oscura
    floor = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    ImageDraw.Draw(floor).rectangle([0, int(CANVAS_H * 0.78), CANVAS_W, CANVAS_H], fill=120)
    floor = floor.filter(ImageFilter.GaussianBlur(70))
    return Image.composite(Image.new("RGB", (CANVAS_W, CANVAS_H), (9, 8, 8)), bg, floor)


def _compose(cutout):
    cutout = _trim_alpha(cutout)
    max_w, max_h = int(CANVAS_W * PRODUCT_FILL), int(CANVAS_H * PRODUCT_FILL)
    cw, ch = cutout.size
    scale = min(max_w / cw, max_h / ch)
    cutout = cutout.resize((max(1, int(cw * scale)), max(1, int(ch * scale))), Image.LANCZOS)
    cw, ch = cutout.size

    rgb = cutout.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.06)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.15)
    cutout = Image.merge("RGBA", (*rgb.split(), cutout.getchannel("A")))

    canvas = _studio_background().convert("RGBA")
    x = (CANVAS_W - cw) // 2
    y = int(CANVAS_H * 0.50 - ch / 2)

    # Sombra de apoyo (elipse bajo el producto)
    ground = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    gw, gh = int(cw * 0.55), int(max(ch * 0.07, 30))
    gcx, gcy = CANVAS_W // 2, y + ch - int(gh * 0.3)
    ImageDraw.Draw(ground).ellipse([gcx - gw, gcy - gh, gcx + gw, gcy + gh], fill=190)
    ground = ground.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.composite(Image.new("RGBA", canvas.size, (0, 0, 0, 255)), canvas, ground)

    # Sombra proyectada (silueta desplazada y difuminada)
    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    sil = Image.new("RGBA", cutout.size, (0, 0, 0, 170))
    sil.putalpha(ImageChops.multiply(cutout.getchannel("A"), Image.new("L", cutout.size, 170)))
    shadow.paste(sil, (x + int(cw * 0.03), y + int(ch * 0.05)), sil)
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas = Image.alpha_composite(canvas, shadow)

    canvas.alpha_composite(cutout, (x, y))
    return canvas.convert("RGB")


def _fallback_finish(rgb):
    """Sin recorte posible: acabado cálido sobre la foto original."""
    img = _resize_max(rgb, 1400)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.10)
    img = ImageEnhance.Sharpness(img).enhance(1.20)
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    max_r = int(max(w, h) * 0.75)
    cx, cy = w // 2, h // 2
    for r in range(max_r, 0, -10):
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * (1 - r / max_r) * 0.55))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max_r // 4))
    inv = ImageChops.invert(mask)
    warm_dark = Image.new("RGB", (w, h), (38, 26, 18))
    return Image.composite(warm_dark, img, inv.point(lambda v: min(v, 70)))


def _enhance_sync(image_bytes):
    try:
        img = _exif_fix(Image.open(io.BytesIO(image_bytes)))
        img.load()
    except Exception as e:
        logger.exception("PIL abrir: %s", e)
        return image_bytes

    img = _resize_max(img, 1800)
    if _has_real_alpha(img):
        result, mode = _compose(img.convert("RGBA")), "alpha"
    else:
        cut = _heuristic_cutout(img.convert("RGB"))
        if cut is not None:
            result, mode = _compose(cut), "heuristic"
        else:
            result, mode = _fallback_finish(img.convert("RGB")), "fallback"
    logger.info("image_ai: modo=%s", mode)

    out = io.BytesIO()
    result.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


async def enhance_product_image(image_bytes):
    try:
        return await asyncio.to_thread(_enhance_sync, image_bytes)
    except Exception as e:
        logger.exception("enhance: %s", e)
        return image_bytes
