import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Coins, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function ErpSalaries() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get(`/erp/salaries/monthly?year=${year}&month=${month}`); setData(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [year, month]);

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="space-y-6">
      <div className="cms-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins size={20} className="text-[#C5A059]" />
          <div>
            <div className="label-eyebrow text-gray-500">Período</div>
            <div className="font-serif text-2xl">{MONTHS[month - 1]} {year}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 border border-gray-300 hover:border-black" data-testid="sal-prev"><ChevronLeft size={16} /></button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }} className="px-3 py-2 border border-gray-300 hover:border-black text-sm" data-testid="sal-today">Hoy</button>
          <button onClick={next} className="p-2 border border-gray-300 hover:border-black" data-testid="sal-next"><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : !data || data.rows.length === 0 ? (
        <>
          <div className="cms-card p-5 bg-black text-[#C5A059] flex items-center justify-between">
            <div className="label-eyebrow opacity-70">Total a pagar este mes</div>
            <div className="font-serif text-3xl" data-testid="sal-total">{formatMoney(0)}</div>
          </div>
          <div className="cms-card p-10 text-center text-gray-400">Sin salarios registrados en {MONTHS[month - 1]} {year}.</div>
        </>
      ) : (
        <>
          <div className="cms-card p-5 bg-black text-[#C5A059] flex items-center justify-between">
            <div className="label-eyebrow opacity-70">Total a pagar este mes</div>
            <div className="font-serif text-3xl" data-testid="sal-total">{formatMoney(data.total)}</div>
          </div>

          <div className="cms-card overflow-hidden">
            <table className="cms-table w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="text-right">Loncheados</th>
                  <th className="text-right">Kg totales</th>
                  <th className="text-right">€/kg medio</th>
                  <th className="text-right">Total a pagar</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.empleado_id} className="border-t border-gray-100" data-testid={`sal-row-${r.empleado_id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-gray-400">{r.rol}</div>
                    </td>
                    <td className="text-right mono">{r.loncheados}</td>
                    <td className="text-right mono">{r.total_kg.toFixed(2)} kg</td>
                    <td className="text-right mono text-xs text-gray-500">{formatMoney(r.total_kg > 0 ? r.total_importe / r.total_kg : 0)}</td>
                    <td className="text-right font-serif text-lg">{formatMoney(r.total_importe)}</td>
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
