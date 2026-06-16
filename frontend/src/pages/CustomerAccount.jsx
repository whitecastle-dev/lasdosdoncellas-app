import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, LogOut, MapPin, Package, Check } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import { useCustomer, customerApi } from "@/context/CustomerContext";
import { formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";

export default function CustomerAccount() {
  const { customer, loading, logout, refresh } = useCustomer();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("profile");
  const [editingAddr, setEditingAddr] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (customer) {
      customerApi.get("/orders").then((r) => setOrders(r.data)).catch(() => {});
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
            <h1 className="font-serif text-4xl md:text-5xl tracking-tighter" style={{ color: "#FAF8F5" }}>Hola, {customer.name?.split(" ")[0]}</h1>
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
                  Pronto podrás guardar tu tarjeta de forma segura (vía Stripe) para activar el botón
                  <span className="gold"> "Comprar ya"</span>. Por ahora, paga con Stripe en cada compra y guarda tu dirección
                  para acelerar el proceso.
                </p>
              </div>
            )}
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

function OrdersList({ orders }) {
  if (!orders.length) return <p className="text-sm" style={{ color: "rgba(250,248,245,0.6)" }}>Aún no tienes pedidos.</p>;
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="border border-[rgba(197,160,89,0.18)] p-5 flex items-center justify-between" data-testid={`my-order-${o.id}`}>
          <div>
            <div className="font-mono-data text-sm gold">{o.order_number}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }}>{new Date(o.created_at).toLocaleString("es-ES")} · {o.status}</div>
          </div>
          <div className="text-right">
            <div className="font-serif text-xl" style={{ color: "#FAF8F5" }}>{formatMoney(o.total)}</div>
            <div className="flex items-center gap-1 text-xs text-[#C5A059] justify-end mt-1"><Package size={11} /> {o.items?.length || 0} productos</div>
          </div>
        </div>
      ))}
    </div>
  );
}