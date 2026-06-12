"""SVG/PNG logo for invoice PDF (procedurally generated)."""
import io
from PIL import Image, ImageDraw, ImageFont


def get_logo_png(size: int = 320) -> bytes:
    """Renders a simple Las Dos Doncellas circular logo to a PNG buffer."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Outer ring
    d.ellipse([2, 2, size - 2, size - 2], outline=(10, 10, 10), width=4)
    # Inner black disc
    pad = 12
    d.ellipse([pad, pad, size - pad, size - pad], fill=(10, 10, 10))
    # Center divider
    mid = size // 2
    d.line([(mid, int(size * 0.22)), (mid, int(size * 0.78))], fill=(255, 255, 255), width=2)
    # L and D letters
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", int(size * 0.32))
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", int(size * 0.075))
    except Exception:
        font = ImageFont.load_default()
        font_sub = ImageFont.load_default()
    # Position L on left half, D on right half
    L_x = int(size * 0.30)
    D_x = int(size * 0.55)
    y = int(size * 0.30)
    d.text((L_x, y), "L", fill=(255, 255, 255), font=font, anchor="lt")
    d.text((D_x, y), "D", fill=(255, 255, 255), font=font, anchor="lt")
    # Brand text
    d.text((mid, int(size * 0.78)), "LAS DOS DONCELLAS", fill=(255, 255, 255), font=font_sub, anchor="mm")
    d.text((mid, int(size * 0.86)), "Productos Ibéricos", fill=(197, 160, 89), font=font_sub, anchor="mm")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
