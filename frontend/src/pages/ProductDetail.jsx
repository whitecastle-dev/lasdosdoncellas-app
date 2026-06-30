import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import ReviewsSection from "@/components/storefront/ReviewsSection";
import ProductCard from "@/components/storefront/ProductCard";
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
  const [variantIdx, setVariantIdx] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [related, setRelated] = useState([]);
  const [pairingCheeses, setPairingCheeses] = useState([]);
  const { addItem } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
      setActiveImg(0);
      setVariantIdx(0);
    })();
    api.get(`/products/${id}/related?limit=6`).then(({ data }) => setRelated(data || [])).catch(() => {});
    api.get(`/products/${id}/pairing-cheeses`).then(({ data }) => setPairingCheeses(data || [])).catch(() => {});
  }, [id]);

  // Variante seleccionada: si hay variantes, su precio sobrescribe el base
  const variant = product && product.variants && product.variants.length > 0
    ? product.variants[variantIdx]
    : null;

  const effectivePrice = variant ? variant.price : product?.price;
  const effectiveCompare = variant ? variant.compare_at_price : product?.compare_at_price;
  const effectiveStock = variant && variant.stock !== null && variant.stock !== undefined
    ? Number(variant.stock)
    : (product?.stock ?? 0);

  const onAdd = () => {
    const itemForCart = variant
      ? { ...product, price: variant.price, variant_label: variant.label, variant_sku_suffix: variant.sku_suffix }
      : product;
    addItem(itemForCart, qty);
    setCartOpen(true);
  };

  const attributes = useMemo(() => product?.attributes || {}, [product]);

  if (!product) return (
    <div className="ldd-storefront min-h-screen flex items-center justify-center gold">Cargando…</div>
  );

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
              <span className="font-serif text-3xl gold" data-testid="product-detail-price">{formatMoney(effectivePrice)}</span>
              {effectiveCompare && effectiveCompare > effectivePrice && (
                <span className="line-through text-base" style={{ color: "rgba(250,248,245,0.45)" }}>{formatMoney(effectiveCompare)}</span>
              )}
              {product.weight_grams && <span className="text-sm" style={{ color: "rgba(250,248,245,0.5)" }}>· {product.weight_grams} g</span>}
            </div>

            <div className="ldd-divider my-8" />

            <p className="text-base leading-relaxed" style={{ color: "rgba(250,248,245,0.8)" }}>
              {product.long_description || product.description}
            </p>

            {/* Atributos genéricos (raza/feed/etc) + atributos específicos por categoría */}
            <div className="grid grid-cols-2 gap-4 mt-8 text-sm" style={{ color: "rgba(250,248,245,0.75)" }}>
              {product.breed && <div><span className="label-eyebrow block gold mb-1">Raza</span>{product.breed}</div>}
              {product.feed && <div><span className="label-eyebrow block gold mb-1">Alimentación</span>{product.feed}</div>}
              {product.curing_months && <div><span className="label-eyebrow block gold mb-1">Curación</span>{product.curing_months} meses</div>}
              {product.origin && <div><span className="label-eyebrow block gold mb-1">Origen</span>{product.origin}</div>}
              {attributes.denominacion_origen && <div><span className="label-eyebrow block gold mb-1">D.O.</span>{attributes.denominacion_origen}</div>}
              {attributes.milk_origin && <div><span className="label-eyebrow block gold mb-1">Leche</span>{attributes.milk_origin}</div>}
              {attributes.milk_type && <div><span className="label-eyebrow block gold mb-1">Tipo de leche</span>{attributes.milk_type}</div>}
            </div>

            {/* Selector de variantes */}
            {product.variants && product.variants.length > 0 && (
              <div className="mt-10" data-testid="product-variants">
                <span className="label-eyebrow gold block mb-3">Selecciona formato</span>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setVariantIdx(i)}
                      className={`px-4 py-2 text-xs uppercase tracking-[0.18em] border transition-all ${
                        variantIdx === i
                          ? "bg-[#C5A059] text-black border-[#C5A059]"
                          : "border-[rgba(250,248,245,0.25)] text-[rgba(250,248,245,0.85)] hover:border-[#C5A059] hover:text-[#C5A059]"
                      }`}
                      data-testid={`variant-${i}`}
                    >
                      {v.label} <span className="ml-2 opacity-80">{formatMoney(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 flex items-center gap-4">
              <div className="flex items-center border border-[rgba(250,248,245,0.2)] rounded-full">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3 hover:text-[#C5A059]" data-testid="detail-qty-dec">−</button>
                <span className="w-10 text-center font-mono-data">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-4 py-3 hover:text-[#C5A059]" data-testid="detail-qty-inc">+</button>
              </div>
              <button onClick={onAdd} disabled={effectiveStock <= 0} className="ldd-btn-gold flex-1 justify-center disabled:opacity-40" data-testid="detail-add-to-cart">
                {effectiveStock <= 0 ? "Agotado" : "Añadir a la cesta"}
              </button>
            </div>

            <ul className="mt-8 space-y-2 text-sm" style={{ color: "rgba(250,248,245,0.7)" }}>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Envío peninsular 24-48h</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Embalaje refrigerado</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#C5A059]" /> Factura electrónica con IVA</li>
            </ul>
          </div>
        </div>

        {/* Maridaje recomendado (solo si hay quesos asociados) */}
        {pairingCheeses.length > 0 && (
          <section className="mt-24" data-testid="product-pairing">
            <div className="label-eyebrow gold mb-3">A la mesa</div>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-2" style={{ color: "#FAF8F5" }}>
              Marida bien con <span className="font-script italic">estos quesos</span>
            </h2>
            {attributes.pairing_text && (
              <p className="text-sm max-w-2xl mb-10" style={{ color: "rgba(250,248,245,0.7)" }}>{attributes.pairing_text}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 sm:gap-x-6 gap-y-10">
              {pairingCheeses.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        )}

        <ReviewsSection
          productId={product.id}
          initialAvg={product.avg_rating || 0}
          initialCount={product.review_count || 0}
          onStatsChange={({ avg, count }) => setProduct((p) => p ? { ...p, avg_rating: avg, review_count: count } : p)}
        />

        {/* Productos relacionados */}
        {related.length > 0 && (
          <section className="mt-24" data-testid="product-related">
            <div className="label-eyebrow gold mb-3">También te puede interesar</div>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-10" style={{ color: "#FAF8F5" }}>
              Productos <span className="font-script italic">relacionados</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 sm:gap-x-6 gap-y-10">
              {related.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        )}
      </div>
      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
