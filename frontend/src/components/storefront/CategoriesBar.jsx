import React from "react";
import { Link } from "react-router-dom";

const CATS = [
  { slug: "jamones", label: "Jamones" },
  { slug: "embutidos", label: "Embutidos" },
  { slug: "lotes", label: "Lotes" },
];

export default function CategoriesBar({ activeSlug = null }) {
  if (activeSlug) return null; // hidden once a category is selected
  return (
    <div className="border-y" style={{ borderColor: "rgba(197,160,89,0.18)", background: "rgba(10,10,10,0.5)" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-3 flex items-center gap-8 overflow-x-auto">
        <span className="label-eyebrow gold whitespace-nowrap">Categorías:</span>
        {CATS.map((c) => (
          <Link key={c.slug} to={`/categoria/${c.slug}`} className="nav-link whitespace-nowrap" data-testid={`catbar-${c.slug}`} style={{ color: "#FAF8F5" }}>
            {c.label}
          </Link>
        ))}
        <Link to="/lotes/configurador" className="nav-link whitespace-nowrap" data-testid="catbar-configurador" style={{ color: "#C5A059" }}>
          Configura tu lote
        </Link>
      </div>
    </div>
  );
}
