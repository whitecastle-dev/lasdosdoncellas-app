import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, Factory, Users, Package, User } from "lucide-react";

const RANGES = [
  { l: "7d", v: 7 }, { l: "30d", v: 30 }, { l: "90d", v: 90 },
];

export default function ErpAnalytics() {
  const [days, setDays] = useState(30);
  const [evo, setEvo] = useState(null);
  const [emp, setEmp] = useState(null);
  const [cli, setCli] = useState(null);
  const [pro, setPro] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b, c, d] = await Promise.all([
          api.get(`/erp/analytics/evolution?days=${days}`),
          api.get(`/erp/analytics/top-employees?days=${days}&limit=8`),
          api.get(`/erp/analytics/top-clients?days=${days}&limit=8`),
          api.get(`/erp/analytics/top-products?days=${days}&limit=8`),
        ]);
        setEvo(a.data); setEmp(b.data); setCli(c.data); setPro(d.data);
      } catch (err) {
        toast.error(formatApiError(err));
      }
    })();
  }, [days]);

  if (!evo) return <div className="py-16 text-center text-gray-400">Cargando…</div>;

  const maxKg = Math.max(1, ...evo.rows.map((r) => r.kg));
  const totalKg = evo.rows.reduce((s, r) => s + r.kg, 0);
  const totalIng = evo.rows.reduce((s, r) => s + r.ingresos, 0);
  const totalCost = evo.rows.reduce((s, r) => s + r.coste, 0);
  const totalPieces = evo.rows.reduce((s, r) => s + r.count, 0);
  const beneficio = totalIng - totalCost;

  return (
    <div className="space-y-6" data-testid="erp-analytics">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Evolución de la sala de loncheado</div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.v}
              onClick={() => setDays(r.v)}
              data-testid={`erp-an-range-${r.v}`}
              className={`px-3 py-1.5 text-xs border ${days === r.v ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}
            >
              Últimos {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={Factory} label="Piezas" value={totalPieces} />
        <KPI icon={TrendingUp} label="Kilos" value={`${totalKg.toFixed(1)} kg`} />
        <KPI icon={TrendingUp} label="Ingresos" value={formatMoney(totalIng)} />
        <KPI icon={TrendingUp} label="Coste" value={formatMoney(totalCost)} color="text-red-700" />
        <KPI icon={TrendingUp} label="Beneficio" value={formatMoney(beneficio)}
             color={beneficio >= 0 ? "text-green-700" : "text-red-700"} highlight />
      </div>

      {/* Evolution chart */}
      <div className="cms-card border border-gray-200 p-5" data-testid="erp-evolution-chart">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-lg">Kilos loncheados por día</div>
          <div className="text-xs text-gray-500">Últimos {days} días</div>
        </div>
        <div className="flex items-end gap-0.5 h-40 overflow-x-auto">
          {evo.rows.map((r) => {
            const h = r.kg > 0 ? Math.max(4, (r.kg / maxKg) * 100) : 2;
            return (
              <div key={r.day} className="flex-1 min-w-[10px] flex flex-col justify-end group relative"
                   title={`${r.day}: ${r.kg.toFixed(1)} kg · ${formatMoney(r.ingresos)}`}>
                <div style={{ height: `${h}%` }}
                     className="bg-gradient-to-t from-[#C5A059] to-[#DFC48A] transition-all hover:opacity-80" />
                {r.kg === 0 && <div className="h-0.5 bg-gray-200" />}
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 whitespace-nowrap pointer-events-none z-10">
                  {r.day.slice(5)} · {r.kg.toFixed(1)}kg · {formatMoney(r.ingresos)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{evo.rows[0]?.day.slice(5)}</span>
          <span>{evo.rows[evo.rows.length - 1]?.day.slice(5)}</span>
        </div>
      </div>

      {/* Tops grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopPanel title="Top empleados" icon={User} rows={emp?.rows || []}
                  labelKey="nombre" testid="erp-top-employees" />
        <TopPanel title="Top clientes" icon={Users} rows={cli?.rows || []}
                  labelKey="nombre" testid="erp-top-clients" showRevenue />
        <TopPanel title="Top productos" icon={Package} rows={pro?.rows || []}
                  labelKey="nombre" testid="erp-top-products" />
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, highlight }) {
  return (
    <div className={`p-4 border ${highlight ? "border-black" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow text-gray-500">{label}</div>
        <Icon size={12} className="text-gray-400" />
      </div>
      <div className={`font-serif text-2xl mt-1 ${color || ""}`}>{value}</div>
    </div>
  );
}

function TopPanel({ title, icon: Icon, rows, labelKey, testid, showRevenue }) {
  return (
    <div className="cms-card border border-gray-200" data-testid={testid}>
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
        <Icon size={14} className="text-[#C5A059]" />
        <div className="font-medium text-sm">{title}</div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={3} className="py-8 text-center text-gray-400 text-xs">Sin datos.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-4 py-2 mono text-xs text-gray-400">#{i + 1}</td>
              <td>
                <div>{r[labelKey]}</div>
                <div className="text-xs text-gray-400">{r.piezas} piezas · {r.kg.toFixed(1)} kg</div>
              </td>
              <td className="text-right px-4 font-serif">
                {showRevenue ? formatMoney(r.ingresos) : `${r.kg.toFixed(1)} kg`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
