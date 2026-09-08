import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, Cable, CheckCircle2, AlertCircle, Building2,
  ArrowUpRight, ArrowDownRight, Wallet, FileText, Users, Truck, Coins,
} from "lucide-react";
import { InvoiceDetailDrawer, EntityDetailDrawer } from "./ContaSimpleDrawers";
import { ProductsAnalyticsTable, ProductDetailDrawer } from "./ContaSimpleProducts";

const TABS = [
  { id: "overview", label: "Resumen" },
  { id: "invoices_issued", label: "Facturas emitidas" },
  { id: "invoices_received", label: "Facturas recibidas" },
  { id: "products", label: "Productos vendidos" },
  { id: "customers", label: "Clientes" },
  { id: "providers", label: "Proveedores" },
  { id: "payments", label: "Cobros / Pagos" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}
function fmtWhen(iso) {
  if (!iso) return "nunca";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function KpiCard({ icon: Icon, label, value, sub, tone = "gold" }) {
  const toneCls = {
    gold: "text-[#C5A059]",
    green: "text-emerald-600",
    red: "text-red-600",
    blue: "text-blue-600",
    slate: "text-slate-500",
  }[tone];
  return (
    <div className="cms-card p-5" data-testid={`cs-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="label-eyebrow text-gray-500 text-[10px]">{label}</div>
          <div className="font-serif text-2xl mt-1">{value}</div>
          {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
        <Icon size={22} className={toneCls} />
      </div>
    </div>
  );
}

function StatusRow({ item, dbCount }) {
  const ok = item.status === 200;
  return (
    <tr className="border-t border-gray-100" data-testid={`cs-preview-${item.dest}`}>
      <td className="px-4 py-2">
        <div className="font-medium">{item.label}</div>
        <div className="text-[11px] text-gray-400 font-mono">{item.src}</div>
      </td>
      <td className="text-right font-mono">{item.count.toLocaleString("es-ES")}</td>
      <td className="text-right font-mono text-gray-500">{(dbCount ?? 0).toLocaleString("es-ES")}</td>
      <td className="pl-4">
        {ok ? (
          <span className="text-emerald-700 text-xs flex items-center gap-1">
            <CheckCircle2 size={12} /> Accesible
          </span>
        ) : (
          <span className="text-red-600 text-xs flex items-center gap-1">
            <AlertCircle size={12} /> {item.status}
          </span>
        )}
      </td>
    </tr>
  );
}

function InvoicesTable({ endpoint, testId, onOpenInvoice, onOpenCustomer }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(endpoint); setRows(data.items || []); }
      catch (e) { toast.error(formatApiError(e)); setRows([]); }
    })();
  }, [endpoint]);
  if (rows === null) return <div className="p-10 text-center text-gray-400 text-sm"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!rows.length) return <div className="p-10 text-center text-gray-400 text-sm">Sin datos. Ejecuta una sincronización.</div>;

  return (
    <div className="cms-card overflow-hidden" data-testid={testId}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Nº</th>
            <th className="py-3">Fecha</th>
            <th className="py-3">Contraparte</th>
            <th className="py-3 text-right">Base</th>
            <th className="py-3 text-right">IVA</th>
            <th className="py-3 text-right">Total</th>
            <th className="py-3 text-right">Cobrado</th>
            <th className="py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isIssued = r.type === "Issued";
            const contraparte = isIssued ? r.target?.organization : r.issuer?.organization;
            const contraNif = isIssued ? r.target?.nif : r.issuer?.nif;
            const paid = r.status === "Payed";
            return (
              <tr
                key={r.id}
                onClick={() => onOpenInvoice && onOpenInvoice(r.id)}
                className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                data-testid={`cs-invoice-row-${r.id}`}
              >
                <td className="px-4 py-2 font-mono text-xs text-[#C5A059] underline decoration-dotted">{r.number}</td>
                <td>{fmtDate(r.invoice_date)}</td>
                <td className="truncate max-w-[280px]">
                  {isIssued && contraNif ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenCustomer && onOpenCustomer(contraNif); }}
                      className="hover:underline text-left"
                      data-testid={`cs-invoice-row-${r.id}-open-customer`}
                    >
                      {contraparte || "—"}
                    </button>
                  ) : (contraparte || "—")}
                </td>
                <td className="text-right font-mono">{formatMoney(r.total_taxable_amount)}</td>
                <td className="text-right font-mono text-gray-500">{formatMoney(r.total_vat_amount)}</td>
                <td className="text-right font-mono font-medium">{formatMoney(r.total_amount)}</td>
                <td className="text-right font-mono text-emerald-700">{formatMoney(r.total_payed_amount)}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {paid ? "Cobrada" : r.status || "Pendiente"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntityTable({ endpoint, testId, onOpenEntity }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(endpoint); setRows(data.items || []); }
      catch (e) { toast.error(formatApiError(e)); setRows([]); }
    })();
  }, [endpoint]);
  const filtered = useMemo(() => {
    if (!rows) return null;
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (r.organization || "").toLowerCase().includes(s)
      || (r.nif || "").toLowerCase().includes(s)
      || (r.city || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  if (rows === null) return <div className="p-10 text-center text-gray-400 text-sm"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="space-y-3" data-testid={testId}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, NIF o ciudad…"
        className="w-full max-w-md px-3 py-2 border border-gray-300 focus:border-black focus:outline-none text-sm"
        data-testid="cs-entities-search"
      />
      <div className="cms-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="py-3">NIF</th>
              <th className="py-3">Ciudad</th>
              <th className="py-3">Provincia</th>
              <th className="py-3">Teléfono</th>
              <th className="py-3">Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpenEntity && onOpenEntity(r.id)}
                className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                data-testid={`cs-entity-row-${r.id}`}
              >
                <td className="px-4 py-2 font-medium text-[#C5A059] underline decoration-dotted">{r.organization || "—"}</td>
                <td className="font-mono text-xs">{r.nif}</td>
                <td>{r.city}</td>
                <td className="text-gray-500">{r.province}</td>
                <td>{r.phone || r.mobile || "—"}</td>
                <td className="text-gray-500">{r.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="p-8 text-center text-gray-400 text-sm">Sin resultados</div>}
      </div>
    </div>
  );
}

function PaymentsTable({ onOpenInvoice }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/contasimple/treasury/payments"); setRows(data.items || []); }
      catch (e) { toast.error(formatApiError(e)); setRows([]); }
    })();
  }, []);
  if (rows === null) return <div className="p-10 text-center text-gray-400 text-sm"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!rows.length) return <div className="p-10 text-center text-gray-400 text-sm">Sin datos. Ejecuta una sincronización.</div>;
  return (
    <div className="cms-card overflow-hidden" data-testid="cs-payments-table">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="py-3">Documento</th>
            <th className="py-3">Tipo</th>
            <th className="py-3">Método</th>
            <th className="py-3 text-right">Importe</th>
            <th className="py-3">Conciliación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isInvoice = r.related_document_type === "IssuedInvoice" || r.related_document_type === "ReceivedInvoice";
            return (
              <tr
                key={r.id}
                onClick={() => isInvoice && r.related_document_id && onOpenInvoice && onOpenInvoice(r.related_document_id)}
                className={`border-t border-gray-100 hover:bg-gray-50/70 ${isInvoice ? "cursor-pointer" : ""}`}
                data-testid={`cs-payment-row-${r.id}`}
              >
                <td className="px-4 py-2">{fmtDate(r.date)}</td>
                <td className={`font-mono text-xs ${isInvoice ? "text-[#C5A059] underline decoration-dotted" : ""}`}>{r.related_document_number || "—"}</td>
                <td className="text-xs text-gray-500">{r.related_document_type}</td>
                <td>{r.payment_method_name}</td>
                <td className="text-right font-mono font-medium">{formatMoney(r.amount)}</td>
                <td>
                  <span className="text-xs text-gray-500">{r.reconciliation_status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ContaSimpleSync() {
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [tab, setTab] = useState("overview");

  // Drawers
  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  const [openEntity, setOpenEntity] = useState(null); // { kind, id }
  const [openProductKey, setOpenProductKey] = useState(null);

  const openInvoice = (id) => setOpenInvoiceId(id);
  const openEntityById = (kind, id) => setOpenEntity({ kind, id });
  const openProduct = (key) => setOpenProductKey(key);

  const openCustomerByNif = async (nif) => {
    if (!nif) return;
    try {
      const { data } = await api.get(`/contasimple/customers?q=${encodeURIComponent(nif)}&limit=1`);
      const c = (data.items || []).find((r) => (r.nif || "").toLowerCase() === nif.toLowerCase()) || (data.items || [])[0];
      if (c) setOpenEntity({ kind: "customer", id: c.id });
      else toast.error(`No hay cliente con NIF ${nif}`);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const load = async () => {
    setLoadingPreview(true);
    // Kick each request off independently so the header renders as soon
    // as /status returns (preview hits ContaSimple ~8× and can take 5-8s).
    api.get("/contasimple/status").then((r) => setStatus(r.data)).catch((e) => toast.error(formatApiError(e)));
    api.get("/contasimple/summary").then((r) => setSummary(r.data)).catch(() => {});
    try {
      const p = await api.get("/contasimple/preview");
      setPreview(p.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doSync = async () => {
    if (!window.confirm("Iniciar la sincronización completa con ContaSimple.\n\nSe descargan facturas, clientes, proveedores, cobros y formas de pago. La operación es idempotente (no duplica).\n\n¿Continuar?")) return;
    setRunning(true);
    try {
      const { data } = await api.post("/contasimple/run");
      const total = (data.results || []).reduce((s, r) => s + (r.created || 0) + (r.updated || 0), 0);
      toast.success(`Sincronización OK · ${total} registros procesados`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    setRunning(false);
  };

  const company = status?.company;

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="label-eyebrow text-gray-500">Contabilidad · Sincronización</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <Cable size={28} className="text-[#C5A059]" />
          ContaSimple
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Puente en vivo con la cuenta contable oficial en ContaSimple. Descarga
          facturas emitidas / recibidas, clientes, proveedores, cobros y formas de pago
          para dejarlos consultables desde este panel. La operación es
          <strong> idempotente</strong>: al re-ejecutar solo se actualiza lo que cambió.
        </p>
      </div>

      {/* Empresa + Botón */}
      <div className="cms-card p-5 mb-6" data-testid="cs-company-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-black/5 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-[#C5A059]" />
            </div>
            <div>
              <div className="font-serif text-lg">{company?.organization || "—"}</div>
              <div className="text-xs text-gray-500 mt-0.5 font-mono">
                NIF {company?.nif || "—"} · empresa #{company?.id || "—"}
              </div>
              <div className="text-xs text-gray-500">{company?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Última sync</div>
              <div className="text-sm font-medium">{fmtWhen(status?.last_sync_at)}</div>
            </div>
            <button
              onClick={load}
              disabled={loadingPreview}
              className="px-4 py-2 border border-gray-300 hover:border-black text-sm flex items-center gap-2 disabled:opacity-50"
              data-testid="cs-refresh"
            >
              {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refrescar
            </button>
            <button
              onClick={doSync}
              disabled={running}
              className="px-5 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50"
              data-testid="cs-run"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Cable size={14} />}
              Sincronizar ahora
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`cs-tab-${t.id}`}
            className={`px-4 py-2 text-sm transition-colors ${tab === t.id ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPIs */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="cs-kpis">
              <KpiCard icon={ArrowUpRight} label="Ingresos" value={formatMoney(summary.issued_total)} sub={`${summary.counts.invoices_issued} facturas emitidas`} tone="green" />
              <KpiCard icon={ArrowDownRight} label="Gastos" value={formatMoney(summary.received_total)} sub={`${summary.counts.invoices_received} facturas recibidas`} tone="red" />
              <KpiCard icon={Wallet} label="Cobros / Pagos" value={formatMoney(summary.payments_total)} sub={`${summary.counts.treasury_payments} movimientos`} tone="blue" />
              <KpiCard icon={Coins} label="Pendiente de cobro" value={formatMoney(summary.pending_to_collect)} sub="Sobre facturas emitidas" tone="gold" />
              <KpiCard icon={FileText} label="IVA repercutido" value={formatMoney(summary.issued_vat)} tone="slate" />
              <KpiCard icon={FileText} label="IVA soportado" value={formatMoney(summary.received_vat)} tone="slate" />
              <KpiCard icon={FileText} label="Balance IVA" value={formatMoney(summary.vat_balance)} sub="A liquidar" tone="gold" />
              <KpiCard icon={Users} label="Clientes + Proveedores" value={`${summary.counts.customers} + ${summary.counts.providers}`} tone="slate" />
            </div>
          )}

          {/* Preview / Estado de pipelines */}
          {preview && (
            <div className="cms-card overflow-hidden" data-testid="cs-preview-table">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="font-serif text-lg">Estado de la conexión</div>
                <div className="text-xs text-gray-500">Comparativa entre ContaSimple y la BBDD local</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Origen</th>
                    <th className="text-right py-3">En ContaSimple</th>
                    <th className="text-right py-3">En BBDD local</th>
                    <th className="pl-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.pipelines || []).map((it) => (
                    <StatusRow key={it.dest} item={it} dbCount={status?.collections?.[it.dest]} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {status?.last_results?.length > 0 && (
            <div className="cms-card p-5" data-testid="cs-last-results">
              <div className="label-eyebrow text-gray-500 mb-3">Resultado de la última sincronización</div>
              <div className="space-y-2">
                {status.last_results.map((r) => (
                  <div key={r.dest} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-gray-500 flex gap-4 flex-wrap justify-end">
                      <span>traídos: <strong className="text-black">{r.fetched ?? 0}</strong></span>
                      <span>creados: <strong className="text-emerald-700">{r.created ?? 0}</strong></span>
                      <span>actualizados: <strong className="text-blue-700">{r.updated ?? 0}</strong></span>
                      {r.errors > 0 && <span>errores: <strong className="text-red-600">{r.errors}</strong></span>}
                      {r.error && <span className="text-red-600 truncate max-w-[400px]">{r.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "invoices_issued" && <InvoicesTable endpoint="/contasimple/invoices/issued" testId="cs-invoices-issued" onOpenInvoice={openInvoice} onOpenCustomer={openCustomerByNif} />}
      {tab === "invoices_received" && <InvoicesTable endpoint="/contasimple/invoices/received" testId="cs-invoices-received" onOpenInvoice={openInvoice} onOpenCustomer={openCustomerByNif} />}
      {tab === "products" && <ProductsAnalyticsTable onOpenProduct={openProduct} />}
      {tab === "customers" && <EntityTable endpoint="/contasimple/customers?limit=500" testId="cs-customers" onOpenEntity={(id) => openEntityById("customer", id)} />}
      {tab === "providers" && <EntityTable endpoint="/contasimple/providers" testId="cs-providers" onOpenEntity={(id) => openEntityById("provider", id)} />}
      {tab === "payments" && <PaymentsTable onOpenInvoice={openInvoice} />}

      {/* Drawers */}
      <InvoiceDetailDrawer
        invoiceId={openInvoiceId}
        open={!!openInvoiceId}
        onClose={() => setOpenInvoiceId(null)}
        onOpenCustomer={openCustomerByNif}
      />
      <EntityDetailDrawer
        kind={openEntity?.kind}
        entityId={openEntity?.id}
        open={!!openEntity}
        onClose={() => setOpenEntity(null)}
        onOpenInvoice={openInvoice}
      />
      <ProductDetailDrawer
        conceptKey={openProductKey}
        open={!!openProductKey}
        onClose={() => setOpenProductKey(null)}
        onOpenInvoice={openInvoice}
        onOpenCustomer={openCustomerByNif}
      />
    </div>
  );
}
