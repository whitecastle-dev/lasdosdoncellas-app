import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, LogOut, MapPin, Package, Check } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import { useCustomer, customerApi } from "@/context/CustomerContext";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";

export default function CustomerAccount() {
  const { customer, loading, logout, refresh } = useCustomer();
  const [orders, setOrders] = useState([]);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "profile");
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);
  const [editingAddr, setEditingAddr] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (customer) {
      // Endpoint unificado: /api/auth/orders devuelve los pedidos del usuario actual
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("ldd_customer_token");
      fetch(`${BACKEND_URL}/api/auth/orders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setOrders(Array.isArray(data) ? data : []))
        .catch(() => setOrders([]));
    }
  }, [customer]);

  if (loading) return <div className="min-h-screen flex items-center justify-center gold" style={{ background: "#0A0A0A" }}>Cargando…</div>;
  if (!customer) return <Navigate to="/cuenta/login" replace />;

  return (
    <div className="ldd-storefront min-h-screen">
      {/* Añadimos la key dinámica para forzar la actualización del Header */}
      <StoreHeader 
        key={customer ? "user-logged" : "user-guest"} 
        onOpenCart={() => {}} 
      />
      
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="label-eyebrow gold mb-3">Mi cuenta</div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tighter" style={{ color: "#FAF8F5" }}>Hola, {customer.first_name || customer.name?.split(" ")[0] || "amigo"}</h1>
          </div>
          <button onClick={async () => { await logout(); nav("/"); }} className="text-sm flex items-center gap-2 hover:text-[#C5A059]" data-testid="account-logout" style={{ color: "rgba(250,248,245,0.7)" }}>
            <LogOut size={14} /> Salir
          </button>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-10">
          <nav className="space-y-1 text-sm" style={{ color: "rgba(250,248,245,0.85)" }}>
            <TabBtn id="profile" tab={tab} setTab={setTab} label="Mis datos" testid="tab-profile" />
            <TabBtn id="addresses" tab={tab} setTab={setTab} label="Direcciones" testid="tab-addresses" />
            <TabBtn id="orders" tab={tab} setTab={setTab} label="Mis pedidos" testid="tab-orders" />
            <TabBtn id="payment" tab={tab} setTab={setTab} label="Pagos guardados" testid="tab-payment" />
            <TabBtn id="whatsapp" tab={tab} setTab={setTab} label="Contacta por WhatsApp" testid="tab-whatsapp" />
          </nav>

          <div>
            {tab === "profile" && <ProfileForm customer={customer} refresh={refresh} />}
            {tab === "addresses" && (
              <AddressesPanel customer={customer} refresh={refresh} editingAddr={editingAddr} setEditingAddr={setEditingAddr} />
            )}
            {tab === "orders" && <OrdersList orders={orders} />}
            {tab === "payment" && (
              <div className="border border-[rgba(197,160,89,0.25)] p-8">
                <div className="label-eyebrow gold mb-3">Próximamente</div>
                <p style={{ color: "rgba(250,248,245,0.7)" }}>
                  Pronto podrás guardar tu tarjeta de forma segura para activar el botón
                  <span className="gold"> &ldquo;Comprar ya&rdquo;</span>. Por ahora, paga con tarjeta en cada compra y guarda tu dirección
                  para acelerar el proceso.
                </p>
              </div>
            )}
            {tab === "whatsapp" && <WhatsAppPanel customer={customer} />}
          </div>
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}

function TabBtn({ id, tab, setTab, label, testid }) {
  return (
    <button onClick={() => setTab(id)} data-testid={testid}
      className={`block w-full text-left px-4 py-3 transition border-l-2 ${tab === id ? "border-[#C5A059] text-[#C5A059] bg-[rgba(197,160,89,0.05)]" : "border-transparent hover:border-[rgba(197,160,89,0.4)] hover:text-[#C5A059]"}`}>
      {label}
    </button>
  );
}

function ProfileForm({ customer, refresh }) {
  const [form, setForm] = useState({ name: customer.name || "", phone: customer.phone || "", tax_id: customer.tax_id || "" });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await customerApi.patch("/me", form);
      await refresh();
      toast.success("Datos guardados");
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-5 max-w-lg" data-testid="profile-form">
      <Field label="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} testid="profile-name" />
      <Field label="Email" value={customer.email} disabled testid="profile-email" />
      <Field label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} testid="profile-phone" />
      <Field label="NIF/CIF" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} testid="profile-tax-id" />
      <button disabled={saving} className="ldd-btn-gold" data-testid="profile-save">{saving ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

function AddressesPanel({ customer, refresh, editingAddr, setEditingAddr }) {
  const [adding, setAdding] = useState(false);
  const addresses = customer.addresses || [];

  const remove = async (id) => {
    if (!confirm("¿Eliminar dirección?")) return;
    try {
      await customerApi.delete(`/addresses/${id}`);
      await refresh();
      toast.success("Dirección eliminada");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl" style={{ color: "#FAF8F5" }}>Tus direcciones</h2>
        <button onClick={() => { setAdding(true); setEditingAddr(null); }} className="ldd-btn-ghost text-xs" data-testid="address-add-button">
          <Plus size={14} /> Nueva dirección
        </button>
      </div>
      {addresses.length === 0 && !adding && (
        <p className="text-sm" style={{ color: "rgba(250,248,245,0.6)" }}>Aún no has guardado direcciones. Añade una para acelerar tus compras.</p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {addresses.map((a) => (
          <div key={a.id} className="border border-[rgba(197,160,89,0.2)] p-5" data-testid={`address-card-${a.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="font-serif text-lg flex items-center gap-2" style={{ color: "#FAF8F5" }}>
                <MapPin size={14} className="text-[#C5A059]" />
                {a.label}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingAddr(a); setAdding(false); }} className="text-[#FAF8F5]/60 hover:text-[#C5A059]" data-testid={`address-edit-${a.id}`}><Pencil size={14} /></button>
                <button onClick={() => remove(a.id)} className="text-[#FAF8F5]/60 hover:text-[#8C211E]" data-testid={`address-delete-${a.id}`}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "rgba(250,248,245,0.8)" }}>
              <div>{a.full_name}</div>
              <div>{a.address}</div>
              <div>{a.postal_code} {a.city}</div>
              <div>{a.country}</div>
              {a.phone && <div className="text-xs mt-1 text-[#C5A059]">{a.phone}</div>}
            </div>
            <div className="flex gap-2 mt-3 text-xs">
              {a.is_default_billing && <span className="text-[#C5A059] flex items-center gap-1"><Check size={10} /> Facturación</span>}
              {a.is_default_shipping && <span className="text-[#C5A059] flex items-center gap-1"><Check size={10} /> Envío</span>}
            </div>
          </div>
        ))}
      </div>
      {(adding || editingAddr) && (
        <AddressForm
          initial={editingAddr || { label: "Casa", full_name: customer.name, country: "España" }}
          isNew={!editingAddr}
          onClose={() => { setAdding(false); setEditingAddr(null); }}
          onSaved={async () => { setAdding(false); setEditingAddr(null); await refresh(); }}
        />
      )}
    </div>
  );
}

