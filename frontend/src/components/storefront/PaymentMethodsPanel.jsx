import React, { useState } from "react";
import { CreditCard, Plus, Trash2, Star, ShieldCheck, Zap } from "lucide-react";
import { customerApi } from "@/context/CustomerContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", maestro: "Maestro", otra: "Tarjeta" };

export function detectBrand(num) {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(50|5[6-9]|6)/.test(n)) return "maestro";
  return n ? "otra" : "";
}

export function luhnOk(num) {
  const n = num.replace(/\D/g, "");
  if (n.length < 12 || n.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const inputCls = "w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm";

export function CardChip({ pm, compact = false }) {
  return (
    <span className="inline-flex items-center gap-2" data-testid={`card-chip-${pm.id}`}>
      <CreditCard size={compact ? 12 : 14} className="text-[#C5A059]" />
      <span className={compact ? "text-xs" : "text-sm"} style={{ color: "#FAF8F5" }}>
        {BRAND_LABEL[pm.brand] || "Tarjeta"} •••• {pm.last4}
      </span>
    </span>
  );
}

export default function PaymentMethodsPanel({ customer, refresh }) {
  const methods = customer.payment_methods || [];
  const [adding, setAdding] = useState(false);

  const setDefault = async (id) => {
    try {
      await customerApi.patch(`/payment-methods/${id}`, { is_default: true });
      await refresh();
      toast.success("Forma de pago predeterminada actualizada");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar esta tarjeta?")) return;
    try {
      await customerApi.delete(`/payment-methods/${id}`);
      await refresh();
      toast.success("Tarjeta eliminada");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div data-testid="payment-methods-panel">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-serif text-2xl" style={{ color: "#FAF8F5" }}>Tus formas de pago</h2>
        <button onClick={() => setAdding(true)} className="ldd-btn-ghost text-xs" data-testid="payment-add-button">
          <Plus size={14} /> Añadir tarjeta
        </button>
      </div>

      {methods.length === 0 && !adding && (
        <p className="text-sm mb-6" style={{ color: "rgba(250,248,245,0.6)" }} data-testid="payment-empty-state">
          Aún no has guardado ninguna tarjeta. Añade una y márcala como predeterminada para activar
          <span className="gold"> &ldquo;Comprar ya&rdquo;</span> en el checkout.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {methods.map((pm) => (
          <div key={pm.id} className={`border p-5 ${pm.is_default ? "border-[#C5A059]" : "border-[rgba(197,160,89,0.2)]"}`} data-testid={`payment-card-${pm.id}`}>
            <div className="flex items-start justify-between mb-3">
              <CardChip pm={pm} />
              <div className="flex gap-2">
                {!pm.is_default && (
                  <button onClick={() => setDefault(pm.id)} title="Hacer predeterminada" className="text-[#FAF8F5]/60 hover:text-[#C5A059]" data-testid={`payment-default-${pm.id}`}>
                    <Star size={14} />
                  </button>
                )}
                <button onClick={() => remove(pm.id)} className="text-[#FAF8F5]/60 hover:text-[#8C211E]" data-testid={`payment-delete-${pm.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-sm" style={{ color: "rgba(250,248,245,0.8)" }}>
              <div>{pm.holder}</div>
              <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.5)" }}>
                Caduca {String(pm.exp_month).padStart(2, "0")}/{String(pm.exp_year).slice(-2)}{pm.label ? ` · ${pm.label}` : ""}
              </div>
            </div>
            {pm.is_default && (
              <div className="mt-3 text-xs text-[#C5A059] flex items-center gap-1" data-testid={`payment-default-badge-${pm.id}`}>
                <Zap size={10} /> Predeterminada · activa &ldquo;Comprar ya&rdquo;
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && <AddCardForm onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} defaultHolder={customer.name || ""} />}

      <div className="mt-8 flex items-start gap-3 text-xs" style={{ color: "rgba(250,248,245,0.5)" }}>
        <ShieldCheck size={14} className="text-[#C5A059] flex-shrink-0 mt-0.5" />
        <span>
          Por seguridad nunca almacenamos el número completo de tu tarjeta: solo guardamos la marca, los últimos 4 dígitos
          y la caducidad. El cobro se realiza siempre en la pasarela segura del banco.
        </span>
      </div>
    </div>
  );
}

function AddCardForm({ onClose, onSaved, defaultHolder }) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState(defaultHolder);
  const [exp, setExp] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const brand = detectBrand(number);

  const fmtNumber = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const fmtExp = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!luhnOk(number)) { toast.error("El número de tarjeta no es válido"); return; }
    const [mm, yy] = exp.split("/");
    const exp_month = Number(mm);
    const exp_year = 2000 + Number(yy);
    if (!exp_month || !yy || yy.length !== 2) { toast.error("Caducidad inválida (MM/AA)"); return; }
    setSaving(true);
    try {
      const digits = number.replace(/\D/g, "");
      await customerApi.post("/payment-methods", {
        brand: brand || "otra", last4: digits.slice(-4), exp_month, exp_year,
        holder: holder.trim(), label: label.trim(), is_default: isDefault,
      });
      toast.success("Tarjeta guardada");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="mt-8 border border-[rgba(197,160,89,0.3)] p-6 space-y-4" data-testid="payment-form">
      <div className="label-eyebrow gold">Nueva tarjeta</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label-eyebrow gold block mb-2">Número de tarjeta</label>
          <div className="relative">
            <input data-testid="card-number" inputMode="numeric" autoComplete="cc-number" value={number} onChange={(e) => setNumber(fmtNumber(e.target.value))} required className={inputCls} placeholder="1234 5678 9012 3456" />
            {brand && <span className="absolute right-3 top-2 text-xs gold uppercase tracking-widest" data-testid="card-brand">{BRAND_LABEL[brand]}</span>}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label-eyebrow gold block mb-2">Titular</label>
          <input data-testid="card-holder" autoComplete="cc-name" value={holder} onChange={(e) => setHolder(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="label-eyebrow gold block mb-2">Caducidad (MM/AA)</label>
          <input data-testid="card-exp" inputMode="numeric" autoComplete="cc-exp" value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} required className={inputCls} placeholder="12/27" />
        </div>
        <div>
          <label className="label-eyebrow gold block mb-2">Alias (opcional)</label>
          <input data-testid="card-label" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="Personal, Empresa…" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm" style={{ color: "rgba(250,248,245,0.85)" }}>
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} data-testid="card-default" />
        Guardar como forma de pago predeterminada
      </label>
      <div className="flex gap-3">
        <button disabled={saving} className="ldd-btn-gold" data-testid="card-save">{saving ? "Guardando…" : "Guardar tarjeta"}</button>
        <button type="button" onClick={onClose} className="ldd-btn-ghost" data-testid="card-cancel">Cancelar</button>
      </div>
    </form>
  );
}
