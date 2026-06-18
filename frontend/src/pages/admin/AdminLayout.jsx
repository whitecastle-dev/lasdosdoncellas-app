import React from "react";
import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Users, LogOut, Store, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard", perm: "dashboard.read" },
  { to: "/admin/products", icon: Package, label: "Productos", perm: "products.read" },
  { to: "/admin/orders", icon: ShoppingCart, label: "Pedidos", perm: "orders.read" },
  { to: "/admin/providers", icon: Truck, label: "Proveedores", perm: "products.read" },
  { to: "/admin/users", icon: Users, label: "Usuarios", perm: "users.read" },
];

export default function AdminLayout() {
  const { user, loading, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="min-h-screen flex items-center justify-center gold" style={{ background: "#0A0A0A" }}>Cargando…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <div className="ldd-cms min-h-screen flex">
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: "#0A0A0A", color: "#FAF8F5" }}>
        <div className="px-5 py-6" style={{ borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
          <div className="font-serif text-xl leading-tight">Las Dos Doncellas</div>
          <div className="font-script gold text-base -mt-0.5">CMS</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {LINKS.filter((l) => hasPermission(l.perm)).map((l) => (
            <NavLink
              key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              data-testid={`sidebar-${l.label.toLowerCase()}`}
            >
              <l.icon size={16} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 space-y-1" style={{ borderTop: "1px solid rgba(197,160,89,0.18)" }}>
          <button onClick={async () => { await logout(); navigate("/"); }} className="sidebar-link w-full text-left" data-testid="sidebar-shop">
            <Store size={16} /> <span>Ver tienda</span>
          </button>
          <div className="px-3 pt-2 pb-1 text-xs" style={{ color: "rgba(250,248,245,0.45)" }}>
            {user.name} <br />
            <span className="gold">{user.role}</span>
          </div>
          <button onClick={async () => { await logout(); navigate("/admin/login"); }} className="sidebar-link w-full text-left text-red-300 hover:bg-red-900/30" data-testid="sidebar-logout">
            <LogOut size={16} /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
