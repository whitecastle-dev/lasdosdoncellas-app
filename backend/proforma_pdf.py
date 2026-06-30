"""PDF Proforma generation — for stock reorder requests to providers.

Issued FROM Las Dos Doncellas TO a provider, listing the products and
quantities we want to reorder. No VAT computed (provider sets terms),
this is a PROFORMA only.
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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


def generate_proforma_pdf(proforma: dict) -> bytes:
    """proforma keys: proforma_number, created_at_date, provider (dict),
    items[] (sku, name, current_stock, threshold, qty, unit_cost, line_total),
    subtotal, total, notes."""
    co = get_company()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=20 * mm,
        title=f"Proforma {proforma.get('proforma_number','')}",
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

    # Header
    logo_bytes = get_logo_png(size=320)
    logo_img = RLImage(io.BytesIO(logo_bytes), width=24 * mm, height=24 * mm)
    brand_table = Table(
        [[
            logo_img,
            Paragraph(f"<b>{co['name'].upper()}</b><br/><font size=8 color='#C5A059'>Productos Ibéricos</font><br/><font size=7 color='#666'>{co['region']}</font>", val),
            Paragraph(f"<b>PEDIDO PROFORMA</b><br/><font size=9>Nº {proforma.get('proforma_number','-')}</font>", right),
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

    pv = proforma.get("provider", {}) or {}
    provider_block = "<br/>".join(filter(None, [
        f"<b>{pv.get('company') or pv.get('name','')}</b>",
        pv.get("contact_name", ""),
        pv.get("address", ""),
        f"{pv.get('postal_code','')} {pv.get('city','')}".strip(),
        pv.get("country", ""),
        f"CIF: {pv.get('tax_id','-')}" if pv.get("tax_id") else "",
        pv.get("email", ""),
        pv.get("phone", ""),
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
        [Paragraph("SOLICITAMOS A", label), Paragraph("EMISOR", label)],
        [Paragraph(provider_block or "-", val), Paragraph(company, val)],
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
            Paragraph(f"<b>Fecha:</b> {proforma.get('created_at_date','')}", val),
            Paragraph(f"<b>Motivo:</b> Reposición por stock bajo", val),
            Paragraph(f"<b>Aprobada por:</b> {proforma.get('approved_by_name','-')}", val),
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

    rows = [["#", "SKU", "Descripción", "Stock", "Pedido", "P. Unit.", "Subtotal"]]
    for i, it in enumerate(proforma.get("items", []), start=1):
        qty = it.get("qty", 0)
        unit = float(it.get("unit_cost", 0) or 0)
        line_sub = qty * unit
        rows.append([
            str(i),
            it.get("sku", ""),
            it.get("name", ""),
            f"{it.get('current_stock', 0)}/{it.get('threshold', 0)}",
            str(qty),
            _money(unit),
            _money(line_sub),
        ])
    items_table = Table(rows, colWidths=[8 * mm, 25 * mm, 60 * mm, 18 * mm, 15 * mm, 22 * mm, 22 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    totals_data = [
        ["Subtotal estimado", _money(proforma.get("subtotal", 0))],
        ["TOTAL ESTIMADO", _money(proforma.get("total", 0))],
    ]
    totals_table = Table(totals_data, colWidths=[45 * mm, 35 * mm], hAlign="RIGHT")
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

    if proforma.get("notes"):
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph(f"<b>Notas:</b> {proforma['notes']}", small))

    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph(
        "Esta proforma no es una factura ni implica obligación de pago. Por favor, confirme disponibilidad, "
        "plazo de entrega y precio definitivo respondiendo a este correo. Gracias.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
