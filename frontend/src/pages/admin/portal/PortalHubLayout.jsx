import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";

/** Sub-tabs bar reused by every portal hub layout. */
export function PortalTabs({ base, tabs, testPrefix = "portal" }) {
  return (
    <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
      {tabs.map((t) => {
        const to = `${base}${t.to ? `/${t.to}` : ""}`;
        return (
          <NavLink
            key={t.to || "index"}
            to={to}
            end={t.end}
            data-testid={`${testPrefix}-tab-${t.to || "index"}`}
            className={({ isActive }) =>
              `whitespace-nowrap px-4 py-2 text-sm transition-colors flex items-center gap-2
               ${isActive ? "border-b-2 border-black text-black font-medium" : "text-gray-500 hover:text-black"}`
            }
          >
            {t.icon ? <t.icon size={14} /> : null}
            {t.label}
          </NavLink>
        );
      })}
    </div>
  );
}

export function LiveBadge({ lastFetch, loading }) {
  if (!lastFetch) return null;
  const t = lastFetch.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wide" data-testid="portal-live-badge">
      <span className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
      En vivo · {t}
    </span>
  );
}

/**
 * Hub layout: standard header + subtabs bar + nested outlet.
 * Consumed by DashboardGeneral, SalaCorte, Tienda, Distribucion, Finanzas hubs.
 */
export default function PortalHubLayout({ title, subtitle, icon: Icon, tabs, base }) {
  const loc = useLocation();
  const active = tabs.find((t) => {
    const to = `${base}${t.to ? `/${t.to}` : ""}`;
    return loc.pathname === to || (t.end && loc.pathname === base);
  });
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="label-eyebrow text-gray-500">Espejo del portal · Solo lectura</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
            {Icon && <Icon size={28} className="text-[#C5A059]" />}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-gray-500 mt-2 max-w-3xl">{subtitle}</p>}
          {active && <p className="text-xs text-gray-400 mt-1">{active.label}</p>}
        </div>
      </div>
      <PortalTabs base={base} tabs={tabs} />
      <Outlet />
    </div>
  );
}
