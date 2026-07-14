import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";

const currentYear = new Date().getFullYear();
const PRESETS = [
  { l: "Este mes", getRange: () => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); return { from: `${y}-${m}-01`, to: new Date(y, d.getMonth() + 1, 0).toISOString().slice(0, 10) }; } },
  { l: "Este año", getRange: () => ({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31` }) },
  { l: "Todo", getRange: () => ({ from: "", to: "" }) },
];

export default function PnL() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31` });

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams();
        if (filter.from) p.set("from", filter.from);
        if (filter.to) p.set("to", filter.to);
        const r = await api.get(`/accounting/pnl?${p.toString()}`);
        setData(r.data);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
  }, [filter]);

  const margen = data ? (data.total_ingresos > 0 ? (data.resultado / data.total_ingresos * 100) : 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Desde</div>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="pnl-from" />
        </div>
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Hasta</div>
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="pnl-to" />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button key={p.l} onClick={() => setFilter(p.getRange())}
              className="px-2 py-1.5 text-xs border border-gray-300 hover:border-black">{p.l}</button>
          ))}
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Big label="Ingresos" value={data.total_ingresos} color="text-green-700" icon={TrendingUp} />
            <Big label="Gastos" value={data.total_gastos} color="text-red-700" icon={TrendingDown} />
            <Big label="Resultado" value={data.resultado}
                 color={data.resultado >= 0 ? "text-green-700" : "text-red-700"}
                 highlight sub={`Margen neto ${margen.toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Ingresos" rows={data.ingresos} total={data.total_ingresos} color="green" />
            <Section title="Gastos" rows={data.gastos} total={data.total_gastos} color="red" />
          </div>
        </>
      )}
    </div>
  );
}

function Big({ label, value, color, icon: Icon, highlight, sub }) {
  return (
    <div className={`p-5 border ${highlight ? "border-black" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow text-gray-500">{label}</div>
        {Icon && <Icon size={14} className="text-gray-400" />}
      </div>
      <div className={`font-serif text-4xl mt-1 ${color}`} data-testid={`pnl-${label.toLowerCase()}`}>{formatMoney(value)}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, rows, total, color }) {
  const bg = color === "green" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";
  const txt = color === "green" ? "text-green-800" : "text-red-800";
  return (
    <div className={`cms-card border ${bg} p-4`}>
      <div className={`label-eyebrow ${txt} mb-3`}>{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-xs">Sin movimientos.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-white/50 last:border-0">
              <td className="py-1.5 mono text-gray-500 text-xs">{r.code}</td>
              <td className="py-1.5">{r.name}</td>
              <td className="py-1.5 text-right font-serif">{formatMoney(r.amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-300 font-serif">
            <td colSpan={2} className="pt-2 text-sm">Total {title.toLowerCase()}</td>
            <td className={`pt-2 text-right text-lg ${txt}`}>{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
