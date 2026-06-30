import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Trash2, Tags } from "lucide-react";

export default function ErpLabels() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", tipo_pieza: "JAMON", peso: 0, fecha: new Date().toISOString().slice(0, 10) });
  const load = async () => {
    try { const { data } = await api.get("/erp/labels"); setRows(data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const onDelete = async (l) => {
    if (!window.confirm(`¿Eliminar etiqueta de ${l.nombre}?`)) return;
    try { await api.delete(`/erp/labels/${l.id}`); toast.success("Eliminada"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/erp/labels", form);
      toast.success("Etiqueta creada");
      setOpen(false);
      setForm({ nombre: "", telefono: "", tipo_pieza: "JAMON", peso: 0, fecha: new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} etiquetas</div>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="lbl-new">
          <Plus size={14} /> Nueva etiqueta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.length === 0 && <div className="col-span-full py-10 text-center text-gray-400">Sin etiquetas</div>}
        {rows.map((l) => (
          <div key={l.id} className="cms-card p-4 border border-gray-200" data-testid={`lbl-card-${l.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Tags size={16} className="text-[#C5A059]" /><div className="font-medium">{l.nombre}</div></div>
              <button onClick={() => onDelete(l)} className="p-1 text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
            </div>
            <div className="mt-2 text-sm text-gray-600">{l.telefono || "—"}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 bg-gray-100">{l.tipo_pieza}</span>
              <div className="font-serif text-lg">{(l.peso || 0).toFixed(2)} kg</div>
            </div>
            <div className="mt-2 text-xs text-gray-400">{l.fecha}</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="lbl-drawer">
            <div className="flex items-center justify-between mb-4">
              <div className="font-serif text-xl flex items-center gap-2"><Tags size={18} className="text-[#C5A059]" />Nueva etiqueta</div>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <F label="Teléfono"><input value={form.telefono} onChange={set("telefono")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Tipo de pieza">
                  <select value={form.tipo_pieza} onChange={set("tipo_pieza")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
                    <option>JAMON</option><option>PALETA</option><option>LOMO</option><option>CHORIZO</option>
                  </select>
                </F>
                <F label="Peso (kg)"><input type="number" step="0.01" min="0" required value={form.peso} onChange={set("peso")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              </div>
              <F label="Fecha"><input type="date" required value={form.fecha} onChange={set("fecha")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059] w-full">Crear etiqueta</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
