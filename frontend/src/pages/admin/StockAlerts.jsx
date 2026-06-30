import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, RefreshCw, FileText, CheckCircle2, XCircle, Mail,
  X, Trash2, Loader2, ShieldCheck, ChevronRight, Edit3, Download
} from "lucide-react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABELS = {
  pending_approval: { label: "Pendiente aprobación", color: "bg-amber-100 text-amber-900 border-amber-200" },
  approved: { label: "Aprobado · pendiente envío", color: "bg-blue-100 text-blue-900 border-blue-200" },
  sent: { label: "Enviado al proveedor", color: "bg-green-100 text-green-900 border-green-200" },
  rejected: { label: "Rechazado", color: "bg-gray-200 text-gray-700 border-gray-300" },
};

const STATUS_FILTERS = [
  { v: "pending_approval", l: "Pendientes" },
  { v: "approved", l: "Aprobados sin envío" },
  { v: "sent", l: "Enviados" },
  { v: "rejected", l: "Rechazados" },
];

export default function StockAlertsAdmin() {
  const { user } = useAuth();
  const isSuper = !!user?.is_superadmin;

  const [tab, setTab] = useState("pending_approval");
  const [alerts, setAlerts] = useState([]);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [drawer, setDrawer] = useState(null); // alert id
  const [loading, setLoading] = useState(true);

  const load = async (status = tab) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/stock-alerts?status=${status}`);
      setAlerts(data);
    } catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };
  useEffect(() => { load(tab); }, [tab]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await api.get("/stock-alerts/scan");
      setScan(data);
      toast.success(`Escaneo completado: ${data.summary.providers} proveedores · ${data.summary.items} productos a reponer`);
    } catch (err) { toast.error(formatApiError(err)); }
    setScanning(false);
  };

  const runGenerate = async () => {
    if (!window.confirm("¿Generar borradores de proforma para todos los productos con stock bajo? Los proveedores NO recibirán nada todavía: necesitarás aprobar cada uno.")) return;
    setGenerating(true);
    try {
      const { data } = await api.post("/stock-alerts/generate");
      const created = data.created?.length || 0;
      const updated = data.updated?.length || 0;
      if (!created && !updated) {
        toast.info(data.message || "No hay productos con stock bajo");
      } else {
        toast.success(`${created} borrador(es) nuevos, ${updated} actualizados`);
        setTab("pending_approval");
        load("pending_approval");
      }
    } catch (err) { toast.error(formatApiError(err)); }
    setGenerating(false);
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Reposición automática</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
            <AlertTriangle size={28} className="text-[#C5A059]" />
            Alertas de stock
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            Escanea productos por debajo del umbral, genera borradores de proforma agrupados por proveedor, y
            <strong> tras la aprobación del superadministrador</strong>, el sistema envía el PDF directamente al proveedor.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={runScan} disabled={scanning}
            className="px-4 py-2 border border-gray-300 hover:border-black text-sm flex items-center gap-2 disabled:opacity-50"
            data-testid="stock-scan">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Escanear stock bajo
          </button>
          <button onClick={runGenerate} disabled={generating}
            className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50"
            data-testid="stock-generate">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Generar borradores
          </button>
        </div>
      </div>

      {scan && (
        <div className="cms-card p-5 mb-6" data-testid="stock-scan-result">
          <div className="flex items-center justify-between mb-4">
            <div className="label-eyebrow text-gray-500">Resultado de escaneo</div>
            <button onClick={() => setScan(null)} className="text-xs text-gray-400 hover:text-black" data-testid="stock-scan-close">Cerrar</button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat label="Proveedores afectados" value={scan.summary.providers} />
            <Stat label="Productos por reponer" value={scan.summary.items} />
            <Stat label="Valor estimado" value={formatMoney(scan.summary.total_value)} />
          </div>
          {scan.summary.items === 0 ? (
            <div className="text-sm text-gray-500">Sin productos por debajo del umbral. Todo en orden.</div>
          ) : (
            <div className="space-y-3">
              {scan.groups.map((g) => (
                <div key={g.provider_id} className="border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{g.provider.company || g.provider.name}</div>
                    <div className="text-xs text-gray-500">{g.provider.email}</div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-gray-400 text-left">
                      <tr><th>SKU</th><th>Producto</th><th className="text-right">Stock</th><th className="text-right">Umbral</th><th className="text-right">Pedir</th><th className="text-right">Subtotal</th></tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => (
                        <tr key={it.product_id} className="border-t border-gray-100">
                          <td className="mono py-1">{it.sku}</td>
                          <td>{it.name}</td>
                          <td className="text-right text-red-700 font-medium">{it.current_stock}</td>
                          <td className="text-right text-gray-500">{it.threshold}</td>
                          <td className="text-right font-medium">{it.qty}</td>
                          <td className="text-right mono">{formatMoney(it.qty * it.unit_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {STATUS_FILTERS.map((s) => (
          <button key={s.v} onClick={() => setTab(s.v)} data-testid={`stock-tab-${s.v}`}
            className={`px-4 py-2 text-sm transition-colors ${tab === s.v ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"}`}>
            {s.l}
          </button>
        ))}
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="px-4 py-3">Proveedor</th>
              <th>Productos</th>
              <th className="text-right">Total estimado</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Proforma</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-12 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && alerts.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                {tab === "pending_approval"
                  ? "Sin borradores pendientes. Escanea y genera para crear nuevos."
                  : "Sin registros en este estado."}
              </td></tr>
            )}
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDrawer(a.id)} data-testid={`stock-alert-${a.id}`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{a.provider?.company || a.provider?.name}</div>
                  <div className="text-xs text-gray-500 mono">{a.provider?.email}</div>
                </td>
                <td className="text-gray-700">{a.items?.length || 0}</td>
                <td className="text-right mono">{formatMoney(a.total)}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString("es-ES")}</td>
                <td className="mono text-xs">{a.proforma_number || "—"}</td>
                <td className="text-right pr-4"><ChevronRight size={16} className="text-gray-400 inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <AlertDrawer
          alertId={drawer}
          isSuper={isSuper}
          onClose={() => setDrawer(null)}
          onChanged={() => { load(tab); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-gray-200 p-4">
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className="font-serif text-3xl mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`text-xs px-2 py-0.5 border ${s.color}`}>{s.label}</span>;
}


function AlertDrawer({ alertId, isSuper, onClose, onChanged }) {
  const [a, setA] = useState(null);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/stock-alerts/${alertId}`);
      setA(data);
      setItems(data.items.map((i) => ({ ...i })));
      setNotes(data.notes || "");
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [alertId]);

  const isPending = a?.status === "pending_approval";
  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_cost) || 0), 0), [items]);

  const updateItem = (idx, field, value) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/stock-alerts/${alertId}`, {
        items: items.map((i) => ({
          product_id: i.product_id, sku: i.sku, name: i.name,
          current_stock: Number(i.current_stock) || 0,
          threshold: Number(i.threshold) || 0,
          qty: Number(i.qty) || 0,
          unit_cost: Number(i.unit_cost) || 0,
        })),
        notes,
      });
      toast.success("Cambios guardados");
      load(); onChanged();
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  const approve = async () => {
    if (!window.confirm(`¿Aprobar y enviar la proforma a ${a.provider?.email}? Se generará el PDF y se mandará por email al proveedor. Esta acción no se puede deshacer.`)) return;
    setApproving(true);
    try {
      const { data } = await api.post(`/stock-alerts/${alertId}/approve`);
      if (data.email_sent) {
        toast.success(`Proforma ${data.proforma_number} enviada a ${data.provider?.email}`);
      } else {
        toast.warning(`Proforma ${data.proforma_number} aprobada — PDF generado, pero el email no se pudo enviar (revisa Brevo).`);
      }
      onChanged();
      onClose();
    } catch (err) { toast.error(formatApiError(err)); }
    setApproving(false);
  };

  const reject = async (reason) => {
    try {
      await api.post(`/stock-alerts/${alertId}/reject`, { reason });
      toast.success("Proforma rechazada");
      setShowReject(false);
      onChanged(); onClose();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const downloadPdf = async () => {
    try {
      const resp = await api.get(`/stock-alerts/${alertId}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proforma_${a?.proforma_number || "borrador"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const del = async () => {
    if (!window.confirm("¿Eliminar esta alerta? No se puede deshacer.")) return;
    try {
      await api.delete(`/stock-alerts/${alertId}`);
      toast.success("Eliminado");
      onChanged(); onClose();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  if (!a) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40">
        <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="stock-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">
              {a.proforma_number ? `Proforma ${a.proforma_number}` : "Borrador de proforma"}
            </div>
            <div className="font-serif text-2xl flex items-center gap-2 mt-1">
              <AlertTriangle size={18} className="text-[#C5A059]" />
              {a.provider?.company || a.provider?.name}
            </div>
            <div className="text-xs text-gray-500 mt-1">{a.provider?.email}{a.provider?.phone && ` · ${a.provider.phone}`}</div>
          </div>
          <button onClick={onClose} data-testid="stock-drawer-close"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <StatusBadge status={a.status} />
            <button onClick={downloadPdf} className="text-sm text-gray-600 hover:text-black flex items-center gap-1" data-testid="stock-pdf-download">
              <Download size={14} /> Descargar PDF
            </button>
          </div>

          {a.status === "rejected" && a.rejected_reason && (
            <div className="bg-red-50 border border-red-200 p-4">
              <div className="label-eyebrow text-red-800 mb-1">Motivo del rechazo</div>
              <div className="text-sm text-red-900">{a.rejected_reason}</div>
              {a.approved_by_name && <div className="text-xs text-red-700 mt-2">Por {a.approved_by_name}</div>}
            </div>
          )}

          {(a.status === "approved" || a.status === "sent") && (
            <div className="bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
              <ShieldCheck size={18} className="text-blue-900 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-medium text-blue-900">
                  {a.status === "sent" ? "Aprobada y enviada al proveedor" : "Aprobada · email no enviado"}
                </div>
                <div className="text-xs text-blue-800 mt-1">
                  Por {a.approved_by_name} · {new Date(a.reviewed_at).toLocaleString("es-ES")}
                </div>
                {a.status === "approved" && (
                  <div className="text-xs text-amber-800 mt-2">
                    El email no se envió (servicio Brevo desactivado o error temporal). Puedes descargar el PDF y enviarlo manualmente.
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="label-eyebrow text-gray-500 mb-3 flex items-center gap-2"><Edit3 size={12} /> Líneas de la proforma</div>
            <div className="border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">SKU</th>
                    <th className="text-left">Producto</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Umbral</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">P. unit. €</th>
                    <th className="text-right">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-3 py-2 mono text-xs">{it.sku}</td>
                      <td className="text-xs">{it.name}</td>
                      <td className="text-right text-red-700">{it.current_stock}</td>
                      <td className="text-right text-gray-400">{it.threshold}</td>
                      <td className="text-right">
                        <input type="number" min={0} value={it.qty} disabled={!isPending}
                          onChange={(e) => updateItem(idx, "qty", e.target.value)}
                          className="w-20 border border-gray-200 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-500"
                          data-testid={`stock-item-qty-${idx}`} />
                      </td>
                      <td className="text-right">
                        <input type="number" min={0} step={0.01} value={it.unit_cost} disabled={!isPending}
                          onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                          className="w-24 border border-gray-200 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-500"
                          data-testid={`stock-item-cost-${idx}`} />
                      </td>
                      <td className="text-right mono text-xs">{formatMoney((Number(it.qty) || 0) * (Number(it.unit_cost) || 0))}</td>
                      <td className="px-2">
                        {isPending && (
                          <button onClick={() => removeItem(idx)} className="p-1 text-red-600 hover:bg-red-50" data-testid={`stock-item-remove-${idx}`}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="py-4 text-center text-gray-400 text-xs">Sin líneas — añade items o elimina la alerta.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black bg-gray-50">
                    <td colSpan={6} className="text-right px-3 py-2 font-medium">TOTAL estimado</td>
                    <td className="text-right font-serif text-lg" data-testid="stock-total">{formatMoney(subtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Notas para el proveedor (aparecen en el PDF y en el email)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isPending}
              placeholder="Urgente para Semana Santa, condiciones especiales…"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none disabled:bg-gray-50 disabled:text-gray-500"
              data-testid="stock-notes" />
          </div>

          {isPending && (
            <div className="border-t border-gray-200 pt-5 space-y-3">
              <button onClick={save} disabled={saving}
                className="px-4 py-2 border border-gray-300 hover:border-black text-sm disabled:opacity-50"
                data-testid="stock-save">
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>

              {!isSuper && (
                <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-center gap-2">
                  <ShieldCheck size={16} /> Solo el superadministrador puede aprobar o rechazar el envío al proveedor.
                </div>
              )}

              {isSuper && (
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={approve} disabled={approving || items.length === 0}
                    className="px-5 py-2.5 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50"
                    data-testid="stock-approve">
                    {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Aprobar y enviar al proveedor
                  </button>
                  <button onClick={() => setShowReject(true)} disabled={approving}
                    className="px-4 py-2.5 border border-red-300 text-red-700 text-sm flex items-center gap-2 hover:bg-red-50"
                    data-testid="stock-reject-open">
                    <XCircle size={14} /> Rechazar
                  </button>
                  <button onClick={del} className="ml-auto p-2 text-gray-400 hover:text-red-600" title="Eliminar alerta" data-testid="stock-delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {!isPending && (
            <div className="border-t border-gray-200 pt-5">
              <button onClick={del} className="text-xs text-red-600 hover:underline flex items-center gap-1" data-testid="stock-delete">
                <Trash2 size={12} /> Eliminar registro
              </button>
            </div>
          )}
        </div>

        {showReject && <RejectModal onCancel={() => setShowReject(false)} onConfirm={reject} />}
      </div>
    </div>
  );
}

function RejectModal({ onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="stock-reject-modal">
        <div className="font-serif text-xl mb-1">Rechazar proforma</div>
        <p className="text-sm text-gray-500 mb-4">El motivo se guardará en el historial. No se enviará nada al proveedor.</p>
        <textarea autoFocus rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Precio fuera de presupuesto, pedido duplicado, esperar próxima semana…"
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-black outline-none"
          data-testid="stock-reject-reason" />
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300" data-testid="stock-reject-cancel">Cancelar</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            className="px-4 py-2 bg-red-600 text-white text-sm disabled:opacity-50"
            data-testid="stock-reject-confirm">
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}
