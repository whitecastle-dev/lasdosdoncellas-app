import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

/** Banner de diagnóstico: avisa si la clave Supabase configurada no es service_role. */
export function PortalKeyBanner() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    api.get("/portal/health").then((r) => setHealth(r.data)).catch(() => setHealth(null));
  }, []);
  if (!health || health.ok) return null;
  const role = health.role || "desconocida";
  return (
    <div className="mb-6 border border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-3 text-sm" data-testid="portal-key-banner">
      <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-medium">
          {health.configured
            ? <>La clave de Supabase activa es <span className="font-mono">{role}</span>, no <span className="font-mono">service_role</span>.</>
            : "Supabase no está configurado en este servidor."}
        </div>
        <div className="text-xs mt-1">
          Con la clave <span className="font-mono">anon</span> Supabase devuelve <span className="font-mono">42501 permission denied</span> en las tablas protegidas.
          Solución: en el panel del backend (Render → Environment) sustituye <span className="font-mono">SUPABASE_SERVICE_KEY</span> por la clave
          <span className="font-mono"> service_role</span> (Supabase → Project Settings → API) y redespliega.
        </div>
      </div>
    </div>
  );
}

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
      <PortalKeyBanner />
      <PortalTabs base={base} tabs={tabs} />
      <Outlet />
    </div>
  );
}
