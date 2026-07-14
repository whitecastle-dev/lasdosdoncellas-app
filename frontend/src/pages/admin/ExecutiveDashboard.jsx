import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import {
  TrendingUp,
  ShoppingCart,
  ShoppingBag,
  Building2,
  Wallet,
  Boxes,
  AlertTriangle,
  Factory,
  Package,
  Receipt,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

const RANGES = [
  { l: "7d", v: 7 },
  { l: "30d", v: 30 },
  { l: "90d", v: 90 },
];

export default function ExecutiveDashboard() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const r = await api.get(`/executive/kpis?days=${days}`);
        setD(r.data);
      } catch (err) {
        toast.error(formatApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  if (loading && !d) return <div className="py-20 text-center text-gray-400">Cargando dashboard…</div>;
  if (!d) return <div className="py-20 text-center text-red-500">Error cargando datos.</div>;

  const maxDay = Math.max(1, ...d.daily.map((x) => x.online + x.tpv + x.b2b));

  return (
    <div className="p-8 lg:p-10 max-w-[1700px] mx-auto space-y-8" data-testid="executive-dashboard">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-eyebrow text-gray-500">Panel ejecutivo</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
            <TrendingUp size={28} className="text-[#C5A059]" />Dashboard 360º
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-3xl">
            KPIs consolidados de <strong>todos los canales</strong> (online + TPV + B2B) y todos los módulos
            del ERP: tesorería, inventario, contabilidad, producción y logística.
          </p>
        </div>
        <div className="flex gap-1" data-testid="exec-range-selector">
          {RANGES.map((r) => (
            <button
              key={r.v}
              onClick={() => setDays(r.v)}
              data-testid={`exec-range-${r.v}`}
              className={`px-3 py-1.5 text-xs border ${days === r.v ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}
            >
              Últimos {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* REVENUE HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <RevenueHero
          label={`Ingresos ${days}d`}
          value={d.revenue.total}
          icon={TrendingUp}
          highlight
        />
        <RevenueBreak label="Online" value={d.revenue.online.total}
                      count={`${d.revenue.online.count} pedidos`}
                      icon={ShoppingCart} to="/admin/orders" testid="exec-rev-online" />
        <RevenueBreak label="TPV Tienda" value={d.revenue.tpv.total}
                      count={`${d.revenue.tpv.count} tickets`}
                      icon={ShoppingBag} to="/admin/tpv/tickets" testid="exec-rev-tpv" />
        <RevenueBreak label="B2B (facturado)" value={d.revenue.b2b.total}
                      count={`${d.revenue.b2b.count} facturas · ${formatMoney(d.revenue.b2b.paid)} cobrado`}
                      icon={Building2} to="/admin/tesoreria/facturas-emitidas" testid="exec-rev-b2b" />
      </div>

      {/* DAILY CHART */}
      <div className="cms-card border border-gray-200 p-5" data-testid="exec-daily-chart">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-eyebrow text-gray-500">Ingresos diarios</div>
            <div className="font-serif text-xl">Últimos {days} días · 3 canales apilados</div>
          </div>
          <div className="flex gap-3 text-xs">
            <Legend color="bg-blue-500" label="Online" />
            <Legend color="bg-amber-500" label="TPV" />
            <Legend color="bg-purple-500" label="B2B" />
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-40 overflow-x-auto">
          {d.daily.map((day) => {
            const total = day.online + day.tpv + day.b2b;
            const h = total > 0 ? Math.max(4, (total / maxDay) * 100) : 2;
            const oh = total > 0 ? (day.online / total) * h : 0;
            const th = total > 0 ? (day.tpv / total) * h : 0;
            const bh = total > 0 ? (day.b2b / total) * h : 0;
            return (
              <div key={day.day} className="flex-1 min-w-[10px] flex flex-col justify-end group relative"
                   title={`${day.day}: ${formatMoney(total)}`}>
                <div style={{ height: `${bh}%` }} className="bg-purple-500 transition-all" />
                <div style={{ height: `${th}%` }} className="bg-amber-500 transition-all" />
                <div style={{ height: `${oh}%` }} className="bg-blue-500 transition-all" />
                {total === 0 && <div className="h-0.5 bg-gray-200" />}
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 whitespace-nowrap pointer-events-none z-10">
                  {day.day.slice(5)} · {formatMoney(total)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{d.daily[0]?.day.slice(5)}</span>
          <span>{d.daily[d.daily.length - 1]?.day.slice(5)}</span>
        </div>
      </div>

      {/* GRID: Treasury + Inventory + Accounting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* TREASURY */}
        <Section title="Tesorería" icon={Wallet} to="/admin/tesoreria">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <MiniStat label="Saldo actual" value={formatMoney(d.treasury.saldo_total)} testid="exec-treasury-saldo" />
            <MiniStat label="Saldo proyectado"
                      value={formatMoney(d.treasury.saldo_proyectado)}
                      color={d.treasury.saldo_proyectado >= 0 ? "text-green-700" : "text-red-700"} />
          </div>
          <Row icon={ArrowUpRight} color="text-green-700"
               label="Por cobrar" value={formatMoney(d.treasury.pending_income.sum)}
               sub={`${d.treasury.pending_income.count} facturas`} to="/admin/tesoreria/recordatorios" />
          <Row icon={ArrowDownRight} color="text-red-700"
               label="Por pagar" value={formatMoney(d.treasury.pending_expense.sum)}
               sub={`${d.treasury.pending_expense.count} facturas`} to="/admin/inventario/facturas-proveedor" />
          <div className="border-t pt-2 mt-2 space-y-1">
            {d.treasury.accounts.slice(0, 3).map((a) => (
              <div key={a.id} className="flex justify-between text-xs">
                <span className="text-gray-500">{a.nombre}</span>
                <span className="font-serif">{formatMoney(a.saldo)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* INVENTORY */}
        <Section title="Inventario" icon={Boxes} to="/admin/inventario">
          <MiniStat label="Valoración stock" value={formatMoney(d.inventory.stock_value)} testid="exec-stock-value" />
          <Row icon={AlertTriangle} color={d.inventory.low_stock_count > 0 ? "text-red-700" : "text-gray-400"}
               label="Bajo stock" value={d.inventory.low_stock_count}
               sub="productos ≤ umbral" to="/admin/stock-alerts" />
          <Row icon={Clock} color={d.inventory.expiring_lots_30d > 0 ? "text-orange-700" : "text-gray-400"}
               label="Caducan 30d" value={d.inventory.expiring_lots_30d}
               sub="lotes" to="/admin/inventario/lotes" />
          <Row icon={AlertTriangle} color={d.inventory.stock_alerts_pending > 0 ? "text-amber-700" : "text-gray-400"}
               label="Alertas pdtes." value={d.inventory.stock_alerts_pending}
               sub="por procesar" to="/admin/stock-alerts" />
        </Section>

        {/* ACCOUNTING */}
        <Section title="Contabilidad" icon={Landmark} to="/admin/contabilidad">
          <MiniStat label="Resultado del mes"
                    value={formatMoney(d.accounting.pnl_month.resultado)}
                    color={d.accounting.pnl_month.resultado >= 0 ? "text-green-700" : "text-red-700"}
                    testid="exec-pnl-month" />
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="p-2 bg-green-50">
              <div className="text-gray-500">Ingresos</div>
              <div className="font-serif text-green-700">{formatMoney(d.accounting.pnl_month.ingresos)}</div>
            </div>
            <div className="p-2 bg-red-50">
              <div className="text-gray-500">Gastos</div>
              <div className="font-serif text-red-700">{formatMoney(d.accounting.pnl_month.gastos)}</div>
            </div>
          </div>
          <div className="border-t pt-2">
            <div className="text-xs text-gray-500 mb-1">IVA trimestre (desde {d.accounting.vat_quarter.quarter_start.slice(5)})</div>
            <div className="flex justify-between text-sm">
              <span>Liquidación</span>
              <span className={`font-serif ${d.accounting.vat_quarter.liquidacion >= 0 ? "text-red-700" : "text-green-700"}`}
                    data-testid="exec-vat-liq">
                {formatMoney(d.accounting.vat_quarter.liquidacion)}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {formatMoney(d.accounting.vat_quarter.repercutido)} rep − {formatMoney(d.accounting.vat_quarter.soportado)} sop
            </div>
          </div>
        </Section>
      </div>

      {/* GRID: Pipeline + Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Pipeline pedidos" icon={Package}>
          <div className="grid grid-cols-3 gap-3">
            <Pipe label="Pendientes pago" value={d.orders_pipeline.pending_payment} color="bg-yellow-100 text-yellow-800" />
            <Pipe label="Pagados / a preparar" value={d.orders_pipeline.paid} color="bg-blue-100 text-blue-800" />
            <Pipe label="Enviados" value={d.orders_pipeline.shipped} color="bg-green-100 text-green-800" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
            <MiniStat label="Pedidos hoy" value={d.orders_pipeline.today} />
            <MiniStat label="Tickets TPV hoy" value={d.orders_pipeline.tpv_today} />
          </div>
        </Section>

        <Section title="Producción · Sala de loncheado" icon={Factory} to="/admin/erp/loncheados">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Loncheados este mes" value={d.production.slicings_month.count} />
            <MiniStat label="Kilos procesados" value={`${d.production.slicings_month.kilos.toFixed(1)} kg`} />
          </div>
        </Section>
      </div>

      {/* TOP PRODUCTS & CUSTOMERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cms-card border border-gray-200">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Receipt size={14} className="text-[#C5A059]" />
            <div className="font-medium text-sm">Top productos ({days}d, todos los canales)</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {d.top_products.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-gray-400 text-xs">Sin ventas registradas.</td></tr>
              )}
              {d.top_products.map((p, i) => (
                <tr key={p.product_id} className="border-t border-gray-100" data-testid={`exec-top-product-${i}`}>
                  <td className="px-4 py-2 mono text-xs text-gray-400">#{i + 1}</td>
                  <td className="text-sm">{p.name}<div className="text-xs text-gray-400">{p.units} uds</div></td>
                  <td className="text-right px-4 font-serif">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cms-card border border-gray-200">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Building2 size={14} className="text-[#C5A059]" />
            <div className="font-medium text-sm">Top clientes B2B ({days}d)</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {d.top_b2b_customers.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-gray-400 text-xs">Sin facturas B2B.</td></tr>
              )}
              {d.top_b2b_customers.map((c, i) => (
                <tr key={c.name} className="border-t border-gray-100" data-testid={`exec-top-b2b-${i}`}>
                  <td className="px-4 py-2 mono text-xs text-gray-400">#{i + 1}</td>
                  <td className="text-sm">{c.name}<div className="text-xs text-gray-400">{c.count} facturas</div></td>
                  <td className="text-right px-4 font-serif">{formatMoney(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RevenueHero({ label, value, icon: Icon, highlight }) {
  return (
    <div className={`p-6 border ${highlight ? "border-black bg-black text-[#C5A059]" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className={`label-eyebrow ${highlight ? "text-[#C5A059]/70" : "text-gray-500"}`}>{label}</div>
        <Icon size={16} className={highlight ? "text-[#C5A059]" : "text-gray-400"} />
      </div>
      <div className={`font-serif text-4xl mt-2 ${highlight ? "text-[#C5A059]" : ""}`} data-testid="exec-revenue-total">
        {formatMoney(value)}
      </div>
      <div className={`text-xs mt-1 ${highlight ? "text-[#C5A059]/60" : "text-gray-500"}`}>
        Total consolidado
      </div>
    </div>
  );
}

function RevenueBreak({ label, value, count, icon: Icon, to, testid }) {
  return (
    <Link to={to} className="p-5 border border-gray-200 hover:border-black transition-colors group" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="label-eyebrow text-gray-500">{label}</div>
        <Icon size={14} className="text-[#C5A059]" />
      </div>
      <div className="font-serif text-3xl mt-1">{formatMoney(value)}</div>
      <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
        <span>{count}</span>
        <ChevronRight size={12} className="text-gray-300 group-hover:text-black" />
      </div>
    </Link>
  );
}

function Section({ title, icon: Icon, to, children }) {
  const Header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-[#C5A059]" />
        <div className="font-serif text-lg">{title}</div>
      </div>
      {to && <ChevronRight size={14} className="text-gray-400" />}
    </div>
  );
  const inner = (
    <div className="cms-card border border-gray-200 p-5 h-full">
      {Header}
      <div className="space-y-2">{children}</div>
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-95">{inner}</Link> : inner;
}

function MiniStat({ label, value, color, testid }) {
  return (
    <div className="mb-2" data-testid={testid}>
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className={`font-serif text-2xl ${color || ""}`}>{value}</div>
    </div>
  );
}

function Row({ icon: Icon, color, label, value, sub, to }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2">
        <Icon size={12} className={color} />
        <div>
          <div>{label}</div>
          <div className="text-[10px] text-gray-400">{sub}</div>
        </div>
      </div>
      <div className={`font-serif ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function Pipe({ label, value, color }) {
  return (
    <div className={`p-3 ${color}`}>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-serif text-2xl">{value}</div>
    </div>
  );
}
