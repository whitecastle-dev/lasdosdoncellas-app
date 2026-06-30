import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Users } from "lucide-react";

const EMPTY = {
  nombre: "", contacto: "", categoria: "minorista",
  tarifa_sin_emplatado_menor: 0, tarifa_sin_emplatado_mayor: 0, tarifa_emplatado: 0,
  direccion: "", cif_nif: "", email: "", activo: true, notas: "",
};

export default function ErpClients() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    try { const { data } = await api.get("/erp/clients"); setRows(data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const onDelete = async (c) => {
    if (!window.confirm(`¿Eliminar ${c.nombre}?`)) return;
    try { await api.delete(`/erp/clients/${c.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} clientes de producción</div>
        <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="pclient-new">
          <Plus size={14} /> Nuevo cliente
        </button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="px-4 py-3">Nombre</th><th>Categoría</th><th>Contacto</th><th className="text-right">€/kg menor</th><th className="text-right">€/kg mayor</th><th className="text-right">€/kg emplatado</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`pclient-row-${c.id}`}>
                <td className="px-4 py-2 font-medium">{c.nombre}</td>
                <td><span className="text-xs px-2 py-0.5 bg-gray-100">{c.categoria}</span></td>
                <td className="text-gray-600 text-xs">{c.contacto || "—"}</td>
                <td className="text-right mono">{formatMoney(c.tarifa_sin_emplatado_menor)}</td>
                <td className="text-right mono">{formatMoney(c.tarifa_sin_emplatado_mayor)}</td>
                <td className="text-right mono">{formatMoney(c.tarifa_emplatado)}</td>
                <td className="text-right pr-2 whitespace-nowrap">
                  <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-gray-100"><Pencil size={12} /></button>
                  <button onClick={() => onDelete(c)} className="p-1.5 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <Drawer initial={editing === "new" ? EMPTY : editing} isNew={editing === "new"} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Drawer({ initial, isNew, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/erp/clients", form);
      else await api.patch(`/erp/clients/${form.id}`, form);
      toast.success(isNew ? "Cliente creado" : "Cambios guardados"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="pclient-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo cliente" : "Editando"}</div>
            <div className="font-serif text-2xl flex items-center gap-2 mt-1"><Users size={20} className="text-[#C5A059]" />{form.nombre || "Cliente"}</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Categoría">
              <select value={form.categoria} onChange={set("categoria")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
                <option value="minorista">Minorista</option><option value="mayorista">Mayorista</option><option value="particular">Particular</option>
              </select>
            </F>
            <F label="Contacto"><input value={form.contacto || ""} onChange={set("contacto")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="CIF/NIF"><input value={form.cif_nif || ""} onChange={set("cif_nif")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Email"><input type="email" value={form.email || ""} onChange={set("email")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Dirección"><input value={form.direccion || ""} onChange={set("direccion")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <div className="label-eyebrow text-gray-500 mb-2">Tarifas (€/kg)</div>
            <div className="grid grid-cols-3 gap-4">
              <F label="Sin emplatado menor"><input type="number" step="0.01" value={form.tarifa_sin_emplatado_menor} onChange={set("tarifa_sin_emplatado_menor")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <F label="Sin emplatado mayor"><input type="number" step="0.01" value={form.tarifa_sin_emplatado_mayor} onChange={set("tarifa_sin_emplatado_mayor")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <F label="Emplatado"><input type="number" step="0.01" value={form.tarifa_emplatado} onChange={set("tarifa_emplatado")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            </div>
          </div>
          <F label="Notas"><textarea rows={3} value={form.notas || ""} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={set("activo")} /> Activo</label>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
