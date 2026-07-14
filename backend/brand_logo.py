"""Logo helper for invoice/proforma PDFs.

Loads the official brand PNG from the frontend `public/brand/logo.png` if
available; falls back to a procedurally-generated logo if not (defensive).
"""
import io
import os
from PIL import Image, ImageDraw, ImageFont

_LOGO_PATHS = [
    "/app/frontend/public/brand/logo.png",
    os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "brand", "logo.png"),
]

_cached_logo: bytes | None = None


def _fallback_logo(size: int) -> bytes:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([2, 2, size - 2, size - 2], outline=(10, 10, 10), width=4)
    pad = 12
    d.rectangle([pad, pad, size - pad, size - pad], fill=(10, 10, 10))
    mid = size // 2
    d.line([(mid, int(size * 0.22)), (mid, int(size * 0.78))], fill=(255, 255, 255), width=2)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", int(size * 0.32))
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", int(size * 0.075))
    except Exception:
        font = ImageFont.load_default()
        font_sub = ImageFont.load_default()
    L_x, D_x, y = int(size * 0.30), int(size * 0.55), int(size * 0.30)
    d.text((L_x, y), "L", fill=(255, 255, 255), font=font, anchor="lt")
    d.text((D_x, y), "D", fill=(255, 255, 255), font=font, anchor="lt")
    d.text((mid, int(size * 0.78)), "LAS DOS DONCELLAS", fill=(255, 255, 255), font=font_sub, anchor="mm")
    d.text((mid, int(size * 0.86)), "Productos Ibéricos", fill=(197, 160, 89), font=font_sub, anchor="mm")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def get_logo_png(size: int = 320) -> bytes:
    """Return the brand logo PNG, resized to fit `size` on the longer edge."""
    global _cached_logo
    if _cached_logo is None:
        for path in _LOGO_PATHS:
            if os.path.exists(path):
                try:
                    with open(path, "rb") as f:
                        _cached_logo = f.read()
                    break
                except Exception:
                    continue
    if not _cached_logo:
        return _fallback_logo(size)
    try:
        img = Image.open(io.BytesIO(_cached_logo)).convert("RGBA")
        # Fit within (size x size) preserving aspect
        img.thumbnail((size, size), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return _fallback_logo(size)
