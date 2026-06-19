import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import ProductCard from "@/components/storefront/ProductCard";
import { api } from "@/lib/api";

const CATEGORY_HEROES = {
  jamones: { title: "Jamones", img: "https://images.unsplash.com/photo-1656423739016-5de747b2c4fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400" },
  embutidos: { title: "Embutidos", img: "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400" },
  lotes: { title: "Lotes Selectos", img: "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400" },
};

export default function CategoryPage() {
  const { slug } = useParams();
  const meta = CATEGORY_HEROES[slug] || { title: slug, img: "" };
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await api.get("/products", { params: { is_active: true } });
      const filtered = data.filter((p) => (p.tags || []).map((t) => t.toLowerCase()).includes(slug.toLowerCase()));
      setProducts(filtered);
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <section className="relative h-[40vh] min-h-[300px] overflow-hidden">
        {meta.img && <img src={meta.img} alt={meta.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 flex items-end pb-12">
          <div className="max-w-[1500px] mx-auto w-full px-6 lg:px-12">
            <div className="label-eyebrow gold mb-3">Categoría</div>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tighter" style={{ color: "#FAF8F5" }}>{meta.title}</h1>
            <Link to="/catalogo" className="label-eyebrow gold mt-4 inline-block hover:opacity-80">← Ver todo el catálogo</Link>
          </div>
        </div>
      </section>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        {loading && <div className="text-center py-20 gold">Cargando…</div>}
        {!loading && products.length === 0 && (
          <div className="text-center py-20" style={{ color: "rgba(250,248,245,0.55)" }}>Pronto añadiremos productos a esta categoría.</div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </div>
      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
