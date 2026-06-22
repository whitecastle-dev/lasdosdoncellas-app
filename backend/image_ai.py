"""Mejora estética de imagen de producto — 100% local, sin API, sin cuota,
sin dependencias pesadas (Pillow puro). Rápido (<1s) y memory-safe en Render free tier.

Pipeline:
1. Resize a 1200px lado mayor (acelera Cloudinary upload)
2. Ligero realce de contraste, saturación y nitidez
3. Vignette dorado cálido sutil (~10% opacidad)
4. Marco interior 1px dorado (toque editorial)
5. Output JPEG calidad 90

Sin remover fondo: el cliente sube ya una foto en un fondo limpio
(blanco/madera). La IA real de remoción de fondo se hace en /enhance endpoint
asíncrono (opt-in), no en cada subida.

NOTA: Esto reemplaza el pipeline rembg que requería 250MB de deps + 30-40s de
ejecución, incompatible con Render free tier.
"""
import io
import logging
import asyncio
import math

from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageChops

logger = logging.getLogger(__name__)

TARGET_LONG_SIDE = 1400
JPEG_QUALITY = 90


def _detect_orientation(img: Image.Image) -> Image.Image:
    """Aplica la rotación EXIF si la hay (típica de fotos de móvil)."""
    try:
        from PIL import ImageOps
        return ImageOps.exif_transpose(img)
    except Exception:
        return img


def _resize_max_side(img: Image.Image, side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= side:
        return img
    if w >= h:
        new_w = side
        new_h = int(h * side / w)
    else:
        new_h = side
        new_w = int(w * side / h)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _apply_warm_vignette(img: Image.Image) -> Image.Image:
    """Vignette dorado cálido sutil en las esquinas — toque editorial."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    max_r = int(max(w, h) * 0.75)
    cx, cy = w // 2, h // 2
    for r in range(max_r, 0, -10):
        alpha = int(255 * (1 - r / max_r) * 0.55)  # max 55% en el centro
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max_r // 4))
    # Invertir para que el oscurecimiento sea en las esquinas, no en el centro
    inv = ImageChops.invert(mask)

    warm_dark = Image.new("RGB", (w, h), (38, 26, 18))
    return Image.composite(warm_dark, img, inv.point(lambda v: min(v, 70)))


def _add_thin_border(img: Image.Image, color: tuple = (197, 160, 89), thickness: int = 2) -> Image.Image:
    """Marco fino dorado en el perímetro."""
    w, h = img.size
    out = img.copy()
    d = ImageDraw.Draw(out)
    for t in range(thickness):
        d.rectangle([t, t, w - 1 - t, h - 1 - t], outline=color)
    return out


def _enhance_sync(image_bytes: bytes) -> bytes:
    """Pipeline síncrono. Devuelve JPEG."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = _detect_orientation(img)
        img = img.convert("RGB")
    except Exception as e:
        logger.exception("PIL no pudo abrir la imagen: %s", e)
        return image_bytes

    # 1) Resize
    img = _resize_max_side(img, TARGET_LONG_SIDE)

    # 2) Realce sutil — sin pasarse para no quemar la foto original
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.10)
    img = ImageEnhance.Sharpness(img).enhance(1.20)
    # Sombra/luz pequeño aumento de luminosidad
    img = ImageEnhance.Brightness(img).enhance(1.02)

    # 3) Vignette cálido
    img = _apply_warm_vignette(img)

    # 4) Marco fino dorado
    img = _add_thin_border(img, color=(197, 160, 89), thickness=2)

    # 5) Export JPEG
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


async def enhance_product_image(image_bytes: bytes) -> bytes:
    """API async usada por los endpoints. Nunca lanza."""
    try:
        return await asyncio.to_thread(_enhance_sync, image_bytes)
    except Exception as e:
        logger.exception("enhance_product_image falló: %s", e)
        return image_bytes
