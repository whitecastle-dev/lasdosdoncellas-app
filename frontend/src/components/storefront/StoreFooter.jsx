import React from "react";
import { Logo } from "@/components/storefront/Logo";
import { Link } from "react-router-dom";

export default function StoreFooter() {
  return (
    <footer className="mt-32 pt-20 pb-12" style={{ borderTop: "1px solid rgba(197,160,89,0.18)" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 grid md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <Logo size={56} />
          <p className="mt-6 max-w-md text-sm leading-relaxed" style={{ color: "rgba(250,248,245,0.65)" }}>
            Ibéricos curados con tiempo y mimo en Castilblanco de los Arroyos —
            corazón de la Sierra Norte de Sevilla.
          </p>
        </div>
        <div>
          <div className="label-eyebrow gold mb-5">Tienda</div>
          <ul className="space-y-3 text-sm" style={{ color: "rgba(250,248,245,0.75)" }}>
            <li><Link to="/catalogo" className="hover:text-[#C5A059] transition">Catálogo</Link></li>
            <li><Link to="/categoria/jamones" className="hover:text-[#C5A059] transition">Jamones</Link></li>
            <li><Link to="/categoria/embutidos" className="hover:text-[#C5A059] transition">Embutidos</Link></li>
            <li><Link to="/lotes/configurador" className="hover:text-[#C5A059] transition">Configura tu lote</Link></li>
          </ul>
        </div>
        <div>
          <div className="label-eyebrow gold mb-5">Contacto</div>
          <ul className="space-y-3 text-sm" style={{ color: "rgba(250,248,245,0.75)" }}>
            <li>info@lasdosdoncellasibericos.es</li>
            <li>Calle Huerto del Cura, 2</li>
            <li>41230 Castilblanco de los Arroyos</li>
            <li>Sevilla · España</li>
            <li className="pt-4"><Link to="/admin/login" className="label-eyebrow hover:text-[#C5A059]" data-testid="footer-admin-link">Acceso CMS</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 mt-16 pt-8 flex items-center justify-between text-xs" style={{ borderTop: "1px solid rgba(197,160,89,0.12)", color: "rgba(250,248,245,0.45)" }}>
        <div>© {new Date().getFullYear()} Las Dos Doncellas S.L. · CIF 77815813M</div>
        <div className="font-script gold text-base">Sierra Norte de Sevilla</div>
      </div>
    </footer>
  );
}
