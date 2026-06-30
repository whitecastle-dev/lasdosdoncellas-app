import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, UserCircle2 } from "lucide-react";

const EMPTY = {
  nombre: "", contacto: "", rol: "employee", activo: true,
  salario_base: 0, tarifa_loncheado_normal: 0, tarifa_loncheado_emplatado: 0, notas: "",
};

export default function ErpEmployees() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/erp/employees"); setRows(data); }
    catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (e) => {
    if (!window.confirm(`¿Eliminar empleado ${e.nombre}?`)) return;
    try { await api.delete(`/erp/employees/${e.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} empleados</div>
        <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="emp-new">
          <Plus size={14} /> Nuevo empleado
        </button>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th>Rol</th>
              <th>Contacto</th>
              <th className="text-right">Salario base</th>
              <th className="text-right">€/kg normal</th>
              <th className="text-right">€/kg emplatado</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin empleados</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`emp-row-${e.id}`}>
                <td className="px-4 py-2 font-medium">{e.nombre}</td>
                <td className="text-gray-600 text-xs">{e.rol}</td>
                <td className="text-gray-600">{e.contacto || "—"}</td>
                <td className="text-right mono">{formatMoney(e.salario_base || 0)}</td>
                <td className="text-right mono text-xs">{formatMoney(e.tarifa_loncheado_normal || 0)}</td>
                <td className="text-right mono text-xs">{formatMoney(e.tarifa_loncheado_emplatado || 0)}</td>
                <td><span className={`text-xs px-2 py-0.5 ${e.activo ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>{e.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="text-right pr-2 whitespace-nowrap">
                  <button onClick={() => setEditing(e)} className="p-1.5 hover:bg-gray-100" data-testid={`emp-edit-${e.id}`}><Pencil size={12} /></button>
                  <button onClick={() => onDelete(e)} className="p-1.5 hover:bg-red-50 text-red-600" data-testid={`emp-delete-${e.id}`}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
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
      if (isNew) await api.post("/erp/employees", form);
      else await api.patch(`/erp/employees/${form.id}`, form);
      toast.success(isNew ? "Empleado creado" : "Cambios guardados");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="emp-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo" : "Editando"}</div>
            <div className="font-serif text-2xl flex items-center gap-2 mt-1">
              <UserCircle2 size={20} className="text-[#C5A059]" />{form.nombre || "Empleado"}
            </div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="emp-nombre" /></F>
          <F label="Contacto"><input value={form.contacto || ""} onChange={set("contacto")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="emp-contacto" /></F>
          <F label="Rol">
            <select value={form.rol} onChange={set("rol")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="emp-rol">
              <option value="employee">Empleado</option>
              <option value="manager">Encargado</option>
              <option value="admin">Administrador</option>
            </select>
          </F>
          <div className="grid grid-cols-3 gap-4">
            <F label="Salario base €"><input type="number" step="0.01" min="0" value={form.salario_base || 0} onChange={set("salario_base")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="€/kg normal"><input type="number" step="0.01" min="0" value={form.tarifa_loncheado_normal || 0} onChange={set("tarifa_loncheado_normal")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="€/kg emplatado"><input type="number" step="0.01" min="0" value={form.tarifa_loncheado_emplatado || 0} onChange={set("tarifa_loncheado_emplatado")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Notas"><textarea rows={3} value={form.notas || ""} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={set("activo")} data-testid="emp-activo" /> Activo</label>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="emp-save">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