function AddressForm({ initial, isNew, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) await customerApi.post("/addresses", form);
      else await customerApi.patch(`/addresses/${form.id}`, form);
      toast.success("Dirección guardada");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="mt-8 border border-[rgba(197,160,89,0.3)] p-6 space-y-4" data-testid="address-form">
      <div className="label-eyebrow gold">{isNew ? "Nueva dirección" : "Editar dirección"}</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Etiqueta" value={form.label || ""} onChange={(e) => setForm({ ...form, label: e.target.value })} testid="addr-label" />
        <Field label="Nombre destinatario" value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required testid="addr-fullname" />
        <Field className="sm:col-span-2" label="Dirección" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} required testid="addr-address" />
        <Field label="Código postal" value={form.postal_code || ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} required testid="addr-postal" />
        <Field label="Ciudad" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} required testid="addr-city" />
        <Field label="País" value={form.country || "España"} onChange={(e) => setForm({ ...form, country: e.target.value })} required testid="addr-country" />
        <Field label="Teléfono" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} testid="addr-phone" />
        <Field className="sm:col-span-2" label="NIF/CIF (facturación)" value={form.tax_id || ""} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} testid="addr-tax" />
      </div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_default_billing} onChange={(e) => setForm({ ...form, is_default_billing: e.target.checked })} data-testid="addr-default-billing" /> Por defecto para facturación</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_default_shipping} onChange={(e) => setForm({ ...form, is_default_shipping: e.target.checked })} data-testid="addr-default-shipping" /> Por defecto para envío</label>
      </div>
      <div className="flex gap-3">
        <button disabled={saving} className="ldd-btn-gold" data-testid="addr-save">{saving ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onClose} className="ldd-btn-ghost" data-testid="addr-cancel">Cancelar</button>
      </div>
    </form>
  );
}

