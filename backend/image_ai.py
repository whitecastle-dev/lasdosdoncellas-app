"""Mejora estética de imagen de producto — 100% local, sin API, sin cuota.

Pipeline:
1. `rembg` (ONNX, modelo BiRefNet/u2netp) → fondo transparente
2. Recorte al bounding box del producto + márgenes
3. Composite sobre un fondo de madera oscura procedural (PIL)
4. Sombra suave + ligero realce de contraste/saturación

Resultado: foto profesional de e-commerce sobre madera oscura "Las Dos Doncellas".
Sin GOOGLE_API_KEY, sin Emergent, sin coste por imagen.

El modelo ONNX se descarga la primera vez (~5MB para u2netp) en
~/.u2net/. En Render con disco efímero esto ocurre en cada reinicio,
~3-5 segundos extra la primera petición tras un deploy.
"""
import io
import logging
import math
import os
import asyncio
import random
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

logger = logging.getLogger(__name__)

# Lazy import — rembg carga ~50MB de deps de ONNX al importarse
_rembg_session = None
_REMBG_MODEL = os.environ.get("REMBG_MODEL", "u2netp")  # u2netp ~5MB, u2net ~170MB, birefnet-general ~80MB


def _get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        logger.info("Cargando modelo rembg '%s' (primera vez puede tardar)…", _REMBG_MODEL)
        _rembg_session = new_session(_REMBG_MODEL)
    return _rembg_session


def _generate_wood_background(width: int, height: int) -> Image.Image:
    """Fondo de madera oscura procedural — vetas suaves con vignette dorado."""
    # Tono base madera oscura
    base = Image.new("RGB", (width, height), (38, 26, 18))
    px = base.load()
    # Vetas verticales sutiles
    rng = random.Random(42)  # determinista para mismo resultado siempre
    for x in range(width):
        # Variación marrón
        offset = int(8 * math.sin(x * 0.013) + 6 * math.sin(x * 0.07 + 1.3))
        # Vetas oscuras
        vein = 1 if (x + int(15 * math.sin(x * 0.003))) % 95 < 3 else 0
        for y in range(height):
            r, g, b = px[x, y]
            n = rng.randint(-3, 3)
            r = max(0, min(255, r + offset + n - vein * 6))
            g = max(0, min(255, g + offset // 2 + n - vein * 5))
            b = max(0, min(255, b + offset // 3 + n - vein * 4))
            px[x, y] = (r, g, b)
    # Suaviza
    base = base.filter(ImageFilter.GaussianBlur(radius=0.6))

    # Vignette dorado cálido
    vignette = Image.new("L", (width, height), 0)
    vd = ImageDraw.Draw(vignette)
    max_r = int(max(width, height) * 0.85)
    for r in range(max_r, 0, -8):
        alpha = int(255 * (1 - r / max_r) * 0.45)
        vd.ellipse([width // 2 - r, height // 2 - r, width // 2 + r, height // 2 + r], fill=alpha)
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=60))
    warm = Image.new("RGB", (width, height), (197, 160, 89))  # gold #C5A059
    base = Image.composite(warm, base, vignette).convert("RGB")
    # Mezcla 25% gold + 75% madera
    base = Image.blend(Image.new("RGB", (width, height), (38, 26, 18)), base, 0.6)

    return base


def _add_drop_shadow(product_rgba: Image.Image, blur: int = 18, offset_y: int = 14, opacity: int = 110) -> Image.Image:
    """Devuelve una imagen RGBA donde se ha pintado una sombra suave bajo la alpha
    del producto. Combina sombra + producto en un nuevo canvas del mismo tamaño."""
    w, h = product_rgba.size
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Alpha del producto como máscara
    alpha = product_rgba.split()[-1]
    # Tinta negra solo donde hay alpha
    black = Image.new("RGBA", (w, h), (0, 0, 0, opacity))
    shadow.paste(black, (0, offset_y), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))
    # Combina sombra + producto
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out = Image.alpha_composite(out, shadow)
    out = Image.alpha_composite(out, product_rgba)
    return out


def _enhance_sync(image_bytes: bytes) -> bytes:
    """Pipeline síncrono. Devuelve PNG."""
    from rembg import remove
    try:
        session = _get_rembg_session()
        cut = remove(image_bytes, session=session)  # bytes PNG con alpha
    except Exception as e:
        logger.exception("rembg falló: %s — devolvemos original.", e)
        return image_bytes

    try:
        product = Image.open(io.BytesIO(cut)).convert("RGBA")
    except Exception as e:
        logger.exception("PIL no pudo abrir el resultado de rembg: %s", e)
        return image_bytes

    # Recorta al bounding box (con margen de 5%)
    bbox = product.getbbox()
    if bbox:
        margin_x = int((bbox[2] - bbox[0]) * 0.05)
        margin_y = int((bbox[3] - bbox[1]) * 0.05)
        bbox = (max(0, bbox[0] - margin_x), max(0, bbox[1] - margin_y),
                min(product.width, bbox[2] + margin_x), min(product.height, bbox[3] + margin_y))
        product = product.crop(bbox)

    # Realce sutil del producto
    product_rgb = Image.new("RGB", product.size, (0, 0, 0))
    product_rgb.paste(product, mask=product.split()[-1])
    enhancer = ImageEnhance.Contrast(product_rgb)
    product_rgb = enhancer.enhance(1.08)
    enhancer = ImageEnhance.Color(product_rgb)
    product_rgb = enhancer.enhance(1.12)
    enhancer = ImageEnhance.Sharpness(product_rgb)
    product_rgb = enhancer.enhance(1.15)
    product = Image.merge("RGBA", (*product_rgb.split(), product.split()[-1]))

    # Canvas final cuadrado, lado = lado mayor del producto * 1.45
    pw, ph = product.size
    canvas_side = int(max(pw, ph) * 1.45)
    canvas_side = max(900, min(canvas_side, 1800))  # entre 900px y 1800px

    bg = _generate_wood_background(canvas_side, canvas_side)

    # Redimensiona producto a ~70% del canvas
    target_long = int(canvas_side * 0.70)
    if pw >= ph:
        new_w = target_long
        new_h = int(ph * target_long / pw)
    else:
        new_h = target_long
        new_w = int(pw * target_long / ph)
    product = product.resize((new_w, new_h), Image.LANCZOS)

    # Sombra
    shadowed = _add_drop_shadow(product, blur=20, offset_y=int(new_h * 0.04), opacity=120)

    # Centrado (ligeramente desplazado hacia arriba para dejar más sombra abajo)
    pos = ((canvas_side - new_w) // 2, (canvas_side - new_h) // 2 - int(canvas_side * 0.03))
    bg_rgba = bg.convert("RGBA")
    bg_rgba.alpha_composite(shadowed, pos)

    # Export PNG
    out_buf = io.BytesIO()
    bg_rgba.convert("RGB").save(out_buf, format="JPEG", quality=88, optimize=True)
    return out_buf.getvalue()


async def enhance_product_image(image_bytes: bytes) -> bytes:
    """API async usada por los endpoints. Nunca lanza."""
    try:
        return await asyncio.to_thread(_enhance_sync, image_bytes)
    except Exception as e:
        logger.exception("enhance_product_image falló: %s", e)
        return image_bytes
