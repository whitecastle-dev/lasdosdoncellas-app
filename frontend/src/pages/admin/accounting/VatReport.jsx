import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Receipt, ArrowRight } from "lucide-react";

// Presets: T1..T4 del año actual
const currentYear = new Date().getFullYear();
const PRESETS = [
  { l: "Q1", from: `${currentYear}-01-01`, to: `${currentYear}-03-31` },
  { l: "Q2", from: `${currentYear}-04-01`, to: `${currentYear}-06-30` },
  { l: "Q3", from: `${currentYear}-07-01`, to: `${currentYear}-09-30` },
  { l: "Q4", from: `${currentYear}-10-01`, to: `${currentYear}-12-31` },
  { l: `Año ${currentYear}`, from: `${currentYear}-01-01`, to: `${currentYear}-12-31` },
];

export default function VatReport() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ from: "", to: "" });

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams();
        if (filter.from) p.set("from", filter.from);
        if (filter.to) p.set("to", filter.to);
        const r = await api.get(`/accounting/vat?${p.toString()}`);
        setData(r.data);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Desde</div>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="vat-from" />
        </div>
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Hasta</div>
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="vat-to" />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button key={p.l} onClick={() => setFilter({ from: p.from, to: p.to })}
              data-testid={`vat-preset-${p.l}`}
              className="px-2 py-1.5 text-xs border border-gray-300 hover:border-black">{p.l}</button>
          ))}
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card icon={ArrowRight} label="IVA repercutido (477)" value={data.repercutido} color="text-green-700"
                  hint="Ventas facturadas + TPV" />
            <Card icon={ArrowRight} label="IVA soportado (472)" value={data.soportado} color="text-blue-700"
                  hint="Facturas de proveedor" reverse />
            <Card icon={Receipt} label="Liquidación" value={data.liquidacion}
                  color={data.liquidacion >= 0 ? "text-red-700" : "text-green-700"}
                  hint={data.liquidacion >= 0 ? "A ingresar en Hacienda" : "A compensar / devolver"} highlight />
          </div>

          <div className="cms-card border border-gray-200 p-6">
            <div className="label-eyebrow text-gray-500 mb-3">Fórmula</div>
            <div className="flex items-center gap-3 text-lg font-serif flex-wrap">
              <span className="text-green-700">{formatMoney(data.repercutido)}</span>
              <span className="text-gray-400">−</span>
              <span className="text-blue-700">{formatMoney(data.soportado)}</span>
              <span className="text-gray-400">=</span>
              <span className={`${data.liquidacion >= 0 ? "text-red-700" : "text-green-700"} font-bold text-2xl`} data-testid="vat-liquidacion">
                {formatMoney(data.liquidacion)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              La liquidación positiva indica que hay que <strong>ingresar</strong> en Hacienda ({formatMoney(data.a_ingresar)}).
              Negativa: hay saldo <strong>a compensar</strong> ({formatMoney(data.a_compensar)}) o solicitar devolución.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, color, hint, highlight, reverse }) {
  return (
    <div className={`p-5 border ${highlight ? "border-black" : "border-gray-200"} relative`}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow text-gray-500">{label}</div>
        <Icon size={14} className={`text-gray-400 ${reverse ? "rotate-180" : ""}`} />
      </div>
      <div className={`font-serif text-3xl mt-1 ${color}`}>{formatMoney(value)}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
