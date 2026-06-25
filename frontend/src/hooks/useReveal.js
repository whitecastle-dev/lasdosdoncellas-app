import { useEffect, useRef } from "react";

/**
 * Pequeño hook para revelar elementos al hacer scroll usando
 * IntersectionObserver. Añade la clase 'in' a cualquier descendiente
 * con la clase 'reveal' del contenedor referenciado.
 *
 * Uso:
 *   const ref = useReveal();
 *   <section ref={ref}>
 *     <h2 className="reveal">Titulo</h2>
 *     <p className="reveal">Texto</p>
 *   </section>
 */
export default function useReveal({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      // Fallback: revelar todo al instante
      if (root) root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const targets = root.querySelectorAll(".reveal");
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            if (once) io.unobserve(e.target);
          } else if (!once) {
            e.target.classList.remove("in");
          }
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [threshold, once]);
  return ref;
}
