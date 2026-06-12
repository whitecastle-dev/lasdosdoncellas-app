import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Menu, X, User } from "lucide-react";
import { Logo } from "@/components/storefront/Logo";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";

export default function StoreHeader({ onOpenCart }) {
  const { count } = useCart();
  const { customer } = useCustomer();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: "rgba(10,10,10,0.78)", borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 flex items-center justify-between py-4">
        <Link to="/" data-testid="header-logo-link">
          <Logo size={44} />
        </Link>
        <nav className="hidden md:flex items-center gap-10" style={{ color: "#FAF8F5" }}>
          <Link to="/" className="nav-link" data-testid="nav-home">Inicio</Link>
          <Link to="/catalogo" className="nav-link" data-testid="nav-catalogo">Catálogo</Link>
          <Link to="/lotes/configurador" className="nav-link" data-testid="nav-configurador">Configurar lote</Link>
          <Link to="/nosotros" className="nav-link" data-testid="nav-nosotros">Nosotros</Link>
        </nav>
        <div className="flex items-center gap-3">
          {customer ? (
            <Link to="/cuenta" className="text-[#FAF8F5] hover:text-[#C5A059] transition flex items-center gap-2 px-3 py-2" data-testid="header-account-link">
              <User size={16} />
              <span className="hidden sm:inline text-xs uppercase tracking-[0.2em]">{customer.name?.split(" ")[0] || "Cuenta"}</span>
            </Link>
          ) : (
            <Link to="/cuenta/login" className="text-[#FAF8F5] hover:text-[#C5A059] transition px-3 py-2 text-xs uppercase tracking-[0.2em] hidden sm:inline" data-testid="header-login-link">
              Acceder
            </Link>
          )}
          <button onClick={onOpenCart} data-testid="header-cart-button" className="relative px-3 py-2 text-[#FAF8F5] hover:text-[#C5A059] transition flex items-center gap-2">
            <ShoppingBag size={18} />
            <span className="hidden sm:inline label-eyebrow">Cesta</span>
            {count > 0 && (
              <span data-testid="cart-count-badge" className="absolute -top-0 -right-1 text-[10px] rounded-full bg-[#C5A059] text-black w-5 h-5 flex items-center justify-center font-medium">{count}</span>
            )}
          </button>
          <button className="md:hidden text-[#FAF8F5]" onClick={() => setOpen(!open)} data-testid="header-menu-toggle">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[rgba(197,160,89,0.18)] px-6 py-4 flex flex-col gap-3" style={{ background: "rgba(10,10,10,0.95)", color: "#FAF8F5" }}>
          <Link to="/" className="nav-link" onClick={() => setOpen(false)}>Inicio</Link>
          <Link to="/catalogo" className="nav-link" onClick={() => setOpen(false)}>Catálogo</Link>
          <Link to="/lotes/configurador" className="nav-link" onClick={() => setOpen(false)}>Configurar lote</Link>
          <Link to="/nosotros" className="nav-link" onClick={() => setOpen(false)}>Nosotros</Link>
          <Link to={customer ? "/cuenta" : "/cuenta/login"} className="nav-link" onClick={() => setOpen(false)}>
            {customer ? "Mi cuenta" : "Acceder"}
          </Link>
        </div>
      )}
    </header>
  );
}
