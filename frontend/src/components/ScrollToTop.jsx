import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Cada vez que cambia la ruta (path o query), volvemos al inicio del documento.
// React Router NO hace esto por defecto, lo que provoca que el usuario aterrice
// "en mitad de página" tras navegar desde un enlace en mitad de la pantalla.
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search]);
  return null;
}
