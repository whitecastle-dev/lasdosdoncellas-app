import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, Package } from "lucide-react";

export default function InventoryValuation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/inventory/valuation"); setData(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  if (loading) return <div className="text-gray-400 py-10 text-center">Calculando…</div>;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="cms-card p-6 flex items-center justify-between bg-black text-[#C5A059]">
        <div>
          <div className="label-eyebrow opacity-70 flex items-center gap-2"><TrendingUp size={14} /> Valor total del stock</div>
          <div className="font-serif text-4xl mt-1" data-testid="inv-val-total">{formatMoney(data.total_valor)}</div>
          <div className="text-xs opacity-60 mt-2">{data.productos} productos con lotes activos</div>
        </div>
        <Package size={40} className="opacity-30" />
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="px-4 py-3">Producto</th><th>SKU</th><th className="text-right">Cantidad</th><th className="text-right">Lotes</th><th className="text-right">Valor</th></tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin lotes activos.</td></tr>}
            {data.rows.map((r) => (
              <tr key={r.product_id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{r.product_name}</td>
                <td className="mono text-xs text-gray-500">{r.sku}</td>
                <td className="text-right mono">{r.qty_total}</td>
                <td className="text-right text-xs text-gray-500">{r.lotes}</td>
                <td className="text-right font-serif">{formatMoney(r.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