function Field({ label, testid, className = "", ...rest }) {
  return (
    <div className={className}>
      <label className="label-eyebrow gold block mb-2">{label}</label>
      <input data-testid={testid} {...rest} className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm disabled:opacity-50" />
    </div>
  );
}

const ORDER_STATUS_LABEL = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  processing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Devuelto / reembolsado",
};

const STATUS_STYLES = {
  pending_payment: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400" },
  confirmed:       { bg: "bg-blue-500/15",  border: "border-blue-500/40",  text: "text-blue-400" },
  processing:      { bg: "bg-indigo-500/15",border: "border-indigo-500/40",text: "text-indigo-400" },
  shipped:         { bg: "bg-purple-500/15",border: "border-purple-500/40",text: "text-purple-400" },
  delivered:       { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400" },
  cancelled:       { bg: "bg-red-500/15",   border: "border-red-500/40",   text: "text-red-400" },
};

function StatusPill({ status, testid }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.pending_payment;
  return (
    <div data-testid={testid}
         className={`inline-block px-2 py-0.5 border ${st.bg} ${st.border} ${st.text} uppercase tracking-widest text-xs`}>
      {ORDER_STATUS_LABEL[status] || status}
    </div>
  );
}

function OrdersList({ orders }) {
  const [openId, setOpenId] = useState(null);
  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-[rgba(197,160,89,0.3)]" data-testid="orders-empty-state">
        <div className="font-script gold text-3xl mb-3">Aún sin historial</div>
        <p className="text-sm" style={{ color: "rgba(250,248,245,0.65)" }}>Aún no tienes pedidos realizados.</p>
        <a href="/catalogo" className="ldd-btn-ghost text-xs mt-6 inline-block">Explorar catálogo</a>
      </div>
    );
  }
  const open = orders.find((o) => o.id === openId);
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <button
          key={o.id}
          onClick={() => setOpenId(o.id)}
          className="w-full text-left border border-[rgba(197,160,89,0.18)] hover:border-[#C5A059] hover:bg-white/[0.02] transition-colors p-5 flex items-center justify-between"
          data-testid={`my-order-${o.id}`}
        >
          <div>
            <div className="font-mono-data text-sm gold">{o.order_number}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }}>
              {new Date(o.created_at).toLocaleString("es-ES")}
            </div>
            <div className="mt-1"><StatusPill status={o.status} /></div>
          </div>
          <div className="text-right">
            <div className="font-serif text-xl" style={{ color: "#FAF8F5" }}>{formatMoney(o.total)}</div>
            <div className="flex items-center gap-1 text-xs text-[#C5A059] justify-end mt-1"><Package size={11} /> {o.items?.length || 0} productos</div>
            <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.4)" }}>Ver detalle →</div>
          </div>
        </button>
      ))}
      {open && <OrderDetailDrawer order={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const STATUS_ORDER = ["pending_payment", "confirmed", "processing", "shipped", "delivered"];

function OrderDetailDrawer({ order, onClose }) {
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const dt = new Date(order.created_at);
  const shippingAddr = order.customer || {};

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex justify-end" onClick={onClose} data-testid="order-detail-drawer">
      <div
        className="w-full max-w-2xl h-full overflow-y-auto"
        style={{ background: "#0A0A0A", borderLeft: "1px solid rgba(197,160,89,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[rgba(197,160,89,0.2)]" style={{ background: "#0A0A0A" }}>
          <div>
            <div className="font-mono-data gold text-sm">{order.order_number}</div>
            <div className="font-serif text-2xl" style={{ color: "#FAF8F5" }}>Detalle del pedido</div>
          </div>
          <button onClick={onClose} data-testid="order-detail-close"
                  className="w-9 h-9 flex items-center justify-center border border-[rgba(197,160,89,0.3)] hover:border-[#C5A059]" aria-label="Cerrar">
            <span style={{ color: "#FAF8F5" }}>✕</span>
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <MetaRow label="Nº pedido" value={order.order_number} mono />
            <MetaRow label="Estado" value={<StatusPill status={order.status} />} />
            <MetaRow label="Fecha" value={dt.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} />
            <MetaRow label="Hora" value={dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} />
            <MetaRow label="Pago" value={order.payment_status === "paid" ? "Confirmado" : "Pendiente"}
                     color={order.payment_status === "paid" ? "text-green-400" : "text-amber-400"} />
            <MetaRow label="Total" value={formatMoney(order.total)} bold />
          </div>

          {/* Timeline */}
          <div className="border border-[rgba(197,160,89,0.2)] p-5">
            <div className="label-eyebrow gold mb-4">Progreso del envío</div>
            <ol className="flex items-center justify-between text-[10px] uppercase tracking-widest">
              {STATUS_ORDER.map((s, i) => {
                const done = currentIdx >= i;
                return (
                  <li key={s} className="flex-1 flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${done ? "bg-[#C5A059]" : "bg-white/10"}`} />
                    {i < STATUS_ORDER.length - 1 && (
                      <div className={`absolute h-px ${done ? "bg-[#C5A059]" : "bg-white/10"}`}
                           style={{ width: `${100 / (STATUS_ORDER.length - 1)}%`, transform: "translate(50%, -6px)" }} />
                    )}
                    <div className={`mt-2 text-center ${done ? "text-[#C5A059]" : "text-white/30"}`}>
                      {ORDER_STATUS_LABEL[s]?.replace(/_/g, " ") || s}
                    </div>
                  </li>
                );
              })}
            </ol>
            {order.status === "cancelled" && (
              <div className="mt-4 text-xs text-red-400">Este pedido fue cancelado.</div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="label-eyebrow gold mb-3">Productos ({order.items?.length || 0})</div>
            <div className="space-y-3">
              {(order.items || []).map((it, i) => {
                const img = it.image_url || it.image || "/brand/logo.png";
                return (
                  <div key={i} className="flex gap-4 border border-[rgba(197,160,89,0.15)] p-3" data-testid={`order-item-${i}`}>
                    <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-white/5">
                      <img src={img} alt={it.name} className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#FAF8F5" }}>{it.name}</div>
                      {it.variant && <div className="text-xs text-white/50 mt-0.5">{it.variant}</div>}
                      <div className="text-xs text-white/60 mt-1">{it.qty} × {formatMoney(it.unit_price ?? it.price)}</div>
                    </div>
                    <div className="text-right font-serif" style={{ color: "#FAF8F5" }}>
                      {formatMoney((it.line_total ?? (it.qty * (it.unit_price ?? it.price ?? 0))))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales */}
          <div className="border border-[rgba(197,160,89,0.2)] p-5 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-white/60">Subtotal</span><span>{formatMoney(order.subtotal || 0)}</span></div>
            {(order.vat_total ?? 0) > 0 && (
              <div className="flex justify-between"><span className="text-white/60">IVA</span><span>{formatMoney(order.vat_total)}</span></div>
            )}
            {(order.shipping ?? 0) > 0 && (
              <div className="flex justify-between"><span className="text-white/60">Envío</span><span>{formatMoney(order.shipping)}</span></div>
            )}
            <div className="flex justify-between font-serif text-lg pt-2 border-t border-[rgba(197,160,89,0.15)]">
              <span>Total</span><span className="gold">{formatMoney(order.total)}</span>
            </div>
          </div>

          {/* Dirección */}
          {shippingAddr.address && (
            <div>
              <div className="label-eyebrow gold mb-2">Dirección de entrega</div>
              <div className="text-sm leading-relaxed" style={{ color: "rgba(250,248,245,0.85)" }}>
                {shippingAddr.name}<br />
                {shippingAddr.address}<br />
                {shippingAddr.postal_code} {shippingAddr.city}<br />
                {shippingAddr.country}<br />
                {shippingAddr.phone && <span className="text-white/50">Tel. {shippingAddr.phone}</span>}
              </div>
            </div>
          )}

          {order.status === "pending_payment" && (
            <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              Este pedido está pendiente de pago. Si has cerrado la pasarela sin completar la transacción,
              puedes volver a la <a href="/checkout" className="underline gold">página de pago</a> o
              contactarnos por WhatsApp.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono, bold, color }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono-data" : "font-serif"} ${bold ? "text-xl" : "text-sm"} ${color || ""}`} style={{ color: color ? undefined : "#FAF8F5" }}>
        {value}
      </div>
    </div>
  );
}

function WhatsAppPanel({ customer }) {
  const [conf, setConf] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/settings/public");
        setConf(r.data.whatsapp || null);
      } catch { /* ignore */ }
    })();
  }, []);
  const phone = (conf?.phone || "").replace(/[^0-9]/g, "");
  const enabled = conf?.enabled && phone.length >= 8;
  const defaultMsg = conf?.default_message
    || `Hola, soy ${customer.first_name || customer.name || "cliente"} — me gustaría hablar con vosotros.`;
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(defaultMsg)}`;
  return (
    <div className="border border-[rgba(197,160,89,0.25)] p-8" data-testid="whatsapp-panel">
      <div className="label-eyebrow gold mb-3">Estamos a una conversación</div>
      <h2 className="font-serif text-2xl mb-4" style={{ color: "#FAF8F5" }}>Contacta con nosotros por WhatsApp</h2>
      <p className="mb-6" style={{ color: "rgba(250,248,245,0.75)" }}>
        Preferimos hablar contigo directamente para resolver dudas de pedidos, sugerir productos,
        planificar cestas o gestionar entregas B2B. Escríbenos y te responde una persona real,
        normalmente en menos de una hora en horario comercial.
      </p>
      {enabled ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="whatsapp-open-btn"
          className="inline-flex items-center gap-3 px-6 py-3 text-sm font-medium tracking-wide transition"
          style={{ background: "#25D366", color: "#0A0A0A" }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.87 11.87 0 0 0 12.03 0C5.4 0 .06 5.34.06 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.9 11.9 0 0 0 5.83 1.49h.01c6.63 0 11.97-5.34 11.97-11.97 0-3.2-1.24-6.2-3.5-8.42Zm-8.5 18.36h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.22-3.68.96.98-3.58-.24-.37a9.9 9.9 0 1 1 18.28-5.28c0 5.46-4.44 9.87-9.92 9.87Zm5.44-7.4c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.5-1.77-1.68-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.62-.93-2.22-.24-.58-.5-.5-.68-.51l-.58-.01c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.13 4.55.72.31 1.28.5 1.72.64.72.23 1.37.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/>
          </svg>
          Abrir chat en WhatsApp
        </a>
      ) : (
        <div className="text-sm" style={{ color: "rgba(250,248,245,0.6)" }}>
          El WhatsApp de la tienda aún no está publicado. Vuelve a intentarlo pronto o envíanos un
          email a <span className="gold">pedidos@lasdosdoncellasibericos.es</span>.
        </div>
      )}
      {enabled && (
        <div className="mt-6 text-xs" style={{ color: "rgba(250,248,245,0.5)" }}>
          Horario: L–V 09:00–18:00 · S 10:00–14:00 (península). Fuera de horario respondemos lo antes posible.
        </div>
      )}
    </div>
  );
}
