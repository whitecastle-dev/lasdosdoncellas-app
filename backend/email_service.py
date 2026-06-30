"""Brevo transactional email service.

If BREVO_API_KEY is not set, calls are logged and silently no-op
(useful in dev). All HTML emails use the Las Dos Doncellas brand.
"""
import os
import logging
import httpx
from company_info import get_company

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _enabled() -> bool:
    return bool(os.environ.get("BREVO_API_KEY"))


async def _send(subject: str, html: str, text: str, to_email: str, to_name: str = "", attachments: list | None = None) -> bool:
    if not _enabled():
        logger.info(f"[brevo:disabled] would send '{subject}' to {to_email}")
        return False
    api_key = os.environ["BREVO_API_KEY"]
    sender_email = os.environ.get("BREVO_SENDER_EMAIL", "no-reply@lasdosdoncellasibericos.es")
    sender_name = os.environ.get("BREVO_SENDER_NAME", "Las Dos Doncellas")
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    if attachments:
        payload["attachment"] = attachments
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(BREVO_URL, json=payload, headers={"api-key": api_key, "Content-Type": "application/json"})
            r.raise_for_status()
            return True
    except Exception as e:
        logger.exception(f"Brevo send failed: {e}")
        return False


def _money(v: float) -> str:
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _shell(content: str) -> str:
    co = get_company()
    return f"""
    <html><body style="margin:0;padding:0;background:#FAF8F5;font-family:Georgia,serif;color:#0A0A0A;">
      <div style="max-width:620px;margin:0 auto;padding:32px 24px;">
        <div style="text-align:center;border-bottom:1px solid #C5A059;padding-bottom:18px;margin-bottom:24px;">
          <div style="font-size:24px;letter-spacing:0.04em;">LAS DOS DONCELLAS</div>
          <div style="font-family:'Brush Script MT',cursive;font-style:italic;font-size:18px;color:#C5A059;margin-top:2px;">Productos Ibéricos</div>
        </div>
        {content}
        <div style="border-top:1px solid #e6dec9;margin-top:32px;padding-top:18px;font-size:11px;color:#666;text-align:center;line-height:1.6;">
          {co['legal_name']} · CIF {co['cif']}<br/>
          {co['address']}, {co['postal']} {co['city']}, {co['province']}<br/>
          {co['email']}
        </div>
      </div>
    </body></html>
    """


def _items_table(order: dict) -> str:
    rows = ""
    for it in order.get("items", []):
        rows += f"""
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">{it['name']} <span style='color:#888;'>× {it['qty']}</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">{_money(it['line_total'])}</td>
        </tr>"""
    return f"""
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      {rows}
      <tr><td style="padding:10px 0;color:#666;">Subtotal</td><td style="text-align:right;font-family:monospace;">{_money(order.get('subtotal',0))}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">IVA</td><td style="text-align:right;font-family:monospace;">{_money(order.get('vat_total',0))}</td></tr>
      <tr><td style="padding:12px 0;border-top:2px solid #0A0A0A;font-size:18px;">Total</td><td style="text-align:right;font-size:18px;font-family:Georgia,serif;border-top:2px solid #0A0A0A;padding-top:12px;">{_money(order.get('total',0))}</td></tr>
    </table>
    """


async def send_order_confirmation(order: dict) -> None:
    """Sends two emails: to customer + to admin (pedidos@...)."""
    customer = order.get("customer", {})
    items = _items_table(order)

    # Customer mail
    customer_html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;margin:0 0 8px;">¡Gracias por tu pedido, {customer.get('name','')}!</h1>
      <p style="color:#555;margin:0 0 24px;line-height:1.6;">Hemos recibido el pago correctamente. Estamos preparando tu pedido <strong style="color:#C5A059;font-family:monospace;">{order.get('order_number')}</strong> con todo el cuidado de la dehesa.</p>
      {items}
      <p style="color:#666;font-size:13px;margin-top:24px;line-height:1.6;">Envío estimado: 24-48h península. Recibirás otra notificación cuando el pedido salga del almacén.</p>
    """)
    customer_text = (
        f"Gracias por tu pedido, {customer.get('name','')}.\n\n"
        f"Pedido {order.get('order_number')} - Total {_money(order.get('total',0))}.\n"
        "Te enviaremos otro email cuando salga del almacén."
    )
    await _send(
        subject=f"Pedido confirmado · {order.get('order_number')}",
        html=customer_html, text=customer_text,
        to_email=customer.get("email", ""), to_name=customer.get("name", ""),
    )

    # Admin mail
    admin_email = os.environ.get("BREVO_ADMIN_EMAIL", "pedidos@lasdosdoncellasibericos.es")
    admin_html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px;">Nuevo pedido pagado</h1>
      <p style="color:#555;margin:0 0 12px;">Cliente: <strong>{customer.get('name')}</strong> ({customer.get('email')})</p>
      <p style="color:#555;margin:0 0 4px;">{customer.get('address')}, {customer.get('postal_code')} {customer.get('city')}</p>
      <p style="color:#555;margin:0 0 24px;">Tel: {customer.get('phone','-')} · NIF: {customer.get('tax_id','-')}</p>
      {items}
      <p style="margin-top:20px;font-size:13px;color:#666;">Pedido <code>{order.get('order_number')}</code> · Factura <code>{order.get('invoice_number')}</code></p>
    """)
    await _send(
        subject=f"[Nuevo pedido] {order.get('order_number')} · {_money(order.get('total',0))}",
        html=admin_html,
        text=f"Nuevo pedido {order.get('order_number')} - {customer.get('name')} - {_money(order.get('total',0))}",
        to_email=admin_email,
    )


