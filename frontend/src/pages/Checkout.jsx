import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Pencil } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
  name: "", email: "", phone: "", address: "", city: "",
  postal_code: "", country: "España", tax_id: "", notes: "",
};

function billingFromAddress(addr, customer) {
  return {
    name: addr.full_name || customer?.name || "",
    email: customer?.email || "",
    phone: addr.phone || customer?.phone || "",
    address: addr.address || "",
    city: addr.city || "",
    postal_code: addr.postal_code || "",
    country: addr.country || "España",
    tax_id: addr.tax_id || customer?.tax_id || "",
    notes: "",
  };
}

export default function Checkout() {
  const { items, total } = useCart();
  const { customer } = useCustomer();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  // When customer logs in or addresses change, auto-prefill with default billing
  useEffect(() => {
    if (customer) {
      const def = (customer.addresses || []).find((a) => a.is_default_billing) || (customer.addresses || [])[0];
      if (def) {
        setForm(billingFromAddress(def, customer));
      } else {
        setForm((f) => ({ ...f, name: customer.name || "", email: customer.email || "", phone: customer.phone || "" }));
      }
    }
  }, [customer]);

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const startCheckout = async () => {
    if (items.length === 0) { toast.error("Tu cesta está vacía"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/checkout/session", {
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        customer: form,
        origin_url: window.location.origin,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiError(err));
      setSubmitting(false);
    }
  };

  const submit = (e) => { e.preventDefault(); startCheckout(); };

  const canQuickBuy = customer && (customer.addresses || []).some((a) => a.is_default_billing);
  const defaultAddr = customer?.addresses?.find((a) => a.is_default_billing);

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <div className="max-w-[1300px] mx-auto px-6 lg:px-12 py-16">
        <div className="label-eyebrow gold mb-3">Pago seguro</div>
        <h1 className="font-serif text-4xl md:text-6xl tracking-tighter" style={{ color: "#FAF8F5" }}>Finalizar compra</h1>

        {/* Steps indicator */}
        <div className="flex items-center gap-3 mt-6 text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(250,248,245,0.6)" }}>
          <span className="text-[#C5A059]">1. Datos</span>
          <span>→</span>
          <span>2. Pago Stripe</span>
          <span>→</span>
          <span>3. Confirmación</span>
        </div>

        {/* Quick-buy banner */}
        {canQuickBuy && !editing && (
          <div className="mt-10 border border-[#C5A059] p-6 flex items-center justify-between gap-6 flex-wrap" style={{ background: "rgba(197,160,89,0.06)" }} data-testid="quick-buy-banner">
            <div>
              <div className="flex items-center gap-2 label-eyebrow gold mb-2"><Zap size={14} /> Comprar ya con tus datos guardados</div>
              <div className="text-sm" style={{ color: "rgba(250,248,245,0.85)" }}>
                <strong>{form.name}</strong> · {form.address}, {form.postal_code} {form.city}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowQuickConfirm(true)} className="ldd-btn-gold" data-testid="buy-now-button">
                <Zap size={14} /> Comprar ya
              </button>
              <button onClick={() => setEditing(true)} className="ldd-btn-ghost text-xs" data-testid="edit-data-button">
                <Pencil size={12} /> Modificar
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_440px] gap-12 lg:gap-20 mt-10">
          <form onSubmit={submit} className="space-y-6" data-testid="checkout-form">
            {(!canQuickBuy || editing) && (
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Nombre completo" required value={form.name} onChange={onChange("name")} testid="checkout-name" />
                <Field label="Email" type="email" required value={form.email} onChange={onChange("email")} testid="checkout-email" />
                <Field label="Teléfono" value={form.phone} onChange={onChange("phone")} testid="checkout-phone" />
                <Field label="NIF/CIF" value={form.tax_id} onChange={onChange("tax_id")} testid="checkout-tax-id" />
                <Field className="sm:col-span-2" label="Dirección" required value={form.address} onChange={onChange("address")} testid="checkout-address" />
                <Field label="Ciudad" required value={form.city} onChange={onChange("city")} testid="checkout-city" />
                <Field label="Código postal" required value={form.postal_code} onChange={onChange("postal_code")} testid="checkout-postal" />
                <Field className="sm:col-span-2" label="País" required value={form.country} onChange={onChange("country")} testid="checkout-country" />
              </div>
            )}
            {(!canQuickBuy || editing) && (
              <div>
                <label className="label-eyebrow gold block mb-2">Notas (opcional)</label>
                <textarea value={form.notes} onChange={onChange("notes")} rows={3} data-testid="checkout-notes"
                  className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm rounded-none" />
              </div>
            )}
            {(!canQuickBuy || editing) && (
              <button type="submit" disabled={submitting} className="ldd-btn-gold disabled:opacity-50" data-testid="checkout-submit">
                {submitting ? "Redirigiendo a Stripe…" : "Pagar con Stripe"}
              </button>
            )}
            {!customer && (
              <p className="text-xs mt-4" style={{ color: "rgba(250,248,245,0.5)" }}>
                ¿Tienes cuenta? <a href="/cuenta/login" className="gold hover:underline">Accede</a> para usar tus datos guardados.
              </p>
            )}
          </form>

          <aside className="lg:sticky lg:top-28 self-start">
            <div className="border border-[rgba(197,160,89,0.25)] p-6">
              <div className="label-eyebrow gold mb-4">Tu pedido</div>
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {items.map((i) => (
                  <div key={i.product_id} className="flex justify-between text-sm" data-testid={`summary-item-${i.product_id}`}>
                    <span>{i.name} <span style={{ color: "rgba(250,248,245,0.5)" }}>× {i.qty}</span></span>
                    <span className="font-mono-data">{formatMoney(i.price * i.qty)}</span>
                  </div>
                ))}
                {items.length === 0 && <div className="text-sm" style={{ color: "rgba(250,248,245,0.5)" }}>Cesta vacía</div>}
              </div>
              <div className="border-t border-[rgba(197,160,89,0.25)] mt-6 pt-4 flex items-center justify-between">
                <span className="label-eyebrow">Total (IVA incl.)</span>
                <span className="font-serif text-3xl gold" data-testid="checkout-total">{formatMoney(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showQuickConfirm && (
        <div className="fixed inset-0 z-50 cart-backdrop flex items-center justify-center px-6" onClick={() => setShowQuickConfirm(false)}>
          <div className="bg-[#0A0A0A] border border-[#C5A059] max-w-md w-full p-8" onClick={(e) => e.stopPropagation()} data-testid="quick-buy-modal">
            <div className="label-eyebrow gold mb-2">Confirmar compra</div>
            <h2 className="font-serif text-3xl tracking-tighter" style={{ color: "#FAF8F5" }}>¿Todo correcto?</h2>
            <div className="mt-5 space-y-3 text-sm" style={{ color: "rgba(250,248,245,0.85)" }}>
              <div><span className="label-eyebrow gold block">Envío a</span>{form.name}<br/>{form.address}, {form.postal_code} {form.city}<br/>{form.country}<br/>{form.phone}</div>
              <div><span className="label-eyebrow gold block">NIF/CIF</span>{form.tax_id || "—"}</div>
              <div className="border-t border-[rgba(197,160,89,0.2)] pt-3 flex justify-between"><span className="label-eyebrow">Total</span><span className="font-serif text-2xl gold">{formatMoney(total)}</span></div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setShowQuickConfirm(false); startCheckout(); }} className="ldd-btn-gold flex-1 justify-center" data-testid="quick-buy-confirm">
                <Zap size={14} /> Pagar ahora
              </button>
              <button onClick={() => { setShowQuickConfirm(false); setEditing(true); }} className="ldd-btn-ghost flex-1" data-testid="quick-buy-edit">
                Modificar datos
              </button>
            </div>
            {defaultAddr && (
              <p className="text-xs mt-4 text-center" style={{ color: "rgba(250,248,245,0.45)" }}>
                Usando "{defaultAddr.label}" como dirección por defecto.
              </p>
            )}
          </div>
        </div>
      )}

      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, className = "", testid }) {
  return (
    <div className={className}>
      <label className="label-eyebrow gold block mb-2">{label}{required && " *"}</label>
      <input type={type} value={value} onChange={onChange} required={required} data-testid={testid}
        className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm rounded-none" />
    </div>
  );
}
