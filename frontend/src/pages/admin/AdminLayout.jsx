import React, { useState, useEffect } from "react";
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Users, LogOut, Store, Truck, Settings as SettingsIcon, Menu, X, Tag, Building2, AlertTriangle, Factory, Boxes, Wallet, ShoppingBag, Calculator, Cable } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FreshnessBadge from "@/components/admin/FreshnessBadge";
import { Logo } from "@/components/storefront/Logo";

const SECTIONS = [
  {
    label: "Vista general",
    links: [
      { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard 360º", desc: "KPIs consolidados", perm: "dashboard.read" },
      { to: "/admin/ecommerce", icon: Store, label: "E-commerce", desc: "Pedidos web y reseñas", perm: "dashboard.read" },
    ],
  },
  {
    label: "Catálogo",
    links: [
      { to: "/admin/products", icon: Package, label: "Productos", desc: "Alta, precios, imágenes", perm: "products.read" },
      { to: "/admin/categories", icon: Tag, label: "Categorías", desc: "Familias del catálogo", perm: "products.read" },
      { to: "/admin/providers", icon: Truck, label: "Proveedores", desc: "Ficha y contactos", perm: "products.read" },
    ],
  },
  {
    label: "Ventas",
    links: [
      { to: "/admin/orders", icon: ShoppingCart, label: "Pedidos online", desc: "Preparación y envíos", perm: "orders.read" },
      { to: "/admin/tpv", icon: ShoppingBag, label: "TPV tienda física", desc: "Caja y tickets", perm: "products.read" },
      { to: "/admin/distribucion", icon: Truck, label: "Distribución B2B", desc: "Albaranes y rutas", perm: "products.read" },
      { to: "/admin/empresas", icon: Building2, label: "Clientes empresa", desc: "Cuentas B2B", perm: "customers.read" },
      { to: "/admin/users", icon: Users, label: "Usuarios web", desc: "Clientes registrados", perm: "users.read" },
    ],
  },
  {
    label: "Operaciones",
    links: [
      { to: "/admin/erp", icon: Factory, label: "Sala de loncheado", desc: "Producción y salarios", perm: "products.read" },
      { to: "/admin/inventario", icon: Boxes, label: "Inventario · Compras", desc: "Lotes, FIFO y coste medio", perm: "products.read" },
      { to: "/admin/stock-alerts", icon: AlertTriangle, label: "Alertas de stock", desc: "Reposición asistida", perm: "stock.read" },
    ],
  },
  {
    label: "Finanzas",
    links: [
      { to: "/admin/tesoreria", icon: Wallet, label: "Tesorería", desc: "Cuentas, cobros, pagos", perm: "products.read" },
      { to: "/admin/contabilidad", icon: Calculator, label: "Contabilidad", desc: "Asientos, IVA, PnL", perm: "products.read" },
      { to: "/admin/contasimple", icon: Cable, label: "ContaSimple", desc: "Sincronización con ContaSimple", perm: "products.write" },
    ],
  },
  {
    label: "Configuración",
    links: [
      { to: "/admin/configuracion", icon: SettingsIcon, label: "Ajustes", desc: "WhatsApp y datos empresa", perm: "users.write" },
    ],
  },
];

export default function AdminLayout() {
  const { user, loading, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cierra el sidebar al navegar
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (loading) return <div className="min-h-screen flex items-center justify-center gold" style={{ background: "#0A0A0A" }}>Cargando…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <div className="ldd-cms min-h-screen flex">
      {/* Barra móvil */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3" style={{ background: "#0A0A0A", borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
        <button onClick={() => setMobileOpen(true)} className="text-[#FAF8F5] p-1" data-testid="admin-mobile-menu-open" aria-label="Abrir menú">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Logo size={30} variant="mark" />
          <div className="font-script gold text-base">Las Dos Doncellas · CMS</div>
        </div>
        <div style={{ width: 22 }} />
      </header>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} data-testid="admin-mobile-overlay" />
      )}

      <aside
        className={`flex-shrink-0 flex flex-col z-50 transition-transform duration-200
          lg:w-64 lg:static lg:translate-x-0
          fixed top-0 bottom-0 left-0 w-72
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "#0A0A0A", color: "#FAF8F5" }}
        data-testid="admin-sidebar"
      >
        <div className="px-5 py-6 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
          <Logo size={44} variant="mark" />
          <div className="flex-1">
            <div className="font-serif text-lg leading-tight">Las Dos Doncellas</div>
            <div className="font-script gold text-sm -mt-0.5">Panel CMS</div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-[#FAF8F5] p-1" aria-label="Cerrar menú" data-testid="admin-mobile-menu-close">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {SECTIONS.map((section) => {
            const visible = section.links.filter((l) => hasPermission(l.perm));
            if (!visible.length) return null;
            return (
              <div key={section.label}>
                <div className="px-3 pb-1 label-eyebrow" style={{ color: "rgba(197,160,89,0.55)", fontSize: 10 }}>
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {visible.map((l) => (
                    <NavLink
                      key={l.to} to={l.to} end={l.end}
                      className={({ isActive }) => `sidebar-link group ${isActive ? "active" : ""}`}
                      data-testid={`sidebar-${l.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      title={l.desc}
                    >
                      <l.icon size={16} className="flex-shrink-0" />
                      <span className="flex-1">
                        <span className="block">{l.label}</span>
                        <span className="block text-[10px] leading-tight opacity-60 group-hover:opacity-80 truncate">{l.desc}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-3 space-y-1" style={{ borderTop: "1px solid rgba(197,160,89,0.18)" }}>
          <a href="/catalogo" target="_blank" rel="noopener noreferrer" className="sidebar-link w-full text-left" data-testid="sidebar-shop">
            <Store size={16} /> <span>Ver tienda</span>
          </a>
          <FreshnessBadge />
          <div className="px-3 pt-2 pb-1 text-xs" style={{ color: "rgba(250,248,245,0.45)" }}>
            {user.name} <br />
            <span className="gold">{user.role}</span>
          </div>
          <button onClick={async () => { await logout(); navigate("/admin/login"); }} className="sidebar-link w-full text-left text-red-300 hover:bg-red-900/30" data-testid="sidebar-logout">
            <LogOut size={16} /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
