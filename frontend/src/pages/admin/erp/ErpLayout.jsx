import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Users, Factory, UserCircle2, Coins, Calendar, Tag, Tags, RefreshCw, ChevronRight
} from "lucide-react";

const TABS = [
  { to: "loncheados", icon: Factory, label: "Loncheados" },
  { to: "empleados", icon: UserCircle2, label: "Empleados" },
  { to: "salarios", icon: Coins, label: "Salarios" },
  { to: "clientes", icon: Users, label: "Clientes producción" },
  { to: "productos", icon: Tag, label: "Tipos de pieza" },
  { to: "eventos", icon: Calendar, label: "Eventos / Servicios" },
  { to: "etiquetas", icon: Tags, label: "Etiquetas particulares" },
  { to: "sync", icon: RefreshCw, label: "Importar desde Supabase" },
];

export default function ErpLayout() {
  const loc = useLocation();
  const isRoot = loc.pathname.endsWith("/erp") || loc.pathname.endsWith("/erp/");
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="label-eyebrow text-gray-500">Centro de control</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <Factory size={28} className="text-[#C5A059]" />
          ERP · Sala de loncheado
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Producción, empleados, salarios y eventos importados del portal histórico. Fase 5 de la integración ERP completa.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            data-testid={`erp-tab-${t.to}`}
            className={({ isActive }) =>
              `px-4 py-2 text-sm transition-colors flex items-center gap-2 ${isActive ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"}`
            }
          >
            <t.icon size={14} />
            {t.label}
          </NavLink>
        ))}
      </div>

      {isRoot ? <ErpHome /> : <Outlet />}
    </div>
  );
}

function ErpHome() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className="cms-card p-5 hover:border-black border border-gray-200 group transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/5 flex items-center justify-center">
                <t.icon size={18} className="text-[#C5A059]" />
              </div>
              <div>
                <div className="font-serif text-lg">{t.label}</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-black" />
          </div>
        </NavLink>
      ))}
    </div>
  );
}
