import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Warehouse } from "lucide-react";

const EMPTY = { nombre: "", tipo: "almacen", direccion: "", temperatura: "", activo: true, notas: "" };
const TIPOS = [
  { v: "almacen", l: "Almacén general" },
  { v: "camara_frigorifica", l: "Cámara frigorífica" },
  { v: "sala_loncheado", l: "Sala de loncheado" },
  { v: "tienda", l: "Tienda física" },
];

export default function InventoryLocations() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    try { const r = await api.get("/inventory/locations"); setRows(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const del = async (l) => {
    if (!window.confirm(`¿Eliminar ${l.nombre}?`)) return;
    try { await api.delete(`/inventory/locations/${l.id}`); toast.success("Eliminada"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} ubicaciones</div>
        <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="loc-new"><Plus size={14} />Nueva ubicación</button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3">Nombre</th><th>Tipo</th><th>Temperatura</th><th>Dirección</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{l.nombre}</td>
                <td><span className="text-xs px-2 py-0.5 bg-gray-100">{TIPOS.find((t) => t.v === l.tipo)?.l || l.tipo}</span></td>
                <td className="text-xs">{l.temperatura || "—"}</td>
                <td className="text-xs text-gray-500">{l.direccion || "—"}</td>
                <td><span className={`text-xs px-2 py-0.5 ${l.activo ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>{l.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="text-right pr-2 whitespace-nowrap">
                  <button onClick={() => setEditing(l)} className="p-1.5 hover:bg-gray-100"><Pencil size={12} /></button>
                  <button onClick={() => del(l)} className="p-1.5 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin ubicaciones</td></tr>}
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
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [k]: v });
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/inventory/locations", form);
      else await api.patch(`/inventory/locations/${form.id}`, form);
      toast.success("Guardada"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()} data-testid="loc-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2"><Warehouse size={20} className="text-[#C5A059]" />{form.nombre || "Ubicación"}</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <F label="Tipo">
            <select value={form.tipo} onChange={set("tipo")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </F>
          <F label="Temperatura"><input value={form.temperatura || ""} onChange={set("temperatura")} placeholder="ej. 4°C / -18°C / Ambiente" className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <F label="Dirección"><input value={form.direccion || ""} onChange={set("direccion")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <F label="Notas"><textarea rows={2} value={form.notas || ""} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={set("activo")} /> Activo</label>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
