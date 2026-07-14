import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

const FALLBACK = [
  { slug: "jamones", name: "Jamones" },
  { slug: "embutidos", name: "Embutidos" },
  { slug: "quesos", name: "Quesos" },
  { slug: "vinos", name: "Vinos" },
  { slug: "aceites", name: "Aceites" },
  { slug: "lotes", name: "Lotes" },
];

export default function CategoriesBar({ activeSlug = null }) {
  const [cats, setCats] = useState(FALLBACK);
  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        if (Array.isArray(data) && data.length) {
          setCats(
            data
              .filter((c) => c.is_active !== false)
              .sort((a, b) => (a.position || 99) - (b.position || 99))
              .map((c) => ({ slug: c.slug, name: c.name }))
          );
        }
      } catch { /* mantiene fallback */ }
    })();
  }, []);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
      window.removeEventListener("resize", updateArrows);
    };
  }, [cats]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.65) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (activeSlug) return null;

  return (
    <div
      className="relative border-y"
      style={{ borderColor: "rgba(197,160,89,0.18)", background: "rgba(10,10,10,0.5)" }}
      data-testid="categories-bar"
    >
      <div className="max-w-[1500px] mx-auto relative">
        {/* Fade left */}
        <div
          className={`pointer-events-none absolute top-0 bottom-0 left-0 w-16 z-10 transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`}
          style={{ background: "linear-gradient(90deg, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0) 100%)" }}
        />
        {/* Fade right */}
        <div
          className={`pointer-events-none absolute top-0 bottom-0 right-0 w-16 z-10 transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`}
          style={{ background: "linear-gradient(270deg, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0) 100%)" }}
        />

        {/* Arrow left */}
        <button
          aria-label="Scroll categorías izquierda"
          data-testid="catbar-arrow-left"
          onClick={() => scrollBy(-1)}
          disabled={!canLeft}
          className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center
            w-8 h-8 rounded-full border transition-all duration-200
            ${canLeft ? "opacity-100 border-[rgba(197,160,89,0.6)] hover:bg-[#C5A059] hover:text-black" : "opacity-0 pointer-events-none border-transparent"}`}
          style={{ background: "rgba(10,10,10,0.85)", color: "#C5A059", backdropFilter: "blur(4px)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Scroll categorías derecha"
          data-testid="catbar-arrow-right"
          onClick={() => scrollBy(1)}
          disabled={!canRight}
          className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center
            w-8 h-8 rounded-full border transition-all duration-200
            ${canRight ? "opacity-100 border-[rgba(197,160,89,0.6)] hover:bg-[#C5A059] hover:text-black" : "opacity-0 pointer-events-none border-transparent"}`}
          style={{ background: "rgba(10,10,10,0.85)", color: "#C5A059", backdropFilter: "blur(4px)" }}
        >
          <ChevronRight size={16} />
        </button>

        <div
          ref={scrollerRef}
          className="ldd-catbar-scroller flex items-center gap-6 py-3 px-6 lg:px-14 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x proximity" }}
        >
          <span className="label-eyebrow gold whitespace-nowrap select-none">Categorías</span>
          {cats.map((c) => (
            <Link
              key={c.slug}
              to={`/catalogo?categoria=${c.slug}`}
              className="nav-link whitespace-nowrap text-[13px] tracking-wider transition-colors"
              data-testid={`catbar-${c.slug}`}
              style={{ color: "#FAF8F5", scrollSnapAlign: "start" }}
            >
              {c.name}
            </Link>
          ))}
          <Link
            to="/lotes/configurador"
            className="nav-link whitespace-nowrap text-[13px] tracking-wider transition-colors"
            data-testid="catbar-configurador"
            style={{ color: "#C5A059", scrollSnapAlign: "start" }}
          >
            Configura tu lote →
          </Link>
        </div>
      </div>

      {/* CSS puro para ocultar scrollbar en WebKit */}
      <style>{`
        .ldd-catbar-scroller::-webkit-scrollbar { display: none; height: 0; }
      `}</style>
    </div>
  );
}
