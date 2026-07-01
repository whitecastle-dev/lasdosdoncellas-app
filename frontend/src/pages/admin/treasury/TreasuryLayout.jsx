import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Wallet, Landmark, ArrowLeftRight, FileText, Bell, TrendingUp, ChevronRight } from "lucide-react";

const TABS = [
  { to: "cashflow", icon: TrendingUp, label: "Cash flow 30d" },
  { to: "cuentas", icon: Landmark, label: "Cuentas y caja" },
  { to: "movimientos", icon: ArrowLeftRight, label: "Movimientos" },
  { to: "facturas-emitidas", icon: FileText, label: "Facturas emitidas" },
  { to: "recordatorios", icon: Bell, label: "Recordatorios" },
];

export default function TreasuryLayout() {
  const loc = useLocation();
  const isRoot = loc.pathname.endsWith("/tesoreria") || loc.pathname.endsWith("/tesoreria/");
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="label-eyebrow text-gray-500">Circuito del dinero</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3"><Wallet size={28} className="text-[#C5A059]" />Tesorería · Facturación</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">Cuentas, cobros, pagos y previsión de caja. Cobrar una factura emitida <strong>incrementa</strong> el saldo automáticamente; pagar una del proveedor lo <strong>resta</strong>.</p>
      </div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} data-testid={`tre-tab-${t.to}`}
            className={({ isActive }) => `px-4 py-2 text-sm transition-colors flex items-center gap-2 ${isActive ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"}`}>
            <t.icon size={14} />{t.label}
          </NavLink>
        ))}
      </div>
      {isRoot ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className="cms-card p-5 hover:border-black border border-gray-200 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-black/5 flex items-center justify-center"><t.icon size={18} className="text-[#C5A059]" /></div><div className="font-serif text-lg">{t.label}</div></div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-black" />
              </div>
            </NavLink>
          ))}
        </div>
      ) : <Outlet />}
    </div>
  );
}
