import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";

// SVG inline para evitar el icono de fontawesome — keeps bundle small
const WhatsAppIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.5 2.2 7.9L.5 31.5l7.8-2c2.3 1.3 5 2 7.7 2 8.6 0 15.5-6.9 15.5-15.5S24.6.5 16 .5zm0 28.2c-2.5 0-4.9-.7-7-1.9l-.5-.3-4.6 1.2 1.2-4.5-.3-.5c-1.4-2.3-2.2-4.9-2.2-7.7C2.6 8.5 8.6 2.5 16 2.5c3.6 0 7 1.4 9.5 4 2.5 2.5 3.9 5.9 3.9 9.5.1 7.5-6 13.7-13.4 13.7zm7.4-10c-.4-.2-2.4-1.2-2.7-1.3-.4-.1-.7-.2-.9.2s-1.1 1.3-1.3 1.5c-.2.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1-2-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.3.2-.4.3-.7.1-.3 0-.5-.1-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.7c-.3 0-.7.1-1 .5s-1.3 1.3-1.3 3.1c0 1.8 1.3 3.6 1.5 3.9.2.3 2.6 4 6.4 5.5.9.4 1.6.6 2.1.8.9.3 1.7.2 2.3.1.7-.1 2.4-1 2.7-1.9.3-.9.3-1.8.2-1.9-.1-.2-.4-.2-.8-.4z"/>
  </svg>
);

/**
 * Botón flotante de WhatsApp que aparece en el storefront cuando el admin
 * lo activa desde /admin/configuracion. Lee /api/settings/public para no
 * exigir auth.
 */
export default function WhatsAppFloat() {
  const [conf, setConf] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/settings/public");
        if (active) setConf(data.whatsapp);
      } catch { /* no crítico */ }
    })();
    return () => { active = false; };
  }, []);

  // No mostrar en el CMS — solo storefront
  if (pathname.startsWith("/admin")) return null;
  if (!conf?.enabled || !conf?.phone) return null;
  const text = conf.default_message ? `?text=${encodeURIComponent(conf.default_message)}` : "";
  const href = `https://wa.me/${conf.phone}${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="wa-float"
      aria-label={conf.label || "Chatea con nosotros por WhatsApp"}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 pl-3 pr-4 py-3 rounded-full shadow-2xl group transition-all duration-300 hover:scale-105"
      style={{
        background: "linear-gradient(135deg, #25D366 0%, #1ebe57 100%)",
        color: "white",
        boxShadow: "0 10px 30px -10px rgba(37, 211, 102, 0.55), 0 2px 6px rgba(0,0,0,0.18)",
      }}
    >
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white/30 opacity-60 animate-ping" />
        <WhatsAppIcon size={22} />
      </span>
      <span className="hidden sm:inline text-sm font-semibold tracking-wide whitespace-nowrap">
        {conf.label || "Chatea con nosotros"}
      </span>
    </a>
  );
}
