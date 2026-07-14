import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Landmark,
  FileSpreadsheet,
  Receipt,
  TrendingUp,
  Layers,
  ChevronRight,
  Calculator,
} from "lucide-react";

const TABS = [
  { to: "plan", icon: Layers, label: "Plan contable" },
  { to: "diario", icon: BookOpen, label: "Libro diario" },
  { to: "mayor", icon: FileSpreadsheet, label: "Libro mayor" },
  { to: "iva", icon: Receipt, label: "IVA" },
  { to: "resultado", icon: TrendingUp, label: "Cuenta de resultados" },
  { to: "analitica", icon: Landmark, label: "Analítica de margen" },
];

export default function AccountingLayout() {
  const loc = useLocation();
  const isRoot = loc.pathname.endsWith("/contabilidad") || loc.pathname.endsWith("/contabilidad/");
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="label-eyebrow text-gray-500">Contabilidad analítica</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <Calculator size={28} className="text-[#C5A059]" />Contabilidad
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Plan contable simplificado (PGC ES) con generación automática de asientos desde tickets TPV,
          facturas emitidas, facturas de proveedor, nóminas y movimientos manuales. Cada asiento cuadra
          debe = haber y es <strong>idempotente</strong> (rehacer el backfill no duplica).
        </p>
      </div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            data-testid={`acc-tab-${t.to}`}
            className={({ isActive }) =>
              `px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                isActive ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"
              }`
            }
          >
            <t.icon size={14} />
            {t.label}
          </NavLink>
        ))}
      </div>
      {isRoot ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className="cms-card p-5 hover:border-black border border-gray-200 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 flex items-center justify-center">
                    <t.icon size={18} className="text-[#C5A059]" />
                  </div>
                  <div className="font-serif text-lg">{t.label}</div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-black" />
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
