import React, { useMemo } from "react";
import { LayoutDashboard, TrendingUp, ArrowUpRight, ArrowDownRight, Wallet,
  Landmark, CircleDollarSign, Boxes, Clock3, ClipboardList, Users, Package,
  Truck, Percent, Coins, Receipt, BadgeCheck, Zap, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { useLiveRows } from "./useLiveRows";
import { LiveBadge } from "./PortalHubLayout";

async function backfillWebOrders() {
  if (!window.confirm("Enviar todos los pedidos web pagados al portal (tabla tienda.ventas). Operación idempotente.\n\n¿Continuar?")) return;
  try {
    const { data } = await api.post("/portal/push/orders/backfill");
    toast.success(`Enviados: ${data.pushed} · Fallidos: ${data.failed}`);
  } catch (e) { toast.error(formatApiError(e)); }
}

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}
function yearRange(offset = 0) {
  const y = new Date().getUTCFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

function KpiCard({ icon: Icon, label, value, sub, tone = "gold", loading }) {
  const tones = {
    gold: { txt: "text-[#C5A059]", bg: "bg-[#C5A059]/8" },
    green: { txt: "text-emerald-600", bg: "bg-emerald-50" },
    red: { txt: "text-red-600", bg: "bg-red-50" },
    blue: { txt: "text-blue-600", bg: "bg-blue-50" },
    slate: { txt: "text-slate-600", bg: "bg-slate-50" },
  }[tone];
  return (
    <div className="cms-card p-4" data-testid={`portal-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{label}</div>
          <div className={`font-serif text-xl mt-1 ${tones.txt} ${loading ? "opacity-50" : ""}`}>{value}</div>
          {sub && <div className="text-[11px] text-gray-500 mt-1 truncate">{sub}</div>}
        </div>
        <div className={`w-9 h-9 flex items-center justify-center ${tones.bg} flex-shrink-0`}>
          <Icon size={16} className={tones.txt} />
        </div>
      </div>
    </div>
  );
}

/** Sum a numeric column across rows. */
function sumOf(rows, key) {
  return (rows || []).reduce((s, r) => s + Number(r[key] || 0), 0);
}

export default function DashboardGeneral() {
  const mCur = useMemo(() => monthRange(0), []);
  const mPrev = useMemo(() => monthRange(-1), []);
  const yCur = useMemo(() => yearRange(0), []);
  const today = todayISO();

  // ---- Facturación (fin_facturas) ----
  const facMes = useLiveRows("fin_facturas", {
    select: "tipo,base_imponible,iva_importe,total,cobrado_pagado,pendiente,estado",
    fecha: `gte.${mCur.from}`, ...({}), // placeholder to keep object shape
    limit: 5000,
  });
  // Add second filter (query string supports repeated keys via URLSearchParams append)
  // We'll instead use a compound URL. Simplify: separate calls.
  const facturasMes = useLiveRows("fin_facturas", {
    select: "tipo,base_imponible,iva_importe,total,cobrado_pagado,pendiente,estado,fecha",
    fecha: `gte.${mCur.from}`,
    limit: 5000,
  });
  const facturasAno = useLiveRows("fin_facturas", {
    select: "tipo,total,cobrado_pagado,pendiente,estado,fecha",
    fecha: `gte.${yCur.from}`,
    limit: 20000,
  });
  const facturasHoy = useLiveRows("fin_facturas", {
    select: "tipo,total",
    fecha: `eq.${today}`,
    limit: 500,
  });

  // ---- Tesorería / Bancos ----
  const cuentas = useLiveRows("fin_cuentas", {
    select: "saldo_actual,tipo,activa",
    activa: "eq.true",
    limit: 100,
  });
  const movTeso = useLiveRows("fin_movimientos_tesoreria", {
    select: "entrada,salida,es_prevision,fecha,tipo",
    fecha: `gte.${mCur.from}`,
    es_prevision: "eq.false",
    limit: 5000,
  });

  // ---- Inventario valorizado ----
  const inventario = useLiveRows("inventario_actual", {
    select: "stock_actual,ultimo_coste",
    limit: 10000,
  });

  // ---- Compras / Gastos ----
  const gastos = useLiveRows("fin_gastos", {
    select: "total,base_imponible,estado,categoria,fecha,tipo,es_prevision",
    fecha: `gte.${mCur.from}`,
    estado: "neq.CANCELADO",
    limit: 5000,
  });
  const gastosPend = useLiveRows("fin_gastos", {
    select: "total,estado",
    estado: "in.(PENDIENTE,VENCIDO)",
    es_prevision: "eq.false",
    limit: 5000,
  });

  // ---- Rentabilidad ----
  const rent = useLiveRows("ldd_rentabilidad_control", {
    select: "ingresos_totales,coste_total,beneficio,rentabilidad_pct,created_at",
    created_at: `gte.${mCur.from}T00:00:00`,
    limit: 5000,
  });

  const facturacionEmitidaMes = useMemo(() => (facturasMes.rows || []).filter((r) => r.tipo === "EMITIDA").reduce((s, r) => s + Number(r.total || 0), 0), [facturasMes.rows]);
  const cobradoMes = useMemo(() => (facturasMes.rows || []).filter((r) => r.tipo === "EMITIDA").reduce((s, r) => s + Number(r.cobrado_pagado || 0), 0), [facturasMes.rows]);
  const facturacionAno = useMemo(() => (facturasAno.rows || []).filter((r) => r.tipo === "EMITIDA").reduce((s, r) => s + Number(r.total || 0), 0), [facturasAno.rows]);
  const facturacionHoy = useMemo(() => sumOf((facturasHoy.rows || []).filter((r) => r.tipo === "EMITIDA"), "total"), [facturasHoy.rows]);
  const cobrosPendientes = useMemo(() => (facturasAno.rows || []).filter((r) => r.tipo === "EMITIDA" && ["PENDIENTE", "EMITIDA", "VENCIDA"].includes(r.estado)).reduce((s, r) => s + Number(r.pendiente || 0), 0), [facturasAno.rows]);
  const pagosPendientes = useMemo(() => sumOf(gastosPend.rows, "total"), [gastosPend.rows]);
  const saldoBancario = useMemo(() => sumOf((cuentas.rows || []).filter((r) => r.tipo === "BANCO"), "saldo_actual"), [cuentas.rows]);
  const cajaDisponible = useMemo(() => sumOf((cuentas.rows || []).filter((r) => r.tipo === "CAJA"), "saldo_actual"), [cuentas.rows]);
  const tesoreriaDisp = saldoBancario + cajaDisponible;
  const cashflowMes = useMemo(() => sumOf(movTeso.rows, "entrada") - sumOf(movTeso.rows, "salida"), [movTeso.rows]);
  const stockValorizado = useMemo(() => (inventario.rows || []).reduce((s, r) => s + Number(r.stock_actual || 0) * Number(r.ultimo_coste || 0), 0), [inventario.rows]);
  const gastosMes = useMemo(() => sumOf(gastos.rows, "total"), [gastos.rows]);
  const beneficioBruto = facturacionEmitidaMes - gastosMes;
  const beneficioOperativo = beneficioBruto; // sin retenciones detalladas
  const beneficioNeto = beneficioBruto * 0.85; // estimación tras impuestos
  const margenGlobal = facturacionEmitidaMes > 0 ? (beneficioBruto / facturacionEmitidaMes) * 100 : 0;
  const ingresosRent = useMemo(() => sumOf(rent.rows, "ingresos_totales"), [rent.rows]);
  const beneficioRent = useMemo(() => sumOf(rent.rows, "beneficio"), [rent.rows]);
  const rentabPct = ingresosRent > 0 ? (beneficioRent / ingresosRent) * 100 : 0;

  const loadingAny = facturasMes.loading || facturasAno.loading || cuentas.loading || gastos.loading || inventario.loading;
  const lastAny = [facturasMes.lastFetch, facturasAno.lastFetch, cuentas.lastFetch, gastos.lastFetch].filter(Boolean).sort((a, b) => b - a)[0];

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="label-eyebrow text-gray-500">Espejo del portal · Solo lectura</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
            <LayoutDashboard size={28} className="text-[#C5A059]" />
            Dashboard General
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-3xl">
            20 KPIs consolidados de toda la empresa. Los datos vienen del portal en vivo (Supabase) y se refrescan automáticamente cada 20 s — no hace falta pulsar actualizar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={backfillWebOrders}
            className="px-3 py-1.5 border border-gray-300 hover:border-black text-xs flex items-center gap-2"
            data-testid="portal-backfill-orders"
            title="Envía todos los pedidos web pagados a la tabla ventas del portal"
          >
            <Upload size={12} />
            Enviar pedidos web al portal
          </button>
          <LiveBadge lastFetch={lastAny} loading={loadingAny} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="portal-dashboard-kpis">
        <KpiCard icon={Zap} label="Facturación hoy" value={formatMoney(facturacionHoy)} sub="Ventas del día" tone="gold" loading={facturasHoy.loading} />
        <KpiCard icon={TrendingUp} label="Facturación mes" value={formatMoney(facturacionEmitidaMes)} sub={`${(facturasMes.rows || []).filter((r) => r.tipo === "EMITIDA").length} facturas emitidas`} tone="green" loading={facturasMes.loading} />
        <KpiCard icon={TrendingUp} label="Facturación año" value={formatMoney(facturacionAno)} sub={new Date().getFullYear().toString()} tone="green" loading={facturasAno.loading} />
        <KpiCard icon={BadgeCheck} label="Ingresos cobrados" value={formatMoney(cobradoMes)} sub="Mes en curso" tone="blue" loading={facturasMes.loading} />
        <KpiCard icon={ArrowUpRight} label="Beneficio bruto" value={formatMoney(beneficioBruto)} sub="Ingresos − gastos mes" tone="green" />

        <KpiCard icon={ArrowUpRight} label="Beneficio operativo" value={formatMoney(beneficioOperativo)} tone="green" />
        <KpiCard icon={ArrowUpRight} label="Beneficio neto est." value={formatMoney(beneficioNeto)} sub="Aprox. tras impuestos" tone="blue" />
        <KpiCard icon={Percent} label="Margen global" value={`${margenGlobal.toFixed(1)}%`} sub="Beneficio / facturación" tone="gold" />
        <KpiCard icon={Wallet} label="Tesorería disponible" value={formatMoney(tesoreriaDisp)} sub={`${(cuentas.rows || []).length} cuentas activas`} tone="blue" loading={cuentas.loading} />
        <KpiCard icon={Landmark} label="Saldo bancario" value={formatMoney(saldoBancario)} tone="blue" />

        <KpiCard icon={CircleDollarSign} label="Caja disponible" value={formatMoney(cajaDisponible)} tone="gold" />
        <KpiCard icon={Boxes} label="Stock valorizado" value={formatMoney(stockValorizado)} sub={`${(inventario.rows || []).length} SKUs`} tone="slate" loading={inventario.loading} />
        <KpiCard icon={ArrowDownRight} label="Cobros pendientes" value={formatMoney(cobrosPendientes)} sub="Facturas por cobrar" tone="red" />
        <KpiCard icon={ArrowDownRight} label="Pagos pendientes" value={formatMoney(pagosPendientes)} sub="Facturas por pagar" tone="red" loading={gastosPend.loading} />
        <KpiCard icon={Clock3} label="Cashflow 30 días" value={formatMoney(cashflowMes)} sub="Entradas − salidas" tone={cashflowMes >= 0 ? "green" : "red"} loading={movTeso.loading} />

        <KpiCard icon={Receipt} label="Gastos del mes" value={formatMoney(gastosMes)} sub={`${(gastos.rows || []).length} apuntes`} tone="red" loading={gastos.loading} />
        <KpiCard icon={ClipboardList} label="Rentabilidad producción" value={`${rentabPct.toFixed(1)}%`} sub="Ingresos LDD / coste" tone="gold" loading={rent.loading} />
        <KpiCard icon={Users} label="Deudas vencidas" value={String((facturasAno.rows || []).filter((r) => r.tipo === "EMITIDA" && r.estado === "VENCIDA").length)} sub="Facturas emitidas vencidas" tone="red" />
        <KpiCard icon={Package} label="Facturas emitidas" value={String((facturasMes.rows || []).filter((r) => r.tipo === "EMITIDA").length)} sub="Mes en curso" tone="slate" />
        <KpiCard icon={Truck} label="Facturas recibidas" value={String((facturasMes.rows || []).filter((r) => r.tipo === "RECIBIDA").length)} sub="Mes en curso" tone="slate" />
      </div>
    </div>
  );
}
