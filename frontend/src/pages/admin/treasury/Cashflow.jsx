import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from "lucide-react";

export default function Cashflow() {
  const [d, setD] = useState(null);
  const [days, setDays] = useState(30);
  const load = async () => {
    try { const r = await api.get(`/treasury/cashflow?days=${days}`); setD(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [days]);
  if (!d) return <div className="text-gray-400 py-10 text-center">Calculando previsión…</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {[7, 30, 60, 90].map((n) => (
          <button key={n} onClick={() => setDays(n)} data-testid={`cf-days-${n}`}
            className={`px-3 py-1.5 text-xs border ${days === n ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}>
            {n} días
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cms-card p-6 bg-black text-[#C5A059]">
          <div className="label-eyebrow opacity-70 flex items-center gap-2"><Wallet size={14} /> Saldo actual (todas las cuentas)</div>
          <div className="font-serif text-5xl mt-2" data-testid="cf-saldo-actual">{formatMoney(d.saldo_actual)}</div>
          <div className="mt-4 space-y-1 text-xs opacity-80">
            {d.cuentas.map((a) => (
              <div key={a.id} className="flex justify-between"><span>{a.nombre}</span><span className="mono">{formatMoney(a.saldo)}</span></div>
            ))}
          </div>
        </div>
        <div className={`cms-card p-6 border-2 ${d.saldo_proyectado >= 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
          <div className="label-eyebrow text-gray-600 flex items-center gap-2"><TrendingUp size={14} /> Proyectado en {d.dias} días</div>
          <div className="font-serif text-5xl mt-2" data-testid="cf-saldo-proyectado">{formatMoney(d.saldo_proyectado)}</div>
          <div className="mt-4 text-xs space-y-1">
            <div className="flex justify-between"><span className="flex items-center gap-1 text-green-800"><ArrowUpCircle size={12} />Por cobrar ({d.por_cobrar.count})</span><span className="mono">+{formatMoney(d.por_cobrar.total)}</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1 text-red-800"><ArrowDownCircle size={12} />Por pagar ({d.por_pagar.count})</span><span className="mono">−{formatMoney(d.por_pagar.total)}</span></div>
          </div>
        </div>
      </div>
      {(d.vencidos_cobro.count > 0 || d.vencidos_pago.count > 0) && (
        <div className="cms-card p-5 bg-amber-50 border-2 border-amber-300 flex items-start gap-3">
          <AlertTriangle className="text-amber-800 mt-1" size={24} />
          <div className="flex-1">
            <div className="font-serif text-lg text-amber-900">Vencidos requieren atención</div>
            <div className="text-sm mt-1 grid grid-cols-2 gap-4">
              {d.vencidos_cobro.count > 0 && <div><strong className="text-amber-900">Cobros vencidos:</strong> {d.vencidos_cobro.count} facturas · {formatMoney(d.vencidos_cobro.total)}</div>}
              {d.vencidos_pago.count > 0 && <div><strong className="text-red-800">Pagos vencidos:</strong> {d.vencidos_pago.count} facturas · {formatMoney(d.vencidos_pago.total)}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
