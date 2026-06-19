import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Mail, X, BarChart3, Search } from "lucide-react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import ExcelBar from "@/components/admin/ExcelBar";

const EMPTY = {
  name: "", company: "", contact_name: "", email: "", phone: "",
  address: "", city: "", postal_code: "", country: "España", tax_id: "",
  website: "", payment_terms: "", notes: "", tags: "", is_active: true,
};

export default function ProvidersAdmin() {
  const [providers, setProviders] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [statsFor, setStatsFor] = useState(null);
  const [emailFor, setEmailFor] = useState(null);

  const load = async () => {
    const { data } = await api.get("/providers", { params: { q: q || undefined } });
    setProviders(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const onDelete = async (p) => {
    if (!confirm(`¿Eliminar proveedor ${p.name}?`)) return;
    try {
      await api.delete(`/providers/${p.id}`);
      toast.success("Proveedor eliminado");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Cadena de suministro</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Proveedores</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ExcelBar entity="providers" onImported={load} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Buscar nombre, email…"
              className="pl-9 pr-3 py-2 border border-gray-200 text-sm bg-white outline-none focus:border-black" data-testid="providers-search" />
          </div>
          <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="providers-new">
            <Plus size={14} /> Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-3 px-4">Nombre</th>
              <th>Empresa</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-gray-400">Sin proveedores. <button onClick={() => setEditing("new")} className="underline">Crea el primero</button>.</td></tr>}
            {providers.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`provider-row-${p.id}`}>
                <td className="py-3 px-4 font-medium">{p.name}</td>
                <td className="text-gray-600">{p.company}</td>
                <td className="mono text-xs">{p.email}</td>
                <td className="text-gray-600">{p.phone}</td>
                <td><span className={`text-xs px-2 py-0.5 ${p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>{p.is_active ? "Activo" : "Inactivo"}</span></td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <button onClick={() => setStatsFor(p)} className="p-2 hover:bg-gray-100" title="Estadísticas" data-testid={`provider-stats-${p.id}`}><BarChart3 size={14} /></button>
                  <button onClick={() => setEmailFor(p)} className="p-2 hover:bg-gray-100" title="Enviar email" data-testid={`provider-email-${p.id}`}><Mail size={14} /></button>
                  <button onClick={() => setEditing(p)} className="p-2 hover:bg-gray-100" data-testid={`provider-edit-${p.id}`}><Pencil size={14} /></button>
                  <button onClick={() => onDelete(p)} className="p-2 hover:bg-red-50 text-red-600" data-testid={`provider-delete-${p.id}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProviderDrawer
          initial={editing === "new" ? EMPTY : { ...editing, tags: (editing.tags || []).join(", ") }}
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          onSaved={() => { load(); setEditing(null); }}
        />
      )}
      {statsFor && <StatsDrawer provider={statsFor} onClose={() => setStatsFor(null)} />}
      {emailFor && <EmailDrawer provider={emailFor} onClose={() => setEmailFor(null)} />}
    </div>
  );
}

function ProviderDrawer({ initial, isNew, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tags: typeof form.tags === "string" ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : form.tags };
    try {
      if (isNew) await api.post("/providers", payload);
      else await api.patch(`/providers/${form.id}`, payload);
      toast.success("Proveedor guardado");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="provider-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo" : "Editando"}</div>
            <div className="font-serif text-2xl">{form.name || "Proveedor"}</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <I label="Nombre *" required value={form.name} onChange={set("name")} testid="prov-name" />
            <I label="Empresa" value={form.company} onChange={set("company")} testid="prov-company" />
            <I label="Persona contacto" value={form.contact_name} onChange={set("contact_name")} testid="prov-contact" />
            <I label="CIF/NIF" value={form.tax_id} onChange={set("tax_id")} testid="prov-tax" />
            <I label="Email *" type="email" required value={form.email} onChange={set("email")} testid="prov-email" />
            <I label="Teléfono" value={form.phone} onChange={set("phone")} testid="prov-phone" />
            <I className="col-span-2" label="Dirección" value={form.address} onChange={set("address")} testid="prov-address" />
            <I label="Ciudad" value={form.city} onChange={set("city")} testid="prov-city" />
            <I label="CP" value={form.postal_code} onChange={set("postal_code")} testid="prov-postal" />
            <I label="País" value={form.country} onChange={set("country")} testid="prov-country" />
            <I label="Web" value={form.website} onChange={set("website")} testid="prov-website" />
            <I label="Condiciones de pago" value={form.payment_terms} onChange={set("payment_terms")} placeholder="30 días, contado..." testid="prov-payment" />
            <I label="Tags (coma)" value={form.tags} onChange={set("tags")} testid="prov-tags" />
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Notas</label>
            <textarea rows={3} value={form.notes} onChange={set("notes")} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" data-testid="prov-notes" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={set("is_active")} data-testid="prov-active" /> Activo</label>
          <button disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="prov-save">{saving ? "Guardando…" : (isNew ? "Crear proveedor" : "Guardar")}</button>
        </form>
      </div>
    </div>
  );
}

function StatsDrawer({ provider, onClose }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get(`/providers/${provider.id}/stats`).then((r) => setStats(r.data)).catch(() => setStats({}));
  }, [provider.id]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="provider-stats-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <div>
            <div className="label-eyebrow text-gray-500">Estadísticas</div>
            <div className="font-serif text-2xl">{provider.name}</div>
            <div className="text-xs text-gray-500 mt-1">{provider.email} {provider.phone && `· ${provider.phone}`}</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6">
          {!stats && <div className="text-gray-400">Cargando…</div>}
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Productos" value={stats.products_count} sub={`${stats.active_products} activos`} />
                <Stat label="Ingresos generados" value={formatMoney(stats.revenue || 0)} />
                <Stat label="Unidades vendidas" value={stats.units_sold || 0} />
                <Stat label="Pedidos" value={stats.orders_count || 0} />
              </div>
              <div className="mt-8">
                <div className="label-eyebrow text-gray-500 mb-3">Top productos</div>
                <table className="w-full text-sm">
                  <tbody>
                    {(stats.top_products || []).map((p) => (
                      <tr key={p.product_id} className="border-t border-gray-100">
                        <td className="py-2">{p.name}</td>
                        <td className="text-right mono text-gray-600">{p.units} uds.</td>
                        <td className="text-right mono">{formatMoney(p.revenue)}</td>
                      </tr>
                    ))}
                    {(!stats.top_products || stats.top_products.length === 0) && <tr><td className="py-4 text-gray-400 text-center" colSpan={3}>Sin ventas todavía</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailDrawer({ provider, onClose }) {
  const [subject, setSubject] = useState(`[Las Dos Doncellas] `);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim()) return toast.error("El cuerpo no puede estar vacío");
    setSending(true);
    try {
      const { data } = await api.post(`/providers/${provider.id}/email`, { subject, body });
      if (data.sent) {
        toast.success(`Email enviado a ${provider.email}`);
        onClose();
      } else {
        toast.error(data.message || "Email no enviado");
      }
    } catch (err) { toast.error(formatApiError(err)); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="provider-email-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <div>
            <div className="label-eyebrow text-gray-500">Enviar email</div>
            <div className="font-serif text-2xl">{provider.name}</div>
            <div className="text-xs text-gray-500 mt-1">→ {provider.email}</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Asunto</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" data-testid="prov-email-subject" />
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Mensaje</label>
            <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none font-mono" data-testid="prov-email-body" />
          </div>
          <button onClick={send} disabled={sending} className="px-5 py-2.5 bg-black text-[#C5A059] flex items-center gap-2" data-testid="prov-email-send">
            <Mail size={14} /> {sending ? "Enviando…" : "Enviar email"}
          </button>
        </div>
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

function Stat({ label, value, sub }) {
  return (
    <div className="border border-gray-200 p-5">
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className="font-serif text-3xl mt-2">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
