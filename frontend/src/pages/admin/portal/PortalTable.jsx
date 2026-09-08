import React, { useMemo, useState } from "react";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { formatMoney } from "@/lib/api";
import { useLiveRows } from "./useLiveRows";
import { LiveBadge } from "./PortalHubLayout";

function fmtCell(value, type) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return formatMoney(Number(value));
  if (type === "number") return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Number(value));
  if (type === "date") {
    try { return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(value); }
  }
  if (type === "datetime") {
    try {
      const d = new Date(value);
      return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
    } catch { return String(value); }
  }
  if (type === "bool") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}

function badgeColor(txt) {
  if (!txt) return "bg-gray-100 text-gray-600";
  const s = String(txt).toUpperCase();
  if (["PAGADA", "COBRADA", "PAYED", "ACTIVA", "ACTIVO", "COMPLETADO", "OK"].includes(s)) return "bg-emerald-50 text-emerald-700";
  if (["PENDIENTE", "EMITIDA", "PROGRAMADO"].includes(s)) return "bg-amber-50 text-amber-700";
  if (["VENCIDA", "VENCIDO", "ANULADA", "CANCELADO", "ERROR"].includes(s)) return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

/**
 * Universal read-only data table backed by ``useLiveRows``.
 *
 * Props
 *   table:    Supabase table name (whitelisted in the proxy)
 *   select:   PostgREST select expression
 *   filters:  { estado: "eq.PAGADA", fecha: "gte.2026-01-01" }
 *   order:    e.g. "fecha.desc"
 *   limit:    default 200
 *   columns:  [{ key, label, type, badge, className }]
 *   searchKeys: keys to filter client-side
 */
export default function PortalTable({
  table,
  select = "*",
  filters = {},
  order,
  limit = 200,
  columns,
  searchKeys = [],
  emptyMessage = "Sin datos en este apartado.",
  interval = 20000,
  testId,
}) {
  const params = useMemo(() => ({
    select,
    ...filters,
    ...(order ? { order } : {}),
    limit,
  }), [select, filters, order, limit]);

  const { rows, error, loading, lastFetch } = useLiveRows(table, params, { interval });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (!q.trim() || !searchKeys.length) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
  }, [rows, q, searchKeys]);

  if (rows === null && !error) {
    return <div className="p-10 text-center text-gray-400 text-sm" data-testid={testId}><Loader2 className="mx-auto animate-spin" /></div>;
  }
  if (error) {
    return (
      <div className="cms-card p-6 flex items-start gap-3 border-red-200" data-testid={testId}>
        <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-red-700">No se pudo cargar la tabla <span className="font-mono">{table}</span></div>
          <div className="text-xs text-red-600 mt-1">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex items-center gap-3">
        {searchKeys.length > 0 && (
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar en pantalla…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 focus:border-black focus:outline-none text-sm"
              data-testid={`${testId || "portal-table"}-search`}
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">{filtered.length} filas</span>
          <LiveBadge lastFetch={lastFetch} loading={loading} />
        </div>
      </div>

      <div className="cms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.className || ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id || i} className="border-t border-gray-100 hover:bg-gray-50/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2 whitespace-nowrap ${c.className || ""}`}>
                      {c.badge
                        ? <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${badgeColor(r[c.key])}`}>{fmtCell(r[c.key], c.type)}</span>
                        : c.type === "money" || c.type === "number"
                          ? <span className="font-mono">{fmtCell(r[c.key], c.type)}</span>
                          : fmtCell(r[c.key], c.type)
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="p-10 text-center text-gray-400 text-sm">{emptyMessage}</div>}
      </div>
    </div>
  );
}
