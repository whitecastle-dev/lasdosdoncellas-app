import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import CategoriesBar from "@/components/storefront/CategoriesBar";
import ProductCard from "@/components/storefront/ProductCard";
import { api } from "@/lib/api";

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") || "created_desc";
  const q = params.get("q") || "";
  const categorySlug = params.get("categoria") || "";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, c] = await Promise.all([
          api.get("/products", { params: { is_active: true, sort, q: q || undefined } }),
          api.get("/categories"),
        ]);
        setProducts(p.data || []);
        setCategories((c.data || []).filter((x) => x.is_active !== false));
      } catch {
        setProducts([]);
        setCategories([]);
      }
      setLoading(false);
    })();
  }, [sort, q]);

  // Scroll al inicio al cambiar la categoría — así el cliente nunca aterriza
  // "en mitad" del catálogo al pulsar una tarjeta desde el home.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [categorySlug]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) || null,
    [categories, categorySlug]
  );

  const filtered = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category_id === activeCategory.id);
  }, [products, activeCategory]);

  // Cuenta de productos por categoría
  const counts = useMemo(() => {
    const m = {};
    for (const p of products) {
      if (!p.category_id) continue;
      m[p.category_id] = (m[p.category_id] || 0) + 1;
    }
    return m;
  }, [products]);

  const setParam = (key, value) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      if (value === null || value === undefined || value === "") np.delete(key);
      else np.set(key, value);
      return np;
    });
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <CategoriesBar />
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <div className="label-eyebrow gold mb-2">Tienda</div>
            <h1 className="font-serif text-5xl md:text-6xl tracking-tighter" style={{ color: "#FAF8F5" }}>
              {activeCategory ? activeCategory.name : "Catálogo"}
            </h1>
            <div className="text-xs mt-3" style={{ color: "rgba(250,248,245,0.55)" }}>
              {filtered.length} producto{filtered.length === 1 ? "" : "s"}
              {activeCategory && (
                <button
                  onClick={() => setParam("categoria", "")}
                  className="ml-3 gold hover:underline"
                  data-testid="catalog-clear-category"
                >
                  Limpiar filtro
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Buscar producto…"
              className="bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm text-[#FAF8F5]"
              data-testid="catalog-search"
            />
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              className="bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm text-[#FAF8F5]"
              data-testid="catalog-sort"
            >
              <option value="created_desc" className="bg-black">Más recientes</option>
              <option value="price_asc" className="bg-black">Precio: menor a mayor</option>
              <option value="price_desc" className="bg-black">Precio: mayor a menor</option>
              <option value="name_asc" className="bg-black">Nombre A-Z</option>
            </select>
          </div>
        </div>

        {/* Pestañas de categoría */}
        <div className="flex items-center gap-3 flex-wrap pb-6 mb-10" style={{ borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
          <CategoryChip
            label="Todos"
            count={products.length}
            active={!activeCategory}
            onClick={() => setParam("categoria", "")}
            testid="catalog-cat-all"
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              count={counts[c.id] || 0}
              active={activeCategory?.id === c.id}
              onClick={() => setParam("categoria", c.slug)}
              testid={`catalog-cat-${c.slug}`}
            />
          ))}
        </div>

        {loading && <div className="text-center py-20 gold">Cargando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 max-w-xl mx-auto" data-testid="catalog-empty">
            <div className="label-eyebrow gold mb-4">{activeCategory ? activeCategory.name : "Catálogo"}</div>
            <h3 className="font-serif text-3xl md:text-4xl tracking-tight mb-4" style={{ color: "#FAF8F5" }}>
              Próximamente
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(250,248,245,0.65)" }}>
              {activeCategory
                ? `Pronto añadiremos más productos a la categoría "${activeCategory.name}". Mientras tanto, descubre el resto de nuestro catálogo.`
                : "Aún no hay productos en el catálogo."}
            </p>
            {activeCategory && (
              <button
                onClick={() => setParam("categoria", "")}
                className="ldd-btn-ghost mt-8"
                data-testid="catalog-empty-back"
              >
                Ver todo el catálogo
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 sm:gap-x-6 gap-y-10 sm:gap-y-12">
          {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </div>
      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function CategoryChip({ label, count, active, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`group relative px-4 py-2 text-xs uppercase tracking-[0.18em] transition-all border ${
        active
          ? "bg-[#C5A059] text-black border-[#C5A059]"
          : "border-[rgba(250,248,245,0.18)] text-[rgba(250,248,245,0.75)] hover:border-[#C5A059] hover:text-[#C5A059]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`ml-2 text-[10px] font-mono-data ${active ? "text-black/70" : "opacity-60"}`}
      >
        {count}
      </span>
    </button>
  );
}
