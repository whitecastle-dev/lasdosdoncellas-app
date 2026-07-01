import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Truck, ClipboardCheck, ChevronDown, ChevronUp } from "lucide-react";

const STATUS = { pending: "Pendiente", partial: "Parcial", received: "Recibido", cancelled: "Cancelado" };
const COLORS = { pending: "bg-amber-100 text-amber-900", partial: "bg-blue-100 text-blue-900", received: "bg-green-100 text-green-900", cancelled: "bg-gray-200 text-gray-700" };

export default function PurchaseOrders() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState("");
  const load = async () => {
    try {
      const params = filter ? `?status=${filter}` : "";
      const r = await api.get(`/purchase-orders${params}`);
      setRows(r.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [filter]);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {["", ...Object.keys(STATUS)].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`po-filter-${s || "all"}`}
            className={`px-3 py-1.5 text-xs border ${filter === s ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}>
            {s ? STATUS[s] : "Todos"}
          </button>
        ))}
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Nº</th><th>Proveedor</th><th>Fecha</th>
            <th className="text-right">Items</th><th className="text-right">Total</th>
            <th>Estado</th><th>Origen</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin pedidos. Genera uno desde una <strong>alerta de stock aprobada</strong>.</td></tr>}
            {rows.map((p) => (
              <React.Fragment key={p.id}>
                <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded({...expanded, [p.id]: !expanded[p.id]})} data-testid={`po-row-${p.id}`}>
                  <td className="px-4 py-2 mono text-xs">{p.po_number}</td>
                  <td className="font-medium">{p.provider?.company || p.provider?.name}</td>
                  <td className="text-xs text-gray-500">{p.created_at?.slice(0, 10)}</td>
                  <td className="text-right">{p.items?.length}</td>
                  <td className="text-right font-serif">{formatMoney(p.total)}</td>
                  <td><span className={`text-xs px-2 py-0.5 ${COLORS[p.status]}`}>{STATUS[p.status]}</span></td>
                  <td className="text-xs text-gray-500">{p.source_alert_id ? "Alerta stock" : "Manual"}</td>
                  <td className="text-right pr-2">{expanded[p.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                </tr>
                {expanded[p.id] && (
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="px-6 py-4">
                      <table className="w-full text-xs">
                        <thead className="text-gray-500"><tr><th className="text-left">SKU</th><th className="text-left">Producto</th><th className="text-right">Cant.</th><th className="text-right">€/uni</th><th className="text-right">Subtotal</th></tr></thead>
                        <tbody>
                          {p.items.map((i, idx) => (
                            <tr key={idx} className="border-t border-gray-200">
                              <td className="mono py-1">{i.sku}</td><td>{i.name}</td>
                              <td className="text-right">{i.qty}</td>
                              <td className="text-right mono">{formatMoney(i.unit_cost)}</td>
                              <td className="text-right mono">{formatMoney(i.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {p.status === "pending" && (
                        <div className="mt-3 text-xs text-gray-500">💡 Ve a <strong>Recepciones → Nueva recepción</strong> y selecciona este pedido para registrar la entrada de mercancía.</div>
                      )}
                      {p.notes && <div className="mt-3 text-xs italic text-gray-500">{p.notes}</div>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
