import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

export default function Analytical() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ from: "", to: "" });

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams();
        if (filter.from) p.set("from", filter.from);
        if (filter.to) p.set("to", filter.to);
        const r = await api.get(`/accounting/analytical?${p.toString()}`);
        setData(r.data);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
  }, [filter]);

  const globalPct = data && data.total_revenue > 0 ? (data.total_margin / data.total_revenue * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Desde</div>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="an-from" />
        </div>
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Hasta</div>
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="an-to" />
        </div>
        <div className="text-xs text-gray-500 max-w-md">
          El coste se calcula usando <strong>average_cost</strong> (coste medio ponderado) de cada producto
          en el momento actual — recalculado en cada recepción de mercancía (FIFO).
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card label="Ventas totales" value={formatMoney(data.total_revenue)} />
            <Card label="Coste directo" value={formatMoney(data.total_cost)} />
            <Card label="Margen bruto" value={formatMoney(data.total_margin)} highlight
                  color={data.total_margin >= 0 ? "text-green-700" : "text-red-700"} />
            <Card label="% Margen" value={`${globalPct.toFixed(1)}%`}
                  color={globalPct >= 0 ? "text-green-700" : "text-red-700"} />
          </div>

          <div className="cms-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
              <Landmark size={14} className="text-[#C5A059]" />
              <div className="font-medium text-sm">Margen por producto</div>
            </div>
            <table className="cms-table w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Coste</th>
                  <th className="text-right">Margen</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin ventas en el periodo.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.product_id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`an-row-${r.product_id}`}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="text-right text-sm">{r.qty}</td>
                    <td className="text-right font-serif">{formatMoney(r.revenue)}</td>
                    <td className="text-right font-serif text-gray-500">{formatMoney(r.cost)}</td>
                    <td className={`text-right font-serif ${r.margin >= 0 ? "text-green-700" : "text-red-700"}`}>{formatMoney(r.margin)}</td>
                    <td className={`text-right text-sm ${r.margin_pct >= 0 ? "text-green-700" : "text-red-700"}`}>{r.margin_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div className={`p-4 border ${highlight ? "border-black" : "border-gray-200"}`}>
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className={`font-serif text-2xl mt-1 ${color || ""}`}>{value}</div>
    </div>
  );
}
