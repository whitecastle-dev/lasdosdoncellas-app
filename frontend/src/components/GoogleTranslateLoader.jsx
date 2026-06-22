import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Carga el widget de Google Translate UNA SOLA VEZ y SOLO cuando la ruta no
 * es /admin. Esto evita que el script de ~200KB y el DOM-walk de Google se
 * ejecuten en el CMS — que es lento y muy notable en móvil.
 *
 * Si el usuario navega de tienda → /admin, dejamos el script montado pero
 * se vuelve inerte porque no encuentra el <div id="google_translate_element">
 * en /admin (lo creamos solo cuando la ruta es de tienda).
 */
let loaded = false;

export default function GoogleTranslateLoader() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;

    // Garantiza el contenedor oculto
    if (!document.getElementById("google_translate_element")) {
      const el = document.createElement("div");
      el.id = "google_translate_element";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
      document.body.appendChild(el);
    }

    if (loaded) return;
    loaded = true;

    // Init callback que usará el script de Google al cargar
    window.googleTranslateElementInit = function () {
      // eslint-disable-next-line no-new, no-undef
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "es",
          includedLanguages: "en,fr,pt,de,it,ca,gl,eu",
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    const s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, [isAdmin]);

  return null;
}
