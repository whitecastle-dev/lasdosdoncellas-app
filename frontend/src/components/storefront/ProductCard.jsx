import React from "react";
import { Link } from "react-router-dom";
import { fileUrl, formatMoney } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import StarRating from "@/components/StarRating";

export function imgSrc(img) {
  if (!img) return "";
  if (img.startsWith("/api/")) return `${process.env.REACT_APP_BACKEND_URL}${img}`;
  if (img.startsWith("http")) return img;
  return fileUrl(img);
}

export default function ProductCard({ p }) {
  const { addItem } = useCart();
  const img = p.image_urls?.[0];
  return (
    <div className="product-card group" data-testid={`product-card-${p.id}`}>
      <Link to={`/product/${p.id}`} className="block relative overflow-hidden aspect-[4/5]" style={{ background: "#171717" }}>
        {img ? (
          <img src={imgSrc(img)} alt={p.name} className="product-card-img w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-script gold text-3xl">Las Dos Doncellas</div>
        )}
        {p.compare_at_price && p.compare_at_price > p.price && (
          <span className="absolute top-4 left-4 bg-[#8C211E] text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1">Oferta</span>
        )}
        {p.stock <= 0 && (
          <span className="absolute top-4 right-4 bg-[#0A0A0A]/80 text-[#FAF8F5] text-[10px] uppercase tracking-[0.2em] px-3 py-1">Agotado</span>
        )}
      </Link>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/product/${p.id}`} className="font-serif text-xl md:text-2xl block leading-tight hover:text-[#C5A059] transition" style={{ color: "#FAF8F5" }}>
            {p.name}
          </Link>
          {p.origin && <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }}>{p.origin}</div>}
          {(p.review_count || 0) > 0 && (
            <div className="mt-2">
              <StarRating value={p.avg_rating || 0} size={12} readOnly count={p.review_count} />
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono-data text-lg gold" data-testid={`product-price-${p.id}`}>{formatMoney(p.price)}</div>
          {p.weight_grams && <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.5)" }}>{p.weight_grams} g</div>}
        </div>
      </div>
      <button
        onClick={() => addItem(p)}
        disabled={p.stock <= 0}
        className="mt-4 w-full py-3 text-[11px] uppercase tracking-[0.22em] border border-[rgba(197,160,89,0.4)] text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
        data-testid={`add-to-cart-${p.id}`}
      >
        Añadir a la cesta
      </button>
    </div>
  );
}
