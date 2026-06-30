import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, Loader2, Database, CheckCircle2, AlertCircle } from "lucide-react";

const LABELS = {
  empleados: "Empleados",
  clientes: "Clientes",
  productos: "Productos / piezas",
  loncheados: "Loncheados",
  salarios: "Salarios",
  servicios_corte: "Servicios (eventos)",
  particulares_etiquetas: "Etiquetas particulares",
};

export default function ErpSync() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const doPreview = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/erp/sync/preview");
      setPreview(data);
    } catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { doPreview(); }, []);

  const doSync = async () => {
    if (!window.confirm("Iniciar sincronización completa con el portal Supabase. La operación es idempotente: registros existentes se actualizan, no se duplican. ¿Continuar?")) return;
    setRunning(true);
    setResults(null);
    try {
      const { data } = await api.post("/erp/sync/run");
      setResults(data);
      const total = (data.results || []).reduce((s, r) => s + (r.created || 0) + (r.updated || 0), 0);
      toast.success(`Sincronización OK · ${total} registros procesados`);
    } catch (err) { toast.error(formatApiError(err)); }
    setRunning(false);
    doPreview();
  };

  return (
    <div className="space-y-6">
      <div className="cms-card p-6">
        <div className="flex items-start gap-4">
          <Database size={32} className="text-[#C5A059] mt-1" />
          <div className="flex-1">
            <div className="font-serif text-xl">Sincronización con el portal histórico</div>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Trae todos los datos del antiguo portal Supabase (clientes, empleados, productos, loncheados, salarios, eventos y etiquetas).
              La sincronización es <strong>idempotente</strong>: si re-ejecutas, solo actualiza lo que cambió, nunca duplica.
            </p>
            <div className="flex gap-3 mt-4">
              <button onClick={doPreview} disabled={loading} className="px-4 py-2 border border-gray-300 hover:border-black text-sm flex items-center gap-2" data-testid="sync-preview">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refrescar conteos
              </button>
              <button onClick={doSync} disabled={running} className="px-5 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50" data-testid="sync-run">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                Sincronizar ahora
              </button>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="cms-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Tabla origen (Supabase)</th>
                <th className="text-right">Registros</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(preview.tables || []).map((t) => (
                <tr key={t.table} className="border-t border-gray-100">
                  <td className="px-4 py-2">{LABELS[t.table] || t.table}<span className="text-gray-400 ml-2 text-xs mono">{t.table}</span></td>
                  <td className="text-right mono">{t.count}</td>
                  <td>
                    {t.status === 206 || t.status === 200
                      ? <span className="text-green-700 text-xs flex items-center gap-1"><CheckCircle2 size={12} /> Accesible</span>
                      : <span className="text-red-600 text-xs flex items-center gap-1"><AlertCircle size={12} /> {t.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && (
        <div className="cms-card p-5" data-testid="sync-results">
          <div className="label-eyebrow text-gray-500 mb-3">Resultado de la última sincronización</div>
          <div className="space-y-2">
            {(results.results || []).map((r) => (
              <div key={r.table} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                <div className="font-medium">{LABELS[r.table] || r.table}</div>
                <div className="text-xs text-gray-500 flex gap-4">
                  <span>traídos: <strong className="text-black">{r.fetched}</strong></span>
                  <span>creados: <strong className="text-green-700">{r.created}</strong></span>
                  <span>actualizados: <strong className="text-blue-700">{r.updated}</strong></span>
                  {r.errors > 0 && <span>errores: <strong className="text-red-600">{r.errors}</strong></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
