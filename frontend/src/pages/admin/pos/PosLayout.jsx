import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, Receipt, ClipboardList, ChevronRight } from "lucide-react";

const TABS = [
  { to: "caja", icon: ShoppingBag, label: "Caja (TPV)" },
  { to: "tickets", icon: Receipt, label: "Tickets" },
  { to: "sesiones", icon: ClipboardList, label: "Sesiones de caja" },
];

export default function PosLayout() {
  const loc = useLocation();
  const isRoot = loc.pathname.endsWith("/tpv") || loc.pathname.endsWith("/tpv/");
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="label-eyebrow text-gray-500">Tienda física</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <ShoppingBag size={28} className="text-[#C5A059]" />TPV · Punto de venta
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Registra ventas al contado. Cada ticket <strong>descuenta stock</strong> por FIFO y crea un
          <strong> movimiento de entrada</strong> en la cuenta de caja seleccionada al abrir la sesión.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            data-testid={`pos-tab-${t.to}`}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
