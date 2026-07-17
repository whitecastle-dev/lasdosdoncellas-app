import React, { useEffect, useState } from "react";
import { X, Loader2, Download, FileText, Building2, User, Mail, Phone, MapPin,
  Calendar, CheckCircle2, Clock, TrendingUp, ArrowUpRight, ArrowDownRight,
  CreditCard, Package } from "lucide-react";
import { api, API, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}
function fmtMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const names = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// ----------- Shell drawer -----------

export function DrawerShell({ open, onClose, title, subtitle, icon: Icon, children, actions, wide = false, testId = "cs-drawer" }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" data-testid={testId}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} data-testid={`${testId}-backdrop`} />
      <aside className={`absolute top-0 right-0 h-full bg-white shadow-2xl flex flex-col ${wide ? "w-full max-w-5xl" : "w-full max-w-3xl"}`}>
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {Icon && (
              <div className="w-10 h-10 bg-black/5 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-[#C5A059]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="label-eyebrow text-gray-500 text-[10px] truncate">{subtitle || "Detalle"}</div>
              <h2 className="font-serif text-2xl leading-tight truncate">{title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded" data-testid={`${testId}-close`} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}

function KV({ label, value, mono, className }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${value ? "" : "text-gray-400"}`}>{value || "—"}</div>
    </div>
  );
}

function KpiTile({ label, value, sub, tone = "gold" }) {
  const tones = { gold: "text-[#C5A059]", green: "text-emerald-600", red: "text-red-600", blue: "text-blue-600", slate: "text-slate-500" };
  return (
    <div className="border border-gray-100 p-4 bg-white">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`font-serif text-xl mt-1 ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusPill({ status, small }) {
  const paid = status === "Payed";
  return (
    <span className={`inline-block px-2 py-0.5 rounded ${small ? "text-[10px]" : "text-xs"} ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {paid ? "Cobrada" : status || "Pendiente"}
    </span>
  );
}

// ---------------- Invoice Detail Drawer ----------------

export function InvoiceDetailDrawer({ invoiceId, open, onClose, onOpenCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) { setData(null); return; }
    setLoading(true);
    api.get(`/contasimple/invoices/${invoiceId}`)
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(formatApiError(e)); onClose(); })
      .finally(() => setLoading(false));
  }, [open, invoiceId, onClose]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("ldd_token") || localStorage.getItem("ldd_customer_token");
      const res = await fetch(`${API}/contasimple/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data?.invoice?.number || `factura-${invoiceId}`).replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado");
    } catch (e) { toast.error(`No se pudo descargar el PDF: ${e.message}`); }
    setDownloading(false);
  };

  const inv = data?.invoice;
  const isIssued = data?.collection === "contasimple_invoices_issued";

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={inv?.number || "Cargando…"}
      subtitle={isIssued ? "Factura emitida" : (data?.collection === "contasimple_invoices_received" ? "Factura recibida" : "Factura")}
      icon={FileText}
      wide
      testId="cs-invoice-drawer"
      actions={
        <button
          onClick={downloadPdf}
          disabled={downloading || loading || !inv}
          className="px-3 py-1.5 bg-black text-[#C5A059] text-xs flex items-center gap-2 disabled:opacity-50"
          data-testid="cs-invoice-download-pdf"
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Descargar PDF
        </button>
      }
    >
      {loading || !inv ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="animate-spin mr-2" /> Cargando…</div>
      ) : (
        <div className="space-y-6">
          {/* Header meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KV label="Fecha factura" value={fmtDate(inv.invoice_date)} />
            <KV label="Vencimiento" value={fmtDate(inv.expiration_date)} />
            <KV label="Periodo" value={inv.period} mono />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Estado</div>
              <div><StatusPill status={inv.status} /></div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cms-card p-4">
              <div className="label-eyebrow text-gray-500 text-[10px] mb-1">Emisor</div>
              <div className="font-serif text-lg">{inv.issuer?.organization}</div>
              <div className="text-xs text-gray-500 font-mono mt-1">NIF {inv.issuer?.nif}</div>
              <div className="text-xs text-gray-500 mt-1">{inv.issuer?.city} · {inv.issuer?.postal_code}</div>
              {inv.issuer?.email && <div className="text-xs text-gray-500">{inv.issuer.email}</div>}
            </div>
            <button
              type="button"
              onClick={() => isIssued && onOpenCustomer && onOpenCustomer(inv.target?.nif)}
              className={`cms-card p-4 text-left ${isIssued ? "hover:border-black cursor-pointer transition" : ""}`}
              data-testid="cs-invoice-open-target"
            >
              <div className="label-eyebrow text-gray-500 text-[10px] mb-1 flex items-center justify-between">
                Destinatario
                {isIssued && <span className="text-[9px] gold">Ver ficha →</span>}
              </div>
              <div className="font-serif text-lg">{inv.target?.organization}</div>
              <div className="text-xs text-gray-500 font-mono mt-1">NIF {inv.target?.nif}</div>
              <div className="text-xs text-gray-500 mt-1">{inv.target?.city} · {inv.target?.postal_code}</div>
              {inv.target?.email && <div className="text-xs text-gray-500">{inv.target.email}</div>}
            </button>
          </div>

          {/* Lines */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Líneas ({(inv.lines || []).length})</div>
            <div className="cms-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Precio ud.</th>
                    <th className="text-right py-2">IVA %</th>
                    <th className="text-right py-2">IVA</th>
                    <th className="text-right py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.lines || []).map((ln, i) => (
                    <tr key={ln.id || i} className="border-t border-gray-100">
                      <td className="px-3 py-2">{ln.concept || "—"}</td>
                      <td className="text-right font-mono">{ln.quantity}</td>
                      <td className="text-right font-mono">{formatMoney(ln.unit_taxable_amount)}</td>
                      <td className="text-right text-gray-500">{ln.vat_percentage}%</td>
                      <td className="text-right font-mono text-gray-500">{formatMoney(ln.vat_amount)}</td>
                      <td className="text-right font-mono font-medium pr-3">{formatMoney(ln.total_taxable_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="cms-card p-5 bg-black/[0.02]">
            <div className="space-y-1 text-sm max-w-md ml-auto">
              <div className="flex justify-between"><span className="text-gray-500">Base imponible</span><span className="font-mono">{formatMoney(inv.total_taxable_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">IVA</span><span className="font-mono">{formatMoney(inv.total_vat_amount)}</span></div>
              {inv.retention_amount ? (
                <div className="flex justify-between"><span className="text-gray-500">Retención ({inv.retention_percentage}%)</span><span className="font-mono text-red-600">-{formatMoney(inv.retention_amount)}</span></div>
              ) : null}
              <div className="flex justify-between pt-2 border-t border-gray-200 text-base"><strong>Total</strong><strong className="font-mono">{formatMoney(inv.total_amount)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Cobrado</span><span className="font-mono text-emerald-700">{formatMoney(inv.total_payed_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pendiente</span><span className="font-mono text-amber-700">{formatMoney((inv.total_amount || 0) - (inv.total_payed_amount || 0))}</span></div>
            </div>
          </div>

          {/* Meta clasificación fiscal */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <KV label="Clase" value={inv.invoice_class_description} className="col-span-2" />
            <KV label="Op. fiscal" value={inv.operation_type_description} />
            <KV label="Fecha creación" value={fmtDate(inv.creation_date)} />
            <KV label="Última actualización" value={fmtDate(inv.last_update_date)} />
          </div>

          {/* Payments */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Cobros / Pagos ({(data.payments || []).length})</div>
            {(data.payments || []).length === 0 ? (
              <div className="text-sm text-gray-400 italic">Sin movimientos de cobro registrados.</div>
            ) : (
              <div className="cms-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="py-2">Método</th>
                      <th className="text-right py-2 pr-3">Importe</th>
                      <th className="py-2">Conciliación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.payments || []).map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{fmtDate(p.date)}</td>
                        <td>{p.payment_method_name}</td>
                        <td className="text-right font-mono font-medium pr-3">{formatMoney(p.amount)}</td>
                        <td className="text-gray-500">{p.reconciliation_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

// ---------------- Entity (customer/provider) Detail Drawer ----------------

function EntityKpis({ kpis, tone }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiTile label={tone === "issued" ? "Facturado" : "Comprado"} value={formatMoney(kpis.total_amount)} sub={`${kpis.n_invoices} facturas`} tone={tone === "issued" ? "green" : "red"} />
      <KpiTile label="Ticket medio" value={formatMoney(kpis.average_ticket)} tone="gold" />
      <KpiTile label="Cobrado" value={formatMoney(kpis.total_payed_amount)} sub={`Pendiente ${formatMoney(kpis.pending_amount)}`} tone="blue" />
      <KpiTile label="IVA" value={formatMoney(kpis.total_vat_amount)} sub={`Base ${formatMoney(kpis.total_taxable_amount)}`} tone="slate" />
    </div>
  );
}

function MonthlyBars({ months }) {
  if (!months.length) return null;
  const max = Math.max(...months.map((m) => m.amount));
  return (
    <div>
      <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Evolución mensual</div>
      <div className="flex items-end gap-1 h-32 border-b border-l border-gray-200 pl-2 pb-1">
        {months.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${m.month}: ${formatMoney(m.amount)} · ${m.count} facturas`}>
            <div className="w-full bg-[#C5A059]/70 hover:bg-[#C5A059] transition" style={{ height: `${max ? (m.amount / max) * 100 : 0}%` }} />
            <div className="text-[9px] text-gray-400">{fmtMonth(m.month)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EntityDetailDrawer({ kind, entityId, open, onClose, onOpenInvoice }) {
  // kind: "customer" | "provider"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const endpoint = kind === "customer" ? `/contasimple/customers/${entityId}/detail` : `/contasimple/providers/${entityId}/detail`;

  useEffect(() => {
    if (!open || !entityId) { setData(null); return; }
    setLoading(true);
    api.get(endpoint)
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(formatApiError(e)); onClose(); })
      .finally(() => setLoading(false));
  }, [open, entityId, endpoint, onClose]);

  const entity = data?.[kind]; // customer or provider

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={entity?.organization || "Cargando…"}
      subtitle={kind === "customer" ? "Cliente 360º" : "Proveedor 360º"}
      icon={kind === "customer" ? User : Building2}
      wide
      testId={`cs-${kind}-drawer`}
    >
      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="animate-spin mr-2" /> Cargando…</div>
      ) : (
        <div className="space-y-6">
          {/* Contact info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KV label="NIF" value={entity.nif} mono />
            <KV label="Ciudad" value={entity.city} />
            <KV label="Provincia" value={entity.province} />
            <KV label="Código postal" value={entity.postal_code} mono />
            <KV label="Dirección" value={entity.address} className="col-span-2" />
            <KV label="Teléfono" value={entity.phone || entity.mobile} />
            <KV label="Email" value={entity.email} />
            <KV label="Descuento" value={entity.discount_percentage ? `${entity.discount_percentage}%` : "—"} />
            <KV label="Alta / Primera factura" value={fmtDate(data.kpis.first_invoice_date)} />
            <KV label="Última factura" value={fmtDate(data.kpis.last_invoice_date)} />
          </div>

          {/* KPIs */}
          <EntityKpis kpis={data.kpis} tone={kind === "customer" ? "issued" : "received"} />

          {/* Monthly evolution */}
          <MonthlyBars months={data.monthly} />

          {/* Top products */}
          {data.top_products.length > 0 && (
            <div>
              <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Productos más comprados (top 10)</div>
              <div className="cms-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="text-right py-2">Uds / kg</th>
                      <th className="text-right py-2">Facturado</th>
                      <th className="text-right py-2 pr-3">Nº líneas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 truncate max-w-[380px]">{p.concept}</td>
                        <td className="text-right font-mono">{p.quantity}</td>
                        <td className="text-right font-mono font-medium">{formatMoney(p.amount)}</td>
                        <td className="text-right text-gray-500 pr-3">{p.occurrences}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoices list */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Facturas ({data.invoices.length})</div>
            {data.invoices.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Sin facturas asociadas.</div>
            ) : (
              <div className="cms-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Nº</th>
                      <th className="py-2">Fecha</th>
                      <th className="text-right py-2">Base</th>
                      <th className="text-right py-2">IVA</th>
                      <th className="text-right py-2">Total</th>
                      <th className="py-2 pl-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        onClick={() => onOpenInvoice && onOpenInvoice(inv.id)}
                        className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                        data-testid={`cs-entity-invoice-row-${inv.id}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{inv.number}</td>
                        <td>{fmtDate(inv.invoice_date)}</td>
                        <td className="text-right font-mono">{formatMoney(inv.total_taxable_amount)}</td>
                        <td className="text-right font-mono text-gray-500">{formatMoney(inv.total_vat_amount)}</td>
                        <td className="text-right font-mono font-medium">{formatMoney(inv.total_amount)}</td>
                        <td className="pl-4"><StatusPill status={inv.status} small /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}
