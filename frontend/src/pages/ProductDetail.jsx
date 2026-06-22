import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import ReviewsSection from "@/components/storefront/ReviewsSection";
import StarRating from "@/components/StarRating";
import { api, fileUrl, formatMoney } from "@/lib/api";
import { useCart } from "@/context/CartContext";

function imgSrc(img) {
  if (!img) return "";
  if (img.startsWith("/api/")) return `${process.env.REACT_APP_BACKEND_URL}${img}`;
  if (img.startsWith("http")) return img;
  return fileUrl(img);
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
      setActiveImg(0);
    })();
  }, [id]);

  if (!product) return (
    <div className="ldd-storefront min-h-screen flex items-center justify-center gold">Cargando…</div>
  );

  const onAdd = () => {
    addItem(product, qty);
    setCartOpen(true);
  };

  const images = (product.image_urls && product.image_urls.length > 0)
    ? product.image_urls
    : ["https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400"];

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-10 pb-24">
        <Link to="/" className="inline-flex items-center gap-2 label-eyebrow gold mb-10 hover:opacity-80" data-testid="back-to-shop">
          <ArrowLeft size={14} /> Volver
        </Link>
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <div className="relative aspect-[4/5] overflow-hidden" style={{ background: "#171717" }}>
              <img src={imgSrc(images[activeImg])} alt={product.name} className="w-full h-full object-cover transition duration-700" data-testid="product-detail-image" />
            </div>
            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`aspect-square overflow-hidden border ${activeImg === i ? "border-[#C5A059]" : "border-transparent"}`} data-testid={`thumb-${i}`}>
                    <img src={imgSrc(src)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="label-eyebrow gold">{product.origin || "Producto ibérico"}</div>
            <h1 className="font-serif text-4xl md:text-6xl tracking-tighter leading-[1.02] mt-4" style={{ color: "#FAF8F5" }}>
              {product.name}
            </h1>
            {(product.review_count || 0) > 0 && (
              <div className="mt-4">
                <StarRating value={product.avg_rating || 0} size={16} readOnly count={product.review_count} showNumber />
              </div>
            )}
            <div className="mt-6 flex items-center gap-4">
              <span className="font-serif text-3xl gold" data-testid="product-detail-price">{formatMoney(product.price)}</span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="line-through text-base" style={{ color: "rgba(250,248,245,0.45)" }}>{formatMoney(product.compare_at_price)}</span>
              )}
              {product.weight_grams && <span className="text-sm" style={{ color: "rgba(250,248,245,0.5)" }}>· {product.weight_grams} g</span>}
            </div>

            <div className="ldd-divider my-8" />

            <p className="text-base leading-relaxed" style={{ color: "rgba(250,248,245,0.8)" }}>
              {product.long_description || product.description}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-8 text-sm" style={{ color: "rgba(250,248,245,0.75)" }}>
              {product.breed && <div><span className="label-eyebrow block gold mb-1">Raza</span>{product.breed}</div>}
              {product.feed && <div><span className="label-eyebrow block gold mb-1">Alimentación</span>{product.feed}</div>}
              {product.curing_months && <div><span className="label-eyebrow block gold mb-1">Curación</span>{product.curing_months} meses</div>}
              {product.origin && <div><span className="label-eyebrow block gold mb-1">Origen</span>{product.origin}</div>}
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex items-center border border-[rgba(250,248,245,0.2)] rounded-full">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3 hover:text-[#C5A059]" data-testid="detail-qty-dec">−</button>
                <span className="w-10 text-center font-mono-data">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-4 py-3 hover:text-[#C5A059]" data-testid="detail-qty-inc">+</button>
              </div>
              <button onClick={onAdd} disabled={product.stock <= 0} className="ldd-btn-gold flex-1 justify-center disabled:opacity-40" data-testid="detail-add-to-cart">
                {product.stock <= 0 ? "Agotado" : "Añadir a la cesta"}
              </button>
            </div>

            <ul className="mt-8 space-y-2 text-sm" style={{ color: "rgba(250,248,245,0.7)" }}>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Envío peninsular 24-48h</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Embalaje refrigerado</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Factura electrónica con IVA</li>
            </ul>
          </div>
        </div>

        <ReviewsSection
          productId={product.id}
          initialAvg={product.avg_rating || 0}
          initialCount={product.review_count || 0}
          onStatsChange={({ avg, count }) => setProduct((p) => p ? { ...p, avg_rating: avg, review_count: count } : p)}
        />
      </div>
      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
