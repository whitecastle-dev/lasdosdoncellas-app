import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Package, Search, TrendingUp, Users, ShoppingCart, ExternalLink, Tag } from "lucide-react";
import { DrawerShell } from "./ContaSimpleDrawers";

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
function fmtNum(n) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n || 0); }

function MatchPill({ match, small }) {
  if (!match) {
    return <span className={`text-gray-400 italic ${small ? "text-[10px]" : "text-xs"}`}>sin match</span>;
  }
  const strong = match.match_score >= 0.75;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${small ? "text-[10px]" : "text-xs"} ${strong ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <Tag size={10} />
      {match.name} · <span className="font-mono opacity-70">{(match.match_score * 100).toFixed(0)}%</span>
    </span>
  );
}

function MiniBars({ months, valueKey = "revenue" }) {
  if (!months || !months.length) return null;
  const max = Math.max(...months.map((m) => m[valueKey] || 0));
  return (
    <div className="flex items-end gap-1 h-32 border-b border-l border-gray-200 pl-2 pb-1">
      {months.map((m) => (
        <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1"
             title={`${m.month} · ${fmtNum(m.quantity)} uds · ${formatMoney(m.revenue)}`}>
          <div className="w-full bg-[#C5A059]/70 hover:bg-[#C5A059] transition"
               style={{ height: `${max ? ((m[valueKey] || 0) / max) * 100 : 0}%` }} />
          <div className="text-[9px] text-gray-400">{fmtMonth(m.month)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Product Detail Drawer ----------------

export function ProductDetailDrawer({ conceptKey, open, onClose, onOpenInvoice, onOpenCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !conceptKey) { setData(null); return; }
    setLoading(true);
    api.get(`/contasimple/products/${conceptKey}/detail`)
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(formatApiError(e)); onClose(); })
      .finally(() => setLoading(false));
  }, [open, conceptKey, onClose]);

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={data?.concept || "Cargando…"}
      subtitle="Producto · Analítica 360º"
      icon={Package}
      wide
      testId="cs-product-drawer"
    >
      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="animate-spin mr-2" /> Cargando…</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-gray-100 p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Facturación</div>
              <div className="font-serif text-xl text-emerald-700 mt-1">{formatMoney(data.kpis.revenue)}</div>
              <div className="text-[11px] text-gray-500 mt-1">{data.kpis.n_invoices} facturas · {data.kpis.n_clients} clientes</div>
            </div>
            <div className="border border-gray-100 p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Unidades vendidas</div>
              <div className="font-serif text-xl text-[#C5A059] mt-1">{fmtNum(data.kpis.quantity)}</div>
              <div className="text-[11px] text-gray-500 mt-1">{data.kpis.n_lines} líneas</div>
            </div>
            <div className="border border-gray-100 p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Precio unitario</div>
              <div className="font-serif text-xl text-blue-600 mt-1">{formatMoney(data.kpis.avg_unit_price)}</div>
              <div className="text-[11px] text-gray-500 mt-1">min {formatMoney(data.kpis.min_unit_price)} · max {formatMoney(data.kpis.max_unit_price)}</div>
            </div>
            <div className="border border-gray-100 p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">IVA acumulado</div>
              <div className="font-serif text-xl text-slate-600 mt-1">{formatMoney(data.kpis.vat)}</div>
              <div className="text-[11px] text-gray-500 mt-1">{fmtDate(data.kpis.first_sale)} → {fmtDate(data.kpis.last_sale)}</div>
            </div>
          </div>

          {/* Catalog match */}
          <div className="cms-card p-4">
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Producto en catálogo web</div>
            {data.catalog_match ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-serif text-lg">{data.catalog_match.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{data.catalog_match.sku} · {data.catalog_match.weight_grams ? `${data.catalog_match.weight_grams} g` : "sin peso"} · PVP {formatMoney(data.catalog_match.price)}</div>
                  <div className="text-[10px] text-gray-400 mt-1">Coincidencia {(data.catalog_match.match_score * 100).toFixed(0)}% · matching por similitud de nombre. Revisa si es correcto.</div>
                </div>
                <a href={`/admin/products`} target="_blank" rel="noopener noreferrer"
                   className="text-xs px-3 py-1.5 border border-gray-300 hover:border-black inline-flex items-center gap-1">
                  Ver en catálogo <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">Este concepto no coincide con ningún producto activo del catálogo web. Puede ser un servicio (corte, envío) o un producto que solo vendes en B2B.</div>
            )}
          </div>

          {/* Monthly evolution */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Evolución mensual · Facturación</div>
            <MiniBars months={data.monthly} valueKey="revenue" />
          </div>

          {/* Top buyers */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Top clientes ({data.top_buyers.length})</div>
            <div className="cms-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="py-2">NIF</th>
                    <th className="text-right py-2">Uds</th>
                    <th className="text-right py-2">Facturado</th>
                    <th className="text-right py-2 pr-3">Nº facturas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_buyers.map((b, i) => (
                    <tr
                      key={i}
                      onClick={() => b.nif && onOpenCustomer && onOpenCustomer(b.nif)}
                      className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                      data-testid={`cs-product-buyer-${i}`}
                    >
                      <td className="px-3 py-2 font-medium">{b.organization || "—"}</td>
                      <td className="font-mono text-xs text-gray-500">{b.nif}</td>
                      <td className="text-right font-mono">{fmtNum(b.quantity)}</td>
                      <td className="text-right font-mono font-medium">{formatMoney(b.revenue)}</td>
                      <td className="text-right text-gray-500 pr-3">{b.n_invoices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices where it appears */}
          <div>
            <div className="label-eyebrow text-gray-500 text-[10px] mb-2">Facturas donde aparece ({data.invoices.length})</div>
            <div className="cms-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Nº</th>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Cliente</th>
                    <th className="text-right py-2">Uds línea</th>
                    <th className="text-right py-2 pr-3">Importe línea</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => onOpenInvoice && onOpenInvoice(inv.id)}
                      className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                      data-testid={`cs-product-invoice-${inv.id}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-[#C5A059] underline decoration-dotted">{inv.number}</td>
                      <td>{fmtDate(inv.invoice_date)}</td>
                      <td className="truncate max-w-[280px]">{inv.target_organization || "—"}</td>
                      <td className="text-right font-mono">{fmtNum(inv.line_quantity)}</td>
                      <td className="text-right font-mono font-medium pr-3">{formatMoney(inv.line_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

// ---------------- Products Table (embedded in ContaSimple page) ----------------

export function ProductsAnalyticsTable({ onOpenProduct }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | matched | unmatched

  useEffect(() => {
    api.get("/contasimple/products/analytics")
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(formatApiError(e)); setData({ products: [], total_revenue: 0, n_products: 0 }); });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    let rows = data.products;
    if (filter === "matched") rows = rows.filter((r) => r.catalog_match);
    else if (filter === "unmatched") rows = rows.filter((r) => !r.catalog_match);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((r) => r.concept.toLowerCase().includes(s)
        || (r.catalog_match?.name || "").toLowerCase().includes(s));
    }
    return rows;
  }, [data, q, filter]);

  if (data === null) {
    return <div className="p-10 text-center text-gray-400 text-sm"><Loader2 className="mx-auto animate-spin" /></div>;
  }
  if (!data.products.length) {
    return <div className="p-10 text-center text-gray-400 text-sm">Sin datos. Ejecuta una sincronización.</div>;
  }

  const nMatched = data.products.filter((p) => p.catalog_match).length;
  const nUnmatched = data.products.length - nMatched;

  return (
    <div className="space-y-4" data-testid="cs-products-analytics">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="cms-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Facturado total</div>
          <div className="font-serif text-xl text-emerald-700 mt-1">{formatMoney(data.total_revenue)}</div>
          <div className="text-[11px] text-gray-500 mt-1">de todas las líneas facturadas</div>
        </div>
        <div className="cms-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Conceptos únicos</div>
          <div className="font-serif text-xl text-[#C5A059] mt-1">{data.n_products}</div>
          <div className="text-[11px] text-gray-500 mt-1">productos distintos vendidos</div>
        </div>
        <div className="cms-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Coinciden catálogo web</div>
          <div className="font-serif text-xl text-blue-600 mt-1">{nMatched} <span className="text-sm text-gray-400">/ {data.n_products}</span></div>
          <div className="text-[11px] text-gray-500 mt-1">match automático por similitud</div>
        </div>
        <div className="cms-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Sin match</div>
          <div className="font-serif text-xl text-amber-600 mt-1">{nUnmatched}</div>
          <div className="text-[11px] text-gray-500 mt-1">servicios o solo B2B</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar concepto o producto de catálogo…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 focus:border-black focus:outline-none text-sm"
            data-testid="cs-products-search"
          />
        </div>
        <div className="flex text-xs border border-gray-200">
          {[["all", "Todos"], ["matched", "Con match"], ["unmatched", "Sin match"]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`cs-products-filter-${k}`}
              className={`px-3 py-2 border-r border-gray-200 last:border-r-0 ${filter === k ? "bg-black text-[#C5A059]" : "hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 ml-auto">{filtered.length} de {data.n_products}</div>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Concepto (facturas)</th>
              <th className="py-3">Match catálogo</th>
              <th className="text-right py-3">Uds</th>
              <th className="text-right py-3">Precio medio</th>
              <th className="text-right py-3">Facturado</th>
              <th className="text-right py-3">Facturas</th>
              <th className="text-right py-3 pr-4">Clientes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.concept_key}
                onClick={() => onOpenProduct(p.concept_key)}
                className="border-t border-gray-100 hover:bg-gray-50/70 cursor-pointer"
                data-testid={`cs-product-row-${p.concept_key.slice(0, 12)}`}
              >
                <td className="px-4 py-2">
                  <div className="font-medium text-[#C5A059] underline decoration-dotted truncate max-w-[380px]">{p.concept}</div>
                  <div className="text-[10px] text-gray-400">{fmtDate(p.first_sale)} → {fmtDate(p.last_sale)}</div>
                </td>
                <td><MatchPill match={p.catalog_match} small /></td>
                <td className="text-right font-mono">{fmtNum(p.quantity)}</td>
                <td className="text-right font-mono text-gray-500">{formatMoney(p.avg_unit_price)}</td>
                <td className="text-right font-mono font-medium">{formatMoney(p.revenue)}</td>
                <td className="text-right text-gray-500">{p.n_invoices}</td>
                <td className="text-right text-gray-500 pr-4">{p.n_clients}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="p-8 text-center text-gray-400 text-sm">Sin resultados</div>}
      </div>
    </div>
  );
}
