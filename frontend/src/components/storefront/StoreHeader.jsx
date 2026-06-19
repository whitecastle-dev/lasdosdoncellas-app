import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Menu, X, User, ChevronDown } from "lucide-react";
import { Logo } from "@/components/storefront/Logo";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function StoreHeader({ onOpenCart }) {
  const { count } = useCart();
  const { customer, logout } = useCustomer();
  const [open, setOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (logout) logout();
    setIsDropdownOpen(false);
    navigate("/");
  };

  return (
    <header
      key={customer ? "logged-in" : "guest"}
      className="sticky top-0 z-40 backdrop-blur-xl notranslate"
      translate="no"
      style={{ background: "rgba(10,10,10,0.78)", borderBottom: "1px solid rgba(197,160,89,0.18)" }}
    >
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 flex items-center justify-between py-4">
        <Link to="/" data-testid="header-logo-link">
          <Logo size={44} />
        </Link>
        <nav className="hidden md:flex items-center gap-10" style={{ color: "#FAF8F5" }}>
          <Link to="/" className="nav-link" data-testid="nav-home" translate="yes">Inicio</Link>
          <Link to="/catalogo" className="nav-link" data-testid="nav-catalogo" translate="yes">Catálogo</Link>
          <Link to="/lotes/configurador" className="nav-link" data-testid="nav-configurador" translate="yes">Configurar lote</Link>
          <Link to="/nosotros" className="nav-link" data-testid="nav-nosotros" translate="yes">Nosotros</Link>
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {customer ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="text-[#FAF8F5] hover:text-[#C5A059] transition flex items-center gap-2 px-3 py-2"
              >
                <User size={16} />
                <span className="hidden sm:inline text-xs uppercase tracking-[0.2em]" translate="yes">
                  {customer.name?.split(" ")[0] || "Cuenta"}
                </span>
                <ChevronDown size={14} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-[rgba(197,160,89,0.3)] py-2 shadow-xl z-50">
                  <Link to="/cuenta/perfil" className="block px-4 py-2 text-xs text-[#FAF8F5] hover:bg-[#C5A059] hover:text-black transition uppercase tracking-widest" onClick={() => setIsDropdownOpen(false)} translate="yes">Mi perfil</Link>
                  <Link to="/cuenta?tab=orders" className="block px-4 py-2 text-xs text-[#FAF8F5] hover:bg-[#C5A059] hover:text-black transition uppercase tracking-widest" onClick={() => setIsDropdownOpen(false)} translate="yes">Mis pedidos</Link>
                  <Link to="/cuenta/configuracion" className="block px-4 py-2 text-xs text-[#FAF8F5] hover:bg-[#C5A059] hover:text-black transition uppercase tracking-widest" onClick={() => setIsDropdownOpen(false)} translate="yes">Cambiar contraseña</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-900/20 transition uppercase tracking-widest" translate="yes">Cerrar sesión</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/cuenta/login" className="text-[#FAF8F5] hover:text-[#C5A059] transition px-3 py-2 text-xs uppercase tracking-[0.2em] hidden sm:inline" data-testid="header-login-link" translate="yes">
              Acceder
            </Link>
          )}
          <button onClick={onOpenCart} data-testid="header-cart-button" className="relative px-3 py-2 text-[#FAF8F5] hover:text-[#C5A059] transition flex items-center gap-2">
            <ShoppingBag size={18} />
            <span className="hidden sm:inline label-eyebrow" translate="yes">Cesta</span>
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
          <Link to="/" className="nav-link" onClick={() => setOpen(false)} translate="yes">Inicio</Link>
          <Link to="/catalogo" className="nav-link" onClick={() => setOpen(false)} translate="yes">Catálogo</Link>
          <Link to="/lotes/configurador" className="nav-link" onClick={() => setOpen(false)} translate="yes">Configurar lote</Link>
          <Link to="/nosotros" className="nav-link" onClick={() => setOpen(false)} translate="yes">Nosotros</Link>
          <Link to={customer ? "/cuenta" : "/cuenta/login"} className="nav-link" onClick={() => setOpen(false)} translate="yes">
            {customer ? "Mi cuenta" : "Acceder"}
          </Link>
        </div>
      )}
    </header>
  );
}
