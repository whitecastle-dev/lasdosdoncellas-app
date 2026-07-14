import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { ClipboardList, Lock, Unlock } from "lucide-react";

export default function PosSessions() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try {
      const r = await api.get("/pos/sessions");
      setRows(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">{rows.length} sesiones registradas</div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th>Estado</th>
              <th>Apertura</th>
              <th>Cierre</th>
              <th>Empleado</th>
              <th className="text-right">Tickets</th>
              <th className="text-right">Ventas</th>
              <th className="text-right">Apertura €</th>
              <th className="text-right">Cierre €</th>
              <th className="text-right">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-10 text-center text-gray-400">Sin sesiones.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`pos-session-row-${s.id}`}>
                <td className="px-4 py-2 mono text-xs">{s.numero}</td>
                <td>
                  {s.estado === "abierta" ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 flex items-center gap-1 w-fit"><Unlock size={10} />abierta</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 flex items-center gap-1 w-fit"><Lock size={10} />cerrada</span>
                  )}
                </td>
                <td className="text-xs">{(s.opened_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="text-xs">{s.closed_at ? s.closed_at.slice(0, 16).replace("T", " ") : "—"}</td>
                <td className="text-sm">{s.empleado_nombre || "—"}</td>
                <td className="text-right text-sm">{s.num_tickets || 0}</td>
                <td className="text-right font-serif">{formatMoney(s.total_ventas)}</td>
                <td className="text-right text-sm">{formatMoney(s.saldo_apertura)}</td>
                <td className="text-right text-sm">{s.saldo_cierre != null ? formatMoney(s.saldo_cierre) : "—"}</td>
                <td className={`text-right text-sm ${s.diferencia == null ? "text-gray-400" : Math.abs(s.diferencia) < 0.01 ? "text-green-700" : s.diferencia > 0 ? "text-blue-700" : "text-red-700"}`}>
                  {s.diferencia == null ? "—" : formatMoney(s.diferencia)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
