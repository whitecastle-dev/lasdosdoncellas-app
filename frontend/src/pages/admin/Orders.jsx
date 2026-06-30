import React, { useEffect, useMemo, useState, useRef } from "react";
import { Download, X, ChevronRight, FileSpreadsheet, Upload } from "lucide-react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";
import useSort, { SortHeader } from "@/components/admin/useSort";
import RelationModal from "@/components/admin/RelationModal";

const STATUSES = [
  { v: "pending_payment", l: "Pendiente de pago" },
  { v: "paid", l: "Pagado" },
  { v: "processing", l: "Preparando" },
  { v: "shipped", l: "Enviado" },
  { v: "delivered", l: "Entregado" },
  { v: "cancelled", l: "Cancelado" },
  { v: "refunded", l: "Reembolsado" },
];
const statusLabel = Object.fromEntries(STATUSES.map((s) => [s.v, s.l]));

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [relation, setRelation] = useState(null); // {type, id}
  const fileRef = useRef();

  const load = async () => {
    const { data } = await api.get("/orders", { params: { status: filter || undefined } });
    setOrders(data);
    setPicked(new Set());
  };
  useEffect(() => { load(); }, [filter]);

  const filtered = useMemo(() => filterRows(orders, q), [orders, q]);
  const { sorted, sortBy, sort } = useSort(filtered, "created_at", "desc");

  const togglePick = (id, e) => {
    e?.stopPropagation();
    setPicked((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };
  const toggleAll = () => {
    if (picked.size === orders.length) setPicked(new Set());
    else setPicked(new Set(orders.map((o) => o.id)));
  };

  const downloadBlob = (data, filename) => {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSelected = async () => {
    try {
      const ids = picked.size > 0 ? Array.from(picked) : null;
      const resp = await api.post("/excel/orders/export", { order_ids: ids }, { responseType: "blob" });
      downloadBlob(resp.data, "pedidos_export.xlsx");
      toast.success(`${ids ? ids.length : orders.length} pedidos exportados`);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const downloadTemplate = async () => {
    try {
      const resp = await api.get("/excel/orders/template", { responseType: "blob" });
      downloadBlob(resp.data, "plantilla_pedidos_las_dos_doncellas.xlsx");
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/excel/orders/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.imported} importados, ${data.updated} actualizados${data.errors?.length ? ` · ${data.errors.length} errores` : ""}`);
      if (data.errors?.length) console.warn("Import errors:", data.errors);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const setStatus = async (order, status) => {
    try {
      const { data } = await api.patch(`/orders/${order.id}/status`, { status });
      toast.success("Estado actualizado");
      setSelected(data);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const downloadInvoice = async (order) => {
    try {
      const resp = await api.get(`/orders/${order.id}/invoice`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura_${order.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const openCustomerCard = async (email) => {
    if (!email) return;
    try {
      const { data } = await api.get(`/users/web/by-email/${encodeURIComponent(email)}`);
      setRelation({ type: "web-customer", id: data.id });
    } catch (err) {
      toast.message("Pedido de invitado", { description: `No hay ficha registrada para ${email}.` });
    }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Gestión</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Pedidos</h1>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <TableFilter value={q} onChange={setQ} placeholder="Buscar por cualquier campo…" testid="orders-filter" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="orders-status-filter">
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <button onClick={downloadTemplate} className="px-3 py-2 border border-gray-200 text-sm flex items-center gap-2 hover:bg-gray-50" data-testid="orders-template-button" title="Descargar plantilla Excel">
            <FileSpreadsheet size={14} /> Plantilla
          </button>
          <button onClick={exportSelected} disabled={orders.length === 0} className="px-3 py-2 border border-gray-200 text-sm flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50" data-testid="orders-export-button">
            <Download size={14} /> Exportar {picked.size > 0 ? `(${picked.size})` : "todos"}
          </button>
          <label className="px-3 py-2 border border-gray-200 text-sm flex items-center gap-2 hover:bg-gray-50 cursor-pointer" data-testid="orders-import-label">
            <Upload size={14} /> Importar Excel
            <input ref={fileRef} type="file" accept=".xlsx" onChange={importFile} className="hidden" data-testid="orders-import-input" />
          </label>
        </div>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-3 px-4 w-8"><input type="checkbox" checked={picked.size === sorted.length && sorted.length > 0} onChange={toggleAll} data-testid="orders-select-all" /></th>
              <SortHeader label="Pedido" sortKey="order_number" sort={sort} sortBy={sortBy} />
              <SortHeader label="Fecha" sortKey="created_at" sort={sort} sortBy={sortBy} />
              <SortHeader label="Cliente" sortKey="customer_email" sort={sort} sortBy={sortBy} />
              <SortHeader label="Estado" sortKey="status" sort={sort} sortBy={sortBy} />
              <SortHeader label="Total" sortKey="total" sort={sort} sortBy={sortBy} className="text-right" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-gray-400">Sin pedidos</td></tr>}
            {sorted.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(o)} data-testid={`order-row-${o.id}`}>
                <td className="px-4 py-3 mono">{o.order_number}</td>
                <td className="text-gray-600">{new Date(o.created_at).toLocaleString("es-ES")}</td>
                <td>{o.customer?.name}
                  <div className="text-xs">
                    <button
                      onClick={(e) => { e.stopPropagation(); openCustomerCard(o.customer?.email); }}
                      className="text-[#C5A059] hover:underline"
                      data-testid={`order-customer-link-${o.id}`}
                    >
                      {o.customer?.email}
                    </button>
                  </div>
                </td>
                <td><span className="text-xs px-2 py-0.5 bg-black text-[#C5A059]">{statusLabel[o.status]}</span></td>
                <td className="mono text-right">{formatMoney(o.total)}</td>
                <td className="text-right pr-4"><ChevronRight size={16} className="text-gray-400" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <OrderDrawer order={selected} onClose={() => setSelected(null)} setStatus={setStatus} downloadInvoice={downloadInvoice} openCustomerCard={openCustomerCard} />}
      {relation && <RelationModal type={relation.type} id={relation.id} onClose={() => setRelation(null)} />}
    </div>
  );
}

function OrderDrawer({ order, onClose, setStatus, downloadInvoice, openCustomerCard }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="order-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">Pedido</div>
            <div className="font-serif text-2xl mono">{order.order_number}</div>
            <div className="text-xs text-gray-500 mt-1">Factura {order.invoice_number} · {order.invoice_date}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadInvoice(order)} className="px-3 py-2 border border-gray-300 text-sm flex items-center gap-2 hover:bg-gray-50" data-testid="order-download-invoice">
              <Download size={14} /> Factura
            </button>
            <button onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="label-eyebrow text-gray-500 mb-2 flex items-center justify-between">
              <span>Cliente</span>
              <button
                onClick={() => openCustomerCard?.(order.customer?.email)}
                className="text-xs text-[#C5A059] hover:underline"
                data-testid="order-view-customer"
              >
                Ver ficha de cliente →
              </button>
            </div>
            <div className="text-sm leading-relaxed">
              <div className="font-medium">{order.customer?.name}</div>
              <div>{order.customer?.email}{order.customer?.phone && ` · ${order.customer.phone}`}</div>
              <div className="text-gray-600">{order.customer?.address}</div>
              <div className="text-gray-600">{order.customer?.postal_code} {order.customer?.city}, {order.customer?.country}</div>
              {order.customer?.tax_id && <div className="text-gray-600">NIF/CIF: {order.customer.tax_id}</div>}
            </div>
          </div>

          <div>
            <div className="label-eyebrow text-gray-500 mb-2">Productos</div>
            <table className="w-full text-sm">
              <tbody>
                {order.items.map((i, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-2">{i.name} <span className="text-gray-500">× {i.qty}</span></td>
                    <td className="mono text-right">{formatMoney(i.line_total)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200"><td className="pt-3 text-gray-600">Subtotal</td><td className="mono text-right pt-3">{formatMoney(order.subtotal)}</td></tr>
                {Object.entries(order.vat_breakdown || {}).map(([rate, amount]) => (
                  <tr key={rate}><td className="text-gray-600">IVA {rate}%</td><td className="mono text-right">{formatMoney(amount)}</td></tr>
                ))}
                <tr className="border-t border-gray-300"><td className="pt-3 font-serif text-xl">Total</td><td className="font-serif text-xl text-right">{formatMoney(order.total)}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div className="label-eyebrow text-gray-500 mb-3">Trazabilidad</div>
            <div className="space-y-2">
              {(order.tracking || []).map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-[#C5A059] mt-1.5" />
                  <div className="flex-1">
                    <div className="font-medium">{statusLabel[t.status] || t.status}</div>
                    <div className="text-xs text-gray-500">{new Date(t.at).toLocaleString("es-ES")} {t.note && `· ${t.note}`}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="label-eyebrow text-gray-500 mb-2">Cambiar estado</div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s.v} onClick={() => setStatus(order, s.v)}
                  className={`px-3 py-1.5 text-xs border ${order.status === s.v ? "bg-black text-[#C5A059] border-black" : "border-gray-300 hover:border-black"}`}
                  data-testid={`order-status-${s.v}`}
                >{s.l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
