import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Layers, RefreshCw } from "lucide-react";

const GROUPS = {
  4: "4 — Acreedores y deudores",
  5: "5 — Cuentas financieras",
  6: "6 — Compras y gastos",
  7: "7 — Ventas e ingresos",
};

const TIPO_COLOR = {
  activo: "bg-blue-100 text-blue-800",
  acreedor: "bg-orange-100 text-orange-800",
  deudor: "bg-purple-100 text-purple-800",
  gasto: "bg-red-100 text-red-800",
  ingreso: "bg-green-100 text-green-800",
};

export default function ChartOfAccounts() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      const [a, s] = await Promise.all([
        api.get("/accounting/accounts"),
        api.get("/accounting/summary"),
      ]);
      setRows(a.data);
      setSummary(s.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, []);

  const backfill = async () => {
    if (!window.confirm("Regenerar asientos desde documentos existentes (idempotente)?")) return;
    setRunning(true);
    try {
      const r = await api.post("/accounting/backfill");
      const c = r.data.created;
      toast.success(
        `${r.data.total_new_entries} nuevos: ${c.tickets} tickets · ${c.issued_invoices_issued + c.issued_invoices_paid} f. emitidas · ${c.supplier_invoices_issued + c.supplier_invoices_paid} f. proveedor · ${c.salaries_paid} nóminas · ${c.manual_movements} mov.`
      );
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setRunning(false);
    }
  };

  const byGroup = rows.reduce((m, a) => {
    (m[a.grupo] = m[a.grupo] || []).push(a);
    return m;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="text-sm text-gray-500">
          {rows.length} cuentas · {summary?.entries || 0} asientos generados
          {summary?.first_date && <> · desde <strong className="text-black">{summary.first_date}</strong> hasta <strong className="text-black">{summary.last_date}</strong></>}
        </div>
        <button
          onClick={backfill}
          disabled={running}
          className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50"
          data-testid="acc-backfill-btn"
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} />
          {running ? "Generando…" : "Regenerar asientos"}
        </button>
      </div>

      {[4, 5, 6, 7].map((g) => (
        <div key={g}>
          <div className="label-eyebrow text-gray-500 mb-2 flex items-center gap-2">
            <Layers size={12} />{GROUPS[g]}
          </div>
          <div className="cms-card overflow-hidden">
            <table className="cms-table w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(byGroup[g] || []).map((a) => (
                  <tr key={a.code} className="border-t border-gray-100" data-testid={`acc-account-${a.code}`}>
                    <td className="px-4 py-2 mono font-medium">{a.code}</td>
                    <td>{a.name}</td>
                    <td><span className={`text-xs px-2 py-0.5 ${TIPO_COLOR[a.tipo] || "bg-gray-100"}`}>{a.tipo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
