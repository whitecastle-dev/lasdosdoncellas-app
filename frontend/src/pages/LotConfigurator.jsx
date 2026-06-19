import React, { useEffect, useState } from "react";
import { Plus, Minus, ShoppingBag, Check, X } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import { api, formatMoney } from "@/lib/api";
import { imgSrc } from "@/components/storefront/ProductCard";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

const BOX_SIZES = [
  { id: "petite", name: "Caja Petite", capacity: 3, price: 8.00, desc: "3 productos · ideal regalo individual" },
  { id: "selecto", name: "Caja Selecta", capacity: 5, price: 12.00, desc: "5 productos · regalo premium" },
  { id: "magna", name: "Caja Magna", capacity: 8, price: 18.00, desc: "8 productos · para los más exigentes" },
];

export default function LotConfigurator() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState({}); // {product_id: qty}
  const [boxId, setBoxId] = useState("selecto");
  const [cartOpen, setCartOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    api.get("/products", { params: { is_active: true } }).then((r) => {
      // exclude lots themselves
      setProducts(r.data.filter((p) => !(p.tags || []).map((t) => t.toLowerCase()).includes("lotes")));
    });
  }, []);

  const box = BOX_SIZES.find((b) => b.id === boxId);
  const totalQty = Object.values(selected).reduce((s, v) => s + v, 0);
  const itemsTotal = Object.entries(selected).reduce((s, [id, qty]) => {
    const p = products.find((x) => x.id === id);
    return s + (p ? p.price * qty : 0);
  }, 0);
  const finalPrice = itemsTotal + (box?.price || 0);
  const capacityLeft = (box?.capacity || 0) - totalQty;

  const change = (id, delta) => {
    setSelected((prev) => {
      const cur = prev[id] || 0;
      const next = Math.max(0, cur + delta);
      if (delta > 0 && totalQty >= (box?.capacity || 0)) {
        toast.error(`La ${box.name} solo permite ${box.capacity} productos`);
        return prev;
      }
      const np = { ...prev, [id]: next };
      if (next === 0) delete np[id];
      return np;
    });
  };

  const buildAndAdd = () => {
    if (totalQty === 0) {
      toast.error("Añade al menos un producto");
      return;
    }
    if (totalQty < (box.capacity)) {
      setShowConfirm(true);
      return;
    }
    confirmBuild();
  };

  const confirmBuild = () => {
    const selectedProducts = Object.entries(selected).map(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      return `${p.name} × ${qty}`;
    }).join(", ");
    const lot = {
      id: `lote-${boxId}-${Date.now()}`,
      name: `${box.name} personalizada`,
      price: finalPrice,
      image_urls: [Object.keys(selected)[0] ? products.find((p) => p.id === Object.keys(selected)[0])?.image_urls?.[0] : null].filter(Boolean),
      _custom_lot: true,
      _description: selectedProducts,
    };
    addItem(lot, 1);
    setShowConfirm(false);
    setCartOpen(true);
    toast.success(`${box.name} añadida a la cesta`);
    setSelected({});
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => setCartOpen(true)} />
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        <div className="label-eyebrow gold mb-3">Tu lote a medida</div>
        <h1 className="font-serif text-5xl md:text-7xl tracking-tighter" style={{ color: "#FAF8F5" }}>
          Compón tu <span className="font-script italic">caja regalo</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: "rgba(250,248,245,0.7)" }}>
          Elige el tamaño de tu caja y rellénala con los productos que más te gusten.
          Empaquetamos a mano con tarjeta personalizada incluida.
        </p>

        {/* Steps */}
        <div className="mt-12">
          <div className="label-eyebrow gold mb-4">1. Elige tu caja</div>
          <div className="grid sm:grid-cols-3 gap-4">
            {BOX_SIZES.map((b) => (
              <button key={b.id} onClick={() => setBoxId(b.id)}
                className={`text-left p-6 border transition ${boxId === b.id ? "border-[#C5A059] bg-[rgba(197,160,89,0.05)]" : "border-[rgba(250,248,245,0.15)] hover:border-[rgba(197,160,89,0.4)]"}`}
                data-testid={`box-option-${b.id}`}>
                <div className="font-serif text-xl" style={{ color: "#FAF8F5" }}>{b.name}</div>
                <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.6)" }}>{b.desc}</div>
                <div className="mt-3 gold font-mono-data text-sm">+ {formatMoney(b.price)} packaging</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1fr_360px] gap-10">
          <div>
            <div className="label-eyebrow gold mb-4">2. Llena tu caja ({totalQty}/{box.capacity} productos)</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => (
                <div key={p.id} className="border border-[rgba(197,160,89,0.18)] overflow-hidden" data-testid={`lot-product-${p.id}`}>
                  <div className="aspect-[4/3] bg-[#171717] overflow-hidden">
                    {p.image_urls?.[0] && <img src={imgSrc(p.image_urls[0])} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-4">
                    <div className="font-serif text-base leading-tight" style={{ color: "#FAF8F5" }}>{p.name}</div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs gold font-mono-data">{formatMoney(p.price)}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => change(p.id, -1)} disabled={!selected[p.id]} className="w-7 h-7 border border-[rgba(250,248,245,0.2)] hover:border-[#C5A059] disabled:opacity-30 flex items-center justify-center" data-testid={`lot-dec-${p.id}`}><Minus size={11} /></button>
                        <span className="w-6 text-center text-sm font-mono-data">{selected[p.id] || 0}</span>
                        <button onClick={() => change(p.id, 1)} disabled={capacityLeft <= 0} className="w-7 h-7 border border-[rgba(250,248,245,0.2)] hover:border-[#C5A059] disabled:opacity-30 flex items-center justify-center" data-testid={`lot-inc-${p.id}`}><Plus size={11} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 self-start border border-[rgba(197,160,89,0.25)] p-6 h-fit">
            <div className="label-eyebrow gold">Tu lote</div>
            <div className="font-serif text-2xl mt-1" style={{ color: "#FAF8F5" }}>{box.name}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }}>{totalQty} de {box.capacity} productos</div>
            <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto">
              {Object.entries(selected).map(([id, qty]) => {
                const p = products.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex justify-between text-sm py-1 border-b border-[rgba(197,160,89,0.1)]">
                    <span>{p.name} × {qty}</span>
                    <span className="font-mono-data gold">{formatMoney(p.price * qty)}</span>
                  </div>
                );
              })}
              {totalQty === 0 && <div className="text-xs" style={{ color: "rgba(250,248,245,0.45)" }}>Aún no has elegido productos.</div>}
            </div>
            <div className="mt-4 pt-4 border-t border-[rgba(197,160,89,0.2)] text-sm space-y-1">
              <div className="flex justify-between"><span style={{ color: "rgba(250,248,245,0.6)" }}>Productos</span><span className="font-mono-data">{formatMoney(itemsTotal)}</span></div>
              <div className="flex justify-between"><span style={{ color: "rgba(250,248,245,0.6)" }}>Packaging</span><span className="font-mono-data">{formatMoney(box.price)}</span></div>
              <div className="flex justify-between pt-3 border-t border-[rgba(197,160,89,0.2)] mt-2"><span className="label-eyebrow">Total</span><span className="font-serif text-2xl gold">{formatMoney(finalPrice)}</span></div>
            </div>
            <button onClick={buildAndAdd} disabled={totalQty === 0} className="ldd-btn-gold w-full justify-center mt-5 disabled:opacity-40" data-testid="lot-add-to-cart">
              <ShoppingBag size={14} /> Añadir a la cesta
            </button>
          </aside>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 cart-backdrop flex items-center justify-center px-6" onClick={() => setShowConfirm(false)}>
          <div className="bg-[#0A0A0A] border border-[#C5A059] max-w-md w-full p-8" onClick={(e) => e.stopPropagation()} data-testid="lot-confirm-modal">
            <div className="label-eyebrow gold mb-2">Quedan huecos</div>
            <h2 className="font-serif text-3xl tracking-tighter" style={{ color: "#FAF8F5" }}>Tu caja no está completa</h2>
            <p className="mt-4 text-sm" style={{ color: "rgba(250,248,245,0.7)" }}>
              Has elegido {totalQty} de {box.capacity} productos. ¿Quieres continuar con la caja
              incompleta o seguir añadiendo?
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={confirmBuild} className="ldd-btn-gold flex-1 justify-center" data-testid="lot-confirm-yes">Añadir igualmente</button>
              <button onClick={() => setShowConfirm(false)} className="ldd-btn-ghost flex-1" data-testid="lot-confirm-no">Seguir eligiendo</button>
            </div>
          </div>
        </div>
      )}

      <StoreFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
