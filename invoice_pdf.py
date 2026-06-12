"""PDF Invoice generation for Spanish iberico e-commerce.

Generates an A4 invoice with company branding (logo), customer fiscal data,
line items, VAT (IVA) breakdown (4%, 10%, 21%) and total.
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
)
from reportlab.lib.enums import TA_RIGHT

from brand_logo import get_logo_png
from company_info import get_company

GOLD = colors.HexColor("#C5A059")
BLACK = colors.HexColor("#0A0A0A")
DARK_OAK = colors.HexColor("#3B2B20")
LIGHT_BG = colors.HexColor("#FAF8F5")


def _money(v: float) -> str:
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def generate_invoice_pdf(order: dict) -> bytes:
    co = get_company()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title=f"Factura {order.get('invoice_number','')}",
    )

    styles = getSampleStyleSheet()
    label = ParagraphStyle("label", parent=styles["Normal"], fontSize=8,
                          textColor=DARK_OAK, leading=10, spaceAfter=2)
    val = ParagraphStyle("val", parent=styles["Normal"], fontSize=10,
                        textColor=BLACK, leading=12)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8,
                          textColor=colors.grey, leading=10)
    right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT,
                          fontSize=10, textColor=BLACK)

    story = []

    # Header — brand with logo
    logo_bytes = get_logo_png(size=320)
    logo_img = RLImage(io.BytesIO(logo_bytes), width=24 * mm, height=24 * mm)
    brand_table = Table(
        [[
            logo_img,
            Paragraph(f"<b>{co['name'].upper()}</b><br/><font size=8 color='#C5A059'>Productos Ibéricos</font><br/><font size=7 color='#666'>{co['region']}</font>", val),
            Paragraph(f"<b>FACTURA</b><br/><font size=9>Nº {order.get('invoice_number','-')}</font>", right),
        ]],
        colWidths=[26 * mm, 90 * mm, 54 * mm],
    )
    brand_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 1, GOLD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 8 * mm))

    cust = order.get("customer", {}) or {}
    fiscal = "<br/>".join(filter(None, [
        cust.get("name", ""),
        cust.get("address", ""),
        f"{cust.get('postal_code','')} {cust.get('city','')}".strip(),
        cust.get("country", "España"),
        f"NIF/CIF: {cust.get('tax_id','-')}",
        cust.get("email", ""),
    ]))

    company = (
        f"{co['legal_name']}<br/>"
        f"Productos Ibéricos<br/>"
        f"{co['address']}<br/>"
        f"{co['postal']} {co['city']}, {co['province']}<br/>"
        f"{co['country']}<br/>"
        f"CIF: {co['cif']}<br/>"
        f"{co['email']}"
    )

    info_table = Table([
        [Paragraph("EMISOR", label), Paragraph("CLIENTE", label)],
        [Paragraph(company, val), Paragraph(fiscal or "-", val)],
    ], colWidths=[85 * mm, 85 * mm])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    meta_table = Table([
        [
            Paragraph(f"<b>Fecha:</b> {order.get('invoice_date','')}", val),
            Paragraph(f"<b>Pedido:</b> {order.get('order_number','')}", val),
            Paragraph(f"<b>Estado:</b> {order.get('payment_status','-').upper()}", val),
        ]
    ], colWidths=[55 * mm, 60 * mm, 55 * mm])
    meta_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.lightgrey),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8 * mm))

    rows = [["#", "Descripción", "Cant.", "P. Unit.", "IVA", "Subtotal"]]
    for i, it in enumerate(order.get("items", []), start=1):
        qty = it.get("qty", 1)
        unit = float(it.get("unit_price", 0))
        line_sub = qty * unit
        rows.append([
            str(i),
            it.get("name", ""),
            str(qty),
            _money(unit),
            f"{int(it.get('vat_rate', 10))}%",
            _money(line_sub),
        ])
    items_table = Table(rows, colWidths=[10 * mm, 80 * mm, 15 * mm, 25 * mm, 15 * mm, 25 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    totals_data = [
        ["Base imponible", _money(order.get("subtotal", 0))],
    ]
    for rate, amount in (order.get("vat_breakdown") or {}).items():
        totals_data.append([f"IVA {rate}%", _money(amount)])
    if order.get("shipping"):
        totals_data.append(["Envío", _money(order.get("shipping", 0))])
    totals_data.append(["TOTAL", _money(order.get("total", 0))])

    totals_table = Table(totals_data, colWidths=[40 * mm, 35 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LINEABOVE", (0, -1), (-1, -1), 1, BLACK),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TEXTCOLOR", (0, -1), (-1, -1), BLACK),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)

    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph(
        f"Gracias por confiar en {co['name']} — Productos Ibéricos curados en {co['region']}. "
        f"Esta factura ha sido emitida electrónicamente y es válida sin firma.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
