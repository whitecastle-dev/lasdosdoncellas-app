import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from "lucide-react";

const CATEGORIAS = ["venta", "compra", "salario", "gasto", "impuestos", "otros"];

export default function Movements() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState({ account_id: "", tipo: "" });
  const [open, setOpen] = useState(false);
  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (filter.account_id) p.set("account_id", filter.account_id);
      if (filter.tipo) p.set("tipo", filter.tipo);
      const [a, b] = await Promise.all([api.get(`/treasury/movements?${p.toString()}`), api.get("/treasury/accounts")]);
      setRows(a.data); setAccounts(b.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [filter]);
  const nameOf = (id) => accounts.find((a) => a.id === id)?.nombre || "—";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Cuenta</div>
            <select value={filter.account_id} onChange={(e) => setFilter({ ...filter, account_id: e.target.value })} className="border border-gray-200 px-2 py-1.5 text-sm bg-white" data-testid="mov-filter-account">
              <option value="">Todas</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Tipo</div>
            <div className="flex gap-1">
              {[["", "Todos"], ["income", "Entradas"], ["expense", "Salidas"]].map(([v, l]) => (
                <button key={v} onClick={() => setFilter({ ...filter, tipo: v })} data-testid={`mov-filter-tipo-${v || "all"}`}
                  className={`px-3 py-1.5 text-xs border ${filter.tipo === v ? "border-black bg-black text-[#C5A059]" : "border-gray-300"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="mov-new"><Plus size={14} />Nuevo movimiento</button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Nº</th><th>Fecha</th><th>Cuenta</th><th>Concepto</th><th>Categoría</th>
            <th>Tipo</th><th className="text-right">Importe</th><th>Conciliado</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin movimientos.</td></tr>}
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`mov-row-${m.id}`}>
                <td className="px-4 py-2 mono text-xs">{m.numero}</td>
                <td className="text-xs">{m.fecha}</td>
                <td className="text-sm">{nameOf(m.account_id)}</td>
                <td className="text-sm">{m.concepto}<div className="text-xs text-gray-400">{m.reference_type && `→ ${m.reference_type}`}</div></td>
                <td className="text-xs"><span className="px-2 py-0.5 bg-gray-100">{m.categoria || "—"}</span></td>
                <td>{m.tipo === "income" ? <span className="text-green-700 flex items-center gap-1"><ArrowUpCircle size={12} />Entrada</span> : <span className="text-red-700 flex items-center gap-1"><ArrowDownCircle size={12} />Salida</span>}</td>
                <td className={`text-right font-serif ${m.tipo === "income" ? "text-green-700" : "text-red-700"}`}>{m.tipo === "income" ? "+" : "−"}{formatMoney(m.importe)}</td>
                <td className="text-xs">{m.conciliado ? <span className="text-green-700">✓</span> : <span className="text-gray-400">Pendiente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <MovDrawer accounts={accounts} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function MovDrawer({ accounts, onClose, onSaved }) {
  const [form, setForm] = useState({ account_id: accounts[0]?.id || "", tipo: "income", importe: 0, fecha: new Date().toISOString().slice(0, 10), concepto: "", categoria: "venta", metodo: "transferencia", notas: "", conciliado: false });
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };
  const save = async (e) => {
    e.preventDefault();
    if (!form.account_id) return toast.error("Selecciona una cuenta");
    if (!form.importe || form.importe <= 0) return toast.error("Importe > 0");
    try {
      await api.post("/treasury/movements", { ...form, reference_type: "manual" });
      toast.success("Movimiento registrado"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()} data-testid="mov-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2"><ArrowLeftRight size={20} className="text-[#C5A059]" />Nuevo movimiento</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Cuenta *">
            <select required value={form.account_id} onChange={set("account_id")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="mov-account">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </F>
          <F label="Tipo">
            <div className="flex gap-2">
              {[["income", "Entrada"], ["expense", "Salida"]].map(([v, l]) => (
                <label key={v} className={`flex-1 border px-3 py-2 text-sm cursor-pointer text-center ${form.tipo === v ? "border-black bg-black text-[#C5A059]" : "border-gray-300"}`}>
                  <input type="radio" value={v} checked={form.tipo === v} onChange={set("tipo")} className="hidden" />{l}
                </label>
              ))}
            </div>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Importe €"><input type="number" step="0.01" min="0.01" required value={form.importe} onChange={set("importe")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="mov-importe" /></F>
            <F label="Fecha"><input type="date" required value={form.fecha} onChange={set("fecha")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Concepto *"><input required value={form.concepto} onChange={set("concepto")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="mov-concepto" /></F>
          <F label="Categoría">
            <select value={form.categoria} onChange={set("categoria")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </F>
          <F label="Notas"><textarea rows={2} value={form.notas} onChange={set("notas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="mov-save">Guardar movimiento</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
