import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import CategoriesBar from "@/components/storefront/CategoriesBar";
import ProductCard, { imgSrc } from "@/components/storefront/ProductCard";
import { api } from "@/lib/api";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
  "https://images.unsplash.com/photo-1534655882117-f9eff36a1574?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
  "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400",
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

export default function Storefront() {
  const [featured, setFeatured] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/products", { params: { is_active: true, featured: true } });
      setFeatured(data.slice(0, 4));
    })();
  }, []);

  return (
    <div className="ldd-storefront min-h-screen relative">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <HeroSlider />
      <CategoriesBar />

      {/* Featured */}
      <section className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-24 pb-12">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="label-eyebrow gold mb-3">Selección de la casa</div>
            <h2 className="font-serif text-4xl md:text-5xl tracking-tight" style={{ color: "#FAF8F5" }}>Lo más exquisito</h2>
          </div>
          <Link to="/catalogo" className="ldd-btn-ghost" data-testid="home-view-all">Ver catálogo completo</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Brand strip */}
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

      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
