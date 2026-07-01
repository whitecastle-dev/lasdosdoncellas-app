import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Boxes, Warehouse, Package, Truck, ClipboardList, FileText, TrendingUp, ChevronRight
} from "lucide-react";

const TABS = [
  { to: "valoracion", icon: TrendingUp, label: "Valoración stock" },
  { to: "lotes", icon: Package, label: "Lotes" },
  { to: "ubicaciones", icon: Warehouse, label: "Ubicaciones" },
  { to: "pedidos", icon: Truck, label: "Pedidos a proveedores" },
  { to: "recepciones", icon: ClipboardList, label: "Recepciones" },
  { to: "facturas-proveedor", icon: FileText, label: "Facturas proveedor" },
];

export default function InventoryLayout() {
  const loc = useLocation();
  const isRoot = loc.pathname.endsWith("/inventario") || loc.pathname.endsWith("/inventario/");
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="label-eyebrow text-gray-500">Centro logístico</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <Boxes size={28} className="text-[#C5A059]" />
          Inventario · Compras · Facturación proveedor
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Todo conectado: la <strong>recepción de mercancía</strong> ajusta stock y coste medio, genera una <strong>factura pendiente</strong>, y los <strong>loncheados</strong> descuentan automáticamente del lote más antiguo por FIFO.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} data-testid={`inv-tab-${t.to}`}
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 flex items-center justify-center"><t.icon size={18} className="text-[#C5A059]" /></div>
                  <div className="font-serif text-lg">{t.label}</div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-black" />
              </div>
            </NavLink>
          ))}
        </div>
      ) : <Outlet />}
    </div>
  );
}
