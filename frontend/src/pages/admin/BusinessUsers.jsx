import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Building2, Percent, CreditCard } from "lucide-react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";
import useSort, { SortHeader } from "@/components/admin/useSort";

const PAYMENT_TERMS = ["Contado", "15 días", "30 días", "60 días", "90 días"];

const EMPTY = {
  company_name: "", tax_id: "", contact_name: "",
  email: "", phone: "",
  address: "", city: "", postal_code: "", country: "España",
  discount_pct: 0, payment_terms: "Contado", credit_limit: 0,
  notes: "", tags: "", is_active: true,
};

export default function BusinessUsersAdmin() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/business-customers");
      setRows(data);
    } catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterRows(rows, q), [rows, q]);
  const { sorted, sortBy, sort } = useSort(filtered, "company_name", "asc");

  const onDelete = async (b) => {
    if (!window.confirm(`¿Eliminar a ${b.company_name}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/business-customers/${b.id}`);
      toast.success("Cliente empresa eliminado");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Cuentas profesionales</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
            <Building2 size={28} className="text-[#C5A059]" />
            Usuarios Empresa
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xl">
            HORECA, distribución y clientes recurrentes con condiciones especiales.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TableFilter value={q} onChange={setQ} placeholder="Buscar por empresa, CIF, email…" testid="biz-filter" />
          <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="biz-new">
            <Plus size={14} /> Nuevo cliente empresa
          </button>
        </div>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <SortHeader label="Empresa" sortKey="company_name" sort={sort} sortBy={sortBy} className="py-3 px-4" />
              <SortHeader label="CIF/NIF" sortKey="tax_id" sort={sort} sortBy={sortBy} />
              <SortHeader label="Contacto" sortKey="contact_name" sort={sort} sortBy={sortBy} />
              <SortHeader label="Email" sortKey="email" sort={sort} sortBy={sortBy} />
              <SortHeader label="Localidad" sortKey="city" sort={sort} sortBy={sortBy} />
              <SortHeader label="Descuento" sortKey="discount_pct" sort={sort} sortBy={sortBy} className="text-right" />
              <SortHeader label="Pago" sortKey="payment_terms" sort={sort} sortBy={sortBy} />
              <SortHeader label="Estado" sortKey="is_active" sort={sort} sortBy={sortBy} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-12 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">
                {rows.length === 0 ? (
                  <>Sin clientes empresa todavía. <button onClick={() => setEditing("new")} className="underline" data-testid="biz-empty-new">Crea el primero</button>.</>
                ) : "Ningún cliente coincide con el filtro."}
              </td></tr>
            )}
            {sorted.map((b) => (
              <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`biz-row-${b.id}`}>
                <td className="px-4 py-3 font-medium">{b.company_name}</td>
                <td className="mono text-xs">{b.tax_id}</td>
                <td className="text-gray-600">{b.contact_name || "—"}</td>
                <td className="mono text-xs">{b.email}</td>
                <td className="text-gray-600">{b.city || "—"}</td>
                <td className="text-right mono">
                  {b.discount_pct > 0 ? <span className="text-green-700">−{b.discount_pct}%</span> : <span className="text-gray-400">—</span>}
                </td>
                <td className="text-gray-600 text-xs">{b.payment_terms || "Contado"}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 ${b.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                    {b.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <button onClick={() => setEditing(b)} className="p-2 hover:bg-gray-100" data-testid={`biz-edit-${b.id}`}><Pencil size={14} /></button>
                  <button onClick={() => onDelete(b)} className="p-2 hover:bg-red-50 text-red-600" data-testid={`biz-delete-${b.id}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <BusinessDrawer
          initial={editing === "new" ? EMPTY : { ...editing, tags: (editing.tags || []).join(", ") }}
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          onSaved={() => { load(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function BusinessDrawer({ initial, isNew, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked
              : e.target.type === "number" ? Number(e.target.value)
              : e.target.value;
    setForm({ ...form, [k]: val });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: typeof form.tags === "string"
        ? form.tags.split(",").map((s) => s.trim()).filter(Boolean)
        : form.tags,
      discount_pct: Number(form.discount_pct) || 0,
      credit_limit: Number(form.credit_limit) || 0,
    };
    try {
      if (isNew) await api.post("/business-customers", payload);
      else await api.patch(`/business-customers/${form.id}`, payload);
      toast.success(isNew ? "Cliente empresa creado" : "Cambios guardados");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="biz-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo" : "Editando"}</div>
            <div className="font-serif text-2xl flex items-center gap-2">
              <Building2 size={20} className="text-[#C5A059]" />
              {form.company_name || "Cliente empresa"}
            </div>
          </div>
          <button onClick={onClose} data-testid="biz-drawer-close"><X size={20} /></button>
        </div>

        <form onSubmit={save} className="p-6 space-y-6">
          <div>
            <div className="label-eyebrow text-gray-500 mb-3">Datos fiscales</div>
            <div className="grid grid-cols-2 gap-4">
              <I label="Razón social *" required value={form.company_name} onChange={set("company_name")} testid="biz-company" />
              <I label="CIF/NIF *" required value={form.tax_id} onChange={set("tax_id")} testid="biz-tax" placeholder="B12345678" />
              <I label="Persona de contacto" value={form.contact_name} onChange={set("contact_name")} testid="biz-contact" />
              <I label="Email *" type="email" required value={form.email} onChange={set("email")} testid="biz-email" />
              <I label="Teléfono" value={form.phone} onChange={set("phone")} testid="biz-phone" />
              <I label="Tags (coma)" value={form.tags} onChange={set("tags")} testid="biz-tags" placeholder="HORECA, distribución" />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="label-eyebrow text-gray-500 mb-3">Dirección fiscal</div>
            <div className="grid grid-cols-2 gap-4">
              <I className="col-span-2" label="Dirección" value={form.address} onChange={set("address")} testid="biz-address" />
              <I label="Ciudad" value={form.city} onChange={set("city")} testid="biz-city" />
              <I label="Código postal" value={form.postal_code} onChange={set("postal_code")} testid="biz-postal" />
              <I label="País" value={form.country} onChange={set("country")} testid="biz-country" />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="label-eyebrow text-gray-500 mb-3 flex items-center gap-2">
              <Percent size={12} /> Condiciones comerciales
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label-eyebrow text-gray-500 block mb-1">Descuento (%)</label>
                <input type="number" min={0} max={100} step={0.5} value={form.discount_pct} onChange={set("discount_pct")} data-testid="biz-discount"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
              </div>
              <div>
                <label className="label-eyebrow text-gray-500 block mb-1">Condiciones de pago</label>
                <select value={form.payment_terms} onChange={set("payment_terms")} data-testid="biz-payment-terms"
                  className="w-full border border-gray-200 px-3 py-2 text-sm bg-white focus:border-black outline-none">
                  {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label-eyebrow text-gray-500 block mb-1 flex items-center gap-1"><CreditCard size={11} /> Límite crédito (€)</label>
                <input type="number" min={0} step={100} value={form.credit_limit} onChange={set("credit_limit")} data-testid="biz-credit-limit"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" placeholder="0 = sin límite" />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="label-eyebrow text-gray-500 block mb-1">Notas internas</label>
            <textarea rows={4} value={form.notes} onChange={set("notes")} data-testid="biz-notes"
              placeholder="Visita comercial mensual, factura papel, alérgenos…"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} data-testid="biz-active" /> Cuenta activa
          </label>

          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-50" data-testid="biz-save">
            {saving ? "Guardando…" : (isNew ? "Crear cliente empresa" : "Guardar cambios")}
          </button>
        </form>
      </div>
    </div>
  );
}

function I({ label, testid, className = "", ...rest }) {
  return (
    <div className={className}>
      <label className="label-eyebrow text-gray-500 block mb-1">{label}</label>
      <input data-testid={testid} {...rest} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
    </div>
  );
}
