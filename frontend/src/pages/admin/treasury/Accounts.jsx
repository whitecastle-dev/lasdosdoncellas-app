import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Landmark, Wallet } from "lucide-react";

const EMPTY = { nombre: "", tipo: "bank", banco: "", iban: "", saldo_inicial: 0, moneda: "EUR", activo: true, notas: "" };

export default function Accounts() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    try { const r = await api.get("/treasury/accounts"); setRows(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const del = async (a) => {
    if (!window.confirm(`¿Eliminar ${a.nombre}?`)) return;
    try { await api.delete(`/treasury/accounts/${a.id}`); toast.success("Eliminada"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const total = rows.reduce((s, a) => s + (a.saldo || 0), 0);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{rows.length} cuentas · Saldo total: <strong className="font-serif text-lg text-black" data-testid="acc-total">{formatMoney(total)}</strong></div>
        <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="acc-new"><Plus size={14} />Nueva cuenta</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full py-10 text-center text-gray-400">Sin cuentas todavía.</div>}
        {rows.map((a) => (
          <div key={a.id} className="cms-card p-5 border border-gray-200" data-testid={`acc-card-${a.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {a.tipo === "cash" ? <Wallet size={16} className="text-[#C5A059]" /> : <Landmark size={16} className="text-[#C5A059]" />}
                <div>
                  <div className="font-medium">{a.nombre}</div>
                  {a.banco && <div className="text-xs text-gray-500">{a.banco}</div>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(a)} className="p-1 hover:bg-gray-100"><Pencil size={12} /></button>
                <button onClick={() => del(a)} className="p-1 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button>
              </div>
            </div>
            {a.iban && <div className="text-xs mono text-gray-400 mb-3">{a.iban}</div>}
            <div className="font-serif text-3xl">{formatMoney(a.saldo)}</div>
            <div className="text-xs text-gray-500 mt-1">Saldo actual</div>
            {!a.activo && <div className="mt-2 text-xs px-2 py-0.5 bg-gray-200 inline-block">Inactiva</div>}
          </div>
        ))}
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
      if (isNew) await api.post("/treasury/accounts", form);
      else await api.patch(`/treasury/accounts/${form.id}`, form);
      toast.success("Guardada"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()} data-testid="acc-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2"><Landmark size={20} className="text-[#C5A059]" />{form.nombre || "Cuenta"}</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Nombre *"><input required value={form.nombre} onChange={set("nombre")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="acc-name" /></F>
          <F label="Tipo">
            <select value={form.tipo} onChange={set("tipo")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              <option value="bank">Cuenta bancaria</option>
              <option value="cash">Caja / efectivo</option>
            </select>
          </F>
          {form.tipo === "bank" && (
            <>
              <F label="Banco"><input value={form.banco || ""} onChange={set("banco")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
              <F label="IBAN"><input value={form.iban || ""} onChange={set("iban")} className="w-full border border-gray-200 px-3 py-2 text-sm mono" placeholder="ES00 …" /></F>
            </>
          )}
          <F label="Saldo inicial (€)"><input type="number" step="0.01" value={form.saldo_inicial} onChange={set("saldo_inicial")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="acc-saldo-inicial" /></F>
          <F label="Notas"><textarea rows={2} value={form.notas || ""} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={set("activo")} /> Activa</label>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="acc-save">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
