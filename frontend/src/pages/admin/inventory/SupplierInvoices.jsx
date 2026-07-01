import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { FileText, CheckCircle2 } from "lucide-react";

const STATUS = { pending_payment: "Pendiente pago", paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada" };
const COLORS = { pending_payment: "bg-amber-100 text-amber-900", paid: "bg-green-100 text-green-900", overdue: "bg-red-100 text-red-900", cancelled: "bg-gray-200 text-gray-700" };

export default function SupplierInvoices() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState("");
  const load = async () => {
    try {
      const params = filter ? `?status=${filter}` : "";
      const [a, b] = await Promise.all([api.get(`/supplier-invoices${params}`), api.get("/supplier-invoices/summary")]);
      setRows(a.data); setSummary(b.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [filter]);
  const markPaid = async (i) => {
    if (!window.confirm(`¿Marcar factura ${i.invoice_number} como PAGADA?`)) return;
    try { await api.patch(`/supplier-invoices/${i.id}`, { status: "paid" }); toast.success("Marcada como pagada"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Pendiente pago" total={summary.pending_payment?.total || 0} count={summary.pending_payment?.count || 0} color="amber" />
          <Stat label="Vencido" total={summary.overdue?.total || 0} count={summary.overdue?.count || 0} color="red" />
          <Stat label="Pagado" total={summary.paid?.total || 0} count={summary.paid?.count || 0} color="green" />
          <Stat label="Cancelado" total={summary.cancelled?.total || 0} count={summary.cancelled?.count || 0} color="gray" />
        </div>
      )}
      <div className="flex items-center gap-2">
        {["", ...Object.keys(STATUS)].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`fac-filter-${s || "all"}`}
            className={`px-3 py-1.5 text-xs border ${filter === s ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}>
            {s ? STATUS[s] : "Todos"}
          </button>
        ))}
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Nº</th><th>Emitida</th><th>Vence</th><th>Proveedor</th>
            <th className="text-right">Base</th><th className="text-right">IVA</th><th className="text-right">Total</th>
            <th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-gray-400">Sin facturas.</td></tr>}
            {rows.map((i) => (
              <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`fac-row-${i.id}`}>
                <td className="px-4 py-2 mono text-xs">{i.invoice_number}</td>
                <td className="text-xs text-gray-500">{i.issue_date}</td>
                <td className="text-xs">{i.due_date || "—"}</td>
                <td>{i.provider?.company || i.provider?.name}</td>
                <td className="text-right mono">{formatMoney(i.subtotal)}</td>
                <td className="text-right mono text-xs text-gray-500">{formatMoney(i.vat_amount)}</td>
                <td className="text-right font-serif">{formatMoney(i.total)}</td>
                <td><span className={`text-xs px-2 py-0.5 ${COLORS[i.status] || "bg-gray-100"}`}>{STATUS[i.status]}</span></td>
                <td className="text-right pr-2">
                  {i.status === "pending_payment" && (
                    <button onClick={() => markPaid(i)} className="text-xs px-2 py-1 border border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-1" data-testid={`fac-pay-${i.id}`}>
                      <CheckCircle2 size={11} /> Marcar pagada
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, total, count, color }) {
  const colors = { amber: "border-amber-300 bg-amber-50", red: "border-red-300 bg-red-50", green: "border-green-300 bg-green-50", gray: "border-gray-300 bg-gray-50" };
  return (
    <div className={`border ${colors[color]} p-4`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-serif text-2xl mt-1">{formatMoney(total)}</div>
      <div className="text-xs text-gray-500 mt-1">{count} factura{count !== 1 ? "s" : ""}</div>
    </div>
  );
}
