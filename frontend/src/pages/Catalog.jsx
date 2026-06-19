import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, c] = await Promise.all([
        api.get("/products", { params: { is_active: true, sort, q: q || undefined } }),
        api.get("/categories"),
      ]);
      setProducts(p.data);
      setCategories(c.data);
      setLoading(false);
    })();
  }, [sort, q]);

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <CategoriesBar />
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <div className="label-eyebrow gold mb-2">Tienda</div>
            <h1 className="font-serif text-5xl md:text-6xl tracking-tighter" style={{ color: "#FAF8F5" }}>Catálogo</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={q}
              onChange={(e) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("q", e.target.value); return np; })}
              placeholder="Buscar producto…"
              className="bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm text-[#FAF8F5]"
              data-testid="catalog-search"
            />
            <select
              value={sort}
              onChange={(e) => setParams((prev) => { const np = new URLSearchParams(prev); np.set("sort", e.target.value); return np; })}
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

        {loading && <div className="text-center py-20 gold">Cargando…</div>}
        {!loading && products.length === 0 && (
          <div className="text-center py-20" style={{ color: "rgba(250,248,245,0.55)" }}>No se han encontrado productos.</div>
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
