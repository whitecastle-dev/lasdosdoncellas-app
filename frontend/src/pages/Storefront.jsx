import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Clock, Sun, Wheat } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import CategoriesBar from "@/components/storefront/CategoriesBar";
import ProductCard from "@/components/storefront/ProductCard";
import StarRating from "@/components/StarRating";
import { api } from "@/lib/api";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
  "https://images.unsplash.com/photo-1534655882117-f9eff36a1574?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
  "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
];

const CATEGORY_TILES = [
  {
    slug: "jamones",
    label: "Jamones",
    sub: "Pieza entera, corte a cuchillo, loncheado al vacío.",
    img: "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  },
  {
    slug: "embutidos",
    label: "Embutidos",
    sub: "Chorizo, salchichón, lomo y caña de lomo — todo de bellota.",
    img: "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  },
  {
    slug: "lotes",
    label: "Lotes & Regalos",
    sub: "Cajas curadas para regalar, configura el tuyo a medida.",
    img: "https://images.unsplash.com/photo-1656423739016-5de747b2c4fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  },
];

const PROCESS_STEPS = [
  { icon: Wheat, title: "Bellota & dehesa", text: "Cerdos ibéricos criados en libertad por la Sierra Norte de Sevilla." },
  { icon: Clock, title: "Curado lento", text: "De 24 a 48 meses en bodega natural — sin atajos, sin prisas." },
  { icon: Sun, title: "Sabor de Castilblanco", text: "Aire seco, encinas y sal — el secreto del sabor que recuerdas." },
];

function HeroSlider() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative h-[78vh] min-h-[520px] overflow-hidden">
      {HERO_IMAGES.map((src, i) => (
        <div key={src} className="absolute inset-0 transition-opacity duration-[1800ms]" style={{ opacity: i === idx ? 1 : 0 }}>
          <img src={src} alt="" className="w-full h-full object-cover" style={{ transform: i === idx ? "scale(1.06)" : "scale(1)", transition: "transform 8s ease-out" }} />
        </div>
      ))}
      <div className="absolute inset-0 hero-gradient" />
      <div className="relative z-10 h-full max-w-[1500px] mx-auto px-6 lg:px-12 flex flex-col justify-end pb-16 md:pb-20">
        <div className="fade-up">
          <div className="label-eyebrow gold mb-6" data-testid="hero-eyebrow">Productos Ibéricos · Sierra Norte de Sevilla</div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] max-w-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>
            El sabor de <span className="font-script gold italic font-normal">Castilblanco</span>,
            servido a domicilio.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed" style={{ color: "rgba(250,248,245,0.78)" }}>
            Curados a mano en Castilblanco de los Arroyos. Sin atajos. Sin prisas.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/catalogo" className="ldd-btn-gold" data-testid="hero-cta-shop">
              Comprar ahora <ArrowRight size={16} />
            </Link>
            <Link to="/lotes/configurador" className="ldd-btn-ghost" data-testid="hero-cta-lote">
              Configura tu lote
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryTiles() {
  return (
    <section className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-24 pb-4" data-testid="home-category-tiles">
      <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow gold mb-3">La casa</div>
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight" style={{ color: "#FAF8F5" }}>
            Explora <span className="font-script italic">por categoría</span>
          </h2>
        </div>
        <Link to="/catalogo" className="ldd-btn-ghost" data-testid="home-tiles-all">Ver todo</Link>
      </div>
      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {CATEGORY_TILES.map((c) => (
          <Link
            key={c.slug}
            to={c.slug === "lotes" ? "/lotes/configurador" : `/categoria/${c.slug}`}
            className="group relative block overflow-hidden aspect-[3/4] border border-[rgba(197,160,89,0.18)]"
            data-testid={`home-tile-${c.slug}`}
          >
            <img
              src={c.img}
              alt={c.label}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-105"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.25) 0%, rgba(10,10,10,0.55) 60%, rgba(10,10,10,0.92) 100%)" }}
            />
            <div className="relative z-10 h-full flex flex-col justify-end p-8">
              <div className="label-eyebrow gold mb-3">Categoría</div>
              <h3 className="font-serif text-3xl md:text-4xl tracking-tight" style={{ color: "#FAF8F5" }}>
                {c.label}
              </h3>
              <p className="mt-3 text-sm leading-relaxed max-w-xs" style={{ color: "rgba(250,248,245,0.75)" }}>
                {c.sub}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] gold opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                Descubrir <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedProducts({ items }) {
  if (!items.length) return null;
  return (
    <section className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-24 pb-12">
      <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow gold mb-3">Selección de la casa</div>
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight" style={{ color: "#FAF8F5" }}>
            Lo más <span className="font-script italic">exquisito</span>
          </h2>
        </div>
        <Link to="/catalogo" className="ldd-btn-ghost" data-testid="home-view-all">Ver catálogo completo</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
        {items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function StatsStrip() {
  const stats = [
    { k: "+30", v: "Productos artesanales" },
    { k: "48m", v: "Curado máximo en bodega" },
    { k: "100%", v: "Bellota ibérica certificada" },
    { k: "24h", v: "Envíos a península" },
  ];
  return (
    <section className="border-y mt-12" style={{ borderColor: "rgba(197,160,89,0.18)", background: "rgba(10,10,10,0.45)" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.v} className="text-center md:text-left">
            <div className="font-serif text-4xl md:text-5xl gold tracking-tight">{s.k}</div>
            <div className="label-eyebrow mt-2" style={{ color: "rgba(250,248,245,0.65)" }}>{s.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-28 pb-16" data-testid="home-process">
      <div className="text-center mb-16">
        <div className="label-eyebrow gold mb-3">El oficio</div>
        <h2 className="font-serif text-4xl md:text-5xl tracking-tight" style={{ color: "#FAF8F5" }}>
          Tres pasos. <span className="font-script italic">Mucho tiempo.</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-10 md:gap-16">
        {PROCESS_STEPS.map((s, i) => (
          <div key={s.title} className="flex flex-col items-start group">
            <div className="flex items-center gap-4 mb-5">
              <span className="font-mono-data text-xs gold opacity-60" style={{ letterSpacing: "0.3em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-12 transition-all group-hover:w-20" style={{ background: "rgba(197,160,89,0.6)" }} />
            </div>
            <s.icon size={28} className="mb-5" style={{ color: "#C5A059" }} />
            <h3 className="font-serif text-2xl md:text-3xl tracking-tight mb-3" style={{ color: "#FAF8F5" }}>{s.title}</h3>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: "rgba(250,248,245,0.7)" }}>{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandStrip() {
  return (
    <section className="relative py-20 mt-12 overflow-hidden" style={{ background: "#171210" }}>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="label-eyebrow gold mb-3">Tradición</div>
          <h2 className="font-serif text-4xl md:text-6xl tracking-tighter" style={{ color: "#FAF8F5" }}>
            Curado entre <span className="font-script italic">encinas y barricas</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed max-w-md" style={{ color: "rgba(250,248,245,0.7)" }}>
            En Castilblanco de los Arroyos, en plena Sierra Norte de Sevilla, criamos cerdos ibéricos en libertad
            y dejamos que sean el tiempo, el aire y la sal los que hagan su magia.
          </p>
          <Link to="/nosotros" className="ldd-btn-gold mt-8 inline-flex" data-testid="home-about-cta">Conoce nuestra historia</Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <img src="https://images.unsplash.com/photo-1656423739016-5de747b2c4fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" alt="" className="row-span-2 w-full h-full object-cover aspect-[3/4]" />
          <img src="https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" alt="" className="w-full h-full object-cover aspect-square" />
          <img src="https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" alt="" className="w-full h-full object-cover aspect-square" />
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ reviews }) {
  if (!reviews.length) return null;
  return (
    <section className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-28 pb-20" data-testid="home-testimonials">
      <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow gold mb-3">Voces de la mesa</div>
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight" style={{ color: "#FAF8F5" }}>
            Lo que dicen <span className="font-script italic">nuestros clientes</span>
          </h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.slice(0, 6).map((r) => (
          <div
            key={r.id}
            className="border p-7 flex flex-col"
            style={{ borderColor: "rgba(197,160,89,0.22)", background: "rgba(23,18,16,0.6)" }}
            data-testid={`home-testimonial-${r.id}`}
          >
            <StarRating value={r.rating || 5} size={14} readOnly />
            <p className="mt-5 text-sm leading-relaxed flex-1" style={{ color: "rgba(250,248,245,0.85)" }}>
              {(r.comment || "").length > 220 ? `${r.comment.slice(0, 220)}…` : (r.comment || "Excelente producto.")}
            </p>
            <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <div className="font-serif text-base" style={{ color: "#FAF8F5" }}>
                {r.customer_name || "Cliente"}
              </div>
              {r.product_name && (
                <div className="text-xs mt-1 gold opacity-80">{r.product_name}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0f0b 0%, #0A0A0A 100%)" }}>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "url(https://images.unsplash.com/photo-1534655882117-f9eff36a1574?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "grayscale(40%) brightness(0.45)",
      }} />
      <div className="relative max-w-[900px] mx-auto px-6 lg:px-12 py-28 text-center">
        <Award size={32} className="mx-auto mb-6" style={{ color: "#C5A059" }} />
        <h2 className="font-serif text-4xl md:text-6xl tracking-tighter" style={{ color: "#FAF8F5" }}>
          Lleva la <span className="font-script italic gold">Sierra Norte</span><br />a tu mesa.
        </h2>
        <p className="mt-6 max-w-xl mx-auto text-base leading-relaxed" style={{ color: "rgba(250,248,245,0.75)" }}>
          Envíos en 24–48 h a toda la península. Embalaje térmico, sin sorpresas.
        </p>
        <div className="mt-10 flex justify-center gap-4 flex-wrap">
          <Link to="/catalogo" className="ldd-btn-gold" data-testid="home-closing-cta-shop">
            Empezar a comprar <ArrowRight size={16} />
          </Link>
          <Link to="/lotes/configurador" className="ldd-btn-ghost" data-testid="home-closing-cta-lote">
            Configurar lote regalo
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Storefront() {
  const [featured, setFeatured] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/products", { params: { is_active: true, featured: true } });
        let list = (data || []).slice(0, 4);
        if (list.length < 4) {
          // Si no hay suficientes destacados, completar con los más recientes
          const { data: all } = await api.get("/products", { params: { is_active: true } });
          const ids = new Set(list.map((p) => p.id));
          for (const p of all || []) {
            if (list.length >= 4) break;
            if (!ids.has(p.id)) list.push(p);
          }
        }
        setFeatured(list);
      } catch { /* ignore */ }
      try {
        const { data } = await api.get("/reviews/recent", { params: { limit: 6, min_rating: 4 } });
        setReviews(data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div className="ldd-storefront min-h-screen relative">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <HeroSlider />
      <CategoriesBar />
      <CategoryTiles />
      <FeaturedProducts items={featured} />
      <StatsStrip />
      <ProcessSection />
      <BrandStrip />
      <TestimonialsSection reviews={reviews} />
      <ClosingCTA />
      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
