import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  if (activeSlug) return null;

  return (
    <div className="border-y" style={{ borderColor: "rgba(197,160,89,0.18)", background: "rgba(10,10,10,0.5)" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-3 flex items-center gap-8 overflow-x-auto">
        <span className="label-eyebrow gold whitespace-nowrap">Categorías:</span>
        {cats.map((c) => (
          <Link
            key={c.slug}
            to={`/catalogo?categoria=${c.slug}`}
            className="nav-link whitespace-nowrap"
            data-testid={`catbar-${c.slug}`}
            style={{ color: "#FAF8F5" }}
          >
            {c.name}
          </Link>
        ))}
        <Link to="/lotes/configurador" className="nav-link whitespace-nowrap" data-testid="catbar-configurador" style={{ color: "#C5A059" }}>
          Configura tu lote
        </Link>
      </div>
    </div>
  );
}
