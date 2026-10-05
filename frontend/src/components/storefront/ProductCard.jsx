import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Check, ShoppingBag } from "lucide-react";
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
  const { addItem, updateQty, items } = useCart();
  const [flash, setFlash] = useState(false);
  const img = p.image_urls?.[0];
  const inCart = items.find((i) => i.product_id === p.id);
  const qty = inCart?.qty || 0;
  const out = p.stock <= 0;

  const add = () => {
    addItem(p);
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
  };

  return (
    <div className="product-card group" data-testid={`product-card-${p.id}`}>
      <Link to={`/product/${p.id}`} className="block relative overflow-hidden aspect-[4/5]" style={{ background: "#171717" }}>
        {img ? (
          <img src={imgSrc(img)} alt={p.name} className="product-card-img w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-4" style={{ background: "linear-gradient(135deg, #1f1410 0%, #0A0A0A 100%)" }}>
            <span className="font-script gold text-2xl mb-1">Las Dos Doncellas</span>
            <span className="label-eyebrow gold opacity-70 text-[10px]">Próximamente</span>
          </div>
        )}
        {p.compare_at_price && p.compare_at_price > p.price && (
          <span className="absolute top-4 left-4 bg-[#8C211E] text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1">Oferta</span>
        )}
        {out && (
          <span className="absolute top-4 right-4 bg-[#0A0A0A]/80 text-[#FAF8F5] text-[10px] uppercase tracking-[0.2em] px-3 py-1">Agotado</span>
        )}
        {qty > 0 && (
          <span
            className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-[0.22em] transition-colors duration-500 ${flash ? "bg-[#C5A059] text-black" : "bg-[#0A0A0A]/85 text-[#C5A059]"}`}
            data-testid={`in-cart-banner-${p.id}`}
          >
            <Check size={12} /> En tu cesta · {qty} {qty === 1 ? "ud." : "uds."}
          </span>
        )}
      </Link>
      <div className="mt-4 sm:mt-5 flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <Link to={`/product/${p.id}`} className="font-serif text-lg sm:text-xl md:text-2xl block leading-tight hover:text-[#C5A059] transition" style={{ color: "#FAF8F5" }}>
            {p.name}
          </Link>
          {p.origin && <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }}>{p.origin}</div>}
          {(p.review_count || 0) > 0 && (
            <div className="mt-2">
              <StarRating value={p.avg_rating || 0} size={12} readOnly count={p.review_count} />
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono-data text-base sm:text-lg gold" data-testid={`product-price-${p.id}`}>{formatMoney(p.price)}</div>
          {p.weight_grams && <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.5)" }}>{p.weight_grams} g</div>}
        </div>
      </div>
      {qty > 0 ? (
        <div className="mt-4 flex items-stretch border border-[#C5A059]" data-testid={`qty-stepper-${p.id}`}>
          <button
            onClick={() => updateQty(p.id, qty - 1)}
            className="w-11 flex items-center justify-center text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition"
            aria-label="Quitar una unidad"
            data-testid={`qty-minus-${p.id}`}
          >
            <Minus size={14} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#C5A059]" data-testid={`qty-value-${p.id}`}>
            <ShoppingBag size={12} /> {qty}
          </div>
          <button
            onClick={add}
            disabled={out}
            className="w-11 flex items-center justify-center text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition disabled:opacity-40"
            aria-label="Añadir una unidad"
            data-testid={`qty-plus-${p.id}`}
          >
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={add}
          disabled={out}
          className="mt-4 w-full py-3 text-[11px] uppercase tracking-[0.22em] border border-[rgba(197,160,89,0.4)] text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid={`add-to-cart-${p.id}`}
        >
          Añadir a la cesta
        </button>
      )}
    </div>
  );
}
