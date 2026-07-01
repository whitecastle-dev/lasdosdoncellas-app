import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Package, AlertTriangle } from "lucide-react";

export default function InventoryLots() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState({});
  const [locations, setLocations] = useState({});
  const [expiringOnly, setExpiringOnly] = useState(false);
  const load = async () => {
    try {
      const params = expiringOnly ? "&expiring_days=30" : "";
      const [a, b, c] = await Promise.all([
        api.get(`/inventory/lots?active_only=true${params}`),
        api.get("/products"),
        api.get("/inventory/locations"),
      ]);
      setRows(a.data);
      setProducts(Object.fromEntries(b.data.map((p) => [p.id, p])));
      setLocations(Object.fromEntries(c.data.map((l) => [l.id, l.nombre])));
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [expiringOnly]);
  const del = async (l) => {
    if (!window.confirm("¿Eliminar lote?")) return;
    try { await api.delete(`/inventory/lots/${l.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="lot-filter-expiring">
          <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
          <AlertTriangle size={14} className="text-amber-600" /> Solo lotes caducan en 30 días
        </label>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Lote</th><th>Producto</th><th>Ubicación</th>
            <th className="text-right">Recibido</th><th className="text-right">Disponible</th>
            <th className="text-right">€/uni</th><th>Caduca</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin lotes.</td></tr>}
            {rows.map((l) => {
              const soon = l.expires_at && l.expires_at <= in30;
              const expired = l.expires_at && l.expires_at < today;
              return (
                <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`lot-row-${l.id}`}>
                  <td className="px-4 py-2 mono text-xs">{l.lot_number}</td>
                  <td className="text-sm">{products[l.product_id]?.name || <span className="text-gray-400">?</span>}</td>
                  <td className="text-xs text-gray-500">{locations[l.location_id] || "—"}</td>
                  <td className="text-right mono">{l.qty_received}</td>
                  <td className="text-right mono font-medium">{l.qty_available}</td>
                  <td className="text-right mono text-xs">{formatMoney(l.unit_cost)}</td>
                  <td className="text-xs"><span className={expired ? "text-red-600 font-medium" : soon ? "text-amber-700 font-medium" : "text-gray-500"}>{l.expires_at || "—"}</span></td>
                  <td className="text-right pr-2"><button onClick={() => del(l)} className="p-1.5 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
