import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Tag } from "lucide-react";

const EMPTY = { nombre: "", categoria: "", activo: true, coste_kg: 0, rendimiento_esperado: 0.85, notas: "" };

export default function ErpProdProducts() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    try { const { data } = await api.get("/erp/products"); setRows(data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const onDelete = async (p) => {
    if (!window.confirm(`¿Eliminar ${p.nombre}?`)) return;
    try { await api.delete(`/erp/products/${p.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} tipos de pieza</div>
        <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="ppro-new">
          <Plus size={14} /> Nuevo tipo
        </button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3">Nombre</th><th>Categoría</th><th className="text-right">Coste €/kg</th><th className="text-right">Rendimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{p.nombre}</td>
                <td className="text-gray-600">{p.categoria || "—"}</td>
                <td className="text-right mono">{formatMoney(p.coste_kg || 0)}</td>
                <td className="text-right mono text-xs">{((p.rendimiento_esperado || 0) * 100).toFixed(0)}%</td>
                <td><span className={`text-xs px-2 py-0.5 ${p.activo ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="text-right pr-2 whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-gray-100"><Pencil size={12} /></button>
                  <button onClick={() => onDelete(p)} className="p-1.5 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin productos</td></tr>}
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
      if (isNew) await api.post("/erp/products", form);
      else await api.patch(`/erp/products/${form.id}`, form);
      toast.success("Guardado"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2"><Tag size={18} className="text-[#C5A059]" />{form.nombre || "Tipo de pieza"}</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <F label="Categoría"><input value={form.categoria || ""} onChange={set("categoria")} className="w-full border border-gray-200 px-3 py-2 text-sm" placeholder="Bellota, Cebo, Cebo 50%…" /></F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Coste €/kg"><input type="number" step="0.01" value={form.coste_kg || 0} onChange={set("coste_kg")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Rendimiento esperado (0-1)"><input type="number" step="0.01" min="0" max="1" value={form.rendimiento_esperado || 0.85} onChange={set("rendimiento_esperado")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Notas"><textarea rows={2} value={form.notas || ""} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={set("activo")} /> Activo</label>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
