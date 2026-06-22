import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Selector de idioma vía Google Translate Element.
 *
 * Traduce TODO el contenido visible (estático + dinámico cargado desde la BD)
 * sin necesidad de añadir claves de traducción por cada string nuevo.
 *
 * El widget de Google se monta oculto en #google_translate_element y este
 * componente sólo renderiza un botón ES/EN/PT/FR custom que selecciona la
 * opción correspondiente del <select> oculto que Google inyecta.
 *
 * El init real (`window.googleTranslateElementInit`) y el <script> están en
 * `public/index.html` y se cargan una sola vez.
 */

const LANGUAGES = [
  { code: "es", label: "ES", name: "Español",     flag: "🇪🇸" },
  { code: "en", label: "EN", name: "English",     flag: "🇬🇧" },
  { code: "fr", label: "FR", name: "Français",    flag: "🇫🇷" },
  { code: "pt", label: "PT", name: "Português",   flag: "🇵🇹" },
  { code: "de", label: "DE", name: "Deutsch",     flag: "🇩🇪" },
  { code: "it", label: "IT", name: "Italiano",    flag: "🇮🇹" },
];

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function currentLangFromCookie() {
  // googtrans cookie format: "/es/en"
  const v = readCookie("googtrans") || readCookie(".googtrans");
  if (!v) return "es";
  const parts = v.split("/").filter(Boolean);
  return parts[1] || "es";
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(currentLangFromCookie());

  // Cierra el menú al pulsar fuera
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest?.("[data-ldd-lang]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const setLanguage = (code) => {
    setCurrent(code);
    setOpen(false);

    if (code === "es") {
      // Volver al original: borra cookies googtrans para los dominios actual y padre
      const host = window.location.hostname;
      const parts = host.split(".");
      const root = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${host};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${root};`;
      window.location.reload();
      return;
    }

    // Selecciona el idioma desde el <select> oculto inyectado por Google
    const setOnSelect = () => {
      const sel = document.querySelector("select.goog-te-combo");
      if (sel) {
        sel.value = code;
        sel.dispatchEvent(new Event("change"));
        return true;
      }
      return false;
    };

    if (!setOnSelect()) {
      // Si el widget aún no está montado, fija la cookie y recarga para que
      // Google aplique la traducción en el siguiente render.
      const host = window.location.hostname;
      const parts = host.split(".");
      const root = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
      const val = `/es/${code}`;
      document.cookie = `googtrans=${val}; path=/;`;
      document.cookie = `googtrans=${val}; path=/; domain=${host};`;
      document.cookie = `googtrans=${val}; path=/; domain=${root};`;
      window.location.reload();
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  return (
    <div className="relative notranslate" translate="no" data-ldd-lang data-testid="lang-switcher">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-[#FAF8F5] hover:text-[#C5A059] transition px-2 py-2"
        data-testid="lang-switcher-button"
        aria-label="Change language"
      >
        <span className="text-lg leading-none" aria-hidden>{currentLang.flag}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-[rgba(197,160,89,0.3)] py-2 shadow-xl z-50"
          data-testid="lang-switcher-menu"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`w-full text-left px-4 py-2 text-xs uppercase tracking-widest transition flex items-center gap-3 ${
                l.code === current
                  ? "text-[#C5A059]"
                  : "text-[#FAF8F5] hover:bg-[#C5A059] hover:text-black"
              }`}
              data-testid={`lang-option-${l.code}`}
            >
              <span className="text-lg leading-none" aria-hidden>{l.flag}</span>
              <span className="flex-1">{l.name}</span>
              <span className="font-mono opacity-60 text-[10px]">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
