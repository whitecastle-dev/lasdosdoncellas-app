import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, FileText, Truck, CheckCircle2, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

const ESTADOS = [
  { v: "", l: "Todos" },
  { v: "pendiente", l: "Pendientes" },
  { v: "en_ruta", l: "En ruta" },
  { v: "entregado", l: "Entregados" },
  { v: "facturado", l: "Facturados" },
  { v: "incidencia", l: "Incidencias" },
];

const badge = (estado) => {
  const map = {
    pendiente: "bg-gray-100 text-gray-700",
    en_ruta: "bg-blue-100 text-blue-800",
    entregado: "bg-green-100 text-green-800",
    facturado: "bg-purple-100 text-purple-800",
    incidencia: "bg-red-100 text-red-800",
  };
  return map[estado] || "bg-gray-100 text-gray-700";
};

export default function DeliveryNotes() {
  const [rows, setRows] = useState([]);
  const [businessCustomers, setBusinessCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [estado, setEstado] = useState("");
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (estado) p.set("estado", estado);
      const r = await api.get(`/delivery-notes?${p.toString()}`);
      setRows(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  const loadRefs = async () => {
    try {
      const [bc, pr] = await Promise.all([
        api.get("/business-customers").catch(() => ({ data: [] })),
        api.get("/products").catch(() => ({ data: [] })),
      ]);
      setBusinessCustomers(bc.data || []);
      setProducts(Array.isArray(pr.data) ? pr.data : pr.data.items || []);
    } catch (err) { /* ignore */ }
  };
  useEffect(() => { load(); }, [estado]);
  useEffect(() => { loadRefs(); }, []);

  const doAction = async (n, action, extra = {}) => {
    try {
      await api.post(`/delivery-notes/${n.id}/action`, { action, ...extra });
      toast.success(`Albarán ${action === "deliver" ? "entregado" : action === "invoice" ? "facturado" : action}`);
      load();
      if (selected?.id === n.id) setSelected(null);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {ESTADOS.map((e) => (
            <button
              key={e.v}
              onClick={() => setEstado(e.v)}
              data-testid={`dn-filter-${e.v || "all"}`}
              className={`px-3 py-1.5 text-xs border ${estado === e.v ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}
            >
              {e.l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpenDrawer(true)}
          className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2"
          data-testid="dn-new"
        >
          <Plus size={14} />Nuevo albarán
        </button>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th className="text-right">Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin albaranes.</td></tr>
            )}
            {rows.map((n) => (
              <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`dn-row-${n.id}`}>
                <td className="px-4 py-2 mono text-xs">{n.numero}</td>
                <td className="text-xs">{n.fecha}</td>
                <td className="text-sm">
                  <div>{n.client_name}</div>
                  {n.client_address && <div className="text-xs text-gray-400">{n.client_address}</div>}
                </td>
                <td className="text-right font-serif">{formatMoney(n.total)}</td>
                <td><span className={`text-xs px-2 py-0.5 ${badge(n.estado)}`}>{n.estado}</span></td>
                <td className="text-right">
                  <button
                    onClick={() => setSelected(n)}
                    className="text-xs text-gray-500 hover:text-black underline"
                    data-testid={`dn-view-${n.id}`}
                  >
                    Detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openDrawer && (
        <NoteDrawer
          businessCustomers={businessCustomers}
          products={products}
          onClose={() => setOpenDrawer(false)}
          onSaved={() => { setOpenDrawer(false); load(); }}
        />
      )}
      {selected && <DetailModal note={selected} onClose={() => setSelected(null)} onAction={doAction} />}
    </div>
  );
}

function NoteDrawer({ businessCustomers, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_name: "",
    client_id: "",
    client_address: "",
    fecha: new Date().toISOString().slice(0, 10),
    notas: "",
    items: [{ product_id: "", sku: "", name: "", qty: 1, unit_price: 0 }],
  });

  const selectBC = (id) => {
    const bc = businessCustomers.find((c) => c.id === id);
    if (bc) {
      setForm({
        ...form,
        client_id: bc.id,
        client_name: bc.razon_social || bc.nombre_comercial || bc.name || "",
        client_address: bc.direccion || bc.address || "",
      });
    } else {
      setForm({ ...form, client_id: "" });
    }
  };

  const setItem = (i, patch) => {
    const items = [...form.items];
    items[i] = { ...items[i], ...patch };
    setForm({ ...form, items });
  };
  const selectProduct = (i, pid) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return setItem(i, { product_id: "" });
    const v = (p.variants || [])[0];
    setItem(i, {
      product_id: p.id,
      sku: v?.sku || p.sku || "",
      name: p.name + (v?.label ? ` · ${v.label}` : ""),
      unit_price: Number(v?.price ?? p.price ?? 0),
    });
  };
  const addItem = () =>
    setForm({ ...form, items: [...form.items, { product_id: "", sku: "", name: "", qty: 1, unit_price: 0 }] });
  const removeItem = (i) =>
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal = form.items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);

  const save = async (e) => {
    e.preventDefault();
    if (!form.client_name) return toast.error("Cliente obligatorio");
    const items = form.items.filter((i) => i.name && Number(i.qty) > 0);
    if (items.length === 0) return toast.error("Añade al menos una línea");
    try {
      await api.post("/delivery-notes", {
        client_name: form.client_name,
        client_id: form.client_id || null,
        client_address: form.client_address,
        fecha: form.fecha,
        notas: form.notas,
        items: items.map((i) => ({
          product_id: i.product_id || null,
          sku: i.sku,
          name: i.name,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
        })),
      });
      toast.success("Albarán creado");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="dn-drawer"
      >
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2">
            <FileText size={20} className="text-[#C5A059]" />Nuevo albarán
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Cliente empresa</div>
              <select
                value={form.client_id}
                onChange={(e) => selectBC(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm bg-white"
                data-testid="dn-client-select"
              >
                <option value="">— manual —</option>
                {businessCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social || c.nombre_comercial || c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Fecha</div>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Nombre cliente *</div>
            <input
              required
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
              data-testid="dn-client-name"
            />
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Dirección de entrega</div>
            <input
              value={form.client_address}
              onChange={(e) => setForm({ ...form, client_address: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label-eyebrow text-gray-500">Líneas</div>
              <button type="button" onClick={addItem} className="text-xs text-gray-500 hover:text-black flex items-center gap-1">
                <Plus size={10} />Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`dn-item-${i}`}>
                  <div className="col-span-4">
                    <select
                      value={it.product_id}
                      onChange={(e) => selectProduct(i, e.target.value)}
                      className="w-full border border-gray-200 px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">— libre —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="col-span-4 border border-gray-200 px-2 py-1.5 text-sm"
                    placeholder="Descripción"
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="col-span-1 border border-gray-200 px-2 py-1.5 text-sm text-right"
                    value={it.qty}
                    onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="col-span-2 border border-gray-200 px-2 py-1.5 text-sm text-right"
                    value={it.unit_price}
                    onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="col-span-1 p-1 text-red-600 hover:bg-red-50 justify-self-end"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 text-sm">
              <div>Total: <strong className="font-serif text-lg ml-2">{formatMoney(subtotal)}</strong></div>
            </div>
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Notas</div>
            <textarea
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="dn-save">
            Crear albarán
          </button>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ note, onClose, onAction }) {
  const [reason, setReason] = useState("");
  const [vat, setVat] = useState(10);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="dn-detail-modal">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="font-serif text-xl flex items-center gap-2">
            <FileText size={18} className="text-[#C5A059]" />Albarán {note.numero}
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Cliente" value={note.client_name} />
            <Info label="Fecha" value={note.fecha} />
            <Info label="Dirección" value={note.client_address || "—"} />
            <Info label="Estado" value={<span className={`px-2 py-0.5 ${badge(note.estado)}`}>{note.estado}</span>} />
          </div>
          <div className="border-t pt-3">
            <div className="label-eyebrow text-gray-500 mb-2">Líneas</div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 text-left">
                <tr><th>Artículo</th><th className="text-right">Cant.</th><th className="text-right">P.U.</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {note.items.map((it, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5">{it.name}<div className="text-xs text-gray-400">{it.sku}</div></td>
                    <td className="text-right">{it.qty}</td>
                    <td className="text-right">{formatMoney(it.unit_price)}</td>
                    <td className="text-right font-serif">{formatMoney(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end text-sm mt-3 font-serif text-xl">Total: {formatMoney(note.total)}</div>
          </div>

          {note.estado === "pendiente" && (
            <div className="border-t pt-4 space-y-3">
              <div className="text-xs text-gray-500">Acciones disponibles:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onAction(note, "deliver")}
                  className="px-3 py-2 bg-green-700 text-white text-xs flex items-center gap-1"
                  data-testid="dn-action-deliver"
                >
                  <CheckCircle2 size={12} />Marcar entregado (descuenta stock)
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={reason}
                    onChange={() => {}}
                    className="hidden"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Motivo incidencia:</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1 border border-gray-200 px-2 py-1 text-xs"
                />
                <button
                  onClick={() => onAction(note, "incident", { reason })}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs flex items-center gap-1"
                  data-testid="dn-action-incident"
                >
                  <AlertTriangle size={12} />Incidencia
                </button>
              </div>
            </div>
          )}

          {note.estado === "entregado" && (
            <div className="border-t pt-4 space-y-2">
              <div className="text-xs text-gray-500">Facturar el albarán generará una factura emitida ligada:</div>
              <div className="flex items-center gap-2">
                <select value={vat} onChange={(e) => setVat(Number(e.target.value))} className="border border-gray-200 px-2 py-1 text-xs bg-white">
                  <option value={0}>IVA 0%</option>
                  <option value={4}>IVA 4%</option>
                  <option value={10}>IVA 10%</option>
                  <option value={21}>IVA 21%</option>
                </select>
                <button
                  onClick={() => onAction(note, "invoice", { vat_pct: vat })}
                  className="px-3 py-2 bg-black text-[#C5A059] text-xs flex items-center gap-1"
                  data-testid="dn-action-invoice"
                >
                  <FileText size={12} />Generar factura
                </button>
              </div>
            </div>
          )}

          {note.estado === "incidencia" && (
            <div className="border-t pt-4">
              <div className="text-xs text-red-700 mb-2">Incidencia: {note.incident_reason || "—"}</div>
              <button
                onClick={() => onAction(note, "reset")}
                className="px-3 py-2 border border-gray-300 text-xs flex items-center gap-1 hover:border-black"
                data-testid="dn-action-reset"
              >
                <RotateCcw size={12} />Reiniciar a pendiente
              </button>
            </div>
          )}

          {note.estado === "en_ruta" && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-xs text-blue-700">
                <Truck size={14} />En ruta ({note.route_id ? `ruta ${note.route_id.slice(0, 8)}…` : "—"})
              </div>
              <button
                onClick={() => onAction(note, "deliver")}
                className="mt-3 px-3 py-2 bg-green-700 text-white text-xs flex items-center gap-1"
                data-testid="dn-action-deliver-en-ruta"
              >
                <CheckCircle2 size={12} />Confirmar entrega
              </button>
            </div>
          )}

          {note.estado === "facturado" && note.invoice_id && (
            <div className="border-t pt-4 text-xs text-purple-700">
              Facturado → factura {note.invoice_id.slice(0, 8)}…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}
