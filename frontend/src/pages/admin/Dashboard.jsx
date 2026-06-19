import React, { useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, Package, Users as UsersIcon, AlertTriangle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { api, formatMoney } from "@/lib/api";

function StatCard({ label, value, icon: Icon, subtext, testid }) {
  return (
    <div className="cms-card p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="label-eyebrow text-gray-500">{label}</div>
          <div className="font-serif text-4xl mt-3 tracking-tight">{value}</div>
          {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
        </div>
        <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ background: "#0A0A0A", color: "#C5A059" }}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

const statusLabel = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  processing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await api.get("/dashboard");
      setData(r.data);
    })();
  }, []);

  if (!data) return <div className="p-10">Cargando…</div>;
  const { totals, daily_revenue, top_products, recent_orders, low_stock } = data;

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="label-eyebrow text-gray-500">Panel general</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Ingresos 30d" value={formatMoney(totals.revenue_30d)} icon={TrendingUp} subtext={`${totals.orders_30d} pedidos`} testid="stat-revenue-30d" />
        <StatCard label="Ingresos totales" value={formatMoney(totals.revenue_total)} icon={TrendingUp} testid="stat-revenue-total" />
        <StatCard label="Pedidos" value={totals.orders} icon={ShoppingBag} subtext={`${totals.paid_orders} pagados · ${totals.pending_orders} pendientes`} testid="stat-orders" />
        <StatCard label="Productos" value={totals.products} icon={Package} subtext={`${totals.active_products} activos`} testid="stat-products" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="cms-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow text-gray-500">Ingresos diarios</div>
              <div className="font-serif text-2xl mt-1">Últimos 14 días</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={daily_revenue}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e6e3de" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="total" stroke="#C5A059" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="cms-card p-6">
          <div className="label-eyebrow text-gray-500 mb-1">Más vendidos</div>
          <div className="font-serif text-2xl mb-4">Top productos</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={top_products} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="units" fill="#0A0A0A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="cms-card p-6 lg:col-span-2">
          <div className="label-eyebrow text-gray-500 mb-1">Actividad reciente</div>
          <div className="font-serif text-2xl mb-4">Últimos pedidos</div>
          <table className="cms-table w-full text-sm">
            <thead><tr className="text-left">
              <th className="py-2">Nº</th><th>Cliente</th><th>Estado</th><th className="text-right">Total</th>
            </tr></thead>
            <tbody>
              {recent_orders.map((o) => (
                <tr key={o.id} className="border-t border-gray-100" data-testid={`recent-order-${o.id}`}>
                  <td className="py-3 mono">{o.order_number}</td>
                  <td>{o.customer?.name}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded-sm" style={{ background: "#0A0A0A", color: "#C5A059" }}>{statusLabel[o.status] || o.status}</span></td>
                  <td className="text-right mono">{formatMoney(o.total)}</td>
                </tr>
              ))}
              {recent_orders.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-500">Sin pedidos aún</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cms-card p-6">
          <div className="label-eyebrow text-gray-500 mb-1 flex items-center gap-2"><AlertTriangle size={12} /> Stock bajo</div>
          <div className="font-serif text-2xl mb-4">Reposición</div>
          <ul className="space-y-2 text-sm">
            {low_stock.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-gray-100 pb-2" data-testid={`low-stock-${p.id}`}>
                <span>{p.name}</span>
                <span className="mono text-red-600">{p.stock}</span>
              </li>
            ))}
            {low_stock.length === 0 && <li className="text-gray-500">Todo en orden ✓</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
