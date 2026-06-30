import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Filter, Package } from "lucide-react";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";

const TIPOS = ["NORMAL", "EMPLATADO"];

export default function ErpSlicings() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ cliente_id: "", empleado_id: "", desde: "", hasta: "" });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAux = async () => {
    const [c, e, p] = await Promise.all([
      api.get("/erp/clients"), api.get("/erp/employees"), api.get("/erp/products"),
    ]);
    setClients(c.data); setEmployees(e.data); setProducts(p.data);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.cliente_id) params.set("cliente_id", filters.cliente_id);
      if (filters.empleado_id) params.set("empleado_id", filters.empleado_id);
      if (filters.desde) params.set("desde", filters.desde);
      if (filters.hasta) params.set("hasta", filters.hasta);
      params.set("limit", "500");
      const [a, b] = await Promise.all([
        api.get(`/erp/slicings?${params.toString()}`),
        api.get(`/erp/slicings/summary?${params.toString()}`),
      ]);
      setRows(a.data); setSummary(b.data);
    } catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { loadAux(); load(); }, []);
  useEffect(() => { load(); }, [filters]);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const ql = q.toLowerCase();
    const idMaps = {
      c: Object.fromEntries(clients.map((x) => [x.id, x.nombre])),
      e: Object.fromEntries(employees.map((x) => [x.id, x.nombre])),
      p: Object.fromEntries(products.map((x) => [x.id, x.nombre])),
    };
    return rows.filter((r) =>
      (idMaps.c[r.cliente_id] || "").toLowerCase().includes(ql) ||
      (idMaps.e[r.empleado_id] || "").toLowerCase().includes(ql) ||
      (idMaps.p[r.producto_id] || "").toLowerCase().includes(ql) ||
      (r.observaciones || "").toLowerCase().includes(ql)
    );
  }, [rows, q, clients, employees, products]);

  const onDelete = async (r) => {
    if (!window.confirm("¿Eliminar loncheado?")) return;
    try { await api.delete(`/erp/slicings/${r.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  const nameOf = (list, id) => list.find((x) => x.id === id)?.nombre || "—";

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Stat label="Piezas" value={summary.piezas} />
          <Stat label="Kg loncheados" value={summary.kg_loncheados} suffix=" kg" />
          <Stat label="Ingresos" value={formatMoney(summary.ingresos)} />
          <Stat label="Coste" value={formatMoney(summary.coste)} />
          <Stat label="Beneficio" value={formatMoney(summary.beneficio)} green />
          <Stat label="€/kg medio" value={formatMoney(summary.media_eur_kg)} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <TableFilter value={q} onChange={setQ} placeholder="Buscar cliente/empleado/producto…" testid="slicings-filter" />
        <FilterSelect label="Cliente" value={filters.cliente_id} onChange={(v) => setFilters({ ...filters, cliente_id: v })} options={clients} />
        <FilterSelect label="Empleado" value={filters.empleado_id} onChange={(v) => setFilters({ ...filters, empleado_id: v })} options={employees} />
        <FilterDate label="Desde" value={filters.desde} onChange={(v) => setFilters({ ...filters, desde: v })} />
        <FilterDate label="Hasta" value={filters.hasta} onChange={(v) => setFilters({ ...filters, hasta: v })} />
        <button onClick={() => setEditing("new")} className="ml-auto px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="slicing-new">
          <Plus size={14} /> Nuevo loncheado
        </button>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">Fecha</th>
              <th>Cliente</th>
              <th>Empleado</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th className="text-right">Peso (kg)</th>
              <th className="text-right">Precio €</th>
              <th className="text-right">€/kg</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-gray-400">Sin loncheados con esos filtros.</td></tr>
            )}
            {filtered.slice(0, 300).map((r) => {
              const eurKg = r.peso_loncheado > 0 ? r.precio_cliente / r.peso_loncheado : 0;
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`slicing-row-${r.id}`}>
                  <td className="px-4 py-2 text-xs">{(r.fecha || r.created_at || "").slice(0, 10)}</td>
                  <td>{nameOf(clients, r.cliente_id)}</td>
                  <td className="text-gray-600">{nameOf(employees, r.empleado_id)}</td>
                  <td className="text-gray-600 text-xs">{nameOf(products, r.producto_id)}</td>
                  <td><span className={`text-xs px-2 py-0.5 ${r.tipo === "EMPLATADO" ? "bg-purple-100 text-purple-800" : "bg-gray-100"}`}>{r.tipo || "NORMAL"}</span></td>
                  <td className="text-right mono">{(r.peso_loncheado || 0).toFixed(2)}</td>
                  <td className="text-right mono">{formatMoney(r.precio_cliente)}</td>
                  <td className="text-right mono text-xs text-gray-500">{formatMoney(eurKg)}</td>
                  <td className="text-right pr-2 whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="p-1.5 hover:bg-gray-100" data-testid={`slicing-edit-${r.id}`}><Pencil size={12} /></button>
                    <button onClick={() => onDelete(r)} className="p-1.5 hover:bg-red-50 text-red-600" data-testid={`slicing-delete-${r.id}`}><Trash2 size={12} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">Mostrando primeros 300 de {filtered.length}. Aplica filtros de fecha o cliente para reducir.</div>
        )}
      </div>

      {editing && (
        <SlicingDrawer
          initial={editing === "new" ? null : editing}
          clients={clients} employees={employees} products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, green, suffix = "" }) {
  return (
    <div className="border border-gray-200 p-3 bg-white">
      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`font-serif text-2xl mt-1 ${green ? "text-green-700" : ""}`}>{value}{suffix}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-200 px-2 py-1.5 text-sm bg-white">
        <option value="">Todos</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </div>
  );
}
function FilterDate({ label, value, onChange }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-200 px-2 py-1.5 text-sm" />
    </div>
  );
}

function SlicingDrawer({ initial, clients, employees, products, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(initial || {
    cliente_id: clients[0]?.id || "", empleado_id: employees[0]?.id || "", producto_id: products[0]?.id || "",
    peso_bruto: 0, peso_loncheado: 0, precio_cliente: 0, tipo: "NORMAL", emplatado: false, coste: 0,
    observaciones: "", fecha: new Date().toISOString().slice(0, 10),
  });
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };
  const merma = Math.max((form.peso_bruto || 0) - (form.peso_loncheado || 0), 0);
  const mermaPct = form.peso_bruto > 0 ? ((merma / form.peso_bruto) * 100).toFixed(1) : 0;

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, emplatado: form.tipo === "EMPLATADO" || form.emplatado };
    try {
      if (isNew) await api.post("/erp/slicings", payload);
      else await api.patch(`/erp/slicings/${form.id}`, payload);
      toast.success(isNew ? "Loncheado registrado" : "Cambios guardados");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="slicing-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo loncheado" : "Editando"}</div>
            <div className="font-serif text-2xl flex items-center gap-2 mt-1">
              <Package size={20} className="text-[#C5A059]" />
              {isNew ? "Registro de pieza" : `${(form.peso_loncheado || 0).toFixed(2)} kg`}
            </div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cliente">
              <select required value={form.cliente_id} onChange={set("cliente_id")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="slicing-cliente">
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Empleado">
              <select required value={form.empleado_id} onChange={set("empleado_id")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="slicing-empleado">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label="Producto">
              <select required value={form.producto_id} onChange={set("producto_id")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="slicing-producto">
                {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={set("tipo")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="slicing-tipo">
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" value={(form.fecha || "").slice(0, 10)} onChange={set("fecha")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="slicing-fecha" />
            </Field>
            <Field label="Peso bruto (entrada, kg)">
              <input type="number" step="0.01" min="0" value={form.peso_bruto} onChange={set("peso_bruto")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="slicing-peso-bruto" />
            </Field>
            <Field label="Peso loncheado (salida, kg) *">
              <input type="number" step="0.01" min="0" required value={form.peso_loncheado} onChange={set("peso_loncheado")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="slicing-peso-loncheado" />
            </Field>
            <Field label="Precio cliente (€) *">
              <input type="number" step="0.01" min="0" required value={form.precio_cliente} onChange={set("precio_cliente")} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="slicing-precio" />
            </Field>
            <Field label="Coste (€)">
              <input type="number" step="0.01" min="0" value={form.coste} onChange={set("coste")} className="w-full border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          {form.peso_bruto > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 text-sm">
              <strong>Merma:</strong> {merma.toFixed(2)} kg ({mermaPct} %)
              {' · '}
              <strong>Rendimiento:</strong> {form.peso_bruto > 0 ? ((form.peso_loncheado / form.peso_bruto) * 100).toFixed(1) : 0}%
            </div>
          )}

          <Field label="Observaciones">
            <textarea rows={2} value={form.observaciones || ""} onChange={set("observaciones")} className="w-full border border-gray-200 px-3 py-2 text-sm" />
          </Field>

          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="slicing-save">
            {isNew ? "Crear loncheado" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label-eyebrow text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}