async def send_status_update(order: dict) -> None:
    status_labels = {
        "processing": "Estamos preparando tu pedido",
        "shipped": "Tu pedido está en camino",
        "delivered": "Tu pedido ha sido entregado",
        "cancelled": "Tu pedido ha sido cancelado",
        "refunded": "Tu pedido ha sido reembolsado",
    }
    status = order.get("status", "")
    if status not in status_labels:
        return
    customer = order.get("customer", {})
    html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:28px;margin:0 0 8px;">{status_labels[status]}</h1>
      <p style="color:#555;line-height:1.6;">Pedido <strong style="color:#C5A059;font-family:monospace;">{order.get('order_number')}</strong></p>
      <p style="color:#666;font-size:13px;margin-top:24px;">Si tienes cualquier pregunta, responde a este email.</p>
    """)
    await _send(
        subject=f"Pedido {order.get('order_number')} · {status_labels[status]}",
        html=html, text=status_labels[status],
        to_email=customer.get("email", ""), to_name=customer.get("name", ""),
    )


async def send_provider_message(provider_email: str, provider_name: str, subject: str, body: str) -> bool:
    html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px;">{subject}</h1>
      <div style="color:#222;font-size:14px;line-height:1.7;white-space:pre-wrap;">{body}</div>
    """)
    return await _send(subject=subject, html=html, text=body, to_email=provider_email, to_name=provider_name)


async def send_proforma_to_provider(provider: dict, proforma: dict, pdf_bytes: bytes) -> bool:
    """Sends the approved proforma PDF to the provider (and CC to pedidos@...).

    `proforma` must include: proforma_number, items list, total, notes.
    """
    import base64
    rows = ""
    for it in proforma.get("items", []):
        rows += f"""
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;">{it.get('name','')} <span style='color:#888;font-family:monospace;font-size:11px;'>{it.get('sku','')}</span></td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">× {it.get('qty',0)}</td>
        </tr>"""

    html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:28px;margin:0 0 8px;">Pedido proforma</h1>
      <p style="color:#555;margin:0 0 12px;line-height:1.6;">Estimados {provider.get('company') or provider.get('name','')}:</p>
      <p style="color:#555;margin:0 0 18px;line-height:1.6;">
        Adjuntamos pedido proforma <strong style="color:#C5A059;font-family:monospace;">{proforma.get('proforma_number','')}</strong>
        con los productos que necesitamos reponer. Por favor, confirmen disponibilidad, precio definitivo y plazo de entrega
        respondiendo a este correo.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        {rows}
        <tr><td style="padding:12px 0;border-top:2px solid #0A0A0A;font-size:16px;">Total estimado</td>
            <td style="text-align:right;font-size:16px;font-family:Georgia,serif;border-top:2px solid #0A0A0A;padding-top:12px;">{_money(proforma.get('total',0))}</td></tr>
      </table>
      {f'<p style="margin-top:18px;color:#555;font-size:13px;"><b>Notas:</b> {proforma.get("notes")}</p>' if proforma.get('notes') else ''}
      <p style="color:#666;font-size:12px;margin-top:24px;line-height:1.6;">
        El PDF de la proforma se adjunta a este correo. Esto no es una factura; sirve únicamente como solicitud de reposición.
      </p>
    """)
    text = (
        f"Pedido proforma {proforma.get('proforma_number')}.\n"
        f"Total estimado: {_money(proforma.get('total',0))}.\n"
        "PDF adjunto. Por favor confirmen disponibilidad y plazo."
    )
    attachment = [{
        "name": f"proforma_{proforma.get('proforma_number','')}.pdf",
        "content": base64.b64encode(pdf_bytes).decode("ascii"),
    }]
    return await _send(
        subject=f"Pedido proforma {proforma.get('proforma_number','')} · Las Dos Doncellas",
        html=html, text=text,
        to_email=provider.get("email", ""),
        to_name=provider.get("name", ""),
        attachments=attachment,
    )


async def send_chat_notification(customer_name: str, customer_email: str, message: str) -> bool:
    """Notifica a info@... que hay un chat nuevo de un cliente pendiente de respuesta."""
    admin_email = os.environ.get("CHAT_NOTIFICATION_EMAIL", "info@lasdosdoncellasibericos.es")
    safe_msg = (message or "")[:600]
    if len(message or "") > 600:
        safe_msg += "…"
    html = _shell(f"""
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px;">Nuevo mensaje de chat</h1>
      <p style="color:#555;margin:0 0 6px;">Cliente: <strong>{customer_name}</strong></p>
      <p style="color:#555;margin:0 0 18px;">{customer_email}</p>
      <div style="background:#FAF8F5;border-left:3px solid #C5A059;padding:14px 18px;color:#222;font-size:14px;line-height:1.6;white-space:pre-wrap;">{safe_msg}</div>
      <p style="margin-top:22px;font-size:13px;color:#666;">
        Responde desde el panel: <a href="https://lasdosdoncellasibericos.es/admin/chat" style="color:#C5A059;">Abrir panel de chat</a>
      </p>
    """)
    text = f"Nuevo mensaje de chat de {customer_name} ({customer_email}):\n\n{safe_msg}"
    return await _send(
        subject=f"[Chat pendiente] {customer_name}",
        html=html, text=text,
        to_email=admin_email,
    )
